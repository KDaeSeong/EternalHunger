import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';
const { getCombatStats, calculateCombatDamage, applyCombatDamageLifesteal } = await import('../src/app/simulation/_lib/combatDamageRuntime.js');
const { resolveCombatWinnerOutcome } = await import('../src/app/simulation/_lib/phaseCombatDamageRuntime.js');
const { runPhaseCombatEncounter } = await import('../src/app/simulation/_lib/phaseCombatEncounterRuntime.js');
const { applyCharacterSkillOnBasicAttack } = await import('../src/app/simulation/_lib/characterSkillRuntime.js');
const { getEffectiveStats } = await import('../src/utils/statusLogic.js');
const { normalizeRuntimeSurvivor } = await import('../src/app/simulation/_lib/survivorRuntime.js');
const { createSeedRng } = await import('../src/app/simulation/_lib/randomSeedRuntime.js');
const { withSimulationRandom } = await import('../src/utils/simulationRandom.js');
const { applyErWeaponSkillAfterCombat } = await import('../src/app/simulation/_lib/combatRuntime.js');
const { createPhaseCombatTacticalRuntime } = await import('../src/app/simulation/_lib/phaseCombatTacticalRuntime.js');
const { getEquipStatTotals } = await import('../src/utils/battleEquipmentLogic.js');
const { addItemToInventory, normalizeInventory } = await import('../src/app/simulation/_lib/inventoryRules.js');
const { GUEST_ITEM_CATALOG } = await import('../src/app/simulation/_generated/guestItemCatalog.generated.js');
const actor = (id = 'a', stats = {}, extra = {}) => ({ _id: id, name: id, teamId: id, zoneId: 'zone', hp: 1000, maxHp: 1000,
  _spatial: { zoneId: 'zone', x: 4, y: 4 },
  inventory: [], stats: { maxHp: 1000, attackPower: 100, defense: 0, skillAmp: 0, attackSpeed: 0.72, ...stats },
  tacticalSkill: 'none', ...extra });
