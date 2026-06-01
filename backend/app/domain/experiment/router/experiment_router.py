from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.common.config.database import get_db
from app.domain.experiment.dto.experiment_response import ExperimentResponse, ExperimentRunResponse
from app.domain.experiment.service.experiment_service import ExperimentService

router = APIRouter(prefix="/api/v1/experiments", tags=["experiments"])
service = ExperimentService()


@router.get("", response_model=list[ExperimentResponse])
def get_experiments(db: Session = Depends(get_db)):
    """
    실험 목록을 반환합니다.

    experiment_name이 같은 학습 작업들은 하나의 실험으로 묶입니다.
    실험 관리 화면의 목록에 사용합니다.
    """
    return service.get_experiments(db)


@router.get("/{experiment_id}", response_model=ExperimentResponse)
def get_experiment(experiment_id: int, db: Session = Depends(get_db)):
    """
    특정 실험의 상세 정보를 반환합니다.
    """
    return service.get_experiment(db, experiment_id)


@router.get("/{experiment_id}/runs", response_model=list[ExperimentRunResponse])
def get_runs(experiment_id: int, db: Session = Depends(get_db)):
    """
    특정 실험에 속한 run 목록을 반환합니다.

    run 1개 = 학습 1회 실행 결과입니다.
    metrics, parameters를 run 간 비교하는 용도로 사용합니다.
    """
    return service.get_runs(db, experiment_id)


run_router = APIRouter(prefix="/api/v1/runs", tags=["runs"])
run_service = ExperimentService()


@run_router.get("/{run_id}", response_model=ExperimentRunResponse)
def get_run(run_id: int, db: Session = Depends(get_db)):
    """
    특정 run의 상세 정보를 반환합니다.

    metrics, parameters, 실행 시간 등 1회 학습 결과 전체를 포함합니다.
    """
    return run_service.get_run(db, run_id)
