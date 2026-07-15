'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '@/lib/Layout';
import { getExperimentJobs, getTrainingResult, formatExecutionName, type TrainingJob, type TrainingResult } from '@/lib/api';
import { fmtDateTime, fmtDuration } from '@/lib/mockData';
import { SkeletonBlock, SkeletonTableRows } from '@/lib/Skeleton';

const METRIC_META: Record<string, { label: string; max: number; higherBetter: boolean }> = {
  mae:    { label: 'MAE',    max: 6, higherBetter: false },
  rmse:   { label: 'RMSE',  max: 8, higherBetter: false },
  csi_10: { label: 'CSI 10', max: 1, higherBetter: true  },
  csi_20: { label: 'CSI 20', max: 1, higherBetter: true  },
  csi_30: { label: 'CSI 30', max: 1, higherBetter: true  },
};

function SummaryCard({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 px-5 py-4 shadow-sm">
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${accent ?? 'text-gray-900'}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

export default function ExperimentResults() {
  const router = useRouter();
  const [jobs, setJobs]       = useState<TrainingJob[]>([]);
  const [results, setResults] = useState<Record<number, TrainingResult>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getExperimentJobs()
      .then(data => setJobs(data.filter(j => j.status === 'COMPLETED')))
      .catch(() => setJobs([]))
      .finally(() => setLoading(false));
  }, []);

  // 완료 job 목록이 결정되면 각 result를 병렬 조회
  useEffect(() => {
    if (jobs.length === 0) return;
    Promise.all(jobs.map(j => getTrainingResult(j.job_id).catch(() => null)))
      .then(res => {
        const map: Record<number, TrainingResult> = {};
        res.forEach((r, i) => { if (r) map[jobs[i].job_id] = r; });
        setResults(map);
      });
  }, [jobs]);

  const allMetrics = Object.values(results)
    .map(r => r.metrics)
    .filter((m): m is Record<string, number> => !!m && Object.keys(m).length > 0);

  const bestMAE   = allMetrics.length ? Math.min(...allMetrics.map(m => m.mae    ?? Infinity))  : null;
  const bestCSI10 = allMetrics.length ? Math.max(...allMetrics.map(m => m.csi_10 ?? -Infinity)) : null;

  return (
    <Layout>
      {/* 페이지 타이틀은 공통 헤더가 표시 */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {loading ? (
          <div className="bg-white rounded-xl border border-gray-200 px-5 py-4 shadow-sm space-y-2">
            <SkeletonBlock className="h-3 w-16" />
            <SkeletonBlock className="h-6 w-20" />
          </div>
        ) : (
          <SummaryCard
            label="완료 실험 수"
            value={`${jobs.length}건`}
            sub="전체 기간 누계"
          />
        )}
        <SummaryCard
          label="최저 MAE"
          value={bestMAE != null ? `${bestMAE.toFixed(3)} mm` : '-'}
          sub="낮을수록 우수"
          accent="text-blue-700"
        />
        <SummaryCard
          label="최고 CSI 10"
          value={bestCSI10 != null ? bestCSI10.toFixed(3) : '-'}
          sub="높을수록 우수"
          accent="text-emerald-700"
        />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-700">완료 실험 목록</span>
          {loading && <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                {['실험명', '모델', '모드', '완료 시각', '소요 시간', 'MAE', 'RMSE', 'CSI 10'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading && jobs.length === 0 && <SkeletonTableRows rows={5} cols={8} />}
              {jobs.map(j => {
                const result       = results[j.job_id];
                const modelVersion = result?.params?.model_version ?? null;
                const m            = result?.metrics;
                const hasMetrics   = m && Object.keys(m).length > 0;
                return (
                  <tr
                    key={j.job_id}
                    onClick={() => router.push(`/experiment-results/${j.job_id}`)}
                    className="cursor-pointer transition-colors hover:bg-blue-50"
                  >
                    <td className="px-4 py-3 font-medium text-gray-900 max-w-xs">
                      <span className="block truncate">{formatExecutionName(j.experiment_name, results[j.job_id]?.params.run_datetime)}</span>
                    </td>
                    <td className="px-4 py-3">
                      {modelVersion ? (
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                          modelVersion === 'v3' ? 'bg-violet-50 text-violet-700' : 'bg-amber-50 text-amber-700'
                        }`}>
                          {modelVersion}
                        </span>
                      ) : (
                        <span className="text-gray-300 text-xs">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">{j.mode}</td>
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{fmtDateTime(j.finished_at)}</td>
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{fmtDuration(j.started_at, j.finished_at)}</td>
                    {(['mae', 'rmse', 'csi_10'] as const).map(key => {
                      const val = hasMetrics ? (m as Record<string, number>)[key] : undefined;
                      if (val == null) return <td key={key} className="px-4 py-3 text-gray-300 text-xs">-</td>;
                      const meta = METRIC_META[key];
                      const pct  = val / meta.max;
                      const good = meta.higherBetter ? pct > 0.6 : pct < 0.4;
                      return (
                        <td key={key} className="px-4 py-3">
                          <span className={`font-mono text-xs font-semibold ${good ? 'text-emerald-700' : 'text-amber-700'}`}>
                            {val.toFixed(3)}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!loading && jobs.length === 0 && (
            <div className="py-16 text-center text-gray-400 text-sm">완료된 실험이 없습니다.</div>
          )}
        </div>
      </div>
    </Layout>
  );
}
