import GameActionIcon from '../../_components/GameActionIcon';

export function BaVanguardPanelTitle({ action, children, meta, title }) {
  return (
    <div className="games-panel-title ba-vanguard-panel-title">
      <h2>
        <GameActionIcon action={action} label={title} />
        {title}
      </h2>
      {children || <span>{meta}</span>}
    </div>
  );
}

export function BaVanguardIconRow({ action, children, className = '', style }) {
  return (
    <article className={`game-save-row game-save-row--icon ba-vanguard-icon-row${className ? ` ${className}` : ''}`} style={style}>
      <GameActionIcon action={action} />
      {children}
    </article>
  );
}
