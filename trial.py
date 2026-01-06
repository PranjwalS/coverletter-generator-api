import httpx
from reportlab.lib.pagesizes import LETTER
from reportlab.pdfgen import canvas
from bs4 import BeautifulSoup

r = httpx.get('https://www.linkedin.com/jobs/view/4354624586/')

c = canvas.Canvas("job_data.pdf", LETTER)
width, height = LETTER
x = 50
y = height-50
max_chars = 90
font_size = 8
line_height = font_size+3
c.setFont("Helvetica", font_size)
soup = BeautifulSoup(r.text, 'html.parser')
soup = soup.find("div", class_="description__text description__text--rich")
soup = soup.get_text()

for line in soup.split('\n'):
    if line.strip()== "":
        continue
    
    for i in range(0, len(line), max_chars):
        c.setFont("Helvetica", font_size)
 
        if y < 50:
            c.showPage()   
            y = height-50
            
        c.drawString(x, y, line[i: i+max_chars])
        y -= line_height
        
c.save()

