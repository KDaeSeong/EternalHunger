import GameActionIcon from '../../_components/GameActionIcon';

export function BaSrpgPanelTitle({ action, heading = 'h2', meta, title }) {
  const Heading = heading;

  return (
    <div className="games-panel-title ba-srpg-panel-title">
      <Heading>
        <GameActionIcon action={action} label={title} />
        {title}
      </Heading>
      {meta === undefined || meta === null ? null : <span>{meta}</span>}
    </div>
  );
}

export function BaSrpgIconRow({ action, children, className = '', label = '', style }) {
  return (
    <article className={`game-save-row srpg-icon-row${className ? ` ${className}` : ''}`} style={style}>
      <GameActionIcon action={action} label={label} />
      {children}
    </article>
  );
}
