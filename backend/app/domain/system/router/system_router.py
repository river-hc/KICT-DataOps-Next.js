from fastapi import APIRouter

from app.domain.system.dto.system_response import GpuStatusResponse
from app.domain.system.service.system_service import SystemService

router = APIRouter(prefix="/api/v1/system", tags=["system"])
service = SystemService()


@router.get("/gpu", response_model=GpuStatusResponse)
def get_gpu_status():
    """
    서버 GPU 상태를 반환합니다.

    - **available**: GPU 사용 가능 여부
    - **gpu_count**: GPU 수량
    - **memory_used_mb / memory_total_mb**: 메모리 사용량
    - **utilization_percent**: GPU 점유율

    nvidia-smi 기반으로 조회합니다. GPU가 없는 환경에서는 available=false로 반환됩니다.
    """
    return service.get_gpu_status()
