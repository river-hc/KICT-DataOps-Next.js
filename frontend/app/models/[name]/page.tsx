'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Layout from '@/lib/Layout';
import { getModels, registerModel, type ModelVersion } from '@/lib/api';
import {
  getVersionAliases, getAliasTarget, setAlias, removeAlias,
  loadHidden, hideModel, getModelDesc, setModelDesc,
  ALIAS_SUGGESTIONS,
} from '@/lib/modelStore';
import { MOCK_MODELS } from '@/lib/modelMock';

// ─── Register modal ───────────────────────────────────────────────────────────

// 아키텍처별 허용 확장자 — Single: 단일 모델 파일 / Multi: tflite 18개 또는 ZIP
const ACCEPT_BY_ARCH = {
  single: '.h5,.pt',
  multi:  '.tflite,.zip',
} as const;

function matchesArch(fileName: string, arch: 'single' | 'multi'): boolean {
  const lower = fileName.toLowerCase();
  return ACCEPT_BY_ARCH[arch].split(',').some(ext => lower.endsWith(ext));
}

// 기존 목록의 Ver.N 최대값 +1을 기본 버전 레이블로 제안 (패턴 불일치 시 빈 값)
function suggestNextVersion(models: ModelVersion[]): string {
  const nums = models
    .map(m => /^Ver\.(\d+)$/.exec(m.version ?? ''))
    .filter((m): m is RegExpExecArray => m !== null)
    .map(m => Number(m[1]));
  return nums.length ? `Ver.${Math.max(...nums) + 1}` : '';
}

