// AI 어시스턴트 채팅 기록을 이 브라우저의 localStorage에 보관한다 — 페이지를 이동하거나
// 새로고침해도 대화가 이어지도록 하기 위함. LLM 요청 자체는 지금처럼 매번 최신 메시지만
// 보내는 무상태 방식 그대로다(백엔드 변경 없음) — 여기 저장된 기록은 화면 표시 전용이다.
//
// 요청(sendChatMessage)을 컴포넌트 안의 useState/클로저가 아니라 여기 모듈 레벨에서 처리하는 게
// 중요하다 — 위젯이 마운트된 페이지에서 답변을 기다리는 도중 다른 페이지로 이동하면 위젯 컴포넌트가
// 언마운트되는데, 그 안에서 await 중이던 fetch는 계속 진행되다가 끝나는 시점에 이미 사라진 컴포넌트의
// setState를 부르게 돼서 응답이 조용히 유실됐었다. 요청을 컴포넌트 생명주기와 무관한 여기서 실행하고
// 끝나는 대로 localStorage에 직접 쓴 뒤 이벤트로 알리면, 그 시점에 어떤 페이지에 있든(위젯이 다시
// 마운트됐든 안 됐든) 다음에 위젯을 열었을 때 정확한 결과가 보인다.
import { queryLlmAssistant, type AssistantResultItem } from './api';

export type ChatMessage =
  | { role: 'user'; text: string }
  | { role: 'assistant'; text: string; results?: AssistantResultItem[] }
  | { role: 'error'; text: string };

export interface ChatHistoryState {
  messages: ChatMessage[];
  compactedUntilIndex: number;
  pending: boolean;
}

const CHAT_HISTORY_KEY = 'kict_ai_chat_history';
export const CHAT_HISTORY_EVENT = 'kict-ai-chat-updated';

const EMPTY_STATE: ChatHistoryState = { messages: [], compactedUntilIndex: 0, pending: false };

export function loadChatHistory(): ChatHistoryState {
  if (typeof window === 'undefined') return EMPTY_STATE;
  try {
    const parsed = JSON.parse(localStorage.getItem(CHAT_HISTORY_KEY) ?? 'null');
    if (!parsed || !Array.isArray(parsed.messages)) return EMPTY_STATE;
    return {
      messages: parsed.messages,
      compactedUntilIndex: parsed.compactedUntilIndex ?? 0,
      pending: !!parsed.pending,
    };
  } catch {
    return EMPTY_STATE;
  }
}

function saveChatHistory(state: ChatHistoryState): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(state));
  } catch { /* noop */ }
  window.dispatchEvent(new Event(CHAT_HISTORY_EVENT));
}

/** compact 배지 상태(compactedUntilIndex)만 갱신 — 위젯의 auto-compact 타이머가 호출한다. */
export function updateCompactedUntilIndex(compactedUntilIndex: number): void {
  const current = loadChatHistory();
  saveChatHistory({ ...current, compactedUntilIndex });
}

export async function sendChatMessage(text: string, requester: string | null): Promise<void> {
  const afterUser = loadChatHistory();
  afterUser.messages = [...afterUser.messages, { role: 'user', text }];
  afterUser.pending = true;
  saveChatHistory(afterUser);

  try {
    const result = await queryLlmAssistant(text, requester);
    const afterReply = loadChatHistory();
    afterReply.messages = [...afterReply.messages, { role: 'assistant', text: result.message, results: result.results }];
    afterReply.pending = false;
    saveChatHistory(afterReply);
  } catch (err) {
    const afterError = loadChatHistory();
    afterError.messages = [
      ...afterError.messages,
      { role: 'error', text: err instanceof Error ? err.message : '검색에 실패했습니다.' },
    ];
    afterError.pending = false;
    saveChatHistory(afterError);
  }
}
