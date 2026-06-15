// 계정 관리 (localStorage 기반)
//
// 백엔드 계정 API가 없는 현재, 유저네임·비밀번호 변경을 localStorage override로 실제 동작시킨다.
// - 기본 계정: NEXT_PUBLIC_AUTH_* (없으면 seongsimyoon / 1234) — login 라우트와 동일 값
// - override가 설정되면 로그인은 서버 라우트 대신 이 값으로 클라이언트 검증
// - 추후 백엔드 계정 API 구현 시 이 모듈만 교체하면 됨 (request.md 참조)

export const DEFAULT_USERNAME = process.env.NEXT_PUBLIC_AUTH_USERNAME || 'seongsimyoon';
export const DEFAULT_PASSWORD = process.env.NEXT_PUBLIC_AUTH_PASSWORD || '1234';

const LS_TOKEN             = 'token';
const LS_USERNAME          = 'username';          // 표시·세션용 현재 로그인 사용자명 (로그인 시 기록)
const LS_OVERRIDE_USERNAME = 'account_username';  // 변경된 로그인 아이디
const LS_OVERRIDE_PASSWORD = 'account_password';  // 변경된 비밀번호

const canUseStorage = () => typeof window !== 'undefined';

/** 유저네임·비밀번호 중 하나라도 사용자가 변경했는지 */
export function hasOverride(): boolean {
  if (!canUseStorage()) return false;
  return !!(localStorage.getItem(LS_OVERRIDE_USERNAME) || localStorage.getItem(LS_OVERRIDE_PASSWORD));
}

/** 현재 유효한 로그인 아이디 (override 우선, 없으면 기본값) */
export function getLoginUsername(): string {
  if (!canUseStorage()) return DEFAULT_USERNAME;
  return localStorage.getItem(LS_OVERRIDE_USERNAME) || DEFAULT_USERNAME;
}

/** 현재 유효한 비밀번호 (override 우선, 없으면 기본값) */
export function getLoginPassword(): string {
  if (!canUseStorage()) return DEFAULT_PASSWORD;
  return localStorage.getItem(LS_OVERRIDE_PASSWORD) || DEFAULT_PASSWORD;
}

/** 현재 세션 표시용 사용자명 (로그인 시 기록된 값, 없으면 현재 로그인 아이디) */
export function getDisplayUsername(): string {
  if (!canUseStorage()) return DEFAULT_USERNAME;
  return localStorage.getItem(LS_USERNAME) || getLoginUsername();
}

/** override 활성 시 클라이언트에서 자격증명 검증 */
export function verifyCredentials(username: string, password: string): boolean {
  return username === getLoginUsername() && password === getLoginPassword();
}

/** 비밀번호 변경 폼의 "현재 비밀번호" 확인용 */
export function verifyCurrentPassword(input: string): boolean {
  return input === getLoginPassword();
}

/** 유저네임 변경 — 로그인 아이디 + 표시명 동시 갱신 (재로그인 없이 즉시 반영) */
export function changeUsername(newName: string): void {
  if (!canUseStorage()) return;
  localStorage.setItem(LS_OVERRIDE_USERNAME, newName);
  localStorage.setItem(LS_USERNAME, newName);
}

/** 비밀번호 변경 */
export function changePassword(newPw: string): void {
  if (!canUseStorage()) return;
  localStorage.setItem(LS_OVERRIDE_PASSWORD, newPw);
}

/** 로그인 성공 시 세션 기록 */
export function persistSession(token: string, username: string): void {
  if (!canUseStorage()) return;
  localStorage.setItem(LS_TOKEN, token);
  localStorage.setItem(LS_USERNAME, username);
}
