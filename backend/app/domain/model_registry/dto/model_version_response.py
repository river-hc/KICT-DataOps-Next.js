from datetime import datetime
from typing import Any, Dict, Optional

from pydantic import BaseModel


class ModelVersionResponse(BaseModel):
    id: int
    experiment_id: Optional[int] = None
    run_id: Optional[int] = None
    version: Optional[str] = None
    model_name: Optional[str] = None
    model_path: Optional[str] = None
    status: str
    metrics: Optional[Dict[str, Any]] = None
    created_at: datetime

    class Config:
        from_attributes = True
