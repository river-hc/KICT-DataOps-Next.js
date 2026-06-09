'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import Layout from '@/lib/Layout';
import {
  getTrainings, getTrainingLogs, createExperiment, createTraining,
  fileToBase64, calculateTimestamp,
  type TrainingJob, type AscFileInput,
} from '@/lib/api';
import { MOCK_TRAININGS } from '@/lib/mockData';

const ALL_STEPS = [10,20,30,40,50,60,70,80,90,100,110,120,130,140,150,160,170,180];
const POLL_MS   = 3000;

type Mode    = 'experiment' | 'training';
type SlotKey = 't0' | 't1' | 't2' | 't3';

interface FileState { file: File | null; name: string | null; }
interface FormFiles { t0: FileState; t1: FileState; t2: FileState; t3: FileState; }

const EMPTY_FILE:  FileState = { file: null, name: null };
const EMPTY_FILES: FormFiles = { t0: EMPTY_FILE, t1: EMPTY_FILE, t2: EMPTY_FILE, t3: EMPTY_FILE };

// file_t0 = T-30m, file_t3 = T+0 (현재)
const FILE_SLOTS = [
  { key: 't0' as SlotKey, label: 'T-30분',   desc: '30분 전 관측', offset: -30 },
  { key: 't1' as SlotKey, label: 'T-20분',   desc: '20분 전 관측', offset: -20 },
  { key: 't2' as SlotKey, label: 'T-10분',   desc: '10분 전 관측', offset: -10 },
  { key: 't3' as SlotKey, label: 'T (현재)', desc: '현재 관측',    offset:   0 },
];

// ─── 유틸 ─────────────────────────────────────────────────────────────────────

