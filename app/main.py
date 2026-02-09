from fastapi import FastAPI, Form, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, FileResponse, StreamingResponse
from fastapi.templating import Jinja2Templates
from dotenv import load_dotenv
import os
from pydantic import BaseModel
from pdf_generator import make_pdf
from dotenv import load_dotenv
from app.prompt import makePrompt
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
@app.get("/")
def root():   
    return {"status": "ok"}



#### Endpoints POST
@app.post("/coverletter-text")
def coverletter_text_input(data: TextData):
    buffer = BytesIO()
    filename = f"{data.title}.pdf"
    make_pdf(data, buffer)  # modify make_pdf to write to buffer
    buffer.seek(0)
    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )
    