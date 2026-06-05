'use client';

import { useState, useEffect } from 'react';
import Layout from '../lib/Layout';
import { getSystemStatus } from '../lib/api';

export default function System() {
  const [gpuCount, setGpuCount] = useState(0);
  const [available, setAvailable] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSystemStatus()
      .then((data) => {
        setGpuCount(data.gpu_count);
        setAvailable(data.available);
        setLoading(false);
      })
      .catch(() => {
        setAvailable(false);
        setLoading(false);
      });
  }, []);

  if (loading) return <Layout><div className="text-center py-20">로딩 중...</div></Layout>;

  return (
    <Layout>
      <h1 className="text-2xl font-bold mb-6">시스템 상태</h1>

      {!available && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-600 mb-6">
          GPU를 사용할 수 없습니다.
        </div>
      )}

      <div className="grid grid-cols-3 gap-6">
        {/* GPU 정보 */}
        <div className="bg-white rounded-lg shadow border p-6">
          <div className="text-sm text-gray-500">GPU 개수</div>
          <div className="text-3xl font-bold text-blue-600 mt-2">{gpuCount}</div>
        </div>

        {/* 서버 상태 */}
        <div className="bg-white rounded-lg shadow border p-6">
          <div className="text-sm text-gray-500">서버 상태</div>
          <div className={`text-3xl font-bold mt-2 ${available ? 'text-green-600' : 'text-red-600'}`}>
            {available ? '정상' : '비정상'}
          </div>
        </div>

        {/* 플랫폼 상태 */}
        <div className="bg-white rounded-lg shadow border p-6">
          <div className="text-sm text-gray-500">플랫폼</div>
          <div className="text-3xl font-bold text-green-600 mt-2">DataOps</div>
        </div>
      </div>
    </Layout>
  );
}