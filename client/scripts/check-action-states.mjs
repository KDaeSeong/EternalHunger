import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';
const status = await import('../src/utils/statusLogic.js');
const { actor, effect, skill, runCombatScenario } = await import('./lib/run-combat-scenario.mjs');
const { applyCombatHit } = await import('../src/app/simulation/_lib/combatImpactRuntime.js');
const { calculateCombatDamage } = await import('../src/app/simulation/_lib/combatDamageRuntime.js');
const { resolveCombatWinnerOutcome } = await import('../src/app/simulation/_lib/phaseCombatDamageRuntime.js');
const { createPhaseCombatSkillSplashRuntime } = await import('../src/app/simulation/_lib/phaseCombatSkillSplashRuntime.js');
const { applyStatusEffect } = await import('../src/app/simulation/_lib/runtimeStatusApplication.js');
const { advanceSpatialMovement, planSpatialPatrol } = await import('../src/app/simulation/_lib/combatSpatialRuntime.js');
const { runDetonationTickPhase } = await import('../src/app/simulation/_lib/phaseDetonationTickRuntime.js');
const { runHuntAction } = await import('../src/app/simulation/_lib/phaseHuntActionRuntime.js');
const { getActionStatePresentation } = await import('../src/app/simulation/_lib/runtimeStatusDisplay.js');
const { describeObserverEvent } = await import('../src/app/simulation/_lib/teamObserverRuntime.js');
let checks = 0;
const failures = [];
const check = async (label, run) => {
  try { await run(); checks++; console.log(`PASS ${label}`); }
  catch (error) { failures.push(label); console.error(`FAIL ${label}`, error); }
};
const unit = (id, effects = [], extra = {}) => actor(id, { activeEffects: effects,
  _spatial: { zoneId: 'zone', x: 4, y: 4 },
  stats: { maxHp: 1000, attackPower: 100, defense: 0, attackSpeed: 1, attackRange: 2, sightRange: 24, moveSpeed: 4 }, ...extra });

await check('sleep stops movement, basics and skills', () => {
  const a = unit('a', [effect('수면', 2)]);
  assert.equal(status.canMoveByStatus(a), false);
  assert.equal(status.canBasicAttackByStatus(a), false);
  assert.equal(status.canUseSkillByStatus(a), false);
});
await check('polymorph allows slow walking but neither basics nor skills', () => {
  const a = unit('a', [effect('변이', 2)]);
  assert.equal(status.canMoveByStatus(a), true);
  assert.equal(status.canBasicAttackByStatus(a), false);
  assert.equal(status.canUseSkillByStatus(a), false);
  assert.equal(status.getMoveSpeedStatusBonus(a), -0.5);
});
await check('suppression stops all actions and is not shortened by duration resistance', () => {
  const a = unit('a', [effect('제압', 2)]);
  assert.equal(status.canMoveByStatus(a), false);
  assert.equal(status.canBasicAttackByStatus(a), false);
  assert.equal(status.canUseSkillByStatus(a), false);
  assert.equal(status.canReduceControlDuration(effect('제압', 2)), false);
});
await check('stasis blocks actions, new targeting and existing damage without being a CC', () => {
  const a = unit('a', [effect('경직', 2)]);
  assert.equal(status.canMoveByStatus(a), false);
  assert.equal(status.canBasicAttackByStatus(a), false);
  assert.equal(status.canUseSkillByStatus(a), false);
  assert.equal(status.isTargetableByStatus(a), false);
  assert.equal(status.getDamageBlockReason(null, a, { existingEffect: true }), 'invulnerable');
  assert.equal(status.isCrowdControlEffect(effect('경직', 2)), false);
});

