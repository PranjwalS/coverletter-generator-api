from datetime import datetime
import time
import sys
import os
import requests
import re
from bs4 import BeautifulSoup
from supabase import create_client

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app.helpers.email_service import send_email

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# ─── Scraper limits ────────────────────────────────────────────────────────────
MAX_JOBS_TOTAL = 100_000
MAX_START_PER_KEYWORD = 5000   # how deep to page per keyword/location combo
TIME_SECONDS = 21600           # 6-hour recency window for LinkedIn
REQUEST_DELAY = 2              # seconds between requests

# ─── Filters (title-level) ─────────────────────────────────────────────────────
# These are broad fallback guards. Primary filtering comes from dashboard configs.
EXCLUDE_TITLE = [
    "professor", "faculty", "lecturer", "instructor",
    "nursing", "clinical", "physician", "psychology",
    "law", "biology", "chemistry",
    "music", "coach", "cheerleading", "welding", "social work",
    "custodial", "police", "child welfare", "fundraising", "yoga",
    "spring 2027", "2027",
]

# ─── Helpers ───────────────────────────────────────────────────────────────────

def fetch_all_dashboard_configs():
    """Pull all active dashboard_configs and aggregate keywords, locations, seasons."""
    resp = supabase.table("dashboard_configs").select(
        "id, profile_id, keywords, locations, seasons"
    ).eq("active", True).execute()
    return resp.data or []


def build_search_matrix(configs):
    """
    Deduplicate and merge all configs into a flat set of (keyword, location) pairs.
    Also build a season set for fall-relevance filtering.
    Returns:
        search_pairs: list of (keyword, location) tuples
        all_seasons: set of season strings (e.g. "fall_2026")
        all_keywords: set of all keywords (for include matching)
    """
    keyword_set = set()
    location_set = set()
    season_set = set()

    for cfg in configs:
        for kw in (cfg.get("keywords") or []):
            keyword_set.add(kw.lower().strip())
        for loc in (cfg.get("locations") or []):
            location_set.add(loc.strip())
        for s in (cfg.get("seasons") or []):
            season_set.add(s.lower().strip())

    # Default fallback if nothing in DB yet
    if not keyword_set:
        keyword_set = {
            "software intern", "software co-op", "developer intern",
            "full stack intern", "backend intern", "frontend intern",
            "ml intern", "data engineer intern", "devops intern",
            "co-op 2026", "intern 2026", "fall co-op", "fall intern",
        }
    if not location_set:
        location_set = {"Canada", "USA", "Remote", "UK", "Germany", "Singapore", "Japan"}
    if not season_set:
        season_set = {"fall_2026"}

    pairs = [(kw, loc) for kw in keyword_set for loc in location_set]
    return pairs, season_set, keyword_set


def build_fall_terms(season_set):
    """Generate fall-relevance terms from the season set."""
    base = [
        "fall", "autumn", "sept", "september", "october", "november",
        "f2026", "fall 2026", "fall2026", "fall co-op", "fall coop",
        "fall intern", "fall term", "fall semester", "fall position",
        "sep 2026", "sept 2026",
    ]
    for s in season_set:
        # e.g. "fall_2026" → "fall 2026", "fall2026"
        readable = s.replace("_", " ")
        compact = s.replace("_", "")
        base += [readable, compact, s]
    return list(set(base))


def infer_season(title_lower, desc_lower, season_set):
    """Best-effort season detection from text."""
    combined = title_lower + " " + desc_lower
    for s in season_set:
        readable = s.replace("_", " ")
        compact = s.replace("_", "")
        if readable in combined or compact in combined or s in combined:
            return s
    # Fallback heuristics
    if any(t in combined for t in ["fall", "autumn", "sept", "september", "october"]):
        return "fall_2026"
    return None


def matches_include(title_lower, keyword_set):
    """Check if title matches any keyword from all configs."""
    # Also keep a broad CS safety net
    broad = [
        "software", "developer", "engineer", "programmer", "data", "ml",
        "machine learning", "ai", "backend", "frontend", "fullstack",
        "full stack", "devops", "cloud", "mobile", "ios", "android",
        "platform", "infrastructure", "security", "embedded", "firmware",
        "nlp", "computer vision", "robotics", "analytics", "database",
    ]
    all_includes = keyword_set | set(broad)
    for kw in all_includes:
        if kw == "ai":
            if re.search(r'\bai\b', title_lower):
                return True
        elif kw == "it":
            if re.search(r'\bit\b', title_lower):
                return True
        else:
            if kw in title_lower:
                return True
    return False


def matches_fall(title_lower, desc_lower, fall_terms):
    combined = title_lower + " " + desc_lower
    return any(term in combined for term in fall_terms)


def fetch_company_desc(company):
    """Try to fetch the LinkedIn company About Us blurb."""
    company_slug = re.sub(r'[^a-z0-9]+', '-', company.lower()).strip('-')
    try:
        resp = requests.get(
            f"https://www.linkedin.com/company/{company_slug}",
            headers={"User-Agent": "Mozilla/5.0"},
            timeout=10,
        )
        soup = BeautifulSoup(resp.text, "html.parser")
        h2 = soup.find("h2", string=lambda t: t and "About us" in t)
        if h2:
            return h2.find_next_sibling("div").find("p").get_text(strip=True)
    except Exception:
        pass
    return ""


# ─── Main ──────────────────────────────────────────────────────────────────────

