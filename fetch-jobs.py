import time

from bs4 import BeautifulSoup
import requests

keyword = ' "Fall" AND "2026" '
need = [""]
all_jobs = []
start = 0

while True:
    response = requests.get(
        "https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search",
        params={
            "keywords": keyword,
            "geoId": "103644278",
            "f_TPR": "r86400",
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
        title = job.select_one("[class*=_title]")
   
        print(title.get_text(strip=True) if title else None)

        
    all_jobs.extend(jobs)
    print(f"Fetched {len(all_jobs)} so far...")
    start += 10
    time.sleep(2)

print(f"Total: {len(all_jobs)}")