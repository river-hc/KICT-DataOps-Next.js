'use client';

/**
 * Design C — Top Nav + Vertical Accordion (port 3002, modern/violet theme)
 * Depth 1: 상단 네비게이션 바 (드롭다운 메뉴)
 * Depth 2: 상태별 섹션 목록 (위→아래 수직 배치)
 * Depth 3: 잡 항목 클릭 시 하단으로 펼쳐지는 상세 드롭다운
 */

import { useState, useCallback } from 'react';
import Link from 'next/link';
import Layout from './Layout';
import {
  MOCK_TRAININGS, MOCK_DETAILS, QPF_PEAK,
  PERF_HISTORY,
  fmtDateTime, fmtDuration, fmtElapsed, fmtRunDatetime,
  type MockDetail,
} from './mockData';
import { displayUsername, formatExecutionName, type TrainingJob } from './api';

// ─── 상태 섹션 설정 ───────────────────────────────────────────────────────────

const SECTIONS = [
  {
    key:      'RUNNING',
    label:    '실행 중',
    statuses: ['RUNNING'] as string[],
    sectionBg:   'bg-emerald-50  border-emerald-200',
    sectionText: 'text-emerald-700',
    dot:         'bg-emerald-500',
    accentBar:   'border-l-emerald-500',
    badgeCls:    'bg-emerald-100 text-emerald-700',
  },
  {
    key:      'QUEUED',
    label:    '대기 중',
    statuses: ['QUEUED'] as string[],
    sectionBg:   'bg-amber-50   border-amber-200',
    sectionText: 'text-amber-700',
    dot:         'bg-amber-400',
    accentBar:   'border-l-amber-400',
    badgeCls:    'bg-amber-100  text-amber-700',
  },
  {
    key:      'COMPLETED',
    label:    '완료',
    statuses: ['COMPLETED'] as string[],
    sectionBg:   'bg-violet-50  border-violet-200',
    sectionText: 'text-violet-700',
    dot:         'bg-violet-500',
    accentBar:   'border-l-violet-500',
    badgeCls:    'bg-violet-100 text-violet-700',
  },
  {
    key:      'FAILED',
    label:    '실패 / 취소',
    statuses: ['FAILED', 'CANCELED'] as string[],
    sectionBg:   'bg-red-50     border-red-200',
    sectionText: 'text-red-700',
    dot:         'bg-red-400',
    accentBar:   'border-l-red-400',
    badgeCls:    'bg-red-100    text-red-700',
  },
] as const;

// ─── 성능 스파크라인 ──────────────────────────────────────────────────────────

function Sparkline({ values, stroke }: { values: number[]; stroke: string }) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const W = 72, H = 28;
  const pts = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * W;
      const y = H - ((v - min) / ((max - min) || 1)) * H;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  const lastX = ((values.length - 1) / (values.length - 1)) * W;
  const lastV = values[values.length - 1];
  const lastY = H - ((lastV - min) / ((max - min) || 1)) * H;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-18 h-7" style={{ width: 72, height: 28 }}>
      <polyline
        points={pts}
        fill="none"
        stroke={stroke}
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle cx={lastX} cy={lastY} r="2.5" fill={stroke} />
    </svg>
  );
}

function SparklinePanel() {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">MAE 추이</p>
        <div className="flex items-end justify-between">
          <div>
            <p className="text-2xl font-bold text-gray-800 tabular-nums">2.18</p>
            <p className="text-xs text-gray-400 mt-0.5">최저 기록 (v3)</p>
          </div>
          <Sparkline values={[2.18, 3.01, 2.34]} stroke="#3b82f6" />
        </div>
        <div className="mt-3 pt-3 border-t border-gray-50 flex items-center gap-2">
          <span className="px-1.5 py-0.5 rounded text-xs bg-emerald-100 text-emerald-700 font-semibold">v3</span>
          <span className="text-xs text-gray-400">v2 대비 MAE 0.75 개선</span>
        </div>
      </div>
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">RMSE 추이</p>
        <div className="flex items-end justify-between">
          <div>
            <p className="text-2xl font-bold text-gray-800 tabular-nums">3.87</p>
            <p className="text-xs text-gray-400 mt-0.5">최저 기록 (v3)</p>
          </div>
          <Sparkline values={[3.87, 5.44, 4.12]} stroke="#f97316" />
        </div>
        <div className="mt-3 pt-3 border-t border-gray-50 flex items-center gap-2">
          <span className="px-1.5 py-0.5 rounded text-xs bg-emerald-100 text-emerald-700 font-semibold">v3</span>
          <span className="text-xs text-gray-400">v2 대비 RMSE 1.45 개선</span>
        </div>
      </div>
    </div>
  );
}

