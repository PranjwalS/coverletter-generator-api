import json
from groq import Groq
from docling.document_converter import DocumentConverter
import os

groq_client = Groq(api_key=os.getenv("GROQ_API_KEY"))


def cv_parser(cv_information):
    prompt = f"""
You are an expert resume parsing system.

Your output will be parsed automatically by a JSON parser.
Invalid JSON will cause system failure.
Your task is to extract structured information from the provided CV markdown and convert it into a STRICT JSON object.

You must follow ALL rules exactly.

---

## CRITICAL RULES

1. ONLY use information explicitly present in the CV.
   - Do NOT infer missing facts.
   - Do NOT guess.
   - Do NOT hallucinate.

2. If a field is not present, return an empty list [] or null (never fabricate).

3. CVs may use different wording for the same concept:
   - "Work Experience", "Experience", "Employment", "Professional Background" → EXPERIENCE
   - "Education", "Academic Background", "Studies" → EDUCATION
   - "Skills", "Technologies", "Toolset" → SKILLS
   - "Projects", "Personal Projects", "Side Work" → PROJECTS
   You MUST correctly map synonyms into the correct JSON field.

4. Maintain accuracy of:
   - dates (do not mix between sections)
   - job titles
   - institutions
   - company names
   - project descriptions

5. Do NOT merge separate experiences/projects incorrectly.

6. If something is ambiguous, prefer leaving it out rather than guessing.

7. Keep all extracted text faithful to the original wording (light cleanup allowed, no rewriting meaning).

---

## OUTPUT FORMAT (STRICT JSON ONLY)

Return ONLY valid JSON. No markdown. No explanation.

Use this structure:

{{
  "name": "",
  "contact": {{
    "phone": "",
    "email": "",
    "location": "",
    "links": []
  }},
  "summary": "",
  "education": [
    {{
      "institution": "",
      "degree": "",
      "field": "",
      "gpa": "",
      "start_date": "",
      "end_date": "",
      "details": []
    }}
  ],
  "experience": [
    {{
      "company": "",
      "role": "",
      "location": "",
      "start_date": "",
      "end_date": "",
      "responsibilities": []
    }}
  ],
  "skills": {{
    "skills": "",
  }},
  "projects": [
    {{
      "name": "",
      "description": [],
      "tech_stack": [],
      "start_date": "",
      "end_date": "",
      "links": []
    }}
  ],
  "certifications_awards": [],
  "additional_sections": {{}}
}}

---

## EXTRA RULES FOR ROBUSTNESS

- If a CV section is missing, return empty arrays [] or empty strings "".
- Preserve multiple roles separately (do NOT merge jobs).
- Preserve bullet points as arrays.
- Keep project descriptions as bullet lists if present.
- Do not assume ordering implies grouping unless clearly structured.

---

## INPUT CV (MARKDOWN)

{cv_information}

---

Now parse the CV carefully and return ONLY the JSON output.
"""
    
    resp = groq_client.chat.completions.create(
        messages=[
            {"role": "system", "content": "You are a highly precise resume parsing engine that outputs strict valid JSON only."},
            {"role": "user", "content": prompt},
        ],
        model="openai/gpt-oss-120b",
        temperature=0
    )

    output = resp.choices[0].message.content
    parsed = json.loads(output)
    return parsed
    



def job_parser(job_description: str) -> dict:
    prompt = f"""
You are an expert job posting parser.

Your output will be parsed automatically by a JSON parser.
Invalid JSON will cause system failure.

Extract structured information from the job posting below into strict JSON.

## RULES
1. ONLY extract information explicitly present in the posting.
2. Do NOT infer, guess, or hallucinate anything.
3. If a field is missing, return empty string "" or empty array [].
4. Skills and requirements should be extracted as clean individual items, not full sentences.
5. Fields means the job domain/category (e.g. "software engineering", "nursing", "legal", "accounting") — infer only from explicit context.

## OUTPUT FORMAT (STRICT JSON ONLY)
Return ONLY valid JSON. No markdown. No explanation.

{{
  "title": "",
  "company": "",
  "location": "",
  "description": "",
  "requirements": [],
  "skills": [],
  "salary": "",
  "duration": "",
  "fields": []
}}

## JOB POSTING
{job_description}

Now parse and return ONLY the JSON.
"""
    resp = groq_client.chat.completions.create(
        messages=[
            {{"role": "system", "content": "You are a precise job posting parser that outputs strict valid JSON only."}},
            {{"role": "user", "content": prompt}},
        ],
        model="openai/gpt-oss-120b",
        temperature=0
    )
    output = resp.choices[0].message.content
    parsed = json.loads(output)
    return parsed
  
  
  
  
def cover_letter_generator(job: dict, user_profile: dict) -> str:
    prompt = f"""
You are helping a real person write a cover letter for a job they genuinely want.

Your goal is to write something that sounds like a confident, self-aware human wrote it — not a template, not a robot.
Do NOT use filler phrases like "I am excited to apply", "I am passionate about", "I would be a great fit".
Do NOT mention skills or experiences not present in the profile.
Do NOT fabricate anything.

Write in first person. Keep it to 3 paragraphs. Be direct and specific.

## WHO THEY ARE
Name: {user_profile.get("display_name", "")}
Skills: {user_profile.get("skills", "")}
Experience: {json.dumps(user_profile.get("experiences", []))}
Education: {json.dumps(user_profile.get("education", []))}
Projects: {json.dumps(user_profile.get("projects", []))}

## THE JOB
Title: {job.get("title", "")}
Company: {job.get("company", "")}
Location: {job.get("location", "")}
What they want: {json.dumps(job.get("requirements", []))}
Skills they need: {json.dumps(job.get("skills", []))}
Description: {job.get("description", "")}

## INSTRUCTIONS
- Paragraph 1: Open with why this specific role at this specific company makes sense for where they are in their career. Be concrete, not generic.
- Paragraph 2: Pull the most relevant 1-2 experiences or projects from their profile that directly speak to what the job needs. Be specific about what they did and the impact.
- Paragraph 3: Short, confident close. Express genuine interest, invite next steps. No begging, no over-enthusiasm.

Return ONLY the cover letter text. No subject line. No "Dear Hiring Manager" header. No sign-off. Just the three paragraphs.
"""
    resp = groq_client.chat.completions.create(
        messages=[
            {"role": "system", "content": "You write cover letters that sound like real humans wrote them — specific, confident, and grounded in the person's actual background."},
            {"role": "user", "content": prompt},
        ],
        model="openai/gpt-oss-120b",
        temperature=0.5
    )
    return resp.choices[0].message.content