'use client';

import { useState, useCallback, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Layout from '@/lib/Layout';
import AscViewer, { COLORBAR } from '@/lib/AscViewer';
import { getTraining, getTrainingResult, getTrainingLogs, getExperiment, displayUsername, formatExecutionName, type TrainingJob, type TrainingResult, type Experiment } from '@/lib/api';
import { fmtDateTime, fmtDuration } from '@/lib/mockData';
import { loadTcMemo, loadTcModelMeta } from '@/lib/experimentStore';
import { parseMetrics } from '@/lib/metrics';
import { SkeletonBlock, SkeletonCard } from '@/lib/Skeleton';

// ─── 지표 메타 ────────────────────────────────────────────────────────────────

const METRIC_META: Record<string, { label: string; unit: string; max: number; higherBetter: boolean }> = {
  mae:  { label: 'MAE',  unit: 'mm', max: 6, higherBetter: false },
  rmse: { label: 'RMSE', unit: 'mm', max: 8, higherBetter: false },
  csi:  { label: 'CSI',  unit: '',   max: 1, higherBetter: true  },
};

function MetricBar({ metricKey, value }: { metricKey: string; value: number }) {
  const meta = METRIC_META[metricKey] ?? { label: metricKey.toUpperCase(), unit: '', max: 1, higherBetter: true };
  const pct  = Math.min(100, Math.max(0, (value / meta.max) * 100));
  const good = meta.higherBetter ? pct > 60 : pct < 40;
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 py-1 min-w-0">
      <span className="w-9 shrink-0 text-xs text-gray-500 truncate">{meta.label}</span>
      <div className="min-w-[2rem] flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full ${good ? 'bg-emerald-500' : 'bg-amber-500'} rounded-full`} style={{ width: `${pct}%` }} />
      </div>
      <span className="ml-auto shrink-0 max-w-full text-[11px] font-mono font-bold text-gray-800 text-right tabular-nums whitespace-nowrap">
        {value.toFixed(3)}
        {meta.unit && <span className="text-gray-400 font-normal text-[10px] ml-0.5">{meta.unit}</span>}
      </span>
    </div>
  );
}

function fmtRunDate(dt: string): string {
  if (!dt) return '-';
  const isoDate = dt.match(/^\d{4}-\d{2}-\d{2}/)?.[0];
  if (isoDate) return isoDate;
  if (/^\d{8}/.test(dt)) return `${dt.slice(0,4)}-${dt.slice(4,6)}-${dt.slice(6,8)}`;
  return dt;
}

function LogPanel({ logs, className = '' }: { logs: string[]; className?: string }) {
  return (
    <div className={`rounded-xl border border-gray-700 bg-black p-3 overflow-hidden ${className}`}>
      <div className="h-full overflow-y-auto pr-2 font-mono text-xs leading-5">
        {logs.length === 0 ? (
          <div className="text-gray-500">로그를 불러오는 중이거나 아직 기록된 로그가 없습니다.</div>
        ) : (
          logs.map((line, i) => (
            <div key={i} className={
              line.startsWith('[INFO]')  ? 'text-gray-200' :
              line.startsWith('[WARN]')  ? 'text-yellow-300' :
              line.startsWith('[ERROR]') ? 'text-red-400' :
              'text-gray-500'
            }>{line}</div>
          ))
        )}
      </div>
    </div>
  );
}

// ─── 메인 ────────────────────────────────────────────────────────────────────

