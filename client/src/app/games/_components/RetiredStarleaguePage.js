import Link from 'next/link';
import SiteHeader from '../../../components/SiteHeader';

export default function RetiredStarleaguePage() {
  return (
    <main className="games-page-shell">
      <SiteHeader />
      <div className="games-page">
        <section className="games-hero" aria-labelledby="retired-starleague-title">
          <div>
            <h1 id="retired-starleague-title">스타리그 웹 플레이 종료</h1>
            <p>마이애니메이션크래프트는 별도 앱으로 개발을 이어갑니다.</p>
            <p>이전에 저장한 데이터와 전적은 삭제하지 않았습니다.</p>
          </div>
          <div className="games-hero-actions">
            <Link href="/games">게임 목록</Link>
            <Link href="/games/records?gameSlug=myanimecraft">기존 전적</Link>
            <Link href="/games/saves?gameSlug=myanimecraft">기존 저장 목록</Link>
          </div>
        </section>
      </div>
    </main>
  );
}
