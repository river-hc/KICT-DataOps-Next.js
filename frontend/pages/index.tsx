'use client';

import { useState, useEffect, useCallback } from 'react';
import Layout from '../lib/Layout';
import {
  getTrainings,
  getSystemStatus,
  type TrainingJob,
  type SystemStatus,
} from '../lib/api';

type TabKey = 'RUNNING' | 'QUEUED' | 'COMPLETED' | 'FAILED';

const TABS: {
  key: TabKey;
  label: string;
  border: string;
  text: string;
  badge: string;
  cardBorder: string;
  emptyText: string;
}[] = [
  {
    key: 'RUNNING',
    label: '실행 중',
    border: 'border-green-500',
    text: 'text-green-700',
    badge: 'bg-green-100 text-green-700',
    cardBorder: 'border-green-400',
    emptyText: '실행 중인 학습이 없습니다.',
  },
  {
    key: 'QUEUED',
    label: '대기 중',
    border: 'border-yellow-500',
    text: 'text-yellow-700',
    badge: 'bg-yellow-100 text-yellow-700',
    cardBorder: 'border-yellow-400',
    emptyText: '대기 중인 학습이 없습니다.',
  },
  {
    key: 'COMPLETED',
    label: '완료',
    border: 'border-blue-500',
    text: 'text-blue-700',
    badge: 'bg-blue-100 text-blue-700',
    cardBorder: 'border-blue-400',
    emptyText: '완료된 학습이 없습니다.',
  },
  {
    key: 'FAILED',
    label: '실패/취소',
    border: 'border-red-500',
    text: 'text-red-700',
    badge: 'bg-red-100 text-red-700',
    cardBorder: 'border-red-400',
    emptyText: '실패 또는 취소된 학습이 없습니다.',
  },
];

