import os
import json
from pydantic import BaseModel
from typing import Optional
from uuid import UUID
from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dependencies import supabase_admin, get_current_user, redis_client

router = APIRouter()



class SalaryConfig(BaseModel):
    type: str  # "hourly", "weekly", "monthly", "yearly"
    min: Optional[float] = None
    max: Optional[float] = None

class DateRange(BaseModel):
    start: Optional[str] = None   # ISO date string
    end: Optional[str] = None

class LocationConfig(BaseModel):
    mode: str = "preference"      # "preference" | "hard"
    includes: list[str] = []      # country or city strings
    excludes: list[str] = []
    radius: Optional[dict] = None # {"lat": float, "lng": float, "km": int}

class DashboardConfigCreate(BaseModel):
    name: str
    description: Optional[str] = None
    job_types: list[str] = []
    include_fields: list[str] = []
    exclude_fields: list[str] = []
    include_skills: list[str] = []
    exclude_skills: list[str] = []
    location: Optional[LocationConfig] = None
    include_companies: list[str] = []
    exclude_companies: list[str] = []
    company_mode: str = "preference"   # "preference" | "hard"
    salary: Optional[SalaryConfig] = None
    seasons: list[str] = []
    work_term_duration: Optional[str] = None
    date_range: Optional[DateRange] = None

