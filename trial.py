import httpx
from reportlab.lib.pagesizes import LETTER
from reportlab.pdfgen import canvas
from bs4 import BeautifulSoup
# from selenium import webdriver
import requests
from dotenv import load_dotenv
import os
from prompt import makePrompt
from openai import OpenAI


r = httpx.get('https://www.linkedin.com/jobs/view/4283101921')


def makeSoup(html):    
    soup = BeautifulSoup(html, 'html.parser')
    description = soup.find("div", class_="description__text description__text--rich").text
    description = description.replace("Show more", "").replace("Show less", "")
    titl = soup.find("title").text
    soup = (f"{titl} \n {description}")
    return soup



# #### Selenium attemp at scraping

# driver = webdriver.Chrome()
# driver.get("https://www.linkedin.com/jobs/view/4354624586/")
# html = driver.page_source
# driver.quit()
# print(makeSoup(html))




### Pdf maker
def makePdf(titl, description):
    c = canvas.Canvas("coverletter.pdf", LETTER)
    width, height = LETTER
    x = 50
    y = height-50
    max_chars = 120
    font_size = 8
    line_height = font_size+3
    c.setFont("Helvetica", font_size)
    c.drawString(x,y,titl)
    y-=line_height+10
    for line in description.split("\n"):
        if line.strip()== "":
            continue
        
        for i in range(0, len(line), max_chars):
            c.setFont("Helvetica", font_size)
    
            if y < 50:
                c.showPage()   
                y = height-50
                
            c.drawString(x, y, line[i: i+max_chars])
            y -= line_height
    c.drawString(x,y-line_height, "Sincerely,")
    c.drawString(x,y-(line_height*2), "Pranjwal Singh")
    c.save()

# makePdf("", r.text)