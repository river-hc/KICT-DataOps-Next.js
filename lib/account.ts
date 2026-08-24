// 계정 관리
//
// - 아이디/비밀번호 검증은 백엔드 계정 API(/api/v1/accounts/*)가 처리한다.
// - 로그인 세션(토큰/아이디)은 이 브라우저의 localStorage에만 저장된다.
// - 닉네임(화면 표시·생성자명)도 계정별로 localStorage에 저장되며, 기본값은 로그인 아이디와 동일하다.

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

/** 로그인 성공 시 세션 기록 */
export function persistSession(token: string, username: string): void {
  if (!canUseStorage()) return;
  localStorage.setItem(LS_TOKEN, token);
  localStorage.setItem(LS_USERNAME, username.toUpperCase());
}
