import {
  ActionButton,
  GameControlButton,
  SmallStat,
} from '../../_components/GamePlayPrimitives';
import {
  RECIPES,
  STUDENTS,
  applyUpgradeAction,
  attemptTowerAction,
  craftRecipeAction,
  enhanceEquipmentAction,
  itemName,
  rerollEquipmentAction,
  resolveDutyAction,
  restAction,
  slotLabel,
} from '../_lib/schaleIdleEngine';

export default function SchaleIdleDutyTab(props) {
  const {
    enhanceSlots,
    growthReport,
    growthRoadmap,
    leader,
    recipeId,
    runAutoSalvage,
    salvageInfo,
    selectedEquip,
    selectedRecipe,
    selectedSlot,
    setEnhanceSlot,
    setRecipeId,
    setState,
    setTowerBatchCount,
    setTowerStopOnFail,
    state,
    totalUpgradeLevel,
    towerBatchCount,
    towerStopOnFail,
    upgrades,
  } = props;

  return (
    <>
        <section className="games-detail-grid">
          <section className="games-panel">
            <div className="games-panel-title">
              <h2>성장 리포트</h2>
              <span>{growthReport.summary}</span>
            </div>
            <div className="games-rank-split">
              <SmallStat label="메인 승률" value={`${growthReport.combat.mainProbabilityPct}%`} />
              <SmallStat label="탑 승률" value={`${growthReport.combat.towerProbabilityPct}%`} />
              <SmallStat label="다음 메인" value={`${growthReport.combat.mainTargetPct}% / F${growthReport.combat.mainTarget}`} />
              <SmallStat label="다음 탑" value={`${growthReport.combat.towerTargetPct}% / ${growthReport.combat.towerTarget}층`} />
              <SmallStat label="보상 대기" value={`${growthReport.resources.claimableRewards}개`} />
              <SmallStat label="분해 후보" value={`${growthReport.resources.salvageCandidates}개`} />
            </div>
            <div className="game-save-list" style={{ marginTop: 12 }}>
              {growthReport.recommendations.slice(0, 4).map((item) => (
                <article className="game-save-row" key={item.id}>
                  <div>
                    <span>{item.priority === 'high' ? '우선' : item.priority === 'low' ? '보류' : '권장'}</span>
                    <strong>{item.title}</strong>
                    <small>{item.detail}</small>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="games-panel">
            <div className="games-panel-title">
              <h2>성장 로드맵</h2>
              <span>{growthRoadmap.headline}</span>
            </div>
            <div className="games-rank-split" style={{ marginBottom: 12 }}>
              <SmallStat label="전체" value={`${growthRoadmap.completionPct}%`} />
              {growthRoadmap.sections.map((section) => (
                <SmallStat
                  key={section.id}
                  label={section.label}
                  value={`${section.pct}% · ${section.done}/${section.total}`}
                />
              ))}
            </div>
            {growthRoadmap.nextAction ? (
              <div className="games-empty" style={{ textAlign: 'left', marginBottom: 12 }}>
                <strong>{growthRoadmap.nextAction.title}</strong>
                {' · '}
                {growthRoadmap.nextAction.action}
                <br />
                {growthRoadmap.nextAction.detail}
              </div>
            ) : null}
            <div className="game-save-list">
              {growthRoadmap.sections.map((section) => (
                <article className="game-save-row" key={section.id}>
                  <div>
                    <span>{section.label} · 완료 {section.done}/{section.total} · {section.pct}%</span>
                    <strong>{section.steps.map((step) => step.title).join(' / ')}</strong>
                    <small>{section.steps.find((step) => step.status !== 'complete')?.detail || '해당 구간 목표를 모두 완료했습니다.'}</small>
                  </div>
                  <strong>{section.steps.find((step) => step.priority === 'high' && step.status !== 'complete') ? '우선' : section.pct >= 100 ? '완료' : '진행'}</strong>
                </article>
              ))}
            </div>
          </section>

          <section className="games-panel">
            <div className="games-panel-title">
              <h2>방치 정산</h2>
              <span>{leader.name}</span>
            </div>
            <div className="games-rank-split">
              <SmallStat label="스태미나" value={`${state.stamina}/100`} />
              <SmallStat label="보스 처치" value={state.counters.KILL_BOSS} />
              <SmallStat label="누적 클리어" value={state.counters.CLEAR_FLOOR} />
              <SmallStat label="오프라인" value={state.offlineLastSummary?.waves ? `${state.offlineLastSummary.waves}웨이브` : '없음'} />
              <SmallStat label="대사" value={leader.lines.clear} />
            </div>
            <label className="game-save-json-field">
              <span>리더</span>
              <select value={state.leaderStudentId} onChange={(event) => setState((current) => ({ ...current, leaderStudentId: event.target.value }))}>
                {STUDENTS.map((student) => <option value={student.id} key={student.id}>{student.name}</option>)}
              </select>
            </label>
            <div style={{ display: 'grid', gap: 8 }}>
              <ActionButton action="settle" onClick={() => setState((current) => resolveDutyAction(current, 30))}>30분 정산</ActionButton>
              <ActionButton action="settle" onClick={() => setState((current) => resolveDutyAction(current, 120))}>2시간 정산</ActionButton>
              <ActionButton action="rest" onClick={() => setState((current) => restAction(current))}>재정비</ActionButton>
            </div>
          </section>

          <section className="games-panel">
            <div className="games-panel-title">
              <h2>오프라인 보상</h2>
              <span>{state.offlineLastSummary?.waves ? `${Math.floor(Number(state.offlineLastSummary.deltaMs || 0) / 60000)}분` : '없음'}</span>
            </div>
            {state.offlineLastSummary?.waves ? (
              <div className="games-rank-split">
                <SmallStat label="웨이브" value={state.offlineLastSummary.waves} />
                <SmallStat label="크레딧" value={`${Number(state.offlineLastSummary.creditsGained || 0).toLocaleString('ko-KR')} Cr`} />
                <SmallStat label="토큰" value={`+${Number(state.offlineLastSummary.tokensGained || 0)}`} />
                <SmallStat label="상한" value={state.offlineLastSummary.capped ? '8시간 적용' : '미적용'} />
              </div>
            ) : <div className="games-empty">저장 데이터를 불러오면 지난 접속 시간에 따른 오프라인 보상이 표시됩니다.</div>}
          </section>

          <section className="games-panel">
            <div className="games-panel-title">
              <h2>제작</h2>
              <span>{selectedRecipe.credits} Cr</span>
            </div>
            <label className="game-save-json-field">
              <span>레시피</span>
              <select value={recipeId} onChange={(event) => setRecipeId(event.target.value)}>
                {RECIPES.map((recipe) => <option value={recipe.id} key={recipe.id}>{recipe.name}</option>)}
              </select>
            </label>
            <p style={{ color: '#64717d', fontWeight: 800, lineHeight: 1.55 }}>
              필요 재료: {Object.entries(selectedRecipe.requires).map(([itemId, qty]) => `${itemName(itemId)} ${qty}`).join(', ')}
            </p>
            <ActionButton action="craft" onClick={() => setState((current) => craftRecipeAction(current, recipeId))}>제작 실행</ActionButton>
          </section>

          <section className="games-panel">
            <div className="games-panel-title">
              <h2>강화 / 탑</h2>
              <span>열쇠 {Number(state.inventory.itm_tower_key || 0)} · 연패 {Number(state.towerLossStreak || 0)}</span>
            </div>
            <label className="game-save-json-field">
              <span>강화 슬롯</span>
              <select value={selectedSlot} onChange={(event) => setEnhanceSlot(event.target.value)} disabled={!enhanceSlots.length}>
                {enhanceSlots.length ? enhanceSlots.map((slot) => <option value={slot} key={slot}>{slotLabel(slot)}</option>) : <option value="">장비 없음</option>}
              </select>
            </label>
            <div className="games-rank-split">
              <SmallStat label="도전 층" value={`${state.towerFloor}층`} />
              <SmallStat label="최고 층" value={`${state.towerMaxCleared}층`} />
              <SmallStat label="연패보정" value={`x${(1 + Math.min(0.24, Math.max(0, Number(state.towerLossStreak || 0)) * 0.06)).toFixed(2)}`} />
              <SmallStat label="토큰" value={Number(state.inventory.itm_tower_token || 0)} />
            </div>
            <label className="game-save-json-field">
              <span>탑 배치 횟수</span>
              <select value={towerBatchCount} onChange={(event) => setTowerBatchCount(Number(event.target.value))}>
                <option value={1}>x1</option>
                <option value={5}>x5</option>
                <option value={10}>x10</option>
                <option value={100}>x100</option>
              </select>
            </label>
            <label className="game-save-json-field">
              <span>탑 배치 규칙</span>
              <select value={towerStopOnFail ? 'stop' : 'continue'} onChange={(event) => setTowerStopOnFail(event.target.value === 'stop')}>
                <option value="stop">실패 시 중단</option>
                <option value="continue">실패해도 계속</option>
              </select>
            </label>
            <div style={{ display: 'grid', gap: 8 }}>
              <ActionButton action="upgrade" disabled={!selectedSlot} onClick={() => setState((current) => enhanceEquipmentAction(current, selectedSlot))}>선택 장비 강화</ActionButton>
              <ActionButton action="reroll" disabled={!selectedEquip} onClick={() => setState((current) => rerollEquipmentAction(current, selectedSlot))}>선택 장비 옵션 재련</ActionButton>
              <ActionButton action="salvage" disabled={!salvageInfo.executableCount} onClick={runAutoSalvage}>
                자동 분해 실행{salvageInfo.candidateOnly ? ' · 후보만' : ''}
              </ActionButton>
              <ActionButton action="tower" disabled={Number(state.inventory.itm_tower_key || 0) <= 0} onClick={() => setState((current) => attemptTowerAction(current, towerBatchCount, towerStopOnFail))}>
                탑 배치 도전 x{towerBatchCount}
              </ActionButton>
              <ActionButton action="tower" disabled={Number(state.inventory.itm_tower_key || 0) <= 0} onClick={() => setState((current) => attemptTowerAction(current, 100, false))}>탑 x100 계속 도전</ActionButton>
            </div>
          </section>

          <section className="games-panel">
            <div className="games-panel-title">
              <h2>상시 연구</h2>
              <span>총 Lv.{totalUpgradeLevel}</span>
            </div>
            <div className="game-save-list">
              {upgrades.map((upgrade) => (
                <article className="game-save-row" key={upgrade.id}>
                  <div>
                    <span>Lv.{upgrade.level} → Lv.{upgrade.nextLevel} · {Number(upgrade.costCredits || 0).toLocaleString('ko-KR')} Cr</span>
                    <strong>{upgrade.name}</strong>
                    <small>{upgrade.bonusText || '보정 없음'}</small>
                    <small>필요: {upgrade.costItemText || '없음'}</small>
                  </div>
                  <GameControlButton action="research" disabled={!upgrade.canUpgrade} onClick={() => setState((current) => applyUpgradeAction(current, upgrade.id))}>연구</GameControlButton>
                </article>
              ))}
            </div>
          </section>
        </section>
                </>
  );
}
