'use client';

import { useState, useEffect } from 'react';
import Layout from '@/lib/Layout';
import { getSystemStatus, type SystemStatus } from '@/lib/api';

export default function System() {
  const [system, setSystem]   = useState<SystemStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSystemStatus()
      .then(data  => { setSystem(data);  setLoading(false); })
      .catch(()   => {                   setLoading(false); });
  }, []);

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
        <h1 className="text-2xl font-bold text-gray-900">시스템 상태</h1>
        <p className="text-sm text-gray-500 mt-0.5">GPU 자원 및 플랫폼 운영 상태를 확인합니다.</p>
      </div>

      {/* 에러/경고 */}
      {system?.error && (
        <div className="mb-5 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          {system.error}
        </div>
      )}
      {!system?.available && !system?.error && (
        <div className="mb-5 p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700">
          GPU를 사용할 수 없습니다.
        </div>
      )}

      {/* 요약 카드 */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-2">GPU 개수</p>
          <p className="text-3xl font-bold text-blue-600">{system?.gpu_count ?? 0}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-2">서버 상태</p>
          <p className={`text-3xl font-bold ${system?.available ? 'text-emerald-600' : 'text-red-600'}`}>
            {system?.available ? '정상' : '비정상'}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-2">플랫폼</p>
          <p className="text-3xl font-bold text-emerald-600">DataOps</p>
        </div>
      </div>

      {/* GPU 상세 */}
      {system && system.gpus.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100">
            <span className="text-sm font-semibold text-gray-700">GPU 상세 정보</span>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                {['GPU', '이름', '사용률', '메모리 사용', '여유 메모리', '온도'].map(h => (
                  <th key={h} className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {system.gpus.map(gpu => (
                <tr key={gpu.index} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3 font-mono text-xs text-gray-600">#{gpu.index}</td>
                  <td className="px-5 py-3 font-medium text-gray-800">{gpu.name}</td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-gray-200 rounded-full h-1.5 w-16">
                        <div
                          className="h-1.5 rounded-full bg-blue-500"
                          style={{ width: `${gpu.utilization_percent}%` }}
                        />
                      </div>
                      <span className="text-gray-700 text-xs">{gpu.utilization_percent}%</span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-gray-600">
                    {(gpu.memory_used_mb / 1024).toFixed(1)} / {(gpu.memory_total_mb / 1024).toFixed(1)} GB
                  </td>
                  <td className="px-5 py-3 text-gray-600">{(gpu.memory_free_mb / 1024).toFixed(1)} GB</td>
                  <td className="px-5 py-3 text-gray-600">{gpu.temperature_c != null ? `${gpu.temperature_c}°C` : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Layout>
  );
}
