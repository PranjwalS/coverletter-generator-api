cv_text = """
Pranjwal Singh. Contact information: phone 438-773-4010, email singhpranjwal@gmail.com, with LinkedIn, GitHub, and Portfolio profiles available.

Education: University of Waterloo, located in Waterloo, Ontario. Enrolled in Bachelor of Computer Science Honours program from September 2025 to April 2030. Specializing in Digital Hardware with a GPA of 3.9.

Work Experience at CJCR, Department of National Defence. Position: Applications Development Intern at Rheinmetall in St-Jean, Quebec, working on the IT Applications Development Team from June 2025 to August 2025. Responsibilities included creating Power Apps solutions for dashboards, tracking systems, and asset management using Dataverse, SQL, and Power Fx. Developed features for a Vue.js web application serving over 10,000 staff members, including new pages and UI components. Worked on a .NET backend implementing SignalR Hubs and RESTful APIs. Used Microsoft Azure DevOps for version control and task management in an Agile team of 55 plus members.

Work Experience at Ericsson. Position: Digital Transformation and Software Testing Intern in Ottawa, Ontario from June 2024 to August 2024. Responsibilities included monitoring Jenkins software pipelines and troubleshooting Kubernetes clusters by checking pod status and reviewing logs. Created Grafana dashboards for tracking performance metrics and identifying bottlenecks in telecom infrastructure.

Technical Skills: Programming languages include Python, JavaScript, TypeScript, C#, Kotlin, C, SQL, Bash, and Racket. Frameworks include React, React Native, Vue.js, Node.js, Jetpack Compose, FastAPI, Flask, .NET, and Celery. Platforms and tools include Linux, GitHub, Docker, Kubernetes, Jenkins, Git, Supabase, PostgreSQL, Vercel, Render, Microsoft Azure DevOps, Power Platform, Unity, and Azure App Service.

Projects: POS Ecosystem Web and Mobile, active from 2025 to present. Developed a React web dashboard for merchant management including onboarding, inventory, products, and orders. Backend uses FastAPI and PostgreSQL hosted on Azure App Service with Supabase for database management. Created a React Native mobile point of sale app for real-time checkout and product scanning using Redis for inventory optimization. Implemented Python machine learning models and web scraping for sales and pricing recommendations using Celery workers and Redis for processing. Technology stack includes React, React Native, FastAPI, PostgreSQL, Supabase, Azure App Service, Redis, Celery, REST APIs, GitHub, and Azure DevOps.

Projects: App and Website Restriction Android App called mute, active from 2025 to present. Built an Android application for creating custom restriction profiles to block apps, websites, and URL keywords. Features include timers, daily schedules, location triggers, and usage limits. Includes notification management that suppresses non-essential alerts while keeping priority notifications. Backend uses FastAPI on Azure App Service for account backups, restriction templates, usage statistics, and safe access recovery. Technology stack includes Kotlin, Jetpack Compose, FastAPI, Python, PostgreSQL, Azure App Service, REST APIs, and Android System Services.
"""
#### HAVE TO REDESIGN THE PROMPT IN HERE SINCE I NEED TO KEEP A CONSTANT SUMMARY FROM THE CV TO SAVE TOKENS BUT ONLY ADJUST SECOND PART ACCORDINLY
####### ALSO SEE WHETHER WE CAN LITERALLY BE CREATING A NEW CV DEPENDING ON THE COMPANY EVERY TIME OVER AND OVER MATE, ADJUSTING SECTIONS TO NEEDS (IN LATEX CODE THO SO SET THAT UP)
def makePrompt(text):
    prompt_data = f"""
    You are a professional technical recruiter and resume writer.

    TASK:
    Generate a concise, tailored cover letter using the template below. Keep it very humble and promising as I'm a new university student
    Highlight I'm studying Computer Science at University of Waterloo
    Do NOT exceed 300 words.
    Do NOT invent experience.
    Use professional but natural language.

    ======== COVER LETTER TEMPLATE ========
    Opening:
    - 1–2 sentences showing interest in the role and company.

    Body Paragraph 1:
    - Match candidate skills to job requirements. Talk shortly about the CJCR and Ericsson positions as corporate experience and then extend about the POS System Project from my cv text as follows.
    - Specifically, I need the first sentence about Waterloo CS (line 2 in cv), the next about CJCR (line 3 in cv), then one sentence about Ericsson (line 4 in cv), and 2 sentences on POS Ecosystem (line 6 in cv) 
    
    Body Paragraph 2:
    - Highlight relevant projects or experience. (line 5 in cv)

    Closing:
    - Express interest in interview and appreciation.

    ======== CANDIDATE CV ========
    {cv_text}

    ======== JOB POSTING ========
    {text}

    ======== OUTPUT RULES ========
    - Min 300 words
    - Max 350 words
    - No bullet points
    - No placeholders
    - No emojis
    - No markdown
    - No "Here's your...", just put the coverletter text straight
    """
    
    return prompt_data