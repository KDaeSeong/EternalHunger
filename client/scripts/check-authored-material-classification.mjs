import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';
const { GUEST_ITEM_PROFILE_KEY, readGuestItems } = await import('../src/app/simulation/_lib/guestItemProfileRuntime.js');
const { inferItemCategory, inferEquipSlot, addItemToInventory, normalizeInventory, invQty } = await import('../src/app/simulation/_lib/inventoryRules.js');
const { prepareCraftTransaction, commitCraftTransaction } = await import('../src/app/simulation/_lib/craftTransactionRuntime.js');
const { tryAutoCraftFromInventory } = await import('../src/app/simulation/_lib/gearInventoryCraftRuntime.js');
const { refreshActorGrowthPlan, getActorGrowthProgress } = await import('../src/app/simulation/_lib/growthPlanRuntime.js');
const { buildCraftableItems, buildItemMetaById, buildItemNameById, buildItemKeyById } = await import('../src/app/simulation/_lib/itemOptionsRuntime.js');
const { createSimulationFrame } = await import('../src/app/simulation/_lib/simulationFrameRuntime.js');
const { captureSimulationReplayResult, cloneReplayData, compareSimulationReplay } = await import('../src/app/simulation/_lib/simulationReplayRuntime.js');
const { emitCraftRunEvent } = await import('../src/app/simulation/_lib/runEventRuntime.js');
const { createSeedRng } = await import('../src/app/simulation/_lib/randomSeedRuntime.js');
const { withSimulationRandom } = await import('../src/utils/simulationRandom.js');
const { getRuleset } = await import('../src/utils/rulesets.js');

// Static equivalents of the supported local item editor payload. No private
// browser evidence, old outcomes, account, storage injection or full match.
const zeroStats = { atk: 0, def: 0, hp: 0, skillAmp: 0, atkSpeed: 0, critChance: 0,
  cdr: 0, lifesteal: 0, moveSpeed: 0, armorPen: 0, adaptiveForce: 0 };
const raw = { _id: 'namu:material:고철', name: '고철', type: '재료', category: 'material', tier: 1, spawnZones: ['a'] };
const ruleset = structuredClone(getRuleset('ER_S11'));
const namesToCheck = ['연결 검사 묶음 중간재', '검사', '검은돌', '사과 재료'];
const item = (id, name, type, tier, ingredients, extra = {}) => ({
  _id: id, externalId: '', name, type, rarity: 'common', tier, stackMax: 1, value: 0,
  tags: [], equipSlot: '', weaponType: '', archetype: '', description: '', lockedByAdmin: false,
  recipe: { ingredients, creditsCost: 1, resultQty: 1 }, stats: { ...zeroStats },
  consumeEffect: null, equipmentEffects: [], ...extra,
});
function catalog(name = namesToCheck[0], weaponType = '단검', materialType = '재료') {
  const component = item('guest-item-material-batch', name, materialType, 2,
    [{ itemId: raw._id, qty: 3 }], { recipe: { ingredients: [{ itemId: raw._id, qty: 3 }], creditsCost: 1, resultQty: 2 } });
  const head = item('guest-item-material-head', '직접 지정 머리', '방어구', 4,
    [{ itemId: component._id, qty: 1 }], { equipSlot: 'head' });
  const weapon = item('guest-item-material-weapon', '직접 지정 무기', '무기', 4,
    [{ itemId: component._id, qty: 1 }], { equipSlot: 'weapon', weaponType });
  const upgrade = item('guest-item-material-upgrade', '직접 지정 상위 머리', '방어구', 5,
    [{ itemId: head._id, qty: 1 }, { itemId: component._id, qty: 1 }], { equipSlot: 'head' });
  const payload = { schemaVersion: 1, items: [component, head, weapon, upgrade] };
  const before = structuredClone(payload);
  const loaded = readGuestItems([raw], { getItem(key) {
    assert.equal(key, GUEST_ITEM_PROFILE_KEY);
    return JSON.stringify(payload);
  } });
  assert.equal(loaded.ok, true, loaded.error);
  assert.deepEqual(payload, before, 'Reading profiles cannot rewrite their UI payload.');
  const byId = new Map(loaded.items.map(row => [row._id, row]));
  return { items: [raw, ...loaded.items], component: byId.get(component._id), head: byId.get(head._id),
    weapon: byId.get(weapon._id), upgrade: byId.get(upgrade._id) };
}
const held = (source, qty = 1) => ({ ...structuredClone(source), itemId: source._id, qty });
const actor = (fixture, quantity = 6, credits = 15) => ({
  _id: 'authored-material-crafter', name: 'crafter', hp: 100, maxHp: 100, zoneId: 'a',
  weaponType: fixture.weapon.weaponType, simCredits: credits, stats: { attackPower: 20, defense: 10 },
  inventory: quantity > 3 ? [held(raw, 3), held(raw, quantity - 3)] : [held(raw, quantity)], equipped: {},
  routePlanTargetItemIds: [fixture.head._id, fixture.weapon._id],
  goalLoadouts: { hero: { headKey: fixture.head._id, weaponKey: fixture.weapon._id },
    legend: { headKey: fixture.upgrade._id } },
});
function assertMaterial(row, label) {
  assert.equal(row.localItemProfile, true, `${label}: authored identity must survive receipt/storage boundaries.`);
  assert.equal(inferItemCategory(row), 'material', `${label}: display words cannot turn authored material into gear or food.`);
  assert.equal(inferEquipSlot(row), '', `${label}: material has no equipment slot.`);
}
let passed = 0, failed = 0;
function check(name, test) {
  try { test(); passed++; console.log(`PASS ${name}`); }
  catch (error) { failed++; console.error(`FAIL ${name}: ${error.stack}`); }
}

