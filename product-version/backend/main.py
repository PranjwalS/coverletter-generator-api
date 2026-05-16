from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from dotenv import load_dotenv
import os
import httpx
from jose import jwt, JWTError
from pydantic import BaseModel
from supabase import create_client, Client

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
# Cache JWKS keys
_jwks_cache = None

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


class UserCreate(BaseModel):
    full_name: str
    email: str
    password: str


class UserLogin(BaseModel):
    email: str
    password: str


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