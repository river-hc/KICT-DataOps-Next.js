'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '@/lib/Layout';
import DashboardExplorer from '@/lib/DashboardExplorer';
import DashboardKanban   from '@/lib/DashboardKanban';
import {
  getTrainings,
  getExperimentJobs,
  getSystemStatus,
  getTrainingResult,
  type TrainingJob,
  type SystemStatus,
} from '@/lib/api';
import { MOCK_EXPERIMENT_JOBS, MOCK_TRAINING_JOBS } from '@/lib/mockData';

// ─── 테마 분기 ────────────────────────────────────────────────────────────────

const THEME = process.env.NEXT_PUBLIC_THEME;

export default function Page() {
  if (THEME === 'dark')   return <DashboardExplorer />;
  if (THEME === 'modern') return <DashboardKanban />;
  return <Dashboard />;
}

// ─── Types ────────────────────────────────────────────────────────────────────

type TabKey = 'RUNNING' | 'QUEUED' | 'COMPLETED' | 'FAILED';

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
                style={{ opacity: isHovered ? 0.7 : 1, transition: 'opacity 0.15황' }}
              />
            );
          })}
          <text x={CX} y={CY - 10} textAnchor="middle" fontSize="30" fontWeight="800" fill="#111827">{total}</text>
          <text x={CX} y={CY + 14} textAnchor="middle" fontSize="12" fill="#9ca3af">전체 현황</text>
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

interface ChartPoint {
  label: string;
  name: string;
  sub: string;
  job_id: number;
  mae: number;
  rmse: number;
  csi: number;
}

// 실험 TC별 결과 테이블 — 최근 완료 실험 최대 5건 (기존 성능 추이 그래프 대체, 2026-06-12 피드백)
function TcResultsTable({ pts, loading }: { pts: ChartPoint[]; loading: boolean }) {
  const router = useRouter();
  const rows = [...pts].slice(-5).reverse(); // 최신순 5건

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm h-full flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-4 pt-4 pb-2 flex-shrink-0">
        <div>
          <h3 className="text-sm font-semibold text-gray-700">실험 결과</h3>
          <p className="text-xs text-gray-400 mt-0.5">최근 완료 실험 TC 지표 · 최대 5건</p>
        </div>
        {loading && <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />}
      </div>

      {rows.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-2 text-gray-300">
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <p className="text-xs text-gray-400">지표가 있는 완료 실험이 없습니다</p>
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                {['TC', '모델', 'MAE', 'RMSE', 'CSI'].map(h => (
                  <th key={h} className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.job_id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors cursor-pointer"
                  onClick={() => router.push(`/experiment-results/${r.job_id}`)}>
                  <td className="px-4 py-2.5 max-w-[180px]">
                    <p className="text-sm font-medium text-gray-800 truncate">{r.name}</p>
                    <p className="text-[11px] text-gray-400">#{r.job_id} · {r.label}</p>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`text-xs font-semibold ${/v3/i.test(r.sub) ? 'text-emerald-600' : 'text-amber-600'}`}>
                      {r.sub}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs text-gray-700 tabular-nums">{r.mae.toFixed(3)}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-gray-700 tabular-nums">{r.rmse.toFixed(3)}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-gray-700 tabular-nums">{r.csi.toFixed(3)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── 메인 컴포넌트 ────────────────────────────────────────────────────────────

function Dashboard() {
  const [expJobs,      setExpJobs]      = useState<TrainingJob[]>([]);
  const [trainJobs,    setTrainJobs]    = useState<TrainingJob[]>([]);
  const [system,       setSystem]       = useState<SystemStatus | null>(null);
  const [loading,      setLoading]      = useState(true);
  const [chartPts,     setChartPts]     = useState<ChartPoint[]>([]);
  const [chartLoading, setChartLoading] = useState(false);
  const prevCompletedIdsRef = useRef('');

  const fetchAll = useCallback(async () => {
    await Promise.all([
      getExperimentJobs()
        .then(data => setExpJobs(data))
        .catch(() => setExpJobs(MOCK_EXPERIMENT_JOBS)),
      getTrainings()
        .then(data => setTrainJobs(data))
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

  // 완료된 잡 목록이 바뀔 때만 result 재조회
  useEffect(() => {
    const completed = expJobs
      .filter(j => j.status === 'COMPLETED')
      .sort((a, b) => a.job_id - b.job_id);
    const idsKey = completed.map(j => j.job_id).join(',');
    if (idsKey === prevCompletedIdsRef.current) return;
    prevCompletedIdsRef.current = idsKey;

    if (completed.length === 0) { setChartPts([]); return; }

    setChartLoading(true);
    Promise.all(completed.map(job => getTrainingResult(job.job_id).catch(() => null)))
      .then(results => {
        const pts: ChartPoint[] = [];
        results.forEach((result, i) => {
          if (!result?.metrics || Object.keys(result.metrics).length === 0) return;
          const job  = completed[i];
          const date = job.created_at ? new Date(job.created_at) : null;
          const label = date
            ? `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
            : '-';
          const m = result.metrics as Record<string, number>;
          pts.push({
            label,
            name:   job.experiment_name,
            sub:    result.params.model_version ?? '-',
            job_id: job.job_id,
            mae:    m.mae  ?? 0,
            rmse:   m.rmse ?? 0,
            // 전체 단일 CSI(백엔드 변경 예정) 우선, 없으면 기존 csi_10 폴백
            csi:    m.csi ?? m.csi_10 ?? 0,
          });
        });
        setChartPts(pts);
      })
      .finally(() => setChartLoading(false));
  }, [expJobs]);

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-20 text-gray-400">로딩 중...</div>
      </Layout>
    );
  }

  // expJobs·trainJobs 모두 /trainings를 조회하므로 job_id 기준으로 중복 제거
  const allJobs = Array.from(
    new Map([...expJobs, ...trainJobs].map(j => [j.job_id, j])).values()
  );
  return (
    <Layout>
      {/* 페이지 타이틀은 공통 헤더가 표시 — GPU 온라인 배지만 우측 정렬로 유지 */}
      {system?.available && (
        <div className="flex items-center justify-end gap-2 text-sm mb-4">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse inline-block" />
          <span className="text-green-600 font-medium">GPU {system.gpu_count}개 온라인</span>
        </div>
      )}

      {/* 도넛 차트 + 실험 TC 결과 테이블 (최근 작업 목록 카드는 결과 테이블 도입으로 제거 — 2026-06-12 피드백) */}
      <div className="flex gap-4 mb-6 items-stretch">
        <div className="w-[40%]">
          <StatusDonutChart jobs={allJobs} />
        </div>
        <div className="w-[60%]">
          <TcResultsTable pts={chartPts} loading={chartLoading} />
        </div>
      </div>
    </Layout>
  );
}