await check('sleep damage preview is pure; the first actual attack wakes with a single bonus', async () => {
  const a = unit('a'); const b = unit('b', [effect('수면', 5)], { _actionReadyAtSec: 1e9 });
  const before = structuredClone(b);
  assert.equal(calculateCombatDamage(a, b, { critical: false }).damage, 100);
  assert.deepEqual(b, before);
  const result = await runCombatScenario([a, b], { duration: 1.25 });
  const hits = result.events.filter((e) => e.kind === 'damage' && e.who === 'a');
  assert.deepEqual(hits.map((e) => e.hpDamage), [120, 100]);
  assert.equal(result.events.filter((e) => e.kind === 'sleep_break').length, 1);
  assert.equal(result.frames.at(-1).roster.find((row) => row._id === 'b').hp, 780);
});
await check('one multi-packet basic plus tactical hit gets only one sleep bonus', () => {
  const a = unit('a'); const b = unit('b', [effect('수면', 5)]); const events = [];
  resolveCombatWinnerOutcome({ state: { actor: a, target: b, currentActionSec: () => 100, supportRoster: [a, b] },
    tactical: { applyCombatTacAttack: () => 20 }, actions: { emitRunEvent: (kind, data) => events.push({ kind, ...data }) } });
  assert.equal(b.hp, 860);
  assert.equal(events.filter((e) => e.kind === 'sleep_break').length, 1);
  assert.deepEqual(events.filter((e) => e.kind === 'damage').map((e) => e.hpDamage), [120, 20]);
});
await check('skill and true hits use the same wake commit, shields absorb bonus and no overkill is counted', () => {
  for (const type of ['skill', 'true']) {
    const b = unit('b', [effect('수면', 5), effect('보호막', 4, { shieldValue: 100 }), effect('침묵', 3)], { hp: 10 });
    const result = applyCombatHit(unit('a'), b, { type, damage: 100 });
    assert.equal(result.hpDamage, 10); assert.equal(result.absorbed, 100);
    assert.equal(b.hp, 0); assert.equal(result.packet.sleepBonusDamage, 20);
    assert.deepEqual(b.activeEffects.map((e) => e.name), ['침묵']);
  }
});
await check('fully absorbed hit wakes sleep while preserving the remaining shield', () => {
  const b = unit('b', [effect('수면', 5), effect('보호막', 4, { shieldValue: 200 })]);
  const result = applyCombatHit(unit('a'), b, { type: 'basic', damage: 100 });
  assert.equal(b.hp, 1000); assert.equal(result.absorbed, 120);
  assert.equal(status.getShieldValue(b), 80); assert.equal(status.canMoveByStatus(b), true);
});
await check('misses, immunity, zero damage and dead targets do not wake or consume shields', () => {
  for (const [attackerEffects, defenderEffects, damage, hp] of [
    [[effect('실명', 3)], [], 100, 1000], [[], [effect('회피', 3)], 100, 1000],
    [[], [effect('무적', 3)], 100, 1000], [[], [effect('경직', 3)], 100, 1000],
    [[], [effect('대상 지정 불가', 3)], 100, 1000], [[], [], 0, 1000], [[], [], 100, 0],
  ]) {
    const b = unit('b', [effect('수면', 5), effect('보호막', 5, { shieldValue: 200 }), ...defenderEffects], { hp });
    const result = applyCombatHit(unit('a', attackerEffects), b, { type: 'basic', damage });
    assert.equal(result.hpDamage, 0); assert.equal(b.hp, hp);
    assert.equal(b.activeEffects.some((e) => e.name === '수면'), true);
    assert.equal(status.getShieldValue(b), 200);
  }
});
await check('suppressed sleep does not wake and explicit zero or custom bonus survives JSON', () => {
  const ignored = unit('b', [effect('수면', 4), effect('저지 불가', 3)]);
  assert.equal(applyCombatHit(unit('a'), ignored, { type: 'basic', damage: 100 }).hpDamage, 100);
  assert.equal(ignored.activeEffects.some((e) => e.name === '수면'), true);
  for (const ratio of [0, 0.4]) {
    const b = JSON.parse(JSON.stringify(unit('b', [status.normalizeStatusEffect(effect('수면', 3, { wakeDamagePct: ratio }))])));
    assert.equal(applyCombatHit(unit('a'), b, { type: 'basic', damage: 100 }).hpDamage, 100 * (1 + ratio));
  }
});
await check('actual splash uses sleep wake and cannot damage a stasis target', () => {
  const a = unit('a'); const b = unit('b', [effect('수면', 3)]); const c = unit('c', [effect('경직', 3)]);
  const events = []; const splash = createPhaseCombatSkillSplashRuntime({
    state: { survivorMap: new Map([a, b, c].map((row) => [row._id, row])) },
    actions: { emitRunEvent: (kind, data) => events.push({ kind, ...data }) } });
  assert.equal(splash.applyCharacterSkillSplashDamage(a, [b, c].map((target) => ({ target, damage: 100, packet: { type: 'skill' } }))), 120);
  assert.equal(b.hp, 880); assert.equal(c.hp, 1000);
  assert.equal(events.filter((e) => e.kind === 'sleep_break').length, 1);
});
const motion = () => ({ zoneId: 'zone', x: 20, y: 4, stopRange: 0, reason: 'approach' });
await check('polymorph slow expires at the same fractional boundary in batched and split walking', () => {
  const initial = unit('a', [effect('변이', 0.5)], { _spatialMotion: motion() });
  const full = structuredClone(initial); advanceSpatialMovement([full], 100, 1);
  let split = structuredClone(initial);
  for (let i = 0; i < 4; i++) { advanceSpatialMovement([split], 100 + i * 0.25, 0.25); split = status.updateEffects(split, { elapsedSec: 0.25 }); }
  assert.equal(full._spatial.x, 7); assert.deepEqual(full._spatial, split._spatial);
});
await check('polymorph cannot consume wildlife or gain hunting rewards', () => {
  const nextSpawn = { untouched: true }; const before = structuredClone(nextSpawn); const a = unit('a', [effect('변이', 3)]);
  const result = runHuntAction({ state: { actor: a, nextSpawn }, actions: { grantMasteries: () => assert.fail('Hunting is blocked.') } });
  assert.equal(result.hunt, null); assert.deepEqual(nextSpawn, before);
});
await check('suppression cancels a stored movement instead of resuming it after expiry', () => {
  const a = unit('a', [], { _spatialMotion: motion() }); applyStatusEffect(a, effect('제압', 0.5));
  assert.equal(a._spatialMotion, null); assert.equal(planSpatialPatrol(a, 100), null);
  advanceSpatialMovement([a], 100, 1); assert.equal(a._spatial.x, 4);
  const restored = JSON.parse(JSON.stringify(unit('a', [effect('제압', 0.5)], { _spatialMotion: motion() })));
  advanceSpatialMovement([restored], 100, 1); assert.equal(restored._spatial.x, 4); assert.equal(restored._spatialMotion, null);
});
await check('ignored suppression lets walking continue until protection expires then discards motion', () => {
  const a = unit('a', [effect('저지 불가', 0.5)], { _spatialMotion: motion() });
  applyStatusEffect(a, effect('제압', 0.75)); assert.notEqual(a._spatialMotion, null);
  advanceSpatialMovement([a], 100, 1); assert.equal(a._spatial.x, 6); assert.equal(a._spatialMotion, null);
  const b = unit('b', [effect('모든 방해 면역', 2)], { _spatialMotion: motion() });
  assert.equal(applyStatusEffect(b, effect('제압', 1)).applied, false); assert.notEqual(b._spatialMotion, null);
});
await check('all four states cancel a real pending cast; immediate sleep wake does not revive that cast', async () => {
  for (const name of ['수면', '변이', '제압', '경직']) {
    let applied = false;
    const result = await runCombatScenario([actor('a', { characterSkills: { q: skill({ castDelaySec: 2, range: 10 }) } }), unit('b', [], { _actionReadyAtSec: 1e9 })],
      { duration: 1.5, onElapsed: (live, elapsed) => {
        if (applied || elapsed < 0.25) return; applied = true;
        const a = live.get('a'); assert.ok(a._pendingCharacterCast, 'A real cast must already be pending.');
        applyStatusEffect(a, effect(name, 3));
        if (name === '수면') applyCombatHit(live.get('b'), a, { type: 'basic', damage: 10 });
      } });
    assert.ok(result.events.some((e) => e.kind === 'skill_cancel' && e.who === 'a' && e.reason === 'status'), name);
    assert.equal(result.events.some((e) => e.kind === 'skill' && e.who === 'a'), false, name);
  }
});
const collarTick = (a, startActors = [a], extra = {}) => runDetonationTickPhase({ state: {
  updatedSurvivors: [a], intervalStartActors: startActors, forbiddenIds: new Set(['zone']),
  useDetonation: true, phaseStartSec: 100, phaseDurationSec: 1, tickSec: 0.25,
  ruleset: { detonation: { decreasePerSec: 1 } }, ...extra,
} });
await check('stasis pauses the collar only for its remaining fraction, unlike invulnerability', () => {
  for (const [name, expected] of [['경직', 9.5], ['무적', 9]]) {
    const initial = unit('a', [effect(name, 0.5)], { detonationSec: 10, gadgetEnergy: 0 });
    const end = status.updateEffects(initial, { elapsedSec: 1 });
    assert.equal(collarTick(end, [initial]).updatedSurvivors[0].detonationSec, expected);
  }
});
await check('safe zone and stasis overlap only once; split and batched collar clocks match', () => {
  const initial = unit('a', [effect('경직', 0.5)], { detonationSec: 10, safeZoneUntil: 100.75 });
  const full = collarTick(status.updateEffects(initial, { elapsedSec: 1 }), [initial]).updatedSurvivors[0];
  let split = structuredClone(initial);
  for (let i = 0; i < 4; i++) {
    split = collarTick(status.updateEffects(split, { elapsedSec: 0.25 }), [split],
      { phaseStartSec: 100 + i * 0.25, phaseDurationSec: 0.25 }).updatedSurvivors[0];
  }
  assert.equal(full.detonationSec, 9.75); assert.equal(split.detonationSec, 9.75);
});
await check('fully paused zero collar does not explode or activate gadgets; it expires afterward', () => {
  const a = unit('a', [effect('경직', 1)], { detonationSec: 0, gadgetEnergy: 100 });
  const result = collarTick(status.updateEffects(a, { elapsedSec: 1 }), [a]);
  assert.equal(result.newlyDead.length, 0); assert.equal(result.updatedSurvivors[0].gadgetEnergy, 100);
  assert.equal(collarTick({ ...result.updatedSurvivors[0], gadgetEnergy: 0 }).newlyDead.length, 1);
});
await check('stasis blocks existing DOT and final-zone damage only until the exact expiry', () => {
  const a = unit('a', [effect('경직', 0.5), effect('중독', 3, { dotDamage: 8 })]);
  const result = status.updateEffects(a, { elapsedSec: 1 });
  assert.equal(result.hp, 996);
  const zone = collarTick({ ...result, hp: 1000 }, [a], { useDetonation: false, suddenDeathActive: true });
  assert.equal(zone.updatedSurvivors[0].hp, 975);
  assert.equal(a.hp, 1000);
});
await check('expiry and cleansing release the new CC but not stasis; ongoing DOT is not a direct wake hit', () => {
  for (const name of ['수면', '변이', '제압']) {
    const a = unit('a', [effect(name, 0.5)]);
    assert.equal(status.canUseSkillByStatus(status.updateEffects(a, { elapsedSec: 0.5 })), true);
    assert.equal(status.purgeNegativeEffects(a, { removeAllNegative: true }).character.activeEffects.length, 0);
  }
  const stasis = unit('a', [effect('경직', 0.5)]);
  assert.equal(status.purgeNegativeEffects(stasis, { removeAllNegative: true }).character.activeEffects.length, 1);
  const sleep = status.updateEffects(unit('a', [effect('수면', 3), effect('중독', 3)]), { elapsedSec: 1 });
  assert.equal(sleep.hp, 992); assert.equal(status.canMoveByStatus(sleep), false);
});

