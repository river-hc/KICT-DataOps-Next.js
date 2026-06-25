# KICT DataOps

KICT DataOps는 강우 예측 모델의 등록, 실험 실행, 결과 조회, 아티팩트 관리를 위한 웹 기반 DataOps 프로토타입입니다.

현재 프론트엔드는 **완성된 모델 파일을 모델 레지스트리에 등록**하고, 등록된 모델 버전으로 **ASC 입력 데이터를 이용한 강우 실험 실행**을 수행하는 흐름을 기준으로 구성되어 있습니다.

## 주요 기능

- 대시보드
  - 당일 실행 현황 도넛 차트
  - 상태별 실행 목록
  - 최신 실행 결과 요약
- 실험 관리
  - `실험 > 실행 > 실행 결과` 3-depth 구조
  - ASC 입력 폴더 선택
  - 모델 버전 선택 후 새 실행 생성
  - 완료 실행의 MAE, RMSE, CSI 결과 확인
  - 실패 실행의 로그 확인
- 모델 레지스트리
  - 완료된 모델 파일 등록
  - `KICT-RAIN-AI` 모델 버전 목록 표시
  - `single` / `multi` 모델 파일 구성 지원
- 아티팩트
  - 실행 결과 파일 메타데이터 조회
  - ASC 결과 파일 접근
- 시스템 리소스
  - GPU 상태 조회
  - 1초 주기 리소스 갱신
- 프로필
  - 닉네임 표시 및 변경
  - 기본 로그인 계정: `KICT_001` / `Kkict001`

## 기술 스택

| 영역 | 기술 |
|---|---|
| Frontend | Next.js 14, React 18, TypeScript, Tailwind CSS |
| Backend | FastAPI, SQLAlchemy |
| Database | PostgreSQL |
| Runtime | Docker, Docker Compose |

## 프로젝트 구조

```text
.
├── frontend/                     # Next.js 프론트엔드
│   ├── app/                      # App Router 페이지/API 라우트
│   ├── lib/                      # 공통 컴포넌트, API 클라이언트, 로컬 보조 저장소
│   └── styles/                   # 전역 스타일
├── backend/                      # FastAPI 백엔드
├── docs/                         # 보조 문서
├── BACKEND_API_LIST_DESIGN.md    # 백엔드 API 변경 요청 요약
├── BACKEND_INPUT_PARAMS_REQUEST.jsonc # 백엔드 입력/응답 파라미터 요청서
├── docker-compose.yml            # 통합 실행용 compose
├── docker-compose.dev.yml        # 프론트 테마별 개발 실행 compose
└── start.sh                      # Docker 통합 실행 스크립트
```

## 사전 준비

- Node.js 18+
- npm
- Python 3.11+
- Docker / Docker Compose
- PostgreSQL 또는 Docker PostgreSQL

## 프론트엔드 로컬 실행

백엔드 서버가 먼저 실행 중이어야 합니다.

```bash
cd frontend
npm install
npm run dev
```

기본 개발 서버:

```text
http://localhost:3003
```

외부 PC에서 같은 네트워크로 접속해야 하는 경우 `npm run dev`는 `0.0.0.0`에 바인딩됩니다.

예시:

```text
http://<개발 PC IP>:3003
```

## 프론트엔드 환경 변수

`frontend/.env.local`에서 백엔드 연결 주소를 설정합니다.

```env
BACKEND_URL=http://localhost:8000
NEXT_PUBLIC_DEMO_MODE=true
DATASET_BROWSE_ROOTS=/data,/mnt,/home/namjun
```

원격 백엔드 개발 서버를 사용할 경우:

```env
BACKEND_URL=http://192.168.1.196:8000
```

프론트의 `/api/:path*` 요청은 `frontend/next.config.js`의 rewrite 설정을 통해 `BACKEND_URL`로 전달됩니다.

### 프론트 단독 시연 모드

백엔드 없이 고객 시연을 진행할 때는 아래 값을 켭니다.

```env
NEXT_PUBLIC_DEMO_MODE=true
```

데모 모드에서는 프론트 API 클라이언트가 백엔드 요청 대신 내장 데모 데이터를 반환합니다.

- 기본 실험: `2026 summer`
- 기본 실행: 완료/실패/실행 중 샘플 데이터
- 모델 버전: `KICT-RAIN-AI Ver.1~3`
- 결과 지표: MAE, RMSE, CSI 샘플 값
- ASC 결과: 브라우저에서 바로 렌더링 가능한 데모 ASC 데이터
- 실패 실행: 로그 전용 결과 화면

