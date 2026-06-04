# SCORING NOTE:
# Scores 1 & 2 are currently skills/fields/config-intersection only.
# Intentionally limited — experience/project semantic matching requires embeddings.
# TODO: Once CareerTwin vector DB RAG is live per user:
#   embed(job.description) → query user's CareerTwin vectors → cosine similarity
#   replaces/augments Score 1 & 2, and Score 3 LLM call gets RAG context too.
# Score 3 LLM bridges the semantic gap in the meantime.


import re
import math
import os
from typing import Optional
from groq import Groq


#### BASICALLY MOVE ALL OF THIS LOGIC IN PARTS IN THE CV PARSING END AS WELL AS IN THE SCRAPE TIME SO ALL THE NORMALIZATION OF SKILLS GOES IN THERE
# Add entries here as new scraper quirks appear; scoring never needs changing. WE'LL ADD THESE TO THE .JSONS LATER FOR SKILLS.JSON
SKILL_ALIASES: dict[str, str] = {
    "react.js": "react",
    "reactjs": "react",
    "react js": "react",
    "node.js": "nodejs",
    "node js": "nodejs",
    "next.js": "nextjs",
    "next js": "nextjs",
    "vue.js": "vue",
    "vue js": "vue",
    "express.js": "express",
    "expressjs": "express",
    "postgres": "postgresql",
    "postgre": "postgresql",
    "mongo": "mongodb",
    "mongo db": "mongodb",
    "ts": "typescript",
    "js": "javascript",
    "py": "python",
    "k8s": "kubernetes",
    "tf": "tensorflow",
    "sklearn": "scikit-learn",
    "scikit learn": "scikit-learn",
    "aws lambda": "aws",
    "amazon web services": "aws",
    "google cloud": "gcp",
    "azure cloud": "azure",
    "c++": "cpp",
    "c plus plus": "cpp",
    "c#": "csharp",
    "dot net": "dotnet",
    ".net": "dotnet",
    "rest api": "rest",
    "restful api": "rest",
    "restful": "rest",
    "graphql api": "graphql",
    "llm": "large language models",
    "large language model": "large language models",
    "gen ai": "generative ai",
    "genai": "generative ai",
    "rag pipeline": "rag",
    "retrieval augmented generation": "rag",
    "ci/cd": "cicd",
    "ci cd": "cicd",
    "github actions": "cicd",
    "gitlab ci": "cicd",
    "power bi": "powerbi",
    "power apps": "powerapps",
    "power platform": "powerapps",
}

_STRIP_PATTERN = re.compile(r"[^a-z0-9\s]")


def _normalize_skill(skill: str) -> str:
    s = skill.lower().strip()
    s = _STRIP_PATTERN.sub("", s).strip()
    return SKILL_ALIASES.get(s, s)


def normalize_skills(skills: list[str]) -> set[str]:
    out = set()
    for s in (skills or []):
        n = _normalize_skill(str(s))
        if n:
            out.add(n)
    return out


def skill_intersection(a: set[str], b: set[str]) -> set[str]:
    return a & b


# Score 1 — cv_to_job
#   coverage    = |matched| / |job_skills|
#                 fraction of the job's skill demand the candidate satisfies
#   utilization = |matched| / |user_skills|
#                 fraction of the candidate's skill set the job will actually use
#                 → secondary signal: prevents a 30-skill powerhouse gaming a
#                   3-skill job listing with a perfect coverage score alone
#   raw = (coverage^α  *  utilization^β)^(1/(α+β))      [generalised geometric]
# With α=0.70, β=0.30 this keeps coverage dominant while the geometric form
# ensures utilization can never be ignored entirely (0 utilization → 0 score).


COVERAGE_WEIGHT    = 0.70
UTILIZATION_WEIGHT = 0.30
COVERAGE_SPARSE_CAP = 65   
MIN_JOB_SKILLS      = 4 


