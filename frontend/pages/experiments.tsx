'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Layout from '../lib/Layout';
import {
  getExperiments,
  getExperimentRuns,
  createExperiment,
  fileToBase64,
  calculateTimestamp,
  type Experiment,
  type ExperimentRun,
  type ExperimentCreateResponse,
} from '../lib/api';

// ─── 파일 상태 타입 ────────────────────────────────────────────────────────────

interface AscFileState {
  file: File | null;
  filename: string | null;
  timestamp: string | null;
  fileData: string | null;
}

const EMPTY_FILE: AscFileState = { file: null, filename: null, timestamp: null, fileData: null };

// 파일 슬롯별 설정 (API: file_t0=T-30분, file_t3=현재)
const FILE_SLOTS = [
  { key: 't0' as const, label: 'T-30분', sublabel: '30분 전 관측', offset: -30 },
  { key: 't1' as const, label: 'T-20분', sublabel: '20분 전 관측', offset: -20 },
  { key: 't2' as const, label: 'T-10분', sublabel: '10분 전 관측', offset: -10 },
  { key: 't3' as const, label: 'T (현재)', sublabel: '현재 관측',    offset: 0 },
];

type SlotKey = 't0' | 't1' | 't2' | 't3';

// ─── 파일 업로드 카드 컴포넌트 ────────────────────────────────────────────────

