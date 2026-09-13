import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';
const { actor, skill, effect, runCombatScenario } = await import('./lib/run-combat-scenario.mjs');
const { initializeSpatialPosition, getSpatialPosition, spatialDistance, getSpatialStats, canSeeActor, canObserveActor,
  isInBasicAttackRange, isInSpatialSkillRange, planSpatialApproach, planSpatialPatrol, advanceSpatialMovement } = await import('../src/app/simulation/_lib/combatSpatialRuntime.js');
const { resolveCombatWinnerOutcome } = await import('../src/app/simulation/_lib/phaseCombatDamageRuntime.js');
const { pickTeamFocusTarget, commitRetreatCover } = await import('../src/app/simulation/_lib/teamCombatRuntime.js');
const { normalizeRuntimeSurvivor } = await import('../src/app/simulation/_lib/survivorRuntime.js');
const { normalizeRevivedSurvivor } = await import('../src/app/simulation/_lib/survivorLifecycleRuntime.js');
const { findCharacterSkillChoice } = await import('../src/app/simulation/_lib/characterCastRuntime.js');
const { updateEffects } = await import('../src/utils/statusLogic.js');
const { createPhaseCombatSkillSplashRuntime } = await import('../src/app/simulation/_lib/phaseCombatSkillSplashRuntime.js');
const { buildTeamObserverModel, describeObserverEvent } = await import('../src/app/simulation/_lib/teamObserverRuntime.js');
const { engageCombatParticipants, findNextCombatAction } = await import('../src/app/simulation/_lib/combatTimingRuntime.js');
const point = (x, y = 4, zoneId = 'zone') => ({ zoneId, x, y });
const unit = (id, x, extra = {}) => actor(id, { _spatial: point(x), ...extra });
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-5, `${actual} != ${expected}`);
const hit = (a, b, roster = [a, b]) => resolveCombatWinnerOutcome({ state: { actor: a, target: b,
  supportRoster: roster, currentActionSec: () => 100, battleSettings: { characterSkillsEnabled: false }, pvpCfg: { criticalFleeHpBelow: 0 } } });
let checks = 0;
const check = async (name, run) => { await run(); checks++; console.log(`PASS ${name}`); };

