'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Layout from '@/lib/Layout';
import { archiveModel, deleteModel, getModels, selectModel, updateModel, type ModelVersion } from '@/lib/api';
import { formatModelDateTime, getArchitecture } from '@/lib/modelRegistry';
import { SkeletonBlock, SkeletonStatCards, SkeletonTableRows } from '@/lib/Skeleton';

type ModelStatus = 'CREATED' | 'SELECTED' | 'ARCHIVED';

function normalizeStatus(status: string | null | undefined): ModelStatus {
  const value = (status ?? '').toUpperCase();
  if (value === 'SELECTED') return 'SELECTED';
  if (value === 'ARCHIVED') return 'ARCHIVED';
  return 'CREATED';
}

function StatusBadge({ status }: { status: string | null | undefined }) {
  const value = normalizeStatus(status);
  const meta = {
    CREATED: 'border-blue-100 bg-blue-50 text-blue-700',
    SELECTED: 'border-emerald-100 bg-emerald-50 text-emerald-700',
    ARCHIVED: 'border-blue-100 bg-blue-50 text-blue-700',
  }[value];
  const label = value === 'SELECTED' ? '사용 중' : '대기';
  return <span className={`inline-flex rounded-md border px-2 py-1 text-xs font-semibold ${meta}`}>{label}</span>;
}

function ValidationBadge({ model }: { model: ModelVersion }) {
  const status = model.metrics?.validation_status ?? 'UNTESTED';
  const cls = status === 'READY'
    ? 'border-emerald-100 bg-emerald-50 text-emerald-700'
    : status === 'MISSING_FILES' || status === 'INVALID'
      ? 'border-red-100 bg-red-50 text-red-700'
      : 'border-gray-100 bg-gray-50 text-gray-500';
  const label = status === 'READY'
    ? '실행 가능'
    : status === 'MISSING_FILES'
      ? '파일 누락'
      : status === 'INVALID'
        ? '검증 실패'
        : '미검증';
  return <span className={`inline-flex rounded-md border px-2 py-1 text-xs font-semibold ${cls}`}>{label}</span>;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-4 py-3">
      <p className="text-xs font-medium text-gray-500">{label}</p>
      <p className="mt-1 truncate text-lg font-bold text-gray-950">{value}</p>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-medium text-gray-500">{label}</p>
      <div className="min-h-10 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 font-mono text-xs text-gray-700 break-all">
        {value || '-'}
      </div>
    </div>
  );
}

