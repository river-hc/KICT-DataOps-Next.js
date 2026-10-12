'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Layout from '@/lib/Layout';
import {
  getTraining, getArtifactsByRun, displayUsername, formatExecutionName,
  type TrainingJob, type Artifact,
} from '@/lib/api';
import { SkeletonBlock } from '@/lib/Skeleton';

function fmtSize(bytes: number | null | undefined): string {
  if (!bytes) return '-';
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024).toFixed(0)} KB`;
}

function downloadArtifact(a: Artifact, jobId: number) {
  // /mock/ 경로는 public/ 정적 파일 직접 다운로드, 그 외는 job 파일 서빙 API를 쓴다
  // (GET /api/v1/artifacts/{id}/download 는 존재하지 않음).
  let url: string;
  if (a.file_path?.startsWith('/mock/')) {
    url = a.file_path;
  } else if (a.file_name) {
    url = `/api/v1/trainings/${jobId}/files/${encodeURIComponent(a.file_name)}`;
  } else {
    alert('파일 경로를 확인할 수 없습니다.');
    return;
  }
  const link = document.createElement('a');
  link.href = url;
  link.download = a.file_name ?? 'download';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function downloadAllArtifacts(artifacts: Artifact[], runId: number, jobId: number) {
  if (artifacts.some(a => a.file_path.startsWith('/mock/'))) {
    artifacts.forEach((a, i) => setTimeout(() => downloadArtifact(a, jobId), i * 300));
    return;
  }
  const link = document.createElement('a');
  link.href = `/api/v1/runs/${runId}/artifacts/download`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export default function JobArtifactsPage() {
  const params = useParams();
  const router = useRouter();
  const jobId = Number(Array.isArray(params.jobId) ? params.jobId[0] : params.jobId);

  const [job, setJob] = useState<TrainingJob | null>(null);
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const j = await getTraining(jobId);
      setJob(j);
      if (j.run_id != null) {
        setArtifacts(await getArtifactsByRun(j.run_id));
      } else {
        setArtifacts([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '아티팩트를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => { if (Number.isFinite(jobId)) refresh(); }, [jobId, refresh]);

  if (loading) {
    return (
      <Layout>
        <div className="space-y-4">
          <SkeletonBlock className="h-6 w-64" />
          <div className="rounded-lg border border-gray-200 bg-white p-5 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => <SkeletonBlock key={i} className="h-12 w-full" />)}
          </div>
        </div>
      </Layout>
    );
  }

  const title = (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={() => router.back()}
        className="font-semibold hover:text-blue-600 transition-colors"
      >
        테스트케이스
      </button>
      <span className="text-gray-300">&gt;</span>
      <span className="truncate">아티팩트</span>
    </span>
  );

  return (
    <Layout title={title}>
      <div className="space-y-4">
        {error && (
          <div className="rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {job && (
          <div className="rounded-lg border border-gray-200 bg-white px-5 py-4">
            <p className="text-base font-semibold text-gray-900">{formatExecutionName(job.experiment_name)}</p>
            <p className="mt-1 text-xs text-gray-400">
              {displayUsername(job.user_name, job.user_name_nickname)} · {job.mode ?? '-'} · job #{job.job_id}
            </p>
          </div>
        )}

        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-gray-700">아티팩트 목록</span>
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-400">{artifacts.length}개</span>
            </div>
            {artifacts.length > 0 && job?.run_id != null && (
              <button
                onClick={() => downloadAllArtifacts(artifacts, job.run_id as number, job.job_id)}
                className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-700"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                일괄 다운로드
              </button>
            )}
          </div>
          <div className="divide-y divide-gray-100">
            {artifacts.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-gray-400">아티팩트가 없습니다.</p>
            ) : (
              artifacts.map(a => (
                <div key={a.id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50 transition-colors">
                  <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
                    <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{a.file_name}</p>
                    <p className="text-xs text-gray-400 truncate">
                      {fmtSize(a.file_size)}{a.created_at && ` · ${a.created_at.slice(0, 10)}`}
                    </p>
                  </div>
                  <button
                    onClick={() => downloadArtifact(a, jobId)}
                    className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-gray-200 rounded-lg text-gray-600 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-600 transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    다운로드
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
