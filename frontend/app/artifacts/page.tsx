'use client';

import { useState, useEffect } from 'react';
import Layout from '@/lib/Layout';
import { getExperimentJobs, getArtifactsByRun, type TrainingJob, type Artifact } from '@/lib/api';
import { MOCK_EXPERIMENT_JOBS, MOCK_ARTIFACTS } from '@/lib/mockData';

const ARTIFACT_TYPE_STYLE: Record<string, string> = {
  model:   'bg-violet-100 text-violet-700',
  metrics: 'bg-blue-100   text-blue-700',
  plot:    'bg-emerald-100 text-emerald-700',
};

const ARTIFACT_TYPE_LABEL: Record<string, string> = {
  model:   '모델',
  metrics: '지표',
  plot:    'ASC',
};

function fmtSize(bytes: number | null | undefined): string {
  if (!bytes) return '-';
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024).toFixed(0)} KB`;
}

function handleDownload(a: Artifact, jobId: number | null) {
  // /mock/ 경로는 public/ 정적 파일 직접 다운로드
  // 그 외: GET /api/v1/trainings/{job_id}/files/{filename} 로 파일 서빙
  // (GET /api/v1/artifacts/{id}/download 는 존재하지 않음)
  let url: string;
  if (a.file_path?.startsWith('/mock/')) {
    url = a.file_path;
  } else if (jobId != null && a.file_name) {
    url = `/api/v1/trainings/${jobId}/files/${encodeURIComponent(a.file_name)}`;
  } else {
    alert('파일 경로를 확인할 수 없습니다.');
    return;
  }
  const link = document.createElement('a');
  link.href     = url;
  link.download = a.file_name ?? 'download';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export default function Artifacts() {
  const [trainings, setTrainings]         = useState<TrainingJob[]>([]);
  const [artifacts, setArtifacts]         = useState<Artifact[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<number | null>(null);
  const [selectedJobId, setSelectedJobId] = useState<number | null>(null);
  const [loading, setLoading]             = useState(true);
  const [artLoading, setArtLoading]       = useState(false);

  useEffect(() => {
    getExperimentJobs()
      .then(data => setTrainings(data))
      .catch(() => setTrainings(MOCK_EXPERIMENT_JOBS))
      .finally(() => setLoading(false));
  }, []);

  const handleRunSelect = async (job: TrainingJob) => {
    if (job.run_id == null) return;
    setSelectedRunId(job.run_id);
    setSelectedJobId(job.job_id);
    setArtLoading(true);
    try {
      const data = await getArtifactsByRun(job.run_id);
      setArtifacts(data);
    } catch {
      setArtifacts(MOCK_ARTIFACTS[job.run_id] ?? []);
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
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">아티팩트</h1>
        <p className="text-sm text-gray-500 mt-0.5">완료된 실험의 모델·지표·강우장 ASC 산출물을 확인하고 다운로드합니다.</p>
      </div>

      <div className="grid grid-cols-2 gap-5">
        {/* 완료된 실험 목록 */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
            <span className="text-sm font-semibold text-gray-700">완료된 실험</span>
            <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{completed.length}건</span>
          </div>
          <div className="divide-y divide-gray-100 max-h-[520px] overflow-y-auto">
            {completed.length === 0 ? (
              <p className="px-5 py-8 text-sm text-center text-gray-400">완료된 실험이 없습니다.</p>
            ) : (
              completed.map(t => (
                <div
                  key={t.job_id}
                  onClick={() => handleRunSelect(t)}
                  className={`px-5 py-3.5 cursor-pointer transition-colors ${
                    selectedRunId === t.run_id
                      ? 'bg-blue-50 border-l-2 border-l-blue-500'
                      : 'hover:bg-gray-50'
                  }`}
                >
                  <p className="text-sm font-medium text-gray-800 truncate">{t.experiment_name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {t.user_name} · {t.mode}
                    {t.run_id != null && (
                      <span className="ml-1.5 font-mono bg-gray-100 px-1.5 py-0.5 rounded text-gray-500">
                        Run #{t.run_id}
                      </span>
                    )}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* 아티팩트 목록 */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
            <span className="text-sm font-semibold text-gray-700">아티팩트 목록</span>
            {selectedRunId && (
              <span className="text-xs font-mono text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                Run #{selectedRunId}
              </span>
            )}
            {selectedRunId && artifacts.length > 0 && (
              <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full ml-auto">
                {artifacts.length}개
              </span>
            )}
          </div>
          <div className="divide-y divide-gray-100 max-h-[520px] overflow-y-auto">
            {!selectedRunId ? (
              <p className="px-5 py-10 text-sm text-center text-gray-400">좌측에서 실험을 선택하세요.</p>
            ) : artLoading ? (
              <div className="flex items-center justify-center py-10">
                <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : artifacts.length === 0 ? (
              <p className="px-5 py-10 text-sm text-center text-gray-400">아티팩트가 없습니다.</p>
            ) : (
              artifacts.map(a => {
                const isMock = a.file_path.startsWith('/mock/');
                return (
                  <div key={a.id} className="px-5 py-3.5 hover:bg-gray-50 transition-colors flex items-center gap-3">
                    {/* 파일 아이콘 */}
                    <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
                      <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>

                    {/* 파일 정보 */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm font-medium text-gray-800 truncate">{a.file_name}</span>
                        <span className={`flex-shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${ARTIFACT_TYPE_STYLE[a.artifact_type] ?? 'bg-gray-100 text-gray-600'}`}>
                          {ARTIFACT_TYPE_LABEL[a.artifact_type] ?? a.artifact_type}
                        </span>
                        {isMock && (
                          <span className="flex-shrink-0 text-xs px-2 py-0.5 rounded-full font-medium bg-amber-100 text-amber-700">
                            mock
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 truncate">
                        {fmtSize(a.file_size)}
                        {a.created_at && ` · ${a.created_at.slice(0, 10)}`}
                      </p>
                    </div>

                    {/* 다운로드 버튼 */}
                    <button
                      onClick={() => handleDownload(a, selectedJobId)}
                      className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-gray-200 rounded-lg text-gray-600 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-600 transition-colors"
                      title="파일 다운로드"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      다운로드
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
