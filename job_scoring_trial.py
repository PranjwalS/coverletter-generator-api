# Let's do some boring work now mate, its called job scoring work, its a celery task and its a small predecessor to my coverlettter gneerator celery job, but we have to discuss it properly to understand what we are trying to create. It is basically what it sounds like, Job Scoring task.
# I need a bunch of params, like a genuine fuck ton, and a ton of manual NLP work, as well as some external hugging face ones that will all be used to pretty much score our jobs one by one, before we even deem them good enough for the coverletter generation, pretty much the scores that are generated will be primordial in two steps, the first (with a lower threshold) to determine whats job are even related to my field mate right, and the second time it gets used is after coverletter is generated, we use a higher threshold query on that column to find jobs that are more pressing to be applied to. Hence the idea for the job_scoring needs to be insanely well done, it's an important aspect pretty much, and a real real time saver to be honest, more then anything else. I don't mind vibecoding this part since it'll be pretty basic python checks, but we'll take it step by step, param by param, so the params makes sense. 
# I do want your input on how would should approach it, first we'll scaffold textually all the params to use, and then we'll write up some code for it, and then turn and test it as a celery task. delay pretty much!

# The major info that we are currently scraping are:
# Title, Tags (sometimes include wage $$), Company name, Job description (vital), and Company description (also vital), I believe these are enough to leverage and quantify every job, moreover since we have access to my CV as well as my personal preferences, as I'm making it lmao.

# So basically, we need to create many params that pretty much every job starts at 0, and we add points AND remove points depending on these params that come from these scraped info pretty much mate.

# Basically; this is a very bare bones version and really a fraction of what i truly truly want and expect from scoring, but here are some initial params that made quite some sense to me:

# 1. We look at the title, if it contains anything that are keywords relating to ['SE', 'CS', "Software" .... and stuff like that we add points, more so, we also define a list of anti ones init, so if i see some bullshit like pharma, marketing, tax, law, stuff like that, that would remove points
# 2. We look at title for stuff like "INtern", "Co-Op", "University" and particularly "Fall 2026" since that is most important to us mate right, and some anti can be "8 months", "Summer 2026" (wo fall mention cause some jobs do Summer/Fall 2026 to show multiple positons possible lmao), and you know some that are just concerning, maybe like Permanent and whatnot too in here

# 3. Moving into tags, if the tags have the wage, then we pull that aside so look for $ signs in there, and we'll do a dif param on this later, but ya use this. And we just look for other tags, maybe nothing to add, but we remove points if we see anything like Part-time, Permanent, Contract and yk that shit mate

# 4. moving into company name, this oculd be interesting, because we can look on kaggle for a few databases (im thinking two to start) and basically just a list of 1. Top 2000 companies in world and 2. Top 10000 companies in world, and if the company in question matches that on the db anywhere, then we can add points, so no removing but rather adding lmao

# 5. The job description now, this is a very very very heavy one, one that will require quite a lot of manipulation in my opinion fam, we will have to very precise in here, because mistakes are easy, i am quite undecided here tbh on what can be done, but at least one is to do NLP on it, to see what we can do and see if we can mathc it to CV somehow, and also pull out hte $ sign and add it to the var for wage
# 6. Give points for high wage, some jobs might not have any so no removing if none, but if lower then 25 then do - points and above 25 is added accrodingly, but not too high cause we aint getting lmao
# 7. Just shorter briefer stuff on the company description now, ofc it will be common to find companies that do something else but still have a fun cs position so its not too telling, but maybe we add points if ther are keywords that i like say ['machine learning, 'ai', 'merchant', 'pos' and stuff like that if ever the company primarily deals with it just add some points lmao
# 8. I can do a bare call to another hf model, where the job is i give him all the textual dta, and ask for his opinion for a pure neutral rating of the position compared to my cv, so completely take this with a grain of salt, ill judge this myself, whether to trust said hf model compared to my liking of the job and see if it matches, and depending on the relative maximal likehihood between ours lmao, i'll assign points to it in bonus or neg even to overall score

# Other then this i think the major stuff needs to just be done on the job description, where we mainly look for red flags like full time, or some dumb shit and whatnot that somehow mad eit past, like that param aroun dthe job desc will be numerou sones actuall and quite stacked, we have to think sometihng smart up


