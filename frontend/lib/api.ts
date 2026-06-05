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

export interface TrainingResult {
  job_id: number;
  run_id: number | null;
  status: string;
  params: Record<string, unknown>;
  metrics: Record<string, unknown>;
  artifacts: Record<string, unknown>[];
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
  index: number;
  name: string;
  utilization_percent: number;
  memory_used_mb: number;
  memory_total_mb: number;
  memory_free_mb: number;
  temperature_c: number | null;
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

// ─── Auth Helpers ─────────────────────────────────────────────────────────────

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('token');
}

export function getUsername(): string | null {
  if (typeof window === 'undefined') return null;
  const token = localStorage.getItem('token');
  if (!token) return null;
  try {
    const parts = atob(token).split(':');
    return parts[0] || null;
  } catch {
    return null;
  }
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
  run_datetime?: string | null;
  model_version?: string | null;
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
  run_datetime: string | null;
  input_files: {
    file_t0: AscFileInput;
    file_t1: AscFileInput;
    file_t2: AscFileInput;
    file_t3: AscFileInput;
  };
  model_version: 'v2' | 'v3' | null;
  forecast_steps: number[] | null;
  include_preview_image: boolean | null;
  experiment_name: string | null;
  experiment_tags: string[] | null;
  experiment_memo: string | null;
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

export async function createExperiment(body: ExperimentCreateRequest): Promise<ExperimentCreateResponse> {
  return request<ExperimentCreateResponse>('/trainings', {
    method: 'POST',
    body: JSON.stringify(body),
  });
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

// ─── System ───────────────────────────────────────────────────────────────────

export async function getSystemStatus(): Promise<SystemStatus> {
  return request<SystemStatus>('/system/gpu');
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