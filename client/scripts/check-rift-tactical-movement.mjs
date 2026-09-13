import assert from 'node:assert/strict';
import './lib/register-simulation-modules.mjs';

// Written during the verification pause. No test/build/runtime execution yet.
const { enterDimensionRiftSpace } = await import('../src/app/simulation/_lib/dimensionRiftSpaceRuntime.js');
const { resolveRiftTacticalMovement } = await import('../src/app/simulation/_lib/riftDisplacementRuntime.js');
const { createPhaseCombatTacticalRuntime } = await import('../src/app/simulation/_lib/phaseCombatTacticalRuntime.js');
const { describeObserverEvent } = await import('../src/app/simulation/_lib/teamObserverRuntime.js');
const { getTacEffectNumber } = await import('../src/utils/tacticalSkillCatalog.js');
const { getCombatSpaceId } = await import('../src/utils/combatSpaceLogic.js');

let checks = 0;
async function check(name, run) { await run(); checks++; console.log(`PASS ${name}`); }
const rift = (id = 'r') => ({ id, zoneId: 'z', resolved: false, entrants: [] });
const actor = (id, x, y, extra = {}) => ({ _id: id, name: id, teamId: id, teamName: id,
  zoneId: 'z', hp: 100, maxHp: 100, inventory: [], simCredits: 17, activeEffects: [],
  stats: { maxHp: 100, attackPower: 20, defense: 0, attackSpeed: 1, moveSpeed: 3, attackRange: 5, sightRange: 10 },
  _spatial: { zoneId: 'z', x, y }, ...extra });
const pair = (from = [4, 4], target = [9, 4]) => {
  const a = actor('a', ...from); const b = actor('b', ...target);
  [a, b].forEach((row) => enterDimensionRiftSpace(row, rift(), 100)); return { a, b };
};
const point = (row) => [row._spatial.x, row._spatial.y];
const resources = (row) => structuredClone(Object.fromEntries(['hp', 'maxHp', 'inventory', 'simCredits', 'activeEffects',
  'skillState', '_basicAttackReadyAtSec', '_growthReadyAtSec', 'safeZoneUntil', 'detonationSec'].map((key) => [key, row[key]])));

await check('catalog distances preserve the four explicitly described tactical movements', () => {
  assert.deepEqual(['블링크', '붉은 폭풍', '리펄서 미사일', '플라즈마 대시']
    .map((name) => getTacEffectNumber(name, 'movementDistance', 1, 0)), [3, 2.5, 3, 2.5]);
});

await check('direct arena movement follows the chosen target without changing admission or resources', () => {
  const { a, b } = pair(); a._tacLastUsed = '붉은 폭풍'; a._tacLastUsedAt = 110; a._spatialMotion = { ...a._spatial, x: 20, targetId: 'b', stopRange: 1 };
  const before = resources(a); const entry = structuredClone(a._dimensionRiftEntry);
  const receipt = resolveRiftTacticalMovement(a, b, { skill: '붉은 폭풍', distance: 2.5, nowSec: 110 });
  assert.deepEqual(point(a), [6.5, 4]); assert.equal(receipt.actualDistance, 2.5); assert.equal(receipt.targetId, 'b');
  assert.deepEqual(a._dimensionRiftEntry, entry); assert.deepEqual(resources(a), before); assert.equal(a._spatialMotion, null);
  assert.equal(getCombatSpaceId(a), 'dimension_rift:r'); assert.equal(a.zoneId, 'z');
});

await check('movement stops at the target instead of overshooting it', () => {
  const { a, b } = pair([4, 4], [5, 4]); a._tacLastUsed = '리펄서 미사일'; a._tacLastUsedAt = 110;
  const receipt = resolveRiftTacticalMovement(a, b, { skill: '리펄서 미사일', distance: 3, nowSec: 110 });
  assert.deepEqual(point(a), [5, 4]); assert.equal(receipt.actualDistance, 1); assert.equal(receipt.stoppedAtTarget, true);
});

await check('one tactical use cannot move twice after callback re-entry or JSON restore', () => {
  const { a, b } = pair(); a._tacLastUsed = '붉은 폭풍'; a._tacLastUsedAt = 110;
  const events = []; resolveRiftTacticalMovement(a, b, { skill: '붉은 폭풍', distance: 2.5, nowSec: 110 },
    { emitRunEvent: (kind, data) => { events.push({ kind, ...data }); assert.equal(resolveRiftTacticalMovement(a, b,
      { skill: '붉은 폭풍', distance: 2.5, nowSec: 110 }), null); } });
  const saved = JSON.parse(JSON.stringify({ a, b }));
  assert.equal(resolveRiftTacticalMovement(saved.a, saved.b, { skill: '붉은 폭풍', distance: 2.5, nowSec: 110 }), null);
  assert.deepEqual(point(saved.a), [6.5, 4]); assert.equal(events.length, 1);
});

