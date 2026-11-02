import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';
import statContract from '../../shared/equipmentStatContract.cjs';
import namuStats from '../../server/utils/namuItemStats.js';
import { GUEST_ITEM_CATALOG } from '../src/app/simulation/_generated/guestItemCatalog.generated.js';
import { calculateCombatDamage, getCombatStats } from '../src/app/simulation/_lib/combatDamageRuntime.js';
import { getBasicAttackIntervalSec } from '../src/app/simulation/_lib/combatTimingRuntime.js';
import { getSpatialStats } from '../src/app/simulation/_lib/combatSpatialRuntime.js';
import { synchronizeEquipmentHealth } from '../src/utils/equipmentHealth.js';
import { normalizeRuntimeSurvivor } from '../src/app/simulation/_lib/survivorRuntime.js';
import { buildGuestSimulationRoster, loadGuestSimulationItemCatalog } from '../src/app/simulation/_lib/guestSimulationBootstrap.js';
import { getCharacterSkillDef } from '../src/app/simulation/_lib/characterSkillDefinitionRuntime.js';
import { applyGuestCharacterProfiles } from '../src/app/simulation/_lib/guestCharacterProfileRuntime.js';
import { getCombatPowerBreakdown } from '../src/app/simulation/_lib/combatPowerEstimateRuntime.js';
import { createEquipmentSuitabilityEvaluator } from '../src/app/simulation/_lib/equipmentSuitabilityRuntime.js';
import { addItemToInventory } from '../src/app/simulation/_lib/inventoryRules.js';
import { applyStartingPassiveHealth } from '../src/utils/characterPassiveStats.js';
import { actor, runCombatScenario } from './lib/run-combat-scenario.mjs';

