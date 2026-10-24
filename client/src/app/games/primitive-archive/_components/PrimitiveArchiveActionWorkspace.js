import { ActionButton, RecentActionResult } from '../../_components/GamePlayPrimitives';
import { formatRequires, itemName } from '../_lib/primitiveArchiveEngine';
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
    autoDayControl,
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
    runProgressReport,
    runCraft,
    runEat,
    runGather,
    runHunt,
    runResearch,
    runRecoveryChoice,
    runRest,
    runSpecialized,
    runUtility,
    selectRegion,
    selectedRegion,
    setActorId,
    setRecipeId,
    regions,
    specializedActions,
    utilityActions,
    state,
    zone,
    zoneId,
    zoneSelectionUnlocked,
  } = props;
  const condition = actingCondition(actor);
  const actorCanAct = canAct && Number(actor?.hp || 0) > 0;
  const recipeMaterialsReady = Boolean(recipe?.materialsReady);
  const rationChoice = runProgressReport?.recoveryChoices?.find((choice) => choice.id === 'ration_break');
  const forecastById = Object.fromEntries((actionForecasts || []).map((row) => [row.id, row]));
  const specializedRows = specializedActions || [];
  const utilityRows = utilityActions || [];
  const lockedSpecializedRows = specializedRows.filter((row) => !row.available);
  const lockedSpecializedText = [
    ...lockedSpecializedRows.slice(0, 4).map((row) => `${row.label}: ${row.lockedReason}`),
    lockedSpecializedRows.length > 4 ? `외 ${lockedSpecializedRows.length - 4}개` : '',
  ].filter(Boolean).join(' \u00B7 ');
  const lockedUtilityRows = utilityRows.filter((row) => !row.available);
  const lockedUtilityText = [
    ...lockedUtilityRows.slice(0, 4).map((row) => `${row.label}: ${row.lockedReason}`),
    lockedUtilityRows.length > 4 ? `외 ${lockedUtilityRows.length - 4}개` : '',
  ].filter(Boolean).join(' · ');
  const inventoryChange = actionFeedback?.inventoryChange;
  const inventoryRows = inventoryChange?.rows || [];
  const visibleInventoryRows = inventoryRows.slice(0, 5);
  const hiddenInventoryRows = inventoryRows.slice(5);
  const renderInventoryRow = (row) => {
    const delta = Number(row.delta || 0);
    const sign = delta > 0 ? '+' : '';
    const tone = delta > 0 ? 'positive' : delta < 0 ? 'negative' : 'unchanged';
    return (
      <li className={`primitive-inventory-change__row is-${tone}`} key={row.id}>
        <span>{itemName(row.id)}</span>
        <strong>{sign}{delta} <span className="primitive-inventory-change__comparison">({row.before} → {row.after})</span></strong>
      </li>
    );
  };

  return (
    <div className="primitive-workspace-panel" role="tabpanel">
      <section className="games-panel games-action-dock primitive-action-workspace">
        <PrimitiveArchivePanelTitle action="primitive-day" title="빠른 행동" meta={`AP ${state.ap}/${state.apMax}`}>
          {autoDayControl || null}
        </PrimitiveArchivePanelTitle>
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
        <div className="primitive-action-result">
          <RecentActionResult
            action={actionFeedback?.action || 'survival'}
            label={actionFeedback?.label || '이번 행동 결과'}
            text={recentActionText}
            tone={actionFeedback?.tone || 'ready'}
            pinned
          />
          {inventoryChange ? (
            <section className="primitive-inventory-change" aria-label="보유 자원 변화">
              <div className="primitive-inventory-change__heading">
                <strong>보유 자원 변화</strong>
                {inventoryChange.dayChanged ? <span className="primitive-inventory-change__day-note">하루 경과·정산 포함</span> : null}
              </div>
              {inventoryRows.length ? (
                <>
                  <ul className="primitive-inventory-change__list">{visibleInventoryRows.map(renderInventoryRow)}</ul>
                  {hiddenInventoryRows.length ? (
                    <details className="primitive-inventory-change__more">
                      <summary>나머지 {hiddenInventoryRows.length}개 변화 보기</summary>
                      <ul className="primitive-inventory-change__list">{hiddenInventoryRows.map(renderInventoryRow)}</ul>
                    </details>
                  ) : null}
                </>
              ) : <p className="primitive-inventory-change__empty">변동 없음</p>}
            </section>
          ) : null}
        </div>
        <div className="primitive-basic-action-grid" aria-label="기본 행동 선택">
          <article className="primitive-action-choice">
            <ActionButton action="gather" cue="off" disabled={!actorCanAct} onClick={runGather}>채집 · {Math.round(gatherChance * 100)}%</ActionButton>
            <small className="primitive-action-choice__hint">{forecastById.gather?.outcome || '주변 자원을 확보합니다.'} · {forecastById.gather?.cost || 'AP 1'}</small>
          </article>
          <article className="primitive-action-choice">
            <ActionButton action="combat" cue="off" disabled={!actorCanAct} onClick={runHunt}>사냥 · {Math.round(huntChance * 100)}%</ActionButton>
            <small className="primitive-action-choice__hint">{forecastById.hunt?.outcome || '식량을 노리며 실패 시 피해를 입을 수 있습니다.'} · {forecastById.hunt?.cost || 'AP 1'}</small>
          </article>
          <article className="primitive-action-choice">
            <ActionButton action="consume" cue="off" disabled={!actorCanAct || forecastById.consume?.locked} onClick={runEat}>개인 식사</ActionButton>
            <small className="primitive-action-choice__hint">{forecastById.consume?.outcome || '허기와 체력을 회복합니다.'} · {forecastById.consume?.cost || '음식 1개 · AP 1'}</small>
          </article>
          <article className="primitive-action-choice">
            <ActionButton
              action="consume"
              cue="off"
              disabled={!actorCanAct || !rationChoice?.enabled}
              title={`위독하거나 허기진 대원부터 식량을 나눕니다. ${rationChoice?.costText || '식량 필요'} · 1 AP`}
              onClick={() => runRecoveryChoice('ration_break')}
            >공동 식사 · 1 AP</ActionButton>
            <small className="primitive-action-choice__hint">{rationChoice?.costText || '식량 필요'} · 대원별 허기에 따라 배식</small>
          </article>
          <article className="primitive-action-choice">
            <ActionButton action="rest" cue="off" disabled={!actorCanAct} onClick={runRest}>휴식</ActionButton>
            <small className="primitive-action-choice__hint">{forecastById.rest?.outcome || '체력과 기력을 회복합니다.'} · {forecastById.rest?.cost || 'AP 1'}</small>
          </article>
          {recipe?.unlocked ? (
            <article className="primitive-action-choice">
              <ActionButton
                action="craft"
                cue="off"
                disabled={!actorCanAct || !recipeMaterialsReady}
                title={!recipeMaterialsReady ? `재료 부족: ${recipe?.materialText || ''}` : '선택한 제작 실행'}
                onClick={runCraft}
              >제작 · {Math.round(craftChance * 100)}%</ActionButton>
              <small className="primitive-action-choice__hint">{forecastById.craft?.outcome || recipe?.materialText || '선택한 도구를 제작합니다.'} · {forecastById.craft?.cost || 'AP 1 · 재료 필요'}</small>
            </article>
          ) : null}
          {research.actionUnlocked ? (
            <article className="primitive-action-choice">
              <ActionButton action="research" cue="off" disabled={!actorCanAct || !research.selected?.available} onClick={runResearch}>
                연구
              </ActionButton>
              <small className="primitive-action-choice__hint">{forecastById.research?.outcome || research.selected?.name || '연구 목표를 선택하세요.'} · {forecastById.research?.cost || '일일 자동 연구 진행'}</small>
            </article>
          ) : null}
        </div>
        <details className="primitive-action-settings">
          <summary>지역·제작 설정 <span>{selectedRegion?.name || zone?.name || '무작위 지역'} · {recipe?.name || '제작 선택'}</span></summary>
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
              <small>{zoneSelectionUnlocked ? '지도 제작 완료 · 구역 지정 가능' : `지도 제작 연구 후 지정 가능 · 발견 ${exploration?.revealed || 0}곳`}</small>
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
              <small>{recipe?.unlocked
                ? `${recipe.materialText || formatRequires(recipe.requires)} · ${recipeMaterialsReady ? '제작 가능' : '재료 부족'} · ${recipe.note}${recipe.prototype ? ` · ${recipe.statusLabel}` : ''}`
                : `제작 잠김 · ${recipe?.lockedReason || '연구 조건 확인'}`}</small>
            </label>
          </div>
          <div className="games-action-dock__notes">
            <span>{zoneSelectionUnlocked
              ? `${selectedRegion?.landmark || zone.note} · ${selectedRegion?.yieldHint || zone.note}`
              : `발견 지역 ${exploration?.revealed || 0}곳 중 무작위 행동`}</span>
            {!research.actionUnlocked ? (
              <span>직접 연구 잠김 · {research.actionReason || forecastById.research?.outcome || '발전 화면에서 선행 조건을 확인하세요.'}</span>
            ) : null}
          </div>
        </details>
        <details className="primitive-specialized-actions">
          <summary className="primitive-specialized-actions__header">
            <strong>{'\uAE30\uC220 \uD574\uAE08 \uC0DD\uC5C5'}</strong>
            <span className="primitive-specialized-actions__meta">{specializedRows.filter((row) => row.available).length}/{specializedRows.length} {'\uD574\uAE08'}</span>
            <span className="primitive-specialized-actions__toggle" aria-hidden="true">
              <span className="primitive-specialized-actions__when-open">접기 ▴</span>
              <span className="primitive-specialized-actions__when-closed">펼치기 ▾</span>
            </span>
          </summary>
          <div className="primitive-specialized-actions__content">
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
                  {row.label} · {row.available ? `${row.chancePct}%` : '\uC7A0\uAE40'}
                </ActionButton>
              ))}
            </div>
            <small>{lockedSpecializedText || '\uBAA8\uB4E0 \uD2B9\uD654 \uC0DD\uC5C5\uC774 \uD65C\uC131\uD654\uB410\uC2B5\uB2C8\uB2E4.'}</small>
          </div>
        </details>
        <details className="primitive-specialized-actions primitive-utility-actions">
          <summary className="primitive-specialized-actions__header">
            <strong>기술 해금 운영</strong>
            <span className="primitive-specialized-actions__meta">{utilityRows.filter((row) => row.unlocked).length}/{utilityRows.length} 해금</span>
            <span className="primitive-specialized-actions__toggle" aria-hidden="true">
              <span className="primitive-specialized-actions__when-open">접기 ▴</span>
              <span className="primitive-specialized-actions__when-closed">펼치기 ▾</span>
            </span>
          </summary>
          <div className="primitive-specialized-actions__content">
            <div className="primitive-specialized-actions__buttons">
              {utilityRows.map((row) => (
                <ActionButton
                  action={row.icon}
                  cue="off"
                  disabled={!actorCanAct || !row.available}
                  key={row.id}
                  onClick={() => runUtility(row.id)}
                  title={`${row.technologyName} · ${row.context} · ${row.available ? row.outcome : row.lockedReason} · ${row.cost}`}
                >
                  {row.label} · {row.available ? '실행' : row.unlocked ? '대기' : '잠김'}
                </ActionButton>
              ))}
            </div>
            <small>남은 사용 횟수 · 경계 {Number(state.exploration?.patrolCharges || 0)}/2 · 훈련 {Number(state.exploration?.drillCharges || 0)}/3 · 계절 {Number(state.exploration?.seasonPlanCharges || 0)}/3 · 관개 {Number(state.exploration?.irrigationCharges || 0)}/3 · 도로 {Number(state.exploration?.roadCharges || 0)}/4 · 교역 {Number(state.diplomacy?.tradeRouteCharges || 0)}/3</small>
            <small>{lockedUtilityText || '모든 기술 해금 운영을 실행할 수 있습니다.'}</small>
          </div>
        </details>
        <details className="primitive-action-forecast-details">
          <summary>행동별 기대수익 {actionForecasts?.length || 0}개 보기</summary>
          <p>‘1회 평균’은 실패와 자원 출현 확률까지 반영한 예상 수확입니다. 실제 수확은 정수 개수이며, 매번 모든 자원을 받는다는 뜻은 아닙니다.</p>
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
      <details className="primitive-horizon-details">
        <summary>다음 날·발전 예고</summary>
        <PrimitiveArchiveTurnHorizon milestones={milestones} />
      </details>
    </div>
  );
}
