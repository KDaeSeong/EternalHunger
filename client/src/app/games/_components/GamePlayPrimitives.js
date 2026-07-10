import GameActionIcon, { gameActionText, resolveGameAction } from './GameActionIcon';

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
      {icon ? <GameActionIcon action={semantic.kind} label={label} /> : null}
      <span className="game-action-button__label">{children}</span>
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
