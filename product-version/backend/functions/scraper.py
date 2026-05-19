from __future__ import annotations

import os
import re
import sys
import time
from datetime import datetime
from difflib import SequenceMatcher

import requests
from bs4 import BeautifulSoup
from supabase import create_client

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

REQUEST_DELAY   = 2
TIME_SECONDS    = 21600
MAX_JOBS_TOTAL  = 100_000
BASE_DEPTH      = 250
MAX_DEPTH       = 5000

FIELD_SUPERSET: dict[str, str] = {
    "ai":             "software",
    "ml":             "software",
    "machine learning": "software",
    "nlp":            "software",
    "computer vision": "software",
    "full stack":     "software",
    "fullstack":      "software",
    "backend":        "software",
    "frontend":       "software",
    "web":            "software",
    "mobile":         "software",
    "ios":            "software",
    "android":        "software",
    "data engineer":  "software",
    "data science":   "software",
    "analytics":      "software",
    "devops":         "software",
    "cloud":          "software",
    "platform":       "software",
    "infrastructure": "software",
    "security":       "software",
    "cybersecurity":  "software",
    "database":       "software",
    "embedded":       "engineering",
    "firmware":       "engineering",
    "hardware":       "engineering",
    "mechanical":     "engineering",
    "electrical":     "engineering",
    "robotics":       "engineering",
    "controls":       "engineering",
    "systems":        "engineering",
}

LOCATION_TO_COUNTRY: dict[str, str] = {
    "canada":        "Canada",
    "toronto":       "Canada",
    "waterloo":      "Canada",
    "vancouver":     "Canada",
    "montreal":      "Canada",
    "ottawa":        "Canada",
    "calgary":       "Canada",
    "edmonton":      "Canada",
    "remote canada": "Canada",
    "usa":           "USA",
    "united states": "USA",
    "new york":      "USA",
    "san francisco": "USA",
    "seattle":       "USA",
    "austin":        "USA",
    "boston":        "USA",
    "chicago":       "USA",
    "los angeles":   "USA",
    "remote":        "Remote",
    "remote us":     "USA",
    "uk":            "UK",
    "united kingdom": "UK",
    "london":        "UK",
    "germany":       "Germany",
    "berlin":        "Germany",
    "munich":        "Germany",
    "singapore":     "Singapore",
    "japan":         "Japan",
    "tokyo":         "Japan",
}

EXCLUDE_TITLE_TERMS: list[str] = [
    "professor", "faculty", "lecturer", "instructor",
    "nursing", "clinical", "physician", "psychology",
    "law", "biology", "chemistry",
    "music", "coach", "cheerleading", "welding", "social work",
    "custodial", "police", "child welfare", "fundraising", "yoga",
    "spring 2027", "2027",
]


def get_country_depth(country: str, user_count: int) -> int:
    return min(BASE_DEPTH * max(1, user_count), MAX_DEPTH)


def desc_similarity(a: str, b: str) -> float:
    if not a or not b:
        return 0.0
    return SequenceMatcher(None, a[:2000], b[:2000]).ratio()


def map_location_to_country(loc: str) -> str:
    key = loc.lower().strip()
    for fragment, country in LOCATION_TO_COUNTRY.items():
        if fragment in key:
            return country
    return loc


def map_field_to_superset(field: str) -> str:
    return FIELD_SUPERSET.get(field.lower().strip(), "other")


def fetch_all_dashboard_configs() -> list[dict]:
    resp = supabase.table("dashboard_configs").select(
        "id, profile_id, include_skills, include_fields, exclude_skills, exclude_fields, locations, seasons"
    ).eq("active", True).execute()
    return resp.data or []


def build_search_sets(configs: list[dict]) -> tuple[set, set, set, set, set]:
    skills: set[str]         = set()
    fields: set[str]         = set()
    ex_skills: set[str]      = set()
    ex_fields: set[str]      = set()
    locations: set[str]      = set()
    seasons: set[str]        = set()

    for cfg in configs:
        for s in (cfg.get("include_skills") or []):
            skills.add(s.lower().strip())
        for f in (cfg.get("include_fields") or []):
            fields.add(f.lower().strip())
        for s in (cfg.get("exclude_skills") or []):
            ex_skills.add(s.lower().strip())
        for f in (cfg.get("exclude_fields") or []):
            ex_fields.add(f.lower().strip())
        for loc in (cfg.get("locations") or []):
            locations.add(loc.strip())
        for season in (cfg.get("seasons") or []):
            seasons.add(season.lower().strip())

    if not fields:
        fields = {"software", "data", "devops", "ml", "full stack", "backend"}
    if not locations:
        locations = {"Canada", "USA", "Remote"}
    if not seasons:
        seasons = {"fall_2026"}

    return skills, fields, ex_skills, ex_fields, locations, seasons


