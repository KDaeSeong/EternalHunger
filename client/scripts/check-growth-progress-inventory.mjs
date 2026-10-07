import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';
const { getActorGrowthProgress, getGrowthRecipeWork, markGrowthComponent, refreshActorGrowthPlan } = await import('../src/app/simulation/_lib/growthPlanRuntime.js');
const { getCraftRecipeTerms } = await import('../src/app/simulation/_lib/gearRecipeGuardRuntime.js');
const { canReceiveItem, getInvItemId, getInvRules, inferEquipSlot, invQty } = await import('../src/app/simulation/_lib/inventoryRules.js');
const { prepareCraftTransaction } = await import('../src/app/simulation/_lib/craftTransactionRuntime.js');
const { areEquipmentWeaponTypesCompatible } = await import('../src/utils/equipmentCatalog.js');
const { getRuleset } = await import('../src/utils/rulesets.js');

const items = [
  { _id: 'raw', name: 'Raw', type: '재료', category: 'material', tier: 1, spawnZones: ['a'], recipe: { ingredients: [] } },
  { _id: 'component', name: 'Component', type: '머리', category: 'equipment', equipSlot: 'head', tier: 1,
    recipe: { ingredients: [{ itemId: 'raw', qty: 1 }] } },
  { _id: 'gear', name: 'Gear', type: '머리', category: 'equipment', equipSlot: 'head', tier: 2,
    recipe: { ingredients: [{ itemId: 'component', qty: 1 }] } },
];
const world = { mapObj: { zones: [{ zoneId: 'a', name: 'A' }] }, zoneGraph: { a: [] }, forbiddenIds: new Set() };

const makeActor = (inventory, extra = {}) => ({ _id: 'actor', hp: 100, maxHp: 100, zoneId: 'a',
  inventory, routePlanTargetItemIds: ['gear'], equipped: {}, ...extra });

function referenceGrowthRecipeWork(actor, catalog, targetId, { ruleset, targetIds = [targetId] } = {}) {
  const byId = new Map(catalog.map((item) => [String(item._id), item]));
  const target = byId.get(String(targetId));
  const inventory = actor.inventory || [];
  const work = { craftIds: [], missing: [], reservedQtyById: {}, componentIds: [], readyCraftId: '', blocked: '',
    requiredCredits: 0, availableCredits: Number(actor?.simCredits ?? 0), plannedCredits: 0 };
  if (!target) return { ...work, blocked: 'invalid_recipe' };
  if (inferEquipSlot(target) === 'weapon' && !areEquipmentWeaponTypesCompatible(actor.weaponType, target.weaponType)) {
    return { ...work, blocked: 'weapon_mismatch' };
  }
  const available = new Map(inventory.map((entry) => [getInvItemId(entry), invQty(inventory, getInvItemId(entry))]));
  const missing = new Map(); const components = new Set(); const craftIds = new Set(); const reserved = {};
  function visit(id, qty, path) {
    if (!Number.isSafeInteger(qty) || qty <= 0) { work.blocked = 'invalid_recipe'; return; }
    const item = byId.get(id); const have = Math.min(qty, available.get(id) || 0);
    available.set(id, (available.get(id) || 0) - have);
    if (id !== target._id) { components.add(id); reserved[id] = (reserved[id] || 0) + qty; }
    const need = qty - have;
    if (need <= 0) return;
    if (!item || path.has(id) || path.size > 20) { work.blocked = 'invalid_recipe'; return; }
    if (Array.isArray(item.recipe?.ingredients) && item.recipe.ingredients.length) {
      const terms = getCraftRecipeTerms(item);
      if (!terms) { work.blocked = 'invalid_recipe'; return; }
      const batches = Math.ceil(need / terms.resultQty); const cost = batches * terms.creditsCost;
      if (!Number.isSafeInteger(batches * terms.resultQty) || !Number.isSafeInteger(work.plannedCredits + cost)) {
        work.blocked = 'invalid_recipe'; return;
      }
      const nextPath = new Set(path).add(id);
      for (const row of terms.ingredients) visit(String(row.itemId), batches * row.qty, nextPath);
      available.set(id, (available.get(id) || 0) + batches * terms.resultQty - need);
      work.plannedCredits += cost; craftIds.add(id);
    } else missing.set(id, (missing.get(id) || 0) + need);
  }
  visit(String(target._id), 1, new Set());
  work.craftIds = [...craftIds]; work.componentIds = [...components]; work.reservedQtyById = reserved;
  const materialReady = work.craftIds.filter((id) => getCraftRecipeTerms(byId.get(id))?.ingredients
    .every((row) => invQty(inventory, row.itemId) >= row.qty));
  const affordable = materialReady.filter((id) => getCraftRecipeTerms(byId.get(id)).creditsCost <= work.availableCredits);
  work.readyCraftId = affordable[0] || '';
  if (!work.blocked && work.readyCraftId && ruleset) {
    const previewCapacity = inventory.length >= getInvRules(ruleset).maxSlots
      || affordable.some((id) => getCraftRecipeTerms(byId.get(id)).resultQty > 1 || invQty(inventory, id) > 0);
    if (previewCapacity) {
      const context = { _growthPlan: { targetIds, componentIds: work.componentIds } };
      work.readyCraftId = affordable.find((id) => prepareCraftTransaction(actor,
        markGrowthComponent(byId.get(id), context), 1, ruleset).ok) || '';
      if (!work.readyCraftId) {
        const canContinueFarming = [...missing.keys()].some((id) => canReceiveItem(inventory,
          markGrowthComponent(byId.get(id), context), id, 1, ruleset));
        if (!canContinueFarming) work.blocked = 'inventory_full';
      }
    }
  }
  work.requiredCredits = materialReady.length ? getCraftRecipeTerms(byId.get(work.readyCraftId || materialReady[0])).creditsCost : 0;
  work.missing = [...missing].map(([id, qty]) => ({ itemId: id, name: byId.get(id)?.name || id,
    need: qty, have: invQty(inventory, id) }));
  if (!work.blocked && materialReady.length && !work.readyCraftId && !work.missing.length) work.blocked = 'insufficient_credits';
  return work;
}

