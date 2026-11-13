import { GameControlButton } from '../../_components/GamePlayPrimitives';
import PrimitiveArchiveOperationsSummary from './PrimitiveArchiveOperationsSummary';
import PrimitiveArchiveAnnualOperations, { PrimitiveArchiveAnnualTransition } from './PrimitiveArchiveAnnualOperations';
import PrimitiveArchiveFoodOutlook from './PrimitiveArchiveFoodOutlook';
import { primitiveArchiveFoodOutlook } from '../_lib/primitiveArchiveFoodOutlook';

function CompletionProgress({ guide, onHelp, blocked, annualMode }) {
  if (!guide?.rows?.length || guide.status === 'ended') return null;
  const disabled = blocked || typeof onHelp !== 'function';
  return <div className="primitive-completion-guide" aria-label="기초 완주 준비">
    <div className="primitive-completion-guide__summary">
      <strong>기초 완주 {guide.rows.filter(row => row.done).length}/{guide.rows.length}</strong>
      <span>{guide.status === 'complete' ? '조건 충족 · 종료와 발전 계속 중 선택' : `남은 조건 ${guide.remaining.length}개`}</span>
    </div>
    <ul className="primitive-completion-guide__conditions">
      {guide.rows.map(row => <li key={row.id} data-complete={row.done ? 'true' : 'false'}>
        <span>{row.label}</span><strong>{row.current}/{row.target} · {row.done ? '충족' : row.current >= row.target ? '세부 조건 확인' : '준비 중'}</strong>
      </li>)}
    </ul>
    {annualMode && guide.objective ? <p>
      <strong>{guide.objective.title}</strong> · {guide.objective.detail}
      <GameControlButton action="target" disabled={disabled}
        onClick={() => onHelp?.({ scope: 'completion', kind: 'target', candidateKind: guide.objective.kind, id: guide.objective.id })}>{guide.objective.actionLabel}</GameControlButton>
    </p> : null}
    {guide.status === 'complete' ? <GameControlButton action="target" disabled={disabled}
      onClick={() => onHelp?.({ scope: 'completion', kind: 'target', candidateKind: 'complete' })}>완주 선택 확인</GameControlButton>
      : <details className="primitive-completion-guide__details">
        <summary>남은 완주 준비와 재료 확인</summary>
        {guide.candidates.map(candidate => <article key={`${candidate.kind}:${candidate.id}`}>
          <h3>{candidate.title}</h3><p>{candidate.detail}</p>
          <div className="primitive-completion-guide__links">
            <GameControlButton action="target" disabled={disabled}
              onClick={() => onHelp?.({ scope: 'completion', kind: 'target', candidateKind: candidate.kind, id: candidate.id })}>{candidate.actionLabel}</GameControlButton>
            {candidate.research.map(technology => <GameControlButton key={technology.technologyId} action="research" disabled={disabled}
              onClick={() => onHelp?.({ scope: 'completion', kind: 'research', technologyId: technology.technologyId })}>{technology.name} 조건 보기</GameControlButton>)}
          </div>
          {candidate.materials.map(material => <div key={material.resourceId}>
            <p>{material.name} {material.current}/{material.required} · {material.missing}개 부족</p>
            <div className="primitive-completion-guide__links">
              {material.sources.map(source => source.kind === 'community'
                ? <GameControlButton key={`community:${source.actionId}`} action="target" disabled={disabled}
                  title={`${source.actionLabel}의 생산 가능 자원입니다. ${(source.research || []).filter(row => !row.completed).map(row => row.name).join(' · ')}${(source.research || []).some(row => !row.completed) ? ' 연구를 마친 뒤 ' : ''}일손을 직접 배치하고 다음 1년 정산을 확인하세요. 현재 배치의 생산량을 보장하지는 않습니다.`}
                  onClick={() => onHelp?.({ scope: 'completion', kind: 'community', resourceId: material.resourceId, actionId: source.actionId })}>{source.actionLabel} · 공동체 생산 확인</GameControlButton>
                : <GameControlButton key={`${source.regionId}:${source.action}`} action="map" disabled={disabled}
                  title={`${source.actionLabel} · ${source.dangerLabel} · 획득 성공을 보장하지 않습니다.`}
                  onClick={() => onHelp?.({ scope: 'completion', kind: 'map', resourceId: material.resourceId, regionId: source.regionId })}>{source.regionName} · {source.actionLabel} 공급처 보기</GameControlButton>)}
              {material.crafting.map(recipe => <GameControlButton key={recipe.recipeId} action="craft" disabled={disabled}
                onClick={() => onHelp?.({ scope: 'completion', kind: 'recipe', recipeId: recipe.recipeId })}>{recipe.name} · {annualMode ? '공동체 가공 확인' : '제작법 확인'}</GameControlButton>)}
            </div>
            {!material.sources.length && !material.crafting.length ? <small>{annualMode
              ? '현재 확인된 공급처가 없습니다. 공동체 생산·가공과 발전 조건을 확인하세요.'
              : '현재 공개된 공급처가 없습니다. 탐사와 발전 조건을 확인하세요.'}</small> : null}
          </div>)}
        </article>)}
        {guide.remaining.some(row => row.id === 'survive') ? <p>생존일은 실제 운영으로 진행됩니다. 안내 확인만으로 시간이 지나지 않습니다.</p> : null}
      </details>}
  </div>;
}

