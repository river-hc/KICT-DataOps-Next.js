from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.domain.artifact.dto.artifact_response import ArtifactResponse
from app.domain.artifact.repository.artifact_repository import ArtifactRepository


class ArtifactService:
    def __init__(self):
        self.repo = ArtifactRepository()

    def get_artifacts_by_run(self, db: Session, run_id: int) -> list[ArtifactResponse]:
        artifacts = self.repo.find_by_run_id(db, run_id)
        return [ArtifactResponse.model_validate(a) for a in artifacts]

    def get_artifact(self, db: Session, artifact_id: int) -> ArtifactResponse:
        artifact = self.repo.find_by_id(db, artifact_id)
        if artifact is None:
            raise HTTPException(status_code=404, detail="Artifact not found")
        return ArtifactResponse.model_validate(artifact)
