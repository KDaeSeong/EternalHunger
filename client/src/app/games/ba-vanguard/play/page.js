'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useToast } from '../../../../components/ToastProvider';
import { apiGet, apiPost, apiPut, clearApiGetCache } from '../../../../utils/api';
import { useAuthToken, useHydrated } from '../../../../utils/client-auth';
import GamePlayShell from '../../_components/GamePlayShell';
import {
  CARDS,
  CIRCLES,
  DEFAULT_RULES,
  GAME_SLUG,
  PRESET_DECKS,
  QUICK_SAVE_SLOT,
  SAVE_VERSION,
  SIDE_LABELS,
  activateVCAct,
  advancePhase,
  aiStep,
  autoRide,
  callFromHand,
  canAttack,
  cardName,
  deckConsistencyReport,
  declareAttack,
  drawOpeningHand,
  endTurn,
  getCard,
  getPreset,
  guardAddFromHand,
  guardEnd,
  guardGGuardian,
  initDuelState,
  mulliganAll,
  normalizeRules,
  retireCircle,
  rideFromHand,
  scoreDeck,
  strideWithAutoCost,
  summarizeDeck,
  summarizeDuel,
  validateDeck,
} from '../_lib/baVanguardCatalog';

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function unitPower(unit) {
  if (!unit) return 0;
  const card = getCard(unit.cardId);
  return Number(card?.power || 0) + Number(unit.powerMod || 0);
}

function typeLabel(type) {
  return {
    starter: '스타터',
    trigger: '트리거',
    sentinel: '센티넬',
    normal: '노멀',
    'g-unit': 'G 유닛',
    'g-guardian': 'G 가디언',
  }[type] || type;
}

function SmallStat({ label, value }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function CardSummary({ cardId, right, active, onClick }) {
  const card = getCard(cardId);
  if (!card) return null;
  const content = (
    <>
      <div>
        <span>G{card.grade} · {typeLabel(card.type)}{card.trigger ? ` · ${card.trigger}` : ''}</span>
        <strong>{card.name}</strong>
        <small>{card.text}</small>
      </div>
      <strong>{right || Number(card.power || card.shield || 0).toLocaleString('ko-KR')}</strong>
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        className="game-save-row"
        onClick={onClick}
        style={{
          borderColor: active ? '#38bdf8' : undefined,
          boxShadow: active ? '0 0 0 2px rgba(56, 189, 248, 0.22)' : undefined,
          textAlign: 'left',
          width: '100%',
        }}
      >
        {content}
      </button>
    );
  }
  return <article className="game-save-row">{content}</article>;
}

function DeckEntryLine({ cardId, count }) {
  const card = getCard(cardId);
  if (!card) return null;
  return (
    <article className="game-save-row">
      <div>
        <span>G{card.grade} · {typeLabel(card.type)}</span>
        <strong>{card.name}</strong>
      </div>
      <strong>{count}</strong>
    </article>
  );
}

const ZONE_LABELS = {
  deck: '덱',
  hand: '패',
  soul: '소울',
  damage: '데미지',
  drop: '드롭',
  removed: '제외',
  gzone: 'G존',
};

function ZonePill({ label, value, active, onClick }) {
  if (onClick) {
    return (
      <button
        type="button"
        className="games-filter-chip"
        onClick={onClick}
        aria-pressed={active}
        style={{
          borderColor: active ? '#38bdf8' : undefined,
          color: active ? '#e0f2fe' : undefined,
          cursor: 'pointer',
        }}
      >
        {label} {value}
      </button>
    );
  }
  return <span className="games-filter-chip">{label} {value}</span>;
}

function zoneCardIds(player, zoneKey) {
  const cards = player?.[zoneKey];
  return Array.isArray(cards) ? cards : [];
}

