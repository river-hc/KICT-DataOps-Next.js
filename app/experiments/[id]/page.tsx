'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Layout from '@/lib/Layout';
import {
  getExperiment, getTrainingJobsByExperiment, getModels, getTrainingResult, deleteTraining,
  createExperimentJob, getDataCollectionInfo, getAnswerDatasets, createAnswerDataset,
  displayUsername, formatExecutionName, setGoldJob, clearGoldJob,
  type TrainingJob, type AscFileInput, type ModelVersion, type DataCollectionDatasetGroup,
  type TrainingResult, type Experiment, type AnswerDataset,
} from '@/lib/api';
import {
  saveTcMemo,
  loadTcModelMeta, saveTcModelMeta,
} from '@/lib/experimentStore';
import { getCurrentUsername } from '@/lib/account';
import { mergeRegisteredModels } from '@/lib/modelStore';
import { parseMetrics } from '@/lib/metrics';
import { SkeletonTableRows } from '@/lib/Skeleton';

// ─── 상수 ────────────────────────────────────────────────────────────────────

const POLL_MS   = 3000;
const ALL_STEPS = [10,20,30,40,50,60,70,80,90,100,110,120,130,140,150,160,170,180];
const DEFAULT_OBSERVATION_DATASET_DIR = '/data/observations/default';
const PAGE_SIZE = 10;
type PageItem = number | 'ellipsis-start' | 'ellipsis-end';

function pageItems(totalPages: number, currentPage: number): PageItem[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  const items: PageItem[] = [1];
  const start = Math.max(2, currentPage - 1);
  const end = Math.min(totalPages - 1, currentPage + 1);
  if (start > 2) items.push('ellipsis-start');
  for (let i = start; i <= end; i += 1) items.push(i);
  if (end < totalPages - 1) items.push('ellipsis-end');
  items.push(totalPages);
  return items;
}

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
type InputSourceMode = 'LOAD' | 'UPLOAD';
type AnswerSourceMode = 'SELECT' | 'UPLOAD';

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

