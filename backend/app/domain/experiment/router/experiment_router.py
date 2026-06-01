from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.common.config.database import get_db
from app.domain.experiment.dto.experiment_response import ExperimentResponse, ExperimentRunResponse
from app.domain.experiment.service.experiment_service import ExperimentService

router = APIRouter(prefix="/api/v1/experiments", tags=["experiments"])
service = ExperimentService()


@router.get("", response_model=list[ExperimentResponse])
def get_experiments(db: Session = Depends(get_db)):
    return service.get_experiments(db)


@router.get("/{experiment_id}", response_model=ExperimentResponse)
def get_experiment(experiment_id: int, db: Session = Depends(get_db)):
    return service.get_experiment(db, experiment_id)


@router.get("/{experiment_id}/runs", response_model=list[ExperimentRunResponse])
def get_runs(experiment_id: int, db: Session = Depends(get_db)):
    return service.get_runs(db, experiment_id)


run_router = APIRouter(prefix="/api/v1/runs", tags=["runs"])
run_service = ExperimentService()


@run_router.get("/{run_id}", response_model=ExperimentRunResponse)
def get_run(run_id: int, db: Session = Depends(get_db)):
    return run_service.get_run(db, run_id)
