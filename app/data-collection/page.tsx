'use client';

import { useEffect, useState } from 'react';
import Layout from '@/lib/Layout';
import {
  deleteTrainingDatasetGroups,
  downloadTrainingDatasetUrl,
  getDataCollectionInfo,
  makeTrainingDataset,
  type DataCollectionDatasetGroup,
  type DataCollectionInfo,
  type DataCollectionPipelineResult,
  type DataCollectionScriptResult,
} from '@/lib/api';
import { getCurrentUsername } from '@/lib/account';

type StepState = 'IDLE' | 'RUNNING' | 'DONE' | 'WARNING' | 'FAILED';
type ActiveTab = 'STATUS' | 'MANAGEMENT';

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

function ExecutionFeedback({
  state,
  result,
  error,
  expectedCount,
}: {
  state: StepState;
  result: DataCollectionPipelineResult | null;
  error: string | null;
  expectedCount: number;
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
    <div className="flex h-full flex-col rounded-lg border border-gray-200 bg-gray-50">
      <div className="border-b border-gray-200 px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">이번 변환 결과</p>
        <p className="mt-1 break-all font-mono text-xs text-gray-700">{outputDir ?? '출력 폴더 확인 중'}</p>
      </div>
      <div className="flex flex-1 flex-col px-4 py-3">
        <div className="mb-3 flex items-center justify-between">
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
          <div className="overflow-hidden rounded border border-gray-200 bg-white">
            {files.map(file => (
              <p key={file} className="break-all border-b border-gray-100 px-3 py-2 font-mono text-[11px] text-gray-600 last:border-b-0">
                {file}
              </p>
            ))}
          </div>
        )}
        {result?.run_id && (
          <p className="mt-2 break-all font-mono text-[11px] text-gray-400">{result.run_id}</p>
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
  deleting = false,
}: {
  path?: string;
  groups: DataCollectionDatasetGroup[];
  selectedGroupIds: string[];
  expandedGroupIds: string[];
  onToggleSelected: (groupId: string) => void;
  onToggleExpanded: (groupId: string) => void;
  onDownload: () => void;
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
                        {group.created_by ?? '-'}
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
  const [intervalMinutes, setIntervalMinutes] = useState(5);
  const [inputTimes, setInputTimes] = useState<string[]>(generateInputTimes('2022-08-09T10:20', 5));
  const [collectAnswerData, setCollectAnswerData] = useState(true);
  const [pipelineResult, setPipelineResult] = useState<DataCollectionPipelineResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [expandedGroupIds, setExpandedGroupIds] = useState<string[]>([]);
  const [deletingAsc, setDeletingAsc] = useState(false);

  useEffect(() => {
    getDataCollectionInfo()
      .then(setInfo)
      .catch(err => setError(err instanceof Error ? err.message : '데이터 수집 설정을 불러오지 못했습니다.'));
  }, []);

  useEffect(() => {
    setInputTimes(generateInputTimes(targetInput, intervalMinutes));
  }, [targetInput, intervalMinutes]);

  useEffect(() => {
    const groupIds = new Set((info?.training_dataset_groups ?? []).map(group => group.id));
    setSelectedGroupIds(prev => prev.filter(groupId => groupIds.has(groupId)));
    setExpandedGroupIds(prev => prev.filter(groupId => groupIds.has(groupId)));
  }, [info]);

  async function refreshInfo() {
    const next = await getDataCollectionInfo();
    setInfo(next);
  }

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
    setState('RUNNING');

    try {
      const result = await makeTrainingDataset({
        target_datetimes: inputTimes,
        interval_minutes: intervalMinutes,
        frame_count: inputTimes.length,
        dataset_name: datasetName.trim(),
        created_by: getCurrentUsername(),
        collect_answer_data: collectAnswerData,
      });
      setPipelineResult(result);
      setActiveTab('STATUS');
      setState(result.status === 'FAILED' ? 'FAILED' : result.file_count === 0 ? 'WARNING' : 'DONE');
      await refreshInfo();
    } catch (err) {
      setState('FAILED');
      setError(err instanceof Error ? err.message : '학습데이터 만들기에 실패했습니다.');
    }
  }

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
              { key: 'STATUS' as ActiveTab, label: '현황' },
              { key: 'MANAGEMENT' as ActiveTab, label: '학습관리' },
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
                  <label className="mb-1.5 block text-xs font-semibold text-gray-500">기준 시간</label>
                  <input
                    type="datetime-local"
                    value={targetInput}
                    onChange={event => setTargetInput(event.target.value)}
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-gray-500">분 간격</label>
                  <input
                    type="number"
                    min={5}
                    step={5}
                    value={intervalMinutes}
                    onChange={event => setIntervalMinutes(Math.max(5, Number(event.target.value) || 5))}
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
                  기준 시간부터 {intervalMinutes}분 간격으로 계산한 4개 입력 파일을 받아 ASC로 변환합니다.
                </p>
              </div>

              <label className="mt-4 flex items-start gap-2.5 rounded-lg border border-gray-200 bg-white px-3 py-2.5">
                <input
                  type="checkbox"
                  checked={collectAnswerData}
                  onChange={event => setCollectAnswerData(event.target.checked)}
                  className="mt-0.5 accent-blue-600"
                />
                <span>
                  <span className="block text-xs font-semibold text-gray-700">정답데이터도 함께 수집</span>
                  <span className="mt-0.5 block text-[11px] text-gray-400">
                    입력 4개 중 가장 최신 시각 기준 10~180분 뒤 데이터를 같은 API로 이어서 수집해 정답데이터셋으로 자동 등록합니다.
                  </span>
                </span>
              </label>
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
            <ExecutionFeedback state={state} result={pipelineResult} error={error} expectedCount={4} />
          </div>

          <div className="flex flex-col">
            <CurrentResultPanel
              result={pipelineResult}
              fallbackPath={info?.training_dataset_dir}
            />
          </div>
        </div>
        ) : (
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
              deleting={deletingAsc}
            />
          </div>
        )}
      </div>

    </Layout>
  );
}