function getNowDt(): string {
  const now = new Date();
  const p   = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}${p(now.getMonth()+1)}${p(now.getDate())}${p(now.getHours())}${p(now.getMinutes())}`;
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

// ─── 태그 입력 (메모 + 태그 통합) ────────────────────────────────────────────

function TagInput({
  tags, onAdd, onRemove, placeholder,
}: {
  tags: string[]; onAdd: (t: string) => void; onRemove: (t: string) => void; placeholder?: string;
}) {
  const [input, setInput] = useState('');

  const flush = () => {
    const t = input.trim();
    if (t && !tags.includes(t)) onAdd(t);
    setInput('');
  };

  return (
    <div className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500">
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {tags.map(tag => (
            <span key={tag} className="inline-flex items-center gap-1 bg-blue-50 border border-blue-200 text-blue-700 text-xs px-2 py-0.5 rounded-full">
              {tag}
              <button type="button" onClick={() => onRemove(tag)} className="text-blue-400 hover:text-blue-600 leading-none">
                <svg viewBox="0 0 12 12" className="w-2.5 h-2.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M2 2l8 8M10 2l-8 8" />
                </svg>
              </button>
            </span>
          ))}
        </div>
      )}
      <input
        type="text"
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); flush(); }
          if (e.key === 'Backspace' && input === '' && tags.length > 0) onRemove(tags[tags.length - 1]);
        }}
        onBlur={flush}
        className="w-full text-sm text-gray-900 outline-none bg-transparent"
        placeholder={tags.length === 0 ? (placeholder ?? '입력 후 Enter') : '태그 추가...'}
      />
    </div>
  );
}

// ─── 파일 업로드 슬롯 ─────────────────────────────────────────────────────────

function FileSlot({
  label, desc, state, onChange,
}: {
  label: string; desc: string; state: FileState; onChange: (f: File | null) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div
      onClick={() => ref.current?.click()}
      className={`relative flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-xl p-4 cursor-pointer transition-colors ${
        state.file
          ? 'border-blue-300 bg-blue-50'
          : 'border-gray-200 bg-gray-50 hover:border-blue-300 hover:bg-blue-50/60'
      }`}
    >
      <input
        ref={ref}
        type="file"
        accept=".asc,.txt,.csv,.dat"
        className="hidden"
        onChange={e => onChange(e.target.files?.[0] ?? null)}
      />
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

// ─── 새 실험 모달 (Task 3) ─────────────────────────────────────────────────────
// 제거: 실험명, 운용 시점, 예측 선행시간 버튼, 미리보기 토글
// 고정: include_preview_image=true, forecast_steps=전체 18개, run_datetime=현재 시각
// 통합: 메모 + 태그 → TagInput

function NewExperimentModal({
  onClose, onSubmit,
}: {
  onClose: () => void;
  onSubmit: (files: FormFiles, modelVersion: 'v2'|'v3', mode: 'single'|'multi', tags: string[]) => Promise<void>;
}) {
  const [modelVersion, setModelVersion] = useState<'v2'|'v3'>('v3');
  const [runMode,      setRunMode]      = useState<'single'|'multi'>('single');
  const [files,        setFiles]        = useState<FormFiles>(EMPTY_FILES);
  const [tags,         setTags]         = useState<string[]>([]);
  const [submitting,   setSubmitting]   = useState(false);
  const [error,        setError]        = useState<string | null>(null);

  const handleFile = (key: SlotKey) => (file: File | null) =>
    setFiles(prev => ({ ...prev, [key]: file ? { file, name: file.name } : EMPTY_FILE }));

  const handleSubmit = async () => {
    setSubmitting(true); setError(null);
    try   { await onSubmit(files, modelVersion, runMode, tags); onClose(); }
    catch (e: unknown) { setError(e instanceof Error ? e.message : '실험 시작에 실패했습니다.'); }
    finally { setSubmitting(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-2xl mx-4 bg-white rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">

        <div className="flex items-start justify-between px-6 py-5 border-b border-gray-100 flex-shrink-0">
          <div>
            <h2 className="text-lg font-bold text-gray-900">새 실험 진행</h2>
            <p className="text-xs text-gray-400 mt-0.5">QPF 모델로 강우장을 예측합니다. 선행시간 10~180분 전체 자동 계산.</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 mt-0.5">
            <svg viewBox="0 0 16 16" className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
              <path d="M2 2l12 12M14 2L2 14" />
            </svg>
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">

          {/* 모델 설정 */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-gray-600">모델 버전</label>
              <div className="flex gap-2">
                {(['v3', 'v2'] as const).map(v => (
                  <button key={v} onClick={() => setModelVersion(v)}
                    className={`flex-1 py-2 rounded-lg border text-sm font-bold transition-colors ${
                      modelVersion === v
                        ? v === 'v3' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-sky-600 text-white border-sky-600'
                        : 'border-gray-200 text-gray-500 hover:border-gray-300'
                    }`}
                  >{v}</button>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-gray-600">모드</label>
              <div className="flex gap-2">
                {(['single', 'multi'] as const).map(m => (
                  <button key={m} onClick={() => setRunMode(m)}
                    className={`flex-1 py-2 rounded-lg border text-sm font-semibold transition-colors ${
                      runMode === m ? 'bg-gray-800 text-white border-gray-800' : 'border-gray-200 text-gray-500 hover:border-gray-300'
                    }`}
                  >{m}</button>
                ))}
              </div>
            </div>
          </div>

          {/* 예측 선행시간 고정 표시 */}
          <div className="bg-blue-50 rounded-xl px-4 py-3 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-blue-800">예측 선행시간</p>
              <p className="text-xs text-blue-500 mt-0.5">10분 ~ 180분 (18개 선행시간 전체 자동 계산)</p>
            </div>
            <span className="text-xs font-mono text-blue-600 bg-blue-100 px-2 py-1 rounded-lg">고정</span>
          </div>

          {/* 입력 ASC 파일 */}
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

          {/* 메모 / 태그 통합 */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-gray-600">
              메모 / 태그
              <span className="ml-1.5 font-normal text-gray-400">(Enter 또는 쉼표로 태그 추가 · 검색 가능)</span>
            </label>
            <TagInput
              tags={tags}
              onAdd={t => setTags(prev => [...prev, t])}
              onRemove={t => setTags(prev => prev.filter(x => x !== t))}
              placeholder="예: 강우, 실시간, 검증 — Enter로 추가"
            />
          </div>

        </div>

        <div className="flex-shrink-0 border-t border-gray-100 px-6 py-4 flex items-center gap-3">
          <div className="flex-1 min-w-0">{error && <p className="text-xs text-red-500">{error}</p>}</div>
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors flex-shrink-0">
            취소
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="px-5 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2 flex-shrink-0"
          >
            {submitting && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
            실험 시작
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── 새 학습 모달 (Task 4) ─────────────────────────────────────────────────────
// 제거: 실험명, 사용자, 운용 시점, 예측 선행시간 버튼, 미리보기 토글
// 고정: include_preview_image=true, forecast_steps=전체 18개, run_datetime=현재 시각

function NewTrainingModal({
  onClose, onSubmit,
}: {
  onClose: () => void;
  onSubmit: (files: FormFiles, modelVersion: 'v2'|'v3', mode: 'single'|'multi') => Promise<void>;
}) {
  const [modelVersion, setModelVersion] = useState<'v2'|'v3'>('v3');
  const [runMode,      setRunMode]      = useState<'single'|'multi'>('single');
  const [files,        setFiles]        = useState<FormFiles>(EMPTY_FILES);
  const [submitting,   setSubmitting]   = useState(false);
  const [error,        setError]        = useState<string | null>(null);

  const handleFile = (key: SlotKey) => (file: File | null) =>
    setFiles(prev => ({ ...prev, [key]: file ? { file, name: file.name } : EMPTY_FILE }));

  const handleSubmit = async () => {
    setSubmitting(true); setError(null);
    try   { await onSubmit(files, modelVersion, runMode); onClose(); }
    catch (e: unknown) { setError(e instanceof Error ? e.message : '학습 시작에 실패했습니다.'); }
    finally { setSubmitting(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-xl mx-4 bg-white rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">

        <div className="flex items-start justify-between px-6 py-5 border-b border-gray-100 flex-shrink-0">
          <div>
            <h2 className="text-lg font-bold text-gray-900">새 학습 진행</h2>
            <p className="text-xs text-gray-400 mt-0.5">QPF 모델 가중치를 업데이트합니다. 선행시간 10~180분 기본값 적용.</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 mt-0.5">
            <svg viewBox="0 0 16 16" className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
              <path d="M2 2l12 12M14 2L2 14" />
            </svg>
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">

          {/* 모델 설정 */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-gray-600">모델 버전</label>
              <div className="flex gap-2">
                {(['v3', 'v2'] as const).map(v => (
                  <button key={v} onClick={() => setModelVersion(v)}
                    className={`flex-1 py-2 rounded-lg border text-sm font-bold transition-colors ${
                      modelVersion === v
                        ? v === 'v3' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-sky-600 text-white border-sky-600'
                        : 'border-gray-200 text-gray-500 hover:border-gray-300'
                    }`}
                  >{v}</button>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-gray-600">모드</label>
              <div className="flex gap-2">
                {(['single', 'multi'] as const).map(m => (
                  <button key={m} onClick={() => setRunMode(m)}
                    className={`flex-1 py-2 rounded-lg border text-sm font-semibold transition-colors ${
                      runMode === m ? 'bg-gray-800 text-white border-gray-800' : 'border-gray-200 text-gray-500 hover:border-gray-300'
                    }`}
                  >{m}</button>
                ))}
              </div>
            </div>
          </div>

          {/* 고정값 안내 */}
          <div className="bg-gray-50 rounded-xl px-4 py-3 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-gray-700">예측 선행시간</p>
              <span className="text-xs text-gray-500 bg-white border border-gray-200 px-2 py-0.5 rounded-lg">10분 ~ 180분 (기본값)</span>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-gray-700">ASC 미리보기 이미지</p>
              <span className="text-xs text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-lg">항상 포함</span>
            </div>
          </div>

          {/* 입력 ASC 파일 */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">입력 ASC 파일</p>
            <div className="grid grid-cols-2 gap-3">
              {FILE_SLOTS.map(slot => (
                <FileSlot key={slot.key} label={slot.label} desc={slot.desc}
                  state={files[slot.key]} onChange={handleFile(slot.key)} />
              ))}
            </div>
            <p className="text-[11px] text-gray-400 mt-2">파일 없이도 학습을 시작할 수 있습니다.</p>
          </div>

        </div>

        <div className="flex-shrink-0 border-t border-gray-100 px-6 py-4 flex items-center gap-3">
          <div className="flex-1 min-w-0">{error && <p className="text-xs text-red-500">{error}</p>}</div>
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors flex-shrink-0">
            취소
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
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

// ─── 실험 목록 ────────────────────────────────────────────────────────────────

function ExperimentContent({ jobs, loading }: { jobs: TrainingJob[]; loading: boolean }) {
  const [filter, setFilter] = useState('ALL');

  const filtered = filter === 'ALL'
    ? jobs
    : jobs.filter(j => {
        const s = j.status.toUpperCase();
        return s === filter || (filter === 'FAILED' && s === 'CANCELED');
      });

  const TABS = [
    { key: 'ALL',       label: '전체',     cls: 'bg-gray-700 text-white' },
    { key: 'RUNNING',   label: '실행 중',  cls: 'bg-emerald-500 text-white' },
    { key: 'QUEUED',    label: '대기 중',  cls: 'bg-amber-400 text-white' },
    { key: 'COMPLETED', label: '완료',     cls: 'bg-blue-500 text-white' },
    { key: 'FAILED',    label: '실패/취소', cls: 'bg-red-400 text-white' },
  ];

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
        <div className="flex gap-1.5">
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
                filter === tab.key ? tab.cls : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        {loading && <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />}
      </div>

      <table className="w-full text-sm">
        <thead className="bg-gray-50">
          <tr>
            {['ID', '실험명', '모드', '상태', '진행률', '등록일', '소요 시간', '결과'].map(h => (
              <th key={h} className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {filtered.map(job => {
            const s           = job.status.toUpperCase();
            const isCompleted = s === 'COMPLETED';
            return (
              <tr key={job.job_id} className="hover:bg-gray-50 transition-colors">
                <td className="px-5 py-3">
                  <span className="font-mono text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">#{job.job_id}</span>
                </td>
                <td className="px-5 py-3 font-medium text-gray-800 max-w-[200px]">
                  <span className="truncate block">{job.experiment_name}</span>
                </td>
                <td className="px-5 py-3 text-gray-500 text-xs">{job.mode}</td>
                <td className="px-5 py-3"><StatusBadge status={job.status} /></td>
                <td className="px-5 py-3 min-w-[120px]">
                  {s === 'RUNNING' && job.progress != null ? (
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${job.progress}%` }} />
                      </div>
                      <span className="text-xs text-gray-500 tabular-nums w-7 text-right">{job.progress}%</span>
                    </div>
                  ) : <span className="text-xs text-gray-300">—</span>}
                </td>
                <td className="px-5 py-3 text-gray-400 text-xs whitespace-nowrap">{job.created_at?.slice(0,10) ?? '-'}</td>
                <td className="px-5 py-3 text-gray-500 text-xs whitespace-nowrap">{fmtDur(job.started_at, job.finished_at)}</td>
                <td className="px-5 py-3">
                  {isCompleted ? (
                    <Link href={`/experiment-results/${job.job_id}`}
                      className="text-xs text-blue-600 hover:text-blue-800 font-medium hover:underline">
                      결과 보기
                    </Link>
                  ) : <span className="text-xs text-gray-300">—</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {filtered.length === 0 && !loading && (
        <div className="py-16 text-center text-gray-400 text-sm">등록된 실험이 없습니다.</div>
      )}
    </div>
  );
}

