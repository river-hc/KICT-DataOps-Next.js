'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '@/lib/Layout';
import { getModels, getModelInfo, type ModelVersion } from '@/lib/api';
import { formatModelDateTime } from '@/lib/modelRegistry';
import RegisterModal from './RegisterModal';
import { SkeletonStatCards, SkeletonTableRows } from '@/lib/Skeleton';

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showRegister, setShowRegister] = useState(false);
  const [modelBasePath, setModelBasePath] = useState('');

  const refresh = useCallback(async () => {
    setError(null);
    try {
      setModels(await getModels());
    } catch (err) {
      setError(err instanceof Error ? err.message : '모델 목록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    getModelInfo().then(info => setModelBasePath(info.model_base_path)).catch(() => {});
  }, [refresh]);

  const groups = useMemo(() => buildGroups(models), [models]);
  const readyCount = models.filter(model => model.metrics?.validation_status === 'READY').length;

  if (loading) {
    return (
      <Layout>
        <div className="space-y-4">
          <SkeletonStatCards count={2} />
          <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
            <table className="w-full min-w-[760px] text-sm">
              <tbody>
                <SkeletonTableRows rows={5} cols={5} />
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
    <Layout titleActions={titleActions}>
      <div className="space-y-4">
        {error && (
          <div className="rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-gray-200 bg-white px-4 py-3">
            <p className="text-xs font-medium text-gray-500">등록 모델</p>
            <p className="mt-1 text-2xl font-bold text-gray-950">{models.length}</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white px-4 py-3">
            <p className="text-xs font-medium text-gray-500">실행 가능</p>
            <p className="mt-1 text-2xl font-bold text-gray-950">{readyCount}</p>
          </div>
        </div>

        {groups.length === 0 ? (
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
                  {['모델', '상태', '파일', '버전 수', '최근 갱신'].map(header => (
                    <th key={header} className="px-4 py-3 text-left text-xs font-semibold text-gray-500">{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {groups.map(group => {
                  const display = group.selected ?? group.latest;
                  const fileCount = display?.metrics?.file_count ?? 0;
                  const expected = display?.metrics?.expected_file_count ?? 0;
                  return (
                    <tr
                      key={group.name}
                      onClick={() => router.push(`/models/${encodeURIComponent(group.name)}`)}
                      className="cursor-pointer border-b border-gray-50 transition hover:bg-gray-50"
                    >
                      <td className="px-4 py-3">
                        <div className="font-semibold text-gray-950">{group.name}</div>
                        <div className="mt-0.5 text-xs text-gray-400">{display?.model_path ?? '-'}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-md border px-2 py-1 text-xs font-semibold ${validationClass(display)}`}>
                          {validationLabel(display)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{fileCount}/{expected}</td>
                      <td className="px-4 py-3 text-gray-600">{group.versions.length}개</td>
                      <td className="px-4 py-3 text-xs text-gray-400">{formatModelDateTime(display?.created_at)}</td>
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
