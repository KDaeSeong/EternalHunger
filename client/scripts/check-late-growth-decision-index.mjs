import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';

const { getLateGrowthTargets } = await import('../src/app/simulation/_lib/lateGrowthTargetRuntime.js');
const { buildActorGrowthPlan } = await import('../src/app/simulation/_lib/growthPlanRuntime.js');
const { getActorEquipmentTier } = await import('../src/app/simulation/_lib/growthEquipmentRuntime.js');
const { getInvItemId, inferEquipSlot, inferItemCategory, invQty } = await import('../src/app/simulation/_lib/inventoryRules.js');
const { getCraftRecipeTerms } = await import('../src/app/simulation/_lib/gearRecipeGuardRuntime.js');
const { prepareCraftTransaction } = await import('../src/app/simulation/_lib/craftTransactionRuntime.js');
const { normalizeWeaponType, areEquipmentWeaponTypesCompatible } = await import('../src/utils/equipmentCatalog.js');

// An independent, unindexed decision over current input, not a past result or
// fixture file. The old scans/sort define valid-input order. Rebuild eligibility
// for each call so edited/deleted recipes cannot survive a stale array cache.
const slots = ['weapon', 'head', 'clothes', 'arm', 'shoes'];
function referenceTargets(actor, items, { authoredOnly = false, includeAcquired = false } = {}) {
  const inventory = Array.isArray(actor.inventory) ? actor.inventory : [];
  const owned = new Set(inventory.filter(entry => invQty(inventory, getInvItemId(entry)) > 0).map(getInvItemId));
  const weapon = normalizeWeaponType(actor.weaponType || '');
  const catalog = items.filter(item => [5, 6].includes(Number(item.tier)) && inferItemCategory(item) === 'equipment'
    && slots.includes(inferEquipSlot(item)) && getCraftRecipeTerms(item));
  const keyOf = item => String(item.itemKey || item.externalId || item._id || '').trim();
  const compatible = (item, slot, tier) => inferEquipSlot(item) === slot && Number(item.tier) === tier
    && (slot !== 'weapon' || areEquipmentWeaponTypesCompatible(weapon, item.weaponType));
  const candidates = [], issues = [];
  for (const slot of slots) {
    const currentTier = getActorEquipmentTier(actor, slot);
    for (const [group, tier] of [['legend', 5], ['transcend', 6]]) {
      const requested = String(actor.goalLoadouts?.[group]?.[`${slot}Key`] || '').trim();
      if (requested) {
        const target = catalog.find(item => keyOf(item) === requested || String(item._id) === requested);
        if (!target || !compatible(target, slot, tier)) issues.push({ slot, tier, key: requested, reason: 'invalid_target' });
        else if (includeAcquired || (!owned.has(String(target._id))
          && actor._lateAcquiredItemIds?.[group]?.[slot] !== String(target._id))) candidates.push({ target, authored: true, slot, tier });
      } else if (!authoredOnly && currentTier < tier) {
        for (const target of catalog.filter(item => compatible(item, slot, tier) && !owned.has(String(item._id)))) {
          if (currentTier >= 4 || getCraftRecipeTerms(target).ingredients.every(row => invQty(inventory, row.itemId) >= row.qty)) {
            candidates.push({ target, authored: false, slot, tier });
          }
        }
      }
    }
  }
  const score = item => getCraftRecipeTerms(item).ingredients.reduce((sum, row) => sum + Math.min(row.qty, invQty(inventory, row.itemId)), 0);
  candidates.sort((a, b) => Number(b.authored) - Number(a.authored) || a.tier - b.tier
    || score(b.target) - score(a.target) || slots.indexOf(a.slot) - slots.indexOf(b.slot)
    || String(a.target._id).localeCompare(String(b.target._id)));
  return { targets: candidates.map(row => row.target), issues };
}

const gear = (id, slot, tier, extra = {}) => ({ _id: id, itemKey: `${id}-key`, name: id,
  type: slot === 'weapon' ? '무기' : '방어구', category: 'equipment', equipSlot: slot, weaponType: slot === 'weapon' ? '권총' : '', tier,
  recipe: { ingredients: [{ itemId: 'ore', qty: 1 }], resultQty: 1, creditsCost: 2 }, ...extra });