await check('Euclidean region-local distance, exact reach boundary, and separate regions', () => {
  const a = unit('a', 4); const b = unit('b', 7, { _spatial: point(7, 8) });
  assert.equal(spatialDistance(a, b), 5);
  b._spatial = point(5.5); assert.equal(isInBasicAttackRange(a, b), true);
  b._spatial.x += 0.01; assert.equal(isInBasicAttackRange(a, b), false);
  b.zoneId = 'other'; b._spatial = point(4, 4, 'other'); assert.equal(spatialDistance(a, b), Infinity);
});
await check('missing, nonfinite, mismatched and outside positions cannot grant a free hit', () => {
  const a = unit('a', 4);
  for (const location of [undefined, point(NaN), point(25), point(-1), point(4, 4, 'wrong')]) {
    const b = unit('b', 4, { _spatial: location });
    assert.equal(getSpatialPosition(b), null); assert.equal(hit(a, b).performed, false); assert.equal(b.hp, 1000);
    assert.equal(a._basicAttackReadyAtSec, undefined);
  }
});
await check('runtime entry initializes deterministically and normalization does not mutate input', () => {
  const a = unit('a', 4); delete a._spatial;
  const first = normalizeRuntimeSurvivor(a); const second = normalizeRuntimeSurvivor(structuredClone(a));
  assert.deepEqual(first._spatial, second._spatial); assert.equal(a._spatial, undefined);
  first._spatial.x = 3; assert.notDeepEqual(first._spatial, second._spatial);
  const moved = { ...first, zoneId: 'other', _spatialMotion: { targetId: 'b' } };
  assert.equal(normalizeRuntimeSurvivor(moved)._spatial.zoneId, 'other');
  assert.equal(normalizeRuntimeSurvivor(moved)._spatialMotion, null);
  assert.deepEqual(initializeSpatialPosition(a), second._spatial);
});
await check('only living allies share sight and shared sight never expands attack range', () => {
  const a = unit('a', 4, { teamId: 'blue', stats: { attackRange: 10, sightRange: 2 } });
  const b = unit('b', 10); const scout = unit('scout', 9, { teamId: 'blue' });
  assert.equal(canSeeActor(a, b), false); assert.equal(canObserveActor(a, b, [a, scout, b]), true);
  assert.equal(isInBasicAttackRange(a, b, [a, scout, b]), true);
  a.stats.attackRange = 1.5; assert.equal(isInBasicAttackRange(a, b, [a, scout, b]), false);
  scout.hp = 0; assert.equal(canObserveActor(a, b, [a, scout, b]), false);
});
await check('actual hit rejects distance and sight failures before reserving cooldown or tactical damage', () => {
  const a = unit('a', 4); const b = unit('b', 8);
  assert.equal(hit(a, b).performed, false); assert.equal(a._basicAttackReadyAtSec, undefined);
  a.stats.attackRange = 6; a.stats.sightRange = 1;
  assert.equal(hit(a, b).performed, false);
  a.stats.sightRange = 8; assert.equal(hit(a, b).performed, true); assert.equal(b.hp, 999);
});
await check('equipped range and sight count but unequipped gear never leaks into spatial stats', () => {
  const a = unit('a', 4, { equipped: { weapon: '' }, inventory: [{ itemId: 'bow', type: 'weapon', equipSlot: 'weapon', stats: { attackRange: 3, sightRange: 2, moveSpeed: 0.2 } }] });
  near(getSpatialStats(a).attackRange, 1.5); near(getSpatialStats(a).moveSpeed, 3.5);
  a.equipped = { weapon: 'bow' };
  near(getSpatialStats(a).attackRange, 4.5); near(getSpatialStats(a).sightRange, 10); near(getSpatialStats(a).moveSpeed, 4.2);
});
await check('elapsed movement uses speed and stops at basic reach, not at the target center', () => {
  const a = unit('a', 4); const b = unit('b', 11);
  planSpatialApproach(a, b, 100, [a, b]); advanceSpatialMovement([a, b], 100, 1);
  near(a._spatial.x, 7.5); advanceSpatialMovement([a, b], 101, 1); near(a._spatial.x, 9.5);
});
await check('root expiry and fractional slow expiry divide movement at their real boundaries', () => {
  const a = unit('a', 4, { activeEffects: [effect('속박', 0.2), effect('slow', 0.5, { moveSpeedBonus: -0.5 })] });
  const b = unit('b', 11); planSpatialApproach(a, b, 100, [a, b]);
  advanceSpatialMovement([a, b], 100, 1);
  near(a._spatial.x, 4 + 0.3 * 1.75 + 0.5 * 3.5);
});
await check('splitting elapsed time and changing roster order do not change physical movement', () => {
  const a = unit('a', 4, { activeEffects: [effect('slow', 0.5, { moveSpeedBonus: -0.5 })] });
  const b = unit('b', 11); planSpatialApproach(a, b, 100, [a, b]); planSpatialApproach(b, a, 100, [a, b]);
  const whole = structuredClone([a, b]); let split = structuredClone([b, a]);
  advanceSpatialMovement(whole, 100, 1);
  for (let i = 0; i < 4; i++) { advanceSpatialMovement(split, 100 + i / 4, 0.25); split = split.map((row) => updateEffects(row, { elapsedSec: 0.25 })); }
  for (const row of whole) near(row._spatial.x, split.find((other) => other._id === row._id)._spatial.x);
});
await check('loss of sight follows only the last known point for at most three seconds', () => {
  const a = unit('a', 4); const b = unit('b', 9); planSpatialApproach(a, b, 100, [a, b]);
  b._spatial = point(23, 23); planSpatialApproach(a, b, 100.25, [a, b]);
  assert.equal(a._spatialMotion.reason, 'last_seen'); assert.equal(a._spatialMotion.x, 9); assert.equal(a._spatialMotion.y, 4);
  assert.equal(planSpatialApproach(a, b, 103, [a, b]), null); assert.equal(a._spatialMotion, null);
});
await check('reaching attack range stops movement without erasing the last observed enemy position', () => {
  const a = unit('a', 4); const b = unit('b', 5); const rows = [a, b]; const live = new Map(rows.map((row) => [row._id, row]));
  engageCombatParticipants(a, b, rows, 100); findNextCombatAction(live, 100, [], { characterSkillsEnabled: false });
  assert.equal(a._spatialMotion, null);
  b._spatial = point(23, 23); findNextCombatAction(live, 100.25, [], { characterSkillsEnabled: false });
  assert.equal(a._spatialMotion.reason, 'last_seen'); assert.equal(a._spatialMotion.x, 5); assert.equal(a._spatialMotion.y, 4);
});
await check('patrol is independent of unseen enemies and makes a stationary searcher explore', () => {
  const a = unit('a', 12); const copy = structuredClone(a);
  planSpatialPatrol(a, 100); planSpatialPatrol(copy, 100); assert.deepEqual(a._spatialMotion, copy._spatialMotion);
  assert.equal(a._spatialMotion.targetId, ''); advanceSpatialMovement([a], 100, 1); assert.notEqual(a._spatial.x, 12);
});
await check('real scheduler approaches before the first basic and records a legal hit distance', async () => {
  const a = unit('a', 4); const b = unit('b', 11, { activeEffects: [effect('속박', 20)], _basicAttackReadyAtSec: 200 });
  const result = await runCombatScenario([a, b], { duration: 4, settings: { characterSkillsEnabled: false } });
  assert.equal(result.times('a')[0], 101.75);
  assert.ok(result.events.filter((row) => row.kind === 'damage').every((row) => row.distance <= 1.500001));
  assert.ok(result.frames.some((frame) => frame.sec < 101.75 && frame.roster.find((row) => row._id === 'a')._spatial.x > 4));
});
await check('rooted out-of-range actor cannot attack or freeze the clock, silence does not prevent approach', async () => {
  const a = unit('a', 4, { activeEffects: [effect('속박', 20)] });
  const b = unit('b', 11, { activeEffects: [effect('속박', 20)] });
  const blocked = await runCombatScenario([a, b], { settings: { characterSkillsEnabled: false } });
  assert.equal(blocked.events.filter((row) => row.kind === 'damage').length, 0);
  const moving = await runCombatScenario([unit('a', 4, { activeEffects: [effect('침묵', 20)] }), b], { settings: { characterSkillsEnabled: false } });
  assert.equal(moving.times('a')[0], 101.75);
});
await check('a ranged skill casts without first entering basic range and does not move while casting', async () => {
  const a = unit('a', 4, { characterSkills: { q: skill({ range: 8 }) } });
  const b = unit('b', 11, { activeEffects: [effect('속박', 20)], _basicAttackReadyAtSec: 200 });
  const result = await runCombatScenario([a, b]); assert.deepEqual(result.times('a', 'skill'), [101.25]);
  assert.ok(result.frames.filter((frame) => frame.sec <= 101.25).every((frame) => frame.roster.find((row) => row._id === 'a')._spatial.x === 4));
  assert.ok(result.times('a')[0] > 101.25);
});
for (const [name, x, reason] of [['range', 10, 'out_of_range'], ['sight', 23, 'out_of_sight']]) {
  await check(`same-region ${name} loss cancels the cast without damage or silent retargeting`, async () => {
    const a = unit('a', 4, { characterSkills: { q: skill({ range: 5 }) } });
    const b = unit('b', 8, { activeEffects: [effect('속박', 20)], _basicAttackReadyAtSec: 200 });
    const result = await runCombatScenario([a, b], { duration: 2, onElapsed: (live, elapsed) => {
      if (elapsed >= 0.5) live.get('b')._spatial = point(x);
    } });
    assert.ok(result.events.some((row) => row.kind === 'skill_cancel' && row.reason === reason));
    assert.equal(result.times('a', 'skill').length, 0);
  });
}
await check('area damage uses radius around its actual target and cannot hit a remote same-region enemy or ally', async () => {
  const a = unit('a', 4, { characterSkills: { q: skill({ range: 8, radius: 2, targetPriority: 'highest_max_hp' }) }, _basicAttackReadyAtSec: 200 });
  const b = unit('b', 8, { maxHp: 10000, activeEffects: [effect('속박', 20)], _basicAttackReadyAtSec: 200 });
  const c = unit('c', 9.5, { teamId: 'b', activeEffects: [effect('속박', 20)], _basicAttackReadyAtSec: 200 });
  const d = unit('d', 12, { teamId: 'b', activeEffects: [effect('속박', 20)], _basicAttackReadyAtSec: 200 });
  const ally = unit('ally', 8, { teamId: 'a', activeEffects: [effect('속박', 20)], _basicAttackReadyAtSec: 200 });
  const result = await runCombatScenario([a, b, c, d, ally], { duration: 1.5 });
  assert.ok(result.survivorMap.get('b').hp < 1000); assert.ok(result.survivorMap.get('c').hp < 1000);
  assert.equal(result.survivorMap.get('d').hp, 1000); assert.equal(result.survivorMap.get('ally').hp, 1000);
  const splash = result.events.find((row) => row.kind === 'damage' && row.targetId === 'c');
  near(splash.areaDistance, 1.5); assert.equal(splash.radius, 2); assert.deepEqual(splash.centerPosition, point(8));
});
await check('a prepared splash is rechecked against its center if the victim moves before commit', () => {
  const a = unit('a', 4); const b = unit('b', 10);
  const runtime = createPhaseCombatSkillSplashRuntime({ state: { survivorMap: new Map([[a._id, a], [b._id, b]]) } });
  const packet = { target: b, damage: 40, packet: { type: 'skill' }, centerPosition: point(7), radius: 2 };
  assert.equal(runtime.applyCharacterSkillSplashDamage(a, [packet]), 0); assert.equal(b.hp, 1000);
  b._spatial.x = 8; assert.equal(runtime.applyCharacterSkillSplashDamage(a, [packet]), 40);
});
await check('support range and AI cluster conditions use actual meters', () => {
  const a = unit('a', 4, { characterSkills: { q: skill({ range: 8, radius: 1, minSplashTargets: 1 }) } });
  const b = unit('b', 8); const c = unit('c', 10);
  assert.equal(findCharacterSkillChoice(a, [b, c], [a, b, c], 100), null);
  c._spatial.x = 8.5; assert.ok(findCharacterSkillChoice(a, [b, c], [a, b, c], 100));
  assert.equal(isInSpatialSkillRange(a, b, { range: 3 }), false);
});
await check('focus fire and retreat cover cannot recruit unreachable same-region teammates', () => {
  const a = unit('a', 4); const nearEnemy = unit('b', 5); const farEnemy = unit('c', 10, { hp: 1 });
  assert.equal(pickTeamFocusTarget(a, [farEnemy, nearEnemy], 'c')._id, 'b');
  const flee = unit('flee', 4, { teamId: 'a' }); const helper = unit('helper', 12, { teamId: 'a' });
  assert.deepEqual(commitRetreatCover(flee, nearEnemy, [flee, helper, nearEnemy], { nowSec: 100 }).helpers, []);
  helper._spatial.x = 4; assert.deepEqual(commitRetreatCover(flee, nearEnemy, [flee, helper, nearEnemy], { nowSec: 100 }).helpers, ['helper']);
});
await check('revival starts a new spatial life and clears old movement', () => {
  const a = unit('a', 23, { hp: 0, _spatialMotion: { targetId: 'b', reason: 'approach' }, _spatialPatrolIndex: 20 });
  const revived = normalizeRevivedSurvivor(a, 500, 'zone', 3, {}, 100);
  assert.equal(revived._spatialMotion, null); assert.equal(revived._spatialPatrolIndex, 0);
  assert.deepEqual(revived._spatial, initializeSpatialPosition(a, { reset: true }));
});
await check('real discovery ignores unseen targets then patrol finds and engages them without a forced encounter', async () => {
  const a = unit('searcher', 4); const b = unit('hidden', 23, { activeEffects: [effect('속박', 100)], _basicAttackReadyAtSec: 1000 });
  assert.equal(canSeeActor(a, b), false);
  const result = await runCombatScenario([a, b], { engage: false, nextDay: 2, duration: 60, settings: { characterSkillsEnabled: false } });
  assert.ok(result.times('searcher').length > 0);
  assert.ok(result.times('searcher')[0] > 100);
  assert.ok(result.events.filter((row) => row.kind === 'damage').every((row) => row.distance <= row.reach + 1e-6));
});
await check('observer exposes actual coordinates, ranges, search intent and cancellation reasons without mutation', () => {
  const a = unit('a', 4); planSpatialPatrol(a, 100); const before = JSON.stringify(a);
  const model = buildTeamObserverModel({ survivors: [a], dead: [], matchSec: 100, events: [], publicItems: [] });
  assert.match(model.members[0].spatial, /4\.0, 4\.0/); assert.match(model.members[0].spatial, /평타 1\.5m/);
  assert.match(model.members[0].motion, /지역 내부 탐색/); assert.equal(JSON.stringify(a), before);
  assert.match(describeObserverEvent({ kind: 'skill_cancel', who: 'a', reason: 'out_of_sight', skill: 'Q' }), /대상 시야 이탈/);
});
console.log(`COMBAT_SPATIAL_CHECKS ${checks}/${checks}`);
