'use client';

/** 전역 푸터 — viewport 최하단 고정 (사이드바 상태 영역과 동일 높이 h-12) */
export default function Footer() {
  return (
    <footer
      className="flex-shrink-0 border-t h-12 px-6 flex items-center justify-between"
      style={{ background: 'var(--header-bg)', borderColor: 'var(--header-border)' }}
    >
      <span className="text-xs" style={{ color: 'var(--sidebar-text)' }}>DataOps Platform</span>
      <span className="text-xs" style={{ color: 'var(--sidebar-text)' }}>v1.0.0 &nbsp;·&nbsp; &copy; 2026 KICT</span>
    </footer>
  );
}
