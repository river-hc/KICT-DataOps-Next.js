// DataOps Platform API Client
// Backend: FastAPI (port 8001) → NGINX reverse proxy (/)

const BASE_URL = '/api/v1';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface HealthStatus {
  status: string;
}

export interface TrainingJob {
  job_id: number;
  user_name: string;
  experiment_name: string;
  mode: string;
  status: string;
  progress: number | null;
  current_epoch: number | null;
  total_epochs: number | null;
  run_id: number | null;
  created_at: string | null;
  started_at: string | null;
  finished_at: string | null;
}

export interface TrainingLog {
  job_id: number;
  logs: string[];
}

export interface TrainingResultParams {
  model_version: string | null;
  forecast_steps: number[] | null;
  include_preview_image: boolean | null;
  run_datetime: string | null;
  observation_dataset_id?: number | null;
  observation_dataset_dir?: string | null;
  output_dir?: string | null;
  // 실험 등록 시 작성한 메모 — 백엔드 응답 노출 대기 (request.md 항목 9)
  experiment_memo?: string | null;
}

export interface TrainingMetricSources {
  observation_dataset_dir?: string | null;
  output_dir?: string | null;
  metrics_dir?: string | null;
  metrics_file_path?: string | null;
  matched_targets?: Record<string, string>;
  missing_steps?: number[];
  errors?: Record<string, string>;
}

export interface TrainingResult {
  job_id: number;
  run_id: number | null;
  status: string;
  params: TrainingResultParams;
  metrics: Record<string, number>;
  metric_sources?: TrainingMetricSources | null;
  artifacts: Record<string, unknown>[];
  asc_urls: Record<number, string>;
}

export interface Experiment {
  id: number;
  name: string;
  description: string | null;
  created_at: string | null;
}

export interface ExperimentRun {
  id: number;
  experiment_id: number;
  job_id: number | null;
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

export interface Artifact {
  id: number;
  run_id: number;
  file_name: string;
  file_path: string;
  file_size: number | null;
  artifact_type: string;
  created_at: string | null;
}

export interface ModelVersion {
  id: number;
  experiment_id: number;
  run_id: number | null;
  model_name: string;
  version: string;
  status: string;
  metrics: Record<string, unknown> | null;
  model_path: string | null;
  created_at: string | null;
}

export interface GpuInfo {
  id: number;
  name: string;
  utilization: number;
  memory_used: number;
  memory_total: number;
  memory_free: number;
  temperature: number | null;
}

export interface SystemStatus {
  available: boolean;
  gpu_count: number;
  gpus: GpuInfo[];
  error: string | null;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  username: string;
}

// 로컬 시스템 정보 — Next.js 라우트 /api/system/local (프론트 서버 실행 머신 기준)
export interface LocalSystemInfo {
  host: string;
  gpu: SystemStatus;
  cpu: {
    percent: number;
    cores: number;
    model: string | null;
    load_avg: number[];
  };
  ram: { used_mb: number; total_mb: number };
  disk: { used_gb: number; total_gb: number } | null;
  os: {
    platform: string;
    release: string;
    uptime_seconds: number;
    node: string;
  };
}

// ─── Auth Helpers ─────────────────────────────────────────────────────────────

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('token');
}

export function getUsername(): string | null {
  if (typeof window === 'undefined') return null;
  if (!localStorage.getItem('token')) return null;
  return localStorage.getItem('nickname') || localStorage.getItem('username') || null;
}

export function displayUsername(value?: string | null): string {
  if (typeof window === 'undefined') return value || '-';
  const currentNickname = getUsername();
  if (currentNickname) return currentNickname;
  return (value || '').trim() || '-';
}

export function isLoggedIn(): boolean {
  return getToken() !== null;
}

export function logout() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('token');
}

export async function login(username: string, password: string): Promise<LoginResponse> {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: '로그인에 실패했습니다.' }));
    throw new Error(err.detail || '로그인에 실패했습니다.');
  }
  const data = await res.json();
  localStorage.setItem('token', data.access_token);
  return data;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const res = await fetch(BASE_URL + url, {
    cache: 'no-store',
    headers,
    ...options,
  });
  if (!res.ok) {
    if (res.status === 401) {
      if (typeof window !== 'undefined') window.location.href = '/login';
      throw new Error('인증이 필요합니다. 다시 로그인해주세요.');
    }
    const body = await res.json().catch(() => null);
    const detail = body?.detail;
    const message = Array.isArray(detail)
      ? detail.map((d: { msg: string }) => d.msg).join(', ')
      : (detail ?? `${res.status} ${res.statusText}`);
    throw new Error(message);
  }
  return res.json();
}

