import GameActionIcon from '../../_components/GameActionIcon';
import { ActionButton, GameControlButton, SmallStat } from '../../_components/GamePlayPrimitives';
import { baSrpgFeedbackPresentation } from '../_lib/baSrpgFeedback';
import {
  GRID,
  actorStatusText,
  attackSelectedAction,
  buyItemAction,
  cellContent,
  craftRecipeAction,
  executeSkillAction,
  itemName,
  refreshShopAction,
  selectEnemyAction,
} from '../_lib/baSrpgEngine';

function BoardCell({ content, selected, target, onClick }) {
  const statusText = content.actor ? actorStatusText(content.actor) : '';
  const zoneText = content.zone?.type === 'Smoke' ? `연막 ${content.zone.duration}라운드` : '';
  const coverText = content.type === 'cover' ? `엄폐 내구도 ${content.coverHp}/${content.coverMaxHp}` : '';
  const label = content.actor
    ? `${content.actor.name}${statusText ? ` · ${statusText}` : ''}${zoneText ? ` · ${zoneText}` : ''}`
    : [coverText, zoneText, content.destroyedCover ? '파괴된 엄폐' : '', content.type === 'obstacle' ? '장애물' : ''].filter(Boolean).join(' · ');
  return (
    <button
      type="button"
      className={`srpg-cell is-${content.type}${selected ? ' is-selected' : ''}${target ? ' is-target' : ''}${content.zone ? ' is-smoke-zone' : ''}${content.actor?.overwatch ? ' is-overwatch' : ''}${content.destroyedCover ? ' is-destroyed-cover' : ''}`}
      data-game-sfx={content.actor ? 'select' : 'click'}
      disabled={content.type === 'obstacle'}
      onClick={onClick}
      title={label}
    >
      {content.actor ? (
        <>
          <strong>{content.actor.name.slice(0, 2)}</strong>
          <span>{content.actor.hp}/{content.actor.maxHp}{content.actor.shield?.amount ? `+${content.actor.shield.amount}` : ''}</span>
        </>
      ) : (
        <>
          <strong>{content.type === 'cover' ? '엄폐' : content.type === 'smoke' ? '연막' : content.type === 'obstacle' ? '장애' : content.destroyedCover ? '파괴' : ''}</strong>
          <span>{content.type === 'cover' ? `${content.coverHp}/${content.coverMaxHp}` : content.type === 'smoke' ? `${content.zone.duration}R` : content.type === 'obstacle' ? '×' : ''}</span>
        </>
      )}
    </button>
  );
}

function expectedAttackDamage(attack) {
  const value = Number(attack?.expectedHpDamage ?? attack?.hpDamage ?? 0);
  return Number.isFinite(value) ? value : 0;
}