// ─── 학습 목록 + 로그 뷰어 ───────────────────────────────────────────────────

function TrainingContent({
  jobs, loading, onRefresh,
}: {
  jobs: TrainingJob[]; loading: boolean; onRefresh: () => void;
}) {
  const [selectedId,   setSelectedId]   = useState<number | null>(null);
  const [logs,         setLogs]         = useState<string[]>([]);
  const [logsLoading,  setLogsLoading]  = useState(false);
  const logsEndRef = useRef<HTMLDivElement>(null);

  const selectedJob       = jobs.find(j => j.job_id === selectedId) ?? null;
  const isSelectedRunning = selectedJob?.status.toUpperCase() === 'RUNNING';

  useEffect(() => {
    if (selectedId == null) { setLogs([]); return; }
    setLogsLoading(true);
    getTrainingLogs(selectedId)
      .then(r => setLogs(r.logs))
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

  return (
    <>
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <span className="text-sm font-semibold text-gray-700">학습 목록</span>
          <div className="flex items-center gap-3">
            {loading && <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />}
            <button
              onClick={onRefresh}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 transition"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              새로고침
            </button>
          </div>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              {['ID', '실험명', '모드', '상태', '진행률', '등록일', '작업'].map(h => (
                <th key={h} className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {jobs.map(job => {
              const s = job.status.toUpperCase();
              return (
                <tr
                  key={job.job_id}
                  onClick={() => setSelectedId(prev => prev === job.job_id ? null : job.job_id)}
                  className={`cursor-pointer transition-colors ${selectedId === job.job_id ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                >
                  <td className="px-5 py-3">
                    <span className="font-mono text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">#{job.job_id}</span>
                  </td>
                  <td className="px-5 py-3 font-medium text-gray-800">{job.experiment_name}</td>
                  <td className="px-5 py-3 text-gray-500">{job.mode}</td>
                  <td className="px-5 py-3"><StatusBadge status={job.status} /></td>
                  <td className="px-5 py-3 min-w-[140px]">
                    {s === 'RUNNING' && job.progress != null ? (
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${job.progress}%` }} />
                        </div>
                        <span className="text-xs text-gray-500 w-7 text-right flex-shrink-0">{job.progress}%</span>
                        {job.current_epoch != null && job.total_epochs != null && (
                          <span className="text-xs text-gray-400 flex-shrink-0">{job.current_epoch}/{job.total_epochs}</span>
                        )}
                      </div>
                    ) : <span className="text-xs text-gray-300">—</span>}
                  </td>
                  <td className="px-5 py-3 text-gray-400 text-xs">{job.created_at?.slice(0,10) ?? '-'}</td>
                  <td className="px-5 py-3">
                    {s === 'RUNNING' && (
                      <button onClick={e => { e.stopPropagation(); onRefresh(); }} className="text-xs text-red-600 hover:underline mr-2">
                        정지
                      </button>
                    )}
                    {(s === 'COMPLETED' || s === 'FAILED') && (
                      <button onClick={e => { e.stopPropagation(); onRefresh(); }} className="text-xs text-amber-600 hover:underline">
                        재설정
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {jobs.length === 0 && !loading && (
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
            <button onClick={() => setSelectedId(null)} className="flex-shrink-0 text-gray-500 hover:text-gray-200 transition-colors">
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
    </>
  );
}

// ─── 메인 페이지 ──────────────────────────────────────────────────────────────

export default function UnifiedPage() {
  const [mode,      setMode]      = useState<Mode>('experiment');
  const [showModal, setShowModal] = useState(false);
  const [jobs,      setJobs]      = useState<TrainingJob[]>([]);
  const [loading,   setLoading]   = useState(false);

  const refresh = useCallback(() => {
    setLoading(true);
    getTrainings()
      .then(setJobs)
      .catch(() => setJobs(MOCK_TRAININGS))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    const hasActive = jobs.some(j => ['RUNNING', 'QUEUED'].includes(j.status.toUpperCase()));
    if (!hasActive) return;
    const id = setInterval(() => { getTrainings().then(setJobs).catch(() => {}); }, POLL_MS);
    return () => clearInterval(id);
  }, [jobs]);

  const handleSubmitExperiment = async (
    files: FormFiles,
    modelVersion: 'v2' | 'v3',
    runMode: 'single' | 'multi',
    tags: string[],
  ) => {
    const nowDt = getNowDt();
    const makeFile = async (fs: FileState, offset: number): Promise<AscFileInput> =>
      fs.file
        ? { filename: fs.name, timestamp: calculateTimestamp(nowDt, offset), file_data: await fileToBase64(fs.file) }
        : { filename: null, timestamp: null, file_data: null };

    await createExperiment({
      run_datetime:          nowDt,
      model_version:         modelVersion,
      forecast_steps:        ALL_STEPS,
      include_preview_image: true,
      experiment_name:       null,
      experiment_tags:       tags.length > 0 ? tags : null,
      experiment_memo:       tags.length > 0 ? tags.join(', ') : null,
      input_files: {
        file_t0: await makeFile(files.t0, -30),
        file_t1: await makeFile(files.t1, -20),
        file_t2: await makeFile(files.t2, -10),
        file_t3: await makeFile(files.t3,   0),
      },
    });
    refresh();
  };

  const handleSubmitTraining = async (
    files: FormFiles,
    modelVersion: 'v2' | 'v3',
    runMode: 'single' | 'multi',
  ) => {
    const nowDt = getNowDt();
    const makeFile = async (fs: FileState, offset: number): Promise<AscFileInput> =>
      fs.file
        ? { filename: fs.name, timestamp: calculateTimestamp(nowDt, offset), file_data: await fileToBase64(fs.file) }
        : { filename: null, timestamp: null, file_data: null };

    await createTraining({
      user_name:             null,
      experiment_name:       null,
      run_datetime:          nowDt,
      model_version:         modelVersion,
      forecast_steps:        ALL_STEPS,
      include_preview_image: true,
      experiment_memo:       null,
      input_files: {
        file_t0: await makeFile(files.t0, -30),
        file_t1: await makeFile(files.t1, -20),
        file_t2: await makeFile(files.t2, -10),
        file_t3: await makeFile(files.t3,   0),
      },
    });
    refresh();
  };

  return (
    <Layout>
      {showModal && mode === 'experiment' && (
        <NewExperimentModal onClose={() => setShowModal(false)} onSubmit={handleSubmitExperiment} />
      )}
      {showModal && mode === 'training' && (
        <NewTrainingModal onClose={() => setShowModal(false)} onSubmit={handleSubmitTraining} />
      )}

      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">실험 / 학습 관리</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {mode === 'experiment'
              ? 'QPF 모델 추론 실험을 생성하고 결과를 확인합니다.'
              : '모델 학습 작업을 생성하고 실행 현황을 모니터링합니다.'}
          </p>
        </div>
        <div className="flex items-center">
          {/* 드롭다운 */}
          <div className="relative">
            <select
              value={mode}
              onChange={e => setMode(e.target.value as Mode)}
              className="appearance-none pl-3 pr-8 py-2 rounded-lg border border-gray-300 bg-white text-sm text-gray-700 font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none cursor-pointer"
            >
              <option value="experiment">실험</option>
              <option value="training">학습</option>
            </select>
            <svg
              className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400"
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
          {/* 새 작업 버튼 (드롭다운 우측 10px) */}
          <button
            onClick={() => setShowModal(true)}
            style={{ marginLeft: '10px' }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition shadow-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            {mode === 'experiment' ? '새 실험 진행' : '새 학습 진행'}
          </button>
        </div>
      </div>

      {/* 컨텐츠 */}
      {mode === 'experiment' ? (
        <ExperimentContent jobs={jobs} loading={loading} />
      ) : (
        <TrainingContent jobs={jobs} loading={loading} onRefresh={refresh} />
      )}
    </Layout>
  );
}
