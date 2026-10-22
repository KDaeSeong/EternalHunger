import { GameControlButton } from '../../_components/GamePlayPrimitives';

export default function PrimitiveArchiveFocusPanel({ plan, onNavigate }) {
  if (!plan) return null;
  const { objective, night, blocked } = plan;
  const dangerRows = night.rows.filter((row) => Number(row.damage) > 0);
  return (
    <section className="primitive-focus-panel" aria-label="현재 목표와 밤 대비">
      <article className="primitive-focus-objective">
        <span className="primitive-focus-eyebrow">지금 목표</span>
        <div className="primitive-focus-title-row">
          <h2>{objective.title}</h2>
          {objective.targetTab ? (
            <GameControlButton action="target" disabled={blocked} onClick={() => onNavigate?.(objective.targetTab)}>
              {objective.actionLabel}
            </GameControlButton>
          ) : null}
        </div>
        <p>{objective.detail}</p>
      </article>
      <article className="primitive-focus-night" data-tone={night.tone}>
        <span className="primitive-focus-eyebrow">이번 밤</span>
        <h2>{night.title}</h2>
        {dangerRows.length ? (
          <ul>
            {dangerRows.map((row) => (
              <li key={row.id}>
                <strong>{row.name} · HP {row.currentHp} → {row.hp}</strong>
                <span>추위 {row.coldDamage} · 허기 {row.hungerDamage} · 저체온 {row.hypothermiaDamage}</span>
              </li>
            ))}
          </ul>
        ) : null}
        <p>{night.detail}</p>
      </article>
    </section>
  );
}
