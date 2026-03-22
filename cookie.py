from playwright.sync_api import sync_playwright
import json
import os
from dotenv import load_dotenv

load_dotenv()
HEADLESS = os.getenv("HEADLESS")
COOKIES_FILE = "secrets/linkedin_cookies.json"

def save_cookies(context):
    cookies = context.cookies()
    for c in cookies:
        if c["name"] == "timezone":
            c["value"] = "America/Chicago"
    with open(COOKIES_FILE, "w") as f:
        json.dump(cookies, f, indent=2)

with sync_playwright() as p:
    browser = p.chromium.launch(headless=HEADLESS)
    context = browser.new_context(
        locale="en-US",
        timezone_id="America/Chicago",
    )

    if os.path.exists(COOKIES_FILE):
        try:
            with open(COOKIES_FILE, "r") as f:
                cookies = json.load(f)
            context.add_cookies(cookies)
        except json.JSONDecodeError:
            print("Cookies invalid, will generate new ones.")

    page = context.new_page()
    page.goto("https://www.linkedin.com/jobs")

    print("Log in manually if needed...")
    input("Press Enter when done...")
    save_cookies(context)
    print("New cookies saved to secrets/linkedin_cookies.json!")

    input("Press Enter to close browser...")
    browser.close()