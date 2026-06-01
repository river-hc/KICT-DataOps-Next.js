from enum import Enum

from sqlalchemy import Column, DateTime, Integer, JSON, String, Text
from sqlalchemy.sql import func

from app.common.config.database import Base


class JobStatus(str, Enum):
    QUEUED = "QUEUED"
    RUNNING = "RUNNING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    CANCELED = "CANCELED"


class TrainingMode(str, Enum):
    SINGLE = "single"
    MULTI = "multi"


class TrainingJob(Base):
    __tablename__ = "training_jobs"

    id = Column(Integer, primary_key=True, index=True)
    experiment_id = Column(Integer, nullable=True)
    run_id = Column(Integer, nullable=True)
    user_name = Column(String(100), nullable=False)
    experiment_name = Column(String(200), nullable=False)
    mode = Column(String(20), nullable=False)
    status = Column(String(20), nullable=False, default=JobStatus.QUEUED)
    parameters = Column(JSON, nullable=True)
    output_dir = Column(String(500), nullable=True)
    config_path = Column(String(500), nullable=True)
    log_path = Column(String(500), nullable=True)
    result_path = Column(String(500), nullable=True)
    process_id = Column(Integer, nullable=True)
    current_epoch = Column(Integer, nullable=True)
    total_epochs = Column(Integer, nullable=True)
    progress = Column(Integer, nullable=True, default=0)
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    started_at = Column(DateTime, nullable=True)
    finished_at = Column(DateTime, nullable=True)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
