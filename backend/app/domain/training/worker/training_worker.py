import threading
import time

from app.common.config.database import SessionLocal
from app.domain.training.repository.training_job_repository import TrainingJobRepository
from app.domain.training.runner.training_runner import TrainingRunner


class TrainingWorker:
    def __init__(self):
        self.job_repo = TrainingJobRepository()
        self.runner = TrainingRunner()
        self._thread: threading.Thread | None = None
        self._stop_event = threading.Event()

    def start(self) -> None:
        self._thread = threading.Thread(target=self._loop, daemon=True)
        self._thread.start()

    def stop(self) -> None:
        self._stop_event.set()

    def _loop(self) -> None:
        while not self._stop_event.is_set():
            try:
                self._tick()
            except Exception:
                pass
            time.sleep(3)

    def _tick(self) -> None:
        db = SessionLocal()
        try:
            running = self.job_repo.find_current_running(db)
            if running is not None:
                return

            next_job = self.job_repo.find_next_queued(db)
            if next_job is None:
                return

            job_id = next_job.id
        finally:
            db.close()

        self.runner.run(job_id)


worker = TrainingWorker()
