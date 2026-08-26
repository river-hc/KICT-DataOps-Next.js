/** @type {import('next').NextConfig} */
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8000';

const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  // /api 프록시 기본 제한이 30초라서, 정답데이터 자동수집처럼 KMA API를 여러 번 이어서
  // 호출하는 오래 걸리는 요청은 백엔드가 끝까지 처리해도 프록시가 먼저 끊어서 500이 났었다.
  // 실제로 읽히는 경로는 top-level이 아니라 experimental 밑이다.
  experimental: {
    proxyTimeout: 180000,
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${BACKEND_URL}/api/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;