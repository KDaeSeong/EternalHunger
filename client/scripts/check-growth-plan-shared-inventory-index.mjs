import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';
const { buildActorGrowthPlan, getGrowthRecipeWork } = await import('../src/app/simulation/_lib/growthPlanRuntime.js');
const { getActorEquipmentTier } = await import('../src/app/simulation/_lib/growthEquipmentRuntime.js');

const raw = { _id: 'raw', name: 'Raw', type: '재료', category: 'material', tier: 1, spawnZones: ['a'],
  recipe: { ingredients: [] } };
const inaccessible = { _id: 'inaccessible', name: 'Unavailable', type: '재료', category: 'material', tier: 1,
  spawnZones: [], recipe: { ingredients: [] } };
const catalog = [raw, inaccessible];
for (const slot of ['weapon', 'head', 'clothes', 'arm', 'shoes']) {
  for (let tier = 1; tier <= 4; tier += 1) {
    for (let choice = 0; choice < 3; choice += 1) {
      catalog.push({ _id: `candidate-${slot}-${tier}-${choice}`, name: 'Candidate', type: '장비',
        category: 'equipment', equipSlot: slot, tier, weaponType: slot === 'weapon' ? '권총' : undefined,
        recipe: { ingredients: [{ itemId: 'raw', qty: 1 }], resultQty: 1, creditsCost: 0 } });
    }
  }
}
catalog.push({ _id: 'authored', name: 'Authored', type: '머리', category: 'equipment', equipSlot: 'head', tier: 4,
  recipe: { ingredients: [{ itemId: 'inaccessible', qty: 1 }], resultQty: 1, creditsCost: 0 } });

let quantityReads = 0;
const watchedRaw = new Proxy({ itemId: 'raw', qty: 1 }, {
  get(target, property, receiver) {
    if (property === 'qty') quantityReads += 1;
    return Reflect.get(target, property, receiver);
  },
});
const makeActor = (inventory, overrides = {}) => ({ _id: 'actor', name: 'Actor', hp: 100, maxHp: 100, zoneId: 'a',
  routePlanTargetItemIds: ['authored'], inventory, equipped: {}, weaponType: '권총', simCredits: 100, ...overrides });
const options = { mapObj: { zones: [{ zoneId: 'a', name: 'A' }] }, zoneGraph: { a: [] },
  forbiddenIds: new Set(), ruleset: {} };
const inventory = [watchedRaw];
const actor = makeActor(inventory);
const plan = buildActorGrowthPlan(actor, catalog, options);
assert.ok(plan?.targetId, 'recovery should evaluate the fallback equipment catalog after the authored goal is blocked');
const recoveryCandidates = catalog.filter((item) => item.category === 'equipment' && item.tier >= 1 && item.tier <= 6).length;
assert.equal(recoveryCandidates, 61);
assert.ok(quantityReads < 10,
  'inventory quantity property reads must remain bounded as recovery candidate count grows');
assert.strictEqual(actor.inventory, inventory, 'planning must not replace or mutate the input inventory');
assert.deepEqual(actor.inventory[0], { itemId: 'raw', qty: 1 });

const sharedItems = [
  raw,
  { _id: 'branch-a', name: 'Branch A', type: '재료', category: 'material', tier: 1, recipe: {
    ingredients: [{ itemId: 'raw', qty: 1 }], resultQty: 2, creditsCost: 2,
  } },
  { _id: 'branch-b', name: 'Branch B', type: '재료', category: 'material', tier: 1, recipe: {
    ingredients: [{ itemId: 'raw', qty: 1 }], resultQty: 1, creditsCost: 3,
  } },
  { _id: 'shared-target', name: 'Shared Target', type: '머리', category: 'equipment', equipSlot: 'head', tier: 2,
    recipe: { ingredients: [{ itemId: 'branch-a', qty: 2 }, { itemId: 'branch-b', qty: 1 }], resultQty: 1, creditsCost: 4 } },
];
const duplicateMaterials = makeActor([{ itemId: 'raw', qty: 1 }, { itemId: 'raw', qty: 2 }]);
const singleMaterial = makeActor([{ itemId: 'raw', qty: 3 }]);
const duplicateWork = getGrowthRecipeWork(duplicateMaterials, sharedItems, 'shared-target');
const singleWork = getGrowthRecipeWork(singleMaterial, sharedItems, 'shared-target');
assert.deepEqual(duplicateWork, singleWork, 'duplicate rows must match their summed stack across shared recipe branches');
assert.deepEqual(duplicateWork, {
  craftIds: ['branch-a', 'branch-b', 'shared-target'], missing: [],
  reservedQtyById: { 'branch-a': 2, raw: 2, 'branch-b': 1 },
  componentIds: ['branch-a', 'raw', 'branch-b'], readyCraftId: 'branch-a', blocked: '',
  requiredCredits: 2, availableCredits: 100, plannedCredits: 9,
});

