from datetime import datetime

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
from supabase import create_client
from prompt import makePrompt, cv_summary_1, cv_summary_2, closing
from job_scoring_trial import calculate_job_score

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
HF_API_TOKEN = os.getenv("HF_API_TOKEN")
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
client = OpenAI(
    base_url="https://router.huggingface.co/v1",
    api_key=HF_API_TOKEN,
)

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

@app.get("/download-cv")
def download_cv():
    cv_path = os.path.join(os.path.dirname(__file__), "static", "Pranjwal_Singh_CV.pdf")
    if not os.path.exists(cv_path):
        return {"error": "CV not found"}
    return FileResponse(cv_path, media_type="application/pdf", filename="CV_Pranjwal_Singh.pdf")



@app.post("/generate-coverletter")
def generate_coverletter(data: JobRequest):
    job_resp = supabase.table("jobs").select("*").eq("id", data.job_id).single().execute()
    job = job_resp.data
    if not job:
        return {"error": "Job not found"}

    # Score
    result = calculate_job_score(job)
    supabase.table("jobs").update({
        "score": result["final_score"],
        "score_breakdown": result["score_breakdown"],
        "scored_at": datetime.now().isoformat()
    }).eq("id", job["id"]).execute()

    # Cover letter
    prompt = makePrompt(job["title"], job["company"], job["job_desc"], job["company_desc"])
    completion = client.chat.completions.create(
        model="meta-llama/Llama-3.1-8B-Instruct",
        messages=[{"role": "user", "content": prompt}],
        max_tokens=500,
        temperature=0.4,
    )
    output = completion.choices[0].message.content
    final_output = (
        output.strip() + "\n\n" +
        cv_summary_1.strip() + "\n\n" +
        cv_summary_2.strip() + "\n\n" +
        closing.strip()
    )

    supabase.table("jobs").update({
        "processed_coverletter": True,
        "coverletter_text": final_output
    }).eq("id", job["id"]).execute()

    return {"coverletter_text": final_output}


#### Endpoints POST
@app.post("/coverletter-text")
def coverletter_text_input(data: TextData):
    buffer = BytesIO()
    # filename = f"{data.title}.pdf"
    filename = "Coverletter_Pranjwal_Singh"
    make_pdf(data.content, buffer, filename)
    buffer.seek(0)  # important

    return StreamingResponse(
        content=buffer,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"'
        },
    )
