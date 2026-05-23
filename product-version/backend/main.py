from pydantic import ValidationError
from fastapi import FastAPI, Depends, File, HTTPException, UploadFile, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from dotenv import load_dotenv
import os
import httpx
from jose import jwt, JWTError
from pydantic import BaseModel
from supabase import create_client, Client
from docling.document_converter import DocumentConverter
from functions.cv_and_cl_gen import cv_parser
import uuid

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "backend.env"), override=True)

FRONTEND_ORIGIN = os.getenv("FRONTEND_ORIGIN", "*")
SUPABASE_URL = os.getenv("SUPABASE_PROD_URL")
SUPABASE_PUBLISHABLE_KEY = os.getenv("SUPABASE_PUBLISHABLE_KEY")
SUPABASE_SECRET_KEY = os.getenv("SUPABASE_SECRET_KEY")

# Public client for auth operations (sign in, sign up)
supabase: Client = create_client(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY)

# Admin client using secret key for admin operations
supabase_admin: Client = create_client(SUPABASE_URL, SUPABASE_SECRET_KEY)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_ORIGIN, "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

bearer_scheme = HTTPBearer()
_jwks_cache = None




### classses

class UserCreate(BaseModel):
    full_name: str
    email: str
    password: str


class UserLogin(BaseModel):
    email: str
    password: str
    
    
class EducationEntry(BaseModel):
    id: str = None
    institution: str
    degree: str
    field: str
    gpa: str | None
    start_date: str
    end_date: str
    details: list[str]
    
class ExperienceEntry(BaseModel):
    id: str = None
    company: str
    role: str
    location: str
    start_date: str
    end_date: str
    responsibilities: list[str]

class ProjectsEntry(BaseModel):
    id: str = None
    name: str
    description: list[str]
    start_date: str
    end_date: str
    links: list[str]
    tech_stack: list[str]


class UpdateEntryRequest(BaseModel):
    section: str
    id: str
    data: dict

class BulkUpdateRequest(BaseModel):
    updates: list[UpdateEntryRequest]


class NewEntryRequest(BaseModel):
    section: str
    data: dict
    

class BulkAddRequest(BaseModel):
    adds: list[NewEntryRequest]
    
class DeleteEntryRequest(BaseModel):
    section: str
    id: str
    
### helpers



def stamp_ids(entries: list) -> list:
    for entry in entries:
        if not entry.get("id"):
            entry["id"] = str(uuid.uuid4())
    return entries



def get_jwks():
    global _jwks_cache
    if _jwks_cache:
        return _jwks_cache
    response = httpx.get(f"{SUPABASE_URL}/auth/v1/.well-known/jwks.json")
    response.raise_for_status()
    _jwks_cache = response.json()
    return _jwks_cache

def verify_supabase_jwt(token: str):
    try:
        jwks = get_jwks()
        # Get the kid from token header
        unverified_header = jwt.get_unverified_header(token)
        kid = unverified_header.get("kid")
        # Find matching key
        key = None
        for k in jwks.get("keys", []):
            if k.get("kid") == kid:
                key = k
                break
        if not key:
            return None
        payload = jwt.decode(token, key, algorithms=["ES256", "RS256"], options={"verify_aud": False})
        return payload
    except JWTError:
        return None




def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme)):
    token = credentials.credentials
    payload = verify_supabase_jwt(token)
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    try:
        profile = supabase_admin.table("profiles").select("*").eq("user_id", user_id).single().execute()
        if not profile.data:
            raise HTTPException(status_code=404, detail="Profile not found")
        return {"user_id": user_id, **profile.data}
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Could not validate user")





### endpoints

@app.get("/", response_class=HTMLResponse)
def root():
    return "<h1>JobScout API ✅</h1>"