def cv_to_job(job_skills_raw: list[str], user_skills_raw: list[str]) -> dict:
    job_skills  = normalize_skills(job_skills_raw)
    user_skills = normalize_skills(user_skills_raw)

    if not job_skills:
        return _cv_to_job_empty("no job skills listed")

    if not user_skills:
        return _cv_to_job_empty("no user skills in profile")

    matched   = skill_intersection(job_skills, user_skills)
    missing   = job_skills - matched

    coverage    = len(matched) / len(job_skills)
    utilization = len(matched) / len(user_skills)

    if coverage == 0:
        raw_score = 0.0
    else:
        # Weighted geometric mean — punishes extreme imbalance
        raw_score = (
            (coverage    ** COVERAGE_WEIGHT) *
            (utilization ** UTILIZATION_WEIGHT)
        ) ** (1 / (COVERAGE_WEIGHT + UTILIZATION_WEIGHT))

    score = round(raw_score * 100)

    # Sparse job listings trust cap
    if len(job_skills) < MIN_JOB_SKILLS:
        score = min(score, COVERAGE_SPARSE_CAP)

    return {
        "score":       score,
        "coverage":    round(coverage, 3),
        "utilization": round(utilization, 3),
        "matched":     sorted(matched),
        "missing":     sorted(missing),
    }


def _cv_to_job_empty(reason: str) -> dict:
    return {
        "score": 0,
        "coverage": 0.0,
        "utilization": 0.0,
        "matched": [],
        "missing": [],
        "note": reason,
    }


# ---------------------------------------------------------------------------
# Score 2 — job_to_cv
# "How well does this job align with what the user is actively looking for?"
#
# Source of truth: dashboard_config include/exclude lists.
# Jobs that reach scoring already passed hard-filter layer 5, so this is NOT
# a binary pass/fail — it's a preference signal on top of an already-acceptable
# job.  We therefore start from a neutral 50 and move from there.
#
# Dimension weights (empirically motivated, not magic):
#
#   Skills  — highest weight.  Most explicit signal of what the user wants
#             and what the job demands.  Positive AND negative matter equally.
#
#   Fields  — second.  Broader domain signal.  A job in the right field but
#             with unfamiliar skills is still worth seeing; wrong field is a
#             weak negative because hard-filter should have caught real misses.
#
#   Location — soft additive.  Many users don't care.  Never a hard penalty
#              here (that's the filter layer's job).  A preferred city is a
#              small bonus.
#
#   Company  — same as location: soft additive bonus for liked companies,
#              very mild negative for disliked ones since hard-filter should
#              block truly unwanted companies.
#
# Scoring math:
#   Each dimension produces a signed delta in [-1, 1] relative to what was
#   possible in that dimension, then scaled by the dimension's weight and
#   mapped to a contribution in points.
#
#   For skills/fields:
#       inc_ratio = |inc_overlap| / max(|inc_list|, 1)   — how much you wanted, you got
#       exc_ratio = |exc_overlap| / max(|exc_list|, 1)   — how much you didn't want, appeared
#       delta = inc_ratio - exc_ratio                    — net signed preference signal
#
#   For location/company (binary presence, not ratio):
#       +SOFT_BONUS if any include match
#       -SOFT_PENALTY if any exclude match
#
#   Final:
#       score = 50 + Σ(delta_i * weight_i * MAX_SWING)
#       clamped to [0, 100]
#
# MAX_SWING is the maximum points any single dimension can move the score.
# With weights summing to 1 and MAX_SWING=40, the theoretical range from
# baseline is ±40 points, giving a practical range of [10, 90] for real jobs
# (extreme ends require all dimensions maxing out in one direction).
# ---------------------------------------------------------------------------

SKILL_WEIGHT    = 0.45
FIELD_WEIGHT    = 0.30
LOCATION_WEIGHT = 0.13
COMPANY_WEIGHT  = 0.12

assert abs(SKILL_WEIGHT + FIELD_WEIGHT + LOCATION_WEIGHT + COMPANY_WEIGHT - 1.0) < 1e-9

MAX_SWING   = 40.0   # max total points a perfectly aligned/misaligned job can swing
SOFT_BONUS  = 0.6    # fraction of weight used for a binary location/company match
SOFT_PENALTY = 0.3   # fraction of weight used for a binary exclude match (softer than include)


