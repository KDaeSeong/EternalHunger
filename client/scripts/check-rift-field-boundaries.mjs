import assert from 'node:assert/strict';
import './lib/register-simulation-modules.mjs';

// Written while verification is paused. This script has not been executed.
const { getCombatSpaceId } = await import('../src/utils/combatSpaceLogic.js');
const { getRuleset } = await import('../src/utils/rulesets.js');
const { getActorDimensionRiftId, enterDimensionRiftSpace, getDimensionRiftEntryIssue,
  releaseOrphanedDimensionRiftSpaces } = await import('../src/app/simulation/_lib/dimensionRiftSpaceRuntime.js');
const { withdrawFromDimensionRift } = await import('../src/app/simulation/_lib/dimensionRiftWithdrawalRuntime.js');
const { advanceDimensionRiftContest, findActorDimensionRift } = await import('../src/app/simulation/_lib/dimensionRiftContestRuntime.js');
const { runPhaseActorActionPipeline } = await import('../src/app/simulation/_lib/phaseActorActionPipelineRuntime.js');
const { runSingleActorPhaseAction } = await import('../src/app/simulation/_lib/phaseActorActionStepRuntime.js');
const { runActorPostActionPhase } = await import('../src/app/simulation/_lib/phaseActorPostActionRuntime.js');
const { runHuntAction } = await import('../src/app/simulation/_lib/phaseHuntActionRuntime.js');
const { runActorMovementDecisionPhase, applyActorKnockbackMovement } = await import('../src/app/simulation/_lib/phaseActorMovementRuntime.js');
const { advanceSpatialMovement } = await import('../src/app/simulation/_lib/combatSpatialRuntime.js');
const { runDetonationTickPhase } = await import('../src/app/simulation/_lib/phaseDetonationTickRuntime.js');
const { createPhaseCombatFleeRuntime } = await import('../src/app/simulation/_lib/phaseCombatFleeRuntime.js');
const { resolvePvpAvoidanceMove } = await import('../src/app/simulation/_lib/phasePvpAvoidanceRuntime.js');
const { runPhaseCombatEncounter } = await import('../src/app/simulation/_lib/phaseCombatEncounterRuntime.js');
const { reconcileCharacterCasts } = await import('../src/app/simulation/_lib/characterCastRuntime.js');
const { describeObserverEvent, buildTeamObserverModel } = await import('../src/app/simulation/_lib/teamObserverRuntime.js');

let checks = 0;
function check(name, run) { run(); checks++; console.log(`PASS ${name}`); }
const ruleset = getRuleset('ER_S11');
const makeRift = () => ({ id: 'r', zoneId: 'z', day: 2, phase: 'night', maxTeams: 2,
  resolved: false, entrants: [], entrantTeamIds: [] });
const actor = (id, teamId = id, extra = {}) => ({ _id: id, name: id, teamId, teamName: teamId,
  zoneId: 'z', hp: 70, maxHp: 100,
  inventory: [{ itemId: 'held-material', qty: 2, type: 'material', tags: [] }], simCredits: 7, activeEffects: [],
  _spatial: { zoneId: 'z', x: 4, y: 4 },
  stats: { maxHp: 100, attackPower: 20, defense: 0, attackSpeed: 1, moveSpeed: 3, sightRange: 10, attackRange: 5 },
  cooldowns: { portableSafeZone: 5, cnotGate: 5, weaponSkill: 5 }, gadgetEnergy: 100,
  detonationSec: 7, detonationMaxSec: 30, tacticalSkill: '블링크',
  _objectiveContestType: 'dimension_rift', _objectiveContestUntilPhaseIdx: 3, ...extra });
const enter = (row) => enterDimensionRiftSpace(row, makeRift(), 100);
const step = (rift, rows, nowSec = 100, overrides = {}) => advanceDimensionRiftContest(rift, rows, {
  nowSec, phaseStartSec: 100, phaseDurationSec: 60, day: 2, phase: 'night', phaseIdxNow: 3,
  rule: { entryWindowSec: 45 }, ...overrides,
});
const resources = (row) => structuredClone(Object.fromEntries(['hp', 'maxHp', 'zoneId', 'simCredits', 'inventory',
  'activeEffects', 'skillState', 'cooldowns', 'gadgetEnergy', 'detonationSec', 'safeZoneUntil',
  '_basicAttackReadyAtSec', '_actionReadyAtSec', '_growthReadyAtSec', '_recentCombatUntil', '_tacNextAbsSec']
  .map((key) => [key, row[key]])));