export default function PrimitiveArchiveFocusPanel({ plan, operations, dayControl, onNavigate, annual, annualStartControl, annualYearControl,
  onCompletionHelp, completionHelpBlocked = false, inventoryRows, ready = true, ended = false }) {
  if (!plan) return null;
  const { objective, night, blocked, supplies } = plan;
  const completionObjective = (plan.completion?.candidates || []).some(candidate => candidate.kind === objective.kind && candidate.id === objective.id);
  const completionReady = plan.completion?.status === 'complete' && objective.targetTab === 'run';
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
        <CompletionProgress guide={plan.completion} onHelp={onCompletionHelp} blocked={blocked || completionHelpBlocked} annualMode />
      </article>
      <PrimitiveArchiveAnnualOperations annual={annual} yearControl={annualYearControl} onNavigate={onNavigate} blocked={blocked} />
    </section>
  );
  const foodOutlook = primitiveArchiveFoodOutlook({ supplies, inventoryRows, ready: ready && !blocked,
    ended, annualMode: Boolean(annual?.annualMode) });
  const dangerRows = night.rows.filter((row) => Number(row.damage) > 0);
  return (
    <section className="primitive-focus-panel" aria-label="현재 목표와 밤 대비">
      <article className="primitive-focus-objective">
        <span className="primitive-focus-eyebrow">지금 목표</span>
        <div className="primitive-focus-title-row">
          <h2>{objective.title}</h2>
          {objective.targetTab ? (
            <GameControlButton action="target" disabled={blocked || ((completionObjective || completionReady) && (completionHelpBlocked || typeof onCompletionHelp !== 'function'))}
              onClick={() => completionReady
                ? onCompletionHelp?.({ scope: 'completion', kind: 'target', candidateKind: 'complete' })
                : completionObjective
                ? onCompletionHelp?.({ scope: 'completion', kind: 'target', candidateKind: objective.kind, id: objective.id })
                : onNavigate?.(objective.targetTab)}>
              {objective.actionLabel}
            </GameControlButton>
          ) : null}
        </div>
        <p>{objective.detail}</p>
        <CompletionProgress guide={plan.completion} onHelp={onCompletionHelp} blocked={blocked || completionHelpBlocked} annualMode={false} />
        <PrimitiveArchiveAnnualTransition annual={annual} control={annualStartControl} />
      </article>
      <article className="primitive-focus-night" data-tone={night.tone}>
        <span className="primitive-focus-eyebrow">이번 밤</span>
        <h2>{night.title}</h2>
        {foodOutlook ? <PrimitiveArchiveFoodOutlook outlook={foodOutlook} /> : null}
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
