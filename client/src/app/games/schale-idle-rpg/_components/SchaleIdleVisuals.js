import GameActionIcon from '../../_components/GameActionIcon';

export function SchaleIdlePanelTitle({ action, children, meta, title }) {
  return (
    <div className="games-panel-title schale-idle-panel-title">
      <h2>
        <GameActionIcon action={action} label={title} />
        {title}
      </h2>
      {children || <span>{meta}</span>}
    </div>
  );
}

export function SchaleIdleIconRow({ action, children, className = '', style }) {
  return (
    <article className={`game-save-row game-save-row--icon schale-idle-icon-row${className ? ` ${className}` : ''}`} style={style}>
      <GameActionIcon action={action} />
      {children}
    </article>
  );
}

export function SchaleIdleImpactStrip({ items = [] }) {
  if (!items.length) return null;
  return (
    <div className="schale-idle-impact-strip" role="status" aria-live="polite" aria-label="최근 성장 변화량">
      {items.map((item) => (
        <div className={`schale-idle-impact-chip is-${item.tone || 'highlight'}`} key={`${item.label}-${item.value}`}>
          <GameActionIcon action={item.action} label={item.label} />
          <span>{item.label}</span>
          <strong>{item.value}</strong>
        </div>
      ))}
    </div>
  );
}