# # The Nuclear Options Param
# Unpaid mentions - Sometimes sneaks into descriptions. Auto-reject tier.
# "Visa sponsorship" mentions - If you need it and they explicitly say no, auto-deduct heavily. If they offer it, boost.

# #Others
# Description length - Super short descriptions (< 200 words) might indicate low effort posting. Deduct slightly.

# Location/Remote scoring is still missing from your params list, and it's actually pretty high-signal:

# Jobs that say "Remote" or "Hybrid" → bonus points (flexible, modern company)
# Jobs that say "On-site in [random small town]" → penalty (unless you'd actually move there)
# Jobs in cities you like (Waterloo, Toronto, SF, NYC, wherever) → bonus

# Mentions of learning/mentorship - For co-ops especially, if they mention training programs or mentorship, that's huge. Add points.
# "Equity" / "Stock options" mentions - Even for interns, if they mention this, shows they value you. Add points.

# Alright. Deep breath. This is actually a **really good system idea**, and you’re thinking about it the *right* way. Let’s slow this down, structure it cleanly, and make sure this scoring engine is something you can trust long-term — not some vibes-only heuristic that bites you later.

# I’m gonna do this in **layers**, not code yet.

# ---

# ## Big Picture (so we don’t lose the plot)

# You want **one canonical score per job**, but that score is used at **two different decision points**:

# 1. **Pre-cover-letter filter (low threshold)**
#    → “Is this even CS-related / worth generating a CL for?”

# 2. **Post-cover-letter prioritization (high threshold)**
#    → “Which jobs do I actually apply to first?”

# That means:

# * The score must be **stable**
# * The score must be **explainable**
# * You must be able to **tune weights without rewriting logic**

# So the design goal is not “clever NLP”
# It’s **robust, interpretable, and tunable**.

# ---

# ## Core Design Principle (important)

# Instead of “one blob score”, we design:

# ### ✅ **Modular sub-scores**

# Each category contributes its own bounded score.

# Example:

# ```
# title_score
# employment_type_score
# company_score
# job_desc_skill_match_score
# job_desc_red_flag_score
# salary_score
# company_desc_interest_score
# hf_semantic_score
# ```

# Then:

# ```
# final_score = weighted_sum(all_sub_scores)
# ```

# This lets you:

# * Debug easily
# * Kill or weaken bad heuristics
# * Log *why* a job scored low or high

# You’ll thank yourself later.

# ---

# ## Let’s Scaffold ALL Params (Textual, No Code Yet)

# I’ll go category by category and **expand** what you already proposed.

# ---

# # 1️⃣ Title-Based Scoring (High Signal, Low Cost)

# ### Positive keywords (add points)

# **Core CS identity**

# ```
# software, engineer, developer, backend, frontend, full-stack,
# machine learning, data, platform, infrastructure, systems,
# distributed, cloud, ai, ml
# ```

# **Student-specific**

# ```
# intern, internship, co-op, coop, university, student
# ```

# **Temporal**

# ```
# fall 2026, fall term, september
# ```

# ### Negative keywords (hard penalties)

# ```
# marketing, sales, accounting, finance-only, tax, audit,
# law, legal, pharma, nursing, biology, chem,
# mechanical, civil, electrical (careful: context-aware later)
# ```

# ### Soft negatives (lighter penalty)

# ```
# senior, staff, principal, lead
# ```

# > ⚠️ Important: **do NOT delete jobs based on title alone**
# > Only score.

# ---

# # 2️⃣ Employment Type & Duration (Title + Tags + Desc)

# This one is HUGE for filtering.

# ### Strong positives

# ```
# internship, co-op, university hire, student program
# ```

# ### Strong negatives (almost disqualifiers)

# ```
# full-time permanent
# 8 months
# 12 months
# contract
# part-time
# freelance
# ```

# ### Contextual logic (important)

# * “Summer/Fall 2026” → small penalty, not full
# * “May–August” → soft penalty
# * “September–December” → strong positive

# This category alone can kill 50% of junk jobs.

# ---

# # 3️⃣ Tags Parsing (Lightweight but Useful)

# ### Wage extraction