const actor = (inventory = [], extra = {}) => ({ _id: 'decision-index-actor', hp: 100, maxHp: 100,
  weaponType: '권총', simCredits: 30, inventory, equipped: {}, goalLoadouts: {}, ...extra });
const ore = { _id: 'ore', name: 'ore', type: '재료', tier: 1 };
let passed = 0, failed = 0, comparisons = 0;
function check(name, run) {
  try { run(); passed += 1; console.log(`PASS ${name}`); }
  catch (error) { failed += 1; console.error(`FAIL ${name}: ${error.stack}`); }
}
function compare(who, items, options) {
  const beforeActor = structuredClone(who), beforeItems = structuredClone(items);
  const expected = referenceTargets(who, items, options);
  const actual = getLateGrowthTargets(who, items, options);
  assert.deepEqual(actual.issues, expected.issues);
  assert.deepEqual(actual.targets.map(item => item._id), expected.targets.map(item => item._id));
  actual.targets.forEach((item, index) => assert.equal(item, expected.targets[index], 'return the real catalog object, not a replacement'));
  assert.deepEqual(who, beforeActor, 'decision cannot mutate possessions, stats or goals');
  assert.deepEqual(items, beforeItems, 'decision cannot mutate catalog or recipes');
  comparisons += 1;
  return actual;
}

check('fresh inventory/slot/recipe indexes preserve the unindexed current-input order', () => {
  const items = [ore, ...slots.flatMap(slot => [gear(`${slot}-a`, slot, 5), gear(`${slot}-b`, slot, 5), gear(`${slot}-c`, slot, 6)])];
  const quantities = [undefined, 0, -1, 1, 2, '2', ' ', 'invalid', 1.5, NaN, Infinity];
  for (const qty of quantities) for (const weaponType of ['권총', '활', '단검', '글러브']) for (const equippedTier of [0, 4, 5, 6]) {
    const inventory = [{ itemId: 'ore', ...(qty === undefined ? {} : { qty }) },
      ...slots.map(slot => ({ ...gear(`worn-${slot}`, slot, equippedTier), itemId: `worn-${slot}`, qty: 1 }))];
    const who = actor(inventory, { weaponType });
    compare(who, items); compare(who, items, { authoredOnly: true });
  }
});

check('authored priority, same-tier alternatives, slot issues and key collisions keep global first-match semantics', () => {
  const head = gear('first-head', 'head', 5, { itemKey: 'shared' });
  const clothes = gear('shared', 'clothes', 5);
  const weapon = gear('pistol', 'weapon', 5);
  const items = [head, clothes, weapon, gear('higher-head', 'head', 6), gear('unknown', 'head', 5, { itemKey: '  ', externalId: 'external-key' })];
  const who = actor([{ ...gear('base', 'head', 5), itemId: 'base', qty: 1 }], {
    goalLoadouts: { legend: { headKey: 'first-head-key', clothesKey: 'shared', weaponKey: 'pistol-key', armKey: 'missing', shoesKey: 'external-key' },
      transcend: { headKey: 'higher-head-key' } },
  });
  compare(who, items); compare(who, [...items].reverse());
  assert.ok(getLateGrowthTargets(who, items).issues.some(row => row.slot === 'clothes'), 'do not fall through an earlier wrong-slot alias');
  who.goalLoadouts.legend.headKey = 'shared'; compare(who, items);
  compare(who, [head, head, ...items], { authoredOnly: true });
});

