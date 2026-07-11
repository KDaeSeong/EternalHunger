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
        <span>{pulse.promptLabel}</span>
        <span>{pulse.chainLabel}</span>
      </aside>
    </section>
  );
}
