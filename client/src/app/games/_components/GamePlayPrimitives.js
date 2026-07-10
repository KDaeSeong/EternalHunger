import GameActionIcon, { gameActionText, resolveGameAction } from './GameActionIcon';

function ActionContent({ action, children, icon, unwrapped = false }) {
  if (!icon) return children;
  return (
    <>
      <GameActionIcon action={action} label={gameActionText(children)} />
      {unwrapped ? children : <span className="game-action-button__label">{children}</span>}
    </>
  );
}

export function ActionButton({ action, children, className = '', cue, disabled, icon = true, onClick, ...buttonProps }) {
  const label = gameActionText(children);
  const semantic = resolveGameAction(action, label);
  return (
    <button
      type="button"
      className={`tcg-primary-action game-action-button${className ? ` ${className}` : ''}`}
      data-game-sfx={cue || semantic.cue}
      disabled={disabled}
      onClick={onClick}
      {...buttonProps}
    >
      <ActionContent action={semantic.kind} icon={icon}>{children}</ActionContent>
    </button>
  );
}

export function GameControlButton({ action, children, className = '', cue, disabled, icon = true, onClick, unwrapped = false, ...buttonProps }) {
  const label = gameActionText(children);
  const semantic = resolveGameAction(action, label);
  return (
    <button
      type="button"
      className={`game-control-button${unwrapped ? ' game-control-button--unwrapped' : ''}${className ? ` ${className}` : ''}`}
      data-game-sfx={cue || semantic.cue}
      disabled={disabled}
      onClick={onClick}
      {...buttonProps}
    >
      <ActionContent action={semantic.kind} icon={icon} unwrapped={unwrapped}>{children}</ActionContent>
    </button>
  );
}

export function SmallStat({ label, value }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export function RecentActionResult({ label = '최근 결과', text, pinned = false }) {
  return (
    <div className={pinned ? 'games-action-result games-action-result--pinned' : 'games-action-result'}>
      <span>{label}</span>
      <strong>{text}</strong>
    </div>
  );
}
