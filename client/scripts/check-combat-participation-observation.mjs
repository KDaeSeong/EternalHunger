import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';
const { observeCombatParticipation } = await import('../src/app/simulation/_lib/combatParticipationObservationRuntime.js');
const { runTeamCombatRound } = await import('../src/app/simulation/_lib/teamCombatRuntime.js');
const { resolveCombatWinnerOutcome } = await import('../src/app/simulation/_lib/phaseCombatDamageRuntime.js');
const { createSeedRng } = await import('../src/app/simulation/_lib/randomSeedRuntime.js');
const { withSimulationRandom } = await import('../src/utils/simulationRandom.js');
const { runCombatScenario } = await import('./lib/run-combat-scenario.mjs');

let checks = 0;
const check = (name, run) => { run(); checks++; console.log(`PASS ${name}`); };
const row = (id, team) => ({ _id: id, name: id, teamId: team, zoneId: 'zone', hp: 500, maxHp: 500,
  _spatial: { zoneId: 'zone', x: 4, y: 4 }, activeEffects: [], inventory: [], equipped: {},
  stats: { maxHp: 500, attackPower: 20, defense: 0, attackSpeed: 1, attackRange: 2, sightRange: 10 },
  tacticalSkill: 'none', _tacNextAbsSec: 1e9 });

check('disabled observation does not inspect actors or build a snapshot', () => {
  const actor = { get _id() { throw Error('No disabled-path actor read'); } };
  observeCombatParticipation(undefined, { roster: [actor] });
});
check('compact owned diagnostics do not retain live actor, cast, hunt or scheduler graphs', () => {
  const actor = row('a', 'one');
  actor._pendingCharacterCast = { targetId: 'b', releaseAtSec: 103, def: { nested: 'not retained' } };
  actor._wildlifeHunt = { id: 'hunt:a', kind: 'bear', target: row('wildlife', 'animal') };
  actor._recentCombatUntil = 104; actor._recentCombatReason = 'lost_track';
  const before = structuredClone(actor), random = createSeedRng('observation');
  const randomBefore = random.getState();
  let captured;
  withSimulationRandom(random, () => observeCombatParticipation(snapshot => { captured = snapshot; }, {
    stage: 'schedule', nowSec: 100, roster: [actor], newDeadIds: ['a'], wildlifeAssistIds: new Map([['a', 'owner']]),
    scheduled: { actorId: 'a', targetId: 'b', actionType: 'skill_release', atSec: 103, choice: actor._pendingCharacterCast },
    arbitration: { selectedScheduler: 'pvp', selectedActorId: 'a', selectedActionType: 'skill_release',
      selectedAtSec: 103, decisionSec: 101, scheduled: false, choice: actor._pendingCharacterCast },
    resolution: { actorId: 'a', targetId: 'b', encounterId: 'owned', outcome: 'hp_hit', hpBefore: 20, hpAfter: 10,
      hpDamage: 10, actor },
  }));
  assert.deepEqual(actor, before); assert.deepEqual(random.getState(), randomBefore);
  assert.ok(Object.isFrozen(captured) && Object.isFrozen(captured.actors[0].pendingCast));
  assert.equal(captured.actors[0].deadInThisPhase, true); assert.equal(captured.actors[0].bossAssistOwnerId, 'owner');
  assert.deepEqual(captured.actors[0].pendingCast, { targetId: 'b', releaseAtSec: 103 });
  assert.deepEqual(captured.actors[0].hunt, { encounterId: 'hunt:a', kind: 'bear' });
  assert.equal(Object.hasOwn(captured.actors[0], 'inventory'), false);
  assert.equal(Object.hasOwn(captured.scheduled, 'choice'), false);
  assert.equal(Object.hasOwn(captured.arbitration, 'choice'), false);
  assert.equal(Object.hasOwn(captured.resolution, 'actor'), false);
  assert.equal(captured.arbitration.scheduled, false);
  assert.equal(captured.resolution.hpDamage, 10);
  actor._pendingCharacterCast.targetId = 'changed'; actor._spatial.x = 10;
  assert.equal(captured.actors[0].pendingCast.targetId, 'b'); assert.equal(captured.actors[0].spatial.x, 4);
});