def build_search_matrix(
    fields: set[str],
    locations: set[str],
    user_count: int,
) -> tuple[list[tuple[str, str, str]], dict[str, int]]:
    country_field_pairs: set[tuple[str, str]] = set()

    country_user_counts: dict[str, int] = {}
    for loc in locations:
        country = map_location_to_country(loc)
        country_user_counts[country] = country_user_counts.get(country, 0) + 1

    broad_categories: set[str] = set()
    for field in fields:
        broad_categories.add(map_field_to_superset(field))

    for country in country_user_counts:
        for cat in broad_categories:
            country_field_pairs.add((country, cat))

    job_types = ["intern", "co-op", "internship", "coop"]

    search_matrix: list[tuple[str, str, str]] = []
    for country, category in country_field_pairs:
        for jtype in job_types:
            keyword = f"{category} {jtype}"
            search_matrix.append((keyword, country, jtype))

    limits: dict[str, int] = {
        country: get_country_depth(country, count)
        for country, count in country_user_counts.items()
    }

    return search_matrix, limits


def build_fall_terms(seasons: set[str]) -> list[str]:
    base = [
        "fall", "autumn", "sept", "september", "october", "november",
        "f2026", "fall 2026", "fall2026", "fall co-op", "fall coop",
        "fall intern", "fall term", "fall semester", "fall position",
        "sep 2026", "sept 2026", "4-month", "4 month",
    ]
    for s in seasons:
        readable = s.replace("_", " ")
        compact  = s.replace("_", "")
        base += [readable, compact, s]
    return list(set(base))


def infer_season(combined: str, seasons: set[str]) -> str | None:
    for s in seasons:
        readable = s.replace("_", " ")
        compact  = s.replace("_", "")
        if readable in combined or compact in combined or s in combined:
            return s
    if any(t in combined for t in ["fall", "autumn", "sept", "september", "october"]):
        return "fall_2026"
    if any(t in combined for t in ["summer", "june", "july"]):
        return "summer_2026"
    if any(t in combined for t in ["winter", "january", "february"]):
        return "winter_2027"
    return None


def is_season_relevant(combined: str, fall_terms: list[str], seasons: set[str]) -> bool:
    if any(term in combined for term in fall_terms):
        return True
    evergreen_signals = [
        "internship", "intern", "co-op", "coop", "co op",
        "new grad", "graduate", "entry level", "entry-level",
    ]
    if any(s in combined for s in evergreen_signals):
        exclude_other = ["spring 2026", "summer 2026", "winter 2026", "spring2026"]
        if not any(ex in combined for ex in exclude_other):
            return True
    return False


