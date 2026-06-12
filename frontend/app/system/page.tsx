'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Layout from '@/lib/Layout';
import {
  getLocalSystem, getTrainings,
  type LocalSystemInfo, type TrainingJob,
  // 백엔드 GPU 인식: 당장 미사용 — 주석 처리 (2026-06-12)
  // getSystemStatus, type SystemStatus,
} from '@/lib/api';

const POLL_MS      = 3000;
const HISTORY_MAX  = 40;   // 스파크라인 최대 포인트 수 (3초 × 40 = 약 2분)

// ─── 유틸 ─────────────────────────────────────────────────────────────────────

function fmtElapsed(start: string | null): string {
  if (!start) return '-';
  const s = Math.max(0, Math.floor((Date.now() - new Date(start).getTime()) / 1000));
  if (s < 60)   return `${s}초`;
  if (s < 3600) return `${Math.floor(s / 60)}분 ${s % 60}초`;
  return `${Math.floor(s / 3600)}시간 ${Math.floor((s % 3600) / 60)}분`;
}

function fmtUptime(sec: number): string {
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (d > 0) return `${d}일 ${h}시간 ${m}분`;
  if (h > 0) return `${h}시간 ${m}분`;
  return `${m}분`;
}

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

// ─── 헬스 요약 카드 ───────────────────────────────────────────────────────────

