'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import SiteHeader from '../../../../components/SiteHeader';
import { apiGet, apiGetCached } from '../../../../utils/api';
import { useAuthToken, useHydrated } from '../../../../utils/client-auth';
import {
  FALLBACK_DECK_CARD_IDS,
  FALLBACK_TCG_CARDS,
  buildDeckFromIds,
  normalizeCards,
} from '../_lib/tcgCatalog';

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

function createInitialState(deckCards = buildDeckFromIds(FALLBACK_DECK_CARD_IDS, FALLBACK_TCG_CARDS)) {
  const base = {
    turn: 1,
    playerHealth: 20,
    enemyHealth: 20,
    maxEnergy: 1,
    energy: 1,
    deck: deckCards,
    hand: [],
    board: [],
    enemyBoard: [
      { id: 'dummy-guard', name: '훈련용 전열', attack: 1, health: 4 },
    ],
    discard: [],
    log: ['훈련 매치가 시작되었습니다.'],
    winner: '',
  };
  return drawCards(base, 4);
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

export default function DualAcademyTcgPlayPage() {
  const mounted = useHydrated();
  const token = useAuthToken();
  const [cardCatalog, setCardCatalog] = useState(FALLBACK_TCG_CARDS);
  const [deckCardIds, setDeckCardIds] = useState(FALLBACK_DECK_CARD_IDS);
  const [deckName, setDeckName] = useState('스타터 덱');
  const [loadingDeck, setLoadingDeck] = useState(true);
  const [deckMessage, setDeckMessage] = useState('');
  const [state, setState] = useState(() => createInitialState(buildDeckFromIds(FALLBACK_DECK_CARD_IDS, FALLBACK_TCG_CARDS)));

  const resetWithDeck = useCallback((cardIds, cards) => {
    setState(createInitialState(buildDeckFromIds(cardIds, cards)));
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
      const enemyHealth = Math.max(0, current.enemyHealth - unit.attack);
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
    setState((current) => {
      const enemyAttack = current.enemyBoard.reduce((sum, unit) => sum + Number(unit.attack || 0), 0);
      const playerHealth = Math.max(0, current.playerHealth - enemyAttack);
      const maxEnergy = Math.min(10, current.maxEnergy + 1);
      const next = drawCards({
        ...current,
        turn: current.turn + 1,
        playerHealth,
        maxEnergy,
        energy: maxEnergy,
        board: current.board.map((unit) => ({ ...unit, ready: true })),
        log: [`상대 턴: 본부에 ${enemyAttack} 피해`, ...current.log].slice(0, 12),
        winner: playerHealth <= 0 ? 'enemy' : current.winner,
      }, 1);
      return next;
    });
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
        </section>

        {state.winner ? (
          <section className={`tcg-result is-${state.winner}`}>
            {state.winner === 'player' ? '승리했습니다.' : '패배했습니다.'}
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
                <span>{state.enemyBoard.length}</span>
              </div>
              <div className="tcg-card-row">
                {state.enemyBoard.map((card) => (
                  <article className="tcg-card is-enemy-card" key={card.id}>
                    <div className="tcg-card-art" />
                    <strong>{card.name}</strong>
                    <span>ATK {card.attack} / HP {card.health}</span>
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
