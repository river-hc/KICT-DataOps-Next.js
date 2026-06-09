'use client';

import { useState, useEffect, useCallback } from 'react';
import { ReactNode } from 'react';
import Link from 'next/link';
import Layout from '@/lib/Layout';
import AscViewer from '@/lib/AscViewer';
import DashboardExplorer from '@/lib/DashboardExplorer';
import DashboardKanban   from '@/lib/DashboardKanban';
import {
  getTrainings,
  getSystemStatus,
  type TrainingJob,
  type SystemStatus,
} from '@/lib/api';
import type { MockDetail } from '@/lib/mockData';

// ─── 테마 분기 ────────────────────────────────────────────────────────────────

const THEME = process.env.NEXT_PUBLIC_THEME;

export default function Page() {
  if (THEME === 'dark')   return <DashboardExplorer />;
  if (THEME === 'modern') return <DashboardKanban />;
  return <Dashboard />;
}

// ─── Types ────────────────────────────────────────────────────────────────────

type TabKey = 'RUNNING' | 'QUEUED' | 'COMPLETED' | 'FAILED';

// ─── 탭 설정 ──────────────────────────────────────────────────────────────────

const TABS: {
  key: TabKey;
  label: string;
  border: string;
  text: string;
  badge: string;
  cardBorder: string;
  emptyText: string;
}[] = [
  { key: 'RUNNING',   label: '실행 중',   border: 'border-green-500',  text: 'text-green-700',  badge: 'bg-green-100 text-green-700',  cardBorder: 'border-green-400',  emptyText: '실행 중인 학습이 없습니다.' },
  { key: 'QUEUED',    label: '대기 중',   border: 'border-yellow-500', text: 'text-yellow-700', badge: 'bg-yellow-100 text-yellow-700', cardBorder: 'border-yellow-400', emptyText: '대기 중인 학습이 없습니다.' },
  { key: 'COMPLETED', label: '완료',      border: 'border-blue-500',   text: 'text-blue-700',   badge: 'bg-blue-100 text-blue-700',    cardBorder: 'border-blue-400',   emptyText: '완료된 학습이 없습니다.' },
  { key: 'FAILED',    label: '실패/취소', border: 'border-red-500',    text: 'text-red-700',    badge: 'bg-red-100 text-red-700',      cardBorder: 'border-red-400',    emptyText: '실패 또는 취소된 학습이 없습니다.' },
];

// ─── 모의 데이터 ──────────────────────────────────────────────────────────────

