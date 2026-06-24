'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ACCOUNT_PROFILE_EVENT, getDisplayUsername } from './account';

export default function UserPopup() {
  const [username, setUsername] = useState('');
  const router = useRouter();

  useEffect(() => {
    const syncUsername = () => setUsername(getDisplayUsername());
    syncUsername();
    window.addEventListener(ACCOUNT_PROFILE_EVENT, syncUsername);
    window.addEventListener('storage', syncUsername);
    return () => {
      window.removeEventListener(ACCOUNT_PROFILE_EVENT, syncUsername);
      window.removeEventListener('storage', syncUsername);
    };
  }, []);

  const initial = username.charAt(0).toUpperCase();

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    router.push('/login');
  };

  return (
    <div className="user-popup">
      <input type="checkbox" id="user-popup-toggle" />

      {/* 트리거: 아바타 + 이름 + 화살표 */}
      <label htmlFor="user-popup-toggle" className="user-trigger">
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
          style={{ background: 'var(--sidebar-active-text)', color: '#fff' }}
        >
          {initial}
        </div>
        <span className="user-trigger-name">{username}</span>
        <svg className="user-chevron" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </label>

      {/* 외부 클릭 닫기 오버레이 */}
      <label htmlFor="user-popup-toggle" className="user-overlay" />

      {/* 팝업 창 */}
      <div className="user-window">

        {/* 사용자 정보 */}
        <div className="user-info-header">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center text-base font-bold flex-shrink-0"
            style={{ background: 'var(--sidebar-active-text)', color: '#fff' }}
          >
            {initial}
          </div>
          <div className="user-info-details">
            <span className="user-info-name">{username}</span>
            <span className="user-info-role">관리자</span>
          </div>
        </div>

        <hr />

        <ul>
          <li>
            <button
              onClick={() => router.push('/profile')}
              className="user-window-btn w-full text-left"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              프로필 설정
            </button>
          </li>
          <li>
            <button onClick={handleLogout} className="user-window-btn logout-btn w-full text-left">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              로그아웃
            </button>
          </li>
        </ul>

      </div>
    </div>
  );
}
