'use client';

import { useState } from 'react';
import Layout from '../lib/Layout';
import { type ExperimentRun } from '../lib/api';

// ─── 모의 데이터 ──────────────────────────────────────────────────────────────

const MOCK_RUNS: (ExperimentRun & { experiment_name: string })[] = [
  {
    id: 12, experiment_id: 4, job_id: 4,
    experiment_name: '2026-06-04 12:00 오후 QPE (v3)',
    run_name: 'run_20260604_1200', version: '3', mode: 'single', status: 'COMPLETED',
    parameters: { model_version: 'v3', forecast_steps: [10,20,30,60,90,120,180], include_preview_image: true },
    metrics: { mae: 2.34, rmse: 4.12, csi_10: 0.78, pod: 0.82, far: 0.18 },
    created_by: 'admin',
    started_at: '2026-06-04T12:00:00', finished_at: '2026-06-04T12:18:34',
    duration_seconds: 1114, created_at: '2026-06-04T11:55:00',
  },
  {
    id: 11, experiment_id: 5, job_id: 5,
    experiment_name: '2026-06-04 09:00 오전 QPE (v2)',
    run_name: 'run_20260604_0900', version: '2', mode: 'single', status: 'COMPLETED',
    parameters: { model_version: 'v2', forecast_steps: [10,20,30,60,90,120,180], include_preview_image: true },
    metrics: { mae: 3.01, rmse: 5.44, csi_10: 0.71, pod: 0.76, far: 0.24 },
    created_by: 'researcher1',
    started_at: '2026-06-04T09:00:00', finished_at: '2026-06-04T09:22:10',
    duration_seconds: 1330, created_at: '2026-06-04T08:55:00',
  },
  {
    id: 10, experiment_id: 6, job_id: 6,
    experiment_name: '2026-06-03 18:00 저녁 예보 검증 (v3)',
    run_name: 'run_20260603_1800', version: '3', mode: 'multi', status: 'COMPLETED',
    parameters: { model_version: 'v3', forecast_steps: [10,20,30,60,90,120,180], include_preview_image: true },
    metrics: { mae: 2.18, rmse: 3.87, csi_10: 0.81, pod: 0.85, far: 0.15 },
    created_by: 'admin',
    started_at: '2026-06-03T18:00:00', finished_at: '2026-06-03T18:35:20',
    duration_seconds: 2120, created_at: '2026-06-03T17:55:00',
  },
];

// ─── 유틸 ─────────────────────────────────────────────────────────────────────

function fmtDateTime(iso: string | null): string {
  if (!iso) return '-';
  return new Date(iso).toLocaleString('ko-KR', {
    month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

function fmtDuration(sec: number | null): string {
  if (sec == null) return '-';
  if (sec < 60) return `${sec}초`;
  if (sec < 3600) return `${Math.floor(sec / 60)}분 ${sec % 60}초`;
  return `${Math.floor(sec / 3600)}시간 ${Math.floor((sec % 3600) / 60)}분`;
}

// ─── 페이지 ───────────────────────────────────────────────────────────────────

export default function RunsPage() {
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const selected = MOCK_RUNS.find(r => r.id === selectedId) ?? null;

  return (
    <Layout>
      {/* 헤더 */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">학습 결과</h1>
        <p className="text-sm text-gray-500 mt-0.5">실험별 학습 실행 이력과 성능 지표를 확인합니다.</p>
      </div>

      <div className="flex gap-5">
        {/* Run 목록 */}
        <div className={`${selected ? 'w-1/2' : 'w-full'} transition-all duration-200`}>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Run</th>
                  <th className="text-left px-4 py-3 font-medium">실험명</th>
                  <th className="text-left px-4 py-3 font-medium">버전</th>
                  <th className="text-left px-4 py-3 font-medium">요청자</th>
                  <th className="text-left px-4 py-3 font-medium">소요 시간</th>
                  <th className="text-left px-4 py-3 font-medium">완료 시각</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {MOCK_RUNS.map(run => (
                  <tr
                    key={run.id}
                    onClick={() => setSelectedId(selectedId === run.id ? null : run.id)}
                    className={`cursor-pointer transition-colors ${
                      selectedId === run.id
                        ? 'bg-blue-50 border-l-2 border-blue-500'
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded">
                        #{run.id}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-800 max-w-[200px] truncate">
                      {run.experiment_name}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-semibold text-gray-600 bg-gray-100 px-2 py-0.5 rounded">
                        v{run.version}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{run.created_by}</td>
                    <td className="px-4 py-3 text-gray-500">{fmtDuration(run.duration_seconds)}</td>
                    <td className="px-4 py-3 text-gray-500">{fmtDateTime(run.finished_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {MOCK_RUNS.length === 0 && (
              <div className="py-16 text-center text-gray-400 text-sm">완료된 학습 결과가 없습니다.</div>
            )}
          </div>
        </div>

        {/* 상세 패널 */}
        {selected && (
          <div className="w-1/2 space-y-4">
            {/* 패널 헤더 */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <div className="flex items-start justify-between mb-1">
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">Run #{selected.id}</p>
                  <h2 className="font-semibold text-gray-900">{selected.experiment_name}</h2>
                  <p className="text-xs text-gray-500 mt-1">
                    {selected.created_by} · {selected.mode} · v{selected.version}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedId(null)}
                  className="text-gray-400 hover:text-gray-600 text-sm"
                >
                  ✕
                </button>
              </div>
              <div className="grid grid-cols-3 gap-3 mt-4">
                <div className="bg-gray-50 rounded-lg px-3 py-2 text-center">
                  <p className="text-xs text-gray-400">시작</p>
                  <p className="text-xs font-medium text-gray-700 mt-0.5">{fmtDateTime(selected.started_at)}</p>
                </div>
                <div className="bg-gray-50 rounded-lg px-3 py-2 text-center">
                  <p className="text-xs text-gray-400">완료</p>
                  <p className="text-xs font-medium text-gray-700 mt-0.5">{fmtDateTime(selected.finished_at)}</p>
                </div>
                <div className="bg-gray-50 rounded-lg px-3 py-2 text-center">
                  <p className="text-xs text-gray-400">소요</p>
                  <p className="text-xs font-medium text-gray-700 mt-0.5">{fmtDuration(selected.duration_seconds)}</p>
                </div>
              </div>
            </div>

            {/* 파라미터 */}
            {selected.parameters && (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">파라미터</h3>
                <div className="space-y-2">
                  {Object.entries(selected.parameters).map(([k, v]) => (
                    <div key={k} className="flex justify-between items-center">
                      <span className="text-xs text-gray-500">{k}</span>
                      <span className="text-xs font-medium text-gray-900 text-right max-w-[60%] truncate">
                        {Array.isArray(v) ? (v as number[]).join(', ') : String(v)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 성능 지표 */}
            {selected.metrics && (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">성능 지표</h3>
                <div className="grid grid-cols-3 gap-2">
                  {Object.entries(selected.metrics).map(([k, v]) => (
                    <div key={k} className="bg-blue-50 rounded-lg p-3 text-center">
                      <p className="text-xs text-gray-400 uppercase font-medium">{k.replace(/_/g, ' ')}</p>
                      <p className="text-base font-bold text-blue-700 mt-0.5">
                        {typeof v === 'number' ? v.toFixed(3) : String(v)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
