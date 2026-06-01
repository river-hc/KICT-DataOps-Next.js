from fastapi import FastAPI

from app.domain.artifact.router.artifact_router import router as artifact_router
from app.domain.experiment.router.experiment_router import router as experiment_router
from app.domain.experiment.router.experiment_router import run_router
from app.domain.model_registry.router.model_version_router import router as model_router
from app.domain.system.router.system_router import router as system_router
from app.domain.training.router.training_router import router as training_router


def include_routers(app: FastAPI) -> None:
    app.include_router(training_router)
    app.include_router(experiment_router)
    app.include_router(run_router)
    app.include_router(artifact_router)
    app.include_router(model_router)
    app.include_router(system_router)
