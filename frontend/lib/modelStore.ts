// MLflow alias(별칭) 기법. Stage(None/Staging/Production)를 대체.
// 별칭은 모델당 이름이 유일(한 별칭 = 한 버전을 가리킴), 한 버전은 여러 별칭 보유 가능.
// 백엔드 별칭 API가 없어 클라이언트 localStorage로 오버레이 관리. 추후 실 API로 교체.

const ALIAS_KEY  = 'kict_model_aliases';  // { [modelName]: { [alias]: versionId } }
const HIDDEN_KEY = 'kict_model_hidden';   // number[] — 삭제(숨김) 처리된 버전 id
const DESC_KEY   = 'kict_model_desc';     // { [modelName]: string } — 모델 설명 편집값

// 자주 쓰는 별칭 제안 (UI 빠른 추가용)
export const ALIAS_SUGGESTIONS = ['champion', 'challenger', 'production', 'staging'];

type AliasMap = Record<string, Record<string, number>>;

// ─── 별칭 ────────────────────────────────────────────────────────────────────

function loadAliasMap(): AliasMap {
  if (typeof window === 'undefined') return {};
  try { return JSON.parse(localStorage.getItem(ALIAS_KEY) ?? '{}'); }
  catch { return {}; }
}

function saveAliasMap(map: AliasMap): void {
  localStorage.setItem(ALIAS_KEY, JSON.stringify(map));
}

/** 모델의 별칭 → 버전 id 매핑 전체 */
export function getModelAliases(modelName: string): Record<string, number> {
  return loadAliasMap()[modelName] ?? {};
}

/** 특정 버전을 가리키는 별칭 이름 목록 */
export function getVersionAliases(modelName: string, versionId: number): string[] {
  const m = getModelAliases(modelName);
  return Object.keys(m).filter(alias => m[alias] === versionId).sort();
}

/** 별칭이 현재 가리키는 버전 id (없으면 null) */
export function getAliasTarget(modelName: string, alias: string): number | null {
  return getModelAliases(modelName)[alias] ?? null;
}

/** 별칭을 버전에 부여 (이미 다른 버전에 있으면 이동) */
export function setAlias(modelName: string, alias: string, versionId: number): void {
  if (typeof window === 'undefined') return;
  const map = loadAliasMap();
  const model = { ...(map[modelName] ?? {}) };
  model[alias] = versionId;
  map[modelName] = model;
  saveAliasMap(map);
}

/** 별칭 제거 */
export function removeAlias(modelName: string, alias: string): void {
  if (typeof window === 'undefined') return;
  const map = loadAliasMap();
  if (!map[modelName]) return;
  const model = { ...map[modelName] };
  delete model[alias];
  map[modelName] = model;
  saveAliasMap(map);
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