@app.post("/create_user")
def create_user(user: UserCreate):
    try:
        auth_response = supabase_admin.auth.admin.create_user({
            "email": user.email,
            "password": user.password,
            "email_confirm": True,
            "user_metadata": {"full_name": user.full_name}
        })
        new_user = auth_response.user
        if not new_user:
            raise HTTPException(status_code=500, detail="Failed to create user")
    except HTTPException:
        raise
    except Exception as e:
        error_msg = str(e)
        if "already" in error_msg.lower():
            raise HTTPException(status_code=400, detail="Email already registered")
        raise HTTPException(status_code=500, detail=f"Auth error: {error_msg}")

    try:
        supabase_admin.table("profiles").insert({
            "user_id": str(new_user.id),
            "display_name": user.full_name,
        }).execute()
    except Exception as e:
        print(f"Profile insert error: {e}")

 ### sign in to fetch the jwt token and hold onto it to maintain state on frontend side
    try:
        sign_in = supabase.auth.sign_in_with_password({
            "email": user.email,
            "password": user.password,
        })
        token = sign_in.session.access_token
        refresh_token = sign_in.session.refresh_token
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Sign in after signup failed: {str(e)}")

    return {
        "id": str(new_user.id),
        "email": new_user.email,
        "full_name": user.full_name,
        "token": token,
        "refresh_token": refresh_token,
    }


@app.post("/login")
def approve_login(user: UserLogin):
    try:
        auth_response = supabase.auth.sign_in_with_password({
            "email": user.email,
            "password": user.password,
        })
        supabase_user = auth_response.user
        session = auth_response.session
        if not supabase_user or not session:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    except HTTPException:
        raise
    except Exception as e:
        error_msg = str(e).lower()
        if "invalid login" in error_msg or "invalid credentials" in error_msg:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")
        raise HTTPException(status_code=500, detail=f"Login error: {str(e)}")

    return {
        "status": "success",
        "id": str(supabase_user.id),
        "email": supabase_user.email,
        "token": session.access_token,
        "refresh_token": session.refresh_token,
    }


@app.get("/me")
def get_me(current_user=Depends(get_current_user)):
    return {
        "id": current_user["user_id"],
        "email": current_user.get("email", ""),
        "full_name": current_user.get("display_name", ""),
        "slug": current_user.get("slug"),
        "display_name": current_user.get("display_name"),
    }
    
@app.post("/cv/upload")
async def upload_cv(file: UploadFile = File(...), current_user = Depends(get_current_user)):
    path = f"{current_user["user_id"]}/cv.pdf"
    file_bytes = await file.read()
    supabase_admin.storage.from_("cvs").upload(path, file_bytes, {"upsert":"true"})
    pdf_url = supabase_admin.storage.from_("cvs").get_public_url(path)
    
    converter = DocumentConverter()
    result = converter.convert(pdf_url) 
    cv_information = result.document.export_to_markdown()
    
    json_output = cv_parser(cv_information)

    supabase_admin.table("profiles").update({
        "cv_pdf_url" : pdf_url,
        "cv_parsed_text": cv_information,
        "cv_json": json_output,
        "education": stamp_ids(json_output.get("education", [])),
        "experiences": stamp_ids(json_output.get("experience", [])),
        "projects": stamp_ids(json_output.get("projects", [])),
        "skills": json_output.get("skills", {}).get("skills", ""),
    }).eq("user_id", current_user["user_id"]).execute()

    return {"status": "ok", "cv_pdf_url": pdf_url}


@app.get("/cv/get")
async def get_cv(current_user = Depends(get_current_user)):
    result = supabase_admin.table("profiles").select("*").eq("user_id", current_user["user_id"]).single().execute()
    user_profile = result.data
    return {
        "education": [EducationEntry(**e) for e in user_profile.get("education", []) if e],
        "experience": [ExperienceEntry(**e) for e in user_profile.get("experiences", []) if e],
        "projects": [ProjectsEntry(**e) for e in user_profile.get("projects", []) if e],
        "skills": user_profile.get("skills")
    }
    
    
