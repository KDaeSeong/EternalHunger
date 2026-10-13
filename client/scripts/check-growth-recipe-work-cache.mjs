import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';

const { getGrowthRecipeWork } = await import('../src/app/simulation/_lib/growthPlanRuntime.js');
const { getCraftRecipeTerms } = await import('../src/app/simulation/_lib/gearRecipeGuardRuntime.js');
const { canReceiveItem, getInvItemId, getInvRules, inferEquipSlot } = await import('../src/app/simulation/_lib/inventoryRules.js');
const { areEquipmentWeaponTypesCompatible } = await import('../src/utils/equipmentCatalog.js');
const { prepareCraftTransaction } = await import('../src/app/simulation/_lib/craftTransactionRuntime.js');

// Deliberately preserve the pre-cache growth-work algorithm as an independent oracle.
function referenceGrowthRecipeWork(actor, items, targetId, { ruleset, targetIds = [targetId] } = {}) {
  const byId = new Map(items.map((item) => [String(item._id), item]));
  const target = byId.get(String(targetId));
  const inventory = actor.inventory || [];
  const work = { craftIds: [], missing: [], reservedQtyById: {}, componentIds: [], readyCraftId: '', blocked: '',
    requiredCredits: 0, availableCredits: Number(actor?.simCredits ?? 0), plannedCredits: 0 };
  if (!target) return { ...work, blocked: 'invalid_recipe' };
  if (inferEquipSlot(target) === 'weapon' && !areEquipmentWeaponTypesCompatible(actor.weaponType, target.weaponType)) {
    return { ...work, blocked: 'weapon_mismatch' };
  }
  const inventoryQuantities = new Map();
  for (const entry of inventory) {
    const id = getInvItemId(entry);
    if (!inventoryQuantities.has(id)) inventoryQuantities.set(id, 0);
    if (!id) continue;
    const raw = entry?.qty === undefined ? 1 : entry.qty;
    const qty = typeof raw === 'number' || (typeof raw === 'string' && raw.trim()) ? Number(raw) : NaN;
    if (Number.isSafeInteger(qty) && qty > 0) inventoryQuantities.set(id, inventoryQuantities.get(id) + qty);
  }
  const availableOverrides = new Map();
  const availableQty = (id) => availableOverrides.has(id) ? availableOverrides.get(id) : inventoryQuantities.get(id);
  const missing = new Map();
  const components = new Set();
  const craftIds = new Set();
  const reserved = {};
  function visit(id, qty, path) {
    if (!Number.isSafeInteger(qty) || qty <= 0) { work.blocked = 'invalid_recipe'; return; }
    const item = byId.get(id);
    const stock = availableQty(id) || 0;
    if (!Number.isSafeInteger(stock) || stock < 0) { work.blocked = 'invalid_recipe'; return; }
    const have = Math.min(qty, stock);
    availableOverrides.set(id, stock - have);
    if (id !== target._id) {
      const total = (reserved[id] || 0) + qty;
      if (!Number.isSafeInteger(total)) { work.blocked = 'invalid_recipe'; return; }
      components.add(id); reserved[id] = total;
    }
    const need = qty - have;
    if (need <= 0) return;
    // Match the accepted acyclic catalog contract, not the retired depth cap.
    if (!item || path.has(id) || path.size >= byId.size) { work.blocked = 'invalid_recipe'; return; }
    if (Array.isArray(item.recipe?.ingredients) && item.recipe.ingredients.length) {
      const terms = getCraftRecipeTerms(item);
      if (!terms) { work.blocked = 'invalid_recipe'; return; }
      const batches = Math.ceil(need / terms.resultQty);
      const cost = batches * terms.creditsCost;
      if (!Number.isSafeInteger(batches * terms.resultQty) || !Number.isSafeInteger(work.plannedCredits + cost)) {
        work.blocked = 'invalid_recipe'; return;
      }
      const nextPath = new Set(path).add(id);
      for (const row of terms.ingredients) visit(String(row.itemId), batches * row.qty, nextPath);
      if (!Number.isSafeInteger(work.plannedCredits + cost)) { work.blocked = 'invalid_recipe'; return; }
      const surplus = (availableQty(id) || 0) + (batches * terms.resultQty - need);
      if (!Number.isSafeInteger(surplus) || surplus < 0) { work.blocked = 'invalid_recipe'; return; }
      availableOverrides.set(id, surplus);
      work.plannedCredits += cost;
      craftIds.add(id);
    } else {
      const total = (missing.get(id) || 0) + need;
      if (!Number.isSafeInteger(total)) { work.blocked = 'invalid_recipe'; return; }
      missing.set(id, total);
    }
  }
  visit(String(target._id), 1, new Set());
  work.craftIds = [...craftIds];
  work.componentIds = [...components];
  work.reservedQtyById = reserved;
  const materialReady = work.craftIds.filter((id) => getCraftRecipeTerms(byId.get(id))?.ingredients
    .every((row) => (inventoryQuantities.get(row.itemId) || 0) >= row.qty));
  const affordable = materialReady.filter((id) => getCraftRecipeTerms(byId.get(id)).creditsCost <= work.availableCredits);
  work.readyCraftId = affordable[0] || '';
  if (!work.blocked && work.readyCraftId && ruleset) {
    const previewCapacity = inventory.length >= getInvRules(ruleset).maxSlots
      || affordable.some((id) => getCraftRecipeTerms(byId.get(id)).resultQty > 1 || inventoryQuantities.get(id) > 0);
    if (previewCapacity) {
      const context = { _growthPlan: { targetIds, componentIds: work.componentIds } };
      const markGrowthComponent = (item) => {
        if (item && context._growthPlan.targetIds.includes(String(item._id || item.itemId))) {
          return { ...item, _forceReplaceSameTier: true };
        }
        if (!item || !context._growthPlan.componentIds.includes(String(item._id || item.itemId))) return item;
        return { ...item, craftComponent: !!inferEquipSlot(item), goalItem: true, _growthReserved: true,
          tags: [...new Set([...(item.tags || []), 'growth_goal'])] };
      };
      work.readyCraftId = affordable.find((id) => prepareCraftTransaction(actor,
        markGrowthComponent(byId.get(id)), 1, ruleset).ok) || '';
      if (!work.readyCraftId) {
        const canContinueFarming = [...missing.keys()].some((id) => canReceiveItem(inventory,
          markGrowthComponent(byId.get(id)), id, 1, ruleset));
        if (!canContinueFarming) work.blocked = 'inventory_full';
      }
    }
  }
  work.requiredCredits = materialReady.length ? getCraftRecipeTerms(byId.get(work.readyCraftId || materialReady[0])).creditsCost : 0;
  work.missing = [...missing].map(([id, qty]) => ({ itemId: id, name: byId.get(id)?.name || id,
    need: qty, have: inventoryQuantities.get(id) || 0 }));
  if (!work.blocked && materialReady.length && !work.readyCraftId && !work.missing.length) work.blocked = 'insufficient_credits';
  return work;
}

