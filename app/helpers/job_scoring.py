import pandas as pd
import re


# ==================== 1. TITLE SCORE ====================
# Deduplication: longer/more specific keywords checked first.
# Once a keyword group fires, shorter overlapping ones are skipped.

# Ordered most-specific → least-specific within each group
TITLE_CS_CORE = [
    'software engineer', 'software developer',
    'backend engineer', 'backend developer',
    'frontend engineer', 'frontend developer',
    'full-stack engineer', 'full-stack developer',
    'fullstack engineer', 'fullstack developer',
    'full stack engineer', 'full stack developer',
    'systems engineer', 'platform engineer',
    'infrastructure engineer', 'cloud engineer', 'cloud developer',
    'distributed systems', 'swe', 'sde',
    # fallbacks — only fire if none of the above matched
    'software', 'backend', 'back-end', 'back end',
    'frontend', 'front-end', 'front end',
    'full stack', 'fullstack', 'full-stack',
    'systems', 'platform', 'infrastructure',
    'distributed', 'developer', 'engineer',
]

TITLE_DATA_AI_ML = [
    'machine learning engineer', 'ml engineer', 'ai engineer',
    'data engineer', 'data scientist', 'data analyst',
    'research engineer', 'applied scientist', 'mlops engineer',
    'data platform engineer',
    # fallbacks
    'machine learning', 'nlp', 'computer vision', 'deep learning',
    'ai/ml', 'data platform',
]

TITLE_STUDENT_COOP = [
    'software engineer internship', 'software engineer co-op',
    'software engineering intern', 'swe intern', 'sde intern',
    'co-op', 'coop', 'co op', 'internship', 'intern',
    'new grad', 'university', 'student', 'graduate',
    'junior', 'entry-level', 'entry level',
]

TITLE_TEMPORAL_MATCH = [
    'fall 2026', 'fall term 2026', 'september 2026',
    'sept 2026', 'sept-dec 2026', 'sep-dec 2026',
    'fall/winter 2026', 'fall winter 2026', 'f26',
]

TITLE_HARD_NEGATIVE = [
    'marketing', 'sales', 'accounting', 'finance',
    'tax', 'audit', 'legal', 'law',
    'pharma', 'nursing', 'biology', 'chemistry',
    'mechanical engineer', 'civil engineer',
    'electrical engineer', 'hardware engineer',
    'recruiter', 'hr ', 'human resources',
    'graphic design', 'ux design', 'product design',
    'supply chain', 'logistics',
    'business analyst', 'program manager',
]

TITLE_SOFT_NEGATIVE = [
    'senior', 'staff ', 'principal', 'lead ',
    'manager', 'director', 'vp ', 'head of',
]

TITLE_RED_FLAGS = ['rockstar', 'ninja', 'guru', 'wizard', '10x']

def score_title(title: str) -> float:
    t = title.lower()
    score = 0.0

    # For CS core — fire once per group using first match (dedup)
    cs_fired = False
    for kw in TITLE_CS_CORE:
        if kw in t:
            score += 2.5
            cs_fired = True
            break  # only count one CS core match

    ai_fired = False
    for kw in TITLE_DATA_AI_ML:
        if kw in t:
            score += 3.0
            ai_fired = True
            break

    student_fired = False
    for kw in TITLE_STUDENT_COOP:
        if kw in t:
            score += 3.5
            student_fired = True
            break

    temporal_fired = False
    for kw in TITLE_TEMPORAL_MATCH:
        if kw in t:
            score += 5.0
            temporal_fired = True
            break

    for kw in TITLE_HARD_NEGATIVE:
        if kw in t:
            score -= 6.0
            break  # one hard negative is enough

    for kw in TITLE_SOFT_NEGATIVE:
        if kw in t:
            score -= 2.0
            break

    for kw in TITLE_RED_FLAGS:
        if kw in t:
            score -= 2.0

    return min(score, 14.0)  # cap: best possible title = ~14


# ==================== 2. EMPLOYMENT TYPE SCORE ====================

EMPLOYMENT_STRONG_POSITIVE = [
    'co-op', 'coop', 'co op', 'internship', 'intern',
    'new grad', 'student program', 'university hire', 'graduate program',
]