const round = observer => {
  const actors = [row('a1', 'one'), row('a2', 'one'), row('b1', 'two')];
  const survivorMap = new Map(actors.map(actor => [actor._id, actor])), events = [];
  const random = createSeedRng('observed-round'); let result;
  const emitRunEvent = (kind, payload, at) => events.push(structuredClone({ kind, ...payload, at }));
  withSimulationRandom(random, () => {
    result = runTeamCombatRound({ actor: actors[0], target: actors[2], survivorMap, nowSec: 100, onlyActorId: 'a1',
      observeCombatRuntime: observer, emitRunEvent, at: { sec: 100 },
      resolveStrike: (actor, target) => resolveCombatWinnerOutcome({
        state: { actor, target, currentActionSec: () => 100, supportRoster: actors, strikeOnly: true },
        actions: { emitRunEvent, atNow: () => ({ sec: 100 }) },
      }),
    });
  });
  return { result, actors, events, random: random.getState() };
};
check('observation on and off preserve the real strike, actor clocks, events and RNG exactly', () => {
  const snapshots = [];
  const plain = round(undefined), observed = round(value => { snapshots.push(value); });
  assert.deepEqual(observed, plain);
  const snapshot = snapshots.find(value => value.stage === 'team_queue');
  assert.deepEqual(snapshot.sides, [['a1', 'a2'], ['b1']]); assert.deepEqual(snapshot.participants, ['a1']);
  assert.equal(snapshot.onlyActorId, 'a1'); assert.equal(snapshot.initiatorId, 'a1');
  assert.equal(snapshot.stage, 'team_queue'); assert.equal(snapshot.nowSec, 100);
  assert.equal(plain.actors[0]._basicAttackReadyAtSec, 101);
  assert.equal(plain.events.filter(event => event.kind === 'team_strike').length, 1);
  const resolution = snapshots.find(value => value.stage === 'team_execution').resolution;
  assert.equal(resolution.outcome, 'hp_hit');
  assert.equal(resolution.actorId, 'a1'); assert.equal(resolution.targetId, 'b1');
  assert.equal(resolution.hpBefore - resolution.hpAfter, resolution.hpDamage);
  assert.equal(resolution.hpDamage, plain.events.find(event => event.kind === 'team_strike').damage);
});
check('a throwing or mutation-attempting observer cannot interrupt actual hit settlement', () => {
  const plain = round(undefined);
  assert.deepEqual(round(() => { throw Error('Failed observer'); }), plain);
  assert.deepEqual(round(snapshot => { snapshot.actors[0].hp = 0; }), plain);
});
check('diagnostic roster snapshots have an explicit bounded overflow flag', () => {
  let snapshot;
  observeCombatParticipation(value => { snapshot = value; }, {
    stage: 'schedule', roster: Array.from({ length: 513 }, (_, index) => row(`a${index}`, 'one')),
  });
  assert.equal(snapshot.actors.length, 512); assert.equal(snapshot.truncated, true);
});
check('team execution distinguishes an actual absorbed attack from positive HP damage', () => {
  const actors = [row('a1', 'one'), row('a2', 'one'), row('b1', 'two')];
  actors[2].activeEffects = [{ name: '무적', remainingDuration: 10, durationUnit: 'sec' }];
  const survivorMap = new Map(actors.map(actor => [actor._id, actor])), snapshots = [], events = [];
  const emitRunEvent = (kind, payload, at) => events.push({ kind, ...payload, at });
  runTeamCombatRound({ actor: actors[0], target: actors[2], survivorMap, nowSec: 100, onlyActorId: 'a1',
    observeCombatRuntime: value => snapshots.push(value), emitRunEvent, at: { sec: 100 },
    resolveStrike: (actor, target) => resolveCombatWinnerOutcome({
      state: { actor, target, currentActionSec: () => 100, supportRoster: actors, strikeOnly: true },
      actions: { emitRunEvent, atNow: () => ({ sec: 100 }) },
    }),
  });
  assert.equal(snapshots.find(value => value.stage === 'team_execution').resolution.outcome, 'performed_no_hp');
  assert.equal(events.find(value => value.kind === 'damage').hpDamage, 0);
  assert.equal(actors[0]._basicAttackReadyAtSec, 101, 'Even a blocked attack pays its normal attack clock.');
});

const loop = async observer => runCombatScenario([row('a1', 'one'), row('b1', 'two'), row('a2', 'one')],
  { duration: 0.75, observeCombatRuntime: observer });
const loopEvidence = result => ({ events: result.events, frames: result.frames, randomState: result.randomState,
  survivors: [...result.survivorMap.values()], newDeadIds: result.newDeadIds,
  roundKills: result.roundKills, roundAssists: result.roundAssists });
const withoutObserver = await loop(undefined);
const observedSnapshots = [];
const withObserver = await loop(value => observedSnapshots.push(value));
assert.deepEqual(loopEvidence(withObserver), loopEvidence(withoutObserver),
  'Arbitration and execution observations preserve all frames/events/state/RNG, not helper function identities.');
assert.deepEqual(loopEvidence(await loop(() => { throw Error('Fail at every observer stage'); })), loopEvidence(withoutObserver));
assert.deepEqual(loopEvidence(await loop(value => { value.actors[0].hp = 0; })), loopEvidence(withoutObserver));
assert.ok(observedSnapshots.some(value => value.stage === 'arbitration' && value.arbitration.scheduled
  && value.arbitration.selectedScheduler === 'pvp'));
assert.ok(observedSnapshots.some(value => value.stage === 'team_execution' && value.resolution.outcome === 'hp_hit'));
checks++; console.log('PASS actual PvP arbitration and team execution are exact with observing off, on, throwing and mutation attempts');

const delayed = [row('a1', 'one'), row('b1', 'two')];
for (const actor of delayed) actor._basicAttackReadyAtSec = 110;
const deferredSnapshots = [];
const deferred = await runCombatScenario(delayed, { duration: 0.75,
  observeCombatRuntime: value => deferredSnapshots.push(value) });
assert.ok(deferredSnapshots.some(value => value.stage === 'arbitration' && value.scheduled
  && value.scheduled.atSec === 110 && value.arbitration.scheduled === false));
assert.equal(deferred.events.filter(value => value.kind === 'damage').length, 0);
checks++; console.log('PASS a future PvP candidate remains deferred rather than counted as an attack');
console.log(`PASS ${checks} combat participation observation checks`);