check('aggregate valid quantities, legacy IDs, worn components and incompatible weapons retain tier/ownership meaning', () => {
  const items = [ore, gear('next-head', 'head', 5), gear('next-shoes', 'shoes', 6), gear('next-gun', 'weapon', 5)];
  const entries = [
    { ...gear('shared', 'head', 6), itemId: 'shared', qty: 0 },
    { ...gear('shared', 'head', 2), id: 'shared', qty: '1' },
    { ...gear('component', 'shoes', 6), itemId: 'component', qty: 1, craftComponent: true },
    { ...gear('unusable', 'weapon', 6), itemId: 'unusable', qty: 1, weaponType: '활' },
    { itemId: 'ore', qty: 0 }, { id: 'ore', qty: 1 }, { _id: 'ore', qty: '2' }, { itemId: 'ore', qty: 'invalid' },
    { itemId: '', qty: 1, equipSlot: 'arm', tier: 99 }, null,
  ];
  const who = actor(entries); compare(who, items);
  who.equipped.shoes = 'component'; compare(who, items);
  who.inventory[1].qty = 0; compare(who, items);
  who.inventory[4].qty = 2; compare(who, items);
});

check('sparse inventory holes retain the unindexed quantity and equipment semantics', () => {
  const items = [ore, gear('sparse-head', 'head', 5), gear('sparse-gun', 'weapon', 6)];
  const sparse = Array(6);
  sparse[1] = { itemId: 'ore', qty: 2 };
  sparse[4] = { ...gear('base', 'head', 4), itemId: 'base', qty: 1 };
  const mixed = Array(7);
  mixed[0] = null; mixed[2] = undefined;
  mixed[5] = { ...gear('worn', 'head', 6), itemId: 'worn', qty: 1 };
  mixed[6] = { itemId: 'ore', qty: 1 };
  for (const inventory of [Array(3), sparse, mixed]) {
    const who = actor(inventory);
    compare(who, items); compare(who, items, { authoredOnly: true });
  }
});

check('sparse catalog holes and deleted array entries keep fresh global candidate order', () => {
  const items = Array(7);
  items[1] = ore; items[3] = gear('sparse-head', 'head', 5); items[6] = gear('sparse-gun', 'weapon', 6);
  const who = actor([{ itemId: 'ore', qty: 2 }]);
  compare(who, items);
  who.goalLoadouts.legend = { headKey: 'sparse-head-key' }; compare(who, items, { authoredOnly: true });
  delete items[3]; compare(who, items); compare(who, items, { authoredOnly: true });
});

check('an invalid recipe edited after a warm decision is excluded without crashing other valid choices', () => {
  const a = gear('a', 'head', 5), b = gear('b', 'head', 5), items = [ore, a, b];
  const who = actor([{ ...gear('base', 'head', 4), itemId: 'base', qty: 1 }]);
  assert.deepEqual(compare(who, items).targets.map(item => item._id), ['a', 'b']);
  for (const update of [item => { item.recipe.resultQty = 0; }, item => { item.recipe.creditsCost = -1; },
    item => { item.recipe.ingredients[0].qty = 0; }, item => { item.lockedByAdmin = 'deleted'; }]) {
    a.recipe = structuredClone(gear('a', 'head', 5).recipe); delete a.lockedByAdmin;
    compare(who, items); update(a);
    assert.deepEqual(compare(who, items).targets.map(item => item._id), ['b']);
  }
});

check('a previously invalid recipe becomes eligible on the same catalog array when genuinely repaired', () => {
  const a = gear('repair', 'head', 5, { recipe: { ingredients: [{ itemId: 'ore', qty: 0 }], resultQty: 1, creditsCost: 0 } });
  const items = [ore, a], who = actor([{ itemId: 'ore', qty: 1 }]);
  assert.equal(compare(who, items).targets.length, 0);
  a.recipe.ingredients[0].qty = 1;
  assert.equal(compare(who, items).targets[0], a);
  a.recipe.resultQty = 2; a.recipe.creditsCost = 10; compare(who, items);
});