export default function ModelDetail() {
  const params = useParams();
  const router = useRouter();
  const modelName = decodeURIComponent(Array.isArray(params.name) ? params.name[0] : (params.name ?? ''));

  const [models, setModels] = useState<ModelVersion[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editTarget, setEditTarget] = useState<ModelVersion | null>(null);
  const [editName, setEditName] = useState('');
  const [editVersion, setEditVersion] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<ModelVersion | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const data = await getModels();
      setModels(data);
      const filtered = data.filter(model => model.model_name === modelName);
      setActiveId(prev => prev ?? filtered.find(model => normalizeStatus(model.status) === 'SELECTED')?.id ?? filtered[0]?.id ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : '모델 정보를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [modelName]);

  useEffect(() => { refresh(); }, [refresh]);

  const versions = useMemo(() => (
    models
      .filter(model => model.model_name === modelName)
      .sort((a, b) => (a.version ?? '').localeCompare(b.version ?? '', undefined, { numeric: true }))
  ), [models, modelName]);

  const active = versions.find(model => model.id === activeId) ?? versions[0] ?? null;
  const selected = versions.find(model => normalizeStatus(model.status) === 'SELECTED') ?? null;

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2000);
  };

  const runAction = async (id: number, action: 'select' | 'archive') => {
    setBusyId(id);
    setError(null);
    try {
      if (action === 'select') {
        await selectModel(id);
        showToast('운영 모델로 변경되었습니다.');
      }
      if (action === 'archive') await archiveModel(id);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : '요청을 처리하지 못했습니다.');
    } finally {
      setBusyId(null);
    }
  };

  const handleEdit = async () => {
    if (!editTarget) return;
    setBusyId(editTarget.id);
    try {
      await updateModel(editTarget.id, { model_name: editName, version_label: editVersion });
      setEditTarget(null);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : '수정 실패');
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setBusyId(deleteTarget.id);
    try {
      await deleteModel(deleteTarget.id);
      setDeleteTarget(null);
      if (versions.length <= 1) {
        router.push('/models');
      } else {
        await refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '삭제 실패');
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="space-y-4">
          <SkeletonStatCards count={3} />
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
            <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
              <table className="w-full min-w-[760px] text-sm">
                <tbody>
                  <SkeletonTableRows rows={4} cols={7} />
                </tbody>
              </table>
            </div>
            <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => <SkeletonBlock key={i} className="h-8 w-full" />)}
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  const title = (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={() => router.push('/models')}
        className="font-semibold hover:text-blue-600 transition-colors"
      >
        모델 레지스트리
      </button>
      <span className="text-gray-300">&gt;</span>
      <span className="truncate">{modelName}</span>
    </span>
  );

  const titleActions = (
    <button
      onClick={() => router.push('/trainings')}
      className="rounded-lg bg-gray-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-gray-800"
    >
      새 테스트케이스 만들기
    </button>
  );

  return (
    <>
    {/* 토스트 */}
    {toast && (
      <div className="fixed bottom-8 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-gray-900 px-5 py-3 text-sm font-medium text-white shadow-lg">
        {toast}
      </div>
    )}

    {/* 수정 모달 */}
    {editTarget && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
        <div className="w-full max-w-sm rounded-xl bg-white shadow-xl p-6 space-y-4">
          <h3 className="text-base font-semibold text-gray-900">모델 수정</h3>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">모델명</label>
              <input
                type="text"
                value={editName}
                onChange={e => setEditName(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">버전 라벨</label>
              <input
                type="text"
                value={editVersion}
                onChange={e => setEditVersion(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button onClick={() => setEditTarget(null)} className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">취소</button>
            <button onClick={handleEdit} disabled={busyId !== null} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">저장</button>
          </div>
        </div>
      </div>
    )}

    {/* 삭제 확인 모달 */}
    {deleteTarget && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
        <div className="w-full max-w-sm rounded-xl bg-white shadow-xl p-6 space-y-4">
          <h3 className="text-base font-semibold text-gray-900">모델 삭제</h3>
          <p className="text-sm text-gray-600">
            <span className="font-semibold">{deleteTarget.model_name} {deleteTarget.version}</span>을 레지스트리에서 삭제합니다. 파일은 그대로 유지됩니다.
          </p>
          <div className="flex justify-end gap-2 pt-1">
            <button onClick={() => setDeleteTarget(null)} className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">취소</button>
            <button onClick={handleDelete} disabled={busyId !== null} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50">삭제</button>
          </div>
        </div>
      </div>
    )}

    <Layout title={title} titleActions={titleActions}>
      <div className="space-y-4">

        {error && (
          <div className="rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Stat label="버전 수" value={`${versions.length}개`} />
          <Stat label="운영 버전" value={selected?.version ?? '지정 없음'} />
          <Stat label="실행 가능" value={`${versions.filter(v => v.metrics?.validation_status === 'READY').length}개`} />
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
          <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
            <div className="border-b border-gray-100 px-4 py-3">
              <p className="text-sm font-bold text-gray-800">버전 목록</p>
            </div>
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {['Version', '상태', '검증', '파일', '방식', '갱신', 'Actions'].map(header => (
                    <th key={header} className="px-3 py-3 text-left text-xs font-semibold text-gray-500">{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {versions.map(model => {
                  const fileCount = model.metrics?.file_count ?? 0;
                  const expected = model.metrics?.expected_file_count ?? 0;
                  const isBusy = busyId === model.id;
                  const isReady = model.metrics?.validation_status === 'READY';
                  const isSelected = normalizeStatus(model.status) === 'SELECTED';
                  return (
                    <tr
                      key={model.id}
                      onClick={() => setActiveId(model.id)}
                      className={`cursor-pointer border-b border-gray-50 transition hover:bg-gray-50 ${active?.id === model.id ? 'bg-blue-50/50' : ''}`}
                    >
                      <td className="px-3 py-3 font-mono text-xs font-semibold text-blue-700">{model.version}</td>
                      <td className="px-3 py-3"><StatusBadge status={model.status} /></td>
                      <td className="px-3 py-3"><ValidationBadge model={model} /></td>
                      <td className="px-3 py-3 text-gray-600">{fileCount}/{expected}</td>
                      <td className="px-3 py-3 text-gray-600">{getArchitecture(model)}</td>
                      <td className="px-3 py-3 text-xs text-gray-400">{formatModelDateTime(model.created_at)}</td>
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap gap-1.5">
                          {!isSelected && (
                            <button
                              onClick={event => { event.stopPropagation(); runAction(model.id, 'select'); }}
                              disabled={isBusy || !isReady}
                              className="rounded-md border border-emerald-200 bg-white px-2 py-1 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-50 disabled:opacity-40"
                            >
                              운영 지정
                            </button>
                          )}
                          <button
                            onClick={event => { event.stopPropagation(); setEditTarget(model); setEditName(model.model_name ?? ''); setEditVersion(model.version ?? ''); }}
                            disabled={isBusy}
                            className="rounded-md border border-blue-100 bg-white px-2 py-1 text-xs font-semibold text-blue-600 transition hover:bg-blue-50 disabled:opacity-50"
                          >
                            수정
                          </button>
                          {!isSelected && (
                            <button
                              onClick={event => { event.stopPropagation(); setDeleteTarget(model); }}
                              disabled={isBusy}
                              className="rounded-md border border-red-100 bg-white px-2 py-1 text-xs font-semibold text-red-500 transition hover:bg-red-50 disabled:opacity-50"
                            >
                              삭제
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="rounded-lg border border-gray-200 bg-white">
            <div className="border-b border-gray-100 px-4 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-bold text-gray-800">선택 버전 상세</p>
                {active && <span className="font-mono text-xs font-semibold text-blue-700">{active.version}</span>}
                {active && <StatusBadge status={active.status} />}
                {active && <ValidationBadge model={active} />}
              </div>
            </div>

            {active ? (
              <div className="grid gap-3 p-4">
                <Detail label="모델 경로" value={active.model_path ?? '-'} />
                <Detail label="Runner" value={String(active.metrics?.runner_version ?? '-')} />
                <Detail label="파일 패턴" value={String(active.metrics?.model_file_pattern ?? '-')} />
                <Detail label="마지막 검증" value={active.metrics?.validated_at ?? '-'} />
                <Detail label="누락 파일" value={(active.metrics?.missing_files ?? []).join(', ') || '없음'} />
              </div>
            ) : (
              <div className="p-10 text-center text-sm text-gray-400">선택된 모델이 없습니다.</div>
            )}
          </div>
        </div>
      </div>
    </Layout>
    </>
  );
}
