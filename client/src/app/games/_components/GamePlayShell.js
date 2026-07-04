'use client';

import SiteHeader from '../../../components/SiteHeader';

export function GameMetric({ label, value }) {
  return (
    <div className="games-metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export default function GamePlayShell({
  kicker,
  title,
  description,
  actions,
  metrics = [],
  messages = [],
  summaryLabel,
  children,
}) {
  const visibleMetrics = metrics.filter(Boolean);
  const visibleMessages = messages.filter(Boolean);

  return (
    <main className="games-page-shell">
      <SiteHeader />
      <section className="games-page">
        <section className="games-hero">
          <div>
            {kicker ? <p className="games-kicker">{kicker}</p> : null}
            <h1>{title}</h1>
            {description ? <p>{description}</p> : null}
          </div>
          {actions ? <div className="games-hero-actions">{actions}</div> : null}
        </section>

        {visibleMetrics.length ? (
          <section className="games-summary" aria-label={summaryLabel || `${title} 요약`}>
            {visibleMetrics.map((metric) => (
              <GameMetric key={metric.key || metric.label} label={metric.label} value={metric.value} />
            ))}
          </section>
        ) : null}

        {visibleMessages.map((item) => (
          <div className={item.tone === 'error' ? 'games-empty games-error' : 'games-empty'} key={item.key || item.text}>
            {item.text}
          </div>
        ))}

        {children}
      </section>
    </main>
  );
}
