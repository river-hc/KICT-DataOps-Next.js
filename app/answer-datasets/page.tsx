'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Layout from '@/lib/Layout';
import {
  getAnswerDatasets, createAnswerDataset, deleteAnswerDataset,
  type AnswerDataset,
} from '@/lib/api';
import { SkeletonStatCards, SkeletonTableRows } from '@/lib/Skeleton';

function formatDateTime(value: string | null): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

// ─── 업로드 모달 ────────────────────────────────────────────────────────────────

function UploadModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const backdropRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadDone, setUploadDone] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleFiles = (fileList: FileList | null) => {
    if (!fileList) return;
    const ascFiles = Array.from(fileList).filter(file => file.name.toLowerCase().endsWith('.asc'));
    setFiles(ascFiles);
  };

  const handleSubmit = async () => {
    if (!name.trim()) { setUploadError('이름을 입력해주세요.'); return; }
    if (files.length === 0) { setUploadError('ASC 파일을 최소 1개 이상 선택해주세요.'); return; }
    setUploading(true); setUploadError(null);
    try {
      await createAnswerDataset({ name: name.trim(), description: description.trim() || null, files });
      setUploadDone(true);
      onDone();
      setTimeout(onClose, 800);
    } catch (e: unknown) {
      setUploadError(e instanceof Error ? e.message : '업로드에 실패했습니다.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onMouseDown={e => { if (e.target === backdropRef.current) onClose(); }}
    >
      <div className="w-full max-w-lg mx-4 rounded-xl bg-white shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <h3 className="text-base font-semibold text-gray-900">정답 데이터셋 업로드</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
              <path d="M2 2l12 12M14 2L2 14" />
            </svg>
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">이름 <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="예: 2022-08-verification"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">설명 (선택)</label>
            <input
              type="text"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="메모"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">ASC 파일 <span className="text-red-500">*</span></label>
            <div
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); handleFiles(e.dataTransfer.files); }}
              onClick={() => fileInputRef.current?.click()}
              className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 px-6 py-6 text-center transition hover:border-blue-400 hover:bg-blue-50"
            >
              <p className="text-sm text-gray-600">클릭하거나 파일을 끌어다 놓으세요</p>
              <p className="mt-1 text-xs text-gray-400">.asc 파일만 인식됩니다</p>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".asc"
                onChange={e => handleFiles(e.target.files)}
                className="hidden"
              />
            </div>
            {files.length > 0 && (
              <p className="mt-2 text-xs text-gray-500">{files.length}개 파일 선택됨</p>
            )}
          </div>

          {uploadError && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{uploadError}</p>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-gray-100 px-6 py-4">
          <button onClick={onClose} className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">취소</button>
          <button
            onClick={handleSubmit}
            disabled={uploading || uploadDone}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-40"
          >
            {uploading && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
            {uploadDone ? '업로드 완료' : uploading ? '업로드 중...' : '업로드'}
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

export default function AnswerDatasetsPage() {
  const [datasets, setDatasets] = useState<AnswerDataset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AnswerDataset | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [page, setPage] = useState(1);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      setDatasets(await getAnswerDatasets());
    } catch (err) {
      setError(err instanceof Error ? err.message : '정답 데이터셋 목록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const totalFiles = datasets.reduce((sum, d) => sum + d.file_count, 0);
  const totalPages = Math.max(1, Math.ceil(datasets.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedDatasets = datasets.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const pagination = pageItems(totalPages, safePage);

  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setBusyId(deleteTarget.id);
    try {
      await deleteAnswerDataset(deleteTarget.id);
      setDeleteTarget(null);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : '삭제에 실패했습니다.');
    } finally {
      setBusyId(null);
    }
  };

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
      onClick={() => setShowUpload(true)}
      className="inline-flex items-center gap-2 rounded-lg bg-gray-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-gray-800"
    >
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
      </svg>
      데이터셋 업로드
    </button>
  );

  return (
    <>
      {showUpload && <UploadModal onClose={() => setShowUpload(false)} onDone={refresh} />}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-sm rounded-xl bg-white shadow-xl p-6 space-y-4">
            <h3 className="text-base font-semibold text-gray-900">정답 데이터셋 삭제</h3>
            <p className="text-sm text-gray-600">
              <span className="font-semibold">{deleteTarget.name}</span>을 삭제합니다.
              등록 정보와 <span className="font-mono text-xs">{deleteTarget.path}</span> 폴더의 파일이 함께 삭제되며 되돌릴 수 없습니다.
            </p>
            <p className="text-xs text-gray-400">이미 이 데이터셋으로 실행된 과거 결과에는 영향이 없습니다.</p>
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setDeleteTarget(null)} className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">취소</button>
              <button
                onClick={handleDelete}
                disabled={busyId !== null}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                삭제
              </button>
            </div>
          </div>
        </div>
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
              <p className="text-xs font-medium text-gray-500">등록된 데이터셋</p>
              <p className="mt-1 text-2xl font-bold text-gray-950">{datasets.length}</p>
            </div>
            <div className="rounded-lg border border-gray-200 bg-white px-4 py-3">
              <p className="text-xs font-medium text-gray-500">전체 파일 수</p>
              <p className="mt-1 text-2xl font-bold text-gray-950">{totalFiles}</p>
            </div>
          </div>

          {datasets.length === 0 ? (
            <div className="rounded-lg border border-gray-200 bg-white p-8">
              <div className="mx-auto max-w-lg space-y-3 text-center">
                <svg className="mx-auto h-8 w-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <circle cx="12" cy="12" r="9" /><path d="M8 12l3 3 5-6" />
                </svg>
                <p className="font-semibold text-gray-700">등록된 정답 데이터셋이 없습니다</p>
                <p className="text-sm text-gray-400">
                  우측 상단 <strong>데이터셋 업로드</strong> 버튼을 누르거나, 서버의 정답 데이터 폴더 아래에 하위 폴더를 만들어
                  ASC 파일을 넣으면 자동으로 인식됩니다.
                </p>
              </div>
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="border-b border-gray-100 bg-gray-50">
                  <tr>
                    {['이름', '경로', '파일 수', '등록일', ''].map(header => (
                      <th key={header} className="px-4 py-3 text-left text-xs font-semibold text-gray-500">{header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pagedDatasets.map(dataset => (
                    <tr key={dataset.id} className="h-[52px] border-b border-gray-50 transition hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="truncate font-semibold text-gray-950">{dataset.name}</div>
                        {dataset.description && (
                          <div className="mt-0.5 truncate text-xs text-gray-400" title={dataset.description}>{dataset.description}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 max-w-[260px] truncate font-mono text-xs text-gray-500" title={dataset.path}>{dataset.path}</td>
                      <td className="px-4 py-3 text-gray-600">{dataset.file_count}개</td>
                      <td className="px-4 py-3 text-xs text-gray-400">{formatDateTime(dataset.created_at)}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => setDeleteTarget(dataset)}
                          disabled={busyId !== null}
                          className="rounded-md border border-red-100 bg-white px-2 py-1 text-xs font-semibold text-red-500 transition hover:bg-red-50 disabled:opacity-50"
                        >
                          삭제
                        </button>
                      </td>
                    </tr>
                  ))}
                  {datasets.length > PAGE_SIZE && pagedDatasets.length < PAGE_SIZE &&
                    Array.from({ length: PAGE_SIZE - pagedDatasets.length }).map((_, i) => (
                      <tr key={`filler-${i}`} className="h-[52px] border-b border-gray-50">
                        <td colSpan={5} className="px-4 py-3">&nbsp;</td>
                      </tr>
                    ))}
                </tbody>
              </table>

              {datasets.length > PAGE_SIZE && (
                <div className="flex h-12 items-center justify-center border-t border-gray-100 px-5 text-xs text-gray-500">
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
            </div>
          )}
        </div>
      </Layout>
    </>
  );
}
