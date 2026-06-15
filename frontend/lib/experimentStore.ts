// 클라이언트(localStorage)에 보관하는 실험 환경. 백엔드 experiment_id 연동 전까지
// 프론트에서 실험을 생성·관리하고, TC(실 백엔드 job)를 매핑한다.
export interface ClientExperiment {
  id: number;
  name: string;
  description: string;
  created_at: string;
  tc_job_ids: number[];
}

const CLIENT_EXP_KEY = 'kict_client_experiments';
const EXP_TC_MAP_KEY = 'kict_exp_tc_map';
const TC_MEMO_KEY    = 'kict_tc_memo';

export function loadClientExperiments(): ClientExperiment[] {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(localStorage.getItem(CLIENT_EXP_KEY) ?? '[]'); }
  catch { return []; }
}

export function saveClientExperiment(exp: ClientExperiment): void {
  const existing = loadClientExperiments();
  localStorage.setItem(CLIENT_EXP_KEY, JSON.stringify([exp, ...existing.filter(e => e.id !== exp.id)]));
}

export function loadExpTcMap(): Record<number, number[]> {
  if (typeof window === 'undefined') return {};
  try { return JSON.parse(localStorage.getItem(EXP_TC_MAP_KEY) ?? '{}'); }
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

// ─── TC 메모 (백엔드가 experiment_memo를 응답하지 않아 클라이언트에 보관) ──────

export function saveTcMemo(jobId: number, memo: string): void {
  if (typeof window === 'undefined' || !memo) return;
  let store: Record<number, string> = {};
  try { store = JSON.parse(localStorage.getItem(TC_MEMO_KEY) ?? '{}'); } catch { /* noop */ }
  store[jobId] = memo;
  localStorage.setItem(TC_MEMO_KEY, JSON.stringify(store));
}

export function loadTcMemo(jobId: number): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const store: Record<number, string> = JSON.parse(localStorage.getItem(TC_MEMO_KEY) ?? '{}');
    return store[jobId] ?? null;
  } catch { return null; }
}
