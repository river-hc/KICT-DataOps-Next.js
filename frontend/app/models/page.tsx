'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Layout from '@/lib/Layout';
import { getModels, type ModelVersion } from '@/lib/api';
import { MOCK_MODELS } from '@/lib/modelMock';
import { formatModelDateTime, getArchitecture } from '@/lib/modelRegistry';
import { hideModel, loadHidden, mergeRegisteredModels, saveRegisteredModel } from '@/lib/modelStore';

// ─── 완료 모델 버전 목록 ─────────────────────────────────────────────────────

function isTrainingStatus(status: string | null | undefined): boolean {
  return ['QUEUED', 'RUNNING'].includes((status ?? '').toUpperCase());
}

function nextVersionLabel(models: ModelVersion[]): string {
  const max = models.reduce((acc, model) => {
    const n = /Ver\.\s*(\d+)/i.exec(model.version)?.[1];
    return n ? Math.max(acc, Number(n)) : acc;
  }, 0);
  return `Ver.${max + 1}`;
}

function fileLabel(file: File): string {
  const withPath = file as File & { webkitRelativePath?: string };
  return withPath.webkitRelativePath || file.name;
}

const MODEL_FILE_EXTENSIONS = ['.h5', '.tflite', '.keras', '.pb', '.onnx'];

function isSupportedModelFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return MODEL_FILE_EXTENSIONS.some(ext => name.endsWith(ext));
}