check('actual UI-shaped profiles preserve material intent for unrelated weapon and food words in both material spellings', () => {
  for (const name of namesToCheck) for (const type of ['재료', 'material']) {
    const fixture = catalog(name, '단검', type);
    assert.equal(fixture.component.externalId, '');
    assert.equal(fixture.component.rarity, 'common');
    assert.deepEqual(fixture.component.stats, zeroStats);
    assertMaterial(fixture.component, `${type}/${name}`);
  }
});
check('explicit equipment slots and legacy non-profile meat, apple and weapon inference keep their existing meanings', () => {
  const explicit = { ...catalog().component, equipSlot: 'head' };
  assert.equal(inferItemCategory(explicit), 'equipment'); assert.equal(inferEquipSlot(explicit), 'head');
  for (const [name, category, slot] of [['고기', 'consumable', ''], ['사과', 'consumable', ''],
    ['탄창', 'equipment', 'weapon'], ['검', 'equipment', 'weapon'], ['붕대', 'material', '']]) {
    for (const marker of [undefined, false]) {
      const legacy = { name, type: '재료', ...(marker === undefined ? {} : { localItemProfile: marker }) };
      assert.equal(inferItemCategory(legacy), category, name); assert.equal(inferEquipSlot(legacy), slot, name);
    }
  }
});
check('a real three-scrap paid receipt receives two materials and preserves their classification after normalization and JSON', () => {
  const fixture = catalog(), subject = actor(fixture, 3);
  const before = structuredClone(subject);
  const prepared = prepareCraftTransaction(subject, fixture.component, 1, ruleset, fixture.items);
  assert.equal(prepared.ok, true, prepared.reason);
  assert.deepEqual(subject, before, 'Preparation is read-only.');
  const committed = commitCraftTransaction(subject, prepared);
  assert.equal(committed.ok, true);
  assert.equal(subject.simCredits, 14);
  assert.deepEqual(committed.receipt.consumed, [{ itemId: raw._id, qty: 3 }]);
  assert.equal(committed.receipt.qty, 2); assert.equal(committed.receipt.receivedQty, 2);
  assert.equal(invQty(subject.inventory, raw._id), 0); assert.equal(invQty(subject.inventory, fixture.component._id), 2);
  for (const inventory of [subject.inventory, normalizeInventory(subject.inventory, ruleset),
    normalizeInventory(cloneReplayData(subject.inventory), ruleset)]) {
    const rows = inventory.filter(row => row.itemId === fixture.component._id);
    assert.ok(rows.length > 0); rows.forEach(row => assertMaterial(row, 'received batch'));
    assert.equal(invQty(inventory, fixture.component._id), 2);
  }
});
check('receiving into an existing neutral-name material stack also retains incoming authored identity', () => {
  const fixture = catalog();
  const oldStack = { ...held(fixture.component), name: '남은 중간재' };
  delete oldStack.localItemProfile;
  const before = structuredClone(oldStack);
  const inventory = addItemToInventory([oldStack], fixture.component, fixture.component._id, 1, 1, ruleset);
  assert.deepEqual(oldStack, before);
  assert.equal(inventory._lastAdd.acceptedQty, 1);
  assert.equal(invQty(inventory, fixture.component._id), 2);
  assert.equal(inventory.filter(row => row.itemId === fixture.component._id).length, 1, 'Exercise an actual stack merge.');
  for (const row of normalizeInventory(cloneReplayData(inventory), ruleset)) assertMaterial(row, 'merged stack');
});

