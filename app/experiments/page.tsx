'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '@/lib/Layout';
import { getExperimentJobs, getExperiments, createExperimentGroup, updateExperiment, deleteExperiment, type TrainingJob, type Experiment } from '@/lib/api';
import { SkeletonTableRows } from '@/lib/Skeleton';

// ─── 상태 요약 계산 ───────────────────────────────────────────────────────────

interface StatusCounts { RUNNING: number; QUEUED: number; COMPLETED: number; FAILED: number; }

function calcStatusCounts(tcJobs: TrainingJob[]): StatusCounts {
  const c: StatusCounts = { RUNNING: 0, QUEUED: 0, COMPLETED: 0, FAILED: 0 };
  for (const j of tcJobs) {
    const s = j.status.toUpperCase();
    if (s === 'RUNNING') c.RUNNING++;
    else if (s === 'QUEUED') c.QUEUED++;
    else if (s === 'COMPLETED') c.COMPLETED++;
    else if (s === 'FAILED' || s === 'CANCELED') c.FAILED++;
  }
  return c;
}

function StatusSummary({ counts, total }: { counts: StatusCounts; total: number }) {
  if (total === 0) return <span className="text-xs text-gray-300">테스트케이스 없음</span>;
  const items = [
    { key: 'RUNNING',   label: '실행 중', cls: 'text-emerald-700 bg-emerald-50' },
    { key: 'QUEUED',    label: '대기',    cls: 'text-amber-700 bg-amber-50' },
    { key: 'COMPLETED', label: '완료',    cls: 'text-blue-700 bg-blue-50' },
    { key: 'FAILED',    label: '실패',    cls: 'text-red-700 bg-red-50' },
  ] as { key: keyof StatusCounts; label: string; cls: string }[];
  const visible = items.filter(i => counts[i.key] > 0);
  return (
    <div className="flex items-center gap-1.5 flex-nowrap">
      {visible.map(i => (
        <span key={i.key} className={`whitespace-nowrap text-[11px] font-semibold px-1.5 py-0.5 rounded ${i.cls}`}>
          {i.label} {counts[i.key]}
        </span>
      ))}
    </div>
  );
}

// ─── 새 실험 환경 모달 ────────────────────────────────────────────────────────

