from pydantic import BaseModel
import json
import os
import re

# ── Profile ───────────────────────────────────────────────────────────────────

PROFILE_PATH = os.path.join(os.path.dirname(__file__), "profile.json")
with open(PROFILE_PATH, "r") as f:
    USER_PROFILE = json.load(f)


# ── Models ────────────────────────────────────────────────────────────────────

class Field(BaseModel):
    selector: str
    tag: str
    type: str
    name: str = ""
    id: str = ""
    placeholder: str = ""
    label: str = ""
    context: str = ""

class AutofillRequest(BaseModel):
    fields: list[Field]

class AutofillResponse(BaseModel):
    fill_map: list[dict]


# ── Helpers ───────────────────────────────────────────────────────────────────

def get_nested(profile: dict, path: str) -> str:
    keys = path.split(".")
    val = profile
    for k in keys:
        if not isinstance(val, dict):
            return ""
        val = val.get(k, "")
    return str(val) if val else ""


def normalize(text: str) -> str:
    if not text:
        return ""
    text = text.lower()
    text = re.sub(r"[*:\-_/\\()\[\]{}|]", " ", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def build_context(f: Field) -> str:
    # label is most important — listed first so it anchors the string
    parts = [f.label, f.placeholder, f.name, f.id, f.context]
    return normalize(" ".join(p for p in parts if p))


def contains_any(ctx: str, keywords: list) -> bool:
    for kw in keywords:
        if normalize(kw) in ctx:
            return True
    return False


def excluded_by(ctx: str, exclusions: list) -> bool:
    return any(normalize(ex) in ctx for ex in exclusions)


def join_list(lst: list) -> str:
    return ", ".join(str(x) for x in lst if x)


# ── Field type guards ─────────────────────────────────────────────────────────

SKIP_TYPES = {"password", "hidden", "submit", "button", "reset", "image"}
# NOTE: "file" is NOT in SKIP_TYPES — we detect file upload fields and flag them

def should_skip_type(f: Field) -> bool:
    return f.type.lower() in SKIP_TYPES


# ══════════════════════════════════════════════════════════════════════════════
# RULES
# Each rule returns:
#   str   — matched value to fill
#   ""    — matched but profile value is empty (skip silently, stop checking)
#   None  — no match, continue to next rule
# ORDER IN RULES LIST MATTERS — specific before generic
# ══════════════════════════════════════════════════════════════════════════════


# ── Personal ──────────────────────────────────────────────────────────────────

def match_email_confirm(f, ctx, profile):
    if contains_any(ctx, ["confirm email", "retype email", "repeat email",
                           "verify email", "re-enter email", "reenter email",
                           "email confirm", "emailconf", "email confirmation",
                           "retype e-mail", "confirm e-mail"]):
        return get_nested(profile, "personal.email")
    return None


def match_email(f, ctx, profile):
    if contains_any(ctx, ["email address", "email", "e-mail",
                           "emailaddress", "e mail"]) \
            and not excluded_by(ctx, ["confirm", "retype", "repeat",
                                      "verify", "re-enter", "reenter"]):
        return get_nested(profile, "personal.email")
    return None


def match_first_name(f, ctx, profile):
    if contains_any(ctx, ["first name", "firstname", "fname",
                           "given name", "givenname", "forename", "f name"]) \
            and not excluded_by(ctx, ["last", "middle", "full", "sur", "family"]):
        return get_nested(profile, "personal.first_name")
    return None


def match_last_name(f, ctx, profile):
    if contains_any(ctx, ["last name", "lastname", "lname", "surname",
                           "family name", "familyname", "l name", "sur name"]) \
            and not excluded_by(ctx, ["first", "given", "fore", "middle"]):
        return get_nested(profile, "personal.last_name")
    return None


def match_middle_name(f, ctx, profile):
    # Profile has no middle name — match and return "" to stop rule chain
    if contains_any(ctx, ["middle name", "middlename", "middle initial", "mname"]):
        return ""
    return None


def match_full_name(f, ctx, profile):
    if contains_any(ctx, ["full name", "fullname", "your name", "applicant name",
                           "candidate name", "legal name", "complete name"]):
        return get_nested(profile, "personal.full_name")
    return None


def match_phone(f, ctx, profile):
    if contains_any(ctx, ["phone", "telephone", "mobile", "cell",
                           "contact number", "phone number", "phonenumber",
                           "tel", "cellphone", "cell phone", "mobile number"]) \
            and not excluded_by(ctx, ["fax", "extension", "ext", "alternative",
                                      "emergency", "home phone", "work phone"]):
        return get_nested(profile, "personal.phone")
    return None


def match_date_of_birth(f, ctx, profile):
    if contains_any(ctx, ["date of birth", "dob", "birth date", "birthdate",
                           "birthday", "born on", "date of birth"]):
        return get_nested(profile, "personal.date_of_birth")
    return None


def match_gender(f, ctx, profile):
    if contains_any(ctx, ["gender", "sex", "gender identity"]) \
            and not excluded_by(ctx, ["pronoun", "preferred name"]):
        return get_nested(profile, "personal.gender")
    return None


def match_pronouns(f, ctx, profile):
    if contains_any(ctx, ["pronoun", "preferred pronoun", "your pronoun",
                           "pronouns", "gender pronoun"]):
        return get_nested(profile, "personal.pronouns")
    return None


def match_ethnicity(f, ctx, profile):
    if contains_any(ctx, ["ethnicity", "ethnic", "race", "racial background",
                           "ethnic background", "ethnic origin",
                           "racial identity", "ethnic group"]):
        return get_nested(profile, "personal.ethnicity")
    return None


def match_languages_spoken(f, ctx, profile):
    if contains_any(ctx, ["languages spoken", "language spoken", "language skills",
                           "spoken languages", "languages you speak",
                           "language proficiency", "what languages"]) \
            and not excluded_by(ctx, ["programming", "coding", "software"]):
        langs = profile.get("personal", {}).get("languages_spoken", [])
        return join_list(langs)
    return None


# ── Location ──────────────────────────────────────────────────────────────────

def match_address_line2(f, ctx, profile):
    if contains_any(ctx, ["address line 2", "address2", "apt", "suite",
                           "unit", "apartment", "line 2", "address line two"]):
        return get_nested(profile, "location.address_line_2")
    return None


def match_address(f, ctx, profile):
    if contains_any(ctx, ["address line 1", "address1", "street address",
                           "mailing address", "home address",
                           "residential address", "street"]) \
            and not excluded_by(ctx, ["line 2", "line2", "apt", "suite",
                                      "city", "state", "country",
                                      "postal", "zip"]):
        return get_nested(profile, "location.address_line_1")
    return None


def match_city(f, ctx, profile):
    if contains_any(ctx, ["city", "town", "municipality",
                           "locality", "city of residence"]) \
            and not excluded_by(ctx, ["birth", "born"]):
        return get_nested(profile, "location.city")
    return None


def match_province(f, ctx, profile):
    if contains_any(ctx, ["province", "state", "territory",
                           "province state", "state province"]) \
            and not excluded_by(ctx, ["country", "nation", "birth", "born"]):
        return get_nested(profile, "location.province_state")
    return None


def match_postal_code(f, ctx, profile):
    if contains_any(ctx, ["postal", "zip", "postcode", "post code",
                           "zip code", "postal code", "postalcode", "zipcode"]):
        return get_nested(profile, "location.postal_code")
    return None


def match_country(f, ctx, profile):
    if contains_any(ctx, ["country", "country of residence",
                           "region of residence", "country region",
                           "nation", "country/region"]) \
            and not excluded_by(ctx, ["code", "dialing", "dial", "birth",
                                      "born", "citizen", "nationality", "passport"]):
        return get_nested(profile, "location.country")
    return None


# ── Identity / Authorization ──────────────────────────────────────────────────

def match_work_auth_canada(f, ctx, profile):
    if contains_any(ctx, ["authorized to work in canada",
                           "work authorization canada",
                           "legally authorized canada",
                           "eligible to work canada",
                           "work in canada", "right to work canada",
                           "legally work in canada"]):
        return get_nested(profile, "identity.work_authorization_canada")
    return None


def match_work_auth_us(f, ctx, profile):
    if contains_any(ctx, ["authorized to work in the us",
                           "authorized to work in us",
                           "work authorization us",
                           "work authorization united states",
                           "legally authorized united states",
                           "eligible to work us", "right to work us",
                           "authorized to work in america"]):
        return get_nested(profile, "identity.work_authorization_us")
    return None


def match_sponsorship(f, ctx, profile):
    if contains_any(ctx, ["sponsorship", "visa sponsorship",
                           "require sponsorship", "require work visa",
                           "need sponsorship", "work permit",
                           "immigration sponsorship",
                           "employment sponsorship"]) \
            and not excluded_by(ctx, ["willing to sponsor",
                                      "we will sponsor",
                                      "company will sponsor"]):
        return get_nested(profile, "identity.requires_sponsorship")
    return None


def match_citizenship(f, ctx, profile):
    if contains_any(ctx, ["citizenship", "citizenship status",
                           "nationality", "immigration status",
                           "residency status", "visa status",
                           "permanent resident", "citizen status"]) \
            and not excluded_by(ctx, ["country", "work auth", "sponsor"]):
        return get_nested(profile, "identity.citizenship")
    return None


def match_veteran(f, ctx, profile):
    if contains_any(ctx, ["veteran", "military", "armed forces",
                           "military status", "veteran status",
                           "served in military"]):
        return get_nested(profile, "identity.veteran_status")
    return None


def match_disability(f, ctx, profile):
    if contains_any(ctx, ["disability", "disabled", "disability status",
                           "person with disability", "differently abled",
                           "accommodation"]):
        return get_nested(profile, "identity.disability_status")
    return None


# ── Co-op / Student specific ──────────────────────────────────────────────────

def match_coop_term(f, ctx, profile):
    if contains_any(ctx, ["co-op term", "coop term", "work term",
                           "co op term", "internship term",
                           "which term", "term applying for",
                           "target term", "desired term"]):
        return get_nested(profile, "coop.coop_term")
    return None


def match_coop_seeking(f, ctx, profile):
    if contains_any(ctx, ["seeking co-op", "looking for coop",
                           "co-op student", "coop student",
                           "are you a co-op", "co-op program"]):
        return get_nested(profile, "coop.seeking_coop")
    return None


def match_student_id(f, ctx, profile):
    if contains_any(ctx, ["student id", "student number",
                           "student identifier", "student #"]):
        return get_nested(profile, "coop.student_id")
    return None


def match_currently_enrolled(f, ctx, profile):
    if contains_any(ctx, ["currently enrolled", "are you enrolled",
                           "current student", "active student",
                           "enrolled in school", "still in school"]):
        edu = profile.get("education", [{}])
        return edu[0].get("currently_enrolled", "") if edu else ""
    return None


# ── Professional ──────────────────────────────────────────────────────────────

def match_current_title(f, ctx, profile):
    if contains_any(ctx, ["current title", "job title", "current position",
                           "position title", "current role", "your title",
                           "professional title", "current job title"]) \
            and not excluded_by(ctx, ["desired", "preferred", "expected",
                                      "applying for", "target"]):
        return get_nested(profile, "professional.current_title")
    return None


def match_years_experience(f, ctx, profile):
    if contains_any(ctx, ["years of experience", "years experience",
                           "how many years", "total experience",
                           "years in field", "experience years",
                           "years worked", "work experience years"]):
        return get_nested(profile, "professional.years_of_experience")
    return None


def match_employment_type(f, ctx, profile):
    if contains_any(ctx, ["employment type", "job type",
                           "type of employment", "work type",
                           "position type", "employment preference"]) \
            and not excluded_by(ctx, ["industry", "field", "sector"]):
        return get_nested(profile, "professional.employment_type_preferred")
    return None


def match_work_arrangement(f, ctx, profile):
    # Only match text/select fields — not checkboxes/radios which need yes/no
    if f.type.lower() in ("checkbox", "radio"):
        return None
    if contains_any(ctx, ["work arrangement", "work location preference",
                           "office preference", "remote preference",
                           "hybrid preference", "preferred work style"]):
        return get_nested(profile, "professional.work_arrangement_preferred")
    return None


def match_salary(f, ctx, profile):
    if contains_any(ctx, ["salary", "compensation", "expected salary",
                           "desired salary", "salary expectation",
                           "pay expectation", "salary requirement",
                           "expected compensation", "remuneration"]):
        val = get_nested(profile, "professional.salary_expectation_cad")
        return val if val else get_nested(profile, "professional.salary_expectation_usd")
    return None


def match_notice_period(f, ctx, profile):
    if contains_any(ctx, ["notice period", "availability",
                           "available to start", "earliest start",
                           "when can you start", "joining date",
                           "available from", "start date"]) \
            and not excluded_by(ctx, ["salary", "pay", "compensation",
                                      "graduation", "university", "school"]):
        val = get_nested(profile, "professional.notice_period")
        return val if val else get_nested(profile, "preferences.available_start_date")
    return None


def match_willing_to_relocate(f, ctx, profile):
    if contains_any(ctx, ["willing to relocate", "open to relocation",
                           "relocation", "relocate", "willing to move",
                           "open to relocating"]):
        return get_nested(profile, "professional.willing_to_relocate")
    return None


def match_linkedin(f, ctx, profile):
    if contains_any(ctx, ["linkedin", "linked in", "linkedin url",
                           "linkedin profile", "linkedin.com"]):
        return get_nested(profile, "professional.linkedin")
    return None


def match_github(f, ctx, profile):
    if contains_any(ctx, ["github", "git hub", "github url",
                           "github profile", "github.com",
                           "code repository", "source code url"]):
        return get_nested(profile, "professional.github")
    return None


def match_portfolio(f, ctx, profile):
    if contains_any(ctx, ["portfolio", "personal website", "personal site",
                           "website url", "portfolio url", "your website",
                           "work samples", "online portfolio"]) \
            and not excluded_by(ctx, ["linkedin", "github", "twitter",
                                      "facebook", "instagram"]):
        val = get_nested(profile, "professional.portfolio")
        return val if val else get_nested(profile, "professional.website")
    return None


# ── Skills ────────────────────────────────────────────────────────────────────

def match_skills_all(f, ctx, profile):
    # Textarea asking for all skills as a list
    if f.type.lower() not in ("textarea", "text"):
        return None
    if contains_any(ctx, ["skills", "technical skills", "your skills",
                           "list your skills", "key skills",
                           "technologies", "tech stack",
                           "tools and technologies"]) \
            and not excluded_by(ctx, ["programming language", "framework",
                                      "cloud", "database", "years"]):
        return get_nested(profile, "skills.all_skills_string")
    return None


def match_programming_languages(f, ctx, profile):
    if contains_any(ctx, ["programming language", "coding language",
                           "language proficiency", "languages known",
                           "coding skills"]) \
            and not excluded_by(ctx, ["spoken", "natural", "human",
                                      "framework", "tool"]):
        langs = profile.get("skills", {}).get("languages", [])
        return join_list(langs)
    return None


def match_frameworks(f, ctx, profile):
    if contains_any(ctx, ["framework", "libraries", "frameworks and libraries",
                           "tech frameworks"]):
        frameworks = profile.get("skills", {}).get("frameworks", [])
        return join_list(frameworks)
    return None


# ── Education ─────────────────────────────────────────────────────────────────

def match_institution(f, ctx, profile):
    if contains_any(ctx, ["school", "university", "college", "institution",
                           "academy", "educational institution", "school name",
                           "university name", "college name", "alma mater"]) \
            and not excluded_by(ctx, ["high school", "secondary school"]):
        edu = profile.get("education", [{}])
        return edu[0].get("institution", "") if edu else ""
    return None


def match_degree(f, ctx, profile):
    if contains_any(ctx, ["degree", "highest degree", "highest education",
                           "education level", "highest qualification",
                           "qualification", "level of education",
                           "academic degree", "degree level",
                           "highest level of education"]) \
            and not excluded_by(ctx, ["field", "major", "subject",
                                      "institution", "school", "gpa", "grade"]):
        edu = profile.get("education", [{}])
        return edu[0].get("degree", "") if edu else ""
    return None


def match_field_of_study(f, ctx, profile):
    if contains_any(ctx, ["field of study", "major", "area of study",
                           "course of study", "discipline",
                           "concentration", "specialization",
                           "program of study"]) \
            and not excluded_by(ctx, ["degree", "level",
                                      "school", "institution"]):
        edu = profile.get("education", [{}])
        return edu[0].get("field_of_study", "") if edu else ""
    return None


def match_graduation_year(f, ctx, profile):
    if contains_any(ctx, ["graduation year", "year of graduation",
                           "graduation date", "year graduated",
                           "completion year", "expected graduation",
                           "grad year", "expected grad"]) \
            and not excluded_by(ctx, ["start", "began", "enrolled", "entry"]):
        edu = profile.get("education", [{}])
        return edu[0].get("graduation_year", "") if edu else ""
    return None


def match_expected_graduation(f, ctx, profile):
    # Returns full "Month Year" string for forms that want a formatted date
    if contains_any(ctx, ["expected graduation date", "anticipated graduation",
                           "expected completion date", "expected grad date"]):
        edu = profile.get("education", [{}])
        return edu[0].get("expected_graduation", "") if edu else ""
    return None


def match_education_start_year(f, ctx, profile):
    if contains_any(ctx, ["start year", "enrollment year", "year started",
                           "year of entry", "start of program",
                           "year enrolled", "entry year"]) \
            and not excluded_by(ctx, ["grad", "end", "finish", "complete"]):
        edu = profile.get("education", [{}])
        return edu[0].get("start_year", "") if edu else ""
    return None


def match_gpa(f, ctx, profile):
    if contains_any(ctx, ["gpa", "grade point", "grade average", "cgpa",
                           "cumulative gpa", "academic average",
                           "cumulative average"]) \
            and not excluded_by(ctx, ["minimum", "required", "expected"]):
        edu = profile.get("education", [{}])
        return edu[0].get("gpa", "") if edu else ""
    return None


# ── Experience descriptions ───────────────────────────────────────────────────

def match_work_experience_description(f, ctx, profile):
    # Textareas asking to describe work experience
    if f.type.lower() not in ("textarea",):
        return None
    if contains_any(ctx, ["describe your experience", "work experience",
                           "professional experience", "describe your background",
                           "summarize your experience", "relevant experience",
                           "tell us about your experience"]):
        exp = profile.get("experience", [])
        if not exp:
            return ""
        # Combine most recent two experiences
        combined = " | ".join(
            f"{e.get('title', '')} at {e.get('company', '')}: {e.get('description', '')}"
            for e in exp[:2]
        )
        return combined
    return None


def match_project_description(f, ctx, profile):
    if f.type.lower() not in ("textarea",):
        return None
    if contains_any(ctx, ["describe a project", "project you worked on",
                           "notable project", "key project",
                           "tell us about a project", "project experience",
                           "describe your project"]):
        projects = profile.get("projects", [])
        if not projects:
            return ""
        p = projects[0]
        return f"{p.get('name', '')}: {p.get('description', '')} Tech: {p.get('tech_stack', '')}"
    return None


# ── Document / file upload detection ─────────────────────────────────────────
# These return a YES/NO string — content.js can use this to flag the field
# rather than actually fill it (file uploads can't be filled programmatically)

def match_resume_upload(f, ctx, profile):
    if contains_any(ctx, ["resume", "cv", "curriculum vitae",
                           "upload resume", "attach resume",
                           "upload cv", "resume upload"]) \
            and not excluded_by(ctx, ["cover letter", "transcript"]):
        # For file inputs, return the filename as a hint to content.js
        if f.type.lower() == "file":
            return get_nested(profile, "documents.resume_filename")
        return get_nested(profile, "documents.resume_available")
    return None


def match_cover_letter_upload(f, ctx, profile):
    if contains_any(ctx, ["cover letter", "covering letter",
                           "upload cover letter", "attach cover letter",
                           "cover letter upload"]) \
            and not excluded_by(ctx, ["resume", "transcript"]):
        if f.type.lower() == "file":
            return get_nested(profile, "documents.cover_letter_filename")
        return get_nested(profile, "documents.cover_letter_available")
    return None


def match_transcript_upload(f, ctx, profile):
    if contains_any(ctx, ["transcript", "academic transcript",
                           "upload transcript", "attach transcript",
                           "official transcript", "unofficial transcript"]):
        if f.type.lower() == "file":
            return get_nested(profile, "documents.transcript_filename")
        return get_nested(profile, "documents.transcript_available")
    return None


# ── Application essays ────────────────────────────────────────────────────────

def match_cover_letter_text(f, ctx, profile):
    if contains_any(ctx, ["cover letter", "covering letter",
                           "letter of interest", "motivation letter",
                           "letter of motivation", "cover note"]) \
            and f.type.lower() in ("textarea",):
        return get_nested(profile, "application_essays.cover_letter_opening")
    return None


def match_why_company(f, ctx, profile):
    if contains_any(ctx, ["why do you want to work", "why this company",
                           "why us", "why are you interested",
                           "why do you want to join", "why apply",
                           "why our company", "what interests you about",
                           "why would you like"]):
        return get_nested(profile, "application_essays.why_this_company")
    return None


def match_about_yourself(f, ctx, profile):
    if contains_any(ctx, ["tell us about yourself", "about yourself",
                           "tell me about yourself", "introduce yourself",
                           "brief introduction", "describe yourself",
                           "personal statement", "about you",
                           "background summary"]):
        return get_nested(profile, "application_essays.tell_me_about_yourself")
    return None


def match_strength(f, ctx, profile):
    if contains_any(ctx, ["greatest strength", "key strength", "your strengths",
                           "what is your strength", "core strength",
                           "describe your strength", "top strength"]):
        return get_nested(profile, "application_essays.greatest_strength")
    return None


def match_weakness(f, ctx, profile):
    if contains_any(ctx, ["greatest weakness", "your weakness",
                           "area for improvement", "what is your weakness",
                           "areas of growth", "describe your weakness",
                           "development area"]) \
            and not excluded_by(ctx, ["strength"]):
        return get_nested(profile, "application_essays.greatest_weakness")
    return None


def match_career_goals(f, ctx, profile):
    if contains_any(ctx, ["career goals", "career objective",
                           "career aspirations", "where do you see yourself",
                           "5 year plan", "five year plan",
                           "long term goals", "professional goals",
                           "career ambitions", "future goals"]):
        return get_nested(profile, "application_essays.career_goals")
    return None


def match_how_did_you_hear(f, ctx, profile):
    if contains_any(ctx, ["how did you hear", "how did you find",
                           "how did you learn", "source of application",
                           "referral source", "where did you hear",
                           "how did you discover", "application source",
                           "how did you find out"]):
        return get_nested(profile, "application_essays.how_did_you_hear")
    return None


def match_additional_info(f, ctx, profile):
    if contains_any(ctx, ["additional information", "anything else",
                           "other information", "additional comments",
                           "further information", "other comments",
                           "additional details", "extra information",
                           "is there anything else"]):
        return get_nested(profile, "application_essays.additional_info")
    return None


# ── Preferences ───────────────────────────────────────────────────────────────

def match_contact_preference(f, ctx, profile):
    if contains_any(ctx, ["contact preference", "preferred contact",
                           "how to contact", "contact method",
                           "preferred method of contact"]):
        return get_nested(profile, "preferences.contact_preference")
    return None


def match_contract(f, ctx, profile):
    if contains_any(ctx, ["contract work", "open to contract",
                           "contract position", "interested in contract",
                           "contract role"]):
        return get_nested(profile, "preferences.contract_available")
    return None


# ── Last resort ───────────────────────────────────────────────────────────────

def match_bare_name(f, ctx, profile):
    if not contains_any(ctx, ["name"]):
        return None
    # Bail if any of these are present — caught by more specific rules above
    if contains_any(ctx, ["first", "last", "middle", "full", "user",
                           "company", "school", "employer", "manager",
                           "reference", "file", "domain", "field",
                           "username", "project", "institution"]):
        return None
    return get_nested(profile, "personal.full_name")


# ══════════════════════════════════════════════════════════════════════════════
# MASTER RULE LIST — ORDER MATTERS, specific before generic
# ══════════════════════════════════════════════════════════════════════════════

RULES = [
    # Email — confirm before plain to avoid wrong match
    match_email_confirm,
    match_email,

    # Name — specific before generic
    match_first_name,
    match_last_name,
    match_middle_name,
    match_full_name,

    # Personal
    match_phone,
    match_date_of_birth,
    match_gender,
    match_pronouns,
    match_ethnicity,
    match_languages_spoken,

    # Location — line2 before line1 to avoid partial match
    match_address_line2,
    match_address,
    match_city,
    match_province,
    match_postal_code,
    match_country,

    # Identity
    match_work_auth_canada,
    match_work_auth_us,
    match_sponsorship,
    match_citizenship,
    match_veteran,
    match_disability,

    # Co-op / student
    match_coop_term,
    match_coop_seeking,
    match_student_id,
    match_currently_enrolled,

    # Professional
    match_current_title,
    match_years_experience,
    match_employment_type,
    match_work_arrangement,
    match_salary,
    match_notice_period,
    match_willing_to_relocate,
    match_linkedin,
    match_github,
    match_portfolio,

    # Skills
    match_programming_languages,
    match_frameworks,
    match_skills_all,

    # Education — expected_graduation before graduation_year (more specific)
    match_institution,
    match_degree,
    match_field_of_study,
    match_expected_graduation,
    match_graduation_year,
    match_education_start_year,
    match_gpa,

    # Experience / projects
    match_work_experience_description,
    match_project_description,

    # Document uploads — file type detection
    match_resume_upload,
    match_cover_letter_upload,
    match_transcript_upload,

    # Essays — cover_letter_text before why_company etc (more specific ctx)
    match_cover_letter_text,
    match_why_company,
    match_about_yourself,
    match_strength,
    match_weakness,
    match_career_goals,
    match_how_did_you_hear,
    match_additional_info,

    # Preferences
    match_contact_preference,
    match_contract,

    # Absolute last resort
    match_bare_name,
]


# ══════════════════════════════════════════════════════════════════════════════
# CORE ENGINE
# ══════════════════════════════════════════════════════════════════════════════

def rule_based_fill(fields: list[Field], profile: dict) -> list[dict]:
    fill_map = []
    seen_selectors = set()

    for f in fields:
        if should_skip_type(f):
            print(f"[autofill] SKIP (type={f.type}): {f.selector}")
            continue

        if f.selector in seen_selectors:
            print(f"[autofill] SKIP (duplicate): {f.selector}")
            continue

        ctx = build_context(f)
        if not ctx:
            print(f"[autofill] SKIP (no context): {f.selector}")
            continue

        matched = False
        for rule in RULES:
            value = rule(f, ctx, profile)
            if value is None:
                continue
            if value == "":
                print(f"[autofill] SKIP (empty profile val) [{rule.__name__}]: {f.selector}")
                matched = True
                break
            print(f"[autofill] MATCH [{rule.__name__}]: {f.selector} -> {repr(value[:80])}")
            fill_map.append({"selector": f.selector, "value": value})
            seen_selectors.add(f.selector)
            matched = True
            break

        if not matched:
            print(f"[autofill] NO MATCH: {f.selector} | ctx: {ctx[:80]}")

    return fill_map


# ── Compatibility stubs ───────────────────────────────────────────────────────

def build_prompt(fields: list[Field], profile: dict) -> str:
    return ""

def call_hf(client, prompt: str) -> str:
    return ""

def parse_llm_output(raw: str, valid_selectors: set) -> list[dict]:
    return []