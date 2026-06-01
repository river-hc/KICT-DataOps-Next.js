from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.common.config.database import get_db
from app.domain.model_registry.dto.model_version_response import ModelVersionResponse
from app.domain.model_registry.service.model_version_service import ModelVersionService

router = APIRouter(prefix="/api/v1/models", tags=["models"])
service = ModelVersionService()


@router.get("", response_model=list[ModelVersionResponse])
def get_models(db: Session = Depends(get_db)):
    return service.get_all(db)


@router.get("/{version_id}", response_model=ModelVersionResponse)
def get_model(version_id: int, db: Session = Depends(get_db)):
    return service.get_by_id(db, version_id)


@router.post("/{version_id}/select", response_model=ModelVersionResponse)
def select_model(version_id: int, db: Session = Depends(get_db)):
    return service.select_version(db, version_id)


@router.post("/{version_id}/archive", response_model=ModelVersionResponse)
def archive_model(version_id: int, db: Session = Depends(get_db)):
    return service.archive_version(db, version_id)
