'use client';

import { useState, useEffect } from 'react';
import Layout from '../lib/Layout';
import { getModels, type ModelVersion } from '../lib/api';

export default function Models() {
  const [models, setModels] = useState<ModelVersion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getModels().then(setModels).finally(() => setLoading(false));
  }, []);

  const statusColor = (s: string) => {
    if (s === 'deployed') return 'text-green-600';
    if (s === 'staging') return 'text-blue-600';
    if (s === 'archived') return 'text-gray-600';
    return 'text-gray-600';
  };

  if (loading) return <Layout><div className="text-center py-20">로딩 중...</div></Layout>;

  return (
    <Layout>
      <h1 className="text-2xl font-bold mb-6">모델 레지스트리</h1>

      <div className="bg-white rounded-lg shadow border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left p-3">모델명</th>
              <th className="text-left p-3">버전</th>
              <th className="text-left p-3">상태</th>
              <th className="text-left p-3">메타</th>
              <th className="text-left p-3">작성일</th>
            </tr>
          </thead>
          <tbody>
            {models.map((m) => (
              <tr key={m.id} className="border-t">
                <td className="p-3 font-medium">{m.model_name}</td>
                <td className="p-3">{m.version}</td>
                <td className={`p-3 font-medium ${statusColor(m.status)}`}>{m.status}</td>
                <td className="p-3 text-gray-500">{m.metrics ? Object.keys(m.metrics).length + '개' : '-'}</td>
                <td className="p-3 text-gray-500">{m.created_at?.slice(0, 10)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {models.length === 0 && <div className="p-6 text-center text-gray-400">모델이 없습니다.</div>}
      </div>
    </Layout>
  );
}