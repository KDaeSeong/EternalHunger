'use client';

import Link from 'next/link';
import { formatNumber } from '../_lib/gameDetailHelpers';

export function GameMetric({ label, value }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd className="ui-num">{value === null || value === undefined ? '—' : formatNumber(value)}</dd>
    </div>
  );
}

// renderItem returns a <Link> with a <strong> title and a <span> line.
export function ActivityPanel({ title, href, items, empty, renderItem, linkLabel = '전체 보기' }) {
  return (
    <section className="ui-panel">
      <div className="ui-panel__head">
        <h2>{title}</h2>
        <Link href={href}>{linkLabel}</Link>
      </div>
      {items.length ? (
        <ul className="ui-list gd-list">
          {items.map((item, index) => <li key={item?._id || item?.slug || index}>{renderItem(item)}</li>)}
        </ul>
      ) : (
        <p className="ui-empty">{empty}</p>
      )}
    </section>
  );
}
