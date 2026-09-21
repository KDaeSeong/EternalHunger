// Authored test values, not an assertion about Eternal Return item balance.
import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const Item = require('../../server/models/Item.js');
const { saveGuestItem, mergeGuestItemCatalog } = await import('../src/app/simulation/_lib/guestItemProfileRuntime.js');
const { addItemToInventory, normalizeInventory } = await import('../src/app/simulation/_lib/inventoryRules.js');
const { getCombatEquipment } = await import('../src/utils/battleEquipmentLogic.js');
const { createEquipmentEffectDraft, prepareEquipmentEffectDraft, describeEquipmentEffects } = await import('../src/utils/equipmentEffectAuthoring.js');

const rupture = () => ({ version: 1, kind: 'rupture', delaySec: 0.8, cooldownSec: 8, radius: 2,
  damage: { base: 20, perLevel: 1, attackPowerRatio: 0, skillAmpRatio: 0.25 } });
const material = { _id: '111111111111111111111110', name: '시험 재료', type: '재료', tier: 1 };
const gear = (extra = {}) => ({ _id: '111111111111111111111111', name: '파열 시험 장비', type: '무기',
  equipSlot: 'weapon', tier: 4, stats: { atk: 10 }, equipmentEffects: [rupture()],
  recipe: { ingredients: [{ itemId: material._id, qty: 1 }], creditsCost: 0, resultQty: 1 }, ...extra });
const localGear = extra => gear({ _id: 'guest-item-rupture-check', ...extra });
const storage = () => {
  const values = new Map();
  return { values, getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
};
const rules = { inventory: { maxSlots: 10, stackMax: { material: 10, consumable: 6, equipment: 1 }, autoDropLowValue: false } };
let passed = 0, failed = 0;
const check = (label, run) => {
  try { run(); passed++; console.log(`PASS ${label}`); }
  catch (error) { failed++; console.error(`FAIL ${label}: ${error.message}`); }
};

check('authored equipment effects survive actual item schema conversion', () => {
  const item = gear(), document = new Item(item);
  assert.equal(document.validateSync(), undefined);
  assert.deepEqual(JSON.parse(JSON.stringify(document)).equipmentEffects, item.equipmentEffects);
});
check('schema rejects invalid effects instead of quietly discarding them', () => {
  for (const effect of [{ ...rupture(), version: 2 }, { ...rupture(), kind: 'unsupported' },
    { ...rupture(), radius: -1 }, { ...rupture(), delaySec: NaN },
    { ...rupture(), damage: { ...rupture().damage, base: -20 } }]) {
    assert.ok(new Item(gear({ equipmentEffects: [effect] })).validateSync(), JSON.stringify(effect));
  }
});
check('new local equipment retains the authored effect through save and catalog reload', () => {
  const target = storage(), item = localGear();
  const result = saveGuestItem(item, [material], target);
  assert.equal(result.ok, true, result.error);
  const restored = mergeGuestItemCatalog([material], { storage: target }).find(row => row._id === item._id);
  assert.deepEqual(restored.equipmentEffects, item.equipmentEffects);
  assert.notEqual(restored.equipmentEffects, item.equipmentEffects);
});
check('invalid local effect updates cannot replace an existing saved item', () => {
  const target = storage(), item = localGear();
  assert.equal(saveGuestItem(item, [material], target).ok, true);
  const before = [...target.values];
  assert.equal(saveGuestItem({ ...item, equipmentEffects: [{ ...rupture(), radius: -1 }] }, [material], target).ok, false);
  assert.deepEqual([...target.values], before);
});
check('real inventory acquisition owns effect definitions and preserves them in JSON', () => {
  const item = gear(), bag = addItemToInventory([], item, item._id, 1, 1, rules);
  assert.equal(bag._lastAdd.acceptedQty, 1);
  assert.deepEqual(bag[0].equipmentEffects, item.equipmentEffects);
  assert.notEqual(bag[0].equipmentEffects, item.equipmentEffects);
  assert.deepEqual(JSON.parse(JSON.stringify(bag))[0].equipmentEffects, item.equipmentEffects);
});
check('normalizing a bag does not alias nested equipment effects', () => {
  const item = gear({ itemId: '111111111111111111111111', category: 'equipment', qty: 1 });
  const before = structuredClone(item);
  const bag = normalizeInventory([item], rules);
  assert.deepEqual(bag[0].equipmentEffects, item.equipmentEffects);
  bag[0].equipmentEffects[0].damage.base = 99;
  assert.deepEqual(item, before);
});
check('explicit real equipment slots exclude stronger spare items and empty slots', () => {
  const equipped = gear(), spare = gear({ _id: '111111111111111111111112', tier: 5 });
  const actor = { inventory: [equipped, spare], equipped: { weapon: equipped._id, head: '', clothes: '', arm: '', shoes: '' } };
  assert.deepEqual(getCombatEquipment(actor), [equipped]);
  actor.equipped.weapon = '';
  assert.deepEqual(getCombatEquipment(actor), []);
});
check('editor draft requires a radius and positive damage, round trips and explicitly clears', () => {
  const fresh = createEquipmentEffectDraft();
  assert.deepEqual(prepareEquipmentEffectDraft(fresh).effects, []);
  fresh.enabled = true;
  assert.equal(prepareEquipmentEffectDraft(fresh).ok, false);
  fresh.value[0].radius = '2'; fresh.value[0].damage.base = '20';
  const saved = prepareEquipmentEffectDraft(fresh);
  assert.equal(saved.ok, true, saved.error);
  assert.deepEqual(prepareEquipmentEffectDraft(createEquipmentEffectDraft(JSON.parse(JSON.stringify(saved.effects)))), saved);
  assert.match(describeEquipmentEffects(saved.effects), /파열.*0.8초.*2m.*20.*8초/);
  fresh.enabled = false;
  assert.deepEqual(prepareEquipmentEffectDraft(fresh).effects, []);
});
check('unsupported editor effects are retained visibly until explicitly corrected or cleared', () => {
  const input = [{ ...rupture(), kind: 'unknown' }];
  const draft = createEquipmentEffectDraft(input);
  assert.deepEqual(draft.value, input); assert.equal(draft.enabled, true);
  assert.equal(prepareEquipmentEffectDraft(draft).ok, false);
  draft.value[0].damage.base = 300; assert.equal(input[0].damage.base, 20);
});
check('inherited effects cannot silently follow a changed non-equipment classification', () => {
  const base = gear();
  assert.equal(saveGuestItem({ ...base, type: '재료', equipmentEffects: [rupture()] }, [material, base], storage()).ok, false);
  const { equipmentEffects: omitted, ...patch } = base;
  assert.equal(saveGuestItem({ ...patch, type: '재료' }, [material, base], storage()).ok, false);
  assert.equal(saveGuestItem({ ...patch, type: '재료', equipmentEffects: [] }, [material, base], storage()).ok, true);
  assert.ok(new Item(gear({ type: '재료' })).validateSync()?.errors.equipmentEffects);
});
console.log(`CUSTOM_EQUIPMENT_DATA_CHECKS ${passed}/${passed + failed}`);
console.log('Scope: schema/local authoring/inventory ownership only; does not establish a proc, timed explosion, combat settlement or product support.');
if (failed) process.exitCode = 1;
