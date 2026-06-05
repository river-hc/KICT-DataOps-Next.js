'use client';

import { useState, useEffect } from 'react';
import Layout from '../lib/Layout';
import { getTrainings, createTraining, type TrainingJob } from '../lib/api';

export default function Trainings() {
  const [trainings, setTrainings] = useState<TrainingJob[]>([]);
  const [userName, setUserName] = useState('');
  const [experimentName, setExperimentName] = useState('');
  const [mode, setMode] = useState<'single' | 'multi'>('single');
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const refresh = () => { getTrainings().then(setTrainings); };
  useEffect(() => { refresh(); }, []);

  const handleCreate = async () => {
    if (!experimentName) return;
    await createTraining({
      user_name: userName || 'admin',
      experiment_name: experimentName,
      input_files: {
        file_t0: { filename: null, timestamp: null, file_data: null },
        file_t1: { filename: null, timestamp: null, file_data: null },
        file_t2: { filename: null, timestamp: null, file_data: null },
        file_t3: { filename: null, timestamp: null, file_data: null },
      },
    });
    setExperimentName('');
    refresh();
  };

  const statusColor = (s: string) => {
    if (s === 'RUNNING') return 'text-green-600';
    if (s === 'FAILED' || s === 'CANCELED') return 'text-red-600';
    if (s === 'QUEUED') return 'text-yellow-600';
    if (s === 'COMPLETED') return 'text-blue-600';
    return 'text-gray-600';
  };

  return (
    <Layout>
      <div className="mb-6 flex gap-3 items-end">
        <div>
          <label className="text-sm text-gray-500">사용자</label>
          <input
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
            className="border rounded px-3 py-2 w-48"
            placeholder="사용자 이름"
          />
        </div>
        <div>
          <label className="text-sm text-gray-500">실험명</label>
          <input
            value={experimentName}
            onChange={(e) => setExperimentName(e.target.value)}
            className="border rounded px-3 py-2 w-48"
            placeholder="실험 이름"
          />
        </div>
        <div>
          <label className="text-sm text-gray-500">모드</label>
          <select value={mode} onChange={(e) => setMode(e.target.value as 'single' | 'multi')} className="border rounded px-3 py-2">
            <option value="single">single</option>
            <option value="multi">multi</option>
          </select>
        </div>
        <button onClick={handleCreate} className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
          학습 시작
        </button>
      </div>

      <div className="bg-white rounded-lg shadow border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left p-3">ID</th>
              <th className="text-left p-3">실험명</th>
              <th className="text-left p-3">모드</th>
              <th className="text-left p-3">상태</th>
              <th className="text-left p-3">작성일</th>
              <th className="text-left p-3">작업</th>
            </tr>
          </thead>
          <tbody>
            {trainings.map((t) => (
              <tr
                key={t.job_id}
                className={`border-t cursor-pointer hover:bg-gray-50 ${selectedId === t.job_id ? 'bg-blue-50' : ''}`}
                onClick={() => setSelectedId(t.job_id)}
              >
                <td className="p-3">{t.job_id}</td>
                <td className="p-3">{t.experiment_name}</td>
                <td className="p-3">{t.mode}</td>
                <td className={`p-3 font-medium ${statusColor(t.status)}`}>{t.status}</td>
                <td className="p-3 text-gray-500">{t.created_at?.slice(0, 10)}</td>
                <td className="p-3">
                  {t.status === 'RUNNING' && (
                    <button onClick={(e) => { e.stopPropagation(); refresh(); }} className="text-red-600 hover:underline text-xs mr-2">
                      정지
                    </button>
                  )}
                  {(t.status === 'COMPLETED' || t.status === 'FAILED') && (
                    <button onClick={(e) => { e.stopPropagation(); refresh(); }} className="text-yellow-600 hover:underline text-xs">
                      재설정
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Layout>
  );
}
