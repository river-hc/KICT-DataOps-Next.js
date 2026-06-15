import type { ModelVersion } from './api';

// MLflow식 운영 단계. 백엔드 Stage 모델이 불완전하여 클라이언트 localStorage로 오버레이 관리.
// 백엔드 select/archive 연동 시 이 파일만 실 API로 교체.
export type ModelStage = 'None' | 'Staging' | 'Production' | 'Archived';

export const MODEL_STAGES: ModelStage[] = ['None', 'Staging', 'Production', 'Archived'];

const STAGE_KEY  = 'kict_model_stage';   // { [versionId]: ModelStage }
const HIDDEN_KEY = 'kict_model_hidden';  // number[] — 삭제(숨김) 처리된 버전 id
const DESC_KEY   = 'kict_model_desc';    // { [modelName]: string } — 모델 설명 편집값

// ─── Stage ───────────────────────────────────────────────────────────────────

function loadStageMap(): Record<number, ModelStage> {
  if (typeof window === 'undefined') return {};
  try { return JSON.parse(localStorage.getItem(STAGE_KEY) ?? '{}'); }
  catch { return {}; }
}

/** 백엔드 status → 기본 Stage 매핑 (localStorage 오버라이드가 없을 때) */
function stageFromStatus(status: string): ModelStage {
  const s = status.toUpperCase();
  if (s === 'SELECTED' || s === 'PRODUCTION') return 'Production';
  if (s === 'ARCHIVED') return 'Archived';
  if (s === 'STAGING') return 'Staging';
  return 'None';
}

export function getStage(model: ModelVersion): ModelStage {
  return loadStageMap()[model.id] ?? stageFromStatus(model.status);
}

export function setStage(id: number, stage: ModelStage): void {
  if (typeof window === 'undefined') return;
  const map = loadStageMap();
  map[id] = stage;
  localStorage.setItem(STAGE_KEY, JSON.stringify(map));
}

// ─── 삭제(숨김) ─────────────────────────────────────────────────────────────

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

// ─── 모델 설명 ──────────────────────────────────────────────────────────────

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