class DashboardConfigPatch(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    job_types: Optional[list[str]] = None
    include_fields: Optional[list[str]] = None
    exclude_fields: Optional[list[str]] = None
    include_skills: Optional[list[str]] = None
    exclude_skills: Optional[list[str]] = None
    location: Optional[LocationConfig] = None
    include_companies: Optional[list[str]] = None
    exclude_companies: Optional[list[str]] = None
    company_mode: Optional[str] = None
    salary: Optional[SalaryConfig] = None
    seasons: Optional[list[str]] = None
    work_term_duration: Optional[str] = None
    date_range: Optional[DateRange] = None
    active: Optional[bool] = None   # flip True on Launch



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
    if not search or len(search) < 2:
        return []

    cached = redis_client.get("companies_list")
    if not cached:
        raise HTTPException(status_code=503, detail="Companies list not cached yet")

    companies = json.loads(cached)
    filtered = [c for c in companies if search.lower() in c["name"].lower()]
    return filtered[:20]

@router.get("/meta/skills-by-fields")
async def get_skills_by_fields(fields: str = ""):
    
    with open("data/skills.json", "r") as f:
        all_skills = json.load(f)

    if not fields:
        return all_skills

    requested = {f.strip().lower() for f in fields.split(",")}

    # skills.json expected shape: { "field_name": ["skill1", "skill2", ...], ... }
    # or flat list — handle both
    if isinstance(all_skills, dict):
        result = {}
        for field, skills in all_skills.items():
            if field.lower() in requested:
                result[field] = skills
        return result if result else all_skills

    # flat list — just return everything (can refine later)
    return all_skills






@router.get("/dashboard-configs")
async def list_dashboard_configs(current_user: str = Depends(get_current_user)):
    res = (
        supabase_admin
        .table("dashboard_configs")
        .select("*")
        .eq("user_id", current_user["user_id"])
        .order("created_at", desc=True)
        .execute()
    )
    return res.data


@router.get("/dashboard-configs/{config_id}")
async def get_dashboard_config(config_id: UUID, current_user: str = Depends(get_current_user)):
    res = (
        supabase_admin
        .table("dashboard_configs")
        .select("*")
        .eq("id", str(config_id))
        .eq("user_id", current_user["user_id"])  
        .single()
        .execute()
    )
    if not res.data:
        raise HTTPException(status_code=404, detail="Config not found")
    return res.data


@router.get("/dashboard-configs/{config_id}/export")
async def export_dashboard_config(config_id: UUID, current_user: str = Depends(get_current_user)):
    res = (
        supabase_admin
        .table("dashboard_configs")
        .select("*")
        .eq("id", str(config_id))
        .eq("user_id", current_user["user_id"])
        .single()
        .execute()
    )
    if not res.data:
        raise HTTPException(status_code=404, detail="Config not found")

    # Strip internal fields before export
    export = {k: v for k, v in res.data.items() if k not in ("user_id", "created_at", "updated_at")}
    return export


@router.post("/dashboard-configs")
async def create_dashboard_config(
    payload: DashboardConfigCreate,
    current_user: str = Depends(get_current_user),
):
    row = {
        "user_id": current_user["user_id"],
        "active": False,
        **payload.model_dump(exclude_none=True),
    }

    # Serialize nested models to plain dicts for Supabase
    if payload.salary:
        row["salary"] = payload.salary.model_dump()
    if payload.date_range:
        row["date_range"] = payload.date_range.model_dump()
    if payload.location:
        row["location"] = payload.location.model_dump()

    res = supabase_admin.table("dashboard_configs").insert(row).execute()
    if not res.data:
        raise HTTPException(status_code=500, detail="Failed to create config")
    return res.data[0]


@router.patch("/dashboard-configs/{config_id}")
async def update_dashboard_config(
    config_id: UUID,
    payload: DashboardConfigPatch,
    current_user: str = Depends(get_current_user),
):
    # Ownership check first
    existing = (
        supabase_admin
        .table("dashboard_configs")
        .select("id")
        .eq("id", str(config_id))
        .eq("user_id", current_user["user_id"])
        .single()
        .execute()
    )
    if not existing.data:
        raise HTTPException(status_code=404, detail="Config not found")

    updates = payload.model_dump(exclude_none=True)

    if payload.salary:
        updates["salary"] = payload.salary.model_dump()
    if payload.date_range:
        updates["date_range"] = payload.date_range.model_dump()
    if payload.location:
        updates["location"] = payload.location.model_dump()

    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")

    res = (
        supabase_admin
        .table("dashboard_configs")
        .update(updates)
        .eq("id", str(config_id))
        .execute()
    )
    return res.data[0]


@router.delete("/dashboard-configs/{config_id}")
async def delete_dashboard_config(config_id: UUID, current_user: str = Depends(get_current_user)):
    existing = (
        supabase_admin
        .table("dashboard_configs")
        .select("id")
        .eq("id", str(config_id))
        .eq("user_id", current_user["user_id"])
        .single()
        .execute()
    )
    if not existing.data:
        raise HTTPException(status_code=404, detail="Config not found")

    supabase_admin.table("dashboard_configs").delete().eq("id", str(config_id)).execute()
    return {"deleted": str(config_id)}


@router.post("/dashboard-configs/{config_id}/launch")
async def launch_dashboard_config(config_id: UUID, current_user: str = Depends(get_current_user)):
    """Activate a config — sets active=True, deactivates all others for this user."""
    existing = (
        supabase_admin
        .table("dashboard_configs")
        .select("id")
        .eq("id", str(config_id))
        .eq("user_id", current_user["user_id"])
        .single()
        .execute()
    )
    if not existing.data:
        raise HTTPException(status_code=404, detail="Config not found")

    # Deactivate all other configs for this user
    # supabase_admin.table("dashboard_configs").update({"active": False}).eq("user_id", user_id).execute()

    # Activate this one
    res = (
        supabase_admin
        .table("dashboard_configs")
        .update({"active": True})
        .eq("id", str(config_id))
        .execute()
    )
    return res.data[0]




# ─── Jobs Feed ────────────────────────────────────────────────────────────────

### MODIFY THE TWO BELOW...


@router.get("/dashboard-configs/{config_id}/jobs")
async def get_jobs_for_config(
    config_id: UUID,
    user_id: str = Depends(get_current_user),
    limit: int = 50,
    offset: int = 0,
    min_score: Optional[float] = None,
):
    """
    Return jobs matched + scored against this config.
    Assumes a user_jobs view/table with config_id, score, job_id FK to jobs.
    """
    config_res = (
        supabase_admin
        .table("dashboard_configs")
        .select("id")
        .eq("id", str(config_id))
        .eq("user_id", user_id)
        .single()
        .execute()
    )
    if not config_res.data:
        raise HTTPException(status_code=404, detail="Config not found")

    query = (
        supabase_admin
        .table("user_jobs")
        .select("*, jobs(*)")
        .eq("config_id", str(config_id))
        .eq("user_id", user_id)
        .order("score", desc=True)
        .range(offset, offset + limit - 1)
    )

    if min_score is not None:
        query = query.gte("score", min_score)

    res = query.execute()
    return {"jobs": res.data, "offset": offset, "limit": limit}


@router.get("/dashboard-configs/{config_id}/jobs/new")
async def get_new_jobs_for_config(
    config_id: UUID,
    user_id: str = Depends(get_current_user),
    since: Optional[str] = None,   # ISO timestamp
):
    """
    Poll for new jobs since a given timestamp.
    Frontend can call this on an interval to show 'X new jobs' badge.
    """
    config_res = (
        supabase_admin
        .table("dashboard_configs")
        .select("id")
        .eq("id", str(config_id))
        .eq("user_id", user_id)
        .single()
        .execute()
    )
    if not config_res.data:
        raise HTTPException(status_code=404, detail="Config not found")

    query = (
        supabase_admin
        .table("user_jobs")
        .select("id, score, created_at, jobs(title, company, location)")
        .eq("config_id", str(config_id))
        .eq("user_id", user_id)
        .eq("seen", False)
        .order("created_at", desc=True)
    )

    if since:
        query = query.gt("created_at", since)

    res = query.execute()
    return {"new_jobs": res.data, "count": len(res.data)}


# ─── Notifications ────────────────────────────────────────────────────────────

@router.post("/dashboard-configs/{config_id}/notify-settings")
async def update_notify_settings(
    config_id: UUID,
    email_enabled: bool = True,
    min_score_threshold: float = 0.75,
    user_id: str = Depends(get_current_user),
):
    """
    Update notification preferences for a config.
    Stored as jsonb in notify_settings column on dashboard_configs.
    """
    existing = (
        supabase_admin
        .table("dashboard_configs")
        .select("id")
        .eq("id", str(config_id))
        .eq("user_id", user_id)
        .single()
        .execute()
    )
    if not existing.data:
        raise HTTPException(status_code=404, detail="Config not found")

    settings = {
        "email_enabled": email_enabled,
        "min_score_threshold": min_score_threshold,
    }

    res = (
        supabase_admin
        .table("dashboard_configs")
        .update({"notify_settings": settings})
        .eq("id", str(config_id))
        .execute()
    )
    return res.data[0]