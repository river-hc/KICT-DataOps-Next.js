from sqlalchemy.orm import Session

from app.domain.artifact.entity.run_artifact import RunArtifact


class ArtifactRepository:
    def save(self, db: Session, artifact: RunArtifact) -> RunArtifact:
        db.add(artifact)
        db.commit()
        db.refresh(artifact)
        return artifact

    def save_all(self, db: Session, artifacts: list[RunArtifact]) -> list[RunArtifact]:
        for artifact in artifacts:
            db.add(artifact)
        db.commit()
        for artifact in artifacts:
            db.refresh(artifact)
        return artifacts

    def find_by_run_id(self, db: Session, run_id: int) -> list[RunArtifact]:
        return (
            db.query(RunArtifact)
            .filter(RunArtifact.run_id == run_id)
            .order_by(RunArtifact.created_at.asc())
            .all()
        )

    def find_by_id(self, db: Session, artifact_id: int) -> RunArtifact | None:
        return db.query(RunArtifact).filter(RunArtifact.id == artifact_id).first()
