import assert from 'node:assert/strict';
import './lib/register-simulation-modules.mjs';

const { getCombatSpaceId, shareCombatSpace } = await import('../src/utils/combatSpaceLogic.js');
const { enterDimensionRiftSpace, leaveDimensionRiftSpace, releaseOrphanedDimensionRiftSpaces } = await import('../src/app/simulation/_lib/dimensionRiftSpaceRuntime.js');
const { advanceDimensionRiftContest } = await import('../src/app/simulation/_lib/dimensionRiftContestRuntime.js');
const { getSpatialPosition, spatialDistance, canObserveActor, getForcedControlMotion, getSpatialLastSeen } = await import('../src/app/simulation/_lib/combatSpatialRuntime.js');
const { engageCombatParticipants, getCombatIntentOpponents, findNextCombatAction } = await import('../src/app/simulation/_lib/combatTimingRuntime.js');
const { applyCombatHit } = await import('../src/app/simulation/_lib/combatImpactRuntime.js');
const { runPhaseCombatEncounter } = await import('../src/app/simulation/_lib/phaseCombatEncounterRuntime.js');
const { createPhaseCombatSkillSplashRuntime } = await import('../src/app/simulation/_lib/phaseCombatSkillSplashRuntime.js');
const { applyCharacterSkillStatusEffects } = await import('../src/app/simulation/_lib/characterStatusSkillRuntime.js');
const { applyPreparedCharacterSkill } = await import('../src/app/simulation/_lib/characterSkillRuntime.js');
const { getCharacterCastInvalidReason, reconcileCharacterCasts } = await import('../src/app/simulation/_lib/characterCastRuntime.js');
const { assessTeamCombat, buildTeamMovementPlans } = await import('../src/app/simulation/_lib/teamTacticsRuntime.js');
const { runTeamCombatRound, commitRetreatCover } = await import('../src/app/simulation/_lib/teamCombatRuntime.js');
const { normalizeRuntimeSurvivor } = await import('../src/app/simulation/_lib/survivorRuntime.js');
const { normalizeRevivedSurvivor } = await import('../src/app/simulation/_lib/survivorLifecycleRuntime.js');
const { getCombatSpacePresentation } = await import('../src/app/simulation/_lib/combatSpacePresentation.js');
const { getDamageBlockReason, addOrRefreshEffect, updateEffects } = await import('../src/utils/statusLogic.js');
const { getRuleset } = await import('../src/utils/rulesets.js');
const { runPvpActionLoop } = await import('../src/app/simulation/_lib/phasePvpActionLoopRuntime.js');
const { withSimulationRandom } = await import('../src/utils/simulationRandom.js');

let checks = 0;
async function check(name, run) { await run(); checks++; console.log(`PASS ${name}`); }
const actor = (id, teamId = id, extra = {}) => ({ _id: id, name: id, teamId, teamName: teamId,
  zoneId: 'z', hp: 100, maxHp: 100, simCredits: 7, inventory: [], activeEffects: [],
  _spatial: { zoneId: 'z', x: 4, y: 4 },
  stats: { maxHp: 100, attackPower: 20, defense: 0, attackSpeed: 1, sightRange: 5, attackRange: 5 },
  tacticalSkill: 'none', _tacNextAbsSec: 99999,
  _objectiveContestType: 'dimension_rift', _objectiveContestUntilPhaseIdx: 3, ...extra });
const rift = (id = 'r') => ({ id, zoneId: 'z', day: 2, phase: 'night', maxTeams: 2,
  resolved: false, entrants: [], entrantTeamIds: [] });
const enter = (subject, id = 'r') => enterDimensionRiftSpace(subject, rift(id), 100);
const leave = (subject, id = 'r', nowSec = 110) => leaveDimensionRiftSpace(subject, rift(id), nowSec, 'test_exit');
const resources = (subject) => structuredClone(Object.fromEntries(['hp', 'maxHp', 'zoneId', 'simCredits', 'inventory',
  'activeEffects', 'skillState', '_basicAttackReadyAtSec', '_lastBasicAttackAtSec', '_actionReadyAtSec', '_growthReadyAtSec', '_armedCharacterSkill']
  .map((key) => [key, subject[key]])));
