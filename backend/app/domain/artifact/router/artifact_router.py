from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.common.config.database import get_db
from app.domain.artifact.dto.artifact_response import ArtifactResponse
from app.domain.artifact.service.artifact_service import ArtifactService

router = APIRouter(prefix="/api/v1", tags=["artifacts"])
service = ArtifactService()


@router.get("/runs/{run_id}/artifacts", response_model=list[ArtifactResponse])
def get_artifacts(run_id: int, db: Session = Depends(get_db)):
    """
    특정 run에서 생성된 결과 파일 목록을 반환합니다.

    - **artifact_type**: model / prediction / plot / csv / log 등
    - **file_path**: 서버 로컬 경로 (파일 다운로드 시 참고)

    학습 결과 화면에서 파일 목록 출력에 사용합니다.
    """
    return service.get_artifacts_by_run(db, run_id)


@router.get("/artifacts/{artifact_id}", response_model=ArtifactResponse)
def get_artifact(artifact_id: int, db: Session = Depends(get_db)):
    """
    특정 artifact의 상세 정보를 반환합니다.
    """
    return service.get_artifact(db, artifact_id)
