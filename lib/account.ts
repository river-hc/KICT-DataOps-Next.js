// 계정 관리 (백엔드 계정 API가 없는 현재, 로컬 사용자 5개를 프론트에서 고정 관리한다)
//
// - 로그인 아이디/기본 비밀번호는 ACCOUNTS에 고정되어 있다.
// - 비밀번호를 변경하면 계정별로 localStorage에 override가 저장된다 (브라우저 로컬 한정).
// - 닉네임(화면 표시·요청자명)도 계정별로 저장되며, 기본값은 로그인 아이디와 동일하다.

export interface AccountDef {
  username: string;
  password: string;
}

export const ACCOUNTS: AccountDef[] = [
  { username: 'KICT-001', password: 'kict001' },
  { username: 'KICT-002', password: 'kict002' },
  { username: 'KICT-003', password: 'kict003' },
  { username: 'KICT-004', password: 'kict004' },
  { username: 'KICT-005', password: 'kict005' },
];

const LS_TOKEN           = 'token';
const LS_USERNAME        = 'username';           // 세션용 현재 로그인 아이디
const LS_PASSWORD_PREFIX = 'account_password:';  // 계정별 변경된 비밀번호
const LS_NICKNAME_PREFIX = 'account_nickname:';  // 계정별 표시 닉네임
export const ACCOUNT_PROFILE_EVENT = 'account-profile-updated';

const canUseStorage = () => typeof window !== 'undefined';

export function findAccount(username: string): AccountDef | undefined {
  return ACCOUNTS.find(a => a.username === username);
}

/** 현재 로그인된 아이디 (세션 없으면 첫 계정) */
export function getCurrentUsername(): string {
  if (!canUseStorage()) return ACCOUNTS[0].username;
  return localStorage.getItem(LS_USERNAME) || ACCOUNTS[0].username;
}

/** @deprecated getCurrentUsername 사용 */
export function getLoginUsername(): string {
  return getCurrentUsername();
}

/** 계정의 현재 유효 비밀번호 (override 우선, 없으면 기본값) */
export function getPasswordFor(username: string): string {
  if (canUseStorage()) {
    const override = localStorage.getItem(LS_PASSWORD_PREFIX + username);
    if (override) return override;
  }
  return findAccount(username)?.password ?? '';
}

/** 해당 계정에 비밀번호 override가 설정되어 있는지 (서버 기본값 검증을 건너뛸지 여부) */
export function hasOverride(username: string): boolean {
  if (!canUseStorage()) return false;
  return !!localStorage.getItem(LS_PASSWORD_PREFIX + username);
}

/** 클라이언트에서 자격증명 검증 (비밀번호 override 계정용) */
export function verifyCredentials(username: string, password: string): boolean {
  if (!findAccount(username)) return false;
  return password === getPasswordFor(username);
}

/** 비밀번호 변경 폼의 "현재 비밀번호" 확인용 (현재 로그인 계정 기준) */
export function verifyCurrentPassword(input: string): boolean {
  return input === getPasswordFor(getCurrentUsername());
}

/** 현재 표시용 닉네임 (계정별, 기본값은 로그인 아이디) */
export function getDisplayUsername(): string {
  const username = getCurrentUsername();
  if (!canUseStorage()) return username;
  return localStorage.getItem(LS_NICKNAME_PREFIX + username) || username;
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

/** 비밀번호 변경 — 계정별 override 저장 */
export function changePassword(username: string, newPw: string): void {
  if (!canUseStorage()) return;
  localStorage.setItem(LS_PASSWORD_PREFIX + username, newPw);
}

/** 로그인 성공 시 세션 기록 */
export function persistSession(token: string, username: string): void {
  if (!canUseStorage()) return;
  localStorage.setItem(LS_TOKEN, token);
  localStorage.setItem(LS_USERNAME, username);
}
