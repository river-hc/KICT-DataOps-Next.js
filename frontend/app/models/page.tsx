'use client';

import { useState, useEffect } from 'react';
import Layout from '@/lib/Layout';
import { getModels, type ModelVersion } from '@/lib/api';

const STATUS_STYLE: Record<string, string> = {
  SELECTED: 'bg-emerald-100 text-emerald-800',
  CREATED:  'bg-blue-100   text-blue-800',
  ARCHIVED: 'bg-gray-100   text-gray-500',
};

function StatusBadge({ status }: { status: string }) {
  const cls = STATUS_STYLE[status] ?? 'bg-gray-100 text-gray-600';
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>
      {status}
    </span>
  );
}

export default function Models() {
  const [models, setModels]   = useState<ModelVersion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getModels().then(setModels).finally(() => setLoading(false));
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
        <h1 className="text-2xl font-bold text-gray-900">모델 레지스트리</h1>
        <p className="text-sm text-gray-500 mt-0.5">등록된 모델 버전과 배포 상태를 관리합니다.</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              {['모델명', '버전', '상태', '메타', '작성일'].map(h => (
                <th key={h} className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {models.map(m => (
              <tr key={m.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-5 py-3 font-medium text-gray-800">{m.model_name}</td>
                <td className="px-5 py-3">
                  <span className="font-mono text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                    {m.version}
                  </span>
                </td>
                <td className="px-5 py-3">
                  <StatusBadge status={m.status} />
                </td>
                <td className="px-5 py-3 text-gray-500">
                  {m.metrics ? `${Object.keys(m.metrics).length}개` : '-'}
                </td>
                <td className="px-5 py-3 text-gray-400 text-xs">{m.created_at?.slice(0, 10) ?? '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {models.length === 0 && (
          <div className="py-16 text-center text-gray-400 text-sm">등록된 모델이 없습니다.</div>
        )}
      </div>
    </Layout>
  );
}
