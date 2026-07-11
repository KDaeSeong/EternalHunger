import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const sourceUrl = new URL('../src/app/games/dual-academy-tcg/_lib/dualAcademyTcgFeedback.js', import.meta.url);
const source = await readFile(sourceUrl, 'utf8');
const moduleUrl = `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const feedback = await import(moduleUrl);

function duel(overrides = {}) {
  return {
    matchId: 'match-a',
    turn: 2,
    turnPlayer: 'player',
    phase: 'MAIN1',
    winner: '',
    chain: [],
    prompt: { kind: 'NONE' },
    players: {
      player: { lp: 8000, grave: [], banished: [] },
      enemy: { lp: 8000, grave: [], banished: [] },
    },
    events: [{ id: 'e0', type: 'TURN_START', actor: 'player', text: '나 턴 시작', turn: 2, phase: 'MAIN1' }],
    ...overrides,
  };
}

const baseState = duel();
const base = feedback.dualAcademyTcgFeedbackSnapshot(baseState);

function cueFor(nextState) {
  return feedback.dualAcademyTcgFeedbackCue(base, feedback.dualAcademyTcgFeedbackSnapshot(nextState));
}

const summonState = duel({
  events: [{ id: 'e1', type: 'SUMMON', actor: 'player', text: '유우카 일반 소환', turn: 2, phase: 'MAIN1' }],
});
assert.equal(cueFor(summonState), 'tcgSummon');
assert.equal(feedback.dualAcademyTcgPulse(summonState).action, 'summon');

assert.equal(cueFor(duel({
  events: [{ id: 'e2', type: 'SET', actor: 'player', text: '카운터 카드 세트', turn: 2, phase: 'MAIN1' }],
})), 'tcgSet');

assert.equal(cueFor(duel({
  chain: [{ chainId: 'c1' }],
  prompt: { kind: 'RESPOND', player: 'enemy' },
  events: [{ id: 'e3', type: 'EFFECT_ACTIVATE', actor: 'player', text: '전술 카드 발동', turn: 2, phase: 'MAIN1' }],
})), 'tcgChain');

assert.equal(cueFor(duel({
  prompt: { kind: 'SELECT_TARGET', player: 'player' },
  events: [{ id: 'e4', type: 'EFFECT_ACTIVATE', actor: 'player', text: '대상을 선택합니다.', turn: 2, phase: 'MAIN1' }],
})), 'tcgPrompt');

assert.equal(cueFor(duel({
  players: {
    player: { lp: 8000, grave: [], banished: [] },
    enemy: { lp: 6500, grave: [], banished: [] },
  },
  events: [{ id: 'e5', type: 'ATTACK_DECLARE', actor: 'player', text: '직접 공격: 1500 LP 피해', turn: 2, phase: 'BATTLE' }],
})), 'tcgHit');

assert.equal(cueFor(duel({
  players: {
    player: { lp: 8000, grave: [], banished: [] },
    enemy: { lp: 8000, grave: [{ id: 'destroyed' }], banished: [] },
  },
  events: [{ id: 'e6', type: 'ATTACK_DECLARE', actor: 'player', text: '상대 몬스터 파괴', turn: 2, phase: 'BATTLE' }],
})), 'tcgDestroy');

assert.equal(cueFor(duel({
  events: [{ id: 'e7', type: 'EFFECT_ACTIVATE', actor: 'enemy', text: '체인 효과가 무효화되었습니다.', turn: 2, phase: 'MAIN1' }],
})), 'tcgNegate');

assert.equal(cueFor(duel({
  events: [{ id: 'e8', type: 'PROMPT', actor: 'player', text: '이번 턴에는 이미 일반 소환했습니다.', turn: 2, phase: 'MAIN1' }],
})), 'tcgInvalid');

assert.equal(cueFor(duel({
  winner: 'player',
  events: [{ id: 'e9', type: 'LOSE', actor: 'enemy', text: 'AI 패배', turn: 2, phase: 'BATTLE' }],
})), 'tcgVictory');

assert.equal(cueFor(duel({ matchId: 'match-b' })), 'tcgStart');

const victoryPulse = feedback.dualAcademyTcgPulse(duel({ winner: 'player' }));
assert.equal(victoryPulse.action, 'victory');
assert.equal(victoryPulse.tone, 'green');

console.log(JSON.stringify({
  eventCues: 9,
  startReset: true,
  pulseAction: victoryPulse.action,
  pulseTone: victoryPulse.tone,
}, null, 2));
