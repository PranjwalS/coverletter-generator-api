from playwright.sync_api import sync_playwright
import json
import os
from dotenv import load_dotenv
import time


load_dotenv()
HEADLESS = bool(os.getenv("HEADLESS"))

def crawler_linkedin(playwright, cookies):
    browser = playwright.chromium.launch(headless=HEADLESS, channel="chrome")
    context = browser.new_context()
    context.add_cookies(cookies)
    page = context.new_page()
    job_cards = []
    
    keywords = search_config.get("keywords")
    geoIDs = list(search_config["geoIDs"].values())
    for ID in geoIDs:
        for keyword in keywords:
            page.goto(f"https://www.linkedin.com/jobs/search/?geoId={ID}&keywords=%22{keyword}%22&origin=JOB_SEARCH_PAGE_SEARCH_BUTTON&refresh=true")
            try:
                page.wait_for_selector('ul:has(li[data-occludable-job-id])', timeout=3000)
            except:
                print(f"No jobs found for keyword '{keyword}' in geoID {ID}")
                continue
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
            time.sleep(2)

    browser.close()  
    return(job_cards)  


search_config = {
    "keywords": [
        'Fall 2026',
        'Autumn 2026'
    ],
    "geoIDs": {
        "Canada": "101174742",
        "Germany": "101282230",
        "USA": "103644278",
        "Singapore": "102454443",
        "Japan": "101355337",
    }
}
    
with sync_playwright() as playwright:
    with open("secrets/linkedin_cookies.json", "r") as f:
        cookies = json.load(f)
    print(crawler_linkedin(playwright, cookies))