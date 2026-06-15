'use client';

import { useState, useEffect, FormEvent } from 'react';
import Layout from '@/lib/Layout';
import {
  getDisplayUsername,
  changeUsername,
  changePassword,
  verifyCurrentPassword,
} from '@/lib/account';

type Notice = { type: 'success' | 'error'; text: string } | null;

const MIN_PW_LEN = 4;

export default function ProfilePage() {
  const [currentName, setCurrentName] = useState('');

  // 유저네임 변경
  const [newName, setNewName]       = useState('');
  const [nameNotice, setNameNotice] = useState<Notice>(null);
  const [nameSaving, setNameSaving] = useState(false);

  // 비밀번호 변경
  const [curPw, setCurPw]         = useState('');
  const [newPw, setNewPw]         = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwNotice, setPwNotice]   = useState<Notice>(null);
  const [pwSaving, setPwSaving]   = useState(false);

  useEffect(() => {
    const name = getDisplayUsername();
    setCurrentName(name);
    setNewName(name);
  }, []);

  const initial = currentName.charAt(0).toUpperCase();

  const handleNameSubmit = (e: FormEvent) => {
    e.preventDefault();
    setNameNotice(null);
    const trimmed = newName.trim();
    if (!trimmed) {
      setNameNotice({ type: 'error', text: '아이디를 입력하세요.' });
      return;
    }
    if (trimmed === currentName) {
      setNameNotice({ type: 'error', text: '기존 아이디와 동일합니다.' });
      return;
    }
    setNameSaving(true);
    changeUsername(trimmed);
    setCurrentName(trimmed);
    setNameSaving(false);
    setNameNotice({ type: 'success', text: '아이디가 변경되었습니다.' });
  };

  const handlePwSubmit = (e: FormEvent) => {
    e.preventDefault();
    setPwNotice(null);
    if (!verifyCurrentPassword(curPw)) {
      setPwNotice({ type: 'error', text: '현재 비밀번호가 올바르지 않습니다.' });
      return;
    }
    if (newPw.length < MIN_PW_LEN) {
      setPwNotice({ type: 'error', text: `새 비밀번호는 최소 ${MIN_PW_LEN}자 이상이어야 합니다.` });
      return;
    }
    if (newPw === curPw) {
      setPwNotice({ type: 'error', text: '현재 비밀번호와 다른 비밀번호를 사용하세요.' });
      return;
    }
    if (newPw !== confirmPw) {
      setPwNotice({ type: 'error', text: '새 비밀번호 확인이 일치하지 않습니다.' });
      return;
    }
    setPwSaving(true);
    changePassword(newPw);
    setPwSaving(false);
    setCurPw('');
    setNewPw('');
    setConfirmPw('');
    setPwNotice({ type: 'success', text: '비밀번호가 변경되었습니다. 다음 로그인부터 적용됩니다.' });
  };

  return (
    <Layout>
      <div className="max-w-2xl mx-auto flex flex-col gap-4">

        {/* 계정 정보 카드 */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 flex items-center gap-4">
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold flex-shrink-0"
            style={{ background: 'var(--sidebar-active-text)', color: '#fff' }}
          >
            {initial}
          </div>
          <div className="min-w-0">
            <p className="text-lg font-bold text-gray-900 truncate">{currentName}</p>
            <p className="text-sm text-gray-400">관리자</p>
          </div>
        </div>

        {/* 아이디 변경 */}
        <form onSubmit={handleNameSubmit} className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-1">아이디 변경</h2>
          <p className="text-xs text-gray-400 mb-4">변경 즉시 화면에 반영되며, 다음 로그인부터 새 아이디로 로그인합니다.</p>

          <label htmlFor="newName" className="block text-xs font-semibold text-gray-500 mb-1.5">새 아이디</label>
          <input
            id="newName"
            type="text"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-gray-200 focus:border-blue-400 focus:outline-none transition-colors"
            placeholder="새 아이디를 입력하세요"
            autoComplete="username"
          />

          {nameNotice && <FormNotice notice={nameNotice} />}

          <div className="flex justify-end mt-4">
            <button
              type="submit"
              disabled={nameSaving}
              className="px-4 py-2 text-sm font-semibold text-white rounded-lg bg-blue-600 hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {nameSaving ? '저장 중...' : '아이디 변경'}
            </button>
          </div>
        </form>

        {/* 비밀번호 변경 */}
        <form onSubmit={handlePwSubmit} className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-1">비밀번호 변경</h2>
          <p className="text-xs text-gray-400 mb-4">현재 비밀번호 확인 후 새 비밀번호로 변경합니다. (최소 {MIN_PW_LEN}자)</p>

          <div className="space-y-3">
            <div>
              <label htmlFor="curPw" className="block text-xs font-semibold text-gray-500 mb-1.5">현재 비밀번호</label>
              <input
                id="curPw"
                type="password"
                value={curPw}
                onChange={e => setCurPw(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-gray-200 focus:border-blue-400 focus:outline-none transition-colors"
                placeholder="현재 비밀번호"
                autoComplete="current-password"
              />
            </div>
            <div>
              <label htmlFor="newPw" className="block text-xs font-semibold text-gray-500 mb-1.5">새 비밀번호</label>
              <input
                id="newPw"
                type="password"
                value={newPw}
                onChange={e => setNewPw(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-gray-200 focus:border-blue-400 focus:outline-none transition-colors"
                placeholder="새 비밀번호"
                autoComplete="new-password"
              />
            </div>
            <div>
              <label htmlFor="confirmPw" className="block text-xs font-semibold text-gray-500 mb-1.5">새 비밀번호 확인</label>
              <input
                id="confirmPw"
                type="password"
                value={confirmPw}
                onChange={e => setConfirmPw(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-gray-200 focus:border-blue-400 focus:outline-none transition-colors"
                placeholder="새 비밀번호 확인"
                autoComplete="new-password"
              />
            </div>
          </div>

          {pwNotice && <FormNotice notice={pwNotice} />}

          <div className="flex justify-end mt-4">
            <button
              type="submit"
              disabled={pwSaving || !curPw || !newPw || !confirmPw}
              className="px-4 py-2 text-sm font-semibold text-white rounded-lg bg-blue-600 hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {pwSaving ? '저장 중...' : '비밀번호 변경'}
            </button>
          </div>
        </form>

      </div>
    </Layout>
  );
}

function FormNotice({ notice }: { notice: NonNullable<Notice> }) {
  const isError = notice.type === 'error';
  return (
    <div className={`flex items-start gap-2 px-3.5 py-2.5 rounded-lg text-xs mt-4 border ${
      isError ? 'bg-red-50 border-red-200 text-red-600' : 'bg-emerald-50 border-emerald-200 text-emerald-700'
    }`}>
      <svg className="w-4 h-4 flex-shrink-0 mt-px" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        {isError ? (
          <>
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </>
        ) : (
          <>
            <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </>
        )}
      </svg>
      {notice.text}
    </div>
  );
}
