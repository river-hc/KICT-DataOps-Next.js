import type { TrainingJob } from './api';

// ─── 타입 ─────────────────────────────────────────────────────────────────────

export interface MockDetail {
  params: {
    model_version: string;
    forecast_steps: number[];
    include_preview_image: boolean;
    run_datetime: string;
  };
  metrics: Record<string, number> | null;
  error?: string;
  ascUrls?: Record<number, string>;
}

// ─── 모의 데이터 ──────────────────────────────────────────────────────────────

export const MOCK_TRAININGS: TrainingJob[] = [
  {
    job_id: 1, user_name: 'admin', experiment_name: '2026-06-05 10:00 QPE 실험 (v3)',
    mode: 'single', status: 'RUNNING', progress: 67, current_epoch: 67, total_epochs: 100,
    run_id: null, created_at: '2026-06-05T09:55:00', started_at: '2026-06-05T10:00:00', finished_at: null,
  },
  {
    job_id: 2, user_name: 'researcher1', experiment_name: '2026-06-05 09:00 강수 검증 실험',
    mode: 'multi', status: 'QUEUED', progress: null, current_epoch: null, total_epochs: null,
    run_id: null, created_at: '2026-06-05T09:50:00', started_at: null, finished_at: null,
  },
  {
    job_id: 3, user_name: 'admin', experiment_name: '2026-06-04 15:00 야간 예보 실험',
    mode: 'single', status: 'QUEUED', progress: null, current_epoch: null, total_epochs: null,
    run_id: null, created_at: '2026-06-05T09:58:00', started_at: null, finished_at: null,
  },
  {
    job_id: 4, user_name: 'admin', experiment_name: '2026-06-04 12:00 오후 QPE (v3)',
    mode: 'single', status: 'COMPLETED', progress: 100, current_epoch: 100, total_epochs: 100,
    run_id: 12, created_at: '2026-06-04T11:55:00', started_at: '2026-06-04T12:00:00', finished_at: '2026-06-04T12:18:34',
  },
  {
    job_id: 5, user_name: 'researcher1', experiment_name: '2026-06-04 09:00 오전 QPE (v2)',
    mode: 'single', status: 'COMPLETED', progress: 100, current_epoch: 100, total_epochs: 100,
    run_id: 11, created_at: '2026-06-04T08:55:00', started_at: '2026-06-04T09:00:00', finished_at: '2026-06-04T09:22:10',
  },
  {
    job_id: 6, user_name: 'admin', experiment_name: '2026-06-03 18:00 저녁 예보 검증 (v3)',
    mode: 'multi', status: 'COMPLETED', progress: 100, current_epoch: 100, total_epochs: 100,
    run_id: 10, created_at: '2026-06-03T17:55:00', started_at: '2026-06-03T18:00:00', finished_at: '2026-06-03T18:35:20',
  },
  {
    job_id: 7, user_name: 'researcher2', experiment_name: '2026-06-03 14:00 오후 QPE 테스트',
    mode: 'single', status: 'FAILED', progress: 23, current_epoch: 23, total_epochs: 100,
    run_id: null, created_at: '2026-06-03T13:55:00', started_at: '2026-06-03T14:00:00', finished_at: '2026-06-03T14:08:15',
  },
  {
    job_id: 8, user_name: 'admin', experiment_name: '2026-06-02 10:00 구형 모델 비교 (v2)',
    mode: 'single', status: 'CANCELED', progress: null, current_epoch: null, total_epochs: null,
    run_id: null, created_at: '2026-06-02T09:55:00', started_at: null, finished_at: '2026-06-02T09:57:00',
  },
];

