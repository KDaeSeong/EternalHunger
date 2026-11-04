import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';
const { synchronizeEquipmentHealth } = await import('../src/utils/equipmentHealth.js');
const { normalizeRuntimeSurvivor } = await import('../src/app/simulation/_lib/survivorRuntime.js');
const { getCombatStats } = await import('../src/app/simulation/_lib/combatDamageRuntime.js');
const { applyCombatHit } = await import('../src/app/simulation/_lib/combatImpactRuntime.js');
const { applyLevelGrowth } = await import('../src/app/simulation/_lib/masteryProgressRuntime.js');
const { restoreRuntimeHp } = await import('../src/app/simulation/_lib/healthRecoveryRuntime.js');
const { enterDimensionRiftSpace } = await import('../src/app/simulation/_lib/dimensionRiftSpaceRuntime.js');
const { commitRuntimeHpDamage, isDimensionRiftDefeated } = await import('../src/utils/dimensionRiftDefeatLogic.js');
const { applyPerkBundleToActor } = await import('../src/app/simulation/_lib/perkRuntime.js');
const { buildInitialSimulationRoster } = await import('../src/app/simulation/_lib/simulationInitialRosterRuntime.js');
const { createSeedRng } = await import('../src/app/simulation/_lib/randomSeedRuntime.js');
const { withSimulationRandom } = await import('../src/utils/simulationRandom.js');

const slots = ['weapon', 'head', 'clothes', 'arm', 'shoes'];
const emptyEquipment = () => Object.fromEntries(slots.map(slot => [slot, null]));
const item = (id, hp = 20, extra = {}) => ({ itemId: id, name: id, type: '방어구',
  equipSlot: 'head', tier: 4, qty: 1, stats: { hp }, ...extra });
const actor = (id = 'health-fixture', extra = {}) => ({ _id: id, name: id, teamId: id, zoneId: 'health-zone',
  hp: 50, maxHp: 100, level: 1, erLevel: 1, inventory: [], equipped: emptyEquipment(), activeEffects: [],
  _spatial: { zoneId: 'health-zone', x: 4, y: 4 }, tacticalSkill: 'none',
  stats: { maxHp: 100, hpGrowth: 0, attackPower: 20, defense: 0, skillAmp: 0, attackSpeed: 1 }, ...extra });
const wearing = (hp = 20, extra = {}) => actor('wearing', { inventory: [item('health-head', hp)],
  equipped: { ...emptyEquipment(), head: 'health-head' }, ...extra });
const close = (actual, expected, message) => assert.ok(Math.abs(actual - expected) <= 0.000001, message || `${actual} != ${expected}`);
const hp = (row, current, maximum) => { close(row.hp, current); close(row.maxHp, maximum); };
let checks = 0;
const failures = [];
const check = (name, run) => {
  try { run(); checks++; console.log('PASS ' + name); }
  catch (error) { failures.push({ name, error: String(error.message).slice(0, 1000) }); console.error('FAIL ' + name + ': ' + String(error.message).slice(0, 1000)); }
};

check('equipping and removing actual flat health preserves injury instead of granting free healing', () => {
  const row = wearing(), definitions = structuredClone(row.inventory), sourceStats = structuredClone(row.stats);
  row._perkBaseMaxHp = 100;
  const random = Math.random;
  Math.random = () => { throw new Error('Equipment health drew randomness'); };
  try {
    synchronizeEquipmentHealth(row); hp(row, 60, 120);
    assert.equal(row._equipmentMaxHpApplied, 20); assert.equal(row._perkBaseMaxHp, 120);
    for (let count = 0; count < 10; count++) {
      row.inventory[0].stats.hp = 40; synchronizeEquipmentHealth(row); hp(row, 70, 140);
      assert.equal(row._equipmentMaxHpApplied, 40); assert.equal(row._perkBaseMaxHp, 140);
      row.equipped.head = null; synchronizeEquipmentHealth(row); hp(row, 50, 100);
      assert.equal(row._equipmentMaxHpApplied, 0); assert.equal(row._perkBaseMaxHp, 100);
      row.inventory[0].stats.hp = 20; row.equipped.head = 'health-head'; synchronizeEquipmentHealth(row); hp(row, 60, 120);
      assert.equal(row._perkBaseMaxHp, 120);
    }
    synchronizeEquipmentHealth(row); assert.equal(row._perkBaseMaxHp, 120);
  } finally { Math.random = random; }
  assert.deepEqual(row.stats, sourceStats); assert.deepEqual(row.inventory, definitions);
});

