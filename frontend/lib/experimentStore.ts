import type { MockExperiment } from './mockData';

const CLIENT_EXP_KEY = 'kict_client_experiments';
const EXP_TC_MAP_KEY = 'kict_exp_tc_map';

export function loadClientExperiments(): MockExperiment[] {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(localStorage.getItem(CLIENT_EXP_KEY) ?? '[]'); }
  catch { return []; }
}

export function saveClientExperiment(exp: MockExperiment): void {
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

export function getAllTcJobIds(exp: MockExperiment): number[] {
  const extra = loadExpTcMap()[exp.id] ?? [];
  return Array.from(new Set([...exp.tc_job_ids, ...extra]));
}