# * Regex for `$`, `$/hr`, `hour`, `hourly`
# * Save:

#   ```
#   min_wage
#   max_wage
#   ```

# ### Tag-based negatives

# ```
# part-time, contract, permanent, remote-only (maybe soft),
# on-call
# ```

# Mostly penalties, little upside here.

# ---

# # 4️⃣ Company Name Reputation Score

# This is **pure upside**, never penalty.

# ### Two-tier approach (good call btw):

# * Top 2k companies → bigger bonus
# * Top 10k companies → smaller bonus

# Extra spice:

# * Case-insensitive fuzzy matching
# * Strip “Inc”, “LLC”, “Ltd”, “Corp”

# This gives legitimacy weighting without biasing too hard.

# ---

# # 5️⃣ Job Description — THE HEART OF THE SYSTEM 🧠🔥

# This is where we go deep.

# I’m splitting this into **multiple independent params**, not one blob.

# ---

# ## 5A. Red Flag Detection (Hard Penalties)

# Search **job description text** for:

# ### Employment deal-breakers

# ```
# full-time
# permanent
# contract role
# not eligible for students
# requires authorization
# minimum 3+ years experience
# ```

# These should be **large negative weights**.

# ---

# ## 5B. Skill Match Score (CV ↔ Job)

# This is **huge** and totally doable without LLMs first.

# ### Step 1: Build your CV skill dictionary

# Group skills:

# ```
# languages: python, java, c++, kotlin
# frameworks: react, fastapi, spring, django
# infra: docker, kubernetes, redis, postgres
# ml: pytorch, tensorflow, sklearn
# ```

# ### Step 2: Extract skills from job description

# * Regex / keyword-based first
# * Later upgrade to NER

# ### Step 3: Overlap score

# ```
# overlap_ratio = matched_skills / required_skills
# ```

# This gives you:

# * Strong numeric signal
# * Explainability (“matched 8/10 skills”)

# ---

# ## 5C. Role Relevance Score

# Not just skills — **what are you doing?**

# Positive phrases:

# ```
# build, design, develop, implement, scale, optimize
# backend systems, APIs, pipelines, platforms
# ```

# Negative phrases:

# ```
# manual testing
# data entry
# support role
# customer service
# ```

# This filters “CS-adjacent but lame” jobs.

# ---

# ## 5D. Requirements Strictness Score

# Count occurrences of:

# ```
# required, must have, minimum X years
# ```

# Too many → penalty
# Intern postings with insane requirements get punished.

# ---

# # 6️⃣ Salary Score (Bounded, Realistic)

# Rule-based, no ML needed.

# Example:

# ```
# < $20/hr     → big penalty
# $20–25/hr   → neutral
# $25–35/hr   → strong positive
# $35–45/hr   → capped positive
# >$45/hr     → no extra bonus (avoid fantasy bias)
# ```

# If no salary → neutral, NOT penalty.

# ---

# # 7️⃣ Company Description Interest Alignment

# Lightweight, soft bonus only.

# Keywords you like:

# ```
# ai, machine learning, fintech, payments, pos,
# merchant, platform, infrastructure
# ```

# This is seasoning, not main course.

# ---

# # 8️⃣ HF / LLM Semantic Opinion (Optional, Capped)

# You’re thinking about this *correctly* already.

# Rules:

# * This score is **capped**
# * It NEVER overrides hard red flags
# * Used as **tie-breaker**, not decider

# Prompt idea:

# > “Given this job description and this CV, rate alignment from 0–10 and explain briefly.”

# You then:

# ```
# hf_score = clamp(model_score * weight)
# ```

# Later you can empirically tune trust.

# ---

# ## Final Scoring Model (Conceptual)

# ```
# final_score =
#   w1 * title_score
# + w2 * employment_score
# + w3 * company_score
# + w4 * skill_match_score
# + w5 * role_relevance_score
# + w6 * red_flag_penalty
# + w7 * salary_score
# + w8 * company_desc_score
# + w9 * hf_score
# ```

# ---

# ## Threshold Logic (CRUCIAL)

# ### Threshold A — Pre-CL

# ```
# if final_score < T1:
#     delete job
# ```

# ### Threshold B — Post-CL Priority

