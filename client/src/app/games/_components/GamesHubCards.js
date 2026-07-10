import Link from 'next/link';

import {
  findGameBySlug,
  gameDetailHref,
  getGameIntegration,
  getGamePortingChecklist,
  getGamePortingProgress,
} from '../_lib/gameCatalog';
import { formatNumber } from '../_lib/gamesHubUtils';
import GameIcon from './GameIcon';

export function GameMetric({ label, value }) {
  return (
    <div className="games-metric">
      <span>{label}</span>
      <strong>{formatNumber(value)}</strong>
    </div>
  );
}

export function GameCard({ slug, tone, title, subtitle, body, metrics, links, visual }) {
  return (
    <article className={`games-card is-${tone} ${visual ? 'has-visual' : ''}`}>
      {visual ? <div className="games-card-visual" aria-hidden="true" /> : null}
      <div className="games-card-main">
        <div className="games-card-title-row">
          <GameIcon slug={slug} label={`${title} icon`} tone={tone} />
          <div>
            <span>{subtitle}</span>
            <h2>{title}</h2>
            <p>{body}</p>
          </div>
        </div>
        <div className="games-card-metrics">
          {metrics.map((metric) => (
            <GameMetric key={metric.label} label={metric.label} value={metric.value} />
          ))}
        </div>
        <div className="games-card-actions">
          {links.map((link) => (
            <Link href={link.href} key={`${link.href}-${link.label}`}>{link.label}</Link>
          ))}
        </div>
      </div>
    </article>
  );
}

export function GameFamilyCard({ tone, kicker, title, body, href, stats, links }) {
  return (
    <article className={`games-family-card is-${tone}`}>
      <div>
        <span>{kicker}</span>
        <h3>{title}</h3>
        <p>{body}</p>
      </div>
      <div className="games-family-stats">
        {stats.map((stat) => (
          <div key={`${title}-${stat.label}`}>
            <span>{stat.label}</span>
            <strong>{stat.value}</strong>
          </div>
        ))}
      </div>
      <div className="games-family-actions">
        <Link href={href}>허브 열기</Link>
        {links.map((link) => (
          <Link href={link.href} key={`${title}-${link.href}`}>{link.label}</Link>
        ))}
      </div>
    </article>
  );
}

export function RoadmapCard({ item, index }) {
  const game = findGameBySlug(item.slug) || item;
  const integration = getGameIntegration(game);
  const checklist = getGamePortingChecklist(game);
  const progress = getGamePortingProgress(game);
  return (
    <article className="games-roadmap-card">
      <div className="games-roadmap-card__head">
        <GameIcon slug={item.slug} label={`${item.title} icon`} tone={game.tone || 'roadmap'} />
        <div>
          <p>{String(index + 1).padStart(2, '0')} · {item.subtitle}</p>
          <h3>{item.title}</h3>
        </div>
        <strong>{item.priority}</strong>
      </div>
      <p>{item.summary}</p>
      <dl>
        <div>
          <dt>범위</dt>
          <dd>{item.scope}</dd>
        </div>
        <div>
          <dt>다음 작업</dt>
          <dd>{item.nextStep}</dd>
        </div>
        <div>
          <dt>이식 상태</dt>
          <dd>{integration.stageLabel} · {integration.adapter} · {progress.percentLabel}</dd>
        </div>
      </dl>
      <div className="games-porting-strip" aria-label={`${item.title} 이식 체크리스트`}>
        {checklist.map((entry) => (
          <span className={entry.done ? 'is-done' : 'is-pending'} key={entry.key}>{entry.label}</span>
        ))}
      </div>
      <Link href={gameDetailHref(item)} className="games-roadmap-card__link">상세 보기</Link>
    </article>
  );
}

export function ActivityList({ title, href, items, empty, renderItem }) {
  return (
    <section className="games-panel">
      <div className="games-panel-title">
        <h2>{title}</h2>
        <Link href={href}>전체 보기</Link>
      </div>
      {items.length ? (
        <div className="games-activity-list">
          {items.map(renderItem)}
        </div>
      ) : (
        <div className="games-empty">{empty}</div>
      )}
    </section>
  );
}
