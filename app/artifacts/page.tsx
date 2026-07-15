'use client';

import { useState, useEffect, useMemo } from 'react';
import Layout from '@/lib/Layout';
import { getExperimentJobs, getArtifactsByRun, getUsername, displayUsername, formatExecutionName, type TrainingJob, type Artifact } from '@/lib/api';
import { loadClientExperiments, loadExpTcMap, loadTcModelMeta } from '@/lib/experimentStore';
import { SkeletonBlock, SkeletonTableRows } from '@/lib/Skeleton';

const PAGE_SIZE = 5;
type PageItem = number | 'ellipsis-start' | 'ellipsis-end';

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

function pageItems(totalPages: number, currentPage: number): PageItem[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const items: PageItem[] = [1];
  const start = Math.max(2, currentPage - 1);
  const end = Math.min(totalPages - 1, currentPage + 1);

  if (start > 2) items.push('ellipsis-start');
  for (let i = start; i <= end; i += 1) items.push(i);
  if (end < totalPages - 1) items.push('ellipsis-end');
  items.push(totalPages);

  return items;
}

export default function Artifacts() {
  const [trainings, setTrainings]         = useState<TrainingJob[]>([]);
  const [artifacts, setArtifacts]         = useState<Artifact[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<number | null>(null);
  const [selectedJobId, setSelectedJobId] = useState<number | null>(null);
  const [page, setPage]                   = useState(1);
  const [loading, setLoading]             = useState(true);
  const [artLoading, setArtLoading]       = useState(false);

  useEffect(() => {
    getExperimentJobs()
      .then(data => setTrainings(data))
      .catch(() => setTrainings([]))
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
      setArtifacts([]);
    } finally {
      setArtLoading(false);
    }
  };

  const experimentNameByJobId = useMemo(() => {
    const map = loadExpTcMap();
    const names: Record<number, string> = {};

    for (const exp of loadClientExperiments()) {
      const ids = map[exp.id] ?? exp.tc_job_ids;
      ids.forEach(id => {
        names[id] = exp.name;
      });
    }

    return names;
  }, []);

  const completed = trainings
    .filter(t => t.status.toUpperCase() === 'COMPLETED' && experimentNameByJobId[t.job_id])
    .sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''));
  const totalPages = Math.max(1, Math.ceil(completed.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedCompleted = completed.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const pagination = pageItems(totalPages, safePage);
  const currentUser = getUsername() ?? 'admin';

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const experimentName = (jobId: number): string => {
    return experimentNameByJobId[jobId] ?? '-';
  };

  const displayRequester = (job: TrainingJob): string => {
    const stored = loadTcModelMeta(job.job_id)?.requester;
    return displayUsername(stored ?? (job.user_name && job.user_name !== 'anonymous' ? job.user_name : currentUser));
  };

  const displayMode = (job: TrainingJob): string => {
    const stored = loadTcModelMeta(job.job_id)?.architecture;
    return stored ?? job.mode ?? '-';
  };

  if (loading) {
    return (
      <Layout>
        <div className="grid grid-cols-2 gap-5 h-[460px] min-h-0">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col min-h-0">
            <div className="px-5 py-3 border-b border-gray-100">
              <SkeletonBlock className="h-3 w-24" />
            </div>
            <table className="w-full table-fixed text-sm">
              <tbody>
                <SkeletonTableRows rows={5} cols={4} />
              </tbody>
            </table>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col min-h-0 p-5 gap-3">
            <SkeletonBlock className="h-3 w-24" />
            {Array.from({ length: 5 }).map((_, i) => <SkeletonBlock key={i} className="h-10 w-full" />)}
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      {/* 페이지 타이틀은 공통 헤더가 표시 */}
      <div className="grid grid-cols-2 gap-5 h-[460px] min-h-0">
        {/* 완료된 실행 목록 */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col min-h-0">
          <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
            <span className="text-sm font-semibold text-gray-700">완료된 실행</span>
            <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{completed.length}건</span>
          </div>
          <div className="flex-1 min-h-0 overflow-hidden">
            {completed.length === 0 ? (
              <p className="px-5 py-8 text-sm text-center text-gray-400">완료된 실행이 없습니다.</p>
            ) : (
              <table className="w-full table-fixed text-sm">
                <thead className="bg-gray-50 text-xs font-semibold text-gray-500">
                  <tr>
                    <th className="w-[24%] px-4 py-2.5 text-left">실험명</th>
                    <th className="w-[38%] px-4 py-2.5 text-left">실행명</th>
                    <th className="w-[20%] px-4 py-2.5 text-left">요청자</th>
                    <th className="w-[18%] px-4 py-2.5 text-left">방식</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {pagedCompleted.map(t => (
                    <tr
                      key={t.job_id}
                      onClick={() => handleRunSelect(t)}
                      className={`h-[68px] cursor-pointer transition-colors ${
                        selectedRunId === t.run_id
                          ? 'bg-blue-50'
                          : 'hover:bg-gray-50'
                      }`}
                    >
                      <td className="px-4 py-3 font-medium text-gray-700 truncate">{experimentName(t.job_id)}</td>
                      <td className="px-4 py-3 text-gray-800 truncate">{formatExecutionName(t.experiment_name)}</td>
                      <td className="px-4 py-3 text-gray-500 truncate">{displayRequester(t)}</td>
                      <td className="px-4 py-3 text-gray-500 truncate">{displayMode(t)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <div className="h-12 flex items-center justify-center border-t border-gray-100 px-5 text-xs text-gray-500">
            <div className="flex items-center gap-2">
              {pagination.map(item => (
                typeof item === 'number' ? (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setPage(item)}
                    className={`min-w-5 px-1 py-1 transition-colors ${
                      item === safePage
                        ? 'font-semibold text-blue-600 underline underline-offset-4'
                        : 'text-gray-500 hover:text-blue-600'
                    }`}
                  >
                    {item}
                  </button>
                ) : (
                  <span key={item} className="px-1 text-gray-300">...</span>
                )
              ))}
            </div>
          </div>
        </div>

        {/* 아티팩트 목록 */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col min-h-0">
          <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
            <span className="text-sm font-semibold text-gray-700">아티팩트 목록</span>
            {selectedRunId && artifacts.length > 0 && (
              <>
                <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full ml-auto">
                  {artifacts.length}개
                </span>
                <button
                  onClick={() => artifacts.forEach((a, i) => setTimeout(() => handleDownload(a, selectedJobId), i * 300))}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  title="목록의 모든 파일 다운로드"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  일괄 다운로드
                </button>
              </>
            )}
          </div>
          <div className="divide-y divide-gray-100 flex-1 min-h-0 overflow-y-auto">
            {!selectedRunId ? (
              <p className="px-5 py-10 text-sm text-center text-gray-400">좌측에서 실행을 선택하세요.</p>
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
