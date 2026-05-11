from fastapi import FastAPI, Form, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, FileResponse, StreamingResponse
from dotenv import load_dotenv
from datetime import datetime
import os
from pydantic import BaseModel
from groq import Groq
from io import BytesIO
from supabase import create_client


load_dotenv()
FRONTEND_ORIGIN=os.getenv("FRONTEND_ORIGIN")

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_ORIGIN, "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

groq_client = Groq(api_key=os.getenv("GROQ_API_KEY"))

#### Classes
class TextData(BaseModel):
    content:str
    # title:str

class JobRequest(BaseModel):
    job_id: int

#### Endpoints GET
@app.get("/", response_class=HTMLResponse)
def root():
    return "<h1>FastAPI server is running ✅</h1>"

