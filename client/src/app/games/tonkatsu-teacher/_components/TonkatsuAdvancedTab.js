import { ActionButton, GameControlButton, SmallStat } from '../../_components/GamePlayPrimitives';
import {
  INGREDIENTS,
  JUDGE_BATCH_MODE_LABELS,
  JUDGE_HISTORY_MODE_LABELS,
  TOURNAMENT_TIERS,
  battleAction,
  buyCosmeticAction,
  buyIngredientAction,
  clearJudgeHistoryAction,
  craftRecipeAction,
  enterTournamentAction,
  equipCosmeticAction,
  feedStudentAction,
  formatNeeds,
  fulfillDailyOrdersAction,
  ingredientName,
  inventoryCount,
  nextDayAction,
  recipeName,
  researchRecipeAction,
  runJudgeBatchAction,
  sellRecipeAction,
  setBusinessModeAction,
  startJudgeMatchAction,
  submitJudgePickAction,
  upgradeFacilityAction,
} from '../_lib/tonkatsuTeacherEngine';

export default function TonkatsuAdvancedTab(props) {
  const {
    canAct,
    cosmetics,
    equippedCosmetics,
    facilities,
    facilityContext,
    ingredient,
    ingredientId,
    inventoryRows,
    judge,
    judgeBatchCount,
    judgeBatchMode,
    judgeHistoryMode,
    judgeMatch,
    judgePick,
    judgeRecent,
    judgeText,
    judgeTierId,
    ownedCosmetics,
    recipe,
    recipeId,
    recipes,
    recipeStatus,
    recentAutoOnly,
    researches,
    setIngredientId,
    setJudgeBatchCount,
    setJudgeBatchMode,
    setJudgeHistoryMode,
    setJudgePick,
    setJudgeText,
    setJudgeTierId,
    setRecipeId,
    setRecentAutoOnly,
    setState,
    setStudentId,
    setTournamentTierId,
    state,
    student,
    studentId,
    tokenCount,
    tokenRows,
    tournament,
    tournamentTierId,
    winRatePreview,
  } = props;

  return (
    <>
              <>
      <section className="games-detail-grid">
        <section className="games-panel">
          <div className="games-panel-title">
            <h2>주방</h2>
            <span>제작비 {recipe.craftCost}G</span>
          </div>
          <label className="game-save-json-field">
            <span>레시피</span>
            <select value={recipeId} onChange={(event) => setRecipeId(event.target.value)}>
              {recipes.map((item) => (
                <option value={item.id} key={item.id} disabled={!item.unlocked}>
                  {item.unlocked ? item.name : `${item.name} · ${item.reason}`}
                </option>
              ))}
            </select>
          </label>
          <p style={{ color: '#cbd5e1', fontWeight: 800, lineHeight: 1.5 }}>
            필요: {formatNeeds(recipe.needs)}
          </p>
          <p style={{ color: '#94a3b8', fontWeight: 800, lineHeight: 1.5 }}>{recipe.note}</p>
          {!recipeStatus.unlocked ? <p style={{ color: '#fbbf24', fontWeight: 900, lineHeight: 1.5 }}>{recipeStatus.reason}</p> : null}
          <div className="games-rank-split">
            <SmallStat label="보유" value={tokenCount} />
            <SmallStat label="판매가" value={`${recipe.sellPrice}G`} />
            <SmallStat label="전투 보정" value={recipe.power} />
          </div>
          <div style={{ display: 'grid', gap: 8 }}>
            <ActionButton action="cook" disabled={!canAct || !recipeStatus.unlocked} onClick={() => setState((current) => craftRecipeAction(current, recipeId))}>메뉴 제작</ActionButton>
            <ActionButton action="sales" disabled={!canAct} onClick={() => setState((current) => sellRecipeAction(current, recipeId))}>영업 판매</ActionButton>
            <ActionButton action="serve" disabled={!canAct} onClick={() => setState((current) => feedStudentAction(current, studentId, recipeId))}>선택 학생에게 배식</ActionButton>
          </div>
        </section>

        <section className="games-panel">
          <div className="games-panel-title">
            <h2>재료 상점</h2>
            <span>재료 {inventoryCount(state)}</span>
          </div>
          <label className="game-save-json-field">
            <span>재료</span>
            <select value={ingredientId} onChange={(event) => setIngredientId(event.target.value)}>
              {INGREDIENTS.map((item) => <option value={item.id} key={item.id}>{item.name} · {item.price}G</option>)}
            </select>
          </label>
          <p style={{ color: '#cbd5e1', fontWeight: 800, lineHeight: 1.5 }}>
            {ingredient.name} · 희귀도 {ingredient.rarity} · #{ingredient.tags.join(' #')}
          </p>
          <div style={{ display: 'grid', gap: 8 }}>
            <ActionButton action="trade" disabled={!canAct} onClick={() => setState((current) => buyIngredientAction(current, ingredientId, 1))}>1개 구매</ActionButton>
            <ActionButton action="trade" disabled={!canAct} onClick={() => setState((current) => buyIngredientAction(current, ingredientId, 5))}>5개 구매</ActionButton>
            <ActionButton action="order" disabled={!canAct} onClick={() => setState((current) => fulfillDailyOrdersAction(current))}>일일 주문 처리</ActionButton>
          </div>
          <div className="games-rank-split" style={{ marginTop: 12 }}>
            <SmallStat label="보관 한도" value={`${inventoryCount(state)}/${facilityContext.storageCap}`} />
            <SmallStat label="주문량" value={facilityContext.dailyOrders} />
            <SmallStat label="영업 배율" value={`x${facilityContext.goldMultFromOrders.toFixed(2)}`} />
          </div>
          <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
            <ActionButton action="sales" disabled={!canAct || state.businessMode === 'hall'} onClick={() => setState((current) => setBusinessModeAction(current, 'hall'))}>홀 영업</ActionButton>
            <ActionButton action="sales" disabled={!canAct || state.businessMode === 'delivery'} onClick={() => setState((current) => setBusinessModeAction(current, 'delivery'))}>배달 영업</ActionButton>
          </div>
        </section>

        <section className="games-panel">
          <div className="games-panel-title">
            <h2>학생 지원</h2>
            <span>예상 승률 {winRatePreview}%</span>
          </div>
          <label className="game-save-json-field">
            <span>학생</span>
            <select value={studentId} onChange={(event) => setStudentId(event.target.value)}>
              {state.students.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}
            </select>
          </label>
          <div className="games-rank-split">
            <SmallStat label="역할" value={student.role} />
            <SmallStat label="HP" value={`${student.currentHp}/${student.hp}`} />
            <SmallStat label="사기" value={student.morale} />
          </div>
          <p style={{ color: '#cbd5e1', fontWeight: 800, lineHeight: 1.5 }}>
            선호 태그 #{student.pref} · 약점 태그 #{student.weak} · 현재 식사 {student.meal ? recipeName(student.meal) : '없음'}
          </p>
          <div style={{ display: 'grid', gap: 8 }}>
            <ActionButton action="combat" disabled={!canAct} onClick={() => setState((current) => battleAction(current, studentId))}>전투 진행</ActionButton>
            <ActionButton action="advance" disabled={!canAct} onClick={() => setState((current) => nextDayAction(current))}>다음 영업일</ActionButton>
          </div>
        </section>
      </section>

      <section className="games-dashboard">
        <section className="games-panel">
          <div className="games-panel-title">
            <h2>인벤토리</h2>
            <span>{inventoryRows.length}종</span>
          </div>
          {inventoryRows.length ? (
            <div className="game-save-list">
              {inventoryRows.map(([id, qty]) => (
                <article className="game-save-row" key={id}>
                  <div>
                    <span>재료</span>
                    <strong>{ingredientName(id)}</strong>
                  </div>
                  <strong>{Number(qty || 0).toLocaleString('ko-KR')}</strong>
                </article>
              ))}
            </div>
          ) : <div className="games-empty">보유 재료가 없습니다.</div>}
        </section>

        <section className="games-panel">
          <div className="games-panel-title">
            <h2>준비된 메뉴</h2>
            <span>{tokenRows.length}종</span>
          </div>
          {tokenRows.length ? (
            <div className="game-save-list">
              {tokenRows.map(([id, qty]) => (
                <article className="game-save-row" key={id}>
                  <div>
                    <span>메뉴</span>
                    <strong>{recipeName(id)}</strong>
                  </div>
                  <strong>{Number(qty || 0).toLocaleString('ko-KR')}</strong>
                </article>
              ))}
            </div>
          ) : <div className="games-empty">준비된 메뉴가 없습니다.</div>}
        </section>

        <section className="games-panel">
          <div className="games-panel-title">
            <h2>코스메틱</h2>
            <span>보유 {ownedCosmetics.length}/{cosmetics.length}</span>
          </div>
          <div className="games-rank-split" style={{ marginBottom: 12 }}>
            {equippedCosmetics.map((row) => (
              <SmallStat key={row.slot} label={row.label} value={row.item?.name || '없음'} />
            ))}
          </div>
          <div className="game-save-list">
            {cosmetics.map((cosmetic) => {
              const priceText = cosmetic.price.recipeShards
                ? `${cosmetic.price.gold}G · 조각 ${cosmetic.price.recipeShards}`
                : `${cosmetic.price.gold}G`;
              return (
                <article className="game-save-row" key={cosmetic.id}>
                  <div>
                    <span>{cosmetic.slotLabel} · 희귀도 {cosmetic.rarity} · {cosmetic.owned ? '보유' : priceText}</span>
                    <strong>{cosmetic.name}</strong>
                    <small>{cosmetic.effectText}</small>
                  </div>
                  {cosmetic.owned ? (
                    <GameControlButton action="equip" disabled={!canAct || cosmetic.equipped || !cosmetic.canEquip} onClick={() => setState((current) => equipCosmeticAction(current, cosmetic.id))}>
                      {cosmetic.equipped ? '장착 중' : '장착'}
                    </GameControlButton>
                  ) : (
                    <GameControlButton action="shop" disabled={!canAct || !cosmetic.canBuy} onClick={() => setState((current) => buyCosmeticAction(current, cosmetic.id))}>
                      구매
                    </GameControlButton>
                  )}
                </article>
              );
            })}
          </div>
        </section>

        <section className="games-panel">
          <div className="games-panel-title">
            <h2>시설</h2>
            <span>{facilities.length}종</span>
          </div>
          <div className="game-save-list">
            {facilities.map((facility) => (
              <article className="game-save-row" key={facility.id}>
                <div>
                  <span>{facility.effect} · Lv.{facility.level}/{facility.maxLevel}</span>
                  <strong>{facility.name}</strong>
                  <small>{facility.maxed ? '최대 레벨' : `다음 비용 ${facility.nextCost}G`}</small>
                </div>
                <GameControlButton action="upgrade" disabled={!canAct || facility.maxed || !facility.canUpgrade} onClick={() => setState((current) => upgradeFacilityAction(current, facility.id))}>업그레이드</GameControlButton>
              </article>
            ))}
          </div>
        </section>

        <section className="games-panel">
          <div className="games-panel-title">
            <h2>연구</h2>
            <span>조각 {Number(state.recipeShards || 0)}</span>
          </div>
          <div className="game-save-list">
            {researches.map((project) => (
              <article className="game-save-row" key={project.recipeId}>
                <div>
                  <span>{project.gold}G · 조각 {project.recipeShards}</span>
                  <strong>{project.name}</strong>
                  <small>{project.done ? '완료' : project.recipeName}</small>
                </div>
                <GameControlButton action="research" disabled={!canAct || project.done || !project.canResearch} onClick={() => setState((current) => researchRecipeAction(current, project.recipeId))}>연구</GameControlButton>
              </article>
            ))}
          </div>
        </section>

        <section className="games-panel">
          <div className="games-panel-title">
            <h2>대회</h2>
            <span>{tournament.theme.name}</span>
          </div>
          <label className="game-save-json-field">
            <span>티어</span>
            <select value={tournamentTierId} onChange={(event) => setTournamentTierId(event.target.value)}>
              {TOURNAMENT_TIERS.map((tier) => <option value={tier.id} key={tier.id}>{tier.name} · {tier.entryGold}G</option>)}
            </select>
          </label>
          <p style={{ color: '#cbd5e1', fontWeight: 800, lineHeight: 1.5 }}>{tournament.theme.desc}</p>
          <div className="games-rank-split">
            <SmallStat label="예상 점수" value={tournament.total} />
            <SmallStat label="목표" value={tournament.tier.targetScore} />
            <SmallStat label="판정" value={tournament.win ? '우승권' : '부족'} />
          </div>
          <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
            <ActionButton action="tournament" disabled={!canAct || !recipeStatus.unlocked} onClick={() => setState((current) => enterTournamentAction(current, recipeId, tournamentTierId))}>선택 메뉴로 출전</ActionButton>
          </div>
        </section>

        <section className="games-panel">
          <div className="games-panel-title">
            <h2>심사위원</h2>
            <span>{judge.rank}</span>
          </div>
          <div className="games-rank-split">
            <SmallStat label="심사" value={judge.judged} />
            <SmallStat label="정답" value={judge.correct} />
            <SmallStat label="정확도" value={`${judge.accuracy}%`} />
          </div>
          {judge.lastBatch ? (
            <p style={{ color: '#fbbf24', fontWeight: 900, lineHeight: 1.5 }}>
              최근 자동심사 {judge.lastBatch.correct}/{judge.lastBatch.count} 정답 ({judge.lastBatch.accuracy}%) · {JUDGE_BATCH_MODE_LABELS[judge.lastBatch.mode] || '자동'}
            </p>
          ) : (
            <p style={{ color: '#94a3b8', fontWeight: 800, lineHeight: 1.5 }}>셰프들의 제출작을 보고 승자를 맞히는 대회 전용 심사 모드입니다.</p>
          )}
          <div className="games-chip-row" style={{ margin: '8px 0 10px' }}>
            <label className="tonkatsu-judge-toggle">
              <input type="checkbox" checked={recentAutoOnly} onChange={(event) => setRecentAutoOnly(event.target.checked)} />
              <span>최근 자동심사만</span>
            </label>
            <label className="game-save-json-field" style={{ margin: 0, minWidth: 150 }}>
              <span>기록 필터</span>
              <select value={judgeHistoryMode} onChange={(event) => setJudgeHistoryMode(event.target.value)}>
                {Object.entries(JUDGE_HISTORY_MODE_LABELS).map(([mode, label]) => <option value={mode} key={mode}>{label}</option>)}
              </select>
            </label>
          </div>
          {judgeRecent.total ? (
            <div className="games-empty" style={{ textAlign: 'left', marginBottom: 12 }}>
              <strong>최근 {recentAutoOnly ? '자동 ' : ''}{judgeRecent.total}판</strong>
              {' · '}
              정확도 {judgeRecent.accuracy}% ({judgeRecent.correct}/{judgeRecent.total})
              {' · '}
              수익 +{judgeRecent.rewardGold}G / +{judgeRecent.rewardShards}조각
              {' · '}
              최근 랭크 {judgeRecent.rank}
              {' · '}
              랜덤 {judgeRecent.modeCounts.random} · 강한쪽 {judgeRecent.modeCounts.strong} · 약한쪽 {judgeRecent.modeCounts.weak} · 수동 {judgeRecent.modeCounts.manual}
            </div>
          ) : null}
          <label className="game-save-json-field">
            <span>심사 티어</span>
            <select value={judgeTierId} onChange={(event) => setJudgeTierId(event.target.value)}>
              {TOURNAMENT_TIERS.map((tier) => <option value={tier.id} key={tier.id}>{tier.name}</option>)}
            </select>
          </label>
          <div className="games-rank-split" style={{ marginTop: 10 }}>
            <label className="game-save-json-field">
              <span>자동 횟수</span>
              <select value={judgeBatchCount} onChange={(event) => setJudgeBatchCount(Number(event.target.value))}>
                {[5, 10, 20, 50].map((count) => <option value={count} key={count}>{count}회</option>)}
              </select>
            </label>
            <label className="game-save-json-field">
              <span>자동 방식</span>
              <select value={judgeBatchMode} onChange={(event) => setJudgeBatchMode(event.target.value)}>
                {Object.entries(JUDGE_BATCH_MODE_LABELS).map(([mode, label]) => <option value={mode} key={mode}>{label}</option>)}
              </select>
            </label>
          </div>
          <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
            <ActionButton action="verdict" disabled={!canAct} onClick={() => {
              setJudgePick('A');
              setJudgeText('');
              setState((current) => startJudgeMatchAction(current, judgeTierId));
            }}>새 심사 매치</ActionButton>
            <ActionButton action="verdict" disabled={!canAct} onClick={() => setState((current) => runJudgeBatchAction(current, judgeTierId, judgeBatchCount, judgeBatchMode))}>자동 심사 실행</ActionButton>
            <ActionButton action="reset" disabled={!canAct || (!judge.judged && !judgeMatch)} onClick={() => setState((current) => clearJudgeHistoryAction(current))}>심사 기록 초기화</ActionButton>
          </div>

          {judgeMatch ? (
            <div style={{ display: 'grid', gap: 10, marginTop: 14 }}>
              <div className="games-rank-split">
                <SmallStat label="테마" value={judgeMatch.themeName || judgeMatch.themeId} />
                <SmallStat label="티어" value={judgeMatch.tierName || judgeMatch.tierId} />
                <SmallStat label="결과" value={judgeMatch.resolved ? (judgeMatch.correct ? '정답' : '오답') : '판정 대기'} />
              </div>
              <article className="game-save-row">
                <div>
                  <span>A · {judgeMatch.aiAName}</span>
                  <strong>{judgeMatch.aiARecipeName || recipeName(judgeMatch.aiARecipeId)}</strong>
                  <small>{judgeMatch.aiAAppeal}</small>
                </div>
                <strong>{judgeMatch.resolved ? `${judgeMatch.aiATotal}점` : '비공개'}</strong>
              </article>
              <article className="game-save-row">
                <div>
                  <span>B · {judgeMatch.aiBName}</span>
                  <strong>{judgeMatch.aiBRecipeName || recipeName(judgeMatch.aiBRecipeId)}</strong>
                  <small>{judgeMatch.aiBAppeal}</small>
                </div>
                <strong>{judgeMatch.resolved ? `${judgeMatch.aiBTotal}점` : '비공개'}</strong>
              </article>
              <label className="game-save-json-field">
                <span>선택</span>
                <select value={judgePick} onChange={(event) => setJudgePick(event.target.value)}>
                  <option value="A">A 셰프</option>
                  <option value="B">B 셰프</option>
                </select>
              </label>
              <label className="game-save-json-field">
                <span>심사 메모</span>
                <input value={judgeText} onChange={(event) => setJudgeText(event.target.value)} placeholder="판정 근거를 적어두세요" />
              </label>
              <ActionButton action="verdict" disabled={!canAct || judgeMatch.resolved} onClick={() => setState((current) => submitJudgePickAction(current, judgePick, judgeText))}>판정 제출</ActionButton>
            </div>
          ) : (
            <div className="games-empty" style={{ marginTop: 14 }}>새 심사 매치를 준비하면 A/B 셰프의 제출작이 표시됩니다.</div>
          )}

          {judgeRecent.rows.length ? (
            <div className="game-save-list" style={{ marginTop: 14 }}>
              {judgeRecent.rows.map((entry, index) => (
                <article className="game-save-row" key={`${entry.id || entry.judgedAt}-${index}`}>
                  <div>
                    <span>{entry.themeName || entry.themeId} · {JUDGE_HISTORY_MODE_LABELS[entry.judgeMode] || '기록'} · {entry.judgePick} 선택</span>
                    <strong>{entry.correct ? '정답' : '오답'} · {entry.aiAName} vs {entry.aiBName}</strong>
                    <small>{entry.judgeText || '메모 없음'}</small>
                  </div>
                  <strong>{entry.aiATotal}:{entry.aiBTotal}</strong>
                </article>
              ))}
            </div>
          ) : judge.judged ? (
            <div className="games-empty" style={{ marginTop: 14 }}>현재 필터에 맞는 심사 기록이 없습니다.</div>
          ) : null}
        </section>

        <section className="games-panel">
          <div className="games-panel-title">
            <h2>로그</h2>
            <span>{state.runId}</span>
          </div>
          <div className="games-activity-list">
            {state.log.slice(0, 12).map((line, index) => (
              <div key={`${line}-${index}`}>
                <strong>{line}</strong>
              </div>
            ))}
          </div>
        </section>
      </section>
              </>
    </>
  );
}