function FileCard({
  label,
  sublabel,
  state,
  disabled,
  onFile,
}: {
  label: string;
  sublabel: string;
  state: AscFileState;
  disabled: boolean;
  onFile: (file: File | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div
      onClick={() => !disabled && inputRef.current?.click()}
      className={`relative rounded-xl border-2 p-4 transition-all ${
        disabled
          ? 'opacity-50 cursor-not-allowed border-gray-200 bg-gray-50'
          : state.file
          ? 'border-blue-400 bg-blue-50 cursor-pointer hover:border-blue-500'
          : 'border-dashed border-gray-300 bg-white cursor-pointer hover:border-blue-400 hover:bg-gray-50'
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".asc,.txt,.csv,.dat"
        className="hidden"
        onChange={e => onFile(e.target.files?.[0] ?? null)}
        disabled={disabled}
      />

      <div className="flex items-center justify-between mb-2">
        <div>
          <span className="text-sm font-semibold text-gray-700">{label}</span>
          <span className="ml-2 text-xs text-gray-400">{sublabel}</span>
        </div>
        {state.file && (
          <button
            type="button"
            onClick={e => { e.stopPropagation(); onFile(null); }}
            className="text-xs text-red-400 hover:text-red-600 font-medium"
          >
            삭제
          </button>
        )}
      </div>

      {state.file ? (
        <div>
          <p className="text-sm font-medium text-blue-700 truncate">{state.filename}</p>
          <p className="text-xs text-gray-500 mt-1">
            {(state.file.size / 1024).toFixed(1)} KB
            {state.timestamp && <span className="ml-2 text-gray-400">· {state.timestamp}</span>}
          </p>
        </div>
      ) : (
        <p className="text-xs text-gray-400 text-center py-2">클릭하여 .asc 파일 선택</p>
      )}
    </div>
  );
}

// ─── 상태 뱃지 ────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string | null }) {
  const s = (status ?? '').toUpperCase();
  const cls =
    s === 'RUNNING'   ? 'bg-green-100 text-green-800' :
    s === 'COMPLETED' ? 'bg-blue-100 text-blue-800' :
    s === 'FAILED'    ? 'bg-red-100 text-red-800' :
    s === 'QUEUED'    ? 'bg-yellow-100 text-yellow-800' :
    'bg-gray-100 text-gray-800';
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>
      {status ?? '-'}
    </span>
  );
}

// ─── 메인 페이지 ──────────────────────────────────────────────────────────────

export default function ExperimentsPage() {
  const [activeView, setActiveView] = useState<'list' | 'create'>('list');

  // 목록 상태
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [runs, setRuns] = useState<ExperimentRun[]>([]);
  const [runsLoading, setRunsLoading] = useState(false);

  // 생성 폼 상태
  const [runDatetime, setRunDatetime]         = useState('');
  const [modelVersion, setModelVersion]       = useState<'v2' | 'v3'>('v3');
  const [forecastSteps, setForecastSteps]     = useState('10,20,30,60,90,120,180');
  const [includePreview, setIncludePreview]   = useState(true);
  const [experimentName, setExperimentName]   = useState('');
  const [experimentTags, setExperimentTags]   = useState('');
  const [experimentMemo, setExperimentMemo]   = useState('');
  const [files, setFiles]                     = useState<Record<SlotKey, AscFileState>>({
    t0: EMPTY_FILE, t1: EMPTY_FILE, t2: EMPTY_FILE, t3: EMPTY_FILE,
  });
  const [submitting, setSubmitting]           = useState(false);
  const [submitResult, setSubmitResult]       = useState<ExperimentCreateResponse | null>(null);
  const [submitError, setSubmitError]         = useState<string | null>(null);

  // ─── 목록 로드 ─────────────────────────────────────────────────────────────

  const loadExperiments = useCallback(async () => {
    setListLoading(true);
    try {
      setExperiments(await getExperiments());
    } catch {
      // silent
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => {
    loadExperiments();
  }, [loadExperiments]);

  // ─── Run 펼치기/접기 ───────────────────────────────────────────────────────

  const toggleRuns = async (expId: number) => {
    if (expandedId === expId) {
      setExpandedId(null);
      setRuns([]);
      return;
    }
    setExpandedId(expId);
    setRunsLoading(true);
    try {
      setRuns(await getExperimentRuns(expId));
    } catch {
      setRuns([]);
    } finally {
      setRunsLoading(false);
    }
  };

  // ─── 파일 변경 핸들러 ──────────────────────────────────────────────────────

  const handleFile = async (slotKey: SlotKey, file: File | null) => {
    if (!file) {
      setFiles(prev => ({ ...prev, [slotKey]: EMPTY_FILE }));
      return;
    }
    const slot = FILE_SLOTS.find(s => s.key === slotKey)!;
    const base = runDatetime ||
      (() => {
        const now = new Date();
        const p = (n: number, l = 2) => String(n).padStart(l, '0');
        return `${now.getFullYear()}${p(now.getMonth()+1)}${p(now.getDate())}${p(now.getHours())}${p(now.getMinutes())}`;
      })();
    const timestamp = calculateTimestamp(base, slot.offset);
    const fileData  = await fileToBase64(file);
    setFiles(prev => ({
      ...prev,
      [slotKey]: { file, filename: file.name, timestamp, fileData },
    }));
  };

  // run_datetime이 바뀌면 이미 업로드된 파일들의 timestamp 재계산
  useEffect(() => {
    if (!runDatetime) return;
    setFiles(prev => {
      const next = { ...prev };
      (Object.keys(next) as SlotKey[]).forEach(key => {
        const s = next[key];
        if (s.file) {
          const slot = FILE_SLOTS.find(sl => sl.key === key)!;
          next[key] = { ...s, timestamp: calculateTimestamp(runDatetime, slot.offset) };
        }
      });
      return next;
    });
  }, [runDatetime]);

  // ─── 폼 제출 ───────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (!runDatetime) {
      setSubmitError('운용 시점을 선택해주세요.');
      return;
    }
    setSubmitError(null);
    setSubmitting(true);
    try {
      const steps = forecastSteps
        .split(',')
        .map(s => parseInt(s.trim()))
        .filter(n => !isNaN(n) && n >= 10 && n <= 180 && n % 10 === 0);

      const result = await createExperiment({
        run_datetime:          runDatetime,
        input_files: {
          file_t0: { filename: files.t0.filename, timestamp: files.t0.timestamp, file_data: files.t0.fileData },
          file_t1: { filename: files.t1.filename, timestamp: files.t1.timestamp, file_data: files.t1.fileData },
          file_t2: { filename: files.t2.filename, timestamp: files.t2.timestamp, file_data: files.t2.fileData },
          file_t3: { filename: files.t3.filename, timestamp: files.t3.timestamp, file_data: files.t3.fileData },
        },
        model_version:         modelVersion,
        forecast_steps:        steps.length > 0 ? steps : null,
        include_preview_image: includePreview,
        experiment_name:       experimentName || null,
        experiment_tags:       experimentTags
          ? experimentTags.split(',').map(t => t.trim()).filter(Boolean).slice(0, 10)
          : null,
        experiment_memo:       experimentMemo || null,
      });
      setSubmitResult(result);
      // 폼 초기화
      setRunDatetime('');
      setExperimentName('');
      setExperimentTags('');
      setExperimentMemo('');
      setFiles({ t0: EMPTY_FILE, t1: EMPTY_FILE, t2: EMPTY_FILE, t3: EMPTY_FILE });
      await loadExperiments();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : '실험 생성에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const switchToCreate = () => {
    setActiveView('create');
    setSubmitResult(null);
    setSubmitError(null);
  };

  // ─── 렌더 ─────────────────────────────────────────────────────────────────

  if (activeView === 'create') {
    return <CreateView
      runDatetime={runDatetime}      setRunDatetime={setRunDatetime}
      modelVersion={modelVersion}    setModelVersion={setModelVersion}
      forecastSteps={forecastSteps}  setForecastSteps={setForecastSteps}
      includePreview={includePreview} setIncludePreview={setIncludePreview}
      experimentName={experimentName} setExperimentName={setExperimentName}
      experimentTags={experimentTags} setExperimentTags={setExperimentTags}
      experimentMemo={experimentMemo} setExperimentMemo={setExperimentMemo}
      files={files}
      onFile={handleFile}
      submitting={submitting}
      submitResult={submitResult}
      submitError={submitError}
      onSubmit={handleSubmit}
      onCancel={() => setActiveView('list')}
    />;
  }

  return (
    <Layout>
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">실험 관리</h1>
          <p className="text-sm text-gray-500 mt-0.5">QPE 모델 추론 실험을 생성하고 결과를 확인합니다.</p>
        </div>
        <button
          onClick={switchToCreate}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition"
        >
          + 새 실험
        </button>
      </div>

      {/* 목록 */}
      {listLoading ? (
        <div className="flex items-center justify-center py-16 text-gray-400">로딩 중...</div>
      ) : experiments.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-gray-400 mb-4">등록된 실험이 없습니다.</p>
          <button onClick={switchToCreate} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">
            첫 번째 실험 시작하기
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {experiments.map(exp => (
            <div key={exp.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              {/* 실험 헤더 */}
              <div
                className="p-5 cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => toggleRuns(exp.id)}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-900">{exp.name}</h3>
                    <p className="text-xs text-gray-400 mt-0.5">
                      ID: {exp.id}
                      {exp.description && <span className="ml-2">{exp.description}</span>}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {exp.created_at && (
                      <span className="text-xs text-gray-400">
                        {new Date(exp.created_at).toLocaleString('ko-KR', {
                          month: '2-digit', day: '2-digit',
                          hour: '2-digit', minute: '2-digit',
                        })}
                      </span>
                    )}
                    <span className="text-gray-400 text-sm">{expandedId === exp.id ? '▲' : '▼'}</span>
                  </div>
                </div>
              </div>

              {/* Run 목록 (펼침) */}
              {expandedId === exp.id && (
                <div className="border-t border-gray-100 bg-gray-50">
                  {runsLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                  ) : runs.length === 0 ? (
                    <p className="p-4 text-center text-sm text-gray-400">실행 기록이 없습니다.</p>
                  ) : (
                    <div className="divide-y divide-gray-200">
                      {runs.map(run => (
                        <div key={run.id} className="px-5 py-3 flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-gray-800">
                              {run.run_name ?? `Run #${run.id}`}
                            </p>
                            <div className="flex gap-3 text-xs text-gray-400 mt-0.5">
                              {run.job_id   && <span>Job #{run.job_id}</span>}
                              {run.version  && <span>v{run.version}</span>}
                              {run.mode     && <span>{run.mode}</span>}
                              {run.started_at && (
                                <span>
                                  {new Date(run.started_at).toLocaleString('ko-KR', {
                                    month: '2-digit', day: '2-digit',
                                    hour: '2-digit', minute: '2-digit',
                                  })}
                                </span>
                              )}
                              {run.duration_seconds != null && (
                                <span>{run.duration_seconds}초</span>
                              )}
                            </div>
                          </div>
                          <StatusBadge status={run.status} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Layout>
  );
}

// ─── 실험 생성 폼 ─────────────────────────────────────────────────────────────

interface CreateViewProps {
  runDatetime: string;      setRunDatetime: (v: string) => void;
  modelVersion: 'v2' | 'v3'; setModelVersion: (v: 'v2' | 'v3') => void;
  forecastSteps: string;    setForecastSteps: (v: string) => void;
  includePreview: boolean;  setIncludePreview: (v: boolean) => void;
  experimentName: string;   setExperimentName: (v: string) => void;
  experimentTags: string;   setExperimentTags: (v: string) => void;
  experimentMemo: string;   setExperimentMemo: (v: string) => void;
  files: Record<SlotKey, AscFileState>;
  onFile: (key: SlotKey, file: File | null) => void;
  submitting: boolean;
  submitResult: ExperimentCreateResponse | null;
  submitError: string | null;
  onSubmit: () => void;
  onCancel: () => void;
}

function CreateView({
  runDatetime, setRunDatetime,
  modelVersion, setModelVersion,
  forecastSteps, setForecastSteps,
  includePreview, setIncludePreview,
  experimentName, setExperimentName,
  experimentTags, setExperimentTags,
  experimentMemo, setExperimentMemo,
  files, onFile,
  submitting, submitResult, submitError,
  onSubmit, onCancel,
}: CreateViewProps) {

  const inputCls = 'w-full px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-900 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none';
  const sectionCls = 'bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-5';
  const labelCls = 'block text-sm font-medium text-gray-700 mb-1.5';

  return (
    <Layout>
      <div className="max-w-3xl mx-auto">
        {/* 헤더 */}
        <div className="mb-6">
          <button onClick={onCancel} className="text-sm text-gray-500 hover:text-gray-700 mb-3 flex items-center gap-1">
            ← 실험 목록
          </button>
          <h1 className="text-2xl font-bold text-gray-900">새 실험 생성</h1>
          <p className="text-sm text-gray-500 mt-1">관측 파일과 파라미터를 입력하여 QPE 추론 실험을 시작합니다.</p>
        </div>

        {/* 성공 메시지 */}
        {submitResult && (
          <div className="mb-5 p-4 bg-green-50 border border-green-200 rounded-xl">
            <p className="font-semibold text-green-800">실험 등록 완료</p>
            <p className="text-sm text-green-700 mt-1">
              Job #{submitResult.job_id} · 대기 순서: {submitResult.queue_position}번째
            </p>
            <p className="text-xs text-green-600 mt-1">{submitResult.message}</p>
          </div>
        )}

        {/* 에러 메시지 */}
        {submitError && (
          <div className="mb-5 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
            {submitError}
          </div>
        )}

        {/* 섹션 1: 운용 시점 및 모델 설정 */}
        <div className={sectionCls}>
          <h2 className="text-base font-semibold text-gray-900 mb-4">운용 시점 및 모델 설정</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>
                운용 시점 <span className="text-red-500">*</span>
              </label>
              <input
                type="datetime-local"
                value={runDatetime
                  ? `${runDatetime.slice(0,4)}-${runDatetime.slice(4,6)}-${runDatetime.slice(6,8)}T${runDatetime.slice(8,10)}:${runDatetime.slice(10,12)}`
                  : ''}
                onChange={e => {
                  if (!e.target.value) { setRunDatetime(''); return; }
                  const d = new Date(e.target.value);
                  const p = (n: number) => String(n).padStart(2, '0');
                  setRunDatetime(
                    `${d.getFullYear()}${p(d.getMonth()+1)}${p(d.getDate())}${p(d.getHours())}${p(d.getMinutes())}`
                  );
                }}
                className={inputCls}
              />
              {runDatetime && (
                <p className="mt-1 text-xs text-gray-400">형식: {runDatetime}</p>
              )}
            </div>
            <div>
              <label className={labelCls}>모델 버전</label>
              <div className="flex gap-2">
                {(['v2', 'v3'] as const).map(v => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setModelVersion(v)}
                    className={`flex-1 py-2 rounded-lg border text-sm font-medium transition ${
                      modelVersion === v
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-300 text-gray-600 hover:border-gray-400'
                    }`}
                  >
                    {v === 'v3' ? 'v3 (기본값)' : 'v2'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* 섹션 2: 관측 파일 업로드 */}
        <div className={sectionCls}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold text-gray-900">관측 파일 업로드 (QPE .asc)</h2>
              <p className="text-xs text-gray-400 mt-0.5">
                4개 시점의 강수량 관측 파일을 업로드합니다. 운용 시점 기준으로 타임스탬프가 자동 계산됩니다.
              </p>
            </div>
            <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded">
              {Object.values(files).filter(f => f.file).length} / 4
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {FILE_SLOTS.map(slot => (
              <FileCard
                key={slot.key}
                label={slot.label}
                sublabel={slot.sublabel}
                state={files[slot.key]}
                disabled={submitting}
                onFile={file => onFile(slot.key, file)}
              />
            ))}
          </div>
        </div>

        {/* 섹션 3: 예측 설정 */}
        <div className={sectionCls}>
          <h2 className="text-base font-semibold text-gray-900 mb-4">예측 설정</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>
                예측 선행시간 (분, 쉼표 구분)
              </label>
              <input
                type="text"
                value={forecastSteps}
                onChange={e => setForecastSteps(e.target.value)}
                placeholder="예: 10,20,30,60"
                className={inputCls}
              />
              <div className="flex gap-1.5 mt-2 flex-wrap">
                {['10,20,30', '30,60,90', '60,120,180', '10,20,30,40,50,60,70,80,90,100,110,120,130,140,150,160,170,180'].map((preset, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setForecastSteps(preset)}
                    className="text-xs px-2 py-0.5 rounded border border-gray-300 text-gray-600 hover:border-blue-400 hover:text-blue-600"
                  >
                    {i < 3 ? preset : '전체'}
                  </button>
                ))}
              </div>
              <p className="mt-1.5 text-xs text-gray-400">10~180 사이 10의 배수. 비워두면 전체 선행시간 계산.</p>
            </div>
            <div>
              <label className={labelCls}>PNG 미리보기 이미지 포함</label>
              <div className="flex gap-2">
                {[true, false].map(v => (
                  <button
                    key={String(v)}
                    type="button"
                    onClick={() => setIncludePreview(v)}
                    className={`flex-1 py-2 rounded-lg border text-sm font-medium transition ${
                      includePreview === v
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-300 text-gray-600 hover:border-gray-400'
                    }`}
                  >
                    {v ? '포함 (기본값)' : '제외'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* 섹션 4: 실험 정보 (선택) */}
        <div className={sectionCls}>
          <h2 className="text-base font-semibold text-gray-900 mb-4">
            실험 정보
            <span className="ml-2 text-xs font-normal text-gray-400">선택 사항</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className={labelCls}>실험 이름 (최대 100자)</label>
              <input
                type="text"
                value={experimentName}
                onChange={e => setExperimentName(e.target.value)}
                maxLength={100}
                placeholder="예: 2026-06-05 10:00 실험"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>태그 (쉼표 구분, 최대 10개)</label>
              <input
                type="text"
                value={experimentTags}
                onChange={e => setExperimentTags(e.target.value)}
                placeholder="예: 강우, 실시간, 검증"
                className={inputCls}
              />
            </div>
          </div>
          <div>
            <label className={labelCls}>메모 (최대 1000자)</label>
            <textarea
              value={experimentMemo}
              onChange={e => setExperimentMemo(e.target.value)}
              maxLength={1000}
              rows={3}
              placeholder="실험에 대한 메모를 입력하세요."
              className={`${inputCls} resize-none`}
            />
          </div>
        </div>

        {/* 제출 버튼 */}
        <div className="flex justify-end gap-3 pb-8">
          <button
            type="button"
            onClick={onCancel}
            className="px-6 py-2.5 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50 transition"
          >
            취소
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={submitting || !runDatetime}
            className="px-6 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {submitting ? '등록 중...' : '실험 시작'}
          </button>
        </div>
      </div>
    </Layout>
  );
}