function SummaryCard({
  label, value, sub, tone = 'gray',
}: {
  label: string; value: string; sub?: string; tone?: 'blue' | 'emerald' | 'amber' | 'red' | 'gray';
}) {
  const toneCls: Record<string, string> = {
    blue:    'text-blue-600',
    emerald: 'text-emerald-600',
    amber:   'text-amber-600',
    red:     'text-red-600',
    gray:    'text-gray-700',
  };
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
      <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-2">{label}</p>
      <p className={`text-3xl font-bold ${toneCls[tone]}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
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
  const [jobs, setJobs]         = useState<TrainingJob[]>([]);
  // 백엔드 GPU 인식: 당장 미사용 — 주석 처리 (2026-06-12)
  // const [backendGpu, setBackendGpu] = useState<SystemStatus | null>(null);
  const [backendLatency, setBackendLatency] = useState<number | null>(null);
  const [loading, setLoading]   = useState(true);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  // GPU별 사용률 히스토리 — 프론트 메모리에만 누적 (새로고침 시 소실)
  const historyRef = useRef<Record<number, number[]>>({});
  const [, bumpHistory] = useState(0);

  const poll = useCallback(async () => {
    const t0 = performance.now();
    const [sys, trainings] = await Promise.all([
      getLocalSystem().catch(() => null),
      getTrainings().then(d => {
        setBackendLatency(Math.round(performance.now() - t0));
        return d;
      }).catch(() => {
        setBackendLatency(null);
        return null;
      }),
      // 백엔드 GPU 인식: 당장 미사용 — 주석 처리 (2026-06-12)
      // 복원 시: 배열에 getSystemStatus().catch(() => null) 추가 + bGpu 구조분해 + setBackendGpu(bGpu)
      // getSystemStatus().catch(() => null),
    ]);

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
    if (trainings) setJobs(trainings);

    setUpdatedAt(new Date());
    setLoading(false);
  }, []);

  useEffect(() => {
    poll();
    const t = setInterval(poll, POLL_MS);
    return () => clearInterval(t);
  }, [poll]);

  // 작업 부하 집계 (백엔드 기준 — 작업은 백엔드 서버에서 실행됨)
  const statusOf = (j: TrainingJob) => j.status.toUpperCase();
  const runningJobs = jobs.filter(j => statusOf(j) === 'RUNNING');
  const queuedCount = jobs.filter(j => statusOf(j) === 'QUEUED').length;
  const failedCount = jobs.filter(j => statusOf(j) === 'FAILED').length;

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

      {/* GPU 미감지 안내 */}
      {gpu && !gpu.available && (
        <div className="mb-5 p-4 bg-amber-50 border border-amber-200 rounded-xl">
          <p className="text-sm font-semibold text-amber-800 mb-1">
            이 PC에서 GPU가 감지되지 않습니다
            {gpu.error && <span className="font-mono font-normal text-xs ml-1.5">({gpu.error})</span>}
          </p>
          <p className="text-xs text-amber-700 leading-relaxed">
            NVIDIA 드라이버가 설치되어 있지 않거나 GPU가 없는 환경입니다.
            실험·학습 작업 자체는 백엔드 서버에서 실행되므로 작업 수행에는 영향이 없습니다.
          </p>
        </div>
      )}

      {/* 헬스 요약 카드 */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <SummaryCard
          label="백엔드 API 응답"
          value={backendLatency != null ? `${backendLatency}ms` : '연결 실패'}
          sub="GET /trainings 왕복 시간"
          tone={backendLatency != null ? (backendLatency < 500 ? 'emerald' : 'amber') : 'red'}
        />
        <SummaryCard
          label="GPU (현재 PC)"
          value={gpu?.available ? `정상 × ${gpu.gpu_count}` : '미감지'}
          sub={gpu?.available ? gpu.gpus[0]?.name : undefined}
          tone={gpu?.available ? 'emerald' : 'amber'}
        />
        <SummaryCard
          label="실행 중 작업"
          value={`${runningJobs.length}건`}
          sub={`대기 ${queuedCount}건 · 백엔드 기준`}
          tone={runningJobs.length > 0 ? 'blue' : 'gray'}
        />
        <SummaryCard
          label="실패 작업"
          value={`${failedCount}건`}
          sub="전체 목록 기준 누적"
          tone={failedCount > 0 ? 'red' : 'gray'}
        />
      </div>

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

      {/* 실행 중 작업 목록 — 백엔드 기준 */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden mb-6">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-700">실행 중 작업</span>
          <span className="text-xs text-gray-400">백엔드 서버 기준</span>
          {runningJobs.length > 0 && (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse flex-shrink-0" />
              {runningJobs.length}건
            </span>
          )}
        </div>
        {runningJobs.length === 0 ? (
          <div className="py-10 text-center text-gray-400 text-sm">실행 중인 작업이 없습니다.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                {['ID', '작업명', '모드', '사용자', '시작 시각', '경과 시간'].map(h => (
                  <th key={h} className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {runningJobs.map(job => (
                <tr key={job.job_id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3 font-mono text-xs text-gray-600">#{job.job_id}</td>
                  <td className="px-5 py-3 font-medium text-gray-800">{job.experiment_name || '-'}</td>
                  <td className="px-5 py-3 text-xs text-gray-500">{job.mode}</td>
                  <td className="px-5 py-3 text-xs text-gray-500">{job.user_name || '-'}</td>
                  <td className="px-5 py-3 text-xs text-gray-500 whitespace-nowrap">
                    {job.started_at ? new Date(job.started_at).toLocaleString('ko-KR', {
                      month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
                    }) : '-'}
                  </td>
                  <td className="px-5 py-3 text-xs text-gray-600 tabular-nums">{fmtElapsed(job.started_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* 환경 정보 — 현재 PC 기준 */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100">
          <span className="text-sm font-semibold text-gray-700">환경 정보</span>
        </div>
        <div className="grid grid-cols-2">
          {[
            { label: 'OS / 커널',   value: <span className="text-gray-600 font-mono">{local ? `${local.os.platform} ${local.os.release}` : '-'}</span> },
            { label: 'Node.js',     value: <span className="text-gray-600 font-mono">{local?.os.node ?? '-'}</span> },
            { label: '호스트명',     value: <span className="text-gray-600 font-mono">{local?.host ?? '-'}</span> },
            { label: '가동 시간',    value: <span className="text-gray-600 font-mono">{local ? fmtUptime(local.os.uptime_seconds) : '-'}</span> },
            // 백엔드 GPU 인식: 당장 미사용 — 주석 처리 (2026-06-12)
            // 복원 시: 상단 import·backendGpu state·poll의 getSystemStatus 호출도 함께 해제
            // {
            //   // 사용자 PC마다 달라지는 유일한 백엔드 변수 — 호스트 GPU는 정상인데
            //   // 여기가 미감지면 toolkit 미설치 / compose GPU 설정 누락
            //   label: '백엔드 GPU 인식',
            //   value: backendGpu == null ? (
            //     <span className="text-gray-400">확인 불가 (백엔드 연결 실패)</span>
            //   ) : backendGpu.available ? (
            //     <span className="text-emerald-600 font-semibold">정상 × {backendGpu.gpu_count}</span>
            //   ) : (
            //     <span className="text-amber-600 font-semibold">
            //       미감지
            //       {local?.gpu.available && <span className="font-normal text-amber-500"> — 호스트 GPU는 정상, 컨테이너 GPU 연결 확인 필요</span>}
            //     </span>
            //   ),
            // },
          ].map(row => (
            <div key={row.label} className="flex items-center gap-3 px-5 py-3 border-b border-gray-100 text-xs">
              <span className="text-gray-400 w-32 flex-shrink-0">{row.label}</span>
              {row.value}
            </div>
          ))}
        </div>
      </div>
    </Layout>
  );
}
