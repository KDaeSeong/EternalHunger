import Link from 'next/link';

import { gameDetailHref } from '../_lib/gameCatalog';
import { gameDisplayTitle, gameTagline } from '../_lib/gameTaglines';
import GameIcon from './GameIcon';
import GameKeyArt, { gameKeyArtSrc } from './GameKeyArt';

// Where "플레이" goes. 스무고개 starts from its room list rather than the create form.
export function gamePlayHref(game) {
  if (game?.slug === 'twenty-questions') return '/twenty-questions';
  const href = String(game?.primaryHref || '');
  return href && !href.startsWith('/board') ? href : '';
}

function TileArt({ game, title, sizes }) {
  if (gameKeyArtSrc(game.slug)) {
    return <GameKeyArt slug={game.slug} title={title} className="game-tile__art" sizes={sizes} />;
  }
  return (
    <span className="game-tile__art game-tile__art--icon">
      <GameIcon slug={game.slug} tone={game.tone} />
    </span>
  );
}

// A game as key art, name and one line.
// With `withActions`, the tile shows 플레이 and 소개 buttons; otherwise the whole tile opens the game's page.
export function GameTile({ game, withActions = false, sizes = '(max-width: 720px) 50vw, 25vw' }) {
  const title = gameDisplayTitle(game);
  const detailHref = gameDetailHref(game);
  const playHref = gamePlayHref(game);

  if (!withActions) {
    return (
      <Link href={detailHref} className="game-tile">
        <TileArt game={game} title={title} sizes={sizes} />
        <span className="game-tile__body">
          <strong>{title}</strong>
          <span>{gameTagline(game)}</span>
        </span>
      </Link>
    );
  }

  return (
    <article className="game-tile">
      <Link href={detailHref} className="game-tile__link" tabIndex={-1} aria-hidden="true">
        <TileArt game={game} title={title} sizes={sizes} />
      </Link>
      <div className="game-tile__body">
        <h3><Link href={detailHref}>{title}</Link></h3>
        <span>{gameTagline(game)}</span>
      </div>
      <div className="game-tile__actions">
        {playHref ? <Link href={playHref} className="ui-button ui-button--primary ui-button--small">플레이</Link> : null}
        <Link href={detailHref} className="ui-button ui-button--quiet ui-button--small">소개</Link>
      </div>
    </article>
  );
}

export function ActivityPanel({ title, titleId, href, linkLabel = '전체 보기', items, empty, renderItem }) {
  return (
    <section className="ui-panel" aria-labelledby={titleId}>
      <div className="ui-panel__head">
        <h2 id={titleId}>{title}</h2>
        <Link href={href}>{linkLabel}</Link>
      </div>
      {items.length ? (
        <ul className="ui-list">
          {items.map(renderItem)}
        </ul>
      ) : (
        <p className="ui-empty">{empty}</p>
      )}
    </section>
  );
}
