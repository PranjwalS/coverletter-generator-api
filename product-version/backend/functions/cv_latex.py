import json
import uuid
from groq import Groq
import os

groq_client = Groq(api_key=os.getenv("GROQ_API_KEY"))



def cv_selector(job: dict, user_profile: dict) -> dict:
    prompt = f"""
You are selecting and tailoring resume content for a real applicant applying to a real job.

============================================================
STEP 1 — ROLE ANALYSIS (DO NOT OUTPUT)
============================================================

Read the job carefully and identify:
1. Primary nature of the role: technical, operational, research, creative, business, or mixed.
2. What the organization values most: reliability, execution, technical depth, communication, ownership, etc.
3. Which experiences and projects from the profile are most relevant.

============================================================
STEP 2 — SELECTION RULES
============================================================

- Select 2 to 3 most relevant experiences. Prioritize relevance over diversity.
- Select 2 to 3 most relevant projects. Same rule.
- For each selected experience/project, you may rewrite bullet points to better mirror the job's language and requirements.
- Rewriting means realigning emphasis and language toward the job description — not shortening, simplifying, or removing detail. The original bullets are well-written in a broader sense. Preserve their depth, specificity, and technical integrity, but with the freedom to align towards the given job. 
- A rewritten bullet should be at least as long and detailed as the original.
- Do NOT fabricate tools, outcomes, or skills not present in the original data.
- Do NOT exaggerate impact or seniority.
- Do NOT add bullet points that don't exist in the original — only rewrite existing ones.
- Keep rewrites grounded, specific, and technically honest.
- Do not preserve any given ID fields from the input

============================================================
PROFILE
============================================================

Experiences: {json.dumps(user_profile.get("experience", []))}
Projects: {json.dumps(user_profile.get("projects", []))}
Skills: {user_profile.get("skills", "")}
Education: {json.dumps(user_profile.get("education", []))}

============================================================
JOB
============================================================

Title: {job.get("title", "")}
Company: {job.get("company", "")}
Description: {job.get("description", "")}
Requirements: {json.dumps(job.get("requirements", []))}
Skills needed: {json.dumps(job.get("skills", []))}

============================================================
OUTPUT RULE (ABSOLUTE)
============================================================

Return ONLY valid JSON. No markdown, no backticks, no commentary.

Exact schema:
{{
  "experiences": [
    {{
      "title": "...",
      "company": "...",
      "date": "...",
      "bullets": ["rewritten or original bullet", ...]
    }}
  ],
  "projects": [
    {{
      "name": "...",
      "date": "...",
      "bullets": ["rewritten or original bullet", ...]
    }}
  ],
  "education": [ <pass through all education as-is, no modifications> ],
  "skills": "<pass through as-is>"
}}
"""
    resp = groq_client.chat.completions.create(
        messages=[
            {"role": "system", "content": "You are a resume tailoring engine. Return only valid JSON exactly matching the requested schema."},
            {"role": "user", "content": prompt},
        ],
        model="openai/gpt-oss-120b",
        temperature=0.3
    )

    raw = resp.choices[0].message.content.strip()
    clean = raw.replace("```json", "").replace("```", "").strip()
    return json.loads(clean)


def strip_ids(obj):
    """Recursively remove any 'id' keys from dicts."""
    if isinstance(obj, dict):
        return {k: strip_ids(v) for k, v in obj.items() if k != "id"}
    if isinstance(obj, list):
        return [strip_ids(i) for i in obj]
    return obj
 
 
def stamp_cv_ids(cv: dict) -> dict:
    cv = strip_ids(cv)
 
    for exp in cv.get("experiences", []):
        eid = str(uuid.uuid4())[:8]
        exp["id"]      = eid
        exp["title"]   = {"id": f"experience_{eid}_title",   "value": exp.get("title", "")}
        exp["company"] = {"id": f"experience_{eid}_company",  "value": exp.get("company", "")}
        exp["date"]    = {"id": f"experience_{eid}_date",     "value": exp.get("date", "")}
        exp["bullets"] = [
            {"id": f"experience_{eid}_b{i+1}", "value": b if isinstance(b, str) else b.get("value", "")}
            for i, b in enumerate(exp.get("bullets", []))
        ]
 
    for proj in cv.get("projects", []):
        pid = str(uuid.uuid4())[:8]
        proj["id"]      = pid
        proj["name"]    = {"id": f"proj_{pid}_name",  "value": proj.get("name", "")}
        proj["date"]    = {"id": f"proj_{pid}_date",  "value": proj.get("date", "")}
        proj["bullets"] = [
            {"id": f"proj_{pid}_b{i+1}", "value": b if isinstance(b, str) else b.get("value", "")}
            for i, b in enumerate(proj.get("bullets", []))
        ]
 
    for edu in cv.get("education", []):
        edid = str(uuid.uuid4())[:8]
        edu["id"]       = edid
        edu["school"]   = {"id": f"educ_{edid}_school", "value": edu.get("institution", edu.get("school", ""))}
        edu["degree"]   = {"id": f"educ_{edid}_degree", "value": edu.get("degree", "")}
        edu["date"]     = {"id": f"educ_{edid}_date",   "value": edu.get("end_date", edu.get("date", ""))}
 
    return cv


