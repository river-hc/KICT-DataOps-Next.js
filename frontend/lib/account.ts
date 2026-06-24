// 계정 관리 (localStorage 기반)
//
// 백엔드 계정 API가 없는 현재, 로그인 아이디와 화면 표시용 닉네임을 분리해서 관리한다.
// - 기본 로그인 계정: NEXT_PUBLIC_AUTH_* (없으면 KICT_001 / Kkict001)
// - 닉네임은 화면 표시·실험 요청자명에 사용하고, 로그인 아이디는 변경하지 않는다.

export const DEFAULT_USERNAME = process.env.NEXT_PUBLIC_AUTH_USERNAME || 'KICT_001';
export const DEFAULT_PASSWORD = process.env.NEXT_PUBLIC_AUTH_PASSWORD || 'Kkict001';
export const DEFAULT_NICKNAME = process.env.NEXT_PUBLIC_AUTH_NICKNAME || 'KICT_001';

const LS_TOKEN             = 'token';
const LS_USERNAME          = 'username';          // 세션용 현재 로그인 아이디
const LS_NICKNAME          = 'nickname';          // 표시·요청자용 닉네임
const LS_OVERRIDE_PASSWORD = 'account_password';  // 변경된 비밀번호
const LS_LEGACY_USERNAME   = 'account_username';  // 이전 버전에서 사용하던 로그인 아이디 override
const LS_SCHEMA_VERSION    = 'account_schema_version';
const ACCOUNT_SCHEMA_VERSION = '2';
export const ACCOUNT_PROFILE_EVENT = 'account-profile-updated';

const canUseStorage = () => typeof window !== 'undefined';

function ensureAccountStorageMigration(): void {
  if (!canUseStorage()) return;
  if (localStorage.getItem(LS_SCHEMA_VERSION) === ACCOUNT_SCHEMA_VERSION) return;
  localStorage.removeItem(LS_LEGACY_USERNAME);
  localStorage.removeItem(LS_OVERRIDE_PASSWORD);
  if (!localStorage.getItem(LS_NICKNAME)) {
    localStorage.setItem(LS_NICKNAME, DEFAULT_NICKNAME);
  }
  localStorage.setItem(LS_SCHEMA_VERSION, ACCOUNT_SCHEMA_VERSION);
}

/** 비밀번호 override가 설정되어 있는지 */
export function hasOverride(): boolean {
  if (!canUseStorage()) return false;
  ensureAccountStorageMigration();
  return !!localStorage.getItem(LS_OVERRIDE_PASSWORD);
}

/** 현재 유효한 로그인 아이디 */
export function getLoginUsername(): string {
  return DEFAULT_USERNAME;
}

/** 현재 유효한 비밀번호 (override 우선, 없으면 기본값) */
export function getLoginPassword(): string {
  if (!canUseStorage()) return DEFAULT_PASSWORD;
  ensureAccountStorageMigration();
  return localStorage.getItem(LS_OVERRIDE_PASSWORD) || DEFAULT_PASSWORD;
}

/** 현재 표시용 닉네임 */
export function getDisplayUsername(): string {
  if (!canUseStorage()) return DEFAULT_NICKNAME;
  ensureAccountStorageMigration();
  return localStorage.getItem(LS_NICKNAME) || DEFAULT_NICKNAME;
}

export function getNickname(): string {
  return getDisplayUsername();
}

/** override 활성 시 클라이언트에서 자격증명 검증 */
export function verifyCredentials(username: string, password: string): boolean {
  return username === getLoginUsername() && password === getLoginPassword();
}

/** 비밀번호 변경 폼의 "현재 비밀번호" 확인용 */
export function verifyCurrentPassword(input: string): boolean {
  return input === getLoginPassword();
}

/** 닉네임 변경 — 로그인 아이디에는 영향 없음 */
export function changeNickname(newName: string): void {
  if (!canUseStorage()) return;
  ensureAccountStorageMigration();
  localStorage.setItem(LS_NICKNAME, newName);
  window.dispatchEvent(new Event(ACCOUNT_PROFILE_EVENT));
}

/** @deprecated 닉네임 변경으로만 동작 */
export function changeUsername(newName: string): void {
  changeNickname(newName);
}

/** 비밀번호 변경 */
export function changePassword(newPw: string): void {
  if (!canUseStorage()) return;
  ensureAccountStorageMigration();
  localStorage.setItem(LS_OVERRIDE_PASSWORD, newPw);
}

/** 로그인 성공 시 세션 기록 */
export function persistSession(token: string, username: string): void {
  if (!canUseStorage()) return;
  ensureAccountStorageMigration();
  localStorage.setItem(LS_TOKEN, token);
  localStorage.setItem(LS_USERNAME, username);
  if (!localStorage.getItem(LS_NICKNAME)) {
    localStorage.setItem(LS_NICKNAME, DEFAULT_NICKNAME);
  }
}
