'use client';

/** 전역 푸터 — viewport 최하단 고정 (사이드바 상태 영역과 동일 높이 h-12) */
export default function Footer() {
  return (
    <footer
      className="flex-shrink-0 border-t h-12 px-6 flex items-center justify-end"
      style={{ background: 'var(--header-bg)', borderColor: 'var(--header-border)' }}
    >
      <span className="flex items-center gap-3 text-xs" style={{ color: 'var(--sidebar-text)' }}>
        <span>v1.0.0</span>
        <span>·</span>
        <span>&copy; 2026 KICT</span>
        <span>|</span>
        <span>developed by River-AI</span>
      </span>
    </footer>
  );
}