check('all five equipped slots contribute once, while spare, missing and explicitly empty slots contribute nothing', () => {
  const inventory = slots.map((slot, index) => item('slot-' + slot, index + 1, { equipSlot: slot, type: slot === 'weapon' ? '무기' : '방어구' }));
  inventory.push(item('unused-spare', 999, { tier: 6 }));
  const row = actor('five-slots', { inventory, equipped: Object.fromEntries(slots.map(slot => [slot, 'slot-' + slot])) });
  synchronizeEquipmentHealth(row); hp(row, 57.5, 115); assert.equal(row._equipmentMaxHpApplied, 15);
  row.equipped = emptyEquipment(); synchronizeEquipmentHealth(row); hp(row, 50, 100);
  row.equipped.head = 'not-in-inventory'; synchronizeEquipmentHealth(row); hp(row, 50, 100);
  const duplicate = wearing(); duplicate.equipped.arm = duplicate.equipped.head;
  synchronizeEquipmentHealth(duplicate); hp(duplicate, 60, 120); assert.equal(duplicate._equipmentMaxHpApplied, 20);
});

check('invalid explicit stock cannot become health, while a legacy missing quantity still means one owned item', () => {
  for (const qty of [0, -1, 0.5, NaN, Infinity, '', null, false, {}, '0', '1.5']) {
    const row = wearing(); row.inventory[0].qty = qty;
    synchronizeEquipmentHealth(row); hp(row, 50, 100);
    const normalized = normalizeRuntimeSurvivor(wearing(20, { inventory: [item('health-head', 20, { qty })] }));
    hp(normalized, 50, 100); assert.equal(normalized.inventory.length, 0);
  }
  const legacy = wearing(); delete legacy.inventory[0].qty;
  synchronizeEquipmentHealth(legacy); hp(legacy, 60, 120);
  const stringCount = wearing(); stringCount.inventory[0].qty = '1';
  synchronizeEquipmentHealth(stringCount); hp(stringCount, 60, 120);
});

check('only existing flat hp is applied, without introducing level scaling, unit conversion or unrelated stat changes', () => {
  const row = wearing(20, { level: 20, erLevel: 20 });
  row.inventory[0].stats = { hp: 20, hpPerLevel: 999, atkSpeed: 35, skillAmp: 0.5 };
  const before = structuredClone(row.inventory);
  synchronizeEquipmentHealth(row); hp(row, 60, 120);
  assert.deepEqual(row.inventory, before); assert.equal(row.stats.maxHp, 100);
  for (const value of [NaN, Infinity]) {
    const invalid = wearing(); invalid.inventory[0].stats.hp = value;
    synchronizeEquipmentHealth(invalid); hp(invalid, 50, 100);
  }
});

check('signed flat health and the one-HP floor remain reversible without drift or accidental healing', () => {
  for (const bonus of [-20, -200]) {
    const row = wearing(bonus); const maximum = Math.max(1, 100 + bonus);
    for (let count = 0; count < 10; count++) {
      row.equipped.head = 'health-head'; synchronizeEquipmentHealth(row);
      hp(row, maximum / 2, maximum); assert.equal(row._equipmentMaxHpApplied, maximum - 100);
      assert.equal(getCombatStats(row).maxHp, maximum);
      row.equipped.head = null; synchronizeEquipmentHealth(row); hp(row, 50, 100);
      assert.equal(row._equipmentMaxHpApplied, 0);
    }
  }
});

check('real actor normalization and combat stat reads observe equipment health exactly once and retain their inputs', () => {
  const source = wearing(), before = structuredClone(source);
  let row = normalizeRuntimeSurvivor(source);
  hp(row, 60, 120); assert.equal(row.stats.maxHp, 100); assert.equal(getCombatStats(row).maxHp, 120);
  const stable = structuredClone(row);
  for (let count = 0; count < 20; count++) {
    row = normalizeRuntimeSurvivor(row); hp(row, 60, 120);
    assert.equal(getCombatStats(row).maxHp, 120); assert.equal(row._equipmentMaxHpApplied, 20);
  }
  assert.deepEqual(row, stable); assert.deepEqual(source, before);
});

check('a real landed hit uses the equipped health before subtracting damage, preventing a false lethal result', () => {
  const defender = wearing(), attacker = actor('attacker'), events = [];
  const impact = applyCombatHit(attacker, defender, { type: 'basic', damage: 50 }, {
    at: { sec: 100 }, emitRunEvent: (kind, details) => events.push({ kind, ...details }),
  });
  hp(defender, 10, 120); assert.equal(impact.hpDamage, 50); assert.equal(impact.hpBefore, 60);
  assert.equal(impact.maxHpBefore, 120); assert.equal(impact.maxHpAfter, 120); assert.equal(impact.defeat, null);
  assert.equal(events.filter(event => event.kind === 'dimension_rift_defeat').length, 0);
  const final = applyCombatHit(attacker, defender, { type: 'basic', damage: 50 });
  hp(defender, 0, 120); assert.equal(final.hpDamage, 10);
  const afterDeath = applyCombatHit(attacker, defender, { type: 'basic', damage: 50 });
  hp(defender, 0, 120); assert.equal(afterDeath.hpDamage, 0);
});

