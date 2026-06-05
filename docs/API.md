# KICT DataOps Training Platform — API 명세

> **Base URL** `http://localhost:8000` (개발) / `/api/v1` (프론트 프록시 경유)  
> **Swagger UI** `http://localhost:8000/docs`  
> **OpenAPI JSON** `http://localhost:8000/openapi.json`

---

## 시스템 개요

AI 모델 학습 실행 및 결과 형상관리 플랫폼 백엔드 API입니다.

| 도메인 | 설명 |
|---|---|
| **trainings** | 학습 작업 실행 및 상태 관리. 요청 → 큐 등록 → 순차 실행 |
| **experiments** | 실험 단위 관리. 동일 `experiment_name`끼리 그룹 |
| **runs** | 학습 1회 실행 결과. metrics / parameters 포함 |
| **artifacts** | 학습 결과 파일 메타 정보 (model.pt, predict.csv, loss_plot.png 등) |
| **models** | 모델 버전 관리. SELECTED(대표) / ARCHIVED(보관) 상태 |
| **system** | 서버 GPU 상태 조회 |

### 실행 흐름

```
POST /api/v1/trainings
  → 즉시 응답 (job_id, queue_position)
  → worker가 순서대로 single.py / multi.py 실행
  → 완료 후 result.json → runs / artifacts / models DB 저장
  → 프론트가 2초 간격 폴링으로 상태 조회
```

---

## 상태값 (Enum)

### JobStatus

| 값 | 설명 |
|---|---|
| `QUEUED` | 대기 중 |
| `RUNNING` | 실행 중 |
| `COMPLETED` | 완료 |
| `FAILED` | 실패 |
| `CANCELED` | 취소됨 |

### TrainingMode

| 값 | 설명 |
|---|---|
| `single` | 단일 모델 학습 |
| `multi` | 다중 모델 학습 |

### ModelVersion 상태

| 값 | 설명 |
|---|---|
| `CREATED` | 기본 생성 상태 |
| `SELECTED` | 운영 대표 모델로 선택됨 |
| `ARCHIVED` | 보관(비활성) 처리됨 |

---

## Trainings

### GET `/api/v1/trainings`

전체 학습 작업 목록 반환 (최신순, 최대 100건).  
작업 현황 화면에서 **2초 간격 폴링**으로 사용합니다.

**Response** `200` — `TrainingSummaryResponse[]`

```json
[
  {
    "job_id": 1,
    "user_name": "admin",
    "experiment_name": "QPE_20260605",
    "mode": "single",
    "status": "RUNNING",
    "progress": 42,
    "current_epoch": 5,
    "total_epochs": 12,
    "run_id": null,
    "created_at": "2026-06-05T10:00:00",
    "started_at": "2026-06-05T10:00:05",
    "finished_at": null
  }
]
```

---

### POST `/api/v1/trainings`

강우예측 추론 작업을 대기열(QUEUED)에 등록합니다.  
등록 즉시 응답하며, 실제 실행은 worker가 순서대로 처리합니다.  
동시에 **1개 job만 실행**되고 나머지는 QUEUED 상태로 대기합니다.

**Request Body** — `TrainingCreateRequest`

| 필드 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `input_files` | `InputFiles` | **필수** | QPE .asc 파일 4개 (Base64 인코딩) |
| `user_name` | `string \| null` | 선택 | 요청자 이름 |
| `run_datetime` | `string \| null` | 선택 | 운용 시점 (`YYYYMMDDHHmm` 형식) |
| `model_version` | `string \| null` | 선택 | `"v2"` 또는 `"v3"` (기본값: `"v3"`) |
| `model_path` | `string \| null` | 선택 | 서버 내 모델 파일 경로 (기본: `/home/harry/models/`) |
| `forecast_steps` | `number[] \| null` | 선택 | 예측 선행시간 목록 (분, 10~180, 10의 배수). 생략 시 전체(10~180) |
| `include_preview_image` | `boolean \| null` | 선택 | PNG 미리보기 포함 여부 (기본값: `true`) |
| `experiment_name` | `string \| null` | 선택 | 실험 이름 (최대 100자) |
| `experiment_tags` | `string[] \| null` | 선택 | 태그 목록 (최대 10개) |
| `experiment_memo` | `string \| null` | 선택 | 메모 (최대 1000자) |
| `output_dir` | `string \| null` | 선택 | 결과 저장 경로 (생략 시 자동 생성) |

**InputFiles 구조**

