from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.domain.model_registry.dto.model_version_response import ModelVersionResponse
from app.domain.model_registry.entity.model_version import ModelVersionStatus
from app.domain.model_registry.repository.model_version_repository import ModelVersionRepository


class ModelVersionService:
    def __init__(self):
        self.repo = ModelVersionRepository()

    def get_all(self, db: Session) -> list[ModelVersionResponse]:
        versions = self.repo.find_all(db)
        return [ModelVersionResponse.model_validate(v) for v in versions]

    def get_by_id(self, db: Session, version_id: int) -> ModelVersionResponse:
        version = self.repo.find_by_id(db, version_id)
        if version is None:
            raise HTTPException(status_code=404, detail="Model version not found")
        return ModelVersionResponse.model_validate(version)

    def get_by_experiment(self, db: Session, experiment_id: int) -> list[ModelVersionResponse]:
        versions = self.repo.find_by_experiment(db, experiment_id)
        return [ModelVersionResponse.model_validate(v) for v in versions]

    def select_version(self, db: Session, version_id: int) -> ModelVersionResponse:
        version = self.repo.update_status(db, version_id, ModelVersionStatus.SELECTED)
        if version is None:
            raise HTTPException(status_code=404, detail="Model version not found")
        return ModelVersionResponse.model_validate(version)

    def archive_version(self, db: Session, version_id: int) -> ModelVersionResponse:
        version = self.repo.update_status(db, version_id, ModelVersionStatus.ARCHIVED)
        if version is None:
            raise HTTPException(status_code=404, detail="Model version not found")
        return ModelVersionResponse.model_validate(version)