check('authored edited/deleted recipes remain explicit invalid targets and never grant alternatives', () => {
  const chosen = gear('authored', 'head', 5), items = [ore, chosen, gear('automatic', 'head', 5)];
  const who = actor([{ itemId: 'ore', qty: 1 }], { goalLoadouts: { legend: { headKey: chosen.itemKey } } });
  compare(who, items); chosen.lockedByAdmin = 'deleted';
  const result = compare(who, items);
  assert.ok(result.issues.some(row => row.slot === 'head' && row.key === chosen.itemKey && row.reason === 'invalid_target'));
  assert.equal(result.targets.some(item => item._id === 'automatic'), false);
  assert.equal(prepareCraftTransaction(who, chosen, 1, { inventory: { maxSlots: 10 } }).ok, false);
  assert.equal(who.inventory.length, 1); assert.equal(who.simCredits, 30);
});

check('slot/type/tier/weapon/key/array edits are read again, not frozen by a catalog identity', () => {
  const chosen = gear('editable', 'head', 5), other = gear('other', 'clothes', 5), items = [ore, chosen, other];
  const who = actor([{ itemId: 'ore', qty: 2 }]); compare(who, items);
  chosen.equipSlot = 'clothes'; compare(who, items);
  chosen.tier = 6; compare(who, items);
  chosen.type = 'consumable'; assert.equal(compare(who, items).targets.includes(chosen), false);
  chosen.type = '무기'; chosen.equipSlot = 'weapon'; chosen.weaponType = '활'; compare(who, items);
  chosen.weaponType = '권총'; compare(who, items);
  chosen.itemKey = 'renamed'; who.goalLoadouts.legend = { weaponKey: 'renamed' }; chosen.tier = 5; compare(who, items);
  items.push(gear('new', 'arm', 5)); compare(who, items);
  items.reverse(); compare(who, items);
});

check('input goals and quantities are fresh on every decision including authored-only loot claims', () => {
  const first = gear('first', 'head', 5), second = gear('second', 'head', 5), items = [ore, first, second];
  const who = actor([{ itemId: 'ore', qty: 1 }]); compare(who, items);
  who.inventory[0].qty = 0; compare(who, items);
  who.goalLoadouts.legend = { headKey: first.itemKey }; compare(who, items, { authoredOnly: true });
  who.goalLoadouts.legend.headKey = second.itemKey; compare(who, items, { authoredOnly: true });
  who.inventory.push({ ...second, itemId: second._id, qty: 1 }); compare(who, items);
  who.inventory.at(-1).qty = 0; compare(who, items);
});

check('direct late goals require exact possession or the matching per-slot acquisition record; automatic upgrades still skip higher gear', () => {
  const legend = gear('authored-legend', 'head', 5), trans = gear('held-transcend', 'head', 6);
  const items = [ore, legend, trans];
  const who = actor([{ ...trans, itemId: trans._id, qty: 1 }], {
    equipped: { head: trans._id }, goalLoadouts: { legend: { headKey: legend.itemKey } },
  });
  assert.deepEqual(compare(who, items).targets.map(item => item._id), [legend._id], 'higher tier alone cannot satisfy direct legend intent');
  assert.deepEqual(compare(who, items, { authoredOnly: true, includeAcquired: true }).targets.map(item => item._id), [legend._id]);
  who._lateAcquiredItemIds = { legend: { head: 'wrong-id' } };
  assert.deepEqual(compare(who, items).targets.map(item => item._id), [legend._id], 'wrong marker cannot complete the slot');
  who._lateAcquiredItemIds.legend.head = legend._id;
  assert.deepEqual(compare(who, items).targets, [], 'matching record completes a consumed exact target');
  assert.deepEqual(compare(who, items, { authoredOnly: true, includeAcquired: true }).targets.map(item => item._id), [legend._id],
    'producer query still enumerates valid authored goals despite acquisition');
  who.goalLoadouts = {};
  assert.deepEqual(compare(who, items).targets, [], 'automatic upgrades do not downgrade a usable higher tier');
});