```json
{
  "file_t0": { "filename": "202606050930.asc", "timestamp": "202606050930", "file_data": "<base64>" },
  "file_t1": { "filename": "202606050940.asc", "timestamp": "202606050940", "file_data": "<base64>" },
  "file_t2": { "filename": "202606050950.asc", "timestamp": "202606050950", "file_data": "<base64>" },
  "file_t3": { "filename": "202606051000.asc", "timestamp": "202606051000", "file_data": "<base64>" }
}
```

> `file_t0` = T-30분 / `file_t1` = T-20분 / `file_t2` = T-10분 / `file_t3` = 현재(T)  
> 4개 필드 모두 객체는 **필수**이며, 내부 프로퍼티(`filename`, `timestamp`, `file_data`)는 null 허용

**Response** `200` — `TrainingCreateResponse`

```json
{
  "job_id": 7,
  "status": "QUEUED",
  "queue_position": 3,
  "message": "학습 작업이 대기열에 등록되었습니다."
}
```

---

### GET `/api/v1/trainings/{job_id}`

특정 학습 작업의 상태와 진행률을 반환합니다.

**Path Parameter**: `job_id` (integer)

**Response** `200` — `TrainingSummaryResponse` (위 목록과 동일한 스키마)

---

### GET `/api/v1/trainings/{job_id}/logs`

학습 stdout 로그 반환 (최대 300줄).  
RUNNING 중에도 실시간에 가깝게 조회 가능합니다. **1~2초 간격 폴링** 권장.

**Response** `200` — `TrainingLogResponse`

```json
{
  "job_id": 7,
  "logs": [
    "[2026-06-05 10:01:00] Epoch 1/12 started",
    "[2026-06-05 10:01:30] loss: 0.0421"
  ]
}
```

---

### GET `/api/v1/trainings/{job_id}/result`

추론 완료 후 결과 반환.  
status가 **COMPLETED**일 때 호출하세요.

| 필드 | 설명 |
|---|---|
| `params` | 실행에 사용된 파라미터 (model_version, 입력 파일 경로 등) |
| `metrics` | 현재 비어 있음 (추론 모델은 별도 지표 없음) |
| `artifacts` | 생성된 예측 강우장 파일 목록 (.asc, 10분~180분 최대 18개) |

**Response** `200` — `TrainingResultResponse`

```json
{
  "job_id": 7,
  "run_id": 3,
  "status": "COMPLETED",
  "params": { "model_version": "v3", "run_datetime": "202606051000" },
  "metrics": {},
  "artifacts": [
    { "filename": "forecast_010min.asc", "file_path": "runs/job_7/outputs/forecast_010min.asc" }
  ]
}
```

---

## Experiments

### GET `/api/v1/experiments`

실험 목록 반환. `experiment_name`이 같은 학습 작업들이 하나의 실험으로 묶입니다.

**Response** `200` — `ExperimentResponse[]`

```json
[
  {
    "id": 1,
    "name": "QPE_20260605",
    "description": null,
    "created_at": "2026-06-05T10:00:00"
  }
]
```

---

### GET `/api/v1/experiments/{experiment_id}`

특정 실험의 상세 정보를 반환합니다.

**Response** `200` — `ExperimentResponse`

---

### GET `/api/v1/experiments/{experiment_id}/runs`

특정 실험에 속한 Run 목록 반환. Run 1개 = 학습 1회 실행 결과.  
metrics, parameters를 run 간 비교하는 용도로 사용합니다.

**Response** `200` — `ExperimentRunResponse[]`

```json
[
  {
    "id": 3,
    "experiment_id": 1,
    "job_id": 7,
    "run_name": "run_20260605_001",
    "version": "v3",
    "mode": "single",
    "status": "COMPLETED",
    "parameters": { "model_version": "v3" },
    "metrics": {},
    "created_by": "admin",
    "started_at": "2026-06-05T10:00:05",
    "finished_at": "2026-06-05T10:08:32",
    "duration_seconds": 507,
    "created_at": "2026-06-05T10:00:00"
  }
]
```

---

## Runs

### GET `/api/v1/runs/{run_id}`

특정 Run의 상세 정보를 반환합니다.  
metrics, parameters, 실행 시간 등 1회 학습 결과 전체를 포함합니다.

**Response** `200` — `ExperimentRunResponse` (위와 동일한 스키마)

---

## Artifacts

### GET `/api/v1/runs/{run_id}/artifacts`

특정 Run에서 생성된 결과 파일 목록 반환.

| 필드 | 설명 |
|---|---|
| `artifact_type` | `model` / `prediction` / `plot` / `csv` / `log` 등 |
| `file_path` | 서버 로컬 경로 (파일 다운로드 시 참고) |

**Response** `200` — `ArtifactResponse[]`