@app.put("/cv/update")
async def update_cv(body: BulkUpdateRequest, current_user = Depends(get_current_user)):
    result = supabase_admin.table("profiles").select("*").eq("user_id", current_user["user_id"]).single().execute()
    profile = result.data
    
    section_map = {
        "education": "education",
        "experiences": "experiences",
        "projects": "projects",
    }
    
    section_model_map = {
        "education": EducationEntry,
        "experiences": ExperienceEntry,
        "projects": ProjectsEntry,
    }
    
    # group updates by section so we only write each column once
    affected = {}
    for update in body.updates:
        column = section_map.get(update.section)
        model = section_model_map.get(update.section)
        if not column:
            raise HTTPException(status_code=400, detail=f"Invalid section: {update.section}")
        if column not in affected:
            affected[column] = profile.get(column, [])
        for entry in affected[column]:
            if entry.get("id") == update.id:
                try:
                    entry.update(update.data)
                    validated = model(**entry)
                    break
                except ValidationError as e:
                    raise HTTPException(status_code=422, detail=str(e))

    for column, entries in affected.items():
        supabase_admin.table("profiles").update({
            column: entries
        }).eq("user_id", current_user["user_id"]).execute()
    
    return {"status": "ok"}


#### careertwin parts

@app.get("/careertwin/get_info")
def get_careertwin_info(current_user = Depends(get_current_user)):
    result = supabase_admin.table("profiles").select("*").eq("user_id", current_user["user_id"]).single().execute()
    user_profile = result.data
    return {
        "education": [EducationEntry(**e) for e in user_profile.get("education", []) if e],
        "experience": [ExperienceEntry(**e) for e in user_profile.get("experiences", []) if e],
        "projects": [ProjectsEntry(**e) for e in user_profile.get("projects", []) if e],
        "skills": user_profile.get("skills")
    }
    

@app.post("/careertwin/add_info")
def add_careertwin_info(body: BulkAddRequest, current_user = Depends(get_current_user)):
    result = supabase_admin.table("profiles").select("*").eq("user_id", current_user["user_id"]).single().execute()
    profile = result.data
    
    section_map = {
        "education": "education",
        "experiences": "experiences",
        "projects": "projects",
    }
    
    section_model_map = {
        "education": EducationEntry,
        "experiences": ExperienceEntry,
        "projects": ProjectsEntry,
    }
    
    affected = {}
    for add in body.adds:
        column = section_map.get(add.section)
        if not column:
            raise HTTPException(status_code=400, detail=f"Invalid section: {add.section}")
        
        model = section_model_map.get(add.section)  # EducationEntry, ExperienceEntry etc
        try:
            validated = model(**add.data)
        except ValidationError as e:
            raise HTTPException(status_code=422, detail=str(e))        
        
        if column not in affected:
            affected[column] = profile.get(column, [])
        
        entry = validated.dict()
        entry["id"] = str(uuid.uuid4())
        affected[column].append(entry)

    for column, entries in affected.items():
        supabase_admin.table("profiles").update({
            column: entries
        }).eq("user_id", current_user["user_id"]).execute()
    
    return {"status": "ok"}




    result = supabase_admin.table("profiles").select("*").eq("user_id", current_user["user_id"]).single().execute()
    profile = result.data
    
    section_map = {
        "education": "education",
        "experiences": "experiences",
        "projects": "projects",
    }
    
    section_model_map = {
        "education": EducationEntry,
        "experiences": ExperienceEntry,
        "projects": ProjectsEntry,
    }
    
    # group updates by section so we only write each column once
    affected = {}
    for update in body.updates:
        column = section_map.get(update.section)
        model = section_model_map.get(update.section)
        if not column:
            raise HTTPException(status_code=400, detail=f"Invalid section: {update.section}")
        if column not in affected:
            affected[column] = profile.get(column, [])
        for entry in affected[column]:
            if entry.get("id") == update.id:
                try:
                    entry.update(update.data)
                    validated = model(**entry)
                    break
                except ValidationError as e:
                    raise HTTPException(status_code=422, detail=str(e))

    for column, entries in affected.items():
        supabase_admin.table("profiles").update({
            column: entries
        }).eq("user_id", current_user["user_id"]).execute()
    
    return {"status": "ok"}
