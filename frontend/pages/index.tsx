'use client';

import { useState, useEffect } from 'react';
import Layout from '../lib/Layout';
import {
  getHealth,
  getTrainings,
  getExperiments,
  getRuns,
  getArtifacts,
  getModels,
  getSystemStatus,
  type TrainingJob,
  type Experiment,
  type ExperimentRun,
  type Artifact,
  type ModelVersion,
  type SystemStatus,
} from '../lib/api';

export default function Dashboard() {
  const [health, setHealth] = useState<string>('');
  const [trainings, setTrainings] = useState<TrainingJob[]>([]);
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [runs, setRuns] = useState<ExperimentRun[]>([]);
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [models, setModels] = useState<ModelVersion[]>([]);
  const [system, setSystem] = useState<SystemStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      getHealth().then((d) => setHealth(d.status)),
      getTrainings().then(setTrainings),
      getExperiments().then(setExperiments),
      getRuns().then(setRuns),
      getArtifacts().then(setArtifacts),
      getModels().then(setModels),
      getSystemStatus().then(setSystem),
    ]).finally(() => setLoading(false));
  }, []);

  const statusColor = (s: string) => {
    if (s === 'running' || s === 'active' || s === 'approved' || s === 'deployed') return 'text-green-600';
    if (s === 'failed' || s === 'error') return 'text-red-600';
    if (s === 'pending' || s === 'queued') return 'text-yellow-600';
    return 'text-gray-600';
  };

  const statCards = [
    { label: '시스템', value: health || '-', sub: system ? `${system.gpu_count} GPU` : '' },
    { label: '학습 중', value: trainings.filter((t) => t.status === 'running').length.toString(), sub: `총 ${trainings.length}건` },
    { label: '실험', value: experiments.length.toString(), sub: '' },
    { label: 'Run', value: runs.length.toString(), sub: '' },
    { label: '아티팩트', value: artifacts.length.toString(), sub: '' },
    { label: '모델', value: models.length.toString(), sub: '' },
  ];

  if (loading) return <Layout><div className="text-center py-20">로딩 중...</div></Layout>;

  return (
    <Layout>
      {/* 상태 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {statCards.map((c) => (
          <div key={c.label} className="bg-white p-6 rounded-lg shadow border">
            <div className="text-sm text-gray-500">{c.label}</div>
            <div className="text-3xl font-bold mt-1">{c.value}</div>
            {c.sub && <div className="text-xs text-gray-400 mt-1">{c.sub}</div>}
          </div>
        ))}
      </div>

      {/* 최신 학습 목록 */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-3">최근 학습</h2>
        <div className="bg-white rounded-lg shadow border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left p-3">이름</th>
                <th className="text-left p-3">모드</th>
                <th className="text-left p-3">상태</th>
                <th className="text-left p-3">작성일</th>
              </tr>
            </thead>
            <tbody>
              {trainings.slice(-10).reverse().map((t) => (
                <tr key={t.job_id} className="border-t">
                  <td className="p-3">{t.experiment_name}</td>
                  <td className="p-3">{t.mode}</td>
                  <td className={`p-3 font-medium ${statusColor(t.status)}`}>{t.status}</td>
                  <td className="p-3 text-gray-500">{t.created_at?.slice(0, 10)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 최근 Run */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-3">최근 Run</h2>
        <div className="bg-white rounded-lg shadow border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left p-3">실험 ID</th>
                <th className="text-left p-3">학습 ID</th>
                <th className="text-left p-3">상태</th>
                <th className="text-left p-3">시작</th>
                <th className="text-left p-3">완료</th>
              </tr>
            </thead>
            <tbody>
              {runs.slice(-10).reverse().map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="p-3">{r.experiment_id}</td>
                  <td className="p-3">{r.training_job_id}</td>
                  <td className={`p-3 font-medium ${statusColor(r.status)}`}>{r.status}</td>
                  <td className="p-3 text-gray-500">{r.started_at?.slice(0, 10)}</td>
                  <td className="p-3 text-gray-500">{r.finished_at?.slice(0, 10)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 실험 목록 */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-3">실험 목록</h2>
        <div className="bg-white rounded-lg shadow border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left p-3">ID</th>
                <th className="text-left p-3">이름</th>
                <th className="text-left p-3">작성일</th>
              </tr>
            </thead>
            <tbody>
              {experiments.map((e) => (
                <tr key={e.id} className="border-t">
                  <td className="p-3">{e.id}</td>
                  <td className="p-3">{e.name}</td>
                  <td className="p-3 text-gray-500">{e.created_at?.slice(0, 10)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 모델 목록 */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-3">모델 레지스트리</h2>
        <div className="bg-white rounded-lg shadow border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left p-3">이름</th>
                <th className="text-left p-3">버전</th>
                <th className="text-left p-3">상태</th>
                <th className="text-left p-3">작성일</th>
              </tr>
            </thead>
            <tbody>
              {models.map((m) => (
                <tr key={m.id} className="border-t">
                  <td className="p-3">{m.model_name}</td>
                  <td className="p-3">{m.version}</td>
                  <td className={`p-3 font-medium ${statusColor(m.status)}`}>{m.status}</td>
                  <td className="p-3 text-gray-500">{m.created_at?.slice(0, 10)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* GPU 상태 */}
      {system && (
        <div>
          <h2 className="text-xl font-semibold mb-3">GPU 상태</h2>
          <div className="bg-white rounded-lg shadow border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left p-3">GPU</th>
                  <th className="text-left p-3">이름</th>
                  <th className="text-left p-3">사용률</th>
                  <th className="text-left p-3">메모리</th>
                  <th className="text-left p-3">온도</th>
                </tr>
              </thead>
              <tbody>
                {system.gpus.map((gpu) => (
                  <tr key={gpu.id} className="border-t">
                    <td className="p-3">{gpu.id}</td>
                    <td className="p-3">{gpu.name}</td>
                    <td className="p-3">{gpu.utilization}</td>
                    <td className="p-3">{(gpu.memory_used / 1024).toFixed(1)} / {(gpu.memory_total / 1024).toFixed(1)} GB</td>
                    <td className="p-3">{gpu.temperature}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Layout>
  );
}