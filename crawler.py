import re
from fastapi import Path
from playwright.async_api import async_playwright
import asyncio
from playwright_stealth import Stealth
import json
import os
from dotenv import load_dotenv
from datetime import datetime
import time
from supabase import create_client
from app.email_service import send_email

print("Script started at:", datetime.now())
load_dotenv()
HEADLESS = bool(os.getenv("HEADLESS"))
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)


async def crawler_linkedin(playwright, cookies):
    browser = await playwright.chromium.launch(headless=HEADLESS)
    context = await browser.new_context(locale="en-US",
        timezone_id="America/Chicago",
        user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36",
        viewport={"width": 1280, "height": 800},
        extra_http_headers={"Accept-Language": "en-US,en;q=0.9"},
        )
    
    await context.add_cookies(cookies)
    page = await context.new_page()
    job_cards = []
    job_count = 0
        
    keywords = search_config.get("keywords")
    geoIDs = list(search_config["geoIDs"].values())
    index = 0
    for geoID in geoIDs:
        for keyword in keywords:
            while True:
                await page.goto(f"https://www.linkedin.com/jobs/search/?geoId={geoID}&f_TPR=r86400&keywords={keyword}&origin=JOB_SEARCH_PAGE_SEARCH_BUTTON&refresh=true&start={25*index}")

                try:
                    await page.wait_for_selector('text="Sign in with Email"', timeout=8000)
                    print("[DEBUG] Login popup detected, filling in credentials...")
                    await page.click('text="Sign in with Email"')
                    await page.wait_for_timeout(1000)
                    print(f"{os.getenv('LINKEDIN_EMAIL')} was detected \n")
                    await page.fill('input[autocomplete="username"]', os.getenv("LINKEDIN_EMAIL"))
                    await page.fill('input[autocomplete="current-password"]', os.getenv("LINKEDIN_PASSWORD"))
                    await page.click('button:has-text("Sign in")')
                    print("[DEBUG] Submitted login form, waiting...")
                    await page.wait_for_timeout(6000)
                except:
                    print("[DEBUG] No login popup, continuing...")

                try:
                    await page.wait_for_selector('ul:has(li[data-occludable-job-id])', timeout=8000)
                except:
                    break

                await page.wait_for_timeout(5000)

                job_cards_locator = page.locator('ul:has(li[data-occludable-job-id]) li[data-occludable-job-id]')

                previous_count = 0
                while True:
                    current_count = await job_cards_locator.count()
                    if current_count == previous_count:
                        break
                    for i in range(previous_count, current_count):
                        await job_cards_locator.nth(i).scroll_into_view_if_needed()
                        await page.wait_for_timeout(200)
                    await page.wait_for_timeout(800)
                    previous_count = current_count

                await page.wait_for_selector('li[data-occludable-job-id]')
                jobs_on_page = await page.query_selector_all('li[data-occludable-job-id]')

                for card in jobs_on_page:
                    link_el = await card.query_selector("a.job-card-container__link")
                    job_link = (await link_el.get_attribute("href")).split("/?")[0] if link_el else None
                    job_link = f"https://www.linkedin.com{job_link}" if job_link else None
                    job_cards.append((job_link,))
                print("Job cards found:", job_cards)

                index += 1
            index = 0
            await asyncio.sleep(2)

    await asyncio.sleep(10)
    response = supabase.table("jobs").select("url").execute()
    existing_urls = set(row["url"] for row in response.data)

    page = await context.new_page()
    page.set_default_navigation_timeout(300000)
    page.set_default_timeout(120000)

    new_jobs = []

    for link in job_cards:
        if link[0] in existing_urls:
            continue

        await page.goto(f"{link[0]}")
        item = {}

        try:
            await page.wait_for_selector('[data-testid="expandable-text-box"]', timeout=15000)
        except:
            print(f"Skipping {link[0]} - timed out")
            continue

        full_text = await page.inner_text("body")
        title_text = await page.title()
        parts = [p.strip() for p in title_text.split(" | ")]
        job_title = parts[0] if len(parts) > 0 else ""
        company_title = parts[1] if len(parts) > 1 else ""

        location_title = ""
        try:
            alert_section = page.locator('h2:has-text("Set alert for similar jobs")')
            if await alert_section.count() > 0:
                for levels in range(1, 8):
                    xpath = "/".join([".."] * levels)
                    container = alert_section.locator(f"xpath={xpath}")
                    if await container.count() == 0:
                        continue
                    alert_p = container.locator("p").first
                    if await alert_p.count() > 0:
                        alert_text = (await alert_p.inner_text()).strip()
                        if "," in alert_text:
                            location_title = alert_text.split(",", 1)[1].strip()
                        break
        except:
            pass

        job_desc_text = ""
        try:
            about_job_section = page.locator('h2:has-text("About the job")')
            if await about_job_section.count() > 0:
                container = about_job_section.locator('xpath=../../..')
                desc_box = container.locator('[data-testid="expandable-text-box"]')
                if await desc_box.count() > 0:
                    job_desc_text = await desc_box.first.inner_text()
        except:
            pass

        company_desc_text = ""
        try:
            about_company_section = page.locator('h2:has-text("About the company")')
            if await about_company_section.count() > 0:
                container = about_company_section.locator('xpath=../../..')
                desc_box = container.locator('[data-testid="expandable-text-box"]')
                if await desc_box.count() > 0:
                    company_desc_text = await desc_box.first.inner_text()
        except:
            pass

        apply_text = ""
        try:
            apply_btn = page.locator('[data-view-name="job-apply-button"]')
            if await apply_btn.count() > 0:
                apply_text = await apply_btn.get_attribute("aria-label") or ""
        except:
            pass

        tags_text = []
        for t in ["On-site", "Remote", "Hybrid"]:
            if t in full_text:
                tags_text.append(t)
        for t in ["Full-time", "Part-time", "Contract", "Temporary", "Volunteer", "Internship"]:
            if t in full_text:
                tags_text.append(t)
        for t in ["Internship", "Entry level", "Associate", "Mid-Senior level", "Director", "Executive"]:
            if t in full_text and t not in tags_text:
                tags_text.append(t)
        for t in ["Co-op", "co-op", "New Grad", "Summer", "Fall", "Winter", "Spring"]:
            if t in full_text and t not in tags_text:
                tags_text.append(t)

        salary_matches = re.findall(r'\$[\d,]+(?:\.\d+)?(?:/hr|/yr|K)?(?:\s*[-–]\s*\$[\d,]+(?:\.\d+)?(?:/hr|/yr|K)?)?', full_text)
        if salary_matches:
            for s in salary_matches:
                s = s.strip()
                if s and s not in tags_text:
                    tags_text.append(s)
                    break

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
        new_jobs.append({'title': job_title, 'company': company_title})
        await asyncio.sleep(1)

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

    await browser.close()
    return ("success", job_count)


