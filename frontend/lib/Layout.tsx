'use client';

import { ReactNode, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Header, { resolveTitle } from './Header';
import Footer from './Footer';

const THEME = process.env.NEXT_PUBLIC_THEME;

// ─── 사이드바 SVG 아이콘 ──────────────────────────────────────────────────────

const Icons = {
  dashboard: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  ),
  training: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
    </svg>
  ),
  experiment: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 3h6v11l3.5 5.5A1 1 0 0117.6 21H6.4a1 1 0 01-.9-1.5L9 14V3z" /><path d="M9 3H6" /><path d="M15 3h3" />
    </svg>
  ),
  results: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3v18h18" /><path d="M7 16l4-4 4 4 4-6" />
    </svg>
  ),
  expResults: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /><polyline points="9 15 11 17 15 13" />
    </svg>
  ),
  artifacts: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
    </svg>
  ),
  models: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx="12" cy="5" rx="9" ry="3" /><path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5" /><path d="M3 12c0 1.66 4.03 3 9 3s9-1.34 9-3" />
    </svg>
  ),
  system: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="3" width="16" height="7" rx="2" />
      <rect x="4" y="14" width="16" height="7" rx="2" />
      <path d="M8 7h.01M8 18h.01M12 7h4M12 18h4" />
    </svg>
  ),
};

interface NavItem {
  name: string;
  href: string;
  icon: ReactNode;
}

interface NavGroup {
  type: 'group';
  name: string;
  icon: ReactNode;
  children: NavItem[];
}

type NavEntry = NavItem | NavGroup;

const navItems: NavEntry[] = [
  { name: '대시보드',        href: '/dashboard',   icon: Icons.dashboard  },
  { name: '실험',            href: '/experiments', icon: Icons.experiment },
  { name: '아티팩트',        href: '/artifacts',   icon: Icons.artifacts  },
  { name: '모델 레지스트리', href: '/models',       icon: Icons.models     },
  { name: '시스템 리소스',    href: '/system',       icon: Icons.system     },
];

const modernNavItems: NavEntry[] = [
  { name: '대시보드',        href: '/dashboard',   icon: Icons.dashboard  },
  { name: '실험',            href: '/experiments', icon: Icons.experiment },
  { name: '아티팩트',        href: '/artifacts',   icon: Icons.artifacts  },
  { name: '모델 레지스트리', href: '/models',       icon: Icons.models     },
  { name: '시스템 리소스',    href: '/system',       icon: Icons.system     },
];

interface LayoutProps {
  children: ReactNode;
  /** true: 바디 영역이 패딩/스크롤 없이 꽉 채움 (전체화면 대시보드용) */
  fullHeight?: boolean;
  /** 페이지 타이틀 카드 좌측 타이틀 영역 */
  title?: ReactNode;
  /** 페이지 타이틀 카드 우측 액션 영역 */
  titleActions?: ReactNode;
  /** 페이지 타이틀 카드 바깥 상단 영역 */
  titlePrefix?: ReactNode;
}

// ─── 사이드바 레이아웃 (포트 3000·3001) ──────────────────────────────────────