# ```
# if final_score >= T2:
#     apply immediately
# else:
#     backlog
# ```

# ---

# ## Celery Architecture (High Level)

# You’ll want:

# * `job_scoring(job_id)` task
# * Writes:

#   ```
#   score
#   score_breakdown (JSON)
#   scored_at
#   ```

# Then your cover letter task just does:

# ```
# WHERE score >= T1 AND processed_coverletter = false
# ```

# Clean. Modular. Fast.

# ---

# ## Next Step (tell me how you want to proceed)

# We’re at a fork. Pick ONE:

# 1️⃣ **Deep-dive job description NLP first** (skills extraction + red flags)
# 2️⃣ **Define exact weights + score ranges**
# 3️⃣ **Scaffold the Python scoring function skeleton**
# 4️⃣ **Design the Supabase schema additions**
# 5️⃣ **Turn this into a Celery task immediately**

# Say the number.
# We’ll build it clean, no yapping, no chaos.













# Job Scoring System - Modular Architecture

# Core Design Principle: Modular sub-scores that contribute to a weighted final score
# This allows for easy debugging, tuning, and explainability

# The score is used at two decision points:
# 1. Pre-cover-letter filter (low threshold) - "Is this even CS-related / worth generating a CL for?"
# 2. Post-cover-letter prioritization (high threshold) - "Which jobs do I actually apply to first?"

# Final scoring model:
# final_score = w1*title_score + w2*employment_score + w3*company_score + w4*skill_match_score
#             + w5*role_relevance_score + w6*red_flag_penalty + w7*salary_score
#             + w8*company_desc_score + w9*location_score + w10*culture_score + w11*hf_score


# ==================== 1. TITLE-BASED SCORING ====================
TITLE_POSITIVE_CS = [
    'software', 'engineer', 'developer', 'backend', 'frontend', 'full-stack', 'fullstack',
    'machine learning', 'data', 'platform', 'infrastructure', 'systems',
    'distributed', 'cloud', 'ai', 'ml', 'swe', 'sde'
]

TITLE_POSITIVE_STUDENT = [
    'intern', 'internship', 'co-op', 'coop', 'university', 'student'
]

TITLE_POSITIVE_TEMPORAL = [
    'fall 2026', 'fall term', 'september', 'sept 2026'
]

TITLE_NEGATIVE_HARD = [
    'marketing', 'sales', 'accounting', 'finance-only', 'tax', 'audit',
    'law', 'legal', 'pharma', 'nursing', 'biology', 'chem',
    'mechanical', 'civil', 'electrical'
]

TITLE_NEGATIVE_SOFT = [
    'senior', 'staff', 'principal', 'lead', 'manager'
]

TITLE_RED_FLAGS = [
    'rockstar', 'ninja', 'guru', 'wizard'
]

def score_title(title: str) -> float:
    score = 0
    
    # CS keywords
    for keyword in TITLE_POSITIVE_CS:
        if keyword in title:
            score += 2
    
    # Student-specific
    for keyword in TITLE_POSITIVE_STUDENT:
        if keyword in title:
            score += 3
    
    # Temporal (Fall 2026)
    for keyword in TITLE_POSITIVE_TEMPORAL:
        if keyword in title:
            score += 4
    
    # Hard negatives (non-CS)
    for keyword in TITLE_NEGATIVE_HARD:
        if keyword in title:
            score -= 5
    
    # Soft negatives (too senior)
    for keyword in TITLE_NEGATIVE_SOFT:
        if keyword in title:
            score -= 2
    
    # Red flags (cringe)
    for keyword in TITLE_RED_FLAGS:
        if keyword in title:
            score -= 3
    
    return score




# ==================== 2. EMPLOYMENT TYPE & DURATION ====================
# Huge for filtering - can kill 50% of junk jobs

EMPLOYMENT_POSITIVE = [
    'internship', 'co-op', 'coop', 'university hire', 'student program'
]

EMPLOYMENT_NEGATIVE_HARD = [
    'full-time permanent', 'permanent', 'full time',
    '8 months', '12 months', 'contract', 'freelance'
]

EMPLOYMENT_NEGATIVE_SOFT = [
    'part-time', 'part time'
]

