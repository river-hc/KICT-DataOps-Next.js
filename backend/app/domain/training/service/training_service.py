import json
from pathlib import Path

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.domain.training.dto.training_request import TrainingCreateRequest
from app.domain.training.dto.training_response import (
    TrainingCreateResponse,
    TrainingLogResponse,
    TrainingResultResponse,
    TrainingSummaryResponse,
)
from app.domain.training.entity.training_job import JobStatus, TrainingJob
from app.domain.training.repository.training_job_repository import TrainingJobRepository


class TrainingService:
    def __init__(self):
        self.training_job_repository = TrainingJobRepository()

    def create_training_job(
        self,
        db: Session,
        request: TrainingCreateRequest,
    ) -> TrainingCreateResponse:
        job = TrainingJob(
            user_name=request.user_name,
            experiment_name=request.experiment_name,
            mode=request.mode,
            status=JobStatus.QUEUED,
            parameters=request.parameters,
            output_dir=request.output_dir,
            total_epochs=request.parameters.get("epochs"),
            progress=0,
        )

        saved_job = self.training_job_repository.save(db, job)
        queue_position = self.get_queue_position(db, saved_job.id)

        return TrainingCreateResponse(
            job_id=saved_job.id,
            status=saved_job.status,
            queue_position=queue_position,
            message="학습 작업이 대기열에 등록되었습니다.",
        )

    def get_queue_position(self, db: Session, job_id: int) -> int:
        queued_jobs = self.training_job_repository.find_queued_jobs(db)

        for index, job in enumerate(queued_jobs, start=1):
            if job.id == job_id:
                return index

        return 0

    def get_training_job(self, db: Session, job_id: int) -> TrainingSummaryResponse:
        job = self.training_job_repository.find_by_id(db, job_id)

        if job is None:
            raise HTTPException(status_code=404, detail="Training job not found")

        return self.to_summary_response(job)

    def get_training_jobs(self, db: Session) -> list[TrainingSummaryResponse]:
        jobs = self.training_job_repository.find_all(db)

        return [self.to_summary_response(job) for job in jobs]

    def get_training_logs(self, db: Session, job_id: int) -> TrainingLogResponse:
        job = self.training_job_repository.find_by_id(db, job_id)

        if job is None:
            raise HTTPException(status_code=404, detail="Training job not found")

        if not job.log_path:
            return TrainingLogResponse(job_id=job_id, logs=[])

        log_file = Path(job.log_path)

        if not log_file.exists():
            return TrainingLogResponse(job_id=job_id, logs=[])

        lines = log_file.read_text(encoding="utf-8", errors="ignore").splitlines()

        return TrainingLogResponse(
            job_id=job_id,
            logs=lines[-300:],
        )

    def get_training_result(self, db: Session, job_id: int) -> TrainingResultResponse:
        job = self.training_job_repository.find_by_id(db, job_id)

        if job is None:
            raise HTTPException(status_code=404, detail="Training job not found")

        result_data = {}

        if job.result_path and Path(job.result_path).exists():
            result_data = json.loads(Path(job.result_path).read_text(encoding="utf-8"))

        return TrainingResultResponse(
            job_id=job.id,
            run_id=job.run_id,
            status=job.status,
            params=job.parameters or {},
            metrics=result_data.get("metrics", {}),
            artifacts=result_data.get("artifacts", []),
        )

    def to_summary_response(self, job: TrainingJob) -> TrainingSummaryResponse:
        return TrainingSummaryResponse(
            job_id=job.id,
            user_name=job.user_name,
            experiment_name=job.experiment_name,
            mode=job.mode,
            status=job.status,
            progress=job.progress,
            current_epoch=job.current_epoch,
            total_epochs=job.total_epochs,
            run_id=job.run_id,
            created_at=job.created_at,
            started_at=job.started_at,
            finished_at=job.finished_at,
        )
    