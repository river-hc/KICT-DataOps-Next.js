'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '@/lib/Layout';
import { getExperimentJobs, type TrainingJob } from '@/lib/api';
import {
  loadClientExperiments, saveClientExperiment, loadExpTcMap,
  type ClientExperiment,
} from '@/lib/experimentStore';

// ─── 상태 요약 계산 ───────────────────────────────────────────────────────────

interface StatusCounts { RUNNING: number; QUEUED: number; COMPLETED: number; FAILED: number; }

function calcStatusCounts(tcJobs: TrainingJob[]): StatusCounts {
  const c: StatusCounts = { RUNNING: 0, QUEUED: 0, COMPLETED: 0, FAILED: 0 };
  for (const j of tcJobs) {
    const s = j.status.toUpperCase();
    if (s === 'RUNNING') c.RUNNING++;
    else if (s === 'QUEUED') c.QUEUED++;
    else if (s === 'COMPLETED') c.COMPLETED++;
    else if (s === 'FAILED' || s === 'CANCELED') c.FAILED++;
  }
  return c;
}

function StatusSummary({ counts, total }: { counts: StatusCounts; total: number }) {
  if (total === 0) return <span className="text-xs text-gray-300">실행 없음</span>;
  const items = [
    { key: 'RUNNING',   label: '실행 중', cls: 'text-emerald-700 bg-emerald-50' },
    { key: 'QUEUED',    label: '대기',    cls: 'text-amber-700 bg-amber-50' },
    { key: 'COMPLETED', label: '완료',    cls: 'text-blue-700 bg-blue-50' },
    { key: 'FAILED',    label: '실패',    cls: 'text-red-700 bg-red-50' },
  ] as { key: keyof StatusCounts; label: string; cls: string }[];
  const visible = items.filter(i => counts[i.key] > 0);
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {visible.map(i => (
        <span key={i.key} className={`text-[11px] font-semibold px-1.5 py-0.5 rounded ${i.cls}`}>
          {i.label} {counts[i.key]}
        </span>
      ))}
    </div>
  );
}

// ─── 새 실험 환경 모달 ────────────────────────────────────────────────────────

function NewExperimentEnvModal({
  onClose, onSave,
}: {
  onClose: () => void;
  onSave: (name: string, desc: string) => void;
}) {
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md mx-4 bg-white rounded-2xl shadow-2xl flex flex-col">
        <div className="flex items-start justify-between px-6 py-5 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-bold text-gray-900">새 실험 환경</h2>
            <p className="text-xs text-gray-400 mt-0.5">실험 환경을 생성한 후 실행을 추가할 수 있습니다.</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 mt-0.5">
            <svg viewBox="0 0 16 16" className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
              <path d="M2 2l12 12M14 2L2 14" />
            </svg>
          </button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1.5">실험 이름</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && name.trim() && (onSave(name.trim(), desc.trim()), onClose())}
              placeholder="예: 2026년 7월 QPF 검증"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1.5">설명 <span className="text-gray-400 font-normal">(선택)</span></label>
            <textarea
              value={desc}
              onChange={e => setDesc(e.target.value)}
              rows={3}
              placeholder="실험 목적, 조건, 비교할 모델 버전 등"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
        </div>
        <div className="border-t border-gray-100 px-6 py-4 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
            취소
          </button>
          <button
            onClick={() => { if (name.trim()) { onSave(name.trim(), desc.trim()); onClose(); } }}
            disabled={!name.trim()}
            className="px-5 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            생성
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── 메인 페이지 ──────────────────────────────────────────────────────────────

const POLL_MS = 3000;

export default function ExperimentsPage() {
  const router = useRouter();
  const [showModal,   setShowModal]   = useState(false);
  const [expJobs,     setExpJobs]     = useState<TrainingJob[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [clientExps,  setClientExps]  = useState<ClientExperiment[]>([]);
  const [tcMap,       setTcMap]       = useState<Record<number, number[]>>({});

  useEffect(() => {
    setClientExps(loadClientExperiments());
    setTcMap(loadExpTcMap());
  }, []);

  // 실 백엔드 작업 목록 (사용자 추가 실행 매칭용)
  const fetchJobs = useCallback(() => {
    getExperimentJobs()
      .then(data => setExpJobs(data))
      .catch(() => setExpJobs([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchJobs(); }, [fetchJobs]);

  useEffect(() => {
    const hasActive = expJobs.some(j => ['RUNNING', 'QUEUED'].includes(j.status.toUpperCase()));
    if (!hasActive) return;
    const id = setInterval(() => getExperimentJobs().then(setExpJobs).catch(() => {}), POLL_MS);
    return () => clearInterval(id);
  }, [expJobs]);

  const allExps = clientExps;

  function handleCreateExp(name: string, desc: string) {
    const newExp: ClientExperiment = {
      id: Date.now(),
      name,
      description: desc,
      created_at: new Date().toISOString(),
      tc_job_ids: [],
    };
    saveClientExperiment(newExp);
    setClientExps(prev => [newExp, ...prev]);
  }

  function fmtDt(iso: string | null) {
    if (!iso) return '-';
    return new Date(iso).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  }

  const titleActions = (
    <button
      onClick={() => setShowModal(true)}
      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition shadow-sm"
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
      </svg>
      새 실험
    </button>
  );

  return (
    <Layout titleActions={titleActions}>
      {showModal && (
        <NewExperimentEnvModal
          onClose={() => setShowModal(false)}
          onSave={handleCreateExp}
        />
      )}

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <span className="text-sm font-semibold text-gray-700">실험 환경 목록</span>
          {loading && <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />}
        </div>

        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              {['실험 이름', '설명', '실행 수', '상태', '최근 실행'].map(h => (
                <th key={h} className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {allExps.map(exp => {
              // 실행 = 이 실험에만 매핑된 실 백엔드 job (localStorage 맵 기준)
              const userIds  = tcMap[exp.id] ?? [];
              const tcJobs   = expJobs.filter(j => userIds.includes(j.job_id));
              const tcCount  = tcJobs.length;
              const counts   = calcStatusCounts(tcJobs);
              const latestTs = tcJobs.reduce<string | null>((acc, j) => {
                const ts = j.finished_at ?? j.started_at ?? j.created_at;
                return !acc || (ts && ts > acc) ? ts : acc;
              }, null);

              return (
                <tr
                  key={exp.id}
                  onClick={() => router.push(`/experiments/${exp.id}`)}
                  className="cursor-pointer border-b border-gray-100 hover:bg-gray-50 transition-colors"
                >
                  <td className="px-5 py-3">
                    <span className="font-semibold text-blue-600 text-sm">{exp.name}</span>
                  </td>
                  <td className="px-5 py-3 text-gray-500 text-sm max-w-[280px]">
                    <span className="line-clamp-1">{exp.description || '-'}</span>
                  </td>
                  <td className="px-5 py-3">
                    <span className="font-mono text-sm text-gray-700">{tcCount > 0 ? `${tcCount}개` : '-'}</span>
                  </td>
                  <td className="px-5 py-3">
                    <StatusSummary counts={counts} total={tcCount} />
                  </td>
                  <td className="px-5 py-3 text-gray-400 text-xs whitespace-nowrap">
                    {fmtDt(latestTs)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {allExps.length === 0 && !loading && (
          <div className="py-16 text-center text-gray-400 text-sm">등록된 실험이 없습니다.</div>
        )}

        <div className="px-5 py-2.5 border-t border-gray-100 text-xs text-gray-400">
          총 {allExps.length}개 실험
        </div>
      </div>
    </Layout>
  );
}
