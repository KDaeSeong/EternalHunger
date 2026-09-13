import assert from 'node:assert/strict';
import './lib/register-simulation-modules.mjs';

// Written during the user-requested verification pause; not executed.
const { commitRuntimeHpDamage, isDimensionRiftDefeated } = await import('../src/utils/dimensionRiftDefeatLogic.js');
const { getCombatSpaceId } = await import('../src/utils/combatSpaceLogic.js');
const { applyCombatHit } = await import('../src/app/simulation/_lib/combatImpactRuntime.js');
const { applyCombatDamageLifesteal } = await import('../src/app/simulation/_lib/combatDamageRuntime.js');
const { applyLevelGrowth } = await import('../src/app/simulation/_lib/masteryProgressRuntime.js');
const { enterDimensionRiftSpace, leaveDimensionRiftSpace, releaseOrphanedDimensionRiftSpaces } = await import('../src/app/simulation/_lib/dimensionRiftSpaceRuntime.js');
const { advanceDimensionRiftContest } = await import('../src/app/simulation/_lib/dimensionRiftContestRuntime.js');
const { tryClaimDimensionRiftReward } = await import('../src/app/simulation/_lib/dimensionRiftRewardRuntime.js');
const { applyActorPhaseStatusTick } = await import('../src/app/simulation/_lib/phaseActorStatusRuntime.js');
const { createPhaseCombatEliminationRuntime } = await import('../src/app/simulation/_lib/phaseCombatEliminationRuntime.js');
const { createPhaseCombatSkillSplashRuntime } = await import('../src/app/simulation/_lib/phaseCombatSkillSplashRuntime.js');
const { createPhaseConsumableRuntime, forceUseConsumableAtIndex } = await import('../src/app/simulation/_lib/consumableRuntime.js');
const { canMoveByStatus, canUseSkillByStatus, canBasicAttackByStatus, canActVoluntarilyByStatus,
  getDamageBlockReason, isTargetableByStatus, applyHealingModifier, updateEffects, addOrRefreshEffect, purgeNegativeEffects } = await import('../src/utils/statusLogic.js');
const { applyPreparedCharacterSkill } = await import('../src/app/simulation/_lib/characterSkillRuntime.js');
const { applyCharacterSkillStatusEffects } = await import('../src/app/simulation/_lib/characterStatusSkillRuntime.js');
const { findNextCombatAction, getCombatIntentOpponents, engageCombatParticipants } = await import('../src/app/simulation/_lib/combatTimingRuntime.js');
const { assessTeamCombat } = await import('../src/app/simulation/_lib/teamTacticsRuntime.js');
const { getCombatSpacePresentation } = await import('../src/app/simulation/_lib/combatSpacePresentation.js');
const { describeObserverEvent } = await import('../src/app/simulation/_lib/teamObserverRuntime.js');
const { getRuleset } = await import('../src/utils/rulesets.js');
const { withSimulationRandom } = await import('../src/utils/simulationRandom.js');

let checks = 0;
function check(name, run) { run(); checks++; console.log(`PASS ${name}`); }
const rift = () => ({ id: 'r', zoneId: 'z', day: 2, phase: 'night', maxTeams: 2, entrants: [], resolved: false });
const actor = (id, teamId = id, extra = {}) => ({ _id: id, name: id, teamId, teamName: teamId,
  zoneId: 'z', hp: 50, maxHp: 100, simCredits: 7,
  inventory: [{ itemId: 'held', type: 'material', qty: 2 }], activeEffects: [],
  stats: { maxHp: 100, attackPower: 20, defense: 0, attackSpeed: 1, attackRange: 5, sightRange: 10 },
  _spatial: { zoneId: 'z', x: 4, y: 4 }, skillState: { q: { cooldownUntil: 150 } },
  _objectiveContestType: 'dimension_rift', _objectiveContestUntilPhaseIdx: 3, ...extra });
const enter = (row) => enterDimensionRiftSpace(row, rift(), 100);
const defeat = (row, atSec = 110) => commitRuntimeHpDamage(row, 1000, { atSec, by: 'attacker' });
const step = (subject, rows, nowSec = 100, extra = {}) => advanceDimensionRiftContest(subject, rows, {
  nowSec, phaseStartSec: 100, phaseDurationSec: 60, day: 2, phase: 'night', phaseIdxNow: 3,
  rule: { entryWindowSec: 45 }, ...extra,
});
const noAward = () => { throw new Error('Arena defeat must not award a match kill, loot, or resurrection'); };
const resources = (row) => structuredClone(Object.fromEntries(['inventory', 'simCredits', 'skillState',
  '_actionReadyAtSec', '_growthReadyAtSec', '_basicAttackReadyAtSec', 'cooldowns'].map((key) => [key, row[key]])));