function ZoneExplorer({ duel, zoneView, gzoneFilter, onFilterChange, onClose }) {
  if (!zoneView) return null;
  const player = duel.players[zoneView.side];
  const cards = zoneCardIds(player, zoneView.zone);
  const filteredCards = zoneView.zone === 'gzone' && gzoneFilter !== 'all'
    ? cards.filter((cardId) => {
      const type = getCard(cardId)?.type;
      return gzoneFilter === 'unit' ? type === 'g-unit' : type === 'g-guardian';
    })
    : cards;
  const shownCards = [...filteredCards].reverse();
  const damageCards = zoneCardIds(player, 'damage');
  const cbUsed = zoneView.zone === 'damage' ? Math.max(0, Math.min(damageCards.length, Number(player.cbUsedTotal || 0))) : 0;
  const sideLabel = SIDE_LABELS[zoneView.side];
  const zoneLabel = ZONE_LABELS[zoneView.zone] || zoneView.zone;

  return (
    <section className="games-panel">
      <div className="games-panel-title">
        <h2>{sideLabel} {zoneLabel}</h2>
        <span>{shownCards.length}/{cards.length}장</span>
      </div>
      <div className="game-save-actions" style={{ marginBottom: 12 }}>
        {zoneView.zone === 'gzone' ? (
          <>
            <button type="button" onClick={() => onFilterChange('all')} disabled={gzoneFilter === 'all'}>전체</button>
            <button type="button" onClick={() => onFilterChange('unit')} disabled={gzoneFilter === 'unit'}>G 유닛</button>
            <button type="button" onClick={() => onFilterChange('guardian')} disabled={gzoneFilter === 'guardian'}>G 가디언</button>
          </>
        ) : null}
        <button type="button" onClick={onClose}>닫기</button>
      </div>
      <div className="game-save-list">
        {shownCards.length ? shownCards.map((cardId, index) => {
          const originalIndex = zoneView.zone === 'damage' ? cards.length - 1 - index : -1;
          const right = zoneView.zone === 'damage' && originalIndex < cbUsed ? 'CB' : undefined;
          return <CardSummary cardId={cardId} right={right} key={`${zoneView.side}-${zoneView.zone}-${cardId}-${index}`} />;
        }) : (
          <div className="game-save-row">
            <div><strong>표시할 카드가 없습니다.</strong></div>
            <strong>-</strong>
          </div>
        )}
      </div>
    </section>
  );
}

