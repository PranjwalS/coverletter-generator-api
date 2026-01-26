from celery import Celery
from supabase import create_client
import os
from datetime import datetime
from openai import OpenAI
from prompt import makePrompt, cv_summary_1, cv_summary_2, closing
from celery.schedules import crontab
from dotenv import load_dotenv
from job_scoring_trial import calculate_job_score, THRESHOLD_PRE_CL

## manual quick run code; 
##      celery -A celery_tasks worker --loglevel=info --pool=solo
## (in new terminal) python
##                   from celery_tasks import enqueue_scoring_jobs
##                   enqueue_scoring_jobs.delay()


load_dotenv()

REDIS_URL = os.getenv("REDIS_URL")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
HF_API_TOKEN = os.getenv("HF_API_TOKEN")

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

client = OpenAI(
    base_url="https://router.huggingface.co/v1",
    api_key=HF_API_TOKEN,
)

celery_app = Celery(
    "worker",
    broker=REDIS_URL,
    backend=REDIS_URL
)

celery_app.conf.update(
    timezone="UTC",
    enable_utc=True,

    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",

    broker_use_ssl={"ssl_cert_reqs": 0},
    redis_backend_use_ssl={"ssl_cert_reqs": 0},
    
    beat_schedule={
        "run-coverletter-pipeline-every-30-min": {
            "task": "enqueue_scoring_jobs",
            "schedule": crontab(minute="*/30"),         ### REMOVE BEAT, TOO MUCH COMMAND USAGE ON UPSTASH, AND INSTEAD DO SCRIPT RUNS FROM CRAWLER
        }
    }
)




@celery_app.task(name="enqueue_scoring_jobs")
def enqueue_scoring_jobs():
    jobs = supabase.table("jobs").select("*").limit(20).eq("processed_coverletter", False).execute()
    jobs = jobs.data or []

    if not jobs:
        print(f'No jobs pending coverletter generation at {datetime.now().strftime("%Y-%m-%d %H:%M")}')
        return

    for job in jobs:
        job_scoring_task.delay(job["id"])

    first, last = jobs[0]["id"], jobs[-1]["id"]
    print(f'Enqueued jobs {first} to {last} at {datetime.now().strftime("%Y-%m-%d %H:%M")} ; {last-first} jobs done :)')



@celery_app.task
def job_scoring_task(job_id: int):
    job_resp = supabase.table("jobs").select("*").eq("id", job_id).single().execute()
    job = job_resp.data

    result = calculate_job_score(job)
    supabase.table("jobs").update({"score": result['final_score'], "score_breakdown": result['score_breakdown'], "scored_at": datetime.now().isoformat()}).eq("id", job["id"]).execute()

    if result['final_score'] >= THRESHOLD_PRE_CL:
        generate_coverletter.delay(job_id)
    else:
        return
    
    

@celery_app.task(name = "coverletter_generator")
def generate_coverletter(job_id):
    job_resp = supabase.table("jobs").select("*").eq("id", job_id).single().execute()
    job = job_resp.data
    prompt = makePrompt(
        job["title"],
        job["company"],
        job["job_desc"],
        job["company_desc"],
    )        

    try:
        completion = client.chat.completions.create(
            model="meta-llama/Llama-3.2-3B-Instruct",
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
    
    except Exception as e:
        print(f"LLM failed for job {job['id']}: {e}")
        return
    
    ## update db
    supabase.table("jobs").update({"processed_coverletter": True, "coverletter_text": final_output}).eq("id", job["id"]).execute()

