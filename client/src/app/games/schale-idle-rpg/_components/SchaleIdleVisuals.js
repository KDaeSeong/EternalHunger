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