// ─── Health ───────────────────────────────────────────────────────────────────

export async function getHealth(): Promise<{ status: string }> {
  const res = await fetch('/health');
  return res.json();
}

// ─── Training ─────────────────────────────────────────────────────────────────

export async function getTrainings(): Promise<TrainingJob[]> {
  return request<TrainingJob[]>('/trainings');
}

export async function createTraining(body: {
  user_name?: string | null;
  experiment_name?: string | null;
  model_name?: string | null;
  mode?: 'single' | 'multi' | string | null;
  train_dataset_dir?: string | null;
  validation_dataset_dir?: string | null;
  hyperparameters?: Record<string, unknown> | null;
  evaluation_metrics?: string[] | null;
  register_policy?: 'manual' | 'auto' | string | null;
  run_datetime?: string | null;
  model_version?: string | null;
  observation_dataset_id?: number | null;
  forecast_steps?: number[] | null;
  include_preview_image?: boolean | null;
  experiment_tags?: string[] | null;
  experiment_memo?: string | null;
  output_dir?: string | null;
  input_files: {
    file_t0: AscFileInput;
    file_t1: AscFileInput;
    file_t2: AscFileInput;
    file_t3: AscFileInput;
  };
}): Promise<{ job_id: number; status: string; queue_position: number; message: string }> {
  return request<{ job_id: number; status: string; queue_position: number; message: string }>('/trainings', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function getTraining(jobId: number): Promise<TrainingJob> {
  return request<TrainingJob>(`/trainings/${jobId}`);
}

export async function getTrainingLogs(jobId: number): Promise<TrainingLog> {
  return request<TrainingLog>(`/trainings/${jobId}/logs`);
}

export async function getTrainingResult(jobId: number): Promise<TrainingResult> {
  return request<TrainingResult>(`/trainings/${jobId}/result`);
}

// ─── Experiments ──────────────────────────────────────────────────────────────

export interface AscFileInput {
  filename: string | null;
  timestamp: string | null;
  file_data: string | null;  // Base64 encoded file content
}

export interface ExperimentCreateRequest {
  user_name?: string | null;
  run_datetime: string | null;
  input_files: {
    file_t0: AscFileInput;
    file_t1: AscFileInput;
    file_t2: AscFileInput;
    file_t3: AscFileInput;
  };
  model_version: string | null;
  mode?: 'single' | 'multi' | string | null;
  forecast_steps: number[] | null;
  include_preview_image: boolean | null;
  experiment_name: string | null;
  experiment_tags: string[] | null;
  experiment_memo: string | null;
  observation_dataset_id: number | null;
  observation_dataset_dir?: string | null;
  output_dir?: string | null;
}

export interface ObservationDataset {
  id: number;
  name: string;
  folder_name: string;
  description: string | null;
  file_count: number;
  created_at: string | null;
}

export interface ObservationDatasetUploadResponse extends ObservationDataset {
  uploaded_files: string[];
}

export interface ExperimentCreateResponse {
  job_id: number;
  status: string;
  queue_position: number;
  message: string;
}

export async function getExperiments(): Promise<Experiment[]> {
  return request<Experiment[]>('/experiments');
}

export async function getExperiment(id: number): Promise<Experiment> {
  return request<Experiment>(`/experiments/${id}`);
}

export async function getExperimentRuns(id: number): Promise<ExperimentRun[]> {
  return request<ExperimentRun[]>(`/experiments/${id}/runs`);
}

export async function getExperimentJobs(): Promise<TrainingJob[]> {
  return request<TrainingJob[]>('/trainings');
}

export async function createExperimentJob(body: ExperimentCreateRequest): Promise<ExperimentCreateResponse> {
  return request<ExperimentCreateResponse>('/trainings', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/** @deprecated use createExperimentJob */
export async function createExperiment(body: ExperimentCreateRequest): Promise<ExperimentCreateResponse> {
  return createExperimentJob(body);
}

export async function getObservationDatasets(): Promise<ObservationDataset[]> {
  return request<ObservationDataset[]>('/observation-datasets');
}

export async function createObservationDataset(body: {
  name: string;
  description?: string | null;
  folder_name?: string | null;
  files: File[];
}): Promise<ObservationDatasetUploadResponse> {
  const token = getToken();
  const form = new FormData();
  form.append('name', body.name);
  if (body.description) form.append('description', body.description);
  if (body.folder_name) form.append('folder_name', body.folder_name);
  body.files.forEach(file => form.append('files', file));

  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}/observation-datasets`, {
    method: 'POST',
    headers,
    body: form,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const detail = body?.detail;
    const message = Array.isArray(detail)
      ? detail.map((d: { msg?: string }) => d.msg ?? String(d)).join(', ')
      : (detail ?? `${res.status} ${res.statusText}`);
    throw new Error(message);
  }

  return res.json();
}

// ─── Runs ─────────────────────────────────────────────────────────────────────

export async function getRun(id: number): Promise<ExperimentRun> {
  return request<ExperimentRun>(`/runs/${id}`);
}

// ─── Artifacts ────────────────────────────────────────────────────────────────

export async function getArtifacts(): Promise<Artifact[]> {
  return [];
}

export async function getArtifactsByRun(runId: number): Promise<Artifact[]> {
  return request<Artifact[]>(`/runs/${runId}/artifacts`);
}

export async function getArtifact(artifactId: number): Promise<Artifact> {
  return request<Artifact>(`/artifacts/${artifactId}`);
}

// ─── Models ───────────────────────────────────────────────────────────────────

export async function getModels(): Promise<ModelVersion[]> {
  return request<ModelVersion[]>('/models');
}

export async function getModel(id: number): Promise<ModelVersion> {
  return request<ModelVersion>(`/models/${id}`);
}

export async function selectModel(id: number): Promise<ModelVersion> {
  return request<ModelVersion>(`/models/${id}/select`, { method: 'POST' });
}

export async function archiveModel(id: number): Promise<ModelVersion> {
  return request<ModelVersion>(`/models/${id}/archive`, { method: 'POST' });
}

// 모델 등록 — multipart/form-data 전송이라 request() 헬퍼(JSON Content-Type 고정) 사용 불가.
// Content-Type을 직접 지정하지 않아야 브라우저가 boundary를 자동 설정함 (request_model.md 참조)
export async function registerModel(form: {
  versionLabel: string;
  architecture: 'single' | 'multi';
  modelFile: File;
  memo?: string;
}): Promise<ModelVersion> {
  const fd = new FormData();
  fd.append('version_label', form.versionLabel);
  fd.append('architecture', form.architecture);
  fd.append('model_file', form.modelFile);
  if (form.memo) fd.append('memo', form.memo);

  const token = getToken();
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}/models`, { method: 'POST', headers, body: fd });

  if (!res.ok) {
    if (res.status === 401) {
      if (typeof window !== 'undefined') window.location.href = '/login';
      throw new Error('인증이 필요합니다. 다시 로그인해주세요.');
    }
    if (res.status === 404 || res.status === 405) {
      throw new Error('모델 등록 API가 아직 백엔드에 구현되지 않았습니다.');
    }
    const body = await res.json().catch(() => null);
    const detail = body?.detail;
    const message = Array.isArray(detail)
      ? detail.map((d: { msg?: string }) => d.msg ?? String(d)).join(', ')
      : (detail ?? `${res.status} ${res.statusText}`);
    throw new Error(message);
  }

  return res.json();
}

// ─── System ───────────────────────────────────────────────────────────────────

export async function getSystemStatus(): Promise<SystemStatus> {
  return request<SystemStatus>('/system/gpu');
}

// 프론트 서버(현재 PC) 기준 — Next.js 앱 라우트라 백엔드 프록시를 타지 않음
export async function getLocalSystem(): Promise<LocalSystemInfo> {
  const res = await fetch('/api/system/local', { cache: 'no-store' });
  if (!res.ok) throw new Error(`local system: ${res.status}`);
  return res.json();
}

// ─── File Utilities ───────────────────────────────────────────────────────────

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Remove data URL prefix (e.g., "data:text/plain;base64,")
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function calculateTimestamp(runDatetime: string, offsetMinutes: number): string {
  // run_datetime이 "202606041000" 형식이라면
  const year = parseInt(runDatetime.substring(0, 4));
  const month = parseInt(runDatetime.substring(4, 6)) - 1;
  const day = parseInt(runDatetime.substring(6, 8));
  const hour = parseInt(runDatetime.substring(8, 10));
  const minute = parseInt(runDatetime.substring(10, 12));

  const date = new Date(year, month, day, hour, minute);
  date.setMinutes(date.getMinutes() + offsetMinutes);

  const pad = (n: number, len: number = 2) => String(n).padStart(len, '0');

  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}${pad(date.getHours())}${pad(date.getMinutes())}`;
}
