import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';
const { actor, skill, effect, runCombatScenario } = await import('./lib/run-combat-scenario.mjs');
const rupture = extra => ({ version: 1, kind: 'rupture', delaySec: 0.8, cooldownSec: 8, radius: 2,
  damage: { base: 20, perLevel: 0, attackPowerRatio: 0, skillAmpRatio: 0 }, ...extra });
const gear = (id = 'rupture-gear', extra = {}) => ({ itemId: id, name: id, type: '무기', category: 'equipment',
  equipSlot: 'weapon', qty: 1, tier: 4, equipmentEffects: [rupture()], ...extra });
const caster = extra => actor('a', { inventory: [gear()], equipped: { weapon: 'rupture-gear' },
  characterSkills: { q: skill({ castDelaySec: 0.25, recoveryDelaySec: 0.25 }) }, ...extra });
const enemy = extra => actor('b', { _basicAttackReadyAtSec: 200, ...extra });
const procs = result => result.events.filter(event => event.kind === 'equipment_effect');
const hits = result => result.events.filter(event => event.kind === 'damage' && event.equipmentEffectId);
let checks = 0;
const check = async (name, fn) => { await fn(); checks++; console.log(`PASS ${name}`); };

await check('a real skill impact schedules one delayed equipment explosion on the shared action clock', async () => {
  const result = await runCombatScenario([caster(), enemy()]);
  assert.equal(procs(result).filter(row => row.stage === 'scheduled').length, 1);
  assert.deepEqual(hits(result).map(row => [row.at.sec, row.hpDamage]), [[101.05, 20]]);
  assert.equal(procs(result).find(row => row.stage === 'triggered').dueAtSec, 101.05);
  assert.ok(result.frames.filter(row => row.sec < 101.05).every(row => !row.roster[0]._equipmentEffectState?.resolvedCount));
});

