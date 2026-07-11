import GameActionIcon from '../../_components/GameActionIcon';

export default function PrimitiveArchiveTurnHorizon({ milestones }) {
  return (
    <section className="games-panel primitive-turn-horizon">
      <div className="games-panel-title">
        <div>
          <h2>한 턴만 더</h2>
          <span>{milestones?.season?.year || 1}년차 · {milestones?.eraLabel || '원시'} 시대</span>
        </div>
        <strong>Day {milestones?.season?.cycleDay || 1}</strong>
      </div>
      <div className="primitive-turn-horizon__rows">
        {(milestones?.rows || []).map((row) => (
          <article key={row.id}>
            <GameActionIcon action={row.action} label={row.label} />
            <div>
              <span>{row.label}</span>
              <strong>{row.value}</strong>
              <small>{row.detail}</small>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
