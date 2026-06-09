'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Layout from '../lib/Layout';
import { getTrainings, type TrainingJob } from '../lib/api';
import {
  MOCK_TRAININGS,
  MOCK_DETAILS,
  fmtDateTime,
  fmtDuration,
} from '../lib/mockData';

const METRIC_META: Record<string, { label: string; max: number; higherBetter: boolean }> = {
  mae:    { label: 'MAE',    max: 6, higherBetter: false },
  rmse:   { label: 'RMSE',  max: 8, higherBetter: false },
  csi_10: { label: 'CSI 10', max: 1, higherBetter: true  },
  csi_20: { label: 'CSI 20', max: 1, higherBetter: true  },
  csi_30: { label: 'CSI 30', max: 1, higherBetter: true  },
  pod:    { label: 'POD',   max: 1, higherBetter: true  },
  far:    { label: 'FAR',   max: 1, higherBetter: false },
  bias:   { label: 'BIAS',  max: 2, higherBetter: false },
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
  const [jobs, setJobs]     = useState<TrainingJob[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getTrainings()
      .then(data => setJobs(data.filter(j => j.status === 'COMPLETED')))
      .catch(() => setJobs(MOCK_TRAININGS.filter(j => j.status === 'COMPLETED')))
      .finally(() => setLoading(false));
  }, []);

  const allMetrics = jobs
    .map(j => MOCK_DETAILS[j.job_id]?.metrics)
    .filter((m): m is Record<string, number> => m != null);

  const bestMAE   = allMetrics.length ? Math.min(...allMetrics.map(m => m.mae    ?? Infinity))  : null;
  const bestCSI10 = allMetrics.length ? Math.max(...allMetrics.map(m => m.csi_10 ?? -Infinity)) : null;

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">실험 결과</h1>
        <p className="text-sm text-gray-500 mt-0.5">완료된 QPF 실험의 성능 지표와 예측 이미지를 확인합니다.</p>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <SummaryCard
          label="완료 실험 수"
          value={loading ? '...' : `${jobs.length}건`}
          sub="전체 기간 누계"
        />
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
                {['#', '실험명', '모델', '모드', '완료 시각', '소요 시간', 'MAE', 'RMSE', 'CSI 10', 'POD', 'FAR', 'Run'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {jobs.map(j => {
                const d = MOCK_DETAILS[j.job_id];
                const m = d?.metrics;
                return (
                  <tr
                    key={j.job_id}
                    onClick={() => router.push(`/experiment-results/${j.job_id}`)}
                    className="cursor-pointer transition-colors hover:bg-blue-50"
                  >
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                        #{j.job_id}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900 max-w-xs">
                      <span className="block truncate">{j.experiment_name}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                        d?.params.model_version === 'v3'
                          ? 'bg-violet-50 text-violet-700'
                          : 'bg-amber-50 text-amber-700'
                      }`}>
                        {d?.params.model_version ?? '-'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">{j.mode}</td>
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{fmtDateTime(j.finished_at)}</td>
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{fmtDuration(j.started_at, j.finished_at)}</td>
                    {(['mae', 'rmse', 'csi_10', 'pod', 'far'] as const).map(key => {
                      const val = m?.[key];
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
                    <td className="px-4 py-3">
                      {j.run_id != null
                        ? <span className="font-mono text-xs bg-violet-50 text-violet-700 px-1.5 py-0.5 rounded">#{j.run_id}</span>
                        : <span className="text-gray-300 text-xs">-</span>}
                    </td>
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
