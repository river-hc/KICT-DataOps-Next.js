'use client';

export default function UserPopup() {
  return (
    <div className="user-popup">
      <input type="checkbox" id="user-popup-toggle" />

      {/* 트리거: 아바타 + 이름 + 화살표 */}
      <label htmlFor="user-popup-toggle" className="user-trigger">
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
          style={{ background: 'var(--sidebar-active-text)', color: '#fff' }}
        >
          K
        </div>
        <span className="user-trigger-name">Kim KICT</span>
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
            K
          </div>
          <div className="user-info-details">
            <span className="user-info-name">Kim KICT</span>
            <span className="user-info-role">관리자</span>
          </div>
        </div>

        <hr />

        <ul>
          <li>
            <label htmlFor="user-popup-toggle" className="user-window-btn logout-btn" role="button" tabIndex={0}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              로그아웃
            </label>
          </li>
        </ul>

      </div>
    </div>
  );
}
