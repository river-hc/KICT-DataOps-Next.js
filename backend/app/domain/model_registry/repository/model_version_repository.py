from sqlalchemy.orm import Session

from app.domain.model_registry.entity.model_version import ModelVersion, ModelVersionStatus


class ModelVersionRepository:
    def save(self, db: Session, version: ModelVersion) -> ModelVersion:
        db.add(version)
        db.commit()
        db.refresh(version)
        return version

    def find_by_id(self, db: Session, version_id: int) -> ModelVersion | None:
        return db.query(ModelVersion).filter(ModelVersion.id == version_id).first()

    def find_all(self, db: Session) -> list[ModelVersion]:
        return db.query(ModelVersion).order_by(ModelVersion.created_at.desc()).all()

    def find_by_experiment(self, db: Session, experiment_id: int) -> list[ModelVersion]:
        return (
            db.query(ModelVersion)
            .filter(ModelVersion.experiment_id == experiment_id)
            .order_by(ModelVersion.created_at.desc())
            .all()
        )

    def update_status(self, db: Session, version_id: int, status: ModelVersionStatus) -> ModelVersion | None:
        version = self.find_by_id(db, version_id)
        if version:
            version.status = status
            db.commit()
            db.refresh(version)
        return version
