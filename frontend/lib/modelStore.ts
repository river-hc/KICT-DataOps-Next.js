// 모델 레지스트리 클라이언트 보조 저장소.
// 백엔드 반영 전/실패 시에도 사용자가 변경한 운영 상태와 편의 기능을 localStorage로 보조.

import type { ModelVersion, TrainingJob } from './api';

const HIDDEN_KEY = 'kict_model_hidden';  // number[] — 삭제(숨김) 처리된 버전 id
const DESC_KEY   = 'kict_model_desc';    // { [modelName]: string } — 모델 설명 편집값
const STATUS_KEY = 'kict_model_status';  // { [modelVersionId]: CREATED|SELECTED|ARCHIVED }
const PENDING_TRAINING_KEY = 'kict_model_pending_trainings';
const REGISTERED_MODELS_KEY = 'kict_registered_models';

export type StoredModelStatus = 'CREATED' | 'SELECTED' | 'ARCHIVED';
export type TrainingModelStatus = 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELED';

export interface PendingTrainingModel {
  jobId: number;
  modelName: string;
  mode: string | null;
  status: TrainingModelStatus;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  registerPolicy: string | null;
  memo: string | null;
}

function normalizeRegisteredModel(model: ModelVersion): ModelVersion {
  return {
    ...model,
    id: Number(model.id),
    experiment_id: Number(model.experiment_id ?? 0),
    run_id: model.run_id ?? null,
    model_name: model.model_name || 'KICT-RAIN-AI',
    version: model.version,
    status: model.status || 'CREATED',
    metrics: model.metrics ?? {},
    model_path: model.model_path ?? null,
    created_at: model.created_at ?? new Date().toISOString(),
  };
}

export function loadRegisteredModels(): ModelVersion[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = JSON.parse(localStorage.getItem(REGISTERED_MODELS_KEY) ?? '[]');
    return Array.isArray(raw) ? raw.map(normalizeRegisteredModel) : [];
  } catch {
    return [];
  }
}

function saveRegisteredModels(models: ModelVersion[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(REGISTERED_MODELS_KEY, JSON.stringify(models));
}

export function saveRegisteredModel(input: {
  modelName: string;
  version: string;
  architecture: 'single' | 'multi';
  filePaths: string[];
}): ModelVersion {
  const next: ModelVersion = {
    id: Date.now(),
    experiment_id: 0,
    run_id: null,
    model_name: input.modelName,
    version: input.version,
    status: 'CREATED',
    metrics: {
      architecture: input.architecture,
      file_count: input.filePaths.length,
      registered_from: 'frontend',
    },
    model_path: input.filePaths.join(', '),
    created_at: new Date().toISOString(),
  };

  saveRegisteredModels([next, ...loadRegisteredModels()]);
  return next;
}

export function mergeRegisteredModels(models: ModelVersion[]): ModelVersion[] {
  const local = loadRegisteredModels();
  const existing = new Set(models.map(model => `${model.model_name}:${model.version}`));
  return [
    ...local.filter(model => !existing.has(`${model.model_name}:${model.version}`)),
    ...models,
  ];
}

function normalizeModelStatus(status: string | null | undefined): StoredModelStatus {
  const value = (status ?? '').toUpperCase();
  if (value === 'SELECTED') return 'SELECTED';
  if (value === 'ARCHIVED') return 'ARCHIVED';
  return 'CREATED';
}

function loadModelStatusMap(): Record<number, StoredModelStatus> {
  if (typeof window === 'undefined') return {};
  try {
    const raw: Record<string, string> = JSON.parse(localStorage.getItem(STATUS_KEY) ?? '{}');
    const map: Record<number, StoredModelStatus> = {};
    for (const [id, status] of Object.entries(raw)) {
      map[Number(id)] = normalizeModelStatus(status);
    }
    return map;
  } catch {
    return {};
  }
}

function saveModelStatusMap(map: Record<number, StoredModelStatus>): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STATUS_KEY, JSON.stringify(map));
}

function normalizeTrainingStatus(status: string | null | undefined): TrainingModelStatus {
  const value = (status ?? '').toUpperCase();
  if (value === 'QUEUED') return 'QUEUED';
  if (value === 'COMPLETED') return 'COMPLETED';
  if (value === 'FAILED') return 'FAILED';
  if (value === 'CANCELED') return 'CANCELED';
  return 'RUNNING';
}

function loadPendingTrainingMap(): Record<number, PendingTrainingModel> {
  if (typeof window === 'undefined') return {};
  try {
    const raw: Record<string, PendingTrainingModel> = JSON.parse(localStorage.getItem(PENDING_TRAINING_KEY) ?? '{}');
    const map: Record<number, PendingTrainingModel> = {};
    for (const [jobId, item] of Object.entries(raw)) {
      map[Number(jobId)] = {
        ...item,
        jobId: Number(jobId),
        status: normalizeTrainingStatus(item.status),
      };
    }
    return map;
  } catch {
    return {};
  }
}

