from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel

from app.domain.training.entity.training_job import JobStatus, TrainingMode


class TrainingCreateResponse(BaseModel):
    job_id: int
    status: JobStatus
    queue_position: int
    message: str


class TrainingSummaryResponse(BaseModel):
    job_id: int
    user_name: str
    experiment_name: str
    mode: TrainingMode
    status: JobStatus
    progress: Optional[int] = None
    current_epoch: Optional[int] = None
    total_epochs: Optional[int] = None
    run_id: Optional[int] = None
    created_at: datetime
    started_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None


class TrainingLogResponse(BaseModel):
    job_id: int
    logs: List[str]


class TrainingResultResponse(BaseModel):
    job_id: int
    run_id: Optional[int] = None
    status: JobStatus
    params: Dict[str, Any] = {}
    metrics: Dict[str, Any] = {}
    artifacts: List[Dict[str, Any]] = []