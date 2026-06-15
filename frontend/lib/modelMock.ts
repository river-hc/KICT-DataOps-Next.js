import type { ModelVersion } from './api';

// 모델 레지스트리 mock — getModels() 빈 결과/실패 시 폴백 (모델: KICT-RAIN-AI)
export const MOCK_MODELS: ModelVersion[] = [
  {
    id: 1, experiment_id: 0, run_id: null,
    model_name: 'KICT-RAIN-AI',
    version: 'Ver.3',
    status: 'CREATED',
    metrics: {
      architecture: 'multi', file_format: 'tflite', file_count: 18,
      note: '기상청 레이더 기반 전이학습 업데이트',
    },
    model_path: '/models/ver3/',
    created_at: '2025-10-14T09:00:00',
  },
  {
    id: 2, experiment_id: 0, run_id: null,
    model_name: 'KICT-RAIN-AI',
    version: 'Ver.2',
    status: 'CREATED',
    metrics: {
      architecture: 'multi', file_format: 'tflite', file_count: 18,
      note: '선행시간별 개별 모델',
    },
    model_path: '/models/ver2/',
    created_at: '2024-06-01T09:00:00',
  },
  {
    id: 3, experiment_id: 0, run_id: null,
    model_name: 'KICT-RAIN-AI',
    version: 'Ver.1',
    status: 'CREATED',
    metrics: {
      architecture: 'single', file_format: 'h5', file_count: 1,
      note: '재귀적 학습, 18개 시점 동시 예측',
    },
    model_path: '/models/ver1/model-best_rec_180min_f.h5',
    created_at: '2023-06-13T09:00:00',
  },
];
