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
    return service.create_training_job(db, request)


@router.get("", response_model=list[TrainingSummaryResponse])
def get_trainings(db: Session = Depends(get_db)):
    return service.get_training_jobs(db)


@router.get("/{job_id}", response_model=TrainingSummaryResponse)
def get_training(job_id: int, db: Session = Depends(get_db)):
    return service.get_training_job(db, job_id)


@router.get("/{job_id}/logs", response_model=TrainingLogResponse)
def get_logs(job_id: int, db: Session = Depends(get_db)):
    return service.get_training_logs(db, job_id)


@router.get("/{job_id}/result", response_model=TrainingResultResponse)
def get_result(job_id: int, db: Session = Depends(get_db)):
    return service.get_training_result(db, job_id)
