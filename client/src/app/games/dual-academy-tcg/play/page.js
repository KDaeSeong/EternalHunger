'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import SiteHeader from '../../../../components/SiteHeader';

const CARD_LIBRARY = {
  striker: {
    id: 'striker',
    name: '전열 스트라이커',
    role: 'Unit',
    cost: 1,
    attack: 2,
    health: 2,
    text: '낮은 코스트로 전열을 빠르게 채웁니다.',
    tone: 'red',
  },
  guardian: {
    id: 'guardian',
    name: '실드 가디언',
    role: 'Unit',
    cost: 2,
    attack: 1,
    health: 5,
    text: '튼튼한 체력으로 다음 턴을 버팁니다.',
    tone: 'blue',
  },
  sniper: {
    id: 'sniper',
    name: '후열 스나이퍼',
    role: 'Unit',
    cost: 3,
    attack: 4,
    health: 2,
    text: '필드에 남으면 강한 압박을 만듭니다.',
    tone: 'violet',
  },
  repair: {
    id: 'repair',
    name: '응급 정비',
    role: 'Tactic',
    cost: 1,
    attack: 0,
    health: 0,
    text: '내 본부 체력을 3 회복합니다.',
    tone: 'green',
  },
  barrage: {
    id: 'barrage',
    name: '집중 포화',
    role: 'Tactic',
    cost: 2,
    attack: 0,
    health: 0,
    text: '상대 본부에 3 피해를 줍니다.',
    tone: 'gold',
  },
};

const STARTING_DECK = [
  'striker',
  'guardian',
  'striker',
  'repair',
  'sniper',
  'barrage',
  'guardian',
  'striker',
  'barrage',
  'repair',
  'sniper',
  'striker',
].map((id, index) => ({ ...CARD_LIBRARY[id], instanceId: `${id}-${index}` }));

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

function createInitialState() {
  const base = {
    turn: 1,
    playerHealth: 20,
    enemyHealth: 20,
    maxEnergy: 1,
    energy: 1,
    deck: STARTING_DECK,
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
  return {
    ...state,
    discard: [...state.discard, card],
  };
}

function cardPower(card) {
  return Number(card.attack || 0) + Number(card.health || 0);
}

export default function DualAcademyTcgPlayPage() {
  const [state, setState] = useState(createInitialState);

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

  const resetMatch = () => setState(createInitialState());

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
