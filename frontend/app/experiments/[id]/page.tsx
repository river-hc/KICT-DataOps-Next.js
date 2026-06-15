'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Layout from '@/lib/Layout';
import {
  getExperimentJobs, getModels, getTrainingLogs,
  createExperimentJob, getObservationDatasets, createObservationDataset,
  fileToBase64, calculateTimestamp,
  type TrainingJob, type AscFileInput, type ModelVersion, type ObservationDataset,
} from '@/lib/api';
import {
  MOCK_EXPERIMENTS, MOCK_EXPERIMENT_JOBS, MOCK_DETAILS,
  type MockExperiment,
} from '@/lib/mockData';
import {
  loadClientExperiments, addTcToExpMap, getAllTcJobIds,
} from '@/lib/experimentStore';

// ─── 상수 ────────────────────────────────────────────────────────────────────

const POLL_MS   = 3000;
const ALL_STEPS = [10,20,30,40,50,60,70,80,90,100,110,120,130,140,150,160,170,180];

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

const EMPTY_FILE:  FileState = { file: null, name: null };
const EMPTY_FILES: FormFiles = { t0: EMPTY_FILE, t1: EMPTY_FILE, t2: EMPTY_FILE, t3: EMPTY_FILE };

const FILE_SLOTS = [
  { key: 't0' as SlotKey, label: 'T-30분',   desc: '30분 전 관측', offset: -30 },
  { key: 't1' as SlotKey, label: 'T-20분',   desc: '20분 전 관측', offset: -20 },
  { key: 't2' as SlotKey, label: 'T-10분',   desc: '10분 전 관측', offset: -10 },
  { key: 't3' as SlotKey, label: 'T (현재)', desc: '현재 관측',    offset:   0 },
];