const step = (subject, rows, nowSec = 100) => advanceDimensionRiftContest(subject, rows, {
  nowSec, phaseStartSec: 100, phaseDurationSec: 60, day: 2, phase: 'night', phaseIdxNow: 3, rule: { entryWindowSec: 45 },
});
const settings = { characterSkillsEnabled: true };
const cast = (caster, target) => ({ def: { name: '시험 Q', slot: 'q', type: 'attack_skill', includesMovement: false },
  level: 1, stage: 1, decision: { supportTarget: false }, zoneId: 'z', combatSpaceId: getCombatSpaceId(caster),
  targetId: target._id, castId: `${caster._id}:1`, startedAtSec: 100, releaseAtSec: 102,
  recoveryUntilSec: 102, previousActionReadyAtSec: 0 });

await check('legacy actors keep ordinary world combat and unchanged team identity', () => {
  const a = actor('a', 'team'); const b = actor('b', 'team');
  assert.equal(getCombatSpaceId(a), 'world'); assert.equal(shareCombatSpace(a, b), true);
  enter(a); assert.equal(a.teamId, 'team'); assert.equal(shareCombatSpace(a, b), false);
});
await check('enter and exit do not heal, cleanse or refund action and skill clocks', () => {
  const a = actor('a', 'a', { hp: 13, inventory: [{ itemId: 'held', qty: 2 }],
    activeEffects: [{ name: '중독', remainingDuration: 6, durationUnit: 'sec', dotDamage: 2 }],
    skillState: { q: { cooldownUntil: 133 } }, _basicAttackReadyAtSec: 101.5, _lastBasicAttackAtSec: 100,
    _actionReadyAtSec: 104, _growthReadyAtSec: 120,
    _armedCharacterSkill: { expiresAtSec: 108 }, _combatIntent: { enemyTeamId: 'b' },
    _spatialLastSeen: { zoneId: 'z', x: 5, y: 5, targetId: 'b', seenAtSec: 100 } });
  const before = resources(a); enter(a);
  assert.deepEqual(resources(a), before); assert.equal(a._combatIntent, null); assert.equal(getSpatialLastSeen(a), null);
  a._spatial.x = 10; leave(a);
  assert.deepEqual(resources(a), before); assert.equal(a._spatial.x, 4); assert.equal(getCombatSpaceId(a), 'world');
});
await check('same map coordinates cannot provide direct or allied cross-space vision', () => {
  const inside = actor('inside', 'a'); const outsideAlly = actor('ally', 'a'); const outsideEnemy = actor('enemy', 'b');
  enter(inside);
  assert.equal(spatialDistance(inside, outsideEnemy), Infinity);
  assert.equal(canObserveActor(inside, outsideEnemy, [inside, outsideAlly, outsideEnemy]), false);
  assert.equal(canObserveActor(outsideEnemy, inside, [inside, outsideAlly, outsideEnemy]), false);
});
await check('allied vision within the same arena still works', () => {
  const a = actor('a', 'a', { _spatial: { zoneId: 'z', x: 0, y: 0 } });
  const ally = actor('ally', 'a', { _spatial: { zoneId: 'z', x: 20, y: 20 } });
  const enemy = actor('b', 'b', { _spatial: { zoneId: 'z', x: 21, y: 20 } });
  [a, ally, enemy].forEach((row) => enter(row));
  assert.equal(canObserveActor(a, enemy, [a]), false);
  assert.equal(canObserveActor(a, enemy, [a, ally]), true);
});
await check('two separate rifts cannot observe or attack each other', () => {
  const a = actor('a'); const b = actor('b'); enter(a, 'first'); enter(b, 'second');
  assert.equal(canObserveActor(a, b, [a, b]), false);
  assert.equal(getDamageBlockReason(a, b, { type: 'basic' }), 'combat_space');
});
await check('the impact boundary blocks HP, shields and sleep wake-up across spaces', () => {
  const a = actor('a'); const b = actor('b', 'b', { activeEffects: [
    { name: '수면', remainingDuration: 5, durationUnit: 'sec' },
    { name: '보호막', remainingDuration: 5, durationUnit: 'sec', shieldValue: 30 },
  ] });
  enter(b); const before = resources(b);
  const result = applyCombatHit(a, b, { type: 'skill', damage: 50 }, {
    shieldBlock: () => { throw new Error('A foreign hit must not consume shields'); },
  });
  assert.equal(result.hpDamage, 0); assert.equal(result.blockedReason, 'combat_space'); assert.deepEqual(resources(b), before);
});
await check('the encounter entry point rereads stale target references before any action', () => {
  const a = actor('a'); const b = actor('b'); const stale = structuredClone(b); enter(b);
  const survivorMap = new Map([[a._id, a], [b._id, b]]); const before = resources(a);
  const out = runPhaseCombatEncounter({ state: { actor: a, target: stale, survivorMap, actionType: 'basic', currentActionSec: () => 100 } });
  assert.equal(out.skipRemainingTurn, true); assert.equal(out.target, b); assert.deepEqual(resources(a), before); assert.equal(b.hp, 100);
});
await check('an ordinary real basic attack still applies inside one arena', () => {
  const a = actor('a'); const b = actor('b'); enter(a); enter(b);
  withSimulationRandom(() => 0.5, () => runPhaseCombatEncounter({ state: { actor: a, target: b,
    survivorMap: new Map([[a._id, a], [b._id, b]]), currentActionSec: () => 100, actionType: 'basic', isSoloMatch: true,
    battleSettings: { characterSkillsEnabled: false }, ruleset: { ai: { escapeHpBelow: 0 }, pvp: { criticalFleeHpBelow: 0 } },
  } }));
  assert.ok(b.hp < 100); assert.ok(a._basicAttackReadyAtSec > 100);
});
await check('character CC and allied cleansing cannot be applied across spaces', () => {
  const a = actor('a', 'a'); const enemy = actor('b', 'b'); const ally = actor('ally', 'a', {
    activeEffects: [{ name: '중독', remainingDuration: 6, durationUnit: 'sec', dotDamage: 2 }] });
  enter(enemy); enter(ally);
  const cc = { effects: [{ name: '기절', target: 'target', durationSec: 3 }], skill: 'CC' };
  const cleanse = { effects: [{ name: '해로운 효과 제거', target: 'target', durationSec: 0 }], skill: '정화' };
  assert.deepEqual(applyCharacterSkillStatusEffects(a, enemy, cc), []);
  assert.deepEqual(applyCharacterSkillStatusEffects(a, ally, cleanse), []);
  assert.equal(ally.activeEffects.length, 1); assert.equal(enemy.activeEffects.length, 0);
});
await check('the generic status application boundary also checks a known source actor', () => {
  const a = actor('a'); const b = actor('b'); enter(b);
  const result = addOrRefreshEffect(b, { name: '기절', remainingDuration: 5, durationUnit: 'sec' }, { sourceActor: a });
  assert.equal(result.applied, false); assert.equal(result.reason, 'combat_space'); assert.equal(b.activeEffects.length, 0);
});
await check('prepared healing and shielding refuse a foreign-space ally', () => {
  const a = actor('a', 'a'); const ally = actor('ally', 'a', { hp: 10 }); enter(ally);
  for (const type of ['heal_skill', 'shield_skill']) {
    const prepared = { ...cast(a, ally), def: { name: type, slot: 'q', type, heal: [50], shield: [50], range: 30 },
      decision: { supportTarget: true } };
    const result = applyPreparedCharacterSkill(a, ally, prepared, { nowSec: 102, settings, visionRoster: [a, ally] });
    assert.equal(result, null); assert.equal(ally.hp, 10); assert.equal(ally.activeEffects.length, 0);
  }
});
await check('a target entering a rift cancels a pending cast without refunding its cooldown', () => {
  const a = actor('a'); const b = actor('b'); a._pendingCharacterCast = cast(a, b);
  a.skillState = { q: { cooldownUntil: 110, stage: 'casting' } }; a._actionReadyAtSec = 102;
  enter(b); const events = [];
  assert.equal(getCharacterCastInvalidReason(a, a._pendingCharacterCast, [a, b], settings), 'combat_space');
  reconcileCharacterCasts([a, b], 101, settings, { emitRunEvent: (kind, data) => events.push({ kind, ...data }) });
  assert.equal(a._pendingCharacterCast, null); assert.equal(a.skillState.q.cooldownUntil, 110);
  assert.equal(events[0].reason, 'combat_space');
});
await check('a caster leaving the arena also invalidates its stored space', () => {
  const a = actor('a'); const b = actor('b'); enter(a); enter(b);
  a._pendingCharacterCast = cast(a, b); leave(a);
  assert.equal(getCharacterCastInvalidReason(a, a._pendingCharacterCast, [a, b], settings), 'combat_space');
  assert.equal(applyPreparedCharacterSkill(a, a, a._pendingCharacterCast, { settings, nowSec: 102 }), null);
});
await check('cached splash hits reread the current authoritative recipient', () => {
  const a = actor('a'); const b = actor('b'); const stale = structuredClone(b); enter(b);
  const runtime = createPhaseCombatSkillSplashRuntime({ state: { survivorMap: new Map([[a._id, a], [b._id, b]]) } });
  assert.equal(runtime.applyCharacterSkillSplashDamage(a, [{ target: stale, damage: 50, packet: { type: 'skill', damage: 50 } }]), 0);
  assert.equal(b.hp, 100); assert.equal(stale.hp, 100);
});
await check('an area center from a previous space cannot strike a newly entered arena', () => {
  const a = actor('a'); const b = actor('b'); const oldCenter = { ...b._spatial }; enter(a); enter(b);
  const runtime = createPhaseCombatSkillSplashRuntime({ state: { survivorMap: new Map([[a._id, a], [b._id, b]]) } });
  assert.equal(runtime.applyCharacterSkillSplashDamage(a, [{ target: b, damage: 50,
    packet: { type: 'skill', damage: 50 }, centerPosition: oldCenter, radius: 10 }]), 0);
  assert.equal(b.hp, 100);
});
await check('forced movement preserves CC but cannot use a source point from outside', () => {
  const source = actor('source'); const target = actor('target');
  const applied = addOrRefreshEffect(target, { name: '도발', remainingDuration: 5, durationUnit: 'sec' }, { sourceActor: source });
  target.activeEffects = applied.character.activeEffects; enter(target);
  const plan = getForcedControlMotion(target, [source, target]);
  assert.equal(plan.sourcePosition, null); assert.equal(plan.motion, null);
  assert.equal(target.activeEffects[0].remainingDuration, 5);
  assert.deepEqual(getCombatIntentOpponents(target, [source, target], 100), []);
});
await check('already applied damage-over-time continues without an entry cleanse', () => {
  const a = actor('a'); const b = actor('b', 'b', {
    activeEffects: [{ name: '중독', remainingDuration: 5, durationUnit: 'sec', dotDamage: 3 }] });
  enter(b); assert.equal(getDamageBlockReason(a, b, { existingEffect: true }), '');
  const result = updateEffects(b, { elapsedSec: 1 });
  assert.ok(result.hp < 100); assert.equal(getCombatSpaceId(result), 'dimension_rift:r');
});
await check('threat assessment and regrouping do not count actors in another space', () => {
  const a = actor('a', 'a'); const outsideAlly = actor('ally', 'a'); const b = actor('b', 'b');
  enter(a); enter(b);
  const assessment = assessTeamCombat(a, [a, outsideAlly, b], { estimatePower: (row) => row === outsideAlly ? 999999 : 10 });
  assert.equal(assessment.allyCount, 1); assert.equal(assessment.enemyCount, 1); assert.equal(assessment.powerRatio, 0.5);
  const plans = buildTeamMovementPlans({ roster: [a, outsideAlly], day: 2, phase: 'night', zoneGraph: { z: ['away'], away: ['z'] },
    chooseLeaderMove: () => ({ targets: ['away'] }), estimatePower: () => 1 });
  assert.equal(plans.size, 0);
});
await check('team turns and retreat cover cannot borrow an outside teammate', () => {
  const a = actor('a1', 'a'); const ally = actor('a2', 'a'); const b = actor('b', 'b'); const outsider = actor('outside', 'a');
  [a, ally, b].forEach((row) => enter(row)); const rows = [a, ally, b, outsider];
  const result = runTeamCombatRound({ actor: a, target: b, survivorMap: new Map(rows.map((row) => [row._id, row])), nowSec: 100,
    random: () => 0.5, resolveStrike: (_striker, victim) => { victim.hp -= 1; return {}; } });
  assert.ok(result.handled); assert.equal(result.participants.includes('outside'), false);
  assert.equal(commitRetreatCover(a, b, [a, b, outsider], { nowSec: 100 }).helpers.length, 0);
  assert.equal(outsider._actionReadyAtSec, undefined);
});
await check('one departing teammate exits without pulling remaining teammates out', () => {
  const subject = rift(); const rows = [actor('a1', 'a'), actor('a2', 'a'), actor('b', 'b')]; step(subject, rows);
  rows[0].zoneId = 'away'; step(subject, rows, 101);
  assert.equal(getCombatSpaceId(rows[0]), 'world'); assert.equal(getCombatSpaceId(rows[1]), 'dimension_rift:r');
  assert.equal(subject.entrants[0].memberDepartures.a1.reason, 'withdrawn');
  rows[0].zoneId = 'z'; step(subject, rows, 102);
  assert.equal(getCombatSpaceId(rows[0]), 'world'); assert.equal(subject.resolved, false);
});
await check('expiration releases every known participant without HP restoration', () => {
  const subject = rift(); const rows = [actor('a', 'a', { hp: 17 }), actor('b', 'b', { hp: 41 })]; step(subject, rows);
  const out = step(subject, rows, 160);
  assert.equal(out.resolution.winnerTeamId, ''); assert.deepEqual(rows.map((row) => row.hp), [17, 41]);
  assert.ok(rows.every((row) => getCombatSpaceId(row) === 'world'));
});
await check('orphan cleanup and explicit revival cannot strand an actor inside a removed rift', () => {
  const a = actor('a', 'a', { hp: 7, skillState: { q: { cooldownUntil: 150 } } }); enter(a);
  assert.equal(releaseOrphanedDimensionRiftSpaces([a], [], 120).length, 1);
  assert.equal(a.hp, 7); assert.equal(a.skillState.q.cooldownUntil, 150);
  const b = actor('b'); enter(b); b.hp = 0;
  const revived = normalizeRevivedSurvivor(b, 25, 'z', 3, getRuleset('ER_S11'), 130);
  assert.equal(getCombatSpaceId(revived), 'world'); assert.equal(revived._dimensionRiftEntry, null); assert.equal(revived.hp, 25);
});
await check('JSON normalization keeps spatial scope and the observer label', () => {
  const a = actor('a'); enter(a);
  const saved = normalizeRuntimeSurvivor(JSON.parse(JSON.stringify(a)));
  assert.equal(getCombatSpaceId(saved), 'dimension_rift:r'); assert.ok(getSpatialPosition(saved));
  assert.equal(getCombatSpacePresentation(saved).label, '🌀 차원의 틈 내부');
  leave(saved); assert.equal(getCombatSpacePresentation(saved), null);
});
await check('scheduled combat actions carry their originating encounter space', () => {
  const a = actor('a'); const b = actor('b'); enter(a); enter(b);
  withSimulationRandom(() => 0.5, () => engageCombatParticipants(a, b, [a, b], 100));
  const next = findNextCombatAction(new Map([[a._id, a], [b._id, b]]), 100, [], { characterSkillsEnabled: false });
  assert.equal(next.combatSpaceId, 'dimension_rift:r'); leave(a);
  assert.notEqual(next.combatSpaceId, getCombatSpaceId(a));
});
await check('the real action loop drops a hit scheduled before an arena exit', async () => {
  const a = actor('a'); const b = actor('b'); enter(a); enter(b);
  withSimulationRandom(() => 0.5, () => engageCombatParticipants(a, b, [a, b], 100));
  let offset = 0; let observations = 0; let frames = 0; const events = [];
  let combatPromise;
  withSimulationRandom(() => 0.5, () => { combatPromise = runPvpActionLoop({ state: {
    updatedSurvivors: [a, b], phaseSurvivors: [a, b], phaseDurationSec: 0.5,
    currentActionSec: () => 100 + offset, getPhaseRuntimeOffsetSec: () => offset,
    nextDay: 1, nextPhase: 'morning', battleSettings: { characterSkillsEnabled: false },
    ruleset: { ai: { escapeHpBelow: 0 }, pvp: { criticalFleeHpBelow: 0 } },
  }, actions: {
    reserveActionSecond: (duration) => { offset = Math.min(0.5, offset + duration); },
    advanceWorld: ({ survivorMap }) => {
      observations++;
      if (observations === 3) for (const row of survivorMap.values()) leave(row, 'r', 100 + offset);
    },
    emitRunEvent: (kind, data) => events.push({ kind, ...data }),
    publishActionFrame: async () => { frames++; assert.ok(frames < 50); },
  } }); });
  const result = await combatPromise;
  assert.equal(events.filter((event) => event.kind === 'damage').length, 0);
  assert.deepEqual([...result.survivorMap.values()].map((row) => row.hp), [100, 100]);
});

console.log(`combat space checks passed: ${checks}`);
