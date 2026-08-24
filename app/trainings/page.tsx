'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '@/lib/Layout';
import { createTraining, getModels, type ModelVersion } from '@/lib/api';
import { applyStoredModelStatuses, savePendingTrainingModel } from '@/lib/modelStore';
import { MOCK_MODELS } from '@/lib/modelMock';

type TrainingMode = 'single' | 'multi';
type RegisterPolicy = 'manual' | 'auto';

const FIXED_FORECAST_STEPS = [10,20,30,40,50,60,70,80,90,100,110,120,130,140,150,160,170,180];
const EVALUATION_METRICS = ['MAE', 'CSI', 'RMSE'] as const;

interface TrainingForm {
  modelName: string;
  mode: TrainingMode;
  inputDataDir: string;
  registerPolicy: RegisterPolicy;
  memo: string;
}

const DEFAULT_FORM: TrainingForm = {
  modelName: 'KICT-RAIN-AI',
  mode: 'multi',
  inputDataDir: '/data/train/rain/2023_2025',
  registerPolicy: 'manual',
  memo: '',
};

function FieldLabel({ children, required = false }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="text-xs font-medium text-gray-600 block mb-1.5">
      {children} {required && <span className="text-red-500">*</span>}
    </label>
  );
}

function FolderPickerCard({
  label,
  value,
  placeholder,
  required = false,
  onChange,
}: {
  label: string;
  value: string;
  placeholder: string;
  required?: boolean;
  onChange: (path: string) => void;
}) {
  const ref = useRef<HTMLInputElement | null>(null);

  const bindDirectoryInput = (node: HTMLInputElement | null) => {
    ref.current = node;
    node?.setAttribute('webkitdirectory', '');
    node?.setAttribute('directory', '');
  };

  const handleDirectorySelect = (fileList: FileList | null) => {
    const first = fileList?.[0] as (File & { webkitRelativePath?: string }) | undefined;
    if (!first) return;
    const relativePath = first.webkitRelativePath ?? '';
    onChange(relativePath.split('/')[0] || first.name);
  };

  const openPicker = async () => {
    const picker = (window as Window & {
      showDirectoryPicker?: () => Promise<{ name: string }>;
    }).showDirectoryPicker;

    if (picker) {
      try {
        const handle = await picker();
        onChange(handle.name);
        return;
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
      }
    }

    ref.current?.click();
  };

  return (
    <div>
      <FieldLabel required={required}>{label}</FieldLabel>
      <div
        onClick={openPicker}
        className={`relative flex items-center gap-3 border-2 border-dashed rounded-xl p-4 cursor-pointer transition-colors ${
          value ? 'border-blue-300 bg-blue-50' : 'border-gray-200 bg-gray-50 hover:border-blue-300 hover:bg-blue-50/60'
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
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
          value ? 'bg-blue-100 text-blue-600' : 'bg-white text-gray-300'
        }`}>
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
          </svg>
        </div>
        <p className={`flex-1 min-w-0 text-sm truncate ${value ? 'font-mono font-semibold text-blue-700' : 'text-gray-400'}`}>
          {value || placeholder}
        </p>
        {value && (
          <button
            type="button"
            onClick={e => { e.stopPropagation(); onChange(''); }}
            className="p-1.5 rounded-md text-blue-400 hover:text-blue-700 hover:bg-blue-100 flex-shrink-0"
            aria-label="선택 해제"
          >
            <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
              <path d="M2 2l12 12M14 2L2 14" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

export default function Trainings() {
  const router = useRouter();
  const [form, setForm] = useState<TrainingForm>(DEFAULT_FORM);
  const [models, setModels] = useState<ModelVersion[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getModels()
      .then(data => setModels(applyStoredModelStatuses(data.length ? data : MOCK_MODELS)))
      .catch(() => setModels(applyStoredModelStatuses(MOCK_MODELS)));
  }, []);

  const modelNames = useMemo(() => {
    const names = new Set(models.map(model => model.model_name));
    if (!names.size) names.add('KICT-RAIN-AI');
    return Array.from(names).sort();
  }, [models]);

  const updateForm = <K extends keyof TrainingForm>(key: K, value: TrainingForm[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.modelName.trim()) { setError('모델명을 입력해주세요.'); return; }
    if (!form.inputDataDir.trim()) { setError('입력 데이터 폴더를 선택해주세요.'); return; }

    setSubmitting(true);
    setError(null);
    try {
      const result = await createTraining({
        user_name: 'admin',
        experiment_name: `${form.modelName.trim()} 학습`,
        model_name: form.modelName.trim(),
        mode: form.mode,
        train_dataset_dir: form.inputDataDir.trim(),
        validation_dataset_dir: null,
        hyperparameters: null,
        forecast_steps: FIXED_FORECAST_STEPS,
        evaluation_metrics: [...EVALUATION_METRICS],
        register_policy: form.registerPolicy,
        experiment_memo: form.memo.trim() || null,
        include_preview_image: false,
        run_datetime: null,
        model_version: null,
        input_files: {
          file_t0: { filename: null, file: null },
          file_t1: { filename: null, file: null },
          file_t2: { filename: null, file: null },
          file_t3: { filename: null, file: null },
        },
      });
      savePendingTrainingModel({
        jobId: result.job_id,
        modelName: form.modelName.trim(),
        mode: form.mode,
        status: result.status,
        registerPolicy: form.registerPolicy,
        memo: form.memo.trim() || null,
      });
      setForm(DEFAULT_FORM);
      router.push('/models');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '학습 시작에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const inp = 'w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none';

  return (
    <Layout>
      <div className="space-y-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">모델 학습</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            입력 데이터 폴더를 기준으로 신규 모델 학습을 실행합니다.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <p className="text-sm font-semibold text-gray-700">학습 실행 설정</p>
            <p className="text-xs text-gray-500 mt-0.5">학습 작업은 모델 목록에서 상태를 확인하고, 저장 정책에 따라 레지스트리에 등록됩니다.</p>
          </div>

          <div className="p-5 space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <FieldLabel required>모델명</FieldLabel>
                <input
                  list="training-model-names"
                  value={form.modelName}
                  onChange={e => updateForm('modelName', e.target.value)}
                  className={inp}
                  placeholder="모델명"
                />
                <datalist id="training-model-names">
                  {modelNames.map(name => <option key={name} value={name} />)}
                </datalist>
                <p className="text-[11px] text-gray-400 mt-1">
                  없는 이름을 입력하면 새 모델 그룹의 첫 버전으로 등록됩니다.
                </p>
              </div>

              <div>
                <FieldLabel>학습 방식</FieldLabel>
                <div className="grid grid-cols-2 gap-2">
                  {(['single', 'multi'] as const).map(mode => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => updateForm('mode', mode)}
                      className={`py-2 rounded-lg border text-sm font-semibold transition-colors ${
                        form.mode === mode
                          ? 'bg-gray-900 text-white border-gray-900'
                          : 'border-gray-200 text-gray-500 hover:border-gray-300'
                      }`}
                    >
                      {mode === 'single' ? 'Single' : 'Multi'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="md:col-span-2">
                <FolderPickerCard
                  label="입력 데이터 폴더"
                  value={form.inputDataDir}
                  required
                  placeholder="폴더 선택"
                  onChange={path => updateForm('inputDataDir', path)}
                />
              </div>
            </div>

            <div className="border-t border-gray-100 pt-5 grid grid-cols-1 md:grid-cols-[1fr_220px] gap-4">
              <div>
                <FieldLabel>성능 지표</FieldLabel>
                <div className="min-h-10 px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 flex flex-wrap items-center gap-2">
                  {EVALUATION_METRICS.map(metric => (
                    <span key={metric} className="px-2 py-0.5 rounded bg-white border border-gray-200 text-xs font-semibold text-gray-700">
                      {metric}
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <FieldLabel>레지스트리 등록 정책</FieldLabel>
                <select
                  value={form.registerPolicy}
                  onChange={e => updateForm('registerPolicy', e.target.value as RegisterPolicy)}
                  className={inp}
                >
                  <option value="manual">완료 후 수동 등록</option>
                  <option value="auto">완료 후 자동 등록</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <FieldLabel>메모</FieldLabel>
                <textarea
                  value={form.memo}
                  onChange={e => updateForm('memo', e.target.value)}
                  rows={3}
                  className={`${inp} resize-none`}
                  placeholder="메모 입력"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 pt-1">
              <div className="flex-1 min-w-0">
                {error && <p className="text-xs text-red-500">{error}</p>}
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                {submitting && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                학습 시작
              </button>
            </div>
          </div>
        </form>
      </div>
    </Layout>
  );
}
