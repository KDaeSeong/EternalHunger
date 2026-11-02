const test = require('node:test');
const assert = require('node:assert/strict');
const { parseNamuItemStats, parseNamuStatTemplates } = require('../utils/namuItemStats');
const { normalizeEquipmentItem, equipmentStatsAtLevel } = require('../../shared/equipmentStatContract.cjs');
const references = require('../../shared/importedEquipmentStats.generated.json');
const { normalizeDefaultItemTree } = require('../utils/defaultItemTreeNormalization');
const source = require('../utils/defaultItemTree.generated.json');

test('versioned normalization restores every known unedited import and is idempotent', () => {
  assert.ok(Object.keys(references).length > 500);
  for (const [key, reference] of Object.entries(references)) {
    const original = { itemKey: key, stats: structuredClone(reference.legacyStats) };
    const snapshot = structuredClone(original);
    const corrected = normalizeEquipmentItem(original);
    for (const [field, expected] of Object.entries(reference.stats)) assert.equal(corrected.stats[field], expected, `${key}: ${field}`);
    assert.deepEqual(normalizeEquipmentItem(corrected), corrected);
    assert.deepEqual(original, snapshot);
  }
});
test('normalized tree keeps identities, recipes and canonical stats through a second load', () => {
  const first = normalizeDefaultItemTree(source), second = normalizeDefaultItemTree(first);
  assert.equal(first.length, 774);
  assert.deepEqual(first, second);
});
test('percentage aliases, lifesteal kinds and level growth retain distinct units', () => {
  const stats = parseNamuItemStats({ '최대 체력': '70', '레벨당 최대 체력': '20~400', 공격속도: '0.5%',
    치명타확률: '1%', '생명력 흡수': '8%', '모든 피해 흡혈': '6%', 방어관통: '12', 이동속도: '0.25' });
  assert.equal(stats.atkSpeed, 0.005); assert.equal(stats.critChance, 0.01);
  assert.equal(stats.lifesteal, 0.08); assert.equal(stats.omnisyphon, 0.06);
  assert.equal(stats.armorPen, 0); assert.equal(stats.armorPenFlat, 12);
  const item = { stats, equipmentStatVersion: 2 };
  assert.equal(equipmentStatsAtLevel(item, 1).hp, 90);
  assert.equal(equipmentStatsAtLevel(item, 20).hp, 470);
});
test('explicit edited and versioned values cannot be replaced by catalog defaults', () => {
  const edited = normalizeEquipmentItem({ itemKey: 'namu:돌격소총:아그니', stats: { atk: 123, atkSpeed: 50 } });
  assert.equal(edited.stats.atk, 123); assert.equal(edited.stats.atkSpeed, 0.5);
  const current = { ...edited, stats: { ...edited.stats, atkSpeed: 2, hp: 0 } };
  assert.deepEqual(normalizeEquipmentItem(current), current);
});
test('source backfill excludes deleted sections just like the actual importer', () => {
  const text = '[include(틀:이터널 리턴/아이템, 아이템명=현재, 분류=옷, 최대체력=70)]\n'
    + '== 삭제된 아이템 ==\n[include(틀:이터널 리턴/아이템, 아이템명=삭제, 분류=옷, 최대체력=999)]';
  assert.deepEqual(parseNamuStatTemplates(text).map(row => row.name), ['현재']);
});