function fmtSeconds(value?: number | null): string {
  if (value == null) return '-';
  const seconds = Math.max(0, Math.round(value));
  if (seconds < 60) return `${seconds}초`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}분 ${seconds % 60}초`;
  return `${Math.floor(seconds / 3600)}시간 ${Math.floor((seconds % 3600) / 60)}분`;
}

function fmtEta(job: TrainingJob): string {
  const status = job.status.toUpperCase();
  if (status === 'RUNNING') {
    return job.remaining_seconds != null ? `남은 약 ${fmtSeconds(job.remaining_seconds)}` : '계산 중';
  }
  if (status === 'QUEUED') {
    const prefix = job.queue_position ? `${job.queue_position}번째 대기` : '대기 중';
    return job.remaining_seconds != null ? `${prefix} · 약 ${fmtSeconds(job.remaining_seconds)}` : prefix;
  }
  return fmtDur(job.started_at, job.finished_at);
}

function calcJobProgressPct(job: TrainingJob): number {
  if (job.current_epoch != null && job.total_epochs != null && job.total_epochs > 0) {
    return Math.min(100, Math.max(0, Math.round((job.current_epoch / job.total_epochs) * 100)));
  }
  if (job.progress != null && job.progress > 0) {
    return Math.min(100, Math.max(0, Math.round(job.progress)));
  }
  if (job.status.toUpperCase() === 'RUNNING' && job.elapsed_seconds != null && job.estimated_total_seconds != null && job.estimated_total_seconds > 0) {
    return Math.min(95, Math.max(1, Math.round((job.elapsed_seconds / job.estimated_total_seconds) * 100)));
  }
  if (job.status.toUpperCase() === 'COMPLETED') return 100;
  return 0;
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

function ProgressBar({ job }: { job: TrainingJob }) {
  const pct = calcJobProgressPct(job);
  return (
    <div className="flex items-center gap-3">
      <span className="w-10 flex-shrink-0 text-right font-mono text-xs font-semibold tabular-nums text-gray-700">{pct}%</span>
      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-gray-200">
        <div
          className="h-full rounded-full bg-blue-600 transition-[width] duration-700"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ─── 테스트케이스 비교 모달 ──────────────────────────────────────────────────────────

interface CompareRow { label: string; values: (job: TrainingJob, result?: TrainingResult) => string }

function CompareModal({ jobs, resultMap, onClose }: {
  jobs: TrainingJob[];
  resultMap: Record<number, TrainingResult>;
  onClose: () => void;
}) {
  const rows: CompareRow[] = [
    { label: '테스트케이스 이름',   values: job => formatExecutionName(job.experiment_name, resultMap[job.job_id]?.params.run_datetime) },
    { label: '상태',        values: job => job.status },
    { label: '모델 버전',   values: job => resultMap[job.job_id]?.params.model_version ?? '-' },
    { label: '등록일',      values: job => fmtDt(job.created_at) },
    { label: '소요시간',    values: job => fmtDur(job.started_at, job.finished_at) },
    { label: '예상시간',    values: job => fmtEta(job) },
    { label: 'MAE',         values: (_job, r) => r?.metrics.mae != null ? Number(r.metrics.mae).toFixed(3) : '-' },
    { label: 'RMSE',        values: (_job, r) => r?.metrics.rmse != null ? Number(r.metrics.rmse).toFixed(3) : '-' },
    { label: 'CSI',         values: (_job, r) => r?.metrics.csi != null ? Number(r.metrics.csi).toFixed(3) : '-' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-4xl mx-4 max-h-[85vh] overflow-auto bg-white rounded-2xl shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white">
          <h2 className="text-lg font-bold text-gray-900">테스트케이스 비교 ({jobs.length}개)</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100">
            <svg viewBox="0 0 16 16" className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
              <path d="M2 2l12 12M14 2L2 14" />
            </svg>
          </button>
        </div>
        <div className="p-6 overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr>
                <th className="text-left px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wide">항목</th>
                {jobs.map(job => (
                  <th key={job.job_id} className="text-left px-3 py-2 text-xs font-semibold text-gray-700 whitespace-nowrap">
                    Job #{job.job_id}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr key={row.label} className="border-t border-gray-100">
                  <td className="px-3 py-2.5 text-xs font-semibold text-gray-500 whitespace-nowrap">{row.label}</td>
                  {jobs.map(job => (
                    <td key={job.job_id} className="px-3 py-2.5 font-mono text-xs text-gray-800 whitespace-nowrap">
                      {row.values(job, resultMap[job.job_id])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
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
        ref={ref}
        type="file"
        accept=".asc"
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
          <p className="text-xs font-bold text-gray-700">입력 ASC 파일</p>
          <p className={`text-xs mt-1 truncate ${state.files.length > 0 ? 'font-mono text-blue-700 font-semibold' : 'text-gray-400'}`}>
            {state.files.length > 0 ? `${state.folderName} · ${state.files.length}개 파일` : '클릭하여 파일 선택 (4개, Ctrl/Cmd+클릭으로 다중선택)'}
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
        <div className="mt-3 rounded-lg border border-gray-200 bg-white px-3 py-2" onClick={e => e.stopPropagation()}>
          <p className="text-[11px] font-semibold text-gray-500 mb-1.5">폴더에서 찾은 파일 {state.files.length}개</p>
          <div className="max-h-28 overflow-y-auto space-y-0.5">
            {state.files.map((f, i) => (
              <p key={`${f.name}-${i}`} className="text-[11px] font-mono text-gray-600 truncate">{f.name}</p>
            ))}
          </div>
        </div>
      )}

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
        <p className="text-[11px] text-red-500 mt-2">테스트케이스에는 최소 4개의 ASC 파일이 필요합니다.</p>
      )}

      {state.validationError && (
        <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
          {state.validationError}
        </div>
      )}
    </div>
  );
}

// ─── 테스트케이스 추가 모달 (NewExperimentModal) ───────────────────────────────

function AddTcModal({
  onClose, onSubmit, models,
}: {
  onClose: () => void;
  onSubmit: (
    files: FormFiles | null,
    modelVersion: string,
    memo: string,
    observationDatasetDir: string | null,
    outputDir: string | null,
    inputDatasetDir: string | null,
    inputDatasetFiles: string[],
    answerDatasetId: number | null,
  ) => Promise<void>;
  models: ModelVersion[];
}) {
  const [selectedModelId,     setSelectedModelId]     = useState<number | null>(models[0]?.id ?? null);
  const [inputMode,           setInputMode]           = useState<InputSourceMode>('LOAD');
  const [datasetGroups,       setDatasetGroups]       = useState<DataCollectionDatasetGroup[]>([]);
  const [selectedGroupId,     setSelectedGroupId]     = useState<string>('');
  const [loadingGroups,       setLoadingGroups]       = useState(false);
  const [ascFolder,           setAscFolder]           = useState<AscFolderState>(EMPTY_ASC_FOLDER);
  const [answerDatasets,      setAnswerDatasets]      = useState<AnswerDataset[]>([]);
  const [answerDatasetId,     setAnswerDatasetId]     = useState<number | null>(null);
  const [loadingAnswerSets,   setLoadingAnswerSets]   = useState(false);
  const [answerMode,          setAnswerMode]          = useState<AnswerSourceMode>('SELECT');
  const [answerUploadName,    setAnswerUploadName]    = useState('');
  const [answerUploadFiles,   setAnswerUploadFiles]   = useState<File[]>([]);
  const [answerUploading,     setAnswerUploading]     = useState(false);
  const [answerUploadError,   setAnswerUploadError]   = useState<string | null>(null);
  const answerFileInputRef = useRef<HTMLInputElement | null>(null);
  const [memo,                setMemo]                = useState('');
  const [submitting,          setSubmitting]          = useState(false);
  const [error,               setError]               = useState<string | null>(null);
  const selectedModel = models.find(model => model.id === selectedModelId) ?? null;
  const selectedArch = selectedModel?.metrics?.architecture as string | undefined;

  useEffect(() => {
    if (selectedModelId == null && models[0]) setSelectedModelId(models[0].id);
  }, [selectedModelId, models]);

  useEffect(() => {
    setLoadingGroups(true);
    getDataCollectionInfo()
      .then(info => {
        const groups = (info.training_dataset_groups ?? []).filter(group => group.file_count === 4);
        setDatasetGroups(groups);
        setSelectedGroupId(prev => prev || groups[0]?.id || '');
      })
      .catch(() => setDatasetGroups([]))
      .finally(() => setLoadingGroups(false));
  }, []);

  const refreshAnswerDatasets = useCallback((selectId?: number) => {
    setLoadingAnswerSets(true);
    return getAnswerDatasets()
      .then(sets => {
        setAnswerDatasets(sets);
        setAnswerDatasetId(prev => selectId ?? prev ?? sets[0]?.id ?? null);
        return sets;
      })
      .catch(() => { setAnswerDatasets([]); return []; })
      .finally(() => setLoadingAnswerSets(false));
  }, []);

  useEffect(() => { refreshAnswerDatasets(); }, [refreshAnswerDatasets]);

  const selectedGroup = datasetGroups.find(group => group.id === selectedGroupId) ?? null;
  const selectedAnswerDataset = answerDatasets.find(dataset => dataset.id === answerDatasetId) ?? null;

  const handleAnswerFiles = (fileList: FileList | null) => {
    if (!fileList) return;
    setAnswerUploadFiles(Array.from(fileList).filter(file => file.name.toLowerCase().endsWith('.asc')));
  };

  const handleAnswerUpload = async () => {
    if (!answerUploadName.trim()) { setAnswerUploadError('이름을 입력해주세요.'); return; }
    if (answerUploadFiles.length === 0) { setAnswerUploadError('ASC 파일을 최소 1개 이상 선택해주세요.'); return; }
    setAnswerUploading(true); setAnswerUploadError(null);
    try {
      const created = await createAnswerDataset({ name: answerUploadName.trim(), files: answerUploadFiles });
      await refreshAnswerDatasets(created.id);
      setAnswerMode('SELECT');
      setAnswerUploadName('');
      setAnswerUploadFiles([]);
    } catch (e: unknown) {
      setAnswerUploadError(e instanceof Error ? e.message : '업로드에 실패했습니다.');
    } finally {
      setAnswerUploading(false);
    }
  };

  const handleSubmit = async () => {
    if (!selectedModel) {
      setError('모델 버전을 선택해주세요.');
      return;
    }
    if (inputMode === 'LOAD' && !selectedGroup) {
      setError('불러올 ASC 입력 묶음을 선택해주세요.');
      return;
    }
    if (inputMode === 'UPLOAD' && (ascFolder.validationError || Object.values(ascFolder.mappedFiles).some(file => !file.file))) {
      setError(ascFolder.validationError ?? '입력 ASC 폴더에서 최소 4개의 파일을 선택해주세요.');
      return;
    }
    setSubmitting(true); setError(null);
    try {
      await onSubmit(
        inputMode === 'UPLOAD' ? ascFolder.mappedFiles : null,
        selectedModel.version,
        memo,
        DEFAULT_OBSERVATION_DATASET_DIR,
        null,
        inputMode === 'LOAD' ? selectedGroup?.path ?? null : null,
        inputMode === 'LOAD' ? selectedGroup?.files ?? [] : [],
        answerDatasetId,
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
            <h2 className="text-lg font-bold text-gray-900">새 테스트케이스</h2>
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
            <div className="mb-3 inline-flex rounded-lg border border-gray-200 bg-gray-50 p-1">
              {[
                { key: 'LOAD' as InputSourceMode, label: '수집 묶음 불러오기' },
                { key: 'UPLOAD' as InputSourceMode, label: '직접 업로드' },
              ].map(item => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => { setInputMode(item.key); setError(null); }}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                    inputMode === item.key ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-800'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {inputMode === 'LOAD' ? (
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold text-gray-700">데이터 수집 묶음</p>
                    <p className="mt-1 text-[11px] text-gray-400">데이터 수집 탭에서 생성한 ASC 4개 묶음을 바로 사용합니다.</p>
                  </div>
                  {loadingGroups && <div className="h-4 w-4 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />}
                </div>
                <select
                  value={selectedGroupId}
                  onChange={event => setSelectedGroupId(event.target.value)}
                  disabled={loadingGroups || datasetGroups.length === 0}
                  className="mt-3 w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm font-medium text-gray-700 outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-400"
                >
                  {datasetGroups.length === 0 ? (
                    <option value="">불러올 ASC 묶음 없음</option>
                  ) : (
                    datasetGroups.map(group => (
                      <option key={group.id} value={group.id}>{group.name} · {group.file_count}개</option>
                    ))
                  )}
                </select>
                {selectedGroup && (
                  <div className="mt-3 rounded-lg border border-gray-200 bg-white px-3 py-2">
                    <p className="break-all font-mono text-[11px] text-gray-500">{selectedGroup.path}</p>
                    <div className="mt-2 max-h-28 overflow-y-auto space-y-0.5">
                      {selectedGroup.files.map(file => (
                        <p key={file} className="truncate font-mono text-[11px] text-gray-700">{file}</p>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <>
                <AscFolderSlot state={ascFolder} onChange={setAscFolder} />
                <p className="text-[11px] text-gray-400 mt-2">파일명 시각 기준으로 최근 4개 파일을 자동 매핑합니다.</p>
              </>
            )}
          </div>

          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">정답 데이터셋</p>
            <div className="mb-3 inline-flex rounded-lg border border-gray-200 bg-gray-50 p-1">
              {[
                { key: 'SELECT' as AnswerSourceMode, label: '기존 데이터셋 선택' },
                { key: 'UPLOAD' as AnswerSourceMode, label: '직접 업로드' },
              ].map(item => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => { setAnswerMode(item.key); setAnswerUploadError(null); }}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                    answerMode === item.key ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-800'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {answerMode === 'SELECT' ? (
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold text-gray-700">등록된 정답 데이터셋</p>
                    <p className="mt-1 text-[11px] text-gray-400">선택한 정답 데이터셋과 비교해 MAE/RMSE/CSI를 계산합니다.</p>
                  </div>
                  {loadingAnswerSets && <div className="h-4 w-4 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />}
                </div>
                <select
                  value={answerDatasetId ?? ''}
                  onChange={e => setAnswerDatasetId(e.target.value ? Number(e.target.value) : null)}
                  disabled={loadingAnswerSets || answerDatasets.length === 0}
                  className="mt-3 w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm font-medium text-gray-700 outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-400"
                >
                  {answerDatasets.length === 0 ? (
                    <option value="">등록된 정답 데이터셋 없음</option>
                  ) : (
                    answerDatasets.map(dataset => (
                      <option key={dataset.id} value={dataset.id}>{dataset.name} · {dataset.file_count}개</option>
                    ))
                  )}
                </select>
                {selectedAnswerDataset && (
                  <div className="mt-3 rounded-lg border border-gray-200 bg-white px-3 py-2">
                    <p className="break-all font-mono text-[11px] text-gray-500">{selectedAnswerDataset.path}</p>
                    <p className="mt-1 text-[11px] text-gray-400">{selectedAnswerDataset.file_count}개 파일</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-3">
                <input
                  type="text"
                  value={answerUploadName}
                  onChange={e => setAnswerUploadName(e.target.value)}
                  placeholder="데이터셋 이름"
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100"
                />
                <div
                  onDragOver={e => e.preventDefault()}
                  onDrop={e => { e.preventDefault(); handleAnswerFiles(e.dataTransfer.files); }}
                  onClick={() => answerFileInputRef.current?.click()}
                  className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-white px-6 py-5 text-center transition hover:border-blue-400 hover:bg-blue-50"
                >
                  <p className="text-sm text-gray-600">클릭하거나 파일을 끌어다 놓으세요</p>
                  <p className="mt-1 text-xs text-gray-400">.asc 파일만 인식됩니다</p>
                  <input
                    ref={answerFileInputRef}
                    type="file"
                    multiple
                    accept=".asc"
                    onChange={e => handleAnswerFiles(e.target.files)}
                    className="hidden"
                  />
                </div>
                {answerUploadFiles.length > 0 && (
                  <p className="text-xs text-gray-500">{answerUploadFiles.length}개 파일 선택됨</p>
                )}
                {answerUploadError && (
                  <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{answerUploadError}</p>
                )}
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleAnswerUpload}
                    disabled={answerUploading}
                    className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-40"
                  >
                    {answerUploading && <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                    {answerUploading ? '업로드 중...' : '업로드'}
                  </button>
                </div>
              </div>
            )}
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
            disabled={
              submitting || !selectedModel ||
              (inputMode === 'LOAD' && !selectedGroup) ||
              (inputMode === 'UPLOAD' && (!!ascFolder.validationError || Object.values(ascFolder.mappedFiles).some(file => !file.file)))
            }
            className="px-5 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2 flex-shrink-0">
            {submitting && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
            새 테스트케이스
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

  // 실험 환경 조회 (서버 기준)
  const [experiment, setExperiment] = useState<Experiment | null | undefined>(undefined);
  // 테스트케이스 = 이 실험에 서버가 직접 연결해둔 job (experiment_id 기준)
  const [realJobs,   setRealJobs]   = useState<TrainingJob[]>([]);
  const [resultMap,  setResultMap]  = useState<Record<number, TrainingResult>>({});
  const [loading,    setLoading]    = useState(true);
  const [showModal,  setShowModal]  = useState(false);
  const [models,              setModels]              = useState<ModelVersion[]>([]);
  const [selectedId,          setSelectedId]          = useState<number | null>(null);
  const prevJobStatusRef = useRef<Record<number, string>>({});
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'COMPLETED' | 'FAILED' | 'RUNNING' | 'QUEUED'>('ALL');
  const [sortBy,        setSortBy]      = useState<'latest' | 'mae' | 'rmse' | 'csi'>('latest');
  const [page,          setPage]        = useState(1);
  const [compareIds,    setCompareIds]  = useState<Set<number>>(new Set());
  const [showCompare,   setShowCompare] = useState(false);
  const [deletingId,    setDeletingId]  = useState<number | null>(null);

  // 실험 환경 로드 (서버 기준)
  useEffect(() => {
    getExperiment(expId)
      .then(setExperiment)
      .catch(() => setExperiment(null));
  }, [expId]);

  // 실 백엔드 작업 목록 로드 (experiment_id로 서버가 이미 필터링 — 상태 무관)
  const fetchJobs = useCallback(() => {
    getTrainingJobsByExperiment(expId)
      .then(data => setRealJobs(data))
      .catch(() => setRealJobs([]))
      .finally(() => setLoading(false));
  }, [expId]);

  useEffect(() => { fetchJobs(); }, [fetchJobs]);

  const tcJobs = realJobs;

  // 완료 테스트케이스별 요약 지표 (실데이터 없으면 null — "-"로 표시됨)
  const tcSummary: Record<number, { mae: number | null; rmse: number | null; csi: number | null }> = {};
  for (const job of tcJobs) {
    if (job.status.toUpperCase() !== 'COMPLETED') continue;
    tcSummary[job.job_id] = parseMetrics(resultMap[job.job_id]?.metrics).summary;
  }

  // 대표 테스트케이스 = 완료된 것 중 CSI가 가장 높은 job (자동 산정)
  // 단, 사용자가 수동 지정(experiment.gold_job_id)했으면 그게 최우선 — CSI 더 높은 게 나와도 안 뺏김
  let autoGoldJobId: number | null = null;
  let bestCsi = -Infinity;
  for (const job of tcJobs) {
    const csi = tcSummary[job.job_id]?.csi;
    if (csi == null) continue;
    if (csi > bestCsi) { bestCsi = csi; autoGoldJobId = job.job_id; }
  }
  const goldJobId = experiment?.gold_job_id ?? autoGoldJobId;
  const isManualGold = experiment?.gold_job_id != null;

  const handleToggleGold = async (jobId: number) => {
    if (!experiment) return;
    try {
      if (isManualGold && goldJobId === jobId) {
        const updated = await clearGoldJob(experiment.id);
        setExperiment(updated);
      } else {
        const updated = await setGoldJob(experiment.id, jobId);
        setExperiment(updated);
      }
    } catch { /* noop */ }
  };

  // 상태 필터 + 정렬 (MAE/RMSE는 낮을수록, CSI는 높을수록 좋은 테스트케이스)
  const visibleJobs = tcJobs
    .filter(job => statusFilter === 'ALL' || job.status.toUpperCase() === statusFilter)
    .slice()
    .sort((a, b) => {
      if (sortBy === 'latest') return (b.created_at ?? '').localeCompare(a.created_at ?? '');
      const av = tcSummary[a.job_id]?.[sortBy];
      const bv = tcSummary[b.job_id]?.[sortBy];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      return sortBy === 'csi' ? bv - av : av - bv;
    });

  const totalPages = Math.max(1, Math.ceil(visibleJobs.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedJobs = visibleJobs.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const pagination = pageItems(totalPages, safePage);

  useEffect(() => { setPage(1); }, [statusFilter, sortBy]);
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);

  // 테스트케이스 결과(성능 지표 + run_datetime) 조회.
  // COMPLETED가 아니어도 params.run_datetime은 항상 있어서, 실행명 표시(formatExecutionName)에
  // 필요하므로 상태 무관하게 조회한다 — 안 그러면 FAILED/QUEUED 건은 run_datetime을 못 받아서
  // 실험명 문자열을 다시 파싱하다가 시각이 00시 00분으로 깨져 보인다.
  useEffect(() => {
    const pending = tcJobs.filter(j => !(j.job_id in resultMap));
    if (pending.length === 0) return;
    pending.forEach(j => {
      getTrainingResult(j.job_id)
        .then(r => setResultMap(prev => ({ ...prev, [j.job_id]: r })))
        .catch(() => {});
    });
  }, [tcJobs, resultMap]);

  // 활성 작업 폴링 (테스트케이스가 실행 중일 때만)
  useEffect(() => {
    const hasActive = realJobs.some(j => ['RUNNING', 'QUEUED'].includes(j.status.toUpperCase()));
    if (!hasActive) return;
    const id = setInterval(() => getTrainingJobsByExperiment(expId).then(setRealJobs).catch(() => {}), POLL_MS);
    return () => clearInterval(id);
  }, [realJobs, expId]);

  // 브라우저 알림 권한 요청 (최초 1회)
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // 완료/실패 전환 시 브라우저 알림
  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window) || Notification.permission !== 'granted') return;
    for (const job of tcJobs) {
      const prevStatus = prevJobStatusRef.current[job.job_id];
      const status = job.status.toUpperCase();
      if (prevStatus && ['RUNNING', 'QUEUED'].includes(prevStatus) && ['COMPLETED', 'FAILED'].includes(status)) {
        const name = formatExecutionName(job.experiment_name, resultMap[job.job_id]?.params.run_datetime);
        new Notification(status === 'COMPLETED' ? '테스트케이스 완료' : '테스트케이스 실패', { body: name });
      }
      prevJobStatusRef.current[job.job_id] = status;
    }
  }, [tcJobs, resultMap]);

  // 모델 목록 로드
  useEffect(() => {
    getModels()
      .then(data => setModels(mergeRegisteredModels(data.length ? data : FALLBACK_MODELS)))
      .catch(() => setModels(mergeRegisteredModels(FALLBACK_MODELS)));
  }, []);

  // 테스트케이스 제출
  const handleSubmitTc = async (
    files: FormFiles | null,
    modelVersion: string,
    memo: string,
    observationDatasetDir: string | null,
    outputDir: string | null,
    inputDatasetDir: string | null,
    inputDatasetFiles: string[],
    answerDatasetId: number | null,
  ) => {
    const sourceFiles = files ? Object.values(files).map(file => file.name) : inputDatasetFiles;
    const runDt = getCompactDtFromFilename(sourceFiles[sourceFiles.length - 1] ?? null) ?? getNowDt();
    const requester = getCurrentUsername();
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
    const makeFile = (fs: FileState): AscFileInput =>
      fs.file
        ? { filename: fs.name, file: fs.file }
        : { filename: null, file: null };

    const payload = {
      user_name:               requester,
      run_datetime:           toApiRunDatetime(runDt),
      model_version:          backendModelVersion,
      mode:                   modelMode,
      forecast_steps:         ALL_STEPS,
      include_preview_image:  true,
      experiment_name:        formatExecutionName(null, runDt),
      experiment_id:          expId,
      experiment_tags:        null,
      experiment_memo:        memo || null,
      observation_dataset_id: null,
      observation_dataset_dir: observationDatasetDir,
      answer_dataset_id:      answerDatasetId,
      output_dir:             outputDir,
      input_dataset_dir:       inputDatasetDir,
      input_files: files ? {
        file_t0: makeFile(files.t0),
        file_t1: makeFile(files.t1),
        file_t2: makeFile(files.t2),
        file_t3: makeFile(files.t3),
      } : undefined,
    };

    const result = await createExperimentJob(payload);

    // 메모/모델메타는 아직 클라이언트에 보관 — 백엔드가 experiment_memo를 응답하지 않음 (request.md 항목 9B)
    if (result?.job_id) {
      if (memo) saveTcMemo(result.job_id, memo);
      saveTcModelMeta(result.job_id, { modelVersion, architecture: modelMode, requester });
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

  const toggleCompare = (jobId: number) => {
    setCompareIds(prev => {
      const next = new Set(prev);
      if (next.has(jobId)) next.delete(jobId); else next.add(jobId);
      return next;
    });
  };

  const handleDeleteJob = async (jobId: number) => {
    if (!window.confirm('이 테스트케이스를 삭제할까요? 결과 파일도 함께 삭제되며 되돌릴 수 없습니다.')) return;
    setDeletingId(jobId);
    try {
      await deleteTraining(jobId);
      setCompareIds(prev => {
        const next = new Set(prev);
        next.delete(jobId);
        return next;
      });
      if (selectedId === jobId) setSelectedId(null);
      fetchJobs();
    } catch (err) {
      alert(err instanceof Error ? err.message : '삭제에 실패했습니다.');
    } finally {
      setDeletingId(null);
    }
  };

  const titleActions = (
    <button
      onClick={() => setShowModal(true)}
      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition shadow-sm flex-shrink-0"
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
      </svg>
      새 테스트케이스
    </button>
  );

  const title = (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={() => router.push('/experiments')}
        className="font-semibold hover:text-blue-600 transition-colors"
      >
        실험
      </button>
      <span className="text-gray-300">&gt;</span>
      <Link
        href={`/experiments/${experiment.id}`}
        className="max-w-[28rem] truncate font-semibold hover:text-blue-600 transition-colors"
      >
        {experiment.name}
      </Link>
      <span className="text-gray-300">&gt;</span>
      <span className="truncate">테스트케이스</span>
    </span>
  );

  return (
    <Layout title={title} titleActions={titleActions}>
      {showModal && (
        <AddTcModal
          onClose={() => setShowModal(false)}
          onSubmit={handleSubmitTc}
          models={selectableModels}
        />
      )}

      {showCompare && (
        <CompareModal
          jobs={tcJobs.filter(job => compareIds.has(job.job_id))}
          resultMap={resultMap}
          onClose={() => setShowCompare(false)}
        />
      )}

      {(experiment.description || experiment.created_by) && (
        <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1">
          {experiment.description && (
            <p className="text-sm text-gray-500">{experiment.description}</p>
          )}
          {experiment.created_by && (
            <span className="text-xs text-gray-400 font-mono">생성자: {experiment.created_by}</span>
          )}
        </div>
      )}

      {/* 테스트케이스 테이블 */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-gray-700">테스트케이스 목록</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as typeof statusFilter)}
              className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-600 focus:outline-none focus:border-blue-300"
            >
              <option value="ALL">전체 상태</option>
              <option value="COMPLETED">COMPLETED</option>
              <option value="FAILED">FAILED</option>
              <option value="RUNNING">RUNNING</option>
              <option value="QUEUED">QUEUED</option>
            </select>
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as typeof sortBy)}
              className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-600 focus:outline-none focus:border-blue-300"
            >
              <option value="latest">최신순</option>
              <option value="mae">MAE 낮은순</option>
              <option value="rmse">RMSE 낮은순</option>
              <option value="csi">CSI 높은순</option>
            </select>
            {compareIds.size > 0 && (
              <button
                type="button"
                onClick={() => setShowCompare(true)}
                disabled={compareIds.size < 2}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-700 disabled:opacity-40"
              >
                비교하기 ({compareIds.size})
              </button>
            )}
            {loading && <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />}
          </div>
        </div>

        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              {['', '테스트케이스 이름', '생성자', '상태', '등록일', '소요시간', '모델', 'MAE', 'RMSE', 'CSI', '삭제'].map((h, i) => (
                <th key={i} className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && pagedJobs.length === 0 && <SkeletonTableRows rows={4} cols={11} />}
            {pagedJobs.flatMap(job => {
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
              const displayRequester = displayUsername(job.user_name);
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
                  <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                    {s === 'COMPLETED' && (
                      <input
                        type="checkbox"
                        checked={compareIds.has(job.job_id)}
                        onChange={() => toggleCompare(job.job_id)}
                        className="accent-blue-600"
                        aria-label="비교에 추가"
                      />
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <button
                        type="button"
                        onClick={e => { e.stopPropagation(); handleToggleGold(job.job_id); }}
                        aria-label={
                          goldJobId === job.job_id
                            ? (isManualGold ? '대표 테스트케이스로 수동 고정됨 (클릭하면 자동 산정으로 되돌림)' : '대표 테스트케이스 (CSI 최고점, 자동 산정 — 클릭하면 수동 고정)')
                            : '이 테스트케이스를 대표로 수동 지정'
                        }
                        title={
                          goldJobId === job.job_id
                            ? (isManualGold ? '수동 고정됨 — 클릭하면 자동 산정으로 되돌림' : 'CSI 최고점 (자동 산정) — 클릭하면 수동 고정')
                            : '클릭하면 이 테스트케이스를 대표로 수동 지정'
                        }
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
                        {goldJobId === job.job_id && isManualGold && (
                          <span
                            className="absolute -bottom-0.5 -right-0.5 flex h-3 w-3 items-center justify-center rounded-full bg-white text-[8px] leading-none shadow"
                            aria-hidden="true"
                          >
                            📌
                          </span>
                        )}
                      </button>
                      <span className="font-semibold text-gray-800 text-sm leading-tight">{executionName}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs font-mono whitespace-nowrap">{displayRequester}</td>
                  <td className="px-4 py-3"><StatusBadge status={job.status} /></td>
                  <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">{fmtDt(job.created_at)}</td>
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
                  <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                    {s !== 'RUNNING' && s !== 'QUEUED' && (
                      <button
                        type="button"
                        onClick={() => handleDeleteJob(job.job_id)}
                        disabled={deletingId === job.job_id}
                        className="inline-flex items-center justify-center rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                        title="테스트케이스 삭제"
                        aria-label="테스트케이스 삭제"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.9} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 7h12M10 11v6m4-6v6M9 7l1-2h4l1 2m-8 0 1 13h8l1-13" />
                        </svg>
                      </button>
                    )}
                  </td>
                </tr>
              );

              if (!isSelected) return [mainRow];

              const detailRow = (
                <tr key={`${job.job_id}-detail`}>
                  <td colSpan={11} className="bg-blue-50/40 border-b border-gray-100 px-6 py-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-3 mb-3">
                      {[
                        { label: '등록일',    value: fmtDt(job.created_at) },
                        { label: '시작일',    value: fmtDt(job.started_at) },
                        { label: '완료일',    value: fmtDt(job.finished_at) },
                        { label: '소요 시간', value: fmtDur(job.started_at, job.finished_at) },
                        { label: '생성자',    value: displayRequester },
                        { label: '모드',      value: displayMode },
                      ].map(row => (
                        <div key={row.label}>
                          <p className="text-[11px] text-gray-400 uppercase font-semibold tracking-wide mb-0.5">{row.label}</p>
                          <p className="text-sm text-gray-800">{row.value}</p>
                        </div>
                      ))}
                      {s === 'RUNNING' && (
                        <div className="col-span-2 md:col-span-4 rounded-lg border border-blue-100 bg-white px-4 py-3">
                          <div className="mb-2 flex items-center justify-between gap-3">
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">진행률</p>
                            <p className="text-xs font-semibold text-blue-700">{fmtEta(job)}</p>
                          </div>
                          <ProgressBar job={job} />
                        </div>
                      )}
                    </div>

                    {s === 'FAILED' && job.error_message && (
                      <div className="mb-3 rounded-lg border border-red-100 bg-red-50 px-4 py-3">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-red-500 mb-1">실패 원인</p>
                        <p className="text-xs text-red-700 font-mono whitespace-pre-wrap break-all">{job.error_message}</p>
                      </div>
                    )}

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
                  </td>
                </tr>
              );

              return [mainRow, detailRow];
            })}
          </tbody>
        </table>

        {tcJobs.length === 0 && !loading && (
          <div className="py-16 text-center text-gray-400 text-sm">
            {totalTc === 0 ? '실험 이력이 없습니다. 새 테스트케이스 버튼으로 검증을 시작하세요.' : '로드 중...'}
          </div>
        )}

        {visibleJobs.length > 0 && (
          <div className="h-12 flex items-center justify-center border-t border-gray-100 px-5 text-xs text-gray-500">
            <div className="flex items-center gap-2">
              {pagination.map(item => (
                typeof item === 'number' ? (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setPage(item)}
                    className={`min-w-5 px-1 py-1 transition-colors ${
                      item === safePage
                        ? 'font-semibold text-blue-600 underline underline-offset-4'
                        : 'text-gray-500 hover:text-blue-600'
                    }`}
                  >
                    {item}
                  </button>
                ) : (
                  <span key={item} className="px-1 text-gray-300">...</span>
                )
              ))}
            </div>
          </div>
        )}

        <div className="px-5 py-2.5 border-t border-gray-100 text-xs text-gray-400">
          총 {totalTc}개 테스트케이스
        </div>
      </div>
    </Layout>
  );
}
