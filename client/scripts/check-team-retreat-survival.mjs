import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';
import { actor, runCombatScenario } from './lib/run-combat-scenario.mjs';
import { withSimulationRandom } from '../src/utils/simulationRandom.js';

// Controlled regression only: the phase pipeline commits the production move
// decision at its boundary; the PvP helper then consumes those returned actors
// on one shared timeline. This does not simulate continuous transit or prove
// natural-match balance.
const { createSeedRng } = await import('../src/app/simulation/_lib/randomSeedRuntime.js');
const { runPhaseActorActionPipeline } = await import('../src/app/simulation/_lib/phaseActorActionPipelineRuntime.js');
const { getLumiaWalkEtaSec } = await import('../src/app/simulation/_lib/lumiaMapGeometryRuntime.js');

const startSec = 100;
const seed = 'team-retreat-survival-v1';
const zoneGraph = (hasExit) => hasExit
  ? { gas_station: ['alley'], alley: ['gas_station'] }
  : { gas_station: [] };
const makeRoster = () => [
  actor('a-retreater', { teamId: 'team-a', teamName: 'A', zoneId: 'gas_station', hp: 40, maxHp: 100,
    _spatial: { zoneId: 'gas_station', x: 4, y: 4 },
    stats: { maxHp: 100, attackPower: 30, defense: 0, attackSpeed: 0.5, attackRange: 2, sightRange: 12, moveSpeed: 3.5 } }),
  actor('b-ally', { teamId: 'team-a', teamName: 'A', zoneId: 'gas_station', hp: 100, maxHp: 100,
    _actionReadyAtSec: startSec + 20, _growthReadyAtSec: startSec + 20,
    _spatial: { zoneId: 'gas_station', x: 4, y: 4 },
    stats: { maxHp: 100, attackPower: 30, defense: 0, attackSpeed: 0.5, attackRange: 2, sightRange: 12, moveSpeed: 3.5 } }),
  actor('z-enemy', { teamId: 'team-z', teamName: 'Z', zoneId: 'gas_station', hp: 100, maxHp: 100,
    _actionReadyAtSec: startSec + 0.5, _growthReadyAtSec: startSec + 0.5,
    _basicAttackReadyAtSec: startSec + 0.25,
    _spatial: { zoneId: 'gas_station', x: 4, y: 4 },
    stats: { maxHp: 100, attackPower: 50, defense: 0, attackSpeed: 1, attackRange: 2, sightRange: 12, moveSpeed: 3.5 } }),
];

async function runCase(hasExit) {
  const input = makeRoster();
  const inputBefore = structuredClone(input);
  const working = structuredClone(input);
  const events = [];
  const movementSeed = createSeedRng(seed);
  const eta = hasExit ? getLumiaWalkEtaSec('gas_station', 'alley') : 1;
  const ruleset = { ai: { fightAvoidMinRatio: 0.55, recoverHpBelow: 0, safeSearchDepth: 3 } };
  const movementResult = withSimulationRandom(movementSeed, () => runPhaseActorActionPipeline({
    state: { phaseSurvivors: working, nextDay: 2, nextPhase: 'night', phaseIdxNow: 4,
      isSoloMatch: false, ruleset, zoneGraph: zoneGraph(hasExit), actionIntervalSec: 20,
      phaseDurationSec: getLumiaWalkEtaSec('gas_station', 'alley') + 0.5,
      currentActionSec: () => startSec,
      mapObj: { zones: [{ zoneId: 'gas_station' }, { zoneId: 'alley' }] },
      zones: [{ zoneId: 'gas_station' }, { zoneId: 'alley' }],
      craftables: [], itemKeyById: {}, itemMetaById: {}, itemNameById: {}, kiosks: [], publicItems: [] },
    actions: { atNow: () => ({ day: 2, phase: 'night', sec: startSec }),
      emitRunEvent: (kind, payload, at) => events.push({ kind, ...payload, at }) },
  }));
  assert.deepEqual(input, inputBefore, 'The production movement decision must not mutate the caller fixture.');

  const movementActor = movementResult.updatedSurvivors.find((row) => row._id === 'a-retreater');
  const combatRoster = ['a-retreater', 'z-enemy', 'b-ally'].map((id) => movementResult.updatedSurvivors.find((row) => row._id === id));
  const attackWindow = getLumiaWalkEtaSec('gas_station', 'alley') + 0.5;
  const combat = await runCombatScenario(combatRoster, { duration: attackWindow, startSec, nextDay: 2, seed });
  assert.deepEqual(input, inputBefore, 'Each complete case must leave the original fixture untouched.');
  return { inputBefore, movementActor, movementResult, events, eta, attackWindow, combat,
    movementRandomState: movementSeed.getState() };
}

let checks = 0;
function check(name, run) {
  run(); checks += 1; console.log(`PASS ${name}`);
}
async function checkAsync(name, run) {
  await run(); checks += 1; console.log(`PASS ${name}`);
}