// ─── 우측 상단 이력 박스 (컴팩트) ────────────────────────────────────────────

function CompactHistoryBox() {
  const [open, setOpen] = useState(true);
  const bestMae  = Math.min(...PERF_HISTORY.map(r => r.mae));
  const bestRmse = Math.min(...PERF_HISTORY.map(r => r.rmse));
  const bestCsi  = Math.max(...PERF_HISTORY.map(r => r.csi));

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div
        className="px-4 py-3 flex items-center justify-between cursor-pointer select-none hover:bg-gray-50 transition-colors"
        onClick={() => setOpen(v => !v)}
      >
        <div className="flex items-center gap-2">
          <p className="text-xs font-bold text-gray-700">학습 이력</p>
          <span className="text-[10px] text-gray-400">최근 {PERF_HISTORY.length}건</span>
        </div>
        <svg
          viewBox="0 0 12 12"
          className={`w-4 h-4 text-gray-400 transition-transform duration-200 flex-shrink-0 ${open ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" strokeWidth={2}
          strokeLinecap="round" strokeLinejoin="round"
        >
          <path d="M2 4l4 4 4-4" />
        </svg>
      </div>
      {open && <div className="border-t border-gray-50" />}
      {open && <div className="overflow-y-auto" style={{ maxHeight: 260 }}>
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-2 py-2 text-left text-[10px] font-semibold text-gray-400">Ver</th>
              <th className="px-2 py-2 text-right text-[10px] font-semibold text-gray-400">MAE</th>
              <th className="px-2 py-2 text-right text-[10px] font-semibold text-gray-400">RMSE</th>
              <th className="px-2 py-2 text-right text-[10px] font-semibold text-gray-400">CSI</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {PERF_HISTORY.map(row => {
              const isBestMae  = row.mae  === bestMae;
              const isBestRmse = row.rmse === bestRmse;
              const isBestCsi  = row.csi  === bestCsi;
              return (
                <tr key={row.run_id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-2 py-2.5">
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                      row.version === 'v3'
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-sky-100 text-sky-700'
                    }`}>
                      {row.version}
                    </span>
                  </td>
                  <td className={`px-2 py-2.5 text-right font-mono font-semibold text-[11px] ${
                    isBestMae ? 'text-emerald-600' : 'text-gray-700'
                  }`}>
                    <span className="block">{row.mae.toFixed(2)}</span>
                    {isBestMae && <span className="text-[9px] text-emerald-400 font-normal leading-none">best</span>}
                  </td>
                  <td className={`px-2 py-2.5 text-right font-mono font-semibold text-[11px] ${
                    isBestRmse ? 'text-emerald-600' : 'text-gray-700'
                  }`}>
                    <span className="block">{row.rmse.toFixed(2)}</span>
                    {isBestRmse && <span className="text-[9px] text-emerald-400 font-normal leading-none">best</span>}
                  </td>
                  <td className={`px-2 py-2.5 text-right font-mono text-[11px] ${
                    isBestCsi ? 'text-emerald-600 font-semibold' : 'text-gray-500'
                  }`}>
                    <span className="block">{row.csi.toFixed(2)}</span>
                    {isBestCsi && <span className="text-[9px] text-emerald-400 font-normal leading-none">best</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>}
    </div>
  );
}

// ─── QPF 막대 차트 ────────────────────────────────────────────────────────────

