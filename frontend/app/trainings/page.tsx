'use client';

import { Suspense, useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import Layout from '@/lib/Layout';
import {
  getTrainings, getTrainingLogs, createTraining,
  fileToBase64, calculateTimestamp,
  type TrainingJob,
} from '@/lib/api';

const POLL_MS    = 3000;
const ALL_STEPS  = [10,20,30,40,50,60,70,80,90,100,110,120,130,140,150,160,170,180];
const DFLT_STEPS = [10,20,30,60,90,120,180];

// ─── 상태 배지 ────────────────────────────────────────────────────────────────

const STATUS_STYLE: Record<string, string> = {
  RUNNING:   'bg-emerald-100 text-emerald-800',
  QUEUED:    'bg-amber-100   text-amber-800',
  COMPLETED: 'bg-blue-100   text-blue-800',
  FAILED:    'bg-red-100    text-red-800',
  CANCELED:  'bg-gray-100   text-gray-600',
};

function StatusBadge({ status }: { status: string }) {
  const s   = status.toUpperCase();
  const cls = STATUS_STYLE[s] ?? 'bg-gray-100 text-gray-600';
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>
      {s === 'RUNNING' && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse flex-shrink-0" />}
      {status}
    </span>
  );
}

function ProgressBar({ progress, currentEpoch, totalEpochs }: {
  progress: number | null; currentEpoch: number | null; totalEpochs: number | null;
}) {
  const pct = progress ?? 0;
  return (
    <div className="flex items-center gap-2" style={{ minWidth: 140 }}>
      <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
        <div className="h-full bg-emerald-500 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-gray-500 w-7 text-right flex-shrink-0">{pct}%</span>
      {currentEpoch != null && totalEpochs != null && (
        <span className="text-xs text-gray-400 flex-shrink-0">{currentEpoch}/{totalEpochs}</span>
      )}
    </div>
  );
}

// ─── 학습 설정 모달 ───────────────────────────────────────────────────────────

interface FormFiles { t0: File|null; t1: File|null; t2: File|null; t3: File|null }

interface TrainingForm {
  userName:       string;
  experimentName: string;
  mode:           'single' | 'multi';
  modelVersion:   'v2' | 'v3';
  runDatetime:    string;   // datetime-local
  forecastSteps:  number[];
  includePreview: boolean;
  memo:           string;
  files:          FormFiles;
}

const FILE_META = [
  { key: 't0' as const, label: 'T+0',   desc: '현재 관측',   offset:   0 },
  { key: 't1' as const, label: 'T-10분', desc: '10분 전 관측', offset: -10 },
  { key: 't2' as const, label: 'T-20분', desc: '20분 전 관측', offset: -20 },
  { key: 't3' as const, label: 'T-30분', desc: '30분 전 관측', offset: -30 },
];

function toApiDt(dtLocal: string) {
  return dtLocal.replace(/[-T:]/g, '').slice(0, 12);
}

function TrainingModal({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (f: TrainingForm) => Promise<void>;
}) {
  const [form, setForm] = useState<TrainingForm>({
    userName: '', experimentName: '', mode: 'single',
    modelVersion: 'v3', runDatetime: '',
    forecastSteps: DFLT_STEPS, includePreview: true,
    memo: '', files: { t0: null, t1: null, t2: null, t3: null },
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState<string | null>(null);

  const toggleStep = (s: number) =>
    setForm(f => ({
      ...f,
      forecastSteps: f.forecastSteps.includes(s)
        ? f.forecastSteps.filter(x => x !== s)
        : [...f.forecastSteps, s].sort((a, b) => a - b),
    }));

  const handleFile = (key: keyof FormFiles) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setForm(f => ({ ...f, files: { ...f.files, [key]: file } }));
  };

  const ts = (offset: number) =>
    form.runDatetime ? calculateTimestamp(toApiDt(form.runDatetime), offset) : null;

  const handleSubmit = async () => {
    if (!form.experimentName.trim())  { setError('실험명을 입력해주세요.');              return; }
    if (!form.runDatetime)            { setError('운용 시점을 선택해주세요.');            return; }
    if (form.forecastSteps.length === 0) { setError('예측 선행시간을 하나 이상 선택해주세요.'); return; }
    setSubmitting(true); setError(null);
    try {
      await onSubmit(form);
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '학습 시작에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const inp = 'w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none';
  const sec = 'border-t border-gray-100 pt-5 mt-5';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <div className="relative z-10 w-full max-w-2xl mx-4 bg-white rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">

        {/* 헤더 */}
        <div className="flex items-start justify-between px-6 py-5 border-b border-gray-100 flex-shrink-0">
          <div>
            <h2 className="text-lg font-bold text-gray-900">새 학습 시작</h2>
            <p className="text-xs text-gray-400 mt-0.5">QPF 모델 가중치 학습 작업을 설정합니다.</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors mt-0.5">
            <svg viewBox="0 0 16 16" className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
              <path d="M2 2l12 12M14 2L2 14" />
            </svg>
          </button>
        </div>

        {/* 바디 */}
        <div className="overflow-y-auto flex-1 px-6 py-5">

          {/* ── 1. 기본 정보 ── */}
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">기본 정보</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-gray-600">
                실험명 <span className="text-red-500">*</span>
              </label>
              <input
                value={form.experimentName}
                onChange={e => setForm(f => ({ ...f, experimentName: e.target.value }))}
                className={inp}
                placeholder="예: 2026-06-09 10:00 QPF (v3)"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-gray-600">사용자</label>
              <input
                value={form.userName}
                onChange={e => setForm(f => ({ ...f, userName: e.target.value }))}
                className={inp}
                placeholder="admin"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-gray-600">모드</label>
              <div className="flex gap-2">
                {(['single', 'multi'] as const).map(m => (
                  <button
                    key={m}
                    onClick={() => setForm(f => ({ ...f, mode: m }))}
                    className={`flex-1 py-2 rounded-lg border text-sm font-semibold transition-colors ${
                      form.mode === m
                        ? 'bg-gray-800 text-white border-gray-800'
                        : 'border-gray-200 text-gray-500 hover:border-gray-300'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-gray-600">메모</label>
              <input
                value={form.memo}
                onChange={e => setForm(f => ({ ...f, memo: e.target.value }))}
                className={inp}
                placeholder="선택 입력"
              />
            </div>
          </div>

          {/* ── 2. 모델 설정 ── */}
          <div className={sec}>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">모델 설정</h3>

            <div className="grid grid-cols-2 gap-4 mb-5">
              {/* 모델 버전 */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-gray-600">모델 버전</label>
                <div className="flex gap-2">
                  {(['v3', 'v2'] as const).map(v => (
                    <button
                      key={v}
                      onClick={() => setForm(f => ({ ...f, modelVersion: v }))}
                      className={`flex-1 py-2 rounded-lg border text-sm font-bold transition-colors ${
                        form.modelVersion === v
                          ? v === 'v3'
                            ? 'bg-emerald-600 text-white border-emerald-600'
                            : 'bg-sky-600 text-white border-sky-600'
                          : 'border-gray-200 text-gray-500 hover:border-gray-300'
                      }`}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>
              {/* 운용 시점 */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-gray-600">
                  운용 시점 <span className="text-red-500">*</span>
                </label>
                <input
                  type="datetime-local"
                  value={form.runDatetime}
                  onChange={e => setForm(f => ({ ...f, runDatetime: e.target.value }))}
                  className={inp}
                />
              </div>
            </div>

            {/* 예측 선행시간 */}
            <div className="flex flex-col gap-2 mb-5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-gray-600">
                  예측 선행시간
                  <span className="ml-1.5 text-gray-400 font-normal">({form.forecastSteps.length}개 선택)</span>
                </label>
                <div className="flex gap-3 text-xs">
                  {[
                    { label: '전체 선택', action: () => setForm(f => ({ ...f, forecastSteps: ALL_STEPS })) },
                    { label: '기본값',   action: () => setForm(f => ({ ...f, forecastSteps: DFLT_STEPS })) },
                    { label: '초기화',   action: () => setForm(f => ({ ...f, forecastSteps: [] })) },
                  ].map(({ label, action }) => (
                    <button key={label} onClick={action} className="text-blue-500 hover:text-blue-700">{label}</button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-9 gap-1.5">
                {ALL_STEPS.map(step => {
                  const on = form.forecastSteps.includes(step);
                  return (
                    <button
                      key={step}
                      onClick={() => toggleStep(step)}
                      className={`py-1.5 rounded-lg border text-xs font-semibold transition-colors ${
                        on
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'border-gray-200 text-gray-400 hover:border-blue-300 hover:text-blue-600'
                      }`}
                    >
                      {step}
                    </button>
                  );
                })}
              </div>
              <p className="text-[11px] text-gray-400">단위: 분 / 기본값 — 10, 20, 30, 60, 90, 120, 180분</p>
            </div>

            {/* 미리보기 이미지 토글 */}
            <div className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3">
              <div>
                <p className="text-sm font-medium text-gray-700">ASC 미리보기 이미지 생성</p>
                <p className="text-xs text-gray-400 mt-0.5">완료 후 QPF 예측 슬라이드를 생성합니다.</p>
              </div>
              <button
                onClick={() => setForm(f => ({ ...f, includePreview: !f.includePreview }))}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border-2 border-transparent transition-colors ${
                  form.includePreview ? 'bg-blue-600' : 'bg-gray-300'
                }`}
              >
                <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${
                  form.includePreview ? 'translate-x-5' : 'translate-x-0'
                }`} />
              </button>
            </div>
          </div>

          {/* ── 3. 입력 ASC 파일 ── */}
          <div className={sec}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">입력 ASC 파일</h3>
              <p className="text-xs text-gray-400">운용 시점 기준 4개 관측 시각</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {FILE_META.map(({ key, label, desc, offset }) => {
                const file = form.files[key];
                const stamp = ts(offset);
                return (
                  <label
                    key={key}
                    className={`relative flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-xl p-4 cursor-pointer transition-colors ${
                      file
                        ? 'border-blue-300 bg-blue-50'
                        : 'border-gray-200 bg-gray-50 hover:border-blue-300 hover:bg-blue-50/60'
                    }`}
                  >
                    <input
                      type="file"
                      accept=".asc,.txt"
                      className="absolute inset-0 opacity-0 cursor-pointer"
                      onChange={handleFile(key)}
                    />
                    {file ? (
                      <>
                        <svg className="w-5 h-5 text-blue-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <p className="text-xs font-semibold text-blue-700 text-center w-full truncate px-1">{file.name}</p>
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5 text-gray-300 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                        <p className="text-xs text-gray-400">클릭하여 업로드</p>
                      </>
                    )}
                    <div className="text-center">
                      <p className="text-xs font-bold text-gray-700">{label}</p>
                      <p className="text-[10px] text-gray-400">{desc}</p>
                      {stamp && <p className="text-[10px] text-blue-500 font-mono mt-0.5">{stamp}</p>}
                    </div>
                  </label>
                );
              })}
            </div>
            <p className="text-[11px] text-gray-400 mt-2">
              파일 없이도 학습을 시작할 수 있습니다. 백엔드 기본값이 적용됩니다.
            </p>
          </div>
        </div>

        {/* 푸터 */}
        <div className="flex-shrink-0 border-t border-gray-100 px-6 py-4 flex items-center gap-3">
          <div className="flex-1 min-w-0">
            {error && <p className="text-xs text-red-500">{error}</p>}
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors flex-shrink-0"
          >
            취소
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || !form.experimentName || !form.runDatetime || form.forecastSteps.length === 0}
            className="px-5 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2 flex-shrink-0"
          >
            {submitting && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
            학습 시작
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── 페이지 ───────────────────────────────────────────────────────────────────

function TrainingsContent() {
  const searchParams = useSearchParams();
  const logsEndRef = useRef<HTMLDivElement>(null);

  const [trainings,    setTrainings]    = useState<TrainingJob[]>([]);
  const [loading,      setLoading]      = useState(false);
  const [showModal,    setShowModal]    = useState(false);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [selectedId,   setSelectedId]   = useState<number | null>(null);
  const [logs,         setLogs]         = useState<string[]>([]);
  const [logsLoading,  setLogsLoading]  = useState(false);

  const refresh = () => {
    setLoading(true);
    getTrainings()
      .then(data => setTrainings(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { refresh(); }, []);

  useEffect(() => {
    const status = searchParams.get('status');
    if (status) setStatusFilter(status.toUpperCase());
  }, [searchParams]);

  const hasActive = trainings.some(t => ['RUNNING', 'QUEUED'].includes(t.status.toUpperCase()));

  useEffect(() => {
    if (!hasActive) return;
    const id = setInterval(() => {
      getTrainings().then(data => setTrainings(data)).catch(() => {});
    }, POLL_MS);
    return () => clearInterval(id);
  }, [hasActive]);

  const selectedJob       = trainings.find(t => t.job_id === selectedId) ?? null;
  const isSelectedRunning = selectedJob?.status.toUpperCase() === 'RUNNING';

  useEffect(() => {
    if (selectedId == null) { setLogs([]); return; }
    setLogsLoading(true);
    getTrainingLogs(selectedId)
      .then(r => { setLogs(r.logs); })
      .catch(() => setLogs([]))
      .finally(() => {
        setLogsLoading(false);
        setTimeout(() => logsEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
      });
  }, [selectedId]);

  useEffect(() => {
    if (selectedId == null || !isSelectedRunning) return;
    const id = setInterval(() => {
      getTrainingLogs(selectedId)
        .then(r => {
          setLogs(r.logs);
          setTimeout(() => logsEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
        })
        .catch(() => {});
    }, POLL_MS);
    return () => clearInterval(id);
  }, [selectedId, isSelectedRunning]);

  const displayed = statusFilter
    ? trainings.filter(t => {
        const s = t.status.toUpperCase();
        return s === statusFilter || (statusFilter === 'FAILED' && s === 'CANCELED');
      })
    : trainings;

  const handleModalSubmit = async (form: TrainingForm) => {
    const makeFile = async (file: File | null, offset: number) => {
      if (!file) return { filename: null, timestamp: null, file_data: null };
      return {
        filename:  file.name,
        timestamp: form.runDatetime ? calculateTimestamp(toApiDt(form.runDatetime), offset) : null,
        file_data: await fileToBase64(file),
      };
    };
    await createTraining({
      user_name:             form.userName || 'admin',
      experiment_name:       form.experimentName,
      run_datetime:          form.runDatetime ? toApiDt(form.runDatetime) : null,
      model_version:         form.modelVersion,
      forecast_steps:        form.forecastSteps,
      include_preview_image: form.includePreview,
      experiment_memo:       form.memo || null,
      input_files: {
        file_t0: await makeFile(form.files.t0,   0),
        file_t1: await makeFile(form.files.t1, -10),
        file_t2: await makeFile(form.files.t2, -20),
        file_t3: await makeFile(form.files.t3, -30),
      },
    });
    refresh();
  };

  return (
    <Layout>
      {/* 모달 */}
      {showModal && (
        <TrainingModal
          onClose={() => setShowModal(false)}
          onSubmit={handleModalSubmit}
        />
      )}

      {/* 페이지 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">학습 관리</h1>
          <p className="text-sm text-gray-500 mt-0.5">학습 잡을 생성하고 실행 현황을 모니터링합니다.</p>
        </div>
        <div className="flex items-center gap-3">
          {hasActive && (
            <span className="flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              실시간 업데이트 중
            </span>
          )}
          <button
            onClick={refresh}
            className="flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 transition"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            새로고침
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition shadow-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            새 학습 시작
          </button>
        </div>
      </div>

      {/* 학습 목록 */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-gray-700">학습 목록</span>
            {statusFilter && (
              <span className="inline-flex items-center gap-1 bg-blue-50 border border-blue-200 text-blue-700 px-2 py-0.5 rounded-full text-xs font-medium">
                {statusFilter}
                <button
                  onClick={() => setStatusFilter(null)}
                  className="ml-0.5 text-blue-400 hover:text-blue-600 transition-colors"
                >
                  <svg viewBox="0 0 12 12" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M2 2l8 8M10 2l-8 8" />
                  </svg>
                </button>
              </span>
            )}
          </div>
          {loading && <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />}
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              {['ID', '실험명', '모드', '상태', '진행률', '작성일', '작업'].map(h => (
                <th key={h} className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {displayed.map(t => {
              const s = t.status.toUpperCase();
              return (
                <tr
                  key={t.job_id}
                  onClick={() => setSelectedId(prev => prev === t.job_id ? null : t.job_id)}
                  className={`cursor-pointer transition-colors ${
                    selectedId === t.job_id ? 'bg-blue-50' : 'hover:bg-gray-50'
                  }`}
                >
                  <td className="px-5 py-3">
                    <span className="font-mono text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                      #{t.job_id}
                    </span>
                  </td>
                  <td className="px-5 py-3 font-medium text-gray-800">{t.experiment_name}</td>
                  <td className="px-5 py-3 text-gray-500">{t.mode}</td>
                  <td className="px-5 py-3"><StatusBadge status={t.status} /></td>
                  <td className="px-5 py-3">
                    {s === 'RUNNING' ? (
                      <ProgressBar progress={t.progress} currentEpoch={t.current_epoch} totalEpochs={t.total_epochs} />
                    ) : (
                      <span className="text-xs text-gray-300">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-gray-400 text-xs">{t.created_at?.slice(0, 10) ?? '-'}</td>
                  <td className="px-5 py-3">
                    {s === 'RUNNING' && (
                      <button onClick={e => { e.stopPropagation(); refresh(); }} className="text-xs text-red-600 hover:underline mr-2">
                        정지
                      </button>
                    )}
                    {(s === 'COMPLETED' || s === 'FAILED') && (
                      <button onClick={e => { e.stopPropagation(); refresh(); }} className="text-xs text-amber-600 hover:underline">
                        재설정
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {trainings.length === 0 && !loading && (
          <div className="py-16 text-center text-gray-400 text-sm">등록된 학습이 없습니다.</div>
        )}
      </div>

      {/* 로그 패널 */}
      {selectedId != null && (
        <div className="mt-4 bg-gray-900 rounded-xl border border-gray-700 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-700 flex items-center gap-3">
            <span className="text-sm font-semibold text-gray-200 flex-1">
              로그 — Job #{selectedId}
              {isSelectedRunning && (
                <span className="ml-2 inline-flex items-center gap-1 text-xs text-emerald-400 font-normal">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  실시간
                </span>
              )}
            </span>
            {logsLoading && <div className="w-3.5 h-3.5 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin flex-shrink-0" />}
            <button
              onClick={() => setSelectedId(null)}
              className="flex-shrink-0 text-gray-500 hover:text-gray-200 transition-colors"
            >
              <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 4l8 8M12 4l-8 8" />
              </svg>
            </button>
          </div>
          <div className="p-4 max-h-64 overflow-y-auto font-mono text-xs text-gray-300 leading-5 space-y-px">
            {logs.length === 0
              ? <span className="text-gray-500">로그가 없습니다.</span>
              : logs.map((line, i) => <div key={i}>{line}</div>)
            }
            <div ref={logsEndRef} />
          </div>
        </div>
      )}
    </Layout>
  );
}

export default function Trainings() {
  return (
    <Suspense fallback={null}>
      <TrainingsContent />
    </Suspense>
  );
}