EMPLOYMENT_TEMPORAL_POSITIVE = [
    'fall 2026', 'fall term', 'september', 'sept',
    'september-december', 'september–december',
    'sept-dec', 'sep-dec', 'fall/winter', '4 month', 'four month',
]

EMPLOYMENT_TEMPORAL_NEGATIVE = [
    'summer only', 'may-august', 'may–august',
    'may to august', 'summer 2026', 'spring term', 'winter 2026',
]

EMPLOYMENT_HARD_NEGATIVE = [
    'permanent', 'full-time permanent', 'contract only', 'freelance',
    '12 month contract', '18 month',
    'not eligible for students', 'not available for co-op',
]

def score_employment(title: str, tags: list, job_desc: str) -> float:
    combined = f"{title} {' '.join(tags or [])} {job_desc}".lower()
    score = 0.0

    # Fire once per group
    for kw in EMPLOYMENT_STRONG_POSITIVE:
        if kw in combined:
            score += 5.0
            break

    for kw in EMPLOYMENT_TEMPORAL_POSITIVE:
        if kw in combined:
            score += 4.0
            break

    for kw in EMPLOYMENT_TEMPORAL_NEGATIVE:
        if kw in combined and 'fall' not in combined:
            score -= 4.0
            break

    for kw in EMPLOYMENT_HARD_NEGATIVE:
        if kw in combined:
            score -= 8.0
            break

    return min(score, 10.0)  # cap at 10


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


# ==================== 6. ROLE RELEVANCE SCORE ====================

ROLE_STRONG_POSITIVE = [
    'build and ship', 'design and implement', 'develop and maintain',
    'build scalable', 'design scalable', 'build production',
    'backend systems', 'backend services', 'backend infrastructure',
    'distributed systems', 'microservices', 'service-oriented architecture',
    'rest apis', 'restful apis', 'api development', 'api design',
    'data pipelines', 'etl pipeline', 'data infrastructure',
    'real-time systems', 'event-driven', 'message queue',
    'cloud infrastructure', 'platform engineering',
    'performance optimization', 'system design',
    'full stack', 'end-to-end',
    'train models', 'model deployment', 'mlops', 'inference pipeline',
    'llm', 'large language model', 'generative ai', 'rag',
    'computer vision', 'nlp', 'natural language processing',
    'deep learning', 'neural network', 'model training', 'fine-tuning',
    'android development', 'mobile development', 'react native', 'ios development',
    'own features', 'own the', 'end-to-end ownership',
    'production systems', 'production code', 'ship to production',
    'used by thousands', 'at scale', 'large scale',
]

ROLE_MODERATE_POSITIVE = [
    'collaborate with engineers', 'work with senior engineers',
    'agile', 'scrum', 'code review', 'pull request',
    'unit testing', 'integration testing', 'tdd',
    'open source', 'debugging', 'troubleshooting',
    'technical documentation', 'architecture decisions',
]

ROLE_NEGATIVE = [
    'manual testing only', 'qa only', 'test case writing only',
    'data entry', 'spreadsheet modeling', 'excel only',
    'customer support', 'help desk', 'tier 1 support',
    'cold calling', 'lead generation', 'telemarketing',
    'administrative', 'social media management', 'content creation',
]

def score_role_relevance(job_desc: str) -> float:
    jd = job_desc.lower()
    score = 0.0
    for kw in ROLE_STRONG_POSITIVE:
        if kw in jd: score += 2.0
    for kw in ROLE_MODERATE_POSITIVE:
        if kw in jd: score += 0.75
    for kw in ROLE_NEGATIVE:
        if kw in jd: score -= 4.0
    return min(score, 18.0)


# ==================== 7. COMPANY DESCRIPTION SCORE ====================

COMPANY_DOMAINS_STRONG = [
    'developer tools', 'devtools', 'developer platform',
    'infrastructure', 'platform as a service', 'paas',
    'fintech', 'payments', 'point of sale', 'pos',
    'e-commerce', 'ecommerce', 'marketplace',
    'ai company', 'ai-first', 'machine learning platform',
    'llm', 'generative ai', 'foundation model',
    'saas', 'b2b saas', 'enterprise software',
    'cloud provider', 'cloud platform',
    'cybersecurity', 'security platform',
    'data platform', 'analytics platform',
    'mobile platform', 'open source',
]