const MOCK_TRAININGS: TrainingJob[] = [
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

const MOCK_DETAILS: Record<number, MockDetail> = {
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
    ascUrls: {
       10: '/asc_data/QPF_202507160020-10.asc',
       20: '/asc_data/QPF_202507160020-20.asc',
       30: '/asc_data/QPF_202507160020-30.asc',
       40: '/asc_data/QPF_202507160020-40.asc',
       50: '/asc_data/QPF_202507160020-50.asc',
       60: '/asc_data/QPF_202507160020-60.asc',
       70: '/asc_data/QPF_202507160020-70.asc',
       80: '/asc_data/QPF_202507160020-80.asc',
       90: '/asc_data/QPF_202507160020-90.asc',
      100: '/asc_data/QPF_202507160020-100.asc',
      110: '/asc_data/QPF_202507160020-110.asc',
      120: '/asc_data/QPF_202507160020-120.asc',
      130: '/asc_data/QPF_202507160020-130.asc',
      140: '/asc_data/QPF_202507160020-140.asc',
      150: '/asc_data/QPF_202507160020-150.asc',
      160: '/asc_data/QPF_202507160020-160.asc',
      170: '/asc_data/QPF_202507160020-170.asc',
      180: '/asc_data/QPF_202507160020-180.asc',
    },
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

// ─── 유틸 ─────────────────────────────────────────────────────────────────────

function fmtDateTime(iso: string | null): string {
  if (!iso) return '-';
  return new Date(iso).toLocaleString('ko-KR', {
    month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

function fmtElapsed(startedAt: string | null): string {
  if (!startedAt) return '-';
  const s = Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000);
  if (s < 60) return `${s}초`;
  if (s < 3600) return `${Math.floor(s / 60)}분 ${s % 60}초`;
  return `${Math.floor(s / 3600)}시간 ${Math.floor((s % 3600) / 60)}분`;
}

function fmtDuration(start: string | null, end: string | null): string {
  if (!start || !end) return '-';
  const s = Math.floor((new Date(end).getTime() - new Date(start).getTime()) / 1000);
  if (s < 60) return `${s}초`;
  if (s < 3600) return `${Math.floor(s / 60)}분 ${s % 60}초`;
  return `${Math.floor(s / 3600)}시간 ${Math.floor((s % 3600) / 60)}분`;
}

function fmtRunDatetime(dt: string): string {
  if (!dt || dt.length < 12) return dt;
  return `${dt.slice(0,4)}-${dt.slice(4,6)}-${dt.slice(6,8)} ${dt.slice(8,10)}:${dt.slice(10,12)}`;
}

// ─── 공통 UI ─────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const s = (status ?? '').toUpperCase();
  const cls =
    s === 'RUNNING'   ? 'bg-green-100 text-green-800 border-green-200' :
    s === 'COMPLETED' ? 'bg-blue-100 text-blue-800 border-blue-200' :
    s === 'FAILED'    ? 'bg-red-100 text-red-800 border-red-200' :
    s === 'QUEUED'    ? 'bg-yellow-100 text-yellow-800 border-yellow-200' :
    'bg-gray-100 text-gray-600 border-gray-200';
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border whitespace-nowrap ${cls}`}>
      {s === 'RUNNING' && <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse inline-block" />}
      {status}
    </span>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded-lg px-4 py-3 border border-gray-200">
      <p className="text-xs text-gray-400 mb-0.5">{label}</p>
      <p className="text-sm font-semibold text-gray-900">{value}</p>
    </div>
  );
}

function InfoCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">{title}</p>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-xs text-gray-500">{label}</span>
      <span className="text-xs font-medium text-gray-900 text-right">{value}</span>
    </div>
  );
}


// ─── 아코디언 아이템 ──────────────────────────────────────────────────────────

function JobAccordion({
  job,
  detail,
  isOpen,
  onToggle,
  queuePosition,
}: {
  job: TrainingJob;
  detail: MockDetail | null;
  isOpen: boolean;
  onToggle: () => void;
  queuePosition?: number;
}) {
  const s = job.status.toUpperCase();

  return (
    <div className={`bg-white rounded-xl border shadow-sm overflow-hidden transition-shadow ${
      isOpen ? 'border-blue-200 shadow-md' : 'border-gray-200'
    }`}>

      {/* ── 헤더 ── */}
      <div
        onClick={onToggle}
        className="flex items-center gap-4 px-5 py-4 cursor-pointer select-none hover:bg-gray-50 transition-colors"
      >
        {/* 상태 / 순번 */}
        <div className="shrink-0">
          {queuePosition != null ? (
            <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-yellow-100 text-yellow-700 text-xs font-bold">
              {queuePosition}
            </span>
          ) : (
            <StatusBadge status={job.status} />
          )}
        </div>

        {/* 실험명 + 메타 */}
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900 truncate">{job.experiment_name}</p>
          <p className="text-xs text-gray-500 mt-0.5">
            {job.user_name} · {job.mode} · Job #{job.job_id}
            {job.run_id != null && ` · Run #${job.run_id}`}
          </p>
        </div>

        {/* 상태별 요약 */}
        <div className="shrink-0 text-right hidden sm:block">
          {s === 'RUNNING' && job.progress != null && (
            <div>
              <p className="text-sm font-semibold text-green-700">{job.progress}%</p>
              <p className="text-xs text-gray-400">
                {job.current_epoch != null
                  ? `Epoch ${job.current_epoch} / ${job.total_epochs}`
                  : '처리 중'}
              </p>
            </div>
          )}
          {s === 'QUEUED' && (
            <div>
              <p className="text-xs text-gray-400">등록</p>
              <p className="text-sm text-gray-600">{fmtDateTime(job.created_at)}</p>
            </div>
          )}
          {s === 'COMPLETED' && (
            <div>
              <p className="text-sm font-medium text-blue-600">{fmtDuration(job.started_at, job.finished_at)}</p>
              <p className="text-xs text-gray-400">{fmtDateTime(job.finished_at)}</p>
            </div>
          )}
          {(s === 'FAILED' || s === 'CANCELED') && (
            <p className="text-sm text-gray-500">{fmtDateTime(job.finished_at)}</p>
          )}
        </div>

        {/* 토글 화살표 */}
        <svg
          className={`w-4 h-4 text-gray-400 shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>

      {/* 진행률 바 (RUNNING만 헤더 하단에 표시) */}
      {s === 'RUNNING' && job.progress != null && (
        <div className="px-5 pb-3 -mt-1">
          <div className="w-full bg-gray-100 rounded-full h-1.5">
            <div
              className="bg-green-500 h-1.5 rounded-full transition-all duration-700"
              style={{ width: `${job.progress}%` }}
            />
          </div>
        </div>
      )}

      {/* ── 펼침 영역 ── */}
      {isOpen && (
        <div className="border-t border-gray-100 bg-gray-50 px-5 py-5 space-y-5">

          {/* 요약 stat (4개) */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard label="요청자"   value={job.user_name} />
            <StatCard label="모드"     value={job.mode} />
            <StatCard label="Run ID"  value={job.run_id != null ? `#${job.run_id}` : '-'} />
            <StatCard
              label={s === 'RUNNING' ? '경과 시간' : '소요 시간'}
              value={s === 'RUNNING' ? fmtElapsed(job.started_at) : fmtDuration(job.started_at, job.finished_at)}
            />
          </div>

          {/* COMPLETED + ASC: 왼쪽 ASC 뷰어 / 오른쪽 실험 정보 2컬럼 */}
          {s === 'COMPLETED' && detail?.params.include_preview_image && detail?.ascUrls ? (
            <div className="grid grid-cols-[3fr_7fr] gap-5">

              {/* 왼쪽: ASC 뷰어 (전체 높이 표시) */}
              <div>
                <AscViewer steps={detail.params.forecast_steps} ascUrls={detail.ascUrls} />
              </div>

              {/* 오른쪽: 실험 정보 */}
              <div className="flex flex-col gap-2">
                <div className="bg-white rounded-lg border border-gray-200 p-3">
                  <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">학습 일정</p>
                  <div className="space-y-1.5">
                    <InfoRow label="등록 시각" value={fmtDateTime(job.created_at)} />
                    <InfoRow label="시작 시각" value={fmtDateTime(job.started_at)} />
                    <InfoRow label="완료 시각" value={fmtDateTime(job.finished_at)} />
                  </div>
                </div>
                {detail && (
                  <div className="bg-white rounded-lg border border-gray-200 p-3">
                    <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">모델 설정</p>
                    <div className="space-y-1.5">
                      <InfoRow label="모델 버전"       value={detail.params.model_version} />
                      <InfoRow label="운용 시점"       value={fmtRunDatetime(detail.params.run_datetime)} />
                      <InfoRow label="미리보기 이미지" value={detail.params.include_preview_image ? '포함' : '제외'} />
                      <div className="flex justify-between items-start gap-2 pt-0.5">
                        <span className="text-xs text-gray-500 shrink-0">예측 선행시간</span>
                        <div className="flex flex-col gap-1 items-end">
                          {Array.from(
                            { length: Math.ceil(detail.params.forecast_steps.length / 9) },
                            (_, i) => detail.params.forecast_steps.slice(i * 9, i * 9 + 9)
                          ).map((row, ri) => (
                            <div key={ri} className="flex gap-1">
                              {row.map(n => (
                                <span key={n} className="text-[10px] bg-blue-50 text-blue-700 px-1 py-0.5 rounded font-medium">{n}분</span>
                              ))}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                {detail?.metrics && (
                  <div>
                    <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">성능 지표</p>
                    <div className="grid grid-cols-4 gap-1.5">
                      {Object.entries(detail.metrics).map(([key, val]) => (
                        <div key={key} className="bg-white rounded-lg p-2 border border-blue-100 text-center">
                          <p className="text-[10px] text-gray-400 font-medium uppercase mb-0.5 leading-tight">{key.replace(/_/g, ' ')}</p>
                          <p className="text-xs font-bold text-blue-700">{val.toFixed(3)}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* 그 외 상태: 기존 세로 레이아웃 */
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <InfoCard title="학습 일정">
                  <InfoRow label="등록 시각" value={fmtDateTime(job.created_at)} />
                  <InfoRow label="시작 시각" value={fmtDateTime(job.started_at)} />
                  <InfoRow label="완료 시각" value={fmtDateTime(job.finished_at)} />
                </InfoCard>
                {detail && (
                  <InfoCard title="모델 설정">
                    <InfoRow label="모델 버전"       value={detail.params.model_version} />
                    <InfoRow label="운용 시점"       value={fmtRunDatetime(detail.params.run_datetime)} />
                    <InfoRow label="예측 선행시간"   value={detail.params.forecast_steps.map(n => `${n}분`).join(', ')} />
                    <InfoRow label="미리보기 이미지" value={detail.params.include_preview_image ? '포함' : '제외'} />
                  </InfoCard>
                )}
              </div>
              {detail?.metrics && (
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">성능 지표</p>
                  <div className="grid grid-cols-4 md:grid-cols-8 gap-2">
                    {Object.entries(detail.metrics).map(([key, val]) => (
                      <div key={key} className="bg-white rounded-lg p-3 border border-blue-100 text-center">
                        <p className="text-xs text-gray-400 font-medium uppercase mb-1">{key.replace(/_/g, ' ')}</p>
                        <p className="text-sm font-bold text-blue-700">{val.toFixed(3)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {detail?.error && (
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">오류 내용</p>
                  <div className={`rounded-lg p-3 text-xs font-mono leading-relaxed whitespace-pre-wrap ${
                    s === 'CANCELED'
                      ? 'bg-white border border-gray-200 text-gray-600'
                      : 'bg-red-50 border border-red-100 text-red-700'
                  }`}>
                    {detail.error}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── 도넛 차트 ────────────────────────────────────────────────────────────────

const DONUT_SEGS: { key: TabKey; label: string; color: string }[] = [
  { key: 'RUNNING',   label: '실행 중', color: '#10b981' },
  { key: 'QUEUED',    label: '대기 중', color: '#f59e0b' },
  { key: 'COMPLETED', label: '완료',    color: '#0ea5e9' },
  { key: 'FAILED',    label: '실패',    color: '#ef4444' },
];

function StatusDonutChart({
  trainings,
  activeTab,
  onTabChange,
}: {
  trainings: TrainingJob[];
  activeTab: TabKey;
  onTabChange: (key: TabKey) => void;
}) {
  const [progress,   setProgress]   = useState(0);
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);

  useEffect(() => {
    const DURATION = 1400;
    let startTs: number | null = null;
    let raf: number;
    function tick(now: number) {
      if (startTs === null) startTs = now;
      const t     = Math.min((now - startTs) / DURATION, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setProgress(eased);
      if (t < 1) raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const counts: Record<TabKey, number> = {
    RUNNING:   trainings.filter(t => t.status === 'RUNNING').length,
    QUEUED:    trainings.filter(t => t.status === 'QUEUED').length,
    COMPLETED: trainings.filter(t => t.status === 'COMPLETED').length,
    FAILED:    trainings.filter(t => t.status === 'FAILED' || t.status === 'CANCELED').length,
  };
  const total = trainings.length;
  const R = 80, SW = 20, C = 2 * Math.PI * R, CX = 108, CY = 108;

  let cumFrac = 0;
  const arcs = DONUT_SEGS.map(seg => {
    const count    = counts[seg.key];
    const frac     = total > 0 ? count / total : 0;
    const segStart = cumFrac;
    const segEnd   = cumFrac + frac;
    const visible  = Math.max(0, Math.min(progress, segEnd) - segStart);
    const pct      = total > 0 ? Math.round((count / total) * 100) : 0;
    cumFrac        = segEnd;
    return { ...seg, count, dash: visible * C, offset: -segStart * C, pct };
  });

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col h-full">
      <div className="flex flex-col items-center px-4 py-4 gap-3 flex-1 justify-center">
        <svg viewBox="0 0 216 216" className="w-full max-w-[148px]">
          <circle cx={CX} cy={CY} r={R} fill="none" stroke="#f3f4f6" strokeWidth={SW} />
          {arcs.filter(a => a.count > 0).map(a => {
            const isActive  = activeTab === a.key;
            const isHovered = hoveredKey === a.key;
            return (
              <circle
                key={a.key}
                cx={CX} cy={CY} r={R}
                fill="none"
                stroke={a.color}
                strokeWidth={isActive ? SW + 3 : SW}
                strokeDasharray={`${a.dash} ${C - a.dash}`}
                strokeDashoffset={a.offset}
                transform={`rotate(-90 ${CX} ${CY})`}
                strokeLinecap="butt"
                onClick={() => onTabChange(a.key)}
                onMouseEnter={() => setHoveredKey(a.key)}
                onMouseLeave={() => setHoveredKey(null)}
                style={{
                  cursor: 'pointer',
                  opacity: isHovered && !isActive ? 0.7 : 1,
                  transition: 'stroke-width 0.15s, opacity 0.15s',
                }}
              />
            );
          })}
          <text x={CX} y={CY - 10} textAnchor="middle" fontSize="30" fontWeight="800" fill="#111827">{total}</text>
          <text x={CX} y={CY + 14} textAnchor="middle" fontSize="12" fill="#9ca3af">전체 잡</text>
        </svg>

        <div className="w-full grid grid-cols-2 gap-x-3 gap-y-2">
          {arcs.map(a => {
            const isActive = activeTab === a.key;
            return (
              <div
                key={a.key}
                className={`flex flex-col items-center gap-0.5 rounded-lg p-1.5 cursor-pointer transition-colors ${
                  isActive ? 'bg-gray-100' : 'hover:bg-gray-50'
                }`}
                onClick={() => onTabChange(a.key)}
              >
                <div className="flex items-center gap-1.5 w-full">
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: a.color }} />
                  <span className={`text-xs truncate ${isActive ? 'font-semibold text-gray-700' : 'text-gray-500'}`}>
                    {a.label}
                  </span>
                </div>
                <div className="flex items-baseline gap-1 w-full pl-4">
                  <span className="text-base font-bold tabular-nums" style={{ color: a.color }}>{a.count}</span>
                  <span className="text-xs text-gray-400 tabular-nums">{a.pct}%</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── 성능 추이 차트 ────────────────────────────────────────────────────────────

const CHART_PTS = [
  { label: '06-03', sub: 'v3', mae: 2.18, rmse: 3.87, csi: 0.81 },
  { label: '06-04', sub: 'v2', mae: 3.01, rmse: 5.44, csi: 0.71 },
  { label: '06-04', sub: 'v3', mae: 2.34, rmse: 4.12, csi: 0.78 },
];

function PerfLineChart() {
  const [hov, setHov] = useState<number | null>(null);
  const W = 540, H = 90;
  const p = { t: 8, r: 32, b: 24, l: 42 };
  const pw = W - p.l - p.r;
  const ph = H - p.t - p.b;
  const maxY = 6;
  const xs    = (i: number) => p.l + (pw / (CHART_PTS.length - 1)) * i;
  const ys    = (v: number) => p.t + ph - (v / maxY) * ph;
  const ysCSI = (v: number) => p.t + ph - v * ph;  // CSI: 0–1 → 전체 높이
  const maePts  = CHART_PTS.map((d, i) => `${xs(i).toFixed(1)},${ys(d.mae).toFixed(1)}`).join(' ');
  const rmsePts = CHART_PTS.map((d, i) => `${xs(i).toFixed(1)},${ys(d.rmse).toFixed(1)}`).join(' ');
  const csiPts  = CHART_PTS.map((d, i) => `${xs(i).toFixed(1)},${ysCSI(d.csi).toFixed(1)}`).join(' ');

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-3 h-full">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h3 className="text-sm font-semibold text-gray-700">성능 추이</h3>
          <p className="text-xs text-gray-400 mt-0.5">완료 실험 기준 — API 연동 전 mock</p>
        </div>
        <div className="flex gap-4 text-xs text-gray-500">
          <span className="flex items-center gap-1.5">
            <svg width="16" height="4" className="flex-shrink-0">
              <line x1="0" y1="2" x2="16" y2="2" stroke="#3b82f6" strokeWidth="2.5" />
            </svg>
            MAE
          </span>
          <span className="flex items-center gap-1.5">
            <svg width="16" height="4" className="flex-shrink-0">
              <line x1="0" y1="2" x2="16" y2="2" stroke="#fb923c" strokeWidth="2.5" />
            </svg>
            RMSE
          </span>
          <span className="flex items-center gap-1.5">
            <svg width="16" height="4" className="flex-shrink-0">
              <line x1="0" y1="2" x2="16" y2="2" stroke="#10b981" strokeWidth="2.5" />
            </svg>
            CSI_10
          </span>
        </div>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ pointerEvents: 'none' }}>
        {[0, 2, 4, 6].map(v => (
          <g key={v}>
            <line x1={p.l} y1={ys(v)} x2={p.l + pw} y2={ys(v)} stroke="#f3f4f6" strokeWidth="1" />
            <text x={p.l - 8} y={ys(v) + 4} textAnchor="end" fontSize="5" fill="#9ca3af">{v}</text>
          </g>
        ))}
        {/* CSI 우측 축 (0 / 0.5 / 1) */}
        {([0, 0.5, 1] as number[]).map(v => (
          <text key={v} x={p.l + pw + 5} y={ysCSI(v) + 4} textAnchor="start" fontSize="5" fill="#10b981">{v}</text>
        ))}
        <line x1={p.l} y1={p.t} x2={p.l} y2={p.t + ph} stroke="#e5e7eb" strokeWidth="1" />
        <line x1={p.l} y1={p.t + ph} x2={p.l + pw} y2={p.t + ph} stroke="#e5e7eb" strokeWidth="1" />
        <polyline points={rmsePts} stroke="#fb923c" strokeWidth="2" fill="none" strokeLinejoin="round" />
        <polyline points={maePts}  stroke="#3b82f6" strokeWidth="2" fill="none" strokeLinejoin="round" />
        <polyline points={csiPts}  stroke="#10b981" strokeWidth="2" fill="none" strokeLinejoin="round" />
        {CHART_PTS.map((d, i) => (
          <g key={i} style={{ pointerEvents: 'all', cursor: 'default' }}
            onMouseEnter={(e) => { e.stopPropagation(); setHov(i); }}
            onMouseLeave={(e) => { e.stopPropagation(); setHov(null); }}
          >
            <rect x={xs(i) - 24} y={p.t} width={48} height={ph} fill="transparent" />
            <circle cx={xs(i)} cy={ys(d.rmse)}   r={hov === i ? 5 : 3.5} fill="#fb923c" stroke="white" strokeWidth="1.5" />
            <circle cx={xs(i)} cy={ys(d.mae)}    r={hov === i ? 5 : 3.5} fill="#3b82f6" stroke="white" strokeWidth="1.5" />
            <circle cx={xs(i)} cy={ysCSI(d.csi)} r={hov === i ? 5 : 3.5} fill="#10b981" stroke="white" strokeWidth="1.5" />
            <text x={xs(i)} y={H - 16} textAnchor="middle" fontSize="5" fill="#9ca3af">{d.label}</text>
            <text
              x={xs(i)} y={H - 3} textAnchor="middle" fontSize="5" fontWeight="600"
              fill={d.sub === 'v3' ? '#059669' : '#d97706'}
            >
              {d.sub}
            </text>
          </g>
        ))}
      </svg>

      <div className="mt-1 h-8 flex justify-center items-center">
        {hov !== null && (
          <div className="flex items-center gap-4 bg-gray-50 border border-gray-200 rounded-lg px-4 py-1.5 text-xs">
            <span className="font-semibold text-gray-600">
              {CHART_PTS[hov].label} ({CHART_PTS[hov].sub})
            </span>
            <span className="text-blue-600">
              MAE <span className="font-mono font-bold">{CHART_PTS[hov].mae}</span>
            </span>
            <span className="text-orange-500">
              RMSE <span className="font-mono font-bold">{CHART_PTS[hov].rmse}</span>
            </span>
            <span className="text-emerald-600">
              CSI <span className="font-mono font-bold">{CHART_PTS[hov].csi}</span>
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── 메인 컴포넌트 ────────────────────────────────────────────────────────────

function Dashboard() {
  const [trainings, setTrainings]   = useState<TrainingJob[]>([]);
  const [system, setSystem]         = useState<SystemStatus | null>(null);
  const [loading, setLoading]       = useState(true);
  const [activeTab, setActiveTab]   = useState<TabKey>('RUNNING');
  const [openJobId, setOpenJobId]   = useState<number | null>(null);

  const fetchAll = useCallback(async () => {
    await Promise.all([
      getTrainings()
        .then(setTrainings)
        .catch(() => setTrainings(MOCK_TRAININGS)),
      getSystemStatus().then(setSystem).catch(() => {}),
    ]);
  }, []);

  useEffect(() => {
    fetchAll().finally(() => setLoading(false));
  }, [fetchAll]);

  useEffect(() => {
    const id = setInterval(fetchAll, 2000);
    return () => clearInterval(id);
  }, [fetchAll]);

  const grouped: Record<TabKey, TrainingJob[]> = {
    RUNNING:   trainings.filter(t => t.status === 'RUNNING'),
    QUEUED:    trainings.filter(t => t.status === 'QUEUED'),
    COMPLETED: trainings.filter(t => t.status === 'COMPLETED'),
    FAILED:    trainings.filter(t => t.status === 'FAILED' || t.status === 'CANCELED'),
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-20 text-gray-400">로딩 중...</div>
      </Layout>
    );
  }

  const activeTabMeta = TABS.find(t => t.key === activeTab)!;

  return (
    <Layout>
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">대시보드</h1>
        <div className="flex items-center gap-2 text-sm">
          {system == null ? (
            <span className="text-gray-400">시스템 확인 중...</span>
          ) : system.available ? (
            <>
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse inline-block" />
              <span className="text-green-600 font-medium">GPU {system.gpu_count}개 온라인</span>
            </>
          ) : (
            <>
              <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
              <span className="text-red-500 font-medium">GPU 오프라인</span>
            </>
          )}
        </div>
      </div>

      {/* 도넛 차트 + 성능 추이 차트 */}
      <div className="flex gap-4 mb-6 items-stretch">

        {/* 왼쪽: 상태 도넛 차트 */}
        <div className="flex-shrink-0 w-56">
          <StatusDonutChart
            trainings={trainings}
            activeTab={activeTab}
            onTabChange={key => { setActiveTab(key); setOpenJobId(null); }}
          />
        </div>

        {/* 오른쪽: 성능 추이 차트 (70% 폭) */}
        <div className="flex-1 min-w-0 flex items-stretch">
          <div className="w-[70%]">
            <PerfLineChart />
          </div>
        </div>

      </div>

      {/* 탭 바 */}
      <div className="flex border-b border-gray-200 mb-5">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => { setActiveTab(tab.key); setOpenJobId(null); }}
            className={`px-5 py-3 text-sm font-medium border-b-2 -mb-px flex items-center gap-2 transition ${
              activeTab === tab.key
                ? `${tab.border} ${tab.text}`
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            {tab.label}
            {grouped[tab.key].length > 0 && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${
                activeTab === tab.key ? tab.badge : 'bg-gray-100 text-gray-500'
              }`}>
                {grouped[tab.key].length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* 탭 콘텐츠 - 아코디언 목록 */}
      {grouped[activeTab].length === 0 ? (
        <div className="py-16 text-center text-gray-400 text-sm">{activeTabMeta.emptyText}</div>
      ) : (
        <div className="space-y-3">
          {grouped[activeTab].map((job, idx) => (
            <JobAccordion
              key={job.job_id}
              job={job}
              detail={MOCK_DETAILS[job.job_id] ?? null}
              isOpen={openJobId === job.job_id}
              onToggle={() => setOpenJobId(openJobId === job.job_id ? null : job.job_id)}
              queuePosition={activeTab === 'QUEUED' ? idx + 1 : undefined}
            />
          ))}
        </div>
      )}

    </Layout>
  );
}
