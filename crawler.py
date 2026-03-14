import re
from playwright.sync_api import sync_playwright
import json
import os
from dotenv import load_dotenv
from datetime import datetime
import time
from supabase import create_client

print("Script started at:", datetime.now())

load_dotenv()
HEADLESS = bool(os.getenv("HEADLESS"))
# Connect to Supabase Postgres
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

def crawler_linkedin(playwright, cookies):
    browser = playwright.chromium.launch(headless=HEADLESS, channel="chrome")
    context = browser.new_context()
    context.add_cookies(cookies)
    page = context.new_page()
    job_cards = []
    job_count = 0
        
    keywords = search_config.get("keywords")
    geoIDs = list(search_config["geoIDs"].values())
    index = 0
    for geoID in geoIDs:
        for keyword in keywords:
            while True: # go thru all pages
                page.goto(f"https://www.linkedin.com/jobs/search/?geoId={geoID}&f_TPR=r8640000&keywords={keyword}&origin=JOB_SEARCH_PAGE_SEARCH_BUTTON&refresh=true&start={25*index}") 
                try:
                    page.wait_for_selector('ul:has(li[data-occludable-job-id])', timeout=3000)
                except:
                    break
                
                
                page.wait_for_timeout(3000) 

                # scroll page to end
                job_cards_locator = page.locator('ul:has(li[data-occludable-job-id]) li[data-occludable-job-id]')

                
                previous_count = 0
                while True:
                    current_count = job_cards_locator.count()
                    if current_count == previous_count:
                        break
                    # scroll through each job card
                    for i in range(previous_count, current_count):
                        job_cards_locator.nth(i).scroll_into_view_if_needed()
                        page.wait_for_timeout(100)

                    previous_count = current_count
                    
                page.wait_for_selector('li[data-occludable-job-id]')
                jobs_on_page = page.query_selector_all('li[data-occludable-job-id]')
                
                for card in jobs_on_page:
                    link_el = card.query_selector("a.job-card-container__link")
                    job_link = link_el.get_attribute("href").split("/?")[0] if link_el else None
                    job_link = f"https://www.linkedin.com{job_link}" if job_link else None

                    job_cards.append((job_link,))
                print("Job cards found:", job_cards)

                index += 1
            index = 0
            time.sleep(2)

    ## remove duplicates
        # scrape link by link
    time.sleep(10)
    response = supabase.table("jobs").select("url").execute()
    existing_urls = set(row["url"] for row in response.data)

    page = context.new_page()
    page.set_default_navigation_timeout(300000)  # 5 min
    page.set_default_timeout(120000)     
    
    
    
    
    #############
####    ########## imrpoved the scraping stuff, gotta fix endpoints tho since it generaes coverltter unnecceaseilry and also just clean up the keywords , empty db and rerun all, put job scoring into scraping tho
    for link in job_cards:
        if link[0] in existing_urls:
            continue

        page.goto(f"{link[0]}")
        item = {}

        try:
            page.wait_for_selector('[data-testid="expandable-text-box"]', timeout=15000)
        except:
            print(f"Skipping {link[0]} - timed out")
            continue

        full_text = page.inner_text("body")

        # --- TITLE + COMPANY: from page title, ironclad ---
        title_text = page.title()
        parts = [p.strip() for p in title_text.split(" | ")]
        job_title = parts[0] if len(parts) > 0 else ""
        company_title = parts[1] if len(parts) > 1 else ""

        # --- LOCATION: always "CompanyName\n<location> ·" in rendered text ---
        location_title = ""
        try:
            after_company = full_text.split(company_title, 1)[1]
            candidate = after_company.strip().splitlines()[0].split("·")[0].strip()
            if candidate and len(candidate) < 80:
                location_title = candidate
        except:
            pass

        # --- JOB DESC: find h2 "About the job", grab the expandable-text-box INSIDE that section ---
        job_desc_text = ""
        try:
            # locate the h2 with exact text, then find the expandable box within the same parent container
            about_job_section = page.locator('h2:has-text("About the job")')
            if about_job_section.count() > 0:
                # walk up to the section container, then find the text box inside it
                container = about_job_section.locator('xpath=../../..')
                desc_box = container.locator('[data-testid="expandable-text-box"]')
                if desc_box.count() > 0:
                    job_desc_text = desc_box.first.inner_text()
        except:
            pass

        # --- COMPANY DESC: same pattern anchored to "About the company" h2 ---
        company_desc_text = ""
        try:
            about_company_section = page.locator('h2:has-text("About the company")')
            if about_company_section.count() > 0:
                container = about_company_section.locator('xpath=../../..')
                desc_box = container.locator('[data-testid="expandable-text-box"]')
                if desc_box.count() > 0:
                    company_desc_text = desc_box.first.inner_text()
        except:
            pass

        # --- APPLY TYPE: aria-label on the apply button, e.g. "Apply on company website" ---
        apply_text = ""
        try:
            apply_btn = page.locator('[data-view-name="job-apply-button"]')
            if apply_btn.count() > 0:
                apply_text = apply_btn.get_attribute("aria-label") or ""
        except:
            pass

        # --- TAGS: scrape ALL meaningful signals from full_text ---
        tags_text = []
        # workplace type
        for t in ["On-site", "Remote", "Hybrid"]:
            if t in full_text:
                tags_text.append(t)
        # job type
        for t in ["Full-time", "Part-time", "Contract", "Temporary", "Volunteer", "Internship"]:
            if t in full_text:
                tags_text.append(t)
        # experience level
        for t in ["Internship", "Entry level", "Associate", "Mid-Senior level", "Director", "Executive"]:
            if t in full_text and t not in tags_text:
                tags_text.append(t)
        # industry / function signals from job desc itself
        for t in ["Co-op", "co-op", "New Grad", "Summer", "Fall", "Winter", "Spring"]:
            if t in full_text and t not in tags_text:
                tags_text.append(t)

        item["title"] = job_title
        item["company"] = company_title
        item["location"] = location_title
        item["tags"] = tags_text
        item["apply_type"] = apply_text
        item["job_desc"] = job_desc_text
        item["company_desc"] = company_desc_text
        item["url"] = link[0]
        item["scraped_at"] = datetime.now().strftime("%Y-%m-%d %H:%M")
        supabase.table("jobs").insert(item).execute()
        job_count += 1
        time.sleep(1)





    browser.close()  
    return("success", job_count)


search_config = {
    "keywords": [
        '("Fall 2026" OR "2026 Fall") AND ("computer science" OR "computer" OR "programmer" OR "coder" OR "software" OR "developer" OR "cs" OR "data" OR "ai" OR "ml" OR "hardware" OR "mobile") NOT ("Summer 2026" OR "2026 Summer" OR "Summer/Fall" OR "July" OR "May")',
        # '("Autumn 2026") AND (intern OR internship OR "co-op" OR coop) AND (software OR backend OR frontend OR "full stack" OR mobile)'
    ],
    "geoIDs": {
        # "Canada": "101174742",
        # "Germany": "101282230",
        "USA": "103644278",
        # "Singapore": "102454443",
        # "Japan": "101355337",
    }
}
    
with sync_playwright() as playwright:
    with open("secrets/linkedin_cookies.json", "r") as f:
        cookies = json.load(f)
    print(crawler_linkedin(playwright, cookies))
    
print("Script finished at:", datetime.now())