function LayoutSidebar({ children, fullHeight = false, title, titleActions, titlePrefix }: LayoutProps) {
  const pathname = usePathname();
  const [open, setOpen]           = useState(true);
  const [groupsOpen, setGroupsOpen] = useState<Record<string, boolean>>({ '학습': true });

  const isModern = THEME === 'modern';
  const entries: NavEntry[] = isModern ? modernNavItems : navItems;

  const isItemActive = (href: string) =>
    pathname === href || (href !== '/' && pathname?.startsWith(href));

  const isGroupActive = (children: NavItem[]) => children.some(c => isItemActive(c.href));
  const pageTitle = resolveTitle(pathname);
  const titleNode = title ?? pageTitle;

  // 페이지 타이틀은 lib/Header.tsx의 ROUTE_TITLES에서 라우트 기반으로 결정

  return (
    // 헤더·푸터는 viewport 최상단·최하단 고정, 스크롤은 main 내부에서만 발생.
    // 높이는 100dvh(동적 viewport) 우선 — 해상도 변경 시 100vh 오차로 푸터 아래 여백이 생기는 것 방지.
    // dvh 미지원 브라우저는 h-screen(100vh)으로 폴백.
    <div
      className="h-screen flex overflow-hidden"
      style={{ background: 'var(--layout-bg)', height: '100dvh' }}
    >

      {/* 사이드바 */}
      <aside
        className={`${open ? 'w-56' : 'w-16'} relative transition-all duration-300 flex flex-col flex-shrink-0`}
        style={{ background: 'var(--sidebar-bg)', borderRight: '1px solid var(--sidebar-border)' }}
      >
        {/* 로고 — 헤더와 동일 높이(h-16)로 하단 경계선 일치 */}
        <div className="h-16 flex-shrink-0 flex items-center px-4 border-b" style={{ borderColor: 'var(--sidebar-border)' }}>
          {open && (
            <div className="flex-1 min-w-0 flex items-center">
              <Link
                href="/dashboard"
                className="text-[24px] leading-8 font-semibold whitespace-nowrap transition-opacity hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 rounded"
                style={{ color: 'var(--logo-text)' }}
                aria-label="대시보드로 이동"
              >
                KICT DataOps
              </Link>
            </div>
          )}
        </div>

        <button
          onClick={() => setOpen(v => !v)}
          className="absolute -right-3 top-1/2 z-20 flex h-12 w-7 -translate-y-1/2 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 shadow-md transition-colors hover:border-gray-300 hover:bg-gray-50 hover:text-gray-800"
          title={open ? '사이드바 접기' : '사이드바 펴기'}
        >
          <svg
            viewBox="0 0 16 16"
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.25}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {open
              ? <path d="M10 4L6 8l4 4" />
              : <path d="M6 4l4 4-4 4" />
            }
          </svg>
        </button>

        {/* 네비게이션 */}
        <nav className="flex-1 p-2 space-y-0.5">
          {entries.map((entry) => {
            if ('type' in entry) {
              const active   = isGroupActive(entry.children);
              const grpOpen  = groupsOpen[entry.name] ?? true;
              return (
                <div key={entry.name}>
                  <button
                    onClick={() => {
                      if (!open) {
                        setOpen(true);
                      } else {
                        setGroupsOpen(prev => ({ ...prev, [entry.name]: !(prev[entry.name] ?? true) }));
                      }
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors"
                    style={active
                      ? { background: 'var(--sidebar-active-bg)', color: 'var(--sidebar-active-text)' }
                      : { color: 'var(--sidebar-text)' }
                    }
                  >
                    <span className="w-5 h-5 flex-shrink-0">{entry.icon}</span>
                    {open && (
                      <>
                        <span className={`flex-1 text-sm text-left truncate ${active ? 'font-semibold' : 'font-medium'}`}>
                          {entry.name}
                        </span>
                        <svg
                          viewBox="0 0 16 16"
                          className={`w-4 h-4 flex-shrink-0 transition-transform duration-200 ${grpOpen ? 'rotate-180' : ''}`}
                          fill="none" stroke="currentColor" strokeWidth={2}
                          strokeLinecap="round" strokeLinejoin="round"
                        >
                          <path d="M4 6l4 4 4-4" />
                        </svg>
                      </>
                    )}
                  </button>
                  {open && grpOpen && (
                    <div
                      className="mt-0.5 ml-4 pl-2 space-y-0.5 border-l"
                      style={{ borderColor: 'var(--sidebar-border)' }}
                    >
                      {entry.children.map(child => {
                        const active = isItemActive(child.href);
                        return (
                          <Link
                            key={child.href}
                            href={child.href}
                            className="theme-nav-link flex items-center gap-3 px-3 py-2 rounded-lg transition-colors"
                            style={active
                              ? { background: 'var(--sidebar-active-bg)', color: 'var(--sidebar-active-text)' }
                              : { color: 'var(--sidebar-text)' }
                            }
                          >
                            <span className="w-4 h-4 flex-shrink-0">{child.icon}</span>
                            <span className={`text-xs truncate ${active ? 'font-semibold' : 'font-medium'}`}>
                              {child.name}
                            </span>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }

            const active = isItemActive(entry.href);
            return (
              <Link
                key={entry.href}
                href={entry.href}
                className="theme-nav-link flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors"
                style={active
                  ? { background: 'var(--sidebar-active-bg)', color: 'var(--sidebar-active-text)' }
                  : { color: 'var(--sidebar-text)' }
                }
              >
                <span className="w-5 h-5 flex-shrink-0">{entry.icon}</span>
                {open && (
                  <span className={`text-sm truncate ${active ? 'font-semibold' : 'font-medium'}`}>
                    {entry.name}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* 하단 브랜드 — 푸터와 동일 높이(h-12)로 상단 경계선 일치 */}
        {open && (
          <div className="h-12 flex-shrink-0 flex items-center px-4 border-t" style={{ borderColor: 'var(--sidebar-border)' }}>
            <span className="text-xs font-medium" style={{ color: 'var(--sidebar-text)' }}>DataOps Platform</span>
          </div>
        )}
      </aside>

      {/* 오른쪽 패널 */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* 전역 헤더 (lib/Header.tsx) — viewport 최상단 고정 */}
        <Header />

        {/* 바디 — 콘텐츠가 모서리에 붙지 않도록 모든 페이지 공통 p-8 여백 */}
        <main className={`flex-1 min-h-0 ${fullHeight ? 'overflow-hidden' : 'p-8 overflow-auto'}`}>
          {fullHeight ? children : (
            <>
              {titlePrefix && (
                <div className="mb-2">
                  {titlePrefix}
                </div>
              )}
              <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
                <div className="flex items-center justify-between gap-4 border-b border-gray-100 px-5 py-4">
                  <h1 className="text-xl font-semibold" style={{ color: 'var(--header-text)' }}>
                    {titleNode}
                  </h1>
                  {titleActions && (
                    <div className="flex flex-shrink-0 items-center gap-2">
                      {titleActions}
                    </div>
                  )}
                </div>
                <div className="p-5">
                  {children}
                </div>
              </div>
            </>
          )}
        </main>

        {/* 전역 푸터 (lib/Footer.tsx) — viewport 최하단 고정 */}
        <Footer />

      </div>
    </div>
  );
}

export default function Layout({ children, fullHeight = false, title, titleActions, titlePrefix }: LayoutProps) {
  return (
    <LayoutSidebar fullHeight={fullHeight} title={title} titleActions={titleActions} titlePrefix={titlePrefix}>
      {children}
    </LayoutSidebar>
  );
}