function ModelRegisterModal({
  nextVersion,
  onClose,
  onRegister,
}: {
  nextVersion: string;
  onClose: () => void;
  onRegister: (model: ModelVersion) => void;
}) {
  const [architecture, setArchitecture] = useState<'single' | 'multi'>('single');
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const filePaths = files.map(fileLabel);
  const unsupportedFiles = files.filter(file => !isSupportedModelFile(file));
  const countError =
    architecture === 'single' && files.length !== 1
      ? 'single 모델은 모델 파일 1개를 선택해주세요.'
      : architecture === 'multi' && files.length === 0
        ? 'multi 모델 파일을 선택해주세요.'
        : null;
  const formatError = unsupportedFiles.length > 0
    ? `지원되지 않는 모델 파일 형식입니다: ${unsupportedFiles.map(file => file.name).join(', ')}`
    : null;
  const validationError = formatError ?? countError;
  const canRegister = files.length > 0 && !validationError;

  const handleFiles = (list: FileList | null) => {
    setFiles(list ? Array.from(list) : []);
    setError(null);
  };

  const handleArchitecture = (value: 'single' | 'multi') => {
    setArchitecture(value);
    setFiles([]);
    setError(null);
  };

  const handleRegister = () => {
    if (validationError) {
      setError(validationError);
      return;
    }

    const model = saveRegisteredModel({
      modelName: 'KICT-RAIN-AI',
      version: nextVersion,
      architecture,
      filePaths,
    });
    onRegister(model);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-xl mx-4 bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-start justify-between px-6 py-5 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-bold text-gray-900">모델 등록</h2>
            <p className="text-xs text-gray-400 mt-0.5">완료된 모델 파일을 레지스트리에 추가합니다.</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100">
            <svg viewBox="0 0 16 16" className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
              <path d="M2 2l12 12M14 2L2 14" />
            </svg>
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">모델명</p>
              <div className="px-3 py-2.5 rounded-lg bg-gray-50 text-sm font-semibold text-gray-800">
                KICT-RAIN-AI
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Ver.</p>
              <div className="px-3 py-2.5 rounded-lg bg-gray-50 text-sm font-mono font-semibold text-gray-800">
                {nextVersion}
              </div>
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">학습 방식</p>
            <div className="grid grid-cols-2 gap-2">
              {(['single', 'multi'] as const).map(value => (
                <label
                  key={value}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-semibold cursor-pointer transition-colors ${
                    architecture === value ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="model-architecture"
                    value={value}
                    checked={architecture === value}
                    onChange={() => handleArchitecture(value)}
                    className="accent-blue-600"
                  />
                  {value}
                </label>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">모델 파일</p>
            <label className="flex min-h-24 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 px-4 py-5 text-center transition-colors hover:border-blue-300 hover:bg-blue-50/50">
              <input
                type="file"
                multiple={architecture === 'multi'}
                accept={MODEL_FILE_EXTENSIONS.join(',')}
                onChange={e => handleFiles(e.target.files)}
                className="hidden"
              />
              <svg className="w-7 h-7 text-gray-400 mb-2" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 16V4m0 0L8 8m4-4l4 4M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2" />
              </svg>
              <span className="text-sm font-semibold text-gray-700">파일 선택</span>
              <span className="text-xs text-gray-400 mt-1">
                {architecture === 'single' ? '모델 파일 1개' : '모델 파일 여러 개 선택 가능'}
              </span>
            </label>

            {filePaths.length > 0 && (
              <div className="mt-3 max-h-28 overflow-y-auto rounded-lg border border-gray-200 bg-white">
                {filePaths.map(path => (
                  <div key={path} className="px-3 py-2 border-b last:border-b-0 border-gray-100 font-mono text-xs text-gray-600 truncate">
                    {path}
                  </div>
                ))}
              </div>
            )}

            {((files.length > 0 && validationError) || error) && (
              <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
                {error ?? validationError}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 border-t border-gray-100 px-6 py-4">
          <div className="flex-1 min-w-0" />
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
            취소
          </button>
          <button
            onClick={handleRegister}
            disabled={!canRegister}
            className="px-5 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            등록
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main — 등록된 모델 목록 ─────────────────────────────────────────────────

export default function Models() {
  const [models, setModels]   = useState<ModelVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRegister, setShowRegister] = useState(false);
  const [hiddenIds, setHiddenIds] = useState<number[]>([]);

  const refresh = useCallback(() => {
    getModels()
      .then(data => {
        setModels(mergeRegisteredModels(data.length ? data : MOCK_MODELS));
      })
      .catch(() => {
        setModels(mergeRegisteredModels(MOCK_MODELS));
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    setHiddenIds(loadHidden());
    refresh();
  }, [refresh]);

  const handleDeleteModel = useCallback((model: ModelVersion) => {
    const ok = window.confirm(
      `${model.model_name} ${model.version} 모델 버전을 삭제하시겠습니까?\n\n삭제 후 레지스트리 목록에서 표시되지 않습니다.`,
    );
    if (!ok) return;

    hideModel(model.id);
    setHiddenIds(prev => prev.includes(model.id) ? prev : [...prev, model.id]);
    setModels(prev => prev.filter(item => item.id !== model.id));
  }, []);

  const nextVersion = useMemo(() => nextVersionLabel(models), [models]);
  const titleActions = (
    <button
      onClick={() => setShowRegister(true)}
      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition shadow-sm"
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.25} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
      </svg>
      모델 등록
    </button>
  );

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

  const versions = models
    .filter(m => !isTrainingStatus(m.status) && !hiddenIds.includes(m.id))
    .sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''));

  return (
    <Layout titleActions={titleActions}>
      {showRegister && (
        <ModelRegisterModal
          nextVersion={nextVersion}
          onClose={() => setShowRegister(false)}
          onRegister={model => setModels(prev => [model, ...prev])}
        />
      )}
      <div className="space-y-3">
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-700">등록 모델 목록</p>
              <p className="text-xs text-gray-500 mt-0.5">학습이 완료된 모델 파일 버전을 목록으로 표시합니다.</p>
            </div>
            {/* 새 모델 학습 페이지 이동 기능은 현재 모델 레지스트리 범위에서 비활성화합니다.
            <button
              onClick={() => router.push('/trainings')}
              className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition shadow-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.25} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 2L2 7l10 5 10-5-10-5z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
              새 모델 학습
            </button>
            */}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {['모델명', 'Ver.', '방식', '등록일', '모델 파일', '삭제'].map(h => (
                    <th
                      key={h}
                      className={`px-3 py-2.5 text-xs font-medium text-gray-500 whitespace-nowrap ${
                        h === '삭제' ? 'text-center' : 'text-left'
                      }`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {versions.map(model => (
                  <tr key={model.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <svg className="w-[18px] h-[18px] text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3.27 6.96L12 12.01l8.73-5.05M12 22.08V12" />
                        </svg>
                        <span className="font-semibold text-gray-800">{model.model_name}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="font-mono text-sm font-semibold text-gray-800">{model.version}</span>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-gray-600 whitespace-nowrap">{getArchitecture(model)}</td>
                    <td className="px-3 py-2.5 text-gray-400 text-xs whitespace-nowrap">{formatModelDateTime(model.created_at)}</td>
                    <td className="px-3 py-2.5 max-w-[260px]">
                      <span className="block truncate font-mono text-xs text-gray-500">{model.model_path ?? '-'}</span>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <button
                        type="button"
                        onClick={() => handleDeleteModel(model)}
                        className="inline-flex items-center justify-center rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600"
                        title={`${model.version} 삭제`}
                        aria-label={`${model.version} 삭제`}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.9} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 7h12M10 11v6m4-6v6M9 7l1-2h4l1 2m-8 0 1 13h8l1-13" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {versions.length === 0 && (
            <div className="py-16 text-center text-gray-400 text-sm">
              아직 레지스트리에 등록된 모델 버전이 없습니다.
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