user_profile = {
  "name": "Pranjwal S.",
  "skills": {
    "skills": "Python, TypeScript, C, C++, SQL, Bash, React, LangChain, React Native, Vue.js, FastAPI, Flask, Celery, Jetpack Compose, Git, GitHub, Docker, Jenkins, Linux, Supabase, Vercel, Render, Android Studio, Unity, Azure (DevOps, Blob, App Service), Power Platform, SQLAlchemy, PostgreSQL"
  },
  "contact": {
    "email": "",
    "links": [
      "https://www.linkedin.com/in/pranjwal-s-01979b242/",
      "https://github.com/PranjwalS"
    ],
    "phone": "",
    "location": ""
  },
  "summary": "CS @ University of Waterloo seeking Fall 2026 Co-op | 3x Intern | Full-Stack & AI/ML Dev",
  "projects": [
    {
      "id": "5d2cc6b8-4f98-4f8b-a42b-17af81b5fe9e",
      "name": "Job Aggregator, Tracker & Career Platform - JobScout",
      "links": [],
      "end_date": "",
      "start_date": "",
      "tech_stack": [
        "React",
        "FastAPI",
        "PostgreSQL",
        "Supabase",
        "Redis",
        "Celery",
        "Playwright",
        "Groq API"
      ],
      "description": [
        "Built a full-stack career platform where users maintain a career profile and create job search dashboards, each running a cron -scheduled scraper across job boards, with LLM -powered scoring, custom cover letter and CV generation via Celery + Redis async pipelines, email alerts for high-scored matches, and pre-interview prep packets with LLM -generated Q&A and mock interview simulation.",
        "Built a Chrome extension for form autofill, and an in-progress LLM + Playwright auto-application bot."
      ]
    },
    {
      "id": "c39dacdf-f811-4437-9844-58cf79c9f8e8",
      "name": "Agentic AI Coding Assistant - EnOSym",
      "links": [],
      "end_date": "",
      "start_date": "",
      "tech_stack": [
        "Python",
        "LangChain",
        "ChromaDB",
        "Whisper",
        "Playwright",
        "Groq API",
        "Ollama",
        "SQLite"
      ],
      "description": [
        "Built a locally-run agentic coding assistant with voice I/O ( Whisper , Coqui TTS ), RAG over codebases and conversation history ( SQLite -backed), using ChromaDB , and a LangChain agentic loop for LLM tool orchestration across relevant file retrieval, code generation, and execution.",
        "Implemented an isolated coding sandbox for iterative code generation and testing with Playwright integration for browser-based tasks, and an autonomous background agent that scans codebases for improvements."
      ]
    },
    {
      "id": "093f4b69-3d09-49e4-b541-36dac0fa2e8c",
      "name": "Minimal Android Launcher - mute.",
      "links": [],
      "end_date": "",
      "start_date": "",
      "tech_stack": [
        "Kotlin",
        "Jetpack Compose",
        "FastAPI",
        "PostgreSQL",
        "Render"
      ],
      "description": [
        "Built a minimal Android home screen launcher in Kotlin to simplify phone UI, presenting only heavy-used apps, with built-in schedule-based blocking on apps and websites via overlays, using AccessibilityService , and a FastAPI backend on Render for configuration backups, launching on Google Play Store."
      ]
    }
  ],
  "education": [
    {
      "id": "36799a5a-444c-4c81-a2af-926f31920ca6",
      "gpa": "3.9",
      "field": "Digital Hardware Specialization",
      "degree": "Bachelor of Computer Science Honours",
      "details": [],
      "end_date": "",
      "start_date": "",
      "institution": "University of Waterloo"
    }
  ],
  "experience": [
    {
      "id": "fd255172-46b9-4e38-9c0d-273e4cb81384",
      "role": "Software Engineer Intern",
      "company": "Edbridges Inc. · Askly.today",
      "end_date": "April 2029",
      "location": "Waterloo, ON",
      "start_date": "September 2025",
      "responsibilities": [
        "Building and improving RAG pipelines and prompt engineering workflows on an AI-powered educational platform, using Python , MongoDB , and Pinecone Vector DB to enhance LLM output quality.",
        "Developing backend LLM workflow systems using LangChain and OpenAI API , and building internal tooling for QA testing and model evaluation."
      ]
    },
    {
      "id": "0059cb09-78fa-4aaf-8f54-201568f2112a",
      "role": "Software Engineer Intern",
      "company": "Edbridges Inc. · Askly.today",
      "end_date": "August 2026",
      "location": "Remote",
      "start_date": "June 2026",
      "responsibilities": [
        "Building and improving RAG pipelines and prompt engineering workflows on an AI-powered educational platform, using Python , MongoDB , and Pinecone Vector DB to enhance LLM output quality.",
        "Developing backend LLM workflow systems using LangChain and OpenAI API , and building internal tooling for QA testing and model evaluation."
      ]
    },
    {
      "id": "bcb0d286-c22f-4331-9ce8-82b6c669d5da",
      "role": "Software Developer Intern",
      "company": "Cadets, IT Development Team, Dept. of National Defence",
      "end_date": "August 2025",
      "location": "St-Jean, QC",
      "start_date": "June 2025",
      "responsibilities": [
        "Built Power Apps solutions for cadet asset management, integrating Dataverse and SQL .",
        "Built and shipped features for the core Vue.js web application used by 10,000+ program staff nationwide, including new pages, UI components, and dynamic dashboards.",
        "Extended a .NET backend by introducing new data entities, implementing SignalR Hubs , and developing RESTful APIs supporting asset tracking and reporting."
      ]
    },
    {
      "id": "c2a74c40-2eb5-4e3e-a7ee-88285fd93c50",
      "role": "Digital Transformation and Software Testing Intern",
      "company": "Ericsson",
      "end_date": "August 2024",
      "location": "Ottawa, ON",
      "start_date": "June 2024",
      "responsibilities": [
        "Monitored and debugged software pipelines using Jenkins and Kubernetes , diagnosing and resolving build and deployment failures by inspecting pod status and reviewing logs.",
        "Maintained Grafana dashboards tracking KPI and performance metrics, supported software testing workflows, and contributed to operational reporting across telecom infrastructure."
      ]
    }
  ],
  "additional_sections": {},
  "certifications_awards": []
}