function RegisterModal({
  onClose, onRegistered, models,
}: {
  onClose: () => void;
  onRegistered: () => void;
  models: ModelVersion[];
}) {
  const [versionLabel, setVersionLabel] = useState(() => suggestNextVersion(models));
  const [architecture, setArchitecture] = useState<'multi' | 'single'>('multi');
  const [file, setFile] = useState<File | null>(null);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileNotice, setFileNotice] = useState<string | null>(null);

  const handleArchChange = (arch: 'multi' | 'single') => {
    setArchitecture(arch);
    if (file && !matchesArch(file.name, arch)) {
      setFile(null);
      setFileNotice('아키텍처에 맞지 않는 파일이라 선택이 해제되었습니다.');
    }
  };

  const handleFileChange = (f: File | null) => {
    if (f && !matchesArch(f.name, architecture)) {
      setFile(null);
      setFileNotice(
        architecture === 'single'
          ? 'Single 아키텍처는 .h5 / .pt 파일만 등록할 수 있습니다.'
          : 'Multi 아키텍처는 .tflite / .zip 파일만 등록할 수 있습니다.'
      );
      return;
    }
    setFile(f);
    setFileNotice(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    const label = versionLabel.trim();
    if (models.some(m => m.version === label)) {
      setError(`이미 존재하는 버전입니다: ${label}`);
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await registerModel({
        versionLabel: label,
        architecture,
        modelFile: file,
        memo: note.trim() || undefined,
      });
      onRegistered();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '모델 등록에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4">

        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-bold text-gray-900">버전 등록</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
              버전 레이블
            </label>
            <input
              type="text"
              value={versionLabel}
              onChange={e => setVersionLabel(e.target.value)}
              placeholder="예: Ver.4, 2025-Q4"
              required
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              아키텍처
            </label>
            <div className="space-y-2">
              {([
                { value: 'multi'  as const, label: 'Multi',  desc: '선행시간별 독립 모델 — 18개 파일은 ZIP으로 묶어 업로드' },
                { value: 'single' as const, label: 'Single', desc: '단일 모델에서 18개 시점 동시 예측' },
              ]).map(opt => (
                <label
                  key={opt.value}
                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition ${
                    architecture === opt.value
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="architecture"
                    value={opt.value}
                    checked={architecture === opt.value}
                    onChange={() => handleArchChange(opt.value)}
                    className="mt-0.5 accent-blue-600"
                  />
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{opt.label}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{opt.desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
              모델 파일
            </label>
            <label className={`flex flex-col items-center justify-center w-full h-24 border-2 border-dashed rounded-lg cursor-pointer transition ${
              file ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:border-gray-300 bg-gray-50'
            }`}>
              <input
                type="file"
                accept={ACCEPT_BY_ARCH[architecture]}
                className="hidden"
                onChange={e => handleFileChange(e.target.files?.[0] ?? null)}
              />
              {file ? (
                <div className="text-center px-4">
                  <p className="text-sm font-medium text-blue-700 truncate max-w-xs">{file.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{(file.size / 1024 / 1024).toFixed(1)} MB</p>
                </div>
              ) : (
                <div className="text-center">
                  <svg className="w-6 h-6 text-gray-300 mx-auto mb-1" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                  </svg>
                  <p className="text-xs text-gray-400">
                    {architecture === 'single' ? '.h5 · .pt' : '.tflite · .zip (18개 모델 묶음)'}
                  </p>
                </div>
              )}
            </label>
            {fileNotice && (
              <p className="text-xs text-amber-600 mt-1.5">{fileNotice}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
              메모 <span className="normal-case font-normal text-gray-400">(선택)</span>
            </label>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              rows={3}
              placeholder="학습 데이터 출처, 전이학습 기반 버전 등"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          <div className="flex items-center gap-2 pt-1">
            <div className="flex-1 min-w-0">
              {error && <p className="text-xs text-red-500">{error}</p>}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition flex-shrink-0"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={!versionLabel.trim() || !file || submitting}
              className="px-5 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 flex-shrink-0"
            >
              {submitting && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              등록
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── 별칭(Alias) 셀 ─────────────────────────────────────────────────────────

function AliasCell({
  aliases, onAdd, onRemove,
}: {
  aliases: string[]; onAdd: (alias: string) => void; onRemove: (alias: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [val, setVal]       = useState('');

  const submit = (raw?: string) => {
    const a = (raw ?? val).trim();
    if (!a) return;
    onAdd(a);
    setVal('');
    setAdding(false);
  };

  const remaining = ALIAS_SUGGESTIONS.filter(s => !aliases.includes(s));

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {aliases.map(a => (
        <span key={a} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-100">
          @{a}
          <button
            onClick={e => { e.stopPropagation(); onRemove(a); }}
            className="text-blue-300 hover:text-blue-600 transition"
            title="별칭 제거"
          >
            <svg viewBox="0 0 16 16" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
              <path d="M3 3l10 10M13 3L3 13" />
            </svg>
          </button>
        </span>
      ))}

      {adding ? (
        <span className="inline-flex items-center gap-1">
          <input
            value={val}
            autoFocus
            onChange={e => setVal(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') setAdding(false); }}
            placeholder="별칭"
            className="w-24 px-2 py-0.5 text-xs border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {remaining.slice(0, 2).map(s => (
            <button
              key={s}
              onClick={() => submit(s)}
              className="px-1.5 py-0.5 text-[11px] text-gray-500 border border-gray-200 rounded hover:bg-gray-50 whitespace-nowrap"
            >
              {s}
            </button>
          ))}
          <button onClick={() => submit()} className="px-1.5 py-0.5 text-[11px] font-semibold text-white bg-blue-600 rounded hover:bg-blue-700">추가</button>
        </span>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-xs text-gray-400 border border-dashed border-gray-300 rounded-full hover:text-gray-600 hover:border-gray-400 transition"
          title="별칭 추가"
        >
          <svg viewBox="0 0 16 16" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
            <path d="M8 3v10M3 8h10" />
          </svg>
        </button>
      )}
    </div>
  );
}

function DeleteButton({ onDelete }: { onDelete: () => void }) {
  return (
    <button
      onClick={e => { e.stopPropagation(); onDelete(); }}
      className="p-1 text-red-400 border border-red-100 rounded-md hover:bg-red-50 transition"
      title="삭제"
    >
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
      </svg>
    </button>
  );
}

// ─── 모델 설명 (인라인 편집) ─────────────────────────────────────────────────

function ModelDescription({ modelName }: { modelName: string }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft]     = useState('');
  const [value, setValue]     = useState<string | null>(null);

  useEffect(() => { setValue(getModelDesc(modelName)); }, [modelName]);

  const start = () => { setDraft(value ?? ''); setEditing(true); };
  const save  = () => { setModelDesc(modelName, draft.trim()); setValue(draft.trim()); setEditing(false); };

  if (editing) {
    return (
      <div className="flex items-center gap-2 mt-1">
        <input
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false); }}
          placeholder="모델 설명 입력"
          autoFocus
          className="flex-1 max-w-md px-2 py-1 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button onClick={save} className="px-2 py-1 text-xs font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700">저장</button>
        <button onClick={() => setEditing(false)} className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700">취소</button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 mt-1 group">
      <p className="text-sm text-gray-500">{value || <span className="text-gray-300">설명 없음</span>}</p>
      <button onClick={start} className="text-gray-300 hover:text-gray-500 transition" title="설명 편집">
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
      </button>
    </div>
  );
}

// ─── 버전 목록 테이블 ─────────────────────────────────────────────────────────

function VersionTable({
  modelName, versions, onAddAlias, onRemoveAlias, onDelete,
}: {
  modelName: string;
  versions: ModelVersion[];
  onAddAlias: (id: number, alias: string) => void;
  onRemoveAlias: (alias: string) => void;
  onDelete: (id: number) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100">
            {['Version', 'Aliases', '아키텍처', '파일 형식', '등록일', '메모', 'Actions'].map(h => (
              <th key={h} className="text-left px-5 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {versions.map(m => {
            const arch    = m.metrics?.architecture as string | undefined;
            const fmt     = m.metrics?.file_format  as string | undefined;
            const cnt     = m.metrics?.file_count   as number | undefined;
            const note    = m.metrics?.note         as string | undefined;
            const aliases = getVersionAliases(modelName, m.id);

            return (
              <tr key={m.id} className="border-b border-gray-50 hover:bg-gray-50/60 transition-colors">
                <td className="px-5 py-3">
                  <span className="font-mono text-sm font-semibold text-blue-600">{m.version}</span>
                </td>
                <td className="px-5 py-3">
                  <AliasCell
                    aliases={aliases}
                    onAdd={a => onAddAlias(m.id, a)}
                    onRemove={onRemoveAlias}
                  />
                </td>
                <td className="px-5 py-3 text-xs text-gray-600 whitespace-nowrap">
                  {arch === 'single' ? 'Single' : arch === 'multi' ? 'Multi' : '-'}
                </td>
                <td className="px-5 py-3 whitespace-nowrap">
                  {fmt ? (
                    <span className="text-xs font-mono bg-violet-50 text-violet-700 border border-violet-100 px-2 py-0.5 rounded">
                      .{fmt}{cnt && cnt > 1 ? ` × ${cnt}` : ''}
                    </span>
                  ) : <span className="text-gray-400">-</span>}
                </td>
                <td className="px-5 py-3 text-gray-400 text-xs whitespace-nowrap">{m.created_at?.slice(0, 10) ?? '-'}</td>
                <td className="px-5 py-3 text-xs text-gray-600 max-w-[220px]">
                  <span className="line-clamp-1">{note || '-'}</span>
                </td>
                <td className="px-5 py-3">
                  <DeleteButton onDelete={() => onDelete(m.id)} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Main — 모델 상세(버전 리스트) ───────────────────────────────────────────

export default function ModelDetail() {
  const params = useParams();
  const router = useRouter();
  const modelName = decodeURIComponent(Array.isArray(params.name) ? params.name[0] : (params.name ?? ''));

  const [models, setModels]       = useState<ModelVersion[]>([]);
  const [loading, setLoading]     = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [hidden, setHidden]       = useState<number[]>([]);
  const [tick, setTick]           = useState(0);

  const refresh = useCallback(() => {
    getModels()
      .then(data => setModels(data.length ? data : MOCK_MODELS))
      .catch(() => setModels(MOCK_MODELS))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => { setHidden(loadHidden()); }, []);

  // 별칭 부여 — 별칭은 모델당 유일. 이미 다른 버전에 있으면 이동 확인
  const handleAddAlias = (id: number, alias: string) => {
    const target = getAliasTarget(modelName, alias);
    if (target != null && target !== id) {
      const from = models.find(m => m.id === target);
      const ok = window.confirm(
        `별칭 @${alias}이(가) 이미 ${from?.version ?? `#${target}`} 버전에 지정되어 있습니다.\n` +
        `이 버전으로 옮길까요? (기존 버전에서는 제거됩니다)`
      );
      if (!ok) return;
    }
    setAlias(modelName, alias, id);
    setTick(t => t + 1);
  };

  const handleRemoveAlias = (alias: string) => {
    removeAlias(modelName, alias);
    setTick(t => t + 1);
  };

  const handleDelete = (id: number) => {
    if (!window.confirm('이 모델 버전을 목록에서 삭제하시겠습니까?')) return;
    hideModel(id);
    setHidden(prev => [...prev, id]);
  };

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
    .filter(m => m.model_name === modelName && !hidden.includes(m.id))
    .sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''));
  const latest = versions[0];
  void tick; // getStage가 localStorage를 읽으므로 tick 변경으로 리렌더만 유도

  return (
    <Layout>
      {showModal && (
        <RegisterModal
          models={versions}
          onClose={() => setShowModal(false)}
          onRegistered={refresh}
        />
      )}

      {/* 브레드크럼 + 등록 버튼 */}
      <div className="flex items-start justify-between gap-4 mb-4">
        <button
          onClick={() => router.push('/models')}
          className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800 transition-colors"
        >
          <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 4l-5 4 5 4" />
          </svg>
          모델 목록
        </button>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition shadow-sm flex-shrink-0"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          버전 등록
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {/* 모델 헤더 */}
        <div className="px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.27 6.96L12 12.01l8.73-5.05M12 22.08V12" />
            </svg>
            <h2 className="text-lg font-bold text-gray-900">{modelName}</h2>
            {latest && (
              <span className="text-xs text-gray-400">
                최신 <span className="font-mono font-semibold text-gray-500">{latest.version}</span>
              </span>
            )}
          </div>
          <ModelDescription modelName={modelName} />
        </div>

        {/* 버전 목록 */}
        <div className="px-5 pt-4 pb-1">
          <p className="text-sm font-semibold text-gray-700">버전 목록 ({versions.length})</p>
        </div>

        {versions.length === 0 ? (
          <div className="py-16 text-center text-gray-400 text-sm">등록된 버전이 없습니다.</div>
        ) : (
          <VersionTable
            modelName={modelName}
            versions={versions}
            onAddAlias={handleAddAlias}
            onRemoveAlias={handleRemoveAlias}
            onDelete={handleDelete}
          />
        )}
      </div>
    </Layout>
  );
}
