'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  getAnswerDatasets, createAnswerDataset, deleteAnswerDatasets, downloadAnswerDatasetsUrl,
  type AnswerDataset,
} from '@/lib/api';
import { SkeletonTableRows } from '@/lib/Skeleton';

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

// ─── 정답데이터 탭 패널 ────────────────────────────────────────────────────────
// 예전엔 좌측 메뉴에 "정답 데이터"가 따로 있었는데, 데이터 수집 화면과 항상 같이 오가며
// 쓰는 기능이라 여기 탭 안으로 옮겼다(별도 메뉴 제거). "입력데이터" 탭(TrainingDatasetManagementPanel)과
// 형태를 통일했다 — 체크박스 선택 + 선택 다운로드/삭제, 같은 카드 레이아웃.

export default function AnswerDatasetsPanel({ path }: { path?: string }) {
  const [datasets, setDatasets] = useState<AnswerDataset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [deleting, setDeleting] = useState(false);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const list = await getAnswerDatasets();
      setDatasets(list);
      const ids = new Set(list.map(d => d.id));
      setSelectedIds(prev => prev.filter(id => ids.has(id)));
    } catch (err) {
      setError(err instanceof Error ? err.message : '정답 데이터셋 목록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const toggleSelected = (id: number) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]);
  };

  const handleDownload = () => {
    if (selectedIds.length === 0) return;
    const link = document.createElement('a');
    link.href = downloadAnswerDatasetsUrl(selectedIds);
    link.download = 'answer_datasets.zip';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDelete = async () => {
    if (selectedIds.length === 0) return;
    if (!window.confirm(`선택한 정답 데이터셋 ${selectedIds.length}개를 삭제할까요? 폴더의 파일도 함께 삭제되며 되돌릴 수 없습니다.`)) return;
    setDeleting(true);
    setError(null);
    try {
      await deleteAnswerDatasets(selectedIds);
      setSelectedIds([]);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : '삭제에 실패했습니다.');
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <table className="w-full min-w-[760px] text-sm">
          <tbody>
            <SkeletonTableRows rows={5} cols={5} />
          </tbody>
        </table>
      </div>
    );
  }

  const selectedCount = selectedIds.length;

  return (
    <>
      {showUpload && <UploadModal onClose={() => setShowUpload(false)} onDone={refresh} />}

      <div className="space-y-4">
        {error && (
          <div className="rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="rounded-lg border border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between gap-4 border-b border-gray-200 px-4 py-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">정답데이터 관리</p>
              <p className="mt-1 break-all font-mono text-xs text-gray-700">{path ?? '폴더 확인 중'}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded bg-white px-2 py-1 text-xs font-semibold text-gray-700 ring-1 ring-gray-200">
                {datasets.length}개
              </span>
              <button
                onClick={() => setShowUpload(true)}
                className="rounded border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-50"
              >
                업로드
              </button>
              <button
                onClick={handleDownload}
                disabled={selectedCount === 0}
                className="rounded bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                선택 다운로드
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting || selectedCount === 0}
                className="rounded border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {deleting ? '삭제 중' : '삭제'}
              </button>
            </div>
          </div>

          <div className="px-4 py-3">
            {datasets.length === 0 ? (
              <div className="flex h-28 items-center justify-center rounded border border-dashed border-gray-200 bg-white text-xs text-gray-400">
                등록된 정답 데이터셋이 없습니다. 위 버튼으로 업로드하거나, 폴더에 ASC 파일을 넣으면 자동 인식됩니다.
              </div>
            ) : (
              <div className="max-h-[520px] overflow-auto rounded border border-gray-200 bg-white">
                {datasets.map(dataset => {
                  const selected = selectedIds.includes(dataset.id);
                  return (
                    <div key={dataset.id} className="border-b border-gray-100 last:border-b-0">
                      <div className="grid gap-3 px-3 py-3 md:grid-cols-[auto_minmax(0,1fr)_auto] md:items-center">
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => toggleSelected(dataset.id)}
                          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-gray-800">{dataset.name}</p>
                          <p className="mt-1 text-[11px] text-gray-400">
                            {dataset.file_count}개 파일 · {formatDateTime(dataset.created_at)}
                            {dataset.description ? ` · ${dataset.description}` : ''}
                          </p>
                          <p className="mt-1 truncate font-mono text-[11px] text-gray-400">{dataset.path}</p>
                        </div>
                        <span className="hidden text-[11px] text-gray-300 md:block">#{dataset.id}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
