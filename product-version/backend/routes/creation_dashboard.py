import os
import json
from pydantic import BaseModel
from typing import Optional
from uuid import UUID
from fastapi import APIRouter, FastAPI, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from uuid import UUID
from typing import Optional
from pydantic import BaseModel
from dependencies import supabase_admin, get_current_user

router = FastAPI()



class SalaryConfig(BaseModel):
    type: str  # "hourly", "monthly", "yearly"
    min: Optional[float] = None
    max: Optional[float] = None

class DateRange(BaseModel):
    start: Optional[str] = None  
    end: Optional[str] = None

class DashboardConfigCreate(BaseModel):
    name: str
    description: Optional[str] = None
    job_types: list[str] = []
    include_fields: list[str] = []
    exclude_fields: list[str] = []
    include_skills: list[str] = []
    exclude_skills: list[str] = []
    include_locations: list[str] = []
    exclude_locations: list[str] = []
    location_mode: str = "preference"  # "preference" or "hard"
    include_companies: list[str] = []
    exclude_companies: list[str] = []
    company_mode: str = "preference"
    salary: Optional[SalaryConfig] = None
    seasons: list[str] = []
    work_term_duration: Optional[str] = None
    date_range: Optional[DateRange] = None

class DashboardConfigPatch(BaseModel):
    # every field optional for partial updates per step
    name: Optional[str] = None
    description: Optional[str] = None
    job_types: Optional[list[str]] = None
    include_fields: Optional[list[str]] = None
    exclude_fields: Optional[list[str]] = None
    include_skills: Optional[list[str]] = None
    exclude_skills: Optional[list[str]] = None
    include_locations: Optional[list[str]] = None
    exclude_locations: Optional[list[str]] = None
    location_mode: Optional[str] = None
    include_companies: Optional[list[str]] = None
    exclude_companies: Optional[list[str]] = None
    company_mode: Optional[str] = None
    salary: Optional[SalaryConfig] = None
    seasons: Optional[list[str]] = None
    work_term_duration: Optional[str] = None
    date_range: Optional[DateRange] = None
    active: Optional[bool] = None  # True on launch





router = APIRouter()
# --- META ---
@router.get("/meta/skills")
async def get_skills():
    with open("data/skills.json", "r") as f:
        return json.load(f)
       
@router.get("/meta/fields")
async def get_fields():
    with open("data/new_fields.json", "r") as f:
        return json.load(f)
    
@router.get("/meta/locations")
async def get_locations():
    with open("data/locations.json", "r") as f:
        return json.load(f)




@router.get("/meta/companies")
async def get_companies(search: str = ""):
    cached = redis_client.get("companies_list")
    companies = json.loads(cached)
    
    if not search or len(search) < 2:
        return []
    
    filtered = [c for c in companies if search.lower() in c["name"].lower()]
    return filtered[:20]

# --- DASHBOARD CONFIGS ---
@router.get("/dashboard-configs/{config_id}")
async def get_dashboard_config(config_id: UUID):
    pass
@router.get("/dashboard-configs/{config_id}/export")
async def export_dashboard_config(config_id: UUID):
    pass
@router.post("/dashboard-configs")
async def create_dashboard_config(payload: DashboardConfigCreate):
    pass
@router.patch("/dashboard-configs/{config_id}")
async def update_dashboard_config(config_id: UUID, payload: DashboardConfigPatch):
    pass