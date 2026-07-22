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