export const MOCK_DETAILS: Record<number, MockDetail> = {
  1: {
    params: { model_version: 'v3', forecast_steps: [10,20,30,60,90,120,180], include_preview_image: true, run_datetime: '202606051000' },
    metrics: null,
  },
  2: {
    params: { model_version: 'v3', forecast_steps: [10,20,30,60], include_preview_image: true, run_datetime: '202606050900' },
    metrics: null,
  },
  3: {
    params: { model_version: 'v3', forecast_steps: [30,60,90,120], include_preview_image: false, run_datetime: '202606041500' },
    metrics: null,
  },
  4: {
    params: {
      model_version: 'v3',
      forecast_steps: [10,20,30,40,50,60,70,80,90,100,110,120,130,140,150,160,170,180],
      include_preview_image: true,
      run_datetime: '202507160020',
    },
    metrics: { mae: 2.34, rmse: 4.12, csi_10: 0.78, csi_20: 0.65, csi_30: 0.52, pod: 0.82, far: 0.18, bias: 1.05 },
    ascUrls: Object.fromEntries(
      [10,20,30,40,50,60,70,80,90,100,110,120,130,140,150,160,170,180]
        .map(s => [s, `/asc_data/QPF_202507160020-${s}.asc`])
    ),
  },
  5: {
    params: { model_version: 'v2', forecast_steps: [10,20,30,60,90,120,180], include_preview_image: true, run_datetime: '202606040900' },
    metrics: { mae: 3.01, rmse: 5.44, csi_10: 0.71, csi_20: 0.58, csi_30: 0.44, pod: 0.76, far: 0.24, bias: 0.98 },
  },
  6: {
    params: { model_version: 'v3', forecast_steps: [10,20,30,60,90,120,180], include_preview_image: true, run_datetime: '202606031800' },
    metrics: { mae: 2.18, rmse: 3.87, csi_10: 0.81, csi_20: 0.69, csi_30: 0.57, pod: 0.85, far: 0.15, bias: 1.02 },
  },
  7: {
    params: { model_version: 'v3', forecast_steps: [10,20,30,60], include_preview_image: true, run_datetime: '202606031400' },
    metrics: null,
    error: 'CUDA out of memory. Tried to allocate 2.00 GiB (GPU 0; 23.69 GiB total capacity; 21.18 GiB already allocated)',
  },
  8: {
    params: { model_version: 'v2', forecast_steps: [10,20,30,60,90,120,180], include_preview_image: true, run_datetime: '202606021000' },
    metrics: null,
    error: '사용자에 의해 취소되었습니다.',
  },
};

// QPF 예보 단계별 최대 강수량 (Design C 막대 차트용 모의값, mm)
export const QPF_PEAK: Record<number, number> = {
  10: 0.3, 20: 2.1, 30: 3.8, 40: 7.5, 50: 6.2, 60: 5.1,
  70: 5.8, 80: 4.9, 90: 3.7, 100: 3.2, 110: 2.8, 120: 4.1,
  130: 0.4, 140: 1.9, 150: 2.6, 160: 0.5, 170: 0.6, 180: 7.5,
};

// ─── 공유 유틸 ────────────────────────────────────────────────────────────────

export function fmtDateTime(iso: string | null): string {
  if (!iso) return '-';
  return new Date(iso).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export function fmtDuration(start: string | null, end: string | null): string {
  if (!start || !end) return '-';
  const s = Math.floor((new Date(end).getTime() - new Date(start).getTime()) / 1000);
  if (s < 60) return `${s}초`;
  if (s < 3600) return `${Math.floor(s / 60)}분 ${s % 60}초`;
  return `${Math.floor(s / 3600)}시간 ${Math.floor((s % 3600) / 60)}분`;
}

export function fmtElapsed(startedAt: string | null): string {
  if (!startedAt) return '-';
  const s = Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000);
  if (s < 60) return `${s}초`;
  if (s < 3600) return `${Math.floor(s / 60)}분 ${s % 60}초`;
  return `${Math.floor(s / 3600)}시간 ${Math.floor((s % 3600) / 60)}분`;
}

export function fmtRunDatetime(dt: string): string {
  if (!dt || dt.length < 12) return dt;
  return `${dt.slice(0,4)}-${dt.slice(4,6)}-${dt.slice(6,8)} ${dt.slice(8,10)}:${dt.slice(10,12)}`;
}

// ─── 학습 결과 (모델 가중치 학습 이력) ────────────────────────────────────────

export interface MockTrainingRun {
  run_id:           number;
  experiment_name:  string;
  model_version:    string;
  mode:             string;
  created_by:       string;
  started_at:       string;
  finished_at:      string;
  duration_seconds: number;
  params: {
    total_epochs:     number;
    batch_size:       number;
    learning_rate:    number;
    train_period:     string;
    base_checkpoint:  string | null;
  };
  training_metrics: {
    best_epoch:       number;
    best_val_loss:    number;
    final_train_loss: number;
    final_val_loss:   number;
  };
}

