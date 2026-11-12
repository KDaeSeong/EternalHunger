import { GameControlButton } from '../../_components/GamePlayPrimitives';
import PrimitiveArchiveOperationsSummary from './PrimitiveArchiveOperationsSummary';
import PrimitiveArchiveAnnualOperations, { PrimitiveArchiveAnnualTransition } from './PrimitiveArchiveAnnualOperations';

export default function PrimitiveArchiveFocusPanel({ plan, operations, dayControl, onNavigate, annual, annualStartControl, annualYearControl }) {
  if (!plan) return null;
  const { objective, night, blocked, supplies } = plan;
  const annualLifetime = annual?.observedLifetimeYears === null ? '자동 생애 종료 없음'
    : `관찰 생애 ${annual?.observedLifetimeYears ?? 60}년`;
  if (annual?.annualMode) return (
    <section className="primitive-focus-panel" aria-label="현재 공동체 운영">
      <article className="primitive-focus-objective">
        <span className="primitive-focus-eyebrow">공동체 운영 · 1회는 1년</span>
        <h2>{blocked ? objective.title : annual.canAdvance ? `정착 ${annual.year}년 운영 준비` : '공동체 운영 종료'}</h2>
        <p>{blocked ? objective.detail : annual.canAdvance
          ? '생산 배치와 실제 비축, 공교육·시설·후계를 확인한 뒤 1년을 운영합니다. 개인의 허기나 밤 대비를 반복하지 않습니다.'
          : annual.advanceReason}</p>
        <p>{annual.lineageMode === 'legacy' ? '이전 런은 기존 생애 정책을 유지하며 새 후계·자연사를 추가하지 않습니다.' : `20년 활동 뒤 인계 안내 · 25년 활동 시 준비된 후계 인계 · ${annualLifetime}. 실제 나이를 뜻하지 않습니다.`}</p>
      </article>
      <PrimitiveArchiveAnnualOperations annual={annual} yearControl={annualYearControl} onNavigate={onNavigate} blocked={blocked} />
    </section>
  );
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
        <PrimitiveArchiveAnnualTransition annual={annual} control={annualStartControl} />
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
        {operations && !blocked ? (
          <PrimitiveArchiveOperationsSummary operations={operations} dayControl={dayControl} onNavigate={onNavigate} blocked={blocked} />
        ) : supplies ? (
          <small className="primitive-focus-supplies" aria-label="비축과 저녁 관리 안내">
            <strong>비축</strong> {supplies.reserveText}<br />
            <strong>저녁 관리</strong> {supplies.careText}
          </small>
        ) : null}
      </article>
    </section>
  );
}
