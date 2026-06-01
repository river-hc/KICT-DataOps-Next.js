from sqlalchemy import Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.sql import func

from app.common.config.database import Base


class RunArtifact(Base):
    __tablename__ = "run_artifacts"

    id = Column(Integer, primary_key=True, index=True)
    run_id = Column(Integer, ForeignKey("experiment_runs.id"), nullable=False)
    artifact_type = Column(String(50), nullable=True)
    file_name = Column(String(200), nullable=True)
    file_path = Column(String(500), nullable=True)
    file_size = Column(Integer, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
