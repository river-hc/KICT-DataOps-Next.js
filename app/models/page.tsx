'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '@/lib/Layout';
import {
  getModels, getModelInfo,
  getModelCategories, renameModelCategory, deleteModelCategory,
  type ModelVersion, type ModelCategory,
} from '@/lib/api';
import { formatModelDateTime, getArchitecture } from '@/lib/modelRegistry';
import RegisterModal from './RegisterModal';
import { SkeletonStatCards, SkeletonTableRows } from '@/lib/Skeleton';

function CategoryFormModal({
  title,
  initialName,
  onClose,
  onSubmit,
}: {
  title: string;
  initialName?: string;
  onClose: () => void;
  onSubmit: (name: string) => Promise<void>;
}) {
  const [name, setName] = useState(initialName ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await onSubmit(name.trim());
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : '저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="w-full max-w-sm rounded-xl bg-white shadow-xl p-6 space-y-4" onClick={e => e.stopPropagation()}>
        <h3 className="text-base font-semibold text-gray-900">{title}</h3>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-700">카테고리 이름</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleSubmit(); }}
            placeholder="예: KICT-RAIN-AI-v2"
            autoFocus
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
          />
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">취소</button>
          <button
            onClick={handleSubmit}
            disabled={saving || !name.trim()}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
    </div>
  );
}

interface ModelGroup {
  name: string;
  versions: ModelVersion[];
  selected: ModelVersion | null;
  readyCount: number;
  latest: ModelVersion | null;
}

function validationLabel(model: ModelVersion | null): string {
  const status = model?.metrics?.validation_status;
  if (status === 'READY') return '실행 가능';
  if (status === 'MISSING_FILES') return '파일 누락';
  if (status === 'INVALID') return '검증 실패';
  return '미검증';
}

function validationClass(model: ModelVersion | null): string {
  const status = model?.metrics?.validation_status;
  if (status === 'READY') return 'bg-emerald-50 text-emerald-700 border-emerald-100';
  if (status === 'MISSING_FILES' || status === 'INVALID') return 'bg-red-50 text-red-700 border-red-100';
  return 'bg-gray-50 text-gray-500 border-gray-100';
}

function buildGroups(models: ModelVersion[]): ModelGroup[] {
  const map = new Map<string, ModelVersion[]>();
  for (const model of models) {
    const arr = map.get(model.model_name) ?? [];
    arr.push(model);
    map.set(model.model_name, arr);
  }

  return Array.from(map.entries()).map(([name, versions]) => {
    const sorted = [...versions].sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''));
    return {
      name,
      versions: sorted,
      selected: sorted.find(v => (v.status ?? '').toUpperCase() === 'SELECTED') ?? null,
      readyCount: sorted.filter(v => v.metrics?.validation_status === 'READY').length,
      latest: sorted[0] ?? null,
    };
  });
}

