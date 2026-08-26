// DataOps API Client
// Backend: FastAPI (port 8000) -> NGINX reverse proxy (/)

import {
  addDemoJob,
  demoArtifacts,
  demoExperiments,
  demoModels,
  demoRuns,
  demoSystemStatus,
  demoTrainingLogs,
  demoTrainingResult,
  isDemoMode,
  readDemoJobs,
} from './demoData';
import { getCurrentUsername, getDisplayUsername } from './account';

const BASE_URL = '/api/v1';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface HealthStatus {
  status: string;
}

export interface TrainingJob {
  job_id: number;
  user_name: string;
  experiment_id?: number | null;
  experiment_name: string;
  mode: string;
  status: string;
  progress: number | null;
  current_epoch: number | null;
  total_epochs: number | null;
  queue_position?: number | null;
  elapsed_seconds?: number | null;
  estimated_total_seconds?: number | null;
  remaining_seconds?: number | null;
  run_id: number | null;
  error_message?: string | null;
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
  answer_dataset_id?: number | null;
  answer_dataset_name?: string | null;
  output_dir?: string | null;
  // 실험 등록 시 작성한 메모 — 백엔드 응답 노출 대기 (request.md 항목 9)
  experiment_memo?: string | null;
  git_commit?: string | null;
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
  error_message?: string | null;
}

export interface Experiment {
  id: number;
  name: string;
  description: string | null;
  created_by: string | null;
  gold_job_id: number | null;
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
  metrics: {
    architecture?: string | null;
    runner_version?: string;
    source?: string;
    model_file_pattern?: string | null;
    forecast_steps?: number[];
    validation_status?: 'READY' | 'MISSING_FILES' | 'INVALID' | 'UNTESTED' | string;
    file_count?: number;
    expected_file_count?: number;
    missing_files?: string[];
    validated_at?: string;
    latest_file_mtime?: string;
    [key: string]: unknown;
  } | null;
  model_path: string | null;
  created_at: string | null;
}

export interface ModelCandidate {
  version: string;
  model_name: string;
  model_path: string;
  architecture: string;
  validation_status: 'READY' | 'MISSING_FILES' | 'UNTESTED' | string;
  file_count: number;
  expected_file_count: number;
  missing_files: string[];
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
  username: string;
  message: string;
}

export interface AccountActionResponse {
  username: string;
  message: string;
}

export interface DataCollectionScriptResult {
  status: 'COMPLETED' | 'FAILED' | 'SKIPPED' | string;
  message: string;
  return_code: number;
  output_dir: string;
  file_count: number;
  files: string[];
  started_at: string;
  finished_at: string;
  stdout_tail: string[];
  stderr_tail: string[];
}

export interface DataCollectionPipelineResult {
  status: 'COMPLETED' | 'WARNING' | 'FAILED' | string;
  message: string;
  run_id?: string | null;
  dataset_name?: string | null;
  collect: DataCollectionScriptResult;
  convert: DataCollectionScriptResult;
  output_dir: string;
  file_count: number;
  files: string[];
  started_at: string;
  finished_at: string;
}

export interface CollectAnswerDataResult {
  status: 'COMPLETED' | 'FAILED' | string;
  message: string;
  answer_dataset_id?: number | null;
  answer_dataset_name?: string | null;
  answer_file_count?: number;
}

export interface DataCollectionJob {
  id: number;
  status: 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | string;
  stage?: string | null;
  progress: number;
  dataset_name?: string | null;
  created_by?: string | null;
  error_message?: string | null;
  result?: {
    input?: DataCollectionPipelineResult;
    answer?: CollectAnswerDataResult;
  } | null;
  created_at: string;
  started_at?: string | null;
  finished_at?: string | null;
}

export interface DataCollectionDatasetGroup {
  id: string;
  name: string;
  path: string;
  file_count: number;
  files: string[];
  created_at?: string | null;
  dataset_name?: string | null;
  created_by?: string | null;
  target_datetimes?: string[];
  interval_minutes?: number | null;
  raw_group_id?: string | null;
}

