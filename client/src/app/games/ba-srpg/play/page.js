'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useToast } from '../../../../components/ToastProvider';
import { apiGet, apiPost, apiPut, clearApiGetCache } from '../../../../utils/api';
import { useAuthToken, useHydrated } from '../../../../utils/client-auth';
import GamePlayShell, { GameFeatureTabs } from '../../_components/GamePlayShell';
import {
  GAME_SLUG,
  GRID,
  QUICK_SAVE_SLOT,
  RECIPES,
  SAVE_VERSION,
  EDICTS,
  MAX_FORMATION_SIZE,
  PROPERTIES,
  TACTICAL_SKILLS,
  actorStatusText,
  attackSelectedAction,
  autoPlayerTurnAction,
  battlePower,
  buyItemAction,
  buyPropertyAction,
  cellContent,
  claimQuestAction,
  cancelRentPropertyAction,
  consumeBandageAction,
  craftRecipeAction,
  createNewState,
  edictRows,
  enactEdictAction,
  endTurnAction,
  equipWeaponAction,
  equipmentRows,
  executeSkillAction,
  formationRows,
  getCampaignReport,
  getBattleForecast,
  getMission,
  getOperationBriefing,
  getPlayTimeSec,
  guildRankInfo,
  inventoryRows,
  itemName,
  moveSelectedAction,
  normalizeState,
  propertyRows,
  questRows,
  refreshShopAction,
  recipeRows,
  rentPropertyAction,
  restAction,
  scoreState,
  setFormationAction,
  selectEnemyAction,
  selectUnitAction,
  shopRows,
  startMissionAction,
  summaryForState,
  tacticalSkillRows,
  toggleLeasePropertyAction,
  townSummary,
  waitSelectedUnitAction,
} from '../_lib/baSrpgEngine';

function ActionButton({ children, disabled, onClick }) {
  return (
    <button type="button" className="tcg-primary-action" disabled={disabled} onClick={onClick}>
      {children}
    </button>
  );
}

function SmallStat({ label, value }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function missionRewardSummary(mission) {
  if (!mission?.rewards?.length) return '보상 없음';
  return mission.rewards.map((reward) => {
    const qty = reward.qtyMin === reward.qtyMax ? reward.qtyMin : `${reward.qtyMin}-${reward.qtyMax}`;
    const chance = Math.round((reward.chance ?? 1) * 100);
    return `${itemName(reward.itemId)} x${qty} (${chance}%)`;
  }).join(' · ');
}

function BoardCell({ content, selected, target, onClick }) {
  const statusText = content.actor ? actorStatusText(content.actor) : '';
  const label = content.actor
    ? `${content.actor.name}${statusText ? ` · ${statusText}` : ''}`
    : content.type === 'cover' ? '엄폐' : content.type === 'obstacle' ? '장애물' : '';
  return (
    <button
      type="button"
      className={`srpg-cell is-${content.type}${selected ? ' is-selected' : ''}${target ? ' is-target' : ''}`}
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
        <span>{content.type === 'cover' ? '▣' : content.type === 'obstacle' ? '×' : ''}</span>
      )}
    </button>
  );
}