await check('visible state reasons reflect active effects, never ignored or expired controls', () => {
  assert.equal(getActionStatePresentation(unit('a', [effect('변이', 2)])).polymorphed, true);
  assert.equal(getActionStatePresentation(unit('a', [effect('변이', 2), effect('저지 불가', 3)])).polymorphed, false);
  assert.equal(getActionStatePresentation(unit('a', [effect('경직', 0)])).collarPaused, false);
  assert.match(getActionStatePresentation(unit('a', [effect('경직', 2)])).text, /금지구역 카운트 정지/);
  assert.match(describeObserverEvent({ kind: 'sleep_break', who: 'a', by: 'b', bonusDamage: 20 }), /수면 해제.*20/);
});
await check('four-state actual combat is identical after JSON restore', async () => {
  const rows = [unit('a', [effect('수면', 3)]), unit('b'), unit('c', [effect('변이', 1.5)]),
    unit('d', [effect('제압', 1)]), unit('e', [effect('경직', 0.5)])];
  const first = await runCombatScenario(structuredClone(rows), { duration: 3.5 });
  const second = await runCombatScenario(JSON.parse(JSON.stringify(rows)), { duration: 3.5 });
  assert.deepEqual(second.events, first.events); assert.deepEqual(second.frames, first.frames);
});

console.log(`ACTION_STATES_CHECKS ${checks}/${checks + failures.length}`);
if (failures.length) process.exitCode = 1;
