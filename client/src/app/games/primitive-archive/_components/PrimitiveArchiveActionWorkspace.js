import { ActionButton, RecentActionResult } from '../../_components/GamePlayPrimitives';
import { formatRequires } from '../_lib/primitiveArchiveEngine';
import PrimitiveArchiveTurnHorizon from './PrimitiveArchiveTurnHorizon';
import { PrimitiveArchivePanelTitle } from './PrimitiveArchiveVisuals';

function actingCondition(actor) {
  if (!actor || Number(actor.hp || 0) <= 0) return { label: '행동 불가', tone: 'danger' };
  if (Number(actor.bodyTemp ?? 37) < 34.5) return { label: '저체온 위험', tone: 'danger' };
  if (Number(actor.hunger || 0) >= 75) return { label: '식사 필요', tone: 'warning' };
  if (Number(actor.stamina || 0) < 25) return { label: '휴식 권장', tone: 'warning' };
  if (Number(actor.hp || 0) < 45) return { label: '회복 권장', tone: 'warning' };
  return { label: '행동 가능', tone: 'ready' };
}

export default function PrimitiveArchiveActionWorkspace(props) {
  const {
    actionFeedback,
    actionForecasts,
    actor,
    actorId,
    canAct,
    craftChance,
    exploration,
    gatherChance,
    huntChance,
    milestones,
    recipe,
    recipeId,
    recipeRows,
    recentActionText,
    research,
    runCraft,
    runEat,
    runGather,
    runHunt,
    runResearch,
    runRest,
    runSpecialized,
    selectRegion,
    selectedRegion,
    setActorId,
    setRecipeId,
    regions,
    specializedActions,
    state,
    zone,
    zoneId,
    zoneSelectionUnlocked,
  } = props;
  const condition = actingCondition(actor);
  const actorCanAct = canAct && Number(actor?.hp || 0) > 0;
  const recipeMaterialsReady = Boolean(recipe?.materialsReady);
  const specializedRows = specializedActions || [];
  const lockedSpecializedText = specializedRows
    .filter((row) => !row.available)
    .map((row) => `${row.label}: ${row.lockedReason}`).join(' \u00B7 ');

  return (
    <div className="primitive-workspace-panel" role="tabpanel">
      <section className="games-panel games-action-dock primitive-action-workspace">
        <PrimitiveArchivePanelTitle action="primitive-day" title="빠른 행동" meta={`AP ${state.ap}/${state.apMax}`} />
        <div className="primitive-acting-status" data-tone={condition.tone}>
          <label>
            <span>행동 캐릭터</span>
            <select value={actorId} onChange={(event) => setActorId(event.target.value)}>
              {state.party.map((member) => (
                <option value={member.id} key={member.id}>{member.name} · {member.role}</option>
              ))}
            </select>
          </label>
          <div className="primitive-acting-status__summary">
            <strong>{actor?.name || '대원'}</strong>
            <span>{condition.label}</span>
          </div>
          <div className="primitive-acting-vitals" aria-label={`${actor?.name || '대원'} 현재 상태`}>
            <span>HP <strong>{Math.round(Number(actor?.hp || 0))}</strong></span>
            <span>허기 <strong>{Math.round(Number(actor?.hunger || 0))}</strong></span>
            <span>ST <strong>{Math.round(Number(actor?.stamina || 0))}</strong></span>
            <span>체온 <strong>{Number(actor?.bodyTemp ?? 37).toFixed(1)}도</strong></span>
          </div>
        </div>
        <div className="games-action-dock__controls">
          <label className="game-save-json-field">
            <span>지역</span>
            <select
              value={zoneSelectionUnlocked ? selectedRegion?.id || zoneId : 'random'}
              disabled={!zoneSelectionUnlocked}
              onChange={(event) => selectRegion(event.target.value)}
            >
              {!zoneSelectionUnlocked ? <option value="random">미지의 구역 · 행동 시 무작위</option> : null}
              {(regions || []).filter((row) => row.revealed && !row.safe).map((row) => (
                <option value={row.id} key={row.id}>{row.name} · {row.dangerLabel}</option>
              ))}
            </select>
            <small>{zoneSelectionUnlocked ? '지도 제작 완료 · 구역 지정 가능' : '지도 제작 연구 후 구역 지정 가능'}</small>
          </label>
          <label className="game-save-json-field">
            <span>제작</span>
            <select value={recipeId} onChange={(event) => setRecipeId(event.target.value)}>
              {(recipeRows || []).map((row) => (
                <option value={row.id} key={row.id}>
                  {!row.unlocked ? `${row.name} · 잠김` : row.materialsReady ? row.name : `${row.name} · 재료 부족`}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="games-action-dock__notes">
          <span>
            {zoneSelectionUnlocked
              ? `${selectedRegion?.landmark || zone.note} · ${selectedRegion?.yieldHint || zone.note}`
              : `발견 지역 ${exploration?.revealed || 0}곳 중 무작위 행동`}
          </span>
          <span>
            {recipe?.unlocked
              ? `${recipe.materialText || formatRequires(recipe.requires)} · ${recipeMaterialsReady ? '제작 가능' : '재료 부족'} · ${recipe.note}${recipe.prototype ? ` · ${recipe.statusLabel}` : ''}`
              : `제작 잠김 · ${recipe?.lockedReason || '연구 조건 확인'}`}
          </span>
        </div>
        <div className="games-action-dock__buttons">
          <ActionButton action="gather" cue="off" disabled={!actorCanAct} onClick={runGather}>채집 · {Math.round(gatherChance * 100)}%</ActionButton>
          <ActionButton action="combat" cue="off" disabled={!actorCanAct} onClick={runHunt}>사냥 · {Math.round(huntChance * 100)}%</ActionButton>
          <ActionButton
            action="craft"
            cue="off"
            disabled={!actorCanAct || !recipe?.unlocked || !recipeMaterialsReady}
            title={!recipe?.unlocked ? recipe?.lockedReason : !recipeMaterialsReady ? `재료 부족: ${recipe?.materialText || ''}` : '선택한 제작 실행'}
            onClick={runCraft}
          >제작 · {Math.round(craftChance * 100)}%</ActionButton>
          <ActionButton action="consume" cue="off" disabled={!actorCanAct} onClick={runEat}>식사</ActionButton>
          <ActionButton action="rest" cue="off" disabled={!actorCanAct} onClick={runRest}>휴식</ActionButton>
          <ActionButton action="research" cue="off" disabled={!actorCanAct || !research.actionUnlocked || !research.selected?.available} onClick={runResearch}>
            {research.actionUnlocked ? '연구' : '직접 연구 잠김'}
          </ActionButton>
        </div>
        <div className="primitive-specialized-actions">
          <div className="primitive-specialized-actions__header">
            <strong>{'\uAE30\uC220 \uD574\uAE08 \uC0DD\uC5C5'}</strong>
            <span>{specializedRows.filter((row) => row.available).length}/{specializedRows.length} {'\uD574\uAE08'}</span>
          </div>
          <div className="primitive-specialized-actions__buttons">
            {specializedRows.map((row) => (
              <ActionButton
                action={row.icon}
                cue="off"
                disabled={!actorCanAct || !row.available}
                key={row.id}
                onClick={() => runSpecialized(row.id)}
                title={`${row.technologyName} \u00B7 ${row.context} \u00B7 ${row.outcome}`}
              >
                {row.label} \u00B7 {row.available ? `${row.chancePct}%` : '\uC7A0\uAE40'}
              </ActionButton>
            ))}
          </div>
          <small>{lockedSpecializedText || '\uBAA8\uB4E0 \uD2B9\uD654 \uC0DD\uC5C5\uC774 \uD65C\uC131\uD654\uB410\uC2B5\uB2C8\uB2E4.'}</small>
        </div>
        <RecentActionResult
          action={actionFeedback?.action || 'survival'}
          label={actionFeedback?.label || '이번 행동 결과'}
          text={recentActionText}
          tone={actionFeedback?.tone || 'ready'}
          pinned
        />
        <details className="primitive-action-forecast-details">
          <summary>행동별 기대수익 {actionForecasts?.length || 0}개 보기</summary>
          <div className="primitive-action-forecast-grid" aria-label="행동별 기대수익">
            {(actionForecasts || []).map((forecast) => (
              <article className={`primitive-action-forecast${forecast.locked ? ' is-locked' : ''}`} key={forecast.id}>
                <div>
                  <strong>{forecast.label}</strong>
                  <span>{forecast.chancePct}%</span>
                </div>
                <small>{forecast.context}</small>
                <p>{forecast.outcome}</p>
                <em>{forecast.cost}</em>
              </article>
            ))}
          </div>
        </details>
      </section>
      <PrimitiveArchiveTurnHorizon milestones={milestones} />
    </div>
  );
}
