'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [showPw, setShowPw]     = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ username, password }),
      });
      if (res.ok) {
        const data = await res.json();
        localStorage.setItem('token',    data.access_token);
        localStorage.setItem('username', data.username ?? username);
        router.push('/dashboard');
      } else {
        const err = await res.json().catch(() => ({ detail: '로그인에 실패했습니다.' }));
        setError(err.detail || '로그인에 실패했습니다.');
      }
    } catch {
      setError('서버 연결에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: 'var(--login-bg)' }}
    >
      <div
        className="w-full max-w-sm overflow-hidden"
        style={{
          background:   'var(--login-card-bg)',
          borderRadius: 20,
          boxShadow:    '0 8px 40px rgba(0,0,0,0.12)',
        }}
      >
        {/* 브랜딩 헤더 */}
        <div
          className="px-8 pt-8 pb-6 text-center"
          style={{
            background:   'var(--login-header-bg)',
            borderBottom: '1px solid var(--login-border)',
          }}
        >
          <div className="flex items-center justify-center mb-4">
            <Image
              src="/Images/KICT_logo.png"
              alt="KICT 로고"
              width={160}
              height={48}
              style={{ objectFit: 'contain' }}
              priority
            />
          </div>
          <p className="text-sm mt-1" style={{ color: 'var(--login-muted)' }}>
            AI 모델 학습 및 결과 관리 플랫폼
          </p>
        </div>

        {/* 로그인 폼 */}
        <form onSubmit={handleSubmit} className="px-8 py-6 space-y-4" style={{ background: 'var(--login-form-bg)' }}>
          {/* 사용자명 */}
          <div>
            <label
              htmlFor="username"
              className="block text-xs font-semibold mb-1.5"
              style={{ color: 'var(--login-muted-2)' }}
            >
              아이디
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              className="login-input w-full px-3.5 py-2.5 text-sm rounded-lg border transition-colors"
              style={{
                background:  'var(--login-input-bg)',
                color:       'var(--login-input-text)',
                borderColor: 'var(--login-border)',
              }}
              placeholder="아이디를 입력하세요"
              required
              autoComplete="username"
            />
          </div>

          {/* 비밀번호 */}
          <div>
            <label
              htmlFor="password"
              className="block text-xs font-semibold mb-1.5"
              style={{ color: 'var(--login-muted-2)' }}
            >
              비밀번호
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="login-input w-full px-3.5 py-2.5 pr-10 text-sm rounded-lg border transition-colors"
                style={{
                  background:  'var(--login-input-bg)',
                  color:       'var(--login-input-text)',
                  borderColor: 'var(--login-border)',
                }}
                placeholder="비밀번호를 입력하세요"
                required
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPw(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 transition-opacity opacity-50 hover:opacity-100"
                style={{ color: 'var(--login-muted)' }}
                tabIndex={-1}
              >
                {showPw ? (
                  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94" />
                    <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* 에러 메시지 */}
          {error && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-600 px-3.5 py-2.5 rounded-lg text-xs">
              <svg className="w-4 h-4 flex-shrink-0 mt-px" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              {error}
            </div>
          )}

          {/* 제출 버튼 */}
          <button
            type="submit"
            disabled={loading || !username || !password}
            className="w-full py-2.5 text-sm font-semibold text-white rounded-lg transition-opacity disabled:opacity-50"
            style={{ background: 'var(--login-accent)' }}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.3" strokeWidth="3" />
                  <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                </svg>
                로그인 처리 중...
              </span>
            ) : '로그인'}
          </button>
        </form>
      </div>
    </div>
  );
}