check('the existing healing cap reaches the equipped maximum but cannot resurrect a zero-HP actor', () => {
  const row = normalizeRuntimeSurvivor(wearing());
  assert.equal(restoreRuntimeHp(row, 100), 60); hp(row, 120, 120);
  assert.equal(restoreRuntimeHp(row, 100), 0);
  row.hp = 0; assert.equal(restoreRuntimeHp(row, 100), 0); hp(row, 0, 120);
});

check('ordinary level growth adds its existing four HP once on top of gear without replacing or duplicating the equipment bonus', () => {
  let row = normalizeRuntimeSurvivor(wearing(20, { stats: { ...wearing().stats, hpGrowth: 4 } }));
  hp(row, 60, 120);
  row.level = 2; row.erLevel = 2;
  applyLevelGrowth(row, { characterLeveledUp: true, beforeCharacterLevel: 1, afterCharacterLevel: 2 });
  hp(row, 64, 124); assert.equal(row._equipmentMaxHpApplied, 20); assert.equal(getCombatStats(row).maxHp, 124);
  const before = structuredClone(row);
  applyLevelGrowth(row, { characterLeveledUp: false }); assert.deepEqual(row, before);
  row = normalizeRuntimeSurvivor(row); hp(row, 64, 124); assert.equal(row._equipmentMaxHpApplied, 20);
});

check('signed equipment health survives level growth and removal without inflating base health or reviving defeated actors', () => {
  for (const bonus of [-20, -200]) {
    for (const state of ['alive', 'dead', 'arena-defeated']) {
      const row = normalizeRuntimeSurvivor(wearing(bonus, {
        hp: state === 'dead' ? 0 : 50,
        stats: { ...wearing().stats, hpGrowth: 4 },
      }));
      if (state === 'arena-defeated') {
        row.hp = 0.25;
        enterDimensionRiftSpace(row, { id: 'signed-health-rift', zoneId: row.zoneId }, 100);
        commitRuntimeHpDamage(row, 999, { atSec: 110, by: 'attacker' });
        assert.equal(isDimensionRiftDefeated(row), true);
      }
      const hpBefore = row.hp;
      const defeat = structuredClone(row._dimensionRiftDefeat);
      row.level = 2; row.erLevel = 2;
      applyLevelGrowth(row, { characterLeveledUp: true, beforeCharacterLevel: 1, afterCharacterLevel: 2 });
      const maximum = Math.max(1, 104 + bonus);
      const grownHp = state === 'alive' ? Math.min(maximum, hpBefore + 4) : hpBefore;
      hp(row, grownHp, maximum);
      assert.equal(getCombatStats(row).maxHp, maximum);
      assert.equal(row._equipmentMaxHpApplied, maximum - 104);
      row.equipped.head = null;
      synchronizeEquipmentHealth(row);
      hp(row, state === 'alive' ? grownHp * 104 / maximum : hpBefore, 104);
      assert.equal(getCombatStats(row).maxHp, 104);
      assert.equal(row._equipmentMaxHpApplied, 0);
      if (state === 'arena-defeated') {
        assert.equal(isDimensionRiftDefeated(row), true);
        assert.deepEqual(row._dimensionRiftDefeat, defeat);
      }
    }
  }
});

check('perk reapplication and withdrawal retain equipped health under the existing perk HP policy', () => {
  let row = normalizeRuntimeSurvivor(wearing(20, { hp: 100 })); hp(row, 120, 120);
  const bundle = { effects: { maxHpPlus: 30 } };
  for (let count = 0; count < 10; count++) {
    applyPerkBundleToActor(row, bundle); synchronizeEquipmentHealth(row); hp(row, 150, 150);
    assert.equal(row._perkBaseMaxHp, 120); assert.equal(row._equipmentMaxHpApplied, 20);
    applyPerkBundleToActor(row, { effects: {} }); synchronizeEquipmentHealth(row); hp(row, 120, 120);
    assert.equal(row._perkBaseMaxHp, 120); assert.equal(row._equipmentMaxHpApplied, 20);
    row = normalizeRuntimeSurvivor(row); hp(row, 120, 120);
  }
  applyPerkBundleToActor(row, bundle); row.hp = 75;
  for (let count = 0; count < 10; count++) {
    applyPerkBundleToActor(row, bundle); synchronizeEquipmentHealth(row); hp(row, 75, 150);
  }
  applyPerkBundleToActor(row, { effects: {} }); synchronizeEquipmentHealth(row); hp(row, 75, 120);
  applyPerkBundleToActor(row, bundle); synchronizeEquipmentHealth(row); hp(row, 105, 150);
});

