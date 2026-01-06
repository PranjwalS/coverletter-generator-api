from fastapi import FastAPI, Form, Request
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates

app = FastAPI()
templates = Jinja2Templates(directory="pages")

@app.get("/", response_class=HTMLResponse)
def read_form(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})

@app.post("/submit-url")
def submit_url(url: str = Form(...)):
    print("Received URL:", url)  
    return {"status": "success", "url": url}

