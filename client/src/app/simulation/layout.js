// 시뮬레이션 페이지는 빌드 시 프리렌더(SSG)에서 돌리면
// 브라우저 전용 로직(localStorage/window 등) 때문에 에러가 날 수 있음.
// 따라서 이 세그먼트는 항상 동적으로 렌더링하도록 강제한다.

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function SimulationLayout({ children }) {
  return children;
}
