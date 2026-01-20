from fastapi import FastAPI, Form, Request
from fastapi.responses import HTMLResponse, FileResponse
from fastapi.templating import Jinja2Templates
import httpx
from reportlab.lib.pagesizes import LETTER
from reportlab.pdfgen import canvas
from bs4 import BeautifulSoup
# from selenium import webdriver
from pdf_generator import make_pdf
from dotenv import load_dotenv
import os
from prompt import makePrompt
from openai import OpenAI

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
def submit_url(request:Request, url: str = Form(...)):
    print("Received URL:", url) 
    
    ## simple scrape from url recieved
    r = httpx.get(url)
    
    ## parse html scraped data
    def makeSoup(text):
        soup = BeautifulSoup(text, 'html.parser')
        description = soup.find("div", class_="description__text description__text--rich").text
        description = description.replace("Show more", "").replace("Show less", "")
        titl = soup.find("title").text
        soup = (f"{titl} \n {description}")
        return soup, titl, description

    soup, titl, description = makeSoup(r.text)
    
    ##selenium code, needs revisiting later since f1 on azure can't handle, could work on b1
    # score = 0
    # # if not titl: score += 3
    # if len(description) < 200: score += 3
    # if len(r.text) < 1000: score += 2
    # if any(m in soup.lower() for m in BLOCK_MARKERS): score += 5
    # if r.status_code != 200: score += 5
    # if score >= 5:
    #     driver = webdriver.Chrome()
    #     driver.get(url)
    #     html = driver.page_source
    #     driver.quit()
    #     print(makeSoup(html)[0])
    # else:
    #


    ## hugging face call for coverletter generation        
    client = OpenAI(
        base_url="https://router.huggingface.co/v1",
        api_key=HF_API_TOKEN,
    )

    completion = client.chat.completions.create(
        model="meta-llama/Llama-3.2-3B-Instruct",
        messages=[{"role": "user", "content": makePrompt(soup)}],
        max_tokens=500,
        temperature=0.4,
    )


    output = completion.choices[0].message.content

    ## text to pdf
    make_pdf(output)
    return templates.TemplateResponse("download_pdf.html", {"request":request})


@app.get("/coverletter.pdf")
def get_pdf():
    return FileResponse("coverletter.pdf", media_type="application/pdf")