실제 백엔드 연동 시에는 다음처럼 끄면 됩니다.

```env
NEXT_PUBLIC_DEMO_MODE=false
```

## 백엔드 로컬 실행

```bash
cd backend/backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
python create_tables.py
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

접속 정보:

```text
Backend API: http://localhost:8000
Swagger UI:  http://localhost:8000/docs
```

## Docker 통합 실행

```bash
./start.sh
```

또는:

```bash
docker compose up -d
```

접속 정보:

```text
Frontend:   http://localhost:3000
Backend:    http://localhost:8000
Swagger UI: http://localhost:8000/docs
```

로그 확인:

```bash
docker compose logs -f
```

중지:

```bash
docker compose down
```

## 개발용 프론트 테마 실행

`docker-compose.dev.yml`은 프론트엔드 테마 비교용 서비스입니다.

```bash
docker compose -f docker-compose.dev.yml up -d
```

| 서비스 | URL | 테마 |
|---|---|---|
| frontend-a | http://localhost:3000 | default |
| frontend-b | http://localhost:3001 | dark |
| frontend-c | http://localhost:3002 | modern |

## 현재 백엔드 API 연동 기준

프론트엔드는 현재 아래 API를 중심으로 동작합니다.

| Method | Path | 용도 |
|---|---|---|
| GET | `/api/v1/trainings` | 실행 목록 조회 |
| POST | `/api/v1/trainings` | 새 실행 생성 |
| GET | `/api/v1/trainings/{job_id}` | 실행 단건 조회 |
| GET | `/api/v1/trainings/{job_id}/logs` | 실행 로그 조회 |
| GET | `/api/v1/trainings/{job_id}/result` | 실행 결과 조회 |
| GET | `/api/v1/trainings/{job_id}/files/{filename}` | ASC 결과 파일 조회 |
| GET | `/api/v1/experiments` | 실험 목록 조회 |
| GET | `/api/v1/experiments/{experiment_id}` | 실험 단건 조회 |
| GET | `/api/v1/experiments/{experiment_id}/runs` | 실험별 run 조회 |
| GET | `/api/v1/runs/{run_id}/artifacts` | 아티팩트 목록 조회 |
| GET | `/api/v1/models` | 모델 버전 목록 조회 |
| GET | `/api/v1/system/gpu` | GPU 리소스 조회 |

백엔드 담당자에게 요청할 추가/수정 API는 아래 문서에 정리되어 있습니다.

- [BACKEND_API_LIST_DESIGN.md](./BACKEND_API_LIST_DESIGN.md)
- [BACKEND_INPUT_PARAMS_REQUEST.jsonc](./BACKEND_INPUT_PARAMS_REQUEST.jsonc)

## 데이터/모델 경로 기준

현재 프론트 흐름은 다음 경로 정책을 전제로 합니다.

- 비교 검증 데이터셋 기본 경로: `/data/observations/default`
- 결과 지표: 백엔드에서 MAE, RMSE, CSI 계산 후 API 응답으로 제공
- ASC 결과 파일: `asc_urls`에 포함된 URL로 조회
- 모델 레지스트리: 완료된 `.tflite`, `.h5`, `.keras`, `.pb`, `.onnx` 파일 등록

## 주요 화면 명칭

| 화면 | 설명 |
|---|---|
| 대시보드 | 당일 실행 현황과 최신 결과 확인 |
| 실험 | 상위 실험 목록 |
| 실행 | 특정 실험의 하위 실행 목록 |
| 실행 결과 | 실행 상세 결과 또는 실패 로그 확인 |
| 모델 레지스트리 | 완료 모델 파일 버전 목록과 등록 |
| 아티팩트 | 실행 결과 파일 목록 |
| 시스템 리소스 | GPU/시스템 상태 |

## 검증 명령

프론트 타입 체크:

```bash
cd frontend
npx tsc --noEmit
```

프론트 프로덕션 빌드:

```bash
cd frontend
npm run build
```

## 참고 사항

- 현재 일부 실험-실행 매핑과 모델 등록 보조 정보는 프론트 localStorage로 보완됩니다.
- 백엔드 API가 `experiment_id`, `model_version_id`, 모델 등록 API 등을 완성하면 해당 보조 저장소 의존도를 줄일 수 있습니다.
- 실패한 실행의 결과 상세 화면은 로그만 표시하도록 구성되어 있습니다.
- 완료된 실행은 ASC 뷰어, 성능 지표, 검증 데이터 매칭 정보, 실행 일정, 메모를 표시합니다.
