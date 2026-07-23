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
export function BaVanguardImpactStrip({ items = [] }) {
  if (!items.length) return null;
  return (
    <div className="ba-vanguard-impact-strip" aria-label="최근 듀얼 수치 변화">
      {items.map((item) => (
        <span className={`ba-vanguard-impact-strip__item is-${item.tone || 'highlight'}`} key={`${item.label}-${item.value}`}>
          <GameActionIcon action={item.action} label={item.label} />
          <b>{item.label}</b>
          <strong>{item.value}</strong>
        </span>
      ))}
    </div>
  );
}

export function BaVanguardBattleForecast({ audit }) {
  if (!audit) return null;
  const totalDefense = Number(audit.baseDefense || 0) + Number(audit.guardShield || 0);
  const blocked = Boolean(audit.perfectGuard || audit.guardNeeded <= 0);
  const recoverable = blocked || audit.canGuard;
  const tone = blocked ? 'success' : recoverable ? 'warning' : 'danger';
  const action = blocked ? 'vanguard-blocked' : recoverable ? 'vanguard-guard-window' : 'vanguard-hit';
  const headline = audit.perfectGuard
    ? '완전 가드 적용'
    : blocked
      ? '현재 공격 차단'
      : recoverable
        ? `추가 실드 ${Number(audit.guardNeeded || 0).toLocaleString('ko-KR')} 필요`
        : `히트 위험 · 실드 ${Number(audit.guardNeeded || 0).toLocaleString('ko-KR')} 부족`;
  return (
    <div className={`ba-vanguard-battle-forecast is-${tone}`}>
      <GameActionIcon action={action} label={headline} />
      <div className="ba-vanguard-battle-forecast__summary">
        <strong>{headline}</strong>
        <span>{audit.defenderLabel} 방어 · 패 {audit.handCount}장 · 센티넬 {audit.sentinels}장</span>
      </div>
      <div className="ba-vanguard-battle-forecast__numbers">
        <span>공격 <b>{Number(audit.attackPower || 0).toLocaleString('ko-KR')}</b></span>
        <span>현재 방어 <b>{totalDefense.toLocaleString('ko-KR')}</b></span>
        <span>가용 실드 <b>{Number(audit.availableShield || 0).toLocaleString('ko-KR')}</b></span>
      </div>
    </div>
  );
}
