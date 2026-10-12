'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Layout from '@/lib/Layout';
import {
  createDataCollectionJob,
  deleteTrainingDatasetGroups,
  displayUsername,
  downloadTrainingDatasetUrl,
  getDataCollectionInfo,
  getLatestDataCollectionJob,
  uploadTrainingDataset,
  type DataCollectionDatasetGroup,
  type DataCollectionInfo,
  type DataCollectionJob,
  type AnswerOffsetResult,
  type CollectAnswerDataResult,
  type DataCollectionPipelineResult,
  type DataCollectionScriptResult,
} from '@/lib/api';
import { getCurrentUsername } from '@/lib/account';
import AnswerDatasetsPanel from './AnswerDatasetsPanel';

type StepState = 'IDLE' | 'RUNNING' | 'DONE' | 'WARNING' | 'FAILED';
type ActiveTab = 'STATUS' | 'MANAGEMENT' | 'ANSWER';

function StatusBadge({ state }: { state: StepState }) {
  const cls =
    state === 'RUNNING' ? 'bg-emerald-50 text-emerald-700' :
    state === 'DONE' ? 'bg-blue-50 text-blue-700' :
    state === 'WARNING' ? 'bg-amber-50 text-amber-700' :
    state === 'FAILED' ? 'bg-red-50 text-red-700' :
    'bg-gray-100 text-gray-500';
  const label =
    state === 'RUNNING' ? '실행 중' :
    state === 'DONE' ? '완료' :
    state === 'WARNING' ? '확인 필요' :
    state === 'FAILED' ? '실패' :
    '대기';

  return <span className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${cls}`}>{label}</span>;
}

function AnswerDataFeedback({ state, result }: { state: StepState; result: CollectAnswerDataResult | null }) {
  if (state === 'IDLE') return null;
  if (state === 'RUNNING') {
    return (
      <div className="mt-2 flex items-center gap-2 text-xs font-medium text-emerald-700">
        <span className="h-3 w-3 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
        정답데이터 수집 중...
      </div>
    );
  }
  if (!result) return null;
  if (state === 'FAILED') {
    return <p className="mt-2 text-xs text-red-600">정답데이터 수집 실패: {result.message}</p>;
  }
  return (
    <p className="mt-2 text-xs font-medium text-emerald-700">
      정답데이터셋 등록됨: {result.answer_dataset_name} ({result.answer_file_count}개 파일)
    </p>
  );
}

function ExecutionFeedback({
  state,
  result,
  error,
  expectedCount,
  answerState,
  answerResult,
}: {
  state: StepState;
  result: DataCollectionPipelineResult | null;
  error: string | null;
  expectedCount: number;
  answerState: StepState;
  answerResult: CollectAnswerDataResult | null;
}) {
  if (state === 'RUNNING') {
    return (
      <div className="mt-4 flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
        <span className="h-4 w-4 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
        공공데이터 수집 후 ASC 변환을 실행하는 중입니다.
      </div>
    );
  }

  if (error) {
    return (
      <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
        {error}
      </div>
    );
  }

  if (!result) return null;

  const isFailed = result.status === 'FAILED';
  const isEmpty = result.status !== 'FAILED' && result.file_count === 0;
  const isPartial = !isFailed && !isEmpty && result.file_count < expectedCount;
  const tone = isFailed ? 'red' : isEmpty || isPartial ? 'amber' : 'blue';
  const title = isFailed ? '학습데이터 만들기 실패' : isEmpty ? 'ASC 파일이 생성되지 않았습니다' : result.message;
  const message = isFailed
    ? result.convert.message || result.collect.message
    : isEmpty
      ? '수집은 끝났지만 변환 결과 폴더에 ASC 파일이 없습니다. 변환 스크립트 로그를 확인하세요.'
      : isPartial
        ? `요청한 ${expectedCount}개 중 ${result.file_count}개만 수집됐어요. 나머지는 공공API에서 데이터를 받지 못했습니다 — 이 묶음은 4개가 안 돼서 테스트케이스 입력으로 못 씁니다.`
        : `ASC 파일 ${result.file_count}개`;

  return (
    <div
      className={`mt-4 rounded-lg border px-4 py-3 ${
        tone === 'red' ? 'border-red-200 bg-red-50' :
        tone === 'amber' ? 'border-amber-200 bg-amber-50' :
        'border-blue-200 bg-blue-50'
      }`}
    >
      <p
        className={`text-sm font-semibold ${
          tone === 'red' ? 'text-red-700' :
          tone === 'amber' ? 'text-amber-700' :
          'text-blue-700'
        }`}
      >
        {title}
      </p>
      {(isFailed || isEmpty || isPartial) && (
        <p className={`mt-1 text-xs ${tone === 'red' ? 'text-red-600' : 'text-amber-700'}`}>
          {message}
        </p>
      )}
      {!isFailed && !isEmpty && <AnswerDataFeedback state={answerState} result={answerResult} />}
    </div>
  );
}

function formatCompactTarget(value: string): string {
  if (!/^\d{12}$/.test(value)) return value;
  return `${value.slice(0, 4)}.${value.slice(4, 6)}.${value.slice(6, 8)} ${value.slice(8, 10)}:${value.slice(10, 12)}`;
}

function CurrentResultPanel({
  result,
  fallbackPath,
}: {
  result: DataCollectionPipelineResult | null;
  fallbackPath?: string;
}) {
  const files = result?.convert.files ?? [];
  const outputDir = result?.convert.output_dir || fallbackPath;

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col rounded-lg border border-gray-200 bg-gray-50">
      <div className="flex-shrink-0 border-b border-gray-200 px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">이번 변환 결과</p>
        <p className="mt-1 break-all font-mono text-xs text-gray-700">{outputDir ?? '출력 폴더 확인 중'}</p>
      </div>
      <div className="flex min-h-0 flex-1 flex-col px-4 py-3">
        <div className="mb-3 flex flex-shrink-0 items-center justify-between">
          <span className="text-xs font-medium text-gray-500">ASC 파일</span>
          <span className="rounded bg-white px-2 py-0.5 text-xs font-semibold text-gray-700 ring-1 ring-gray-200">
            {files.length}개
          </span>
        </div>
        {files.length === 0 ? (
          <div className="flex min-h-0 flex-1 items-center justify-center rounded border border-dashed border-gray-200 bg-white text-xs text-gray-400">
            실행 후 생성된 ASC 파일이 여기에 표시됩니다.
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto rounded border border-gray-200 bg-white">
            {files.map(file => (
              <p key={file} className="break-all border-b border-gray-100 px-3 py-2 font-mono text-[11px] text-gray-600 last:border-b-0">
                {file}
              </p>
            ))}
          </div>
        )}
        {result?.run_id && (
          <p className="mt-2 flex-shrink-0 break-all font-mono text-[11px] text-gray-400">{result.run_id}</p>
        )}
      </div>
    </div>
  );
}

function AnswerResultPanel({ result }: { result: CollectAnswerDataResult | null }) {
  const files = result?.files ?? [];
  const outputDir = result?.output_dir;
  const missing = (result?.offset_results ?? []).filter(o => o.status !== 'COMPLETED');

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col rounded-lg border border-gray-200 bg-gray-50">
      <div className="flex-shrink-0 border-b border-gray-200 px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">정답데이터 수집 결과</p>
        <p className="mt-1 break-all font-mono text-xs text-gray-700">{outputDir ?? '수집 후 표시됩니다'}</p>
      </div>
      <div className="flex min-h-0 flex-1 flex-col px-4 py-3">
        <div className="mb-3 flex flex-shrink-0 items-center justify-between">
          <span className="text-xs font-medium text-gray-500">ASC 파일</span>
          <span className="rounded bg-white px-2 py-0.5 text-xs font-semibold text-gray-700 ring-1 ring-gray-200">
            {files.length}개
          </span>
        </div>
        {files.length === 0 ? (
          <div className="flex min-h-0 flex-1 items-center justify-center rounded border border-dashed border-gray-200 bg-white text-xs text-gray-400">
            정답데이터 수집 후 생성된 ASC 파일이 여기에 표시됩니다.
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto rounded border border-gray-200 bg-white">
            {files.map(file => (
              <p key={file} className="break-all border-b border-gray-100 px-3 py-2 font-mono text-[11px] text-gray-600 last:border-b-0">
                {file}
              </p>
            ))}
          </div>
        )}
        {missing.length > 0 && (
          <div className="mt-3 flex-shrink-0 rounded border border-red-200 bg-red-50 px-3 py-2">
            <p className="text-xs font-semibold text-red-700">수집 실패한 선행시간 ({missing.length}개)</p>
            <p className="mt-1 text-[11px] text-red-600">
              {missing.map((o: AnswerOffsetResult) => `${o.offset_minutes}분`).join(', ')}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function TrainingDatasetUploadModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const backdropRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadDone, setUploadDone] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleFiles = (fileList: FileList | null) => {
    if (!fileList) return;
    setFiles(Array.from(fileList).filter(file => file.name.toLowerCase().endsWith('.asc')));
  };

  const isFileCountValid = files.length === 4;
  const fileCountColor = files.length === 0 ? 'text-gray-400' : isFileCountValid ? 'text-emerald-600' : 'text-amber-600';

  const handleSubmit = async () => {
    if (!name.trim()) { setUploadError('학습 제목을 입력해주세요.'); return; }
    if (!isFileCountValid) { setUploadError(`입력 데이터는 4개 파일이 필요합니다. (현재 ${files.length}개)`); return; }
    setUploading(true);
    setUploadError(null);
    try {
      await uploadTrainingDataset({ datasetName: name.trim(), createdBy: getCurrentUsername(), files });
      setUploadDone(true);
      onDone();
      setTimeout(onClose, 800);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : '업로드에 실패했습니다.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onMouseDown={e => { if (e.target === backdropRef.current) onClose(); }}
    >
      <div className="w-full max-w-lg mx-4 rounded-xl bg-white shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <h3 className="text-base font-semibold text-gray-900">입력데이터 업로드</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
              <path d="M2 2l12 12M14 2L2 14" />
            </svg>
          </button>
        </div>

        {uploadDone ? (
          <div className="px-6 py-8 text-center">
            <svg className="mx-auto h-10 w-10 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            <p className="mt-2 text-sm font-semibold text-gray-700">업로드 완료</p>
          </div>
        ) : (
          <>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">학습 제목 <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="예: 2022-08-09 강우 학습데이터"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">ASC 파일 <span className="text-red-500">*</span></label>
                <div
                  onDragOver={e => e.preventDefault()}
                  onDrop={e => { e.preventDefault(); handleFiles(e.dataTransfer.files); }}
                  onClick={() => fileInputRef.current?.click()}
                  className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 px-6 py-6 text-center transition hover:border-blue-400 hover:bg-blue-50"
                >
                  <p className="text-sm text-gray-600">클릭하거나 파일을 끌어다 놓으세요</p>
                  <p className="mt-1 text-xs text-gray-400">.asc 파일 4개 (T0~T3) 동시 선택</p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept=".asc"
                    onChange={e => handleFiles(e.target.files)}
                    className="hidden"
                  />
                </div>
                {files.length > 0 && (
                  <p className={`mt-2 text-xs font-semibold ${fileCountColor}`}>{files.length} / 4 파일</p>
                )}
                {files.length > 0 && !isFileCountValid && (
                  <p className="mt-1 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
                    입력 데이터는 4개 파일이 필요합니다. 현재 {files.length}개 선택됨.
                  </p>
                )}
              </div>

              {uploadError && (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{uploadError}</p>
              )}
            </div>

            <div className="flex justify-end gap-2 border-t border-gray-100 px-6 py-4">
              <button onClick={onClose} className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">취소</button>
              <button
                onClick={handleSubmit}
                disabled={uploading || !isFileCountValid || !name.trim()}
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-40"
              >
                {uploading && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                {uploading ? '업로드 중...' : '업로드'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function TrainingDatasetManagementPanel({
  path,
  groups,
  selectedGroupIds,
  expandedGroupIds,
  onToggleSelected,
  onToggleExpanded,
  onDownload,
  onDelete,
  onUploadClick,
  deleting = false,
}: {
  path?: string;
  groups: DataCollectionDatasetGroup[];
  selectedGroupIds: string[];
  expandedGroupIds: string[];
  onToggleSelected: (groupId: string) => void;
  onToggleExpanded: (groupId: string) => void;
  onDownload: () => void;
  onUploadClick: () => void;
  onDelete: () => void;
  deleting?: boolean;
}) {
  const totalFiles = groups.reduce((sum, group) => sum + group.file_count, 0);
  const selectedCount = groups
    .filter(group => selectedGroupIds.includes(group.id))
    .reduce((sum, group) => sum + group.file_count, 0);

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50">
      <div className="flex items-center justify-between gap-4 border-b border-gray-200 px-4 py-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">학습데이터 관리</p>
          <p className="mt-1 break-all font-mono text-xs text-gray-700">{path ?? '폴더 확인 중'}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded bg-white px-2 py-1 text-xs font-semibold text-gray-700 ring-1 ring-gray-200">
            {totalFiles.toLocaleString()}개
          </span>
          <button
            onClick={onUploadClick}
            className="rounded border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-50"
          >
            업로드
          </button>
          <button
            onClick={onDownload}
            disabled={selectedCount === 0}
            className="rounded bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            선택 다운로드
          </button>
          <button
            onClick={onDelete}
            disabled={deleting || selectedCount === 0}
            className="rounded border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {deleting ? '삭제 중' : '삭제'}
          </button>
        </div>
      </div>
      <div className="px-4 py-3">
        {groups.length === 0 ? (
          <div className="flex h-28 items-center justify-center rounded border border-dashed border-gray-200 bg-white text-xs text-gray-400">
            저장된 학습데이터가 없습니다.
          </div>
        ) : (
          <div className="max-h-[520px] overflow-auto rounded border border-gray-200 bg-white">
            {groups.map(group => {
              const expanded = expandedGroupIds.includes(group.id);
              const selected = selectedGroupIds.includes(group.id);
              const targets = group.target_datetimes ?? [];
              return (
                <div key={group.id} className="border-b border-gray-100 last:border-b-0">
                  <div className="grid gap-3 px-3 py-3 md:grid-cols-[auto_minmax(0,1fr)_auto] md:items-center">
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => onToggleSelected(group.id)}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <button
                      onClick={() => onToggleExpanded(group.id)}
                      className="min-w-0 flex-1 text-left"
                      title={group.path}
                    >
                      <p className="truncate text-sm font-semibold text-gray-800">
                        {group.dataset_name || group.name}
                      </p>
                      <p className="mt-1 text-[11px] text-gray-400">
                        {displayUsername(group.created_by, group.created_by_nickname)}
                        {group.created_at ? ` · ${new Date(group.created_at).toLocaleString('ko-KR')}` : ''}
                        {group.interval_minutes ? ` · ${group.interval_minutes}분 간격` : ''}
                        {targets.length ? ` · ${formatCompactTarget(targets[0])} ~ ${formatCompactTarget(targets[targets.length - 1])}` : ''}
                      </p>
                      <p className="mt-1 truncate font-mono text-[11px] text-gray-400">{group.id}</p>
                    </button>
                    <button
                      onClick={() => onToggleExpanded(group.id)}
                      className="flex h-8 w-8 items-center justify-center rounded text-gray-400 transition-colors hover:bg-gray-50 hover:text-gray-700"
                      aria-label={expanded ? '접기' : '펼치기'}
                      title={expanded ? '접기' : '펼치기'}
                    >
                      <svg
                        viewBox="0 0 16 16"
                        className={`h-4 w-4 transition-transform ${expanded ? 'rotate-180' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M4 6l4 4 4-4" />
                      </svg>
                    </button>
                  </div>
                  {expanded && (
                    <div className="border-t border-gray-100 bg-gray-50 px-3 py-2">
                      <p className="mb-1 break-all font-mono text-[11px] text-gray-400">{group.path}</p>
                      {group.files.map(file => (
                        <p key={file} className="break-all py-0.5 font-mono text-[11px] text-gray-500">
                          {file}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function toDatetimeLocal(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

// 입력 4개 중 가장 최신 시각 기준 interval분 간격으로, 180분 뒤까지 정답데이터 수집 대상 시각을 미리 계산한다.
// 백엔드(data_collection_service.py의 collect_answer_data)와 정확히 같은 그리드로 계산해야 미리보기가 실제 결과랑 맞는다.
function generateAnswerTimes(latestInputTime: string, interval: number): string[] {
  const baseDate = new Date(latestInputTime);
  if (Number.isNaN(baseDate.getTime())) return [];

  const steps: string[] = [];
  for (let minutes = interval; minutes <= 180; minutes += interval) {
    steps.push(toDatetimeLocal(new Date(baseDate.getTime() + minutes * 60_000)));
  }
  return steps;
}

function generateInputTimes(base: string, interval: number): string[] {
  const baseDate = new Date(base);
  if (Number.isNaN(baseDate.getTime())) return [];

  return [0, 1, 2, 3].map(index => {
    const next = new Date(baseDate.getTime() + index * interval * 60_000);
    return toDatetimeLocal(next);
  });
}

function formatTargetLabel(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export default function DataCollectionPage() {
  const [info, setInfo] = useState<DataCollectionInfo | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>('STATUS');
  const [state, setState] = useState<StepState>('IDLE');
  const [datasetName, setDatasetName] = useState('');
  const [datasetNameTouched, setDatasetNameTouched] = useState(false);
  const [targetInput, setTargetInput] = useState('2022-08-09T10:20');
  // 빈 입력을 허용하려고 문자열로 관리 — 실제 계산엔 effectiveInterval(기본값 5)을 쓴다.
  const [intervalMinutesInput, setIntervalMinutesInput] = useState('');
  const effectiveInterval = Math.max(5, Number(intervalMinutesInput) || 5);
  const [inputTimes, setInputTimes] = useState<string[]>(generateInputTimes('2022-08-09T10:20', 5));
  const [collectAnswerDataEnabled, setCollectAnswerDataEnabled] = useState(false);
  const [showAnswerTimes, setShowAnswerTimes] = useState(true);
  const [answerTargetInput, setAnswerTargetInput] = useState('2022-08-09T10:20');
  const [answerTargetTouched, setAnswerTargetTouched] = useState(false);
  const [answerIntervalMinutesInput, setAnswerIntervalMinutesInput] = useState('');
  const effectiveAnswerInterval = Math.max(10, Math.round((Number(answerIntervalMinutesInput) || 10) / 10) * 10);
  const [answerState, setAnswerState] = useState<StepState>('IDLE');
  const [answerResult, setAnswerResult] = useState<CollectAnswerDataResult | null>(null);
  const [pipelineResult, setPipelineResult] = useState<DataCollectionPipelineResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [expandedGroupIds, setExpandedGroupIds] = useState<string[]>([]);
  const [deletingAsc, setDeletingAsc] = useState(false);
  const [showUploadTraining, setShowUploadTraining] = useState(false);

  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const appliedTerminalJobIdRef = useRef<number | null>(null);
  const isInitialPollRef = useRef(true);

  useEffect(() => {
    getDataCollectionInfo()
      .then(setInfo)
      .catch(err => setError(err instanceof Error ? err.message : '데이터 수집 설정을 불러오지 못했습니다.'));
  }, []);

  useEffect(() => {
    setInputTimes(generateInputTimes(targetInput, effectiveInterval));
  }, [targetInput, effectiveInterval]);

  // 정답데이터 기준 시간은 독립적으로 고를 수 있지만, 사용자가 직접 건드리기 전까지는
  // 입력데이터의 마지막(4번째) 프레임 시각을 따라간다 — 채점(coverage check)이 그 시각 기준으로
  // 정답데이터를 찾기 때문에, 기본값이 안 맞으면 수집은 성공해도 실험에서 "정답데이터 없음"이 뜬다.
  useEffect(() => {
    if (answerTargetTouched) return;
    const lastInputTime = inputTimes[inputTimes.length - 1];
    if (lastInputTime) setAnswerTargetInput(lastInputTime);
  }, [inputTimes, answerTargetTouched]);

  useEffect(() => {
    const groupIds = new Set((info?.training_dataset_groups ?? []).map(group => group.id));
    setSelectedGroupIds(prev => prev.filter(groupId => groupIds.has(groupId)));
    setExpandedGroupIds(prev => prev.filter(groupId => groupIds.has(groupId)));
  }, [info]);

  async function refreshInfo() {
    const next = await getDataCollectionInfo();
    setInfo(next);
  }

  // 진행상황을 DB(job)에서 읽어와 반영 — 이 브라우저에서 시작한 작업이 아니어도,
  // 실행 중일 때는 메뉴를 이동했다가 돌아와도 항상 같은 결과가 보인다.
  // 다만 이미 끝난(완료/실패) 작업은 페이지에 처음 들어왔을 때는 반영하지 않는다 — 예전에
  // 누가 돌린 결과가 방문할 때마다 계속 남아있으면 지금 막 돌린 것처럼 헷갈리기 쉽다. 지난 작업은
  // "데이터 관리" 탭에서 계속 확인할 수 있으니, 여기 현황 화면은 방문 시점 기준으로 깨끗하게 시작하고
  // 실행 중이던 작업이 눈앞에서 끝나는 경우에만 그 결과를 이어서 보여준다.
  const applyJobToState = useCallback((job: DataCollectionJob | null) => {
    const isFirstPoll = isInitialPollRef.current;
    isInitialPollRef.current = false;
    if (!job) return;

    const isTerminal = job.status !== 'QUEUED' && job.status !== 'RUNNING';
    if (isFirstPoll && isTerminal) return;

    const inputResult = job.result?.input ?? null;
    const answerResult = job.result?.answer ?? null;
    if (inputResult) setPipelineResult(inputResult);

    if (job.status === 'QUEUED' || job.status === 'RUNNING') {
      setState('RUNNING');
      setAnswerState(job.stage === 'ANSWER_COLLECTING' ? 'RUNNING' : 'IDLE');
      return;
    }

    if (job.status === 'FAILED' && !inputResult) {
      setState('FAILED');
      setError(job.error_message || '학습데이터 만들기에 실패했습니다.');
    } else if (inputResult) {
      setState(inputResult.status === 'FAILED' ? 'FAILED' : inputResult.file_count === 0 ? 'WARNING' : 'DONE');
    }

    if (answerResult) {
      setAnswerResult(answerResult);
      setAnswerState(answerResult.status === 'FAILED' ? 'FAILED' : 'DONE');
    }

    if (appliedTerminalJobIdRef.current !== job.id) {
      appliedTerminalJobIdRef.current = job.id;
      refreshInfo().catch(() => {});
    }
  }, []);

  const pollLatestJob = useCallback(async () => {
    if (pollTimerRef.current) {
      clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    try {
      const job = await getLatestDataCollectionJob();
      applyJobToState(job);
      if (job && (job.status === 'QUEUED' || job.status === 'RUNNING')) {
        pollTimerRef.current = setTimeout(pollLatestJob, 2000);
      }
    } catch {
      pollTimerRef.current = setTimeout(pollLatestJob, 3000);
    }
  }, [applyJobToState]);

  useEffect(() => {
    pollLatestJob();
    return () => {
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    };
  }, [pollLatestJob]);

  async function handleMakeTrainingDataset() {
    if (!datasetName.trim()) {
      setDatasetNameTouched(true);
      setError('학습 제목을 입력하세요.');
      return;
    }
    if (inputTimes.length !== 4) {
      setError('실험 입력 시간은 4개가 필요합니다.');
      return;
    }

    setError(null);
    setPipelineResult(null);
    setAnswerResult(null);
    setAnswerState('IDLE');
    setState('RUNNING');

    try {
      await createDataCollectionJob({
        target_datetimes: inputTimes,
        interval_minutes: effectiveInterval,
        dataset_name: datasetName.trim(),
        created_by: getCurrentUsername(),
        collect_answer_data: collectAnswerDataEnabled,
        answer_interval_minutes: effectiveAnswerInterval,
        answer_target_datetimes: collectAnswerDataEnabled ? [answerTargetInput] : [],
      });
      setActiveTab('STATUS');
      pollLatestJob();
    } catch (err) {
      setState('FAILED');
      setError(err instanceof Error ? err.message : '학습데이터 만들기에 실패했습니다.');
    }
  }

  const answerTimes = collectAnswerDataEnabled
    ? generateAnswerTimes(answerTargetInput, effectiveAnswerInterval)
    : [];

  const ascGroups = (info?.training_dataset_groups ?? []).filter(group => group.id !== '__root__');
  const canRun = inputTimes.length === 4 && info?.collector_command_configured !== false && info?.converter_command_configured !== false;
  const showDatasetNameError = datasetNameTouched && !datasetName.trim();

  function handleDownloadAscZip() {
    if (selectedGroupIds.length === 0) {
      setError('다운로드할 실행 묶음을 선택하세요.');
      return;
    }

    const link = document.createElement('a');
    link.href = downloadTrainingDatasetUrl(selectedGroupIds);
    link.download = 'training_dataset_asc.zip';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  async function handleDeleteAscGroups() {
    const deletable = selectedGroupIds.filter(groupId => groupId !== '__root__');
    if (deletable.length === 0) {
      setError('삭제할 ASC 실행 묶음을 선택하세요.');
      return;
    }
    if (!window.confirm(`선택한 학습데이터 ${deletable.length}개를 삭제할까요? 연결된 원본 수집 폴더도 함께 삭제됩니다.`)) return;

    setDeletingAsc(true);
    setError(null);
    try {
      await deleteTrainingDatasetGroups(deletable);
      setSelectedGroupIds(prev => prev.filter(groupId => !deletable.includes(groupId)));
      setExpandedGroupIds(prev => prev.filter(groupId => !deletable.includes(groupId)));
      await refreshInfo();
    } catch (err) {
      setError(err instanceof Error ? err.message : '학습데이터 삭제에 실패했습니다.');
    } finally {
      setDeletingAsc(false);
    }
  }

  function toggleSelectedGroup(groupId: string) {
    setSelectedGroupIds(prev =>
      prev.includes(groupId) ? prev.filter(item => item !== groupId) : [...prev, groupId],
    );
  }

  function toggleExpandedGroup(groupId: string) {
    setExpandedGroupIds(prev =>
      prev.includes(groupId) ? prev.filter(item => item !== groupId) : [...prev, groupId],
    );
  }

  return (
    <>
    {showUploadTraining && (
      <TrainingDatasetUploadModal
        onClose={() => setShowUploadTraining(false)}
        onDone={refreshInfo}
      />
    )}
    <Layout>
      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </div>
      )}

      <div className="space-y-5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            {[
              { key: 'STATUS' as ActiveTab, label: '데이터수집' },
              { key: 'MANAGEMENT' as ActiveTab, label: '입력데이터 관리' },
              { key: 'ANSWER' as ActiveTab, label: '정답데이터 관리' },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
                  activeTab === tab.key
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <StatusBadge state={state} />
        </div>

        {activeTab === 'STATUS' ? (
        <div className="grid items-stretch gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
          <div className="flex flex-col">
            <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-4">
              <div className="mb-4">
                <label className="mb-1.5 block text-xs font-semibold text-gray-500">학습 제목</label>
                <input
                  type="text"
                  value={datasetName}
                  onBlur={() => setDatasetNameTouched(true)}
                  onChange={event => {
                    setDatasetName(event.target.value);
                    if (event.target.value.trim()) {
                      setDatasetNameTouched(false);
                      if (error === '학습 제목을 입력하세요.') setError(null);
                    }
                  }}
                  placeholder="예: 강우 학습데이터"
                  className={`w-full rounded-lg border bg-white px-3 py-2 text-sm font-medium text-gray-700 outline-none transition ${
                    showDatasetNameError
                      ? 'border-red-300 focus:border-red-400 focus:ring-2 focus:ring-red-100'
                      : 'border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100'
                  }`}
                />
                {showDatasetNameError ? (
                  <p className="mt-1 text-[11px] font-medium text-red-600">학습 제목을 입력하세요.</p>
                ) : (
                  <p className="mt-1 text-[11px] text-gray-400">
                    저장 폴더는 번호와 짧은 해시가 앞에 붙은 제목으로 생성됩니다.
                  </p>
                )}
              </div>
              <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_160px]">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-gray-500">
                    기준 시간 <span className="font-normal text-gray-400">(입력데이터)</span>
                  </label>
                  <input
                    type="datetime-local"
                    value={targetInput}
                    onChange={event => setTargetInput(event.target.value)}
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-gray-500">
                    분 간격 <span className="font-normal text-gray-400">(5분간격)</span>
                  </label>
                  <input
                    type="number"
                    min={5}
                    step={5}
                    value={intervalMinutesInput}
                    onChange={event => setIntervalMinutesInput(event.target.value)}
                    onBlur={() => {
                      if (intervalMinutesInput && Number(intervalMinutesInput) < 5) {
                        setIntervalMinutesInput('5');
                      }
                    }}
                    placeholder="5"
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                  />
                </div>
              </div>

              <div className="mt-4">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-500">실험 입력 시간</span>
                  <span className="rounded bg-white px-2 py-0.5 text-xs font-semibold text-gray-700 ring-1 ring-gray-200">
                    {inputTimes.length}개
                  </span>
                </div>
                {inputTimes.length === 0 ? (
                  <div className="rounded border border-dashed border-gray-200 bg-white px-3 py-3 text-xs text-gray-400">
                    추가된 입력 시간이 없습니다.
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {inputTimes.map(value => (
                      <span
                        key={value}
                        className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700"
                      >
                        {formatTargetLabel(value)}
                      </span>
                    ))}
                  </div>
                )}
                <p className="mt-2 text-xs text-gray-400">
                  기준 시간부터 {effectiveInterval}분 간격으로 계산한 4개 입력 파일을 받아 ASC로 변환합니다.
                </p>
              </div>

              <label className="mt-4 flex items-start gap-2.5 rounded-lg border border-gray-200 bg-white px-3 py-2.5">
                <input
                  type="checkbox"
                  checked={collectAnswerDataEnabled}
                  onChange={event => setCollectAnswerDataEnabled(event.target.checked)}
                  className="mt-0.5 accent-blue-600"
                />
                <span>
                  <span className="block text-xs font-semibold text-gray-700">정답데이터도 함께 수집</span>
                  <span className="mt-0.5 block text-[11px] text-gray-400">
                    아래에서 직접 고른 기준 시간부터 10~180분 뒤 데이터를 같은 API로 이어서 수집해 정답데이터셋으로 자동 등록합니다.
                  </span>
                </span>
              </label>

              {collectAnswerDataEnabled && (
                <>
                <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_160px]">
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-gray-500">
                      기준 시간 <span className="font-normal text-gray-400">(정답데이터)</span>
                    </label>
                    <input
                      type="datetime-local"
                      value={answerTargetInput}
                      onChange={event => {
                        setAnswerTargetTouched(true);
                        setAnswerTargetInput(event.target.value);
                      }}
                      className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                    />
                    <p className="mt-1 text-[11px] text-gray-400">
                      기본값은 입력데이터 마지막 프레임 시각과 같습니다. 실험에서 이 입력데이터로 채점하려면 값을 바꾸지 마세요.
                    </p>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-gray-500">
                      정답데이터 분 간격 <span className="font-normal text-gray-400">(10분 단위)</span>
                    </label>
                    <input
                      type="number"
                      min={10}
                      step={10}
                      value={answerIntervalMinutesInput}
                      onChange={event => setAnswerIntervalMinutesInput(event.target.value)}
                      onBlur={() => {
                        if (answerIntervalMinutesInput && Number(answerIntervalMinutesInput) < 10) {
                          setAnswerIntervalMinutesInput('10');
                        }
                      }}
                      placeholder="10"
                      className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                    />
                  </div>
                </div>

                <div className="mt-4">
                  <div className="flex items-center justify-between gap-3 rounded border border-dashed border-gray-200 bg-white px-3 py-2.5">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-gray-500">정답데이터 수집 시간</p>
                      {answerTimes.length === 0 ? (
                        <p className="mt-0.5 text-xs text-gray-400">실험 입력 시간을 먼저 확인하세요.</p>
                      ) : (
                        <p className="mt-0.5 truncate text-xs text-gray-600">
                          {formatTargetLabel(answerTimes[0])} ~ {formatTargetLabel(answerTimes[answerTimes.length - 1])}
                          <span className="ml-1.5 text-gray-400">· {answerTimes.length}개 · {effectiveAnswerInterval}분 간격</span>
                        </p>
                      )}
                    </div>
                    {answerTimes.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setShowAnswerTimes(v => !v)}
                        className="flex-shrink-0 text-xs font-semibold text-blue-600 hover:underline"
                      >
                        {showAnswerTimes ? '접기' : '전체 보기'}
                      </button>
                    )}
                  </div>
                  {showAnswerTimes && answerTimes.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {answerTimes.map(value => (
                        <span
                          key={value}
                          className="rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700"
                        >
                          {formatTargetLabel(value)}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                </>
              )}
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-[1fr_auto] md:items-center">
              <div>
                <p className="text-sm font-medium text-gray-700">공공API 원본 수집 후 ASC 학습데이터를 생성합니다.</p>
                <p className="mt-1 break-all font-mono text-xs text-gray-400">
                  {info?.training_dataset_dir ?? '출력 폴더 확인 중'}
                </p>
              </div>
              <button
                onClick={handleMakeTrainingDataset}
                disabled={state === 'RUNNING' || !canRun}
                className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {state === 'RUNNING' ? '만드는 중' : '학습데이터 만들기'}
              </button>
            </div>

            {info?.collector_command_configured === false && (
              <p className="mt-3 text-xs font-medium text-amber-600">
                DATA_COLLECTOR_COMMAND가 설정되면 버튼이 활성화됩니다.
              </p>
            )}
            {info?.converter_command_configured === false && (
              <p className="mt-3 text-xs font-medium text-amber-600">
                DATA_CONVERTER_COMMAND가 설정되면 버튼이 활성화됩니다.
              </p>
            )}
            <ExecutionFeedback
              state={state}
              result={pipelineResult}
              error={error}
              expectedCount={4}
              answerState={answerState}
              answerResult={answerResult}
            />
          </div>

          <div className="flex h-full min-h-0 flex-col gap-5">
            <CurrentResultPanel
              result={pipelineResult}
              fallbackPath={info?.training_dataset_dir}
            />
            {collectAnswerDataEnabled && <AnswerResultPanel result={answerResult} />}
          </div>
        </div>
        ) : activeTab === 'MANAGEMENT' ? (
          <div>
            <TrainingDatasetManagementPanel
              path={info?.training_dataset_dir}
              groups={ascGroups}
              selectedGroupIds={selectedGroupIds}
              expandedGroupIds={expandedGroupIds}
              onToggleSelected={toggleSelectedGroup}
              onToggleExpanded={toggleExpandedGroup}
              onDownload={handleDownloadAscZip}
              onDelete={handleDeleteAscGroups}
              onUploadClick={() => setShowUploadTraining(true)}
              deleting={deletingAsc}
            />
          </div>
        ) : (
          <AnswerDatasetsPanel path={info?.answer_data_dir} />
        )}
      </div>

    </Layout>
    </>
  );
}
