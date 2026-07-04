'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useToast } from '../../../../components/ToastProvider';
import { apiGet, apiPost, apiPut, clearApiGetCache } from '../../../../utils/api';
import { useAuthToken, useHydrated } from '../../../../utils/client-auth';
import GamePlayShell from '../../_components/GamePlayShell';
import {
  GAME_SLUG,
  QUICK_SAVE_SLOT,
  RECIPES,
  SAVE_VERSION,
  STUDENTS,
  achievementRows,
  attemptTowerAction,
  availableEnhanceSlots,
  autoSalvageAction,
  claimAchievementRewardsAction,
  buyTowerShopOfferAction,
  claimMissionRewardsAction,
  craftRecipeAction,
  createNewState,
  enhanceEquipmentAction,
  equipTitleAction,
  getEquippedList,
  getLeader,
  getPlayTimeSec,
  inventoryRows,
  itemName,
  missionRows,
  normalizeState,
  rerollEquipmentAction,
  resolveDutyAction,
  restAction,
  salvageRows,
  salvageSummary,
  salvageSelectedAction,
  scoreState,
  selectedSalvageSummary,
  setSalvageCandidateOnlyAction,
  slotLabel,
  summaryForState,
  teamPower,
  titleRows,
  towerShopRows,
} from '../_lib/schaleIdleEngine';

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

function formatRolls(equip) {
  const rolls = equip?.rolls || {};
  return [
    `화력 ${Math.round(Number(rolls.powerAddMul || 1) * 100)}%`,
    `계수 ${Math.round(Number(rolls.powerMulMul || 1) * 100)}%`,
    `스태미나 ${Math.round(Number(rolls.staminaMulMul || 1) * 100)}%`,
  ].join(' · ');
}

function formatAffixes(equip) {
  return (equip?.affixes || []).map((affix) => `${affix.locked ? '잠금 ' : ''}${affix.label} x${affix.value}`).join(', ');
}