export default function Models() {
  const router = useRouter();
  const [models, setModels] = useState<ModelVersion[]>([]);
  const [categories, setCategories] = useState<ModelCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showRegister, setShowRegister] = useState(false);
  const [renameTarget, setRenameTarget] = useState<ModelCategory | null>(null);
  const [modelBasePath, setModelBasePath] = useState('');

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const [modelList, categoryList] = await Promise.all([getModels(), getModelCategories()]);
      setModels(modelList);
      setCategories(categoryList);
    } catch (err) {
      setError(err instanceof Error ? err.message : '모델 목록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleDeleteCategory = async (category: ModelCategory) => {
    if (!window.confirm(`"${category.name}" 카테고리를 삭제할까요?`)) return;
    try {
      await deleteModelCategory(category.id);
      await refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : '카테고리 삭제에 실패했습니다.');
    }
  };

  useEffect(() => {
    refresh();
    getModelInfo().then(info => setModelBasePath(info.model_base_path)).catch(() => {});
  }, [refresh]);

  const groups = useMemo(() => buildGroups(models), [models]);
  const groupByName = useMemo(() => new Map(groups.map(g => [g.name, g])), [groups]);
  const singleCount = models.filter(model => getArchitecture(model) === 'Single').length;
  const multiCount = models.filter(model => getArchitecture(model) === 'Multi').length;

  if (loading) {
    return (
      <Layout>
        <div className="space-y-4">
          <SkeletonStatCards count={2} />
          <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
            <table className="w-full min-w-[760px] text-sm">
              <tbody>
                <SkeletonTableRows rows={5} cols={6} />
              </tbody>
            </table>
          </div>
        </div>
      </Layout>
    );
  }

  const titleActions = (
    <button
      onClick={() => setShowRegister(true)}
      className="inline-flex items-center gap-2 rounded-lg bg-gray-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-gray-800"
    >
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
      </svg>
      모델 등록
    </button>
  );

  return (
    <>
    {showRegister && (
      <RegisterModal
        onClose={() => setShowRegister(false)}
        onDone={refresh}
      />
    )}
    {renameTarget && (
      <CategoryFormModal
        title="카테고리 이름 수정"
        initialName={renameTarget.name}
        onClose={() => setRenameTarget(null)}
        onSubmit={async name => { await renameModelCategory(renameTarget.id, name); await refresh(); }}
      />
    )}
    <Layout titleActions={titleActions}>
      <div className="space-y-4">
        {error && (
          <div className="rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-gray-200 bg-white px-4 py-3">
            <p className="text-xs font-medium text-gray-500">싱글 모델</p>
            <p className="mt-1 text-2xl font-bold text-gray-950">{singleCount}</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white px-4 py-3">
            <p className="text-xs font-medium text-gray-500">멀티 모델</p>
            <p className="mt-1 text-2xl font-bold text-gray-950">{multiCount}</p>
          </div>
        </div>

        {categories.length === 0 ? (
          <div className="rounded-lg border border-gray-200 bg-white p-8">
            <div className="mx-auto max-w-lg space-y-5">
              <div className="flex items-center gap-3">
                <svg className="h-8 w-8 text-gray-300 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <ellipse cx="12" cy="5" rx="9" ry="3" /><path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5" /><path d="M3 12c0 1.66 4.03 3 9 3s9-1.34 9-3" />
                </svg>
                <div>
                  <p className="font-semibold text-gray-700">등록된 모델이 없습니다</p>
                  <p className="text-sm text-gray-400">아래 경로에 모델 파일을 넣은 뒤 우측 상단 <strong>모델 등록</strong> 버튼을 눌러주세요.</p>
                </div>
              </div>

              <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-4 space-y-3 text-xs">
                <p className="font-semibold text-blue-700">모델 파일 위치 가이드</p>
                {modelBasePath && (
                  <p className="font-mono text-blue-600 break-all">{modelBasePath}</p>
                )}
                <div className="space-y-2 text-blue-600">
                  <div className="rounded bg-white/60 px-3 py-2 space-y-0.5">
                    <p className="font-semibold">v1 — Single (파일 1개)</p>
                    <p className="font-mono text-blue-500">model-best_rec_180min_f.tflite</p>
                  </div>
                  <div className="rounded bg-white/60 px-3 py-2 space-y-0.5">
                    <p className="font-semibold">v2 — Multi (파일 18개)</p>
                    <p className="font-mono text-blue-500">model-best_fcst_10min.tflite ~ model-best_fcst_180min.tflite</p>
                  </div>
                  <div className="rounded bg-white/60 px-3 py-2 space-y-0.5">
                    <p className="font-semibold">v3 — Multi (파일 18개)</p>
                    <p className="font-mono text-blue-500">model-best_fcst_10min_re.tflite ~ model-best_fcst_180min_re.tflite</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="border-b border-gray-100 bg-gray-50">
                <tr>
                  {['모델', '상태', '파일', '버전 수', '최근 갱신', ''].map(header => (
                    <th key={header} className="px-4 py-3 text-left text-xs font-semibold text-gray-500">{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {categories.map(category => {
                  const group = groupByName.get(category.name) ?? null;
                  const display = group?.selected ?? group?.latest ?? null;
                  const fileCount = display?.metrics?.file_count ?? 0;
                  const expected = display?.metrics?.expected_file_count ?? 0;
                  return (
                    <tr
                      key={category.id}
                      onClick={() => router.push(`/models/${encodeURIComponent(category.name)}`)}
                      className="cursor-pointer border-b border-gray-50 transition hover:bg-gray-50"
                    >
                      <td className="px-4 py-3">
                        <div className="font-semibold text-gray-950">{category.name}</div>
                        <div className="mt-0.5 text-xs text-gray-400">{display?.model_path ?? '등록된 모델 없음'}</div>
                      </td>
                      <td className="px-4 py-3">
                        {group ? (
                          <span className={`inline-flex rounded-md border px-2 py-1 text-xs font-semibold ${validationClass(display)}`}>
                            {validationLabel(display)}
                          </span>
                        ) : (
                          <span className="inline-flex rounded-md border border-gray-100 bg-gray-50 px-2 py-1 text-xs font-semibold text-gray-400">
                            모델 없음
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{group ? `${fileCount}/${expected}` : '-'}</td>
                      <td className="px-4 py-3 text-gray-600">{group?.versions.length ?? 0}개</td>
                      <td className="px-4 py-3 text-xs text-gray-400">
                        {formatModelDateTime(display?.created_at ?? category.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1.5" onClick={event => event.stopPropagation()}>
                          <button
                            onClick={() => setRenameTarget(category)}
                            className="rounded-md border border-blue-100 bg-white px-2 py-1 text-xs font-semibold text-blue-600 transition hover:bg-blue-50"
                          >
                            수정
                          </button>
                          <button
                            onClick={() => handleDeleteCategory(category)}
                            className="rounded-md border border-red-100 bg-white px-2 py-1 text-xs font-semibold text-red-500 transition hover:bg-red-50"
                          >
                            삭제
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Layout>
    </>
  );
}
