// 성능 지표 파싱·샘플 생성.
// 지표는 추론 "전체에 대한 단일 값" (MAE / RMSE / CSI) — 선행시간별 구분 없음 (백엔드 합의: request.md 9A).
// 백엔드 result.metrics가 채워지면 parseMetrics가 실데이터를 쓰고, 비어 있으면 화면 확인용
// 샘플(데모) 지표로 폴백한다. (isSample 플래그로 UI에 "샘플" 배지 표시)

export interface MetricSummary { mae: number | null; rmse: number | null; csi: number | null; }

export interface ParsedMetrics {
  summary: MetricSummary;
  isSample: boolean;
}

const r3 = (n: number) => Math.round(n * 1000) / 1000;

/** 백엔드 metrics(Record)에서 전체 단일 지표 추출 */
export function parseMetrics(raw: Record<string, unknown> | null | undefined): ParsedMetrics {
  const num = (v: unknown): number | null => (typeof v === 'number' && !Number.isNaN(v) ? v : null);
  if (!raw || Object.keys(raw).length === 0) {
    return { summary: { mae: null, rmse: null, csi: null }, isSample: false };
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
    isSample: false,
  };
}

/** 모델 버전 품질 계수 (v3 > v2 > v1) */
function qualityOf(version: string | null | undefined): number {
  const v = (version ?? '').toLowerCase();
  if (v.includes('3')) return 1.0;
  if (v.includes('2')) return 0.92;
  return 0.85;
}

/**
 * 화면 확인용 샘플 지표(전체 단일 값). 버전 품질이 높을수록 CSI↑·오차↓.
 * jobId로 결정적(deterministic) 미세 변동 → 같은 TC는 항상 같은 값.
 */
export function sampleMetrics(jobId: number, version: string | null | undefined): ParsedMetrics {
  const q = qualityOf(version);
  const jitter = ((jobId * 2654435761) % 1000) / 1000 * 0.04; // 0~0.04
  const mae  = r3(3.4 - q * 1.4 + jitter);          // v3≈2.0, v2≈2.13, v1≈2.21 (+미세변동)
  const rmse = r3(mae * 1.7 + 0.3);
  const csi  = r3(Math.min(1, 0.50 + q * 0.27 - jitter)); // v3≈0.77, v2≈0.748, v1≈0.73
  return { summary: { mae, rmse, csi }, isSample: true };
}

/** 실데이터가 있으면 그대로, 없으면 샘플로 폴백 */
export function metricsOrSample(
  raw: Record<string, unknown> | null | undefined,
  jobId: number,
  version: string | null | undefined,
): ParsedMetrics {
  const parsed = parseMetrics(raw);
  const hasReal = parsed.summary.csi != null || parsed.summary.mae != null || parsed.summary.rmse != null;
  return hasReal ? parsed : sampleMetrics(jobId, version);
}
