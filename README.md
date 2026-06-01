# KICT DataOps

AI 모델 학습 실행 및 결과 형상관리 플랫폼

- **Backend**: Python / FastAPI / SQLAlchemy
- **DB**: PostgreSQL (Docker)
- **Frontend**: Next.js (별도 담당자)

---

## 사전 준비

- Python 3.11+
- Docker & Docker Compose
- Node.js 18+ (프론트엔드 담당자)

---

## 실행 방법

### 1. PostgreSQL 시작

```bash
cd ~/apps/kict-dataops
docker compose up -d
```

### 2. 백엔드 실행

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# .env 파일 생성 (최초 1회)
cp .env.example .env
# DATABASE_URL 등 설정값 확인 후 수정

# 테이블 생성 (최초 1회 또는 스키마 변경 시)
python create_tables.py

# 서버 실행
uvicorn app.main:app --reload
```

백엔드 서버: http://localhost:8000  
Swagger UI: http://localhost:8000/docs

### 3. 프론트엔드 실행

> 백엔드가 먼저 실행 중이어야 합니다.

```bash
cd frontend
npm install
npm run dev
```

프론트엔드: http://localhost:3000

---

## 주요 API

| Method | URL | 설명 |
|--------|-----|------|
| POST | `/api/v1/trainings` | 학습 실행 요청 |
| GET | `/api/v1/trainings` | 작업 목록 |
| GET | `/api/v1/trainings/{job_id}` | 작업 상세 |
| GET | `/api/v1/trainings/{job_id}/logs` | 학습 로그 |
| GET | `/api/v1/trainings/{job_id}/result` | 학습 결과 |
| GET | `/api/v1/experiments` | 실험 목록 |
| GET | `/api/v1/experiments/{id}/runs` | 실험별 run 목록 |
| GET | `/api/v1/runs/{run_id}/artifacts` | 결과 파일 목록 |
| GET | `/api/v1/models` | 모델 버전 목록 |
| GET | `/api/v1/system/gpu` | GPU 상태 |

전체 API 명세는 Swagger UI 참고.

---

## 학습 실행 요청 예시

```json
POST /api/v1/trainings
{
  "user_name": "홍길동",
  "experiment_name": "my-experiment-v1",
  "mode": "single",
  "parameters": {
    "epochs": 10,
    "learning_rate": 0.001,
    "batch_size": 32
  },
  "output_dir": "/home/user/outputs"  // 생략 시 runs/job_{id}/outputs/ 자동 생성
}
```

---

## 프론트엔드 담당자 참고

- `/frontend` 폴더는 비어 있습니다. Next.js 프로젝트를 여기에 세팅하면 됩니다.
- API 프록시 설정: `next.config.js`에서 `/api/*` → `http://localhost:8000/api/*` 로 rewrite 필요
- 작업 상태는 2초 polling으로 조회하면 됩니다.
- 상세 API 명세는 백엔드 Swagger UI (http://localhost:8000/docs) 참고