function savePendingTrainingMap(map: Record<number, PendingTrainingModel>): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(PENDING_TRAINING_KEY, JSON.stringify(map));
}

export function applyStoredModelStatuses(models: ModelVersion[]): ModelVersion[] {
  const map = loadModelStatusMap();
  return models.map(model => (
    map[model.id] ? { ...model, status: map[model.id] } : model
  ));
}

export function saveModelStatus(
  models: ModelVersion[],
  id: number,
  status: StoredModelStatus,
): ModelVersion[] {
  const target = models.find(model => model.id === id);
  const next = models.map(model => {
    if (model.id === id) return { ...model, status };
    if (
      status === 'SELECTED' &&
      target &&
      model.model_name === target.model_name &&
      normalizeModelStatus(model.status) === 'SELECTED'
    ) {
      return { ...model, status: 'CREATED' };
    }
    return model;
  });

  const map = loadModelStatusMap();
  for (const model of next) {
    if (model.id === id || (status === 'SELECTED' && target && model.model_name === target.model_name)) {
      map[model.id] = normalizeModelStatus(model.status);
    }
  }
  saveModelStatusMap(map);

  return next;
}

export function savePendingTrainingModel(input: {
  jobId: number;
  modelName: string;
  mode: string | null;
  status: string | null;
  registerPolicy: string | null;
  memo: string | null;
}): void {
  if (typeof window === 'undefined') return;
  const map = loadPendingTrainingMap();
  map[input.jobId] = {
    jobId: input.jobId,
    modelName: input.modelName,
    mode: input.mode,
    status: normalizeTrainingStatus(input.status),
    createdAt: new Date().toISOString(),
    startedAt: null,
    finishedAt: null,
    registerPolicy: input.registerPolicy,
    memo: input.memo,
  };
  savePendingTrainingMap(map);
}

export function updatePendingTrainingStatuses(jobs: TrainingJob[]): void {
  if (typeof window === 'undefined') return;
  const map = loadPendingTrainingMap();
  let changed = false;

  for (const job of jobs) {
    const item = map[job.job_id];
    if (!item) continue;
    map[job.job_id] = {
      ...item,
      status: normalizeTrainingStatus(job.status),
      startedAt: job.started_at ?? item.startedAt,
      finishedAt: job.finished_at ?? item.finishedAt,
    };
    changed = true;
  }

  if (changed) savePendingTrainingMap(map);
}

function pendingToModel(item: PendingTrainingModel): ModelVersion {
  return {
    id: -Math.abs(item.jobId),
    experiment_id: 0,
    run_id: null,
    model_name: item.modelName,
    version: '학습 중',
    status: item.status,
    metrics: {
      architecture: item.mode,
      training_job_id: `TR-${item.jobId}`,
      training_started_at: item.startedAt,
      training_finished_at: item.finishedAt,
      training_duration: item.status === 'COMPLETED' ? '완료' : '진행 중',
      register_policy: item.registerPolicy,
      note: item.memo,
    },
    model_path: null,
    created_at: item.createdAt,
  };
}

export function mergePendingTrainingModels(models: ModelVersion[]): ModelVersion[] {
  const pending = Object.values(loadPendingTrainingMap()).map(pendingToModel);
  return [...pending, ...models];
}

// ─── 삭제(숨김) — 백엔드 DELETE 부재 대응 ────────────────────────────────────

export function loadHidden(): number[] {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(localStorage.getItem(HIDDEN_KEY) ?? '[]'); }
  catch { return []; }
}

export function hideModel(id: number): void {
  if (typeof window === 'undefined') return;
  const hidden = loadHidden();
  if (!hidden.includes(id)) localStorage.setItem(HIDDEN_KEY, JSON.stringify([...hidden, id]));
}

// ─── 모델 설명 — 백엔드 필드 부재 대응 ───────────────────────────────────────

export function getModelDesc(modelName: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const map: Record<string, string> = JSON.parse(localStorage.getItem(DESC_KEY) ?? '{}');
    return map[modelName] ?? null;
  } catch { return null; }
}

export function setModelDesc(modelName: string, desc: string): void {
  if (typeof window === 'undefined') return;
  let map: Record<string, string> = {};
  try { map = JSON.parse(localStorage.getItem(DESC_KEY) ?? '{}'); } catch { /* noop */ }
  map[modelName] = desc;
  localStorage.setItem(DESC_KEY, JSON.stringify(map));
}
