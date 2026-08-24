'use client';

import { useState } from 'react';

// 신경망/노드-엣지 느낌의 장식용 배경 (좌표 고정 — 서버/클라이언트 렌더 불일치 방지)
const NODES: [number, number][] = [
  [12, 18], [48, 10], [82, 22], [20, 46], [60, 40],
  [90, 52], [8, 74], [42, 68], [72, 78], [95, 90],
  [30, 92], [58, 96],
];
const EDGES: [number, number][] = [
  [0, 1], [1, 2], [0, 3], [1, 4], [2, 4], [2, 5],
  [3, 4], [3, 6], [4, 5], [4, 7], [5, 9], [6, 7],
  [7, 8], [8, 9], [7, 10], [8, 11], [10, 11], [3, 7],
];

function NeuralNetBackground() {
  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      className="absolute inset-0 h-full w-full opacity-40"
      aria-hidden="true"
    >
      {EDGES.map(([a, b], i) => (
        <line
          key={i}
          x1={NODES[a][0]} y1={NODES[a][1]}
          x2={NODES[b][0]} y2={NODES[b][1]}
          stroke="white" strokeWidth={0.3}
        />
      ))}
      {NODES.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={1.1} fill="white" />
      ))}
    </svg>
  );
}

function QuestionMarkIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={2.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ filter: 'drop-shadow(0 1.5px 1.5px rgba(0,0,0,0.4))' }}
    >
      <path d="M9 8.5a3 3 0 115.8 1c0 2-2.8 2.2-2.8 4.6" />
      <circle cx="12" cy="18" r="0.75" fill="currentColor" stroke="none" />
    </svg>
  );
}

function KAvatar({ className }: { className?: string }) {
  return <span className={`font-bold ${className ?? ''}`}>K</span>;
}

export default function AiAssistantWidget() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {open && (
        <div className="fixed bottom-24 right-6 z-50 w-[340px] max-w-[calc(100vw-3rem)] overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl">
          {/* 헤더 — 신경망 배경 */}
          <div className="relative overflow-hidden px-4 py-4" style={{ background: 'linear-gradient(135deg, #4338ca 0%, #6366f1 45%, #7c3aed 100%)' }}>
            <NeuralNetBackground />
            <div className="relative flex items-center gap-3">
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-white/15">
                <KAvatar className="text-sm text-white" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-white">AI 어시스턴트</p>
                <p className="text-[11px] text-white/70">실험·테스트케이스 검색 (준비 중)</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg p-1 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
                aria-label="닫기"
              >
                <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                  <path d="M2 2l12 12M14 2L2 14" />
                </svg>
              </button>
            </div>
          </div>

          {/* 대화 영역 */}
          <div className="min-h-[320px] space-y-3 bg-gray-50 px-4 py-4">
            <div className="flex items-start gap-2">
              <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-indigo-100">
                <KAvatar className="text-xs text-indigo-600" />
              </div>
              <div className="max-w-[240px] rounded-2xl rounded-tl-sm border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-700 shadow-sm">
                무엇을 도와드릴까요?
              </div>
            </div>
          </div>

          {/* 입력창 (비활성 — 준비 중) */}
          <div className="border-t border-gray-100 bg-white px-3 py-3">
            <div className="flex items-center gap-2">
              <input
                type="text"
                disabled
                placeholder="메시지를 입력하세요"
                className="w-full flex-1 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-400 outline-none"
              />
              <button
                type="button"
                disabled
                className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-gray-100 text-gray-300"
                aria-label="전송"
              >
                <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor">
                  <path d="M2.5 17.5l15-7.5-15-7.5v6l10 1.5-10 1.5v6z" />
                </svg>
              </button>
            </div>
            <p className="mt-1.5 text-center text-[10px] text-gray-400">준비 중인 기능입니다</p>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-label="AI 어시스턴트 열기"
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-2xl shadow-lg transition-transform hover:scale-105"
        style={{
          background: 'linear-gradient(135deg, #4338ca 0%, #6366f1 45%, #7c3aed 100%)',
          boxShadow: '0 8px 24px rgba(99,102,241,0.45)',
        }}
      >
        <QuestionMarkIcon className="h-8 w-8 text-white" />
      </button>
    </>
  );
}