const gear = (id, stats, tier = 1) => ({ itemId: id, type: 'weapon', equipSlot: 'weapon', tier, stats });
let checks = 0;
const check = (name, fn) => { withSimulationRandom(createSeedRng('damage-check'), fn); checks++; console.log(`PASS ${name}`); };
check('zero bonuses and fractional speed remain neutral after full actor normalization', () => {
  const a = normalizeRuntimeSurvivor(actor('a', { armorPenFlat: 25, critChance: 0.25 }));
  const s = getEffectiveStats(a);
  assert.equal(s.attackSpeed, 0.72); assert.equal(s.damageIncrease, 0); assert.equal(s.critChance, 0.25);
  assert.equal(s.armorPenFlat, 25); assert.equal(calculateCombatDamage(actor(), actor('b')).damage, 100);
});
check('defense divides both basic and skill damage by 100 plus defense', () => {
  const b = actor('b', { defense: 100 });
  assert.equal(calculateCombatDamage(actor(), b).damage, 50);
  assert.equal(calculateCombatDamage(actor(), b, { type: 'skill', baseDamage: 100 }).damage, 50);
});
check('percentage penetration precedes flat penetration and defense cannot go negative', () => {
  const a = actor('a', { armorPen: 0.25, armorPenFlat: 25 });
  const hit = calculateCombatDamage(a, actor('b', { defense: 100 }));
  assert.equal(hit.appliedDefense, 50); assert.equal(hit.damage, 67);
  assert.equal(calculateCombatDamage(actor('a', { armorPenFlat: 500 }), actor('b', { defense: 100 })).damage, 100);
});
check('critical is 175 percent and does not amplify ordinary skills', () => {
  const a = actor('a', { critChance: 1, basicAttackAmp: 0.2 });
  assert.equal(calculateCombatDamage(a, actor('b')).damage, 210);
  assert.equal(calculateCombatDamage(a, actor('b'), { type: 'skill', baseDamage: 100 }).damage, 100);
  assert.equal(calculateCombatDamage(actor(), actor('b'), { critical: true }).damage, 175);
});
check('damage categories, final percentage and flat addition are ordered explicitly', () => {
  const a = actor('a', { damageIncrease: 0.2, basicAttackAmp: 0.2, finalDamageIncrease: 0.2, finalDamageFlat: 3 });
  const b = actor('b', { damageReduction: 0.1, basicDamageReduction: 0.1, skillDamageReduction: 0.5 });
  assert.equal(calculateCombatDamage(a, b).damage, 148);
  assert.equal(calculateCombatDamage(a, b, { type: 'skill', baseDamage: 100 }).damage, 69);
  assert.equal(calculateCombatDamage(a, b, { type: 'skill', baseDamage: 0 }).damage, 0);
});
check('amplification floors, total skill reduction, and true damage have separate semantics', () => {
  const b = actor('b', { defense: 500, damageReduction: 1, skillDamageReduction: 1 });
  assert.equal(calculateCombatDamage(actor(), b, { type: 'skill', baseDamage: 100 }).damage, 0);
  assert.equal(calculateCombatDamage(actor(), actor('b', { damageReduction: 1 })).damage, 10);
  assert.equal(calculateCombatDamage(actor(), b, { type: 'true', baseDamage: 100 }).damage, 100);
});
check('critical damage reduction affects critical basics but not skills', () => {
  const b = actor('b', { criticalDamageReduction: 0.4 });
  assert.equal(calculateCombatDamage(actor(), b, { critical: true }).damage, 105);
  assert.equal(calculateCombatDamage(actor(), b, { type: 'skill', baseDamage: 100 }).damage, 100);
});
check('adaptive compares additional attack with amp, not base attack or weapon identity', () => {
  const a = actor('a', { attackPower: 500, skillAmp: 30 }, { weaponType: '권총', inventory: [gear('w', { atk: 20, adaptiveForce: 10 })] });
  assert.equal(getCombatStats(a).adaptiveTarget, 'skillAmp'); assert.equal(getCombatStats(a).skillAmp, 50);
  a.characterSkills = { passive: { enabled: true, statModifiers: { attackPower: 30 } } };
  a.weaponType = '아르카나';
  assert.equal(getCombatStats(a).adaptiveTarget, 'attackPower'); assert.equal(getCombatStats(a).attackPower, 560);
});
check('only equipped items contribute, without spare, empty-slot or duplicate-slot bonuses', () => {
  const a = actor('a', {}, { inventory: [gear('w', { atk: 10 }), gear('spare', { atk: 999 }, 5)], equipped: { weapon: 'w' } });
  assert.equal(getCombatStats(a).attackPower, 110);
  a.equipped.head = 'w'; assert.equal(getCombatStats(a).attackPower, 110);
  a.equipped = { weapon: null }; assert.equal(getCombatStats(a).attackPower, 100);
});
check('lifesteal distinguishes basic, skill, area and wildlife damage', () => {
  const run = (opts) => applyCombatDamageLifesteal(actor('a', { lifesteal: 0.2, omnisyphon: 0.1 }, { hp: 100 }), 100, opts);
  assert.equal(run({ type: 'basic' }), 30); assert.equal(run({ type: 'skill' }), 10);
  assert.equal(run({ type: 'skill', area: true }), 5);
  assert.equal(run({ type: 'basic', area: true, targetKind: 'wildlife' }), 9);
  assert.equal(applyCombatDamageLifesteal(actor('a', { lifesteal: 1 }, { hp: 0 }), 100), 0);
});
const hit = (a, b, extra = {}, tactical = {}, actions = {}) => {
  const events = []; let eliminated = 0;
  resolveCombatWinnerOutcome({ state: { actor: a, target: b, nextDay: 1, currentActionSec: () => 100,
    pvpCfg: { criticalFleeHpBelow: 0 }, battleSettings: { skills: { characterSkills: true } }, ...extra }, tactical,
    actions: { emitRunEvent: (kind, data) => events.push({ kind, ...data }), ...actions },
    combatElimination: { applyCombatElimination: () => eliminated++ } });
  return { a, b, events, eliminated };
};
check('production hit ignores the legacy winner, score, date and execution-lottery settings', () => {
  const first = hit(actor(), actor('b', { defense: 100 }));
  const second = hit(actor(), actor('b', { defense: 100 }), { nextDay: 99, battleResult: { winner: { _id: 'b' } },
    estimatePower: () => { throw new Error('Damage must not use estimated power.'); },
    pvpCfg: { damageBase: 999, damageDayScale: 999, earlyLethalFinishMax: 1, earlyLethalFinishChanceBase: 1, criticalFleeHpBelow: 0 } });
  assert.equal(first.b.hp, 950); assert.equal(second.b.hp, 950);
  assert.deepEqual(first.events, second.events); assert.equal(first.events[0].appliedDefense, 100);
});
check('production damage grants no shield or overkill lifesteal and counts a single real death', () => {
  const f = hit(actor('a', { lifesteal: 1 }, { hp: 100 }), actor('b', {}, { hp: 10 }));
  assert.equal(f.a.hp, 110); assert.equal(f.b.hp, 0); assert.equal(f.eliminated, 1);
  assert.equal(f.events.find((event) => event.kind === 'damage').hpDamage, 10);
  const shielded = hit(actor('a', { lifesteal: 1 }, { hp: 100 }), actor('b'), {}, { shieldBlock: () => 0 });
  assert.equal(shielded.a.hp, 100); assert.equal(shielded.b.hp, 1000);
});
check('a survivor with one HP remaining is not executed by a lottery', () => {
  const f = hit(actor(), actor('b', {}, { hp: 101 }), { pvpCfg: { criticalFleeHpBelow: 0,
    earlyLethalFinishHpBelow: 999, earlyLethalFinishMax: 1, earlyLethalFinishChanceBase: 1 } });
  assert.equal(f.b.hp, 1); assert.equal(f.eliminated, 0);
});
check('legacy generated gear retains its hundredths unit in skill coefficients', () => {
  const a = actor('a', {}, { inventory: [gear('wpn_legacy', { atk: 20, skillAmp: 0.5 })], characterSkills: {
    q: { enabled: true, name: 'test', type: 'attack_skill', flatDamage: [10], attackPowerScale: 0.5, skillAmpScale: 1, cooldownSec: 10 },
  } });
  const out = applyCharacterSkillOnBasicAttack(a, actor('b', { defense: 100 }), 10, { nowSec: 100 });
  assert.equal(out.extraDamage, 60); assert.equal(out.damage, 70);
  assert.equal(out.results[0].packet.raw, 120); assert.equal(out.results[0].packet.damage, 60);
});
check('catalog amp is an additive stat, not one hundred times its displayed value', () => {
  const item = GUEST_ITEM_CATALOG.find((entry) => entry._id === 'namu:기타:천국의 계단');
  assert.equal(item.stats.skillAmp, 68);
  const a = actor('a', { skillAmp: 12 }, { inventory: [{ ...structuredClone(item), itemId: item._id }], characterSkills: {
    q: { enabled: true, name: 'controlled-amp-case', type: 'attack_skill', flatDamage: [10],
      currentHpPct: [20], skillAmpScale: 0.5, cooldownSec: 10 },
  } });
  const b = actor('b', { defense: 38 }, { hp: 148, maxHp: 148 });
  const before = structuredClone(a.inventory);
  const out = applyCharacterSkillOnBasicAttack(a, b, 0, { nowSec: 100 });
  assert.equal(getCombatStats(a).skillAmp, 80);
  assert.equal(out.results[0].packet.raw, 80); // 10 + round(148 * .2) + (12 + 68) * .5
  assert.equal(out.results[0].packet.damage, 58);
  assert.deepEqual(a.inventory, before, 'Reading units must not rewrite saved item stats.');
});
check('custom fractional and string amp values are points, without a size heuristic', () => {
  for (const [value, expected] of [[0.5, 12.5], [1, 13], ['68', 80], [0, 12], [undefined, 12], ['bad', 12]]) {
    const a = actor('a', { skillAmp: 12 }, { inventory: [gear('custom-item', { skillAmp: value })] });
    assert.equal(getCombatStats(a).skillAmp, expected);
  }
});
check('persisted generated ids retain legacy units across inventory and JSON round trips', () => {
  for (const identity of [{ itemKey: 'wpn_old' }, { externalId: 'eq_old' }]) {
    const item = { _id: 'database-id', ...identity, type: 'weapon', equipSlot: 'weapon', tier: 2, stats: { skillAmp: 0.5 } };
    const inventory = normalizeInventory(JSON.parse(JSON.stringify(addItemToInventory([], item, item._id, 1, 1, {}))), {});
    assert.equal(getCombatStats(actor('a', {}, { inventory, equipped: { weapon: 'database-id' } })).skillAmp, 50);
  }
});
check('legacy equipment score totals convert each item before summing mixed units', () => {
  const items = [gear('catalog', { skillAmp: 68 }), { ...gear('eq_old', { skillAmp: 0.2 }), equipSlot: 'head' }];
  const a = actor('a', {}, { inventory: items });
  assert.equal(getCombatStats(a).skillAmp, 88);
  assert.ok(Math.abs(getEquipStatTotals(a).skillAmp - 0.88) < 1e-10);
});
check('high point-based amp is not silently capped by the legacy score range in real damage', () => {
  const a = actor('a', {}, { inventory: [gear('custom-large', { skillAmp: 500 })] });
  assert.equal(getCombatStats(a).skillAmp, 500);
});
check('basic-type enhancements inherit the parent crit without another random draw', () => {
  const a = actor('a', {}, { characterSkills: { q: { enabled: true, name: 'enhance', type: 'basic_attack_enhance',
    damageType: 'basic', flatDamage: [100], cooldownSec: 10 } } });
  const result = applyCharacterSkillOnBasicAttack(a, actor('b'), 175, { nowSec: 100, basicCritical: true });
  assert.equal(result.extraDamage, 175);
});
check('actual encounter never selects a winner first or lets a killed target counterattack', () => {
  const a = actor('a'); const b = actor('b', { attackPower: 9999 }, { hp: 50 });
  const survivorMap = new Map([[a._id, a], [b._id, b]]);
  const events = [];
  runPhaseCombatEncounter({ state: { actor: a, target: b, survivorMap, currentActionSec: () => 100,
    nextDay: 2, ruleset: { ai: { escapeHpBelow: 0 }, pvp: { criticalFleeHpBelow: 0, teamCombatEnabled: false } },
    pickUnbiasedBattle: () => { throw new Error('The live encounter must not call the outcome lottery.'); } },
    actions: { emitRunEvent: (kind, data) => events.push({ kind, ...data }) } });
  assert.equal(b.hp, 0); assert.equal(a.hp, 1000);
  assert.ok(!events.some((event) => event.kind === 'damage' && event.who === 'b'));
});
check('dead or stunned actors cannot emit a damage packet', () => {
  const dead = hit(actor('a', {}, { hp: 0 }), actor('b'));
  const stunned = hit(actor('a', {}, { activeEffects: [{ name: '기절', remainingDuration: 10, durationUnit: 'sec' }] }), actor('b'));
  assert.equal(dead.events.length, 0); assert.equal(stunned.events.length, 0);
});
check('weapon follow-ups also apply skill defense and fully consumed shields stay at zero damage', () => withSimulationRandom(() => 0, () => {
  const run = (defense, shield) => {
    const a = actor('a', {}, { weaponType: '권총', weaponMasteryLevel: 10 });
    const b = actor('b', { defense }); const events = [];
    const result = applyErWeaponSkillAfterCombat(a, b, { damageDealt: 100, nowSec: 100,
      ...(shield ? { shieldBlock: () => 0 } : {}), emitRunEvent: (kind, payload) => events.push({ kind, ...payload }) });
    return { result, b, events };
  };
  const open = run(0, false); const armor = run(100, false); const shield = run(100, true);
  assert.ok(open.result.damage > 0); assert.equal(armor.result.damage, Math.round(open.result.damage / 2));
  assert.equal(shield.result.damage, 0); assert.equal(shield.b.hp, 1000);
  assert.equal(armor.events.find((event) => event.kind === 'damage').appliedDefense, 100);
}));
check('weapon follow-up lifesteal preserves the wildlife multiplier and actual HP removal', () => withSimulationRandom(() => 0, () => {
  const run = (targetKind, targetHp = 1000, shield = false) => {
    const a = actor('a', { omnisyphon: 0.5 }, { hp: 100, weaponType: '권총', weaponMasteryLevel: 10 });
    const b = actor('b', {}, { hp: targetHp });
    const result = applyErWeaponSkillAfterCombat(a, b, { damageDealt: 100, nowSec: 100, targetKind,
      ...(shield ? { shieldBlock: () => 0 } : {}) });
    return { result, healed: a.hp - 100, removed: targetHp - b.hp };
  };
  const experiment = run('experiment'); const wildlife = run('wildlife');
  assert.ok(wildlife.removed > 0); assert.equal(wildlife.removed, experiment.removed);
  // The established modifier floors each packet's healing after the multiplier.
  assert.equal(experiment.healed, Math.floor(experiment.removed * 0.5));
  assert.equal(run(undefined).healed, experiment.healed, 'Unspecified targets retain the ordinary PvP default.');
  assert.equal(wildlife.healed, Math.floor(wildlife.removed * 0.5 * 0.6), 'Weapon skill damage against wildlife must use the same 60% heal multiplier.');
  const overkill = run('wildlife', 4); const shielded = run('wildlife', 1000, true);
  assert.equal(overkill.removed, 4); assert.equal(overkill.healed, 1);
  assert.equal(shielded.removed, 0); assert.equal(shielded.healed, 0);
}));
check('the live hit passes its target kind through to the real weapon follow-up', () => withSimulationRandom(() => 0, () => {
  const a = actor('hunter', { omnisyphon: 0.5 }, { hp: 100, weaponType: '권총', weaponMasteryLevel: 10 });
  const b = actor('wildlife:test');
  const result = hit(a, b, { targetKind: 'wildlife' }, {}, { applyErWeaponSkillAfterCombat });
  const packets = result.events.filter(event => event.kind === 'damage');
  assert.equal(packets.length, 2, 'Exercise the basic hit and the actual weapon skill, not a mock callback.');
  const expectedHeal = packets.reduce((sum, packet) => sum + Math.floor(packet.hpDamage * 0.5 * 0.6), 0);
  assert.equal(a.hp - 100, expectedHeal);
}));
check('a tactical shield consuming the whole hit does not restore the original incoming damage', () => {
  const b = actor('b', {}, { tacticalSkill: '초월', tacticalSkillLevel: 2 });
  const { shieldBlock } = createPhaseCombatTacticalRuntime({ state: { absNow: 100 } });
  assert.equal(shieldBlock(b, 10), 0);
});
console.log(`COMBAT_DAMAGE_CHECKS ${checks}/${checks}`);
