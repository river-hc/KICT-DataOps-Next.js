// 클라이언트(localStorage)에 보관하는 실험 환경. 백엔드 experiment_id 연동 전까지
// 프론트에서 실험을 생성·관리하고, TC(실 백엔드 job)를 매핑한다.
import { DEMO_EXPERIMENT_ID, DEMO_JOB_IDS, isDemoMode } from './demoData';

export interface ClientExperiment {
  id: number;
  name: string;
  description: string;
  created_at: string;
  tc_job_ids: number[];
}

const CLIENT_EXP_KEY = 'kict_client_experiments';
const EXP_TC_MAP_KEY = 'kict_exp_tc_map';
const TC_MODEL_KEY   = 'kict_tc_model_meta';

export interface TcModelMeta {
  modelVersion: string;
  architecture: 'single' | 'multi' | null;
  requester?: string | null;
}

function ensureDemoExperimentSeed(): void {
  if (typeof window === 'undefined' || !isDemoMode()) return;
  const existing = JSON.parse(localStorage.getItem(CLIENT_EXP_KEY) ?? '[]') as ClientExperiment[];
  if (!existing.some(exp => exp.id === DEMO_EXPERIMENT_ID)) {
    const demo: ClientExperiment = {
      id: DEMO_EXPERIMENT_ID,
      name: '2026 summer',
      description: 'KICT 강우 예측 모델 성능 검증',
      created_at: new Date().toISOString(),
      tc_job_ids: DEMO_JOB_IDS,
    };
    localStorage.setItem(CLIENT_EXP_KEY, JSON.stringify([demo, ...existing]));
  }

  const map = JSON.parse(localStorage.getItem(EXP_TC_MAP_KEY) ?? '{}') as Record<number, number[]>;
  if (!Array.isArray(map[DEMO_EXPERIMENT_ID]) || map[DEMO_EXPERIMENT_ID].length === 0) {
    map[DEMO_EXPERIMENT_ID] = DEMO_JOB_IDS;
    localStorage.setItem(EXP_TC_MAP_KEY, JSON.stringify(map));
  }
}

export function loadClientExperiments(): ClientExperiment[] {
  if (typeof window === 'undefined') return [];
  try {
    ensureDemoExperimentSeed();
    return JSON.parse(localStorage.getItem(CLIENT_EXP_KEY) ?? '[]');
  }
  catch { return []; }
}

export function saveClientExperiment(exp: ClientExperiment): void {
  const existing = loadClientExperiments();
  localStorage.setItem(CLIENT_EXP_KEY, JSON.stringify([exp, ...existing.filter(e => e.id !== exp.id)]));
}

export function loadExpTcMap(): Record<number, number[]> {
  if (typeof window === 'undefined') return {};
  try {
    ensureDemoExperimentSeed();
    return JSON.parse(localStorage.getItem(EXP_TC_MAP_KEY) ?? '{}');
  }
  catch { return {}; }
}

export function addTcToExpMap(expId: number, jobId: number): void {
  const map = loadExpTcMap();
  const existing = map[expId] ?? [];
  if (!existing.includes(jobId)) {
    map[expId] = [...existing, jobId];
    localStorage.setItem(EXP_TC_MAP_KEY, JSON.stringify(map));
  }
}

/** 사용자가 이 실험에 직접 추가한 TC(실 백엔드 job) id만 반환 — localStorage 맵 기준 */
export function getUserTcJobIds(expId: number): number[] {
  return loadExpTcMap()[expId] ?? [];
}

/** 테스트케이스 삭제 시 실험 매핑에서도 제거 */
export function removeTcFromExpMap(expId: number, jobId: number): void {
  const map = loadExpTcMap();
  const existing = map[expId] ?? [];
  if (existing.includes(jobId)) {
    map[expId] = existing.filter(id => id !== jobId);
    localStorage.setItem(EXP_TC_MAP_KEY, JSON.stringify(map));
  }
}

// ─── TC 모델 메타 (백엔드 mode 응답 보정용) ─────────────────────────────────

export function saveTcModelMeta(jobId: number, meta: TcModelMeta): void {
  if (typeof window === 'undefined') return;
  let store: Record<number, TcModelMeta> = {};
  try { store = JSON.parse(localStorage.getItem(TC_MODEL_KEY) ?? '{}'); } catch { /* noop */ }
  store[jobId] = meta;
  localStorage.setItem(TC_MODEL_KEY, JSON.stringify(store));
}

export function loadTcModelMeta(jobId: number): TcModelMeta | null {
  if (typeof window === 'undefined') return null;
  try {
    const store: Record<number, TcModelMeta> = JSON.parse(localStorage.getItem(TC_MODEL_KEY) ?? '{}');
    return store[jobId] ?? null;
  } catch { return null; }
}

export function updateTcRequesterNickname(nickname: string): void {
  if (typeof window === 'undefined' || !nickname.trim()) return;
  try {
    const store: Record<number, TcModelMeta> = JSON.parse(localStorage.getItem(TC_MODEL_KEY) ?? '{}');
    let changed = false;
    Object.keys(store).forEach(key => {
      store[Number(key)] = { ...store[Number(key)], requester: nickname };
      changed = true;
    });
    if (changed) localStorage.setItem(TC_MODEL_KEY, JSON.stringify(store));
  } catch { /* noop */ }
}