def job_to_cv(
    job_skills_raw:    list[str],
    job_fields_raw:    list[str],
    job_location:      str,
    job_company:       str,
    include_skills:    list[str],
    include_fields:    list[str],
    include_locations: list[str],
    include_companies: list[str],
    exclude_skills:    list[str],
    exclude_fields:    list[str],
    exclude_locations: list[str],
    exclude_companies: list[str],
) -> dict:
    """
    Returns:
        {
            "score":      int 0-100,
            "breakdown":  dict per dimension,
        }
    """

    job_skills  = normalize_skills(job_skills_raw)
    job_fields  = {f.lower().strip() for f in (job_fields_raw  or [])}
    loc         = (job_location or "").lower()
    company     = (job_company  or "").lower()

    inc_skills    = normalize_skills(include_skills)
    inc_fields    = {f.lower().strip() for f in (include_fields    or [])}
    inc_locs      = [l.lower().strip() for l in (include_locations or [])]
    inc_companies = [c.lower().strip() for c in (include_companies or [])]

    exc_skills    = normalize_skills(exclude_skills)
    exc_fields    = {f.lower().strip() for f in (exclude_fields    or [])}
    exc_locs      = [l.lower().strip() for l in (exclude_locations or [])]
    exc_companies = [c.lower().strip() for c in (exclude_companies or [])]

    breakdown = {}

    # ---- Skills delta ----
    skill_inc_overlap = skill_intersection(job_skills, inc_skills)
    skill_exc_overlap = skill_intersection(job_skills, exc_skills)
    skill_inc_ratio   = len(skill_inc_overlap) / max(len(inc_skills), 1) if inc_skills else 0.0
    skill_exc_ratio   = len(skill_exc_overlap) / max(len(exc_skills), 1) if exc_skills else 0.0
    skill_delta       = skill_inc_ratio - skill_exc_ratio   # [-1, 1]
    breakdown["skills"] = {
        "delta":       round(skill_delta, 3),
        "inc_matched": sorted(skill_inc_overlap),
        "exc_matched": sorted(skill_exc_overlap),
    }

    # ---- Fields delta ----
    field_inc_overlap = job_fields & inc_fields
    field_exc_overlap = job_fields & exc_fields
    field_inc_ratio   = len(field_inc_overlap) / max(len(inc_fields), 1) if inc_fields else 0.0
    field_exc_ratio   = len(field_exc_overlap) / max(len(exc_fields), 1) if exc_fields else 0.0
    field_delta       = field_inc_ratio - field_exc_ratio
    breakdown["fields"] = {
        "delta":       round(field_delta, 3),
        "inc_matched": sorted(field_inc_overlap),
        "exc_matched": sorted(field_exc_overlap),
    }

    # ---- Location (soft binary) ----
    loc_delta = 0.0
    loc_inc_hit = any(l in loc for l in inc_locs) if inc_locs else False
    loc_exc_hit = any(l in loc for l in exc_locs) if exc_locs else False
    if loc_inc_hit: loc_delta += SOFT_BONUS
    if loc_exc_hit: loc_delta -= SOFT_PENALTY
    loc_delta = max(-1.0, min(1.0, loc_delta))
    breakdown["location"] = {"delta": round(loc_delta, 3), "inc_hit": loc_inc_hit, "exc_hit": loc_exc_hit}

    # ---- Company (soft binary) ----
    co_delta = 0.0
    co_inc_hit = any(c in company for c in inc_companies) if inc_companies else False
    co_exc_hit = any(c in company for c in exc_companies) if exc_companies else False
    if co_inc_hit: co_delta += SOFT_BONUS
    if co_exc_hit: co_delta -= SOFT_PENALTY
    co_delta = max(-1.0, min(1.0, co_delta))
    breakdown["company"] = {"delta": round(co_delta, 3), "inc_hit": co_inc_hit, "exc_hit": co_exc_hit}

    # ---- Aggregate ----
    weighted_delta = (
        skill_delta    * SKILL_WEIGHT +
        field_delta    * FIELD_WEIGHT +
        loc_delta      * LOCATION_WEIGHT +
        co_delta       * COMPANY_WEIGHT
    )

    # weighted_delta is in [-1, 1]; scale to [-MAX_SWING, +MAX_SWING] and add baseline
    raw_score = 50.0 + (weighted_delta * MAX_SWING)
    score     = int(max(0, min(100, round(raw_score))))

    return {"score": score, "breakdown": breakdown}


# ---------------------------------------------------------------------------
# Combined match score
# Simple arithmetic mean of score 1 and score 2.
# Presented to the user as the primary "match %" on the job card.
# ---------------------------------------------------------------------------

def match_score(s1: int, s2: int) -> int:
    return round((s1 + s2) / 2)


