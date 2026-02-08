from json import load
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import os
from pydantic import BaseModel


load_dotenv()
FRONTEND_ORIGIN=os.getenv("FRONTEND_ORIGIN")

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_ORIGIN],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root():
    return {"status": "ok"}


@app.get("/hello")
def hello(name: str = "world"):
    return {"message": f"hello {name}"}



class UserIn(BaseModel):
    name: str

@app.post("/users")
def create_user(user: UserIn):
    return {"hello": user.name}