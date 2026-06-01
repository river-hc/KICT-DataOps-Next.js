from enum import Enum

from sqlalchemy import Column, DateTime, ForeignKey, Integer, JSON, String
from sqlalchemy.sql import func

from app.common.config.database import Base


class ModelVersionStatus(str, Enum):
    CREATED = "CREATED"
    SELECTED = "SELECTED"
    ARCHIVED = "ARCHIVED"


class ModelVersion(Base):
    __tablename__ = "model_versions"

    id = Column(Integer, primary_key=True, index=True)
    experiment_id = Column(Integer, ForeignKey("experiments.id"), nullable=True)
    run_id = Column(Integer, ForeignKey("experiment_runs.id"), nullable=True)
    version = Column(String(50), nullable=True)
    model_name = Column(String(200), nullable=True)
    model_path = Column(String(500), nullable=True)
    status = Column(String(20), nullable=False, default=ModelVersionStatus.CREATED)
    metrics = Column(JSON, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
