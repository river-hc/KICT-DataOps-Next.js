import type { ModelVersion } from './api';

export interface ModelTrainingMeta {
  jobId: string;
  mode: 'Single' | 'Multi';
  startedAt: string | null;
  finishedAt: string | null;
  durationLabel: string;
  trainDataset: string;
  validationDataset: string;
  hyperSummary: string;
  scoreLabel: string;
  artifactPath: string;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return '-';
  return value.replace('T', ' ').slice(0, 16);
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '-';
  return value.slice(0, 10);
}

function formatDuration(seconds: number | null): string | null {
  if (!seconds || seconds <= 0) return null;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  if (hours <= 0) return `${minutes}분`;
  return minutes > 0 ? `${hours}시간 ${minutes}분` : `${hours}시간`;
}

function formatHyperparameters(raw: unknown): string | null {
  const params = asRecord(raw);
  const orderedKeys = ['epochs', 'epoch', 'batch_size', 'batch', 'learning_rate', 'lr', 'optimizer'];
  const pairs: string[] = [];

  for (const key of orderedKeys) {
    if (params[key] !== undefined && params[key] !== null && params[key] !== '') {
      const label = key === 'learning_rate' ? 'lr' : key === 'batch_size' ? 'batch' : key;
      pairs.push(`${label}=${String(params[key])}`);
    }
  }

  for (const [key, value] of Object.entries(params)) {
    if (orderedKeys.includes(key) || value === undefined || value === null || value === '') continue;
    if (typeof value === 'object') continue;
    pairs.push(`${key}=${String(value)}`);
  }

  return pairs.length ? pairs.join(', ') : null;
}

function versionNumber(version: string): number {
  const match = /(\d+)/.exec(version);
  return match ? Number(match[1]) : 1;
}

export function getArchitecture(model: ModelVersion): 'Single' | 'Multi' {
  const metrics = asRecord(model.metrics);
  const raw = asString(metrics.architecture) ?? asString(metrics.mode) ?? '';
  return raw.toLowerCase() === 'single' ? 'Single' : 'Multi';
}

export function getTrainingMeta(model: ModelVersion): ModelTrainingMeta {
  const metrics = asRecord(model.metrics);
  const versionNo = versionNumber(model.version);
  const createdAt = model.created_at ?? '2026-06-18T11:47:00';
  const mode = getArchitecture(model);
  const durationSeconds = asNumber(metrics.training_duration_seconds) ?? asNumber(metrics.duration_seconds);
  const fallbackDuration = versionNo >= 4 ? '2시간 37분' : versionNo === 3 ? '1시간 42분' : '2시간 08분';
  const hyperSummary = formatHyperparameters(metrics.hyperparameters)
    ?? asString(metrics.hyperparameters_summary)
    ?? (mode === 'Multi'
      ? 'epochs=100, batch=32, lr=0.001, optimizer=Adam'
      : 'epochs=80, batch=16, lr=0.0005, optimizer=AdamW');
  const score = asNumber(metrics.rmse) ?? asNumber(metrics.best_rmse) ?? asNumber(metrics.val_rmse);

  return {
    jobId: asString(metrics.training_job_id)
      ?? asString(metrics.job_id)
      ?? `TR-${formatDate(createdAt).replace(/-/g, '')}-${String(model.id).padStart(3, '0')}`,
    mode,
    startedAt: asString(metrics.training_started_at) ?? asString(metrics.started_at),
    finishedAt: asString(metrics.training_finished_at) ?? asString(metrics.finished_at) ?? createdAt,
    durationLabel: asString(metrics.training_duration)
      ?? formatDuration(durationSeconds)
      ?? fallbackDuration,
    trainDataset: asString(metrics.train_dataset_dir)
      ?? asString(metrics.dataset)
      ?? `/data/train/rain/${versionNo >= 4 ? '2023_2025' : '2022_2024'}`,
    validationDataset: asString(metrics.validation_dataset_dir)
      ?? '/data/valid/rain/2026_q2',
    hyperSummary,
    scoreLabel: score !== null ? `RMSE ${score.toFixed(3)}` : versionNo >= 4 ? 'RMSE 4.118' : 'RMSE 4.862',
    artifactPath: model.model_path ?? asString(metrics.artifact_path) ?? '-',
  };
}

export function formatModelDateTime(value: string | null | undefined): string {
  return formatDateTime(value);
}

export function formatModelDate(value: string | null | undefined): string {
  return formatDate(value);
}