export default function SchaleIdlePlayPage() {
  const token = useAuthToken();
  const hydrated = useHydrated();
  const { showToast } = useToast();
  const [state, setState] = useState(() => createNewState());
  const [recipeId, setRecipeId] = useState(RECIPES[0].id);
  const [enhanceSlot, setEnhanceSlot] = useState('');
  const [selectedSalvageUids, setSelectedSalvageUids] = useState([]);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');

  const equipped = useMemo(() => getEquippedList(state), [state]);
  const enhanceSlots = useMemo(() => availableEnhanceSlots(state), [state]);
  const rows = useMemo(() => inventoryRows(state), [state]);
  const missions = useMemo(() => missionRows(state), [state]);
  const achievements = useMemo(() => achievementRows(state), [state]);
  const titles = useMemo(() => titleRows(state), [state]);
  const salvage = useMemo(() => salvageRows(state), [state]);
  const salvageInfo = useMemo(() => salvageSummary(state), [state]);
  const validSelectedSalvageUids = useMemo(() => {
    const uidSet = new Set(salvage.map((entry) => entry.uid));
    return selectedSalvageUids.filter((uid) => uidSet.has(uid));
  }, [salvage, selectedSalvageUids]);
  const selectedSalvageInfo = useMemo(
    () => selectedSalvageSummary(state, validSelectedSalvageUids),
    [state, validSelectedSalvageUids],
  );
  const shopOffers = useMemo(() => towerShopRows(state), [state]);
  const leader = getLeader(state);
  const selectedRecipe = RECIPES.find((item) => item.id === recipeId) || RECIPES[0];
  const selectedSlot = enhanceSlot || enhanceSlots[0] || '';
  const selectedEquip = selectedSlot ? state.equipment?.[selectedSlot] : null;
  const power = teamPower(state);
  const score = scoreState(state);
  const claimableAchievements = achievements.filter((achievement) => achievement.canClaim).length;
  const equippedTitle = titles.find((title) => title.equipped);

  const saveRun = async () => {
    if (!token || busy) {
      setMessage('로그인하면 Schale Idle RPG 진행 상태를 서버 저장 슬롯에 저장할 수 있습니다.');
      return;
    }
    setBusy('save');
    try {
      await apiPut(`/game-saves/${GAME_SLUG}/${QUICK_SAVE_SLOT}`, {
        saveName: `Schale Idle F${state.maxClearedFloor} T${state.towerMaxCleared}`,
        version: SAVE_VERSION,
        summary: summaryForState(state),
        payload: { state },
        lastPlayedAt: new Date().toISOString(),
      }, { timeoutMs: 15000 });
      clearApiGetCache('/game-saves');
      setMessage('Schale Idle RPG 진행 상태를 저장했습니다.');
      showToast({ tone: 'success', message: 'Schale Idle RPG 진행 상태를 저장했습니다.' });
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
      setMessage('로그인하면 저장된 Schale Idle RPG 진행 상태를 불러올 수 있습니다.');
      return;
    }
    setBusy('load');
    try {
      const list = await apiGet(`/game-saves?gameSlug=${GAME_SLUG}`, { timeoutMs: 12000 });
      const quickSave = Array.isArray(list?.saves) ? list.saves.find((save) => save.slotKey === QUICK_SAVE_SLOT) : null;
      if (!quickSave?.id) {
        setMessage('저장된 Schale Idle RPG 진행 상태가 없습니다.');
        return;
      }
      const detail = await apiGet(`/game-saves/${quickSave.id}`, { timeoutMs: 12000 });
      setState(normalizeState(detail?.save?.payload?.state));
      setSelectedSalvageUids([]);
      setMessage('저장된 Schale Idle RPG 진행 상태를 불러왔습니다.');
      showToast({ tone: 'success', message: '저장된 Schale Idle RPG 진행 상태를 불러왔습니다.' });
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
      setMessage('로그인하면 Schale Idle RPG 진행 스냅샷을 전적에 남길 수 있습니다.');
      return;
    }
    setBusy('record');
    try {
      await apiPost(`/game-records/${GAME_SLUG}`, {
        title: `Schale Idle RPG Floor ${state.maxClearedFloor}`,
        mode: 'idle-rpg',
        result: 'account-progress',
        score,
        playTimeSec: getPlayTimeSec(state),
        summary: summaryForState(state),
        payload: { state },
      }, { timeoutMs: 15000 });
      clearApiGetCache('/game-records');
      setMessage('Schale Idle RPG 진행 스냅샷을 전적에 기록했습니다.');
      showToast({ tone: 'success', message: 'Schale Idle RPG 진행 스냅샷을 전적에 기록했습니다.' });
    } catch (err) {
      const nextMessage = err?.message || '전적 기록에 실패했습니다.';
      setMessage(nextMessage);
      showToast({ tone: 'danger', message: nextMessage });
    } finally {
      setBusy('');
    }
  };

  const startNewRun = () => {
    setState(createNewState());
    setRecipeId(RECIPES[0].id);
    setEnhanceSlot('');
    setSelectedSalvageUids([]);
    setMessage('');
  };

  const runAutoSalvage = () => {
    setState((current) => autoSalvageAction(current));
    setSelectedSalvageUids([]);
  };

  const runSelectedSalvage = () => {
    const selectedUids = validSelectedSalvageUids;
    setState((current) => salvageSelectedAction(current, selectedUids));
    setSelectedSalvageUids([]);
  };

  const toggleSalvageSelection = (uid) => {
    setSelectedSalvageUids((current) => (
      current.includes(uid) ? current.filter((item) => item !== uid) : [...current, uid]
    ));
  };

  const actions = (
    <>
      <button type="button" onClick={startNewRun}>새 당직</button>
      <button type="button" onClick={() => void saveRun()} disabled={!hydrated || busy === 'save'}>{busy === 'save' ? '저장 중...' : '저장'}</button>
      <button type="button" onClick={() => void loadRun()} disabled={!hydrated || busy === 'load'}>{busy === 'load' ? '불러오는 중...' : '불러오기'}</button>
      <button type="button" onClick={() => void recordRun()} disabled={!hydrated || busy === 'record'}>{busy === 'record' ? '기록 중...' : '전적 기록'}</button>
      <Link href="/myanime/schale-idle-rpg">상세</Link>
    </>
  );

  const metrics = [
    { label: '최고 층', value: state.maxClearedFloor },
    { label: '현재 층', value: state.floor },
    { label: '탑', value: `${state.towerMaxCleared}층` },
    { label: '전투력', value: power.toLocaleString('ko-KR') },
    { label: '크레딧', value: `${Number(state.credits || 0).toLocaleString('ko-KR')} Cr` },
    { label: '업적', value: `${achievements.filter((achievement) => achievement.claimed).length}/${achievements.length}` },
    { label: '점수', value: score.toLocaleString('ko-KR') },
  ];

  const messages = [
    message ? { key: 'message', text: message } : null,
    !token && hydrated ? { key: 'auth', text: '로그인하지 않아도 진행은 가능하지만 저장/불러오기/전적 기록은 로그인 후 사용할 수 있습니다.' } : null,
  ];

  return (
    <GamePlayShell
      kicker="Schale Idle RPG"
      title="샬레 당직 RPG"
      description="업로드된 Schale Idle RPG v1.34의 방치 정산, 장비 제작, 강화, 시련의 탑, 미션 보상 루프를 사이트용 playable slice로 이식했습니다."
      summaryLabel="Schale Idle RPG 요약"
      actions={actions}
      metrics={metrics}
      messages={messages}
    >
      <section className="games-detail-grid">
        <section className="games-panel">
          <div className="games-panel-title">
            <h2>방치 정산</h2>
            <span>{leader.name}</span>
          </div>
          <div className="games-rank-split">
            <SmallStat label="스태미나" value={`${state.stamina}/100`} />
            <SmallStat label="보스 처치" value={state.counters.KILL_BOSS} />
            <SmallStat label="누적 클리어" value={state.counters.CLEAR_FLOOR} />
            <SmallStat label="대사" value={leader.lines.clear} />
          </div>
          <label className="game-save-json-field">
            <span>리더</span>
            <select value={state.leaderStudentId} onChange={(event) => setState((current) => ({ ...current, leaderStudentId: event.target.value }))}>
              {STUDENTS.map((student) => <option value={student.id} key={student.id}>{student.name}</option>)}
            </select>
          </label>
          <div style={{ display: 'grid', gap: 8 }}>
            <ActionButton onClick={() => setState((current) => resolveDutyAction(current, 30))}>30분 정산</ActionButton>
            <ActionButton onClick={() => setState((current) => resolveDutyAction(current, 120))}>2시간 정산</ActionButton>
            <ActionButton onClick={() => setState((current) => restAction(current))}>재정비</ActionButton>
          </div>
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
          <ActionButton onClick={() => setState((current) => craftRecipeAction(current, recipeId))}>제작 실행</ActionButton>
        </section>

        <section className="games-panel">
          <div className="games-panel-title">
            <h2>강화 / 탑</h2>
            <span>열쇠 {Number(state.inventory.itm_tower_key || 0)}</span>
          </div>
          <label className="game-save-json-field">
            <span>강화 슬롯</span>
            <select value={selectedSlot} onChange={(event) => setEnhanceSlot(event.target.value)} disabled={!enhanceSlots.length}>
              {enhanceSlots.length ? enhanceSlots.map((slot) => <option value={slot} key={slot}>{slotLabel(slot)}</option>) : <option value="">장비 없음</option>}
            </select>
          </label>
          <div style={{ display: 'grid', gap: 8 }}>
            <ActionButton disabled={!selectedSlot} onClick={() => setState((current) => enhanceEquipmentAction(current, selectedSlot))}>선택 장비 강화</ActionButton>
            <ActionButton disabled={!selectedEquip} onClick={() => setState((current) => rerollEquipmentAction(current, selectedSlot))}>선택 장비 옵션 재련</ActionButton>
            <ActionButton disabled={!salvageInfo.executableCount} onClick={runAutoSalvage}>
              자동 분해 실행{salvageInfo.candidateOnly ? ' · 후보만' : ''}
            </ActionButton>
            <ActionButton onClick={() => setState((current) => attemptTowerAction(current, 1))}>탑 1회 도전</ActionButton>
            <ActionButton onClick={() => setState((current) => attemptTowerAction(current, 5))}>탑 5회 도전</ActionButton>
          </div>
        </section>
      </section>

      <section className="games-dashboard">
        <section className="games-panel">
          <div className="games-panel-title">
            <h2>장비</h2>
            <span>{equipped.length}개</span>
          </div>
          {equipped.length ? (
            <div className="game-save-list">
              {equipped.map((equip) => (
                <article className="game-save-row" key={equip.uid}>
                  <div>
                    <span>{slotLabel(equip.slot)} · {equip.rarity}</span>
                    <strong>{equip.name}</strong>
                    <small>{formatRolls(equip)}</small>
                    <small>{formatAffixes(equip) || '옵션 없음'}</small>
                  </div>
                  <strong>+{equip.enhance || 0}</strong>
                </article>
              ))}
            </div>
          ) : <div className="games-empty">장착 중인 장비가 없습니다. 제작으로 장비를 확보하세요.</div>}
        </section>

        <section className="games-panel">
          <div className="games-panel-title">
            <h2>인벤토리</h2>
            <span>{rows.length}종</span>
          </div>
          <div className="game-save-list">
            {rows.slice(0, 14).map((row) => (
              <article className="game-save-row" key={row.itemId}>
                <div>
                  <span>{row.rarity}</span>
                  <strong>{row.name}</strong>
                </div>
                <strong>{Number(row.qty || 0).toLocaleString('ko-KR')}</strong>
              </article>
            ))}
          </div>
        </section>

        <section className="games-panel">
          <div className="games-panel-title">
            <h2>타워 상점</h2>
            <span>토큰 {Number(state.inventory.itm_tower_token || 0)}</span>
          </div>
          <div className="game-save-list">
            {shopOffers.map((offer) => (
              <article className="game-save-row" key={offer.id}>
                <div>
                  <span>{offer.costText} · {offer.limitText}</span>
                  <strong>{offer.name}</strong>
                  <small>남은 구매 {offer.remaining}</small>
                </div>
                <button type="button" disabled={!offer.canBuy} onClick={() => setState((current) => buyTowerShopOfferAction(current, offer.id))}>구매</button>
              </article>
            ))}
          </div>
        </section>

        <section className="games-panel">
          <div className="games-panel-title">
            <h2>분해 대기열</h2>
            <button type="button" className="tcg-primary-action" disabled={!salvageInfo.executableCount} onClick={runAutoSalvage}>
              자동 분해{salvageInfo.candidateOnly ? ' · 후보만' : ''}
            </button>
          </div>
          {salvage.length ? (
            <>
              <div className="games-chip-row" style={{ marginBottom: 12 }}>
                <button
                  type="button"
                  className={`schale-salvage-toggle${salvageInfo.candidateOnly ? ' is-on' : ''}`}
                  onClick={() => setState((current) => setSalvageCandidateOnlyAction(current, !salvageInfo.candidateOnly))}
                >
                  후보만 분해
                  {salvageInfo.candidateOnly ? <span>ON</span> : <span>OFF</span>}
                </button>
                <button
                  type="button"
                  className="schale-salvage-toggle"
                  disabled={!salvageInfo.executableCount}
                  onClick={() => setSelectedSalvageUids(salvage.filter((entry) => entry.executable).map((entry) => entry.uid))}
                >
                  실행 대상 선택
                </button>
                <button
                  type="button"
                  className="schale-salvage-toggle"
                  disabled={!validSelectedSalvageUids.length}
                  onClick={() => setSelectedSalvageUids([])}
                >
                  선택 해제
                </button>
                <button
                  type="button"
                  className="tcg-primary-action"
                  disabled={!selectedSalvageInfo.executableCount}
                  onClick={runSelectedSalvage}
                >
                  선택 분해
                </button>
              </div>
              <div className="games-empty" style={{ textAlign: 'left', marginBottom: 12 }}>
                {salvageInfo.candidateOnly ? (
                  <>
                    <strong>후보만 분해 ON</strong> · 실행 대상 {salvageInfo.executableCount}개 / 보호 유지 {salvageInfo.protectedByCandidateOnly}개입니다.
                    장착 장비 {salvageInfo.protectedEquipped}개는 별도로 보호 중입니다.
                  </>
                ) : (
                  <>
                    <strong>후보만 분해 OFF</strong> · 전체 대기열 {salvageInfo.totalQueued}개를 자동 분해 대상으로 처리합니다.
                    위험 후보까지 포함되므로 실행 전 목록을 확인하세요.
                  </>
                )}
              </div>
              <div className="games-rank-split" style={{ marginBottom: 12 }}>
                <SmallStat label="대기열" value={`${salvageInfo.totalQueued}개`} />
                <SmallStat label="실행 대상" value={`${salvageInfo.executableCount}개`} />
                <SmallStat label="보호" value={`${salvageInfo.protectedByCandidateOnly}개`} />
                <SmallStat label="고철" value={salvageInfo.totals.scrap} />
                <SmallStat label="강화석" value={salvageInfo.totals.stone} />
                <SmallStat label="리롤권" value={salvageInfo.totals.ticket} />
                <SmallStat label="위험 후보" value={`${salvageInfo.highRiskCount}개`} />
              </div>
              {validSelectedSalvageUids.length ? (
                <div className="games-empty" style={{ textAlign: 'left', marginBottom: 12 }}>
                  <strong>선택 {selectedSalvageInfo.selectedCount}개</strong>
                  {' · '}
                  실행 {selectedSalvageInfo.executableCount}개 / 보호 {selectedSalvageInfo.protectedByCandidateOnly}개
                  {' · '}
                  예상 보상 {selectedSalvageInfo.totalRewardText}
                  {selectedSalvageInfo.candidateOnly && selectedSalvageInfo.highRiskCount ? ' · 위험 후보는 보호됩니다.' : ''}
                </div>
              ) : null}
              <div className="game-save-list">
                <article className="game-save-row">
                  <div>
                    <span>희귀도: {salvageInfo.byRarityText}</span>
                    <strong>슬롯 분포: {salvageInfo.bySlotText}</strong>
                  </div>
                </article>
                {salvageInfo.highRiskCount ? (
                  <article className="game-save-row">
                    <div>
                      <span>RARE 이상 / 강화 +3 이상 / 점수 120 이상</span>
                      <strong>위험 후보 상위: {salvageInfo.topRiskRows.map((entry) => `${entry.name}(${entry.score})`).join(', ')}</strong>
                    </div>
                    <strong>주의</strong>
                  </article>
                ) : null}
                {salvage.slice(0, 8).map((entry) => (
                  <article className="game-save-row" key={`${entry.uid}-${entry.createdAt}`}>
                    <div>
                      <span>{slotLabel(entry.slot)} · {entry.rarity} · {entry.reason}</span>
                      <strong>{entry.name}</strong>
                      <small>{entry.rewardText}</small>
                      <small>점수 {entry.score} · {entry.executable ? '실행 대상' : '보호'}</small>
                    </div>
                    <label className="schale-salvage-check">
                      <input
                        type="checkbox"
                        checked={validSelectedSalvageUids.includes(entry.uid)}
                        onChange={() => toggleSalvageSelection(entry.uid)}
                      />
                      <span>선택</span>
                    </label>
                  </article>
                ))}
              </div>
            </>
          ) : <div className="games-empty">분해 대기 중인 장비가 없습니다.</div>}
        </section>

        <section className="games-panel">
          <div className="games-panel-title">
            <h2>미션</h2>
            <button type="button" className="tcg-primary-action" onClick={() => setState((current) => claimMissionRewardsAction(current))}>보상 수령</button>
          </div>
          <div className="game-save-list">
            {missions.map((mission) => (
              <article className="game-save-row" key={mission.id}>
                <div>
                  <span>{mission.type} · {mission.progress}/{mission.target}</span>
                  <strong>{mission.name}</strong>
                </div>
                <strong>{mission.claimed ? '수령' : mission.done ? '완료' : '진행'}</strong>
              </article>
            ))}
          </div>
        </section>

        <section className="games-panel">
          <div className="games-panel-title">
            <h2>업적</h2>
            <button type="button" className="tcg-primary-action" disabled={!claimableAchievements} onClick={() => setState((current) => claimAchievementRewardsAction(current))}>
              {claimableAchievements ? `${claimableAchievements}개 수령` : '수령 없음'}
            </button>
          </div>
          <div className="game-save-list">
            {achievements.map((achievement) => (
              <article className="game-save-row" key={achievement.id}>
                <div>
                  <span>{achievement.progress}/{achievement.target}{achievement.titleName ? ` · ${achievement.titleName}` : ''}</span>
                  <strong>{achievement.name}</strong>
                  <small>{achievement.desc}</small>
                </div>
                <strong>{achievement.claimed ? '수령' : achievement.done ? '완료' : '진행'}</strong>
              </article>
            ))}
          </div>
        </section>

        <section className="games-panel">
          <div className="games-panel-title">
            <h2>칭호</h2>
            <span>{equippedTitle ? equippedTitle.name : '미장착'}</span>
          </div>
          <div className="game-save-list">
            {titles.map((title) => (
              <article className="game-save-row" key={title.id}>
                <div>
                  <span>{title.kind === 'POWER_MUL' ? '전투력' : '크레딧'} x{Number(title.mul || 1).toFixed(2)}</span>
                  <strong>{title.name}</strong>
                  <small>{title.desc}</small>
                </div>
                <button type="button" disabled={!title.unlocked} onClick={() => setState((current) => equipTitleAction(current, title.equipped ? null : title.id))}>
                  {title.equipped ? '해제' : title.unlocked ? '장착' : '잠김'}
                </button>
              </article>
            ))}
          </div>
        </section>
      </section>

      <section className="games-dashboard">
        <section className="games-panel">
          <div className="games-panel-title">
            <h2>근무 보고서</h2>
            <span>{state.lastDutyReport ? `${state.lastDutyReport.fromFloor}-${state.lastDutyReport.toFloor}층` : '없음'}</span>
          </div>
          {state.lastDutyReport ? (
            <div className="games-activity-list">
              <div>
                <strong>획득 {Number(state.lastDutyReport.totalCreditsGained || 0).toLocaleString('ko-KR')} Cr · {state.lastDutyReport.stoppedReason}</strong>
              </div>
              {(state.lastDutyReport.highlights || []).map((line, index) => (
                <div key={`${line}-${index}`}>
                  <strong>{line}</strong>
                </div>
              ))}
            </div>
          ) : <div className="games-empty">아직 방치 정산 보고서가 없습니다.</div>}
        </section>

        <section className="games-panel">
          <div className="games-panel-title">
            <h2>탑 보고서</h2>
            <span>{state.towerLastBatchReport ? `${state.towerLastBatchReport.successes}승 ${state.towerLastBatchReport.failures}패` : '없음'}</span>
          </div>
          {state.towerLastBatchReport ? (
            <div className="games-activity-list">
              <div>
                <strong>획득 {Number(state.towerLastBatchReport.creditsGained || 0).toLocaleString('ko-KR')} Cr · 토큰 {Number(state.towerLastBatchReport.tokensGained || 0)}</strong>
              </div>
              {(state.towerLastBatchReport.logs || []).map((line, index) => (
                <div key={`${line}-${index}`}>
                  <strong>{line}</strong>
                </div>
              ))}
            </div>
          ) : <div className="games-empty">아직 탑 도전 보고서가 없습니다.</div>}
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
    </GamePlayShell>
  );
}