function QpfBarChart({ steps }: { steps: number[] }) {
  const MAX_MM = 8;
  const bars = steps.map(s => ({ step: s, peak: QPF_PEAK[s] ?? 0 }));

  return (
    <div>
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
        QPF 예측 강수량 (최대값 mm)
      </p>
      <div className="flex items-end gap-0.5 h-20 bg-gray-50 rounded-lg px-2 pt-2 pb-1 border border-gray-100">
        {bars.map(({ step, peak }) => {
          const pct = Math.max(Math.round((peak / MAX_MM) * 100), 2);
          const color =
            peak < 1 ? 'bg-sky-300'    :
            peak < 3 ? 'bg-blue-400'   :
            peak < 5 ? 'bg-violet-400' :
            peak < 7 ? 'bg-violet-600' :
                       'bg-violet-800';
          return (
            <div key={step} className="flex-1 flex flex-col items-center group relative">
              <div className={`w-full rounded-t-sm ${color}`} style={{ height: `${pct}%` }} />
              <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs rounded px-1.5 py-0.5 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                T+{step}: {peak}mm
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex justify-between text-xs text-gray-400 mt-1 px-1">
        <span>T+10</span>
        <span>T+90</span>
        <span>T+180</span>
      </div>
    </div>
  );
}

// ─── 펼침 상세 내용 ───────────────────────────────────────────────────────────

function ExpandedDetail({ job, detail }: { job: TrainingJob; detail: MockDetail | null }) {
  const s = job.status.toUpperCase();

  return (
    <div className="px-6 pt-4 pb-6 bg-gray-50 border-t border-gray-100 space-y-4">

      {/* 학습 일정 (3열 그리드) */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: '등록',                              val: fmtDateTime(job.created_at) },
          { label: s === 'RUNNING' ? '경과 시간' : '소요 시간', val: s === 'RUNNING' ? fmtElapsed(job.started_at) : fmtDuration(job.started_at, job.finished_at) },
          { label: '완료',                              val: fmtDateTime(job.finished_at) },
        ].map(({ label, val }) => (
          <div key={label} className="bg-white rounded-xl p-3 border border-gray-100 shadow-sm text-center">
            <p className="text-xs text-gray-400 mb-1">{label}</p>
            <p className="text-xs font-semibold text-gray-800 font-mono leading-snug">{val}</p>
          </div>
        ))}
      </div>

      {/* RUNNING 진행 바 */}
      {s === 'RUNNING' && job.progress != null && (
        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-gray-500">Epoch {job.current_epoch} / {job.total_epochs}</span>
            <span className="font-bold text-emerald-600">{job.progress}%</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2.5">
            <div
              className="bg-emerald-500 h-2.5 rounded-full transition-all"
              style={{ width: `${job.progress}%` }}
            />
          </div>
        </div>
      )}

      {/* 모델 파라미터 + 성능 지표 (2열) */}
      {detail && (
        <div className={`grid gap-4 ${detail.metrics ? 'grid-cols-2' : 'grid-cols-1'}`}>

          {/* 모델 파라미터 */}
          <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">모델 파라미터</p>
            <div className="space-y-2.5">
              {[
                ['버전',        detail.params.model_version],
                ['운용 시점',   fmtRunDatetime(detail.params.run_datetime)],
                ['선행시간',    detail.params.forecast_steps.map(n => `${n}분`).join(', ')],
                ['미리보기',    detail.params.include_preview_image ? '포함' : '제외'],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between items-start gap-3 text-xs">
                  <span className="text-gray-400 shrink-0">{k}</span>
                  <span className="text-gray-800 font-medium text-right font-mono break-all">{v}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 성능 지표 */}
          {detail.metrics && (
            <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">성능 지표</p>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(detail.metrics).map(([k, v]) => (
                  <div key={k} className="bg-violet-50 rounded-xl p-2.5 text-center border border-violet-100">
                    <p className="text-xs text-violet-400 uppercase font-medium mb-1 leading-tight">
                      {k.replace(/_/g, ' ')}
                    </p>
                    <p className="text-sm font-bold text-violet-700 font-mono">{v.toFixed(3)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* QPF 막대 차트 (완료된 잡에만) */}
      {detail?.params.include_preview_image && s === 'COMPLETED' && (
        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
          <QpfBarChart steps={detail.params.forecast_steps} />
        </div>
      )}

      {/* 오류 블록 */}
      {detail?.error && (
        <pre className={`text-xs font-mono p-4 rounded-xl border whitespace-pre-wrap leading-relaxed ${
          job.status === 'CANCELED'
            ? 'bg-gray-50 border-gray-200 text-gray-500'
            : 'bg-red-50  border-red-100  text-red-600'
        }`}>
          {detail.error}
        </pre>
      )}
    </div>
  );
}

// ─── 잡 아코디언 행 ───────────────────────────────────────────────────────────

type SectionConfig = typeof SECTIONS[number];

function JobAccordion({
  job,
  detail,
  isExpanded,
  onToggle,
  section,
}: {
  job: TrainingJob;
  detail: MockDetail | null;
  isExpanded: boolean;
  onToggle: () => void;
  section: SectionConfig;
}) {
  const s = job.status.toUpperCase();

  return (
    <div className={`rounded-2xl overflow-hidden border border-gray-100 shadow-sm transition-shadow ${isExpanded ? 'shadow-md ring-1 ring-violet-200' : 'hover:shadow-md'}`}>

      {/* 헤더 행 — 클릭 시 펼침/접힘 */}
      <div
        role="button"
        tabIndex={0}
        onClick={onToggle}
        onKeyDown={e => e.key === 'Enter' && onToggle()}
        className={`flex items-center gap-4 px-5 py-4 bg-white cursor-pointer border-l-4 ${section.accentBar} transition-colors hover:bg-gray-50`}
      >
        {/* 잡 이름 + 메타 */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-800 truncate leading-snug">
            {formatExecutionName(job.experiment_name)}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            {displayUsername(job.user_name)} · {job.mode}
          </p>
        </div>

        {/* 상태 배지 */}
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold flex-shrink-0 ${section.badgeCls}`}>
          {s === 'RUNNING' && (
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          )}
          {job.status}
        </span>

        {/* 진행률 / 시간 */}
        <span className="text-xs text-gray-400 font-mono flex-shrink-0 hidden md:block">
          {s === 'RUNNING'   ? `${job.progress ?? 0}%` :
           s === 'QUEUED'    ? fmtDateTime(job.created_at) :
           s === 'COMPLETED' ? fmtDuration(job.started_at, job.finished_at) :
                               fmtDateTime(job.finished_at)}
        </span>

        {/* 펼침 화살표 */}
        <svg
          className={`w-4 h-4 text-gray-300 transition-transform duration-200 flex-shrink-0 ${isExpanded ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" strokeWidth={2.5}
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </div>

      {/* 펼쳐진 상세 내용 */}
      {isExpanded && <ExpandedDetail job={job} detail={detail} />}
    </div>
  );
}

// ─── 메인 컴포넌트 ────────────────────────────────────────────────────────────

export default function DashboardKanban() {
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const toggle = useCallback((id: number) => {
    setExpandedId(prev => prev === id ? null : id);
  }, []);

  // 요약 통계
  const summary = [
    { label: '전체',   href: '/trainings',                   value: MOCK_TRAININGS.length,                                                              cls: 'text-gray-700    bg-gray-50    border-gray-200'    },
    { label: '실행 중', href: '/trainings?status=RUNNING',    value: MOCK_TRAININGS.filter(j => j.status === 'RUNNING').length,                          cls: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
    { label: '완료',   href: '/trainings?status=COMPLETED',  value: MOCK_TRAININGS.filter(j => j.status === 'COMPLETED').length,                        cls: 'text-violet-700  bg-violet-50  border-violet-200'  },
    { label: '실패',   href: '/trainings?status=FAILED',     value: MOCK_TRAININGS.filter(j => j.status === 'FAILED' || j.status === 'CANCELED').length, cls: 'text-red-700     bg-red-50     border-red-200'     },
  ];

  return (
    <Layout>
      <div className="flex gap-3 items-start">

        {/* 왼쪽: 메인 콘텐츠 */}
        <div className="flex-1 min-w-0 space-y-5">

          {/* 페이지 헤더 */}
          <div>
            <h1 className="text-2xl font-bold text-gray-900">대시보드</h1>
            <p className="text-sm text-gray-400 mt-1">QPE 모델 학습 잡 현황을 확인합니다.</p>
          </div>

          {/* 요약 통계 카드 (4열) */}
          <div className="grid grid-cols-4 gap-3">
            {summary.map(({ label, href, value, cls }) => (
              <Link key={label} href={href} className={`rounded-2xl p-4 border text-center transition-all hover:shadow-md block ${cls}`}>
                <p className="text-3xl font-bold">{value}</p>
                <p className="text-xs font-semibold mt-1 opacity-60 uppercase tracking-wide">{label}</p>
              </Link>
            ))}
          </div>

          <SparklinePanel />

          {/* 상태별 섹션 (위→아래 수직 배치) */}
          {SECTIONS.map(section => {
            const jobs = MOCK_TRAININGS.filter(j =>
              section.statuses.includes(j.status)
            );

            return (
              <div key={section.key} className="space-y-3.5">

                {/* 섹션 헤더 */}
                <div className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border ${section.sectionBg}`}>
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${section.dot}`} />
                  <span className={`text-sm font-bold ${section.sectionText}`}>{section.label}</span>
                  <span className={`ml-auto text-xs font-bold px-2 py-0.5 rounded-full bg-white/70 ${section.sectionText}`}>
                    {jobs.length}건
                  </span>
                </div>

                {/* 잡 목록 */}
                {jobs.length > 0 ? (
                  <div className="space-y-3.5 pl-1">
                    {jobs.map(job => (
                      <JobAccordion
                        key={job.job_id}
                        job={job}
                        detail={MOCK_DETAILS[job.job_id] ?? null}
                        isExpanded={expandedId === job.job_id}
                        onToggle={() => toggle(job.job_id)}
                        section={section}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="text-center text-gray-300 text-xs py-6 border-2 border-dashed border-gray-100 rounded-2xl">
                    해당 잡 없음
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* 오른쪽: 이력 박스 */}
        <div className="w-72 flex-shrink-0 self-start">
          <CompactHistoryBox />
        </div>

      </div>
    </Layout>
  );
}
