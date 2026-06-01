from datetime import datetime
from typing import Any, Dict, Optional

from pydantic import BaseModel


class ExperimentResponse(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class ExperimentRunResponse(BaseModel):
    id: int
    experiment_id: int
    job_id: int
    run_name: Optional[str] = None
    version: Optional[str] = None
    mode: Optional[str] = None
    status: Optional[str] = None
    parameters: Optional[Dict[str, Any]] = None
    metrics: Optional[Dict[str, Any]] = None
    created_by: Optional[str] = None
    started_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None
    duration_seconds: Optional[int] = None
    created_at: datetime

    class Config:
        from_attributes = True