const material = (id, extra = {}) => ({ _id: id, name: id, type: '재료', category: 'material', tier: 1, ...extra });
const gear = (id, ingredients, extra = {}) => ({ _id: id, name: id, type: '방어구', category: 'equipment',
  equipSlot: 'head', tier: 2, recipe: { ingredients, resultQty: 1, creditsCost: 0 }, ...extra });
const actor = (inventory = [], extra = {}) => ({ _id: 'fixture-actor', name: 'Fixture', hp: 100, maxHp: 100,
  simCredits: 100, weaponType: '권총', inventory, equipped: {}, ...extra });
let compared = 0;
function compare(name, who, items, targetId, options = {}) {
  const actorBefore = structuredClone(who);
  const itemsBefore = structuredClone(items);
  const expected = referenceGrowthRecipeWork(who, items, targetId, options);
  const actual = getGrowthRecipeWork(who, items, targetId, options);
  assert.deepEqual(actual, expected, `${name}: public result must match the uncached reference exactly`);
  assert.deepEqual(who, actorBefore, `${name}: actor must remain unchanged`);
  assert.deepEqual(items, itemsBefore, `${name}: catalog items must remain unchanged`);
  compared += 1;
}

const shared = material('shared-raw');
const sharedA = material('shared-a', { recipe: { ingredients: [{ itemId: 'shared-raw', qty: 2 }, { itemId: 'shared-raw', qty: 1 }], resultQty: 2, creditsCost: 3 } });
const branchA = material('branch-a', { recipe: { ingredients: [{ itemId: 'shared-a', qty: 1 }], resultQty: 1, creditsCost: 2 } });
const branchB = material('branch-b', { recipe: { ingredients: [{ itemId: 'shared-a', qty: 1 }], resultQty: 1, creditsCost: 4 } });
const sharedDag = [shared, sharedA, branchA, branchB, gear('dag-target', [
  { itemId: 'branch-a', qty: 1 }, { itemId: 'branch-b', qty: 1 }, { itemId: 'branch-a', qty: 1 },
])];
compare('shared DAG, duplicate root ingredient, virtual surplus versus actual inventory', actor([{ itemId: 'shared-raw', qty: 1 }]), sharedDag, 'dag-target');
compare('existing intermediate inventory', actor([{ itemId: 'shared-a', qty: 2 }, { itemId: 'shared-raw', qty: 3 }]), sharedDag, 'dag-target');
function takePermutations(values, limit) {
  const result = [];
  function visit(prefix, rest) {
    if (result.length >= limit) return;
    if (!rest.length) { result.push(prefix); return; }
    for (let i = 0; i < rest.length && result.length < limit; i += 1) {
      visit([...prefix, rest[i]], [...rest.slice(0, i), ...rest.slice(i + 1)]);
    }
  }
  visit([], values);
  return result;
}
for (const [index, permutation] of takePermutations(sharedDag, 6).entries()) {
  compare(`shared DAG catalog permutation ${index + 1}`, actor([{ itemId: 'shared-raw', qty: 1 }]), permutation, 'dag-target');
}
compare('credits insufficient', actor([{ itemId: 'ore', qty: 5 }], { simCredits: 0 }),
  [material('ore'), gear('cost-target', [{ itemId: 'ore', qty: 2 }], { recipe: { ingredients: [{ itemId: 'ore', qty: 2 }], resultQty: 1, creditsCost: 5 } })], 'cost-target');

