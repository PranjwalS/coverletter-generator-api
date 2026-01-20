cv_text = """
Pranjwal Singh. Contact information: phone 438-773-4010, email singhpranjwal@gmail.com, with LinkedIn, GitHub, and Portfolio profiles available.

Education: University of Waterloo, located in Waterloo, Ontario. Enrolled in Bachelor of Computer Science Honours program from September 2025 to April 2030. Specializing in Digital Hardware with a GPA of 3.9.

Work Experience at CJCR, Department of National Defence. Position: Applications Development Intern at Rheinmetall in St-Jean, Quebec, working on the IT Applications Development Team from June 2025 to August 2025. Responsibilities included creating Power Apps solutions for dashboards, tracking systems, and asset management using Dataverse, SQL, and Power Fx. Developed features for a Vue.js web application serving over 10,000 staff members, including new pages and UI components. Worked on a .NET backend implementing SignalR Hubs and RESTful APIs. Used Microsoft Azure DevOps for version control and task management in an Agile team of 55 plus members.

Work Experience at Ericsson. Position: Digital Transformation and Software Testing Intern in Ottawa, Ontario from June 2024 to August 2024. Responsibilities included monitoring Jenkins software pipelines and troubleshooting Kubernetes clusters by checking pod status and reviewing logs. Created Grafana dashboards for tracking performance metrics and identifying bottlenecks in telecom infrastructure.

Technical Skills: Programming languages include Python, JavaScript, TypeScript, C#, Kotlin, C, SQL, Bash, and Racket. Frameworks include React, React Native, Vue.js, Node.js, Jetpack Compose, FastAPI, Flask, .NET, and Celery. Platforms and tools include Linux, GitHub, Docker, Kubernetes, Jenkins, Git, Supabase, PostgreSQL, Vercel, Render, Microsoft Azure DevOps, Power Platform, Unity, and Azure App Service.

Projects: POS Ecosystem Web and Mobile, active from 2025 to present. Developed a React web dashboard for merchant management including onboarding, inventory, products, and orders. Backend uses FastAPI and PostgreSQL hosted on Azure App Service with Supabase for database management. Created a React Native mobile point of sale app for real-time checkout and product scanning using Redis for inventory optimization. Implemented Python machine learning models and web scraping for sales and pricing recommendations using Celery workers and Redis for processing. Technology stack includes React, React Native, FastAPI, PostgreSQL, Supabase, Azure App Service, Redis, Celery, REST APIs, GitHub, and Azure DevOps.

Projects: App and Website Restriction Android App called mute, active from 2025 to present. Built an Android application for creating custom restriction profiles to block apps, websites, and URL keywords. Features include timers, daily schedules, location triggers, and usage limits. Includes notification management that suppresses non-essential alerts while keeping priority notifications. Backend uses FastAPI on Azure App Service for account backups, restriction templates, usage statistics, and safe access recovery. Technology stack includes Kotlin, Jetpack Compose, FastAPI, Python, PostgreSQL, Azure App Service, REST APIs, and Android System Services.
"""




cv_skillset = """Technical Skills: Programming languages include Python, JavaScript, Kotlin, C, SQL, Bash, and Racket. 
Frameworks include React, React Native, Vue.js, Jetpack Compose, FastAPI, Flask, .NET, and Celery. 
Platforms and tools include Linux, GitHub, Docker, Jenkins, Supabase, PostgreSQL, Vercel, Render, Azure Suite, Microsoft Azure DevOps, Power Platform, and Azure App Service."""

def makePrompt(job_text):
    prompt_data = f"""
    You are a professional technical recruiter and resume writer.

    TASK:
    Generate the first two paragraphs of a concise, tailored cover letter based on the job posting below. Focus on making it professional, humble, and enthusiastic. Do NOT invent any experience. 
    IMPORTANT: Do not add greetings, introductions like "Here’s your cover letter", placeholders, or any commentary. Do NOT include anything that makes the text look AI-generated. Start immediately with the first sentence of paragraph 1 and end at the last sentence of paragraph 2. Only these two paragraphs.

    Paragraph 1 (Intro):
    - Show genuine interest in the role and the company.
    - Make it 2–3 sentences.
    - Mention why the position excites you and aligns with your academic and career focus.

    Paragraph 2 (Interest & Skill Alignment):
    - Highlight 1–2 responsibilities, technologies, or tools from the job posting in very short phrases (half a sentence max).
    - Identify 1–3 concrete responsibilities, tools, or technologies **explicitly mentioned in the job description**
    - Write 3–4 concise sentences explaining your interest in these specific responsibilities or technologies. 
    - Focus on curiosity, enthusiasm, and willingness to learn. Show that you understand the role and the technologies it uses. 
    - Keep sentences short, clear, and professional; do not insert filler or vague generalities. MAKE IT VERY TIGHT AND STRONG, AND PUNCHY.
    - Make the paragraph 3–4 sentences.
    - Avoid vague phrases, soft HR-style content, or generic statements about company culture.
    - Focus on connecting your skills to the company’s requirements while emphasizing curiosity and willingness to grow.

    JOB POSTING TEXT:
    {job_text}

    OUTPUT RULES:
    - The text must read like it was written by a human for this job. It should be indistinguishable from a human-written cover letter.
    - Absolutely no greetings, placeholders, salutations, or any extra commentary. Do NOT write “Dear”, “Hello”, “Here’s your cover letter”, or anything else — the text must start directly with the first sentence of the intro paragraph, and ONLY include paragraph 1 and paragraph 2, and nothing after that please.
    - Provide only plain text, no markdown, no bullet points, no placeholders. Make it plain text, just straight into the cover letter.
    - Keep paragraphs clear, professional, and natural.
    - Do NOT exceed 200 words, but minimum 150 words for the first two paragraphs combined.
    - Do NOT include the CV summary or closing; these will be added later by me.
    """
    return prompt_data
