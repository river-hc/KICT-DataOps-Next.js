'use client';

/**
 * Design B — Explorer 레이아웃 (port 3001)
 * Depth 1: 사이드바 (Layout)
 * Depth 2: 3-컬럼 분리
 *   Col A (w-56)  — 상태 분포 도넛 차트 (독립 영역)
 *   Col B (w-64)  — 학습 잡 목록 + 필터 탭
 * Depth 3: Col C (flex-1) — 잡 상세 카드
 */

import { useState, useEffect } from 'react';
import Layout from './Layout';
import AscSnapshot from './AscSnapshot';
import {
  MOCK_TRAININGS, MOCK_DETAILS,
  fmtDateTime, fmtDuration, fmtElapsed, fmtRunDatetime,
  type MockDetail,
} from './mockData';
import type { TrainingJob } from './api';
import PerfHistoryTable from './PerfHistoryTable';

type StatusFilter = 'ALL' | 'RUNNING' | 'QUEUED' | 'COMPLETED' | 'FAILED';

// ─── 상태 설정 ────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { dot: string; badge: string }> = {
  RUNNING:   { dot: 'bg-emerald-500', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  QUEUED:    { dot: 'bg-amber-400',   badge: 'bg-amber-50  text-amber-700  border-amber-200'    },
  COMPLETED: { dot: 'bg-sky-500',     badge: 'bg-sky-50    text-sky-700    border-sky-200'       },
  FAILED:    { dot: 'bg-red-400',     badge: 'bg-red-50    text-red-700    border-red-200'       },
  CANCELED:  { dot: 'bg-gray-300',    badge: 'bg-gray-50   text-gray-500   border-gray-200'      },
};
const get = (s: string) => STATUS_CONFIG[s.toUpperCase()] ?? STATUS_CONFIG.CANCELED;

// ─── 컬럼 A: 도넛 차트 ───────────────────────────────────────────────────────

const CHART_SEGS = [
  { key: 'RUNNING',   label: '실행 중', color: '#10b981' },
  { key: 'QUEUED',    label: '대기 중', color: '#f59e0b' },
  { key: 'COMPLETED', label: '완료',    color: '#0ea5e9' },
  { key: 'FAILED',    label: '실패',    color: '#ef4444' },
];