def run():
    print(f"Scraper started at: {datetime.now()}")

    # 1. Load all active dashboard configs
    configs = fetch_all_dashboard_configs()
    print(f"Loaded {len(configs)} active dashboard configs.")

    search_pairs, season_set, keyword_set = build_search_matrix(configs)
    fall_terms = build_fall_terms(season_set)

    print(f"Search matrix: {len(search_pairs)} keyword×location pairs")
    print(f"Seasons: {season_set}")

    # 2. Load existing URLs to skip duplicates
    existing_resp = supabase.table("jobs").select("url").execute()
    existing_urls = set(row["url"] for row in (existing_resp.data or []))
    print(f"Existing jobs in DB: {len(existing_urls)}")

    new_jobs = []
    total_fetched = 0

    # 3. Scrape
    for keyword, location in search_pairs:
        if total_fetched >= MAX_JOBS_TOTAL:
            break
        print(f"\n── keyword='{keyword}' | location='{location}' ──")
        start = 0

        while start < MAX_START_PER_KEYWORD and total_fetched < MAX_JOBS_TOTAL:
            try:
                response = requests.get(
                    "https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search",
                    params={
                        "keywords": keyword,
                        "location": location,
                        "f_TPR": f"r{TIME_SECONDS}",
                        "start": start,
                    },
                    headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"},
                    timeout=15,
                )
            except Exception as e:
                print(f"Request error: {e}")
                break

            soup = BeautifulSoup(response.text, "html.parser")
            jobs = soup.find_all("div", class_="base-card")
            if not jobs:
                print("No more results, moving on.")
                break

            for job in jobs:
                title_el = job.select_one("[class*=_title]")
                title = title_el.get_text(strip=True) if title_el else None
                if not title:
                    continue

                title_lower = title.lower()

                # Title-level exclude
                if any(kw in title_lower for kw in EXCLUDE_TITLE):
                    continue

                # Title-level include
                if not matches_include(title_lower, keyword_set):
                    continue

                url_el = job.select_one("[class*=_full-link]")
                url = url_el["href"].split("?")[0] if url_el else None
                if not url or url in existing_urls:
                    continue

                # Fetch full job description
                job_id = url.split("-")[-1]
                try:
                    job_resp = requests.get(
                        f"https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/{job_id}",
                        headers={"User-Agent": "Mozilla/5.0"},
                        timeout=15,
                    )
                    job_soup = BeautifulSoup(job_resp.text, "html.parser")
                    desc_el = job_soup.select_one("[class*=description] > section > div")
                    tags_el = job_soup.select_one("[class*=_job-criteria-list]")
                    desc_text = desc_el.get_text(strip=True) if desc_el else ""
                    tags = [t.strip() for t in tags_el.get_text(separator="|").split("|") if t.strip()] if tags_el else []
                except Exception:
                    desc_text = ""
                    tags = []

                desc_lower = desc_text.lower()

                # Fall-relevance check
                if not matches_fall(title_lower, desc_lower, fall_terms):
                    continue

                company_el = job.select_one("[class*=_subtitle]")
                location_el = job.select_one("[class*=_location]")
                company = company_el.get_text(strip=True) if company_el else "Unknown"
                job_location = location_el.get_text(strip=True) if location_el else location

                company_desc = fetch_company_desc(company)
                season = infer_season(title_lower, desc_lower, season_set)

                item = {
                    "url": url,
                    "title": title,
                    "company": company,
                    "location": job_location,
                    "description": desc_text or None,
                    "source": "linkedin",
                    "season": season,
                    "scraped_at": datetime.now().isoformat(),
                }

                try:
                    supabase.table("jobs").insert(item).execute()
                    existing_urls.add(url)
                    new_jobs.append({"title": title, "company": company})
                    total_fetched += 1
                    print(f"[{total_fetched}] {title} @ {company}")
                except Exception as e:
                    # Likely duplicate URL conflict — skip silently
                    if "duplicate" not in str(e).lower():
                        print(f"Insert error: {e}")
                    continue

            start += 10
            time.sleep(REQUEST_DELAY)

    print(f"\nScraper finished at: {datetime.now()}")
    print(f"New jobs inserted: {len(new_jobs)}")

    # 4. Email summary
    if new_jobs:
        rows = "\n".join([
            f"""
            <tr>
                <td style="padding: 8px 12px; border-bottom: 1px solid #eee;">{j['title']}</td>
                <td style="padding: 8px 12px; border-bottom: 1px solid #eee; color: #666;">{j['company']}</td>
            </tr>
            """
            for j in new_jobs
        ])
        body = f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
            <h2 style="color: #1a1a1a; margin-bottom: 4px;">Crawler Run Complete</h2>
            <p style="color: #666; margin-top: 0;">{len(new_jobs)} new job{'s' if len(new_jobs) != 1 else ''} found</p>
            <table style="width: 100%; border-collapse: collapse; margin-top: 16px;">
                <thead>
                    <tr style="background: #f5f5f5;">
                        <th style="padding: 10px 12px; text-align: left; font-size: 13px; color: #888; font-weight: 600;">TITLE</th>
                        <th style="padding: 10px 12px; text-align: left; font-size: 13px; color: #888; font-weight: 600;">COMPANY</th>
                    </tr>
                </thead>
                <tbody>{rows}</tbody>
            </table>
            <p style="color: #aaa; font-size: 12px; margin-top: 24px;">Scraped at {datetime.now().strftime("%Y-%m-%d %H:%M")}</p>
        </div>
        """
        send_email(
            subject=f"🔍 {len(new_jobs)} new job{'s' if len(new_jobs) != 1 else ''} found",
            body=body,
            html=True,
        )


if __name__ == "__main__":
    run()