function fmtDateTime(iso: string | null): string {
  if (!iso) return '-';
  return new Date(iso).toLocaleString('ko-KR', {
    month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

function fmtElapsed(startedAt: string | null): string {
  if (!startedAt) return '-';
  const s = Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000);
  if (s < 60) return `${s}초`;
  if (s < 3600) return `${Math.floor(s / 60)}분 ${s % 60}초`;
  return `${Math.floor(s / 3600)}시간 ${Math.floor((s % 3600) / 60)}분`;
}

function fmtDuration(start: string | null, end: string | null): string {
  if (!start || !end) return '-';
  const s = Math.floor((new Date(end).getTime() - new Date(start).getTime()) / 1000);
  if (s < 60) return `${s}초`;
  if (s < 3600) return `${Math.floor(s / 60)}분`;
  return `${Math.floor(s / 3600)}시간 ${Math.floor((s % 3600) / 60)}분`;
}

export default function Dashboard() {
  const [trainings, setTrainings] = useState<TrainingJob[]>([]);
  const [system, setSystem] = useState<SystemStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>('RUNNING');

  const fetchAll = useCallback(async () => {
    await Promise.all([
      getTrainings().then(setTrainings).catch(() => {}),
      getSystemStatus().then(setSystem).catch(() => {}),
    ]);
  }, []);

  useEffect(() => {
    fetchAll().finally(() => setLoading(false));
  }, [fetchAll]);

  useEffect(() => {
    const id = setInterval(fetchAll, 5000);
    return () => clearInterval(id);
  }, [fetchAll]);

  const grouped: Record<TabKey, TrainingJob[]> = {
    RUNNING:   trainings.filter(t => t.status === 'RUNNING'),
    QUEUED:    trainings.filter(t => t.status === 'QUEUED'),
    COMPLETED: trainings.filter(t => t.status === 'COMPLETED'),
    FAILED:    trainings.filter(t => t.status === 'FAILED' || t.status === 'CANCELED'),
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-20 text-gray-400">로딩 중...</div>
      </Layout>
    );
  }

  const activeTabMeta = TABS.find(t => t.key === activeTab)!;

  return (
    <Layout>
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">대시보드</h1>
        <div className="flex items-center gap-2 text-sm">
          {system == null ? (
            <span className="text-gray-400">시스템 확인 중...</span>
          ) : system.available ? (
            <>
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse inline-block" />
              <span className="text-green-600 font-medium">GPU {system.gpu_count}개 온라인</span>
            </>
          ) : (
            <>
              <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
              <span className="text-red-500 font-medium">GPU 오프라인</span>
            </>
          )}
        </div>
      </div>

      {/* 요약 카드 (탭 전환 겸용) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`bg-white rounded-xl p-4 text-left transition-all hover:shadow-md border-2 ${
              activeTab === tab.key
                ? `${tab.cardBorder} shadow-md`
                : 'border-gray-100 shadow-sm'
            }`}
          >
            <div className="text-xs font-medium text-gray-500 mb-2">{tab.label}</div>
            <div className={`text-3xl font-bold ${grouped[tab.key].length > 0 ? tab.text : 'text-gray-300'}`}>
              {grouped[tab.key].length}
            </div>
          </button>
        ))}
      </div>

      {/* 탭 바 */}
      <div className="flex border-b border-gray-200 mb-5">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-5 py-3 text-sm font-medium border-b-2 -mb-px flex items-center gap-2 transition ${
              activeTab === tab.key
                ? `${tab.border} ${tab.text}`
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            {tab.label}
            {grouped[tab.key].length > 0 && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${
                activeTab === tab.key ? tab.badge : 'bg-gray-100 text-gray-500'
              }`}>
                {grouped[tab.key].length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* 탭 콘텐츠 */}
      {grouped[activeTab].length === 0 ? (
        <div className="py-16 text-center text-gray-400 text-sm">{activeTabMeta.emptyText}</div>
      ) : (
        <>
          {activeTab === 'RUNNING' && <RunningGrid jobs={grouped.RUNNING} />}
          {activeTab === 'QUEUED'  && <QueuedTable jobs={grouped.QUEUED} />}
          {activeTab === 'COMPLETED' && <CompletedTable jobs={[...grouped.COMPLETED].reverse()} />}
          {activeTab === 'FAILED'  && <FailedTable jobs={[...grouped.FAILED].reverse()} />}
        </>
      )}
    </Layout>
  );
}

// ─── RUNNING: 카드 그리드 ─────────────────────────────────────────────────────

function RunningGrid({ jobs }: { jobs: TrainingJob[] }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {jobs.map(job => (
        <div key={job.job_id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 hover:shadow-md transition">
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="font-semibold text-gray-900">{job.experiment_name}</p>
              <p className="text-xs text-gray-500 mt-0.5">{job.user_name} · {job.mode}</p>
            </div>
            <span className="flex items-center gap-1.5 text-xs font-semibold text-green-700 bg-green-50 border border-green-200 px-2.5 py-1 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse inline-block" />
              RUNNING
            </span>
          </div>

          {/* 진행률 */}
          <div className="mb-4">
            <div className="flex justify-between text-xs text-gray-500 mb-1.5">
              <span>
                {job.current_epoch != null && job.total_epochs != null
                  ? `Epoch ${job.current_epoch} / ${job.total_epochs}`
                  : '처리 중...'}
              </span>
              {job.progress != null && (
                <span className="font-semibold text-gray-700">{job.progress}%</span>
              )}
            </div>
            {job.progress != null ? (
              <div className="w-full bg-gray-100 rounded-full h-2.5">
                <div
                  className="bg-green-500 h-2.5 rounded-full transition-all duration-700 ease-out"
                  style={{ width: `${job.progress}%` }}
                />
              </div>
            ) : (
              <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                <div className="h-2.5 w-1/2 bg-green-400 rounded-full animate-pulse" />
              </div>
            )}
          </div>

          <div className="flex justify-between text-xs text-gray-400 pt-3 border-t border-gray-100">
            <span>시작: {fmtDateTime(job.started_at)}</span>
            <span className="font-medium text-gray-500">경과: {fmtElapsed(job.started_at)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── QUEUED: 대기 순서 테이블 ─────────────────────────────────────────────────

function QueuedTable({ jobs }: { jobs: TrainingJob[] }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-gray-600">
          <tr>
            <th className="text-left px-4 py-3 font-medium w-14">순서</th>
            <th className="text-left px-4 py-3 font-medium">실험명</th>
            <th className="text-left px-4 py-3 font-medium">요청자</th>
            <th className="text-left px-4 py-3 font-medium">모드</th>
            <th className="text-left px-4 py-3 font-medium">등록 시각</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {jobs.map((job, idx) => (
            <tr key={job.job_id} className="hover:bg-gray-50">
              <td className="px-4 py-3">
                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-yellow-100 text-yellow-700 text-xs font-bold">
                  {idx + 1}
                </span>
              </td>
              <td className="px-4 py-3 font-medium text-gray-800">{job.experiment_name}</td>
              <td className="px-4 py-3 text-gray-500">{job.user_name}</td>
              <td className="px-4 py-3 text-gray-500">{job.mode}</td>
              <td className="px-4 py-3 text-gray-500">{fmtDateTime(job.created_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── COMPLETED: 완료 테이블 ───────────────────────────────────────────────────

function CompletedTable({ jobs }: { jobs: TrainingJob[] }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-gray-600">
          <tr>
            <th className="text-left px-4 py-3 font-medium">실험명</th>
            <th className="text-left px-4 py-3 font-medium">요청자</th>
            <th className="text-left px-4 py-3 font-medium">모드</th>
            <th className="text-left px-4 py-3 font-medium">Run</th>
            <th className="text-left px-4 py-3 font-medium">소요 시간</th>
            <th className="text-left px-4 py-3 font-medium">완료 시각</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {jobs.map(job => (
            <tr key={job.job_id} className="hover:bg-gray-50">
              <td className="px-4 py-3 font-medium text-gray-800">{job.experiment_name}</td>
              <td className="px-4 py-3 text-gray-500">{job.user_name}</td>
              <td className="px-4 py-3 text-gray-500">{job.mode}</td>
              <td className="px-4 py-3">
                {job.run_id != null
                  ? <span className="px-2 py-0.5 rounded text-xs font-mono bg-blue-50 text-blue-700">#{job.run_id}</span>
                  : <span className="text-gray-300">-</span>}
              </td>
              <td className="px-4 py-3 text-gray-500">{fmtDuration(job.started_at, job.finished_at)}</td>
              <td className="px-4 py-3 text-gray-500">{fmtDateTime(job.finished_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── FAILED: 실패/취소 테이블 ─────────────────────────────────────────────────

function FailedTable({ jobs }: { jobs: TrainingJob[] }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-gray-600">
          <tr>
            <th className="text-left px-4 py-3 font-medium">실험명</th>
            <th className="text-left px-4 py-3 font-medium">요청자</th>
            <th className="text-left px-4 py-3 font-medium">상태</th>
            <th className="text-left px-4 py-3 font-medium">모드</th>
            <th className="text-left px-4 py-3 font-medium">시각</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {jobs.map(job => (
            <tr key={job.job_id} className="hover:bg-gray-50">
              <td className="px-4 py-3 font-medium text-gray-800">{job.experiment_name}</td>
              <td className="px-4 py-3 text-gray-500">{job.user_name}</td>
              <td className="px-4 py-3">
                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                  job.status === 'CANCELED'
                    ? 'bg-gray-100 text-gray-600'
                    : 'bg-red-100 text-red-700'
                }`}>
                  {job.status}
                </span>
              </td>
              <td className="px-4 py-3 text-gray-500">{job.mode}</td>
              <td className="px-4 py-3 text-gray-500">{fmtDateTime(job.finished_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