# ---------------------------------------------------------------------------
# Score 3 — LLM holistic score (async)
#
# Runs AFTER scores 1 & 2 are stored.  Never blocks the pipeline.
# The LLM receives structured context so it acts as a semantic referee,
# not a replacement for the algorithmic scores.
#
# Output: { "score": int 0-100, "rationale": str (one sentence) }
#
# TODO (CareerTwin):
#   Pass RAG-retrieved user experience chunks as additional context so the
#   LLM can reason about narrative fit, not just skill keywords.
# ---------------------------------------------------------------------------

LLM_SYSTEM_PROMPT = """\
You are a senior technical recruiter scoring job-candidate fit.
You will be given:
  - A job description
  - The candidate's CV text
  - Two algorithmic match scores already computed:
      cv_to_job_score: how well the candidate's skills cover the job (0-100)
      job_to_cv_score: how well the job matches the candidate's preferences (0-100)

Your task: produce a holistic fit score from 0 to 100 that captures what the
algorithmic scores miss — narrative fit, growth potential, role-level
appropriateness, and semantic alignment between the candidate's experience and
the job's actual responsibilities.

Rules:
  - Do NOT simply average the two provided scores.
  - Do NOT reward or penalise purely on prestige or company size.
  - Penalise hard if the role level is clearly mismatched (e.g. 10 YOE required
    for an intern applicant).
  - Your score should be independent and complement the algorithmic scores.
  - Respond ONLY with valid JSON in this exact format, no other text:
    {"score": <integer 0-100>, "rationale": "<one sentence max 30 words>"}
"""


def build_llm_scoring_prompt(
    job_title:       str,
    job_description: str,
    cv_text:         str,
    cv_to_job:       int,
    job_to_cv:       int,
) -> str:
    avg = round((cv_to_job + job_to_cv) / 2)
    return f"""\
JOB TITLE: {job_title}

JOB DESCRIPTION:
{job_description[:3000]}

CANDIDATE CV:
{cv_text[:3000]}

ALGORITHMIC SCORES:
  cv_to_job_score : {cv_to_job}/100  (skills the candidate has vs skills the job needs)
  job_to_cv_score : {job_to_cv}/100  (job attributes vs candidate's stated preferences)
  algorithmic_avg : {avg}/100

Now produce the holistic score JSON.
"""


def llm_score(
    job_title:       str,
    job_description: str,
    cv_text:         str,
    cv_to_job_score: int,
    job_to_cv_score: int,
    groq_client:     Optional[Groq] = None,
) -> dict:
    """
    Calls Groq (llama-3.3-70b-versatile) for a holistic LLM score.
    Returns {"score": int, "rationale": str} or {"score": None, "error": str}.

    Pass groq_client explicitly for testability; if None, instantiates from env.
    """
    import json as _json

    client = groq_client or Groq(api_key=os.environ["GROQ_API_KEY"])

    prompt = build_llm_scoring_prompt(
        job_title       = job_title,
        job_description = job_description,
        cv_text         = cv_text,
        cv_to_job       = cv_to_job_score,
        job_to_cv       = job_to_cv_score,
    )

    try:
        response = client.chat.completions.create(
            model       = "llama-3.3-70b-versatile",
            temperature = 0.2,    # low temp — we want consistent scoring not creativity
            max_tokens  = 120,
            messages    = [
                {"role": "system", "content": LLM_SYSTEM_PROMPT},
                {"role": "user",   "content": prompt},
            ],
        )
        raw = response.choices[0].message.content.strip()

        # Strip any accidental markdown fences
        raw = re.sub(r"```[a-z]*", "", raw).replace("```", "").strip()
        parsed = _json.loads(raw)

        score     = int(parsed["score"])
        rationale = str(parsed["rationale"])

        if not (0 <= score <= 100):
            raise ValueError(f"score out of range: {score}")

        return {"score": score, "rationale": rationale}

    except Exception as e:
        return {"score": None, "error": str(e)}


# ---------------------------------------------------------------------------
# Top-level entry point — called by the pipeline / endpoint
# ---------------------------------------------------------------------------

