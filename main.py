from fastapi import FastAPI, Form, Request
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates
import httpx
from reportlab.lib.pagesizes import LETTER
from reportlab.pdfgen import canvas
from bs4 import BeautifulSoup
from selenium import webdriver
from trial import makePdf
from dotenv import load_dotenv
import os

app = FastAPI()
templates = Jinja2Templates(directory="pages")

@app.get("/", response_class=HTMLResponse)
def read_form(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})


load_dotenv()
HF_API_TOKEN = os.getenv("HF_API_TOKEN")
if not HF_API_TOKEN:
    raise RuntimeError("HF_API_TOKEN not set")

BLOCK_MARKERS = [
    "enable javascript",
    "verify you are human",
    "captcha",
    "access denied",
    "robot"
]


@app.post("/submit-url")
def submit_url(url: str = Form(...)):
    print("Received URL:", url) 
    
    r = httpx.get(url)
    
    def makeSoup(text):
        soup = BeautifulSoup(text, 'html.parser')
        description = soup.find("div", class_="description__text description__text--rich").text
        description = description.replace("Show more", "").replace("Show less", "")
        titl = soup.find("title").text
        soup = (f"{titl} \n {description}")
        return soup, titl, description

    score = 0
    soup, titl, description = makeSoup(r.text)
    if not titl: score += 3
    if len(description) < 200: score += 3
    if len(r.text) < 1000: score += 2
    if any(m in soup.lower() for m in BLOCK_MARKERS): score += 5
    if r.status_code != 200: score += 5
    if score >= 5:
        driver = webdriver.Chrome()
        driver.get(url)
        html = driver.page_source
        driver.quit()
        print(makeSoup(html)[0])
    else:
        print(soup)
        makePdf(titl, description)
        print("HF token loaded:", bool(os.getenv("HF_API_TOKEN")))

    return {"status": "success", "url": url}


