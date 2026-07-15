import '../styles/globals.css';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'KICT DataOps',
  description: 'AI 모델 학습 및 결과 관리',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  const theme = process.env.NEXT_PUBLIC_THEME ?? 'default';

  return (
    <html lang="ko">
      <body data-theme={theme}>{children}</body>
    </html>
  );
}
