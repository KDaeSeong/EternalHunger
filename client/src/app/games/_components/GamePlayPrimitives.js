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

export function RecentActionResult({ action = '', label = '최근 결과', text, pinned = false, tone = '' }) {
  const className = [
    'games-action-result',
    pinned ? 'games-action-result--pinned' : '',
    action ? 'games-action-result--with-icon' : '',
    tone ? 'is-' + tone : '',
  ].filter(Boolean).join(' ');
  return (
    <div className={className} role="status" aria-live="polite">
      {action ? <GameActionIcon action={action} className="games-action-result__icon" label={label} /> : null}
      <span className="games-action-result__label">{label}</span>
      <strong className="games-action-result__text">{text}</strong>
    </div>
  );
}
