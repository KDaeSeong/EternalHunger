'use client';

import Link from 'next/link';
import { formatNumber } from '../_lib/gameDetailHelpers';

export function GameMetric({ label, value }) {
  return (
    <div className="games-metric">
      <span>{label}</span>
      <strong>{formatNumber(value)}</strong>
    </div>
  );
}

export function ActivityPanel({ title, href, items, empty, renderItem, linkLabel = '전체 보기' }) {
  return (
    <section className="games-panel">
      <div className="games-panel-title">
        <h2>{title}</h2>
        <Link href={href}>{linkLabel}</Link>
      </div>
      {items.length ? <div className="games-activity-list">{items.map(renderItem)}</div> : <div className="games-empty">{empty}</div>}
    </section>
  );
}