def layer1_field_in_title(title_lower: str, fields: set[str]) -> bool:
    for field in fields:
        if field == "ai":
            if re.search(r'\bai\b', title_lower):
                return True
        elif field in title_lower:
            return True
    broad_title_signals = [
        "software", "developer", "engineer", "programmer", "data",
        "machine learning", "backend", "frontend", "fullstack", "full stack",
        "devops", "cloud", "mobile", "ios", "android", "platform",
        "infrastructure", "security", "embedded", "firmware", "nlp",
        "computer vision", "robotics", "analytics", "database",
    ]
    return any(sig in title_lower for sig in broad_title_signals)


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

    matched_fields: list[str] = []
    for f in fields:
        if f == "ai":
            if re.search(r'\bai\b', combined):
                matched_fields.append(f)
        elif f in combined:
            matched_fields.append(f)

    for broad, _ in FIELD_SUPERSET.items():
        if broad in combined and broad not in matched_fields:
            matched_fields.append(broad)

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

    additional_tech = [
        "python", "javascript", "typescript", "react", "node", "vue", "angular",
        "java", "kotlin", "swift", "go", "golang", "rust", "c++", "c#",
        "sql", "postgresql", "mysql", "mongodb", "redis", "kafka", "spark",
        "docker", "kubernetes", "aws", "gcp", "azure", "terraform",
        "pytorch", "tensorflow", "scikit", "pandas", "numpy",
        "fastapi", "django", "flask", "spring", "rails", "express",
        "graphql", "rest", "grpc", "git", "linux", "bash",
    ]
    for tech in additional_tech:
        if tech in combined and tech not in matched_skills:
            matched_skills.append(tech)

    for ex in ex_fields:
        if ex in combined:
            return [], [], None, None, None, False
    for ex in ex_skills:
        if re.search(rf'\b{re.escape(ex)}\b', combined):
            pass

    salary: dict | None = None
    salary_patterns = [
        r'\$\s*(\d[\d,]*)\s*(?:k|,000)?\s*(?:[-–]\s*\$?\s*(\d[\d,]*)\s*(?:k|,000)?)?\s*(?:\/\s*(?:hr|hour|yr|year|annum))?',
        r'(\d+)\s*(?:k|,000)\s*(?:[-–]\s*(\d+)\s*(?:k|,000)?)?\s*(?:per\s+(?:year|hour|annum))?',
        r'(?:salary|compensation|pay)[:\s]+\$?\s*(\d[\d,]+)',
    ]
    for pattern in salary_patterns:
        m = re.search(pattern, combined, re.IGNORECASE)
        if m:
            salary = {"raw": m.group(0).strip()}
            break

    requirements: dict | None = None
    req_signals = [
        "bachelor", "master", "degree", "pursuing", "enrolled",
        "gpa", "3rd year", "4th year", "final year", "penultimate",
        "years of experience", "year of experience",
    ]
    found_reqs = [sig for sig in req_signals if sig in combined]
    if found_reqs:
        snippet_start = max(0, combined.find(found_reqs[0]) - 50)
        snippet_end   = min(len(combined), snippet_start + 300)
        requirements  = {"signals": found_reqs, "snippet": combined[snippet_start:snippet_end]}

    duration: str | None = None
    duration_patterns = [
        r'(\d+)\s*[-–]?\s*month',
        r'(4|8|12|16)\s*months?',
        r'(one|two|three|four|six|eight|twelve|sixteen)\s*months?',
        r'(fall|winter|summer|spring)\s+(?:term|semester|co-op|coop)',
        r'(january|may|september)\s+\d{4}',
    ]
    for dp in duration_patterns:
        m = re.search(dp, combined, re.IGNORECASE)
        if m:
            duration = m.group(0).strip()
            break

    is_relevant = bool(matched_fields or matched_skills)
    return matched_fields, matched_skills, requirements, salary, duration, is_relevant


def fetch_job_detail(job_id: str) -> tuple[str, list[str]]:
    try:
        resp = requests.get(
            f"https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/{job_id}",
            headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"},
            timeout=15,
        )
        soup     = BeautifulSoup(resp.text, "html.parser")
        desc_el  = soup.select_one("[class*=description] > section > div")
        tags_el  = soup.select_one("[class*=_job-criteria-list]")
        desc     = desc_el.get_text(separator=" ", strip=True) if desc_el else ""
        tags     = [t.strip() for t in tags_el.get_text(separator="|").split("|") if t.strip()] if tags_el else []
        return desc, tags
    except Exception:
        return "", []


