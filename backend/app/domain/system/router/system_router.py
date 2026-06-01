from fastapi import APIRouter

from app.domain.system.dto.system_response import GpuStatusResponse
from app.domain.system.service.system_service import SystemService

router = APIRouter(prefix="/api/v1/system", tags=["system"])
service = SystemService()


@router.get("/gpu", response_model=GpuStatusResponse)
def get_gpu_status():
    return service.get_gpu_status()