function getNowDt(): string {
  const now = new Date();
  const p   = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}${p(now.getMonth()+1)}${p(now.getDate())}${p(now.getHours())}${p(now.getMinutes())}`;
}

function toApiRunDatetime(compact: string): string {
  return `${compact.slice(0,4)}-${compact.slice(4,6)}-${compact.slice(6,8)}T${compact.slice(8,10)}:${compact.slice(10,12)}:00`;
}

function getCompactDtFromFilename(filename: string | null): string | null {
  if (!filename) return null;
  const m = filename.match(/(20\d{10})/);
  if (m) return m[1];
  const s = filename.match(/(20\d{2})[-_]?(\d{2})[-_]?(\d{2})[-_T]?(\d{2})[-_]?(\d{2})/);
  if (!s) return null;
  return `${s[1]}${s[2]}${s[3]}${s[4]}${s[5]}`;
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
  const ref = useRef<HTMLInputElement>(null);
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

// ─── TC 추가 모달 (NewExperimentModal) ────────────────────────────────────────

function AddTcModal({
  onClose, onSubmit, models, observationDatasets, onDatasetUploaded,
}: {
  onClose: () => void;
  onSubmit: (files: FormFiles, modelVersion: string, memo: string, observationDatasetId: number | null) => Promise<void>;
  models: ModelVersion[];
  observationDatasets: ObservationDataset[];
  onDatasetUploaded: (ds: ObservationDataset) => void;
}) {
  const [modelVersion,        setModelVersion]        = useState<string>(() => models[0]?.version ?? '');
  const [files,               setFiles]               = useState<FormFiles>(EMPTY_FILES);
  const [memo,                setMemo]                = useState('');
  const [submitting,          setSubmitting]          = useState(false);
  const [error,               setError]               = useState<string | null>(null);
  const [obsDatasetId,        setObsDatasetId]        = useState<number | null>(null);
  const [showDatasetUpload,   setShowDatasetUpload]   = useState(false);
  const [datasetName,         setDatasetName]         = useState('');
  const [datasetFolderName,   setDatasetFolderName]   = useState('');
  const [datasetDescription,  setDatasetDescription]  = useState('');
  const [datasetFiles,        setDatasetFiles]        = useState<File[]>([]);
  const [datasetUploading,    setDatasetUploading]    = useState(false);
  const [datasetUploadError,  setDatasetUploadError]  = useState<string | null>(null);

  const handleFile = (key: SlotKey) => (file: File | null) =>
    setFiles(prev => ({ ...prev, [key]: file ? { file, name: file.name } : EMPTY_FILE }));

  const handleSubmit = async () => {
    setSubmitting(true); setError(null);
    try   { await onSubmit(files, modelVersion, memo, obsDatasetId); onClose(); }
    catch (e: unknown) { setError(e instanceof Error ? e.message : '실험 시작에 실패했습니다.'); }
    finally { setSubmitting(false); }
  };

  const canUploadDataset = datasetName.trim().length > 0 && datasetFiles.length > 0 && !datasetUploading;

  const handleDatasetUpload = async () => {
    if (!canUploadDataset) return;
    setDatasetUploading(true);
    setDatasetUploadError(null);
    try {
      const ds = await createObservationDataset({
        name: datasetName.trim(),
        folder_name: datasetFolderName.trim() || null,
        description: datasetDescription.trim() || null,
        files: datasetFiles,
      });
      onDatasetUploaded(ds);
      setObsDatasetId(ds.id);
      setDatasetName(''); setDatasetFolderName(''); setDatasetDescription(''); setDatasetFiles([]);
      setShowDatasetUpload(false);
    } catch (e: unknown) {
      setDatasetUploadError(e instanceof Error ? e.message : '정답 데이터셋 업로드에 실패했습니다.');
    } finally {
      setDatasetUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-2xl mx-4 bg-white rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-start justify-between px-6 py-5 border-b border-gray-100 flex-shrink-0">
          <div>
            <h2 className="text-lg font-bold text-gray-900">TC 추가</h2>
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
            <label className="text-xs font-medium text-gray-600 block mb-1.5">모델 버전</label>
            <select
              value={modelVersion}
              onChange={e => setModelVersion(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              {models.map(m => {
                const arch = m.metrics?.architecture as string | undefined;
                const archLabel = arch === 'single' ? 'Single' : arch === 'multi' ? 'Multi' : '';
                return (
                  <option key={m.id} value={m.version}>
                    {m.version}{archLabel ? ` (${archLabel})` : ''}
                  </option>
                );
              })}
            </select>
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
            <div className="grid grid-cols-2 gap-3">
              {FILE_SLOTS.map(slot => (
                <FileSlot key={slot.key} label={slot.label} desc={slot.desc}
                  state={files[slot.key]} onChange={handleFile(slot.key)} />
              ))}
            </div>
            <p className="text-[11px] text-gray-400 mt-2">파일 없이도 실험을 시작할 수 있습니다.</p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium text-gray-600">
                성능 지표 정답 데이터셋 <span className="text-gray-400 font-normal">(선택)</span>
              </label>
              <button type="button" onClick={() => setShowDatasetUpload(v => !v)}
                className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold text-blue-600 border border-blue-100 rounded-lg hover:bg-blue-50 transition-colors">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                데이터셋 업로드
              </button>
            </div>
            <div className="space-y-2">
              {observationDatasets.length === 0 ? (
                <div className="border border-dashed border-gray-200 rounded-lg px-4 py-3 bg-gray-50">
                  <p className="text-xs text-gray-400">등록된 정답 데이터셋이 없습니다.</p>
                </div>
              ) : (
                <select value={obsDatasetId ?? ''} onChange={e => setObsDatasetId(e.target.value === '' ? null : Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                  <option value="">선택 안 함</option>
                  {observationDatasets.map(ds => (
                    <option key={ds.id} value={ds.id}>{ds.name} ({ds.file_count}개 파일)</option>
                  ))}
                </select>
              )}
              <p className="text-[11px] text-gray-400">
                run_datetime과 forecast step 기준으로 정답 파일을 매칭합니다.
              </p>
              {showDatasetUpload && (
                <div className="border border-gray-200 rounded-xl bg-gray-50 px-4 py-3 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-medium text-gray-500">데이터셋 이름</label>
                      <input value={datasetName} onChange={e => setDatasetName(e.target.value)}
                        placeholder="예: 2026_summer_validation"
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-medium text-gray-500">폴더명 <span className="text-gray-400 font-normal">(선택)</span></label>
                      <input value={datasetFolderName} onChange={e => setDatasetFolderName(e.target.value)}
                        placeholder="비우면 백엔드 기본값 사용"
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-medium text-gray-500">설명 <span className="text-gray-400 font-normal">(선택)</span></label>
                    <input value={datasetDescription} onChange={e => setDatasetDescription(e.target.value)}
                      placeholder="테스트 조건이나 기준 시각 메모"
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-medium text-gray-500">정답 ASC 파일</label>
                    <input type="file" accept=".asc" multiple onChange={e => setDatasetFiles(Array.from(e.target.files ?? []))}
                      className="w-full text-xs text-gray-500 file:mr-3 file:px-3 file:py-1.5 file:rounded-lg file:border-0 file:bg-white file:text-xs file:font-semibold file:text-gray-600 hover:file:bg-gray-100" />
                    <p className="text-[11px] text-gray-400">파일명은 QPE_YYYYMMDDHHMM.asc 형식이어야 합니다.</p>
                    {datasetFiles.length > 0 && (
                      <div className="max-h-20 overflow-y-auto rounded-lg border border-gray-100 bg-white px-3 py-2">
                        {datasetFiles.map(file => (
                          <p key={`${file.name}-${file.size}`} className="text-[11px] text-gray-500 truncate">{file.name}</p>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      {datasetUploadError && <p className="text-xs text-red-500">{datasetUploadError}</p>}
                    </div>
                    <button type="button" onClick={handleDatasetUpload} disabled={!canUploadDataset}
                      className="px-3 py-2 bg-gray-800 text-white text-xs font-semibold rounded-lg hover:bg-gray-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2">
                      {datasetUploading && <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                      업로드 후 선택
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-gray-600">메모</label>
            <textarea value={memo} onChange={e => setMemo(e.target.value)} rows={3}
              placeholder="학습 데이터 출처, 특이사항 등"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
          </div>
        </div>

        <div className="flex-shrink-0 border-t border-gray-100 px-6 py-4 flex items-center gap-3">
          <div className="flex-1 min-w-0">{error && <p className="text-xs text-red-500">{error}</p>}</div>
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors flex-shrink-0">취소</button>
          <button onClick={handleSubmit} disabled={submitting}
            className="px-5 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2 flex-shrink-0">
            {submitting && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
            TC 추가
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

  // 실험 환경 조회 (MOCK + localStorage client)
  const [experiment, setExperiment] = useState<MockExperiment | null | undefined>(undefined);
  const [tcJobIds,   setTcJobIds]   = useState<number[]>([]);
  const [allJobs,    setAllJobs]    = useState<TrainingJob[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [showModal,  setShowModal]  = useState(false);
  const [models,              setModels]              = useState<ModelVersion[]>([]);
  const [observationDatasets, setObservationDatasets] = useState<ObservationDataset[]>([]);
  const [selectedId,          setSelectedId]          = useState<number | null>(null);
  const [logs,                setLogs]                = useState<string[]>([]);
  const [logsLoading,         setLogsLoading]         = useState(false);
  const logsEndRef = useRef<HTMLDivElement>(null);

  // 실험 환경 로드
  useEffect(() => {
    const found = MOCK_EXPERIMENTS.find(e => e.id === expId)
      ?? loadClientExperiments().find(e => e.id === expId)
      ?? null;
    setExperiment(found);
    if (found) {
      setTcJobIds(getAllTcJobIds(found));
    }
  }, [expId]);

  // TC Map 변경 반영 (TC 추가 후)
  const refreshTcIds = useCallback(() => {
    const found = MOCK_EXPERIMENTS.find(e => e.id === expId)
      ?? loadClientExperiments().find(e => e.id === expId)
      ?? null;
    if (found) setTcJobIds(getAllTcJobIds(found));
  }, [expId]);

  // 작업 목록 로드
  const fetchJobs = useCallback(() => {
    getExperimentJobs()
      .then(data => setAllJobs(data))
      .catch(() => setAllJobs(MOCK_EXPERIMENT_JOBS))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchJobs(); }, [fetchJobs]);

  // 활성 작업 폴링
  useEffect(() => {
    const tcJobs  = allJobs.filter(j => tcJobIds.includes(j.job_id));
    const hasActive = tcJobs.some(j => ['RUNNING', 'QUEUED'].includes(j.status.toUpperCase()));
    if (!hasActive) return;
    const id = setInterval(() => getExperimentJobs().then(setAllJobs).catch(() => {}), POLL_MS);
    return () => clearInterval(id);
  }, [allJobs, tcJobIds]);

  // 모델 목록 + 정답 데이터셋 로드
  useEffect(() => {
    getModels()
      .then(data => setModels(data.length ? data : FALLBACK_MODELS))
      .catch(() => setModels(FALLBACK_MODELS));
    getObservationDatasets()
      .then(setObservationDatasets)
      .catch(() => setObservationDatasets([]));
  }, []);

  // 실행 중 TC 로그
  const selectedJob       = allJobs.find(j => j.job_id === selectedId) ?? null;
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

  // TC 제출
  const handleSubmitTc = async (
    files: FormFiles,
    modelVersion: string,
    memo: string,
    observationDatasetId: number | null,
  ) => {
    const runDt = getCompactDtFromFilename(files.t3.name) ?? getNowDt();
    const makeFile = async (fs: FileState, offset: number): Promise<AscFileInput> =>
      fs.file
        ? { filename: fs.name, timestamp: calculateTimestamp(runDt, offset), file_data: await fileToBase64(fs.file) }
        : { filename: null, timestamp: null, file_data: null };

    const result = await createExperimentJob({
      run_datetime:           toApiRunDatetime(runDt),
      model_version:          modelVersion,
      forecast_steps:         ALL_STEPS,
      include_preview_image:  true,
      experiment_name:        null,
      experiment_tags:        null,
      experiment_memo:        memo || null,
      observation_dataset_id: observationDatasetId,
      input_files: {
        file_t0: await makeFile(files.t0, -30),
        file_t1: await makeFile(files.t1, -20),
        file_t2: await makeFile(files.t2, -10),
        file_t3: await makeFile(files.t3,   0),
      },
    });

    // 실험 TC 맵 갱신 (백엔드 experiment_id 연동 전 클라이언트 측 보관)
    if (result?.job_id) {
      addTcToExpMap(expId, result.job_id);
      refreshTcIds();
    }
    fetchJobs();
  };

  const handleDatasetUploaded = useCallback((ds: ObservationDataset) => {
    setObservationDatasets(prev => [ds, ...prev.filter(d => d.id !== ds.id)]);
  }, []);

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

  const tcJobs = allJobs.filter(j => tcJobIds.includes(j.job_id));
  const totalTc = tcJobIds.length;

  return (
    <Layout>
      {showModal && (
        <AddTcModal
          onClose={() => setShowModal(false)}
          onSubmit={handleSubmitTc}
          models={models}
          observationDatasets={observationDatasets}
          onDatasetUploaded={handleDatasetUploaded}
        />
      )}

      {/* 실험 헤더 */}
      <div className="mb-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <button onClick={() => router.push('/experiments')}
                className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
                실험 목록
              </button>
              <svg className="w-3 h-3 text-gray-300" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-gray-900">{experiment.name}</h1>
            {experiment.description && (
              <p className="text-sm text-gray-500 mt-1">{experiment.description}</p>
            )}
            <p className="text-xs text-gray-400 mt-1">
              ID: {expId} · {totalTc}개 TC · 생성일 {fmtDt(experiment.created_at)}
            </p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition shadow-sm flex-shrink-0"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            TC 추가
          </button>
        </div>
      </div>

      {/* TC 테이블 */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <span className="text-sm font-semibold text-gray-700">테스트 케이스 (TC) 목록</span>
          {loading && <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />}
        </div>

        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              {['TC 이름', '상태', '등록일', '소요시간', '모델', 'MAE', 'RMSE', 'CSI'].map(h => (
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
              const detail     = MOCK_DETAILS[job.job_id];
              const metrics    = detail?.metrics;
              const modelVer   = detail?.params.model_version ?? '-';
              const csi        = metrics ? (metrics.csi ?? metrics.csi_10 ?? null) : null;

              const mainRow = (
                <tr
                  key={job.job_id}
                  onClick={toggle}
                  className={`cursor-pointer border-b border-gray-100 transition-colors ${isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                >
                  <td className="px-4 py-3">
                    <div>
                      {(s === 'COMPLETED' || s === 'FAILED' || s === 'CANCELED') ? (
                        <Link
                          href={`/experiment-results/${job.job_id}`}
                          onClick={e => e.stopPropagation()}
                          className="font-semibold text-blue-600 hover:underline text-sm leading-tight"
                        >
                          {job.experiment_name}
                        </Link>
                      ) : (
                        <span className="font-semibold text-gray-800 text-sm leading-tight">{job.experiment_name}</span>
                      )}
                      <p className="text-[11px] text-gray-400 mt-0.5">#{job.job_id} · {job.mode}</p>
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
                  <td className="px-4 py-3 font-mono text-xs text-gray-700 tabular-nums">
                    {metrics?.mae != null ? metrics.mae.toFixed(3) : '-'}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-700 tabular-nums">
                    {metrics?.rmse != null ? metrics.rmse.toFixed(3) : '-'}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-700 tabular-nums">
                    {csi != null ? csi.toFixed(3) : '-'}
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
                        { label: '요청자',    value: job.user_name },
                        { label: '모드',      value: job.mode },
                        ...(job.run_id != null ? [{ label: 'Run ID', value: `#${job.run_id}` }] : []),
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
                            로그 — Job #{job.job_id}
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
            {totalTc === 0 ? 'TC가 없습니다. TC 추가 버튼으로 실험을 시작하세요.' : '로드 중...'}
          </div>
        )}

        <div className="px-5 py-2.5 border-t border-gray-100 text-xs text-gray-400">
          총 {totalTc}개 TC
        </div>
      </div>
    </Layout>
  );
}
