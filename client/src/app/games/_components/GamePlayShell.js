'use client';

import { useState } from 'react';
import SiteHeader from '../../../components/SiteHeader';

export function GameMetric({ label, value }) {
  return (
    <div className="games-metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export function GameFeatureTabs({ tabs = [], initialTabId = '' }) {
  const visibleTabs = tabs.filter(Boolean);
  const fallbackId = visibleTabs[0]?.id || '';
  const [activeTabId, setActiveTabId] = useState(initialTabId || fallbackId);
  const activeTab = visibleTabs.find((tab) => tab.id === activeTabId) || visibleTabs[0];

  if (!visibleTabs.length) return null;

  return (
    <section className="game-feature-tabs">
      <div className="game-feature-tabs__list" role="tablist" aria-label="게임 기능">
        {visibleTabs.map((tab) => {
          const selected = activeTab?.id === tab.id;
          return (
            <button
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`game-feature-panel-${tab.id}`}
              id={`game-feature-tab-${tab.id}`}
              className={selected ? 'is-active' : ''}
              key={tab.id}
              onClick={() => setActiveTabId(tab.id)}
            >
              <span>{tab.label}</span>
              {tab.badge ? <strong>{tab.badge}</strong> : null}
            </button>
          );
        })}
      </div>
      {activeTab ? (
        <div
          className="game-feature-tabs__panel"
          id={`game-feature-panel-${activeTab.id}`}
          role="tabpanel"
          aria-labelledby={`game-feature-tab-${activeTab.id}`}
        >
          {activeTab.children}
        </div>
      ) : null}
    </section>
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
  summaryDensity = 'normal',
  children,
}) {
  const visibleMetrics = metrics.filter(Boolean);
  const visibleMessages = messages.filter(Boolean);
  const summaryClassName = summaryDensity === 'compact' ? 'games-summary games-summary--compact' : 'games-summary';

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
          <section className={summaryClassName} aria-label={summaryLabel || `${title} 요약`}>
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