EMPLOYMENT_TEMPORAL_NEGATIVE = [
    'summer 2026', 'may-august', 'may–august'
]

EMPLOYMENT_TEMPORAL_POSITIVE = [
    'september-december', 'september–december', 'september', 'fall 2026', 'fall term'
]

def score_employment(title: str, tags: list, job_desc: str) -> float:
    score = 0
    combined_text = f"{title} {' '.join(tags)} {job_desc}"
    
    # Strong positives
    for keyword in EMPLOYMENT_POSITIVE:
        if keyword in combined_text:
            score += 4
    
    # Hard negatives (disqualifiers)
    for keyword in EMPLOYMENT_NEGATIVE_HARD:
        if keyword in combined_text:
            score -= 6
    
    # Soft negatives
    for keyword in EMPLOYMENT_NEGATIVE_SOFT:
        if keyword in combined_text:
            score -= 2
    
    # Temporal negatives (Summer only)
    for keyword in EMPLOYMENT_TEMPORAL_NEGATIVE:
        if keyword in combined_text and 'fall' not in combined_text:
            score -= 3
    
    # Temporal positives (Fall)
    for keyword in EMPLOYMENT_TEMPORAL_POSITIVE:
        if keyword in combined_text:
            score += 5
    
    return score


# ==================== 3. TAGS PARSING ====================
# Lightweight but useful - wage extraction + employment type validation

# Wage extraction patterns (regex later)
# Look for: $, $/hr, hour, hourly

# Tag-based negatives
TAGS_NEGATIVE = [
    'part-time', 'contract', 'permanent', 'on-call'
]


# ==================== 4. COMPANY REPUTATION SCORE ====================
# Pure upside, never penalty - uses external databases

# Two-tier approach:
# - Top 2k companies -> bigger bonus
# - Top 10k companies -> smaller bonus

# Implementation notes:
# - Case-insensitive fuzzy matching
# - Strip: "Inc", "LLC", "Ltd", "Corp", "Incorporated", "Limited"





# ==================== 5. JOB DESCRIPTION ANALYSIS ====================
# The heart of the system - multiple independent sub-scores
# --- 5A. Red Flag Detection (Hard Penalties) ---
DESC_RED_FLAGS_EMPLOYMENT = [
    'full-time', 'full time', 'permanent', 'contract role',
    'not eligible for students', 'requires authorization',
    'minimum 3 years experience', 'minimum 5 years experience',
    '3+ years', '5+ years'
]

DESC_RED_FLAGS_UNPAID = [
    'unpaid', 'volunteer', 'no compensation', 'for credit only'
]

DESC_RED_FLAGS_VISA = [
    'no visa sponsorship', 'must be authorized to work', 'no sponsorship available'
]

REQUIREMENTS_STRICT = [
    'required', 'must have', 'minimum', 'mandatory', 'essential'
]

def score_red_flags(job_desc: str) -> float:
    penalty = 0
    
    # Employment red flags
    for flag in DESC_RED_FLAGS_EMPLOYMENT:
        if flag in job_desc:
            penalty -= 4
    
    # Unpaid (auto-reject tier)
    for flag in DESC_RED_FLAGS_UNPAID:
        if flag in job_desc:
            penalty -= 10
    
    # Visa issues
    for flag in DESC_RED_FLAGS_VISA:
        if flag in job_desc:
            penalty -= 7
    
    # Requirements strictness
    strict_count = sum(job_desc.count(word) for word in REQUIREMENTS_STRICT)
    if strict_count > 8:  # Too many strict requirements
        penalty -= 3
    
    # Description length check
    word_count = len(job_desc.split())
    if word_count < 200:
        penalty -= 2
    
    return penalty




# --- 5B. Skill Match Score (CV ↔ Job) ---
# Build CV skill dictionary grouped by category

CV_SKILLS = {
    'languages': ['python', 'java', 'javascript', 'typescript', 'c++', 'kotlin', 'go', 'rust'],
    'frameworks': ['react', 'fastapi', 'spring', 'django', 'flask', 'nextjs', 'vue'],
    'databases': ['postgres', 'postgresql', 'mysql', 'mongodb', 'redis', 'sqlite'],
    'infra': ['docker', 'kubernetes', 'aws', 'gcp', 'azure', 'terraform', 'jenkins'],
    'ml': ['pytorch', 'tensorflow', 'sklearn', 'scikit-learn', 'pandas', 'numpy']
}