let checks = 0;
async function check(name, run) { await run(); checks++; console.log(`PASS ${name}`); }
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} != ${b}`);
const catalog = GUEST_ITEM_CATALOG;
const agni = catalog.find(item => item._id === 'namu:돌격소총:아그니');

await check('new imports preserve fractional percent, spaced aliases and per-level points', () => {
  const stats = namuStats.parseNamuItemStats({ '공격 속도': '0.5%', 최대체력: '120', 레벨당최대체력: '20~400',
    '치명타 확률': '24%', 모든피해흡혈: '8%', 생명력흡수: '6%', 이동속도: '0.25' });
  assert.equal(stats.atkSpeed, 0.005); assert.equal(stats.hp, 120); assert.equal(stats.hpPerLevel, 20);
  assert.equal(stats.critChance, 0.24); assert.equal(stats.omnisyphon, 0.08); assert.equal(stats.lifesteal, 0.06);
  assert.equal(stats.moveSpeedFlat, 0.25); assert.equal(stats.moveSpeed, 0);
});
await check('legacy imported speed and newly generated catalog produce the same clock without rewriting inputs', () => {
  const legacy = { ...agni, equipmentStatVersion: 0, stats: { atk: 69, atkSpeed: 35 } };
  const before = structuredClone(legacy);
  const base = actor('a', { stats: { attackPower: 25, attackSpeed: 0.86 }, inventory: [{ ...legacy, itemId: legacy._id }] });
  const current = { ...base, inventory: [{ ...agni, itemId: agni._id }] };
  close(getCombatStats(base).attackSpeed, 1.21);
  assert.equal(getBasicAttackIntervalSec(base), getBasicAttackIntervalSec(current));
  assert.ok(getBasicAttackIntervalSec(base) > 0.8);
  assert.deepEqual(legacy, before);
  const normalized = statContract.normalizeEquipmentItem(legacy);
  assert.deepEqual(statContract.normalizeEquipmentItem(normalized), normalized);
  const statless = statContract.normalizeEquipmentItem({ ...legacy, stats: undefined });
  assert.equal(statless.stats.atkSpeed, 0.35);
  assert.deepEqual(statContract.normalizeEquipmentItem(statless), statless);
});
await check('edited import points survive backfill and versioned 2 APS remains an additive stat', () => {
  const changed = statContract.normalizeEquipmentItem({ ...agni, equipmentStatVersion: 0, stats: { atk: 123, atkSpeed: 35 } });
  assert.equal(changed.stats.atk, 123); assert.equal(changed.stats.atkSpeed, 0.35);
  const authored = { itemId: 'authored', equipSlot: 'weapon', equipmentStatVersion: 2, stats: { atkSpeed: 2 } };
  assert.equal(statContract.equipmentStatsAtLevel(authored).atkSpeed, 2);
  assert.equal(statContract.equipmentStatsAtLevel({ itemId: 'wpn_old', stats: { atkSpeed: 0.125 } }).atkSpeed, 0.125);
});
await check('inventory acquisition retains the normalized unit marker', () => {
  const result = addItemToInventory([], agni, 1, 1);
  assert.ok(result.length, JSON.stringify(result));
  const item = result.find(row => row.itemId === agni._id);
  assert.ok(item, JSON.stringify(result));
  assert.equal(item.equipmentStatVersion, 2);
  assert.equal(statContract.equipmentStatsAtLevel(item).atkSpeed, 0.35);
});
await check('legacy authored attackPower, defense and attackSpeed aliases retain their real effects', () => {
  const item = { itemId: 'aliases', equipSlot: 'weapon', stats: { attackPower: 10, defense: 5, attackSpeed: 35, maxHp: 50 } };
  const row = actor('a', { stats: { attackPower: 24, defense: 14, attackSpeed: 1 }, inventory: [item] });
  const stats = getCombatStats(row);
  assert.equal(stats.attackPower, 34); assert.equal(stats.defense, 19); close(stats.attackSpeed, 1.35);
  assert.equal(statContract.equipmentStatsAtLevel(item).hp, 50);
});
await check('gear health is applied once, preserves injury across swaps and never resurrects', () => {
  const gear = { itemId: 'hp', equipSlot: 'head', equipmentStatVersion: 2, stats: { hp: 200, hpPerLevel: 10 } };
  let row = normalizeRuntimeSurvivor(actor('a', { hp: 50, maxHp: 100, stats: { maxHp: 100, hpGrowth: 0 }, inventory: [gear] }));
  assert.equal(row.maxHp, 310); assert.equal(row.hp, 155);
  const stable = structuredClone(row);
  for (let n = 0; n < 20; n++) row = normalizeRuntimeSurvivor(row);
  assert.equal(row.maxHp, stable.maxHp); assert.equal(row.hp, stable.hp);
  for (let n = 0; n < 10; n++) {
    row.equipped.head = null; synchronizeEquipmentHealth(row);
    assert.equal(row.maxHp, 100); assert.equal(row.hp, 50);
    row.equipped.head = 'hp'; synchronizeEquipmentHealth(row);
  }
  row.hp = 0; synchronizeEquipmentHealth(row); assert.equal(row.hp, 0);
  assert.equal(getCombatStats(row).maxHp, 310);
});
await check('equipped per-level attack and skill amplification use the actual actor level', () => {
  const item = { itemId: 'growth', equipSlot: 'weapon', equipmentStatVersion: 2,
    stats: { atk: 10, atkPerLevel: 3, skillAmp: 8, skillAmpPerLevel: 5, moveSpeedFlat: 0.25 } };
  const row = actor('a', { level: 10, stats: { maxHp: 1000, attackPower: 24, attackPowerGrowth: 0, skillAmpGrowth: 0 }, inventory: [item] });
  assert.equal(getCombatStats(row).attackPower, 64); assert.equal(getCombatStats(row).skillAmp, 58);
  close(getSpatialStats(row).moveSpeed, 3.75);
});
await check('all fresh samples have editable active skills and local explicit disabling is respected', () => {
  const roster = buildGuestSimulationRoster();
  assert.equal(roster.length, 24);
  for (const row of roster) for (const slot of ['q', 'w', 'e', 'r']) assert.ok(getCharacterSkillDef(row, slot));
  const changed = applyGuestCharacterProfiles(roster, [{ id: roster[0]._id, name: '사용자 편집', tacticalSkill: '초월',
    characterSkills: { q: { enabled: false } } }]);
  assert.equal(getCharacterSkillDef(changed[0], 'q'), null);
  assert.equal(changed[0].name, '사용자 편집');
});
await check('unusable skill amplification cannot inflate combat power or gear preferences', () => {
  const plain = actor('a', { stats: { maxHp: 1000, attackPower: 30, attackSpeed: 1, skillAmp: 0 } });
  const boosted = { ...plain, stats: { ...plain.stats, skillAmp: 500 } };
  close(getCombatPowerBreakdown(plain).total, getCombatPowerBreakdown(boosted).total);
  assert.ok(getCombatPowerBreakdown({ ...plain, stats: { ...plain.stats, armorPen: 0.5 } }).total
    > getCombatPowerBreakdown(plain).total);
  const evaluate = createEquipmentSuitabilityEvaluator(plain);
  const attack = { itemId: 'attack', equipSlot: 'weapon', tier: 4, stats: { atk: 30 } };
  const amp = { itemId: 'amp', equipSlot: 'weapon', tier: 4, stats: { skillAmp: 100 } };
  assert.ok(evaluate(attack) > evaluate(amp));
  const caster = { ...plain, characterSkills: { q: { enabled: true, name: '증폭', type: 'attack_skill', flatDamage: [1],
    skillAmpScale: 1, cooldownSec: 1 } } };
  assert.ok(getCombatPowerBreakdown({ ...caster, stats: { ...caster.stats, skillAmp: 100 } }).total
    > getCombatPowerBreakdown(caster).total);
  assert.ok(createEquipmentSuitabilityEvaluator(caster)(amp) > createEquipmentSuitabilityEvaluator(caster)(attack));
});
await check('sample melee entry is scheduled outside basic range and actually closes the gap', async () => {
  const roster = buildGuestSimulationRoster();
  const row = source => applyStartingPassiveHealth({ ...structuredClone(source), teamId: source._id, zoneId: 'zone',
    hp: source.stats.maxHp, maxHp: source.stats.maxHp, inventory: [], _tacNextAbsSec: 1e9,
    _spatial: { zoneId: 'zone', x: source.erRole === 'tank' ? 4 : 12, y: 12 } });
  const tank = row(roster[0]), marksman = row(roster[1]);
  const match = await runCombatScenario([tank, marksman], { duration: 10, seed: 'sample-entry' });
  assert.ok(match.events.some(event => event.kind === 'spatial_displacement' && event.who === tank._id));
  assert.ok(match.events.some(event => event.kind === 'damage' && event.who === tank._id));
});
await check('corrected source catalog remains detached and contains real health and growth options', async () => {
  const first = await loadGuestSimulationItemCatalog({ includeLocal: false });
  const second = await loadGuestSimulationItemCatalog({ includeLocal: false });
  assert.equal(first.length, 774);
  assert.ok(first.filter(item => Number(item.stats?.hp || 0) + Number(item.stats?.hpPerLevel || 0) > 0).length > 30);
  assert.ok(first.every(item => Number(item.stats?.atkSpeed || 0) <= 1));
  first[0].name = '독립 사본'; assert.notEqual(first[0].name, second[0].name);
});
console.log(JSON.stringify({ pass: true, checks }));
