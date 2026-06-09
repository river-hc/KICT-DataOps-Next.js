'use client';

import { PERF_HISTORY, type PerfHistoryRow } from './mockData';

function fmtDur(sec: number): string {
  if (sec < 60) return `${sec}초`;
  if (sec < 3600) return `${Math.floor(sec / 60)}분 ${sec % 60}초`;
  return `${Math.floor(sec / 3600)}시간 ${Math.floor((sec % 3600) / 60)}분`;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString('ko-KR', {
    month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  });
}

const BEST_MAE  = Math.min(...PERF_HISTORY.map(r => r.mae));
const BEST_RMSE = Math.min(...PERF_HISTORY.map(r => r.rmse));
const BEST_CSI  = Math.max(...PERF_HISTORY.map(r => r.csi));

export default function PerfHistoryTable({
  data      = PERF_HISTORY,
  accentCls = 'text-blue-700 bg-blue-50',
}: {
  data?:      PerfHistoryRow[];
  accentCls?: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-700">학습 이력</h3>
          <p className="text-xs text-gray-400 mt-0.5">완료 실험 성능 지표 (mock)</p>
        </div>
        <span className="text-xs font-mono text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
          {data.length}건
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              {['Run', '실험명', '버전', '모드', '시작 일자', '소요', 'MAE', 'RMSE', 'CSI_10'].map(h => (
                <th key={h} className="text-left px-4 py-2.5 text-gray-500 font-semibold whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {data.map(r => (
              <tr key={r.run_id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-2.5">
                  <span className={`font-mono text-xs px-1.5 py-0.5 rounded ${accentCls}`}>
                    #{r.run_id}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-gray-700 font-medium max-w-[160px]">
                  <span className="truncate block">{r.name}</span>
                </td>
                <td className="px-4 py-2.5">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                    r.version === 'v3' ? 'bg-emerald-100 text-emerald-700' : 'bg-sky-100 text-sky-700'
                  }`}>
                    {r.version}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-gray-400">{r.mode}</td>
                <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap font-mono">
                  {fmtDate(r.date)}
                </td>
                <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap font-mono">
                  {fmtDur(r.duration)}
                </td>
                <td className={`px-4 py-2.5 font-mono font-semibold whitespace-nowrap ${
                  r.mae === BEST_MAE ? 'text-emerald-600' : 'text-gray-700'
                }`}>
                  {r.mae.toFixed(3)}
                  {r.mae === BEST_MAE && (
                    <span className="ml-1 text-[10px] font-normal text-emerald-400">best</span>
                  )}
                </td>
                <td className={`px-4 py-2.5 font-mono font-semibold whitespace-nowrap ${
                  r.rmse === BEST_RMSE ? 'text-emerald-600' : 'text-gray-700'
                }`}>
                  {r.rmse.toFixed(3)}
                  {r.rmse === BEST_RMSE && (
                    <span className="ml-1 text-[10px] font-normal text-emerald-400">best</span>
                  )}
                </td>
                <td className={`px-4 py-2.5 font-mono font-semibold whitespace-nowrap ${
                  r.csi === BEST_CSI ? 'text-emerald-600' : 'text-gray-700'
                }`}>
                  {r.csi.toFixed(3)}
                  {r.csi === BEST_CSI && (
                    <span className="ml-1 text-[10px] font-normal text-emerald-400">best</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
