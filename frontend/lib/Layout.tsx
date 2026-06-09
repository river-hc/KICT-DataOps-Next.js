'use client';

import { ReactNode, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import UserPopup from './UserPopup';

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
      <circle cx="12" cy="12" r="3" />
      <path d="M19.07 4.93l-1.41 1.41M4.93 4.93l1.41 1.41M19.07 19.07l-1.41-1.41M4.93 19.07l1.41-1.41M12 2v2M12 20v2M2 12h2M20 12h2" />
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
  { name: '대시보드',        href: '/',                   icon: Icons.dashboard  },
  { name: '실험 관리',       href: '/experiments',        icon: Icons.experiment },
  { name: '실험 결과',       href: '/experiment-results', icon: Icons.expResults },
  {
    type: 'group',
    name: '학습',
    icon: Icons.training,
    children: [
      { name: '학습 관리', href: '/trainings', icon: Icons.training  },
      { name: '학습 결과', href: '/runs',      icon: Icons.results   },
      { name: '아티팩트',  href: '/artifacts', icon: Icons.artifacts },
    ],
  },
  { name: '모델 레지스트리', href: '/models',              icon: Icons.models     },
  { name: '시스템',          href: '/system',              icon: Icons.system     },
];

const modernNavItems: NavEntry[] = [
  { name: '대시보드',        href: '/',            icon: Icons.dashboard  },
  { name: '실험 관리',      href: '/experiments',        icon: Icons.experiment  },
  { name: '실험 결과',      href: '/experiment-results', icon: Icons.expResults  },
  {
    type: 'group',
    name: '학습',
    icon: Icons.training,
    children: [
      { name: '학습 관리', href: '/trainings', icon: Icons.training  },
      { name: '학습 결과', href: '/runs',      icon: Icons.results   },
      { name: '아티팩트',  href: '/artifacts', icon: Icons.artifacts },
    ],
  },
  { name: '모델 레지스트리', href: '/models', icon: Icons.models },
  { name: '시스템',          href: '/system', icon: Icons.system },
];

interface LayoutProps {
  children: ReactNode;
  /** true: 바디 영역이 패딩/스크롤 없이 꽉 채움 (전체화면 대시보드용) */
  fullHeight?: boolean;
}

// ─── 사이드바 레이아웃 (포트 3000·3001) ──────────────────────────────────────

function LayoutSidebar({ children, fullHeight = false }: LayoutProps) {
  const pathname = usePathname();
  const [open, setOpen]           = useState(true);
  const [groupsOpen, setGroupsOpen] = useState<Record<string, boolean>>({ '학습': true });

  const isModern = THEME === 'modern';
  const entries: NavEntry[] = isModern ? modernNavItems : navItems;

  const isItemActive = (href: string) =>
    pathname === href || (href !== '/' && pathname?.startsWith(href));

  const isGroupActive = (children: NavItem[]) => children.some(c => isItemActive(c.href));

  const headerTitle = (() => {
    for (const e of entries) {
      if ('type' in e) {
        const match = e.children.find(c => c.href === pathname);
        if (match) return match.name;
      } else if (e.href === pathname) {
        return e.name;
      }
    }
    return 'DataOps Platform';
  })();

  return (
    <div className="h-screen flex overflow-hidden" style={{ background: 'var(--layout-bg)' }}>

      {/* 사이드바 */}
      <aside
        className={`${open ? 'w-56' : 'w-16'} transition-all duration-300 flex flex-col flex-shrink-0`}
        style={{ background: 'var(--sidebar-bg)', borderRight: '1px solid var(--sidebar-border)' }}
      >
        {/* 로고 */}
        <div className="flex items-center py-4 pl-4 pr-1 border-b" style={{ borderColor: 'var(--sidebar-border)' }}>
          {open && (
            <span className="flex-1 min-w-0 font-bold text-lg truncate" style={{ color: 'var(--logo-text)' }}>
              DataOps
            </span>
          )}
          <button
            onClick={() => setOpen(v => !v)}
            className={`flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-md transition-opacity opacity-60 hover:opacity-100 ${open ? 'ml-auto' : 'mx-auto'}`}
            style={{ color: 'var(--logo-text)' }}
            title={open ? '사이드바 접기' : '사이드바 펴기'}
          >
            <svg
              viewBox="0 0 16 16"
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {open
                ? <path d="M11 3l-6 5 6 5" />
                : <path d="M5 3l6 5-6 5" />
              }
            </svg>
          </button>
        </div>

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

        {/* 상태 */}
        {open && (
          <div className="p-4 border-t" style={{ borderColor: 'var(--sidebar-border)' }}>
            <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--status-text)' }}>
              <span className="w-2 h-2 rounded-full bg-current animate-pulse flex-shrink-0" />
              <span>System Online</span>
            </div>
          </div>
        )}
      </aside>

      {/* 오른쪽 패널 */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* 헤더 */}
        <header
          className="flex-shrink-0 border-b px-6 py-5"
          style={{
            background:  'var(--header-bg)',
            borderColor: 'var(--header-border)',
            boxShadow:   '0 1px 3px rgba(0,0,0,0.06)',
          }}
        >
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-semibold" style={{ color: 'var(--header-text)' }}>
              {headerTitle}
            </h1>
            <UserPopup />
          </div>
        </header>

        {/* 바디 */}
        <main className={`flex-1 min-h-0 ${fullHeight ? 'overflow-hidden' : 'p-6 overflow-auto'}`}>
          {children}
        </main>

        {/* 푸터 */}
        <footer
          className="flex-shrink-0 border-t h-12 px-6 flex items-center justify-between"
          style={{ background: 'var(--header-bg)', borderColor: 'var(--header-border)' }}
        >
          <span className="text-xs" style={{ color: 'var(--sidebar-text)' }}>DataOps Platform</span>
          <span className="text-xs" style={{ color: 'var(--sidebar-text)' }}>v1.0.0 &nbsp;·&nbsp; &copy; 2026 KICT</span>
        </footer>

      </div>
    </div>
  );
}

export default function Layout({ children, fullHeight = false }: LayoutProps) {
  return <LayoutSidebar fullHeight={fullHeight}>{children}</LayoutSidebar>;
}
