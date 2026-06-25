'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Layout from '@/lib/Layout';
import {
  getExperimentJobs, getModels, getTrainingLogs, getTrainingResult,
  createExperimentJob,
  fileToBase64, calculateTimestamp, getUsername, displayUsername, formatExecutionName,
  type TrainingJob, type AscFileInput, type ModelVersion,
  type TrainingResult,
} from '@/lib/api';
import {
  loadClientExperiments, addTcToExpMap, getUserTcJobIds, saveTcMemo,
  loadTcModelMeta, saveTcModelMeta,
  type ClientExperiment,
} from '@/lib/experimentStore';
import { mergeRegisteredModels } from '@/lib/modelStore';
import { metricsOrSample } from '@/lib/metrics';

// ─── 상수 ────────────────────────────────────────────────────────────────────

const POLL_MS   = 3000;
const ALL_STEPS = [10,20,30,40,50,60,70,80,90,100,110,120,130,140,150,160,170,180];
const DEFAULT_OBSERVATION_DATASET_DIR = '/data/observations/default';
const GOLD_MEDAL_KEY_PREFIX = 'kict_gold_execution_';

const FALLBACK_MODELS: ModelVersion[] = [
  { id: 1, experiment_id: 0, run_id: null, model_name: 'KICT-RAIN-AI', version: 'Ver.3',
    status: 'CREATED', metrics: { architecture: 'multi' }, model_path: null, created_at: null },
  { id: 2, experiment_id: 0, run_id: null, model_name: 'KICT-RAIN-AI', version: 'Ver.2',
    status: 'CREATED', metrics: { architecture: 'multi' }, model_path: null, created_at: null },
  { id: 3, experiment_id: 0, run_id: null, model_name: 'KICT-RAIN-AI', version: 'Ver.1',
    status: 'CREATED', metrics: { architecture: 'single' }, model_path: null, created_at: null },
];

// ─── 유틸 ─────────────────────────────────────────────────────────────────────

type SlotKey = 't0' | 't1' | 't2' | 't3';

interface FileState { file: File | null; name: string | null; }
interface FormFiles { t0: FileState; t1: FileState; t2: FileState; t3: FileState; }
interface AscFolderState { folderName: string; files: File[]; mappedFiles: FormFiles; validationError: string | null; }

const EMPTY_FILE:  FileState = { file: null, name: null };
const EMPTY_FILES: FormFiles = { t0: EMPTY_FILE, t1: EMPTY_FILE, t2: EMPTY_FILE, t3: EMPTY_FILE };
const EMPTY_ASC_FOLDER: AscFolderState = { folderName: '', files: [], mappedFiles: EMPTY_FILES, validationError: null };

const FILE_SLOTS = [
  { key: 't0' as SlotKey, label: 'T-30분',   desc: '30분 전 관측', offset: -30 },
  { key: 't1' as SlotKey, label: 'T-20분',   desc: '20분 전 관측', offset: -20 },
  { key: 't2' as SlotKey, label: 'T-10분',   desc: '10분 전 관측', offset: -10 },
  { key: 't3' as SlotKey, label: 'T (현재)', desc: '현재 관측',    offset:   0 },
];

const ASC_FILE_EXTENSIONS = ['.asc'];

function isSupportedAscFile(file: File): boolean {
  return ASC_FILE_EXTENSIONS.some(ext => file.name.toLowerCase().endsWith(ext));
}

function getNowDt(): string {
  const now = new Date();
  const p   = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}${p(now.getMonth()+1)}${p(now.getDate())}${p(now.getHours())}${p(now.getMinutes())}`;
}

function toApiRunDatetime(compact: string): string {
  return `${compact.slice(0,4)}-${compact.slice(4,6)}-${compact.slice(6,8)}T${compact.slice(8,10)}:${compact.slice(10,12)}:00`;
}

function addMinutesToCompactDt(compact: string, minutes: number): string {
  const date = new Date(
    Number(compact.slice(0, 4)),
    Number(compact.slice(4, 6)) - 1,
    Number(compact.slice(6, 8)),
    Number(compact.slice(8, 10)),
    Number(compact.slice(10, 12)) + minutes,
  );
  const p = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}${p(date.getMonth() + 1)}${p(date.getDate())}${p(date.getHours())}${p(date.getMinutes())}`;
}