check('current catalog decisions integrate into real growth planning after invalidation without touching possessions', () => {
  const base = gear('base', 'head', 4), a = gear('a', 'head', 5), b = gear('b', 'head', 5);
  a.recipe.ingredients = [{ itemId: base._id, qty: 1 }]; b.recipe.ingredients = [{ itemId: base._id, qty: 1 }];
  const items = [base, a, b], who = actor([{ ...base, itemId: base._id, qty: 1 }], {
    zoneId: 'a', routePlanTargetItemIds: [base._id], equipped: { head: base._id }, _growthFocusId: a._id,
  });
  const options = { mapObj: { zones: [{ zoneId: 'a', name: 'a' }] }, zoneGraph: { a: [] }, forbiddenIds: new Set(),
    ruleset: { inventory: { maxSlots: 10, stackMax: { material: 3, equipment: 1 } } } };
  assert.equal(buildActorGrowthPlan(who, items, options).targetId, a._id);
  a.recipe.resultQty = 0;
  const before = structuredClone(who);
  assert.equal(buildActorGrowthPlan(who, items, options).targetId, b._id);
  assert.deepEqual(who, before);
});

check('recipe normalization and inventory quantity reads are bounded within a call, not cached across calls', () => {
  const a = gear('count-a', 'head', 5), b = gear('count-b', 'head', 5);
  let ingredientReads = 0, qtyReads = 0;
  const rows = a.recipe.ingredients;
  Object.defineProperty(a.recipe, 'ingredients', { enumerable: true, configurable: true, get() { ingredientReads += 1; return rows; } });
  const entry = { itemId: 'ore' };
  Object.defineProperty(entry, 'qty', { enumerable: true, configurable: true, get() { qtyReads += 1; return 2; } });
  const who = actor([entry, { ...gear('base', 'head', 4), itemId: 'base', qty: 1 }]), items = [ore, a, b, a];
  getLateGrowthTargets(who, items);
  assert.equal(ingredientReads, 1, 'normalize one unique candidate recipe once even when aliases/order comparisons repeat');
  assert.equal(qtyReads, 2, 'read valid quantity once for normalization, not for each candidate/slot/sort comparison');
  getLateGrowthTargets(who, items);
  assert.equal(ingredientReads, 2, 'next call must re-read recipes'); assert.equal(qtyReads, 4, 'next call must re-read quantities');
});

check('unused recipes are not normalized while active authored aliases retain first-valid global matching', () => {
  const irrelevant = gear('unused', 'shoes', 6), first = gear('first', 'clothes', 5, { itemKey: 'collision' });
  const second = gear('second', 'head', 5, { itemKey: 'collision' });
  let reads = 0;
  const ingredients = irrelevant.recipe.ingredients;
  Object.defineProperty(irrelevant.recipe, 'ingredients', { enumerable: true, get() { reads += 1; return ingredients; } });
  const who = actor([{ itemId: 'ore', qty: 1 }]), items = [irrelevant, first, second];
  assert.deepEqual(getLateGrowthTargets(who, items, { authoredOnly: true }), { targets: [], issues: [] });
  assert.equal(reads, 0, 'an authored-only loot query without authored choices has no eligible recipe work');
  who.goalLoadouts.legend = { headKey: 'collision' };
  assert.deepEqual(getLateGrowthTargets(who, items, { authoredOnly: true }).issues,
    [{ slot: 'head', tier: 5, key: 'collision', reason: 'invalid_target' }]);
  first.recipe.resultQty = 0;
  assert.equal(getLateGrowthTargets(who, items, { authoredOnly: true }).targets[0], second);
  assert.equal(reads, 0, 'a different slot and unmatched alias are not candidate recipes');
  first.recipe.resultQty = 1;
  assert.deepEqual(getLateGrowthTargets(who, items, { authoredOnly: true }).issues,
    [{ slot: 'head', tier: 5, key: 'collision', reason: 'invalid_target' }]);
});

check('current-input decisions do not read global randomness', () => {
  const random = Math.random;
  try {
    Math.random = () => { throw Error('Late growth decisions cannot consume randomness'); };
    compare(actor([{ itemId: 'ore', qty: 1 }]), [ore, gear('rng', 'head', 5)]);
  } finally { Math.random = random; }
});

console.log(`LATE_GROWTH_DECISION_INDEX_CHECKS ${passed}/${passed + failed} groups; ${comparisons} fresh unindexed comparisons`);
if (failed) process.exitCode = 1;
