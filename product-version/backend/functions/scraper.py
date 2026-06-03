from __future__ import annotations

import os
import re
import sys
import time
from datetime import datetime
from difflib import SequenceMatcher
import json, pathlib

import requests
from bs4 import BeautifulSoup
from supabase import create_client

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)



DATA_DIR = pathlib.Path(__file__).parent.parent / "data"

FIELDS_DATA    = json.loads((DATA_DIR / "fields.json").read_text())
LOCATIONS_DATA = json.loads((DATA_DIR / "locations.json").read_text())

FIELD_SUPERSET = {f["value"]: f["superset"] for f in FIELDS_DATA["fields"]}
LOCATION_TO_COUNTRY = {loc["value"].lower(): loc["country"] for loc in LOCATIONS_DATA["locations"]}


REQUEST_DELAY   = 2
TIME_SECONDS    = 21600  ## 6 Hours
MAX_JOBS_TOTAL  = 100_000  ## per scrape
BASE_DEPTH      = 250
MAX_DEPTH       = 5000


#-------------------------------------------------------------#
def desc_similarity(a: str, b: str) -> float:
    if not a or not b:
        return 0.0
    return SequenceMatcher(None, a[:2000], b[:2000]).ratio()



#-------------------------------------------------------------#
### Fetch all data from table, and create sets and search_matrix
def fetch_all_dashboard_configs() -> list[dict]:
    resp = supabase.table("dashboard_configs").select(
        "id, profile_id, include_skills, include_fields, include_locations, job_types"  ## ignoring include_companies for now, not everyone has preferences on here, gets filtered later regardless.
    ).eq("active", True).execute()
    return resp.data or []

def build_sets(configs: list[dict]) -> tuple[set[str], set[str], set[str], set[str]]:
    skills: set[str]    = set()
    fields: set[str]    = set()
    locations: set[str] = set()
    job_types: set[str] = set()

    for cfg in configs:
        for s in (cfg.get("include_skills") or []):
            skills.add(s.lower().strip())
        for f in (cfg.get("include_fields") or []):
            fields.add(f.lower().strip())
        for loc in (cfg.get("include_locations") or []):
            locations.add(loc.lower().strip())
        for jt in (cfg.get("job_types") or []):
            job_types.add(jt.lower().strip())

    if not skills or not fields or not locations or not job_types:
        print("[scraper] incomplete configs — exiting")
        return set(), set(), set(), set()

    return skills, fields, locations, job_types


## go config by config, mapping importance of every search field by country to then fetch depth
def compute_votes(configs: list[dict]) -> dict[tuple[str, str], int]:
    votes: dict[tuple[str, str], int] = {}
    for cfg in configs:
        cfg_supersets = {FIELD_SUPERSET.get(f.lower().strip()) for f in (cfg.get("include_fields") or [])} - {None}
        cfg_countries = {LOCATION_TO_COUNTRY.get(loc.lower().strip()) for loc in (cfg.get("include_locations") or [])} - {None}
        for superset in cfg_supersets:
            for country in cfg_countries:
                votes[(superset, country)] = votes.get((superset, country), 0) + 1
    return votes


## will have to redesign depth logic in here though later!!
def get_depth(superset: str, country: str, votes: dict[tuple[str, str], int]) -> int:
    return min(BASE_DEPTH * max(1, votes.get((superset, country), 1)), MAX_DEPTH)


def build_search_matrix(fields: set[str], locations: set[str], job_types: set[str], votes: dict[tuple[str, str], int]) -> list[tuple[str, str, str]]:
    supersets: set[str] = set()
    countries: set[str] = set()

    for f in fields:
        superset = FIELD_SUPERSET.get(f)
        if superset:
            supersets.add(superset)

    for loc in locations:
        country = LOCATION_TO_COUNTRY.get(loc)
        if country:
            countries.add(country)

    if not supersets or not countries:
        print("[scraper] couldn't map fields/locations to search matrix — exiting")
        return []

    ## search configs:
    return [
        (f"{superset} {job_type}",  country, job_type, get_depth(superset, country, votes))
        for superset in supersets
        for country in countries
        for job_type in job_types
    ]
    
    
    
    
### layers 1-5;