def score_job(
    # job row from DB
    job_id:          str,
    job_title:       str,
    job_description: str,
    job_skills:      list[str],
    job_fields:      list[str],
    job_location:    str,
    job_company:     str,
    # profile row
    user_skills:     list[str],
    cv_text:         str,
    # dashboard_config row
    include_skills:    list[str],
    include_fields:    list[str],
    include_locations: list[str],
    include_companies: list[str],
    exclude_skills:    list[str],
    exclude_fields:    list[str],
    exclude_locations: list[str],
    exclude_companies: list[str],
    # options
    run_llm:         bool = False,
    groq_client:     Optional[Groq] = None,
) -> dict:
    """
    Returns the full scoring payload ready to upsert into user_jobs.

    {
        "job_id":          str,
        "cv_to_job_score": int,
        "job_to_cv_score": int,
        "match_score":     int,   # avg of above two, shown to user
        "cv_to_job_detail": dict,
        "job_to_cv_detail": dict,
        "llm_score":        int | None,
        "llm_rationale":    str | None,
    }
    """

    s1_result = cv_to_job(job_skills, user_skills)
    s2_result = job_to_cv(
        job_skills_raw    = job_skills,
        job_fields_raw    = job_fields,
        job_location      = job_location,
        job_company       = job_company,
        include_skills    = include_skills,
        include_fields    = include_fields,
        include_locations = include_locations,
        include_companies = include_companies,
        exclude_skills    = exclude_skills,
        exclude_fields    = exclude_fields,
        exclude_locations = exclude_locations,
        exclude_companies = exclude_companies,
    )

    s1 = s1_result["score"]
    s2 = s2_result["score"]
    avg = match_score(s1, s2)

    llm_result = {"score": None, "rationale": None}
    if run_llm:
        raw = llm_score(
            job_title        = job_title,
            job_description  = job_description,
            cv_text          = cv_text,
            cv_to_job_score  = s1,
            job_to_cv_score  = s2,
            groq_client      = groq_client,
        )
        llm_result["score"]     = raw.get("score")
        llm_result["rationale"] = raw.get("rationale") or raw.get("error")

    return {
        "job_id":           job_id,
        "cv_to_job_score":  s1,
        "job_to_cv_score":  s2,
        "match_score":      avg,
        "cv_to_job_detail": s1_result,
        "job_to_cv_detail": s2_result,
        "llm_score":        llm_result["score"],
        "llm_rationale":    llm_result["rationale"],
    }














# ==================== 3. COMPANY REPUTATION SCORE ====================

def load_company_databases():
    global top_1k_companies, top_2k_companies, top_10k_companies
    try:
        top_1k_companies = pd.read_csv('datasets/Top_1k.csv')['company_name'].dropna().str.lower().str.strip().tolist()
    except Exception:
        top_1k_companies = []
    try:
        top_2k_companies = pd.read_csv('datasets/Top_2k.csv')['Company'].dropna().str.lower().str.strip().tolist()
    except Exception:
        top_2k_companies = []
    try:
        top_10k_companies = pd.read_csv('datasets/Top_10k.csv')['Company_name'].dropna().str.lower().str.strip().tolist()
    except Exception:
        top_10k_companies = []

load_company_databases()

COMPANY_SUFFIXES = ['inc', 'llc', 'ltd', 'corp', 'incorporated', 'limited', '.', ',']

def score_company(company: str) -> float:
    c = company.lower()
    for s in COMPANY_SUFFIXES:
        c = c.replace(s, '').strip()
    for top in top_1k_companies:
        if c in top or top in c: return 8.0
    for top in top_2k_companies:
        if c in top or top in c: return 5.0
    for top in top_10k_companies:
        if c in top or top in c: return 3.0
    return 0.0


# ==================== 4. RED FLAG PENALTIES ====================

RED_FLAGS_HARD = [
    '3+ years', '5+ years', 'minimum 3 years', 'minimum 5 years',
    'at least 3 years', 'at least 5 years',
    '3 years of professional experience', '5 years of professional experience',
    'not eligible for students', 'no co-op', 'not a co-op position',
    'permanent residents only',
    'unpaid', 'no compensation', 'volunteer only', 'for credit only',
    'no visa sponsorship', 'no sponsorship', 'will not sponsor',
    'must be authorized to work in the united states',
    'warehouse', 'commercial driver', 'cdl required',
]

RED_FLAGS_SOFT = [
    '7+ years', '10+ years', 'principal engineer', 'staff engineer',
    'commission only', 'base salary not guaranteed',
]

def score_red_flags(job_desc: str) -> float:
    jd = job_desc.lower()
    penalty = 0.0
    for flag in RED_FLAGS_HARD:
        if flag in jd: penalty -= 8.0
    for flag in RED_FLAGS_SOFT:
        if flag in jd: penalty -= 3.0
    if len(jd.split()) < 150:
        penalty -= 2.0
    return penalty


