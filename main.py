from fastapi import FastAPI

app = FastAPI()

# Azure DevOps connection check
@app.get("/")
def root():
    return {"status": "ok", "message": "checking status closed"}
