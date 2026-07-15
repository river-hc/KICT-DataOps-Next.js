'use client';

import { useState, useMemo } from 'react';
import Layout from '@/lib/Layout';
import { MOCK_TRAINING_RUNS, type MockTrainingRun, fmtDateTime } from '@/lib/mockData';
import { displayUsername } from '@/lib/api';

// ─── 유틸 ─────────────────────────────────────────────────────────────────────

function fmtDuration(sec: number): string {
  if (sec < 60)   return `${sec}초`;
  if (sec < 3600) return `${Math.floor(sec / 60)}분 ${sec % 60}초`;
  return `${Math.floor(sec / 3600)}시간 ${Math.floor((sec % 3600) / 60)}분`;
}

function fmtLR(lr: number): string {
  if (lr < 0.001) return lr.toExponential(0);
  return lr.toString();
}

// ─── 타입 ─────────────────────────────────────────────────────────────────────

type SortKey = 'run_id' | 'started_at' | 'duration_seconds' | 'best_val_loss' | 'final_train_loss';
type SortDir = 'asc' | 'desc';
type FilterKey = 'ALL' | 'v2' | 'v3' | 'single' | 'multi';

// ─── 정렬 헤더 셀 ─────────────────────────────────────────────────────────────

function SortTh({ label, sKey, current, dir, onClick }: {
  label: string; sKey: SortKey; current: SortKey; dir: SortDir;
  onClick: (k: SortKey) => void;
}) {
  const active = current === sKey;
  return (
    <th
      onClick={() => onClick(sKey)}
      className={`px-4 py-3 text-left text-xs font-semibold cursor-pointer select-none whitespace-nowrap ${
        active ? 'text-blue-600' : 'text-gray-500 hover:text-gray-700'
      }`}
    >
      <span className="flex items-center gap-1">
        {label}
        {active ? (
          <svg viewBox="0 0 8 6" className="w-2 h-1.5 flex-shrink-0">
            {dir === 'asc'
              ? <path d="M0 5L4 1L8 5" stroke="currentColor" fill="none" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              : <path d="M0 1L4 5L8 1" stroke="currentColor" fill="none" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            }
          </svg>
        ) : (
          <svg viewBox="0 0 8 10" className="w-2 h-2 flex-shrink-0 text-gray-300">
            <path d="M0 3L4 0L8 3" stroke="currentColor" fill="none" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M0 7L4 10L8 7" stroke="currentColor" fill="none" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </span>
    </th>
  );
}

// ─── Loss 막대 ────────────────────────────────────────────────────────────────

function LossBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-mono font-bold text-gray-800 w-14 text-right shrink-0">
        {value.toFixed(4)}
      </span>
    </div>
  );
}

// ─── 페이지 ───────────────────────────────────────────────────────────────────

