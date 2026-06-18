'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '@/lib/Layout';
import { getModels, getTrainings, type ModelVersion } from '@/lib/api';
import {
  applyStoredModelStatuses,
  loadHidden,
  mergePendingTrainingModels,
  updatePendingTrainingStatuses,
} from '@/lib/modelStore';
import { MOCK_MODELS } from '@/lib/modelMock';
import { formatModelDateTime } from '@/lib/modelRegistry';

// ─── 모델 그룹 요약 ──────────────────────────────────────────────────────────

interface ModelGroup {
  name: string;
  versionCount: number;
  selectedVersion: string | null;   // 운영(SELECTED) 버전
  trainingStatus: string | null;
  latestRegistered: string | null;
}

function isTrainingStatus(status: string | null | undefined): boolean {
  return ['QUEUED', 'RUNNING'].includes((status ?? '').toUpperCase());
}

function trainingStatusLabel(status: string | null): string {
  const value = (status ?? '').toUpperCase();
  if (value === 'QUEUED') return '대기 중';
  if (value === 'RUNNING') return '학습 중';
  return '대기 작업 없음';
}

function buildGroups(models: ModelVersion[]): ModelGroup[] {
  const map = new Map<string, ModelVersion[]>();
  for (const m of models) {
    const arr = map.get(m.model_name) ?? [];
    arr.push(m);
    map.set(m.model_name, arr);
  }
  return Array.from(map.entries()).map(([name, arr]) => {
    const sorted = [...arr].sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''));
    const registered = sorted.filter(m => !isTrainingStatus(m.status));
    const selected = registered.find(m => (m.status ?? '').toUpperCase() === 'SELECTED');
    const activeTraining = sorted.find(m => isTrainingStatus(m.status));
    return {
      name,
      versionCount: registered.length,
      selectedVersion: selected?.version ?? null,
      trainingStatus: activeTraining?.status ?? null,
      latestRegistered: registered[0]?.created_at ?? sorted[0]?.created_at ?? null,
    };
  });
}

// ─── Main — 등록된 모델 목록 ─────────────────────────────────────────────────

export default function Models() {
  const router = useRouter();
  const [models, setModels]   = useState<ModelVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [hidden, setHidden]   = useState<number[]>([]);

  const refresh = useCallback(() => {
    Promise.allSettled([getModels(), getTrainings()])
      .then(([modelResult, trainingResult]) => {
        const data = modelResult.status === 'fulfilled' ? modelResult.value : [];
        if (trainingResult.status === 'fulfilled') updatePendingTrainingStatuses(trainingResult.value);
        const base = applyStoredModelStatuses(data.length ? data : MOCK_MODELS);
        setModels(mergePendingTrainingModels(base));
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => { setHidden(loadHidden()); }, []);

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

  const groups = buildGroups(models.filter(m => !hidden.includes(m.id)));

  return (
    <Layout>
      <div className="space-y-3">
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-700">학습 산출 모델</p>
              <p className="text-xs text-gray-500 mt-0.5">학습 완료 후 등록된 모델을 운영 후보로 관리합니다.</p>
            </div>
            <button
              onClick={() => router.push('/trainings')}
              className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition shadow-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.25} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 2L2 7l10 5 10-5-10-5z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
              새 모델 학습
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {['모델명', '등록 버전', '운영 버전', '학습 상태', '최근 등록'].map(h => (
                    <th key={h} className="text-left px-3 py-2.5 text-xs font-medium text-gray-500 whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {groups.map(g => (
                  <tr
                    key={g.name}
                    onClick={() => router.push(`/models/${encodeURIComponent(g.name)}`)}
                    className="cursor-pointer border-b border-gray-100 hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <svg className="w-[18px] h-[18px] text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3.27 6.96L12 12.01l8.73-5.05M12 22.08V12" />
                        </svg>
                        <span className="font-semibold text-blue-600">{g.name}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-gray-700">{g.versionCount}개</td>
                    <td className="px-3 py-2.5">
                      {g.selectedVersion ? (
                        <span className="font-mono text-xs text-gray-500">{g.selectedVersion}</span>
                      ) : (
                        <span className="text-xs text-gray-300">지정 없음</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-gray-700 whitespace-nowrap">{trainingStatusLabel(g.trainingStatus)}</td>
                    <td className="px-3 py-2.5 text-gray-400 text-xs whitespace-nowrap">
                      {formatModelDateTime(g.latestRegistered)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {groups.length === 0 && (
            <div className="py-16 text-center text-gray-400 text-sm">
              아직 레지스트리에 등록된 학습 완료 모델이 없습니다.
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
