'use client';

import { useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Layout from '@/lib/Layout';
import AscViewer, { COLORBAR } from '@/lib/AscViewer';
import {
  MOCK_TRAININGS,
  MOCK_DETAILS,
  fmtDateTime,
  fmtDuration,
  fmtRunDatetime,
} from '@/lib/mockData';

// ─── 지표 메타 ────────────────────────────────────────────────────────────────

const METRIC_META: Record<string, { label: string; unit: string; max: number; higherBetter: boolean }> = {
  mae:    { label: 'MAE',    unit: 'mm', max: 6, higherBetter: false },
  rmse:   { label: 'RMSE',  unit: 'mm', max: 8, higherBetter: false },
  csi_10: { label: 'CSI 10', unit: '',  max: 1, higherBetter: true  },
  csi_20: { label: 'CSI 20', unit: '',  max: 1, higherBetter: true  },
  csi_30: { label: 'CSI 30', unit: '',  max: 1, higherBetter: true  },
};

const SHOW_METRICS = new Set(Object.keys(METRIC_META));

function MetricBar({ metricKey, value }: { metricKey: string; value: number }) {
  const meta = METRIC_META[metricKey] ?? { label: metricKey.toUpperCase(), unit: '', max: 1, higherBetter: true };
  const pct  = Math.min(100, Math.max(0, (value / meta.max) * 100));
  const good = meta.higherBetter ? pct > 60 : pct < 40;
  return (
    <div className="flex items-center gap-3 py-1">
      <span className="text-xs text-gray-500 w-16 shrink-0">{meta.label}</span>
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full ${good ? 'bg-emerald-500' : 'bg-amber-500'} rounded-full`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-mono font-bold text-gray-800 w-14 text-right shrink-0">
        {value.toFixed(3)}
        {meta.unit && <span className="text-gray-400 font-normal text-[10px] ml-0.5">{meta.unit}</span>}
      </span>
    </div>
  );
}

// ─── 메인 ────────────────────────────────────────────────────────────────────

export default function ExperimentResultDetail() {
  const params  = useParams<{ id: string }>();
  const { id }  = params;
  const jobId   = typeof id === 'string' ? parseInt(id, 10) : null;

  const job    = jobId != null ? MOCK_TRAININGS.find(j => j.job_id === jobId) ?? null : null;
  const detail = jobId != null ? (MOCK_DETAILS[jobId] ?? null) : null;

  // ── 재생 상태 (AscViewer controlled mode) ──
  const steps = detail?.params.forecast_steps ?? [];
  const [frameIdx,   setFrameIdx]   = useState(0);
  const [isPlaying,  setIsPlaying]  = useState(false);
  const [intervalMs, setIntervalMs] = useState(900);

  const goPrev = useCallback(() => {
    setIsPlaying(false);
    setFrameIdx(i => (i - 1 + steps.length) % steps.length);
  }, [steps.length]);

  const goNext = useCallback(() => {
    setIsPlaying(false);
    setFrameIdx(i => (i + 1) % steps.length);
  }, [steps.length]);

  if (jobId == null || !job) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center py-24 text-gray-400">
          <svg className="w-12 h-12 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm font-medium">실험을 찾을 수 없습니다.</p>
          <Link href="/experiments" className="mt-4 text-xs text-blue-600 hover:underline">
            목록으로 돌아가기
          </Link>
        </div>
      </Layout>
    );
  }

  const stepMin = steps.length > 0 ? Math.min(...steps) : null;
  const stepMax = steps.length > 0 ? Math.max(...steps) : null;
  const forecastLabel = stepMin != null && stepMax != null
    ? stepMin === stepMax ? `${stepMin}분` : `${stepMin}분 ~ ${stepMax}분`
    : '-';

  return (
    <Layout>
      {/* 뒤로가기 + 헤더 */}
      <div className="mb-6">
        <Link
          href="/experiments"
          className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800 transition-colors mb-4"
        >
          <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 4l-5 4 5 4" />
          </svg>
          실험 / 학습 목록
        </Link>

        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200">
                COMPLETED
              </span>
              {job.run_id != null && (
                <span className="font-mono text-xs bg-violet-50 text-violet-700 border border-violet-100 px-2 py-0.5 rounded">
                  Run #{job.run_id}
                </span>
              )}
              {detail && (
                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                  detail.params.model_version === 'v3'
                    ? 'bg-violet-50 text-violet-700 border border-violet-100'
                    : 'bg-amber-50 text-amber-700 border border-amber-100'
                }`}>
                  {detail.params.model_version}
                </span>
              )}
            </div>
            <h1 className="text-xl font-bold text-gray-900">{job.experiment_name}</h1>
            <p className="text-xs text-gray-400 mt-0.5">
              {job.user_name} · {job.mode} 모드 · {fmtDateTime(job.started_at)} 시작 · 소요 {fmtDuration(job.started_at, job.finished_at)}
            </p>
          </div>
        </div>
      </div>

      {/* 본문 2컬럼 */}
      <div className="grid grid-cols-2 gap-6">

        {/* 왼쪽: ASC 뷰어 (캔버스만, 컨트롤 숨김) */}
        <div>
          {detail?.ascUrls ? (
            <AscViewer
              steps={steps}
              ascUrls={detail.ascUrls}
              hideControls
              frameIdx={frameIdx}
              onFrameChange={setFrameIdx}
              playing={isPlaying}
              onPlayingChange={setIsPlaying}
              speed={intervalMs}
              onSpeedChange={setIntervalMs}
            />
          ) : (
            <div className="flex items-center justify-center bg-gray-50 rounded-xl border border-dashed border-gray-200 min-h-[300px]">
              <div className="text-center">
                <svg className="w-10 h-10 text-gray-300 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <p className="text-sm text-gray-400">강우장 데이터 없음</p>
              </div>
            </div>
          )}
        </div>

        {/* 오른쪽: 재생 컨트롤 + 지표 + 설정 */}
        <div className="flex flex-col gap-4">

          {/* 재생 컨트롤 */}
          {steps.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">재생 컨트롤</p>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-gray-800">T+{steps[frameIdx]}분</span>
                  <span className="text-xs text-gray-400">{frameIdx + 1} / {steps.length}</span>
                </div>
              </div>

              {/* prev / play / next + 속도 */}
              <div className="flex items-center gap-2 mb-3">
                <button onClick={goPrev} className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 transition">
                  <svg viewBox="0 0 16 16" className="w-4 h-4" fill="currentColor"><path d="M11 4L5 8l6 4V4z"/></svg>
                </button>
                <button
                  onClick={() => setIsPlaying(p => !p)}
                  className={`w-8 h-8 flex items-center justify-center rounded-lg transition ${isPlaying ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                >
                  {isPlaying
                    ? <svg viewBox="0 0 16 16" className="w-4 h-4" fill="currentColor"><rect x="4" y="3" width="3" height="10" rx="0.5"/><rect x="9" y="3" width="3" height="10" rx="0.5"/></svg>
                    : <svg viewBox="0 0 16 16" className="w-4 h-4" fill="currentColor"><path d="M5 4l6 4-6 4V4z"/></svg>
                  }
                </button>
                <button onClick={goNext} className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 transition">
                  <svg viewBox="0 0 16 16" className="w-4 h-4" fill="currentColor"><path d="M5 4l6 4-6 4V4z"/></svg>
                </button>
                <div className="flex items-center gap-2 ml-auto text-xs text-gray-400">
                  <span>느림</span>
                  <input type="range" min={200} max={2000} step={100}
                    value={2200 - intervalMs}
                    onChange={e => setIntervalMs(2200 - Number(e.target.value))}
                    className="w-20 accent-blue-600"
                  />
                  <span>빠름</span>
                </div>
              </div>

              {/* 타임라인 */}
              <div className="flex flex-wrap gap-1.5 mb-4">
                {steps.map((step, i) => (
                  <button key={step}
                    onClick={() => { setFrameIdx(i); setIsPlaying(false); }}
                    className={`text-xs px-2.5 py-1 rounded-full font-medium transition ${
                      i === frameIdx ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >T+{step}</button>
                ))}
              </div>

              {/* 컬러바 */}
              <div>
                <div className="flex h-3 rounded overflow-hidden">
                  {COLORBAR.slice(0, -1).map((s, i) => (
                    <div key={i} className="flex-1" style={{ background: s.color }} />
                  ))}
                </div>
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  {COLORBAR.map(s => <span key={s.label}>{s.label}</span>)}
                </div>
                <p className="text-xs text-gray-400 text-right mt-0.5">단위: mm/hr</p>
              </div>
            </div>
          )}

          {/* 성능 지표 */}
          {detail?.metrics && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">성능 지표</p>
              <div className="space-y-0.5">
                {Object.entries(detail.metrics)
                  .filter(([k]) => SHOW_METRICS.has(k))
                  .map(([k, v]) => (
                    <MetricBar key={k} metricKey={k} value={v} />
                  ))}
              </div>
            </div>
          )}

          {/* 모델 설정 */}
          {detail && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">모델 설정</p>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-500">모델 버전</span>
                  <span className={`px-1.5 py-0.5 rounded text-xs font-semibold ${
                    detail.params.model_version === 'v3' ? 'bg-violet-50 text-violet-700' : 'bg-amber-50 text-amber-700'
                  }`}>{detail.params.model_version}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-500">운용 시점</span>
                  <span className="text-xs font-medium text-gray-900">{fmtRunDatetime(detail.params.run_datetime)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-500">예측 선행시간</span>
                  <span className="text-xs font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">{forecastLabel}</span>
                </div>
              </div>
            </div>
          )}

          {/* 실행 일정 */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">실행 일정</p>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-500">요청자</span>
                <span className="text-xs font-medium text-gray-900">{job.user_name}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-500">등록 시각</span>
                <span className="text-xs font-medium text-gray-900">{fmtDateTime(job.created_at)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-500">시작 시각</span>
                <span className="text-xs font-medium text-gray-900">{fmtDateTime(job.started_at)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-500">완료 시각</span>
                <span className="text-xs font-medium text-gray-900">{fmtDateTime(job.finished_at)}</span>
              </div>
              <div className="flex justify-between items-center pt-1.5 border-t border-gray-100">
                <span className="text-xs text-gray-500">소요 시간</span>
                <span className="text-xs font-bold text-blue-700">{fmtDuration(job.started_at, job.finished_at)}</span>
              </div>
            </div>
          </div>

        </div>
      </div>
    </Layout>
  );
}