const mutableRow = { itemId: 'raw', qty: 0 };
const mutableActor = makeActor([mutableRow]);
const directRecipe = [raw, { _id: 'direct-target', name: 'Direct Target', type: '머리', category: 'equipment',
  equipSlot: 'head', tier: 2, recipe: { ingredients: [{ itemId: 'raw', qty: 1 }] } }];
const beforeMutation = getGrowthRecipeWork(mutableActor, directRecipe, 'direct-target');
mutableRow.qty = 1;
const afterMutation = getGrowthRecipeWork(mutableActor, directRecipe, 'direct-target');
assert.equal(beforeMutation.missing[0]?.have, 0);
assert.equal(afterMutation.missing.length, 0, 'a later call must reindex an in-place inventory quantity change');
assert.equal(afterMutation.readyCraftId, 'direct-target');
assert.deepEqual(getGrowthRecipeWork(mutableActor, directRecipe, 'direct-target'), afterMutation,
  'virtual planning state must not leak between independent recipe calls');
assert.deepEqual(getGrowthRecipeWork(mutableActor, directRecipe, 'direct-target',
  { inventoryQuantities: new Map([['raw', 0]]) }), afterMutation,
  'the public recipe API must not accept injected cached quantities');

const surplusItems = [
  raw,
  { _id: 'batch', name: 'Batch', type: '재료', category: 'material', tier: 1,
    recipe: { ingredients: [{ itemId: 'raw', qty: 1 }], resultQty: 2, creditsCost: 2 } },
  { _id: 'branch-a', name: 'Branch A', type: '재료', category: 'material', tier: 1,
    recipe: { ingredients: [{ itemId: 'batch', qty: 1 }], resultQty: 1, creditsCost: 3 } },
  { _id: 'branch-b', name: 'Branch B', type: '재료', category: 'material', tier: 1,
    recipe: { ingredients: [{ itemId: 'batch', qty: 1 }], resultQty: 1, creditsCost: 4 } },
  { _id: 'surplus-target', name: 'Surplus Target', type: '머리', category: 'equipment', equipSlot: 'head', tier: 2,
    recipe: { ingredients: [{ itemId: 'branch-a', qty: 1 }, { itemId: 'branch-b', qty: 1 }], resultQty: 1, creditsCost: 5 } },
];
const surplusActor = makeActor([{ itemId: 'raw', qty: 1 }]);
const surplusWork = getGrowthRecipeWork(surplusActor, surplusItems, 'surplus-target');
assert.deepEqual(surplusWork, {
  craftIds: ['batch', 'branch-a', 'branch-b', 'surplus-target'], missing: [],
  reservedQtyById: { 'branch-a': 1, batch: 2, raw: 1, 'branch-b': 1 },
  componentIds: ['branch-a', 'batch', 'raw', 'branch-b'], readyCraftId: 'batch', blocked: '',
  requiredCredits: 2, availableCredits: 100, plannedCredits: 14,
});
assert.equal(surplusActor.inventory[0].qty, 1, 'virtual batch surplus must not consume actual inventory');

const stageCatalog = [
  raw,
  { _id: 'basic-head', name: 'Basic Head', type: '장비', category: 'equipment', equipSlot: 'head', tier: 2,
    recipe: { ingredients: [{ itemId: 'raw', qty: 1 }], resultQty: 1, creditsCost: 0 } },
  { _id: 'late-head', name: 'Late Head', type: '장비', category: 'equipment', equipSlot: 'head', tier: 5,
    recipe: { ingredients: [{ itemId: 'raw', qty: 1 }], resultQty: 1, creditsCost: 0 } },
];
const openingPlan = buildActorGrowthPlan(makeActor([{ itemId: 'raw', qty: 1 }], {
  routePlanTargetItemIds: ['basic-head'],
}), stageCatalog, options);
assert.equal(openingPlan.stage, 'opening');
assert.equal(openingPlan.targetId, 'basic-head', 'the fixed catalog should select its unfinished basic goal');
const latePlan = buildActorGrowthPlan(makeActor([
  { itemId: 'raw', qty: 1 }, { itemId: 'basic-head', qty: 1, equipSlot: 'head', tier: 2 },
], {
  routePlanTargetItemIds: ['basic-head'], goalLoadouts: { legend: { headKey: 'late-head' } },
}), stageCatalog, options);
assert.equal(latePlan.stage, 'late');
assert.equal(latePlan.targetId, 'late-head', 'completed basic gear should advance to the authored late target');