job = {
    "title": "Backend Engineer Intern",
    "company": "AXL Labs Inc",
    "description": "As the Application Developer, you will work with various teams to identify and implement solutions of agreed applications into action. Responsibilities include internal systems support/development, project enhancements/development in workflow automation, and reporting improvements, ensuring smooth IT operations, end‑user support, and integration for seamless report generation.",
    "requirements": [
  "Familiarity with .NET framework 4.0, .NET Core 5 and above, HTML5, AJAX, XML, Web Services, IIS, Python",
  "Familiarity with Web API (SOAP, REST) frameworks and development",
  "Familiarity with responsive framework like Bootstrap",
  "Familiarity with DevOps continuous development and continuous integration concepts",
  "Familiarity with CI/CD tools such as git-actions",
  "Proficiency in SQL including T‑SQL stored procedures, SSIS & SSRS (preferably MS SQL)",
  "Knowledge of object‑oriented analysis and design using UML",
  "Good team player with strong interpersonal and communication skills",
  "Eligibility to work in Singapore and obtain necessary documentation"
],
    "skills":[
  ".NET framework 4.0",
  ".NET Core 5+",
  "HTML5",
  "AJAX",
  "XML",
  "Web Services",
  "IIS",
  "Python",
  "Web API (SOAP)",
  "Web API (REST)",
  "Bootstrap",
  "DevOps",
  "CI/CD",
  "git-actions",
  "SQL",
  "T‑SQL",
  "Stored Procedures",
  "SSIS",
  "SSRS",
  "UML"
]
}

selected = cv_selector(job, user_profile)
stamped = stamp_cv_ids(selected)
print(json.dumps(stamped, indent=2))