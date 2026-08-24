// 라우트별 헤더 타이틀 — 사이드바 항목 + 사이드바 미노출 상세 라우트
// 정확히 일치 또는 하위 경로(`/경로/...`)면 매칭
const ROUTE_TITLES: [string, string][] = [
  ['/dashboard',          '대시보드'],
  ['/experiments',        '실험'],
  ['/experiment-results', '테스트케이스 결과'],
  ['/training-results',   '학습 결과'],
  ['/trainings',          '학습'],
  ['/artifacts',          '아티팩트'],
  ['/models',             '모델 레지스트리'],
  ['/answer-datasets',    '정답 데이터'],
  ['/system',             '시스템 리소스'],
  ['/data-collection',    '데이터 수집'],
  ['/runs',               'Runs'],
  ['/profile',            '프로필 설정'],
];

export function resolveTitle(pathname: string | null): string {
  if (!pathname) return 'DataOps';
  const match = ROUTE_TITLES.find(
    ([prefix]) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
  return match ? match[1] : 'DataOps';
}
