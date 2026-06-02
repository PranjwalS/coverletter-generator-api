from datetime import datetime
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
async def list_dashboard_configs(current_user: dict = Depends(get_current_user)):
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
async def get_dashboard_config(config_id: UUID, current_user: dict = Depends(get_current_user)):
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
async def export_dashboard_config(config_id: UUID, current_user: dict = Depends(get_current_user)):
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
    current_user: dict = Depends(get_current_user),
):
    row = {
        "user_id": current_user["user_id"],
        "active": False,
        **payload.model_dump(exclude_none=True, exclude={"location", "salary", "date_range"}),
    }

    # Serialize nested models to plain dicts for Supabase
    if payload.salary:
        row["salary"] = payload.salary.model_dump()
    if payload.date_range:
        row["date_range"] = payload.date_range.model_dump()
    if payload.location:
        row["location_mode"] = payload.location.mode
        row["include_locations"] = payload.location.includes
        row["exclude_locations"] = payload.location.excludes

    res = supabase_admin.table("dashboard_configs").insert(row).execute()
    if not res.data:
        raise HTTPException(status_code=500, detail="Failed to create config")
    return res.data[0]


@router.patch("/dashboard-configs/{config_id}")
async def update_dashboard_config(
    config_id: UUID,
    payload: DashboardConfigPatch,
    current_user: dict = Depends(get_current_user),
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

    updates = payload.model_dump(exclude_none=True, exclude={"location", "salary", "date_range"})

    if payload.salary:
        updates["salary"] = payload.salary.model_dump()
    if payload.date_range:
        updates["date_range"] = payload.date_range.model_dump()
    if payload.location:
        updates["location_mode"] = payload.location.mode
        updates["include_locations"] = payload.location.includes
        updates["exclude_locations"] = payload.location.excludes
        
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
async def delete_dashboard_config(config_id: UUID, current_user: dict = Depends(get_current_user)):
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
async def launch_dashboard_config(config_id: UUID, current_user: dict = Depends(get_current_user)):
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


def apply_config_filters(query, config: dict):
    if config.get("job_types"):
        query = query.in_("job_type", config["job_types"])

    if config.get("seasons"):
        query = query.in_("season", config["seasons"])

    if config.get("include_fields"):
        query = query.overlaps("fields", config["include_fields"])

    if config.get("exclude_fields"):
        for field in config["exclude_fields"]:
            query = query.not_.contains("fields", [field])

    if config.get("include_skills"):
        query = query.overlaps("skills", config["include_skills"])

    if config.get("exclude_skills"):
        for skill in config["exclude_skills"]:
            query = query.not_.contains("skills", [skill])

    if config.get("location_mode") == "hard" and config.get("include_locations"):
        query = query.overlaps("locations", config["include_locations"])

    if config.get("exclude_locations"):
        for loc in config["exclude_locations"]:
            query = query.not_.contains("locations", [loc])

    if config.get("exclude_companies"):
        query = query.not_.in_("company", config["exclude_companies"])

    if config.get("company_mode") == "hard" and config.get("include_companies"):
        query = query.in_("company", config["include_companies"])

## we'll have to mod this, perhaps trn jobs.duration into a json that holds stuff like; {duration: ..., start: ..., end: ...} instead
    date_range = config.get("date_range")
    if date_range:
        if date_range.get("start"):
            query = query.gte("scraped_at", date_range["start"])
        if date_range.get("end"):
            query = query.lte("scraped_at", date_range["end"])

    return query


# user can manually trigger it too (or you call it on dashboard open if last sync was >X hours ago).
@router.post("/dashboard-configs/{config_id}/sync")
async def sync_jobs_for_config(
    config_id: UUID,
    current_user: dict = Depends(get_current_user),
):
    
    user_id = current_user["user_id"]
    config_res = (
        supabase_admin
        .table("dashboard_configs")
        .select("*")
        .eq("id", str(config_id))
        .eq("user_id", user_id)
        .single()
        .execute()
    )
    if not config_res.data:
        raise HTTPException(status_code=404, detail="Config not found")

    config = config_res.data
    last_synced = config.get("last_synced_at")

    jobs_query = supabase_admin.table("jobs").select("id")
    if last_synced:
        jobs_query = jobs_query.gt("scraped_at", last_synced)
    jobs_query = apply_config_filters(jobs_query, config)
    jobs_res = jobs_query.execute()

    if not jobs_res.data:
        return {"synced": 0}

    rows = [
        {
            "user_id": user_id,
            "dashboard_config_id": str(config_id),
            "job_id": job["id"],
            "status": "new",
        }
        for job in jobs_res.data
    ]

    res = (
        supabase_admin
        .table("user_jobs")
        .upsert(rows, on_conflict="user_id,job_id,dashboard_config_id", ignore_duplicates=True)
        .execute()
    )
    
    supabase_admin.table("dashboard_configs").update({"last_synced_at": datetime.utcnow().isoformat()}).eq("id", str(config_id)).execute()
    return {"synced": len(res.data) if res.data else 0}


@router.get("/dashboard-configs/{config_id}/jobs")
async def get_jobs_for_config(
    config_id: UUID,
    current_user: dict = Depends(get_current_user),
    limit: int = 50,
    offset: int = 0,
    status: Optional[str] = None,
):
    user_id = current_user["user_id"]

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
        .eq("dashboard_config_id", str(config_id))
        .eq("user_id", user_id)
        .order("llm_score", desc=True, nulls_first=False)
        .order("created_at", desc=True)
        .range(offset, offset + limit - 1)
    )

    if status:
        query = query.eq("status", status)

    res = query.execute()
    return {"jobs": res.data, "offset": offset, "limit": limit, "count": len(res.data)}