COMPANY_DOMAINS_MODERATE = [
    'software company', 'technology company', 'tech startup',
    'digital transformation', 'automation',
    'healthtech', 'health tech', 'medtech',
    'edtech', 'education technology',
    'gaming', 'game engine',
    'telecommunications', 'telecom',
    'logistics technology', 'proptech', 'adtech',
]

def score_company_desc(company_desc: str) -> float:
    cd = company_desc.lower()
    score = 0.0
    for kw in COMPANY_DOMAINS_STRONG:
        if kw in cd: score += 2.0
    for kw in COMPANY_DOMAINS_MODERATE:
        if kw in cd: score += 1.0
    return min(score, 8.0)


# ==================== 8. SALARY SCORE ====================

def score_salary(tags: list, job_desc: str) -> float:
    combined = f"{' '.join(tags or [])} {job_desc}".lower()

    hourly_matches = re.findall(
        r'\$(\d+(?:\.\d+)?)(?:\s*[-–]\s*\$?(\d+(?:\.\d+)?))?'
        r'(?:\s*/\s*(?:hr|hour)|\s+per\s+hour|\s+hourly)',
        combined
    )
    annual_matches = re.findall(
        r'\$(\d{2,3}),?000(?:\s*[-–]\s*\$?(\d{2,3}),?000)?'
        r'(?:\s*/\s*(?:year|yr|annual)|\s+annually|\s+per\s+year)?',
        combined
    )

    all_hourly = []
    for lo, hi in hourly_matches:
        if lo: all_hourly.append(float(lo))
        if hi: all_hourly.append(float(hi))
    for lo, hi in annual_matches:
        if lo: all_hourly.append(float(lo.replace(',', '')) / 2080)
        if hi: all_hourly.append(float(hi.replace(',', '')) / 2080)

    if not all_hourly: return 0.0

    avg = sum(all_hourly) / len(all_hourly)
    if avg < 18:   return -4.0
    elif avg < 22: return  0.0
    elif avg < 28: return  3.0
    elif avg < 40: return  5.0
    elif avg < 55: return  4.0
    else:          return  2.0


# ==================== 9. LOCATION SCORE ====================

LOCATION_REMOTE = [
    'remote', 'hybrid', 'work from home', 'wfh',
    'distributed', 'fully remote', 'remote-first',
]

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


# ==================== 10. CULTURE / GROWTH SCORE ====================

CULTURE_LEARNING = [
    'mentorship', 'mentor', 'paired with senior', 'training program',
    'learning opportunities', 'professional development', 'onboarding program',
    'career growth', 'growth opportunities', 'hackathon',
    'conference budget', 'learning budget', 'education budget',
    'tech talks', 'knowledge sharing', 'lunch and learn',
    'engineering blog', 'open source contributions encouraged',
]

CULTURE_PERKS = [
    'equity', 'stock options', 'rsu', 'esop', 'profit sharing',
    'relocation assistance', 'relocation stipend', 'housing stipend',
    'signing bonus', 'competitive compensation', 'performance bonus',
]

CULTURE_ENG_QUALITY = [
    'code review culture', 'high engineering standards', 'engineering excellence',
    'ci/cd pipeline', 'automated testing', 'technical roadmap',
    'engineer-driven', 'flat structure', 'small team',
    'fast-moving', 'high velocity', 'production systems at scale',
    'shipped to millions',
]

def score_culture(job_desc: str) -> float:
    jd = job_desc.lower()
    score = 0.0
    for kw in CULTURE_LEARNING:
        if kw in jd: score += 1.5
    for kw in CULTURE_PERKS:
        if kw in jd: score += 1.0
    for kw in CULTURE_ENG_QUALITY:
        if kw in jd: score += 1.5
    return min(score, 8.0)


# ==================== HF SEMANTIC SCORE ====================
# TODO: implement LLM semantic alignment score
# Rules when implemented:
#   - Capped, never overrides hard red flags
#   - Tie-breaker only
#   - Prompt: "Rate alignment between this JD and CV 0-10"
#
# def score_hf_semantic(job_desc: str, cv_summary: str) -> float:
#     ...
#     return min(float(model_score), 10.0) * 0.4


# ==================== WEIGHTS ====================

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