export interface DataCollectionInfo {
  external_scripts_dir: string;
  collector_command_configured: boolean;
  converter_command_configured: boolean;
  raw_output_dir: string;
  training_dataset_dir: string;
  timeout_seconds: number;
  raw_file_count: number;
  raw_files: string[];
  raw_data_groups: DataCollectionDatasetGroup[];
  training_dataset_file_count: number;
  training_dataset_files: string[];
  training_dataset_groups: DataCollectionDatasetGroup[];
}

export interface DataCollectionDeleteResult {
  deleted_groups: string[];
  deleted_file_count: number;
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
  return getDisplayUsername();
}

/** 그 job/실험을 실제로 만든 계정 아이디를 그대로 표시 (닉네임이 아니라 아이디 — 브라우저 무관하게 항상 동일) */
export function displayUsername(value?: string | null): string {
  const username = (value || '').trim();
  if (!username || username === 'anonymous') return '-';
  return username;
}

export function formatExecutionName(value?: string | null, runDatetime?: string | null): string {
  const source = (runDatetime || value || '').trim();
  // 대시보드 등 일부 화면은 runDatetime 없이 이미 이 함수로 만들어진 experiment_name만 다시 넘긴다 —
  // "YYYY-MM-DD 강우 실험(HH시 MM분)" 형태면 시:분 뒤에 한글이 와서 재파싱 시 00시 00분으로 깨지므로
  // 그대로 돌려준다.
  if (/^\d{4}-\d{2}-\d{2} 강우 실험\(\d{1,2}시 \d{1,2}분\)$/.test(source)) {
    return source;
  }
  const iso = source.match(/(\d{4})-(\d{2})-(\d{2})[T\s]?(\d{2})?:?(\d{2})?/);
  const compact = source.match(/(20\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/);
  const match = iso ?? compact;
  if (!match) return value || '-';

  const [, y, m, d, h = '00', min = '00'] = match;
  return `${y}-${m}-${d} 강우 실험(${h}시 ${min}분)`;
}

export function isLoggedIn(): boolean {
  return getToken() !== null;
}

export function logout() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('token');
}

