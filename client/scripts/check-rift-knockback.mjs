import assert from 'node:assert/strict';
import './lib/register-simulation-modules.mjs';

// Written during the verification pause. No test/build/runtime execution yet.
const { applyStatusEffect } = await import('../src/app/simulation/_lib/runtimeStatusApplication.js');
const { resolveRiftKnockbacks } = await import('../src/app/simulation/_lib/riftDisplacementRuntime.js');
const { enterDimensionRiftSpace, leaveDimensionRiftSpace } = await import('../src/app/simulation/_lib/dimensionRiftSpaceRuntime.js');
const { getCombatSpaceId } = await import('../src/utils/combatSpaceLogic.js');
const { normalizeStatusEffect, updateEffects, getKnockbackDistance, canMoveByStatus } = await import('../src/utils/statusLogic.js');
const { normalizeRuntimeEffect } = await import('../src/app/simulation/_lib/runtimeStatusNormalization.js');
const { describeRuntimeEffect } = await import('../src/app/simulation/_lib/runtimeStatusDisplay.js');
const { reconcileCharacterCasts } = await import('../src/app/simulation/_lib/characterCastRuntime.js');
const { findNextCombatAction } = await import('../src/app/simulation/_lib/combatTimingRuntime.js');
const { commitRuntimeHpDamage } = await import('../src/utils/dimensionRiftDefeatLogic.js');
const { applyActorKnockbackMovement } = await import('../src/app/simulation/_lib/actorMovementDecisionHelpers.js');
const { applyErWeaponSkillAfterCombat } = await import('../src/app/simulation/_lib/combatRuntime.js');
const { runPvpActionLoop } = await import('../src/app/simulation/_lib/phasePvpActionLoopRuntime.js');
const { describeObserverEvent, buildTeamObserverModel } = await import('../src/app/simulation/_lib/teamObserverRuntime.js');
const { withSimulationRandom } = await import('../src/utils/simulationRandom.js');

let checks = 0;
async function check(name, run) { await run(); checks++; console.log(`PASS ${name}`); }
const actor = (id, x, y, extra = {}) => ({ _id: id, name: id, teamId: id, teamName: id,
  zoneId: 'z', hp: 1000, maxHp: 1000, simCredits: 23, inventory: [], activeEffects: [],
  stats: { maxHp: 1000, attackPower: 100, defense: 0, attackSpeed: 1 },
  _spatial: { zoneId: 'z', x, y }, ...extra });
const rift = (id = 'r') => ({ id, zoneId: 'z', resolved: false, entrants: [] });
const pair = (from = [4, 4], target = [8, 4]) => {
  const a = actor('a', ...from); const b = actor('b', ...target);
  [a, b].forEach((row) => enterDimensionRiftSpace(row, rift(), 100)); return { a, b };
};
const effect = (distance = 1, extra = {}) => ({ name: '넉백', remainingDuration: 5, durationUnit: 'sec', knockbackDistance: distance, ...extra });
const push = (a, b, distance = 1, opts = {}) => applyStatusEffect(b, effect(distance), { sourceActor: a, nowSec: 110, ...opts });
const point = (row) => [row._spatial.x, row._spatial.y];
const noRandom = () => { throw new Error('Arena displacement must not draw random numbers'); };
const pendingCast = (actor, target) => ({ castId: `${actor._id}:1`, def: { slot: 'q', name: 'Q', type: 'attack_skill' },
  stage: 1, targetId: target._id, combatSpaceId: getCombatSpaceId(actor), zoneId: 'z',
  startedAtSec: 109, releaseAtSec: 112, recoveryUntilSec: 113, previousActionReadyAtSec: 105, decision: {} });
const resources = (row) => structuredClone(Object.fromEntries(['hp', 'maxHp', 'inventory', 'simCredits', 'skillState',
  '_basicAttackReadyAtSec', '_growthReadyAtSec', '_tacNextAbsSec', 'safeZoneUntil', 'detonationSec', '_recentCombatUntil'].map((key) => [key, row[key]])));