def layer1_fields_in_title(fields: set[str], title_lower: str) -> bool:
    supersets = {FIELD_SUPERSET.get(f) for f in fields} - {None}
    
    for f in fields:
        if f in title_lower:
            return True
    for broad in supersets:
        if broad in title_lower:
            return True
    return False
    
    
def layer2_dedup(
    url: str,
    title: str,
    company: str,
    job_location: str,
    desc_text: str,
    url_set: set[str],
    title_company_map: dict[tuple[str, str], dict],
) -> tuple[str, dict | None]:
    """
        Returns:
        ("skip", None)        → already exists, nothing to do
        ("replace", existing) → repost, same location, replace existing
        ("merge", existing)   → same job, new location, merge locations
        ("insert", None)      → new job, proceed with insert
    """
    
    if url in url_set:
        return "skip", None
    
    tc_key = (title.lower().strip(), company.lower().strip())

    if tc_key in title_company_map:
        existing = title_company_map[tc_key]
        sim = desc_similarity(desc_text, existing.get("description") or "")
        if sim > 0.85:
            existing_locs = existing.get("locations")
            if job_location in existing_locs:
                return "replace", existing
            else:
                return "merge", existing

        return "insert", None
    return "insert", None



    
#-------------------------------------------------------------#
### HAVE TO REVIEW AND PERHAPS REWRITE EVERYTHING BELOW OF HERE
#-------------------------------------------------------------#
### Layer 3: extract metadata from title + description
def layer3_extract_metadata(
    title: str,
    desc_text: str,
    skills: set[str],
    fields: set[str],
    ex_skills: set[str],
    ex_fields: set[str],
) -> tuple[list[str], list[str], dict | None, dict | None, str | None, bool]:
    title_lower = title.lower()
    desc_lower  = desc_text.lower()
    combined    = title_lower + " " + desc_lower

    ## --- exclude check first, bail early ---
    for ex in ex_fields:
        if ex in combined:
            return [], [], None, None, None, False
    for ex in ex_skills:
        if re.search(rf'\b{re.escape(ex)}\b', combined):
            return [], [], None, None, None, False

    ## --- match fields ---
    matched_fields: list[str] = []
    for f in fields:
        if f == "ai":
            if re.search(r'\bai\b', combined):
                matched_fields.append(f)
        elif f in combined:
            matched_fields.append(f)

    ## also check superset keys (broad categories)
    for broad in FIELD_SUPERSET:
        if broad in combined and broad not in matched_fields:
            matched_fields.append(broad)

    ## --- match skills ---
    matched_skills: list[str] = []
    for s in skills:
        if s == "c":
            if re.search(r'\bc\b', combined):
                matched_skills.append(s)
        elif s == "r":
            if re.search(r'\br\b', combined):
                matched_skills.append(s)
        elif s in combined:
            matched_skills.append(s)

    ## --- layer 4: salary ---
    salary: dict | None = None
    salary_patterns = [
        r'\$\s*(\d[\d,]*)\s*(?:k|,000)?\s*(?:[-–]\s*\$?\s*(\d[\d,]*)\s*(?:k|,000)?)?\s*(?:\/\s*(?:hr|hour|yr|year|annum))?',
        r'(\d+)\s*(?:k|,000)\s*(?:[-–]\s*(\d+)\s*(?:k|,000)?)?\s*(?:per\s+(?:year|hour|annum))?',
        r'(?:salary|compensation|pay|rate)[:\s]+\$?\s*(\d[\d,]+)',
    ]
    for pattern in salary_patterns:
        m = re.search(pattern, combined, re.IGNORECASE)
        if m:
            salary = {"raw": m.group(0).strip()}
            break

    ## --- layer 4: requirements ---
    requirements: dict | None = None
    req_signals = [
        "bachelor", "master", "phd", "degree", "diploma",
        "pursuing", "enrolled", "currently studying",
        "gpa", "1st year", "2nd year", "3rd year", "4th year",
        "final year", "penultimate", "recent graduate", "new grad",
        "years of experience", "year of experience",
        "no experience", "entry level", "junior",
    ]
    found_reqs = [sig for sig in req_signals if sig in combined]
    if found_reqs:
        snippet_start = max(0, combined.find(found_reqs[0]) - 50)
        snippet_end   = min(len(combined), snippet_start + 300)
        requirements  = {"signals": found_reqs, "snippet": combined[snippet_start:snippet_end]}

    ## --- layer 4: duration/season ---
    duration: str | None = None
    duration_patterns = [
        r'(\d+)\s*[-–]?\s*month',
        r'(fall|winter|summer|spring|autumn)\s+(?:term|semester|co-?op|internship|placement)',
        r'(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{4}',
        r'(q[1-4])\s+\d{4}',
        r'(full[- ]?year|year[- ]?long|permanent|contract)',
        r'(\d+)\s*(?:week|weeks)',
    ]
    for dp in duration_patterns:
        m = re.search(dp, combined, re.IGNORECASE)
        if m:
            duration = m.group(0).strip()
            break

    is_relevant = bool(matched_fields or matched_skills)
    return matched_fields, matched_skills, requirements, salary, duration, is_relevant