for (const [label, rows, expected] of [
  ['undefined quantity defaults to one', [{ itemId: 'gear' }], true],
  ['positive numeric string is owned', [{ itemId: 'gear', qty: '2' }], true],
  ['null quantity is invalid', [{ itemId: 'gear', qty: null }], false],
  ['negative quantity is invalid', [{ itemId: 'gear', qty: -1 }], false],
  ['fractional quantity is invalid', [{ itemId: 'gear', qty: 1.5 }], false],
  ['unsafe integer quantity is invalid', [{ itemId: 'gear', qty: Number.MAX_SAFE_INTEGER + 1 }], false],
  ['duplicates retain any positive stack', [{ itemId: 'gear', qty: 0 }, { itemId: 'gear', qty: 1 }], true],
]) {
  const progress = getActorGrowthProgress(makeActor(rows), items);
  const oldScanResult = rows.some((entry) => invQty(rows, getInvItemId(entry)) > 0);
  assert.equal(oldScanResult, expected, `${label} fixture expectation`);
  assert.equal(progress.completedSlots === 1, oldScanResult, `${label} optimized result must match invQty scan`);
  const actor = makeActor(rows, { simCredits: 20 });
  assert.deepEqual(getGrowthRecipeWork(actor, items, 'gear'), referenceGrowthRecipeWork(actor, items, 'gear'),
    `${label} recipe work must deeply match the original invQty map implementation`);
}

const blankIdFallback = makeActor([{ itemId: '', equipSlot: 'head', tier: 5, qty: 1 }],
  { _growthFallbackTargets: { head: '' } });
assert.equal(getActorGrowthProgress(blankIdFallback, items).completedSlots, 0,
  'blank IDs must not be considered owned just because invQty returns zero for blank IDs');
assert.deepEqual(getGrowthRecipeWork(blankIdFallback, items, 'gear'),
  referenceGrowthRecipeWork(blankIdFallback, items, 'gear'), 'blank IDs retain recipe accounting parity');

for (const inventory of [
  [{ itemId: 'raw', qty: '1' }],
  [{ itemId: 'raw', qty: 1 }, { itemId: 'raw', qty: 1 }],
  [{ itemId: 'raw', qty: 1 }, { itemId: '', qty: 4 }, { itemId: 'component', qty: null }],
  [{ itemId: 'component', qty: 1 }, { itemId: 'raw', qty: 1 }],
]) {
  const actor = makeActor(inventory, { simCredits: 20 });
  assert.deepEqual(getGrowthRecipeWork(actor, items, 'gear'), referenceGrowthRecipeWork(actor, items, 'gear'),
    'missing, ready craft, reservation, and credit fields must match the original implementation');
}

