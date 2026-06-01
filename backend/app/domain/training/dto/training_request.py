from typing import Any, Dict, Optional

from pydantic import BaseModel, Field

from app.domain.training.entity.training_job import TrainingMode


class TrainingCreateRequest(BaseModel):
    user_name: str = Field(..., min_length=1, max_length=100)
    experiment_name: str = Field(..., min_length=1, max_length=200)
    mode: TrainingMode
    parameters: Dict[str, Any]
    output_dir: Optional[str] = None