from sqlalchemy.orm import Session

from app.domain.training.entity.training_job import JobStatus, TrainingJob


class TrainingJobRepository:
    def save(self, db: Session, job: TrainingJob) -> TrainingJob:
        db.add(job)
        db.commit()
        db.refresh(job)

        return job

    def find_by_id(self, db: Session, job_id: int) -> TrainingJob | None:
        return db.query(TrainingJob).filter(TrainingJob.id == job_id).first()

    def find_all(self, db: Session, limit: int = 100) -> list[TrainingJob]:
        return (
            db.query(TrainingJob)
            .order_by(TrainingJob.created_at.desc())
            .limit(limit)
            .all()
        )

    def find_current_running(self, db: Session) -> TrainingJob | None:
        return (
            db.query(TrainingJob)
            .filter(TrainingJob.status == JobStatus.RUNNING)
            .order_by(TrainingJob.started_at.asc())
            .first()
        )

    def find_next_queued(self, db: Session) -> TrainingJob | None:
        return (
            db.query(TrainingJob)
            .filter(TrainingJob.status == JobStatus.QUEUED)
            .order_by(TrainingJob.created_at.asc())
            .first()
        )

    def find_queued_jobs(self, db: Session) -> list[TrainingJob]:
        return (
            db.query(TrainingJob)
            .filter(TrainingJob.status == JobStatus.QUEUED)
            .order_by(TrainingJob.created_at.asc())
            .all()
        )