const receiptInventory = [{ itemId: 'component', qty: 1, tags: ['custom', 'route_goal', 'growth_goal'] }];
receiptInventory._lastAdd = { itemId: 'component', acceptedQty: 1 };
const actor = makeActor(receiptInventory, { equipped: { head: 'component' } });
refreshActorGrowthPlan(actor, items, world);
assert.equal(actor.inventory._lastAdd, undefined, 'refresh must preserve its established receipt-clearing behavior');
assert.notStrictEqual(actor.inventory, receiptInventory, 'refresh must retain established array-copy behavior');
assert.deepEqual(actor.inventory[0].tags, ['custom', 'growth_goal'], 'custom tags survive while stale goal tags normalize');
assert.equal(actor.inventory[0]._growthReserved, true);
assert.equal(actor.inventory[0].craftComponent, false, 'worn ingredients remain reserved but are not marked as craft components');

const rules = getRuleset('ER_S11');
const paidCatalog = structuredClone(items);
paidCatalog.find(item => item._id === 'gear').recipe.creditsCost = 5;
for (const credits of [0, 5]) {
  const paidActor = makeActor([{ itemId: 'component', qty: 1 }], { simCredits: credits });
  const actual = getGrowthRecipeWork(paidActor, paidCatalog, 'gear', { ruleset: rules });
  assert.deepEqual(actual, referenceGrowthRecipeWork(paidActor, paidCatalog, 'gear', { ruleset: rules }));
  assert.equal(actual.requiredCredits, 5);
  assert.equal(actual.blocked, credits ? '' : 'insufficient_credits');
  assert.equal(actual.readyCraftId, credits ? 'gear' : '');
}

const batchCatalog = structuredClone(items);
batchCatalog.find(item => item._id === 'component').recipe.resultQty = 2;
batchCatalog.find(item => item._id === 'gear').recipe.ingredients[0].qty = 2;
const oneSlotRules = { ...rules, inventory: { ...rules.inventory, maxSlots: 1 } };
const partialActor = makeActor([{ ...batchCatalog[1], itemId: 'component', qty: 1 },
  { itemId: 'raw', qty: 1 }], { simCredits: 20 });
const partialWork = getGrowthRecipeWork(partialActor, batchCatalog, 'gear', { ruleset: oneSlotRules });
assert.deepEqual(partialWork, referenceGrowthRecipeWork(partialActor, batchCatalog, 'gear', { ruleset: oneSlotRules }));
assert.equal(partialWork.readyCraftId, '');
assert.equal(partialWork.blocked, 'inventory_full');

const releasingActor = makeActor([{ itemId: 'raw', qty: 1 }], { simCredits: 20 });
const releasingWork = getGrowthRecipeWork(releasingActor, items, 'gear', { ruleset: oneSlotRules });
assert.deepEqual(releasingWork, referenceGrowthRecipeWork(releasingActor, items, 'gear', { ruleset: oneSlotRules }));
assert.equal(releasingWork.readyCraftId, 'component');
assert.equal(releasingWork.blocked, '');

for (const rows of [
  [{ itemId: 'raw', qty: Number.MAX_SAFE_INTEGER }, { itemId: 'raw', qty: Number.MAX_SAFE_INTEGER }],
  [{ itemId: 'raw', qty: 1 }, { itemId: 'component', qty: 0 }, { itemId: 'component', qty: 1 }],
]) {
  const batchActor = makeActor(rows, { simCredits: 20 });
  assert.deepEqual(getGrowthRecipeWork(batchActor, batchCatalog, 'gear', { ruleset: rules }),
    referenceGrowthRecipeWork(batchActor, batchCatalog, 'gear', { ruleset: rules }));
}

console.log(JSON.stringify({ pass: true, quantityCases: 7,
  recipeParityCases: 18, scope: 'growth quantity indexing parity, paid recipes, actual ruleset capacity/batch accounting and refresh marker/receipt contracts' }));