function getCompactDtFromFilename(filename: string | null): string | null {
  if (!filename) return null;
  const m = filename.match(/(20\d{10})/);
  if (m) return m[1];
  const s = filename.match(/(20\d{2})[-_]?(\d{2})[-_]?(\d{2})[-_T]?(\d{2})[-_]?(\d{2})/);
  if (!s) return null;
  return `${s[1]}${s[2]}${s[3]}${s[4]}${s[5]}`;
}

function getFilePath(file: File): string {
  return (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
}

function getFolderNameFromFiles(files: File[]): string {
  const first = files[0];
  if (!first) return '';
  const relativePath = getFilePath(first);
  return relativePath.includes('/') ? relativePath.split('/')[0] : 'ASC 파일 묶음';
}

function toBackendModelVersion(version: string): string {
  const normalized = version.trim().toLowerCase().replace(/\s+/g, '');
  if (normalized === 'ver.1' || normalized === 'ver1' || normalized === 'v1') return 'ver1';
  if (normalized === 'ver.2' || normalized === 'ver2' || normalized === 'v2') return 'v2';
  if (normalized === 'ver.3' || normalized === 'ver3' || normalized === 'v3') return 'v3';
  return version;
}

function mapAscFiles(files: File[]): FormFiles {
  const usable = files
    .filter(isSupportedAscFile)
    .sort((a, b) => {
      const aDt = getCompactDtFromFilename(a.name);
      const bDt = getCompactDtFromFilename(b.name);
      if (aDt && bDt && aDt !== bDt) return aDt.localeCompare(bDt);
      if (aDt && !bDt) return -1;
      if (!aDt && bDt) return 1;
      return getFilePath(a).localeCompare(getFilePath(b));
    });

  const byTimestamp = new Map<string, File>();
  for (const file of usable) {
    const dt = getCompactDtFromFilename(file.name);
    if (dt && !byTimestamp.has(dt)) byTimestamp.set(dt, file);
  }

  const timestamps = Array.from(byTimestamp.keys()).sort();
  for (let i = timestamps.length - 1; i >= 0; i -= 1) {
    const t3Dt = timestamps[i];
    const t0 = byTimestamp.get(addMinutesToCompactDt(t3Dt, -30));
    const t1 = byTimestamp.get(addMinutesToCompactDt(t3Dt, -20));
    const t2 = byTimestamp.get(addMinutesToCompactDt(t3Dt, -10));
    const t3 = byTimestamp.get(t3Dt);
    const hasAllTargets = ALL_STEPS.every(step => byTimestamp.has(addMinutesToCompactDt(t3Dt, step)));

    if (t0 && t1 && t2 && t3 && hasAllTargets) {
      return {
        t0: { file: t0, name: t0.name },
        t1: { file: t1, name: t1.name },
        t2: { file: t2, name: t2.name },
        t3: { file: t3, name: t3.name },
      };
    }
  }

  const latest = usable.slice(-4);
  return {
    t0: latest[0] ? { file: latest[0], name: latest[0].name } : EMPTY_FILE,
    t1: latest[1] ? { file: latest[1], name: latest[1].name } : EMPTY_FILE,
    t2: latest[2] ? { file: latest[2], name: latest[2].name } : EMPTY_FILE,
    t3: latest[3] ? { file: latest[3], name: latest[3].name } : EMPTY_FILE,
  };
}

function fmtDt(iso: string | null): string {
  if (!iso) return '-';
  return new Date(iso).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function fmtDur(start: string | null, end: string | null): string {
  if (!start || !end) return '-';
  const s = Math.floor((new Date(end).getTime() - new Date(start).getTime()) / 1000);
  if (s < 60)   return `${s}초`;
  if (s < 3600) return `${Math.floor(s/60)}분 ${s%60}초`;
  return `${Math.floor(s/3600)}시간 ${Math.floor((s%3600)/60)}분`;
}

// ─── 상태 배지 ────────────────────────────────────────────────────────────────

const STATUS_CLS: Record<string, string> = {
  RUNNING:   'bg-emerald-100 text-emerald-800',
  QUEUED:    'bg-amber-100   text-amber-800',
  COMPLETED: 'bg-blue-100    text-blue-800',
  FAILED:    'bg-red-100     text-red-800',
  CANCELED:  'bg-gray-100    text-gray-600',
};

function StatusBadge({ status }: { status: string }) {
  const s = status.toUpperCase();
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_CLS[s] ?? 'bg-gray-100 text-gray-600'}`}>
      {s === 'RUNNING' && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse flex-shrink-0" />}
      {status}
    </span>
  );
}

// ─── 진행률 바 ────────────────────────────────────────────────────────────────

function ProgressBar({ progress, currentEpoch, totalEpochs }: {
  progress: number | null;
  currentEpoch?: number | null;
  totalEpochs?: number | null;
}) {
  let pct: number | null = null;
  if (currentEpoch != null && totalEpochs != null && totalEpochs > 0)
    pct = Math.min(100, Math.round((currentEpoch / totalEpochs) * 100));
  else if (progress != null && progress > 0)
    pct = progress;
  const isIndet = pct === null || pct === 0;
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden relative">
        {isIndet
          ? <div className="progress-indeterminate" />
          : <div className="absolute inset-y-0 left-0 bg-emerald-500 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />}
      </div>
      <span className="text-xs tabular-nums w-7 text-right flex-shrink-0 text-gray-500">
        {isIndet ? <span className="text-gray-400 tracking-widest">···</span> : `${pct}%`}
      </span>
    </div>
  );
}

// ─── 파일 업로드 슬롯 ─────────────────────────────────────────────────────────

function FileSlot({ label, desc, state, onChange }: {
  label: string; desc: string; state: FileState; onChange: (f: File | null) => void;
}) {
  const ref = useRef<HTMLInputElement | null>(null);
  return (
    <div
      onClick={() => ref.current?.click()}
      className={`relative flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-xl p-4 cursor-pointer transition-colors ${
        state.file ? 'border-blue-300 bg-blue-50' : 'border-gray-200 bg-gray-50 hover:border-blue-300 hover:bg-blue-50/60'
      }`}
    >
      <input ref={ref} type="file" accept=".asc,.txt,.csv,.dat" className="hidden"
        onChange={e => onChange(e.target.files?.[0] ?? null)} />
      {state.file ? (
        <>
          <svg className="w-5 h-5 text-blue-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-xs font-semibold text-blue-700 text-center w-full truncate px-1">{state.name}</p>
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
      </div>
    </div>
  );
}

function AscFolderSlot({ state, onChange }: {
  state: AscFolderState;
  onChange: (state: AscFolderState) => void;
}) {
  const ref = useRef<HTMLInputElement | null>(null);
  const mappedEntries = FILE_SLOTS.map(slot => ({ ...slot, file: state.mappedFiles[slot.key] }));
  const mappedCount = mappedEntries.filter(entry => entry.file.file).length;

  const bindDirectoryInput = (node: HTMLInputElement | null) => {
    ref.current = node;
    node?.setAttribute('webkitdirectory', '');
    node?.setAttribute('directory', '');
  };

  const handleDirectorySelect = (fileList: FileList | null) => {
    const files = Array.from(fileList ?? []);
    if (files.length === 0) return;
    const ascFiles = files.filter(isSupportedAscFile);
    const mappedFiles = mapAscFiles(files);
    const mappedCount = Object.values(mappedFiles).filter(file => file.file).length;
    const validationError =
      ascFiles.length === 0
        ? '지원되지 않는 입력 데이터 형식입니다. .asc 파일이 포함된 폴더를 선택해주세요.'
        : mappedCount < 4
          ? '입력 ASC 폴더에서 T-30/T-20/T-10/T 기준 4개 파일을 매핑할 수 없습니다.'
          : null;
    onChange({
      folderName: getFolderNameFromFiles(files),
      files,
      mappedFiles,
      validationError,
    });
  };

  return (
    <div
      onClick={() => ref.current?.click()}
      className={`relative border-2 border-dashed rounded-xl p-4 cursor-pointer transition-colors ${
        state.files.length > 0 ? 'border-blue-300 bg-blue-50' : 'border-gray-200 bg-gray-50 hover:border-blue-300 hover:bg-blue-50/60'
      }`}
    >
      <input
        ref={bindDirectoryInput}
        type="file"
        multiple
        className="hidden"
        onChange={e => {
          handleDirectorySelect(e.target.files);
          e.target.value = '';
        }}
      />
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
          state.files.length > 0 ? 'bg-blue-100 text-blue-600' : 'bg-white text-gray-300'
        }`}>
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-gray-700">입력 ASC 폴더</p>
          <p className={`text-xs mt-1 truncate ${state.files.length > 0 ? 'font-mono text-blue-700 font-semibold' : 'text-gray-400'}`}>
            {state.files.length > 0 ? `${state.folderName} · ${state.files.length}개 파일` : '클릭하여 폴더 선택'}
          </p>
        </div>
        {state.files.length > 0 && (
          <button
            type="button"
            onClick={e => { e.stopPropagation(); onChange(EMPTY_ASC_FOLDER); }}
            className="p-1.5 rounded-md text-blue-400 hover:text-blue-700 hover:bg-blue-100 flex-shrink-0"
            aria-label="선택 해제"
          >
            <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
              <path d="M2 2l12 12M14 2L2 14" />
            </svg>
          </button>
        )}
      </div>

      {state.files.length > 0 && (
        <div className="grid grid-cols-2 gap-2 mt-3">
          {mappedEntries.map(entry => (
            <div key={entry.key} className={`rounded-lg px-3 py-2 border ${
              entry.file.file ? 'bg-white border-blue-100' : 'bg-gray-50 border-gray-100'
            }`}>
              <p className="text-[11px] font-semibold text-gray-500">{entry.label}</p>
              <p className={`text-[11px] mt-0.5 truncate ${entry.file.file ? 'font-mono text-gray-800' : 'text-red-400'}`}>
                {entry.file.name ?? '매핑 파일 없음'}
              </p>
            </div>
          ))}
        </div>
      )}

      {state.files.length > 0 && mappedCount < 4 && (
        <p className="text-[11px] text-red-500 mt-2">실행에는 최소 4개의 ASC 파일이 필요합니다.</p>
      )}

      {state.validationError && (
        <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
          {state.validationError}
        </div>
      )}
    </div>
  );
}