const orderedItems = [material('first'), material('second'), gear('ordered', [
  { itemId: 'second', qty: 2 }, { itemId: 'first', qty: 1 }, { itemId: 'second', qty: 1 },
])];
const ordered = referenceGrowthRecipeWork(actor([]), orderedItems, 'ordered');
assert.deepEqual(ordered.craftIds, ['ordered']);
assert.deepEqual(ordered.componentIds, ['second', 'first']);
assert.deepEqual(ordered.missing.map(({ itemId, need }) => [itemId, need]), [['second', 3], ['first', 1]]);
compare('duplicate ingredients retain first-seen component and missing order', actor([]), orderedItems, 'ordered');

const invalidCases = [
  ['zero quantity', [{ itemId: 'raw', qty: 0 }]],
  ['nonnumeric quantity', [{ itemId: 'raw', qty: 'many' }]],
  ['ingredient sum overflow', [{ itemId: 'raw', qty: Number.MAX_SAFE_INTEGER }, { itemId: 'raw', qty: 1 }]],
];
for (const [label, ingredients] of invalidCases) {
  compare(`invalid ${label}`, actor([]), [material('raw'), gear(`invalid-${label}`, ingredients)], `invalid-${label}`);
}

const cycleA = material('cycle-a', { recipe: { ingredients: [{ itemId: 'cycle-b', qty: 1 }], resultQty: 1, creditsCost: 0 } });
const cycleB = material('cycle-b', { recipe: { ingredients: [{ itemId: 'cycle-a', qty: 1 }], resultQty: 1, creditsCost: 0 } });
compare('cycle', actor([]), [cycleA, cycleB], 'cycle-a');
const deepChain = Array.from({ length: 22 }, (_, i) => material(`depth-${i}`, {
  recipe: i === 21 ? undefined : { ingredients: [{ itemId: `depth-${i + 1}`, qty: 1 }], resultQty: 1, creditsCost: 0 },
}));
compare('acyclic depth 21 catalog is valid', actor([]), deepChain, 'depth-0');
compare('missing catalog ID', actor([]), [gear('missing-target', [{ itemId: 'absent', qty: 2 }])], 'missing-target');
compare('empty recipe', actor([]), [gear('empty-target', [])], 'empty-target');
compare('absent target ID', actor([]), [material('raw')], 'absent-target');
compare('incompatible weapon target', actor([], { weaponType: '권총' }), [
  material('ore'), { _id: 'bow-target', name: 'Bow', type: '무기', category: 'equipment', equipSlot: 'weapon', weaponType: '활',
    recipe: { ingredients: [{ itemId: 'ore', qty: 1 }], resultQty: 1, creditsCost: 0 } },
], 'bow-target');
const blockedCapacityWork = referenceGrowthRecipeWork(actor([
  { itemId: 'ore', qty: 2, goalItem: true, _growthReserved: true },
  ...Array.from({ length: 2 }, (_, i) => ({ itemId: `filler-${i}`, qty: 1, goalItem: true, _growthReserved: true,
    craftComponent: true })),
], { simCredits: 100 }), [material('ore'), gear('capacity-target', [{ itemId: 'ore', qty: 1 }])], 'capacity-target', {
  ruleset: { inventory: { maxSlots: 3 } }, targetIds: ['capacity-target'],
});
assert.equal(blockedCapacityWork.blocked, 'inventory_full', 'full bag with a protected ore remainder must reject receipt');
assert.equal(blockedCapacityWork.readyCraftId, '', 'blocked receipt must not retain a craft target');
compare('full-bag capacity preview rejection with protected ingredient remainder', actor([
  { itemId: 'ore', qty: 2, goalItem: true, _growthReserved: true },
  ...Array.from({ length: 2 }, (_, i) => ({ itemId: `filler-${i}`, qty: 1, goalItem: true, _growthReserved: true,
    craftComponent: true })),
], { simCredits: 100 }), [material('ore'), gear('capacity-target', [{ itemId: 'ore', qty: 1 }])], 'capacity-target', {
  ruleset: { inventory: { maxSlots: 3 } }, targetIds: ['capacity-target'],
});

