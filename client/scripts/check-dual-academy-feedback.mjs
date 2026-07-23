import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

function dataModule(source) {
  return `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
}

const feedbackUrl = new URL('../src/app/games/dual-academy-tcg/_lib/dualAcademyTcgFeedback.js', import.meta.url);
const catalogUrl = new URL('../src/app/games/dual-academy-tcg/_lib/tcgCatalog.js', import.meta.url);
const engineUrl = new URL('../src/app/games/dual-academy-tcg/_lib/tcgDuelEngine.js', import.meta.url);
const boardUrl = new URL('../src/app/games/dual-academy-tcg/_components/TcgPlayBoard.js', import.meta.url);
const advisorUrl = new URL('../src/app/games/dual-academy-tcg/_components/DualAcademyTcgAdvisorTab.js', import.meta.url);
const inspectUrl = new URL('../src/app/games/dual-academy-tcg/_components/DualAcademyTcgInspectTab.js', import.meta.url);
const logsUrl = new URL('../src/app/games/dual-academy-tcg/_components/DualAcademyTcgLogsTab.js', import.meta.url);
const pulseUrl = new URL('../src/app/games/dual-academy-tcg/_components/DualAcademyTcgDuelPulse.js', import.meta.url);
const handUrl = new URL('../src/app/games/dual-academy-tcg/_components/DualAcademyTcgHandTab.js', import.meta.url);
const deckUrl = new URL('../src/app/games/dual-academy-tcg/deck/page.js', import.meta.url);
const playUrl = new URL('../src/app/games/dual-academy-tcg/play/page.js', import.meta.url);
const iconUrl = new URL('../src/app/games/_components/GameActionIcon.js', import.meta.url);
const sfxUrl = new URL('../src/app/games/_lib/useGameSfx.js', import.meta.url);
const styleUrl = new URL('../src/styles/AppShell.css', import.meta.url);

const [
  feedbackSource,
  catalogSource,
  rawEngineSource,
  boardSource,
  advisorSource,
  inspectSource,
  logsSource,
  pulseSource,
  handSource,
  deckSource,
  playSource,
  iconSource,
  sfxSource,
  styleSource,
] = await Promise.all([
  readFile(feedbackUrl, 'utf8'),
  readFile(catalogUrl, 'utf8'),
  readFile(engineUrl, 'utf8'),
  readFile(boardUrl, 'utf8'),
  readFile(advisorUrl, 'utf8'),
  readFile(inspectUrl, 'utf8'),
  readFile(logsUrl, 'utf8'),
  readFile(pulseUrl, 'utf8'),
  readFile(handUrl, 'utf8'),
  readFile(deckUrl, 'utf8'),
  readFile(playUrl, 'utf8'),
  readFile(iconUrl, 'utf8'),
  readFile(sfxUrl, 'utf8'),
  readFile(styleUrl, 'utf8'),
]);

const catalogModuleUrl = dataModule(catalogSource);
const engineSource = rawEngineSource.replace("from './tcgCatalog.js';", `from '${catalogModuleUrl}';`);
assert.notEqual(engineSource, rawEngineSource, 'TCG engine catalog import replacement failed');

const [feedback, catalog, engine] = await Promise.all([
  import(dataModule(feedbackSource)),
  import(catalogModuleUrl),
  import(dataModule(engineSource)),
]);

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

assert.equal(feedback.dualAcademyTcgPulse(duel({
  prompt: { kind: 'RESPOND', player: 'player' },
})).promptAction, 'tcg-prompt-response');
assert.equal(feedback.dualAcademyTcgPulse(duel({
  prompt: { kind: 'SELECT_TARGET', player: 'player' },
})).promptAction, 'tcg-prompt-target');
assert.equal(feedback.dualAcademyTcgPulse(duel({
  prompt: { kind: 'SELECT_FROM_DECK', player: 'player' },
})).promptAction, 'tcg-prompt-deck');
assert.equal(feedback.dualAcademyTcgPulse(duel({
  prompt: { kind: 'SELECT_COST_MIKA_NEGATE', player: 'player' },
})).promptAction, 'tcg-prompt-cost');
assert.equal(feedback.dualAcademyTcgPulse(duel({
  prompt: { kind: 'TRIGGER_CONFIRM', player: 'player' },
})).promptAction, 'tcg-prompt-trigger');

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
})), 'tcgTargetPrompt');
assert.equal(cueFor(duel({
  prompt: { kind: 'SELECT_FROM_DECK', player: 'player' },
})), 'tcgDeckSearch');
assert.equal(cueFor(duel({
  prompt: { kind: 'TRIGGER_CONFIRM', player: 'player' },
})), 'tcgTriggerPrompt');

assert.equal(cueFor(duel({
  players: {
    player: { lp: 8000, grave: [], banished: [] },
    enemy: { lp: 6500, grave: [], banished: [] },
  },
  events: [{ id: 'e5', type: 'ATTACK_DECLARE', actor: 'player', text: '직접 공격: 1500 LP 피해', turn: 2, phase: 'BATTLE' }],
})), 'tcgDirectAttack');
assert.equal(feedback.dualAcademyTcgPulse(duel({
  events: [{ id: 'e5-pulse', type: 'ATTACK_DECLARE', actor: 'player', text: '직접 공격: 1500 LP 피해', turn: 2, phase: 'BATTLE' }],
})).action, 'tcg-direct-attack');

assert.equal(cueFor(duel({
  players: {
    player: { lp: 8000, grave: [], banished: [] },
    enemy: { lp: 8000, grave: [{ id: 'destroyed' }], banished: [] },
  },
  events: [{ id: 'e6', type: 'ATTACK_DECLARE', actor: 'player', text: '상대 몬스터 파괴', turn: 2, phase: 'BATTLE' }],
})), 'tcgDestroy');

assert.equal(cueFor(duel({
  events: [{ id: 'e7', type: 'EFFECT_ACTIVATE', actor: 'enemy', text: '체인 효과가 무효화되었습니다.', turn: 2, phase: 'MAIN1' }],
})), 'tcgCounter');

assert.equal(cueFor(duel({
  players: {
    player: { lp: 8000, grave: [], banished: [] },
    enemy: { lp: 7200, grave: [], banished: [] },
  },
  events: [{ id: 'e7-pierce', type: 'DAMAGE_TAKEN', actor: 'enemy', text: '관통: 800 LP 피해', turn: 2, phase: 'BATTLE' }],
})), 'tcgPierce');

assert.equal(cueFor(duel({
  players: {
    player: { lp: 8000, grave: [], banished: [] },
    enemy: { lp: 8000, grave: [], banished: [{ id: 'banished' }] },
  },
  events: [{ id: 'e7-banish', type: 'EFFECT_ACTIVATE', actor: 'player', text: '상대 카드 제외', payload: { effect: 'banish-enemy-card' }, turn: 2, phase: 'MAIN1' }],
})), 'tcgBanish');

assert.equal(cueFor(duel({
  players: {
    player: { lp: 8400, grave: [], banished: [] },
    enemy: { lp: 8000, grave: [], banished: [] },
  },
  events: [{ id: 'e7-heal', type: 'EFFECT_ACTIVATE', actor: 'player', text: '400 LP 회복', turn: 2, phase: 'MAIN1' }],
})), 'tcgHeal');

const shieldedState = duel({
  players: {
    player: { lp: 8000, grave: [], banished: [], monster: [{ shield: true }] },
    enemy: { lp: 8000, grave: [], banished: [] },
  },
});
const shieldBrokenState = duel({
  players: {
    player: { lp: 8000, grave: [], banished: [], monster: [{ shield: false }] },
    enemy: { lp: 8000, grave: [], banished: [] },
  },
  events: [{ id: 'e7-shield-break', type: 'ATTACK_DECLARE', actor: 'enemy', text: '보호막 대상과 전투했습니다.', turn: 2, phase: 'BATTLE' }],
});
assert.equal(
  feedback.dualAcademyTcgFeedbackCue(
    feedback.dualAcademyTcgFeedbackSnapshot(shieldedState),
    feedback.dualAcademyTcgFeedbackSnapshot(shieldBrokenState),
  ),
  'tcgShieldBreak',
);

const chainWaitingState = duel({ chain: [{ chainId: 'resolve-me' }] });
const chainResolvedState = duel({
  events: [{ id: 'e7-chain-resolve', type: 'EFFECT_ACTIVATE', actor: 'player', text: '효과를 처리했습니다.', turn: 2, phase: 'MAIN1' }],
});
assert.equal(
  feedback.dualAcademyTcgFeedbackCue(
    feedback.dualAcademyTcgFeedbackSnapshot(chainWaitingState),
    feedback.dualAcademyTcgFeedbackSnapshot(chainResolvedState),
  ),
  'tcgChainResolve',
);

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
assert.deepEqual(victoryPulse.impacts, []);

const impactPulse = feedback.dualAcademyTcgPulse(duel({
  players: {
    player: { lp: 7600, hand: [{ id: 'drawn' }], grave: [], banished: [], monster: [{ id: 'summoned' }] },
    enemy: { lp: 6800, hand: [], grave: [], banished: [] },
  },
  events: [{ id: 'e-impact', type: 'DAMAGE_TAKEN', actor: 'enemy', text: '직접 공격: 1200 LP 피해', turn: 2, phase: 'BATTLE' }],
}), base);
assert.ok(impactPulse.impacts.some((item) => item.label === '내 LP' && item.value === '-400'), '듀얼 펄스는 내 LP 변화를 표시해야 합니다.');
assert.ok(impactPulse.impacts.some((item) => item.label === 'AI LP' && item.value === '-1,200'), '듀얼 펄스는 AI LP 변화를 표시해야 합니다.');
assert.ok(impactPulse.impacts.some((item) => item.label === '내 필드' && item.value === '+1'), '듀얼 펄스는 필드 전개 변화를 표시해야 합니다.');

const cardMap = new Map(catalog.FALLBACK_TCG_CARDS.map((card) => [card.id, card]));
const zone = () => Array.from({ length: 5 }, () => null);

function cardInstance(id, owner, suffix, overrides = {}) {
  const card = cardMap.get(id);
  assert.ok(card, `Missing fallback card ${id}`);
  return {
    ...card,
    instanceId: `${owner}-${id}-${suffix}`,
    owner,
    face: 'up',
    position: 'ATK',
    currentHealth: Math.max(1, Number(card.health || 1)),
    hasAttacked: false,
    shield: Boolean(card.shield),
    protectedUntilTurn: 0,
    ...overrides,
  };
}

function playerState(overrides = {}) {
  return {
    lp: 8000,
    deck: [],
    hand: [],
    grave: [],
    banished: [],
    monster: zone(),
    spellTrap: zone(),
    field: null,
    flags: { normalSummoned: false, usedEffects: {} },
    ...overrides,
  };
}

function engineState(overrides = {}) {
  const seed = engine.createDuelState();
  return {
    ...seed,
    matchId: 'engine-match',
    turn: 2,
    turnPlayer: 'player',
    phase: 'MAIN1',
    winner: '',
    players: { player: playerState(), enemy: playerState() },
    chain: [],
    prompt: { kind: 'NONE' },
    log: [],
    events: [],
    ...overrides,
  };
}

const mika = cardInstance('TRI-MIKA-01', 'player', 'mika');
const trinityCost = cardInstance('TRI-TUNE-01', 'player', 'cost');
const enemySpell = cardInstance('TRI-NORMAL-01', 'enemy', 'spell');
const mikaPlayer = playerState({ monster: [mika, trinityCost, null, null, null] });
const mikaEnemy = playerState({ spellTrap: [enemySpell, null, null, null, null] });
const enemyChain = {
  chainId: 'enemy-chain',
  owner: 'enemy',
  source: { zone: 'spellTrap', slot: 0 },
  cardId: enemySpell.id,
  cardName: enemySpell.name,
  meta: { effect: 'destroy-enemy-unit' },
};
const mikaResponseState = engineState({
  players: { player: mikaPlayer, enemy: mikaEnemy },
  chain: [enemyChain],
  prompt: { kind: 'RESPOND', player: 'player', toChainId: enemyChain.chainId },
});

const mikaReadiness = engine.mikaQuickReadiness(mikaResponseState, 'player');
assert.equal(mikaReadiness.canActivate, true);
assert.equal(mikaReadiness.options.length, 1);
assert.equal(mikaReadiness.options[0].slot, 1);

const mikaCostPrompt = engine.activateMikaQuick(mikaResponseState);
assert.equal(mikaCostPrompt.prompt.kind, 'SELECT_COST_MIKA_NEGATE');
assert.equal(
  feedback.dualAcademyTcgFeedbackCue(
    feedback.dualAcademyTcgFeedbackSnapshot(mikaResponseState),
    feedback.dualAcademyTcgFeedbackSnapshot(mikaCostPrompt),
  ),
  'tcgMikaCost',
);

const mikaPaid = engine.chooseMikaNegateCost(mikaCostPrompt, mikaCostPrompt.prompt.options[0]);
assert.equal(mikaPaid.players.player.monster[1], null);
assert.equal(mikaPaid.players.player.grave.at(-1).id, 'TRI-TUNE-01');
assert.equal(mikaPaid.players.player.flags.usedEffects['TRI-MIKA-01:MIKA_QUICK_2'], true);
assert.equal(mikaPaid.chain[0].meta.effect, 'mika-negate');
assert.equal(mikaPaid.prompt.kind, 'RESPOND');
assert.equal(mikaPaid.prompt.player, 'enemy');

const mikaResolved = engine.resolveChain(engine.passResponse(mikaPaid));
assert.equal(mikaResolved.chain.length, 0);
assert.equal(mikaResolved.players.enemy.spellTrap[0], null);
assert.equal(mikaResolved.players.enemy.grave.some((card) => card.id === 'TRI-NORMAL-01'), true);
assert.equal(mikaResolved.players.player.monster[0].id, 'TRI-MIKA-01');
assert.equal(mikaResolved.events[0].payload.effect, 'mika-negate');
assert.equal(
  feedback.dualAcademyTcgFeedbackCue(
    feedback.dualAcademyTcgFeedbackSnapshot(mikaResponseState),
    feedback.dualAcademyTcgFeedbackSnapshot(mikaResolved),
  ),
  'tcgMikaNegate',
);

const mikaUsedState = {
  ...mikaResolved,
  chain: [{ ...enemyChain, chainId: 'enemy-chain-2' }],
  prompt: { kind: 'RESPOND', player: 'player', toChainId: 'enemy-chain-2' },
};
assert.equal(engine.mikaQuickReadiness(mikaUsedState, 'player').canActivate, false);

const noCostState = engineState({
  players: { player: playerState({ monster: [mika, null, null, null, null] }), enemy: mikaEnemy },
  chain: [enemyChain],
  prompt: { kind: 'RESPOND', player: 'player', toChainId: enemyChain.chainId },
});
assert.equal(engine.mikaQuickReadiness(noCostState, 'player').canActivate, false);

const mikaBattleState = engineState({
  phase: 'BATTLE',
  players: {
    player: playerState({ monster: [cardInstance('TRI-MIKA-01', 'player', 'battle'), null, null, null, null] }),
    enemy: playerState(),
  },
});
const mikaBattle = engine.declareAttack(mikaBattleState, 0, null);
assert.equal(mikaBattle.players.enemy.lp, 7991);
assert.equal(mikaBattle.events[0].payload.effect, 'mika-battle-boost');
assert.equal(feedback.dualAcademyTcgPulse(mikaBattle).action, 'tcg-mika-burst');

const hinaBattleState = engineState({
  phase: 'BATTLE',
  players: {
    player: playerState({ lp: 7000, monster: [cardInstance('GEH-HINA-01', 'player', 'battle'), null, null, null, null] }),
    enemy: playerState({ monster: [cardInstance('striker', 'enemy', 'target'), null, null, null, null] }),
  },
});
const hinaBattle = engine.declareAttack(hinaBattleState, 0, 0);
assert.equal(hinaBattle.players.player.lp, 7400);
assert.equal(hinaBattle.players.enemy.monster[0], null);
assert.equal(hinaBattle.events[0].payload.effect, 'hina-battle-heal');
assert.equal(feedback.dualAcademyTcgPulse(hinaBattle).action, 'tcg-hina-recover');

const yuuka = cardInstance('MIL-YUUKA-01', 'player', 'yuuka');
const yuukaState = engineState({
  players: { player: playerState({ monster: [yuuka, null, null, null, null] }), enemy: playerState() },
});
const yuukaPrompt = engine.activateYuukaQuick(yuukaState, 0);
assert.equal(yuukaPrompt.prompt.kind, 'SELECT_TARGET');
const yuukaProtected = engine.chooseTarget(yuukaPrompt, yuukaPrompt.prompt.options[0]);
assert.equal(yuukaProtected.players.player.monster[0].dataCounters, 1);
assert.equal(yuukaProtected.players.player.monster[0].protectedUntilTurn, 2);
assert.equal(engine.targetOptions(yuukaProtected, 'enemy', 'destroy-enemy-unit').length, 0);
assert.equal(yuukaProtected.events[0].payload.effect, 'yuuka-data-shield');
assert.equal(feedback.dualAcademyTcgPulse(yuukaProtected).action, 'tcg-yuuka-guard');

for (const token of ['activateMikaQuick', 'chooseMikaNegateCost', 'SELECT_COST_MIKA_NEGATE', 'tcg-mika-negate', 'tcg-mika-cost']) {
  assert.equal(boardSource.includes(token), true, `TCG prompt UI is missing ${token}`);
}
for (const token of ['tcg-mika-cost', 'tcg-mika-negate', 'tcg-mika-burst', 'tcg-hina-recover', 'tcg-yuuka-guard']) {
  assert.equal(iconSource.includes(token), true, `Shared action icon map is missing ${token}`);
}
for (const token of [
  'tcg-card-counter',
  'tcg-card-field',
  'tcg-card-monster',
  'tcg-card-quick',
  'tcg-card-set',
  'tcg-card-spell',
  'tcg-card-trap',
  'tcg-prompt-cost',
  'tcg-prompt-deck',
  'tcg-prompt-response',
  'tcg-prompt-target',
  'tcg-prompt-trigger',
  'tcg-zone-banished',
  'tcg-zone-deck',
  'tcg-zone-empty',
  'tcg-zone-field',
  'tcg-zone-grave',
  'tcg-zone-hand',
  'tcg-zone-monster',
  'tcg-zone-spell-trap',
]) {
  assert.equal(iconSource.includes(token), true, `Shared action icon map is missing ${token}`);
}
for (const token of ['cardSemanticAction', 'zoneSemanticAction', 'CardTypeBadge']) {
  assert.equal(boardSource.includes(token), true, `TCG card presentation is missing ${token}`);
}
assert.equal(handSource.includes('<CardTypeBadge card={card} />'), true, 'Hand cards must show semantic card-type icons');
assert.equal(deckSource.includes('deckCardAction'), true, 'Deck cards must show semantic card-type icons');
for (const token of [
  'tcg-direct-attack',
  'tcg-pierce',
  'tcg-clash',
  'tcg-shield',
  'tcg-shield-break',
  'tcg-banish',
  'tcg-heal',
  'tcg-counter',
  'tcg-chain-resolve',
  'tcg-deck-out',
]) {
  assert.equal(iconSource.includes(token), true, `Shared action icon map is missing ${token}`);
}
for (const token of [
  'tcgMikaCost',
  'tcgMikaNegate',
  'tcgMikaBurst',
  'tcgHinaRecover',
  'tcgYuukaGuard',
  'tcgYuukaSearch',
  'tcgDirectAttack',
  'tcgPierce',
  'tcgClash',
  'tcgShield',
  'tcgShieldBreak',
  'tcgBanish',
  'tcgHeal',
  'tcgCounter',
  'tcgChainResolve',
  'tcgDeckOut',
  'tcgTargetPrompt',
  'tcgDeckSearch',
  'tcgTriggerPrompt',
]) {
  assert.equal(sfxSource.includes(token), true, `Shared SFX library is missing ${token}`);
}

const semanticIconCount = [boardSource, advisorSource, inspectSource, logsSource, pulseSource, handSource, deckSource]
  .reduce((sum, source) => sum + (source.match(/<GameActionIcon\b/g) || []).length, 0);
assert.ok(semanticIconCount >= 32, `Expected at least 32 semantic TCG icons, found ${semanticIconCount}`);
assert.equal(logsSource.includes('dualAcademyTcgEventPresentation'), true, 'TCG event log must use semantic event presentations');
assert.equal(pulseSource.includes('pulse.promptAction'), true, 'TCG pulse must show a semantic prompt icon');
assert.equal(pulseSource.includes('pulse.chainAction'), true, 'TCG pulse must show a semantic chain icon');
assert.equal(pulseSource.includes('pulse.impacts'), true, 'TCG pulse must render concrete duel impacts');
assert.equal(playSource.includes('setDuelPulse(dualAcademyTcgPulse(state, previous))'), true, 'TCG page must calculate impacts before replacing the feedback snapshot');
assert.equal(playSource.includes('<h1>v13 듀얼</h1>'), false, 'TCG page title must not expose an internal version label');
assert.equal(styleSource.includes('.tcg-duel-pulse__impact'), true, 'TCG impact chips need dedicated compact styles');

console.log(JSON.stringify({
  eventCues: 22,
  characterEffectCues: 6,
  semanticIcons: semanticIconCount,
  cardAndZoneIconKinds: 20,
  promptCues: 3,
  impactKinds: impactPulse.impacts.length,
  mikaCostOptions: mikaReadiness.options.length,
  mikaNegateResolved: true,
  mikaBattleAttack: 9,
  hinaBattleRecovery: 400,
  yuukaTargetProtection: true,
  startReset: true,
  pulseAction: victoryPulse.action,
  pulseTone: victoryPulse.tone,
}, null, 2));
