'use client';

import { useState, useEffect } from 'react';
import Layout from '../lib/Layout';
import { getSystemStatus, type SystemStatus } from '../lib/api';

export default function System() {
  const [system, setSystem] = useState<SystemStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSystemStatus()
      .then((data) => {
        setSystem(data);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, []);

  if (loading) return <Layout><div className="text-center py-20">로딩 중...</div></Layout>;

  return (
    <Layout>
      <h1 className="text-2xl font-bold mb-6">시스템 상태</h1>

      {system?.error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-600 mb-6">
          {system.error}
        </div>
      )}

      {!system?.available && !system?.error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-600 mb-6">
          GPU를 사용할 수 없습니다.
        </div>
      )}

      <div className="grid grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow border p-6">
          <div className="text-sm text-gray-500">GPU 개수</div>
          <div className="text-3xl font-bold text-blue-600 mt-2">{system?.gpu_count ?? 0}</div>
        </div>

        <div className="bg-white rounded-lg shadow border p-6">
          <div className="text-sm text-gray-500">서버 상태</div>
          <div className={`text-3xl font-bold mt-2 ${system?.available ? 'text-green-600' : 'text-red-600'}`}>
            {system?.available ? '정상' : '비정상'}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow border p-6">
          <div className="text-sm text-gray-500">플랫폼</div>
          <div className="text-3xl font-bold text-green-600 mt-2">DataOps</div>
        </div>
      </div>

      {system && system.gpus.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold mb-3">GPU 상세 정보</h2>
          <div className="bg-white rounded-lg shadow border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left p-3">GPU</th>
                  <th className="text-left p-3">이름</th>
                  <th className="text-left p-3">사용률</th>
                  <th className="text-left p-3">메모리 사용</th>
                  <th className="text-left p-3">여유 메모리</th>
                  <th className="text-left p-3">온도</th>
                </tr>
              </thead>
              <tbody>
                {system.gpus.map((gpu) => (
                  <tr key={gpu.index} className="border-t">
                    <td className="p-3">{gpu.index}</td>
                    <td className="p-3">{gpu.name}</td>
                    <td className="p-3">{gpu.utilization_percent}%</td>
                    <td className="p-3">
                      {(gpu.memory_used_mb / 1024).toFixed(1)} / {(gpu.memory_total_mb / 1024).toFixed(1)} GB
                    </td>
                    <td className="p-3">{(gpu.memory_free_mb / 1024).toFixed(1)} GB</td>
                    <td className="p-3">{gpu.temperature_c ?? '-'}°C</td>
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
