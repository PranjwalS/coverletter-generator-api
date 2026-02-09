from fastapi import FastAPI, Form, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, FileResponse
from fastapi.templating import Jinja2Templates
from dotenv import load_dotenv
import os
from pydantic import BaseModel
from pdf_generator import make_pdf
from dotenv import load_dotenv
from app.prompt import makePrompt
from openai import OpenAI

load_dotenv()
FRONTEND_ORIGIN=os.getenv("FRONTEND_ORIGIN")

app = FastAPI()
templates = Jinja2Templates(directory="pages")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_ORIGIN],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root():
    return {"status": "ok"}


@app.get("/hello")
def hello(name: str = "world"):
    return {"message": f"hello {name}"}



class UserIn(BaseModel):
    name: str

@app.post("/users")
def create_user(user: UserIn):
    return {"hello": user.name}








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