const noAction = () => { throw new Error('A field action must not run inside the arena'); };
const fieldState = (rows, overrides = {}) => ({ phaseSurvivors: rows, currentActionSec: () => 110,
  actionIntervalSec: 8, statusElapsedSec: 0, nextDay: 2, nextPhase: 'night', phaseIdxNow: 3,
  publicItems: [], craftables: [], ruleset, nextSpawn: { dimensionRifts: [] },
  zoneGraph: { z: ['away'], away: ['z'] }, forbiddenIds: new Set(), ...overrides });
const hazards = (rows, overrides = {}) => runDetonationTickPhase({ state: {
  updatedSurvivors: rows, phaseStartSec: 100, phaseDurationSec: 1, useDetonation: true,
  forbiddenIds: new Set(['z']), zoneGraph: { z: ['away'], away: ['z'] },
  mapObj: { zones: [{ zoneId: 'z' }, { zoneId: 'away' }] }, ruleset: {
    detonation: { decreasePerSecForbidden: 1, regenPerSecOutsideForbidden: 1, maxSec: 30 },
  }, ...overrides,
} });
const mapOf = (rows) => new Map(rows.map((row) => [row._id, row]));
const fleeRuntime = (rows, overrides = {}, actions = {}) => createPhaseCombatFleeRuntime({
  state: { survivorMap: mapOf(rows), currentActionSec: () => 110, zoneGraph: {}, ...overrides },
  tactical: { canUseTac: noAction, applyTacUse: noAction }, actions,
});

