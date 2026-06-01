from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.common.config.settings import settings
from app.domain.training.worker.training_worker import worker
from app.router import include_routers


@asynccontextmanager
async def lifespan(app: FastAPI):
    worker.start()
    yield
    worker.stop()


description = """
AI 모델 학습 실행 및 결과 형상관리 플랫폼 백엔드 API입니다.

## 구조

- **trainings** : 학습 작업 실행 및 상태 관리. 학습 요청 → 큐 등록 → 순차 실행
- **experiments** : 실험 단위 관리. 같은 experiment_name끼리 묶임
- **runs** : 학습 1회 실행 결과. metrics / parameters 포함
- **artifacts** : 학습 결과 파일 메타 정보 (model.pt, predict.csv, loss_plot.png 등)
- **models** : 모델 버전 관리. SELECTED(대표 모델) / ARCHIVED(보관) 상태 관리
- **system** : 서버 GPU 상태 조회

## 실행 흐름

```
POST /trainings → QUEUED 등록
→ worker(백그라운드)가 순서대로 single.py / multi.py 실행
→ 완료 후 result.json 읽어서 runs / artifacts / models DB 저장
→ 프론트가 폴링으로 상태 조회
```
"""

app = FastAPI(
    title=settings.app_name,
    version="1.0.0",
    description=description,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

include_routers(app)


@app.get("/health")
def health():
    return {"status": "ok"}
