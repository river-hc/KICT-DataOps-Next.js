import type {
  Artifact,
  Experiment,
  ExperimentRun,
  ModelVersion,
  SystemStatus,
  TrainingJob,
  TrainingLog,
  TrainingResult,
} from './api';

export const DEMO_EXPERIMENT_ID = 202606;
export const DEMO_JOB_IDS = [9104, 9103, 9102, 9101];

const DEMO_JOBS_KEY = 'kict_demo_jobs';

export function isDemoMode(): boolean {
  return process.env.NEXT_PUBLIC_DEMO_MODE === 'true';
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function localDateParts(date = new Date()) {
  return {
    y: date.getFullYear(),
    m: pad(date.getMonth() + 1),
    d: pad(date.getDate()),
    h: pad(date.getHours()),
    min: pad(date.getMinutes()),
  };
}

function isoAt(hour: number, minute: number): string {
  const now = new Date();
  now.setHours(hour, minute, 0, 0);
  const { y, m, d, h, min } = localDateParts(now);
  return `${y}-${m}-${d}T${h}:${min}:00`;
}

function displayNameFromIso(iso: string): string {
  const [, y, m, d, h, min] = iso.match(/(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/) ?? [];
  return y ? `${y}-${m}-${d} 강우 실험(${h}시 ${min}분)` : '강우 실험';
}

export function demoModels(): ModelVersion[] {
  const now = new Date().toISOString();
  return [
    {
      id: 3,
      experiment_id: 0,
      run_id: null,
      model_name: 'KICT-RAIN-AI',
      version: 'Ver.3',
      status: 'CREATED',
      metrics: {
        architecture: 'multi',
        file_count: 18,
        training_duration_seconds: 18420,
        hyperparameters: { optimizer: 'Adam', batch_size: 8, epochs: 120 },
      },
      model_path: '/models/kict-rain-ai/ver3',
      created_at: now,
    },
    {
      id: 2,
      experiment_id: 0,
      run_id: null,
      model_name: 'KICT-RAIN-AI',
      version: 'Ver.2',
      status: 'CREATED',
      metrics: {
        architecture: 'multi',
        file_count: 18,
        training_duration_seconds: 20160,
        hyperparameters: { optimizer: 'Adam', batch_size: 8, epochs: 100 },
      },
      model_path: '/models/kict-rain-ai/ver2',
      created_at: new Date(Date.now() - 86400000 * 12).toISOString(),
    },
    {
      id: 1,
      experiment_id: 0,
      run_id: null,
      model_name: 'KICT-RAIN-AI',
      version: 'Ver.1',
      status: 'CREATED',
      metrics: {
        architecture: 'single',
        file_count: 1,
        training_duration_seconds: 16800,
        hyperparameters: { optimizer: 'RMSprop', batch_size: 4, epochs: 80 },
      },
      model_path: '/models/kict-rain-ai/ver1/model.h5',
      created_at: new Date(Date.now() - 86400000 * 30).toISOString(),
    },
  ];
}

export function demoExperiments(): Experiment[] {
  return [
    {
      id: DEMO_EXPERIMENT_ID,
      name: '2026 summer',
      description: 'KICT 강우 예측 모델 성능 검증',
      created_by: 'admin',
      gold_job_id: null,
      created_at: new Date().toISOString(),
    },
  ];
}

export function defaultDemoJobs(): TrainingJob[] {
  const r1 = isoAt(13, 40);
  const r2 = isoAt(12, 20);
  const r3 = isoAt(10, 50);
  const r4 = isoAt(9, 30);
  return [
    {
      job_id: 9104,
      user_name: 'KICT_001',
      experiment_name: displayNameFromIso(r1),
      mode: 'multi',
      status: 'COMPLETED',
      progress: 100,
      current_epoch: null,
      total_epochs: null,
      run_id: 8104,
      created_at: r1,
      started_at: r1,
      finished_at: isoAt(13, 42),
    },
    {
      job_id: 9103,
      user_name: 'KICT_001',
      experiment_name: displayNameFromIso(r2),
      mode: 'multi',
      status: 'COMPLETED',
      progress: 100,
      current_epoch: null,
      total_epochs: null,
      run_id: 8103,
      created_at: r2,
      started_at: r2,
      finished_at: isoAt(12, 22),
    },
    {
      job_id: 9102,
      user_name: 'KICT_001',
      experiment_name: displayNameFromIso(r3),
      mode: 'single',
      status: 'FAILED',
      progress: 0,
      current_epoch: null,
      total_epochs: null,
      run_id: 8102,
      created_at: r3,
      started_at: r3,
      finished_at: isoAt(10, 51),
    },
    {
      job_id: 9101,
      user_name: 'KICT_001',
      experiment_name: displayNameFromIso(r4),
      mode: 'multi',
      status: 'RUNNING',
      progress: 64,
      current_epoch: null,
      total_epochs: null,
      run_id: null,
      created_at: r4,
      started_at: r4,
      finished_at: null,
    },
  ];
}

export function readDemoJobs(): TrainingJob[] {
  if (typeof window === 'undefined') return defaultDemoJobs();
  try {
    const raw = localStorage.getItem(DEMO_JOBS_KEY);
    if (!raw) {
      const seeded = defaultDemoJobs();
      localStorage.setItem(DEMO_JOBS_KEY, JSON.stringify(seeded));
      return seeded;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : defaultDemoJobs();
  } catch {
    return defaultDemoJobs();
  }
}

function writeDemoJobs(jobs: TrainingJob[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(DEMO_JOBS_KEY, JSON.stringify(jobs));
}

export function addDemoJob(input: {
  userName?: string | null;
  runDatetime?: string | null;
  modelVersion?: string | null;
  mode?: string | null;
  experimentName?: string | null;
}): TrainingJob {
  const id = Date.now();
  const runDatetime = input.runDatetime ?? new Date().toISOString().slice(0, 19);
  const job: TrainingJob = {
    job_id: id,
    user_name: input.userName || 'KICT_001',
    experiment_name: input.experimentName || displayNameFromIso(runDatetime),
    mode: input.mode || (input.modelVersion?.toLowerCase().includes('ver.1') ? 'single' : 'multi'),
    status: 'COMPLETED',
    progress: 100,
    current_epoch: null,
    total_epochs: null,
    run_id: id + 1000,
    created_at: runDatetime,
    started_at: runDatetime,
    finished_at: new Date(new Date(runDatetime).getTime() + 120000).toISOString().slice(0, 19),
  };
  writeDemoJobs([job, ...readDemoJobs()]);
  return job;
}

function versionForJob(jobId: number): string {
  if (jobId === 9102) return 'Ver.1';
  if (jobId === 9103) return 'Ver.2';
  return 'Ver.3';
}

function metricsForJob(jobId: number): Record<string, number> {
  if (jobId === 9103) return { mae: 2.214, rmse: 3.962, csi: 0.742 };
  if (jobId === 9102) return {};
  if (jobId === 9101) return {};
  const jitter = ((jobId * 17) % 20) / 1000;
  return { mae: 1.934 + jitter, rmse: 3.388 + jitter * 2, csi: 0.782 - jitter };
}

function ascText(step: number): string {
  const ncols = 48;
  const nrows = 36;
  const t = step / 180;
  const rows: string[] = [
    `ncols ${ncols}`,
    `nrows ${nrows}`,
    'xllcorner 124.5',
    'yllcorner 33.0',
    'cellsize 0.05',
    'NODATA_value -9999',
  ];
  for (let y = 0; y < nrows; y += 1) {
    const vals: string[] = [];
    for (let x = 0; x < ncols; x += 1) {
      const dx = x - (14 + t * 18);
      const dy = y - (14 + Math.sin(t * Math.PI) * 7);
      const core = Math.max(0, 42 - Math.sqrt(dx * dx + dy * dy) * 4.2);
      const band = Math.max(0, 16 - Math.abs(y - 24 + x * 0.18) * 2.2);
      vals.push((core + band + ((x * y + step) % 5)).toFixed(1));
    }
    rows.push(vals.join(' '));
  }
  return rows.join('\n');
}

function dataUrl(text: string): string {
  return `data:text/plain;charset=utf-8,${encodeURIComponent(text)}`;
}

export function demoTrainingResult(jobId: number): TrainingResult {
  const job = readDemoJobs().find(item => item.job_id === jobId);
  const version = versionForJob(jobId);
  const steps = [10,20,30,40,50,60,70,80,90,100,110,120,130,140,150,160,170,180];
  const asc_urls = Object.fromEntries(steps.map(step => [step, dataUrl(ascText(step))])) as Record<number, string>;
  return {
    job_id: jobId,
    run_id: job?.run_id ?? jobId + 1000,
    status: job?.status ?? 'COMPLETED',
    params: {
      model_version: version,
      forecast_steps: steps,
      include_preview_image: true,
      run_datetime: job?.created_at ?? new Date().toISOString(),
      observation_dataset_dir: '/data/observations/default',
      experiment_memo: jobId === 9102 ? 'Ver.1 모델 실패 로그 확인용 데모 실행' : '시연용 강우 예측 실행',
    },
    metrics: metricsForJob(jobId),
    metric_sources: {
      observation_dataset_dir: '/data/observations/default',
      metrics_file_path: `/data/observations/results/job_${jobId}/metrics.json`,
      matched_targets: Object.fromEntries(steps.map(step => [String(step), `/data/observations/default/QPE_T+${step}.asc`])),
      missing_steps: [],
      errors: {},
    },
    artifacts: [],
    asc_urls,
  };
}

export function demoTrainingLogs(jobId: number): TrainingLog {
  const failed = readDemoJobs().find(job => job.job_id === jobId)?.status === 'FAILED';
  return {
    job_id: jobId,
    logs: failed
      ? [
          '[INFO] 실행 요청 수신',
          '[INFO] 모델 버전: Ver.1',
          '[INFO] 입력 ASC 파일 검증 완료',
          '[ERROR] 모델 입력 shape 불일치로 추론 실패',
          '[ERROR] expected channels=4, received channels=18',
          '[INFO] 작업 상태를 FAILED로 저장했습니다.',
        ]
      : [
          '[INFO] 실행 요청 수신',
          '[INFO] 비교 데이터셋: /data/observations/default',
          '[INFO] 18개 선행시간 예측 완료',
          '[INFO] MAE/RMSE/CSI 계산 완료',
          '[INFO] 산출물 저장 완료',
        ],
  };
}

export function demoArtifacts(runId: number): Artifact[] {
  const jobId = runId > 9000 ? runId - 1000 : runId + 1000;
  return [
    {
      id: runId * 10 + 1,
      run_id: runId,
      file_name: `job_${jobId}_qpf_010.asc`,
      file_path: `/api/v1/trainings/${jobId}/files/job_${jobId}_qpf_010.asc`,
      file_size: 18432,
      artifact_type: 'asc',
      created_at: new Date().toISOString(),
    },
    {
      id: runId * 10 + 2,
      run_id: runId,
      file_name: `job_${jobId}_metrics.json`,
      file_path: `/data/observations/results/job_${jobId}/metrics.json`,
      file_size: 2048,
      artifact_type: 'metrics',
      created_at: new Date().toISOString(),
    },
  ];
}

export function demoRuns(experimentId: number): ExperimentRun[] {
  if (experimentId !== DEMO_EXPERIMENT_ID) return [];
  return readDemoJobs().map(job => ({
    id: job.run_id ?? job.job_id + 1000,
    experiment_id: DEMO_EXPERIMENT_ID,
    job_id: job.job_id,
    run_name: job.experiment_name,
    version: versionForJob(job.job_id),
    mode: job.mode,
    status: job.status,
    parameters: { observation_dataset_dir: '/data/observations/default' },
    metrics: metricsForJob(job.job_id),
    created_by: job.user_name,
    started_at: job.started_at,
    finished_at: job.finished_at,
    duration_seconds: job.started_at && job.finished_at
      ? Math.floor((new Date(job.finished_at).getTime() - new Date(job.started_at).getTime()) / 1000)
      : null,
    created_at: job.created_at ?? new Date().toISOString(),
  }));
}

export function demoSystemStatus(): SystemStatus {
  return {
    available: true,
    gpu_count: 1,
    error: null,
    gpus: [
      {
        id: 0,
        name: 'NVIDIA RTX A6000',
        utilization: 42,
        memory_used: 18432,
        memory_total: 49152,
        memory_free: 30720,
        temperature: 58,
      },
    ],
  };
}
