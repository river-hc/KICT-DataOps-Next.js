'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Layout from '@/lib/Layout';
import { getModels, type ModelVersion } from '@/lib/api';
import {
  getModelDesc,
  mergeRegisteredModels,
  setModelDesc,
} from '@/lib/modelStore';
import { MOCK_MODELS } from '@/lib/modelMock';
import {
  formatModelDateTime,
  getArchitecture,
  getTrainingMeta,
  type ModelTrainingMeta,
} from '@/lib/modelRegistry';

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
          placeholder="설명"
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

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg px-3 py-2.5 shadow-sm">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-base font-bold text-gray-900 mt-0.5 break-all">{value}</p>
    </div>
  );
}

function DetailField({ label, value, code = false }: { label: string; value: string; code?: boolean }) {
  return (
    <div>
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <div className={`min-h-10 px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 text-sm text-gray-700 break-all ${code ? 'font-mono' : ''}`}>
        {value}
      </div>
    </div>
  );
}

function VersionTable({
  versions, activeId, onSelectVersion,
}: {
  versions: ModelVersion[];
  activeId: number | null;
  onSelectVersion: (id: number) => void;
}) {
  const headers = [
    { label: 'Version', cls: 'w-24' },
    { label: '방식', cls: 'w-20' },
    { label: '완료', cls: 'w-28' },
    { label: '시간', cls: 'w-24' },
    { label: '모델 파일', cls: '' },
  ];

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-sm">
        <thead className="bg-gray-50">
          <tr>
            {headers.map(h => (
              <th key={h.label} className={`text-left px-2 py-2.5 text-xs font-medium text-gray-500 whitespace-nowrap ${h.cls}`}>
                {h.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {versions.map(model => {
            const meta = getTrainingMeta(model);

            return (
              <tr
                key={model.id}
                onClick={() => onSelectVersion(model.id)}
                className={`cursor-pointer border-b border-gray-50 transition-colors ${
                  activeId === model.id ? 'bg-blue-50/60' : 'hover:bg-gray-50/70'
                }`}
              >
                <td className="px-2 py-2.5">
                  <span className="font-mono text-sm font-semibold text-blue-600">{model.version}</span>
                </td>
                <td className="px-2 py-2.5 text-xs text-gray-600 whitespace-nowrap">{meta.mode}</td>
                <td className="px-2 py-2.5 text-xs text-gray-500 whitespace-nowrap">{formatModelDateTime(meta.finishedAt)}</td>
                <td className="px-2 py-2.5 text-gray-700 whitespace-nowrap">{meta.durationLabel}</td>
                <td className="px-2 py-2.5 max-w-[280px]">
                  <span className="block truncate font-mono text-xs text-gray-500">{meta.artifactPath}</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function VersionDetailPanel({ model, meta }: { model: ModelVersion; meta: ModelTrainingMeta }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-bold text-gray-800">선택 버전 학습 정보</p>
          <span className="font-mono text-xs text-blue-600">{model.version}</span>
        </div>
      </div>

      <div className="p-4 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2 gap-3">
        <DetailField label="생성 Job" value={meta.jobId} code />
        <DetailField label="방식" value={getArchitecture(model)} />
        <DetailField label="학습 시작" value={formatModelDateTime(meta.startedAt)} />
        <DetailField label="학습 완료" value={formatModelDateTime(meta.finishedAt)} />
        <DetailField label="학습 시간" value={meta.durationLabel} />
        <DetailField label="주요 성능" value={meta.scoreLabel} />
        <DetailField label="입력 데이터 폴더" value={meta.trainDataset} code />
        <DetailField label="모델 artifact" value={meta.artifactPath} code />
      </div>
    </div>
  );
}

export default function ModelDetail() {
  const params = useParams();
  const router = useRouter();
  const modelName = decodeURIComponent(Array.isArray(params.name) ? params.name[0] : (params.name ?? ''));

  const [models, setModels] = useState<ModelVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeVersionId, setActiveVersionId] = useState<number | null>(null);

  const refresh = useCallback(() => {
    getModels()
      .then(data => {
        setModels(mergeRegisteredModels(data.length ? data : MOCK_MODELS));
      })
      .catch(() => {
        setModels(mergeRegisteredModels(MOCK_MODELS));
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

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
    .filter(m => m.model_name === modelName && !['QUEUED', 'RUNNING'].includes((m.status ?? '').toUpperCase()))
    .sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''));
  const latest = versions[0];
  const latestRegistered = latest;
  const activeVersion = versions.find(m => m.id === activeVersionId) ?? null;
  const activeMeta = activeVersion ? getTrainingMeta(activeVersion) : null;

  if (activeVersion && activeMeta) {
    return (
      <Layout>
        <div className="flex items-start justify-between gap-4 mb-4">
          <button
            onClick={() => setActiveVersionId(null)}
            className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800 transition-colors"
          >
            <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 4l-5 4 5 4" />
            </svg>
            버전 목록
          </button>
          {/* 학습 페이지 이동 기능은 현재 모델 레지스트리 범위에서 비활성화합니다.
          <button
            onClick={() => router.push('/trainings')}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition shadow-sm flex-shrink-0"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.25} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 2L2 7l10 5 10-5-10-5z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
            학습 페이지로 이동
          </button>
          */}
        </div>

        <div className="space-y-3">
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <div className="flex flex-wrap items-center gap-2.5">
                <h2 className="text-lg font-bold text-gray-900">{modelName}</h2>
                <span className="font-mono text-xs text-blue-600">{activeVersion.version}</span>
              </div>
            </div>
            <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-2.5">
              <SummaryCard label="생성 Job" value={activeMeta.jobId} />
              <SummaryCard label="방식" value={getArchitecture(activeVersion)} />
              <SummaryCard label="학습 시간" value={activeMeta.durationLabel} />
              <SummaryCard label="주요 성능" value={activeMeta.scoreLabel} />
            </div>
          </div>

          <VersionDetailPanel model={activeVersion} meta={activeMeta} />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
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
        {/* 학습 페이지 이동 기능은 현재 모델 레지스트리 범위에서 비활성화합니다.
        <button
          onClick={() => router.push('/trainings')}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition shadow-sm flex-shrink-0"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.25} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 2L2 7l10 5 10-5-10-5z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M2 17l10 5 10-5M2 12l10 5 10-5" />
          </svg>
          학습 페이지로 이동
        </button>
        */}
      </div>

      <div className="space-y-3">
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <div className="flex flex-wrap items-center gap-2.5">
              <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.27 6.96L12 12.01l8.73-5.05M12 22.08V12" />
              </svg>
              <h2 className="text-lg font-bold text-gray-900">{modelName}</h2>
              {latestRegistered && <span className="text-xs text-gray-400">최신 <span className="font-mono font-semibold text-gray-500">{latestRegistered.version}</span></span>}
            </div>
            <ModelDescription modelName={modelName} />
          </div>

          <div className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <SummaryCard label="등록 버전" value={`${versions.length}개`} />
            <SummaryCard label="최신 버전" value={latestRegistered?.version ?? '-'} />
            <SummaryCard label="최근 학습 시간" value={latestRegistered ? getTrainingMeta(latestRegistered).durationLabel : '-'} />
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <p className="text-sm font-semibold text-gray-700">버전 목록 ({versions.length})</p>
          </div>

          {versions.length === 0 ? (
            <div className="py-16 text-center text-gray-400 text-sm">등록된 버전이 없습니다.</div>
          ) : (
            <VersionTable
              versions={versions}
              activeId={null}
              onSelectVersion={setActiveVersionId}
            />
          )}
        </div>
      </div>
    </Layout>
  );
}
