import os
import json
from pydantic import BaseModel
from typing import Optional
from uuid import UUID
from fastapi import APIRouter, HTTPException
from uuid import UUID


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

## input from frontend?
# {
#   "name": "Fall 2026 SWE",
#   "description": "...",
#   "job_types": ["co-op"],
#   "include_fields": ["software engineer"],  ## use fields INCLudes to fetch skills
#   "exclude_fields": ["manager"],   
#   "include_skills": ["python", "react"],
#   "exclude_skills": ["cobol"],
#   "include_locations": [...],
#   "exclude_locations": [...],
#   "location_mode": "preference",
#   "include_companies": [...],
#   "exclude_companies": [...],
#   "company_mode": "hard",
#   "salary": { "type": "hourly", "min": 20 },
#   "seasons": ["fall_2026"],
#   "work_term_duration": "4_months",
#   "date_range": { "start": "2026-09-01", "end": "2026-12-31" }
# }





## endpoints idea
# GET  /meta/skills
# GET  /meta/fields
# GET  /meta/locations
# GET  /meta/companies

# GET  /dashboard-configs/{id}          ← resume draft OR edit existing
# GET  /dashboard-configs/{id}/export   ← copy-from previous

# POST   /dashboard-configs             ← create draft (step 1 submit)
# PATCH  /dashboard-configs/{id}        ← update per step