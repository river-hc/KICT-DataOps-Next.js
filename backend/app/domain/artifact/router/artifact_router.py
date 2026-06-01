from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.common.config.database import get_db
from app.domain.artifact.dto.artifact_response import ArtifactResponse
from app.domain.artifact.service.artifact_service import ArtifactService

router = APIRouter(prefix="/api/v1", tags=["artifacts"])
service = ArtifactService()


@router.get("/runs/{run_id}/artifacts", response_model=list[ArtifactResponse])
def get_artifacts(run_id: int, db: Session = Depends(get_db)):
    return service.get_artifacts_by_run(db, run_id)


@router.get("/artifacts/{artifact_id}", response_model=ArtifactResponse)
def get_artifact(artifact_id: int, db: Session = Depends(get_db)):
    return service.get_artifact(db, artifact_id)