const recoveryCatalog = [raw,
  { _id: 'authored', name: 'Blocked Authored', type: '장비', category: 'equipment', equipSlot: 'head', tier: 4,
    spawnZones: [], recipe: { ingredients: [{ itemId: 'unavailable', qty: 1 }], resultQty: 1, creditsCost: 0 } },
  { _id: 'unavailable', name: 'Unavailable', type: '재료', category: 'material', tier: 1,
    spawnZones: [], recipe: { ingredients: [] } },
  ...[
    ['fallback-head', 'head', 4], ['fallback-clothes', 'clothes', 2], ['fallback-arm', 'arm', 1],
    ['fallback-shoes', 'shoes', 3], ['fallback-weapon', 'weapon', 1],
  ].map(([id, slot, tier]) => ({ _id: id, name: id, type: '장비', category: 'equipment', equipSlot: slot, tier,
    weaponType: slot === 'weapon' ? '권총' : undefined,
    recipe: { ingredients: [{ itemId: 'raw', qty: 1 }], resultQty: 1, creditsCost: 0 } })),
];
const mutableClothes = { itemId: 'bad-clothes', qty: 'not-a-quantity', equipSlot: 'clothes', tier: 6 };
const tierInventory = [
  { itemId: 'raw', qty: 1 },
  { itemId: 'worn-head', qty: 1, equipSlot: 'head', tier: 3, craftComponent: true },
  { itemId: 'unworn-head', qty: 1, equipSlot: 'head', tier: 5, craftComponent: true },
  { itemId: 'dup-shoe', qty: 0, equipSlot: 'shoes', tier: 1 },
  { itemId: 'dup-shoe', qty: 1, equipSlot: 'shoes', tier: 2 },
  mutableClothes,
  { itemId: 'negative-arm', qty: 1, equipSlot: 'arm', tier: -5 },
  { itemId: 'wrong-weapon', qty: 1, equipSlot: 'weapon', weaponType: '활', tier: 6 },
];
const tierActor = makeActor(tierInventory, { equipped: { head: 'worn-head' } });
const tierBySlot = () => Object.fromEntries(['weapon', 'head', 'clothes', 'arm', 'shoes']
  .map((slot) => [slot, getActorEquipmentTier(tierActor, slot)]));
const expectedRecoveryTarget = (tiers) => recoveryCatalog
  .filter((item) => item.category === 'equipment' && item._id.startsWith('fallback-')
    && item.tier > tiers[item.equipSlot] && item.tier <= 4
    && (item.equipSlot !== 'weapon' || item.weaponType === tierActor.weaponType))
  .sort((a, b) => tiers[a.equipSlot] - tiers[b.equipSlot]
    || b.tier - a.tier || a._id.localeCompare(b._id))[0]._id;
const assertRecoveryMatchesExportedTiers = (label) => {
  const expectedTiers = tierBySlot();
  const expectedTarget = expectedRecoveryTarget(expectedTiers);
  const result = buildActorGrowthPlan(tierActor, recoveryCatalog, options);
  assert.equal(result.stage, 'recovery', `${label}: blocked authored goal should use recovery`);
  assert.equal(result.targetId, expectedTarget,
    `${label}: fallback choice should rank from exported equipment tiers ${JSON.stringify(expectedTiers)}`);
  return { expectedTiers, targetId: result.targetId };
};
const initialTierRecovery = assertRecoveryMatchesExportedTiers('initial equipment state');
assert.deepEqual(initialTierRecovery.expectedTiers, { weapon: 0, head: 3, clothes: 0, arm: 0, shoes: 2 },
  'worn craft component, aggregate duplicate quantity, invalid quantity, negative tier, and weapon compatibility rules');
assert.equal(initialTierRecovery.targetId, 'fallback-clothes');
const originalTierInventory = tierActor.inventory;
mutableClothes.qty = 1;
const afterQuantityMutation = assertRecoveryMatchesExportedTiers('in-place quantity update');
assert.equal(afterQuantityMutation.expectedTiers.clothes, 6);
assert.equal(afterQuantityMutation.targetId, 'fallback-arm');
mutableClothes.equipSlot = 'arm';
const afterEquipmentMutation = assertRecoveryMatchesExportedTiers('in-place equipment update');
assert.equal(afterEquipmentMutation.expectedTiers.clothes, 0);
assert.equal(afterEquipmentMutation.expectedTiers.arm, 6);
assert.equal(afterEquipmentMutation.targetId, 'fallback-clothes');
assert.strictEqual(tierActor.inventory, originalTierInventory, 'fresh planning calls must not replace the caller inventory array');

console.log(JSON.stringify({ pass: true, recoveryCandidates, inventoryQuantityReads: quantityReads,
  stageTargets: [openingPlan.targetId, latePlan.targetId],
  equipmentMutationTargets: [initialTierRecovery.targetId, afterQuantityMutation.targetId, afterEquipmentMutation.targetId],
  scope: 'per-plan inventory-index reuse, independent-call freshness, equipment tier parity, and recipe overlay accounting; no browser or match benchmark' }));
