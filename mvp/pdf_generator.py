from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import LETTER
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase import pdfmetrics
from reportlab.lib.units import inch
import os

closing = """Thank you for your time and consideration. I would greatly appreciate the opportunity to further discuss how my interests and experiences align with this role and how I could contribute to your team. I can be reached at 438-773-4010 or singhpranjwal@gmail.com, and I look forward to hearing from you."""
cv_summary_1 = """
Currently pursuing a Bachelor of Computer Science at the University of Waterloo with a specialization in Digital Hardware and a 3.9 GPA, 
I am passionate about exploring opportunities in machine learning, data engineering, full-stack development, and cloud/back-end systems, 
and am eager to rapidly learn and apply new technologies. As an Applications Development Intern at CJCR, Department of National Defence, 
I contributed to Power Apps solutions integrating diverse data sources for dashboards, tracking systems, and asset management, 
while developing features for a Vue.js web application and a .NET backend serving over 10,000 staff members. 
At Ericsson, I served as a Software Testing Intern, monitoring Jenkins pipelines, troubleshooting Kubernetes clusters, and reporting insights through Grafana dashboards.
"""
cv_summary_2 = """
My POS Ecosystem project demonstrates full-stack expertise, combining a React web dashboard and React Native mobile app for 
real-time merchant management, inventory, and checkout, with FastAPI, PostgreSQL, Redis, and Celery, deployed via Azure App Service, Supabase, and DevOps pipelines. 
Additionally, I built an Android system that overlays restrictions on apps and websites selected by the user, automatically enforcing schedules and limits to enhance focus and productivity.
"""
def make_pdf(ai_text, filename="coverletter.pdf"):
    font_path = os.path.join(os.path.dirname(__file__), 'fonts', 'cmunrm.ttf')
    
    if not os.path.exists(font_path):
        print(f"ERROR: Font file not found at {font_path}")
        return
    
    pdfmetrics.registerFont(TTFont('CMR', font_path))
    
    c = canvas.Canvas(filename, pagesize=LETTER)
    width, height = LETTER
    
    c.setFont('CMR', 10)
    
    left_margin = right_margin = 1 * inch
    top_margin = height - 1 * inch
    bottom_margin = 1 * inch
    line_height = 14
    max_width = width - left_margin - right_margin
    
    y = top_margin
    
    # === DRAW HEADER ===
    header_text = "Pranjwal Singh | Computer Science Student, University of Waterloo | 438-773-4010 | singhpranjwal@gmail.com"
    c.setFont('CMR', 11)
    c.drawCentredString(width / 2, y, header_text)
    y -= line_height * 2  # add space after header
    c.setFont('CMR', 10)
    
    # Function to draw justified paragraph
    def draw_justified_paragraph(text, x, y, max_width):
        words = text.split()
        lines = []
        line = []
        
        # Build lines
        for word in words:
            test_line = ' '.join(line + [word])
            if pdfmetrics.stringWidth(test_line, 'CMR', 10) > max_width:
                if line:
                    lines.append(line)
                line = [word]
            else:
                line.append(word)
        if line:
            lines.append(line)
        
        # Draw justified lines (except last line)
        for i, line_words in enumerate(lines):
            if i == len(lines) - 1:  # Last line - left aligned
                c.drawString(x, y, ' '.join(line_words))
            else:  # Justify by adding space between words
                if len(line_words) == 1:
                    c.drawString(x, y, line_words[0])
                else:
                    text_width = sum(pdfmetrics.stringWidth(w, 'CMR', 10) for w in line_words)
                    total_space = max_width - text_width
                    space_width = total_space / (len(line_words) - 1)
                    
                    x_pos = x
                    for word in line_words[:-1]:
                        c.drawString(x_pos, y, word)
                        x_pos += pdfmetrics.stringWidth(word, 'CMR', 10) + space_width
                    c.drawString(x_pos, y, line_words[-1])
            
            y -= line_height
        
        return y
    
 
    paragraphs = [p.strip() for p in ai_text.split('\n\n') if p.strip()]
    

    y = draw_justified_paragraph("Dear Recruiter,", left_margin, y, max_width)
    

    for para in paragraphs:
        y = draw_justified_paragraph(para, left_margin, y, max_width)
        y -= line_height 
    
   
    y = draw_justified_paragraph(cv_summary_1, left_margin, y, max_width)
    y -= 10
    y = draw_justified_paragraph(cv_summary_2, left_margin, y, max_width)
    y -= line_height
    y = draw_justified_paragraph(closing, left_margin, y, max_width)
    
    c.showPage()
    c.save()
    print(f"PDF saved as {filename}")