check('post-growth perk reapplication does not erase real level growth or apply equipment health a second time', () => {
  const row = normalizeRuntimeSurvivor(wearing(20, { stats: { ...wearing().stats, hpGrowth: 4 } }));
  const bundle = { effects: { maxHpPlus: 30 } };
  applyPerkBundleToActor(row, bundle); hp(row, 90, 150);
  row.level = 2; row.erLevel = 2;
  applyLevelGrowth(row, { characterLeveledUp: true, beforeCharacterLevel: 1, afterCharacterLevel: 2 });
  hp(row, 94, 154); assert.equal(row._perkBaseMaxHp, 124); assert.equal(row._equipmentMaxHpApplied, 20);
  for (let count = 0; count < 10; count++) {
    applyPerkBundleToActor(row, bundle); synchronizeEquipmentHealth(row); hp(row, 94, 154);
  }
  applyPerkBundleToActor(row, { effects: {} }); synchronizeEquipmentHealth(row); hp(row, 94, 124);
});

check('starting a new game discards previous equipment health bookkeeping before initial normalization', () => {
  const prior = wearing(40, { hp: 70, maxHp: 140, _equipmentMaxHpApplied: 40, _perkBaseMaxHp: 140 });
  const before = structuredClone(prior);
  const roster = withSimulationRandom(createSeedRng('fresh-health-run'), () => buildInitialSimulationRoster({
    charList: [prior], routeItems: [], initialMap: { zones: [{ zoneId: 'health-zone' }], zoneConnections: [] },
    initialZoneIds: ['health-zone'], loadedSettings: { matchMode: 'solo' },
  }));
  for (const row of [...roster.candidateChars, ...roster.shuffledChars]) {
    hp(row, 100, 100); assert.deepEqual(row.inventory, []);
    assert.equal(Number(row._equipmentMaxHpApplied || 0), 0);
    assert.equal(row._perkBaseMaxHp, 100); assert.equal(getCombatStats(row).maxHp, 100);
  }
  assert.deepEqual(prior, before);
});

check('a dead actor stays dead through equipment changes, normalization and post-hit level growth', () => {
  let row = wearing(20, { hp: 0, stats: { ...wearing().stats, hpGrowth: 4 } });
  synchronizeEquipmentHealth(row); hp(row, 0, 120);
  row.inventory[0].stats.hp = 40; synchronizeEquipmentHealth(row); hp(row, 0, 140);
  row = normalizeRuntimeSurvivor(row); hp(row, 0, 140);
  row.level = 2; row.erLevel = 2;
  applyLevelGrowth(row, { characterLeveledUp: true, beforeCharacterLevel: 1, afterCharacterLevel: 2 });
  hp(row, 0, 144); assert.equal(row._equipmentMaxHpApplied, 40);
  row.equipped = emptyEquipment(); synchronizeEquipmentHealth(row); hp(row, 0, 104);
});

check('real arena defeat retains its fractional committed HP through gear and growth instead of reviving combat participation', () => {
  let row = actor('arena-defeated', { hp: 0.25, inventory: [item('health-head', 20)],
    stats: { ...wearing().stats, hpGrowth: 4 } });
  enterDimensionRiftSpace(row, { id: 'health-rift', zoneId: row.zoneId }, 100);
  commitRuntimeHpDamage(row, 999, { atSec: 110, by: 'attacker' });
  assert.equal(isDimensionRiftDefeated(row), true); assert.equal(row.hp, 0.25);
  const defeat = structuredClone(row._dimensionRiftDefeat);
  row.equipped.head = 'health-head'; synchronizeEquipmentHealth(row); hp(row, 0.25, 120);
  row.inventory[0].stats.hp = 40; synchronizeEquipmentHealth(row); hp(row, 0.25, 140);
  row = normalizeRuntimeSurvivor(row); hp(row, 0.25, 140);
  row.level = 2; row.erLevel = 2;
  applyLevelGrowth(row, { characterLeveledUp: true, beforeCharacterLevel: 1, afterCharacterLevel: 2 });
  hp(row, 0.25, 144); assert.equal(isDimensionRiftDefeated(row), true); assert.deepEqual(row._dimensionRiftDefeat, defeat);
  const impact = applyCombatHit(actor('arena-attacker'), row, { type: 'basic', damage: 50 });
  assert.equal(impact.hpDamage, 0); hp(row, 0.25, 144);
});

console.log(JSON.stringify({ pass: failures.length === 0, checks, failures,
  scope: 'Fresh actor/item fixtures through actual equipment health, normalization, combat impact, healing, growth and arena defeat modules. Flat hp only; no catalog conversion, saved-result inputs, balance simulation, server, full suite or build.' }));
if (failures.length) process.exitCode = 1;
