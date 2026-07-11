import { ActionButton, RecentActionResult } from '../../_components/GamePlayPrimitives';
import { formatRequires } from '../_lib/primitiveArchiveEngine';
import PrimitiveArchiveTurnHorizon from './PrimitiveArchiveTurnHorizon';

export default function PrimitiveArchiveActionWorkspace(props) {
  const {
    actionFeedback,
    actionForecasts,
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
    selectRegion,
    selectedRegion,
    setRecipeId,
    regions,
    state,
    zone,
    zoneId,
    zoneSelectionUnlocked,
  } = props;

  return (
    <div className="primitive-workspace-panel" role="tabpanel">
      <section className="games-panel games-action-dock primitive-action-workspace">
        <div className="games-panel-title">
          <h2>빠른 행동</h2>
          <span>AP {state.ap}/{state.apMax}</span>
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
                <option value={row.id} key={row.id}>{row.unlocked ? row.name : `${row.name} · 잠김`}</option>
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
              ? `${formatRequires(recipe.requires)} · ${recipe.note}${recipe.prototype ? ` · ${recipe.statusLabel}` : ''}`
              : `제작 잠김 · ${recipe?.lockedReason || '연구 조건 확인'}`}
          </span>
        </div>
        <div className="games-action-dock__buttons">
          <ActionButton action="gather" cue="off" disabled={!canAct} onClick={runGather}>채집 · {Math.round(gatherChance * 100)}%</ActionButton>
          <ActionButton action="combat" cue="off" disabled={!canAct} onClick={runHunt}>사냥 · {Math.round(huntChance * 100)}%</ActionButton>
          <ActionButton action="craft" cue="off" disabled={!canAct || !recipe?.unlocked} onClick={runCraft}>제작 · {Math.round(craftChance * 100)}%</ActionButton>
          <ActionButton action="consume" cue="off" disabled={!canAct} onClick={runEat}>식사</ActionButton>
          <ActionButton action="rest" cue="off" disabled={!canAct} onClick={runRest}>휴식</ActionButton>
          <ActionButton action="research" disabled={!canAct || !research.actionUnlocked || !research.selected?.available} onClick={runResearch}>
            {research.actionUnlocked ? '연구' : '직접 연구 잠김'}
          </ActionButton>
        </div>
        <RecentActionResult
          action={actionFeedback?.action || 'survival'}
          label="이번 행동 결과"
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
