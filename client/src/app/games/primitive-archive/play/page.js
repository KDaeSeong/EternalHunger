'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useToast } from '../../../../components/ToastProvider';
import { apiGet, apiPost, apiPut, clearApiGetCache } from '../../../../utils/api';
import { useAuthToken, useHydrated } from '../../../../utils/client-auth';
import GamePlayShell from '../../_components/GamePlayShell';
import {
  EQUIPMENT_SLOT_LABELS,
  GAME_SLUG,
  ITEMS,
  QUICK_SAVE_SLOT,
  RECIPES,
  SAVE_VERSION,
  ZONES,
  actionChance,
  averageParty,
  buyPerkAction,
  createNewState,
  equipmentChoicesForSlot,
  equipmentInventoryRows,
  equipmentRows,
  formatRequires,
  getActor,
  getPlayTimeSec,
  itemName,
  normalizeState,
  partyInsulation,
  perkRows,
  researchSummary,
  runCampAction,
  runCraftAction,
  runEatAction,
  runGatherAction,
  runHuntAction,
  runResearchAction,
  runRestAction,
  scoreState,
  selectTechAction,
  setEquipmentSlotAction,
  settleRunAction,
  startNewRunFromMeta,
  summaryForState,
  techRows,
  totalCarryWeight,
} from '../_lib/primitiveArchiveEngine';

function ActionButton({ children, disabled, onClick }) {
  return (
    <button type="button" className="tcg-primary-action" disabled={disabled} onClick={onClick}>
      {children}
    </button>
  );
}

const PARTY_SORT_OPTIONS = [
  { value: 'default', label: '기본' },
  { value: 'recommend', label: '추천' },
  { value: 'stamina', label: '스태미나' },
  { value: 'success', label: '성공률' },
];

function clampRatio(value) {
  return Math.max(0, Math.min(1, Number(value || 0)));
}

function chanceText(value) {
  return `${Math.round(clampRatio(value) * 100)}%`;
}

function roleActionForMember(member) {
  if (member?.role === '사냥') return 'hunt';
  if (member?.role === '제작') return 'craft';
  return 'gather';
}

function actionLabel(action) {
  if (action === 'hunt') return '사냥';
  if (action === 'craft') return '제작';
  return '채집';
}

function vitalBadges(member) {
  const badges = [];
  if (Number(member.hp || 0) <= 0) badges.push('탈진');
  else if (Number(member.hp || 0) <= 35) badges.push('부상');
  if (Number(member.hunger || 0) >= 80) badges.push('허기');
  if (Number(member.stamina || 0) <= 25) badges.push('피로');
  if (!badges.length) badges.push('양호');
  return badges;
}