check('ordinary field lethal damage remains an ordinary zero-HP result', () => {
  const row = actor('field'); const out = commitRuntimeHpDamage(row, 1000);
  assert.equal(row.hp, 0); assert.equal(out.hpDamage, 50); assert.equal(out.defeat, null);
});
check('a real lethal hit inside commits one defeat and only actual HP loss', () => {
  const a = actor('a'); const b = actor('b', 'b', { hp: 10 }); [a, b].forEach(enter); const events = [];
  const hit = applyCombatHit(a, b, { type: 'basic', damage: 200, critical: true },
    { at: { sec: 110 }, emitRunEvent: (kind, data) => events.push({ kind, ...data }) });
  assert.equal(hit.hpDamage, 9); assert.equal(b.hp, 1); assert.equal(isDimensionRiftDefeated(b), true);
  assert.equal(events[0].kind, 'dimension_rift_defeat'); assert.equal(events[0].by, 'a');
  assert.equal(b.deadAtPhaseIdx, undefined); assert.equal(b._deathBy, undefined);
});
check('shield absorption happens before a lethal packet can defeat the participant', () => {
  const a = actor('a'); const b = actor('b'); [a, b].forEach(enter);
  const hit = applyCombatHit(a, b, { type: 'skill', damage: 200 }, { shieldBlock: () => 0, at: { sec: 110 } });
  assert.equal(hit.hpDamage, 0); assert.equal(b.hp, 50); assert.equal(isDimensionRiftDefeated(b), false);
});
check('fractional HP and one HP are never increased by defeat protection', () => {
  for (const hp of [0.25, 1]) {
    const row = actor('a', 'a', { hp }); enter(row); const hit = defeat(row);
    assert.equal(row.hp, hp); assert.equal(hit.hpDamage, 0); assert.ok(hit.defeat);
  }
});
check('dead and committed-death snapshots are never restored by the damage boundary', () => {
  const row = actor('a'); enter(row); row.hp = 0;
  assert.equal(defeat(row).defeat, null); assert.equal(row.hp, 0);
  const committed = actor('b', 'b', { deadAtPhaseIdx: 3 }); enter(committed);
  assert.equal(defeat(committed).defeat, null); assert.equal(committed.hp, 0);
  const live = actor('live', 'live', { deadAtPhaseIdx: -1 }); enter(live);
  assert.ok(defeat(live).defeat); assert.equal(live.hp, 1);
});
check('a bare or mismatched space label does not create nonlethal protection', () => {
  for (const entry of [undefined, { riftId: 'other', enteredAtSec: 100 }]) {
    const row = actor('a', 'a', { _combatSpaceId: 'dimension_rift:r', _dimensionRiftEntry: entry });
    assert.equal(defeat(row).defeat, null); assert.equal(row.hp, 0);
  }
});
check('repeated packets cannot consume shields, emit another defeat or alter its cause', () => {
  const a = actor('a'); const b = actor('b'); [a, b].forEach(enter); defeat(b);
  const before = structuredClone(b); const events = [];
  const hit = applyCombatHit(a, b, { type: 'skill', damage: 1000 },
    { shieldBlock: noAward, emitRunEvent: (...args) => events.push(args), at: { sec: 111 } });
  assert.equal(hit.blockedReason, 'rift_defeated'); assert.equal(hit.hpDamage, 0);
  assert.deepEqual(b, before); assert.deepEqual(events, []);
});
check('defeated actors cannot move, act, cast, attack, receive healing or be targeted', () => {
  const row = actor('a'); enter(row); defeat(row);
  assert.equal(canActVoluntarilyByStatus(row), false); assert.equal(canMoveByStatus(row), false);
  assert.equal(canMoveByStatus(row, { forced: true }), false); assert.equal(canBasicAttackByStatus(row), false);
  assert.equal(canUseSkillByStatus(row), false); assert.equal(isTargetableByStatus(row), false);
  assert.equal(applyHealingModifier(row, 100), 0);
  assert.equal(getDamageBlockReason(null, row, { existingEffect: true }), 'rift_defeated');
});
check('cleansing statuses cannot remove a defeat or resume the actor', () => {
  const row = actor('a', 'a', { activeEffects: [{ name: '중독', dotDamage: 3, remainingDuration: 5, durationUnit: 'sec' }] });
  enter(row); defeat(row); const out = purgeNegativeEffects(row, { removeAllNegative: true });
  assert.ok(isDimensionRiftDefeated(out.character)); assert.equal(canMoveByStatus(out.character), false);
  assert.equal(addOrRefreshEffect(row, { name: '재생', recovery: 100, remainingDuration: 5, durationUnit: 'sec' }).applied, false);
});
check('defeated sources cannot apply stored skills or generic status payloads', () => {
  const a = actor('a'); const b = actor('b'); [a, b].forEach(enter); defeat(a); const before = structuredClone(b);
  const effect = { name: '기절', target: 'target', durationSec: 3, remainingDuration: 3, durationUnit: 'sec' };
  assert.equal(addOrRefreshEffect(b, effect, { sourceActor: a }).reason, 'rift_defeated');
  assert.deepEqual(applyCharacterSkillStatusEffects(a, b, { effects: [effect] }), []);
  assert.equal(applyPreparedCharacterSkill(a, b, { def: { type: 'attack_skill' } }), null);
  assert.deepEqual(b, before);
});
check('automatic and direct consumables leave defeated actors and use counters unchanged', () => {
  const row = actor('a'); enter(row); defeat(row); const before = structuredClone(row);
  const runtime = createPhaseConsumableRuntime({ survivorMap: new Map([['a', row]]), consCfg: { enabled: true } });
  assert.equal(runtime.tryUseConsumable(row, 'turn_start'), false);
  assert.deepEqual(forceUseConsumableAtIndex(row, 0), { used: false, reason: 'rift_defeated' });
  assert.deepEqual(row, before);
});
check('lifesteal receives actual removed HP rather than the overkill packet', () => {
  const a = actor('a', 'a', { hp: 10, activeEffects: [{ name: '흡혈', lifestealPct: 1, remainingDuration: 5, durationUnit: 'sec' }] });
  const b = actor('b', 'b', { hp: 10 }); [a, b].forEach(enter);
  const hit = applyCombatHit(a, b, { type: 'basic', damage: 500 }, { at: { sec: 110 } });
  const healed = applyCombatDamageLifesteal(a, hit.hpDamage);
  assert.equal(hit.hpDamage, 9); assert.equal(healed, 9); assert.equal(a.hp, 19);
});
check('post-hit mastery can grow maximum HP but cannot heal an arena-defeated participant', () => {
  const row = actor('a', 'a', { hp: 10, maxHp: 100,
    stats: { maxHp: 100, hpGrowth: 10, attackPower: 20, defense: 0, attackSpeed: 1, attackRange: 5, sightRange: 10 } });
  enter(row); defeat(row); const maxBefore = row.maxHp;
  applyLevelGrowth(row, { characterLeveledUp: true, beforeCharacterLevel: 1, afterCharacterLevel: 2 });
  assert.equal(row.hp, 1); assert.ok(row.maxHp > maxBefore); assert.equal(isDimensionRiftDefeated(row), true);
});
check('the real status phase records DOT defeat instead of committing a match death', () => {
  const row = actor('a', 'a', { hp: 4, activeEffects: [{ name: '중독', dotDamage: 10, remainingDuration: 5,
    durationUnit: 'sec', sourceActorId: 'poisoner' }] }); enter(row); const events = [];
  const out = applyActorPhaseStatusTick({ state: { actor: row, elapsedSec: 1, startSec: 110 },
    actions: { setDeathMetadata: noAward, emitDeathRunEventOnce: noAward,
      emitRunEvent: (kind, data) => events.push({ kind, ...data }) } });
  assert.equal(out.died, false); assert.equal(out.actor.hp, 1); assert.equal(events[0].by, 'poisoner');
  assert.equal(out.actor._dimensionRiftDefeat.atSec, 110.4);
});
check('splitting a constant-rate DOT interval preserves defeat time and remaining status time', () => {
  const row = actor('a', 'a', { hp: 4, activeEffects: [{ name: '중독', dotDamage: 10, remainingDuration: 5, durationUnit: 'sec' }] }); enter(row);
  const batched = updateEffects(structuredClone(row), { elapsedSec: 2, startSec: 110 });
  let split = structuredClone(row);
  for (let index = 0; index < 4; index++) split = updateEffects(split, { elapsedSec: 0.5, startSec: 110 + index * 0.5 });
  assert.equal(batched.hp, 1); assert.equal(split.hp, 1);
  assert.equal(batched._dimensionRiftDefeat.atSec, split._dimensionRiftDefeat.atSec);
  assert.deepEqual(batched.activeEffects, split.activeEffects);
});
check('carried healing cannot cancel an already recorded defeat in a later status segment', () => {
  const row = actor('a', 'a', { activeEffects: [{ name: '재생', recovery: 100, remainingDuration: 5, durationUnit: 'sec' }] });
  enter(row); defeat(row); const out = updateEffects(row, { elapsedSec: 2, startSec: 110 });
  assert.equal(out.hp, 1); assert.ok(isDimensionRiftDefeated(out)); assert.equal(out.activeEffects[0].remainingDuration, 3);
});
check('the elimination entry point diverts living arena victims before kill and loot callbacks', () => {
  const a = actor('a'); const b = actor('b'); [a, b].forEach(enter);
  const newDeadIds = []; const roundKills = {}; const before = resources(b);
  const runtime = createPhaseCombatEliminationRuntime({ state: { newDeadIds, roundKills, currentActionSec: () => 110 },
    actions: { grantPvpKillMastery: noAward, setDeathMetadata: noAward, emitDeathRunEventOnce: noAward, addEarnedCredits: noAward } });
  assert.equal(runtime.applyCombatElimination(a, b).riftDefeat, true);
  assert.equal(runtime.applyCombatElimination(a, b).riftDefeat, true);
  assert.deepEqual(newDeadIds, []); assert.deepEqual(roundKills, {}); assert.deepEqual(resources(b), before); assert.equal(b.hp, 1);
});
check('extraction preserves resources and timed effects while adding one explicit return protection', () => {
  const row = actor('a', 'a', { _actionReadyAtSec: 115, _growthReadyAtSec: 120, _basicAttackReadyAtSec: 116,
    activeEffects: [{ name: '중독', dotDamage: 3, remainingDuration: 5, durationUnit: 'sec' }] });
  enter(row); const before = resources(row); defeat(row); row._spatial.x = 17;
  const exit = leaveDimensionRiftSpace(row, rift(), 110, 'defeated');
  assert.equal(row.hp, 1); assert.deepEqual(resources(row), before); assert.equal(row._spatial.x, 4);
  assert.equal(getCombatSpaceId(row), 'world'); assert.equal(row._dimensionRiftDefeat, null);
  assert.equal(row.activeEffects.find((effect) => effect.name === '중독').remainingDuration, 5);
  assert.equal(row._lastDimensionRiftDefeatReturn.protectionUntilSec, 113);
  assert.equal(row._recentCombatUntil, 118); assert.equal(exit.defeat.hpDamage, 49);
});
check('repeated exits cannot refresh protection and carried DOT resumes after it expires', () => {
  const row = actor('a', 'a', { activeEffects: [{ name: '중독', dotDamage: 3, remainingDuration: 10, durationUnit: 'sec' }] });
  enter(row); defeat(row); leaveDimensionRiftSpace(row, rift(), 110, 'defeated'); const before = structuredClone(row);
  assert.equal(leaveDimensionRiftSpace(row, rift(), 111, 'defeated'), null); assert.deepEqual(row, before);
  const protectedRow = updateEffects(row, { elapsedSec: 3, startSec: 110 }); assert.equal(protectedRow.hp, 1);
  const after = updateEffects(protectedRow, { elapsedSec: 1, startSec: 113 }); assert.equal(after.hp, 0);
  assert.equal(after._dimensionRiftDefeat, null);
});
check('a partial defeat extracts only that member and leaves the team fighting', () => {
  const subject = rift(); const rows = [actor('a1', 'a'), actor('a2', 'a'), actor('b')]; step(subject, rows);
  defeat(rows[0]); step(subject, rows, 110);
  const a = subject.entrants.find((entry) => entry.teamId === 'a');
  assert.equal(a.memberDepartures.a1.reason, 'defeated'); assert.equal(a.outcome, undefined);
  assert.equal(getCombatSpaceId(rows[0]), 'world'); assert.equal(getCombatSpaceId(rows[1]), 'dimension_rift:r');
});
check('living defeated teammates retain their winning team reward without HP restoration', () => {
  const subject = rift(); const rows = [actor('a1', 'a'), actor('a2', 'a'), actor('b')]; step(subject, rows);
  defeat(rows[0]); step(subject, rows, 110); defeat(rows[2], 145); step(subject, rows, 145);
  assert.deepEqual(subject.resolution.winnerMemberIds, ['a1', 'a2']);
  const claim = withSimulationRandom(() => 0.5, () => tryClaimDimensionRiftReward(subject, rows, { nowSec: 145,
    publicItems: [{ _id: 'meteor', name: '운석', type: 'material', tier: 4 }], ruleset: getRuleset('ER_S11') }));
  assert.equal(claim.claimed, true); assert.equal(rows[0].hp, 1);
  assert.deepEqual(rows.map((row) => row.simCredits), [52, 52, 7]);
});
check('simultaneous team defeats do not fabricate a winner or globally kill either team', () => {
  const subject = rift(); const rows = [actor('a'), actor('b')]; step(subject, rows);
  rows.forEach((row) => defeat(row)); step(subject, rows, 110);
  assert.ok(subject.entrants.every((entry) => entry.outcome === 'defeated')); assert.equal(subject.resolved, false);
  const out = step(subject, rows, 160); assert.equal(out.resolution.winnerTeamId, '');
  assert.deepEqual(rows.map((row) => row.hp), [1, 1]);
});
check('a coincident zone closure still extracts a recorded defeat without turning it into a death', () => {
  const subject = rift(); const rows = [actor('a'), actor('b')]; step(subject, rows); defeat(rows[0]);
  const out = step(subject, rows, 110, { forbiddenIds: new Set(['z']) });
  assert.equal(out.resolution.winnerTeamId, ''); assert.equal(rows[0]._lastDimensionRiftExit.reason, 'defeated');
  assert.equal(rows[0]._lastDimensionRiftExit.exitCause, 'zone_closed'); assert.equal(rows[0].safeZoneUntil, 113);
  assert.equal(rows[1]._lastDimensionRiftDefeatReturn, undefined);
});
check('JSON and orphan cleanup preserve defeat provenance without duplicate protection', () => {
  const row = actor('a'); enter(row); defeat(row); const restored = JSON.parse(JSON.stringify(row));
  assert.equal(releaseOrphanedDimensionRiftSpaces([restored], [], 111).length, 1);
  const receipt = structuredClone(restored._lastDimensionRiftDefeatReturn);
  assert.equal(releaseOrphanedDimensionRiftSpaces([restored], [], 112).length, 0);
  assert.deepEqual(restored._lastDimensionRiftDefeatReturn, receipt); assert.equal(restored.hp, 1);
});
check('real splash packets defeat multiple targets without calling match elimination', () => {
  const a = actor('a'); const b = actor('b', 'b', { hp: 10 }); const c = actor('c', 'b', { hp: 0.5 });
  [a, b, c].forEach(enter); const events = []; const survivorMap = new Map([a, b, c].map((row) => [row._id, row]));
  const runtime = createPhaseCombatSkillSplashRuntime({ state: { survivorMap }, actions: { applyCombatElimination: noAward,
    atNow: () => ({ sec: 110 }), emitRunEvent: (kind, data) => events.push({ kind, ...data }) } });
  const damage = runtime.applyCharacterSkillSplashDamage(a, [b, c].map((target) => ({ target, damage: 100,
    packet: { type: 'skill', damage: 100 }, skill: '광역' })));
  assert.equal(damage, 9); assert.ok([b, c].every(isDimensionRiftDefeated));
  assert.equal(events.filter((event) => event.kind === 'dimension_rift_defeat').length, 2);
});
check('a defeated actor cannot create a zero-time combat reservation or count as active support', () => {
  const a = actor('a'); const b = actor('b'); [a, b].forEach(enter);
  withSimulationRandom(() => 0.5, () => engageCombatParticipants(a, b, [a, b], 100));
  defeat(a); assert.deepEqual(getCombatIntentOpponents(a, [a, b], 110), []);
  assert.deepEqual(getCombatIntentOpponents(b, [a, b], 110), []);
  assert.equal(findNextCombatAction(new Map([['a', a]]), 110), null);
  assert.equal(assessTeamCombat(b, [a, b], { estimatePower: () => 100 }).enemyCount, 0);
});
check('observer wording distinguishes arena defeat from match death', () => {
  const row = actor('a'); enter(row); defeat(row);
  assert.match(getCombatSpacePresentation(row).label, /전투 불능/);
  assert.match(describeObserverEvent({ kind: 'dimension_rift_defeat', ...row._dimensionRiftDefeat }), /경기 사망\/처치 보상 없음/);
});

console.log(`rift defeat checks passed: ${checks}`);
