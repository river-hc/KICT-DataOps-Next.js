'use client';

import { useState, useCallback, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useRouter } from 'next/navigation';
import Layout from '@/lib/Layout';
import AscViewer, { COLORBAR } from '@/lib/AscViewer';
import { getTraining, getTrainingResult, getTrainingLogs, type TrainingJob, type TrainingResult } from '@/lib/api';
import { fmtDateTime, fmtDuration, fmtRunDatetime } from '@/lib/mockData';
import { loadClientExperiments, loadExpTcMap, loadTcMemo } from '@/lib/experimentStore';
import { metricsOrSample } from '@/lib/metrics';

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
    <div className="flex items-center gap-3 py-1">
      <span className="text-xs text-gray-500 w-12 shrink-0">{meta.label}</span>
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

// ─── 부모 실험 찾기 ───────────────────────────────────────────────────────────

function findParentExperimentId(jobId: number): number | null {
  // 사용자 추가 TC 매핑(localStorage)을 우선 — 가장 권위 있는 소스
  const tcMap = loadExpTcMap();
  for (const [expId, jobIds] of Object.entries(tcMap)) {
    if ((jobIds as number[]).includes(jobId)) return Number(expId);
  }
  for (const exp of loadClientExperiments()) {
    if (exp.tc_job_ids.includes(jobId)) return exp.id;
  }
  return null;
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
  const [logsOpen,     setLogsOpen]     = useState(false);
  const [parentExpId,  setParentExpId]  = useState<number | null>(null);
  // 메모는 백엔드가 응답하지 않으므로 클라이언트 localStorage에서 직접 로드 (detail과 독립)
  const [memo,         setMemo]         = useState<string | null>(null);

  // 재생 상태 (AscViewer controlled mode)
  const [frameIdx,   setFrameIdx]   = useState(0);
  const [isPlaying,  setIsPlaying]  = useState(false);
  const [intervalMs, setIntervalMs] = useState(900);

  useEffect(() => {
    if (jobId == null) return;
    const id = jobId;
    setParentExpId(findParentExperimentId(id));
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
    });
  }, [jobId]);

  const steps = detail?.params.forecast_steps ?? [];

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
        <div className="flex items-center justify-center py-24">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </Layout>
    );
  }

  const stepMin = steps.length > 0 ? Math.min(...steps) : null;
  const stepMax = steps.length > 0 ? Math.max(...steps) : null;
  const forecastLabel = stepMin != null && stepMax != null
    ? stepMin === stepMax ? `${stepMin}분` : `${stepMin}분 ~ ${stepMax}분`
    : '-';

  // 성능 지표 — 전체 단일 값(MAE/RMSE/CSI). 실데이터 우선, 없으면 화면 확인용 샘플로 폴백
  const pm             = metricsOrSample(detail?.metrics, jobId ?? 0, detail?.params.model_version ?? null);
  const metricSources  = detail?.metric_sources;
  const matchedCount   = metricSources?.matched_targets ? Object.keys(metricSources.matched_targets).length : 0;
  const ascUrls        = detail?.asc_urls && Object.keys(detail.asc_urls).length > 0 ? detail.asc_urls : undefined;

  const backHref = parentExpId ? `/experiments/${parentExpId}` : '/experiments';

  return (
    <Layout>
      <div className="h-full flex flex-col min-h-0">
      {/* 뒤로가기 + 헤더 */}
      <div className="mb-3 flex-shrink-0">
        <button
          onClick={() => router.push(backHref)}
          className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800 transition-colors mb-2"
        >
          <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 4l-5 4 5 4" />
          </svg>
          테스트 케이스 목록
        </button>

        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h1 className="text-xl font-bold text-gray-900 min-w-0 truncate">{job?.experiment_name}</h1>
          <div className="flex items-center gap-2 flex-wrap">
            {(() => {
              const s = (job?.status ?? 'COMPLETED').toUpperCase();
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
            {job?.run_id != null && (
              <span className="font-mono text-xs bg-violet-50 text-violet-700 border border-violet-100 px-2 py-0.5 rounded">
                Run #{job.run_id}
              </span>
            )}
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

      {/* 본문 2열×2행 — 행1: 슬라이드 / 정보 스택(같은 높이), 행2: 메모(좌하단) */}
      {/* 메모를 아래 행으로 분리해, 로그(mt-auto) 하단이 메모가 아닌 슬라이드 canvas 하단과 정렬됨 */}
      <div className="grid grid-cols-[9fr_16fr] grid-rows-[1fr_auto] gap-x-4 flex-1 min-h-0">

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
              onSpeedChange={setIntervalMs}
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

        {/* (1,2)-(2,2) 정보 스택 — 두 행에 걸쳐, 하단이 좌측 메모 카드 하단과 정렬됨. 컬럼 자체는 스크롤하지 않음 */}
        <div className="row-span-2 flex flex-col gap-3 min-w-0 min-h-0">

          {/* 왼쪽 슬라이드 제목 줄과 높이를 맞춰, 첫 카드가 슬라이드 이미지 상단선에 정렬되도록 함 */}
          <p aria-hidden className="text-xs font-semibold uppercase tracking-wider flex-shrink-0 invisible">spacer</p>

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

          {/* 카드 1행 배치: 성능 지표 · 모델 설정 · 검증 데이터 · 실행 일정 */}
          <div className="grid grid-cols-4 gap-3 flex-shrink-0">

            {/* 성능 지표 — 전체 단일 값 (MAE / RMSE / CSI) */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-2.5 min-w-0">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">성능 지표</p>
                {pm.isSample && (
                  <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">샘플</span>
                )}
              </div>
              <div className="space-y-0.5">
                {pm.summary.mae  != null && <MetricBar metricKey="mae"  value={pm.summary.mae} />}
                {pm.summary.rmse != null && <MetricBar metricKey="rmse" value={pm.summary.rmse} />}
                {pm.summary.csi  != null && <MetricBar metricKey="csi"  value={pm.summary.csi} />}
              </div>
              {pm.isSample && (
                <p className="text-[10px] text-gray-300 mt-1.5">백엔드 지표 연동 시 실데이터로 자동 대체</p>
              )}
            </div>

            {/* 모델 설정 */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-2.5 min-w-0">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">모델 설정</p>
              {detail ? (
                <div className="space-y-2">
                  <div className="min-w-0">
                    <span className="text-xs text-gray-500 block mb-0.5">모델 버전</span>
                    <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-semibold ${
                      detail.params.model_version === 'v3' ? 'bg-violet-50 text-violet-700' : 'bg-amber-50 text-amber-700'
                    }`}>{detail.params.model_version}</span>
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs text-gray-500 block mb-0.5">운용 시점</span>
                    <span className="text-xs font-medium text-gray-900 block break-words">
                      {detail.params.run_datetime ? fmtRunDatetime(detail.params.run_datetime) : '-'}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs text-gray-500 block mb-0.5">예측 선행시간</span>
                    <span className="inline-block text-xs font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded break-words">{forecastLabel}</span>
                  </div>
                </div>
              ) : <p className="text-xs text-gray-300">-</p>}
            </div>

            {/* 검증 데이터 */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-2.5 min-w-0">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">검증 데이터</p>
              {metricSources ? (
                <div className="space-y-2">
                  <div className="min-w-0">
                    <span className="text-xs text-gray-500 block mb-0.5">정답 경로</span>
                    <span className="text-xs font-medium text-gray-900 break-words block leading-relaxed">
                      {metricSources.observation_dataset_dir ?? '-'}
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
                  <p className="text-xs text-gray-400 text-center">정답 데이터 없음</p>
                  <p className="text-[11px] text-gray-300 text-center">TC 등록 시 데이터셋 미선택</p>
                </div>
              )}
            </div>

            {/* 실행 일정 */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-2.5 min-w-0">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">실행 일정</p>
              <div className="space-y-2">
                <div className="min-w-0">
                  <span className="text-xs text-gray-500 block mb-0.5">요청자</span>
                  <span className="text-xs font-medium text-gray-900 block break-words">{job?.user_name}</span>
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

          {/* 로그 아코디언 — 접으면 정보 카드 바로 아래, 펼치면 카드 아래 남은 공간 전체를
              채우고 본문만 내부 스크롤 (상단 카드는 고정) */}
          {logs.length > 0 && (
            <div className={`rounded-xl overflow-hidden border border-gray-700 shadow-sm flex flex-col min-h-0 ${
              logsOpen ? 'flex-1' : 'flex-shrink-0'
            }`}>
              <button
                onClick={() => setLogsOpen(v => !v)}
                className="w-full flex-shrink-0 flex items-center gap-2 px-4 py-3 bg-gray-900 text-gray-200 text-sm font-semibold text-left hover:bg-gray-800 transition-colors"
              >
                <svg
                  className={`w-3.5 h-3.5 transition-transform duration-200 ${logsOpen ? 'rotate-90' : ''}`}
                  fill="currentColor" viewBox="0 0 16 16"
                >
                  <path d="M6 4l5 4-5 4V4z"/>
                </svg>
                로그 표시
                <span className="ml-auto text-xs text-gray-500 font-normal">{logs.length}줄</span>
              </button>
              {logsOpen && (
                <div className="bg-black p-4 flex-1 min-h-0 overflow-y-auto font-mono text-xs leading-5">
                  {logs.map((line, i) => (
                    <div key={i} className={
                      line.startsWith('[INFO]')  ? 'text-gray-200' :
                      line.startsWith('[WARN]')  ? 'text-yellow-300' :
                      line.startsWith('[ERROR]') ? 'text-red-400' :
                      'text-gray-500'
                    }>{line}</div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>

        {/* (2,1) 메모 — 좌하단. 슬라이드 아래 행에 배치 (위 행 높이에 영향 없음) */}
        {memo && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-3 mt-3 max-h-32 overflow-y-auto">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">메모</p>
            <p className="text-xs text-gray-700 whitespace-pre-wrap leading-5">{memo}</p>
          </div>
        )}
      </div>
      </div>
    </Layout>
  );
}