#-------------------------------------------------------------#
### Fetch full job description + tags from LinkedIn job posting
def fetch_job_detail(job_id: str) -> tuple[str, list[str]]:
    try:
        resp = requests.get(
            f"https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/{job_id}",
            headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"},
            timeout=15,
        )
        soup    = BeautifulSoup(resp.text, "html.parser")
        desc_el = soup.select_one("[class*=description] > section > div")
        tags_el = soup.select_one("[class*=_job-criteria-list]")
        desc    = desc_el.get_text(separator=" ", strip=True) if desc_el else ""
        tags    = [t.strip() for t in tags_el.get_text(separator="|").split("|") if t.strip()] if tags_el else []
        return desc, tags
    except Exception:
        return "", []


#-------------------------------------------------------------#
### Layer 1: at least one user field must appear in the title
def layer1_field_in_title(title_lower: str, fields: set[str]) -> bool:
    for f in fields:
        if f == "ai":
            if re.search(r'\bai\b', title_lower):
                return True
        elif f in title_lower:
            return True
    ## also accept if a superset key appears in the title
    for broad in FIELD_SUPERSET:
        if broad in title_lower:
            return True
    return False


#-------------------------------------------------------------#
### Main scraper run
def run():
    print(f"[scraper] run started at {datetime.now().isoformat()}")

    ## --- pull configs ---
    configs = fetch_all_dashboard_configs()
    if not configs:
        print("[scraper] no active configs — exiting")
        return

    print(f"[scraper] {len(configs)} active dashboard config(s) loaded")

    ## --- build union sets across all users ---
    skills, fields, locations, job_types = build_sets(configs)
    if not skills or not fields or not locations or not job_types:
        return

    ex_skills: set[str] = set()
    ex_fields: set[str] = set()
    for cfg in configs:
        for s in (cfg.get("exclude_skills") or []):
            ex_skills.add(s.lower().strip())
        for f in (cfg.get("exclude_fields") or []):
            ex_fields.add(f.lower().strip())

    ## --- compute votes and build search matrix ---
    votes         = compute_votes(configs)
    search_matrix = build_search_matrix(fields, locations, job_types, votes)

    if not search_matrix:
        print("[scraper] empty search matrix — exiting")
        return

    print(f"[scraper] search matrix: {len(search_matrix)} entries")

    ## --- pull existing jobs into memory for dedup ---
    existing_resp = supabase.table("jobs").select("id, url, title, company, locations, description").execute()
    existing_rows = existing_resp.data or []

    url_set: set[str] = {r["url"] for r in existing_rows}
    title_company_map: dict[tuple[str, str], dict] = {
        (r["title"].lower().strip(), r["company"].lower().strip()): r
        for r in existing_rows
    }

    print(f"[scraper] {len(url_set)} existing jobs loaded into memory")

    ## --- scrape ---
    total_inserted  = 0
    country_scraped: dict[str, int] = {}

    for keyword, country, job_type, depth_limit in search_matrix:
        if total_inserted >= MAX_JOBS_TOTAL:
            break

        if country_scraped.get(country, 0) >= depth_limit:
            continue

        print(f"\n[scraper] keyword='{keyword}' | country='{country}' | depth={depth_limit}")
        start = 0

        while total_inserted < MAX_JOBS_TOTAL:
            if country_scraped.get(country, 0) >= depth_limit:
                break

            try:
                resp = requests.get(
                    "https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search",
                    params={
                        "keywords": keyword,
                        "location": country,
                        "f_TPR":    f"r{TIME_SECONDS}",
                        "start":    start,
                    },
                    headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"},
                    timeout=15,
                )
            except Exception as e:
                print(f"[scraper] request error: {e}")
                break

            soup  = BeautifulSoup(resp.text, "html.parser")
            cards = soup.find_all("div", class_="base-card")
            if not cards:
                break

            for card in cards:
                ## --- pull basic card info ---
                title_el = card.select_one("[class*=_title]")
                title    = title_el.get_text(strip=True) if title_el else None
                if not title:
                    continue

                title_lower = title.lower()

                ## --- layer 1: field must appear in title ---
                if not layer1_field_in_title(title_lower, fields):
                    continue

                url_el = card.select_one("[class*=_full-link]")
                url    = url_el["href"].split("?")[0] if url_el and url_el.get("href") else None
                if not url:
                    continue

                company_el   = card.select_one("[class*=_subtitle]")
                location_el  = card.select_one("[class*=_location]")
                company      = company_el.get_text(strip=True)  if company_el  else "Unknown"
                job_location = location_el.get_text(strip=True) if location_el else country

                title_key = title_lower.strip()
                company_key = company.lower().strip()
                tc_key = (title_key, company_key)

                ## --- fetch full description ---
                job_id = url.split("-")[-1]
                desc_text, tags = fetch_job_detail(job_id)
                time.sleep(REQUEST_DELAY)

                ## --- layer 3 + 4: relevance + metadata ---
                matched_fields, matched_skills, requirements, salary, duration, is_relevant = layer3_extract_metadata(
                    title, desc_text, skills, fields, ex_skills, ex_fields
                )

                if not is_relevant:
                    continue

                ## --- layer 2: dedup ---
                if url in url_set:
                    continue

                if tc_key in title_company_map:
                    existing     = title_company_map[tc_key]
                    sim          = desc_similarity(desc_text, existing.get("description") or "")
                    existing_locs = existing.get("locations") or [existing.get("location", "")]
                    same_location = job_location in existing_locs

                    if sim > 0.85:
                        if same_location:
                            ## repost — replace
                            try:
                                supabase.table("jobs").update({
                                    "url":         url,
                                    "description": desc_text,
                                    "fields":      matched_fields,
                                    "skills":      matched_skills,
                                    "requirements":requirements,
                                    "salary":      salary,
                                    "duration":    duration,
                                    "scraped_at":  datetime.now().isoformat(),
                                }).eq("id", existing["id"]).execute()
                                url_set.discard(existing["url"])
                                url_set.add(url)
                                title_company_map[tc_key]["url"] = url
                                print(f"[dedup] REPLACED repost: {title} @ {company}")
                            except Exception as e:
                                print(f"[dedup] replace error: {e}")
                        else:
                            ## same job, different location — merge
                            try:
                                merged_locs = list(set(existing_locs + [job_location]))
                                supabase.table("jobs").update({
                                    "locations": merged_locs,
                                }).eq("id", existing["id"]).execute()
                                title_company_map[tc_key]["locations"] = merged_locs
                                print(f"[dedup] MERGED location: {title} @ {company} → {merged_locs}")
                            except Exception as e:
                                print(f"[dedup] merge error: {e}")
                        url_set.add(url)
                        continue

                ## --- layer 5: insert new job ---
                item = {
                    "url":          url,
                    "title":        title,
                    "company":      company,
                    "location":     job_location,
                    "locations":    [job_location],
                    "description":  desc_text or None,
                    "source":       "linkedin",
                    "fields":       matched_fields,
                    "skills":       matched_skills,
                    "requirements": requirements,
                    "salary":       salary,
                    "duration":     duration,
                    "scraped_at":   datetime.now().isoformat(),
                }

                try:
                    supabase.table("jobs").insert(item).execute()
                    url_set.add(url)
                    title_company_map[tc_key] = item
                    country_scraped[country]  = country_scraped.get(country, 0) + 1
                    total_inserted           += 1
                    print(f"[{total_inserted}] {title} @ {company} ({job_location})")
                except Exception as e:
                    if "duplicate" not in str(e).lower():
                        print(f"[scraper] insert error: {e}")
                    continue

            start += 10

    print(f"\n[scraper] finished at {datetime.now().isoformat()} — {total_inserted} new jobs inserted")


if __name__ == "__main__":
    run()