// ─── 실행 추가 모달 (NewExperimentModal) ───────────────────────────────

function AddTcModal({
  onClose, onSubmit, models,
}: {
  onClose: () => void;
  onSubmit: (
    files: FormFiles,
    modelVersion: string,
    memo: string,
    observationDatasetDir: string | null,
    outputDir: string | null,
  ) => Promise<void>;
  models: ModelVersion[];
}) {
  const [selectedModelId,     setSelectedModelId]     = useState<number | null>(models[0]?.id ?? null);
  const [ascFolder,           setAscFolder]           = useState<AscFolderState>(EMPTY_ASC_FOLDER);
  const [memo,                setMemo]                = useState('');
  const [submitting,          setSubmitting]          = useState(false);
  const [error,               setError]               = useState<string | null>(null);
  const selectedModel = models.find(model => model.id === selectedModelId) ?? null;
  const selectedArch = selectedModel?.metrics?.architecture as string | undefined;

  useEffect(() => {
    if (selectedModelId == null && models[0]) setSelectedModelId(models[0].id);
  }, [selectedModelId, models]);

  const handleSubmit = async () => {
    if (!selectedModel) {
      setError('모델 버전을 선택해주세요.');
      return;
    }
    if (ascFolder.validationError || Object.values(ascFolder.mappedFiles).some(file => !file.file)) {
      setError(ascFolder.validationError ?? '입력 ASC 폴더에서 최소 4개의 파일을 선택해주세요.');
      return;
    }
    setSubmitting(true); setError(null);
    try {
      await onSubmit(
        ascFolder.mappedFiles,
        selectedModel.version,
        memo,
        DEFAULT_OBSERVATION_DATASET_DIR,
        null,
      );
      onClose();
    }
    catch (e: unknown) { setError(e instanceof Error ? e.message : '실험 시작에 실패했습니다.'); }
    finally { setSubmitting(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-2xl mx-4 bg-white rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-start justify-between px-6 py-5 border-b border-gray-100 flex-shrink-0">
          <div>
            <h2 className="text-lg font-bold text-gray-900">새 실행</h2>
            <p className="text-xs text-gray-400 mt-0.5">QPF 모델로 강우장을 예측합니다. 선행시간 10~180분 전체 자동 계산.</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 mt-0.5">
            <svg viewBox="0 0 16 16" className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
              <path d="M2 2l12 12M14 2L2 14" />
            </svg>
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">
          <div>
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 block">모델 버전</label>
            <select
              value={selectedModelId ?? ''}
              onChange={e => setSelectedModelId(e.target.value ? Number(e.target.value) : null)}
              disabled={models.length === 0}
              className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-400"
            >
              {models.length === 0 ? (
                <option value="">등록된 모델 버전 없음</option>
              ) : (
                models.map(model => (
                  <option key={model.id} value={model.id}>
                    {model.model_name} · {model.version}
                  </option>
                ))
              )}
            </select>
            {selectedModel && (
              <p className="text-[11px] text-gray-400 mt-1.5">
                선택 모델: {selectedModel.model_name} · {selectedModel.version}
                {selectedArch && <span> ({selectedArch})</span>}
              </p>
            )}
          </div>

          <div className="bg-blue-50 rounded-xl px-4 py-3 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-blue-800">예측 선행시간</p>
              <p className="text-xs text-blue-500 mt-0.5">10분 ~ 180분 (18개 선행시간 전체 자동 계산)</p>
            </div>
            <span className="text-xs font-mono text-blue-600 bg-blue-100 px-2 py-1 rounded-lg">고정</span>
          </div>

          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">입력 ASC 파일</p>
            <AscFolderSlot state={ascFolder} onChange={setAscFolder} />
            <p className="text-[11px] text-gray-400 mt-2">폴더 안 파일명 시각 기준으로 최근 4개 파일을 T-30/T-20/T-10/T에 자동 매핑합니다.</p>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-gray-600">메모</label>
            <textarea value={memo} onChange={e => setMemo(e.target.value)} rows={3}
              placeholder="메모 입력"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
          </div>
        </div>

        <div className="flex-shrink-0 border-t border-gray-100 px-6 py-4 flex items-center gap-3">
          <div className="flex-1 min-w-0">{error && <p className="text-xs text-red-500">{error}</p>}</div>
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors flex-shrink-0">취소</button>
          <button
            onClick={handleSubmit}
            disabled={submitting || !selectedModel || !!ascFolder.validationError || Object.values(ascFolder.mappedFiles).some(file => !file.file)}
            className="px-5 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2 flex-shrink-0">
            {submitting && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
            새 실행
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── 메인 페이지 ──────────────────────────────────────────────────────────────

export default function ExperimentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const expId  = Number(params.id);

  // 실험 환경 조회 (클라이언트 localStorage 기준)
  const [experiment, setExperiment] = useState<ClientExperiment | null | undefined>(undefined);
  // 실행 = 이 실험에만 매핑된 실 백엔드 job (localStorage 맵 기준)
  const [userTcIds,  setUserTcIds]  = useState<number[]>([]);
  const [realJobs,   setRealJobs]   = useState<TrainingJob[]>([]);
  const [resultMap,  setResultMap]  = useState<Record<number, TrainingResult>>({});
  const [loading,    setLoading]    = useState(true);
  const [showModal,  setShowModal]  = useState(false);
  const [models,              setModels]              = useState<ModelVersion[]>([]);
  const [selectedId,          setSelectedId]          = useState<number | null>(null);
  const [goldJobId,           setGoldJobId]           = useState<number | null>(null);
  const [logs,                setLogs]                = useState<string[]>([]);
  const [logsLoading,         setLogsLoading]         = useState(false);
  const logsEndRef = useRef<HTMLDivElement>(null);

  // 실험 환경 로드 (클라이언트 localStorage 기준)
  useEffect(() => {
    const found = loadClientExperiments().find(e => e.id === expId) ?? null;
    setExperiment(found);
    if (found) setUserTcIds(getUserTcJobIds(expId));
    try {
      const saved = localStorage.getItem(`${GOLD_MEDAL_KEY_PREFIX}${expId}`);
      setGoldJobId(saved ? Number(saved) : null);
    } catch { /* noop */ }
  }, [expId]);

  const toggleGoldJob = (jobId: number) => {
    setGoldJobId(prev => {
      const next = prev === jobId ? null : jobId;
      try {
        const key = `${GOLD_MEDAL_KEY_PREFIX}${expId}`;
        if (next == null) localStorage.removeItem(key);
        else localStorage.setItem(key, String(next));
      } catch { /* noop */ }
      return next;
    });
  };

  // 실행 Map 변경 반영 (실행 추가 후)
  const refreshTcIds = useCallback(() => {
    setUserTcIds(getUserTcJobIds(expId));
  }, [expId]);

  // 실 백엔드 작업 목록 로드
  const fetchJobs = useCallback(() => {
    getExperimentJobs()
      .then(data => setRealJobs(data))
      .catch(() => setRealJobs([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchJobs(); }, [fetchJobs]);

  // 실행 = 이 실험에만 매핑된 실 백엔드 job
  const tcJobs = realJobs.filter(j => userTcIds.includes(j.job_id));

  // 완료된 실행의 성능 지표 조회 (백엔드가 metrics를 채우면 자동 표시 — 현재는 빈 값)
  useEffect(() => {
    const completed = tcJobs.filter(j => j.status.toUpperCase() === 'COMPLETED' && !(j.job_id in resultMap));
    if (completed.length === 0) return;
    completed.forEach(j => {
      getTrainingResult(j.job_id)
        .then(r => setResultMap(prev => ({ ...prev, [j.job_id]: r })))
        .catch(() => {});
    });
  }, [tcJobs, resultMap]);

  // 활성 작업 폴링 (사용자 추가 실행이 실행 중일 때만)
  useEffect(() => {
    const hasActive = realJobs
      .filter(j => userTcIds.includes(j.job_id))
      .some(j => ['RUNNING', 'QUEUED'].includes(j.status.toUpperCase()));
    if (!hasActive) return;
    const id = setInterval(() => getExperimentJobs().then(setRealJobs).catch(() => {}), POLL_MS);
    return () => clearInterval(id);
  }, [realJobs, userTcIds]);

  // 모델 목록 로드
  useEffect(() => {
    getModels()
      .then(data => setModels(mergeRegisteredModels(data.length ? data : FALLBACK_MODELS)))
      .catch(() => setModels(mergeRegisteredModels(FALLBACK_MODELS)));
  }, []);

  // 실행 중 로그
  const selectedJob       = tcJobs.find(j => j.job_id === selectedId) ?? null;
  const isSelectedRunning = selectedJob?.status.toUpperCase() === 'RUNNING';

  useEffect(() => {
    if (selectedId == null || !isSelectedRunning) { setLogs([]); return; }
    setLogsLoading(true);
    getTrainingLogs(selectedId)
      .then(r => setLogs(r.logs)).catch(() => setLogs([]))
      .finally(() => {
        setLogsLoading(false);
        setTimeout(() => logsEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
      });
  }, [selectedId, isSelectedRunning]);

  useEffect(() => {
    if (selectedId == null || !isSelectedRunning) return;
    const id = setInterval(() => {
      getTrainingLogs(selectedId).then(r => {
        setLogs(r.logs);
        setTimeout(() => logsEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
      }).catch(() => {});
    }, POLL_MS);
    return () => clearInterval(id);
  }, [selectedId, isSelectedRunning]);

  // 실행 제출
  const handleSubmitTc = async (
    files: FormFiles,
    modelVersion: string,
    memo: string,
    observationDatasetDir: string | null,
    outputDir: string | null,
  ) => {
    const runDt = getCompactDtFromFilename(files.t3.name) ?? getNowDt();
    const requester = getUsername() ?? 'admin';
    const selectedModel = models.find(model => model.version === modelVersion);
    const architecture = selectedModel?.metrics?.architecture === 'multi'
      ? 'multi'
      : selectedModel?.metrics?.architecture === 'single'
        ? 'single'
        : null;
    const backendModelVersion = toBackendModelVersion(modelVersion);
    const modelMode = backendModelVersion === 'ver1' || backendModelVersion === 'ver1_tflite'
      ? 'single'
      : architecture ?? 'multi';
    const makeFile = async (fs: FileState, offset: number): Promise<AscFileInput> =>
      fs.file
        ? { filename: fs.name, timestamp: calculateTimestamp(runDt, offset), file_data: await fileToBase64(fs.file) }
        : { filename: null, timestamp: null, file_data: null };

    const result = await createExperimentJob({
      user_name:               requester,
      run_datetime:           toApiRunDatetime(runDt),
      model_version:          backendModelVersion,
      mode:                   modelMode,
      forecast_steps:         ALL_STEPS,
      include_preview_image:  true,
      experiment_name:        formatExecutionName(null, runDt),
      experiment_tags:        null,
      experiment_memo:        memo || null,
      observation_dataset_id: null,
      observation_dataset_dir: observationDatasetDir,
      output_dir:             outputDir,
      input_files: {
        file_t0: await makeFile(files.t0, -30),
        file_t1: await makeFile(files.t1, -20),
        file_t2: await makeFile(files.t2, -10),
        file_t3: await makeFile(files.t3,   0),
      },
    });

    // 실행 맵 갱신 (백엔드 experiment_id 연동 전 클라이언트 측 보관)
    // 메모도 클라이언트에 보관 — 백엔드가 experiment_memo를 응답하지 않음 (request.md 항목 9B)
    if (result?.job_id) {
      addTcToExpMap(expId, result.job_id);
      if (memo) saveTcMemo(result.job_id, memo);
      saveTcModelMeta(result.job_id, { modelVersion, architecture: modelMode, requester });
      refreshTcIds();
    }
    fetchJobs();
  };

  // ─── 렌더 ─────────────────────────────────────────────────────────────────

  if (experiment === undefined) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </Layout>
    );
  }

  if (experiment === null) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-gray-400">
          <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm">실험을 찾을 수 없습니다.</p>
          <button onClick={() => router.push('/experiments')}
            className="text-sm text-blue-500 hover:underline">실험 목록으로 돌아가기</button>
        </div>
      </Layout>
    );
  }

  const totalTc = tcJobs.length;
  const selectableModels = models.filter(model => !['QUEUED', 'RUNNING'].includes((model.status ?? '').toUpperCase()));

  // 완료 실행별 요약 지표
  const tcSummary: Record<number, { mae: number | null; rmse: number | null; csi: number | null; isSample: boolean }> = {};
  for (const job of tcJobs) {
    if (job.status.toUpperCase() !== 'COMPLETED') continue;
    const ver = resultMap[job.job_id]?.params.model_version ?? job.experiment_name.match(/v\d/i)?.[0] ?? null;
    const pm = metricsOrSample(resultMap[job.job_id]?.metrics, job.job_id, ver);
    tcSummary[job.job_id] = { ...pm.summary, isSample: pm.isSample };
  }

  const titleActions = (
    <button
      onClick={() => setShowModal(true)}
      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition shadow-sm flex-shrink-0"
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
      </svg>
      새 실행
    </button>
  );

  const titlePrefix = (
    <span className="inline-flex items-center gap-2 text-sm text-gray-500">
      <button
        type="button"
        onClick={() => router.push('/experiments')}
        className="font-semibold text-gray-600 hover:text-blue-600 transition-colors"
      >
        실험
      </button>
      <span className="text-gray-300">&gt;</span>
      <Link
        href={`/experiments/${experiment.id}`}
        className="max-w-[48rem] truncate font-medium text-gray-700 hover:text-blue-600 transition-colors"
      >
        {experiment.name}
      </Link>
      <span className="text-gray-300">&gt;</span>
    </span>
  );

  return (
    <Layout title="실행" titleActions={titleActions} titlePrefix={titlePrefix}>
      {showModal && (
        <AddTcModal
          onClose={() => setShowModal(false)}
          onSubmit={handleSubmitTc}
          models={selectableModels}
        />
      )}

      {experiment.description && (
        <p className="mb-4 text-sm text-gray-500">{experiment.description}</p>
      )}

      {/* 실행 테이블 */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-gray-700">실행 목록</span>
          </div>
          {loading && <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />}
        </div>

        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              {['실행 이름', '상태', '등록일', '소요시간', '모델', 'MAE', 'RMSE', 'CSI'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tcJobs.flatMap(job => {
              const s          = job.status.toUpperCase();
              const isSelected = job.job_id === selectedId;
              const toggle     = () => setSelectedId(prev => prev === job.job_id ? null : job.job_id);
              const result     = resultMap[job.job_id];
              const storedMeta = loadTcModelMeta(job.job_id);
              const modelVer   = result?.params.model_version ?? storedMeta?.modelVersion ?? job.experiment_name.match(/v\d/i)?.[0] ?? '-';
              const executionName = formatExecutionName(job.experiment_name, result?.params.run_datetime);
              const registryModel = models.find(model => model.version === modelVer);
              const registryArch = registryModel?.metrics?.architecture;
              const displayMode = storedMeta?.architecture
                ?? (registryArch === 'multi' || registryArch === 'single' ? registryArch : null)
                ?? job.mode;
              const displayRequester = displayUsername(
                storedMeta?.requester
                  ?? (job.user_name && job.user_name !== 'anonymous' ? job.user_name : getUsername() ?? null),
              );
              const sum        = tcSummary[job.job_id];
              const fmtCell = (v: number | null | undefined) =>
                v == null
                  ? <span className="text-gray-300">-</span>
                  : <span className="text-gray-700">{v.toFixed(3)}</span>;

              const mainRow = (
                <tr
                  key={job.job_id}
                  onClick={toggle}
                  className={`cursor-pointer border-b border-gray-100 transition-colors ${isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <button
                        type="button"
                        onClick={e => {
                          e.stopPropagation();
                          toggleGoldJob(job.job_id);
                        }}
                        aria-pressed={goldJobId === job.job_id}
                        aria-label="대표 실행 표시"
                        title="대표 실행 표시"
                        className={`relative flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border transition-colors ${
                          goldJobId === job.job_id
                            ? 'border-amber-300 bg-amber-50'
                            : 'border-gray-200 bg-white hover:border-amber-300 hover:bg-amber-50'
                        }`}
                      >
                        {goldJobId === job.job_id ? (
                          <span className="text-sm leading-none" aria-hidden="true">🥇</span>
                        ) : (
                          <span className="h-2.5 w-2.5 rounded-full border border-gray-300" aria-hidden="true" />
                        )}
                      </button>
                      <span className="font-semibold text-gray-800 text-sm leading-tight">{executionName}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={job.status} /></td>
                  <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">{job.created_at?.slice(0,10) ?? '-'}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">{fmtDur(job.started_at, job.finished_at)}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-semibold ${/v3/i.test(modelVer) ? 'text-emerald-600' : 'text-amber-600'}`}>
                      {modelVer}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs tabular-nums">
                    {fmtCell(sum?.mae)}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs tabular-nums">
                    {fmtCell(sum?.rmse)}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs tabular-nums">
                    {fmtCell(sum?.csi)}
                  </td>
                </tr>
              );

              if (!isSelected) return [mainRow];

              const detailRow = (
                <tr key={`${job.job_id}-detail`}>
                  <td colSpan={8} className="bg-blue-50/40 border-b border-gray-100 px-6 py-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-3 mb-3">
                      {[
                        { label: '등록일',    value: fmtDt(job.created_at) },
                        { label: '시작일',    value: fmtDt(job.started_at) },
                        { label: '완료일',    value: fmtDt(job.finished_at) },
                        { label: '소요 시간', value: fmtDur(job.started_at, job.finished_at) },
                        { label: '요청자',    value: displayRequester },
                        { label: '모드',      value: displayMode },
                      ].map(row => (
                        <div key={row.label}>
                          <p className="text-[11px] text-gray-400 uppercase font-semibold tracking-wide mb-0.5">{row.label}</p>
                          <p className="text-sm text-gray-800">{row.value}</p>
                        </div>
                      ))}
                      {s === 'RUNNING' && (
                        <div className="col-span-2">
                          <p className="text-[11px] text-gray-400 uppercase font-semibold tracking-wide mb-1.5">진행률</p>
                          <ProgressBar progress={job.progress} currentEpoch={job.current_epoch} totalEpochs={job.total_epochs} />
                        </div>
                      )}
                    </div>

                    {(s === 'COMPLETED' || s === 'FAILED' || s === 'CANCELED') && (
                      <Link
                        href={`/experiment-results/${job.job_id}`}
                        className={`inline-flex items-center gap-2 px-4 py-2 text-white text-sm font-semibold rounded-lg transition shadow-sm ${
                          s === 'COMPLETED' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-600 hover:bg-gray-700'
                        }`}
                      >
                        {s === 'COMPLETED' ? '결과 상세 보기' : '로그 확인'}
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                      </Link>
                    )}

                    {s === 'RUNNING' && (
                      <div className="mt-3 bg-gray-900 rounded-xl border border-gray-700 overflow-hidden">
                        <div className="px-5 py-3 border-b border-gray-700 flex items-center gap-3">
                          <span className="text-sm font-semibold text-gray-200 flex-1">
                            로그
                            <span className="ml-2 inline-flex items-center gap-1 text-xs text-emerald-400 font-normal">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                              실시간
                            </span>
                          </span>
                          {logsLoading && <div className="w-3.5 h-3.5 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin flex-shrink-0" />}
                        </div>
                        <div className="p-4 max-h-48 overflow-y-auto font-mono text-xs text-gray-300 leading-5 space-y-px">
                          {logs.length === 0
                            ? <span className="text-gray-500">로그를 불러오는 중이거나 아직 기록된 로그가 없습니다.</span>
                            : logs.map((line, i) => <div key={i}>{line}</div>)}
                          <div ref={logsEndRef} />
                        </div>
                      </div>
                    )}
                  </td>
                </tr>
              );

              return [mainRow, detailRow];
            })}
          </tbody>
        </table>

        {tcJobs.length === 0 && !loading && (
          <div className="py-16 text-center text-gray-400 text-sm">
            {totalTc === 0 ? '실험 이력이 없습니다. 새 실행 버튼으로 검증을 시작하세요.' : '로드 중...'}
          </div>
        )}

        <div className="px-5 py-2.5 border-t border-gray-100 text-xs text-gray-400">
          총 {totalTc}개 실행
        </div>
      </div>
    </Layout>
  );
}
