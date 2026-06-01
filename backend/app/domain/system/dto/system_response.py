from typing import List, Optional

from pydantic import BaseModel


class GpuInfo(BaseModel):
    index: int
    name: str
    memory_total_mb: int
    memory_used_mb: int
    memory_free_mb: int
    utilization_percent: int
    temperature_c: Optional[int] = None


class GpuStatusResponse(BaseModel):
    available: bool
    gpu_count: int
    gpus: List[GpuInfo] = []
    error: Optional[str] = None