search_config = {
    
    "keywords": [
        '("fall" OR "sept" OR "september" OR "autumn") AND "2026" AND ("computer science" OR "computer" OR "machine learning" OR "it" OR "programmer" OR "coder" OR "software" OR "developer" OR "cs" OR "data" OR "ai" OR "ml" OR "hardware" OR "mobile") NOT ("Summer 2026" OR "2026 Summer" OR "Summer/Fall" OR "July" OR "May")',
        # '("Autumn 2026") AND (intern OR internship OR "co-op" OR coop) AND (software OR backend OR frontend OR "full stack" OR mobile)'
    ],
    "geoIDs": {
        # "Canada": "101174742",
        # "Germany": "101282230",
        "USA": "103644278",
        # "Singapore": "102454443",
        # "Japan": "101355337",
        # "UK": "101165590",
    }
}
    

    

async def main():
    cookies_env = os.getenv("COOKIES")
    if cookies_env:
        cookies = json.loads(cookies_env)
    else:
        with open("secrets/linkedin_cookies.json", "r") as f:
            cookies = json.load(f)

    async with Stealth().use_async(async_playwright()) as playwright:
        browser = await playwright.chromium.launch(headless=HEADLESS)
        context = await browser.new_context(
            locale="en-US",
            timezone_id="America/Chicago",
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36",
            viewport={"width": 1280, "height": 800},
            extra_http_headers={"Accept-Language": "en-US,en;q=0.9"},
        )
        await context.add_cookies(cookies)
        page = await context.new_page()
        await page.goto("https://www.linkedin.com/jobs")

        try:
            await page.wait_for_selector('input[autocomplete="username"]', timeout=8000)
            await page.fill('input[autocomplete="username"]', os.getenv("LINKEDIN_EMAIL"))
            await page.fill('input[autocomplete="current-password"]', os.getenv("LINKEDIN_PASSWORD"))
            await page.click('button:has-text("Sign in")')
            await page.wait_for_timeout(6000)
        except:
            print("[DEBUG] No login form, continuing...")

        cookies = await context.cookies()
        result = await crawler_linkedin(playwright, cookies)
        print(result)

asyncio.run(main())