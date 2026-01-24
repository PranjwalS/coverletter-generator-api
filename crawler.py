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
    job_details = []
    
    keywords = search_config.get("keywords")
    geoIDs = list(search_config["geoIDs"].values())
    index = 0
    for geoID in geoIDs:
        for keyword in keywords:
            while True: # go thru all pages
                page.goto(f"https://www.linkedin.com/jobs/search/?geoId={geoID}&f_TPR=r10800&keywords=%22{keyword}%22&origin=JOB_SEARCH_PAGE_SEARCH_BUTTON&refresh=true&start={25*index}")
                try:
                    page.wait_for_selector('ul:has(li[data-occludable-job-id])', timeout=3000)
                except:
                    print(f"No jobs found for keyword '{keyword}' in geoID {geoID}")
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
                index += 1
            index = 0
            time.sleep(2)

    ## remove duplicates
        # scrape link by link

    response = supabase.table("jobs").select("url").execute()
    existing_urls = set(row["url"] for row in response.data)

    for link in job_cards:
        if link[0] in existing_urls:
            continue
        
        page.goto(f"{link[0]}")
        time.sleep(1)
        item = {}

        job_container = page.locator(".job-view-layout.jobs-details").first
        job_container.wait_for(timeout=5000)
        
        
        title_locator = job_container.locator(".job-details-jobs-unified-top-card__job-title > h1")
        job_title = title_locator.first.inner_text() if title_locator.count() > 0 else ""

        company_locator = job_container.locator(".job-details-jobs-unified-top-card__company-name > a") 
        company_title = company_locator.first.inner_text() if company_locator.count() > 0 else ""
        
        location_locator = job_container.locator(".job-details-jobs-unified-top-card__primary-description-container >> span.tvm__text--low-emphasis")
        location_title = location_locator.first.inner_text() if location_locator.count() > 0 else ""

        tags_locator = job_container.locator(".job-details-fit-level-preferences >> span.tvm__text--low-emphasis")
        tags_text = [tag.inner_text().strip() for tag in tags_locator.all()]
        
        apply_locator = job_container.locator(".jobs-apply-button--top-card >> span.artdeco-button__text")
        apply_text = apply_locator.first.inner_text() if apply_locator else ""
        
        job_desc_locator = page.locator("article.jobs-description__container #job-details")
        job_desc_text = job_desc_locator.first.inner_text() if job_desc_locator else ""

        company_desc_locator = job_container.locator(".jobs-company__box >> p.jobs-company__company-description.text-body-small-open")
        company_desc_text = company_desc_locator.first.inner_text() if company_desc_locator else ""

        
        item["title"] = job_title
        item["company"] = company_title
        item["location"] = location_title
        item["tags"] = tags_text
        item["apply_type"] = apply_text
        item["job_desc"] = job_desc_text
        item["company_desc"] = company_desc_text
        item["url"] = link[0]
        item["scraped_at"] = datetime.now().strftime("%Y-%m-%d %H:%M")
        job_details.append(item)
        time.sleep(1)
    
    
    # batch send to db
    if job_details:
        response = supabase.table("jobs").insert(job_details).execute()



    browser.close()  
    return("success", len(job_details))  


search_config = {
    "keywords": [
        'Fall 2026',
        'Autumn 2026'
    ],
    "geoIDs": {
        "Canada": "101174742",
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
