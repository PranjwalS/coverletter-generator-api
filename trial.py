import httpx
from reportlab.lib.pagesizes import LETTER
from reportlab.pdfgen import canvas
from bs4 import BeautifulSoup
# from selenium import webdriver
import requests
from dotenv import load_dotenv
import os

r = httpx.get('https://www.linkedin.com/jobs/view/4354624586/')


def makeSoup(html):    
    soup = BeautifulSoup(html, 'html.parser')
    description = soup.find("div", class_="description__text description__text--rich").text
    description = description.replace("Show more", "").replace("Show less", "")
    titl = soup.find("title").text
    soup = (f"{titl} \n {description}")
    return soup

# print(makeSoup(r.text))

# #### Selenium attemp at scraping

# driver = webdriver.Chrome()
# driver.get("https://www.linkedin.com/jobs/view/4354624586/")
# html = driver.page_source
# driver.quit()
# print(makeSoup(html))




### Pdf maker
def makePdf(titl, description):
    c = canvas.Canvas("job_data.pdf", LETTER)
    width, height = LETTER
    x = 50
    y = height-50
    max_chars = 120
    font_size = 8
    line_height = font_size+3
    c.setFont("Helvetica", font_size)
    c.drawString(x,y,titl)
    y-=line_height+10
    for line in description.split('\n'):
        if line.strip()== "":
            continue
        
        for i in range(0, len(line), max_chars):
            c.setFont("Helvetica", font_size)
    
            if y < 50:
                c.showPage()   
                y = height-50
                
            c.drawString(x, y, line[i: i+max_chars])
            y -= line_height
            
    c.save()




load_dotenv()
HF_API_TOKEN = os.getenv("HF_API_TOKEN")
if not HF_API_TOKEN:
    raise RuntimeError("HF_API_TOKEN not set")

API_URL = "https://router.huggingface.co/models/mistralai/Mixtral-8x22B-v0.1"
headers = {"Authorization": f"Bearer {HF_API_TOKEN}"}

payload = {
    "inputs": "JOB DESCRIPTION HERE\n\nWrite a tailored cover letter.",
    "parameters": {"max_new_tokens": 400}
}

r = requests.post(API_URL, headers=headers, json=payload)
print(r.json()[0]["generated_text"])

