from playwright.sync_api import sync_playwright
import json
import os

COOKIES_FILE = "linkedin_cookies.json"

def save_cookies(context):
    cookies = context.cookies()
    with open(COOKIES_FILE, "w") as f:
        json.dump(cookies, f, indent=2)

with sync_playwright() as p:
    browser = p.chromium.launch(headless=False)
    context = browser.new_context()

    # Load cookies if possible
    if os.path.exists(COOKIES_FILE):
        try:
            with open(COOKIES_FILE, "r") as f:
                cookies = json.load(f)
            context.add_cookies(cookies)
        except json.JSONDecodeError:
            print("Cookies invalid, will generate new ones.")

    page = context.new_page()
    page.goto("https://www.linkedin.com/jobs")

    # If LinkedIn redirects to login page, wait for manual login

    print("Login detected, please log in manually…")
    input("Press Enter when done…")
    save_cookies(context)
    print("New cookies saved!")

    input("Press Enter to close browser…")
    browser.close()
