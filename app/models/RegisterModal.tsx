'use client';

import { useEffect, useRef, useState } from 'react';
import { uploadModelFile } from '@/lib/api';

interface Props {
  onClose: () => void;
  onDone: () => void;
}

type Architecture = 'single' | 'multi';

const MULTI_COUNT = 18;

export default function RegisterModal({ onClose, onDone }: Props) {
  const [architecture, setArchitecture] = useState<Architecture>('single');
  const [files, setFiles] = useState<File[]>([]);
  const [versionLabel, setVersionLabel] = useState('');
  const [modelName, setModelName] = useState('KICT-RAIN-AI');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadDone, setUploadDone] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const backdropRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handler = (e: MouseEvent) => { if (e.target === backdropRef.current) onClose(); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  // 아키텍처 바뀌면 파일 초기화
  useEffect(() => { setFiles([]); if (fileInputRef.current) fileInputRef.current.value = ''; }, [architecture]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFiles(Array.from(e.target.files ?? []));
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setFiles(Array.from(e.dataTransfer.files));
  };

  const isFileCountValid = architecture === 'single' ? files.length === 1 : files.length === MULTI_COUNT;
  const fileCountLabel = architecture === 'single'
    ? `${files.length} / 1 파일`
    : `${files.length} / ${MULTI_COUNT} 파일`;
  const fileCountColor = files.length === 0 ? 'text-gray-400' : isFileCountValid ? 'text-emerald-600' : 'text-amber-600';

  const handleUpload = async () => {
    if (!isFileCountValid || !versionLabel.trim() || !modelName.trim()) return;
    setUploading(true);
    setUploadError(null);
    try {
      await uploadModelFile({ files, versionLabel: versionLabel.trim(), modelName: modelName.trim(), architecture });
      setUploadDone(true);
      onDone();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : '업로드 실패');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div ref={backdropRef} className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-lg rounded-xl bg-white shadow-xl" onClick={e => e.stopPropagation()}>

        {/* 헤더 */}
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <h2 className="text-base font-semibold text-gray-900">모델 등록</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-4">
          {uploadDone ? (
            <div className="py-8 text-center">
              <svg className="mx-auto h-10 w-10 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <p className="mt-2 text-sm font-semibold text-gray-700">업로드 완료</p>
            </div>
          ) : (
            <>
              {/* 아키텍처 선택 */}
              <div>
                <p className="mb-2 text-xs font-medium text-gray-700">아키텍처</p>
                <div className="flex gap-3">
                  {(['single', 'multi'] as Architecture[]).map(arch => (
                    <label
                      key={arch}
                      className={`flex flex-1 cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 transition-colors ${
                        architecture === arch ? 'border-blue-300 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="architecture"
                        value={arch}
                        checked={architecture === arch}
                        onChange={() => setArchitecture(arch)}
                        className="accent-blue-600"
                      />
                      <div>
                        <p className="text-sm font-semibold text-gray-800 capitalize">{arch}</p>
                        <p className="text-xs text-gray-400">{arch === 'single' ? '파일 1개' : `파일 ${MULTI_COUNT}개`}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* 파일 드롭존 */}
              <div
                onDragOver={e => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 px-6 py-6 text-center transition hover:border-blue-400 hover:bg-blue-50"
              >
                <svg className="h-7 w-7 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                </svg>
                {files.length > 0 ? (
                  <p className={`mt-2 text-sm font-semibold ${fileCountColor}`}>{fileCountLabel}</p>
                ) : (
                  <>
                    <p className="mt-2 text-sm text-gray-600">파일을 드래그하거나 클릭해서 선택</p>
                    <p className="mt-1 text-xs text-gray-400">
                      {architecture === 'single' ? '.tflite 파일 1개' : `.tflite 파일 ${MULTI_COUNT}개 동시 선택`}
                    </p>
                  </>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple={architecture === 'multi'}
                  accept=".tflite,.pt,.pth,.onnx,.h5"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </div>

              {/* 파일 수 경고 */}
              {files.length > 0 && !isFileCountValid && (
                <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
                  {architecture === 'single'
                    ? '파일을 1개만 선택해주세요.'
                    : `${MULTI_COUNT}개 파일이 필요합니다. 현재 ${files.length}개 선택됨.`}
                </p>
              )}

              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">버전 라벨 <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={versionLabel}
                    onChange={e => setVersionLabel(e.target.value)}
                    placeholder="예: v4, custom-01"
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">모델명 <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={modelName}
                    onChange={e => setModelName(e.target.value)}
                    placeholder="예: KICT-RAIN-AI"
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100"
                  />
                </div>
              </div>

              {uploadError && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{uploadError}</p>}

              <div className="flex justify-end pt-2">
                <button
                  onClick={handleUpload}
                  disabled={!isFileCountValid || !versionLabel.trim() || !modelName.trim() || uploading}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-40"
                >
                  {uploading ? '업로드 중...' : '업로드'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
