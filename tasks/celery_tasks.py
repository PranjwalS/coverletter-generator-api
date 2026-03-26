import sys
from celery import Celery
from supabase import create_client
import os
from datetime import datetime
from groq import Groq
from celery.schedules import crontab
from dotenv import load_dotenv

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app.helpers.email_service import send_email
from app.helpers.prompt import makePrompt, cv_summary_1, cv_summary_2, closing
from app.helpers.job_scoring import calculate_job_score, THRESHOLD_PRE_CL

## manual quick run code; 
##      celery -A celery_tasks worker --loglevel=info --pool=solo
## (in new terminal) python
##                   from celery_tasks import enqueue_scoring_jobs
##                   enqueue_scoring_jobs.delay()

load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '.env'))

REDIS_URL = os.getenv("REDIS_URL")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
groq_client = Groq(api_key=os.getenv("GROQ_API_KEY"))

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
            "schedule": crontab(minute="*/30"),
        }
    }
)

def emailer(unscored_count, cl_count):
    body = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #1a1a1a; margin-bottom: 4px;">Celery Beat — Pipeline Run</h2>
        <p style="color: #666; margin-top: 0;">Run at {datetime.now().strftime("%Y-%m-%d %H:%M UTC")}</p>
        <table style="width: 100%; border-collapse: collapse; margin-top: 16px;">
            <tbody>
                <tr>
                    <td style="padding: 8px 12px; border-bottom: 1px solid #eee;">Jobs enqueued for scoring</td>
                    <td style="padding: 8px 12px; border-bottom: 1px solid #eee; color: #666;">{unscored_count}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 12px;">Jobs enqueued for cover letter</td>
                    <td style="padding: 8px 12px; color: #666;">{cl_count}</td>
                </tr>
            </tbody>
        </table>
    </div>
    """
    send_email(
        subject=f"⚙️ Celery run: {unscored_count} to score, {cl_count} for CL",
        body=body,
        html=True
    )

@celery_app.task(name="enqueue_scoring_jobs")
def enqueue_scoring_jobs():
    # unscored jobs
    unscored = supabase.table("jobs").select("*").eq("processed_coverletter", False).is_("scored_at", "null").range(0, 10).execute().data or []
    
    # scored but no coverletter yet (above threshold)
    needs_cl = supabase.table("jobs").select("*").eq("processed_coverletter", False).not_.is_("scored_at", "null").gte("score", THRESHOLD_PRE_CL).range(0, 10).execute().data or []

    for job in unscored:
        job_scoring_task.delay(job["id"])

    for job in needs_cl:
        generate_coverletter.delay(job["id"])

    print(f"Enqueued {len(unscored)} to score, {len(needs_cl)} for coverletter at {datetime.now().strftime('%Y-%m-%d %H:%M')}")
    emailer(len(unscored), len(needs_cl))


@celery_app.task(name="celery_tasks.job_scoring_task")
def job_scoring_task(job_id: int):
    job_resp = supabase.table("jobs").select("*").eq("id", job_id).single().execute()
    job = job_resp.data

    result = calculate_job_score(job)
    supabase.table("jobs").update({"score": result['final_score'], "score_breakdown": result['score_breakdown'], "scored_at": datetime.now().isoformat()}).eq("id", job["id"]).execute()
    if result['final_score'] >= 60:
        send_email(
            subject=f"⭐ High score job: {job['title']} at {job['company']} ({result['final_score']})",
            body=f"""
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
                <h2 style="color: #1a1a1a;">High Score Job Found</h2>
                <p><strong>{job['title']}</strong> at <strong>{job['company']}</strong></p>
                <p>Score: <span style="color: #f59e0b; font-size: 24px; font-weight: bold;">{result['final_score']}</span></p>
                <p style="color: #666;">{job.get('location', 'Location unknown')}</p>
                <a href="{job.get('url', '#')}" style="display: inline-block; margin-top: 12px; padding: 10px 20px; background: #1a1a1a; color: white; text-decoration: none; border-radius: 4px;">View Job</a>
            </div>
            """,
            html=True
        )
    if result['final_score'] >= THRESHOLD_PRE_CL:
        print(f"Generating coverletter for job {job_id} with score {result['final_score']}")
        generate_coverletter.delay(job_id)
    else:
        print(f"Skipping job {job_id} with score {result['final_score']}")
        return


@celery_app.task(name="celery_tasks.coverletter_generator", bind=True, max_retries=None, rate_limit="5/m")
def generate_coverletter(self, job_id):
    job_resp = supabase.table("jobs").select("*").eq("id", job_id).single().execute()
    job = job_resp.data
    prompt = makePrompt(
        job["title"],
        job["company"],
        job["job_desc"],
        job["company_desc"],
    )

    try:
        resp = groq_client.chat.completions.create(
            messages=[
                {"role": "system", "content": "You are a helpful assistant."},
                {"role": "user", "content": prompt},
            ],
            model="openai/gpt-oss-120b",
        )

        output = resp.choices[0].message.content
        final_output = (
            output.strip() + "\n\n" +
            cv_summary_1.strip() + "\n\n" +
            cv_summary_2.strip() + "\n\n" +
            closing.strip()
        )

    except Exception as e:
        print(f"LLM failed for job {job['id']}, retrying... {e}")
        raise self.retry(exc=e, countdown=120)

    supabase.table("jobs").update({"processed_coverletter": True, "coverletter_text": final_output}).eq("id", job["id"]).execute()
    print(f"Done job {job['id']}")

if __name__ == "__main__":
    # enqueue_scoring_jobs()
    jobs = supabase.table("jobs").select("*").eq("processed_coverletter", False).is_("scored_at", "null").range(0, 2).execute()
    for job in jobs.data:
        job_scoring_task.delay(job["id"])
        print(f"Queued job {job['id']}")