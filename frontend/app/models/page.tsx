'use client';

import { useState, useEffect } from 'react';
import Layout from '@/lib/Layout';
import { getModels, type ModelVersion } from '@/lib/api';

// ─── Mock ─────────────────────────────────────────────────────────────────────

const MOCK_MODELS: ModelVersion[] = [
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

// ─── Register modal ───────────────────────────────────────────────────────────

function RegisterModal({ onClose }: { onClose: () => void }) {
  const [versionLabel, setVersionLabel] = useState('');
  const [architecture, setArchitecture] = useState<'multi' | 'single'>('multi');
  const [file, setFile] = useState<File | null>(null);
  const [note, setNote] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: POST /api/v1/models (multipart/form-data)
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4">

        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-bold text-gray-900">모델 등록</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
              버전 레이블
            </label>
            <input
              type="text"
              value={versionLabel}
              onChange={e => setVersionLabel(e.target.value)}
              placeholder="예: Ver.4, 2025-Q4"
              required
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              아키텍처
            </label>
            <div className="space-y-2">
              {([
                { value: 'multi'  as const, label: 'Multi',  desc: '선행시간별 독립 모델 — 18개 파일은 ZIP으로 묶어 업로드' },
                { value: 'single' as const, label: 'Single', desc: '단일 모델에서 18개 시점 동시 예측' },
              ]).map(opt => (
                <label
                  key={opt.value}
                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition ${
                    architecture === opt.value
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="architecture"
                    value={opt.value}
                    checked={architecture === opt.value}
                    onChange={() => setArchitecture(opt.value)}
                    className="mt-0.5 accent-blue-600"
                  />
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{opt.label}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{opt.desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
              모델 파일
            </label>
            <label className={`flex flex-col items-center justify-center w-full h-24 border-2 border-dashed rounded-lg cursor-pointer transition ${
              file ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:border-gray-300 bg-gray-50'
            }`}>
              <input
                type="file"
                accept=".h5,.tflite,.pt,.zip"
                className="hidden"
                onChange={e => setFile(e.target.files?.[0] ?? null)}
              />
              {file ? (
                <div className="text-center px-4">
                  <p className="text-sm font-medium text-blue-700 truncate max-w-xs">{file.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{(file.size / 1024 / 1024).toFixed(1)} MB</p>
                </div>
              ) : (
                <div className="text-center">
                  <svg className="w-6 h-6 text-gray-300 mx-auto mb-1" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                  </svg>
                  <p className="text-xs text-gray-400">.h5 · .tflite · .pt · .zip</p>
                </div>
              )}
            </label>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
              메모 <span className="normal-case font-normal text-gray-400">(선택)</span>
            </label>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              rows={3}
              placeholder="학습 데이터 출처, 특이사항 등"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={!versionLabel || !file}
              className="px-5 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              등록
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function Models() {
  const [models, setModels]       = useState<ModelVersion[]>([]);
  const [loading, setLoading]     = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  useEffect(() => {
    getModels()
      .then(data => setModels(data.length ? data : MOCK_MODELS))
      .catch(() => setModels(MOCK_MODELS))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-20 text-gray-400">
          <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mr-3" />
          로딩 중...
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      {showModal && <RegisterModal onClose={() => setShowModal(false)} />}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">모델 레지스트리</h1>
          <p className="text-sm text-gray-500 mt-0.5">등록된 모델 버전을 관리합니다.</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition shadow-sm"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          모델 등록
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              {['버전', '아키텍처', '파일 형식', '등록일'].map(h => (
                <th key={h} className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {models.flatMap(m => {
              const arch = m.metrics?.architecture as string | undefined;
              const fmt  = m.metrics?.file_format  as string | undefined;
              const cnt  = m.metrics?.file_count   as number | undefined;
              const isExpanded = expandedId === m.id;

              const mainRow = (
                <tr
                  key={m.id}
                  onClick={() => setExpandedId(isExpanded ? null : m.id)}
                  className="hover:bg-gray-50 cursor-pointer transition-colors border-b border-gray-100"
                >
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <svg
                        className={`w-3.5 h-3.5 text-gray-400 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}
                        fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 16 16"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 4l5 4-5 4" />
                      </svg>
                      <span className="font-mono text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded font-semibold">
                        {m.version}
                      </span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-xs text-gray-600">
                    {arch === 'single' ? 'Single' : arch === 'multi' ? 'Multi' : '-'}
                  </td>
                  <td className="px-5 py-3">
                    {fmt ? (
                      <span className="text-xs font-mono bg-violet-50 text-violet-700 border border-violet-100 px-2 py-0.5 rounded">
                        .{fmt}{cnt && cnt > 1 ? ` × ${cnt}` : ''}
                      </span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-gray-400 text-xs">
                    {m.created_at?.slice(0, 10) ?? '-'}
                  </td>
                </tr>
              );

              if (!isExpanded) return [mainRow];

              const detailRow = (
                <tr key={`${m.id}-detail`}>
                  <td colSpan={4} className="px-5 py-4 bg-gray-50/60 border-b border-gray-100">
                    <div className="space-y-1.5">
                      {m.model_path && (
                        <div className="flex gap-2 text-xs">
                          <span className="text-gray-400 w-12 shrink-0">경로</span>
                          <span className="font-mono text-gray-600 break-all">{m.model_path}</span>
                        </div>
                      )}
                      <div className="flex gap-2 text-xs">
                        <span className="text-gray-400 w-12 shrink-0">모델명</span>
                        <span className="text-gray-600">{m.model_name}</span>
                      </div>
                      {(m.metrics?.note as string | undefined) && (
                        <div className="flex gap-2 text-xs">
                          <span className="text-gray-400 w-12 shrink-0">메모</span>
                          <span className="text-gray-600">{m.metrics?.note as string}</span>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              );

              return [mainRow, detailRow];
            })}
          </tbody>
        </table>
        {models.length === 0 && (
          <div className="py-16 text-center text-gray-400 text-sm">등록된 모델이 없습니다.</div>
        )}
      </div>
    </Layout>
  );
}
