import GameActionIcon from '../../_components/GameActionIcon';
import { PrimitiveArchivePanelTitle } from './PrimitiveArchiveVisuals';

export default function PrimitiveArchiveTurnHorizon({ milestones }) {
  return (
    <section className="games-panel primitive-turn-horizon primitive-turn-horizon--compact">
      <PrimitiveArchivePanelTitle
        action="primitive-day"
        title="한 턴만 더"
        meta={`${milestones?.season?.year || 1}년차 · ${milestones?.eraLabel || '원시'} 시대`}
      >
        <strong>Day {milestones?.season?.cycleDay || 1}</strong>
      </PrimitiveArchivePanelTitle>
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