function StatusDonutChart({
  onFilterChange,
  activeFilter,
}: {
  onFilterChange: (key: string) => void;
  activeFilter: string;
}) {
  const [progress,   setProgress]   = useState(0);
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);

  // 마운트 시 12시→시계방향 드로잉 애니메이션
  useEffect(() => {
    const DURATION = 1400;
    let startTs: number | null = null;
    let raf: number;

    function tick(now: number) {
      if (startTs === null) startTs = now;
      const t     = Math.min((now - startTs) / DURATION, 1);
      const eased = 1 - Math.pow(1 - t, 3); // cubic ease-out
      setProgress(eased);
      if (t < 1) raf = requestAnimationFrame(tick);
    }

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const total = MOCK_TRAININGS.length;
  const R  = 80;
  const SW = 20;
  const C  = 2 * Math.PI * R;
  const CX = 108;
  const CY = 108;

  const counts = CHART_SEGS.map(s => ({
    ...s,
    count:
      s.key === 'RUNNING'   ? MOCK_TRAININGS.filter(j => j.status === 'RUNNING').length :
      s.key === 'QUEUED'    ? MOCK_TRAININGS.filter(j => j.status === 'QUEUED').length :
      s.key === 'COMPLETED' ? MOCK_TRAININGS.filter(j => j.status === 'COMPLETED').length :
                              MOCK_TRAININGS.filter(j => j.status === 'FAILED' || j.status === 'CANCELED').length,
  }));

  let cumFrac = 0;
  const arcs = counts.map(seg => {
    const frac     = total > 0 ? seg.count / total : 0;
    const segStart = cumFrac;
    const segEnd   = cumFrac + frac;
    const visible  = Math.max(0, Math.min(progress, segEnd) - segStart);
    const pct      = total > 0 ? Math.round((seg.count / total) * 100) : 0;
    cumFrac        = segEnd;
    return { ...seg, frac, dash: visible * C, offset: -segStart * C, pct };
  });

  return (
    <div className="flex flex-col">
      {/* 섹션 헤더 */}
      <div className="px-5 py-4 border-b border-gray-100">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">상태 분포</p>
      </div>

      {/* 차트 영역 */}
      <div className="flex flex-col items-center px-4 py-4 gap-4">

        {/* SVG 도넛 */}
        <svg viewBox="0 0 216 216" className="w-full max-w-[160px]">
          {/* 배경 트랙 */}
          <circle cx={CX} cy={CY} r={R} fill="none" stroke="#f3f4f6" strokeWidth={SW} />

          {/* 세그먼트 (12시→시계방향 애니메이션) */}
          {arcs.filter(a => a.count > 0).map(a => {
            const isActive  = activeFilter === a.key;
            const isHovered = hoveredKey   === a.key;
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
                onClick={() => onFilterChange(isActive ? 'ALL' : a.key)}
                onMouseEnter={() => setHoveredKey(a.key)}
                onMouseLeave={() => setHoveredKey(null)}
                style={{
                  cursor:  'pointer',
                  opacity: isHovered && !isActive ? 0.7 : 1,
                  transition: 'stroke-width 0.15s, opacity 0.15s',
                }}
              />
            );
          })}

          {/* 중앙: 전체 수 */}
          <text x={CX} y={CY - 10} textAnchor="middle" fontSize="30" fontWeight="800" fill="#111827">
            {total}
          </text>
          <text x={CX} y={CY + 14} textAnchor="middle" fontSize="12" fill="#9ca3af">
            전체 잡
          </text>
        </svg>

        {/* 범례 (차트 하단, 2열) */}
        <div className="w-full grid grid-cols-2 gap-x-4 gap-y-2.5">
          {arcs.map(a => {
            const isActive = activeFilter === a.key;
            return (
              <div
                key={a.key}
                className={`flex flex-col items-center gap-1 rounded-lg p-1 cursor-pointer transition-colors ${
                  isActive ? 'bg-gray-100' : 'hover:bg-gray-50'
                }`}
                onClick={() => onFilterChange(isActive ? 'ALL' : a.key)}
              >
                <div className="flex items-center gap-1.5 w-full">
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ background: a.color }}
                  />
                  <span className={`text-xs truncate ${isActive ? 'font-semibold text-gray-700' : 'text-gray-500'}`}>
                    {a.label}
                  </span>
                </div>
                <div className="flex items-baseline gap-1 w-full pl-4">
                  <span className="text-base font-bold tabular-nums" style={{ color: a.color }}>
                    {a.count}
                  </span>
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

// ─── 컬럼 A: 버전 비교 막대 차트 ─────────────────────────────────────────────

const VERSION_METRICS = [
  { label: 'MAE',    v2: 3.01, v3: 2.26, max: 3.5 },
  { label: 'RMSE',   v2: 5.44, v3: 3.99, max: 6.0 },
  { label: 'CSI_10', v2: 0.71, v3: 0.80, max: 1.0 },
];

function VersionBarChart() {
  return (
    <div className="border-t border-gray-100">
      <div className="px-5 py-4">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-0.5">버전 비교</p>
        <p className="text-xs text-gray-400 mb-4">v2 vs v3 평균 성능</p>
        <div className="space-y-4">
          {VERSION_METRICS.map(m => (
            <div key={m.label}>
              <p className="text-xs font-semibold text-gray-500 mb-1.5">{m.label}</p>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs text-sky-500 font-semibold w-5">v2</span>
                <div className="flex-1 bg-gray-100 rounded-full h-2">
                  <div
                    className="bg-sky-400 h-2 rounded-full"
                    style={{ width: `${(m.v2 / m.max) * 100}%` }}
                  />
                </div>
                <span className="text-xs font-mono text-sky-600 w-8 text-right">{m.v2}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-emerald-500 font-semibold w-5">v3</span>
                <div className="flex-1 bg-gray-100 rounded-full h-2">
                  <div
                    className="bg-emerald-400 h-2 rounded-full"
                    style={{ width: `${(m.v3 / m.max) * 100}%` }}
                  />
                </div>
                <span className="text-xs font-mono text-emerald-600 w-8 text-right">{m.v3}</span>
              </div>
            </div>
          ))}
        </div>
        <div className="flex gap-3 mt-4 pt-3 border-t border-gray-100">
          <span className="flex items-center gap-1.5 text-xs text-gray-400">
            <span className="w-2 h-2 rounded-full bg-sky-400 flex-shrink-0" />
            v2 (1건)
          </span>
          <span className="flex items-center gap-1.5 text-xs text-gray-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0" />
            v3 (2건 평균)
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── 배지 ─────────────────────────────────────────────────────────────────────

function Badge({ status }: { status: string }) {
  const c = get(status);
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold border ${c.badge}`}>
      {status.toUpperCase() === 'RUNNING' && (
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
      )}
      {status}
    </span>
  );
}

// ─── 컬럼 B: 잡 카드 ─────────────────────────────────────────────────────────

function JobCard({ job, isSelected, onClick }: { job: TrainingJob; isSelected: boolean; onClick: () => void }) {
  const c = get(job.status);
  return (
    <div
      onClick={onClick}
      className={`relative rounded-xl border cursor-pointer transition-all overflow-hidden ${
        isSelected
          ? 'border-sky-400 bg-sky-50 shadow-sm'
          : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
      }`}
    >
      {/* 상단 컬러 바 */}
      <div className={`h-1 w-full ${c.dot}`} />

      <div className="px-3 py-2.5">
        {/* 상태 뱃지 + 잡 ID */}
        <div className="flex items-center justify-between mb-1.5">
          <Badge status={job.status} />
          <span className="text-xs text-gray-300 font-mono">#{job.job_id}</span>
        </div>

        {/* 실험명 */}
        <p className={`text-sm font-semibold leading-snug line-clamp-2 ${isSelected ? 'text-sky-800' : 'text-gray-800'}`}>
          {job.experiment_name}
        </p>

        {/* 메타 정보 */}
        <p className="text-xs text-gray-400 mt-1.5 truncate">
          {job.user_name} · {fmtDateTime(job.finished_at ?? job.started_at ?? job.created_at)}
        </p>

        {/* 실행 중: 진행률 바 */}
        {job.status === 'RUNNING' && job.progress != null && (
          <div className="mt-2 w-full bg-gray-100 rounded-full h-1">
            <div
              className="bg-emerald-500 h-1 rounded-full transition-all"
              style={{ width: `${job.progress}%` }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── 컬럼 C: 상세 패널 헬퍼 ──────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">{children}</p>;
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 border-b border-gray-50 last:border-b-0">
      <span className="text-xs text-gray-400 shrink-0 w-24">{label}</span>
      <span className="text-xs text-gray-800 font-medium text-right break-all font-mono">{value}</span>
    </div>
  );
}

// ─── 컬럼 C: 상세 패널 ───────────────────────────────────────────────────────

function DetailPanel({ job, detail }: { job: TrainingJob; detail: MockDetail | null }) {
  const s = job.status.toUpperCase();
  const snapshotStep = detail?.params.forecast_steps?.[Math.floor((detail.params.forecast_steps.length - 1) / 2)] ?? 60;
  const snapshotUrl  = detail?.ascUrls?.[snapshotStep];

  return (
    <div className="h-full overflow-y-auto bg-gray-50 p-6 space-y-4">

      {/* 잡 헤더 카드 */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <Badge status={job.status} />
          <span className="text-xs text-gray-400 font-mono">Job #{job.job_id}</span>
          {job.run_id && <span className="text-xs text-gray-400 font-mono">Run #{job.run_id}</span>}
        </div>
        <h2 className="text-lg font-bold text-gray-900 leading-snug">{job.experiment_name}</h2>
        <p className="text-sm text-gray-400 mt-1">{job.user_name} · {job.mode}</p>

        {s === 'RUNNING' && job.progress != null && (
          <div className="mt-4 pt-4 border-t border-gray-50">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-500">Epoch {job.current_epoch} / {job.total_epochs}</span>
              <span className="font-bold text-emerald-600">{job.progress}%</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2">
              <div className="bg-emerald-500 h-2 rounded-full" style={{ width: `${job.progress}%` }} />
            </div>
          </div>
        )}
      </div>

      {/* 학습 일정 */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <SectionLabel>학습 일정</SectionLabel>
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: '등록', val: fmtDateTime(job.created_at) },
            { label: s === 'RUNNING' ? '경과' : '소요', val: s === 'RUNNING' ? fmtElapsed(job.started_at) : fmtDuration(job.started_at, job.finished_at) },
            { label: '완료', val: fmtDateTime(job.finished_at) },
          ].map(({ label, val }) => (
            <div key={label} className="bg-gray-50 rounded-xl p-3 text-center">
              <p className="text-xs text-gray-400 mb-1">{label}</p>
              <p className="text-xs font-semibold text-gray-800 font-mono leading-snug">{val}</p>
            </div>
          ))}
        </div>
      </div>

      {/* 모델 파라미터 */}
      {detail && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <SectionLabel>모델 파라미터</SectionLabel>
          <InfoRow label="버전"      value={detail.params.model_version} />
          <InfoRow label="운용 시점" value={fmtRunDatetime(detail.params.run_datetime)} />
          <InfoRow label="선행시간"  value={detail.params.forecast_steps.map(n => `${n}분`).join(', ')} />
          <InfoRow label="미리보기"  value={detail.params.include_preview_image ? '포함' : '제외'} />
        </div>
      )}

      {/* 성능 지표 */}
      {detail?.metrics && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <SectionLabel>성능 지표</SectionLabel>
          <div className="grid grid-cols-4 gap-2">
            {Object.entries(detail.metrics).map(([k, v]) => (
              <div key={k} className="bg-sky-50 rounded-xl p-3 text-center border border-sky-100">
                <p className="text-xs text-sky-400 uppercase font-medium mb-1 leading-tight">
                  {k.replace(/_/g, '\n')}
                </p>
                <p className="text-base font-bold text-sky-700 font-mono">{v.toFixed(3)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* QPF 스냅샷 */}
      {detail?.params.include_preview_image && s === 'COMPLETED' && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <SectionLabel>QPF 예측 미리보기 (T+{snapshotStep}분)</SectionLabel>
          <div className="max-w-[180px]">
            <AscSnapshot step={snapshotStep} url={snapshotUrl} label={`T+${snapshotStep}분`} />
          </div>
          <p className="text-xs text-gray-400 mt-2">단일 프레임 스냅샷 · 전체 슬라이드는 포트 3000에서 확인</p>
        </div>
      )}

      {/* 오류 */}
      {detail?.error && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <SectionLabel>오류 내용</SectionLabel>
          <pre className={`text-xs font-mono p-3 rounded-xl border whitespace-pre-wrap leading-relaxed ${
            job.status === 'CANCELED'
              ? 'bg-gray-50 border-gray-200 text-gray-500'
              : 'bg-red-50  border-red-100  text-red-600'
          }`}>
            {detail.error}
          </pre>
        </div>
      )}
    </div>
  );
}

// ─── 메인 컴포넌트 ────────────────────────────────────────────────────────────

export default function DashboardExplorer() {
  const [filter,     setFilter]     = useState<StatusFilter>('ALL');
  const [selectedId, setSelectedId] = useState<number | null>(MOCK_TRAININGS[0]?.job_id ?? null);

  const STATUS_TABS: { key: StatusFilter; label: string; activeClass: string }[] = [
    { key: 'ALL',       label: '전체', activeClass: 'bg-gray-700    text-white' },
    { key: 'RUNNING',   label: '실행', activeClass: 'bg-emerald-500 text-white' },
    { key: 'QUEUED',    label: '대기', activeClass: 'bg-amber-400   text-white' },
    { key: 'COMPLETED', label: '완료', activeClass: 'bg-sky-500     text-white' },
    { key: 'FAILED',    label: '실패', activeClass: 'bg-red-400     text-white' },
  ];

  const filtered = MOCK_TRAININGS.filter(j =>
    filter === 'ALL' ||
    j.status === filter ||
    (filter === 'FAILED' && (j.status === 'FAILED' || j.status === 'CANCELED'))
  );

  const selectedJob    = MOCK_TRAININGS.find(j => j.job_id === selectedId) ?? null;
  const selectedDetail = selectedId != null ? (MOCK_DETAILS[selectedId] ?? null) : null;

  return (
    // fullHeight: Layout main이 padding/외부스크롤 없이 h-full로 채움
    <Layout fullHeight>
      <div className="flex h-full overflow-hidden">

        {/* ══ 컬럼 A: 상태 분포 도넛 차트 + 버전 비교 ════ */}
        <div className="w-56 flex-shrink-0 bg-white border-r border-gray-200 overflow-hidden">
          <StatusDonutChart
            onFilterChange={key => { setFilter(key as StatusFilter); setSelectedId(null); }}
            activeFilter={filter}
          />
          <VersionBarChart />
        </div>

        {/* ══ 우측: B(상단) + C(하단) — CSS Grid로 화면 비율 분할 ══ */}
        <div
          className="flex-1 min-w-0 overflow-hidden"
          style={{ display: 'grid', gridTemplateRows: '42% 58%' }}
        >

          {/* ── 컬럼 B: 학습 잡 목록 (상단 42%) ─────────── */}
          <div className="flex flex-col overflow-hidden bg-white border-b-2 border-gray-200">

            {/* 헤더 + 필터 탭 (고정) */}
            <div className="flex-shrink-0 px-4 pt-4 pb-3 border-b border-gray-100">
              <div className="flex items-center justify-between mb-2.5">
                <h2 className="text-sm font-bold text-gray-700">학습 잡 목록</h2>
                <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full font-mono">
                  {MOCK_TRAININGS.length}건
                </span>
              </div>
              <div className="flex gap-1 overflow-x-auto pb-0.5">
                {STATUS_TABS.map(tab => (
                  <button
                    key={tab.key}
                    onClick={() => setFilter(tab.key)}
                    className={`px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap flex-shrink-0 transition-colors ${
                      filter === tab.key
                        ? tab.activeClass
                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 필터 결과 수 (고정) */}
            <div className="flex-shrink-0 px-4 py-1.5 border-b border-gray-50">
              <p className="text-xs text-gray-400">{filtered.length}건 표시 중</p>
            </div>

            {/* 잡 카드 목록 — 내부 스크롤 */}
            <div className="flex-1 min-h-0 overflow-y-auto p-3">
              <div className="grid grid-cols-2 gap-2">
                {filtered.map(job => (
                  <JobCard
                    key={job.job_id}
                    job={job}
                    isSelected={selectedId === job.job_id}
                    onClick={() => setSelectedId(job.job_id)}
                  />
                ))}
              </div>
              {filtered.length === 0 && (
                <p className="text-center text-gray-400 text-sm py-10">해당 잡이 없습니다.</p>
              )}
            </div>
          </div>

          {/* ── 컬럼 C: 잡 상세 (하단 58%) — 내부 스크롤 ── */}
          <div className="overflow-hidden">
            {selectedJob ? (
              <DetailPanel job={selectedJob} detail={selectedDetail} />
            ) : (
              <div className="h-full overflow-y-auto bg-gray-50 p-4">
                <PerfHistoryTable accentCls="text-sky-600 bg-sky-50" />
              </div>
            )}
          </div>

        </div>
      </div>
    </Layout>
  );
}
