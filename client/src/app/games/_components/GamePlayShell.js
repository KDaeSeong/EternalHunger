'use client';

import { useState } from 'react';
import SiteHeader from '../../../components/SiteHeader';
import GameActionIcon from './GameActionIcon';
import { useGameSfxEventHandlers } from '../_lib/useGameSfx';

const DEFAULT_METRIC_LIMITS = {
  micro: 6,
  compact: 7,
  dense: 8,
  normal: 7,
};

export function GameMetric({ label, value, density = '', variant = '' }) {
  const densityClass = density ? ` games-metric--${density}` : '';
  const variantClass = variant ? ` games-metric--${variant}` : '';
  return (
    <div className={`games-metric${densityClass}${variantClass}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export function GameFeatureTabs({ tabs = [], initialTabId = '', activeTabId: controlledActiveTabId, onTabChange }) {
  const visibleTabs = tabs.filter(Boolean);
  const fallbackId = visibleTabs[0]?.id || '';
  const [internalActiveTabId, setInternalActiveTabId] = useState(initialTabId || fallbackId);
  const activeTabId = controlledActiveTabId || internalActiveTabId;
  const activeTab = visibleTabs.find((tab) => tab.id === activeTabId) || visibleTabs[0];
  const tabListClassName = visibleTabs.length > 6
    ? 'game-feature-tabs__list game-feature-tabs__list--dense'
    : 'game-feature-tabs__list';
  const selectTab = (tabId) => {
    if (!controlledActiveTabId) setInternalActiveTabId(tabId);
    if (onTabChange) onTabChange(tabId);
  };

  if (!visibleTabs.length) return null;

  return (
    <section className="game-feature-tabs">
      <div className={tabListClassName} role="tablist" aria-label="게임 기능">
        {visibleTabs.map((tab) => {
          const selected = activeTab?.id === tab.id;
          const badgeTitle = typeof tab.badge === 'string' || typeof tab.badge === 'number'
            ? String(tab.badge)
            : '';
          const tabTitle = [tab.label, badgeTitle].filter(Boolean).join(' · ');
          return (
            <button
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`game-feature-panel-${tab.id}`}
              id={`game-feature-tab-${tab.id}`}
              className={selected ? 'is-active' : ''}
              key={tab.id}
              title={tabTitle}
              onClick={() => selectTab(tab.id)}
            >
              <GameActionIcon action={tab.icon || tab.id} label={tab.label} />
              <span className="game-feature-tabs__label">{tab.label}</span>
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
  primaryMetricLimit,
  heroLayout = 'default',
  children,
}) {
  const visibleMetrics = metrics.filter(Boolean);
  const visibleMessages = messages.filter(Boolean);
  const {
    handleGameSfxChangeCapture,
    handleGameSfxPointerDownCapture,
  } = useGameSfxEventHandlers();
  const metricLimit = primaryMetricLimit || DEFAULT_METRIC_LIMITS[summaryDensity] || DEFAULT_METRIC_LIMITS.normal;
  const primaryMetrics = visibleMetrics.slice(0, metricLimit);
  const secondaryMetrics = visibleMetrics.slice(metricLimit);
  const summaryClassName = summaryDensity === 'micro'
    ? 'games-summary games-summary--micro'
    : summaryDensity === 'dense'
    ? 'games-summary games-summary--dense'
    : summaryDensity === 'compact'
      ? 'games-summary games-summary--compact'
      : 'games-summary';

  return (
    <main
      className="games-page-shell"
      onChangeCapture={handleGameSfxChangeCapture}
      onPointerDownCapture={handleGameSfxPointerDownCapture}
    >
      <SiteHeader />
      <section className="games-page">
        <section className={heroLayout === 'stacked' ? 'games-hero games-hero--stacked' : 'games-hero'}>
          <div>
            {kicker ? <p className="games-kicker">{kicker}</p> : null}
            <h1>{title}</h1>
            {description ? <p>{description}</p> : null}
          </div>
          {actions ? <div className="games-hero-actions">{actions}</div> : null}
        </section>

        {visibleMetrics.length ? (
          <>
            <section className={summaryClassName} aria-label={summaryLabel || `${title} 요약`}>
              {primaryMetrics.map((metric) => (
                <GameMetric
                  key={metric.key || metric.label}
                  label={metric.label}
                  value={metric.value}
                  density={summaryDensity}
                />
              ))}
            </section>
            {secondaryMetrics.length ? (
              <details className="games-summary-overflow">
                <summary>세부 지표 {secondaryMetrics.length}개</summary>
                <div className="games-summary-overflow__grid">
                  {secondaryMetrics.map((metric) => (
                    <GameMetric
                      key={metric.key || metric.label}
                      label={metric.label}
                      value={metric.value}
                      density={summaryDensity}
                      variant="secondary"
                    />
                  ))}
                </div>
              </details>
            ) : null}
          </>
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
