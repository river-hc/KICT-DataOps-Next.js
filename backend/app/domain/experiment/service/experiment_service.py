from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.domain.experiment.dto.experiment_response import ExperimentResponse, ExperimentRunResponse
from app.domain.experiment.repository.experiment_repository import ExperimentRepository, ExperimentRunRepository


class ExperimentService:
    def __init__(self):
        self.experiment_repo = ExperimentRepository()
        self.run_repo = ExperimentRunRepository()

    def get_experiments(self, db: Session) -> list[ExperimentResponse]:
        experiments = self.experiment_repo.find_all(db)
        return [ExperimentResponse.model_validate(e) for e in experiments]

    def get_experiment(self, db: Session, experiment_id: int) -> ExperimentResponse:
        experiment = self.experiment_repo.find_by_id(db, experiment_id)
        if experiment is None:
            raise HTTPException(status_code=404, detail="Experiment not found")
        return ExperimentResponse.model_validate(experiment)

    def get_runs(self, db: Session, experiment_id: int) -> list[ExperimentRunResponse]:
        self.get_experiment(db, experiment_id)
        runs = self.run_repo.find_by_experiment(db, experiment_id)
        return [ExperimentRunResponse.model_validate(r) for r in runs]

    def get_run(self, db: Session, run_id: int) -> ExperimentRunResponse:
        run = self.run_repo.find_by_id(db, run_id)
        if run is None:
            raise HTTPException(status_code=404, detail="Run not found")
        return ExperimentRunResponse.model_validate(run)
