'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import SiteHeader from '../../../../components/SiteHeader';
import { useToast } from '../../../../components/ToastProvider';
import { apiGet, apiGetCached, apiPost, apiPut, clearApiGetCache } from '../../../../utils/api';
import { useAuthToken, useHydrated } from '../../../../utils/client-auth';
import {
  FALLBACK_DECK_CARD_IDS,
  FALLBACK_TCG_CARDS,
  TCG_GAME_SLUG,
  buildDeckFromIds,
  normalizeCards,
} from '../_lib/tcgCatalog';

const QUICK_SAVE_SLOT = 'quick-match';
const ENEMY_DECK_CARD_IDS = [
  'guardian',
  'striker',
  'charger',
  'repair',
  'barrage',
  'sniper',
  'guardian',
  'barrier',
  'captain',
  'striker',
  'barrage',
  'charger',
];

function createMatchId() {
  return `match-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function buildEnemyDeck(cards) {
  return buildDeckFromIds(ENEMY_DECK_CARD_IDS, cards)
    .map((card, index) => ({ ...card, instanceId: `enemy-${card.id}-${index}` }));
}

function drawCards(state, count) {
  const deck = [...state.deck];
  const hand = [...state.hand];
  const log = [...state.log];
  for (let i = 0; i < count; i += 1) {
    const next = deck.shift();
    if (!next) {
      log.unshift('덱이 비었습니다.');
      break;
    }
    hand.push(next);
    log.unshift(`${next.name} 카드를 뽑았습니다.`);
  }
  return { ...state, deck, hand, log: log.slice(0, 12) };
}

function drawEnemyCards(state, count) {
  const enemyDeck = [...(state.enemyDeck || [])];
  const enemyHand = [...(state.enemyHand || [])];
  const log = [...state.log];
  for (let i = 0; i < count; i += 1) {
    const next = enemyDeck.shift();
    if (!next) {
      log.unshift('상대 덱이 비었습니다.');
      break;
    }
    enemyHand.push(next);
    log.unshift(`상대가 카드 1장을 뽑았습니다.`);
  }
  return { ...state, enemyDeck, enemyHand, log: log.slice(0, 12) };
}

function createInitialState(
  deckCards = buildDeckFromIds(FALLBACK_DECK_CARD_IDS, FALLBACK_TCG_CARDS),
  enemyDeckCards = buildEnemyDeck(FALLBACK_TCG_CARDS),
) {
  const base = {
    matchId: createMatchId(),
    startedAt: new Date().toISOString(),
    turn: 1,
    playerHealth: 20,
    enemyHealth: 20,
    maxEnergy: 1,
    energy: 1,
    enemyMaxEnergy: 1,
    enemyEnergy: 1,
    deck: deckCards,
    hand: [],
    board: [],
    enemyDeck: enemyDeckCards,
    enemyHand: [],
    enemyBoard: [],
    discard: [],
    log: ['훈련 매치가 시작되었습니다.'],
    winner: '',
  };
  return drawEnemyCards(drawCards(base, 4), 3);
}

function normalizeSavedState(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return {
    matchId: value.matchId || createMatchId(),
    startedAt: value.startedAt || new Date().toISOString(),
    turn: Math.max(1, Number(value.turn || 1)),
    playerHealth: clampHealth(value.playerHealth ?? 20),
    enemyHealth: clampHealth(value.enemyHealth ?? 20),
    maxEnergy: Math.max(1, Math.min(10, Number(value.maxEnergy || 1))),
    energy: Math.max(0, Math.min(10, Number(value.energy || 0))),
    enemyMaxEnergy: Math.max(1, Math.min(10, Number(value.enemyMaxEnergy || 1))),
    enemyEnergy: Math.max(0, Math.min(10, Number(value.enemyEnergy || 0))),
    deck: Array.isArray(value.deck) ? value.deck : [],
    hand: Array.isArray(value.hand) ? value.hand : [],
    board: Array.isArray(value.board) ? value.board : [],
    enemyDeck: Array.isArray(value.enemyDeck) ? value.enemyDeck : [],
    enemyHand: Array.isArray(value.enemyHand) ? value.enemyHand : [],
    enemyBoard: Array.isArray(value.enemyBoard) ? value.enemyBoard : [],
    discard: Array.isArray(value.discard) ? value.discard : [],
    log: Array.isArray(value.log) ? value.log.slice(0, 12) : [],
    winner: ['player', 'enemy'].includes(value.winner) ? value.winner : '',
  };
}

function matchPayload(state) {
  return {
    matchId: state.matchId,
    startedAt: state.startedAt,
    turn: state.turn,
    playerHealth: state.playerHealth,
    enemyHealth: state.enemyHealth,
    maxEnergy: state.maxEnergy,
    energy: state.energy,
    enemyMaxEnergy: state.enemyMaxEnergy,
    enemyEnergy: state.enemyEnergy,
    deck: state.deck,
    hand: state.hand,
    board: state.board,
    enemyDeck: state.enemyDeck,
    enemyHand: state.enemyHand,
    enemyBoard: state.enemyBoard,
    discard: state.discard,
    log: state.log,
    winner: state.winner,
  };
}

function getPlayTimeSec(startedAt) {
  const start = new Date(startedAt || '').getTime();
  if (!Number.isFinite(start)) return 0;
  return Math.max(0, Math.floor((Date.now() - start) / 1000));
}

function clampHealth(value) {
  return Math.max(0, Math.min(30, Number(value || 0)));
}

function resolveTactic(card, state) {
  if (card.id === 'repair') {
    return {
      ...state,
      playerHealth: clampHealth(state.playerHealth + 3),
      discard: [...state.discard, card],
      log: [`${card.name}: 본부 체력 +3`, ...state.log].slice(0, 12),
    };
  }
  if (card.id === 'barrage') {
    const enemyHealth = Math.max(0, state.enemyHealth - 3);
    return {
      ...state,
      enemyHealth,
      discard: [...state.discard, card],
      log: [`${card.name}: 상대 본부에 3 피해`, ...state.log].slice(0, 12),
      winner: enemyHealth <= 0 ? 'player' : state.winner,
    };
  }
  if (card.id === 'barrier') {
    return {
      ...state,
      playerHealth: clampHealth(state.playerHealth + 2),
      discard: [...state.discard, card],
      log: [`${card.name}: 본부 체력 +2`, ...state.log].slice(0, 12),
    };
  }
  return {
    ...state,
    discard: [...state.discard, card],
  };
}

function cardPower(card) {
  return Number(card.attack || 0) + Number(card.health || 0);
}

function unitHealth(unit) {
  return Number(unit?.currentHealth ?? unit?.health ?? 0);
}

function weakestUnitIndex(units) {
  if (!Array.isArray(units) || !units.length) return -1;
  return units.reduce((bestIndex, unit, index) => (
    unitHealth(unit) < unitHealth(units[bestIndex]) ? index : bestIndex
  ), 0);
}

function resolveCombat(attacker, defender) {
  const nextAttacker = {
    ...attacker,
    currentHealth: unitHealth(attacker) - Number(defender.attack || 0),
    ready: false,
  };
  const nextDefender = {
    ...defender,
    currentHealth: unitHealth(defender) - Number(attacker.attack || 0),
  };
  return {
    attacker: nextAttacker,
    defender: nextDefender,
    attackerDead: nextAttacker.currentHealth <= 0,
    defenderDead: nextDefender.currentHealth <= 0,
  };
}

function resolveEnemyTactic(card, state) {
  if (card.id === 'repair' || card.id === 'barrier') {
    return {
      ...state,
      enemyHealth: clampHealth(state.enemyHealth + (card.id === 'repair' ? 3 : 2)),
      discard: [...state.discard, card],
      log: [`상대 ${card.name}: 상대 본부 회복`, ...state.log].slice(0, 12),
    };
  }
  if (card.id === 'barrage') {
    const playerHealth = Math.max(0, state.playerHealth - 3);
    return {
      ...state,
      playerHealth,
      discard: [...state.discard, card],
      log: [`상대 ${card.name}: 내 본부에 3 피해`, ...state.log].slice(0, 12),
      winner: playerHealth <= 0 ? 'enemy' : state.winner,
    };
  }
  return {
    ...state,
    discard: [...state.discard, card],
  };
}

function playEnemyCards(state) {
  let next = state;
  let guard = 0;
  while (!next.winner && guard < 8) {
    guard += 1;
    const affordable = next.enemyHand
      .filter((card) => Number(card.cost || 0) <= next.enemyEnergy)
      .sort((a, b) => {
        const aRole = a.role === 'Unit' ? 0 : 1;
        const bRole = b.role === 'Unit' ? 0 : 1;
        return aRole - bRole || Number(b.cost || 0) - Number(a.cost || 0);
      });
    const card = affordable[0];
    if (!card) break;

    next = {
      ...next,
      enemyHand: next.enemyHand.filter((row) => row.instanceId !== card.instanceId),
      enemyEnergy: next.enemyEnergy - Number(card.cost || 0),
    };

    if (card.role === 'Tactic') {
      next = resolveEnemyTactic(card, next);
    } else {
      next = {
        ...next,
        enemyBoard: [...next.enemyBoard, { ...card, ready: false, currentHealth: card.health }],
        log: [`상대가 ${card.name} 배치`, ...next.log].slice(0, 12),
      };
    }
  }
  return next;
}

function resolveEnemyAttacks(state) {
  let next = state;
  const attackers = [...next.enemyBoard];
  for (const attacker of attackers) {
    if (next.winner) break;
    const liveIndex = next.enemyBoard.findIndex((unit) => unit.instanceId === attacker.instanceId);
    if (liveIndex < 0 || !next.enemyBoard[liveIndex]?.ready) continue;

    const targetIndex = weakestUnitIndex(next.board);
    if (targetIndex >= 0) {
      const target = next.board[targetIndex];
      const combat = resolveCombat(next.enemyBoard[liveIndex], target);
      const enemyBoard = next.enemyBoard.slice();
      const board = next.board.slice();
      if (combat.attackerDead) enemyBoard.splice(liveIndex, 1);
      else enemyBoard[liveIndex] = combat.attacker;
      if (combat.defenderDead) board.splice(targetIndex, 1);
      else board[targetIndex] = combat.defender;
      next = {
        ...next,
        enemyBoard,
        board,
        log: [`상대 ${attacker.name}이(가) ${target.name}와 교전`, ...next.log].slice(0, 12),
      };
    } else {
      const playerHealth = Math.max(0, next.playerHealth - Number(attacker.attack || 0));
      next = {
        ...next,
        playerHealth,
        enemyBoard: next.enemyBoard.map((unit) => (
          unit.instanceId === attacker.instanceId ? { ...unit, ready: false } : unit
        )),
        log: [`상대 ${attacker.name} 공격: ${attacker.attack} 피해`, ...next.log].slice(0, 12),
        winner: playerHealth <= 0 ? 'enemy' : next.winner,
      };
    }
  }
  return next;
}

function runEnemyTurn(state) {
  const enemyMaxEnergy = Math.min(10, Number(state.enemyMaxEnergy || 1) + 1);
  let next = drawEnemyCards({
    ...state,
    enemyMaxEnergy,
    enemyEnergy: enemyMaxEnergy,
    enemyBoard: state.enemyBoard.map((unit) => ({ ...unit, ready: true })),
    log: ['상대 턴 시작', ...state.log].slice(0, 12),
  }, 1);
  next = playEnemyCards(next);
  next = resolveEnemyAttacks(next);
  if (next.winner) return next;

  const maxEnergy = Math.min(10, Number(next.maxEnergy || 1) + 1);
  return drawCards({
    ...next,
    turn: next.turn + 1,
    maxEnergy,
    energy: maxEnergy,
    board: next.board.map((unit) => ({ ...unit, ready: true })),
    log: ['내 턴 시작', ...next.log].slice(0, 12),
  }, 1);
}

export default function DualAcademyTcgPlayPage() {
  const mounted = useHydrated();
  const token = useAuthToken();
  const { showToast } = useToast();
  const [cardCatalog, setCardCatalog] = useState(FALLBACK_TCG_CARDS);
  const [deckCardIds, setDeckCardIds] = useState(FALLBACK_DECK_CARD_IDS);
  const [deckName, setDeckName] = useState('스타터 덱');
  const [loadingDeck, setLoadingDeck] = useState(true);
  const [deckMessage, setDeckMessage] = useState('');
  const [saveBusy, setSaveBusy] = useState(false);
  const [recordedMatchIds, setRecordedMatchIds] = useState([]);
  const [recordMessage, setRecordMessage] = useState('');
  const [state, setState] = useState(() => createInitialState(buildDeckFromIds(FALLBACK_DECK_CARD_IDS, FALLBACK_TCG_CARDS)));

  const resetWithDeck = useCallback((cardIds, cards) => {
    setRecordMessage('');
    setState(createInitialState(buildDeckFromIds(cardIds, cards), buildEnemyDeck(cards)));
  }, []);

  const loadDeck = useCallback(async () => {
    if (!mounted) return;
    setLoadingDeck(true);
    setDeckMessage('');
    try {
      const cardPayload = await apiGetCached('/tcg/cards', {
        ttlMs: 60000,
        timeoutMs: 12000,
        storage: 'session',
      });
      const nextCards = normalizeCards(cardPayload?.cards);
      let nextCardIds = Array.isArray(cardPayload?.defaultDeckCardIds) && cardPayload.defaultDeckCardIds.length
        ? cardPayload.defaultDeckCardIds
        : FALLBACK_DECK_CARD_IDS;
      let nextDeckName = '기본 덱';

      if (token) {
        try {
          const deckPayload = await apiGet('/tcg/decks/active', { timeoutMs: 12000 });
          if (Array.isArray(deckPayload?.deck?.cardIds) && deckPayload.deck.cardIds.length) {
            nextCardIds = deckPayload.deck.cardIds;
            nextDeckName = deckPayload.deck.name || nextDeckName;
          }
        } catch (err) {
          setDeckMessage(err?.message || '저장된 덱을 불러오지 못해 기본 덱을 사용합니다.');
        }
      } else {
        setDeckMessage('로그인하면 저장된 덱을 사용할 수 있습니다.');
      }

      setCardCatalog(nextCards);
      setDeckCardIds(nextCardIds);
      setDeckName(nextDeckName);
      resetWithDeck(nextCardIds, nextCards);
    } catch (err) {
      setDeckMessage(err?.message || '카드 정보를 불러오지 못해 기본 덱을 사용합니다.');
      setCardCatalog(FALLBACK_TCG_CARDS);
      setDeckCardIds(FALLBACK_DECK_CARD_IDS);
      setDeckName('기본 덱');
      resetWithDeck(FALLBACK_DECK_CARD_IDS, FALLBACK_TCG_CARDS);
    } finally {
      setLoadingDeck(false);
    }
  }, [mounted, resetWithDeck, token]);

  useEffect(() => {
    void loadDeck();
  }, [loadDeck]);

  useEffect(() => {
    if (!mounted || !token || !state.winner || recordedMatchIds.includes(state.matchId)) return;
    let cancelled = false;
    const saveRecord = async () => {
      try {
        setRecordedMatchIds((current) => current.includes(state.matchId) ? current : [...current, state.matchId]);
        const result = state.winner === 'player' ? 'win' : 'loss';
        const score = Math.max(0, Number(state.enemyHealth <= 0 ? state.playerHealth : state.enemyHealth));
        const payload = {
          title: 'Dual Academy TCG 훈련 매치',
          mode: 'prototype',
          result,
          score: state.winner === 'player' ? 100 + state.playerHealth + Math.max(0, 12 - state.turn) : score,
          playTimeSec: getPlayTimeSec(state.startedAt),
          summary: {
            deckName,
            turn: state.turn,
            playerHealth: state.playerHealth,
            enemyHealth: state.enemyHealth,
            remainingDeck: state.deck.length,
            result,
          },
          payload: {
            deckName,
            deckCardIds,
            state: matchPayload(state),
          },
        };
        await apiPost(`/game-records/${TCG_GAME_SLUG}`, payload, { timeoutMs: 12000 });
        clearApiGetCache('/game-records');
        if (!cancelled) setRecordMessage('전적을 자동 저장했습니다.');
      } catch (err) {
        if (!cancelled) {
          setRecordedMatchIds((current) => current.filter((id) => id !== state.matchId));
          setRecordMessage(err?.message || '전적 자동 저장에 실패했습니다.');
        }
      }
    };
    void saveRecord();
    return () => {
      cancelled = true;
    };
  }, [deckCardIds, deckName, mounted, recordedMatchIds, state, token]);

  const handCost = useMemo(
    () => state.hand.reduce((sum, card) => sum + Number(card.cost || 0), 0),
    [state.hand],
  );

  const boardPower = useMemo(
    () => state.board.reduce((sum, card) => sum + cardPower(card), 0),
    [state.board],
  );

  const canAct = !state.winner;

  const playCard = (instanceId) => {
    if (!canAct) return;
    setState((current) => {
      const card = current.hand.find((row) => row.instanceId === instanceId);
      if (!card) return current;
      if (card.cost > current.energy) {
        return {
          ...current,
          log: [`에너지가 부족합니다. (${card.cost})`, ...current.log].slice(0, 12),
        };
      }
      const hand = current.hand.filter((row) => row.instanceId !== instanceId);
      const nextBase = {
        ...current,
        hand,
        energy: current.energy - card.cost,
      };
      if (card.role === 'Tactic') return resolveTactic(card, nextBase);
      return {
        ...nextBase,
        board: [...current.board, { ...card, ready: false, currentHealth: card.health }],
        log: [`${card.name} 배치`, ...current.log].slice(0, 12),
      };
    });
  };

  const attackWithCard = (instanceId) => {
    if (!canAct) return;
    setState((current) => {
      const unit = current.board.find((row) => row.instanceId === instanceId);
      if (!unit || !unit.ready) return current;
      const unitIndex = current.board.findIndex((row) => row.instanceId === instanceId);
      const targetIndex = weakestUnitIndex(current.enemyBoard);
      if (targetIndex >= 0) {
        const target = current.enemyBoard[targetIndex];
        const combat = resolveCombat(unit, target);
        const board = current.board.slice();
        const enemyBoard = current.enemyBoard.slice();
        if (combat.attackerDead) board.splice(unitIndex, 1);
        else board[unitIndex] = combat.attacker;
        if (combat.defenderDead) enemyBoard.splice(targetIndex, 1);
        else enemyBoard[targetIndex] = combat.defender;
        return {
          ...current,
          board,
          enemyBoard,
          log: [`${unit.name}이(가) ${target.name}와 교전`, ...current.log].slice(0, 12),
        };
      }

      const enemyHealth = Math.max(0, current.enemyHealth - Number(unit.attack || 0));
      return {
        ...current,
        enemyHealth,
        board: current.board.map((row) => (
          row.instanceId === instanceId ? { ...row, ready: false } : row
        )),
        log: [`${unit.name} 공격: ${unit.attack} 피해`, ...current.log].slice(0, 12),
        winner: enemyHealth <= 0 ? 'player' : current.winner,
      };
    });
  };

  const endTurn = () => {
    if (!canAct) return;
    setState((current) => runEnemyTurn(current));
  };

  const saveMatch = async () => {
    if (!token || saveBusy) {
      setDeckMessage('로그인하면 현재 매치를 저장할 수 있습니다.');
      return;
    }
    setSaveBusy(true);
    try {
      await apiPut(`/game-saves/${TCG_GAME_SLUG}/${QUICK_SAVE_SLOT}`, {
        saveName: `${deckName} ${state.turn}턴`,
        version: 'tcg-prototype-v1',
        summary: {
          deckName,
          turn: state.turn,
          playerHealth: state.playerHealth,
          enemyHealth: state.enemyHealth,
          winner: state.winner || 'playing',
        },
        payload: {
          deckName,
          deckCardIds,
          cardCatalog,
          state: matchPayload(state),
        },
        lastPlayedAt: new Date().toISOString(),
      }, { timeoutMs: 15000 });
      clearApiGetCache('/game-saves');
      setDeckMessage('현재 매치를 저장했습니다.');
      showToast({ tone: 'success', message: '현재 매치를 저장했습니다.' });
    } catch (err) {
      const message = err?.message || '매치 저장에 실패했습니다.';
      setDeckMessage(message);
      showToast({ tone: 'danger', message });
    } finally {
      setSaveBusy(false);
    }
  };

  const loadMatch = async () => {
    if (!token || saveBusy) {
      setDeckMessage('로그인하면 저장된 매치를 불러올 수 있습니다.');
      return;
    }
    setSaveBusy(true);
    try {
      const list = await apiGet(`/game-saves?gameSlug=${TCG_GAME_SLUG}`, { timeoutMs: 12000 });
      const quickSave = Array.isArray(list?.saves)
        ? list.saves.find((save) => save.slotKey === QUICK_SAVE_SLOT)
        : null;
      if (!quickSave?.id) {
        setDeckMessage('저장된 매치가 없습니다.');
        return;
      }

      const detail = await apiGet(`/game-saves/${quickSave.id}`, { timeoutMs: 12000 });
      const payload = detail?.save?.payload || {};
      const restored = normalizeSavedState(payload.state);
      if (!restored) {
        setDeckMessage('저장된 매치 데이터가 올바르지 않습니다.');
        return;
      }
      const nextCards = normalizeCards(payload.cardCatalog);
      const nextCardIds = Array.isArray(payload.deckCardIds) && payload.deckCardIds.length
        ? payload.deckCardIds
        : deckCardIds;
      setCardCatalog(nextCards);
      setDeckCardIds(nextCardIds);
      setDeckName(payload.deckName || detail?.save?.summary?.deckName || deckName);
      setRecordMessage('');
      setState(restored);
      setDeckMessage('저장된 매치를 불러왔습니다.');
      showToast({ tone: 'success', message: '저장된 매치를 불러왔습니다.' });
    } catch (err) {
      const message = err?.message || '매치 불러오기에 실패했습니다.';
      setDeckMessage(message);
      showToast({ tone: 'danger', message });
    } finally {
      setSaveBusy(false);
    }
  };

  const resetMatch = () => resetWithDeck(deckCardIds, cardCatalog);

  return (
    <main className="tcg-page-shell">
      <SiteHeader />
      <section className="tcg-arena">
        <header className="tcg-topbar">
          <div>
            <p>Dual Academy TCG</p>
            <h1>훈련 매치</h1>
          </div>
          <nav>
            <Link href="/games/dual-academy-tcg">상세</Link>
            <Link href="/games/dual-academy-tcg/deck">덱 편집</Link>
            <Link href="/board?category=game&gameSlug=dual-academy-tcg">게시판</Link>
            <button type="button" onClick={saveMatch} disabled={saveBusy}>저장</button>
            <button type="button" onClick={loadMatch} disabled={saveBusy}>불러오기</button>
            <button type="button" onClick={resetMatch}>새 매치</button>
          </nav>
        </header>

        <section className="tcg-scoreboard" aria-label="match status">
          <div>
            <span>내 본부</span>
            <strong>{state.playerHealth}</strong>
          </div>
          <div>
            <span>상대 본부</span>
            <strong>{state.enemyHealth}</strong>
          </div>
          <div>
            <span>턴</span>
            <strong>{state.turn}</strong>
          </div>
          <div>
            <span>에너지</span>
            <strong>{state.energy}/{state.maxEnergy}</strong>
          </div>
          <div>
            <span>상대 에너지</span>
            <strong>{state.enemyEnergy}/{state.enemyMaxEnergy}</strong>
          </div>
        </section>

        {state.winner ? (
          <section className={`tcg-result is-${state.winner}`}>
            {state.winner === 'player' ? '승리했습니다.' : '패배했습니다.'}
            {recordMessage ? <span>{recordMessage}</span> : null}
          </section>
        ) : null}

        <section className="tcg-layout">
          <aside className="tcg-panel">
            <h2>덱</h2>
            <p className="tcg-deck-name">{loadingDeck ? '덱 불러오는 중' : deckName}</p>
            {deckMessage ? <p className="tcg-deck-message">{deckMessage}</p> : null}
            <div className="tcg-deck-count">
              <strong>{state.deck.length}</strong>
              <span>남은 카드</span>
            </div>
            <dl className="tcg-small-stats">
              <div>
                <dt>손패 비용</dt>
                <dd>{handCost}</dd>
              </div>
              <div>
                <dt>필드 전력</dt>
                <dd>{boardPower}</dd>
              </div>
              <div>
                <dt>버린 카드</dt>
                <dd>{state.discard.length}</dd>
              </div>
            </dl>
          </aside>

          <section className="tcg-board">
            <div className="tcg-lane is-enemy">
              <div className="tcg-lane-title">
                <h2>상대 필드</h2>
                <span>필드 {state.enemyBoard.length} / 손패 {state.enemyHand.length} / 덱 {state.enemyDeck.length}</span>
              </div>
              <div className="tcg-card-row">
                {state.enemyBoard.map((card) => (
                  <article className="tcg-card is-enemy-card" key={card.id}>
                    <div className="tcg-card-art" />
                    <strong>{card.name}</strong>
                    <span>ATK {card.attack} / HP {unitHealth(card)}</span>
                  </article>
                ))}
              </div>
            </div>

            <div className="tcg-lane">
              <div className="tcg-lane-title">
                <h2>내 필드</h2>
                <button type="button" onClick={endTurn} disabled={!canAct}>턴 종료</button>
              </div>
              <div className="tcg-card-row">
                {state.board.length ? state.board.map((card) => (
                  <article className={`tcg-card is-${card.tone}`} key={card.instanceId}>
                    <div className="tcg-card-art" />
                    <strong>{card.name}</strong>
                    <span>ATK {card.attack} / HP {card.currentHealth}</span>
                    <button type="button" onClick={() => attackWithCard(card.instanceId)} disabled={!card.ready || !canAct}>
                      공격
                    </button>
                  </article>
                )) : <div className="tcg-empty-zone">배치된 유닛이 없습니다.</div>}
              </div>
            </div>
          </section>

          <aside className="tcg-panel tcg-log">
            <h2>로그</h2>
            <ol>
              {state.log.map((line, index) => (
                <li key={`${line}-${index}`}>{line}</li>
              ))}
            </ol>
          </aside>
        </section>

        <section className="tcg-hand">
          <div className="tcg-lane-title">
            <h2>손패</h2>
            <span>{state.hand.length}</span>
          </div>
          <div className="tcg-hand-row">
            {state.hand.map((card) => (
              <article className={`tcg-card is-${card.tone}`} key={card.instanceId}>
                <div className="tcg-card-head">
                  <span>{card.cost}</span>
                  <strong>{card.role}</strong>
                </div>
                <div className="tcg-card-art" />
                <h3>{card.name}</h3>
                <p>{card.text}</p>
                {card.role === 'Unit' ? <span>ATK {card.attack} / HP {card.health}</span> : null}
                <button type="button" onClick={() => playCard(card.instanceId)} disabled={!canAct || card.cost > state.energy}>
                  사용
                </button>
              </article>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}
