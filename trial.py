import httpx
from reportlab.lib.pagesizes import LETTER
from reportlab.pdfgen import canvas

r = httpx.get('https://www.linkedin.com/jobs/view/4354624586/')

c = canvas.Canvas("job_data.pdf", LETTER)
width, height = LETTER
x = 50
y = height-50
max_chars = 90
font_size = 8
line_height = font_size+3
c.setFont("Helvetica", font_size)
for line in r.text.split('\n'):
    if line.strip()== "":
        continue
    
    for i in range(0, len(line), max_chars): 
        if y < 50:
            c.showPage()   
            y = height-50
            c.setFont("Helvetica", font_size)
            
        c.drawString(x, y, line[i: i+max_chars])
        y -= line_height
        
c.save()
