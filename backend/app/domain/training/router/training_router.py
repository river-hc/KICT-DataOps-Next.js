from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.common.config.database import get_db
from app.domain.training.dto.training_request import TrainingCreateRequest
from app.domain.training.dto.training_response import (
    TrainingCreateResponse,
    TrainingLogResponse,
    TrainingResultResponse,
    TrainingSummaryResponse,
)
from app.domain.training.service.training_service import TrainingService

router = APIRouter(prefix="/api/v1/trainings", tags=["trainings"])
service = TrainingService()


@router.post("", response_model=TrainingCreateResponse)
def create_training(request: TrainingCreateRequest, db: Session = Depends(get_db)):
    """
    학습 작업을 대기열(QUEUED)에 등록합니다.

    - **mode**: `single` → single.py 실행 / `multi` → multi.py 실행
    - **parameters**: epochs, learning_rate, batch_size 등 학습 하이퍼파라미터
    - **output_dir**: 결과 파일 저장 경로 (생략 시 `runs/job_{id}/outputs/` 자동 생성)

    등록 즉시 응답하며, 실제 실행은 worker가 순서대로 처리합니다.
    동시에 1개 job만 실행되고 나머지는 QUEUED 상태로 대기합니다.
    """
    return service.create_training_job(db, request)


@router.get("", response_model=list[TrainingSummaryResponse])
def get_trainings(db: Session = Depends(get_db)):
    """
    전체 학습 작업 목록을 반환합니다. (최신순, 최대 100건)

    작업 현황 화면에서 폴링(1~2초 간격)으로 사용합니다.
    """
    return service.get_training_jobs(db)


@router.get("/{job_id}", response_model=TrainingSummaryResponse)
def get_training(job_id: int, db: Session = Depends(get_db)):
    """
    특정 학습 작업의 상태와 진행률을 반환합니다.

    - **status**: QUEUED / RUNNING / COMPLETED / FAILED / CANCELED
    - **progress**: 0~100 (epoch 기준)
    - **current_epoch** / **total_epochs**: 진행 중인 epoch 정보
    """
    return service.get_training_job(db, job_id)


@router.get("/{job_id}/logs", response_model=TrainingLogResponse)
def get_logs(job_id: int, db: Session = Depends(get_db)):
    """
    학습 stdout 로그를 반환합니다. (최대 300줄)

    RUNNING 중에도 실시간에 가깝게 조회 가능합니다.
    1~2초 간격으로 폴링해서 터미널처럼 출력하면 됩니다.
    """
    return service.get_training_logs(db, job_id)


@router.get("/{job_id}/result", response_model=TrainingResultResponse)
def get_result(job_id: int, db: Session = Depends(get_db)):
    """
    학습 완료 후 결과를 반환합니다.

    - **params**: 실행에 사용된 하이퍼파라미터
    - **metrics**: loss, accuracy, rmse 등 학습 지표
    - **artifacts**: 생성된 결과 파일 목록 (모델, 예측값, 그래프 등)

    status가 COMPLETED일 때 호출하세요. RUNNING 중에도 호출은 되나 metrics/artifacts는 비어 있습니다.
    """
    return service.get_training_result(db, job_id)
