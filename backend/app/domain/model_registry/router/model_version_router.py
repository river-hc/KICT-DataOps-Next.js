from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.common.config.database import get_db
from app.domain.model_registry.dto.model_version_response import ModelVersionResponse
from app.domain.model_registry.service.model_version_service import ModelVersionService

router = APIRouter(prefix="/api/v1/models", tags=["models"])
service = ModelVersionService()


@router.get("", response_model=list[ModelVersionResponse])
def get_models(db: Session = Depends(get_db)):
    """
    전체 모델 버전 목록을 반환합니다.

    - **status**: CREATED(기본) / SELECTED(대표 모델) / ARCHIVED(보관)

    모델 관리 화면의 버전 목록에 사용합니다.
    """
    return service.get_all(db)


@router.get("/{version_id}", response_model=ModelVersionResponse)
def get_model(version_id: int, db: Session = Depends(get_db)):
    """
    특정 모델 버전의 상세 정보를 반환합니다.
    """
    return service.get_by_id(db, version_id)


@router.post("/{version_id}/select", response_model=ModelVersionResponse)
def select_model(version_id: int, db: Session = Depends(get_db)):
    """
    해당 모델 버전을 SELECTED(대표 모델)로 지정합니다.

    운영에 사용할 모델을 선택할 때 사용합니다.
    """
    return service.select_version(db, version_id)


@router.post("/{version_id}/archive", response_model=ModelVersionResponse)
def archive_model(version_id: int, db: Session = Depends(get_db)):
    """
    해당 모델 버전을 ARCHIVED(보관) 상태로 변경합니다.

    더 이상 사용하지 않는 버전을 보관 처리할 때 사용합니다.
    """
    return service.archive_version(db, version_id)
