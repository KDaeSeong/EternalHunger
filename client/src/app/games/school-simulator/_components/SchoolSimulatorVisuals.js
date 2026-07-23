import GameActionIcon from '../../_components/GameActionIcon';

export function SchoolSimulatorPanelTitle({ action, heading = 'h2', meta, style, title }) {
  const Heading = heading;

  return (
    <div className="games-panel-title school-panel-title" style={style}>
      <Heading>
        <GameActionIcon action={action} label={title} />
        {title}
      </Heading>
      {meta === undefined || meta === null ? null : <span>{meta}</span>}
    </div>
  );
}

export function SchoolSimulatorIconRow({ action, children, className = '', label = '', ...props }) {
  return (
    <article className={`game-save-row school-icon-row${className ? ` ${className}` : ''}`} {...props}>
      <GameActionIcon action={action} label={label} />
      {children}
    </article>
  );
}

export function SchoolSimulatorImpactStrip({ items = [] }) {
  if (!items.length) return null;
  return (
    <div className="school-impact-strip" role="status" aria-live="polite" aria-label="최근 학교 운영 변화량">
      {items.map((item) => (
        <div className={`school-impact-chip is-${item.tone || 'highlight'}`} key={`${item.label}-${item.value}`}>
          <GameActionIcon action={item.action} label={item.label} />
          <span>{item.label}</span>
          <strong>{item.value}</strong>
        </div>
      ))}
    </div>
  );
}
