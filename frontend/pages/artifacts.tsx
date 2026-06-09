'use client';

import { useState, useEffect } from 'react';
import Layout from '../lib/Layout';
import { getTrainings, getArtifactsByRun, type TrainingJob, type Artifact } from '../lib/api';

const ARTIFACT_TYPE_STYLE: Record<string, string> = {
  model:   'bg-violet-100 text-violet-700',
  metrics: 'bg-blue-100   text-blue-700',
  plot:    'bg-emerald-100 text-emerald-700',
};

function fmtSize(bytes: number | null | undefined): string {
  if (!bytes) return '-';
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024).toFixed(0)} KB`;
}

export default function Artifacts() {
  const [trainings, setTrainings]         = useState<TrainingJob[]>([]);
  const [artifacts, setArtifacts]         = useState<Artifact[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<number | null>(null);
  const [loading, setLoading]             = useState(true);
  const [artLoading, setArtLoading]       = useState(false);

  useEffect(() => {
    getTrainings()
      .then(data => setTrainings(data))
      .finally(() => setLoading(false));
  }, []);

  const handleRunSelect = async (runId: number) => {
    setSelectedRunId(runId);
    setArtLoading(true);
    try {
      setArtifacts(await getArtifactsByRun(runId));
    } catch {
      setArtifacts([]);
    } finally {
      setArtLoading(false);
    }
  };

  const completed = trainings.filter(t => t.status.toUpperCase() === 'COMPLETED');

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

  return (
    <Layout>
      {/* 페이지 헤더 */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">아티팩트</h1>
        <p className="text-sm text-gray-500 mt-0.5">완료된 학습의 모델·지표·이미지 산출물을 확인합니다.</p>
      </div>

      <div className="grid grid-cols-2 gap-5">
        {/* 학습 목록 */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100">
            <span className="text-sm font-semibold text-gray-700">완료된 학습</span>
            <span className="ml-2 text-xs text-gray-400">{completed.length}건</span>
          </div>
          <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
            {completed.length === 0 ? (
              <p className="px-5 py-8 text-sm text-center text-gray-400">완료된 학습이 없습니다.</p>
            ) : (
              completed.map(t => (
                <div
                  key={t.job_id}
                  onClick={() => { if (t.run_id != null) handleRunSelect(t.run_id); }}
                  className={`px-5 py-3 cursor-pointer transition-colors ${
                    selectedRunId === t.run_id
                      ? 'bg-blue-50 border-l-2 border-blue-500'
                      : 'hover:bg-gray-50'
                  }`}
                >
                  <p className="text-sm font-medium text-gray-800">{t.experiment_name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {t.user_name} · {t.mode} · Job #{t.job_id}{t.run_id != null ? ` · Run #${t.run_id}` : ''}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* 아티팩트 목록 */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100">
            <span className="text-sm font-semibold text-gray-700">아티팩트 목록</span>
            {selectedRunId && (
              <span className="ml-2 text-xs text-gray-400">#{selectedRunId}</span>
            )}
          </div>
          <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
            {!selectedRunId ? (
              <p className="px-5 py-8 text-sm text-center text-gray-400">학습을 선택하세요.</p>
            ) : artLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : artifacts.length === 0 ? (
              <p className="px-5 py-8 text-sm text-center text-gray-400">아티팩트가 없습니다.</p>
            ) : (
              artifacts.map(a => (
                <div key={a.id} className="px-5 py-3 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-sm font-medium text-gray-800">{a.file_name}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ARTIFACT_TYPE_STYLE[a.artifact_type] ?? 'bg-gray-100 text-gray-600'}`}>
                      {a.artifact_type}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400">
                    {a.file_path} · {fmtSize(a.file_size)}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
