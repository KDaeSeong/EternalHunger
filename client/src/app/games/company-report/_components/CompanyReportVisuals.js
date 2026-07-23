import GameActionIcon from '../../_components/GameActionIcon';

export function CompanyReportPanelTitle({ action, children, heading = 'h2', meta, title }) {
  const Heading = heading;
  const titleNode = (
    <Heading>
      <GameActionIcon action={action} label={title} />
      {title}
    </Heading>
  );
  const metaNode = meta === undefined || meta === null ? null : <span>{meta}</span>;

  if (children) {
    return (
      <div className="games-panel-title company-report-panel-title">
        <div className="company-report-panel-title__copy">
          {titleNode}
          {metaNode}
        </div>
        {children}
      </div>
    );
  }

  return (
    <div className="games-panel-title company-report-panel-title">
      {titleNode}
      {metaNode}
    </div>
  );
}

export function CompanyReportIconRow({ action, children, className = '', label = '', style }) {
  return (
    <article className={`game-save-row company-report-icon-row${className ? ` ${className}` : ''}`} style={style}>
      <GameActionIcon action={action} label={label} />
      {children}
    </article>
  );
}

export function CompanyReportImpactStrip({ items = [] }) {
  const rows = Array.isArray(items) ? items.filter(Boolean).slice(0, 3) : [];
  if (!rows.length) return null;
  return (
    <div className="company-report-impact-strip" aria-label="최근 처리 영향" role="status">
      {rows.map((item) => (
        <div className={`company-report-impact-chip is-${item.tone || 'ready'}`} key={item.key}>
          <GameActionIcon action={item.action || 'analysis'} label={item.label} />
          <span>{item.label}</span>
          <strong>{item.value}</strong>
        </div>
      ))}
    </div>
  );
}