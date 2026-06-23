'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Layout from '@/lib/Layout';
import {
  getLocalSystem,
  type LocalSystemInfo,
  // 백엔드 GPU 인식: 당장 미사용 — 주석 처리 (2026-06-12)
  // getSystemStatus, type SystemStatus,
} from '@/lib/api';

const POLL_MS      = 3000;
const HISTORY_MAX  = 40;   // 스파크라인 최대 포인트 수 (3초 × 40 = 약 2분)

// ─── 스파크라인 (프론트 메모리 누적 — 새로고침 시 초기화) ─────────────────────

function Sparkline({ points }: { points: number[] }) {
  if (points.length < 2) {
    return <span className="text-[10px] text-gray-300">수집 중...</span>;
  }
  const W = 96, H = 28;
  const step = W / (HISTORY_MAX - 1);
  const startX = W - (points.length - 1) * step;
  const path = points
    .map((v, i) => {
      const x = startX + i * step;
      const y = H - 2 - (Math.min(100, Math.max(0, v)) / 100) * (H - 4);
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="flex-shrink-0">
      <path d={path} fill="none" stroke="#3b82f6" strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

// ─── 자원 게이지 (CPU / RAM / DISK) ──────────────────────────────────────────

function ResourceGauge({
  label, percent, detail, desc,
}: {
  label: string; percent: number | null; detail: string; desc: string;
}) {
  const pct = percent != null ? Math.min(100, Math.max(0, percent)) : null;
  const barColor =
    pct == null      ? 'bg-gray-200'  :
    pct >= 90        ? 'bg-red-500'   :
    pct >= 75        ? 'bg-amber-500' :
                       'bg-blue-500';
  return (
    <div className="px-5 py-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-bold text-gray-700">{label}</span>
        <span className="text-xs text-gray-600 tabular-nums">{pct != null ? `${pct}%` : '-'}</span>
      </div>
      <div className="bg-gray-100 rounded-full h-1.5 mb-2 overflow-hidden">
        {pct != null && (
          <div className={`h-1.5 rounded-full transition-all duration-500 ${barColor}`} style={{ width: `${pct}%` }} />
        )}
      </div>
      <p className="text-[11px] text-gray-500 tabular-nums">{detail}</p>
      <p className="text-[10px] text-gray-400 mt-0.5">{desc}</p>
    </div>
  );
}

// ─── 메인 ─────────────────────────────────────────────────────────────────────

export default function System() {
  const [local, setLocal]       = useState<LocalSystemInfo | null>(null);
  // 백엔드 GPU 인식: 당장 미사용 — 주석 처리 (2026-06-12)
  // const [backendGpu, setBackendGpu] = useState<SystemStatus | null>(null);
  const [loading, setLoading]   = useState(true);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  // GPU별 사용률 히스토리 — 프론트 메모리에만 누적 (새로고침 시 소실)
  const historyRef = useRef<Record<number, number[]>>({});
  const [, bumpHistory] = useState(0);

  const poll = useCallback(async () => {
    const sys = await getLocalSystem().catch(() => null);

    if (sys) {
      setLocal(sys);
      for (const gpu of sys.gpu.gpus) {
        const h = historyRef.current[gpu.id] ?? [];
        h.push(gpu.utilization);
        if (h.length > HISTORY_MAX) h.shift();
        historyRef.current[gpu.id] = h;
      }
      bumpHistory(n => n + 1);
    }

    setUpdatedAt(new Date());
    setLoading(false);
  }, []);

  useEffect(() => {
    poll();
    const t = setInterval(poll, POLL_MS);
    return () => clearInterval(t);
  }, [poll]);

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

  const gpu = local?.gpu ?? null;
  const ramPct  = local ? Math.round((local.ram.used_mb / local.ram.total_mb) * 100) : null;
  const diskPct = local?.disk ? Math.round((local.disk.used_gb / local.disk.total_gb) * 100) : null;

  return (
    <Layout>
      {/* 페이지 타이틀은 공통 헤더가 표시 — 갱신 시각만 우측 정렬로 유지 */}
      {updatedAt && (
        <div className="flex justify-end mb-4">
          <p className="text-xs text-gray-400">
            현재 PC{local ? ` (${local.host})` : ''} 기준 · 마지막 갱신 {updatedAt.toLocaleTimeString('ko-KR')} · {POLL_MS / 1000}초 주기
          </p>
        </div>
      )}

      {/* GPU 상세 (실시간 폴링 + 사용률 추이) */}
      {gpu && gpu.gpus.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden mb-6">
          <div className="px-5 py-3 border-b border-gray-100">
            <span className="text-sm font-semibold text-gray-700">GPU 상세 정보</span>
            <span className="text-xs text-gray-400 ml-2">현재 PC 기준</span>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                {['GPU', '이름', '사용률', '추이 (최근 2분)', '메모리 사용', '여유 메모리', '온도'].map(h => (
                  <th key={h} className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {gpu.gpus.map(g => (
                <tr key={g.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3 font-mono text-xs text-gray-600">#{g.id}</td>
                  <td className="px-5 py-3 font-medium text-gray-800">{g.name}</td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-gray-200 rounded-full h-1.5 w-16">
                        <div
                          className="h-1.5 rounded-full bg-blue-500 transition-all duration-500"
                          style={{ width: `${g.utilization}%` }}
                        />
                      </div>
                      <span className="text-gray-700 text-xs tabular-nums">{g.utilization}%</span>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <Sparkline points={historyRef.current[g.id] ?? []} />
                  </td>
                  <td className="px-5 py-3 text-gray-600 tabular-nums">
                    {(g.memory_used / 1024).toFixed(1)} / {(g.memory_total / 1024).toFixed(1)} GB
                  </td>
                  <td className="px-5 py-3 text-gray-600 tabular-nums">{(g.memory_free / 1024).toFixed(1)} GB</td>
                  <td className="px-5 py-3 text-gray-600 tabular-nums">{g.temperature != null ? `${g.temperature}°C` : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 시스템 자원 — 현재 PC 기준 실측 */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden mb-6">
        <div className="px-5 py-3 border-b border-gray-100">
          <span className="text-sm font-semibold text-gray-700">시스템 자원</span>
          <span className="text-xs text-gray-400 ml-2">현재 PC 기준</span>
        </div>
        <div className="grid grid-cols-3 divide-x divide-gray-100">
          <ResourceGauge
            label="CPU"
            percent={local?.cpu.percent ?? null}
            detail={local ? `${local.cpu.cores}코어 · Load ${local.cpu.load_avg[0] ?? '-'}` : '-'}
            desc={local?.cpu.model ?? '사용률 · 코어 수'}
          />
          <ResourceGauge
            label="RAM"
            percent={ramPct}
            detail={local ? `${(local.ram.used_mb / 1024).toFixed(1)} / ${(local.ram.total_mb / 1024).toFixed(1)} GB` : '-'}
            desc="MemAvailable 기준 사용량"
          />
          <ResourceGauge
            label="DISK"
            percent={diskPct}
            detail={local?.disk ? `${local.disk.used_gb.toFixed(1)} / ${local.disk.total_gb.toFixed(1)} GB` : '-'}
            desc="루트(/) 파티션 기준"
          />
        </div>
      </div>

    </Layout>
  );
}