def run():
    print(f"[scraper] run started at {datetime.now().isoformat()}")

    configs = fetch_all_dashboard_configs()
    user_count = max(len(configs), 1)
    print(f"[scraper] {user_count} active dashboard config(s) loaded")

    skills, fields, ex_skills, ex_fields, locations, seasons = build_search_sets(configs)
    fall_terms = build_fall_terms(seasons)

    search_matrix, country_limits = build_search_matrix(fields, locations, user_count)
    print(f"[scraper] search matrix: {len(search_matrix)} trios | countries: {list(country_limits.keys())}")

    existing_resp = supabase.table("jobs").select("id, url, title, company, locations, description").execute()
    existing_rows = existing_resp.data or []

    url_set: set[str] = set(r["url"] for r in existing_rows)
    title_company_map: dict[tuple[str, str], dict] = {
        (r["title"].lower().strip(), r["company"].lower().strip()): r
        for r in existing_rows
    }

    print(f"[scraper] {len(url_set)} existing jobs loaded into memory")

    total_scraped = 0
    country_scraped: dict[str, int] = {}

    for keyword, country, job_type in search_matrix:
        if total_scraped >= MAX_JOBS_TOTAL:
            break

        depth_limit = country_limits.get(country, BASE_DEPTH)
        if country_scraped.get(country, 0) >= depth_limit:
            continue

        print(f"\n[scraper] keyword='{keyword}' | country='{country}'")
        start = 0

        while start < MAX_START_PER_KEYWORD and total_scraped < MAX_JOBS_TOTAL:
            if country_scraped.get(country, 0) >= depth_limit:
                break

            try:
                resp = requests.get(
                    "https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search",
                    params={
                        "keywords": keyword,
                        "location": country,
                        "f_TPR": f"r{TIME_SECONDS}",
                        "start": start,
                    },
                    headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"},
                    timeout=15,
                )
            except Exception as e:
                print(f"[scraper] request error: {e}")
                break

            soup = BeautifulSoup(resp.text, "html.parser")
            cards = soup.find_all("div", class_="base-card")
            if not cards:
                break

            for card in cards:
                title_el = card.select_one("[class*=_title]")
                title = title_el.get_text(strip=True) if title_el else None
                if not title:
                    continue

                title_lower = title.lower()

                if any(ex in title_lower for ex in EXCLUDE_TITLE_TERMS):
                    continue

                if not layer1_field_in_title(title_lower, fields):
                    continue

                url_el = card.select_one("[class*=_full-link]")
                url = url_el["href"].split("?")[0] if url_el else None
                if not url:
                    continue

                company_el  = card.select_one("[class*=_subtitle]")
                location_el = card.select_one("[class*=_location]")
                company     = company_el.get_text(strip=True) if company_el else "Unknown"
                job_location = location_el.get_text(strip=True) if location_el else country

                title_key   = title_lower.strip()
                company_key = company.lower().strip()
                tc_key      = (title_key, company_key)

                job_id = url.split("-")[-1]
                desc_text, tags = fetch_job_detail(job_id)
                desc_lower = desc_text.lower()
                combined   = title_lower + " " + desc_lower

                if not is_season_relevant(combined, fall_terms, seasons):
                    continue

                matched_fields, matched_skills, requirements, salary, duration, is_relevant = layer3_extract_metadata(
                    title, desc_text, skills, fields, ex_skills, ex_fields
                )

                if not is_relevant:
                    continue

                inferred_season = infer_season(combined, seasons)

                if url in url_set:
                    continue

                if tc_key in title_company_map:
                    existing = title_company_map[tc_key]
                    sim = desc_similarity(desc_text, existing.get("description") or "")

                    existing_locs = existing.get("locations") or [existing.get("location", "")]
                    same_location = job_location in existing_locs

                    if sim > 0.85:
                        if same_location:
                            try:
                                supabase.table("jobs").update({
                                    "url":          url,
                                    "description":  desc_text,
                                    "fields":       matched_fields,
                                    "skills":       matched_skills,
                                    "requirements": requirements,
                                    "salary":       salary,
                                    "duration":     duration,
                                    "season":       inferred_season,
                                    "scraped_at":   datetime.now().isoformat(),
                                }).eq("id", existing["id"]).execute()
                                url_set.discard(existing["url"])
                                url_set.add(url)
                                title_company_map[tc_key]["url"] = url
                                print(f"[dedup] REPLACED repost: {title} @ {company}")
                            except Exception as e:
                                print(f"[dedup] replace error: {e}")
                        else:
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

                item = {
                    "url":          url,
                    "title":        title,
                    "company":      company,
                    "location":     job_location,
                    "locations":    [job_location],
                    "description":  desc_text or None,
                    "source":       "linkedin",
                    "season":       inferred_season,
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
                    total_scraped            += 1
                    print(f"[{total_scraped}] {title} @ {company} ({job_location})")
                except Exception as e:
                    if "duplicate" not in str(e).lower():
                        print(f"[scraper] insert error: {e}")
                    continue

            start += 10
            time.sleep(REQUEST_DELAY)

    print(f"\n[scraper] finished at {datetime.now().isoformat()} — {total_scraped} new jobs inserted")


if __name__ == "__main__":
    run()