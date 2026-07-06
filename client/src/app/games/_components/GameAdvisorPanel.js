'use client';

export default function GameAdvisorPanel({
  title = '플레이 가이드',
  badge = '',
  primaryTitle = '',
  primaryText = '',
  focusRows = [],
  adviceLines = [],
  emptyText = '현재 표시할 안내가 없습니다.',
}) {
  const visibleFocusRows = focusRows.filter(Boolean);
  const visibleAdviceLines = adviceLines.filter(Boolean);

  if (!primaryTitle && !primaryText && !visibleFocusRows.length && !visibleAdviceLines.length) {
    return null;
  }

  return (
    <section className="games-panel">
      <div className="games-panel-title">
        <h2>{title}</h2>
        {badge ? <span>{badge}</span> : null}
      </div>

      {primaryTitle || primaryText ? (
        <section className="tcg-event-callout is-info">
          {primaryTitle ? <strong>{primaryTitle}</strong> : null}
          {primaryText ? <p>{primaryText}</p> : null}
        </section>
      ) : null}

      {visibleFocusRows.length ? (
        <div className="games-rank-split" style={{ marginTop: 14 }}>
          {visibleFocusRows.map((row) => (
            <div key={row.label}>
              <span>{row.label}</span>
              <strong>{row.value}</strong>
            </div>
          ))}
        </div>
      ) : null}

      {visibleAdviceLines.length ? (
        <div className="game-save-list" style={{ marginTop: 14 }}>
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
      ) : (
        <div className="games-empty" style={{ marginTop: 14 }}>{emptyText}</div>
      )}
    </section>
  );
}