# ==================== 5. SKILL MATCH SCORE ====================

CV_SKILLS_EXACT = [
    'python', 'javascript', 'sql', 'bash', ' c ',
    'react', 'react native', 'vue', 'vue.js',
    'fastapi', 'flask', 'celery', 'jetpack compose',
    'git', 'docker', 'jenkins', 'linux',
    'supabase', 'vercel', 'render', 'android studio',
    'sqlalchemy', 'postgresql', 'postgres', 'redis',
    'azure', 'power platform', 'kotlin',
]

CV_SKILLS_ADJACENT = [
    'typescript', 'node.js', 'nodejs', 'express',
    'graphql', 'rest api', 'restful api',
    'kubernetes', 'aws', 'gcp', 'terraform',
    'pytorch', 'tensorflow', 'scikit-learn', 'pandas', 'numpy',
    'kafka', 'rabbitmq', 'elasticsearch',
    'next.js', 'nextjs', 'tailwind',
    'mongodb', 'mysql', 'sqlite',
    'github actions', 'ci/cd', 'devops',
    'spring boot', 'django',
    'websocket', 'grpc',
    'spark', 'airflow', 'dbt',
    'openai', 'langchain', 'hugging face',
]

def score_skill_match(job_desc: str) -> float:
    jd = job_desc.lower()
    exact = sum(1 for s in CV_SKILLS_EXACT    if s in jd)
    adj   = sum(1 for s in CV_SKILLS_ADJACENT if s in jd)

    if exact == 0 and adj == 0: return -3.0
    if exact == 0: return min(adj * 0.5, 5.0)
    if exact <= 2:   score = exact * 2.0   + adj * 0.5
    elif exact <= 5: score = exact * 2.5   + adj * 0.75
    else:            score = exact * 3.0   + adj * 0.75

    return min(score, 20.0)



LOCATION_PREFERRED = [
    'waterloo', 'toronto', 'ottawa', 'vancouver', 'montreal', 'kitchener',
    'san francisco', 'new york', 'seattle', 'austin', 'boston',
    'berlin', 'london', 'singapore', 'amsterdam',
]

def score_location(location: str, job_desc: str = '') -> float:
    combined = f"{location} {job_desc}".lower()
    score = 0.0
    for kw in LOCATION_REMOTE:
        if kw in combined: score += 2.0; break
    for city in LOCATION_PREFERRED:
        if city in combined: score += 1.0; break
    return score







WEIGHTS = {
    'title_score':          1.5,
    'employment_score':     2.0,
    'company_score':        0.5,
    'skill_match_score':    1.8,
    'role_relevance_score': 1.7,
    'red_flag_penalty':     2.5,
    'salary_score':         0.6,
    'company_desc_score':   0.8,
    'location_score':       0.3,
    'culture_score':        0.4,
    # 'hf_semantic_score':  0.4,
}

THRESHOLD_PRE_CL  = 10.0
THRESHOLD_POST_CL = 60.0


# ==================== MAIN ====================

def calculate_job_score(job_data: dict) -> dict:
    title        = job_data.get('title', '').lower()
    tags         = job_data.get('tags', [])
    company      = job_data.get('company', '').lower()
    job_desc     = job_data.get('job_desc', '').lower()
    company_desc = (job_data.get('company_desc') or 'None').lower() if job_data else ''
    location     = job_data.get('location', '').lower()

    scores = {
        'title_score':          score_title(title),
        'employment_score':     score_employment(title, tags, job_desc),
        'company_score':        score_company(company),
        'skill_match_score':    score_skill_match(job_desc),
        'role_relevance_score': score_role_relevance(job_desc),
        'red_flag_penalty':     score_red_flags(job_desc),
        'salary_score':         score_salary(tags, job_desc),
        'company_desc_score':   score_company_desc(company_desc),
        'location_score':       score_location(location, job_desc),
        'culture_score':        score_culture(job_desc),
        # 'hf_semantic_score':  0,
    }

    final_score = min(
        round(sum(scores[k] * WEIGHTS.get(k, 1.0) for k in scores), 2),
        100.0  # global cap
    )

    return {
        'final_score': final_score,
        'score_breakdown': scores,
    }