'use client';

import { useState, useEffect, useCallback } from 'react';
import Layout from '@/lib/Layout';
import DashboardExplorer from '@/lib/DashboardExplorer';
import DashboardKanban   from '@/lib/DashboardKanban';
import {
  getTrainings,
  getExperimentJobs,
  getSystemStatus,
  type TrainingJob,
  type SystemStatus,
} from '@/lib/api';
import { MOCK_EXPERIMENT_JOBS, MOCK_TRAINING_JOBS } from '@/lib/mockData';
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
type JobTab = 'experiment' | 'training';

// ─── 실험 상세 mock (버전 표시용) ──────────────────────────────────────────────

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

// ─── 도넛 차트 ────────────────────────────────────────────────────────────────

const DONUT_SEGS: { key: TabKey; label: string; color: string }[] = [
  { key: 'RUNNING',   label: '실행 중', color: '#10b981' },
  { key: 'QUEUED',    label: '대기 중', color: '#f59e0b' },
  { key: 'COMPLETED', label: '완료',    color: '#0ea5e9' },
  { key: 'FAILED',    label: '실패',    color: '#ef4444' },
];

function StatusDonutChart({ jobs }: { jobs: TrainingJob[] }) {
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
    RUNNING:   jobs.filter(t => t.status === 'RUNNING').length,
    QUEUED:    jobs.filter(t => t.status === 'QUEUED').length,
    COMPLETED: jobs.filter(t => t.status === 'COMPLETED').length,
    FAILED:    jobs.filter(t => t.status === 'FAILED' || t.status === 'CANCELED').length,
  };
  const total = jobs.length;
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
        <svg viewBox="0 0 216 216" className="w-full max-w-[296px]">
          <circle cx={CX} cy={CY} r={R} fill="none" stroke="#f3f4f6" strokeWidth={SW} />
          {arcs.filter(a => a.count > 0).map(a => {
            const isHovered = hoveredKey === a.key;
            return (
              <circle
                key={a.key}
                cx={CX} cy={CY} r={R}
                fill="none"
                stroke={a.color}
                strokeWidth={SW}
                strokeDasharray={`${a.dash} ${C - a.dash}`}
                strokeDashoffset={a.offset}
                transform={`rotate(-90 ${CX} ${CY})`}
                strokeLinecap="butt"
                onMouseEnter={() => setHoveredKey(a.key)}
                onMouseLeave={() => setHoveredKey(null)}
                style={{ opacity: isHovered ? 0.7 : 1, transition: 'opacity 0.15s' }}
              />
            );
          })}
          <text x={CX} y={CY - 10} textAnchor="middle" fontSize="30" fontWeight="800" fill="#111827">{total}</text>
          <text x={CX} y={CY + 14} textAnchor="middle" fontSize="12" fill="#9ca3af">전체 잡</text>
        </svg>

        <div className="w-full grid grid-cols-2 gap-x-3 gap-y-2">
          {arcs.map(a => (
            <div
              key={a.key}
              className="flex flex-col items-center gap-0.5 rounded-lg p-1.5 hover:bg-gray-50"
              onMouseEnter={() => setHoveredKey(a.key)}
              onMouseLeave={() => setHoveredKey(null)}
            >
              <div className="flex items-center gap-1.5 w-full">
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: a.color }} />
                <span className="text-xs truncate text-gray-500">{a.label}</span>
              </div>
              <div className="flex items-baseline gap-1 w-full pl-4">
                <span className="text-base font-bold tabular-nums" style={{ color: a.color }}>{a.count}</span>
                <span className="text-xs text-gray-400 tabular-nums">{a.pct}%</span>
              </div>
            </div>
          ))}
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
  const W = 480, H = 220;
  const p = { t: 18, r: 44, b: 40, l: 52 };
  const pw = W - p.l - p.r;
  const ph = H - p.t - p.b;
  const maxY = 6;
  const xs    = (i: number) => p.l + (pw / (CHART_PTS.length - 1)) * i;
  const ys    = (v: number) => p.t + ph - (v / maxY) * ph;
  const ysCSI = (v: number) => p.t + ph - v * ph;
  const maePts  = CHART_PTS.map((d, i) => `${xs(i).toFixed(1)},${ys(d.mae).toFixed(1)}`).join(' ');
  const rmsePts = CHART_PTS.map((d, i) => `${xs(i).toFixed(1)},${ys(d.rmse).toFixed(1)}`).join(' ');
  const csiPts  = CHART_PTS.map((d, i) => `${xs(i).toFixed(1)},${ysCSI(d.csi).toFixed(1)}`).join(' ');

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm h-full flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-4 pt-4 pb-2 flex-shrink-0">
        <div>
          <h3 className="text-sm font-semibold text-gray-700">성능 추이</h3>
          <p className="text-xs text-gray-400 mt-0.5">완료 실험 기준 — API 연동 전 mock</p>
        </div>
        <div className="flex gap-4 text-xs text-gray-500">
          <span className="flex items-center gap-1.5">
            <svg width="16" height="4" className="flex-shrink-0"><line x1="0" y1="2" x2="16" y2="2" stroke="#3b82f6" strokeWidth="2.5" /></svg>
            MAE
          </span>
          <span className="flex items-center gap-1.5">
            <svg width="16" height="4" className="flex-shrink-0"><line x1="0" y1="2" x2="16" y2="2" stroke="#fb923c" strokeWidth="2.5" /></svg>
            RMSE
          </span>
          <span className="flex items-center gap-1.5">
            <svg width="16" height="4" className="flex-shrink-0"><line x1="0" y1="2" x2="16" y2="2" stroke="#10b981" strokeWidth="2.5" /></svg>
            CSI_10
          </span>
        </div>
      </div>

      <div className="flex-1 min-h-0 px-3 pb-2">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full" preserveAspectRatio="none">
          {[0, 2, 4, 6].map(v => (
            <g key={v}>
              <line x1={p.l} y1={ys(v)} x2={p.l + pw} y2={ys(v)} stroke="#f3f4f6" strokeWidth="1" />
              <text x={p.l - 8} y={ys(v) + 4} textAnchor="end" fontSize="11" fill="#9ca3af">{v}</text>
            </g>
          ))}
          {([0, 0.5, 1] as number[]).map(v => (
            <text key={v} x={p.l + pw + 6} y={ysCSI(v) + 4} textAnchor="start" fontSize="11" fill="#10b981">{v}</text>
          ))}
          <line x1={p.l} y1={p.t} x2={p.l} y2={p.t + ph} stroke="#e5e7eb" strokeWidth="1" />
          <line x1={p.l} y1={p.t + ph} x2={p.l + pw} y2={p.t + ph} stroke="#e5e7eb" strokeWidth="1" />
          <polyline points={rmsePts} stroke="#fb923c" strokeWidth="2.5" fill="none" strokeLinejoin="round" />
          <polyline points={maePts}  stroke="#3b82f6" strokeWidth="2.5" fill="none" strokeLinejoin="round" />
          <polyline points={csiPts}  stroke="#10b981" strokeWidth="2.5" fill="none" strokeLinejoin="round" />
          {CHART_PTS.map((d, i) => (
            <g key={i} style={{ cursor: 'default' }}
              onMouseEnter={(e) => { e.stopPropagation(); setHov(i); }}
              onMouseLeave={(e) => { e.stopPropagation(); setHov(null); }}
            >
              <rect x={xs(i) - 36} y={p.t} width={72} height={ph} fill="transparent" />
              <circle cx={xs(i)} cy={ys(d.rmse)}   r={hov === i ? 7 : 5} fill="#fb923c" stroke="white" strokeWidth="2" />
              <circle cx={xs(i)} cy={ys(d.mae)}    r={hov === i ? 7 : 5} fill="#3b82f6" stroke="white" strokeWidth="2" />
              <circle cx={xs(i)} cy={ysCSI(d.csi)} r={hov === i ? 7 : 5} fill="#10b981" stroke="white" strokeWidth="2" />
              <text x={xs(i)} y={H - 22} textAnchor="middle" fontSize="11" fill="#9ca3af">{d.label}</text>
              <text
                x={xs(i)} y={H - 8} textAnchor="middle" fontSize="11" fontWeight="600"
                fill={d.sub === 'v3' ? '#059669' : '#d97706'}
              >
                {d.sub}
              </text>
            </g>
          ))}
        </svg>
      </div>

      <div className="flex-shrink-0 h-9 px-4 pb-2 flex justify-center items-center">
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
  const [expJobs,   setExpJobs]   = useState<TrainingJob[]>([]);
  const [trainJobs, setTrainJobs] = useState<TrainingJob[]>([]);
  const [system,    setSystem]    = useState<SystemStatus | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [jobTab,    setJobTab]    = useState<JobTab>('experiment');

  const fetchAll = useCallback(async () => {
    await Promise.all([
      getExperimentJobs()
        .then(data => setExpJobs(data.length ? data : MOCK_EXPERIMENT_JOBS))
        .catch(() => setExpJobs(MOCK_EXPERIMENT_JOBS)),
      getTrainings()
        .then(data => setTrainJobs(data.length ? data : MOCK_TRAINING_JOBS))
        .catch(() => setTrainJobs(MOCK_TRAINING_JOBS)),
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

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-20 text-gray-400">로딩 중...</div>
      </Layout>
    );
  }

  const allJobs    = [...expJobs, ...trainJobs];
  const currentJobs = jobTab === 'experiment' ? expJobs : trainJobs;
  const sorted = [...currentJobs]
    .sort((a, b) => new Date(b.created_at ?? '').getTime() - new Date(a.created_at ?? '').getTime())
    .slice(0, 10);

  const JOB_TABS: { key: JobTab; label: string; count: number }[] = [
    { key: 'experiment', label: '실험', count: expJobs.length },
    { key: 'training',   label: '학습', count: trainJobs.length },
  ];

  return (
    <Layout>
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">대시보드</h1>
        <div className="flex items-center gap-2 text-sm">
          {system?.available ? (
            <>
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse inline-block" />
              <span className="text-green-600 font-medium">GPU {system.gpu_count}개 온라인</span>
            </>
          ) : system != null && (
            <>
              <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
              <span className="text-red-500 font-medium">GPU 오프라인</span>
            </>
          )}
        </div>
      </div>

      {/* 도넛 차트 + 성능 추이 차트 */}
      <div className="flex gap-4 mb-6 items-stretch">
        <div className="w-[40%]">
          <StatusDonutChart jobs={allJobs} />
        </div>
        <div className="w-[60%]">
          <PerfLineChart />
        </div>
      </div>

      {/* 최근 작업 목록 */}
      <div>
        {/* 탭 */}
        <div className="flex items-center mb-3">
          <div className="flex rounded-lg overflow-hidden border border-gray-200">
            {JOB_TABS.map((tab, i) => (
              <button
                key={tab.key}
                onClick={() => setJobTab(tab.key)}
                className={`flex items-center gap-2 px-4 py-1.5 text-sm font-medium transition-colors ${
                  i > 0 ? 'border-l border-gray-200' : ''
                } ${
                  jobTab === tab.key
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                {tab.label}
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${
                  jobTab === tab.key ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-500'
                }`}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* 테이블 */}
        {sorted.length === 0 ? (
          <div className="py-16 text-center text-gray-400 text-sm">등록된 작업이 없습니다.</div>
        ) : (
          <div className="rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            {/* 컬럼 헤더 */}
            <div className="grid grid-cols-[1fr_110px_160px_130px] gap-4 px-5 py-2.5 bg-gray-50 border-b border-gray-100">
              {['이름', '상태', '모드 / 버전', '생성일자'].map(h => (
                <span key={h} className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{h}</span>
              ))}
            </div>

            {/* 행 */}
            {sorted.map((job, idx) => {
              const s       = job.status.toUpperCase();
              const version = MOCK_DETAILS[job.job_id]?.params.model_version ?? '-';
              const isLast  = idx === sorted.length - 1;
              return (
                <div
                  key={job.job_id}
                  className={`bg-white px-5 py-3.5 grid grid-cols-[1fr_110px_160px_130px] gap-4 items-center ${
                    !isLast ? 'border-b border-gray-100' : ''
                  }`}
                >
                  {/* 이름 */}
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{job.experiment_name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">#{job.job_id} · {job.user_name}</p>
                  </div>

                  {/* 상태 */}
                  <div>
                    <StatusBadge status={job.status} />
                    {s === 'RUNNING' && job.progress != null && (
                      <div className="mt-1.5 h-1 bg-gray-100 rounded-full overflow-hidden w-[90px]">
                        <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${job.progress}%` }} />
                      </div>
                    )}
                  </div>

                  {/* 모드 / 버전 */}
                  <span className="text-sm text-gray-600">{job.mode} / {version}</span>

                  {/* 생성일자 */}
                  <span className="text-sm text-gray-500 whitespace-nowrap">{fmtDateTime(job.created_at)}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}
