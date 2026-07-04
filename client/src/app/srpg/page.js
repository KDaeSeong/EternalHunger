'use client';

import Link from 'next/link';
import SiteHeader from '../../components/SiteHeader';
import {
  findGameBySlug,
  gameDetailHref,
  getGamePortingProgress,
} from '../games/_lib/gameCatalog';

const SRPG_GAME_SLUGS = ['ba-srpg'];

function GameMetric({ label, value }) {
  return (
    <div className="games-metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function SrpgCard({ game }) {
  const progress = getGamePortingProgress(game);
  const integration = game.integration || {};
  return (
    <article className="games-card is-battle">
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
          <Link href={game.recordHref}>전적</Link>
        </div>
      </div>
    </article>
  );
}

export default function SrpgHubPage() {
  const games = SRPG_GAME_SLUGS.map(findGameBySlug).filter(Boolean);
  const primaryGame = games[0] || null;

  return (
    <main className="games-page-shell">
      <SiteHeader />
      <section className="games-page">
        <section className="games-hero">
          <div>
            <p className="games-kicker">SRPG</p>
            <h1>SRPG 허브</h1>
            <p>그리드 전투, 미션, 상점, 성장 루프를 별도 전술 게임 영역으로 분리합니다.</p>
          </div>
          <div className="games-hero-actions">
            {primaryGame ? <Link href={primaryGame.primaryHref}>바로 플레이</Link> : null}
            <Link href="/myanime">MyAnime 허브</Link>
            <Link href="/games">게임 허브</Link>
          </div>
        </section>

        <section className="games-summary" aria-label="SRPG 허브 요약">
          <GameMetric label="등록 게임" value={games.length} />
          <GameMetric label="플레이 가능" value={games.filter((game) => !String(game.primaryHref || '').startsWith('/board')).length} />
          <GameMetric label="상태 저장" value={games.filter((game) => game.integration?.supportsSaves).length} />
          <GameMetric label="전적 연동" value={games.filter((game) => game.integration?.supportsRecords).length} />
        </section>

        <section className="games-grid" aria-label="SRPG 게임 목록">
          {games.map((game) => <SrpgCard game={game} key={game.slug} />)}
        </section>
      </section>
    </main>
  );
}
