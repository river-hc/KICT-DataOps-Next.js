import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    // Layout·Header·Footer·AscViewer 등 핵심 컴포넌트가 lib/에 있음 —
    // 누락 시 lib에서만 쓰인 클래스(p-8, overflow-auto 등)의 CSS가 생성되지 않음
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: '#1890ff',
        success: '#52c41a',
        warning: '#faad14',
        error: '#ff4d4f',
      },
    },
  },
  plugins: [require('@tailwindcss/line-clamp')],
};

export default config;