function runChain(fixture, restoreEveryAction) {
  let subject = actor(fixture);
  const meta = buildItemMetaById(fixture.items), itemNames = buildItemNameById(fixture.items);
  subject._itemKeyById = buildItemKeyById(fixture.items);
  const world = { mapObj: { _id: 'authored-material-map', zones: [{ zoneId: 'a', name: 'a' }] },
    zoneGraph: { a: [] }, forbiddenIds: new Set(), ruleset };
  const craftables = buildCraftableItems(fixture.items), events = [], receipts = [], equippedAt = new Map();
  const random = createSeedRng('authored-material-chain');
  const itemsBefore = structuredClone(fixture.items);
  for (let step = 1; step <= 7; step++) {
    subject._actionCycleKey = `authored-material:${step}`;
    refreshActorGrowthPlan(subject, fixture.items, world);
    const beforeCredits = subject.simCredits;
    const crafted = withSimulationRandom(random, () => tryAutoCraftFromInventory(subject, craftables,
      itemNames, meta, 1, step, ruleset, fixture.items));
    assert.ok(crafted?.changed, `Step ${step} must execute the real inventory-craft path.`);
    const expected = fixture.items.find(row => row._id === crafted.craftedId);
    assert.ok(expected?.recipe, 'Only declared catalogue recipes may produce results.');
    assert.equal(crafted.receipt.paidCost, 1); assert.equal(subject.simCredits, beforeCredits - 1);
    assert.deepEqual(crafted.receipt.consumed, expected.recipe.ingredients);
    assert.equal(crafted.receipt.qty, expected.recipe.resultQty);
    receipts.push(crafted.receipt);
    emitCraftRunEvent((kind, payload, at) => events.push({ kind, ...payload, at }), subject._id,
      crafted, { day: 1, phase: 'morning', sec: step }, 'a');
    for (const target of [fixture.head, fixture.weapon, fixture.upgrade]) {
      if (subject.equipped[target.equipSlot] === target._id && invQty(subject.inventory, target._id) === 1)
        equippedAt.set(target._id, equippedAt.get(target._id) ?? step);
    }
    for (const row of subject.inventory.filter(row => row.itemId === fixture.component._id))
      assertMaterial(row, `inventory action ${step}`);
    if (restoreEveryAction) {
      subject = cloneReplayData(subject);
      subject.inventory = normalizeInventory(subject.inventory, ruleset);
    }
    if (subject.equipped.head === fixture.upgrade._id && subject.equipped.weapon === fixture.weapon._id) break;
  }
  assert.deepEqual(fixture.items, itemsBefore, 'Runtime crafting cannot edit the saved catalogue.');
  assert.equal(receipts.length, 5);
  assert.equal(new Set(receipts.map(row => row.actionKey)).size, receipts.length);
  assert.equal(receipts.filter(row => row.itemId === fixture.component._id).length, 2);
  for (const target of [fixture.head, fixture.weapon, fixture.upgrade]) {
    assert.equal(receipts.filter(row => row.itemId === target._id).length, 1);
    assert.ok(equippedAt.has(target._id), `${target.name} must be actually equipped, not merely reported acquired.`);
  }
  assert.ok(equippedAt.get(fixture.head._id) < equippedAt.get(fixture.upgrade._id));
  assert.equal(subject.simCredits, 10); assert.equal(invQty(subject.inventory, raw._id), 0);
  assert.equal(invQty(subject.inventory, fixture.component._id), 1);
  assert.equal(invQty(subject.inventory, fixture.head._id), 0);
  assert.equal(invQty(subject.inventory, fixture.upgrade._id), 1);
  assert.equal(invQty(subject.inventory, fixture.weapon._id), 1);
  assert.equal(subject.equipped.head, fixture.upgrade._id); assert.equal(subject.equipped.weapon, fixture.weapon._id);
  assert.equal(subject._openingAcquiredItemIds.head, fixture.head._id);
  assert.equal(getActorGrowthProgress(subject, fixture.items).openingComplete, true);
  const finalFrame = createSimulationFrame({ day: 1, phase: 'morning', matchSec: receipts.length,
    survivors: [subject], dead: [], spawnState: null });
  // Product JSON capture/comparison only; no claim of IndexedDB or full-match replay.
  return captureSimulationReplayResult({ events, finalFrame, random: random.getState(), ending: null });
}
for (const name of namesToCheck) for (const weapon of ['단검', '망치']) {
  check(`real paid batch/head/${weapon}/upper-head chain survives JSON storage with material name ${name}`, () => {
    const fixture = catalog(name, weapon);
    const original = runChain(fixture, false), restored = runChain(fixture, true);
    assert.equal(compareSimulationReplay(original, restored).matched, true);
    const stored = cloneReplayData(original);
    assert.equal(compareSimulationReplay(original, stored).matched, true);
    const changed = cloneReplayData(stored); changed.events[0].paidCost += 1;
    assert.equal(compareSimulationReplay(original, changed).matched, false, 'The comparison must detect a changed real receipt.');
  });
}
check('invalid output quantity, missing ingredients and insufficient funds reject atomically', () => {
  const fixture = catalog();
  for (const [label, subject, output] of [
    ['output', actor(fixture, 3), { ...fixture.component, recipe: { ...fixture.component.recipe, resultQty: 0 } }],
    ['ingredients', actor(fixture, 2), fixture.component],
    ['credits', actor(fixture, 3, 0), fixture.component],
  ]) {
    const before = structuredClone(subject), prepared = prepareCraftTransaction(subject, output, 1, ruleset, fixture.items);
    assert.equal(prepared.ok, false, label);
    assert.equal(commitCraftTransaction(subject, prepared).ok, false, label);
    assert.deepEqual(subject, before, `${label}: no stock, credits, equipment or acquisition may change.`);
  }
});
check('a forged prepared output cannot create extra material or consume the original stock or fee', () => {
  const fixture = catalog(), subject = actor(fixture, 3), before = structuredClone(subject);
  const prepared = prepareCraftTransaction(subject, fixture.component, 1, ruleset, fixture.items);
  assert.equal(prepared.ok, true, prepared.reason);
  prepared.receipt.qty = 99;
  assert.equal(commitCraftTransaction(subject, prepared).ok, false);
  assert.deepEqual(subject, before);
});
console.log(`AUTHORED_MATERIAL_CLASSIFICATION_CHECKS ${passed}/${passed + failed}`);
if (failed) process.exitCode = 1;
