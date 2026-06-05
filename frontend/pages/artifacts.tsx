'use client';

import { useState, useEffect } from 'react';
import Layout from '../lib/Layout';
import { getTrainings, getArtifactsByRun, type TrainingJob, type Artifact } from '../lib/api';

export default function Artifacts() {
  const [trainings, setTrainings] = useState<TrainingJob[]>([]);
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getTrainings().then((data) => {
      setTrainings(data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const handleRunSelect = async (jobId: number) => {
    const runId = jobId; // job_id를 run_id로 사용
    setSelectedRunId(runId);
    try {
      const data = await getArtifactsByRun(runId);
      setArtifacts(data);
    } catch {
      setArtifacts([]);
    }
  };

  const artifactTypeColor = (type: string) => {
    if (type === 'model') return 'text-purple-600';
    if (type === 'metrics') return 'text-blue-600';
    if (type === 'plot') return 'text-green-600';
    return 'text-gray-600';
  };

  if (loading) return <Layout><div className="text-center py-20">로딩 중...</div></Layout>;

  return (
    <Layout>
      <h1 className="text-2xl font-bold mb-6">결과물 아티팩트</h1>

      <div className="grid grid-cols-2 gap-6">
        {/* 학습 목록 */}
        <div className="bg-white rounded-lg shadow border p-4">
          <h2 className="font-semibold mb-3">학습 목록 (결과 완료)</h2>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {trainings
              .filter((t) => t.status === 'completed')
              .map((t) => (
                <div
                  key={t.job_id}
                  className={`p-3 border rounded cursor-pointer ${selectedRunId === t.job_id ? 'bg-blue-50 border-blue-300' : 'hover:bg-gray-50'}`}
                  onClick={() => handleRunSelect(t.job_id)}
                >
                  <div className="font-medium">{t.experiment_name}</div>
                  <div className="text-xs text-gray-500">
                    {t.user_name} · {t.mode}
                  </div>
                </div>
              ))}
          </div>
        </div>

        {/* 아티팩트 목록 */}
        <div className="bg-white rounded-lg shadow border p-4">
          <h2 className="font-semibold mb-3">아티팩트 목록</h2>
          {selectedRunId ? (
            <div className="space-y-2">
              {artifacts.map((a) => (
                <div key={a.id} className="p-3 border rounded hover:bg-gray-50">
                  <div className="flex justify-between">
                    <span className="font-medium">{a.name}</span>
                    <span className={`text-xs ${artifactTypeColor(a.artifact_type)}`}>{a.artifact_type}</span>
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    {a.file_path} · {(a.file_size || 0) / 1024 / 1024 >= 1
                      ? `${(a.file_size! / 1024 / 1024).toFixed(1)} MB`
                      : `${(a.file_size || 0) / 1024} KB`}
                  </div>
                </div>
              ))}
              {artifacts.length === 0 && <p className="text-gray-400 text-sm">아티팩트가 없습니다.</p>}
            </div>
          ) : (
            <p className="text-gray-400 text-sm">학습을 선택하세요.</p>
          )}
        </div>
      </div>
    </Layout>
  );
}