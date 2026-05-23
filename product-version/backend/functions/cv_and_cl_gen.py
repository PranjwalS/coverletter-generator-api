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
    
