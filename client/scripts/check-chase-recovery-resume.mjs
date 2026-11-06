import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';
import { actor, runCombatScenario } from './lib/run-combat-scenario.mjs';

const { createPhaseCombatFleeRuntime } = await import('../src/app/simulation/_lib/phaseCombatFleeRuntime.js');
const { runPhaseCombatEncounter } = await import('../src/app/simulation/_lib/phaseCombatEncounterRuntime.js');
const { withSimulationRandom } = await import('../src/utils/simulationRandom.js');
const { isAiRecoveryLocked } = await import('../src/app/simulation/_lib/survivorLifecycleRuntime.js');

// Controlled module and bounded-phase evidence, not natural formation acceptance.
const START = 100;
const stats = { maxHp: 1000, attackPower: 1, defense: 0, attackSpeed: 1,
  attackRange: 40, sightRange: 50, moveSpeed: 3.5 };
const fleeing = actor('chase-resume-flee', { zoneId: 'a', stats: { ...stats },
  _spatial: { zoneId: 'a', x: 4, y: 4 }, _actionReadyAtSec: 1000, _basicAttackReadyAtSec: 1000 });
const chasing = actor('chase-resume-chaser', { zoneId: 'a', stats: { ...stats },
  _spatial: { zoneId: 'a', x: 4.5, y: 4 } });
const survivorMap = new Map([fleeing, chasing].map(row => [row._id, row]));
const events = [];
let now = START;
const emitRunEvent = (kind, payload) => events.push({ ...structuredClone(payload), kind, sec: now });
const ruleset = { ai: { escapeHpBelow: 0 }, pvp: { criticalFleeHpBelow: 0, teamCombatEnabled: true } };
const fleeRuntime = createPhaseCombatFleeRuntime({ state: {
  survivorMap, currentActionSec: () => now, estimatePower: () => 1, ruleset,
  zoneGraph: { a: ['b'], b: ['a'] }, forbiddenIds: new Set(), totalZonesCount: 5,
}, actions: { emitRunEvent, atNow: () => ({ sec: now }) } });
let fleeDraws = 0;
const chaseResult = withSimulationRandom(() => { fleeDraws++; return 0; },
  () => fleeRuntime.resolveFleeSequence(fleeing, chasing, { reason: 'controlled_retreat' }));
assert.equal(chaseResult.escaped, true);
assert.equal(chaseResult.caught, true);
assert.equal(fleeing.zoneId, 'b');
assert.equal(chasing.zoneId, 'b');
assert.equal(chasing._recentCombatReason, 'chase');
assert.equal(chasing._recentCombatUntil, START + 4);
assert.equal(fleeing._recentCombatUntil, START + 8);
assert.ok(fleeDraws > 0 && fleeDraws < 10);
assert.equal(events.filter(row => row.kind === 'move' && row.who === chasing._id && row.reason === 'chase').length, 1);
assert.equal(events.filter(row => row.kind === 'chase' && row.outcome === 'caught').length, 1);
assert.ok(chaseResult.preDamage > 0 && chaseResult.preDamage <= 13);
assert.equal(fleeing.hp, 1000 - chaseResult.preDamage);
assert.equal(chasing.hp, 1000);
const hpAfterChase = fleeing.hp;

function encounterAt(sec) {
  now = sec;
  return withSimulationRandom(() => 0.5, () => runPhaseCombatEncounter({ state: {
    actor: survivorMap.get(chasing._id), target: survivorMap.get(fleeing._id), survivorMap, currentActionSec: () => now,
    actionType: 'basic', ruleset, zoneGraph: { a: ['b'], b: ['a'] }, totalZonesCount: 5,
    shouldAvoidCombatByPower: () => null,
  }, actions: { emitRunEvent, atNow: () => ({ sec: now }) } }));
}
for (const sec of [100, 101, 103, 103.999999]) {
  assert.equal(isAiRecoveryLocked(chasing, sec), true);
  encounterAt(sec);
  assert.equal(survivorMap.get(fleeing._id).hp, hpAfterChase, 'ordinary basic must not damage through the chase recovery window');
  assert.equal(survivorMap.get(chasing._id)._recentCombatUntil, 104, 'attempting a locked attack must not restart recovery');
  assert.equal(survivorMap.get(chasing._id)._basicAttackReadyAtSec || 0, 0, 'a blocked attack must not reserve attack time');
}
assert.equal(events.filter(row => row.kind === 'damage').length, 0);
assert.equal(isAiRecoveryLocked(chasing, 104), false);
encounterAt(104);
const resumed = events.filter(row => row.kind === 'damage' && row.who === chasing._id);
assert.equal(resumed.length, 1);
assert.equal(resumed[0].sec, 104);
assert.ok(resumed[0].hpDamage > 0 && resumed[0].hpDamage < 10);
assert.equal(survivorMap.get(fleeing._id).hp, hpAfterChase - resumed[0].hpDamage);
assert.equal(survivorMap.get(chasing._id).hp, 1000);
assert.equal(survivorMap.get(chasing._id)._recentCombatUntil, 104);
const readyAfterResume = survivorMap.get(chasing._id)._basicAttackReadyAtSec;
assert.ok(readyAfterResume > 104);
encounterAt(104);
assert.equal(events.filter(row => row.kind === 'damage').length, 1, 'same-time repeat must not reserve or apply a second attack');
assert.equal(survivorMap.get(chasing._id)._basicAttackReadyAtSec, readyAfterResume);

const continued = await runCombatScenario([...survivorMap.values()], {
  startSec: 104, duration: 2, engage: false, seed: 'fixed-chase-recovery-resume',
});
const later = continued.events.filter(row => row.kind === 'damage' && row.who === chasing._id);
assert.ok(later.length > 0, 'the real bounded PvP loop must keep attacking after recovery');
assert.ok(later.every(row => row.at.sec >= readyAfterResume && row.at.sec <= 106));
assert.ok(later.every(row => row.hpDamage > 0 && row.hpDamage < 10));
assert.equal(continued.survivorMap.get(fleeing._id).hp,
  hpAfterChase - resumed[0].hpDamage - later.reduce((sum, row) => sum + row.hpDamage, 0));
assert.equal(continued.survivorMap.get(chasing._id).hp, 1000);
assert.ok(continued.frames.length > 0 && continued.frames.length < 100);
assert.ok(continued.frames.every((frame, index, rows) => frame.sec >= 104 && frame.sec <= 106
  && (!index || frame.sec >= rows[index - 1].sec)));
assert.equal(continued.frames.at(-1).sec, 106);
assert.ok(continued.events.length < 100);
console.log(JSON.stringify({ scope: 'controlled chase recovery and bounded PvP continuation',
  chaseAt: START, recoveryUntil: 104, chaseDamage: chaseResult.preDamage,
  lockedBasicHits: 0, firstResumedBasic: resumed[0].sec,
  laterBasicTimes: later.map(row => row.at.sec), endSec: continued.frames.at(-1).sec,
  damageAccounted: true, finiteFrames: continued.frames.length }));
