from sqlalchemy.orm import Session

from app.domain.experiment.entity.experiment import Experiment, ExperimentRun


class ExperimentRepository:
    def find_or_create(self, db: Session, name: str) -> Experiment:
        experiment = db.query(Experiment).filter(Experiment.name == name).first()
        if experiment is None:
            experiment = Experiment(name=name)
            db.add(experiment)
            db.commit()
            db.refresh(experiment)
        return experiment

    def find_by_id(self, db: Session, experiment_id: int) -> Experiment | None:
        return db.query(Experiment).filter(Experiment.id == experiment_id).first()

    def find_all(self, db: Session) -> list[Experiment]:
        return db.query(Experiment).order_by(Experiment.created_at.desc()).all()


class ExperimentRunRepository:
    def save(self, db: Session, run: ExperimentRun) -> ExperimentRun:
        db.add(run)
        db.commit()
        db.refresh(run)
        return run

    def find_by_id(self, db: Session, run_id: int) -> ExperimentRun | None:
        return db.query(ExperimentRun).filter(ExperimentRun.id == run_id).first()

    def find_by_experiment(self, db: Session, experiment_id: int) -> list[ExperimentRun]:
        return (
            db.query(ExperimentRun)
            .filter(ExperimentRun.experiment_id == experiment_id)
            .order_by(ExperimentRun.created_at.desc())
            .all()
        )

    def find_by_job_id(self, db: Session, job_id: int) -> ExperimentRun | None:
        return db.query(ExperimentRun).filter(ExperimentRun.job_id == job_id).first()
