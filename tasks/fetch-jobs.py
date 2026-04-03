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

HEADLESS = os.getenv("HEADLESS")

new_jobs = []

# Broad search terms — no quotes, catches general intern/co-op postings
keywords = [
    "fall co-op",
    "fall intern",
    "co-op 2026",
    "intern 2026",
    "co-op",
    "internship",
]

locations = ['USA', 'Canada', 'Singapore', 'UK', 'Germany', 'Japan']
time_seconds = 21600  # 6 hours
MAX_JOBS = 12000

# Fall-relevance check — applied to title + description after include/exclude pass
FALL_TERMS = [
    "fall", "autumn", "sept", "september", "october", "november",
    "f2026", "fall 2026", "fall2026", "fall co-op", "fall coop",
    "fall intern", "fall term", "fall semester", "fall position",
    "sep 2026", "sept 2026",
]

INCLUDE = [
    "software", "computer science", "computer", "machine learning",
    "programmer", "coder", "developer", "data", "artificial intelligence",
    "ai", "ml", "hardware", "mobile", "backend", "frontend", "full stack",
    "fullstack", "devops", "cloud", "embedded", "firmware", "cybersecurity",
    "cyber", "security", "ios", "android", "nlp", "deep learning",
    "computer vision", "robotics", "it ", "infrastructure",
    "platform", "analytics", "database", "network", "blockchain",
]

EXCLUDE = [
    "summer", "2026 summer", "summer/fall",
    "july", "may", "professor", "faculty", "lecturer", "instructor",
    "nursing", "clinical", "physician", "psychology",
    "law", "biology", "chemistry",
    "music", "coach", "cheerleading", "welding", "social work",
    "custodial", "police", "child welfare", "fundraising", "yoga",
    "spring 2027", "2027",
]

all_jobs = []
start = 0
response = supabase.table("jobs").select("url").execute()
existing_urls = set(row["url"] for row in response.data)

def matches_include(title_lower):
    for kw in INCLUDE:
        if kw == "ai":
            if re.search(r'\bai\b', title_lower):
                return True
        elif kw == "it ":
            if re.search(r'\bit\b', title_lower):
                return True
        else:
            if kw in title_lower:
                return True
    return False

def matches_fall(title_lower, desc_lower):
    """Check if title or description contains any fall-relevant term."""
    combined = title_lower + " " + desc_lower
    return any(term in combined for term in FALL_TERMS)

print("Script started at:", datetime.now())

for location in locations:
    print(f"location {location}")
    for keyword in keywords:
        print(f"keyword {keyword}")
        start = 0
        while start < 1500 and len(all_jobs) < MAX_JOBS:
            response = requests.get(
                "https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search",
                params={
                    "keywords": keyword,
                    "location": location,
                    "f_TPR": f"r{time_seconds}",
                    "start": start,
                },
                headers={
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36"
                }
            )

            soup = BeautifulSoup(response.text, "html.parser")
            jobs = soup.find_all("div", class_="base-card")
            if not jobs:
                break

            for job in jobs:
                title_el = job.select_one("[class*=_title]")
                title = title_el.get_text(strip=True) if title_el else None
                if not title:
                    print("SKIP: no title")
                    continue

                title_lower = title.lower()

                # --- Pass 1: title-level include/exclude ---
                if any(kw in title_lower for kw in EXCLUDE):
                    print(f"SKIP EXCLUDE: {title}")
                    continue
                if not matches_include(title_lower):
                    print(f"SKIP INCLUDE: {title}")
                    continue

                company_el = job.select_one("[class*=_subtitle]")
                location_el = job.select_one("[class*=_location]")
                url_el = job.select_one("[class*=_full-link]")
                url = url_el["href"].split("?")[0] if url_el else None
                if not url or url in existing_urls:
                    continue

                # --- Fetch description ---
                job_id = url.split("-")[-1]
                job_response = requests.get(
                    f"https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/{job_id}",
                    headers={
                        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36"
                    }
                )
                job_soup = BeautifulSoup(job_response.text, "html.parser")
                desc = job_soup.select_one("[class*=description] > section > div")
                tags = job_soup.select_one("[class*=_job-criteria-list]")
                desc_text = desc.get_text(strip=True) if desc else ""

                # --- Pass 2: fall relevance check on title + description ---
                if not matches_fall(title_lower, desc_text.lower()):
                    print(f"SKIP FALL: {title}")
                    continue

                company = company_el.get_text(strip=True) if company_el else None
                company_slug = re.sub(r'[^a-z0-9]+', '-', company.lower()).strip('-')
                try:
                    company_resp = requests.get(
                        f"https://www.linkedin.com/company/{company_slug}",
                        headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36"}
                    )
                    company_soup = BeautifulSoup(company_resp.text, "html.parser")
                    h2 = company_soup.find("h2", string=lambda t: t and "About us" in t)
                    company_desc = h2.find_next_sibling("div").find("p").get_text(strip=True) if h2 else ""
                except:
                    company_desc = ""

                item = {
                    "title": title,
                    "company": company,
                    "location": location_el.get_text(strip=True) if location_el else None,
                    "url": url,
                    "tags": [t.strip() for t in tags.get_text(separator="|").split("|") if t.strip()] if tags else None,
                    "job_desc": desc_text if desc_text else None,
                    "scraped_at": datetime.now().strftime("%Y-%m-%d %H:%M"),
                    "company_desc": company_desc,
                }

                supabase.table("jobs").insert(item).execute()
                existing_urls.add(url)
                new_jobs.append({'title': title, 'company': item["company"]})
                print(f"Found: {new_jobs[-1]}")

            all_jobs.extend(jobs)
            start += 10
            time.sleep(2)
            print("Fetched: ", start)

print(f"Total: {len(all_jobs)}")
print(f"Total valid: {len(new_jobs)}")

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
        html=True
    )

print("Script ended at:", datetime.now())
