import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';
import { createTeamCombatParticipationDiagnostics } from './lib/team-combat-participation-diagnostics.mjs';
const { observeCombatParticipation } = await import('../src/app/simulation/_lib/combatParticipationObservationRuntime.js');
const { runTeamCombatRound } = await import('../src/app/simulation/_lib/teamCombatRuntime.js');
const { resolveCombatWinnerOutcome } = await import('../src/app/simulation/_lib/phaseCombatDamageRuntime.js');
const { createSeedRng } = await import('../src/app/simulation/_lib/randomSeedRuntime.js');
const { withSimulationRandom } = await import('../src/utils/simulationRandom.js');
const { runCombatScenario } = await import('./lib/run-combat-scenario.mjs');
const { findNextCombatAction } = await import('../src/app/simulation/_lib/combatTimingRuntime.js');

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
  actor._spatialMotion = { zoneId: 'zone', x: 8, y: 4, stopRange: 2, reason: 'approach', targetId: 'b' };
  actor._spatialLastSeen = { zoneId: 'zone', x: 8, y: 4, targetId: 'b', seenAtSec: 99.75 };
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
    actorCandidates: [{ actorId: 'a', branch: 'pending_cast', opponentCount: 0, nearestDistance: null,
      candidate: { actorId: 'a', targetId: 'b', actionType: 'skill_release', atSec: 103, choice: actor._pendingCharacterCast } }],
    worldStep: { fromSec: 100, toSec: 100.25, decisionSec: 101, actor },
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
  assert.equal(Object.hasOwn(captured.actorCandidates[0].candidate, 'choice'), false);
  assert.equal(Object.hasOwn(captured.worldStep, 'actor'), false);
  assert.equal(captured.actorCandidates[0].nearestDistance, null, 'No target distance is unknown, not zero.');
  assert.ok(Object.isFrozen(captured.actorCandidates[0].candidate) && Object.isFrozen(captured.actors[0].spatialMotion));
  assert.deepEqual(captured.actors[0].spatialMotion, { reason: 'approach', targetId: 'b', x: 8, y: 4, stopRange: 2 });
  assert.equal(captured.arbitration.scheduled, false);
  assert.equal(captured.resolution.hpDamage, 10);
  actor._pendingCharacterCast.targetId = 'changed'; actor._spatial.x = 10; actor._spatialMotion.x = 20;
  assert.equal(captured.actors[0].pendingCast.targetId, 'b'); assert.equal(captured.actors[0].spatial.x, 4);
  assert.equal(captured.actors[0].spatialMotion.x, 8);
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
    stage: 'actor_schedule', roster: Array.from({ length: 513 }, (_, index) => row(`a${index}`, 'one')),
    actorCandidates: Array.from({ length: 513 }, (_, index) => ({ actorId: `a${index}`, branch: 'no_intent_patrol' })),
  });
  assert.equal(snapshot.actors.length, 512); assert.equal(snapshot.truncated, true);
  assert.equal(snapshot.actorCandidates.length, 512); assert.equal(snapshot.actorCandidatesTruncated, true);
});
check('nearest observed target stays distinct from the already chosen attack target', () => {
  const attacker = row('attacker', 'one'), near = row('near', 'two'), selected = row('selected', 'two');
  near._spatial.x = 5; selected._spatial.x = 6;
  attacker.stats.attackRange = 3;
  attacker._combatIntent = { zoneId: 'zone', enemyTeamId: 'two', targetId: 'selected' };
  let snapshot;
  findNextCombatAction(new Map([attacker, near, selected].map(actor => [actor._id, actor])), 100,
    [], {}, new Set(), value => { snapshot = value; });
  const fact = snapshot.actorCandidates.find(value => value.actorId === 'attacker');
  assert.equal(fact.candidate.actionType, 'basic'); assert.equal(fact.candidate.targetId, 'selected');
  assert.equal(fact.nearestTargetId, 'near'); assert.equal(fact.nearestDistance, 1);
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
assert.ok(observedSnapshots.some(value => value.stage === 'post_world' && value.worldStep.toSec === value.nowSec));
const initialActorSchedule = observedSnapshots.find(value => value.stage === 'actor_schedule');
assert.equal(initialActorSchedule.actorCandidates.filter(value => value.candidate?.actionType === 'basic').length, 3,
  'Every actor best candidate is captured during the same pass, not only the global winner.');
assert.ok(initialActorSchedule.actorCandidates.some(value => value.candidate?.actorId !== initialActorSchedule.scheduled.actorId));
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

const chasing = async observer => {
  const pursuer = row('chaser', 'one'), target = row('stationary', 'two');
  pursuer.stats.moveSpeed = 4; pursuer.stats.sightRange = 20;
  target._spatial.x = 14; target.stats.sightRange = 20; target._actionReadyAtSec = 120;
  return runCombatScenario([pursuer, target], { duration: 3, observeCombatRuntime: observer });
};
const chaseSnapshots = [];
const chasePlain = await chasing(undefined), chaseObserved = await chasing(value => chaseSnapshots.push(value));
assert.deepEqual(loopEvidence(chaseObserved), loopEvidence(chasePlain));
assert.deepEqual(loopEvidence(await chasing(() => { throw Error('Fail during chase'); })), loopEvidence(chasePlain));
assert.deepEqual(loopEvidence(await chasing(value => {
  if (value.stage === 'actor_schedule') value.actorCandidates[0].candidate.atSec = 0;
  if (value.stage === 'post_world') value.actors[0].spatialMotion.x = 24;
})), loopEvidence(chasePlain));
assert.ok(chaseSnapshots.some(value => value.stage === 'actor_schedule' && value.actorCandidates.some(candidate =>
  candidate.actorId === 'chaser' && candidate.branch === 'observed_out_of_range' && candidate.motionReason === 'approach')));
const preMove = chaseSnapshots.find(value => value.stage === 'arbitration' && value.scheduled?.actorId === 'chaser'
  && value.scheduled.actionType === 'approach' && value.arbitration.scheduled);
const postMove = chaseSnapshots.find(value => value.stage === 'post_world' && value.scheduled?.actorId === 'chaser'
  && value.scheduled.actionType === 'approach' && value.worldStep.fromSec === preMove.nowSec);
assert.ok(postMove.actors.find(value => value.actorId === 'chaser').spatial.x
  > preMove.actors.find(value => value.actorId === 'chaser').spatial.x);
assert.ok(chaseObserved.events.some(value => value.kind === 'damage' && value.who === 'chaser' && value.hpDamage > 0),
  'Actual shared movement must lead into the normal attack guard and positive HP damage.');
assert.ok(chaseSnapshots.some(value => value.stage === 'actor_schedule' && value.actorCandidates.some(candidate =>
  candidate.actorId === 'chaser' && candidate.branch === 'basic_in_range' && candidate.candidate?.actionType === 'basic')));
checks++; console.log('PASS one-pass per-actor chase candidates link actual movement to normal attack/HP without diagnostic side effects');
const chaseDiagnostics = createTeamCombatParticipationDiagnostics({
  roster: [...chasePlain.survivorMap.values()], actorIds: ['chaser', 'stationary'],
});
const withCollector = await chasing(value => chaseDiagnostics.observe(value));
assert.deepEqual(loopEvidence(withCollector), loopEvidence(chasePlain),
  'The actual bounded collector, not only a snapshot callback, preserves the complete controlled loop.');
const diagnosticSummary = chaseDiagnostics.summary();
const chaseCounts = diagnosticSummary.countsByActor.chaser;
assert.ok(chaseCounts.actor_schedule.byActionType.approach > 0 && chaseCounts.actor_schedule.byActionType.basic > 0);
assert.ok(chaseCounts.post_world.pairing.matched > 0 && chaseCounts.post_world.actorMovement.moved > 0);
assert.ok(chaseCounts.post_world.motionBefore.chase > 0 && chaseCounts.post_world.motionAfter.chase > 0);
assert.equal(chaseCounts.post_world.pairing.no_pending, 0);
assert.equal(chaseCounts.post_world.pairing.identity_mismatch, 0);
assert.equal(chaseCounts.post_world.pairing.time_mismatch, 0);
assert.equal(chaseCounts.team_execution.hp_hit, 0,
  'An actual 1v1 hit is not a team-round resolution; its positive damage receipt was checked separately.');
const teamDiagnostics = createTeamCombatParticipationDiagnostics({
  roster: [...withoutObserver.survivorMap.values()], actorIds: ['a1', 'a2', 'b1'],
});
const teamCollected = await loop(value => teamDiagnostics.observe(value));
assert.deepEqual(loopEvidence(teamCollected), loopEvidence(withoutObserver));
assert.ok(teamDiagnostics.summary().countsByActor.a1.team_execution.hp_hit > 0);
for (const samples of Object.values(diagnosticSummary.causalSamplesByActor)) {
  assert.ok(samples.filter(sample => sample.stage === 'actor_schedule').length <= 3);
  assert.ok(samples.filter(sample => sample.stage === 'post_world').length <= 3);
}
checks++; console.log('PASS actual collector pairs real world steps and records HP attacks without changing the controlled loop');
console.log(`PASS ${checks} combat participation observation checks`);