check('a valid admission is required in addition to a space label', () => {
  const row = actor('a');
  assert.equal(getActorDimensionRiftId(row), '');
  row._combatSpaceId = 'dimension_rift:r';
  assert.equal(getActorDimensionRiftId(row), '');
  row._dimensionRiftEntry = { riftId: 'other', enteredAtSec: 100 };
  assert.equal(getActorDimensionRiftId(row), '');
  row._dimensionRiftEntry.riftId = 'r';
  assert.equal(getActorDimensionRiftId(row), 'r');
  row._dimensionRiftEntry.enteredAtSec = null;
  assert.equal(getActorDimensionRiftId(row), '');
});
check('damaged entry times are classified without inventing a replacement timestamp', () => {
  const subject = { ...makeRift(), openedAtSec: 100, entryClosesAtSec: 145, closesAtSec: 160 };
  const row = actor('a'); enterDimensionRiftSpace(row, subject, 110);
  assert.equal(getDimensionRiftEntryIssue(row, subject, 110), '');
  for (const [value, now, expected] of [[null, 110, 'invalid_entry_time'], [-1, 110, 'negative_entry_time'],
    [99, 110, 'before_open'], [111, 110, 'future_entry_time'], [145, 150, 'after_entry_close']]) {
    row._dimensionRiftEntry.enteredAtSec = value;
    assert.equal(getDimensionRiftEntryIssue(row, subject, now), expected);
  }
});
check('orphan cleanup releases a matching arena label even when its entry record is missing', () => {
  const subject = { ...makeRift(), openedAtSec: 100, entryClosesAtSec: 145, closesAtSec: 160,
    entrants: [{ teamId: 'a', memberIds: ['a'], memberDepartures: {} }] };
  const row = actor('a'); enterDimensionRiftSpace(row, subject, 110); row._dimensionRiftEntry = null;
  const before = resources(row); const changes = releaseOrphanedDimensionRiftSpaces([row], [subject], 111);
  assert.equal(changes.length, 1); assert.equal(changes[0].reason, 'membership_invalid');
  assert.equal(changes[0].entryIssue, 'missing_or_mismatched_entry'); assert.equal(getCombatSpaceId(row), 'world');
  assert.deepEqual(resources(row), before); assert.equal(row._lastDimensionRiftDefeatReturn, undefined);
});
check('a corrupt admitted member is excluded instead of fighting or winning from a fabricated time', () => {
  for (const corrupt of [null, -1, 99, 999]) {
    const subject = makeRift(); const rows = [actor('a'), actor('b')]; step(subject, rows);
    rows[0]._dimensionRiftEntry.enteredAtSec = corrupt;
    const out = step(subject, rows, 110);
    assert.equal(getCombatSpaceId(rows[0]), 'world'); assert.equal(rows[0]._lastDimensionRiftExit.reason, 'membership_invalid');
    assert.equal(subject.entrants.find((entry) => entry.teamId === 'a').outcome, 'invalid');
    assert.equal(out.departed[0].reason, 'invalid'); assert.deepEqual(out.activeTeams.map((team) => team.teamId), ['b']);
    const finish = step(subject, rows, 145); assert.equal(finish.resolution.winnerTeamId, 'b');
    assert.deepEqual(finish.resolution.winnerMemberIds, ['b']);
  }
});
check('a corrupt arena clock closes without a winner and releases every participant', () => {
  for (const corrupt of [(subject) => { subject.openedAtSec = '100'; },
    (subject) => { subject.entryClosesAtSec = 90; }, (subject) => { subject.closesAtSec = 80; }]) {
    const subject = makeRift(); const rows = [actor('a'), actor('b')]; step(subject, rows); corrupt(subject);
    const out = step(subject, rows, 110); assert.equal(out.resolution.reason, 'invalid_timing');
    assert.equal(out.resolution.winnerTeamId, ''); assert.ok(rows.every((row) => getCombatSpaceId(row) === 'world'));
    assert.ok(rows.every((row) => row._lastDimensionRiftExit.reason === 'invalid_timing'));
  }
  assert.match(describeObserverEvent({ kind: 'dimension_rift_space', who: 'a', direction: 'leave',
    reason: 'invalid_timing', zoneId: 'z' }), /손상된 전장 시계.*승자 없이 종료/);
});
check('observer wording identifies quarantine rather than a voluntary withdrawal', () => {
  assert.match(describeObserverEvent({ kind: 'dimension_rift_space', who: 'a', direction: 'leave',
    reason: 'membership_invalid', entryIssue: 'future_entry_time', zoneId: 'z' }), /손상된 참가 기록 격리.*보상 제외/);
});
check('scheduled arena actors retain field resources and growth clocks', () => {
  const a = actor('a', 'team', { _growthReadyAtSec: 105, _actionReadyAtSec: 105 });
  const b = actor('b', 'team'); [a, b].forEach(enter);
  const before = [a, b].map(resources);
  const out = runPhaseActorActionPipeline({ state: fieldState([a, b]),
    actions: { reserveActionSecond: noAction, emitRunEvent: noAction, grantMastery: noAction } });
  assert.deepEqual(out.updatedSurvivors.map(resources), before);
  assert.ok(out.updatedSurvivors.every((row) => row.aiCurrentAction === 'dimension_rift_wait'));
  assert.deepEqual(out.newlyDead, []);
});
check('low HP and a forbidden entrance cannot reopen field farming', () => {
  const row = actor('a', 'a', { hp: 3 }); enter(row); const before = resources(row);
  const out = runPhaseActorActionPipeline({ state: fieldState([row], { forbiddenIds: new Set(['z']) }),
    actions: { reserveActionSecond: noAction, emitRunEvent: noAction, grantMastery: noAction } });
  assert.deepEqual(resources(out.updatedSurvivors[0]), before);
  assert.equal(getActorDimensionRiftId(out.updatedSurvivors[0]), 'r');
});
check('the standalone post-action boundary cannot grant field energy or apply forbidden-zone damage inside', () => {
  const row = actor('a', 'a', { hp: 3, _postActionPhaseIdx: -1 }); enter(row); const before = structuredClone(row);
  const out = runActorPostActionPhase({ state: { actor: row, damagePerTick: 99, forbiddenIds: new Set(['z']),
    nextDay: 2, nextPhase: 'night', phaseIdxNow: 3, ruleset, useDetonation: true },
  actions: { runDay1HeroGear: noAction, setDeathMetadata: noAction, emitDeathRunEventOnce: noAction } });
  assert.equal(out.reason, 'combat_space'); assert.equal(out.died, false); assert.deepEqual(row, before);
});
check('the standalone hunt boundary cannot consume wildlife or settle rewards inside', () => {
  const row = actor('a'); enter(row); const before = structuredClone(row);
  const untouchable = new Proxy({}, { get: noAction });
  const out = runHuntAction({ state: { actor: row, nextSpawn: untouchable, mapObj: untouchable,
    publicItems: [], ruleset, phaseIdxNow: 3 }, actions: { addLog: noAction, emitRunEvent: noAction,
    grantMasteries: noAction, setDeathMetadata: noAction } });
  assert.equal(out.reason, 'combat_space'); assert.equal(out.hunt, null); assert.deepEqual(row, before);
});
check('the standalone action entry still ticks carried DOT before holding field actions', () => {
  const row = actor('a', 'a', { activeEffects: [{ name: '중독', remainingDuration: 5, durationUnit: 'sec', dotDamage: 3 }] });
  enter(row);
  const out = runSingleActorPhaseAction({ sourceActor: row,
    state: { ...fieldState([row]), statusElapsedSec: 1, pendingPickAssigned: true },
    actions: { reserveActionSecond: noAction, grantMastery: noAction, emitQueueRunEvent: noAction } });
  assert.ok(out.actor.hp < 70); assert.equal(out.actor.activeEffects[0].remainingDuration, 4);
  assert.equal(out.actor.aiCurrentAction, 'dimension_rift_wait'); assert.equal(out.pendingPickAssigned, true);
  assert.deepEqual(out.newlyDead, []);
});
check('direct movement decisions cannot plan a field route or hyperloop inside', () => {
  const row = actor('a', 'a', { hp: 2 }); enter(row); const before = structuredClone(row);
  const out = runActorMovementDecisionPhase({ state: { actor: row, forbiddenIds: new Set(['z']),
    zoneGraph: { z: ['away'] } }, actions: { reserveActionSecond: noAction, grantMastery: noAction, emitRunEvent: noAction } });
  assert.equal(out.didMove, false); assert.equal(out.nextZoneId, 'z'); assert.equal(out.mustEscape, false);
  assert.deepEqual(row, before);
});
check('the legacy knockback handler cannot push an arena actor into a field neighbor', () => {
  const row = actor('a', 'a', { activeEffects: [{ name: '넉백', remainingDuration: 3, durationUnit: 'sec', knockbackDistance: 2 }] });
  enter(row); const before = structuredClone(row);
  const out = applyActorKnockbackMovement({ state: { actor: row, zoneGraph: { z: ['away'] } },
    actions: { emitRunEvent: noAction } });
  assert.equal(out.currentZone, 'z'); assert.deepEqual(out.neighbors, []); assert.deepEqual(row, before);
});
check('internal spatial movement keeps running on the ordinary clock', () => {
  const row = actor('a'); enter(row);
  row._spatialMotion = { zoneId: 'z', combatSpaceId: getCombatSpaceId(row), x: 10, y: 4,
    targetId: '', stopRange: 0, reason: 'patrol' };
  const before = resources(row); advanceSpatialMovement([row], 100, 1);
  assert.ok(row._spatial.x > 4 && row._spatial.x <= 10);
  assert.equal(getActorDimensionRiftId(row), 'r'); assert.deepEqual(resources(row), before);
});
check('arena membership freezes a zero collar and does not activate field gadgets', () => {
  const row = actor('a', 'a', { detonationSec: 0 }); enter(row);
  const out = hazards([row]); const saved = out.updatedSurvivors[0];
  assert.equal(out.newlyDead.length, 0); assert.equal(saved.hp, 70); assert.equal(saved.zoneId, 'z');
  assert.equal(saved.detonationSec, 0); assert.equal(saved.gadgetEnergy, 100);
  assert.deepEqual(saved.cooldowns, { portableSafeZone: 4, cnotGate: 4, weaponSkill: 4 });
});
check('safe field regeneration is not earned inside but continues outside', () => {
  const inside = actor('inside'); enter(inside); const outside = actor('outside');
  const out = hazards([inside, outside], { forbiddenIds: new Set() });
  const rows = mapOf(out.updatedSurvivors);
  assert.equal(rows.get('inside').detonationSec, 7); assert.equal(rows.get('outside').detonationSec, 8);
});
check('final-zone damage is limited to the field and still kills an unprotected field actor', () => {
  const inside = actor('inside', 'inside', { hp: 3 }); enter(inside);
  const outside = actor('outside', 'outside', { hp: 3 });
  const out = hazards([inside, outside], { useDetonation: false, suddenDeathActive: true });
  assert.deepEqual(out.newlyDead.map((row) => row._id), ['outside']);
  assert.equal(out.updatedSurvivors[0].hp, 3); assert.equal(out.updatedSurvivors[0].cooldowns.weaponSkill, 4);
});
check('a bare or mismatched arena label does not grant hazard immunity', () => {
  const row = actor('bad', 'bad', { hp: 3, _combatSpaceId: 'dimension_rift:r',
    _dimensionRiftEntry: { riftId: 'other', enteredAtSec: 100 } });
  const out = hazards([row], { useDetonation: false, suddenDeathActive: true });
  assert.deepEqual(out.newlyDead.map((victim) => victim._id), ['bad']);
});
check('closing the entrance releases participants before the next field-hazard interval', () => {
  const rift = makeRift(); const rows = [actor('a'), actor('b')]; step(rift, rows);
  const out = step(rift, rows, 101, { forbiddenIds: new Set(['z']) });
  assert.equal(out.resolution.reason, 'zone_closed'); assert.equal(out.resolution.winnerTeamId, '');
  assert.ok(rows.every((row) => getCombatSpaceId(row) === 'world'));
  const after = hazards(rows, { useDetonation: false, suddenDeathActive: true, phaseStartSec: 101 });
  assert.deepEqual(after.updatedSurvivors.map((row) => row.hp), [65, 65]);
});
check('voluntary withdrawal preserves resources, restores the entrance and commits only once', () => {
  const row = actor('a', 'a', { hp: 9, skillState: { q: { cooldownUntil: 150 } },
    _actionReadyAtSec: 112, _basicAttackReadyAtSec: 113, _growthReadyAtSec: 120 });
  enter(row); const before = resources(row); row._spatial.x = 17;
  const events = [];
  const options = { reason: 'avoid_power', opponentId: 'b', actions: { emitRunEvent: (kind, data) => events.push({ kind, ...data }) } };
  assert.ok(withdrawFromDimensionRift(row, 110, options));
  assert.equal(withdrawFromDimensionRift(row, 111, options), null);
  assert.deepEqual(resources(row), before); assert.equal(row._spatial.x, 4); assert.equal(getCombatSpaceId(row), 'world');
  assert.equal(row._lastDimensionRiftExit.cause, 'avoid_power'); assert.equal(events.length, 1);
});
check('movement-blocking control prevents voluntary withdrawal without granting protection', () => {
  for (const name of ['속박', '기절', '제압', '공포']) {
    const row = actor(name, name, { activeEffects: [{ name, remainingDuration: 5, durationUnit: 'sec' }] });
    enter(row); const before = structuredClone(row);
    assert.equal(withdrawFromDimensionRift(row, 110), null); assert.deepEqual(row, before);
  }
});
check('dead actors and invalid or reversed times cannot commit a withdrawal', () => {
  for (const now of [NaN, Infinity, 99, -1]) {
    const row = actor('a'); enter(row); const before = structuredClone(row);
    assert.equal(withdrawFromDimensionRift(row, now), null); assert.deepEqual(row, before);
  }
  const row = actor('dead'); enter(row); row.hp = 0;
  assert.equal(withdrawFromDimensionRift(row, 110), null); assert.equal(row.hp, 0);
});
check('real flee dispatch withdraws before consulting field routes or blink', () => {
  const a = actor('a'); const b = actor('b'); [a, b].forEach(enter);
  const events = []; const runtime = fleeRuntime([a, b], {}, { emitRunEvent: (kind, data) => events.push({ kind, ...data }) });
  const out = runtime.resolveFleeSequence(a, b, { moveReason: 'critical_flee' });
  assert.equal(out.escaped, true); assert.equal(out.withdrawn, true); assert.equal(out.caught, false);
  assert.equal(a.zoneId, 'z'); assert.equal(a._lastDimensionRiftExit.cause, 'critical_flee');
  assert.deepEqual(events.map((event) => event.kind), ['dimension_rift_space']);
  assert.equal(runtime.resolveFleeSequence(a, b), null);
});
check('avoidance rereads current arena membership instead of moving a stale field copy', () => {
  const a = actor('a'); const stale = structuredClone(a); const b = actor('b'); [a, b].forEach(enter);
  const survivorMap = mapOf([a, b]); const events = [];
  const out = resolvePvpAvoidanceMove({ state: { actor: stale, opponent: b, survivorMap,
    currentActionSec: () => 110, zoneGraph: { z: ['away'] }, recoverSec: 20, safeZoneSec: 20 },
  actions: { emitRunEvent: (kind, data) => events.push({ kind, ...data }) } });
  assert.equal(out.withdrawn, true); assert.equal(out.moved, false);
  assert.equal(getCombatSpaceId(survivorMap.get('a')), 'world'); assert.equal(survivorMap.get('a').zoneId, 'z');
  assert.equal(survivorMap.get('a').safeZoneUntil || 0, 0);
  assert.equal(survivorMap.get('a')._recentCombatUntil || 0, 0);
  assert.equal(events[0].reason, 'withdrawn'); assert.equal(stale._lastDimensionRiftExit, undefined);
});
check('foreign, moved or already-dead opponents cannot trigger withdrawal', () => {
  for (const mode of ['outside', 'moved', 'dead']) {
    const a = actor('a'); const b = actor('b'); enter(a);
    if (mode !== 'outside') enter(b);
    if (mode === 'moved') b.zoneId = 'away';
    if (mode === 'dead') b.hp = 0;
    const before = structuredClone(a); const survivorMap = mapOf([a, b]);
    assert.equal(fleeRuntime([a, b]).resolveFleeSequence(a, b), null);
    const out = resolvePvpAvoidanceMove({ state: { actor: a, opponent: b, survivorMap, currentActionSec: () => 110 } });
    assert.equal(out.blocked, true); assert.deepEqual(a, before);
  }
});
check('field avoidance still chooses a real neighboring safe region', () => {
  const a = actor('a'); const b = actor('b'); const survivorMap = mapOf([a, b]);
  const out = resolvePvpAvoidanceMove({ state: { actor: a, opponent: b, survivorMap, currentActionSec: () => 110,
    forbiddenIds: new Set(['z']), zoneGraph: { z: ['away'], away: ['z'] }, estimatePower: () => 10 } });
  assert.equal(out.moved, true); assert.equal(out.toZoneId, 'away');
  assert.equal(survivorMap.get('a').zoneId, 'away'); assert.equal(survivorMap.get('a')._lastDimensionRiftExit, undefined);
});
check('one withdrawing teammate does not remove other teammates or allow reentry', () => {
  const rift = makeRift(); const rows = [actor('a1', 'a'), actor('a2', 'a'), actor('b', 'b')]; step(rift, rows);
  withdrawFromDimensionRift(rows[0], 110);
  assert.equal(findActorDimensionRift({ dimensionRifts: [rift] }, rows[0]), null);
  step(rift, rows, 110);
  const a = rift.entrants.find((entry) => entry.teamId === 'a');
  assert.equal(a.memberDepartures.a1.reason, 'withdrawn'); assert.equal(a.outcome, undefined);
  assert.equal(getActorDimensionRiftId(rows[1]), 'r'); assert.equal(getActorDimensionRiftId(rows[0]), '');
  step(rift, rows, 111); assert.equal(getActorDimensionRiftId(rows[0]), '');
});
check('a whole-team withdrawal settles occupancy only after the existing admission deadline', () => {
  const rift = makeRift(); const rows = [actor('a'), actor('b')]; step(rift, rows);
  withdrawFromDimensionRift(rows[0], 110); step(rift, rows, 110);
  assert.equal(rift.resolved, false); assert.equal(rows[0].hp, 70);
  const out = step(rift, rows, 145);
  assert.equal(out.resolution.winnerTeamId, 'b'); assert.deepEqual(out.resolution.winnerMemberIds, ['b']);
  assert.equal(rift.entrants.find((entry) => entry.teamId === 'a').outcome, 'withdrawn');
  assert.deepEqual(rows.map((row) => row.simCredits), [7, 7]);
});
check('JSON retains the individual forfeiture and cannot duplicate withdrawal', () => {
  const rift = makeRift(); const rows = [actor('a'), actor('b')]; step(rift, rows);
  withdrawFromDimensionRift(rows[0], 110); step(rift, rows, 110);
  const saved = JSON.parse(JSON.stringify({ rift, rows }));
  assert.equal(withdrawFromDimensionRift(saved.rows[0], 111), null);
  step(saved.rift, saved.rows, 111);
  assert.equal(getCombatSpaceId(saved.rows[0]), 'world'); assert.equal(saved.rows[0]._lastDimensionRiftExit.atSec, 110);
  assert.equal(saved.rift.entrants.find((entry) => entry.teamId === 'a').memberDepartures.a.reason, 'withdrawn');
});
check('withdrawal cancels a pending cast through the existing reconciler without refunding it', () => {
  const a = actor('a'); const b = actor('b'); [a, b].forEach(enter);
  a._pendingCharacterCast = { def: { name: 'Q', slot: 'q', type: 'attack_skill', includesMovement: false },
    level: 1, stage: 1, decision: { supportTarget: false }, zoneId: 'z', combatSpaceId: getCombatSpaceId(a),
    targetId: 'b', castId: 'a:1', startedAtSec: 100, releaseAtSec: 112, recoveryUntilSec: 112, previousActionReadyAtSec: 0 };
  a.skillState = { q: { cooldownUntil: 150, stage: 'casting' } }; a._actionReadyAtSec = 112;
  const events = []; assert.ok(withdrawFromDimensionRift(a, 110));
  reconcileCharacterCasts([a, b], 110, { characterSkillsEnabled: true }, { emitRunEvent: (kind, data) => events.push({ kind, ...data }) });
  assert.equal(a._pendingCharacterCast, null); assert.equal(a.skillState.q.cooldownUntil, 150);
  assert.ok(events.some((event) => event.kind === 'skill_cancel' && event.reason === 'combat_space'));
});
check('observer history explains a forfeiture instead of showing a false region move', () => {
  const a = actor('a'); const b = actor('b'); [a, b].forEach(enter); const events = [];
  withdrawFromDimensionRift(a, 110, { opponentId: 'b', actions: { atNow: () => ({ sec: 110 }),
    emitRunEvent: (kind, data, at) => events.push({ kind, ...data, at }) } });
  const text = describeObserverEvent(events[0]);
  assert.match(text, /참가 포기.*입구 복귀/);
  const model = buildTeamObserverModel({ survivors: [a, b], events, teamId: 'a', matchSec: 110 });
  assert.match(model.members[0].decision.text, /참가 포기/); assert.match(model.turningPoints[0].text, /입구 복귀/);
});
check('the post-combat neighbor picker holds admitted actors but still routes field actors', () => {
  const inside = actor('inside'); enter(inside); const outside = actor('outside');
  const runtime = fleeRuntime([inside, outside], { zoneGraph: { z: ['away'], away: ['z'] } });
  assert.equal(runtime.pickSparseSafeNeighbor('z', inside), 'z');
  assert.equal(runtime.pickSparseSafeNeighbor('z', outside), 'away');
});
check('the real encounter escape path makes no damage, kill, loot or world-move award', () => {
  const a = actor('a', 'a', { hp: 10 }); const b = actor('b'); [a, b].forEach(enter);
  const survivorMap = mapOf([a, b]); const roundKills = {}; const newDeadIds = []; const events = [];
  const out = runPhaseCombatEncounter({ state: { actor: a, target: b, survivorMap, roundKills, newDeadIds,
    currentActionSec: () => 110, actionType: 'basic', isSoloMatch: true, ruleset: { ai: { escapeHpBelow: 42 } } },
    actions: { grantPvpKillMastery: noAction, grantPvpDamageMastery: noAction, addEarnedCredits: noAction,
      emitRunEvent: (kind, data) => events.push({ kind, ...data }) } });
  assert.equal(out.skipRemainingTurn, true); assert.equal(getCombatSpaceId(survivorMap.get('a')), 'world');
  assert.equal(survivorMap.get('a').hp, 10); assert.equal(survivorMap.get('b').hp, 70);
  assert.deepEqual(roundKills, {}); assert.deepEqual(newDeadIds, []);
  assert.deepEqual(events.map((event) => event.kind), ['dimension_rift_space']);
});

console.log(`rift field boundary checks passed: ${checks}`);
