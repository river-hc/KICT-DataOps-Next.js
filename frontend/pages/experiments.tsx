import { useState } from 'react';
import { useRouter } from 'next/router';
import Layout from '@/lib/Layout';
import {
  getExperiments,
  getExperimentRuns,
  createExperiment,
  fileToBase64,
  calculateTimestamp,
  Experiment,
  ExperimentRun,
} from '@/lib/api';

// ───_asc File Upload State ──────────────────────────────────

interface AscFileState {
  file: File | null;
  filename: string | null;
  timestamp: string | null;
  fileData: string | null;
}

// ─── Main Page Component ──────────────────────────────────

export default function ExperimentsPage() {
  const router = useRouter();
  const [activeView, setActiveView] = useState<'list' | 'create'>('list');

  // Experiments list state
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [loading, setLoading] = useState(false);

  // Create experiment form state
  const [runDatetime, setRunDatetime] = useState('');
  const [modelVersion, setModelVersion] = useState<'v2' | 'v3'>('v3');
  const [forecastSteps, setForecastSteps] = useState<string>('60');
  const [includePreview, setIncludePreview] = useState(true);
  const [experimentName, setExperimentName] = useState('');
  const [experimentTags, setExperimentTags] = useState('');
  const [experimentMemo, setExperimentMemo] = useState('');
  const [createLoading, setCreateLoading] = useState(false);
  const [createResult, setCreateResult] = useState<{ id: number; name: string; message: string } | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);

  // Asc file states (T0~T3)
  const [ascFileT0, setAscFileT0] = useState<AscFileState>({
    file: null,
    filename: null,
    timestamp: null,
    fileData: null,
  });
  const [ascFileT1, setAscFileT1] = useState<AscFileState>({
    file: null,
    filename: null,
    timestamp: null,
    fileData: null,
  });
  const [ascFileT2, setAscFileT2] = useState<AscFileState>({
    file: null,
    filename: null,
    timestamp: null,
    fileData: null,
  });
  const [ascFileT3, setAscFileT3] = useState<AscFileState>({
    file: null,
    filename: null,
    timestamp: null,
    fileData: null,
  });

  // ─── Load experiments ───────────────────────────────────

  const loadExperiments = async () => {
    setLoading(true);
    try {
      const data = await getExperiments();
      setExperiments(data);
    } catch (err) {
      console.error('Failed to load experiments:', err);
    } finally {
      setLoading(false);
    }
  };

  // ─── Load runs for an experiment ─────────────────────────────

  const [runs, setRuns] = useState<ExperimentRun[]>([]);
  const [runsLoading, setRunsLoading] = useState(false);
  const [expandedExperiment, setExpandedExperiment] = useState<number | null>(null);

  const loadRuns = async (experimentId: number) => {
    if (expandedExperiment === experimentId) {
      setExpandedExperiment(null);
      setRuns([]);
      return;
    }
    setExpandedExperiment(experimentId);
    setRunsLoading(true);
    try {
      const data = await getExperimentRuns(experimentId);
      setRuns(data);
    } catch (err) {
      console.error('Failed to load runs:', err);
    } finally {
      setRunsLoading(false);
    }
  };

  // ─── File Upload Handler ───────────────────────────────────

  const handleFileChange = async (
    timeLabel: 't0' | 't1' | 't2' | 't3',
    file: File | null
  ) => {
    if (!file) {
      if (timeLabel === 't0') setAscFileT0({ file: null, filename: null, timestamp: null, fileData: null });
      if (timeLabel === 't1') setAscFileT1({ file: null, filename: null, timestamp: null, fileData: null });
      if (timeLabel === 't2') setAscFileT2({ file: null, filename: null, timestamp: null, fileData: null });
      if (timeLabel === 't3') setAscFileT3({ file: null, filename: null, timestamp: null, fileData: null });
      return;
    }

    const base64 = await fileToBase64(file);
    const timestamp = calculateTimestamp(runDatetime || new Date().toISOString().replace(/[-T:]/g, '').slice(0, 12) + '00', 0);

    const newState = {
      file,
      filename: file.name,
      timestamp,
      fileData: base64,
    };

    if (timeLabel === 't0') setAscFileT0(newState);
    if (timeLabel === 't1') setAscFileT1(newState);
    if (timeLabel === 't2') setAscFileT2(newState);
    if (timeLabel === 't3') setAscFileT3(newState);
  };

  // ─── Create Experiment ───────────────────────────────────

  const handleCreateExperiment = async () => {
    if (!runDatetime) {
      setCreateError('운용시점(run_datetime)을 선택해주세요.');
      return;
    }

    setCreateError(null);
    setCreateLoading(true);

    try {
      const selectedSteps = forecastSteps
        .split(',')
        .map(s => parseInt(s.trim()))
        .filter(n => !isNaN(n) && n >= 10 && n <= 180);

      const body = {
        run_datetime: runDatetime,
        input_files: {
          file_t0: ascFileT0.file
            ? { filename: ascFileT0.filename, timestamp: ascFileT0.timestamp, file_data: ascFileT0.fileData }
            : null,
          file_t1: ascFileT1.file
            ? { filename: ascFileT1.filename, timestamp: ascFileT1.timestamp, file_data: ascFileT1.fileData }
            : null,
          file_t2: ascFileT2.file
            ? { filename: ascFileT2.filename, timestamp: ascFileT2.timestamp, file_data: ascFileT2.fileData }
            : null,
          file_t3: ascFileT3.file
            ? { filename: ascFileT3.filename, timestamp: ascFileT3.timestamp, file_data: ascFileT3.fileData }
            : null,
        },
        model_version: modelVersion,
        forecast_steps: selectedSteps.length > 0 ? selectedSteps : [60],
        include_preview_image: includePreview,
        experiment_name: experimentName || null,
        experiment_tags: experimentTags
          ? experimentTags.split(',').map(t => t.trim()).filter(Boolean).slice(0, 10)
          : null,
        experiment_memo: experimentMemo || null,
      };

      const result = await createExperiment(body);
      setCreateResult({ id: result.id, name: result.name, message: result.message || '실험이 생성되었습니다.' });

      // 폼 초기화
      setRunDatetime('');
      setExperimentName('');
      setExperimentTags('');
      setExperimentMemo('');
      setAscFileT0({ file: null, filename: null, timestamp: null, fileData: null });
      setAscFileT1({ file: null, filename: null, timestamp: null, fileData: null });
      setAscFileT2({ file: null, filename: null, timestamp: null, fileData: null });
      setAscFileT3({ file: null, filename: null, timestamp: null, fileData: null });

      // 목록 새로고침
      await loadExperiments();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : '실험 생성에 실패했습니다.');
    } finally {
      setCreateLoading(false);
    }
  };

  // ─── Render ──────────────────────────────────────────

  const statusColors: Record<string, string> = {
    RUNNING: 'bg-green-100 text-green-800',
    COMPLETED: 'bg-blue-100 text-blue-800',
    FAILED: 'bg-red-100 text-red-800',
    QUEUED: 'bg-yellow-100 text-yellow-800',
    PENDING: 'bg-gray-100 text-gray-800',
  };

  const statusColorsDark: Record<string, string> = {
    RUNNING: 'bg-green-900/30 text-green-400',
    COMPLETED: 'bg-blue-900/30 text-blue-400',
    FAILED: 'bg-red-900/30 text-red-400',
    QUEUED: 'bg-yellow-900/30 text-yellow-400',
    PENDING: 'bg-gray-800 text-gray-400',
  };

  // Forecast step options (10~180, step 10)
  const forecastStepOptions = [];
  for (let i = 10; i <= 180; i += 10) {
    forecastStepOptions.push(i);
  }

  if (activeView === 'create') {
    return (
      <Layout>
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <button
              onClick={() => setActiveView('list')}
              className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 mb-4"
            >
              ← 실험 목록
            </button>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              새 실험 생성
            </h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              ASC 파일과 실험 파라미터를 입력하여 새로운 모델 실험을 생성합니다.
            </p>
          </div>

          {/* Create Form */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
              기본 설정
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              {/* Run Datetime */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  운용시점 (Run Datetime) *
                </label>
                <input
                  type="datetime-local"
                  value={runDatetime ? runDatetime.replace(/\d{2}$/, '') : ''}
                  onChange={(e) => {
                    if (e.target.value) {
                      const d = new Date(e.target.value);
                      const pad = (n: number) => String(n).padStart(2, '0');
                      const formatted = `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}`;
                      setRunDatetime(formatted);
                    }
                  }}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                />
                {runDatetime && (
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    형식: {runDatetime}
                  </p>
                )}
              </div>

              {/* Model Version */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  모델 버전 (Model Version)
                </label>
                <select
                  value={modelVersion}
                  onChange={(e) => setModelVersion(e.target.value as 'v2' | 'v3')}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                >
                  <option value="v2">v2</option>
                  <option value="v3">v3 (기본값)</option>
                </select>
              </div>

              {/* Forecast Steps */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  예측 선행시간 (Forecast Steps, 분 단위, 쉼표 구분)
                </label>
                <input
                  type="text"
                  value={forecastSteps}
                  onChange={(e) => setForecastSteps(e.target.value)}
                  placeholder="예: 10,20,30 또는 60"
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  10~180 사이의 값, 10의 배수 (예: {forecastStepOptions.slice(0, 6).join(', ')}, ...)
                </p>
              </div>

              {/* Include Preview Image */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  PNG 미리보기 포함
                </label>
                <select
                  value={includePreview ? 'true' : 'false'}
                  onChange={(e) => setIncludePreview(e.target.value === 'true')}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                >
                  <option value="true">예 (기본값)</option>
                  <option value="false">아니오</option>
                </select>
              </div>
            </div>

            {/* Experiment Info */}
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              실험 정보
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  실험 이름 (최대 100자)
                </label>
                <input
                  type="text"
                  value={experimentName}
                  onChange={(e) => setExperimentName(e.target.value)}
                  maxLength={100}
                  placeholder="예: 2026-06-04 10:00 강우 실험"
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  실험 태그 (최대 10개, 쉼표 구분)
                </label>
                <input
                  type="text"
                  value={experimentTags}
                  onChange={(e) => setExperimentTags(e.target.value)}
                  placeholder="예: 강우, 산만, 실시간"
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                실험 메모 (최대 1000자)
              </label>
              <textarea
                value={experimentMemo}
                onChange={(e) => setExperimentMemo(e.target.value)}
                maxLength={1000}
                rows={3}
                placeholder="실험에 대한 상세 메모를 입력하세요."
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>
          </div>

          {/* ASC File Uploads */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
              ASC 파일 업로드 (T0~T3)
            </h2>

            {[
              { label: 'T0 (기준)', state: ascFileT0, setter: setAscFileT0, index: 0 },
              { label: 'T+1시간', state: ascFileT1, setter: setAscFileT1, index: 1 },
              { label: 'T+2시간', state: ascFileT2, setter: setAscFileT2, index: 2 },
              { label: 'T+3시간', state: ascFileT3, setter: setAscFileT3, index: 3 },
            ].map(({ label, state, index }) => (
              <div key={index} className="mb-4 last:mb-0">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {label}
                  </label>
                  {state.file && (
                    <button
                      onClick={() => handleFileChange(['t0','t1','t2','t3'][index] as 't0' | 't1' | 't2' | 't3', null)}
                      className="text-xs text-red-500 hover:text-red-700 dark:hover:text-red-400"
                    >
                      삭제
                    </button>
                  )}
                </div>
                <input
                  type="file"
                  accept=".asc,.txt,.csv,.json,.xml,.yaml,.yml,.dat"
                  onChange={(e) => handleFileChange(['t0','t1','t2','t3'][index] as 't0' | 't1' | 't2' | 't3', e.target.files?.[0] || null)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm file:mr-4 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 dark:file:bg-blue-900/30 dark:file:text-blue-400 dark:hover:file:bg-blue-900/50"
                />
                {state.file && (
                  <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    <div>파일: {state.filename}</div>
                    <div>타임스탬프: {state.timestamp}</div>
                    <div>크기: {(state.file.size / 1024).toFixed(1)} KB</div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Error & Result */}
          {createError && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400">
              {createError}
            </div>
          )}

          {createResult && (
            <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
              <h3 className="font-semibold text-green-800 dark:text-green-400">실험 생성 성공</h3>
              <p className="text-green-700 dark:text-green-300 mt-1">
                실험 ID: <strong>{createResult.id}</strong> | 이름: {createResult.name}
              </p>
              <p className="text-green-600 dark:text-green-400 text-sm mt-1">
                {createResult.message}
              </p>
            </div>
          )}

          {/* Submit */}
          <div className="flex justify-end gap-4">
            <button
              onClick={() => setActiveView('list')}
              className="px-6 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              취소
            </button>
            <button
              onClick={handleCreateExperiment}
              disabled={createLoading || !runDatetime}
              className="px-6 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              {createLoading ? '생성 중...' : '실험 생성'}
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  // ─── List View ──────────────────────────────────────────

  return (
    <Layout>
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              모델 실험
            </h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              머신러닝 모델 학습 실험을 관리하고 모니터링합니다.
            </p>
          </div>
          <button
            onClick={() => {
              setActiveView('create');
              setCreateResult(null);
              setCreateError(null);
            }}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 font-medium"
          >
            + 새 실험
          </button>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
        )}

        {/* Experiment List */}
        {!loading && experiments.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500 dark:text-gray-400">등록된 실험이 없습니다.</p>
          </div>
        )}

        {!loading && experiments.length > 0 && (
          <div className="space-y-4">
            {experiments.map((exp) => (
              <div
                key={exp.id}
                className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden"
              >
                {/* Experiment Header */}
                <div
                  className="p-5 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"
                  onClick={() => loadRuns(exp.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                          {exp.name}
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                          ID: {exp.id}
                          {exp.description && (
                            <span className="ml-2">{exp.description}</span>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {exp.created_at && (
                        <span className="text-sm text-gray-400 dark:text-gray-500">
                          {exp.created_at.replace('T', ' ')}
                        </span>
                      )}
                      <span className="text-gray-400 dark:text-gray-500 text-xl">
                        {expandedExperiment === exp.id ? '▲' : '▼'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Runs (Expanded) */}
                {expandedExperiment === exp.id && (
                  <div className="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-850">
                    {runsLoading ? (
                      <div className="flex items-center justify-center py-6">
                        <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                      </div>
                    ) : runs.length === 0 ? (
                      <div className="p-4 text-center text-sm text-gray-400 dark:text-gray-500">
                        실행 기록이 없습니다.
                      </div>
                    ) : (
                      <div className="divide-y divide-gray-200 dark:divide-gray-700">
                        {runs.map((run) => (
                          <div key={run.id} className="p-4 flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium text-gray-900 dark:text-white">
                                Run #{run.id}
                              </p>
                              {run.training_job_id && (
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                  Training Job: {run.training_job_id}
                                </p>
                              )}
                              {run.started_at && (
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                  시작: {run.started_at.replace('T', ' ')}
                                </p>
                              )}
                            </div>
                            <span
                              className={`px-2 py-1 rounded-full text-xs font-medium ${
                                statusColors[run.status.toUpperCase()] ||
                                (run.status.includes('success') || run.status.includes('completed')
                                  ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
                                  : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400')
                              }`}
                            >
                              {run.status}
                            </span>
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
      </div>
    </Layout>
  );
}