const firstAffordable = material('first-affordable', { recipe: { ingredients: [{ itemId: 'raw-first', qty: 1 }], resultQty: 1, creditsCost: 0 } });
const secondAffordable = { _id: 'second-affordable', name: 'Second Affordable', type: '소모품', category: 'consumable',
  recipe: { ingredients: [{ itemId: 'raw-second', qty: 1 }], resultQty: 2, creditsCost: 0 } };
const multipleAffordableItems = [material('raw-first'), material('raw-second'), firstAffordable, secondAffordable,
  gear('multiple-affordable-target', [{ itemId: 'first-affordable', qty: 2 }, { itemId: 'second-affordable', qty: 2 }])];
const multipleAffordableActor = actor([
  { itemId: 'raw-first', qty: 1 }, { itemId: 'raw-second', qty: 1 },
  { itemId: 'first-affordable', qty: 1 }, { itemId: 'second-affordable', qty: 1 },
  { itemId: 'filler-a', qty: 1 }, { itemId: 'filler-b', qty: 1 },
]);
const multiOptions = { ruleset: { inventory: { maxSlots: 6, stackMax: { material: 1, consumable: 10 } } },
  targetIds: ['multiple-affordable-target'] };
const multipleExpected = referenceGrowthRecipeWork(multipleAffordableActor, multipleAffordableItems,
  'multiple-affordable-target', multiOptions);
assert.equal(multipleExpected.readyCraftId, 'second-affordable', 'later affordable output should fit its existing stack');
compare('multiple affordable candidates choose later receivable output', multipleAffordableActor, multipleAffordableItems,
  'multiple-affordable-target', multiOptions);

const stackOutput = { _id: 'stack-output', name: 'Stack Output', type: '재료', category: 'material',
  recipe: { ingredients: [{ itemId: 'stack-raw', qty: 1 }], resultQty: 2, creditsCost: 0 } };
const stackRoot = gear('stack-root', [{ itemId: 'stack-output', qty: 2 }]);
const stackActor = actor([{ itemId: 'stack-raw', qty: 1 }, { itemId: 'stack-output', qty: 1 }, { itemId: 'stack-filler', qty: 1 }]);
const stackOptions = { ruleset: { inventory: { maxSlots: 3, stackMax: { material: 10 } } }, targetIds: ['stack-root'] };
const stackExpected = referenceGrowthRecipeWork(stackActor, [material('stack-raw'), stackOutput, stackRoot], 'stack-root', stackOptions);
assert.equal(stackExpected.readyCraftId, 'stack-output', 'qty>1 output should merge into the existing partial stack');
compare('full bag accepts qty>1 output into existing stack', stackActor, [material('stack-raw'), stackOutput, stackRoot], 'stack-root', stackOptions);