export default function BaSrpgBattleTab(props) {
  const {
    battle,
    battleForecast,
    battleMissionOverlay,
    battlePresentation,
    handleCellClick,
    mission,
    recipeId,
    recipes,
    selectedRecipe,
    setSkillId,
    setRecipeId,
    setState,
    shop,
    state,
    town,
  } = props;
  const battleSignal = baSrpgFeedbackPresentation(state);

  return (
    <>
      <section className="games-panel">
        <div className="games-panel-title">
          <h2>전장</h2>
          <span>{battle.lastResult || mission.caution}</span>
        </div>
        <div className={`srpg-battle-signal is-${battleSignal.tone}`} role="status" aria-live="polite">
          <GameActionIcon action={battleSignal.action} label={battleSignal.label} />
          <span>
            <strong>{battleSignal.label}</strong>
            <small>{battleSignal.detail}</small>
          </span>
          <em>{battle.phase === 'player' ? `턴 ${battle.turn}` : battle.phase === 'cleared' ? '완료' : '실패'}</em>
        </div>
        <div className="srpg-board" style={{ '--srpg-cols': GRID.width }}>
          {Array.from({ length: GRID.height }).flatMap((_, y) => (
            Array.from({ length: GRID.width }).map((__, x) => {
              const content = cellContent(state, x, y);
              const selected = content.actor?.id && content.actor.id === battle.selectedUnitId;
              const target = content.actor?.id && content.actor.id === battle.targetEnemyId;
              return (
                <BoardCell
                  key={`${x}-${y}`}
                  content={content}
                  selected={selected}
                  target={target}
                  onClick={() => handleCellClick(x, y)}
                />
              );
            })
          ))}
        </div>
      </section>

      <section className="games-panel">
        <div className="games-panel-title">
          <h2>미션 오버레이</h2>
          <span>{battleMissionOverlay.headline}</span>
        </div>
        <div className="games-empty" style={{ textAlign: 'left', marginBottom: 12 }}>
          <strong>{battleMissionOverlay.objective}</strong>
          <br />
          {battleMissionOverlay.caution}
        </div>
        <div className="games-rank-split" style={{ marginBottom: 12 }}>
          <SmallStat label="전력차" value={`${battleMissionOverlay.powerGap >= 0 ? '+' : ''}${battleMissionOverlay.powerGap}`} />
          <SmallStat label="승산" value={`${battleMissionOverlay.successPct}%`} />
          <SmallStat label="턴 조건" value={`${battleMissionOverlay.turn}/${battleMissionOverlay.targetTurn}`} />
          <SmallStat label="적 생존" value={`${battleMissionOverlay.aliveEnemyCount}/${battleMissionOverlay.enemyCount}`} />
          <SmallStat label="엄폐/장애물" value={`${battleMissionOverlay.coverCount}/${battleMissionOverlay.obstacleCount}`} />
          <SmallStat label="보상" value={battleMissionOverlay.rewardText} />
        </div>
        <div className="game-save-list">
          {battleMissionOverlay.starRows.map((row) => (
            <article className="game-save-row" key={row.id}>
              <div>
                <span>{row.done ? '달성' : '진행 중'}</span>
                <strong>{row.label}</strong>
                <small>{row.value}</small>
              </div>
              <strong>{row.done ? 'OK' : '-'}</strong>
            </article>
          ))}
          {battleMissionOverlay.recommendations.map((line, index) => (
            <article className="game-save-row" key={`${line}-${index}`}>
              <div>
                <span>작전 추천 {index + 1}</span>
                <strong>{line}</strong>
              </div>
            </article>
          ))}
          {battleMissionOverlay.threatRows.map((row) => (
            <article className="game-save-row" key={row.id}>
              <div>
                <span>우선 표적 · 사거리 {row.range} · 공격 {row.atk}</span>
                <strong>{row.name}</strong>
                <small>HP {row.hp}. 장거리/고화력 적은 전투판에서 먼저 위치를 확인하세요.</small>
              </div>
              <strong>{row.range >= 4 ? '원거리' : '접근'}</strong>
            </article>
          ))}
        </div>
      </section>

      <section className="games-dashboard">
        <section className="games-panel">
          <div className="games-panel-title">
            <h2>전투 연출</h2>
            <span>{battlePresentation.headline}</span>
          </div>
          <div className="games-empty" style={{ textAlign: 'left', marginBottom: 12 }}>
            <strong>{battlePresentation.latestCue.title}</strong> · {battlePresentation.latestCue.detail}
          </div>
          <div className="games-rank-split" style={{ marginBottom: 12 }}>
            <SmallStat label="완성도" value={`${battlePresentation.completionPct}%`} />
            <SmallStat label="컷인 톤" value={battlePresentation.cutInTone} />
            <SmallStat label="감사 항목" value={`${battlePresentation.presentationRows.length}개`} />
            <SmallStat label="통과" value={`${battlePresentation.presentationRows.filter((row) => row.ready).length}개`} />
          </div>
          <div className="game-save-list">
            {battlePresentation.presentationRows.map((row) => (
              <article className="game-save-row" key={row.id}>
                <div>
                  <span>{row.ready ? '연결됨' : '점검 필요'} · {row.value}</span>
                  <strong>{row.label}</strong>
                  <small>{row.detail}</small>
                </div>
                <strong>{row.ready ? 'OK' : '확인'}</strong>
              </article>
            ))}
          </div>
        </section>

        <section className="games-panel">
          <div className="games-panel-title">
            <h2>전투 예측</h2>
            <span>{battleForecast.headline}</span>
          </div>
          <div className="games-rank-split" style={{ marginBottom: 12 }}>
            <SmallStat label="위협" value={battleForecast.threatLevel} />
            <SmallStat label="예상 피해" value={battleForecast.incomingTotal} />
            <SmallStat label="고위험" value={`${battleForecast.highThreatCount}명`} />
            <SmallStat label="노출" value={`${battleForecast.exposedUnits}명`} />
            <SmallStat label="선택 유닛" value={battleForecast.selectedUnitName || '-'} />
            <SmallStat
              label="최선 공격"
              value={battleForecast.bestAttack
                ? `${battleForecast.bestAttack.enemyName} ${expectedAttackDamage(battleForecast.bestAttack)}`
                : '-'}
            />
          </div>
          <div className="game-save-list">
            {battleForecast.recommendations.map((line, index) => (
              <article className="game-save-row" key={`${line}-${index}`}>
                <div>
                  <span>권장 {index + 1}</span>
                  <strong>{line}</strong>
                </div>
              </article>
            ))}
          </div>
        </section>

        {battleForecast.statusRows?.length ? (
          <section className="games-panel srpg-status-panel">
            <div className="games-panel-title">
              <h2>전술 효과 예고</h2>
              <span>{battleForecast.statusSummary}</span>
            </div>
            <div className="game-save-list">
              {battleForecast.statusRows.map((row) => (
                <article className="game-save-row" key={row.id}>
                  <div>
                    <span>{row.sideLabel} · {row.actorName}</span>
                    <strong>{row.label}</strong>
                    <small>{row.detail}</small>
                  </div>
                  <strong>{row.value}</strong>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        <section className="games-panel">
          <div className="games-panel-title">
            <h2>전술 HUD</h2>
            <span>{battleForecast.bestAction?.badge || '대기'}</span>
          </div>
          <div className="games-rank-split" style={{ marginBottom: 12 }}>
            <SmallStat label="최우선" value={battleForecast.bestAction?.label || '-'} />
            <SmallStat label="점수" value={battleForecast.bestAction?.score ?? 0} />
            <SmallStat label="스킬 후보" value={`${battleForecast.skillPreviews?.length || 0}개`} />
            <SmallStat label="실행 가능" value={`${(battleForecast.actionRows || []).filter((action) => action.enabled).length}개`} />
          </div>
          <div className="game-save-list">
            {(battleForecast.actionRows || []).map((action) => (
              <article className="game-save-row" key={action.id}>
                <div>
                  <span>{action.badge} · 점수 {action.score}</span>
                  <strong>{action.title}</strong>
                  <small>{action.detail}</small>
                </div>
                <ActionButton
                  action={action.type === 'attack' ? 'combat' : action.action || 'skill'}
                  disabled={!action.enabled}
                  onClick={() => {
                    if (action.type === 'attack') {
                      setState((current) => attackSelectedAction(selectEnemyAction(current, action.targetId), action.targetId));
                      return;
                    }
                    if (action.type === 'skill') {
                      setSkillId(action.skillId);
                      setState((current) => (
                        action.targetType === 'enemy'
                          ? executeSkillAction(selectEnemyAction(current, action.targetId), action.skillId)
                          : executeSkillAction(current, action.skillId)
                      ));
                    }
                  }}
                >
                  실행
                </ActionButton>
              </article>
            ))}
          </div>
        </section>

        <section className="games-panel">
          <div className="games-panel-title">
            <h2>적 턴 예상</h2>
            <span>{battleForecast.enemyPlans.length}개 행동</span>
          </div>
          <div className="game-save-list">
            {battleForecast.enemyPlans.slice(0, 6).map((plan) => (
              <article className="game-save-row" key={plan.enemyId}>
                <div>
                  <span>{plan.rule} · {plan.moveText} · {plan.priority === 'high' ? '위험' : plan.priority === 'low' ? '낮음' : '주의'}</span>
                  <strong>{plan.enemyName} → {plan.targetName}</strong>
                  <small>{plan.detail}</small>
                  {plan.hpDamage ? (
                    <small>피해 {plan.hpDamage} · 기대 {plan.expectedHpDamage} · 명중 {plan.hitChancePct}%{plan.lethal ? ' · 격파 위험' : ''}</small>
                  ) : null}
                </div>
                <strong>{plan.lethal ? '위험' : plan.expectedHpDamage || '-'}</strong>
              </article>
            ))}
          </div>
        </section>

        <section className="games-panel">
          <div className="games-panel-title">
            <h2>아군 위험도</h2>
            <span>{battleForecast.unitThreats[0]?.riskLabel || '안정'}</span>
          </div>
          <div className="game-save-list">
            {battleForecast.unitThreats.map((unit) => (
              <article className="game-save-row" key={unit.unitId}>
                <div>
                  <span>{unit.riskLabel} · 예상 피해 {unit.incomingExpected} · 피격 후 {unit.hpRatioAfter}%</span>
                  <strong>{unit.unitName}</strong>
                  <small>공격 예정: {unit.attackersText}{unit.inCover ? ' · 엄폐 중' : ' · 노출'}</small>
                </div>
                <strong>{unit.lethal ? '격파' : unit.riskScore}</strong>
              </article>
            ))}
          </div>
        </section>

        <section className="games-panel">
          <div className="games-panel-title">
            <h2>공격 후보</h2>
            <span>{battleForecast.selectedUnitName || '선택 없음'}</span>
          </div>
          <div className="game-save-list">
            {battleForecast.selectedAttacks.slice(0, 5).map((attack) => (
              <article className="game-save-row" key={attack.enemyId}>
                <div>
                  <span>{attack.inRange ? '사거리 안' : '사거리 밖'} · 거리 {attack.distance} · {attack.coverText}</span>
                  <strong>{attack.enemyName}</strong>
                  <small>피해 {attack.hpDamage} · 기대 {attack.expectedHpDamage} · 명중 {attack.hitChancePct}%{attack.lethal ? ' · 마무리 가능' : ''}</small>
                </div>
                <strong>{attack.lethal ? '킬각' : attack.inRange ? attack.expectedHpDamage : '-'}</strong>
              </article>
            ))}
          </div>
        </section>

        <section className="games-panel">
          <div className="games-panel-title">
            <h2>학생</h2>
            <span>{battle.units.filter((unit) => unit.hp > 0).length}/{battle.units.length}</span>
          </div>
          <div className="game-save-list">
            {battle.units.map((unit) => (
              <article className="game-save-row" key={unit.id}>
                <div>
                  <span>{unit.role} · AP {unit.ap}{actorStatusText(unit) ? ` · ${actorStatusText(unit)}` : ''}</span>
                  <strong>{unit.name}</strong>
                </div>
                <strong>{unit.hp}/{unit.maxHp}</strong>
              </article>
            ))}
          </div>
        </section>

        <section className="games-panel">
          <div className="games-panel-title">
            <h2>적</h2>
            <span>{battle.enemies.filter((enemy) => enemy.hp > 0).length}/{battle.enemies.length}</span>
          </div>
          <div className="game-save-list">
            {battle.enemies.map((enemy) => (
              <article className="game-save-row" key={enemy.id}>
                <div>
                  <span>사거리 {enemy.range} · 이동 {enemy.move}{actorStatusText(enemy) ? ` · ${actorStatusText(enemy)}` : ''}</span>
                  <strong>{enemy.name}</strong>
                </div>
                <strong>{enemy.hp}/{enemy.maxHp}</strong>
              </article>
            ))}
          </div>
        </section>

        <section className="games-panel">
          <div className="games-panel-title">
            <h2>제작 / 상점</h2>
            <span>{state.guildRep} Rep</span>
          </div>
          <label className="game-save-json-field">
            <span>제작</span>
            <select value={recipeId} onChange={(event) => setRecipeId(event.target.value)}>
              {recipes.map((recipe) => <option value={recipe.id} key={recipe.id}>{recipe.name}</option>)}
            </select>
          </label>
          <p style={{ color: '#64717d', fontWeight: 800, lineHeight: 1.55 }}>
            필요: {selectedRecipe.inputs.map((input) => `${itemName(input.itemId)} ${input.qty}`).join(', ')} · {selectedRecipe.costCredit} Cr
            {selectedRecipe.baseCostCredit !== selectedRecipe.costCredit ? ` (기본 ${selectedRecipe.baseCostCredit})` : ''}
          </p>
          <div style={{ display: 'grid', gap: 8 }}>
            <ActionButton action="craft" onClick={() => setState((current) => craftRecipeAction(current, recipeId))}>제작</ActionButton>
          </div>
          <div className="games-rank-split" style={{ marginTop: 10 }}>
            <SmallStat label="상점 갱신" value={`${town.shopRefreshCount}회`} />
            <SmallStat label="유료 갱신" value={`${town.shopPaidRefreshCount}회`} />
            <SmallStat label="무료" value={`${town.shopFreeRefreshLeft}/1`} />
            <SmallStat label="갱신 비용" value={`${town.shopRefreshCost} Cr`} />
          </div>
          <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
            <ActionButton action="shop" disabled={!town.shopFreeRefreshAvailable} onClick={() => setState((current) => refreshShopAction(current, true))}>
              무료 상점 갱신
            </ActionButton>
            <ActionButton action="shop" disabled={Number(state.credit || 0) < Number(town.shopRefreshCost || 0)} onClick={() => setState((current) => refreshShopAction(current, false))}>
              유료 상점 갱신
            </ActionButton>
          </div>
          <div className="games-chip-row" style={{ marginTop: 10 }}>
            {shop.map((item) => (
              <GameControlButton
                action="shop"
                className="srpg-shop-chip"
                key={item.itemId}
                unwrapped
                disabled={(item.stock != null && Number(item.stock || 0) <= 0) || Number(state.credit || 0) < Number(item.price || 0)}
                title={item.stock == null ? '재고 무제한' : `재고 ${item.stock}`}
                onClick={() => setState((current) => buyItemAction(current, item.itemId))}
              >
                <span>{item.name} {item.price}Cr{item.basePrice !== item.price ? `/${item.basePrice}` : ''}</span>
                <small>재고 {item.stock == null ? '∞' : item.stock}</small>
              </GameControlButton>
            ))}
          </div>
        </section>
      </section>
    </>
  );
}