```json
[
  {
    "id": 11,
    "run_id": 3,
    "artifact_type": "prediction",
    "file_name": "forecast_060min.asc",
    "file_path": "runs/job_7/outputs/forecast_060min.asc",
    "file_size": 204800,
    "created_at": "2026-06-05T10:08:35"
  }
]
```

---

### GET `/api/v1/artifacts/{artifact_id}`

특정 Artifact의 상세 정보를 반환합니다.

**Response** `200` — `ArtifactResponse`

---

## Models

### GET `/api/v1/models`

전체 모델 버전 목록 반환.

| status 값 | 설명 |
|---|---|
| `CREATED` | 기본 생성 상태 |
| `SELECTED` | 운영 대표 모델 |
| `ARCHIVED` | 보관(비활성) |

**Response** `200` — `ModelVersionResponse[]`

```json
[
  {
    "id": 2,
    "experiment_id": 1,
    "run_id": 3,
    "version": "v3.1.0",
    "model_name": "QPE_v3",
    "model_path": "/home/harry/models/qpe_v3.pt",
    "status": "SELECTED",
    "metrics": null,
    "created_at": "2026-06-05T10:08:40"
  }
]
```

---

### GET `/api/v1/models/{version_id}`

특정 모델 버전 상세 정보를 반환합니다.

---

### POST `/api/v1/models/{version_id}/select`

해당 모델 버전을 **SELECTED(대표 모델)**로 지정합니다.  
운영에 사용할 모델을 선택할 때 사용합니다.

**Response** `200` — 변경된 `ModelVersionResponse`

---

### POST `/api/v1/models/{version_id}/archive`

해당 모델 버전을 **ARCHIVED(보관)** 상태로 변경합니다.

**Response** `200` — 변경된 `ModelVersionResponse`

---

## System

### GET `/api/v1/system/gpu`

서버 GPU 상태 반환. `nvidia-smi` 기반 조회.  
GPU가 없는 환경에서는 `available: false`로 반환됩니다.

**Response** `200` — `GpuStatusResponse`

```json
{
  "available": true,
  "gpu_count": 2,
  "gpus": [
    {
      "index": 0,
      "name": "NVIDIA A100",
      "memory_total_mb": 81920,
      "memory_used_mb": 12288,
      "memory_free_mb": 69632,
      "utilization_percent": 23,
      "temperature_c": 45
    }
  ],
  "error": null
}
```

---

## Health

### GET `/health`

서버 헬스 체크.

**Response** `200` — `{}`

---

## 스키마 요약

### TrainingCreateRequest (필수 필드만)

```typescript
{
  input_files: {           // 필수
    file_t0: FileData;     // T-30분
    file_t1: FileData;     // T-20분
    file_t2: FileData;     // T-10분
    file_t3: FileData;     // T현재
  };
}

interface FileData {
  filename: string | null;
  timestamp: string | null;  // YYYYMMDDHHmm
  file_data: string | null;  // Base64
}
```

### TrainingSummaryResponse

```typescript
{
  job_id: number;
  user_name: string;
  experiment_name: string;
  mode: "single" | "multi";
  status: "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED" | "CANCELED";
  progress: number | null;        // 0~100
  current_epoch: number | null;
  total_epochs: number | null;
  run_id: number | null;
  created_at: string;             // ISO 8601
  started_at: string | null;
  finished_at: string | null;
}
```

### ExperimentRunResponse

```typescript
{
  id: number;
  experiment_id: number;
  job_id: number;
  run_name: string | null;
  version: string | null;
  mode: string | null;
  status: string | null;
  parameters: Record<string, unknown> | null;
  metrics: Record<string, unknown> | null;
  created_by: string | null;
  started_at: string | null;
  finished_at: string | null;
  duration_seconds: number | null;
  created_at: string;
}
```

### GpuInfo

```typescript
{
  index: number;
  name: string;
  memory_total_mb: number;
  memory_used_mb: number;
  memory_free_mb: number;
  utilization_percent: number;
  temperature_c: number | null;
}
```

---

## 에러 응답

FastAPI 표준 에러 형식을 사용합니다.

```json
// 일반 에러
{ "detail": "에러 메시지" }

// 유효성 검사 에러 (422)
{
  "detail": [
    { "loc": ["body", "input_files"], "msg": "field required", "type": "value_error.missing" }
  ]
}
```

---

## 프론트엔드 연동 참고

| 항목 | 값 |
|---|---|
| 프록시 설정 | `next.config.js` `/api/:path*` → `http://localhost:8000/api/:path*` |
| 폴링 주기 | 2초 (학습 목록, 로그) |
| Base URL (코드 내) | `/api/v1` |
| 인증 헤더 | `Authorization: Bearer <token>` |