function Field({ title, player, side, selectedAttacker, zoneView, onCircleClick, onZoneClick }) {
  const rows = [
    ['RC_BL', 'RC_BC', 'RC_BR'],
    ['RC_FL', 'VC', 'RC_FR'],
  ];
  const zoneActive = (zone) => zoneView?.side === side && zoneView?.zone === zone;
  return (
    <section className="games-panel">
      <div className="games-panel-title">
        <h2>{title}</h2>
        <span>{player.isStrided ? 'STRIDE' : 'NORMAL'}</span>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
        <ZonePill label="덱" value={zoneCardIds(player, 'deck').length} active={zoneActive('deck')} onClick={() => onZoneClick(side, 'deck')} />
        <ZonePill label="패" value={zoneCardIds(player, 'hand').length} />
        <ZonePill label="소울" value={zoneCardIds(player, 'soul').length} active={zoneActive('soul')} onClick={() => onZoneClick(side, 'soul')} />
        <ZonePill label="데미지" value={zoneCardIds(player, 'damage').length} active={zoneActive('damage')} onClick={() => onZoneClick(side, 'damage')} />
        <ZonePill label="드롭" value={zoneCardIds(player, 'drop').length} active={zoneActive('drop')} onClick={() => onZoneClick(side, 'drop')} />
        <ZonePill label="제외" value={zoneCardIds(player, 'removed').length} active={zoneActive('removed')} onClick={() => onZoneClick(side, 'removed')} />
        <ZonePill label="G존" value={zoneCardIds(player, 'gzone').length} active={zoneActive('gzone')} onClick={() => onZoneClick(side, 'gzone')} />
      </div>
      <div style={{ display: 'grid', gap: 8 }}>
        {rows.map((row) => (
          <div key={row.join('-')} style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
            {row.map((circle) => {
              const unit = player.circles[circle];
              const card = getCard(unit?.cardId);
              const selected = selectedAttacker === circle && side === 'me';
              const actionable = side === 'me' ? Boolean(unit) : true;
              return (
                <button
                  key={circle}
                  type="button"
                  onClick={() => actionable && onCircleClick(circle)}
                  className="game-save-row"
                  style={{
                    minHeight: 104,
                    alignItems: 'stretch',
                    borderColor: selected ? '#38bdf8' : undefined,
                    boxShadow: selected ? '0 0 0 2px rgba(56, 189, 248, 0.24)' : undefined,
                    textAlign: 'left',
                  }}
                >
                  <div>
                    <span>{circle} · {unit?.isRest ? 'REST' : 'STAND'}</span>
                    <strong>{card?.name || '빈 서클'}</strong>
                    {card ? <small>G{card.grade} · {typeLabel(card.type)} · P{unitPower(unit).toLocaleString('ko-KR')}</small> : null}
                  </div>
                  {circle === 'VC' && unit ? <strong>C{1 + Number(unit.critMod || 0)}</strong> : <strong>{unit ? '' : '-'}</strong>}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </section>
  );
}

function BattlePanel({ battle, selectedHandId, onGuardAdd, onGGuard, onGuardEnd }) {
  if (!battle) return null;
  return (
    <section className="games-panel">
      <div className="games-panel-title">
        <h2>배틀 처리</h2>
        <span>{SIDE_LABELS[battle.attackerSide]} 공격</span>
      </div>
      <div className="games-rank-split">
        <SmallStat label="공격" value={`${battle.attackerCircle}${battle.boosterCircle ? ` + ${battle.boosterCircle}` : ''}`} />
        <SmallStat label="방어" value={`${battle.defenderCircle}`} />
        <SmallStat label="가드 실드" value={battle.guardShield.toLocaleString('ko-KR')} />
        <SmallStat label="완전 가드" value={battle.perfectGuard ? 'YES' : 'NO'} />
      </div>
      {battle.defenderSide === 'me' ? (
        <div className="game-save-actions" style={{ marginTop: 12 }}>
          <button type="button" onClick={onGGuard}>G 가디언</button>
          <button type="button" onClick={onGuardAdd} disabled={!selectedHandId}>선택 카드 가드</button>
          <button type="button" onClick={onGuardEnd}>가드 종료</button>
        </div>
      ) : <p style={{ color: '#cbd5e1', fontWeight: 800 }}>AI가 자동으로 가드를 처리합니다.</p>}
      <div className="games-activity-list" style={{ marginTop: 12 }}>
        {battle.note.length ? battle.note.map((row, index) => <div key={`${row}-${index}`}><strong>{row}</strong></div>) : <div><strong>아직 처리 메모가 없습니다.</strong></div>}
        {battle.driveChecks.length ? <div><strong>드라이브 체크: {battle.driveChecks.map(cardName).join(', ')}</strong></div> : null}
        {battle.damageChecks.length ? <div><strong>데미지 체크: {battle.damageChecks.map(cardName).join(', ')}</strong></div> : null}
      </div>
    </section>
  );
}

export default function BaVanguardPlayPage() {
  const token = useAuthToken();
  const hydrated = useHydrated();
  const { showToast } = useToast();
  const [presetId, setPresetId] = useState(PRESET_DECKS[0]?.id || '');
  const [opponentPresetId, setOpponentPresetId] = useState(PRESET_DECKS[1]?.id || PRESET_DECKS[0]?.id || '');
  const [seed, setSeed] = useState(2401);
  const [rules, setRules] = useState(() => normalizeRules(DEFAULT_RULES));
  const [autoGuardMe, setAutoGuardMe] = useState(false);
  const [duel, setDuel] = useState(() => initDuelState({
    meDeck: getPreset(PRESET_DECKS[0]?.id),
    oppDeck: getPreset(PRESET_DECKS[1]?.id || PRESET_DECKS[0]?.id),
    seed: 2401,
    firstTurnNoDraw: rules.firstTurnNoDraw,
  }));
  const [selectedHandIndex, setSelectedHandIndex] = useState(null);
  const [selectedAttacker, setSelectedAttacker] = useState(null);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [zoneView, setZoneView] = useState(null);
  const [gzoneFilter, setGzoneFilter] = useState('all');

  const deck = getPreset(presetId);
  const opponentDeck = getPreset(opponentPresetId);
  const validation = useMemo(() => validateDeck(deck, rules), [deck, rules]);
  const opponentValidation = useMemo(() => validateDeck(opponentDeck, rules), [opponentDeck, rules]);
  const summary = useMemo(() => summarizeDeck(deck), [deck]);
  const openingHand = useMemo(() => drawOpeningHand(deck, seed, 5), [deck, seed]);
  const deckReport = useMemo(() => deckConsistencyReport(deck, seed, rules), [deck, seed, rules]);
  const openingStats = deckReport.opening;
  const compositionRows = deckReport.composition;
  const score = scoreDeck(deck, rules);
  const duelSummary = summarizeDuel(duel);
  const visibleCards = CARDS.filter((card) => card.clan === deck.clan);
  const valid = validation.errors.length === 0 && opponentValidation.errors.length === 0;
  const me = duel.players.me;
  const opp = duel.players.opp;
  const selectedHandId = selectedHandIndex === null ? null : me.hand[selectedHandIndex] || null;
  const canControl = duel.active === 'me' && !duel.winner;
  const canMulligan = canControl && duel.turn === 1 && duel.phase === 'STAND' && !duel.battle && !duel.mulliganDone?.me;

  const mutateDuel = (mutator) => {
    setDuel((prev) => {
      const next = clone(prev);
      mutator(next);
      return next;
    });
  };

  const openZone = (side, zone) => {
    setZoneView({ side, zone });
    if (zone === 'gzone') setGzoneFilter('all');
  };

  const startNewDuel = (nextSeed = seed) => {
    setDuel(initDuelState({
      meDeck: deck,
      oppDeck: opponentDeck,
      seed: nextSeed,
      first: 'me',
      firstTurnNoDraw: rules.firstTurnNoDraw,
    }));
    setSelectedHandIndex(null);
    setSelectedAttacker(null);
    setZoneView(null);
    setMessage('새 플레이테스트를 시작했습니다.');
  };

  const runAiUntilStop = () => {
    setDuel((prev) => {
      const next = clone(prev);
      for (let index = 0; index < 80; index += 1) {
        if (next.winner) break;
        if (next.battle?.defenderSide === 'me' && !autoGuardMe) break;
        if (next.active === 'me' && !next.battle) break;
        const progressed = aiStep(next, rules.firstTurnNoDraw, autoGuardMe);
        if (!progressed) break;
      }
      return next;
    });
  };

  const nextPhase = () => {
    setSelectedAttacker(null);
    setSelectedHandIndex(null);
    mutateDuel((next) => {
      if (next.phase === 'END') endTurn(next);
      else advancePhase(next, rules.firstTurnNoDraw);
    });
    setTimeout(runAiUntilStop, 0);
  };

  const onMulligan = () => {
    mutateDuel((next) => mulliganAll(next, 'me'));
    setSelectedHandIndex(null);
  };

  const onAutoRide = () => {
    mutateDuel((next) => autoRide(next, 'me'));
    setSelectedHandIndex(null);
  };

  const onRideSelected = () => {
    if (!selectedHandId) return;
    mutateDuel((next) => rideFromHand(next, 'me', selectedHandId));
    setSelectedHandIndex(null);
  };

  const onCallSelected = (circle) => {
    if (!selectedHandId) return;
    mutateDuel((next) => callFromHand(next, 'me', selectedHandId, circle));
    setSelectedHandIndex(null);
  };

  const onRetire = (circle) => {
    mutateDuel((next) => retireCircle(next, 'me', circle));
  };

  const onStride = () => {
    mutateDuel((next) => strideWithAutoCost(next, 'me'));
    setSelectedHandIndex(null);
  };

  const onVCAct = () => {
    mutateDuel((next) => activateVCAct(next, 'me', selectedHandId || undefined));
    setSelectedHandIndex(null);
  };

  const onMyCircleClick = (circle) => {
    if (!canControl) return;
    if (duel.phase === 'BATTLE') {
      if (canAttack(duel, 'me', circle)) setSelectedAttacker((current) => (current === circle ? null : circle));
      return;
    }
    if (duel.phase === 'MAIN' && circle !== 'VC' && me.circles[circle]) onRetire(circle);
  };

  const onOppCircleClick = (circle) => {
    if (!selectedAttacker || !canControl || duel.phase !== 'BATTLE') return;
    mutateDuel((next) => {
      declareAttack(next, selectedAttacker, circle);
      aiStep(next, rules.firstTurnNoDraw, autoGuardMe);
    });
    setSelectedAttacker(null);
  };

  const onGuardAdd = () => {
    if (!selectedHandId) return;
    mutateDuel((next) => guardAddFromHand(next, 'me', selectedHandId));
    setSelectedHandIndex(null);
  };

  const onGGuard = () => {
    mutateDuel((next) => guardGGuardian(next, 'me', selectedHandId || undefined));
    setSelectedHandIndex(null);
  };

  const onGuardEnd = () => {
    mutateDuel((next) => guardEnd(next));
    setSelectedHandIndex(null);
    setTimeout(runAiUntilStop, 0);
  };

  const setRuleOption = (key, value) => {
    setRules((current) => normalizeRules({ ...current, [key]: value }));
  };

  const saveRun = async () => {
    if (!token || busy) {
      setMessage('로그인하면 BA Vanguard 플레이테스트 상태를 저장할 수 있습니다.');
      return;
    }
    setBusy('save');
    try {
      await apiPut(`/game-saves/${GAME_SLUG}/${QUICK_SAVE_SLOT}`, {
        saveName: `BA Vanguard ${deck.name}`,
        version: SAVE_VERSION,
        summary: {
          presetId,
          opponentPresetId,
          deckName: deck.name,
          opponentDeckName: opponentDeck.name,
          clan: deck.clan,
          rules,
          score,
          duel: duelSummary,
        },
        payload: { presetId, opponentPresetId, seed, rules, autoGuardMe, duel },
        lastPlayedAt: new Date().toISOString(),
      }, { timeoutMs: 15000 });
      clearApiGetCache('/game-saves');
      setMessage('BA Vanguard 플레이테스트 상태를 저장했습니다.');
      showToast({ tone: 'success', message: 'BA Vanguard 플레이테스트 상태를 저장했습니다.' });
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
      setMessage('로그인하면 저장된 BA Vanguard 플레이테스트 상태를 불러올 수 있습니다.');
      return;
    }
    setBusy('load');
    try {
      const list = await apiGet(`/game-saves?gameSlug=${GAME_SLUG}`, { timeoutMs: 12000 });
      const quickSave = Array.isArray(list?.saves) ? list.saves.find((save) => save.slotKey === QUICK_SAVE_SLOT) : null;
      if (!quickSave?.id) {
        setMessage('저장된 BA Vanguard 플레이테스트 상태가 없습니다.');
        return;
      }
      const detail = await apiGet(`/game-saves/${quickSave.id}`, { timeoutMs: 12000 });
      const payload = detail?.save?.payload || {};
      const nextPreset = getPreset(payload.presetId)?.id || PRESET_DECKS[0].id;
      const nextOpp = getPreset(payload.opponentPresetId)?.id || PRESET_DECKS[1]?.id || PRESET_DECKS[0].id;
      const nextSeed = Number(payload.seed || 2401);
      const nextRules = normalizeRules(payload.rules);
      setPresetId(nextPreset);
      setOpponentPresetId(nextOpp);
      setSeed(nextSeed);
      setRules(nextRules);
      setAutoGuardMe(Boolean(payload.autoGuardMe));
      setDuel(payload.duel || initDuelState({
        meDeck: getPreset(nextPreset),
        oppDeck: getPreset(nextOpp),
        seed: nextSeed,
        firstTurnNoDraw: nextRules.firstTurnNoDraw,
      }));
      setSelectedHandIndex(null);
      setSelectedAttacker(null);
      setZoneView(null);
      setMessage('저장된 BA Vanguard 플레이테스트 상태를 불러왔습니다.');
      showToast({ tone: 'success', message: '저장된 BA Vanguard 플레이테스트 상태를 불러왔습니다.' });
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
      setMessage('로그인하면 BA Vanguard 플레이테스트 결과를 전적에 기록할 수 있습니다.');
      return;
    }
    setBusy('record');
    try {
      await apiPost(`/game-records/${GAME_SLUG}`, {
        title: `BA Vanguard - ${deck.name}`,
        mode: 'playtest',
        result: duel.winner ? (duel.winner === 'me' ? 'win' : 'loss') : 'in-progress',
        score: score + (duel.winner === 'me' ? 300 : 0),
        playTimeSec: 0,
        summary: {
          deckName: deck.name,
          opponentDeckName: opponentDeck.name,
          clan: deck.clan,
          rules,
          openingHand: openingHand.map(cardName),
          duel: duelSummary,
        },
        payload: { presetId, opponentPresetId, seed, rules, deck, opponentDeck, validation, duel },
      }, { timeoutMs: 15000 });
      clearApiGetCache('/game-records');
      setMessage('BA Vanguard 플레이테스트 결과를 전적에 기록했습니다.');
      showToast({ tone: 'success', message: 'BA Vanguard 플레이테스트 결과를 전적에 기록했습니다.' });
    } catch (err) {
      const nextMessage = err?.message || '전적 기록에 실패했습니다.';
      setMessage(nextMessage);
      showToast({ tone: 'danger', message: nextMessage });
    } finally {
      setBusy('');
    }
  };

  const actions = (
    <>
      <button type="button" onClick={() => startNewDuel(seed)}>새 듀얼</button>
      <button type="button" onClick={() => setSeed((current) => current + 1)}>시드 +1</button>
      <button type="button" onClick={() => void saveRun()} disabled={!hydrated || busy === 'save'}>{busy === 'save' ? '저장 중...' : '저장'}</button>
      <button type="button" onClick={() => void loadRun()} disabled={!hydrated || busy === 'load'}>{busy === 'load' ? '불러오는 중...' : '불러오기'}</button>
      <button type="button" onClick={() => void recordRun()} disabled={!hydrated || busy === 'record'}>{busy === 'record' ? '기록 중...' : '전적 기록'}</button>
      <Link href="/myanime/ba-vanguard">상세</Link>
    </>
  );

  const metrics = [
    { label: '카드', value: CARDS.length },
    { label: '턴/페이즈', value: `${duel.turn} · ${duel.phase}` },
    { label: '진행', value: duel.winner ? `${SIDE_LABELS[duel.winner]} 승리` : `${SIDE_LABELS[duel.active]} 차례` },
    { label: '내 데미지', value: `${me.damage.length}/6` },
    { label: 'AI 데미지', value: `${opp.damage.length}/6` },
    { label: '점수', value: score.toLocaleString('ko-KR') },
  ];

  const messages = [
    message ? { key: 'message', text: message } : null,
    !token && hydrated ? { key: 'auth', text: '로그인하지 않아도 플레이테스트는 가능하지만 저장/불러오기/전적 기록은 로그인 후 사용할 수 있습니다.' } : null,
    !valid ? { key: 'invalid', tone: 'error', text: '현재 덱 또는 상대 덱에 규칙 오류가 있습니다. 검증 목록을 확인하세요.' } : null,
    duel.battle?.defenderSide === 'me' ? { key: 'guard', text: '방어 창이 열렸습니다. 패에서 카드를 선택해 가드하거나 바로 가드 종료를 누르세요.' } : null,
  ];

  return (
    <GamePlayShell
      kicker="BA Vanguard"
      title="BA Vanguard"
      description="myanime 원본의 P-G 플레이테스트 흐름을 사이트용으로 이식했습니다. 라이드, 콜, 스트라이드, 배틀, 가드, 드라이브/데미지 체크, 간단 AI 진행을 한 화면에서 확인합니다."
      summaryLabel="BA Vanguard 현황"
      actions={actions}
      metrics={metrics}
      messages={messages}
    >
      <section className="games-detail-grid">
        <section className="games-panel">
          <div className="games-panel-title">
            <h2>플레이 설정</h2>
            <span>{deck.clan}</span>
          </div>
          <label className="game-save-json-field">
            <span>내 프리셋</span>
            <select value={presetId} onChange={(event) => setPresetId(event.target.value)}>
              {PRESET_DECKS.map((preset) => <option value={preset.id} key={preset.id}>{preset.name}</option>)}
            </select>
          </label>
          <label className="game-save-json-field">
            <span>AI 프리셋</span>
            <select value={opponentPresetId} onChange={(event) => setOpponentPresetId(event.target.value)}>
              {PRESET_DECKS.map((preset) => <option value={preset.id} key={preset.id}>{preset.name}</option>)}
            </select>
          </label>
          <label className="game-save-json-field">
            <span>시드</span>
            <input value={seed} onChange={(event) => setSeed(Number(event.target.value) || 0)} />
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#cbd5e1', fontWeight: 900 }}>
            <input type="checkbox" checked={autoGuardMe} onChange={(event) => setAutoGuardMe(event.target.checked)} />
            내 방어 자동 처리
          </label>
          <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#cbd5e1', fontWeight: 900 }}>
              <input type="checkbox" checked={rules.allowMixedClan} onChange={(event) => setRuleOption('allowMixedClan', event.target.checked)} />
              학원(클랜) 혼합 허용
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#cbd5e1', fontWeight: 900 }}>
              <input type="checkbox" checked={rules.firstTurnNoDraw} onChange={(event) => setRuleOption('firstTurnNoDraw', event.target.checked)} />
              선공 1턴 드로우/공격 제한
            </label>
            <p style={{ margin: 0, color: '#94a3b8', fontWeight: 800, lineHeight: 1.45 }}>
              룰 옵션은 덱 검증과 새 듀얼 시작부터 적용됩니다.
            </p>
          </div>
          <div className="game-save-actions" style={{ marginTop: 12 }}>
            <button type="button" onClick={() => startNewDuel(seed)}>설정으로 재시작</button>
            <button type="button" onClick={runAiUntilStop}>AI 진행</button>
          </div>
        </section>

        <section className="games-panel">
          <div className="games-panel-title">
            <h2>진행 컨트롤</h2>
            <span>{duel.winner ? `${SIDE_LABELS[duel.winner]} 승리` : `${SIDE_LABELS[duel.active]} 차례`}</span>
          </div>
          <div className="games-rank-split">
            <SmallStat label="선공 제한" value={rules.firstTurnNoDraw ? 'ON' : 'OFF'} />
            <SmallStat label="혼합 클랜" value={rules.allowMixedClan ? '허용' : '금지'} />
            <SmallStat label="패" value={`${me.hand.length}/${opp.hand.length}`} />
            <SmallStat label="덱" value={`${me.deck.length}/${opp.deck.length}`} />
          </div>
          <div className="game-save-actions" style={{ marginTop: 12 }}>
            <button type="button" onClick={nextPhase} disabled={Boolean(duel.winner || duel.battle)}>다음 페이즈</button>
            <button type="button" onClick={onMulligan} disabled={!canMulligan}>멀리건</button>
            <button type="button" onClick={onAutoRide} disabled={!canControl || duel.phase !== 'MAIN'}>자동 라이드</button>
            <button type="button" onClick={onStride} disabled={!canControl || duel.phase !== 'MAIN'}>스트라이드</button>
            <button type="button" onClick={onVCAct} disabled={!canControl || duel.phase !== 'MAIN'}>VC 스킬</button>
          </div>
          {selectedAttacker ? <p style={{ color: '#cbd5e1', fontWeight: 800 }}>공격자 {selectedAttacker} 선택 중입니다. AI 필드의 목표를 누르세요.</p> : null}
        </section>

        <BattlePanel
          battle={duel.battle}
          selectedHandId={selectedHandId}
          onGuardAdd={onGuardAdd}
          onGGuard={onGGuard}
          onGuardEnd={onGuardEnd}
        />
      </section>

      <section className="games-detail-grid">
        <Field
          title="AI 필드"
          player={opp}
          side="opp"
          selectedAttacker={selectedAttacker}
          zoneView={zoneView}
          onCircleClick={onOppCircleClick}
          onZoneClick={openZone}
        />
        <Field
          title="내 필드"
          player={me}
          side="me"
          selectedAttacker={selectedAttacker}
          zoneView={zoneView}
          onCircleClick={onMyCircleClick}
          onZoneClick={openZone}
        />
      </section>

      <ZoneExplorer
        duel={duel}
        zoneView={zoneView}
        gzoneFilter={gzoneFilter}
        onFilterChange={setGzoneFilter}
        onClose={() => setZoneView(null)}
      />

      <section className="games-dashboard">
        <section className="games-panel">
          <div className="games-panel-title">
            <h2>내 패</h2>
            <span>{me.hand.length}장</span>
          </div>
          <div className="game-save-list">
            {me.hand.length ? me.hand.map((cardId, index) => (
              <CardSummary
                cardId={cardId}
                key={`${cardId}-${index}`}
                active={selectedHandIndex === index}
                right={selectedHandIndex === index ? '선택' : undefined}
                onClick={() => setSelectedHandIndex((current) => (current === index ? null : index))}
              />
            )) : <div className="game-save-row"><div><strong>패가 없습니다.</strong></div><strong>-</strong></div>}
          </div>
        </section>

        <section className="games-panel">
          <div className="games-panel-title">
            <h2>패 액션</h2>
            <span>{selectedHandId ? cardName(selectedHandId) : '미선택'}</span>
          </div>
          {selectedHandId ? <CardSummary cardId={selectedHandId} /> : <p style={{ color: '#cbd5e1', fontWeight: 800 }}>패에서 카드를 선택하세요.</p>}
          <div className="game-save-actions" style={{ marginTop: 12 }}>
            <button type="button" onClick={onRideSelected} disabled={!selectedHandId || !canControl || duel.phase !== 'MAIN'}>라이드</button>
            {CIRCLES.filter((circle) => circle !== 'VC' && !me.circles[circle]).map((circle) => (
              <button type="button" key={circle} onClick={() => onCallSelected(circle)} disabled={!selectedHandId || !canControl || duel.phase !== 'MAIN'}>{circle} 콜</button>
            ))}
          </div>
          <div className="game-save-actions" style={{ marginTop: 8 }}>
            {CIRCLES.filter((circle) => circle !== 'VC' && me.circles[circle]).map((circle) => (
              <button type="button" key={circle} onClick={() => onRetire(circle)} disabled={!canControl || duel.phase !== 'MAIN'}>{circle} 퇴각</button>
            ))}
          </div>
        </section>

        <section className="games-panel">
          <div className="games-panel-title">
            <h2>로그</h2>
            <span>최근 {Math.min(duel.log.length, 80)}개</span>
          </div>
          <div className="games-activity-list">
            {duel.log.slice(0, 80).map((row, index) => (
              <div key={`${row}-${index}`}><strong>{row}</strong></div>
            ))}
          </div>
        </section>
      </section>

      <section className="games-dashboard">
        <section className="games-panel">
          <div className="games-panel-title">
            <h2>검증</h2>
            <span>{valid ? '통과' : '오류 있음'}</span>
          </div>
          <div className="games-activity-list">
            {validation.errors.length ? validation.errors.map((row) => <div key={row}><strong>{row}</strong></div>) : <div><strong>내 덱 필수 규칙 오류가 없습니다.</strong></div>}
            {validation.warnings.map((row) => <div key={row}><strong>{row}</strong></div>)}
            {opponentValidation.errors.map((row) => <div key={`opp-${row}`}><strong>AI: {row}</strong></div>)}
            {opponentValidation.warnings.map((row) => <div key={`opp-w-${row}`}><strong>AI: {row}</strong></div>)}
          </div>
        </section>

        <section className="games-panel">
          <div className="games-panel-title">
            <h2>오프닝 핸드</h2>
            <span>Seed {seed}</span>
          </div>
          <div className="game-save-list">
            {openingHand.map((cardId, index) => <CardSummary cardId={cardId} key={`${cardId}-${index}`} right={`G${getCard(cardId)?.grade ?? '-'}`} />)}
          </div>
        </section>

        <section className="games-panel">
          <div className="games-panel-title">
            <h2>덱 요약</h2>
            <span>{summary.mainCount}/{rules.mainSize}</span>
          </div>
          <div className="games-rank-split">
            <SmallStat label="평균 파워" value={summary.averagePower.toLocaleString('ko-KR')} />
            <SmallStat label="실드 총합" value={summary.totalShield.toLocaleString('ko-KR')} />
            <SmallStat label="G3" value={summary.grade3Count} />
          </div>
          <p style={{ color: '#cbd5e1', fontWeight: 800, lineHeight: 1.5 }}>{deck.description}</p>
        </section>
      </section>

      <section className="games-dashboard">
        <section className="games-panel">
          <div className="games-panel-title">
            <h2>덱 분석</h2>
            <span>{openingStats.samples}회 샘플</span>
          </div>
          <div className="games-rank-split">
            <SmallStat label="G1 확보" value={`${openingStats.grade1Rate}%`} />
            <SmallStat label="G2 확보" value={`${openingStats.grade2Rate}%`} />
            <SmallStat label="G3 확보" value={`${openingStats.grade3Rate}%`} />
            <SmallStat label="라인 완성" value={`${openingStats.rideLineRate}%`} />
          </div>
          <div className="games-rank-split" style={{ marginTop: 12 }}>
            <SmallStat label="센티넬" value={`${openingStats.sentinelRate}%`} />
            <SmallStat label="평균 트리거" value={openingStats.triggerAverage} />
            <SmallStat label="평균 실드" value={openingStats.shieldAverage.toLocaleString('ko-KR')} />
            <SmallStat label="평균 파워" value={openingStats.powerAverage.toLocaleString('ko-KR')} />
          </div>
          <div className="games-activity-list" style={{ marginTop: 12 }}>
            {deckReport.recommendations.map((row) => (
              <div key={row}><strong>{row}</strong></div>
            ))}
          </div>
        </section>

        <section className="games-panel">
          <div className="games-panel-title">
            <h2>구성표</h2>
            <span>{compositionRows.length}개 묶음</span>
          </div>
          <div className="game-save-list">
            {compositionRows.map((row) => (
              <article className="game-save-row" key={row.key}>
                <div>
                  <span>{row.label}</span>
                  <strong>{row.count}장</strong>
                  <small>평균 파워 {row.averagePower.toLocaleString('ko-KR')} · 실드 합계 {row.shieldTotal.toLocaleString('ko-KR')}</small>
                </div>
                <strong>{row.zoneLabel}</strong>
              </article>
            ))}
          </div>
        </section>
      </section>

      <section className="games-dashboard">
        <section className="games-panel">
          <div className="games-panel-title">
            <h2>메인 덱</h2>
            <span>{summary.mainCount}장</span>
          </div>
          <div className="game-save-list">
            {deck.main.map((entry) => <DeckEntryLine cardId={entry.cardId} count={entry.count} key={entry.cardId} />)}
          </div>
        </section>

        <section className="games-panel">
          <div className="games-panel-title">
            <h2>G존</h2>
            <span>{summary.gCount}장</span>
          </div>
          <div className="game-save-list">
            {deck.gzone.map((entry) => <DeckEntryLine cardId={entry.cardId} count={entry.count} key={entry.cardId} />)}
          </div>
        </section>

        <section className="games-panel">
          <div className="games-panel-title">
            <h2>카드 라이브러리</h2>
            <span>{visibleCards.length}장</span>
          </div>
          <div className="game-save-list">
            {visibleCards.map((card) => <CardSummary cardId={card.id} key={card.id} />)}
          </div>
        </section>
      </section>
    </GamePlayShell>
  );
}