export default function ExperimentResultDetail() {
  const params   = useParams<{ id: string }>();
  const router   = useRouter();
  const jobId    = params.id ? parseInt(params.id, 10) : null;

  const [job,          setJob]          = useState<TrainingJob | null>(null);
  const [detail,       setDetail]       = useState<TrainingResult | null>(null);
  const [logs,         setLogs]         = useState<string[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [parentExpId,  setParentExpId]  = useState<number | null>(null);
  const [parentExperiment, setParentExperiment] = useState<Experiment | null>(null);
  // 메모는 백엔드가 응답하지 않으므로 클라이언트 localStorage에서 직접 로드 (detail과 독립)
  const [memo,         setMemo]         = useState<string | null>(null);

  // 재생 상태 (AscViewer controlled mode)
  const [frameIdx,   setFrameIdx]   = useState(0);
  const [isPlaying,  setIsPlaying]  = useState(false);
  const [intervalMs] = useState(1000);

  useEffect(() => {
    if (jobId == null) return;
    const id = jobId;
    setMemo(loadTcMemo(id));
    Promise.all([
      getTraining(id).catch(() => null),
      getTrainingResult(id).catch(() => null),
      getTrainingLogs(id).catch(() => null),
    ]).then(([j, d, l]) => {
      setJob(j);
      setDetail(d);
      setLogs(l?.logs ?? []);
      setLoading(false);
      setParentExpId(j?.experiment_id ?? null);
    });
  }, [jobId]);

  // 부모 실험 정보 로드 (서버 기준)
  useEffect(() => {
    if (parentExpId == null) { setParentExperiment(null); return; }
    getExperiment(parentExpId).then(setParentExperiment).catch(() => setParentExperiment(null));
  }, [parentExpId]);

  const steps = detail?.params.forecast_steps ?? [];
  const storedMeta = jobId != null ? loadTcModelMeta(jobId) : null;
  const displayRequester = displayUsername(job?.user_name);

  const goPrev = useCallback(() => {
    setIsPlaying(false);
    setFrameIdx(i => (i - 1 + steps.length) % steps.length);
  }, [steps.length]);

  const goNext = useCallback(() => {
    setIsPlaying(false);
    setFrameIdx(i => (i + 1) % steps.length);
  }, [steps.length]);

  if (jobId == null || (!loading && !job)) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center py-24 text-gray-400">
          <svg className="w-12 h-12 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm font-medium">실험을 찾을 수 없습니다.</p>
          <button onClick={() => router.push('/experiments')} className="mt-4 text-xs text-blue-600 hover:underline">
            목록으로 돌아가기
          </button>
        </div>
      </Layout>
    );
  }

  if (loading) {
    return (
      <Layout>
        <div className="h-full flex flex-col min-h-0">
          <div className="mb-3 flex-shrink-0">
            <SkeletonBlock className="h-6 w-64" />
          </div>
          <div className="grid grid-cols-[9fr_16fr] grid-rows-[minmax(0,1fr)_8rem] gap-x-4 gap-y-3 flex-1 min-h-0">
            <SkeletonBlock className="min-h-0" />
            <div className="grid grid-cols-4 gap-3 min-h-0">
              {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} lines={3} />)}
            </div>
            <SkeletonBlock className="h-full" />
            <SkeletonBlock className="h-full" />
          </div>
        </div>
      </Layout>
    );
  }

  const stepMin = steps.length > 0 ? Math.min(...steps) : null;
  const stepMax = steps.length > 0 ? Math.max(...steps) : null;
  const forecastLabel = stepMin != null && stepMax != null
    ? stepMin === stepMax ? `${stepMin}분` : `${stepMin}분 ~ ${stepMax}분`
    : '-';

  // 성능 지표 — 백엔드가 출력 경로의 지표 파일에서 추출해 내려준 값만 표시
  const pm             = parseMetrics(detail?.metrics);
  const metricSources  = detail?.metric_sources;
  const matchedCount   = metricSources?.matched_targets ? Object.keys(metricSources.matched_targets).length : 0;
  const metricFilePath  = metricSources?.metrics_file_path ?? null;
  const hasMetricValues = pm.summary.mae != null || pm.summary.rmse != null || pm.summary.csi != null;
  const ascUrls        = detail?.asc_urls && Object.keys(detail.asc_urls).length > 0 ? detail.asc_urls : undefined;

  const executionName = formatExecutionName(job?.experiment_name, detail?.params.run_datetime);
  const resultStatus = (job?.status ?? 'COMPLETED').toUpperCase();
  const isFailedResult = resultStatus === 'FAILED';
  const failureMessage = detail?.error_message || job?.error_message;

  const title = (
    <span className="inline-flex items-center gap-2">
      {parentExperiment ? (
        <Link
          href={`/experiments/${parentExperiment.id}`}
          className="max-w-[28rem] truncate font-semibold hover:text-blue-600 transition-colors"
        >
          {parentExperiment.name}
        </Link>
      ) : (
        <span>-</span>
      )}
      <span className="text-gray-300">&gt;</span>
      <Link
        href={parentExperiment ? `/experiments/${parentExperiment.id}` : '/experiments'}
        className="font-semibold hover:text-blue-600 transition-colors"
      >
        테스트케이스
      </Link>
      <span className="text-gray-300">&gt;</span>
      <span className="truncate">테스트케이스 결과</span>
    </span>
  );

  return (
    <Layout title={title}>
      <div className="h-full flex flex-col min-h-0">
      {/* 헤더 */}
      <div className="mb-3 flex-shrink-0">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 min-w-0">
            {/*
            <button
              aria-label="테스트케이스 목록으로 돌아가기"
              title="테스트케이스 목록으로 돌아가기"
              onClick={() => router.push(parentExpId ? `/experiments/${parentExpId}` : '/experiments')}
              className="uiverse-back-chevron flex-shrink-0"
            >
              <input type="checkbox" checked readOnly aria-hidden="true" tabIndex={-1} />
              <svg className="chevron-right" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M8.59 16.59 13.17 12 8.59 7.41 10 6l6 6-6 6z" />
              </svg>
            </button>
            */}
            <h1 className="text-xl font-bold text-gray-900 min-w-0 truncate">{executionName}</h1>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {(() => {
              const s = resultStatus;
              const cls =
                s === 'COMPLETED' ? 'bg-blue-100 text-blue-800 border-blue-200' :
                s === 'FAILED'    ? 'bg-red-100 text-red-800 border-red-200' :
                s === 'RUNNING'   ? 'bg-green-100 text-green-800 border-green-200' :
                s === 'QUEUED'    ? 'bg-yellow-100 text-yellow-800 border-yellow-200' :
                'bg-gray-100 text-gray-600 border-gray-200';
              return (
                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${cls}`}>{s}</span>
              );
            })()}
            {detail?.params.model_version && (
              <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                detail.params.model_version === 'v3'
                  ? 'bg-violet-50 text-violet-700 border border-violet-100'
                  : 'bg-amber-50 text-amber-700 border border-amber-100'
              }`}>
                {detail.params.model_version}
              </span>
            )}
          </div>
        </div>
      </div>

      {isFailedResult ? (
        <div className="flex-1 min-h-0 flex flex-col gap-3">
          {failureMessage && (
            <div className="flex-shrink-0 rounded-xl border border-red-100 bg-red-50 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-red-500 mb-1">실패 원인</p>
              <p className="text-xs text-red-700 font-mono whitespace-pre-wrap break-all">{failureMessage}</p>
            </div>
          )}
          <LogPanel logs={logs} className="flex-1 min-h-0" />
        </div>
      ) : (
        <>
      {/* 본문 2열×2행 — 행1: 뷰어 / 정보, 행2: 메모 */}
      <div className="grid grid-cols-[9fr_16fr] grid-rows-[minmax(0,1fr)_8rem] gap-x-4 gap-y-3 flex-1 min-h-0">

        {/* (1,1) QPF 슬라이드 — 좌상단 */}
        <div className="min-h-0">
          {ascUrls && steps.length > 0 ? (
            <AscViewer
              steps={steps}
              ascUrls={ascUrls}
              hideControls
              fillHeight
              frameIdx={frameIdx}
              onFrameChange={setFrameIdx}
              playing={isPlaying}
              onPlayingChange={setIsPlaying}
              speed={intervalMs}
            />
          ) : (
            <div className="h-full flex items-center justify-center bg-gray-50 rounded-xl border border-dashed border-gray-200 min-h-[300px]">
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

        {/* (1,2) 정보 스택 — canvas 상단/하단선에 맞춰 배치 */}
        <div className="flex flex-col gap-3 min-w-0 min-h-0 pt-7">

          {/* 재생 컨트롤 */}
          {steps.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-3 flex-shrink-0">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">재생 컨트롤</p>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-gray-800">T+{steps[frameIdx]}분</span>
                  <span className="text-xs text-gray-400">{frameIdx + 1} / {steps.length}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 mb-2">
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
              </div>
              <div className="flex flex-wrap gap-1.5 mb-3">
                {steps.map((step, i) => (
                  <button key={step}
                    onClick={() => { setFrameIdx(i); setIsPlaying(false); }}
                    className={`text-xs px-2.5 py-1 rounded-full font-medium transition ${
                      i === frameIdx ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >T+{step}</button>
                ))}
              </div>
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

          {/* 카드 1행 배치: 성능 지표 · 모델 설정 · 검증 데이터 · 테스트케이스 일정 */}
          <div className="grid grid-cols-4 gap-3 flex-1 min-h-0">

            {/* 성능 지표 — 전체 단일 값 (MAE / RMSE / CSI) */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-3 min-w-0 min-h-0 h-full overflow-y-auto">
              <div className="flex items-center justify-between mb-4 min-w-0">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">성능 지표</p>
              </div>
              {hasMetricValues ? (
                <div className="space-y-5 pt-2">
                  {pm.summary.mae  != null && <MetricBar metricKey="mae"  value={pm.summary.mae} />}
                  {pm.summary.rmse != null && <MetricBar metricKey="rmse" value={pm.summary.rmse} />}
                  {pm.summary.csi  != null && <MetricBar metricKey="csi"  value={pm.summary.csi} />}
                </div>
              ) : (
                <p className="text-xs text-gray-300 leading-relaxed">지표 파일 생성 대기</p>
              )}
            </div>

            {/* 모델 설정 */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-2.5 min-w-0 min-h-0 h-full overflow-y-auto">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">모델 설정</p>
              {detail ? (
                <div className="space-y-5 pt-2">
                  <div className="min-w-0">
                    <span className="text-xs text-gray-500 block mb-0.5">모델 버전</span>
                    <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-semibold ${
                      detail.params.model_version === 'v3' ? 'bg-violet-50 text-violet-700' : 'bg-amber-50 text-amber-700'
                    }`}>{detail.params.model_version}</span>
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs text-gray-500 block mb-0.5">운용 시점</span>
                    <span className="text-xs font-medium text-gray-900 block break-words">
                      {detail.params.run_datetime ? fmtRunDate(detail.params.run_datetime) : '-'}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs text-gray-500 block mb-0.5">예측 선행시간</span>
                    <span className="inline-block text-xs font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded break-words">{forecastLabel}</span>
                  </div>
                  {detail.params.git_commit && (
                    <div className="min-w-0">
                      <span className="text-xs text-gray-500 block mb-0.5">트레이너 코드 버전</span>
                      <span className="text-xs font-mono text-gray-700 break-words">{detail.params.git_commit}</span>
                    </div>
                  )}
                </div>
              ) : <p className="text-xs text-gray-300">-</p>}
            </div>

            {/* 검증 데이터 */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-2.5 min-w-0 min-h-0 h-full overflow-y-auto">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">검증 데이터</p>
              {metricSources ? (
                <div className="space-y-4 pt-2">
                  <div className="min-w-0">
                    <span className="text-xs text-gray-500 block mb-0.5">정답 데이터셋</span>
                    <span className="text-xs font-medium text-gray-900 break-words block leading-relaxed">
                      {detail?.params.answer_dataset_name ?? '-'}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs text-gray-500 block mb-0.5">비교 데이터 경로</span>
                    <span className="text-xs font-medium text-gray-900 break-words block leading-relaxed">
                      {metricSources.observation_dataset_dir ?? '-'}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs text-gray-500 block mb-0.5">지표 파일 경로</span>
                    <span className="text-xs font-medium text-gray-900 break-words block leading-relaxed">
                      {metricFilePath ?? '-'}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs text-gray-500 block mb-0.5">매칭 파일</span>
                    <span className="text-xs font-semibold text-emerald-700 block">{matchedCount}개</span>
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs text-gray-500 block mb-0.5">누락 step</span>
                    <span className="text-xs font-medium text-gray-900 block break-words">
                      {metricSources.missing_steps?.length ? metricSources.missing_steps.join(', ') : '-'}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-4 gap-1.5">
                  <svg className="w-7 h-7 text-gray-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p className="text-xs text-gray-400 text-center">비교 데이터 없음</p>
                  <p className="text-[11px] text-gray-300 text-center">테스트케이스 등록 시 경로 미지정</p>
                </div>
              )}
            </div>

            {/* 테스트케이스 일정 */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-2.5 min-w-0 min-h-0 h-full overflow-y-auto">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">테스트케이스 일정</p>
              <div className="space-y-4 pt-2">
                <div className="min-w-0">
                  <span className="text-xs text-gray-500 block mb-0.5">생성자</span>
                  <span className="text-xs font-medium text-gray-900 block break-words">{displayRequester}</span>
                </div>
                <div className="min-w-0">
                  <span className="text-xs text-gray-500 block mb-0.5">등록 시각</span>
                  <span className="text-xs font-medium text-gray-900 block break-words">{fmtDateTime(job?.created_at ?? null)}</span>
                </div>
                <div className="min-w-0">
                  <span className="text-xs text-gray-500 block mb-0.5">시작 시각</span>
                  <span className="text-xs font-medium text-gray-900 block break-words">{fmtDateTime(job?.started_at ?? null)}</span>
                </div>
                <div className="min-w-0">
                  <span className="text-xs text-gray-500 block mb-0.5">완료 시각</span>
                  <span className="text-xs font-medium text-gray-900 block break-words">{fmtDateTime(job?.finished_at ?? null)}</span>
                </div>
                <div className="min-w-0 pt-1.5 border-t border-gray-100">
                  <span className="text-xs text-gray-500 block mb-0.5">소요 시간</span>
                  <span className="text-xs font-bold text-blue-700 block break-words">{fmtDuration(job?.started_at ?? null, job?.finished_at ?? null)}</span>
                </div>
              </div>
            </div>

          </div>

        </div>

        {/* (2행) 메모 */}
        <div className="col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm p-3 h-full min-h-0 overflow-y-auto">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">메모</p>
          <p className="text-xs text-gray-700 whitespace-pre-wrap leading-5">{memo || '-'}</p>
        </div>
      </div>
        </>
      )}
      </div>
    </Layout>
  );
}
