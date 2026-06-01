from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class ArtifactResponse(BaseModel):
    id: int
    run_id: int
    artifact_type: Optional[str] = None
    file_name: Optional[str] = None
    file_path: Optional[str] = None
    file_size: Optional[int] = None
    created_at: datetime

    class Config:
        from_attributes = True
