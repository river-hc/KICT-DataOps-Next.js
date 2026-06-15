'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '@/lib/Layout';
import { getModels, type ModelVersion } from '@/lib/api';
import { getModelAliases, loadHidden } from '@/lib/modelStore';
import { MOCK_MODELS } from '@/lib/modelMock';

// ─── 모델 그룹 요약 ──────────────────────────────────────────────────────────

interface ModelGroup {
  name: string;
  versionCount: number;
  latest: ModelVersion;
  aliases: { alias: string; version: string }[];
  latestRegistered: string | null;
}

function buildGroups(models: ModelVersion[]): ModelGroup[] {
  const map = new Map<string, ModelVersion[]>();
  for (const m of models) {
    const arr = map.get(m.model_name) ?? [];
    arr.push(m);
    map.set(m.model_name, arr);
  }
  return Array.from(map.entries()).map(([name, arr]) => {
    const sorted = [...arr].sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''));
    const byId = new Map(sorted.map(m => [m.id, m.version]));
    const aliasMap = getModelAliases(name); // { alias: versionId }
    const aliases = Object.entries(aliasMap)
      .filter(([, vid]) => byId.has(vid))
      .map(([alias, vid]) => ({ alias, version: byId.get(vid)! }))
      .sort((a, b) => a.alias.localeCompare(b.alias));
    return {
      name,
      versionCount: sorted.length,
      latest: sorted[0],
      aliases,
      latestRegistered: sorted[0]?.created_at ?? null,
    };
  });
}

// ─── Main — 등록된 모델 목록 ─────────────────────────────────────────────────

export default function Models() {
  const router = useRouter();
  const [models, setModels]   = useState<ModelVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [hidden, setHidden]   = useState<number[]>([]);

  const refresh = useCallback(() => {
    getModels()
      .then(data => setModels(data.length ? data : MOCK_MODELS))
      .catch(() => setModels(MOCK_MODELS))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => { setHidden(loadHidden()); }, []);

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

  const groups = buildGroups(models.filter(m => !hidden.includes(m.id)));

  return (
    <Layout>
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100">
          <span className="text-sm font-semibold text-gray-700">등록된 모델 ({groups.length})</span>
        </div>

        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              {['모델명', '버전 수', '최신 버전', '별칭(Aliases)', '최근 등록일'].map(h => (
                <th key={h} className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {groups.map(g => (
              <tr
                key={g.name}
                onClick={() => router.push(`/models/${encodeURIComponent(g.name)}`)}
                className="cursor-pointer border-b border-gray-100 hover:bg-gray-50 transition-colors"
              >
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2.5">
                    <svg className="w-4.5 h-4.5 text-gray-400 flex-shrink-0" width="18" height="18" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.27 6.96L12 12.01l8.73-5.05M12 22.08V12" />
                    </svg>
                    <span className="font-semibold text-blue-600">{g.name}</span>
                  </div>
                </td>
                <td className="px-5 py-3 text-gray-700">{g.versionCount}개</td>
                <td className="px-5 py-3">
                  <span className="font-mono text-xs font-semibold text-gray-700">{g.latest?.version ?? '-'}</span>
                </td>
                <td className="px-5 py-3">
                  {g.aliases.length > 0 ? (
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {g.aliases.map(({ alias, version }) => (
                        <span key={alias} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-100">
                          @{alias}
                          <span className="font-mono text-blue-400">{version}</span>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-xs text-gray-300">없음</span>
                  )}
                </td>
                <td className="px-5 py-3 text-gray-400 text-xs whitespace-nowrap">
                  {g.latestRegistered?.slice(0, 10) ?? '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {groups.length === 0 && (
          <div className="py-16 text-center text-gray-400 text-sm">등록된 모델이 없습니다.</div>
        )}
      </div>
    </Layout>
  );
}
