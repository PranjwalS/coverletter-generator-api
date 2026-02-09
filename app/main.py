from fastapi import FastAPI, Form, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, FileResponse, StreamingResponse
from fastapi.templating import Jinja2Templates
from dotenv import load_dotenv
import os
from pydantic import BaseModel
from pdf_generator import make_pdf
from dotenv import load_dotenv
from prompt import makePrompt
from openai import OpenAI
from io import BytesIO

load_dotenv()
FRONTEND_ORIGIN=os.getenv("FRONTEND_ORIGIN")

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_ORIGIN],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

#### Classes
class TextData(BaseModel):
    content:str
    title:str
    

#### Endpoints GET
@app.get("/", response_class=HTMLResponse)
def root():
    return "<h1>FastAPI server is running ✅</h1>"




#### Endpoints POST
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from io import BytesIO
from pdf_generator import make_pdf
import os

app = FastAPI()

FRONTEND_ORIGIN = os.getenv("FRONTEND_ORIGIN", "*")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_ORIGIN],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class TextData(BaseModel):
    content: str
    title: str

@app.post("/coverletter-text")
def coverletter_text_input(data: TextData):
    buffer = BytesIO()
    filename = f"{data.title}.pdf"

    make_pdf(data.content, buffer, filename)
    buffer.seek(0)  # important

    return StreamingResponse(
        content=buffer,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"'
        },
    )