# Skill extraction approach:
# 1. Regex / keyword-based first (flatten CV_SKILLS and search)
# 2. Later upgrade to NER if needed
# 3. Calculate overlap_ratio = matched_skills / required_skills


# --- 5C. Role Relevance Score ---
# Not just skills - what are you actually doing?

ROLE_POSITIVE = [
    'build', 'design', 'develop', 'implement', 'scale', 'optimize',
    'backend systems', 'apis', 'pipelines', 'platforms', 'microservices',
    'distributed systems', 'infrastructure'
]

ROLE_NEGATIVE = [
    'manual testing', 'qa only', 'data entry', 'support role',
    'customer service', 'help desk', 'tier 1 support'
]




# --- 5F. Learning & Mentorship & Benefits Indicators ---
CULTURE_POSITIVE_LEARNING = [
    'mentorship', 'mentor', 'training program', 'learning',
    'professional development', 'onboarding', 'career growth'
]

CULTURE_POSITIVE_EQUITY = [
    'equity', 'stock options', 'rsu', 'esop', 'profit sharing', 'stipends', 'relocation payments'
]


# ==================== 6. SALARY SCORE ====================
# Rule-based, bounded, realistic

# Salary ranges (hourly):
# < $20/hr     -> big penalty
# $20-25/hr   -> neutral
# $25-35/hr   -> strong positive
# $35-45/hr   -> capped positive
# > $45/hr     -> no extra bonus (avoid fantasy bias)

# If no salary mentioned -> neutral (NOT penalty)

# Salary extraction:
# - From tags ($ signs)
# - From job description (regex for $ patterns)

def score_salary(tags: list, job_desc: str) -> float:
    import re
    
    score = 0
    combined_text = f"{' '.join(tags)} {job_desc}"
    
    # Extract salary with regex
    salary_patterns = [
        r'\$(\d+)(?:-(\d+))?(?:/hr|/hour| per hour| hourly)?',
        r'(\d+)(?:-(\d+))?\s*(?:dollars?|USD)(?:/hr|/hour| per hour| hourly)?'
    ]
    
    salaries = []
    for pattern in salary_patterns:
        matches = re.findall(pattern, combined_text)
        for match in matches:
            if match[0]:
                salaries.append(int(match[0]))
            if match[1]:
                salaries.append(int(match[1]))
    
    if not salaries:
        return 0  # Neutral if no salary
    
    avg_salary = sum(salaries) / len(salaries)
    
    # Scoring tiers
    if avg_salary < 20:
        score -= 3
    elif 20 <= avg_salary < 25:
        score += 0
    elif 25 <= avg_salary < 35:
        score += 4
    elif 35 <= avg_salary < 45:
        score += 4
    else:  # >= 45
        score += 2 
    
    return score




# ==================== 7. COMPANY DESCRIPTION INTEREST ALIGNMENT ====================
# Lightweight, soft bonus only - seasoning, not main course

COMPANY_DESC_INTERESTS = [
    'ai', 'machine learning', 'fintech', 'payments', 'pos',
    'merchant', 'platform', 'infrastructure', 'saas', 'b2b',
    'developer tools', 'cloud', 'cybersecurity'
]


# ==================== 8. LOCATION & REMOTE SCORING ====================
# High signal - flexibility and location preferences

LOCATION_POSITIVE_REMOTE = [
    'remote', 'hybrid', 'work from home', 'wfh', 'distributed'
]

LOCATION_POSITIVE_CITIES = [
    'waterloo', 'toronto', 'san francisco', 'new york', 'seattle',
    'vancouver', 'montreal', 'austin', 'boston', 'berlin', 'singapore', 'tokyo',
    'kyoto', 'sf', 'nyc', 'usa', 'winnipeg'
]

def score_location(job_desc: str) -> float:
    score = 0
    
    # Remote/hybrid bonus
    for keyword in LOCATION_POSITIVE_REMOTE:
        if keyword in job_desc:
            score += 3
            break
    
    # Preferred cities
    for city in LOCATION_POSITIVE_CITIES:
        if city in job_desc:
            score += 2
            break
    
    return score