export default function RunsPage() {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [filter,     setFilter]     = useState<FilterKey>('ALL');
  const [sortKey,    setSortKey]    = useState<SortKey>('started_at');
  const [sortDir,    setSortDir]    = useState<SortDir>('desc');

  const bestValLoss = Math.min(...MOCK_TRAINING_RUNS.map(r => r.training_metrics.best_val_loss));
  const bestRun     = MOCK_TRAINING_RUNS.find(r => r.training_metrics.best_val_loss === bestValLoss);
  const maxLoss     = Math.max(...MOCK_TRAINING_RUNS.map(r => r.training_metrics.best_val_loss)) * 1.2;

  const filtered = useMemo(() => MOCK_TRAINING_RUNS.filter(r => {
    if (filter === 'v2')     return r.model_version === 'v2';
    if (filter === 'v3')     return r.model_version === 'v3';
    if (filter === 'single') return r.mode === 'single';
    if (filter === 'multi')  return r.mode === 'multi';
    return true;
  }), [filter]);

  const sorted = useMemo(() => [...filtered].sort((a, b) => {
    let av: number, bv: number;
    if      (sortKey === 'best_val_loss')    { av = a.training_metrics.best_val_loss;    bv = b.training_metrics.best_val_loss; }
    else if (sortKey === 'final_train_loss') { av = a.training_metrics.final_train_loss; bv = b.training_metrics.final_train_loss; }
    else if (sortKey === 'duration_seconds') { av = a.duration_seconds; bv = b.duration_seconds; }
    else if (sortKey === 'run_id')           { av = a.run_id; bv = b.run_id; }
    else { av = new Date(a.started_at).getTime(); bv = new Date(b.started_at).getTime(); }
    return sortDir === 'asc' ? av - bv : bv - av;
  }), [filtered, sortKey, sortDir]);

  const selected: MockTrainingRun | null = MOCK_TRAINING_RUNS.find(r => r.run_id === selectedId) ?? null;

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  }

  const FILTER_TABS: { key: FilterKey; label: string; active: string }[] = [
    { key: 'ALL',    label: '전체',   active: 'bg-gray-700 text-white'    },
    { key: 'v3',     label: 'v3',     active: 'bg-emerald-500 text-white' },
    { key: 'v2',     label: 'v2',     active: 'bg-sky-500 text-white'     },
    { key: 'single', label: 'single', active: 'bg-violet-500 text-white'  },
    { key: 'multi',  label: 'multi',  active: 'bg-amber-500 text-white'   },
  ];

  return (
    <Layout>
      {/* 헤더 */}
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-gray-900">학습 결과</h1>
        <p className="text-sm text-gray-500 mt-0.5">모델 가중치 학습 이력, 손실 지표, 체크포인트 정보를 확인합니다.</p>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-4 py-3">
          <p className="text-xs text-gray-400 mb-0.5">전체 학습 Run</p>
          <p className="text-2xl font-bold text-gray-800">{MOCK_TRAINING_RUNS.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-4 py-3">
          <p className="text-xs text-gray-400 mb-0.5">최저 Val Loss</p>
          <p className="text-2xl font-bold text-emerald-600 tabular-nums">{bestValLoss.toFixed(4)}</p>
          {bestRun && (
            <p className="text-xs text-gray-400 mt-0.5 truncate">
              {bestRun.model_version}
            </p>
          )}
        </div>
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-4 py-3">
          <p className="text-xs text-gray-400 mb-0.5">최신 체크포인트</p>
          <p className="text-sm font-bold text-blue-700 mt-1 truncate">
            checkpoint_run15_epoch87.pt
          </p>
          <p className="text-xs text-gray-400 mt-0.5">v3 · epoch 87</p>
        </div>
      </div>

      {/* 필터 + 건수 */}
      <div className="flex items-center gap-2 mb-4">
        {FILTER_TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => { setFilter(tab.key); setSelectedId(null); }}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
              filter === tab.key ? tab.active : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
        <span className="ml-auto text-xs text-gray-400">{sorted.length}건 표시 중</span>
      </div>

      {/* 테이블 + 상세 패널 */}
      <div className="flex gap-4 items-start">

        {/* 테이블 */}
        <div className={`${selected ? 'w-3/5' : 'w-full'} transition-all duration-200 min-w-0`}>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">실험명</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">버전</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">모드</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">학습 데이터 기간</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">에포크 (Best/전체)</th>
                    <SortTh label="Train Loss" sKey="final_train_loss" current={sortKey} dir={sortDir} onClick={handleSort} />
                    <SortTh label="Val Loss"   sKey="best_val_loss"    current={sortKey} dir={sortDir} onClick={handleSort} />
                    <SortTh label="학습 시간"  sKey="duration_seconds" current={sortKey} dir={sortDir} onClick={handleSort} />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {sorted.map(run => {
                    const isBest = run.training_metrics.best_val_loss === bestValLoss;
                    return (
                      <tr
                        key={run.run_id}
                        onClick={() => setSelectedId(selectedId === run.run_id ? null : run.run_id)}
                        className={`cursor-pointer transition-colors text-xs ${
                          selectedId === run.run_id ? 'bg-blue-50' : 'hover:bg-gray-50'
                        }`}
                      >
                        <td className="px-4 py-3 font-medium text-gray-800 max-w-[200px]">
                          <span className="truncate block">{run.experiment_name}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`font-semibold px-2 py-0.5 rounded-full ${
                            run.model_version === 'v3'
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-sky-100 text-sky-700'
                          }`}>
                            {run.model_version}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-400">{run.mode}</td>
                        <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{run.params.train_period}</td>
                        <td className="px-4 py-3 font-mono text-gray-700 whitespace-nowrap">
                          {run.training_metrics.best_epoch}
                          <span className="text-gray-300 mx-0.5">/</span>
                          {run.params.total_epochs}
                        </td>
                        <td className={`px-4 py-3 font-mono font-semibold whitespace-nowrap ${
                          isBest ? 'text-emerald-600' : 'text-gray-700'
                        }`}>
                          {run.training_metrics.final_train_loss.toFixed(4)}
                        </td>
                        <td className={`px-4 py-3 font-mono font-semibold whitespace-nowrap ${
                          isBest ? 'text-emerald-600' : 'text-gray-700'
                        }`}>
                          {run.training_metrics.best_val_loss.toFixed(4)}
                          {isBest && <span className="ml-1 text-[10px] font-normal text-emerald-400">best</span>}
                        </td>
                        <td className="px-4 py-3 text-gray-500 font-mono whitespace-nowrap">
                          {fmtDuration(run.duration_seconds)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {sorted.length === 0 && (
                <div className="py-16 text-center text-gray-400 text-sm">
                  해당 조건의 학습 결과가 없습니다.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 상세 패널 */}
        {selected && (
          <div className="w-2/5 min-w-0 space-y-4">

            {/* 패널 헤더 */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                      selected.model_version === 'v3'
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-sky-100 text-sky-700'
                    }`}>
                      {selected.model_version}
                    </span>
                    <span className="text-xs text-gray-400">{selected.mode}</span>
                  </div>
                  <h2 className="text-sm font-semibold text-gray-900 leading-snug">
                    {selected.experiment_name}
                  </h2>
                  <p className="text-xs text-gray-400 mt-0.5">{displayUsername(selected.created_by)}</p>
                </div>
                <button
                  onClick={() => setSelectedId(null)}
                  className="flex-shrink-0 ml-2 p-1 rounded hover:bg-gray-100 transition-colors"
                >
                  <svg viewBox="0 0 16 16" className="w-3.5 h-3.5 text-gray-400" fill="none"
                    stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                    <path d="M2 2L14 14M14 2L2 14" />
                  </svg>
                </button>
              </div>

              {/* 시간 정보 */}
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: '시작',   val: fmtDateTime(selected.started_at) },
                  { label: '완료',   val: fmtDateTime(selected.finished_at) },
                  { label: '소요',   val: fmtDuration(selected.duration_seconds) },
                ].map(({ label, val }) => (
                  <div key={label} className="bg-gray-50 rounded-lg px-3 py-2 text-center">
                    <p className="text-xs text-gray-400">{label}</p>
                    <p className="text-xs font-semibold text-gray-700 mt-0.5 font-mono">{val}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* 학습 손실 지표 */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">
                학습 손실 지표
              </h3>
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs text-gray-500">Train Loss (최종)</span>
                  </div>
                  <LossBar value={selected.training_metrics.final_train_loss} max={maxLoss} color="bg-blue-400" />
                </div>
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs text-gray-500">Val Loss (최종)</span>
                  </div>
                  <LossBar value={selected.training_metrics.final_val_loss} max={maxLoss} color="bg-amber-400" />
                </div>
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs text-gray-500">Val Loss (Best — Epoch {selected.training_metrics.best_epoch})</span>
                  </div>
                  <LossBar value={selected.training_metrics.best_val_loss} max={maxLoss} color="bg-emerald-500" />
                </div>
              </div>
            </div>

            {/* 학습 파라미터 */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                학습 파라미터
              </h3>
              <div className="space-y-2">
                {[
                  { label: '총 에포크',      val: `${selected.params.total_epochs} epoch` },
                  { label: 'Best 에포크',    val: `epoch ${selected.training_metrics.best_epoch}` },
                  { label: '배치 크기',      val: String(selected.params.batch_size) },
                  { label: '학습률',         val: fmtLR(selected.params.learning_rate) },
                  { label: '학습 데이터',    val: selected.params.train_period },
                  {
                    label: '기반 체크포인트',
                    val: selected.params.base_checkpoint ?? '없음 (처음부터 학습)',
                  },
                ].map(({ label, val }) => (
                  <div key={label} className="flex justify-between items-start gap-3">
                    <span className="text-xs text-gray-400 shrink-0">{label}</span>
                    <span className="text-xs font-medium text-gray-800 text-right font-mono break-all">{val}</span>
                  </div>
                ))}
              </div>
            </div>

          </div>
        )}
      </div>
    </Layout>
  );
}
