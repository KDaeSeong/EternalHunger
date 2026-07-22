import GameActionIcon from '../../_components/GameActionIcon';

export function TonkatsuPanelTitle({ action, heading = 'h2', meta, title }) {
  const Heading = heading;

  return (
    <div className="games-panel-title tonkatsu-panel-title">
      <Heading>
        <GameActionIcon action={action} label={title} />
        {title}
      </Heading>
      {meta === undefined || meta === null ? null : <span>{meta}</span>}
    </div>
  );
}

export function TonkatsuIconRow({ action, children, className = '', label = '', style }) {
  return (
    <article className={`game-save-row tonkatsu-icon-row${className ? ` ${className}` : ''}`} style={style}>
      <GameActionIcon action={action} label={label} />
      {children}
    </article>
  );
}
