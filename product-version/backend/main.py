from fastapi import FastAPI, Depends, Header, HTTPException, status, Form, Request
from fastapi.security import OAuth2PasswordBearer
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, FileResponse, StreamingResponse
from dotenv import load_dotenv
from datetime import datetime
import os
from pydantic import BaseModel
from groq import Groq
from io import BytesIO
from supabase import create_client
from auth import hash_password, verify_password, create_access_token, decode_access_token

load_dotenv()
FRONTEND_ORIGIN=os.getenv("FRONTEND_ORIGIN")

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_ORIGIN, "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

groq_client = Groq(api_key=os.getenv("GROQ_API_KEY"))

#### Classes

class UserCreate(BaseModel):
    full_name: str
    email:str
    password:str


class UserLogin(BaseModel):
    email: str
    password: str
    
    
    
#### Endpoints GET
@app.get("/", response_class=HTMLResponse)
def root():
    return "<h1>FastAPI server is running ✅</h1>"



oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login") 



def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    user = db.query(User).filter(User.id == payload.get("user_id")).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user


### REFACTOR TO WORK WITH SUPABASE CLIENT INSTEAD, SO ALL THE CALLS UP ARE DEPENDING ON THE SUPABASE CLIENT AND WHATNOT
@app.post("/create_user")
def create_user(user: UserCreate, db: Session = Depends(get_db)):
    print("PASSWORD:", repr(user.password))
    hashed_pw = hash_password(password=user.password)
    gen_slug = "-".join([name.lower() for name in user.full_name.split()])
    new_user = User(email=user.email, hashed_password=hashed_pw, full_name=user.full_name, slug=gen_slug)

    try:
        db.add(new_user)
        db.commit()
        db.refresh(new_user)
    except Exception as e:
        db.rollback()
        print("ERROR:", e)
        raise HTTPException(status_code=500, detail=str(e))

    token = create_access_token({"user_id": str(new_user.id)})
    return {"id": new_user.id, "email": new_user.email, "name": new_user.full_name, "created_at": new_user.created_at, "token": token}


@app.post("/login")
def approve_login(user: UserLogin, db: Session = Depends(get_db)):
    curr_user = db.query(User).filter(User.email == user.email).first()
    if not curr_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    
    if not verify_password(user.password, curr_user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect password")
    
    token = create_access_token({"user_id": str(curr_user.id)})
    return {"status": "success", "id": curr_user.id, "email": curr_user.email, "token": token} 


@app.get("/me")
def get_me(current_user: User = Depends(get_current_user)):
    return {"email": current_user.email, "id": current_user.id, "slug": current_user.slug}
