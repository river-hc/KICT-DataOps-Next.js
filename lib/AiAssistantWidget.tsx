'use client';

import { useEffect, useRef, useState } from 'react';
import { queryAssistant, formatExecutionName, displayUsername, type AssistantResultItem } from '@/lib/api';

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

type ChatMessage =
  | { role: 'user'; text: string }
  | { role: 'assistant'; text: string; results?: AssistantResultItem[] }
  | { role: 'error'; text: string };

const METRIC_LABEL: Record<'mae' | 'rmse' | 'csi', string> = { mae: 'MAE', rmse: 'RMSE', csi: 'CSI' };

function fmtMetric(value: number | null): string {
  return value == null ? '-' : value.toFixed(3);
}

function ResultCard({ item }: { item: AssistantResultItem }) {
  const name = formatExecutionName(item.experiment_name, item.run_datetime);
  return (
    <a
      href={`/experiment-results/${item.job_id}`}
      target="_blank"
      rel="noopener noreferrer"
      className="block rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-xs shadow-sm transition-colors hover:border-indigo-300 hover:bg-indigo-50/40"
    >
      <p className="font-semibold text-gray-800">{name}</p>
      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-gray-500">
        {item.model_version && (
          <span className="font-semibold text-indigo-600">{item.model_version}</span>
        )}
        <span>{item.status}</span>
        <span>{displayUsername(item.user_name)}</span>
        <span>{METRIC_LABEL.csi} {fmtMetric(item.csi)}</span>
        <span>{METRIC_LABEL.mae} {fmtMetric(item.mae)}</span>
        <span>{METRIC_LABEL.rmse} {fmtMetric(item.rmse)}</span>
      </div>
    </a>
  );
}

export default function AiAssistantWidget() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, sending]);

  async function handleSend() {
    const text = input.trim();
    if (!text || sending) return;

    setMessages(prev => [...prev, { role: 'user', text }]);
    setInput('');
    setSending(true);
    try {
      const result = await queryAssistant(text);
      setMessages(prev => [...prev, { role: 'assistant', text: result.message, results: result.results }]);
    } catch (err) {
      setMessages(prev => [
        ...prev,
        { role: 'error', text: err instanceof Error ? err.message : '검색에 실패했습니다.' },
      ]);
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <>
      {open && (
        <div className="fixed bottom-24 right-6 z-50 w-[360px] max-w-[calc(100vw-3rem)] overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl">
          {/* 헤더 — 신경망 배경 */}
          <div className="relative overflow-hidden px-4 py-4" style={{ background: 'linear-gradient(135deg, #4338ca 0%, #6366f1 45%, #7c3aed 100%)' }}>
            <NeuralNetBackground />
            <div className="relative flex items-center gap-3">
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-white/15">
                <KAvatar className="text-sm text-white" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-white">AI 어시스턴트</p>
                <p className="text-[11px] text-white/70">실험·테스트케이스 검색</p>
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
          <div ref={scrollRef} className="max-h-[420px] min-h-[220px] space-y-3 overflow-y-auto bg-gray-50 px-4 py-4">
            <div className="flex items-start gap-2">
              <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-indigo-100">
                <KAvatar className="text-xs text-indigo-600" />
              </div>
              <div className="max-w-[260px] rounded-2xl rounded-tl-sm border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-700 shadow-sm">
                무엇을 도와드릴까요? 예: &quot;8월 25일부터 8월 27일까지 CSI 잘나온 순서대로 5개&quot;
              </div>
            </div>

            {messages.map((msg, i) => {
              if (msg.role === 'user') {
                return (
                  <div key={i} className="flex justify-end">
                    <div className="max-w-[260px] rounded-2xl rounded-tr-sm bg-indigo-600 px-3.5 py-2.5 text-sm text-white shadow-sm">
                      {msg.text}
                    </div>
                  </div>
                );
              }
              if (msg.role === 'error') {
                return (
                  <div key={i} className="flex items-start gap-2">
                    <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-red-100">
                      <KAvatar className="text-xs text-red-600" />
                    </div>
                    <div className="max-w-[260px] rounded-2xl rounded-tl-sm border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700 shadow-sm">
                      {msg.text}
                    </div>
                  </div>
                );
              }
              return (
                <div key={i} className="flex items-start gap-2">
                  <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-indigo-100">
                    <KAvatar className="text-xs text-indigo-600" />
                  </div>
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="inline-block max-w-full rounded-2xl rounded-tl-sm border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-700 shadow-sm">
                      {msg.text}
                    </div>
                    {msg.results && msg.results.length > 0 && (
                      <div className="space-y-2">
                        {msg.results.map(item => (
                          <ResultCard key={item.job_id} item={item} />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {sending && (
              <div className="flex items-start gap-2">
                <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-indigo-100">
                  <KAvatar className="text-xs text-indigo-600" />
                </div>
                <div className="flex items-center gap-1.5 rounded-2xl rounded-tl-sm border border-gray-200 bg-white px-3.5 py-2.5 shadow-sm">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-300 [animation-delay:-0.3s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-300 [animation-delay:-0.15s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-300" />
                </div>
              </div>
            )}
          </div>

          {/* 입력창 */}
          <div className="border-t border-gray-100 bg-white px-3 py-3">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={sending}
                placeholder="메시지를 입력하세요"
                className="w-full flex-1 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-100 disabled:text-gray-400"
              />
              <button
                type="button"
                onClick={handleSend}
                disabled={sending || !input.trim()}
                className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white transition-colors hover:bg-indigo-700 disabled:bg-gray-100 disabled:text-gray-300"
                aria-label="전송"
              >
                <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor">
                  <path d="M2.5 17.5l15-7.5-15-7.5v6l10 1.5-10 1.5v6z" />
                </svg>
              </button>
            </div>
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
