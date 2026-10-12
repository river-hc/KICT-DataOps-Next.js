'use client';

import { useEffect, useRef, useState } from 'react';
import { formatExecutionName, displayUsername, type AssistantResultItem } from '@/lib/api';
import { getCurrentUsername } from '@/lib/account';
import { loadChatHistory, sendChatMessage, updateCompactedUntilIndex, CHAT_HISTORY_EVENT, type ChatMessage } from '@/lib/chatHistoryStore';

// 대화가 이만큼 쌓이면 오래된 메시지를 "N개 압축됨" 배지로 접는다 — 실제 토큰 사용량이
// 아니라 메시지 개수 기준의 화면 연출이다(백엔드가 무상태라 실제 컨텍스트 사용량을 모른다).
const COMPACT_THRESHOLD = 10;
const VISIBLE_TAIL = 4;

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
  const [compactedUntilIndex, setCompactedUntilIndex] = useState(0);
  const [compacting, setCompacting] = useState(false);
  const [showCompacted, setShowCompacted] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const compactingRef = useRef(false);

  // 채팅 상태의 기준은 이 컴포넌트가 아니라 localStorage(chatHistoryStore)다 — 답변을 기다리는
  // 도중 다른 페이지로 이동해서 이 컴포넌트가 언마운트돼도, 요청은 스토어 쪽에서 계속 진행되다가
  // 끝나면 스토어에 직접 쓰고 이벤트를 쏜다. 여기서는 그 이벤트를 듣고 최신 상태로 동기화만 한다.
  useEffect(() => {
    function sync() {
      const state = loadChatHistory();
      setMessages(state.messages);
      setCompactedUntilIndex(state.compactedUntilIndex);
      setSending(state.pending);
    }
    sync();
    window.addEventListener(CHAT_HISTORY_EVENT, sync);
    return () => window.removeEventListener(CHAT_HISTORY_EVENT, sync);
  }, []);

  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, sending]);

  useEffect(() => {
    const activeCount = messages.length - compactedUntilIndex;
    if (activeCount <= COMPACT_THRESHOLD || compactingRef.current) return;
    compactingRef.current = true;
    setCompacting(true);
    const timer = setTimeout(() => {
      const nextCompactedUntilIndex = messages.length - VISIBLE_TAIL;
      updateCompactedUntilIndex(nextCompactedUntilIndex);
      // 스토어 이벤트 왕복을 기다리지 않고 이 컴포넌트 상태를 바로 갱신 — 새로고침 없이 즉시 줄어든다.
      setCompactedUntilIndex(nextCompactedUntilIndex);
      setCompacting(false);
      setShowCompacted(false);
      compactingRef.current = false;
    }, 2200);
    return () => clearTimeout(timer);
    // compacting은 일부러 deps에서 뺐다 — setCompacting(true)가 이 effect를 다시 트리거해서
    // 방금 건 타이머를 cleanup으로 스스로 취소해버리는 재진입 버그가 있었음(그래서 compactingRef로 가드).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, compactedUntilIndex]);

  const activeCount = messages.length - compactedUntilIndex;
  const visibleMessages = showCompacted ? messages : messages.slice(compactedUntilIndex);

  function handleSend() {
    const text = input.trim();
    if (!text || sending) return;
    setInput('');
    sendChatMessage(text, getCurrentUsername());
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <>
      {open && (
        <div className="fixed bottom-32 right-6 z-50 flex h-[calc(100vh-10rem)] max-h-[720px] w-[380px] max-w-[calc(100vw-3rem)] flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl">
          {/* 헤더 — 깔끔한 흰 배경, 단색 accent만 사용 */}
          <div className="flex-shrink-0 border-b border-gray-100 px-4 py-3.5">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-indigo-50">
                <SparkleIcon className="h-4.5 w-4.5 text-indigo-600" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-gray-900">AI 어시스턴트</p>
                <p className="text-[11px] text-gray-400">Gemma4 E4B</p>
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

            {!compacting && compactedUntilIndex > 0 && (
              <button
                type="button"
                onClick={() => setShowCompacted(v => !v)}
                className="w-full rounded-xl border border-dashed border-gray-200 bg-white px-3 py-2 text-center text-[11px] font-medium text-gray-400 transition-colors hover:border-gray-300 hover:text-gray-600"
              >
                {showCompacted ? '이전 대화 접기' : `이전 대화 ${compactedUntilIndex}개 압축됨 · 펼쳐보기`}
              </button>
            )}

            {visibleMessages.map((msg, i) => {
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

            {compacting && (
              <div className="flex flex-col gap-1.5 rounded-xl border border-amber-100 bg-amber-50/70 px-3 py-2.5 text-xs font-medium text-amber-700">
                <span>대화 기록 정리 중… (compacting)</span>
                <div className="relative h-1 w-full overflow-hidden rounded-full bg-amber-100">
                  <div className="progress-indeterminate-amber" />
                </div>
              </div>
            )}

            {sending && (
              <div className="flex items-start gap-2">
                <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-indigo-100">
                  <KAvatar className="text-xs text-indigo-600" />
                </div>
                <div className="flex items-center gap-2 rounded-2xl rounded-tl-sm border border-gray-200 bg-white px-3.5 py-2.5 shadow-sm">
                  <SparkleIcon className="h-3.5 w-3.5 flex-shrink-0 text-indigo-500 [animation:ai-thinking-spin_2.5s_linear_infinite]" />
                  <span className="animate-pulse text-sm text-gray-500">Thinking...</span>
                </div>
              </div>
            )}
          </div>

          {/* 입력창 */}
          <div className="flex-shrink-0 border-t border-gray-100 bg-white px-3 py-3">
            <div className="flex items-end gap-2">
              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="메시지를 입력하세요"
                rows={3}
                className="w-full flex-1 resize-none rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-100"
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
        className="fixed bottom-12 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-600 shadow-lg transition-all hover:scale-105 hover:bg-indigo-700 active:scale-95"
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
