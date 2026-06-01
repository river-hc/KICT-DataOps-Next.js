from app.common.config.database import Base, engine

# import all entities so Base.metadata is populated
from app.domain.artifact.entity.run_artifact import RunArtifact  # noqa: F401
from app.domain.experiment.entity.experiment import Experiment, ExperimentRun  # noqa: F401
from app.domain.model_registry.entity.model_version import ModelVersion  # noqa: F401
from app.domain.training.entity.training_job import TrainingJob  # noqa: F401

if __name__ == "__main__":
    Base.metadata.create_all(bind=engine)
    print("All tables created.")
