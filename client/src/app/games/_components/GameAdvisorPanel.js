'use client';

import { useId, useMemo, useSyncExternalStore } from 'react';

const ADVISOR_STORAGE_EVENT = 'eh-game-advisor-storage';

function rowText(row, key, fallback = '') {
  if (row && typeof row === 'object') return String(row[key] || fallback).trim();
  return String(row || fallback).trim();
}

function storageSafeKey(title, badge, storageKey) {
  const explicit = String(storageKey || '').trim();
  if (explicit) return explicit;
  return `eh_game_advisor:${String(title || '').trim()}:${String(badge || '').trim()}`.slice(0, 160);
}

function subscribeAdvisorStorage(callback) {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener('storage', callback);
  window.addEventListener(ADVISOR_STORAGE_EVENT, callback);
  return () => {
    window.removeEventListener('storage', callback);
    window.removeEventListener(ADVISOR_STORAGE_EVENT, callback);
  };
}

function readExpandedSnapshot(persistKey, defaultExpanded) {
  if (!persistKey || typeof window === 'undefined') return defaultExpanded ? '1' : '0';
  const saved = window.localStorage.getItem(persistKey);
  if (saved === '1' || saved === '0') return saved;
  return defaultExpanded ? '1' : '0';
}

function deriveTutorialSteps(adviceLines, focusRows) {
  const adviceSteps = adviceLines
    .slice(0, 3)
    .map((line) => ({
      title: rowText(line, 'title', rowText(line, 'kind', '다음 행동')),
      detail: rowText(line, 'detail', rowText(line, 'kind', '현재 추천을 기준으로 한 번 실행해 보세요.')),
    }))
    .filter((line) => line.title || line.detail);

  if (adviceSteps.length) return adviceSteps;

  return focusRows
    .slice(0, 3)
    .map((row) => ({
      title: rowText(row, 'label', '확인 지표'),
      detail: rowText(row, 'value', '현재 값을 보고 다음 행동을 고르세요.'),
    }))
    .filter((line) => line.title || line.detail);
}

export default function GameAdvisorPanel({
  title = '플레이 가이드',
  badge = '',
  primaryTitle = '',
  primaryText = '',
  focusRows = [],
  adviceLines = [],
  tutorialSteps = [],
  policyRows = [],
  storageKey = '',
  tone = 'info',
  compact = false,
  minimal = false,
  defaultExpanded = false,
  emptyText = '현재 표시할 안내가 없습니다.',
}) {
  const titleId = useId();
  const visibleFocusRows = focusRows.filter(Boolean);
  const visibleAdviceLines = adviceLines.filter(Boolean);
  const visiblePolicyRows = policyRows.filter(Boolean);
  const visibleTutorialSteps = useMemo(() => {
    const explicit = tutorialSteps.filter(Boolean);
    return explicit.length ? explicit : deriveTutorialSteps(visibleAdviceLines, visibleFocusRows);
  }, [tutorialSteps, visibleAdviceLines, visibleFocusRows]);
  const persistKey = storageSafeKey(title, badge, storageKey);
  const expandedSnapshot = useSyncExternalStore(
    subscribeAdvisorStorage,
    () => readExpandedSnapshot(persistKey, defaultExpanded),
    () => (defaultExpanded ? '1' : '0')
  );
  const expanded = expandedSnapshot === '1';

  const toggleExpanded = () => {
    if (!persistKey || typeof window === 'undefined') return;
    window.localStorage.setItem(persistKey, expanded ? '0' : '1');
    window.dispatchEvent(new Event(ADVISOR_STORAGE_EVENT));
  };

  if (
    !primaryTitle &&
    !primaryText &&
    !visibleFocusRows.length &&
    !visibleAdviceLines.length &&
    !visiblePolicyRows.length &&
    !visibleTutorialSteps.length
  ) {
    return null;
  }

  const hasDetails = compact
    ? Boolean(primaryTitle || primaryText || visibleFocusRows.length || visibleAdviceLines.length || visiblePolicyRows.length || visibleTutorialSteps.length)
    : visiblePolicyRows.length > 0 || visibleTutorialSteps.length > 0;
  const showMainContent = !compact || expanded;

  return (
    <section className={`games-panel game-advisor-panel game-advisor-panel--${tone}${compact ? ' game-advisor-panel--compact' : ''}${minimal ? ' game-advisor-panel--minimal' : ''}${expanded ? ' is-expanded' : ''}`} aria-labelledby={titleId}>
      <div className="games-panel-title">
        <h2 id={titleId}>{title}</h2>
        <div className="game-advisor-title-actions">
          {badge ? <span>{badge}</span> : null}
          {hasDetails ? (
            <button
              type="button"
              className="game-advisor-toggle"
              aria-expanded={expanded}
              onClick={toggleExpanded}
            >
              {expanded ? '간략히' : '자세히'}
            </button>
          ) : null}
        </div>
      </div>

      {compact && !expanded ? (
        <div className="game-advisor-compact-summary">
          {primaryTitle ? <strong>{primaryTitle}</strong> : null}
          {primaryText ? <span>{primaryText}</span> : null}
        </div>
      ) : null}

      {showMainContent && (primaryTitle || primaryText) ? (
        <section className={`tcg-event-callout game-advisor-callout is-${tone}`}>
          {primaryTitle ? <strong>{primaryTitle}</strong> : null}
          {primaryText ? <p>{primaryText}</p> : null}
        </section>
      ) : null}

      {showMainContent && visibleFocusRows.length ? (
        <div className="games-rank-split game-advisor-focus-grid">
          {visibleFocusRows.map((row) => (
            <div key={row.label}>
              <span>{row.label}</span>
              <strong>{row.value}</strong>
            </div>
          ))}
        </div>
      ) : null}

      {showMainContent && visibleAdviceLines.length ? (
        <div className="game-save-list game-advisor-list">
          {visibleAdviceLines.map((line) => (
            <article className="game-save-row" key={line.title || line}>
              <div>
                {line.kind ? <span>{line.kind}</span> : null}
                <strong>{line.title || line}</strong>
                {line.detail ? <small>{line.detail}</small> : null}
              </div>
            </article>
          ))}
        </div>
      ) : showMainContent ? (
        <div className="games-empty game-advisor-empty">{emptyText}</div>
      ) : null}

      {hasDetails && expanded ? (
        <div className="game-advisor-details">
          {visibleTutorialSteps.length ? (
            <section className="game-advisor-detail-group">
              <strong>진행 순서</strong>
              <ol>
                {visibleTutorialSteps.map((step, index) => (
                  <li key={`${rowText(step, 'title', 'step')}-${index}`}>
                    <span>{rowText(step, 'title', `Step ${index + 1}`)}</span>
                    {rowText(step, 'detail') ? <small>{rowText(step, 'detail')}</small> : null}
                  </li>
                ))}
              </ol>
            </section>
          ) : null}

          {visiblePolicyRows.length ? (
            <section className="game-advisor-detail-group">
              <strong>표시 정책</strong>
              <div className="game-advisor-policy-grid">
                {visiblePolicyRows.map((row) => (
                  <div key={row.label || row.title}>
                    <span>{row.label || row.title}</span>
                    <b>{row.value}</b>
                    {row.detail ? <small>{row.detail}</small> : null}
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