# ==================== 9. HF / LLM SEMANTIC OPINION ====================
# Optional, capped, used as tie-breaker

# Rules:
# - This score is CAPPED
# - It NEVER overrides hard red flags
# - Used as tie-breaker, not decider

# Prompt template:
# "Given this job description and this CV, rate alignment from 0-10 and explain briefly."

# hf_score = clamp(model_score * weight)


# ==================== SCORING WEIGHTS ====================
# Tunable parameters - adjust based on empirical results

WEIGHTS = {
    'title': 1.0,
    'employment': 2.0,  # Higher weight - critical filter
    'company': 0.5,
    'skill_match': 1.5,
    'role_relevance': 1.0,
    'red_flags': -3.0,  # Negative weight for penalties
    'salary': 0.8,
    'company_desc': 0.3,
    'location': 1.0,
    'culture': 0.5,  # Learning + equity combined
    'hf_semantic': 0.4  # Capped, tie-breaker only
}


# ==================== THRESHOLD LOGIC ====================

# Threshold A - Pre-CL filter
THRESHOLD_PRE_CL = 5.0  # If final_score < this, skip cover letter generation

# Threshold B - Post-CL priority
THRESHOLD_POST_CL = 8.0  # If final_score >= this, apply immediately (high priority)


# ==================== SCORING FUNCTION SKELETON ====================

def calculate_job_score(job_data: dict) -> dict:
    """
    Calculate comprehensive job score with breakdown.
    
    Args:
        job_data: Dict containing title, tags, company, job_desc, company_desc
        
    Returns:
        Dict with final_score and score_breakdown
    """
    
    scores = {
        'title_score': 0,
        'employment_score': 0,
        'company_score': 0,
        'skill_match_score': 0,
        'role_relevance_score': 0,
        'red_flag_penalty': 0,
        'salary_score': 0,
        'company_desc_score': 0,
        'location_score': 0,
        'culture_score': 0,
        'hf_semantic_score': 0
    }
    
    # Extract data
    title = job_data.get('title', '').lower()
    tags = job_data.get('tags', [])
    company = job_data.get('company', '').lower()
    job_desc = job_data.get('job_desc', '').lower()
    company_desc = job_data.get('company_desc', '').lower()
    
    # TODO: Implement each scoring component
    # scores['title_score'] = score_title(title)
    # scores['employment_score'] = score_employment(title, tags, job_desc)
    # scores['company_score'] = score_company(company)
    # scores['skill_match_score'] = score_skill_match(job_desc)
    # scores['role_relevance_score'] = score_role_relevance(job_desc)
    # scores['red_flag_penalty'] = score_red_flags(job_desc)
    # scores['salary_score'] = score_salary(tags, job_desc)
    # scores['company_desc_score'] = score_company_desc(company_desc)
    # scores['location_score'] = score_location(job_desc)
    # scores['culture_score'] = score_culture(job_desc)
    # scores['hf_semantic_score'] = score_hf_semantic(job_data)
    
    # Calculate weighted final score
    final_score = sum(scores[k] * WEIGHTS.get(k.replace('_score', '').replace('_penalty', ''), 1.0) 
                     for k in scores.keys())
    
    return {
        'final_score': final_score,
        'score_breakdown': scores,
        'pass_pre_cl': final_score >= THRESHOLD_PRE_CL,
        'high_priority': final_score >= THRESHOLD_POST_CL
    }


# ==================== CELERY TASK STRUCTURE ====================

# from celery import shared_task
# 
# @shared_task
# def job_scoring_task(job_id: int):
#     """
#     Celery task to score a job and update database.
#     
#     Writes to DB:
#     - score (float)
#     - score_breakdown (JSON)
#     - scored_at (timestamp)
#     """
#     
#     # Fetch job from DB
#     job_data = fetch_job_from_db(job_id)
#     
#     # Calculate score
#     result = calculate_job_score(job_data)
#     
#     # Update DB
#     update_job_score(
#         job_id=job_id,
#         score=result['final_score'],
#         score_breakdown=result['score_breakdown']
#     )
#     
#     return result





