await check('basic attacks and basic-damage enhancements cannot proc rupture', async () => {
  for (const characterSkills of [{}, { q: skill({ type: 'basic_attack_enhance', damageType: 'basic', castDelaySec: 0.25 }) }]) {
    const result = await runCombatScenario([caster({ characterSkills }), enemy()]);
    assert.equal(procs(result).length, 0);
  }
});
await check('shield-only skill impact triggers but invulnerability and wildlife do not', async () => {
  const shielded = await runCombatScenario([caster(), enemy({ activeEffects: [effect('보호막', 5, { shieldValue: 1000 })] })]);
  assert.equal(procs(shielded).filter(row => row.stage === 'scheduled').length, 1);
  assert.equal(hits(shielded)[0].hpDamage, 0); assert.equal(hits(shielded)[0].absorbed, 20);
  const immune = await runCombatScenario([caster(), enemy({ activeEffects: [effect('무적', 5)] })]);
  assert.equal(procs(immune).length, 0);
  const animal = await runCombatScenario([caster(), enemy({ _id: 'wildlife:test' })]);
  assert.equal(procs(animal).length, 0);
});
await check('a real area skill can proc on a secondary target when the primary is immune', async () => {
  const result = await runCombatScenario([caster({ characterSkills: { q: skill({ radius: 1, castDelaySec: 0.25 }) } }),
    enemy({ activeEffects: [effect('무적', 5)] }), actor('b2', { teamId: 'b', _basicAttackReadyAtSec: 200 })]);
  const scheduled = procs(result).filter(row => row.stage === 'scheduled');
  assert.equal(scheduled.length, 1); assert.equal(scheduled[0].targetId, 'b2');
  assert.deepEqual(hits(result).map(row => [row.targetId, row.hpDamage]), [['b', 0], ['b2', 20]]);
});
await check('duplicate equipped effects pick one strongest source and do not stack on an area hit', async () => {
  const extra = gear('rupture-head', { type: '방어구', equipSlot: 'head', equipmentEffects: [rupture({
    damage: { base: 60, perLevel: 0, attackPowerRatio: 0, skillAmpRatio: 0 } })] });
  const result = await runCombatScenario([caster({ inventory: [gear(), extra], equipped: { weapon: 'rupture-gear', head: 'rupture-head' },
    characterSkills: { q: skill({ radius: 1, castDelaySec: 0.25 }) } }), enemy(), actor('b2', { teamId: 'b', _basicAttackReadyAtSec: 200 })]);
  assert.equal(procs(result).filter(row => row.stage === 'scheduled').length, 1);
  assert.equal(procs(result)[0].itemId, 'rupture-head');
  assert.ok(hits(result).every(row => row.hpDamage === 60));
});
await check('empty slots and non-owned quantity cannot activate bag equipment', async () => {
  // The AI roster normalizer intentionally auto-equips a best item. Test the
  // hit boundary directly for an explicitly empty slot, not before that AI step.
  const { applyCombatHit } = await import('../src/app/simulation/_lib/combatImpactRuntime.js');
  const empty = caster({ equipped: { weapon: '' } });
  applyCombatHit(empty, enemy(), { type: 'skill', damage: 40 }, { at: { sec: 100 } });
  assert.equal(empty._equipmentEffectState, undefined);
  for (const qty of [0, -1, 0.5, NaN, true, null]) {
    const result = await runCombatScenario([caster({ inventory: [gear('rupture-gear', { qty })] }), enemy()]);
    assert.equal(procs(result).length, 0);
  }
});
await check('scheduled effects survive stun and unequip, and swapping cannot reset their shared cooldown', async () => {
  const result = await runCombatScenario([caster({ characterSkills: { q: skill({ cooldownSec: 1, castDelaySec: 0.25, recoveryDelaySec: 0.25 }) } }), enemy()],
    { onElapsed: (map, sec) => {
      if (sec === 0.5) {
        map.get('a').inventory = [gear('replacement')]; map.get('a').equipped.weapon = '';
        map.get('a').activeEffects = [effect('기절', 0.6)];
      }
      if (sec >= 1.1) map.get('a').equipped.weapon = 'replacement';
    } });
  assert.equal(procs(result).filter(row => row.stage === 'scheduled').length, 1);
  assert.equal(hits(result)[0].at.sec, 101.05);
  assert.equal(hits(result)[0].itemId, 'rupture-gear');
});
await check('phase boundary JSON preserves pending time and cooldown with no new cast or duplicate blast', async () => {
  const first = await runCombatScenario([caster(), enemy()], { duration: 1 });
  assert.equal(hits(first).length, 0);
  const rows = JSON.parse(JSON.stringify([...first.survivorMap.values()]));
  const next = await runCombatScenario(rows, { startSec: 101, duration: 2, engage: false });
  assert.deepEqual(hits(next).map(row => row.at.sec), [101.05]);
  assert.equal(procs(next).filter(row => row.stage === 'scheduled').length, 0);
  assert.equal(next.survivorMap.get('a')._equipmentEffectState.cooldowns.rupture.readyAtSec, 108.25);
});
await check('effects resolve exactly on a phase boundary, not a phase later', async () => {
  const result = await runCombatScenario([caster(), enemy()], { duration: 1.05 });
  assert.deepEqual(hits(result).map(row => row.at.sec), [101.05]);
  assert.equal(result.survivorMap.get('a')._equipmentEffectState.pending.length, 0);
});
for (const [reason, change] of [
  ['source_dead', map => { map.get('a').hp = 0; }],
  ['target_dead', map => { map.get('b').hp = 0; }],
  ['space_changed', map => { map.get('b')._combatSpaceId = 'dimension_rift:other'; }],
]) await check(`reserved explosion is cancelled once on ${reason}`, async () => {
  const result = await runCombatScenario([caster(), enemy()], { onElapsed: (map, sec) => { if (sec === 0.5) change(map); } });
  assert.equal(hits(result).length, 0);
  const cancelled = procs(result).filter(row => row.stage === 'cancelled');
  assert.equal(cancelled.length, 1); assert.equal(cancelled[0].reason, reason);
});
await check('delayed area follows target position and excludes allies, distant actors and another combat space', async () => {
  const extra = [actor('b2', { teamId: 'b', _basicAttackReadyAtSec: 200, _spatial: { zoneId: 'zone', x: 12, y: 12 } }),
    actor('far', { teamId: 'b', _basicAttackReadyAtSec: 200, _spatial: { zoneId: 'zone', x: 22, y: 22 } }),
    actor('ally', { teamId: 'a', _basicAttackReadyAtSec: 200, _spatial: { zoneId: 'zone', x: 12, y: 12 } }),
    actor('rift', { teamId: 'b', _combatSpaceId: 'dimension_rift:elsewhere', _basicAttackReadyAtSec: 200 })];
  const result = await runCombatScenario([caster(), enemy(), ...extra], { onElapsed: (map, sec) => {
    if (sec === 0.5) { map.get('b')._spatial = { zoneId: 'zone', x: 12, y: 12 }; map.get('b')._spatialMotion = null; }
  } });
  assert.deepEqual(hits(result).map(row => row.targetId), ['b', 'b2']);
  assert.equal(procs(result).find(row => row.stage === 'triggered').centerPosition.x, 12);
});
await check('equipment damage uses defense and actual HP, contribution, elimination and health observations', async () => {
  const result = await runCombatScenario([caster({ inventory: [gear('rupture-gear', { equipmentEffects: [rupture({
    damage: { base: 100, perLevel: 0, attackPowerRatio: 0, skillAmpRatio: 0 } })] })] }),
    enemy({ hp: 62, maxHp: 62, stats: { defense: 100, attackPower: 1, attackSpeed: 1 } })]);
  const hit = hits(result)[0];
  assert.equal(hit.raw, 100); assert.equal(hit.appliedDefense, 100); assert.equal(hit.damage, 50);
  assert.ok(hit.hpDamage < hit.damage); assert.equal(hit.hpAfter, 0);
  assert.equal(result.roundKills.a, 1); assert.ok(result.newDeadIds.includes('b'));
  const battle = result.events.find(row => row.kind === 'battle' && row.equipmentEffectId);
  assert.equal(battle.damage, hit.hpDamage); assert.equal(battle.lethal, true);
  assert.equal(result.events.filter(row => row.kind === 'elimination' && row.reason === 'equipment_effect').length, 1);
  assert.equal(procs(result).filter(row => row.stage === 'scheduled').length, 1, 'no recursive proc');
});
await check('duplicate impact callbacks and JSON reload cannot repeat a reservation or resolved blast', async () => {
  const { recordEquipmentSkillImpact } = await import('../src/app/simulation/_lib/equipmentEffectRuntime.js');
  const { resolveEquipmentEffectDamage } = await import('../src/app/simulation/_lib/equipmentEffectDamageRuntime.js');
  const a = caster(), b = enemy();
  const impact = { packet: { type: 'skill', damage: 40, castId: 'a:1' }, hpBefore: 1000, hpAfter: 960, hpDamage: 40, absorbed: 0 };
  const first = recordEquipmentSkillImpact(a, b, impact, { at: { sec: 100 } });
  assert.ok(first); assert.equal(recordEquipmentSkillImpact(a, b, impact, { at: { sec: 100 } }), null);
  const rows = JSON.parse(JSON.stringify([a, b])), map = new Map(rows.map(row => [row._id, row]));
  const before = JSON.stringify(rows);
  const options = { actor: map.get('a'), survivorMap: map, effectId: first.id, nowSec: 100.79 };
  assert.equal(resolveEquipmentEffectDamage(options).performed, false); assert.equal(JSON.stringify(rows), before);
  options.nowSec = 100.8; assert.equal(resolveEquipmentEffectDamage(options).performed, true);
  const after = JSON.stringify(rows);
  assert.equal(resolveEquipmentEffectDamage(options).performed, false); assert.equal(JSON.stringify(rows), after);
});
await check('a stale equipment slot cannot proc an item classified as a material', async () => {
  const { applyCombatHit } = await import('../src/app/simulation/_lib/combatImpactRuntime.js');
  const a = caster({ inventory: [gear('rupture-gear', { type: '재료' })] });
  applyCombatHit(a, enemy(), { type: 'skill', damage: 40 }, { at: { sec: 100 } });
  assert.equal(a._equipmentEffectState, undefined);
});
await check('unequipping every item preserves an already queued effect and its original source', async () => {
  const { recordEquipmentSkillImpact } = await import('../src/app/simulation/_lib/equipmentEffectRuntime.js');
  const { resolveEquipmentEffectDamage } = await import('../src/app/simulation/_lib/equipmentEffectDamageRuntime.js');
  const a = caster(), b = enemy(), map = new Map([['a', a], ['b', b]]), events = [];
  const pending = recordEquipmentSkillImpact(a, b, { packet: { type: 'skill', castId: 'a:1' }, hpBefore: 1000, hpDamage: 40 }, { at: { sec: 100 } });
  a.inventory = []; a.equipped = {};
  // Ordinary zone movement is not a different combat space. Follow the target.
  b.zoneId = 'remote'; b._spatial = { zoneId: 'remote', x: 10, y: 10 };
  const result = resolveEquipmentEffectDamage({ actor: a, effectId: pending.id, survivorMap: map, nowSec: 100.8,
    actions: { emitRunEvent: (kind, payload) => events.push({ kind, ...payload }) } });
  assert.equal(result.performed, true); assert.equal(result.damage, 20);
  assert.equal(events.find(row => row.stage === 'triggered').itemId, 'rupture-gear');
  assert.equal(events.find(row => row.kind === 'damage').zoneId, 'remote');
  assert.equal(a._equipmentEffectState.cooldowns.rupture.readyAtSec, 108);
});
await check('revival drops old pending effects without resetting cooldown or mutating the corpse snapshot', async () => {
  const { recordEquipmentSkillImpact } = await import('../src/app/simulation/_lib/equipmentEffectRuntime.js');
  const { normalizeRevivedSurvivor } = await import('../src/app/simulation/_lib/survivorLifecycleRuntime.js');
  const a = caster();
  recordEquipmentSkillImpact(a, enemy(), { packet: { type: 'skill', castId: 'a:1' }, hpBefore: 1000, hpDamage: 40 }, { at: { sec: 100 } });
  a.hp = 0; const before = JSON.stringify(a);
  const revived = normalizeRevivedSurvivor(a, 50, 'zone', 1, {}, 100.5);
  assert.equal(revived.hp, 50); assert.deepEqual(revived._equipmentEffectState.pending, []);
  assert.equal(revived._equipmentEffectState.cooldowns.rupture.readyAtSec, 108);
  assert.equal(JSON.stringify(a), before);
});
await check('a fresh match clears prior equipment reservations and shared cooldowns', async () => {
  const { buildInitialSimulationRoster } = await import('../src/app/simulation/_lib/simulationInitialRosterRuntime.js');
  const { buildGuestSimulationRoster, buildGuestSimulationMap } = await import('../src/app/simulation/_lib/guestSimulationBootstrap.js');
  // Match initialization uses the real 24-player squad selection boundary.
  const roster = buildGuestSimulationRoster().map(row => ({ ...row, _equipmentEffectState: {
    pending: [{ id: `${row._id}:old` }], cooldowns: { rupture: { readyAtSec: 999 } }, sequence: 9,
  } }));
  const initialMap = buildGuestSimulationMap(), before = JSON.stringify(roster);
  const result = buildInitialSimulationRoster({ charList: roster, initialMap,
    initialZoneIds: initialMap.zones.map(zone => zone.zoneId), routeItems: [] });
  assert.equal(result.shuffledChars.length, 24);
  assert.ok(result.shuffledChars.every(row => row._equipmentEffectState === undefined));
  assert.equal(JSON.stringify(roster), before);
});
await check('failing equipment notifications report errors only after every area hit has settled', async () => {
  const { recordEquipmentSkillImpact } = await import('../src/app/simulation/_lib/equipmentEffectRuntime.js');
  const { resolveEquipmentEffectDamage } = await import('../src/app/simulation/_lib/equipmentEffectDamageRuntime.js');
  const a = caster(), b = enemy(), c = enemy({ _id: 'c' });
  const survivorMap = new Map([['a', a], ['b', b], ['c', c]]), observed = [], mastery = [];
  const pending = recordEquipmentSkillImpact(a, b, { packet: { type: 'skill', castId: 'a:1' }, hpBefore: 1000, hpDamage: 40 }, { at: { sec: 100 } });
  let failure;
  try {
    resolveEquipmentEffectDamage({ actor: a, effectId: pending.id, survivorMap, nowSec: 100.8,
      actions: { emitRunEvent: (kind) => { observed.push(kind); throw new Error(`observer:${kind}`); },
        addLog: () => { throw new Error('observer:log'); },
        grantPvpDamageMastery: (row, payload) => mastery.push([row._id, payload]),
      } });
  } catch (error) { failure = error; }
  assert.equal(b.hp, 980); assert.equal(c.hp, 980);
  assert.equal(a._equipmentEffectState.pending.length, 0);
  assert.equal(a._equipmentEffectState.resolvedCount, 1);
  assert.equal(b.lastDamagedBy, 'a'); assert.equal(c.lastDamagedBy, 'a');
  assert.equal(mastery.length, 4);
  assert.deepEqual(observed, ['equipment_effect', 'damage', 'battle', 'damage', 'battle']);
  assert.ok(failure instanceof AggregateError);
  assert.equal(failure.errors.length, 7);
  const beforeRetry = JSON.stringify([...survivorMap.values()]);
  assert.equal(resolveEquipmentEffectDamage({ actor: a, effectId: pending.id, survivorMap, nowSec: 101 }).performed, false);
  assert.equal(JSON.stringify([...survivorMap.values()]), beforeRetry);
});
await check('the actual encounter settles both lethal hits and loot before reporting observer failures', async () => {
  const { recordEquipmentSkillImpact } = await import('../src/app/simulation/_lib/equipmentEffectRuntime.js');
  const { runPhaseCombatEncounter } = await import('../src/app/simulation/_lib/phaseCombatEncounterRuntime.js');
  const a = caster({ simCredits: 0 }), b = enemy({ hp: 10, simCredits: 100 }), c = enemy({ _id: 'c', hp: 10, simCredits: 100 });
  const survivorMap = new Map([['a', a], ['b', b], ['c', c]]), newDeadIds = [], roundKills = {}, events = [];
  const pending = recordEquipmentSkillImpact(a, b, { packet: { type: 'skill', castId: 'a:1' }, hpBefore: 10, hpDamage: 1 }, { at: { sec: 100 } });
  const state = { actor: a, target: b, survivorMap, newDeadIds, roundKills,
    actionType: 'equipment_effect', equipmentEffectId: pending.id, currentActionSec: () => 100.8 };
  const actions = { atNow: () => ({ sec: 100.8 }),
    emitRunEvent: (kind, payload) => { events.push({ kind, ...payload }); throw new Error(`observer:${kind}`); },
    addLog: () => { throw new Error('observer:log'); },
    emitDeathRunEventOnce: () => { throw new Error('observer:death'); },
    flushDeadSnapshots: () => { throw new Error('observer:snapshot'); },
  };
  assert.throws(() => runPhaseCombatEncounter({ state, actions }), AggregateError);
  assert.equal(b.hp, 0); assert.equal(c.hp, 0);
  assert.deepEqual(newDeadIds, ['b', 'c']); assert.equal(roundKills.a, 2);
  assert.equal(a.simCredits, 70); assert.equal(b.simCredits, 65); assert.equal(c.simCredits, 65);
  assert.equal(events.filter(row => row.kind === 'elimination').length, 2);
  assert.equal(events.filter(row => row.kind === 'gain').length, 2);
  assert.equal(runPhaseCombatEncounter({ state, actions }).performed, false);
  assert.equal(roundKills.a, 2); assert.equal(a.simCredits, 70);
});
await check('equipment notification isolation does not swallow a domain settlement error', async () => {
  const { recordEquipmentSkillImpact } = await import('../src/app/simulation/_lib/equipmentEffectRuntime.js');
  const { resolveEquipmentEffectDamage } = await import('../src/app/simulation/_lib/equipmentEffectDamageRuntime.js');
  const a = caster(), b = enemy(), survivorMap = new Map([['a', a], ['b', b]]);
  const pending = recordEquipmentSkillImpact(a, b, { packet: { type: 'skill', castId: 'a:1' }, hpBefore: 1000, hpDamage: 40 }, { at: { sec: 100 } });
  const domainFailure = new Error('mastery computation failed');
  assert.throws(() => resolveEquipmentEffectDamage({ actor: a, effectId: pending.id, survivorMap, nowSec: 100.8,
    actions: { grantPvpDamageMastery: () => { throw domainFailure; } } }), error => error === domainFailure);
});
console.log(`EQUIPMENT_EFFECT_COMBAT_CHECKS ${checks}`);