export const MOCK_TRAINING_RUNS: MockTrainingRun[] = [
  {
    run_id: 15,
    experiment_name: 'QPF v3 기반 모델 학습 (2024 데이터)',
    model_version: 'v3', mode: 'single', created_by: 'admin',
    started_at: '2026-06-02T09:00:00', finished_at: '2026-06-02T11:37:00',
    duration_seconds: 9420,
    params: {
      total_epochs: 100, batch_size: 32, learning_rate: 0.001,
      train_period: '2023-01 ~ 2024-12', base_checkpoint: null,
    },
    training_metrics: { best_epoch: 87, best_val_loss: 0.0354, final_train_loss: 0.0321, final_val_loss: 0.0389 },
  },
  {
    run_id: 14,
    experiment_name: 'QPF v3 파인튜닝 (최신 데이터 추가)',
    model_version: 'v3', mode: 'single', created_by: 'researcher1',
    started_at: '2026-05-20T14:00:00', finished_at: '2026-05-20T15:12:00',
    duration_seconds: 4320,
    params: {
      total_epochs: 50, batch_size: 16, learning_rate: 0.0005,
      train_period: '2024-06 ~ 2025-12', base_checkpoint: 'checkpoint_run15_epoch87.pt',
    },
    training_metrics: { best_epoch: 43, best_val_loss: 0.0341, final_train_loss: 0.0298, final_val_loss: 0.0368 },
  },
  {
    run_id: 13,
    experiment_name: 'QPF v3 아키텍처 개선 실험',
    model_version: 'v3', mode: 'multi', created_by: 'admin',
    started_at: '2026-05-10T10:00:00', finished_at: '2026-05-10T12:48:00',
    duration_seconds: 10080,
    params: {
      total_epochs: 100, batch_size: 32, learning_rate: 0.001,
      train_period: '2023-01 ~ 2025-12', base_checkpoint: null,
    },
    training_metrics: { best_epoch: 92, best_val_loss: 0.0348, final_train_loss: 0.0305, final_val_loss: 0.0371 },
  },
  {
    run_id: 9,
    experiment_name: 'QPF v2 초기 모델 학습',
    model_version: 'v2', mode: 'single', created_by: 'researcher2',
    started_at: '2026-03-15T09:00:00', finished_at: '2026-03-15T11:42:00',
    duration_seconds: 9720,
    params: {
      total_epochs: 80, batch_size: 32, learning_rate: 0.001,
      train_period: '2021-01 ~ 2023-12', base_checkpoint: null,
    },
    training_metrics: { best_epoch: 61, best_val_loss: 0.0487, final_train_loss: 0.0456, final_val_loss: 0.0512 },
  },
];

// ─── 성능 추이 차트 / 이력 테이블 공유 데이터 ─────────────────────────────────

export interface PerfHistoryRow {
  run_id:   number;
  name:     string;
  version:  string;
  mode:     string;
  date:     string;
  duration: number;
  mae:      number;
  rmse:     number;
  csi:      number;
}

export const PERF_CHART_DATA: Array<{ label: string; sub: string; mae: number; rmse: number }> = [
  { label: '06-03', sub: 'v3', mae: 2.18, rmse: 3.87 },
  { label: '06-04', sub: 'v2', mae: 3.01, rmse: 5.44 },
  { label: '06-04', sub: 'v3', mae: 2.34, rmse: 4.12 },
];

export const PERF_HISTORY: PerfHistoryRow[] = [
  { run_id: 12, name: '2026-06-04 12:00 오후 QPE',  version: 'v3', mode: 'single',
    date: '2026-06-04T12:00:00', duration: 1114, mae: 2.34, rmse: 4.12, csi: 0.78 },
  { run_id: 11, name: '2026-06-04 09:00 오전 QPE',  version: 'v2', mode: 'single',
    date: '2026-06-04T09:00:00', duration: 1330, mae: 3.01, rmse: 5.44, csi: 0.71 },
  { run_id: 10, name: '2026-06-03 18:00 저녁 예보', version: 'v3', mode: 'multi',
    date: '2026-06-03T18:00:00', duration: 2120, mae: 2.18, rmse: 3.87, csi: 0.81 },
];
