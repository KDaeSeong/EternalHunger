import GameActionIcon from '../../_components/GameActionIcon';

export default function DualAcademyTcgDuelPulse({ pulse }) {
  return (
    <section className={`tcg-duel-pulse is-${pulse.tone}`} aria-live="polite">
      <GameActionIcon action={pulse.action} label={pulse.label} />
      <div>
        <span>{pulse.label}</span>
        <strong>{pulse.detail}</strong>
        <small>{pulse.meta}</small>
      </div>
      <aside aria-label="듀얼 처리 상태">
        <span>
          <GameActionIcon action={pulse.promptAction} label={pulse.promptLabel} />
          {pulse.promptLabel}
        </span>
        <span>
          <GameActionIcon action={pulse.chainAction} label={pulse.chainLabel} />
          {pulse.chainLabel}
        </span>
        {(pulse.impacts || []).map((item) => (
          <span className={`tcg-duel-pulse__impact is-${item.tone}`} key={`${item.label}-${item.value}`}>
            <GameActionIcon action={item.action} label={item.label} />
            <b>{item.label}</b>
            <strong>{item.value}</strong>
          </span>
        ))}
      </aside>
    </section>
  );
}
