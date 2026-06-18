'use client';

import { useEffect, useState } from 'react';

interface FolderEntry {
  name: string;
  path: string;
}

interface FolderResponse {
  currentPath: string;
  parentPath: string | null;
  roots: string[];
  folders: FolderEntry[];
}

function FieldLabel({ children, required = false }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="text-xs font-medium text-gray-600 block mb-1.5">
      {children} {required && <span className="text-red-500">*</span>}
    </label>
  );
}

export function DatasetPathButton({
  label,
  value,
  required = false,
  optional = false,
  placeholder = '선택 필요',
  onPick,
}: {
  label: string;
  value: string;
  required?: boolean;
  optional?: boolean;
  placeholder?: string;
  onPick: () => void;
}) {
  return (
    <div>
      <FieldLabel required={required}>
        {label} {optional && <span className="text-gray-400 font-normal">(선택)</span>}
      </FieldLabel>
      <button
        type="button"
        onClick={onPick}
        className="w-full min-h-10 px-3 py-2 rounded-lg border border-gray-200 bg-white text-left text-sm text-gray-900 hover:border-blue-300 hover:bg-blue-50/40 transition flex items-center gap-3"
      >
        <span className={`font-mono flex-1 break-all ${value ? 'text-gray-900' : 'text-gray-400'}`}>
          {value || placeholder}
        </span>
        <span className="px-2 py-1 rounded-md bg-gray-100 text-gray-600 text-xs font-semibold whitespace-nowrap">경로 찾기</span>
      </button>
    </div>
  );
}

export function DatasetFolderPicker({
  title,
  current,
  onSelect,
  onClose,
}: {
  title: string;
  current: string;
  onSelect: (path: string) => void;
  onClose: () => void;
}) {
  const [data, setData] = useState<FolderResponse | null>(null);
  const [selected, setSelected] = useState(current);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadFolders = async (folderPath?: string) => {
    setLoading(true);
    setError(null);
    try {
      const params = folderPath ? `?path=${encodeURIComponent(folderPath)}` : '';
      const res = await fetch(`/api/local-folders${params}`, { cache: 'no-store' });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.detail ?? '폴더 목록을 읽지 못했습니다.');
      setData(body);
      setSelected(body.currentPath);
    } catch (err) {
      setError(err instanceof Error ? err.message : '폴더 목록을 읽지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFolders(current || undefined);
  }, [current]);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <button className="absolute inset-0 bg-black/40" onClick={onClose} aria-label="닫기" />
      <div className="relative z-10 w-full max-w-2xl mx-4 bg-white rounded-lg shadow-2xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-gray-900">{title}</h2>
            <p className="text-xs text-gray-500 mt-0.5">현재 PC의 데이터셋 폴더</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100">
            <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
              <path d="M2 2l12 12M14 2L2 14" />
            </svg>
          </button>
        </div>

        <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
          <p className="text-xs text-gray-500 mb-1">현재 위치</p>
          <div className="flex items-center gap-2">
            <p className="flex-1 font-mono text-sm text-gray-800 break-all">{data?.currentPath ?? '-'}</p>
            {data?.parentPath && (
              <button
                type="button"
                onClick={() => loadFolders(data.parentPath ?? undefined)}
                className="px-2 py-1 text-xs font-semibold text-gray-600 border border-gray-200 rounded-md bg-white hover:bg-gray-100"
              >
                상위
              </button>
            )}
          </div>
        </div>

        {data?.roots && data.roots.length > 1 && (
          <div className="px-5 py-3 border-b border-gray-100 flex flex-wrap gap-2">
            {data.roots.map(root => (
              <button
                key={root}
                type="button"
                onClick={() => loadFolders(root)}
                className="px-2 py-1 rounded-md bg-gray-100 text-gray-600 text-xs font-mono hover:bg-gray-200"
              >
                {root}
              </button>
            ))}
          </div>
        )}

        <div className="p-5 space-y-2 max-h-[420px] overflow-y-auto">
          {loading && (
            <div className="py-10 flex items-center justify-center text-gray-400 text-sm">
              <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mr-2" />
              폴더 목록 로딩 중...
            </div>
          )}

          {!loading && error && (
            <div className="py-10 text-center text-sm text-red-500">{error}</div>
          )}

          {!loading && !error && data?.folders.length === 0 && (
            <div className="py-10 text-center text-sm text-gray-400">하위 폴더가 없습니다.</div>
          )}

          {!loading && !error && data?.folders.map(folder => (
            <button
              key={folder.path}
              type="button"
              onClick={() => loadFolders(folder.path)}
              className={`w-full text-left px-3 py-3 rounded-lg border transition ${
                selected === folder.path
                  ? 'border-blue-300 bg-blue-50 text-blue-800'
                  : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center gap-2">
                <svg viewBox="0 0 24 24" className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
                </svg>
                <span className="font-mono text-sm break-all">{folder.name}</span>
              </div>
            </button>
          ))}
        </div>

        <div className="px-5 py-4 border-t border-gray-100 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            취소
          </button>
          <button
            type="button"
            onClick={() => { onSelect(selected); onClose(); }}
            disabled={!selected || loading}
            className="px-5 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            현재 폴더 선택
          </button>
        </div>
      </div>
    </div>
  );
}