export default function PrimitiveArchivePlayPage() {
  const token = useAuthToken();
  const hydrated = useHydrated();
  const { showToast } = useToast();
  const [state, setState] = useState(() => createNewState());
  const [actorId, setActorId] = useState('shiroko');
  const [zoneId, setZoneId] = useState('forest');
  const [recipeId, setRecipeId] = useState('twine');
  const [partySort, setPartySort] = useState('default');
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');

  const actor = getActor(state, actorId);
  const zone = ZONES.find((row) => row.id === zoneId) || ZONES[0];
  const recipe = RECIPES.find((row) => row.id === recipeId) || RECIPES[0];
  const hp = averageParty(state, 'hp');
  const hunger = averageParty(state, 'hunger');
  const stamina = averageParty(state, 'stamina');
  const score = scoreState(state);
  const dead = state.ended || hp <= 0;
  const canAct = !dead && state.ap > 0;
  const gatherChance = actionChance(state, actorId, 'gather', 0.5);
  const huntChance = actionChance(state, actorId, 'hunt', 0.42);
  const craftChance = recipe ? actionChance(state, actorId, 'craft', recipe.baseChance - 0.18) : 0;
  const research = useMemo(() => researchSummary(state), [state]);
  const techs = useMemo(() => techRows(state), [state]);
  const perks = useMemo(() => perkRows(state), [state]);
  const currentEquipmentRows = useMemo(() => equipmentRows(state, actorId), [state, actorId]);
  const equipmentInventory = useMemo(() => equipmentInventoryRows(state), [state]);
  const insulation = partyInsulation(state);
  const partyView = useMemo(() => {
    const rows = state.party.map((member, index) => {
      const chances = {
        gather: actionChance(state, member.id, 'gather', 0.5),
        hunt: actionChance(state, member.id, 'hunt', 0.42),
        craft: actionChance(state, member.id, 'craft', recipe.baseChance - 0.18),
      };
      const basisAction = roleActionForMember(member);
      const basisChance = chances[basisAction];
      const staminaRatio = clampRatio(Number(member.stamina || 0) / 100);
      const hpRatio = clampRatio(Number(member.hp || 0) / 100);
      const hungerSafety = clampRatio((100 - Number(member.hunger || 0)) / 100);
      const recommendScore = basisChance * 0.62 + staminaRatio * 0.22 + hpRatio * 0.08 + hungerSafety * 0.08;
      return {
        member,
        index,
        chances,
        basisAction,
        basisChance,
        staminaRatio,
        recommendScore,
        badges: vitalBadges(member),
      };
    });

    if (partySort === 'stamina') return rows.sort((a, b) => b.staminaRatio - a.staminaRatio || a.index - b.index);
    if (partySort === 'success') return rows.sort((a, b) => b.basisChance - a.basisChance || a.index - b.index);
    if (partySort === 'recommend') return rows.sort((a, b) => b.recommendScore - a.recommendScore || a.index - b.index);
    return rows;
  }, [partySort, recipe.baseChance, state]);
  const inventoryRows = Object.entries(state.inventory)
    .filter(([, qty]) => Number(qty || 0) > 0)
    .sort(([a], [b]) => itemName(a).localeCompare(itemName(b), 'ko-KR'));

  const runGather = () => {
    if (!canAct) return;
    setState((current) => runGatherAction(current, actorId, zoneId));
  };

  const runHunt = () => {
    if (!canAct) return;
    setState((current) => runHuntAction(current, actorId, zoneId));
  };

  const runCraft = () => {
    if (!canAct || !recipe) return;
    setState((current) => runCraftAction(current, actorId, recipeId));
  };

  const runEat = () => {
    if (!canAct) return;
    setState((current) => runEatAction(current, actorId));
  };

  const runRest = () => {
    if (!canAct) return;
    setState((current) => runRestAction(current, actorId));
  };

  const runResearch = () => {
    if (!canAct) return;
    setState((current) => runResearchAction(current, actorId));
  };

  const runCamp = (kind) => {
    if (!canAct) return;
    setState((current) => runCampAction(current, actorId, kind));
  };

  const saveRun = async () => {
    if (!token || busy) {
      setMessage('로그인하면 런을 서버 저장 슬롯에 저장할 수 있습니다.');
      return;
    }
    setBusy('save');
    try {
      await apiPut(`/game-saves/${GAME_SLUG}/${QUICK_SAVE_SLOT}`, {
        saveName: `Primitive Archive Day ${state.day}`,
        version: SAVE_VERSION,
        summary: summaryForState(state),
        payload: { state },
        lastPlayedAt: new Date().toISOString(),
      }, { timeoutMs: 15000 });
      clearApiGetCache('/game-saves');
      setMessage('런을 저장했습니다.');
      showToast({ tone: 'success', message: 'Primitive Archive 런을 저장했습니다.' });
    } catch (err) {
      const nextMessage = err?.message || '런 저장에 실패했습니다.';
      setMessage(nextMessage);
      showToast({ tone: 'danger', message: nextMessage });
    } finally {
      setBusy('');
    }
  };

  const loadRun = async () => {
    if (!token || busy) {
      setMessage('로그인하면 저장된 런을 불러올 수 있습니다.');
      return;
    }
    setBusy('load');
    try {
      const list = await apiGet(`/game-saves?gameSlug=${GAME_SLUG}`, { timeoutMs: 12000 });
      const quickSave = Array.isArray(list?.saves) ? list.saves.find((save) => save.slotKey === QUICK_SAVE_SLOT) : null;
      if (!quickSave?.id) {
        setMessage('저장된 Primitive Archive 런이 없습니다.');
        return;
      }
      const detail = await apiGet(`/game-saves/${quickSave.id}`, { timeoutMs: 12000 });
      setState(normalizeState(detail?.save?.payload?.state));
      setMessage('저장된 런을 불러왔습니다.');
      showToast({ tone: 'success', message: '저장된 런을 불러왔습니다.' });
    } catch (err) {
      const nextMessage = err?.message || '저장 불러오기에 실패했습니다.';
      setMessage(nextMessage);
      showToast({ tone: 'danger', message: nextMessage });
    } finally {
      setBusy('');
    }
  };

  const recordRun = async () => {
    if (!token || busy) {
      setMessage('로그인하면 런 결과를 전적에 남길 수 있습니다.');
      return;
    }
    setBusy('record');
    try {
      const result = hp <= 0 ? 'fail' : 'clear';
      await apiPost(`/game-records/${GAME_SLUG}`, {
        title: `Primitive Archive Day ${state.day}`,
        mode: 'survival-loop',
        result,
        score,
        playTimeSec: getPlayTimeSec(state),
        summary: summaryForState(state),
        payload: { state },
      }, { timeoutMs: 15000 });
      clearApiGetCache('/game-records');
      setMessage('런 결과를 전적에 기록했습니다.');
      showToast({ tone: 'success', message: '런 결과를 전적에 기록했습니다.' });
      setState((current) => settleRunAction(current));
    } catch (err) {
      const nextMessage = err?.message || '전적 기록에 실패했습니다.';
      setMessage(nextMessage);
      showToast({ tone: 'danger', message: nextMessage });
    } finally {
      setBusy('');
    }
  };

  const startNewRun = () => {
    setState((current) => startNewRunFromMeta(current));
    setActorId('shiroko');
    setZoneId('forest');
    setRecipeId('twine');
    setMessage('');
  };

  const playActions = (
    <>
      <button type="button" onClick={startNewRun}>새 런</button>
      <button type="button" onClick={() => void saveRun()} disabled={!hydrated || busy === 'save'}>{busy === 'save' ? '저장 중...' : '저장'}</button>
      <button type="button" onClick={() => void loadRun()} disabled={!hydrated || busy === 'load'}>{busy === 'load' ? '불러오는 중...' : '불러오기'}</button>
      <button type="button" onClick={() => void recordRun()} disabled={!hydrated || busy === 'record'}>{busy === 'record' ? '기록 중...' : '런 기록'}</button>
      <button type="button" onClick={() => setState((current) => settleRunAction(current))}>런 정산</button>
      <Link href="/myanime/primitive-archive">상세</Link>
    </>
  );

  const playMetrics = [
    { label: 'Day', value: state.day },
    { label: 'AP', value: `${state.ap}/${state.apMax}` },
    { label: 'HP', value: hp },
    { label: '허기', value: hunger },
    { label: '스태미나', value: stamina },
    { label: '보온', value: insulation },
    { label: '연구', value: `${research.completed}/${research.total}` },
    { label: '특전', value: state.meta.perkPoints },
    { label: '무게', value: totalCarryWeight(state) },
    { label: '점수', value: score.toLocaleString('ko-KR') },
  ];

  const playMessages = [
    message ? { key: 'message', text: message } : null,
    !token && hydrated ? { key: 'auth', text: '로그인하지 않아도 플레이는 가능하지만, 저장/불러오기/전적 기록은 로그인해야 사용할 수 있습니다.' } : null,
    dead ? { key: 'dead', tone: 'error', text: '런이 종료 상태입니다. 결과를 기록하거나 새 런을 시작하세요.' } : null,
  ];

  return (
    <GamePlayShell
      kicker="Primitive Archive"
      title="원시 아카이브"
      description="학생 파티가 원시 지대에서 채집, 사냥, 제작, 캠프를 반복하며 며칠이나 버티는지 보는 첫 이식 slice입니다."
      summaryLabel="Primitive Archive 요약"
      actions={playActions}
      metrics={playMetrics}
      messages={playMessages}
    >
        <section className="games-detail-grid">
          <section className="games-panel">
            <div className="games-panel-title">
              <h2>파티</h2>
              <span>{state.weather.name} · {state.weather.temp}°C</span>
            </div>
            <label className="game-save-json-field">
              <span>정렬</span>
              <select value={partySort} onChange={(event) => setPartySort(event.target.value)}>
                {PARTY_SORT_OPTIONS.map((option) => (
                  <option value={option.value} key={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
            <div style={{ display: 'grid', gap: 10 }}>
              {partyView.map(({ member, chances, basisAction, basisChance, badges }) => (
                <button
                  type="button"
                  key={member.id}
                  onClick={() => setActorId(member.id)}
                  style={{
                    minWidth: 0,
                    display: 'grid',
                    gridTemplateColumns: '52px minmax(0, 1fr)',
                    gap: 10,
                    alignItems: 'center',
                    border: actorId === member.id ? '1px solid rgba(56, 189, 248, 0.75)' : '1px solid rgba(148, 163, 184, 0.22)',
                    borderRadius: 8,
                    background: actorId === member.id ? 'rgba(8, 47, 73, 0.56)' : 'rgba(15, 23, 42, 0.46)',
                    color: '#f8fafc',
                    padding: 9,
                    textAlign: 'left',
                    cursor: 'pointer',
                  }}
                >
                  <Image src={member.portrait} alt={member.name} width={52} height={52} />
                  <span>
                    <strong style={{ display: 'block' }}>{member.name} · {member.role}</strong>
                    <small style={{ display: 'block', color: '#cbd5e1', marginTop: 3 }}>
                      HP {member.hp} · 허기 {member.hunger} · ST {member.stamina} · {badges.join(' / ')}
                    </small>
                    <small style={{ display: 'block', color: '#bae6fd', marginTop: 3 }}>
                      추천 {actionLabel(basisAction)} {chanceText(basisChance)} · 채집 {chanceText(chances.gather)} · 사냥 {chanceText(chances.hunt)} · 제작 {chanceText(chances.craft)}
                    </small>
                    <small style={{ display: 'block', color: '#94a3b8', marginTop: 3 }}>{member.trait}</small>
                  </span>
                </button>
              ))}
            </div>
          </section>

          <section className="games-panel">
            <div className="games-panel-title">
              <h2>행동</h2>
              <span>{actor?.name || '대상'} 선택 중</span>
            </div>

            <label className="game-save-json-field">
              <span>지역</span>
              <select value={zoneId} onChange={(event) => setZoneId(event.target.value)}>
                {ZONES.map((row) => <option value={row.id} key={row.id}>{row.name}</option>)}
              </select>
            </label>
            <p style={{ color: '#cbd5e1', fontWeight: 800, lineHeight: 1.5 }}>{zone.note}</p>

            <div style={{ display: 'grid', gap: 8 }}>
              <ActionButton disabled={!canAct} onClick={runGather}>채집 · 성공 {Math.round(gatherChance * 100)}%</ActionButton>
              <ActionButton disabled={!canAct} onClick={runHunt}>사냥 · 성공 {Math.round(huntChance * 100)}%</ActionButton>
              <ActionButton disabled={!canAct} onClick={runEat}>식사</ActionButton>
              <ActionButton disabled={!canAct} onClick={runRest}>휴식</ActionButton>
            </div>

            <hr style={{ width: '100%', border: 0, borderTop: '1px solid rgba(148, 163, 184, 0.18)' }} />

            <label className="game-save-json-field">
              <span>제작</span>
              <select value={recipeId} onChange={(event) => setRecipeId(event.target.value)}>
                {RECIPES.map((row) => <option value={row.id} key={row.id}>{row.name}</option>)}
              </select>
            </label>
            <p style={{ color: '#cbd5e1', fontWeight: 800, lineHeight: 1.5 }}>
              필요: {formatRequires(recipe.requires)} · {recipe.note}
            </p>
            <ActionButton disabled={!canAct} onClick={runCraft}>제작 · 성공 {Math.round(craftChance * 100)}%</ActionButton>
          </section>

          <section className="games-panel">
            <div className="games-panel-title">
              <h2>캠프</h2>
              <span>연료 {state.camp.fuel}</span>
            </div>
            <div className="games-rank-split">
              <div><span>모닥불</span><strong>Lv.{state.camp.fireLevel}</strong></div>
              <div><span>대피소</span><strong>Lv.{state.camp.shelterLevel}</strong></div>
              <div><span>작업대</span><strong>Lv.{state.camp.workbenchLevel}</strong></div>
            </div>
            <div style={{ display: 'grid', gap: 8 }}>
              <ActionButton disabled={!canAct} onClick={() => runCamp('fuel')}>연료 넣기 · 나무 1</ActionButton>
              <ActionButton disabled={!canAct} onClick={() => runCamp('fire')}>모닥불 강화 · 나무 2, 돌 2</ActionButton>
              <ActionButton disabled={!canAct} onClick={() => runCamp('shelter')}>대피소 강화 · 나무 3, 섬유 2, 가죽 1</ActionButton>
              <ActionButton disabled={!canAct} onClick={() => runCamp('workbench')}>작업대 제작 · 나무 4, 돌 2</ActionButton>
              <ActionButton disabled={!canAct} onClick={() => runCamp('cook')}>고기 굽기 · 고기 1, 연료 1</ActionButton>
            </div>
          </section>

          <section className="games-panel">
            <div className="games-panel-title">
              <h2>장비</h2>
              <span>{actor?.name || '대상'} · 보온 {actor ? currentEquipmentRows.reduce((sum, row) => sum + Number(row.insulation || 0), 0) : 0}</span>
            </div>
            <div className="game-save-list">
              {currentEquipmentRows.map((row) => {
                const choices = equipmentChoicesForSlot(state, actorId, row.slot);
                return (
                  <article className="game-save-row" key={row.slot}>
                    <div>
                      <span>{row.label}{row.successText ? ` · ${row.successText}` : ''}</span>
                      <strong>{row.itemName}</strong>
                    </div>
                    <select
                      value={row.itemId}
                      onChange={(event) => setState((current) => setEquipmentSlotAction(current, actorId, row.slot, event.target.value))}
                    >
                      {choices.map((choice) => (
                        <option value={choice.itemId} key={`${row.slot}-${choice.itemId || 'none'}`}>
                          {choice.name}{choice.qty ? ` x${choice.qty}` : ''}
                        </option>
                      ))}
                    </select>
                  </article>
                );
              })}
            </div>
            <div className="games-panel-title" style={{ marginTop: 16 }}>
              <h2>장비 보유</h2>
              <span>{equipmentInventory.reduce((sum, item) => sum + Number(item.qty || 0), 0)}개</span>
            </div>
            <div className="games-chip-row">
              {equipmentInventory.length ? equipmentInventory.map((item) => (
                <span className="games-tag" key={item.itemId}>
                  {EQUIPMENT_SLOT_LABELS[item.slot] || item.slot} · {item.name} x{item.qty}
                </span>
              )) : <span className="games-tag">보유 장비 없음</span>}
            </div>
          </section>
        </section>

        <section className="games-dashboard">
          <section className="games-panel">
            <div className="games-panel-title">
              <h2>연구</h2>
              <span>{research.completed}/{research.total}</span>
            </div>
            <label className="game-save-json-field">
              <span>목표 기술</span>
              <select
                value={state.research.selectedTechId}
                onChange={(event) => setState((current) => selectTechAction(current, event.target.value))}
              >
                {techs.map((tech) => (
                  <option value={tech.id} key={tech.id} disabled={!tech.available && !tech.completed && !tech.selected}>
                    {tech.completed ? '완료 · ' : tech.selected ? '선택 · ' : tech.available ? '가능 · ' : '잠김 · '}
                    {tech.name} ({tech.progress}/{tech.cost})
                  </option>
                ))}
              </select>
            </label>
            <div className="games-rank-split">
              <div><span>선택</span><strong>{research.selected?.name || '-'}</strong></div>
              <div><span>진행</span><strong>{research.selected?.progressPct || 0}%</strong></div>
              <div><span>가능</span><strong>{research.available}</strong></div>
            </div>
            <p style={{ color: '#cbd5e1', fontWeight: 800, lineHeight: 1.5 }}>
              유레카: {research.selected?.eureka?.desc || '없음'} {research.selected?.eurekaDone ? '· 달성' : ''}
            </p>
            <ActionButton disabled={!canAct || !research.selected?.available} onClick={runResearch}>
              연구 실행
            </ActionButton>
          </section>

          <section className="games-panel">
            <div className="games-panel-title">
              <h2>특전</h2>
              <span>{state.meta.perkPoints} pt</span>
            </div>
            <div className="game-save-list">
              {perks.map((perk) => (
                <article className="game-save-row" key={perk.id}>
                  <div>
                    <span>Lv.{perk.level}/{perk.maxLevel} · 비용 {perk.cost}</span>
                    <strong>{perk.name}</strong>
                    <small style={{ display: 'block', color: '#94a3b8', marginTop: 4 }}>{perk.desc}</small>
                  </div>
                  <button
                    type="button"
                    className="tcg-primary-action"
                    disabled={!perk.canBuy}
                    onClick={() => setState((current) => buyPerkAction(current, perk.id))}
                  >
                    {perk.maxed ? '완료' : '구매'}
                  </button>
                </article>
              ))}
            </div>
          </section>
        </section>

        <section className="games-dashboard">
          <section className="games-panel">
            <div className="games-panel-title">
              <h2>인벤토리</h2>
              <span>{totalCarryWeight(state).toLocaleString('ko-KR')} 무게</span>
            </div>
            {inventoryRows.length ? (
              <div className="game-save-list">
                {inventoryRows.map(([id, qty]) => (
                  <article className="game-save-row" key={id}>
                    <div>
                      <span>{ITEMS[id]?.icon || 'item'}</span>
                      <strong>{itemName(id)}</strong>
                    </div>
                    <strong>{Number(qty || 0).toLocaleString('ko-KR')}</strong>
                  </article>
                ))}
              </div>
            ) : <div className="games-empty">보유 아이템이 없습니다.</div>}
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
    </GamePlayShell>
  );
}