// 로그인/비밀번호 검증 자체는 백엔드 계정 API가 처리한다. 실패 시(401/404) 여기서 직접
// 에러 메시지를 던져야 해서, 401을 만나면 /login으로 리다이렉트하는 공용 request()는 쓰지 않는다.
export async function loginAccount(username: string, password: string): Promise<LoginResponse> {
  const res = await fetch(`${BASE_URL}/accounts/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: '로그인에 실패했습니다.' }));
    throw new Error(err.detail || '로그인에 실패했습니다.');
  }
  return res.json();
}

export async function resetAccountPassword(username: string): Promise<AccountActionResponse> {
  const res = await fetch(`${BASE_URL}/accounts/${encodeURIComponent(username)}/reset-password`, {
    method: 'POST',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: '비밀번호 초기화에 실패했습니다.' }));
    throw new Error(err.detail || '비밀번호 초기화에 실패했습니다.');
  }
  return res.json();
}

export async function changeAccountPassword(
  username: string,
  currentPassword: string,
  newPassword: string,
): Promise<AccountActionResponse> {
  return request<AccountActionResponse>(`/accounts/${encodeURIComponent(username)}/change-password`, {
    method: 'POST',
    body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
  });
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
  if (res.status === 204) {
    return undefined as T;
  }
  return res.json();
}

// 파일 업로드(multipart/form-data)용 — Content-Type은 브라우저가 boundary 포함해서 자동으로 설정하므로 직접 지정하지 않는다.
async function requestForm<T>(url: string, formData: FormData): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const res = await fetch(BASE_URL + url, {
    method: 'POST',
    cache: 'no-store',
    headers,
    body: formData,
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

// ─── Data Collection ─────────────────────────────────────────────────────────

export async function getDataCollectionInfo(): Promise<DataCollectionInfo> {
  return request<DataCollectionInfo>('/data-collection/info');
}

export async function collectPublicWeatherData(): Promise<DataCollectionScriptResult> {
  return request<DataCollectionScriptResult>('/data-collection/collect', { method: 'POST' });
}

export async function convertTrainingDataset(): Promise<DataCollectionScriptResult> {
  return request<DataCollectionScriptResult>('/data-collection/convert', { method: 'POST' });
}

export async function makeTrainingDataset(body: {
  target_datetimes: string[];
  interval_minutes: number;
  frame_count: number;
  dataset_name?: string | null;
  created_by?: string | null;
}): Promise<DataCollectionPipelineResult> {
  return request<DataCollectionPipelineResult>('/data-collection/make-training-dataset', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/** 입력 수집이 끝난 뒤 이어서 호출 — 한 요청에 다 묶으면 오래 걸려 타임아웃에 걸리기 쉬워서 분리함 */
export async function collectAnswerData(body: {
  run_id: string;
  target_datetimes: string[];
  dataset_name?: string | null;
}): Promise<CollectAnswerDataResult> {
  return request<CollectAnswerDataResult>('/data-collection/collect-answer-data', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/**
 * 입력 4프레임(+선택 시 정답데이터) 수집을 백그라운드에 등록만 하고 바로 반환한다.
 * 진행상황/결과는 getLatestDataCollectionJob으로 조회 — 요청-응답으로 오래 붙잡지 않아서
 * 프록시 타임아웃이 없고, 다른 사용자/새로고침에서도 동일하게 이어서 보인다.
 */
export async function createDataCollectionJob(body: {
  target_datetimes: string[];
  interval_minutes: number;
  dataset_name?: string | null;
  created_by?: string | null;
  collect_answer_data: boolean;
}): Promise<DataCollectionJob> {
  return request<DataCollectionJob>('/data-collection/jobs', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function getLatestDataCollectionJob(): Promise<DataCollectionJob | null> {
  return request<DataCollectionJob | null>('/data-collection/jobs/latest');
}

export function downloadTrainingDatasetUrl(groups: string[] = []): string {
  const params = new URLSearchParams();
  groups.forEach(group => params.append('groups', group));
  const query = params.toString();
  return `${BASE_URL}/data-collection/training-dataset/download${query ? `?${query}` : ''}`;
}

export function downloadRawDataUrl(groups: string[] = []): string {
  const params = new URLSearchParams();
  groups.forEach(group => params.append('groups', group));
  const query = params.toString();
  return `${BASE_URL}/data-collection/raw-data/download${query ? `?${query}` : ''}`;
}

export async function deleteRawDataGroups(groups: string[]): Promise<DataCollectionDeleteResult> {
  const params = new URLSearchParams();
  groups.forEach(group => params.append('groups', group));
  return request<DataCollectionDeleteResult>(`/data-collection/raw-data?${params.toString()}`, { method: 'DELETE' });
}

export async function deleteTrainingDatasetGroups(groups: string[]): Promise<DataCollectionDeleteResult> {
  const params = new URLSearchParams();
  groups.forEach(group => params.append('groups', group));
  return request<DataCollectionDeleteResult>(`/data-collection/training-dataset?${params.toString()}`, { method: 'DELETE' });
}

// ─── Assistant (규칙기반 검색, LLM/벡터DB 없음) ──────────────────────────────────

export interface AssistantResultItem {
  job_id: number;
  experiment_name: string;
  run_datetime: string | null;
  model_version: string | null;
  status: string;
  user_name: string | null;
  mae: number | null;
  rmse: number | null;
  csi: number | null;
}

export interface AssistantQueryResult {
  message: string;
  count: number;
  results: AssistantResultItem[];
}

export async function queryAssistant(message: string): Promise<AssistantQueryResult> {
  return request<AssistantQueryResult>('/assistant/query', {
    method: 'POST',
    body: JSON.stringify({ message }),
  });
}

// ─── Training ─────────────────────────────────────────────────────────────────

export async function getTrainings(): Promise<TrainingJob[]> {
  if (isDemoMode()) return readDemoJobs();
  return request<TrainingJob[]>('/trainings');
}

interface TrainingFormFields {
  user_name?: string | null;
  run_datetime?: string | null;
  model_version?: string | null;
  observation_dataset_id?: number | null;
  answer_dataset_id?: number | null;
  experiment_id?: number | null;
  forecast_steps?: number[] | null;
  include_preview_image?: boolean | null;
  experiment_name?: string | null;
  experiment_tags?: string[] | null;
  experiment_memo?: string | null;
  output_dir?: string | null;
  input_dataset_dir?: string | null;
  input_files?: {
    file_t0: AscFileInput;
    file_t1: AscFileInput;
    file_t2: AscFileInput;
    file_t3: AscFileInput;
  };
}

// 백엔드가 multipart/form-data(파일 파트 4개 + 나머지 값은 Form 필드)로 받으므로 여기서 FormData로 조립한다.
function buildTrainingFormData(body: TrainingFormFields): FormData {
  const formData = new FormData();
  if (body.user_name) formData.append('user_name', body.user_name);
  if (body.run_datetime) formData.append('run_datetime', body.run_datetime);
  if (body.model_version) formData.append('model_version', body.model_version);
  if (body.observation_dataset_id != null) formData.append('observation_dataset_id', String(body.observation_dataset_id));
  if (body.answer_dataset_id != null) formData.append('answer_dataset_id', String(body.answer_dataset_id));
  if (body.experiment_id != null) formData.append('experiment_id', String(body.experiment_id));
  (body.forecast_steps ?? []).forEach(step => formData.append('forecast_steps', String(step)));
  if (body.include_preview_image != null) formData.append('include_preview_image', String(body.include_preview_image));
  if (body.experiment_name) formData.append('experiment_name', body.experiment_name);
  (body.experiment_tags ?? []).forEach(tag => formData.append('experiment_tags', tag));
  if (body.experiment_memo) formData.append('experiment_memo', body.experiment_memo);
  if (body.output_dir) formData.append('output_dir', body.output_dir);
  if (body.input_dataset_dir) formData.append('input_dataset_dir', body.input_dataset_dir);

  if (body.input_dataset_dir) return formData;
  if (!body.input_files) throw new Error('ASC 입력 파일이 없습니다.');

  const slots: Array<[string, AscFileInput]> = [
    ['file_t0', body.input_files.file_t0],
    ['file_t1', body.input_files.file_t1],
    ['file_t2', body.input_files.file_t2],
    ['file_t3', body.input_files.file_t3],
  ];
  for (const [key, slot] of slots) {
    if (!slot.file) throw new Error(`${key} 파일이 없습니다.`);
    formData.append(key, slot.file, slot.filename ?? slot.file.name);
  }
  return formData;
}

export async function createTraining(body: TrainingFormFields & {
  experiment_name?: string | null;
  model_name?: string | null;
  mode?: 'single' | 'multi' | string | null;
  train_dataset_dir?: string | null;
  validation_dataset_dir?: string | null;
  hyperparameters?: Record<string, unknown> | null;
  evaluation_metrics?: string[] | null;
  register_policy?: 'manual' | 'auto' | string | null;
}): Promise<{ job_id: number; status: string; queue_position: number; message: string }> {
  if (isDemoMode()) {
    const job = addDemoJob({
      userName: body.user_name,
      runDatetime: body.run_datetime,
      modelVersion: body.model_version,
      mode: body.mode,
      experimentName: body.experiment_name,
    });
    return { job_id: job.job_id, status: job.status, queue_position: 0, message: '데모 테스트케이스가 생성되었습니다.' };
  }
  return requestForm('/trainings', buildTrainingFormData(body));
}

export async function getTraining(jobId: number): Promise<TrainingJob> {
  if (isDemoMode()) {
    const job = readDemoJobs().find(item => item.job_id === jobId);
    if (!job) throw new Error('데모 테스트케이스를 찾을 수 없습니다.');
    return job;
  }
  return request<TrainingJob>(`/trainings/${jobId}`);
}

export async function deleteTraining(jobId: number): Promise<void> {
  return request<void>(`/trainings/${jobId}`, { method: 'DELETE' });
}

export async function getTrainingLogs(jobId: number): Promise<TrainingLog> {
  if (isDemoMode()) return demoTrainingLogs(jobId);
  return request<TrainingLog>(`/trainings/${jobId}/logs`);
}

export async function getTrainingResult(jobId: number): Promise<TrainingResult> {
  if (isDemoMode()) return demoTrainingResult(jobId);
  return request<TrainingResult>(`/trainings/${jobId}/result`);
}

// ─── Comments ─────────────────────────────────────────────────────────────────

export interface Comment {
  id: number;
  job_id: number;
  author: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export async function getComments(jobId: number): Promise<Comment[]> {
  return request<Comment[]>(`/trainings/${jobId}/comments`);
}

export async function createComment(jobId: number, author: string, content: string): Promise<Comment> {
  return request<Comment>(`/trainings/${jobId}/comments`, {
    method: 'POST',
    body: JSON.stringify({ author, content }),
  });
}

export async function updateComment(commentId: number, author: string, content: string): Promise<Comment> {
  return request<Comment>(`/comments/${commentId}`, {
    method: 'PATCH',
    body: JSON.stringify({ author, content }),
  });
}

export async function deleteComment(commentId: number, author: string): Promise<void> {
  await request<void>(`/comments/${commentId}?author=${encodeURIComponent(author)}`, {
    method: 'DELETE',
  });
}

// ─── Experiments ──────────────────────────────────────────────────────────────

export interface AscFileInput {
  filename: string | null;
  file: File | null;
}

export interface ExperimentCreateRequest {
  user_name?: string | null;
  run_datetime: string | null;
  input_files?: {
    file_t0: AscFileInput;
    file_t1: AscFileInput;
    file_t2: AscFileInput;
    file_t3: AscFileInput;
  };
  input_dataset_dir?: string | null;
  model_version: string | null;
  mode?: 'single' | 'multi' | string | null;
  forecast_steps: number[] | null;
  include_preview_image: boolean | null;
  experiment_name: string | null;
  experiment_id?: number | null;
  experiment_tags: string[] | null;
  experiment_memo: string | null;
  observation_dataset_id: number | null;
  observation_dataset_dir?: string | null;
  answer_dataset_id?: number | null;
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

export interface AnswerDataset {
  id: number;
  name: string;
  folder_name: string;
  path: string;
  description: string | null;
  file_count: number;
  created_at: string | null;
}

export interface AnswerDatasetUploadResponse extends AnswerDataset {
  uploaded_files: string[];
}

export interface ExperimentCreateResponse {
  job_id: number;
  status: string;
  queue_position: number;
  message: string;
}

export async function getExperiments(): Promise<Experiment[]> {
  if (isDemoMode()) return demoExperiments();
  return request<Experiment[]>('/experiments');
}

export async function getExperiment(id: number): Promise<Experiment> {
  if (isDemoMode()) {
    const exp = demoExperiments().find(item => item.id === id);
    if (!exp) throw new Error('데모 실험을 찾을 수 없습니다.');
    return exp;
  }
  return request<Experiment>(`/experiments/${id}`);
}

export async function getExperimentRuns(id: number): Promise<ExperimentRun[]> {
  if (isDemoMode()) return demoRuns(id);
  return request<ExperimentRun[]>(`/experiments/${id}/runs`);
}

export async function getExperimentJobs(): Promise<TrainingJob[]> {
  if (isDemoMode()) return readDemoJobs();
  return request<TrainingJob[]>('/trainings');
}

/** 특정 실험(experiment_id)에 서버가 직접 연결해둔 job만 조회 — 상태 무관, 브라우저와 무관하게 항상 동일 */
export async function getTrainingJobsByExperiment(experimentId: number): Promise<TrainingJob[]> {
  if (isDemoMode()) return readDemoJobs();
  return request<TrainingJob[]>(`/trainings?experiment_id=${experimentId}`);
}

/** 실험(테스트케이스 그룹)을 서버에 생성 — 이 experiment_id를 테스트케이스 등록 시 넘기면 브라우저/계정 무관하게 공유됨 */
export async function createExperimentGroup(name: string, description?: string | null): Promise<Experiment> {
  return request<Experiment>('/experiments', {
    method: 'POST',
    body: JSON.stringify({ name, description: description ?? null, created_by: getCurrentUsername() }),
  });
}

/** 대표 테스트케이스(금메달) 수동 지정 — 이후 CSI 더 높은 게 생겨도 자동으로 안 뺏김 */
export async function setGoldJob(experimentId: number, jobId: number): Promise<Experiment> {
  return request<Experiment>(`/experiments/${experimentId}/gold`, {
    method: 'POST',
    body: JSON.stringify({ job_id: jobId }),
  });
}

/** 수동 지정 해제 — CSI 최고점 기준 자동 산정으로 되돌림 */
export async function clearGoldJob(experimentId: number): Promise<Experiment> {
  return request<Experiment>(`/experiments/${experimentId}/gold`, { method: 'DELETE' });
}

export async function createExperimentJob(body: ExperimentCreateRequest): Promise<ExperimentCreateResponse> {
  if (isDemoMode()) {
    const job = addDemoJob({
      userName: body.user_name,
      runDatetime: body.run_datetime,
      modelVersion: body.model_version,
      mode: body.mode,
      experimentName: body.experiment_name,
    });
    return { job_id: job.job_id, status: job.status, queue_position: 0, message: '데모 테스트케이스가 생성되었습니다.' };
  }
  return requestForm<ExperimentCreateResponse>('/trainings', buildTrainingFormData(body));
}

export async function getObservationDatasets(): Promise<ObservationDataset[]> {
  if (isDemoMode()) {
    return [{
      id: 1,
      name: '기본 검증 데이터셋',
      folder_name: 'default',
      description: '/data/observations/default',
      file_count: 72,
      created_at: new Date().toISOString(),
    }];
  }
  return request<ObservationDataset[]>('/observation-datasets');
}

export async function getAnswerDatasets(): Promise<AnswerDataset[]> {
  if (isDemoMode()) {
    return [{
      id: 1,
      name: 'basic',
      folder_name: 'basic',
      path: '/data/answer/basic',
      description: '데모 정답 데이터셋',
      file_count: 18,
      created_at: new Date().toISOString(),
    }];
  }
  return request<AnswerDataset[]>('/answer-datasets');
}

export async function deleteAnswerDataset(id: number): Promise<void> {
  return request<void>(`/answer-datasets/${id}`, { method: 'DELETE' });
}

export async function createAnswerDataset(body: {
  name: string;
  description?: string | null;
  folder_name?: string | null;
  files: File[];
}): Promise<AnswerDatasetUploadResponse> {
  const token = getToken();
  const form = new FormData();
  form.append('name', body.name);
  if (body.description) form.append('description', body.description);
  if (body.folder_name) form.append('folder_name', body.folder_name);
  body.files.forEach(file => form.append('files', file));

  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}/answer-datasets`, {
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
  if (isDemoMode()) {
    const run = demoRuns(202606).find(item => item.id === id);
    if (!run) throw new Error('데모 run을 찾을 수 없습니다.');
    return run;
  }
  return request<ExperimentRun>(`/runs/${id}`);
}

// ─── Artifacts ────────────────────────────────────────────────────────────────

export async function getArtifacts(): Promise<Artifact[]> {
  return [];
}

export async function getArtifactsByRun(runId: number): Promise<Artifact[]> {
  if (isDemoMode()) return demoArtifacts(runId);
  return request<Artifact[]>(`/runs/${runId}/artifacts`);
}

export async function getArtifact(artifactId: number): Promise<Artifact> {
  if (isDemoMode()) {
    const artifact = demoArtifacts(Math.floor(artifactId / 10)).find(item => item.id === artifactId);
    if (!artifact) throw new Error('데모 아티팩트를 찾을 수 없습니다.');
    return artifact;
  }
  return request<Artifact>(`/artifacts/${artifactId}`);
}

// ─── Models ───────────────────────────────────────────────────────────────────

export async function getModels(): Promise<ModelVersion[]> {
  if (isDemoMode()) return demoModels();
  return request<ModelVersion[]>('/models');
}

export async function getModel(id: number): Promise<ModelVersion> {
  if (isDemoMode()) {
    const model = demoModels().find(item => item.id === id);
    if (!model) throw new Error('데모 모델을 찾을 수 없습니다.');
    return model;
  }
  return request<ModelVersion>(`/models/${id}`);
}

export async function selectModel(id: number): Promise<ModelVersion> {
  if (isDemoMode()) return getModel(id);
  return request<ModelVersion>(`/models/${id}/select`, { method: 'POST' });
}

export async function archiveModel(id: number): Promise<ModelVersion> {
  if (isDemoMode()) return getModel(id);
  return request<ModelVersion>(`/models/${id}/archive`, { method: 'POST' });
}

export async function scanModels(): Promise<ModelVersion[]> {
  return request<ModelVersion[]>('/models/scan', { method: 'POST' });
}

export async function validateModel(id: number): Promise<ModelVersion> {
  return request<ModelVersion>(`/models/${id}/validate`, { method: 'POST' });
}

export async function updateModel(id: number, body: { model_name?: string; version_label?: string }): Promise<ModelVersion> {
  return request<ModelVersion>(`/models/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
}

export async function deleteModel(id: number): Promise<void> {
  return request<void>(`/models/${id}`, { method: 'DELETE' });
}

export async function getModelInfo(): Promise<{ model_base_path: string }> {
  return request<{ model_base_path: string }>('/models/info');
}

export async function getModelCandidates(): Promise<ModelCandidate[]> {
  return request<ModelCandidate[]>('/models/candidates');
}

export async function registerModelVersions(versions: string[]): Promise<ModelVersion[]> {
  return request<ModelVersion[]>('/models/register', {
    method: 'POST',
    body: JSON.stringify({ versions }),
  });
}

export async function uploadModelFile(form: {
  files: File[];
  versionLabel: string;
  modelName: string;
  architecture: 'single' | 'multi';
}): Promise<ModelVersion> {
  const fd = new FormData();
  for (const f of form.files) fd.append('files', f);
  fd.append('version_label', form.versionLabel);
  fd.append('model_name', form.modelName);
  fd.append('architecture', form.architecture);

  const token = getToken();
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}/models/upload`, { method: 'POST', headers, body: fd });
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

// ─── System ───────────────────────────────────────────────────────────────────

export async function getSystemStatus(): Promise<SystemStatus> {
  if (isDemoMode()) return demoSystemStatus();
  return request<SystemStatus>('/system/gpu');
}

// 프론트 서버(현재 PC) 기준 — Next.js 앱 라우트라 백엔드 프록시를 타지 않음
export async function getLocalSystem(): Promise<LocalSystemInfo> {
  const res = await fetch('/api/system/local', { cache: 'no-store' });
  if (!res.ok) throw new Error(`local system: ${res.status}`);
  return res.json();
}
