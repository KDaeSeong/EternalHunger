export function ActionButton({ children, disabled, onClick }) {
  return (
    <button type="button" className="tcg-primary-action" disabled={disabled} onClick={onClick}>
      {children}
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
