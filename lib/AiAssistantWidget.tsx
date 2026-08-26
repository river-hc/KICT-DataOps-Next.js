'use client';

import { useEffect, useRef, useState } from 'react';
import { queryAssistant, queryLlmAssistant, formatExecutionName, displayUsername, type AssistantResultItem } from '@/lib/api';
import { getCurrentUsername } from '@/lib/account';

// AI를 나타내는 스파클(반짝임) 아이콘 — 물음표는 "도움말"로 읽혀서, 요즘 AI 제품들이
// 공통적으로 쓰는 4각 별 모양으로 바꿨다.
function SparkleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M12 2.5c.6 3.4 1.4 5.6 2.5 6.9 1.1 1.3 3.2 2.2 6.5 2.6-3.3.4-5.4 1.3-6.5 2.6-1.1 1.3-1.9 3.5-2.5 6.9-.6-3.4-1.4-5.6-2.5-6.9-1.1-1.3-3.2-2.2-6.5-2.6 3.3-.4 5.4-1.3 6.5-2.6 1.1-1.3 1.9-3.5 2.5-6.9z" />
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
  const [useLlm, setUseLlm] = useState(false);
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
      const requester = getCurrentUsername();
      const result = useLlm ? await queryLlmAssistant(text, requester) : await queryAssistant(text, requester);
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
        <div className="fixed bottom-24 right-6 z-50 flex max-h-[calc(100vh-8rem)] w-[380px] max-w-[calc(100vw-3rem)] flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl">
          {/* 헤더 — 깔끔한 흰 배경, 단색 accent만 사용 */}
          <div className="flex-shrink-0 border-b border-gray-100 px-4 py-3.5">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-indigo-50">
                <SparkleIcon className="h-4.5 w-4.5 text-indigo-600" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-gray-900">AI 어시스턴트</p>
                <p className="text-[11px] text-gray-400">실험·테스트케이스 검색</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
                aria-label="닫기"
              >
                <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                  <path d="M2 2l12 12M14 2L2 14" />
                </svg>
              </button>
            </div>
            <div className="mt-3 flex items-center gap-1 rounded-lg bg-gray-100 p-0.5 text-[11px] font-semibold">
              <button
                type="button"
                onClick={() => setUseLlm(false)}
                className={`flex-1 rounded-md py-1.5 transition-colors ${!useLlm ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                빠른 검색
              </button>
              <button
                type="button"
                onClick={() => setUseLlm(true)}
                className={`flex-1 rounded-md py-1.5 transition-colors ${useLlm ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                title="사내망 로컬 LLM(Gemma 4)이 답변합니다 — 응답이 느릴 수 있어요"
              >
                AI 모드
              </button>
            </div>
          </div>

          {/* 대화 영역 */}
          <div ref={scrollRef} className="min-h-[220px] flex-1 space-y-3 overflow-y-auto bg-gray-50 px-4 py-4">
            <div className="flex items-start gap-2">
              <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-indigo-100">
                <KAvatar className="text-xs text-indigo-600" />
              </div>
              <div className="max-w-[280px] rounded-2xl rounded-tl-sm border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-700 shadow-sm">
                무엇을 도와드릴까요? 예: &quot;8월 25일부터 8월 27일까지 CSI 잘나온 순서대로 5개&quot;
              </div>
            </div>

            {messages.map((msg, i) => {
              if (msg.role === 'user') {
                return (
                  <div key={i} className="flex justify-end">
                    <div className="max-w-[280px] rounded-2xl rounded-tr-sm bg-indigo-600 px-3.5 py-2.5 text-sm text-white shadow-sm">
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
                    <div className="max-w-[280px] rounded-2xl rounded-tl-sm border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700 shadow-sm">
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
          <div className="flex-shrink-0 border-t border-gray-100 bg-white px-3 py-3">
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
        aria-label={open ? 'AI 어시스턴트 닫기' : 'AI 어시스턴트 열기'}
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-600 shadow-lg transition-all hover:scale-105 hover:bg-indigo-700 active:scale-95"
        style={{ boxShadow: '0 10px 24px -6px rgba(79,70,229,0.5)' }}
      >
        {open ? (
          <svg viewBox="0 0 20 20" className="h-6 w-6 text-white" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
            <path d="M4 4l12 12M16 4L4 16" />
          </svg>
        ) : (
          <SparkleIcon className="h-6 w-6 text-white" />
        )}
      </button>
    </>
  );
}
