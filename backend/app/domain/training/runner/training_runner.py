import json
import os
import re
import subprocess
from datetime import datetime
from pathlib import Path

from sqlalchemy.orm import Session

from app.common.config.database import SessionLocal
from app.common.config.settings import settings
from app.domain.artifact.entity.run_artifact import RunArtifact
from app.domain.artifact.repository.artifact_repository import ArtifactRepository
from app.domain.experiment.entity.experiment import ExperimentRun
from app.domain.experiment.repository.experiment_repository import ExperimentRepository, ExperimentRunRepository
from app.domain.model_registry.entity.model_version import ModelVersion
from app.domain.model_registry.repository.model_version_repository import ModelVersionRepository
from app.domain.training.entity.training_job import JobStatus, TrainingJob
from app.domain.training.repository.training_job_repository import TrainingJobRepository


class TrainingRunner:
    def __init__(self):
        self.job_repo = TrainingJobRepository()
        self.experiment_repo = ExperimentRepository()
        self.run_repo = ExperimentRunRepository()
        self.artifact_repo = ArtifactRepository()
        self.model_version_repo = ModelVersionRepository()

    def run(self, job_id: int) -> None:
        db = SessionLocal()
        try:
            job = self.job_repo.find_by_id(db, job_id)
            if job is None:
                return
            self._execute(db, job)
        finally:
            db.close()

    def _execute(self, db: Session, job: TrainingJob) -> None:
        job_dir = Path(settings.runs_dir) / f"job_{job.id}"
        job_dir.mkdir(parents=True, exist_ok=True)

        config_path = job_dir / "config.json"
        log_path = job_dir / "train.log"
        result_path = job_dir / "result.json"
        output_dir = Path(job.output_dir) if job.output_dir else job_dir / "outputs"
        output_dir.mkdir(parents=True, exist_ok=True)

        config = {
            "job_id": job.id,
            "mode": job.mode,
            "experiment_name": job.experiment_name,
            "parameters": job.parameters or {},
            "output_dir": str(output_dir),
            "result_path": str(result_path),
        }
        config_path.write_text(json.dumps(config, indent=2, ensure_ascii=False), encoding="utf-8")

        job.status = JobStatus.RUNNING
        job.started_at = datetime.now()
        job.config_path = str(config_path)
        job.log_path = str(log_path)
        job.result_path = str(result_path)
        db.commit()

        script = "single.py" if job.mode == "single" else "multi.py"
        trainer_path = Path(settings.trainer_dir) / script
        cmd = ["python", str(trainer_path), "--config-path", str(config_path)]

        try:
            process = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                encoding="utf-8",
                errors="replace",
            )
            job.process_id = process.pid
            db.commit()

            with log_path.open("w", encoding="utf-8") as log_file:
                for line in process.stdout:
                    log_file.write(line)
                    log_file.flush()
                    self._parse_progress(db, job, line.strip())

            process.wait()
            finished_at = datetime.now()

            if process.returncode == 0:
                self._save_results(db, job, result_path)
                job.status = JobStatus.COMPLETED
            else:
                job.status = JobStatus.FAILED
                job.error_message = f"Process exited with code {process.returncode}"

        except Exception as e:
            job.status = JobStatus.FAILED
            job.error_message = str(e)
            finished_at = datetime.now()

        job.finished_at = finished_at
        job.progress = 100 if job.status == JobStatus.COMPLETED else job.progress
        db.commit()

    def _parse_progress(self, db: Session, job: TrainingJob, line: str) -> None:
        # e.g. "[INFO] Epoch 3/10 - loss=0.398"
        match = re.search(r"Epoch\s+(\d+)/(\d+)", line)
        if match:
            current = int(match.group(1))
            total = int(match.group(2))
            job.current_epoch = current
            job.total_epochs = total
            job.progress = int(current / total * 100)
            db.commit()

    def _save_results(self, db: Session, job: TrainingJob, result_path: Path) -> None:
        if not result_path.exists():
            return

        result_data = json.loads(result_path.read_text(encoding="utf-8"))

        experiment = self.experiment_repo.find_or_create(db, job.experiment_name)
        job.experiment_id = experiment.id

        started_at = job.started_at
        finished_at = job.finished_at or datetime.now()
        duration = int((finished_at - started_at).total_seconds()) if started_at else None

        run = ExperimentRun(
            experiment_id=experiment.id,
            job_id=job.id,
            run_name=result_data.get("run_name", job.experiment_name),
            version=result_data.get("version"),
            mode=job.mode,
            status=result_data.get("status", "COMPLETED"),
            parameters=job.parameters,
            metrics=result_data.get("metrics", {}),
            created_by=job.user_name,
            started_at=started_at,
            finished_at=finished_at,
            duration_seconds=duration,
        )
        saved_run = self.run_repo.save(db, run)
        job.run_id = saved_run.id
        db.commit()

        artifacts_data = result_data.get("artifacts", [])
        artifacts = []
        for a in artifacts_data:
            file_path = a.get("path", "")
            file_size = None
            if file_path and os.path.exists(file_path):
                file_size = os.path.getsize(file_path)
            artifacts.append(
                RunArtifact(
                    run_id=saved_run.id,
                    artifact_type=a.get("type"),
                    file_name=a.get("name"),
                    file_path=file_path,
                    file_size=file_size,
                )
            )
        if artifacts:
            self.artifact_repo.save_all(db, artifacts)

        metrics = result_data.get("metrics", {})
        model_artifact = next((a for a in artifacts_data if a.get("type") == "model"), None)
        if model_artifact:
            model_version = ModelVersion(
                experiment_id=experiment.id,
                run_id=saved_run.id,
                version=result_data.get("version"),
                model_name=model_artifact.get("name"),
                model_path=model_artifact.get("path"),
                metrics=metrics,
            )
            self.model_version_repo.save(db, model_version)
