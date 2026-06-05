'use client';

import { ReactNode, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface NavItem {
  name: string;
  href: string;
  abbr: string;
}

const navItems: NavItem[] = [
  { name: '대시보드', href: '/', abbr: 'D' },
  { name: '학습 관리', href: '/trainings', abbr: 'T' },
  { name: '실험 관리', href: '/experiments', abbr: 'E' },
  { name: '학습 결과', href: '/runs', abbr: 'R' },
  { name: '아티팩트', href: '/artifacts', abbr: 'A' },
  { name: '모델 레지스트리', href: '/models', abbr: 'M' },
  { name: '시스템', href: '/system', abbr: 'S' },
];

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div className="h-screen bg-gray-50 flex overflow-hidden">
      {/* 사이드바 */}
      <aside
        className={`${
          sidebarOpen ? 'w-56' : 'w-16'
        } bg-white shadow-lg transition-all duration-300 flex flex-col`}
      >
        {/* 로고 */}
        <div className="p-4 border-b border-gray-200">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="w-full flex items-center justify-center gap-2 text-blue-600 font-bold text-lg hover:text-blue-800 transition"
          >
            {sidebarOpen ? <span className="truncate">DataOps</span> : <span>DO</span>}
          </button>
        </div>

        {/* 네비게이션 */}
        <nav className="flex-1 p-2 space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href || (item.href !== '/' && pathname?.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg transition ${
                  isActive
                    ? 'bg-blue-50 text-blue-600 font-medium'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <span className="w-6 text-center text-sm font-semibold">{sidebarOpen ? '' : item.abbr}</span>
                {sidebarOpen && <span className="text-sm">{item.name}</span>}
              </Link>
            );
          })}
        </nav>

        {/* 상태 */}
        {sidebarOpen && (
          <div className="p-4 border-t border-gray-200">
            <div className="flex items-center gap-2 text-sm text-green-600">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
              <span>System Online</span>
            </div>
          </div>
        )}
      </aside>

      {/* 메인 콘텐츠 */}
      <div className="flex-1 flex flex-col">
        {/* 헤더 */}
        <header className="bg-white shadow-sm border-b border-gray-200 px-6 py-4">
          <h1 className="text-xl font-semibold text-gray-800">
            {navItems.find((n) => n.href === pathname)?.name || 'DataOps Platform'}
          </h1>
        </header>

        {/* 콘텐츠 */}
        <main className="flex-1 p-6 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}