await check('world, foreign, future and malformed rift membership cannot create internal movement', () => {
  const cases = [];
  cases.push([actor('world-a', 4, 4), actor('world-b', 9, 4)]);
  { const { a, b } = pair(); b._dimensionRiftEntry.riftId = 'other'; b._combatSpaceId = 'dimension_rift:other';
    b._spatial.combatSpaceId = 'dimension_rift:other'; cases.push([a, b]); }
  { const { a, b } = pair(); a._dimensionRiftEntry.enteredAtSec = 120; cases.push([a, b]); }
  { const { a, b } = pair(); a._dimensionRiftEntry = null; cases.push([a, b]); }
  for (const [a, b] of cases) {
    a._tacLastUsed = '붉은 폭풍'; a._tacLastUsedAt = 110; const before = structuredClone(a);
    assert.equal(resolveRiftTacticalMovement(a, b, { skill: '붉은 폭풍', distance: 2.5, nowSec: 110 }), null);
    assert.deepEqual(a, before);
  }
});

await check('root, defeat and untargetability reject direct tactical movement', () => {
  for (const mutate of [
    (a) => { a.activeEffects = [{ name: '속박', remainingDuration: 2, durationUnit: 'sec' }]; },
    (a) => { a._dimensionRiftDefeat = { id: 'r:a:100:defeat:1', riftId: 'r', enteredAtSec: 100 }; },
    (_a, b) => { b.activeEffects = [{ name: '대상 지정 불가', remainingDuration: 2, durationUnit: 'sec' }]; },
  ]) {
    const { a, b } = pair(); mutate(a, b); a._tacLastUsed = '붉은 폭풍'; a._tacLastUsedAt = 110; const before = point(a);
    assert.equal(resolveRiftTacticalMovement(a, b, { skill: '붉은 폭풍', distance: 2.5, nowSec: 110 }), null);
    assert.deepEqual(point(a), before);
  }
});

await check('all catalogued movement tacticals are blocked by root without spending cooldown', () => {
  for (const tacticalSkill of ['블링크', '붉은 폭풍', '리펄서 미사일', '플라즈마 대시']) {
    const a = actor('a', 4, 4, { tacticalSkill, activeEffects: [{ name: '속박', remainingDuration: 2, durationUnit: 'sec' }] });
    const runtime = createPhaseCombatTacticalRuntime({ state: { absNow: 110 } });
    assert.equal(runtime.canUseTac(a), false); assert.equal(a._tacNextAbsSec, undefined);
  }
  assert.equal(createPhaseCombatTacticalRuntime({ state: { absNow: 110 } })
    .canUseTac(actor('a', 4, 4, { tacticalSkill: '치유의 바람' })), true);
});

await check('real combat tactical paths move by each offensive catalog distance and spend one cooldown', () => {
  for (const [tacticalSkill, expectedDistance] of [['붉은 폭풍', 2.5], ['리펄서 미사일', 3], ['플라즈마 대시', 2.5]]) {
    const { a, b } = pair([4, 4], [10, 4]); a.tacticalSkill = tacticalSkill;
    const events = []; const runtime = createPhaseCombatTacticalRuntime({ state: { absNow: 110 },
      actions: { emitRunEvent: (kind, data) => events.push({ kind, ...data }) } });
    assert.ok(runtime.applyCombatTacAttack(a, b, 0) > 0);
    assert.deepEqual(point(a), [4 + expectedDistance, 4]); assert.ok(a._tacNextAbsSec > 110);
    assert.equal(events.filter((event) => event.kind === 'spatial_displacement').length, 1);
    assert.equal(runtime.applyCombatTacAttack(a, b, 0), 0); assert.deepEqual(point(a), [4 + expectedDistance, 4]);
  }
});

await check('field combat keeps its existing abstract tactical effect without coordinate displacement', () => {
  const a = actor('a', 4, 4, { tacticalSkill: '붉은 폭풍' }); const b = actor('b', 9, 4);
  const runtime = createPhaseCombatTacticalRuntime({ state: { absNow: 110 } });
  assert.ok(runtime.applyCombatTacAttack(a, b, 0) > 0); assert.deepEqual(point(a), [4, 4]);
  assert.equal(a._lastRiftTacticalMovementReceipt, undefined); assert.ok(a._tacNextAbsSec > 110);
});

await check('foreign, future or malformed combat membership cannot spend a tactical cooldown or affect the target', () => {
  for (const mutate of [
    (_a, b) => { b._dimensionRiftEntry.riftId = 'other'; b._combatSpaceId = 'dimension_rift:other'; b._spatial.combatSpaceId = 'dimension_rift:other'; },
    (a) => { a._dimensionRiftEntry.enteredAtSec = 120; },
    (_a, b) => { b._dimensionRiftEntry = null; },
  ]) {
    const { a, b } = pair(); a.tacticalSkill = '플라즈마 대시'; mutate(a, b);
    const before = structuredClone({ a, b }); const runtime = createPhaseCombatTacticalRuntime({ state: { absNow: 110 } });
    assert.equal(runtime.applyCombatTacAttack(a, b, 9), 9); assert.deepEqual({ a, b }, before);
  }
});

await check('observer text distinguishes tactical movement from knockback', () => {
  const { a, b } = pair(); a.tacticalSkill = '붉은 폭풍'; const events = [];
  createPhaseCombatTacticalRuntime({ state: { absNow: 110 }, actions: {
    emitRunEvent: (kind, data) => events.push({ kind, ...data }),
  } }).applyCombatTacAttack(a, b, 0);
  const movement = events.find((event) => event.kind === 'spatial_displacement');
  assert.match(describeObserverEvent(movement), /틈 내부 전술 이동\(붉은 폭풍\) 2.5m/);
  assert.doesNotMatch(describeObserverEvent(movement), /넉백/);
});

console.log(`Rift tactical-movement checks: ${checks}`);