const safe = await runCase(true);
const blocked = await runCase(false);

check('same local team threat is assessed from the same actors and stats in both topologies', () => {
  for (const result of [safe, blocked]) {
    assert.equal(result.events.find((event) => event.kind === 'team_decision')?.reason, 'team_power_gap');
  }
  assert.deepEqual(safe.inputBefore, blocked.inputBefore);
});

check('the production pipeline commits open-route travel ETA into actor readiness and action-cycle output', () => {
  assert.equal(safe.movementActor.zoneId, 'alley');
  assert.equal(safe.movementActor._actionReadyAtSec, startSec + safe.eta);
  assert.equal(safe.movementActor._growthReadyAtSec, startSec + 20);
  const cycle = safe.events.find((event) => event.kind === 'action_cycle' && event.who === 'a-retreater');
  assert.ok(cycle); assert.equal(cycle.intervalSec, 20); assert.equal(cycle.readyAtSec, startSec + 20);
  const moved = safe.events.find((event) => event.kind === 'move' && event.who === 'a-retreater');
  assert.ok(moved); assert.equal(moved.from, 'gas_station'); assert.equal(moved.to, 'alley');
  assert.equal(moved.etaSec, safe.eta);
  assert.equal(safe.movementActor.stats.moveSpeed, 3.5);
});

check('the blocked topology holds the same actor in the threatened zone without a retreat event', () => {
  assert.equal(blocked.movementActor.zoneId, 'gas_station');
  assert.equal(blocked.movementActor._actionReadyAtSec, startSec + 1);
  assert.equal(blocked.movementActor._growthReadyAtSec, startSec + 20);
  const blockedCycle = blocked.events.find((event) => event.kind === 'action_cycle' && event.who === 'a-retreater');
  assert.ok(blockedCycle); assert.equal(blockedCycle.readyAtSec, startSec + 20);
  assert.equal(blocked.events.some((event) => event.kind === 'move' && event.who === 'a-retreater'), false);
});

await checkAsync('the PvP loop starts at the movement decision time and preserves an actual enemy attack during the ETA window', async () => {
  assert.equal(safe.combat.frames[0].sec, startSec);
  assert.equal(blocked.combat.frames[0].sec, startSec);
  assert.equal(safe.attackWindow, blocked.attackWindow);
  assert.equal(safe.combat.frames.at(-1).sec, startSec + safe.attackWindow);
  assert.equal(blocked.combat.frames.at(-1).sec, startSec + blocked.attackWindow);
  const safeHits = safe.combat.events.filter((event) => event.kind === 'damage' && event.who === 'z-enemy'
    && event.targetId === 'a-retreater' && event.type === 'basic' && event.hpDamage > 0);
  const blockedHit = blocked.combat.events.find((event) => event.kind === 'damage' && event.who === 'z-enemy'
    && event.targetId === 'a-retreater' && event.type === 'basic' && event.hpDamage > 0);
  assert.equal(safeHits.length, 0, 'After the committed zone change, the enemy must not hit the retreated actor.');
  assert.ok(blockedHit, 'The same attacker must perform a real basic hit when no exit exists.');
  const enemy = blocked.movementResult.updatedSurvivors.find((row) => row._id === 'z-enemy');
  assert.ok(blockedHit.at.sec >= Math.max(startSec, enemy._actionReadyAtSec, enemy._basicAttackReadyAtSec),
    'The real hit must honor the attacker readiness returned by the production pipeline.');
  assert.ok(blockedHit.at.sec < startSec + safe.eta, 'The control hit must occur before the open-route ETA expires.');
  assert.ok(blockedHit.hpDamage >= blockedHit.hpBefore);
  assert.equal(blockedHit.hpAfter, 0);
  assert.equal(blocked.combat.survivorMap.get('a-retreater').hp, 0);
  assert.ok(safe.combat.survivorMap.get('a-retreater').hp > 0);
});

await checkAsync('fresh identical inputs reproduce movement, combat packets, frames and final HP without mutating fixtures', async () => {
  for (const [hasExit, original] of [[true, safe], [false, blocked]]) {
    const repeat = await runCase(hasExit);
    assert.deepEqual(repeat.inputBefore, original.inputBefore);
    assert.deepEqual(repeat.events, original.events);
    assert.deepEqual(repeat.movementRandomState, original.movementRandomState);
    assert.deepEqual(repeat.movementActor, original.movementActor);
    assert.deepEqual({ events: repeat.combat.events, frames: repeat.combat.frames,
      randomState: repeat.combat.randomState, hp: repeat.combat.survivorMap.get('a-retreater').hp },
    { events: original.combat.events, frames: original.combat.frames,
      randomState: original.combat.randomState, hp: original.combat.survivorMap.get('a-retreater').hp });
  }
});

console.log(`TEAM_RETREAT_SURVIVAL_CHECKS ${checks}/${checks}`);
console.log('SCOPE controlled phase-pipeline movement/readiness plus shared PvP observation; not continuous transit or natural-match balance');
