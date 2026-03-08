import pandas as pd
from datetime import datetime

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
    'internship', 'co-op', 'coop', 'university hire', 'student program', 'intern'
]

EMPLOYMENT_NEGATIVE_HARD = [
    'permanent',
    '8 months', '12 months', 'contract', 'freelance'
]

EMPLOYMENT_NEGATIVE_SOFT = [
    'part-time', 'part time'
]

EMPLOYMENT_TEMPORAL_NEGATIVE = [
    'summer 2026', 'may-august', 'may–august'
]

EMPLOYMENT_TEMPORAL_POSITIVE = [
    'september-december', 'september–december', 'september', 'fall 2026', 'fall'
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
            score += 4
    
    return score




# ==================== 4. COMPANY REPUTATION SCORE ====================
# Pure upside, never penalty - uses external databases

# Two-tier approach:
# - Top 2k companies -> bigger bonus
# - Top 10k companies -> smaller bonus

# Implementation notes:
# - Case-insensitive fuzzy matching
# - Strip: "Inc", "LLC", "Ltd", "Corp", "Incorporated", "Limited"

def load_company_databases():
    global top_1k_companies, top_2k_companies, top_10k_companies
    
    try:
        df_small = pd.read_csv('datasets/Top_1k.csv')
        top_1k_companies = df_small['company_name'].dropna().str.lower().str.strip().tolist()
    except Exception as e:
        top_1k_companies = []
        
    try:
        df_medium = pd.read_csv('datasets/Top_2k.csv')
        top_2k_companies = df_medium['Company'].dropna().str.lower().str.strip().tolist()
    except Exception as e:
        top_2k_companies = []
    
    try:
        df_large = pd.read_csv('datasets/Top_10k.csv')
        top_10k_companies = df_large['Company_name'].dropna().str.lower().str.strip().tolist()
    except Exception as e:
        top_10k_companies = []
load_company_databases()


def score_company(company: str) -> float:
    # Clean company name
    company_clean = company.lower()
    for suffix in ['inc', 'llc', 'ltd', 'corp', 'incorporated', 'limited', '.']:
        company_clean = company_clean.replace(suffix, '').strip()
    
    #Check top 1k
    for top_company in top_1k_companies:
        if company_clean in top_company.lower() or top_company.lower() in company_clean:
            return 8
        
    # Check top 2k
    for top_company in top_2k_companies:
        if company_clean in top_company.lower() or top_company.lower() in company_clean:
            return 5
    
    # Check top 10k
    for top_company in top_10k_companies:
        if company_clean in top_company.lower() or top_company.lower() in company_clean:
            return 3
    
    return 0


# ==================== 5. JOB DESCRIPTION ANALYSIS ====================
# The heart of the system - multiple independent sub-scores
# --- 5A. Red Flag Detection (Hard Penalties) ---
DESC_RED_FLAGS_EMPLOYMENT = [
    'permanent', 'contract role',
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

def score_skill_match(job_desc: str) -> float:
    # Flatten all CV skills into one list
    all_cv_skills = []
    for category in CV_SKILLS.values():
        all_cv_skills.extend(category)
    
    # Find matches
    matched_skills = []
    for skill in all_cv_skills:
        if skill in job_desc:
            matched_skills.append(skill)
    
    # Score based on match count
    match_count = len(matched_skills)
    
    for skill in COMPANY_DESC_INTERESTS:
        if skill in job_desc:
            match_count += 0.25
            
    if match_count == 0:
        return -2
    elif match_count <= 3:
        return match_count * 1
    elif match_count <= 6:
        return match_count * 1.5
    else:
        return min(match_count * 2, 15)  


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

def score_role_relevance(job_desc: str) -> float:
    score = 0
    
    # Positive phrases (what you're building)
    for keyword in ROLE_POSITIVE:
        if keyword in job_desc:
            score += 1
    
    # Negative phrases (lame work)
    for keyword in ROLE_NEGATIVE:
        if keyword in job_desc:
            score -= 3
    
    return score


# --- 5F. Learning & Mentorship & Benefits Indicators ---
CULTURE_POSITIVE_LEARNING = [
    'mentorship', 'mentor', 'training program', 'learning',
    'professional development', 'onboarding', 'career growth'
]

CULTURE_POSITIVE_EQUITY = [
    'equity', 'stock options', 'rsu', 'esop', 'profit sharing', 'stipends', 'relocation payments'
]


def score_culture(job_desc: str) -> float:
    score = 0
    
    # Learning & mentorship
    for keyword in CULTURE_POSITIVE_LEARNING:
        if keyword in job_desc:
            score += 2
    
    # Equity & benefits
    for keyword in CULTURE_POSITIVE_EQUITY:
        if keyword in job_desc:
            score += 2
    
    return min(score, 6)  # Cap at 6



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

def score_company_desc(company_desc: str) -> float:
    score = 0
    
    for keyword in COMPANY_DESC_INTERESTS:
        if keyword in company_desc:
            score += 1
    
    return min(score, 5)  # Cap at 5



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






#######


WEIGHTS = {
    'title': 1.3,
    'employment': 1.4,  
    'company': 0.5,
    'skill_match': 1.5,
    'role_relevance': 1.2,
    'red_flags': -2.0,  # Negative weight for penalties
    'salary': 1.0,
    'company_desc': 0.3,
    'location': 1.0,
    'culture': 0.5, 
    # 'hf_semantic': 0.4  # Capped, tie-breaker only
}

# Threshold A - Pre-CL filter
THRESHOLD_PRE_CL = 20.0  

# Threshold B - Post-CL priority
THRESHOLD_POST_CL = 55.0

def calculate_job_score(job_data: dict) -> dict:
    """
    Calculate comprehensive job score with breakdown.
    
    Args:
        job_data: Dict containing title, tags, company, job_desc, company_desc
        
    Returns:
        Dict with final_score and score_breakdown
    """
      
    # Extract data
    title = job_data.get('title', '').lower()
    tags = job_data.get('tags', [])
    company = job_data.get('company', '').lower()
    job_desc = job_data.get('job_desc', '').lower()
    company_desc = job_data.get('company_desc', '').lower()
    location = job_data.get('location', '').lower()
    
    scores = {
        'title_score': score_title(title),
        'employment_score': score_employment(title, tags, job_desc),
        'company_score': score_company(company),
        'skill_match_score': score_skill_match(job_desc),
        'role_relevance_score': score_role_relevance(job_desc),
        'red_flag_penalty': score_red_flags(job_desc),
        'salary_score': score_salary(tags, job_desc),
        'company_desc_score': score_company_desc(company_desc),
        'location_score': score_location(location),
        'culture_score': score_culture(job_desc),
        'hf_semantic_score': 0  # TODO: Implement HF model call
    }
    
    # Calculate weighted final score
    final_score = round(sum(scores[k] * WEIGHTS.get(k.replace('_score', '').replace('_penalty', ''), 1.0) 
                     for k in scores.keys()), 2)
    
    return {
        'final_score': final_score,
        'score_breakdown': scores,
    }

###