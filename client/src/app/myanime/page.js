'use client';

import Link from 'next/link';
import SiteHeader from '../../components/SiteHeader';
import {
  findGameBySlug,
  gameDetailHref,
  getGamePortingProgress,
} from '../games/_lib/gameCatalog';

const MYANIME_GAME_SLUGS = [
  'myanimecraft',
  'dual-academy-tcg',
  'ba-vanguard',
  'schale-idle-rpg',
  'school-simulator',
  'tonkatsu-teacher',
  'si-coding-sim',
  'rail3d-sim',
  'company-report',
  'racing-logos-demo',
  'primitive-archive',
];

function GameMetric({ label, value }) {
  return (
    <div className="games-metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function PrototypeCard({ game }) {
  const progress = getGamePortingProgress(game);
  const integration = game.integration || {};
  return (
    <article className="games-card">
      <div className="games-card-main">
        <div>
          <span>{game.subtitle}</span>
          <h2>{game.title}</h2>
          <p>{game.summary || game.detail}</p>
        </div>
        <div className="games-card-metrics">
          <GameMetric label="이식" value={progress.label} />
          <GameMetric label="단계" value={integration.stageLabel || '후보'} />
        </div>
        <div className="games-card-actions">
          <Link href={game.primaryHref}>플레이</Link>
          <Link href={gameDetailHref(game)}>상세</Link>
          <Link href={game.boardHref}>게시판</Link>
        </div>
      </div>
    </article>
  );
}

export default function MyAnimeHubPage() {
  const games = MYANIME_GAME_SLUGS.map(findGameBySlug).filter(Boolean);
  const playableCount = games.filter((game) => !String(game.primaryHref || '').startsWith('/board')).length;

  return (
    <main className="games-page-shell">
      <SiteHeader />
      <section className="games-page">
        <section className="games-hero">
          <div>
            <p className="games-kicker">MyAnime</p>
            <h1>마이애니메 게임 허브</h1>
            <p>업로드된 myanime 프로토타입을 한 곳에서 고르고, 플레이 화면과 상세 이식 현황으로 이동합니다.</p>
          </div>
          <div className="games-hero-actions">
            <Link href="/games">게임 허브</Link>
            <Link href="/games/records">게임 기록</Link>
            <Link href="/board?category=game">게임 게시판</Link>
          </div>
        </section>

        <section className="games-summary" aria-label="마이애니메 허브 요약">
          <GameMetric label="등록 게임" value={games.length} />
          <GameMetric label="플레이 가능" value={playableCount} />
          <GameMetric label="저장/전적 연동" value={games.filter((game) => game.integration?.supportsRecords).length} />
          <GameMetric label="게임방 후보" value={games.filter((game) => game.integration?.supportsRooms).length} />
        </section>

        <section className="games-grid" aria-label="마이애니메 게임 목록">
          {games.map((game) => <PrototypeCard game={game} key={game.slug} />)}
        </section>
      </section>
    </main>
  );
}