export default function BaSrpgPlayPage() {
  const token = useAuthToken();
  const hydrated = useHydrated();
  const { showToast } = useToast();
  const [state, setState] = useState(() => createNewState());
  const [missionId, setMissionId] = useState('m001');
  const [recipeId, setRecipeId] = useState(RECIPES[0].id);
  const [propertyId, setPropertyId] = useState(PROPERTIES[0].id);
  const [edictId, setEdictId] = useState(EDICTS[0].id);
  const [skillId, setSkillId] = useState(TACTICAL_SKILLS[0].id);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');

  const battle = state.battle;
  const mission = getMission(battle.missionId);
  const selectedUnit = battle.units.find((unit) => unit.id === battle.selectedUnitId) || battle.units[0];
  const selectedCanAct = battle.phase === 'player' && selectedUnit && !selectedUnit.acted && Number(selectedUnit.ap || 0) > 0;
  const targetEnemy = battle.enemies.find((enemy) => enemy.id === battle.targetEnemyId && enemy.hp > 0);
  const formation = useMemo(() => formationRows(state), [state]);
  const rows = useMemo(() => inventoryRows(state), [state]);
  const equips = useMemo(() => equipmentRows(state), [state]);
  const quests = useMemo(() => questRows(state), [state]);
  const shop = useMemo(() => shopRows(state), [state]);
  const recipes = useMemo(() => recipeRows(state), [state]);
  const properties = useMemo(() => propertyRows(state), [state]);
  const edicts = useMemo(() => edictRows(state), [state]);
  const skills = useMemo(() => tacticalSkillRows(state), [state]);
  const town = useMemo(() => townSummary(state), [state]);
  const guildRank = useMemo(() => guildRankInfo(state), [state]);
  const campaignReport = useMemo(() => getCampaignReport(state), [state]);
  const operationBriefing = useMemo(() => getOperationBriefing(state), [state]);
  const battleForecast = useMemo(() => getBattleForecast(state), [state]);
  const score = scoreState(state);
  const power = battlePower(state);
  const selectedRecipe = recipes.find((recipe) => recipe.id === recipeId) || recipes[0];
  const selectedProperty = properties.find((property) => property.id === propertyId) || properties[0];
  const selectedEdict = edicts.find((edict) => edict.id === edictId) || edicts[0];
  const selectedSkill = skills.find((skill) => skill.id === skillId) || skills[0];
  const selectedMission = getMission(missionId);
  const selectedMissionProgress = campaignReport.missionRows.find((row) => row.id === selectedMission.id) || campaignReport.missionRows[0];
  const selectedMissionBrief = operationBriefing.missionRows.find((row) => row.id === selectedMission.id) || operationBriefing.missionRows[0];
  const selectedMissionRewards = missionRewardSummary(selectedMission);
  const formationCount = formation.filter((student) => student.selected).length;
  const cleared = battle.phase === 'cleared';
  const failed = battle.phase === 'failed';

  const saveRun = async () => {
    if (!token || busy) {
      setMessage('로그인하면 BA SRPG 진행 상태를 저장 슬롯에 저장할 수 있습니다.');
      return;
    }
    setBusy('save');
    try {
      await apiPut(`/game-saves/${GAME_SLUG}/${QUICK_SAVE_SLOT}`, {
        saveName: `BA SRPG Day ${state.day}`,
        version: SAVE_VERSION,
        summary: summaryForState(state),
        payload: { state },
        lastPlayedAt: new Date().toISOString(),
      }, { timeoutMs: 15000 });
      clearApiGetCache('/game-saves');
      setMessage('BA SRPG 진행 상태를 저장했습니다.');
      showToast({ tone: 'success', message: 'BA SRPG 진행 상태를 저장했습니다.' });
    } catch (err) {
      const nextMessage = err?.message || '저장에 실패했습니다.';
      setMessage(nextMessage);
      showToast({ tone: 'danger', message: nextMessage });
    } finally {
      setBusy('');
    }
  };

  const loadRun = async () => {
    if (!token || busy) {
      setMessage('로그인하면 저장된 BA SRPG 진행 상태를 불러올 수 있습니다.');
      return;
    }
    setBusy('load');
    try {
      const list = await apiGet(`/game-saves?gameSlug=${GAME_SLUG}`, { timeoutMs: 12000 });
      const quickSave = Array.isArray(list?.saves) ? list.saves.find((save) => save.slotKey === QUICK_SAVE_SLOT) : null;
      if (!quickSave?.id) {
        setMessage('저장된 BA SRPG 진행 상태가 없습니다.');
        return;
      }
      const detail = await apiGet(`/game-saves/${quickSave.id}`, { timeoutMs: 12000 });
      const nextState = normalizeState(detail?.save?.payload?.state);
      setState(nextState);
      setMissionId(nextState.selectedMissionId);
      setMessage('저장된 BA SRPG 진행 상태를 불러왔습니다.');
      showToast({ tone: 'success', message: '저장된 BA SRPG 진행 상태를 불러왔습니다.' });
    } catch (err) {
      const nextMessage = err?.message || '불러오기에 실패했습니다.';
      setMessage(nextMessage);
      showToast({ tone: 'danger', message: nextMessage });
    } finally {
      setBusy('');
    }
  };

  const recordRun = async () => {
    if (!token || busy) {
      setMessage('로그인하면 BA SRPG 전투 스냅샷을 전적에 남길 수 있습니다.');
      return;
    }
    setBusy('record');
    try {
      await apiPost(`/game-records/${GAME_SLUG}`, {
        title: `BA SRPG - ${mission.name}`,
        mode: 'tactical-grid',
        result: cleared ? 'mission-clear' : failed ? 'mission-failed' : 'mission-snapshot',
        score,
        playTimeSec: getPlayTimeSec(state),
        summary: summaryForState(state),
        payload: { state },
      }, { timeoutMs: 15000 });
      clearApiGetCache('/game-records');
      setMessage('BA SRPG 전투 스냅샷을 전적에 기록했습니다.');
      showToast({ tone: 'success', message: 'BA SRPG 전투 스냅샷을 전적에 기록했습니다.' });
    } catch (err) {
      const nextMessage = err?.message || '전적 기록에 실패했습니다.';
      setMessage(nextMessage);
      showToast({ tone: 'danger', message: nextMessage });
    } finally {
      setBusy('');
    }
  };

  const startNewRun = () => {
    const nextState = createNewState();
    setState(nextState);
    setMissionId(nextState.selectedMissionId);
    setRecipeId(RECIPES[0].id);
    setPropertyId(PROPERTIES[0].id);
    setEdictId(EDICTS[0].id);
    setSkillId(TACTICAL_SKILLS[0].id);
    setMessage('');
  };

  const handleCellClick = (x, y) => {
    const content = cellContent(state, x, y);
    if (content.type === 'unit') setState((current) => selectUnitAction(current, content.actor.id));
    if (content.type === 'enemy') setState((current) => selectEnemyAction(current, content.actor.id));
  };

  const runAutoBattle = () => {
    setState((current) => {
      let next = current;
      for (let i = 0; i < 8; i += 1) {
        if (next.battle.phase !== 'player') break;
        next = autoPlayerTurnAction(next);
        if (next.battle.phase === 'cleared' || next.battle.phase === 'failed') break;
      }
      return next;
    });
  };

  const actions = (
    <>
      <button type="button" onClick={startNewRun}>새 작전</button>
      <button type="button" onClick={() => void saveRun()} disabled={!hydrated || busy === 'save'}>{busy === 'save' ? '저장 중...' : '저장'}</button>
      <button type="button" onClick={() => void loadRun()} disabled={!hydrated || busy === 'load'}>{busy === 'load' ? '불러오는 중...' : '불러오기'}</button>
      <button type="button" onClick={() => void recordRun()} disabled={!hydrated || busy === 'record'}>{busy === 'record' ? '기록 중...' : '전적 기록'}</button>
      <Link href="/srpg/ba-srpg">상세</Link>
    </>
  );

  const metrics = [
    { label: '임무', value: mission.name },
    { label: '편성', value: `${formationCount}/${MAX_FORMATION_SIZE}` },
    { label: '일차', value: state.day },
    { label: '턴', value: battle.turn },
    { label: '전투력', value: power.toLocaleString('ko-KR') },
    { label: '승리', value: state.battleWins },
    { label: '별', value: `${campaignReport.starTotal}/${campaignReport.starMax}` },
    { label: '작전', value: `${operationBriefing.readinessPct}%` },
    { label: '위협', value: battleForecast.threatLevel },
    { label: '길드', value: `${guildRank.rank} (${guildRank.rep})` },
    { label: '부동산', value: town.activeProperties },
    { label: '크레딧', value: `${Number(state.credit || 0).toLocaleString('ko-KR')} Cr` },
    { label: '점수', value: score.toLocaleString('ko-KR') },
  ];

  const messages = [
    message ? { key: 'message', text: message } : null,
    !token && hydrated ? { key: 'auth', text: '로그인하지 않아도 플레이는 가능하지만 저장/불러오기/전적 기록은 로그인 후 사용할 수 있습니다.' } : null,
    cleared ? { key: 'clear', text: '임무를 클리어했습니다. 전적에 기록하거나 다른 임무를 시작하세요.' } : null,
    failed ? { key: 'failed', tone: 'error', text: '임무에 실패했습니다. 여관 휴식 후 재도전하거나 새 임무를 시작하세요.' } : null,
  ];

  return (
    <GamePlayShell
      kicker="BA SRPG"
      title="BA SRPG 전술 작전"
      description="업로드된 BA SRPG 데이터를 기반으로 격자 이동, AP, 사거리, 엄폐, 적 턴, 임무 보상, 의뢰/제작/상점을 묶은 1차 전술 slice입니다."
      summaryLabel="BA SRPG 요약"
      actions={actions}
      metrics={metrics}
      messages={messages}
    >
      <GameFeatureTabs
        tabs={[
          {
            id: 'mission',
            label: '작전 준비',
            badge: `${formationCount}/${MAX_FORMATION_SIZE}`,
            children: (
              <>
      <section className="games-detail-grid">
        <section className="games-panel">
          <div className="games-panel-title">
            <h2>작전 선택</h2>
            <span>{mission.region}</span>
          </div>
          <label className="game-save-json-field">
            <span>임무</span>
            <select value={missionId} onChange={(event) => setMissionId(event.target.value)}>
              {campaignReport.missionRows.map((item) => (
                <option value={item.id} key={item.id}>
                  [{item.difficultyLabel}] {item.name}{item.locked ? ' (잠김)' : ''}
                </option>
              ))}
            </select>
          </label>
          <p style={{ color: '#64717d', fontWeight: 800, lineHeight: 1.55 }}>{selectedMission.objective}</p>
          <div className="games-rank-split">
            <SmallStat label="난이도" value={selectedMissionProgress?.difficultyLabel || selectedMission.difficulty} />
            <SmallStat label="권장 전투력" value={selectedMission.recommendedPower} />
            <SmallStat label="상태" value={selectedMissionProgress?.locked ? '잠김' : selectedMissionProgress?.powerGap >= 0 ? '출정 가능' : '전력 부족'} />
            <SmallStat label="예상 승산" value={`${selectedMissionBrief?.successPct ?? 0}%`} />
            <SmallStat label="크레딧" value={`${selectedMission.creditMin}-${selectedMission.creditMax}`} />
          </div>
          {selectedMissionProgress?.locked ? (
            <p style={{ color: '#9f5f00', fontWeight: 900, lineHeight: 1.55 }}>
              잠금 사유: {selectedMissionProgress.lockReason}
            </p>
          ) : null}
          <p style={{ color: '#64717d', fontWeight: 800, lineHeight: 1.55 }}>{selectedMissionRewards}</p>
          <p style={{ color: '#64717d', fontWeight: 800, lineHeight: 1.55 }}>{selectedMission.caution}</p>
          <div style={{ display: 'grid', gap: 8 }}>
            <ActionButton disabled={!formationCount || selectedMissionProgress?.locked} onClick={() => setState((current) => startMissionAction(current, missionId))}>선택 임무 시작</ActionButton>
            <ActionButton onClick={() => setState((current) => restAction(current))}>여관 휴식</ActionButton>
          </div>
        </section>

        <section className="games-panel">
          <div className="games-panel-title">
            <h2>작전 브리핑</h2>
            <span>{operationBriefing.headline}</span>
          </div>
          <div className="games-rank-split">
            <SmallStat label="준비도" value={`${operationBriefing.readinessPct}%`} />
            <SmallStat label="전투력" value={operationBriefing.power.toLocaleString('ko-KR')} />
            <SmallStat label="붕대" value={`${operationBriefing.bandages}개`} />
            <SmallStat label="무기" value={operationBriefing.weaponEquipped ? '장착' : '미장착'} />
            <SmallStat label="보고 가능" value={`${operationBriefing.readyQuests}건`} />
          </div>
          <div className="games-empty" style={{ textAlign: 'left', marginBottom: 12 }}>
            <strong>다음 액션</strong> · {operationBriefing.nextAction}
          </div>
          <div className="game-save-list">
            {operationBriefing.missionRows.slice(0, 4).map((row) => (
              <article className="game-save-row" key={row.id}>
                <div>
                  <span>CH.{row.chapter} · {row.difficultyLabel} · {row.riskLabel} · 평균 {row.avgCredit}Cr</span>
                  <strong>{row.name}</strong>
                  <small>승산 {row.successPct}% · {row.repeatValue} · {row.prepText}</small>
                  <small>{row.rewardText}</small>
                </div>
                <button
                  type="button"
                  className="tcg-primary-action"
                  onClick={() => setMissionId(row.id)}
                  disabled={row.locked}
                >
                  선택
                </button>
              </article>
            ))}
          </div>
        </section>

        <section className="games-panel">
          <div className="games-panel-title">
            <h2>캠페인 진행</h2>
            <span>{campaignReport.progressPct}% · ★{campaignReport.starTotal}/{campaignReport.starMax}</span>
          </div>
          <p style={{ color: '#64717d', fontWeight: 800, lineHeight: 1.55, margin: 0 }}>
            {campaignReport.headline}
          </p>
          <div className="games-rank-split">
            <SmallStat label="클리어" value={`${campaignReport.clearedCount}/${campaignReport.totalMissions}`} />
            <SmallStat label="다음 임무" value={campaignReport.nextMissionName} />
            <SmallStat label="CH1 별" value={`${campaignReport.chapterOneStars}/9`} />
            <SmallStat label="Hard" value={campaignReport.hardUnlocked ? '해금' : '잠김'} />
            <SmallStat label="VeryHard" value={campaignReport.veryHardUnlocked ? '해금' : campaignReport.veryHardRequirementText} />
          </div>
          <div className="game-save-list">
            {campaignReport.missionRows.map((row) => (
              <article className="game-save-row" key={row.id}>
                <div>
                  <span>CH.{row.chapter} · {row.difficultyLabel} · {row.statusLabel} · 권장 {row.recommendedPower}</span>
                  <strong>{row.name}</strong>
                  <small>
                    {row.cleared
                      ? `최고 ★${row.bestStars}/3 · 최단 ${row.bestTurn || '-'}턴 · 전원 생존 ${row.allSurvived ? '성공' : '미달'}`
                      : row.locked
                        ? row.lockReason
                        : campaignReport.recommendations.join(' / ')}
                  </small>
                </div>
                <button
                  type="button"
                  className="tcg-primary-action"
                  onClick={() => setMissionId(row.id)}
                  disabled={row.locked}
                >
                  선택
                </button>
              </article>
            ))}
          </div>
        </section>

        <section className="games-panel">
          <div className="games-panel-title">
            <h2>출전 편성</h2>
            <span>{formationCount}/{MAX_FORMATION_SIZE}</span>
          </div>
          <div className="game-save-list">
            {formation.map((student) => (
              <article className="game-save-row" key={student.id}>
                <div>
                  <span>{student.role} · 전투력 {student.power}{student.selected ? ` · ${student.order}번` : ''}</span>
                  <strong>{student.name}</strong>
                  <small>HP {student.hp} · 공격 {student.atk} · 방어 {student.def} · 사거리 {student.range} · 이동 {student.move}</small>
                </div>
                <button
                  type="button"
                  className="tcg-primary-action"
                  onClick={() => setState((current) => setFormationAction(current, student.id, !student.selected))}
                >
                  {student.selected ? '제외' : '편성'}
                </button>
              </article>
            ))}
          </div>
        </section>

        <section className="games-panel">
          <div className="games-panel-title">
            <h2>선택 유닛</h2>
            <span>{selectedUnit?.name || '-'}</span>
          </div>
          <div className="games-rank-split">
            <SmallStat label="HP" value={selectedUnit ? `${selectedUnit.hp}/${selectedUnit.maxHp}` : '-'} />
            <SmallStat label="AP" value={selectedUnit?.ap ?? 0} />
            <SmallStat label="공격" value={selectedUnit?.atk ?? 0} />
            <SmallStat label="사거리" value={selectedUnit?.range ?? 0} />
          </div>
          <div className="srpg-pad">
            <button type="button" disabled={!selectedCanAct} onClick={() => setState((current) => moveSelectedAction(current, 0, -1))}>↑</button>
            <button type="button" disabled={!selectedCanAct} onClick={() => setState((current) => moveSelectedAction(current, -1, 0))}>←</button>
            <button type="button" disabled={!selectedCanAct} onClick={() => setState((current) => moveSelectedAction(current, 1, 0))}>→</button>
            <button type="button" disabled={!selectedCanAct} onClick={() => setState((current) => moveSelectedAction(current, 0, 1))}>↓</button>
          </div>
        </section>

        <section className="games-panel">
          <div className="games-panel-title">
            <h2>전술 명령</h2>
            <span>{battle.phase}</span>
          </div>
          <div className="games-rank-split">
            <SmallStat label="대상" value={targetEnemy?.name || '없음'} />
            <SmallStat label="적 생존" value={battle.enemies.filter((enemy) => enemy.hp > 0).length} />
            <SmallStat label="스킬" value={selectedSkill?.name || '-'} />
            <SmallStat label="소모 AP" value={selectedSkill?.apCost ?? 0} />
          </div>
          <label className="game-save-json-field">
            <span>전술 스킬</span>
            <select value={skillId} onChange={(event) => setSkillId(event.target.value)}>
              {skills.map((skill) => (
                <option value={skill.id} key={skill.id}>{skill.name} · AP {skill.apCost}</option>
              ))}
            </select>
          </label>
          <p style={{ color: '#64717d', fontWeight: 800, lineHeight: 1.55 }}>
            대상 {selectedSkill?.targetName || '-'} · 사거리 {selectedSkill?.rangeText || '-'} · {selectedSkill?.note || ''}
          </p>
          <div style={{ display: 'grid', gap: 8 }}>
            <ActionButton disabled={!selectedCanAct || !targetEnemy} onClick={() => setState((current) => attackSelectedAction(current, targetEnemy?.id))}>선택 대상 공격</ActionButton>
            <ActionButton disabled={!selectedSkill?.canUse} onClick={() => setState((current) => executeSkillAction(current, skillId))}>선택 스킬 사용</ActionButton>
            <ActionButton
              disabled={!selectedCanAct || Number(state.inventory.con_bandage || 0) <= 0}
              onClick={() => setState((current) => consumeBandageAction(current))}
            >
              붕대 사용 (x{Number(state.inventory.con_bandage || 0)})
            </ActionButton>
            <ActionButton
              disabled={!selectedCanAct}
              onClick={() => setState((current) => waitSelectedUnitAction(current))}
            >
              대기
            </ActionButton>
            <ActionButton disabled={battle.phase !== 'player'} onClick={() => setState((current) => endTurnAction(current))}>턴 종료</ActionButton>
            <ActionButton disabled={battle.phase !== 'player'} onClick={() => setState((current) => autoPlayerTurnAction(current))}>자동 1턴</ActionButton>
            <ActionButton disabled={battle.phase !== 'player'} onClick={runAutoBattle}>자동 전투 x8</ActionButton>
          </div>
        </section>
      </section>
              </>
            ),
          },
          {
            id: 'town',
            label: '타운/경제',
            badge: guildRank.rank,
            children: (
              <>

      <section className="games-dashboard">
        <section className="games-panel">
          <div className="games-panel-title">
            <h2>타운 허브</h2>
            <span>{town.activeEdictName}</span>
          </div>
          <div className="games-rank-split">
            <SmallStat label="휴식 비용" value={`${town.restCost} Cr`} />
            <SmallStat label="상점 할인" value={`${town.shopDiscountPct}%`} />
            <SmallStat label="길드 랭크" value={guildRank.rank} />
            <SmallStat label="다음 랭크" value={guildRank.nextRep == null ? '최대' : `${guildRank.remaining} Rep`} />
          </div>
          <p style={{ color: '#64717d', fontWeight: 800, lineHeight: 1.55 }}>
            보유 {town.ownedProperties} · 활성 {town.activeProperties} · 임차 {town.rentedProperties} · 임대 {town.leasedProperties}
          </p>
        </section>

        <section className="games-panel">
          <div className="games-panel-title">
            <h2>부동산</h2>
            <span>{selectedProperty.status}</span>
          </div>
          <label className="game-save-json-field">
            <span>시설</span>
            <select value={propertyId} onChange={(event) => setPropertyId(event.target.value)}>
              {properties.map((property) => (
                <option value={property.id} key={property.id}>{property.name} · {property.status}</option>
              ))}
            </select>
          </label>
          <p style={{ color: '#64717d', fontWeight: 800, lineHeight: 1.55 }}>{selectedProperty.desc}</p>
          <div className="games-rank-split">
            <SmallStat label="구매" value={`${selectedProperty.buyPrice} Cr`} />
            <SmallStat label="임차" value={`${selectedProperty.rentFee} Cr`} />
            <SmallStat label="유지비" value={`${selectedProperty.rentCostPerDay} Cr`} />
            <SmallStat label="임대수익" value={`${selectedProperty.leaseIncomePerDay} Cr`} />
          </div>
          <div style={{ display: 'grid', gap: 8 }}>
            <ActionButton disabled={selectedProperty.owned} onClick={() => setState((current) => buyPropertyAction(current, propertyId))}>구매</ActionButton>
            <ActionButton disabled={selectedProperty.owned || Boolean(selectedProperty.rented)} onClick={() => setState((current) => rentPropertyAction(current, propertyId))}>3일 임차</ActionButton>
            <ActionButton disabled={!selectedProperty.rented} onClick={() => setState((current) => cancelRentPropertyAction(current, propertyId))}>임차 종료</ActionButton>
            <ActionButton disabled={!selectedProperty.owned} onClick={() => setState((current) => toggleLeasePropertyAction(current, propertyId))}>
              {selectedProperty.leased ? '임대 종료' : '임대 시작'}
            </ActionButton>
          </div>
        </section>

        <section className="games-panel">
          <div className="games-panel-title">
            <h2>칙령</h2>
            <span>{town.activeEdictName}</span>
          </div>
          <label className="game-save-json-field">
            <span>월간 칙령</span>
            <select value={edictId} onChange={(event) => setEdictId(event.target.value)}>
              {edicts.map((edict) => <option value={edict.id} key={edict.id}>{edict.name}</option>)}
            </select>
          </label>
          <p style={{ color: '#64717d', fontWeight: 800, lineHeight: 1.55 }}>{selectedEdict.desc}</p>
          <div className="games-rank-split">
            <SmallStat label="상태" value={selectedEdict.active ? '발효 중' : selectedEdict.available ? '발령 가능' : '이번 달 마감'} />
            <SmallStat label="주기" value="월간" />
          </div>
          <ActionButton disabled={!selectedEdict.available} onClick={() => setState((current) => enactEdictAction(current, edictId))}>
            칙령 발령
          </ActionButton>
        </section>
      </section>
              </>
            ),
          },
          {
            id: 'battle',
            label: '전장/제작',
            badge: battle.phase,
            children: (
              <>

      <section className="games-panel">
        <div className="games-panel-title">
          <h2>전장</h2>
          <span>{battle.lastResult || mission.caution}</span>
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

      <section className="games-dashboard">
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
                ? `${battleForecast.bestAttack.enemyName} ${battleForecast.bestAttack.expectedHpDamage}`
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
            <ActionButton onClick={() => setState((current) => craftRecipeAction(current, recipeId))}>제작</ActionButton>
          </div>
          <div className="games-rank-split" style={{ marginTop: 10 }}>
            <SmallStat label="상점 갱신" value={`${town.shopRefreshCount}회`} />
            <SmallStat label="유료 갱신" value={`${town.shopPaidRefreshCount}회`} />
            <SmallStat label="무료" value={`${town.shopFreeRefreshLeft}/1`} />
            <SmallStat label="갱신 비용" value={`${town.shopRefreshCost} Cr`} />
          </div>
          <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
            <ActionButton disabled={!town.shopFreeRefreshAvailable} onClick={() => setState((current) => refreshShopAction(current, true))}>
              무료 상점 갱신
            </ActionButton>
            <ActionButton disabled={Number(state.credit || 0) < Number(town.shopRefreshCost || 0)} onClick={() => setState((current) => refreshShopAction(current, false))}>
              유료 상점 갱신
            </ActionButton>
          </div>
          <div className="games-chip-row" style={{ marginTop: 10 }}>
            {shop.map((item) => (
              <button
                type="button"
                className="srpg-shop-chip"
                key={item.itemId}
                disabled={(item.stock != null && Number(item.stock || 0) <= 0) || Number(state.credit || 0) < Number(item.price || 0)}
                title={item.stock == null ? '재고 무제한' : `재고 ${item.stock}`}
                onClick={() => setState((current) => buyItemAction(current, item.itemId))}
              >
                <span>{item.name} {item.price}Cr{item.basePrice !== item.price ? `/${item.basePrice}` : ''}</span>
                <small>재고 {item.stock == null ? '∞' : item.stock}</small>
              </button>
            ))}
          </div>
        </section>
      </section>
              </>
            ),
          },
          {
            id: 'inventory',
            label: '보유/의뢰',
            badge: `${rows.length}종`,
            children: (
              <>

      <section className="games-dashboard">
        <section className="games-panel">
          <div className="games-panel-title">
            <h2>인벤토리</h2>
            <span>{rows.length}종</span>
          </div>
          <div className="game-save-list">
            {rows.map((row) => (
              <article className="game-save-row" key={row.itemId}>
                <div>
                  <span>{row.kind}</span>
                  <strong>{row.name}</strong>
                </div>
                <strong>{Number(row.qty || 0).toLocaleString('ko-KR')}</strong>
              </article>
            ))}
          </div>
        </section>

        <section className="games-panel">
          <div className="games-panel-title">
            <h2>장비</h2>
            <span>{equips.length}개</span>
          </div>
          <div className="game-save-list">
            {equips.length ? equips.map((equip) => (
              <article className="game-save-row" key={equip.uid}>
                <div>
                  <span>공격 {equip.stats.atk || 0} · 명중 {equip.stats.acc || 0}</span>
                  <strong>{equip.name}</strong>
                </div>
                <button type="button" className="tcg-primary-action" onClick={() => setState((current) => equipWeaponAction(current, equip.uid))}>
                  {equip.equipped ? '장착 중' : '장착'}
                </button>
              </article>
            )) : <div className="games-empty">보유 장비가 없습니다.</div>}
          </div>
        </section>

        <section className="games-panel">
          <div className="games-panel-title">
            <h2>의뢰</h2>
            <span>{Object.keys(state.questClaims || {}).length}회 보고</span>
          </div>
          <div className="game-save-list">
            {quests.map((quest) => (
              <article className="game-save-row" key={quest.id}>
                <div>
                  <span>{quest.cadence} · {quest.progress}/{quest.required} · {quest.claimed ? '보고 완료' : quest.done ? '보고 가능' : '진행 중'}</span>
                  <strong>{quest.title}</strong>
                </div>
                <button type="button" className="tcg-primary-action" disabled={!quest.done || quest.claimed} onClick={() => setState((current) => claimQuestAction(current, quest.id))}>
                  {quest.claimed ? '완료' : '보고'}
                </button>
              </article>
            ))}
          </div>
        </section>
      </section>

      <section className="games-panel">
        <div className="games-panel-title">
          <h2>최근 로그</h2>
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
              </>
            ),
          },
        ]}
      />
    </GamePlayShell>
  );
}
