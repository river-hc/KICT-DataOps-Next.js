// 계정 관리
//
// - 아이디/비밀번호 검증은 백엔드 계정 API(/api/v1/accounts/*)가 처리한다.
// - 로그인 세션(토큰/아이디)은 이 브라우저의 localStorage에만 저장된다.
// - 닉네임은 서버(accounts.nickname)가 기준이다. 댓글/실험/테스트케이스 등은 닉네임을 복제 저장하지
//   않고 매번 서버에서 조인해서 보여주므로, 프로필에서 바꾸면 다음 조회부터 모든 화면에 반영된다.
//   여기 localStorage 캐시는 이 브라우저에서 UserPopup 등을 서버 왕복 없이 즉시 표시하기 위한 것뿐이다.

const DEFAULT_USERNAME = 'KICT-001';

const LS_TOKEN           = 'token';
const LS_USERNAME        = 'username';           // 세션용 현재 로그인 아이디
const LS_NICKNAME_PREFIX = 'account_nickname:';  // 계정별 표시 닉네임
export const ACCOUNT_PROFILE_EVENT = 'account-profile-updated';

const canUseStorage = () => typeof window !== 'undefined';

/** 현재 로그인된 아이디 (세션 없으면 기본 계정) */
export function getCurrentUsername(): string {
  if (!canUseStorage()) return DEFAULT_USERNAME;
  return localStorage.getItem(LS_USERNAME) || DEFAULT_USERNAME;
}

/** 현재 표시용 닉네임 (계정별, 기본값은 로그인 아이디) */
export function getDisplayUsername(): string {
  return getNicknameForUsername(getCurrentUsername());
}

/** 특정 계정의 표시 닉네임 — 그 계정용 override가 이 브라우저에 있으면 그걸, 없으면 아이디 그대로 반환 */
export function getNicknameForUsername(username: string): string {
  if (!canUseStorage()) return username;
  return localStorage.getItem(LS_NICKNAME_PREFIX + username.toUpperCase()) || username;
}

export function getNickname(): string {
  return getDisplayUsername();
}

/** 닉네임 변경 — 현재 로그인 계정 기준, 로그인 아이디에는 영향 없음 */
export function changeNickname(newName: string): void {
  if (!canUseStorage()) return;
  localStorage.setItem(LS_NICKNAME_PREFIX + getCurrentUsername(), newName);
  window.dispatchEvent(new Event(ACCOUNT_PROFILE_EVENT));
}

/**
 * 이 브라우저의 캐시를 서버 기준 닉네임으로 맞춘다. 닉네임을 바꾼 기기가 아니라
 * 다른 기기/브라우저(오래 로그인된 세션 포함)에서도 최신 닉네임이 보이게 하려고
 * UserPopup이 마운트될 때 호출한다 — 여긴 여전히 화면 즉시 표시용 캐시일 뿐이고,
 * 진짜 기준은 항상 서버(accounts.nickname)다.
 */
export function applyServerNickname(username: string, nickname: string | null): void {
  if (!canUseStorage()) return;
  const key = LS_NICKNAME_PREFIX + username.toUpperCase();
  if (nickname) {
    localStorage.setItem(key, nickname);
  } else {
    localStorage.removeItem(key);
  }
  window.dispatchEvent(new Event(ACCOUNT_PROFILE_EVENT));
}

/** 로그인 성공 시 세션 기록 */
export function persistSession(token: string, username: string): void {
  if (!canUseStorage()) return;
  localStorage.setItem(LS_TOKEN, token);
  localStorage.setItem(LS_USERNAME, username.toUpperCase());
}