await check('an actual status application moves one meter and returns its committed snapshot', () => {
  const { a, b } = pair(); const result = withSimulationRandom(noRandom, () => push(a, b));
  assert.deepEqual(point(b), [9, 4]); assert.deepEqual(point(result.character), point(b));
  assert.equal(result.displacements.length, 1); assert.equal(result.effect.knockbackConsumed, true);
  assert.equal(b._lastRiftKnockbackReceipt.actualDistance, 1); assert.equal(b._lastRiftKnockbackReceipt.sourceActorId, 'a');
  assert.equal(b.zoneId, 'z'); assert.equal(getCombatSpaceId(b), 'dimension_rift:r');
});
await check('fractional meters survive both status normalizers without finite-value overflow', () => {
  const { a, b } = pair(); const normalized = normalizeRuntimeEffect(normalizeStatusEffect(effect(0.75)));
  assert.equal(normalized.knockbackDistance, 0.75); push(a, b, 0.75); assert.deepEqual(point(b), [8.75, 4]);
  assert.ok(Number.isFinite(normalizeRuntimeEffect(normalizeStatusEffect(effect(1e308))).knockbackDistance));
});
await check('diagonal clipping stops at the first edge without turning the ray toward a corner', () => {
  const { a, b } = pair([22, 11], [23, 12]); push(a, b, 10);
  assert.deepEqual(point(b), [24, 13]); assert.equal(b._lastRiftKnockbackReceipt.clipped, true);
  assert.equal(b._lastRiftKnockbackReceipt.actualDistance, 1.414214);
});
await check('coincident impact positions use the documented deterministic positive-X fallback', () => {
  const { a, b } = pair([8, 8], [8, 8]); withSimulationRandom(noRandom, () => push(a, b, 2));
  assert.deepEqual(point(b), [10, 8]);
});
await check('an outward impulse at a wall is consumed and interrupts casting without moving regions', () => {
  const { a, b } = pair([23, 8], [24, 8]); b._pendingCharacterCast = pendingCast(b, a); push(a, b, 2);
  assert.deepEqual(point(b), [24, 8]); assert.equal(b._lastRiftKnockbackReceipt.actualDistance, 0);
  assert.equal(b._pendingCharacterCast.statusInterrupt, '넉백'); assert.equal(getKnockbackDistance(b), 0);
});
await check('reconciliation, JSON restore and callback re-entry cannot apply the same impulse twice', () => {
  const { a, b } = pair(); const events = []; push(a, b, 1, { emitRunEvent: (kind, data) => {
    events.push({ kind, ...data }); assert.equal(resolveRiftKnockbacks([b], 110).length, 0);
  } });
  const restored = JSON.parse(JSON.stringify(b)); restored.activeEffects[0].knockbackConsumed = false;
  assert.equal(resolveRiftKnockbacks([restored], 111).length, 0); assert.deepEqual(point(restored), [9, 4]);
  assert.equal(restored.activeEffects[0].knockbackConsumed, true); assert.equal(events.length, 1);
});
await check('a later real application gets a new serial even after the previous effect expires', () => {
  const { a, b } = pair(); push(a, b); const serial = b._lastRiftKnockbackReceipt.serial;
  b.activeEffects = []; push(a, b, 2, { nowSec: 120 });
  assert.deepEqual(point(b), [11, 4]); assert.equal(b._lastRiftKnockbackReceipt.serial, serial + 1);
});
await check('movement, CC and harmful-effect immunities reject the impulse; duration resistance does not shorten knockback', () => {
  for (const name of ['이동 방해 면역', '모든 방해 면역', '해로운 효과 면역']) {
    const { a, b } = pair(); b.activeEffects = [{ name, remainingDuration: 5, durationUnit: 'sec' }];
    assert.equal(push(a, b).applied, false); assert.deepEqual(point(b), [8, 4]); assert.equal(b._lastRiftKnockbackReceipt, undefined);
  }
  const { a, b } = pair(); b.stats.ccDurationReduction = 0.9;
  assert.equal(push(a, b).effect.remainingDuration, 5);
});
await check('unstoppable defers the stored impulse until its status boundary', () => {
  const { a, b } = pair(); b.activeEffects = [{ name: '저지 불가', remainingDuration: 1, durationUnit: 'sec' }];
  assert.ok(push(a, b).suppressedBy); assert.deepEqual(point(b), [8, 4]);
  Object.assign(b, updateEffects(b, { elapsedSec: 1, startSec: 110 }));
  assert.equal(resolveRiftKnockbacks([b], 111).length, 1); assert.deepEqual(point(b), [9, 4]);
  assert.equal(b._lastRiftKnockbackReceipt.atSec, 111); assert.equal(b._lastRiftKnockbackReceipt.effectAppliedAtSec, 110);
});
await check('an impulse that expires along with unstoppable cannot activate afterward', () => {
  const { a, b } = pair(); b.activeEffects = [{ name: '저지 불가', remainingDuration: 1, durationUnit: 'sec' }];
  applyStatusEffect(b, effect(2, { remainingDuration: 1 }), { sourceActor: a, nowSec: 110 });
  Object.assign(b, updateEffects(b, { elapsedSec: 1, startSec: 110 }));
  assert.equal(resolveRiftKnockbacks([b], 111).length, 0); assert.deepEqual(point(b), [8, 4]);
});
await check('deferred direction uses both impact snapshots, not later caster or target positions', () => {
  const { a, b } = pair(); push(a, b, 2, { nowSec: undefined });
  assert.equal(b._lastRiftKnockbackReceipt, undefined); a._spatial.x = 20; b._spatial = { ...b._spatial, x: 12, y: 8 };
  resolveRiftKnockbacks([b], 110); assert.deepEqual(point(b), [14, 8]);
  assert.equal(b._lastRiftKnockbackReceipt.sourcePosition.x, 4); assert.equal(b._lastRiftKnockbackReceipt.targetPositionAtHit.x, 8);
});
await check('missing direction is reported once without guessing or consuming randomness', () => {
  const { b } = pair(); const events = [];
  withSimulationRandom(noRandom, () => applyStatusEffect(b, effect(), { nowSec: 110, emitRunEvent: (kind, data) => events.push({ kind, ...data }) }));
  resolveRiftKnockbacks([b], 111, { emitRunEvent: (kind, data) => events.push({ kind, ...data }) });
  assert.deepEqual(point(b), [8, 4]); assert.equal(events.length, 1); assert.equal(events[0].reason, 'source_position_unknown');
});
await check('effects from a prior entry, a different arena, or the world cannot push an admitted actor', () => {
  for (const mutate of [(row) => { row.knockbackTargetEntryAtSec = 99; },
    (row) => { row.knockbackTargetSpaceId = 'dimension_rift:other'; }]) {
    const { a, b } = pair(); push(a, b, 1, { nowSec: undefined }); mutate(b.activeEffects[0]);
    assert.equal(resolveRiftKnockbacks([b], 110).length, 0); assert.deepEqual(point(b), [8, 4]);
  }
  const a = actor('a', 4, 4); const b = actor('b', 8, 4); push(a, b); enterDimensionRiftSpace(b, rift(), 110);
  assert.equal(resolveRiftKnockbacks([b], 111).length, 0); assert.deepEqual(point(b), [8, 4]);
});
await check('root and stun block walking but do not suppress a valid forced displacement', () => {
  for (const name of ['속박', '기절']) {
    const { a, b } = pair(); b.activeEffects = [{ name, remainingDuration: 5, durationUnit: 'sec' }];
    assert.equal(canMoveByStatus(b), false); push(a, b); assert.deepEqual(point(b), [9, 4]);
  }
});
await check('stasis, arena defeat and a defeated source cannot apply a new displacement', () => {
  const first = pair(); first.b.activeEffects = [{ name: '경직', remainingDuration: 5, durationUnit: 'sec' }];
  assert.equal(push(first.a, first.b).applied, false); assert.deepEqual(point(first.b), [8, 4]);
  const second = pair(); commitRuntimeHpDamage(second.b, 10000, { atSec: 109 });
  assert.equal(push(second.a, second.b).applied, false); assert.deepEqual(point(second.b), [8, 4]);
  const third = pair(); commitRuntimeHpDamage(third.a, 10000, { atSec: 109 });
  assert.equal(push(third.a, third.b).applied, false); assert.deepEqual(point(third.b), [8, 4]);
});
await check('real cast cancellation preserves cooldown while the impulse clears the old motion', () => {
  const { a, b } = pair(); b._pendingCharacterCast = pendingCast(b, a); b.skillState = { q: { stage: 'casting', cooldownUntil: 999 } };
  b._actionReadyAtSec = 113; b._spatialMotion = { ...b._spatial, x: 16, stopRange: 0 };
  push(a, b); const events = []; reconcileCharacterCasts([a, b], 110, { characterSkillsEnabled: true },
    { emitRunEvent: (kind, data) => events.push({ kind, ...data }) });
  assert.equal(b._pendingCharacterCast, null); assert.equal(b._spatialMotion, null); assert.equal(b.skillState.q.cooldownUntil, 999);
  assert.equal(events.find((event) => event.kind === 'skill_cancel').reason, 'status');
});
await check('displacement does not heal, spend credits, reset timers or consume other effects', () => {
  const { a, b } = pair(); b.inventory = [{ itemId: 'held', qty: 2 }]; b._basicAttackReadyAtSec = 123;
  b._growthReadyAtSec = 140; b._tacNextAbsSec = 200; b.safeZoneUntil = 112; b.detonationSec = 17; b._recentCombatUntil = 119;
  b.activeEffects = [normalizeStatusEffect({ name: '중독', dotDamage: 3, remainingDuration: 9, durationUnit: 'sec' })];
  const before = resources(b); push(a, b); assert.deepEqual(resources(b), before);
  assert.equal(b.activeEffects.find((row) => row.name === '중독').remainingDuration, 9);
});
await check('ordinary field movement keeps its integer threshold and legacy region route', () => {
  const a = actor('a', 4, 4); const b = actor('b', 8, 4); push(a, b, 0.5);
  const input = { state: { actor: b, zoneGraph: { z: ['away'] } } };
  withSimulationRandom(noRandom, () => applyActorKnockbackMovement(input)); assert.equal(b.zoneId, 'z');
  push(a, b, 1); withSimulationRandom(() => 0.5, () => applyActorKnockbackMovement(input)); assert.equal(b.zoneId, 'away');
});
await check('consumed and suppressed arena impulses cannot become field teleports after exit', () => {
  for (const suppressed of [false, true]) {
    const { a, b } = pair(); if (suppressed) b.activeEffects = [{ name: '저지 불가', remainingDuration: 1, durationUnit: 'sec' }];
    push(a, b); leaveDimensionRiftSpace(b, rift(), 111, 'window_expired');
    Object.assign(b, updateEffects(b, { elapsedSec: 1, startSec: 111 }));
    assert.equal(getKnockbackDistance(b), 0);
    withSimulationRandom(noRandom, () => applyActorKnockbackMovement({ state: { actor: b, zoneGraph: { z: ['away'] } } }));
    assert.equal(b.zoneId, 'z');
  }
});
await check('knockback keeps admission and return-point state intact instead of recording a withdrawal', () => {
  const { a, b } = pair(); const entry = structuredClone(b._dimensionRiftEntry); push(a, b, 8);
  assert.deepEqual(b._dimensionRiftEntry, entry); assert.equal(b._lastDimensionRiftExit, undefined);
  leaveDimensionRiftSpace(b, rift(), 120, 'window_expired'); assert.deepEqual(point(b), [8, 4]);
});
await check('the actual Full Swing weapon path supplies the caster snapshot and applies arena movement', () => {
  const { a, b } = pair(); a.weaponType = '방망이'; a.weaponMasteryLevel = 10; const events = [];
  const result = withSimulationRandom(() => 0, () => applyErWeaponSkillAfterCombat(a, b,
    { damageDealt: 100, nowSec: 110, at: { sec: 110 }, emitRunEvent: (kind, data) => events.push({ kind, ...data }) }));
  assert.equal(result.skill, '풀스윙'); assert.deepEqual(point(b), [9, 4]);
  assert.equal(events.filter((event) => event.kind === 'spatial_displacement').length, 1); assert.ok(a.cooldowns.weaponSkill > 0);
});
await check('a foreign-space direct weapon call cannot spend cooldowns or draw a proc roll', () => {
  const { a, b } = pair(); leaveDimensionRiftSpace(b, rift(), 110, 'withdrawn');
  a.weaponType = '방망이'; a.weaponMasteryLevel = 10; const before = structuredClone(a);
  const out = withSimulationRandom(noRandom, () => applyErWeaponSkillAfterCombat(a, b, { damageDealt: 100, nowSec: 110 }));
  assert.equal(out.applied, false); assert.deepEqual(a, before);
  assert.equal(push(a, b).reason, 'combat_space');
});
await check('the actual PvP runner resolves a restored impulse before its first published frame', async () => {
  const { a, b } = pair(); push(a, b, 1, { nowSec: undefined }); const frames = [];
  let combatPromise;
  withSimulationRandom(() => 0.5, () => { combatPromise = runPvpActionLoop({ state: { updatedSurvivors: [a, b], phaseSurvivors: [a, b],
    currentActionSec: () => 110, phaseDurationSec: 0 }, actions: {
    publishActionFrame: ({ survivorMap }) => { frames.push(structuredClone(survivorMap.get('b'))); },
  } }); });
  await combatPromise;
  assert.ok(frames.length > 0); assert.deepEqual(point(frames[0]), [9, 4]);
  assert.equal(frames[0]._lastRiftKnockbackReceipt.atSec, 110);
});
await check('the real scheduler exposes the suppression boundary before a pending spell release', () => {
  const { a, b } = pair(); b.activeEffects = [{ name: '저지 불가', remainingDuration: 1, durationUnit: 'sec' }];
  b._pendingCharacterCast = pendingCast(b, a); b.skillState = { q: { stage: 'casting', cooldownUntil: 999 } }; push(a, b);
  const next = findNextCombatAction(new Map([['b', b]]), 110, [], { characterSkillsEnabled: true });
  assert.equal(next.actionType, 'status_boundary'); assert.equal(next.atSec, 111);
  Object.assign(b, updateEffects(b, { elapsedSec: 1, startSec: 110 })); resolveRiftKnockbacks([b], 111);
  reconcileCharacterCasts([a, b], 111, { characterSkillsEnabled: true }); assert.equal(b._pendingCharacterCast, null);
  assert.equal(b.skillState.q.cooldownUntil, 999);
});
await check('observer events and status labels explain internal displacement instead of region travel', () => {
  const { a, b } = pair(); const events = []; push(a, b, 0.75, { emitRunEvent: (kind, data, at) => events.push({ kind, ...data, at }) });
  assert.match(describeObserverEvent(events[0]), /틈 내부 넉백 0.75m/);
  assert.match(describeRuntimeEffect(b.activeEffects.find((row) => row.name === '넉백')), /처리 완료/);
  const model = buildTeamObserverModel({ survivors: [a, b], teamId: 'b', matchSec: 110, events });
  assert.ok(model.turningPoints.some((row) => row.kind === 'spatial_displacement'));
});

console.log(`Rift-knockback checks: ${checks}`);