// Mutate existing catalog objects in place between public calls. Catalog array shape and _id stay fixed.
const mutableRaw = material('mutable-raw');
const mutableAltRaw = material('mutable-alt-raw');
const mutableTarget = gear('mutable-target', [{ itemId: 'mutable-raw', qty: 1 }]);
const mutableItems = [mutableRaw, mutableAltRaw, mutableTarget];
const mutableActor = actor([{ itemId: 'mutable-raw', qty: 1 }, { itemId: 'mutable-alt-raw', qty: 2 }]);
compare('mutable recipe initial', mutableActor, mutableItems, 'mutable-target');
mutableTarget.recipe.ingredients[0].qty = 2;
compare('same ingredient object qty mutation between calls', mutableActor, mutableItems, 'mutable-target');
mutableTarget.recipe.resultQty = 3;
mutableTarget.recipe.creditsCost = 7;
compare('same recipe resultQty and creditsCost mutation between calls', mutableActor, mutableItems, 'mutable-target');
mutableTarget.recipe.resultQty = 0;
compare('invalid resultQty returns invalid recipe after prior valid call', mutableActor, mutableItems, 'mutable-target');
mutableTarget.recipe.resultQty = 2;
mutableTarget.recipe.creditsCost = -1;
compare('invalid creditsCost returns invalid recipe after prior valid call', mutableActor, mutableItems, 'mutable-target');
mutableTarget.recipe.creditsCost = 1;
compare('valid terms refresh after invalid resultQty and creditsCost calls', mutableActor, mutableItems, 'mutable-target');
mutableTarget.lockedByAdmin = 'deleted';
compare('same item deletion lock mutation between calls', mutableActor, mutableItems, 'mutable-target');
mutableTarget.lockedByAdmin = undefined;
mutableTarget.recipe = { ingredients: [{ itemId: 'mutable-raw', qty: 1 }], resultQty: 2, creditsCost: 1 };
compare('same item recipe replacement between calls', mutableActor, mutableItems, 'mutable-target');
mutableTarget.recipe.ingredients[0].itemId = 'mutable-alt-raw';
compare('same ingredient row itemId mutation between calls', mutableActor, mutableItems, 'mutable-target');
const changedIngredientWork = getGrowthRecipeWork(mutableActor, mutableItems, 'mutable-target');
assert.deepEqual(changedIngredientWork.componentIds, ['mutable-alt-raw']);
assert.equal(changedIngredientWork.reservedQtyById['mutable-raw'], undefined);
assert.equal(changedIngredientWork.reservedQtyById['mutable-alt-raw'], 1);
assert.equal(changedIngredientWork.readyCraftId, 'mutable-target');

const overflowItems = [material('overflow-raw-a'), material('overflow-raw-b'),
  material('overflow-a', { recipe: { ingredients: [{ itemId: 'overflow-raw-a', qty: 1 }], resultQty: 1, creditsCost: Number.MAX_SAFE_INTEGER } }),
  material('overflow-b', { recipe: { ingredients: [{ itemId: 'overflow-raw-b', qty: 1 }], resultQty: 1, creditsCost: 1 } }),
  gear('overflow-target', [{ itemId: 'overflow-a', qty: 1 }, { itemId: 'overflow-b', qty: 1 }])];
compare('planned credits overflow', actor([{ itemId: 'overflow-raw-a', qty: 1 }, { itemId: 'overflow-raw-b', qty: 1 }]),
  overflowItems, 'overflow-target');
const multiplyItems = [material('multiply-raw'),
  material('multiply-mid', { recipe: { ingredients: [{ itemId: 'multiply-raw', qty: Number.MAX_SAFE_INTEGER }], resultQty: 1, creditsCost: 0 } }),
  gear('multiply-target', [{ itemId: 'multiply-mid', qty: 2 }])];
compare('ingredient quantity multiplication overflow', actor([]), multiplyItems, 'multiply-target');

const oneIngredient = { itemId: 'watched-raw', qty: 1 };
let qtyReads = 0;
const watchedIngredient = new Proxy(oneIngredient, { get(target, property, receiver) {
  if (property === 'qty') qtyReads += 1;
  return Reflect.get(target, property, receiver);
} });
const measuredItems = [material('watched-raw'), gear('watched-target', [watchedIngredient])];
const measuredActor = actor([{ itemId: 'watched-raw', qty: 1 }]);
const measuredExpected = referenceGrowthRecipeWork(measuredActor,
  [material('watched-raw'), gear('watched-target', [oneIngredient])], 'watched-target');
const measuredResult = getGrowthRecipeWork(measuredActor, measuredItems, 'watched-target');
assert.deepEqual(measuredResult, measuredExpected, 'read reduction must preserve the actual recipe work');
assert.equal(qtyReads, 2,
  `one ruleset-free ready recipe should normalize its ingredient once (guard reads qty twice); observed ${qtyReads} reads`);

console.log(`PASS ${compared} exact reference comparisons; one-call recipe reads=${qtyReads}`);
