'use client';

import { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import UserPopup from './UserPopup';

// ─── 네비게이션 그룹 ──────────────────────────────────────────────────────────

type NavItem  = { name: string; href: string; desc?: string };
type NavGroup = { label: string; href?: string; items?: NavItem[] };

const NAV_GROUPS: NavGroup[] = [
  { label: '대시보드', href: '/' },
  {
    label: '학습',
    items: [
      { name: '학습 관리', href: '/trainings',  desc: '학습 잡 실행 및 현황 관리' },
      { name: '학습 결과', href: '/runs',        desc: '실행 이력 및 성능 지표'   },
    ],
  },
  {
    label: '실험',
    items: [
      { name: '실험 관리', href: '/experiments', desc: '실험 파라미터 설정' },
      { name: '아티팩트',  href: '/artifacts',   desc: '모델 산출물 관리'   },
    ],
  },
  {
    label: '모델',
    items: [
      { name: '모델 레지스트리', href: '/models', desc: '등록된 모델 버전 관리' },
    ],
  },
  { label: '시스템', href: '/system' },
];

// 아래 방향 화살표 SVG (CSS에서 hover 시 rotate -180deg 처리)
const ChevronDown = (
  <svg viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 9l-7 7-7-7" />
  </svg>
);

// ─── 레이아웃 ─────────────────────────────────────────────────────────────────

export default function LayoutTopNav({
  children,
  fullHeight = false,
}: {
  children: ReactNode;
  fullHeight?: boolean;
}) {
  const pathname = usePathname() ?? '/';

  return (
    <div
      className={`flex flex-col ${fullHeight ? 'h-screen overflow-hidden' : 'min-h-screen'}`}
      style={{ background: 'var(--layout-bg)' }}
    >

      {/* 헤더 */}
      <header
        className="flex-shrink-0 border-b"
        style={{ background: 'var(--header-bg)', borderColor: 'var(--header-border)' }}
      >
        <div className="flex items-stretch h-[100px] px-6">

          {/* 로고 */}
          <div
            className="flex items-center pr-8 border-r mr-2"
            style={{ borderColor: 'var(--header-border)' }}
          >
            <span
              className="font-bold text-2xl tracking-tight select-none"
              style={{ color: 'var(--logo-text)' }}
            >
              DataOps
            </span>
          </div>

          {/* 네비게이션 */}
          <ul className="top-menu flex-1">
            {NAV_GROUPS.map(group => {
              const isActive = group.href
                ? pathname === group.href
                : (group.items?.some(i => i.href !== '/' && pathname.startsWith(i.href)) ?? false);

              if (group.href) {
                return (
                  <li key={group.label} className="top-item">
                    <Link
                      href={group.href}
                      className={`top-link${isActive ? ' is-active' : ''}`}
                    >
                      {group.label}
                    </Link>
                  </li>
                );
              }

              return (
                <li key={group.label} className="top-item has-submenu">
                  <button className={`top-link${isActive ? ' is-active' : ''}`}>
                    {group.label}
                    {ChevronDown}
                  </button>

                  <ul className="top-submenu">
                    {group.items!.map(item => (
                      <li key={item.href} className="top-submenu-item">
                        <Link href={item.href} className="top-submenu-link">
                          <span>{item.name}</span>
                          {item.desc && <span className="sub-desc">{item.desc}</span>}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </li>
              );
            })}
          </ul>

          {/* 우측: 온라인 상태 + 사용자 프로필 */}
          <div className="flex items-center gap-3 pl-4">
            <div className="flex items-center gap-1.5 text-sm" style={{ color: 'var(--status-text)' }}>
              <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
              <span className="font-medium">Online</span>
            </div>
            <UserPopup />
          </div>

        </div>
      </header>

      {/* 바디 */}
      <main className={`flex-1 ${fullHeight ? 'min-h-0 overflow-hidden' : 'overflow-auto'}`}>
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
  );
}
