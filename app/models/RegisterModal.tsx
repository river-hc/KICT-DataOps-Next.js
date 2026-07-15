'use client';

import { useEffect, useRef, useState } from 'react';
import {
  getModelCandidates,
  registerModelVersions,
  uploadModelFile,
  type ModelCandidate,
} from '@/lib/api';

interface Props {
  onClose: () => void;
  onDone: () => void;
  modelBasePath: string;
}

type Tab = 'scan' | 'upload';
type Architecture = 'single' | 'multi';

const MULTI_COUNT = 18;

function ValidationBadge({ status }: { status: string }) {
  if (status === 'READY')
    return <span className="rounded-md border border-emerald-100 bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">실행 가능</span>;
  if (status === 'MISSING_FILES')
    return <span className="rounded-md border border-red-100 bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700">파일 누락</span>;
  return <span className="rounded-md border border-gray-100 bg-gray-50 px-2 py-0.5 text-xs font-semibold text-gray-500">미검증</span>;
}

export default function RegisterModal({ onClose, onDone, modelBasePath }: Props) {
  const [tab, setTab] = useState<Tab>('scan');

  // ── 스캔 탭 ─────────────────────────────────────────────────────────────────
  const [candidates, setCandidates] = useState<ModelCandidate[]>([]);
  const [scanning, setScanning] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [registering, setRegistering] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);

  // ── 업로드 탭 ────────────────────────────────────────────────────────────────
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

  const handleScan = async () => {
    setScanning(true);
    setScanError(null);
    setSelected(new Set());
    try {
      setCandidates(await getModelCandidates());
    } catch (err) {
      setScanError(err instanceof Error ? err.message : '스캔 실패');
    } finally {
      setScanning(false);
    }
  };

  const toggleSelect = (version: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(version) ? next.delete(version) : next.add(version);
      return next;
    });
  };

  const handleRegister = async () => {
    if (selected.size === 0) return;
    setRegistering(true);
    setScanError(null);
    try {
      await registerModelVersions(Array.from(selected));
      onDone();
      onClose();
    } catch (err) {
      setScanError(err instanceof Error ? err.message : '등록 실패');
    } finally {
      setRegistering(false);
    }
  };

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

        {/* 탭 */}
        <div className="flex border-b border-gray-100">
          {(['scan', 'upload'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-3 text-sm font-medium transition-colors ${
                tab === t ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {t === 'scan' ? '파일시스템 스캔' : '파일 업로드'}
            </button>
          ))}
        </div>

        {/* ── 스캔 탭 ──────────────────────────────────────────────────────────── */}
        {tab === 'scan' && (
          <div className="p-6 space-y-4">
            {/* 가이드 박스 */}
            <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-xs space-y-1.5">
              <p className="font-semibold text-blue-700">모델 파일 위치 가이드</p>
              <p className="text-blue-600 font-mono break-all">{modelBasePath}</p>
              <div className="pt-1 space-y-1 text-blue-600">
                <div className="flex gap-2">
                  <span className="font-semibold shrink-0">v1 (Single)</span>
                  <span className="text-blue-500">model-best_rec_180min_f.tflite × 1</span>
                </div>
                <div className="flex gap-2">
                  <span className="font-semibold shrink-0">v2 (Multi)</span>
                  <span className="text-blue-500">model-best_fcst_&#123;step&#125;min.tflite × 18</span>
                </div>
                <div className="flex gap-2">
                  <span className="font-semibold shrink-0">v3 (Multi)</span>
                  <span className="text-blue-500">model-best_fcst_&#123;step&#125;min_re.tflite × 18</span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">미등록 모델을 스캔합니다.</p>
              <button
                onClick={handleScan}
                disabled={scanning}
                className="inline-flex items-center gap-1.5 rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-gray-700 disabled:opacity-50"
              >
                <svg className={`h-3.5 w-3.5 ${scanning ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v6h6M20 20v-6h-6M20 9A8 8 0 006.7 5.1M4 15a8 8 0 0013.3 3.9" />
                </svg>
                스캔
              </button>
            </div>

            {scanError && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{scanError}</p>}

            {candidates.length === 0 && !scanning && (
              <div className="py-8 text-center text-sm text-gray-400">스캔을 실행하면 미등록 모델이 표시됩니다.</div>
            )}

            {candidates.length > 0 && (
              <div className="space-y-2">
                {candidates.map(c => {
                  const isSelected = selected.has(c.version);
                  return (
                    <div
                      key={c.version}
                      onClick={() => toggleSelect(c.version)}
                      className={`flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 transition-colors ${
                        isSelected ? 'border-blue-300 bg-blue-50' : 'border-gray-200 bg-white hover:bg-gray-50'
                      }`}
                    >
                      <div className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border-2 transition-colors ${
                        isSelected ? 'border-blue-600 bg-blue-600' : 'border-gray-300'
                      }`}>
                        {isSelected && (
                          <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-gray-900 text-sm">{c.model_name}</span>
                          <span className="font-mono text-xs text-gray-500">{c.version}</span>
                          <span className="text-xs text-gray-400">({c.architecture})</span>
                        </div>
                        <p className="mt-0.5 text-xs text-gray-400 truncate">{c.model_path}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-xs text-gray-400">{c.file_count}/{c.expected_file_count}</span>
                        <ValidationBadge status={c.validation_status} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {candidates.length > 0 && (
              <div className="flex items-center justify-between pt-2">
                <span className="text-xs text-gray-400">{selected.size}개 선택됨</span>
                <button
                  onClick={handleRegister}
                  disabled={selected.size === 0 || registering}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-40"
                >
                  {registering ? '등록 중...' : '등록'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── 업로드 탭 ────────────────────────────────────────────────────────── */}
        {tab === 'upload' && (
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
        )}
      </div>
    </div>
  );
}