function NewExperimentEnvModal({
  onClose, onSave,
}: {
  onClose: () => void;
  onSave: (name: string, desc: string) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!name.trim() || saving) return;
    setSaving(true);
    setError(null);
    try {
      await onSave(name.trim(), desc.trim());
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : '실험 생성에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md mx-4 bg-white rounded-2xl shadow-2xl flex flex-col">
        <div className="flex items-start justify-between px-6 py-5 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-bold text-gray-900">새 실험 환경</h2>
            <p className="text-xs text-gray-400 mt-0.5">실험 환경을 생성한 후 테스트케이스를 추가할 수 있습니다.</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 mt-0.5">
            <svg viewBox="0 0 16 16" className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
              <path d="M2 2l12 12M14 2L2 14" />
            </svg>
          </button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1.5">실험 이름</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && submit()}
              placeholder="예: 2026년 7월 QPF 검증"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1.5">설명 <span className="text-gray-400 font-normal">(선택)</span></label>
            <textarea
              value={desc}
              onChange={e => setDesc(e.target.value)}
              rows={3}
              placeholder="실험 목적, 조건, 비교할 모델 버전 등"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
          {error && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>
          )}
        </div>
        <div className="border-t border-gray-100 px-6 py-4 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
            취소
          </button>
          <button
            onClick={submit}
            disabled={!name.trim() || saving}
            className="px-5 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {saving ? '생성 중...' : '생성'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── 페이지네이션 ─────────────────────────────────────────────────────────────

const PAGE_SIZE = 10;
type PageItem = number | 'ellipsis-start' | 'ellipsis-end';

function pageItems(totalPages: number, currentPage: number): PageItem[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  const items: PageItem[] = [1];
  const start = Math.max(2, currentPage - 1);
  const end = Math.min(totalPages - 1, currentPage + 1);
  if (start > 2) items.push('ellipsis-start');
  for (let i = start; i <= end; i += 1) items.push(i);
  if (end < totalPages - 1) items.push('ellipsis-end');
  items.push(totalPages);
  return items;
}

// ─── 메인 페이지 ──────────────────────────────────────────────────────────────

const POLL_MS = 3000;

export default function ExperimentsPage() {
  const router = useRouter();
  const [showModal,   setShowModal]   = useState(false);
  const [expJobs,     setExpJobs]     = useState<TrainingJob[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [page,        setPage]        = useState(1);
  const [editingExpId, setEditingExpId] = useState<number | null>(null);
  const [nameDraft,    setNameDraft]    = useState('');
  const [savingName,   setSavingName]   = useState(false);
  const [deletingId,   setDeletingId]   = useState<number | null>(null);
  const [rowError,     setRowError]     = useState<string | null>(null);

  // 실험 목록 (서버 기준 — 브라우저/계정과 무관하게 항상 동일)
  const fetchExperiments = useCallback(() => {
    getExperiments().then(setExperiments).catch(() => setExperiments([]));
  }, []);

  useEffect(() => { fetchExperiments(); }, [fetchExperiments]);

  // 실 백엔드 작업 목록 (experiment_id로 실험과 연결됨 — 서버 기준)
  const fetchJobs = useCallback(() => {
    getExperimentJobs()
      .then(data => setExpJobs(data))
      .catch(() => setExpJobs([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchJobs(); }, [fetchJobs]);

  useEffect(() => {
    const hasActive = expJobs.some(j => ['RUNNING', 'QUEUED'].includes(j.status.toUpperCase()));
    if (!hasActive) return;
    const id = setInterval(() => getExperimentJobs().then(setExpJobs).catch(() => {}), POLL_MS);
    return () => clearInterval(id);
  }, [expJobs]);

  const allExps = experiments;
  const totalPages = Math.max(1, Math.ceil(allExps.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedExps = allExps.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const pagination = pageItems(totalPages, safePage);

  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);

  async function handleCreateExp(name: string, desc: string) {
    const created = await createExperimentGroup(name, desc || null);
    setExperiments(prev => [created, ...prev]);
    router.push(`/experiments/${created.id}`);
  }

  async function handleSaveExpName(expId: number) {
    if (!nameDraft.trim()) return;
    setSavingName(true);
    setRowError(null);
    try {
      const updated = await updateExperiment(expId, { name: nameDraft.trim() });
      setExperiments(prev => prev.map(e => (e.id === expId ? updated : e)));
      setEditingExpId(null);
    } catch (err) {
      setRowError(err instanceof Error ? err.message : '이름 수정에 실패했습니다.');
    } finally {
      setSavingName(false);
    }
  }

  async function handleDeleteExperiment(expId: number, name: string) {
    if (!window.confirm(`"${name}" 실험을 삭제할까요? 테스트케이스가 남아있으면 삭제할 수 없습니다.`)) return;
    setDeletingId(expId);
    setRowError(null);
    try {
      await deleteExperiment(expId);
      setExperiments(prev => prev.filter(e => e.id !== expId));
    } catch (err) {
      setRowError(err instanceof Error ? err.message : '삭제에 실패했습니다.');
    } finally {
      setDeletingId(null);
    }
  }

  function fmtDt(iso: string | null) {
    if (!iso) return '-';
    return new Date(iso).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  }

  const titleActions = (
    <button
      onClick={() => setShowModal(true)}
      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition shadow-sm"
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
      </svg>
      새 실험
    </button>
  );

  return (
    <Layout titleActions={titleActions}>
      {showModal && (
        <NewExperimentEnvModal
          onClose={() => setShowModal(false)}
          onSave={handleCreateExp}
        />
      )}

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <span className="text-sm font-semibold text-gray-700">실험 환경 목록</span>
          {loading && <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />}
        </div>

        {rowError && (
          <div className="px-5 py-2 text-xs text-red-600 bg-red-50 border-b border-red-100">{rowError}</div>
        )}

        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              {['실험 이름', '생성자', '설명', '테스트케이스 수', '상태', '최근 테스트케이스', ''].map(h => (
                <th key={h} className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && allExps.length === 0 && <SkeletonTableRows rows={5} cols={7} />}
            {pagedExps.map(exp => {
              // 테스트케이스 = 이 실험에 서버가 직접 연결해둔 job (experiment_id 기준)
              const tcJobs   = expJobs.filter(j => j.experiment_id === exp.id);
              const tcCount  = tcJobs.length;
              const counts   = calcStatusCounts(tcJobs);
              const latestTs = tcJobs.reduce<string | null>((acc, j) => {
                const ts = j.finished_at ?? j.started_at ?? j.created_at;
                return !acc || (ts && ts > acc) ? ts : acc;
              }, null);

              return (
                <tr
                  key={exp.id}
                  onClick={() => router.push(`/experiments/${exp.id}`)}
                  className="h-[52px] cursor-pointer border-b border-gray-100 hover:bg-gray-50 transition-colors"
                >
                  <td className="px-5 py-3">
                    {editingExpId === exp.id ? (
                      <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                        <input
                          value={nameDraft}
                          onChange={e => setNameDraft(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && handleSaveExpName(exp.id)}
                          className="w-40 rounded-lg border border-gray-200 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          autoFocus
                        />
                        <button
                          onClick={() => handleSaveExpName(exp.id)}
                          disabled={savingName || !nameDraft.trim()}
                          className="flex-shrink-0 text-xs font-semibold text-blue-600 hover:underline disabled:opacity-40"
                        >
                          저장
                        </button>
                        <button onClick={() => setEditingExpId(null)} className="flex-shrink-0 text-xs text-gray-400 hover:underline">
                          취소
                        </button>
                      </div>
                    ) : (
                      <span className="font-semibold text-blue-600 text-sm">{exp.name}</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-gray-500 text-xs font-mono whitespace-nowrap">
                    {exp.created_by || '-'}
                  </td>
                  <td className="px-5 py-3 text-gray-500 text-sm max-w-[280px]">
                    <span className="line-clamp-1">{exp.description || '-'}</span>
                  </td>
                  <td className="px-5 py-3">
                    <span className="font-mono text-sm text-gray-700">{tcCount > 0 ? `${tcCount}개` : '-'}</span>
                  </td>
                  <td className="px-5 py-3">
                    <StatusSummary counts={counts} total={tcCount} />
                  </td>
                  <td className="px-5 py-3 text-gray-400 text-xs whitespace-nowrap">
                    {fmtDt(latestTs)}
                  </td>
                  <td className="px-5 py-3" onClick={e => e.stopPropagation()}>
                    {editingExpId !== exp.id && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => { setNameDraft(exp.name); setEditingExpId(exp.id); }}
                          className="text-gray-300 hover:text-gray-600"
                          aria-label="이름 수정"
                          title="이름 수정"
                        >
                          <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
                            <path d="M13.5 3.5l3 3L6 17l-4 1 1-4L13.5 3.5z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDeleteExperiment(exp.id, exp.name)}
                          disabled={deletingId === exp.id}
                          className="text-red-500 hover:text-red-600 disabled:opacity-40"
                          aria-label="실험 삭제"
                          title="실험 삭제"
                        >
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.9} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 7h12M10 11v6m4-6v6M9 7l1-2h4l1 2m-8 0 1 13h8l1-13" />
                          </svg>
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
            {allExps.length > PAGE_SIZE && pagedExps.length < PAGE_SIZE &&
              Array.from({ length: PAGE_SIZE - pagedExps.length }).map((_, i) => (
                <tr key={`filler-${i}`} className="h-[52px] border-b border-gray-100">
                  <td colSpan={7} className="px-5 py-3">&nbsp;</td>
                </tr>
              ))}
          </tbody>
        </table>

        {allExps.length === 0 && !loading && (
          <div className="py-16 text-center text-gray-400 text-sm">등록된 실험이 없습니다.</div>
        )}

        {allExps.length > PAGE_SIZE && (
          <div className="h-12 flex items-center justify-center border-t border-gray-100 px-5 text-xs text-gray-500">
            <div className="flex items-center gap-2">
              {pagination.map(item => (
                typeof item === 'number' ? (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setPage(item)}
                    className={`min-w-5 px-1 py-1 transition-colors ${
                      item === safePage
                        ? 'font-semibold text-blue-600 underline underline-offset-4'
                        : 'text-gray-500 hover:text-blue-600'
                    }`}
                  >
                    {item}
                  </button>
                ) : (
                  <span key={item} className="px-1 text-gray-300">...</span>
                )
              ))}
            </div>
          </div>
        )}

        <div className="px-5 py-2.5 border-t border-gray-100 text-xs text-gray-400">
          총 {allExps.length}개 실험
        </div>
      </div>
    </Layout>
  );
}
