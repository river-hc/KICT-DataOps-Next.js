// 성능 지표 파싱.
// 지표는 추론 "전체에 대한 단일 값" (MAE / RMSE / CSI) — 선행시간별 구분 없음 (백엔드 합의: request.md 9A).
// 백엔드 result.metrics에 실데이터가 없으면 null로 반환 — 화면에는 "-"로 표시된다.

export interface MetricSummary { mae: number | null; rmse: number | null; csi: number | null; }

export interface ParsedMetrics {
  summary: MetricSummary;
}

/** 백엔드 metrics(Record)에서 전체 단일 지표 추출 */
export function parseMetrics(raw: Record<string, unknown> | null | undefined): ParsedMetrics {
  const num = (v: unknown): number | null => (typeof v === 'number' && !Number.isNaN(v) ? v : null);
  if (!raw || Object.keys(raw).length === 0) {
    return { summary: { mae: null, rmse: null, csi: null } };
  }
  const csiValues = Object.entries(raw)
    .filter(([key]) => /^csi_\d+$/i.test(key))
    .map(([, value]) => num(value))
    .filter((value): value is number => value != null);
  const csi = num(raw.csi) ?? (csiValues.length
    ? Math.round((csiValues.reduce((sum, value) => sum + value, 0) / csiValues.length) * 1000) / 1000
    : null);

  return {
    summary: { mae: num(raw.mae), rmse: num(raw.rmse), csi },
  };
}
