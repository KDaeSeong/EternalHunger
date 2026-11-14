import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';
const { saveGuestItem, readGuestItems, mergeGuestItemCatalog } = await import('../src/app/simulation/_lib/guestItemProfileRuntime.js');
const { buildItemIndexes, buildDay1TargetCandidatesBySlot } = await import('../src/app/simulation/_lib/routePlanBuilderRuntime.js');
const { buildDay1HeroRoutePlanDetails } = await import('../src/app/simulation/_lib/routePlanRuntime.js');
const { buildInitialFastRoutePlan, mergeInitialRoutePlanFields } = await import('../src/app/simulation/_lib/simulationInitialRosterRuntime.js');
const { getActorGrowthProgress, refreshActorGrowthPlan } = await import('../src/app/simulation/_lib/growthPlanRuntime.js');
const { getOpeningGrowthTargetByKey } = await import('../src/app/simulation/_lib/growthTargetIdentityRuntime.js');
const { tryAutoCraftFromInventory } = await import('../src/app/simulation/_lib/gearInventoryCraftRuntime.js');
const { addItemToInventory, invQty } = await import('../src/app/simulation/_lib/inventoryRules.js');

// Actual guest storage and runtime functions on disposable authored data.
// Seeded inventory below is a controlled crafting boundary, not a natural-match claim.
const rules = { inventory: { maxSlots: 10, stackMax: { material: 10, equipment: 1, consumable: 6 }, autoDropLowValue: false } };
function fixture({ primary = 'original-head-key', alias = 'edited-head-alias', ordered = [] } = {}) {
  const a = { _id: 'source:alias-a', name: '지정 재료', type: '재료', tier: 1, spawnZones: ['a'] };
  const b = { _id: 'source:alias-b', name: '다른 재료', type: '재료', tier: 1, spawnZones: ['b'] };
  const target = { _id: '64b000000000000000000001', itemKey: primary, externalId: 'old-head-alias',
    name: '직접 지정 투구', type: '방어구', equipSlot: 'head', tier: 4,
    recipe: { ingredients: [{ itemId: a._id, qty: 1 }], creditsCost: 2, resultQty: 1 } };
  const alternative = { _id: '64b000000000000000000002', itemKey: 'other-head-key', name: '다른 투구',
    type: '방어구', equipSlot: 'head', tier: 4,
    recipe: { ingredients: [{ itemId: b._id, qty: 1 }], creditsCost: 1, resultQty: 1 } };
  const otherSlots = ['weapon', 'clothes', 'arm', 'shoes'].map(slot => ({
    _id: 'builtin:alias-' + slot, name: slot + ' 준비 장비', type: slot === 'weapon' ? '무기' : '방어구',
    equipSlot: slot, tier: 4, ...(slot === 'weapon' ? { weaponType: '단검' } : {}),
    recipe: { ingredients: [{ itemId: b._id, qty: 1 }], creditsCost: 0, resultQty: 1 },
  }));
  const builtin = [...ordered, a, b, alternative, target, ...otherSlots];
  const before = structuredClone(builtin), rows = new Map();
  const storage = { getItem: key => rows.get(key) ?? null, setItem: (key, value) => rows.set(key, value) };
  assert.equal(saveGuestItem({ ...target, externalId: alias }, builtin, storage).ok, true);
  assert.equal(readGuestItems(builtin, storage).ok, true);
  const items = mergeGuestItemCatalog(builtin, { storage });
  assert.deepEqual(builtin, before, 'Saving local edits must preserve the built-in catalog');
  const loaded = items.find(item => item._id === target._id);
  assert.equal(loaded.itemKey, primary);
  assert.equal(loaded.externalId, alias);
  const actor = { _id: 'opening-alias-actor', name: '별칭 검사 대원', hp: 100, maxHp: 100,
    stats: {}, simCredits: 20, inventory: [], equipped: {}, zoneId: 'b', weaponType: '단검',
    goalLoadouts: { hero: { headKey: alias, ...Object.fromEntries(otherSlots.map(item => [item.equipSlot + 'Key', item._id])) } } };
  const map = { zones: [{ zoneId: 'a', name: 'a' }, { zoneId: 'b', name: 'b' }] };
  return { items, builtin, actor, map, target: loaded, alternative, a, b, otherSlots, storage };
}
const candidates = f => buildDay1TargetCandidatesBySlot(f.actor, f.items, buildItemIndexes(f.items), f.map).get('head') || [];
let passed = 0, failed = 0;
function check(name, run) {
  try { run(); passed++; console.log('PASS ' + name); }
  catch (error) { failed++; console.error('FAIL ' + name + ': ' + error.message); }
}
check('saved secondary alias remains an explicit initial target instead of an ordinary fallback', () => {
  const f = fixture(), rows = candidates(f);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].goal, true);
  assert.equal(rows[0].item._id, f.target._id);
  assert.deepEqual(rows[0].requirements.map(row => row.itemId), [f.a._id]);
});
check('ID, primary key and secondary alias point to the same original catalog object', () => {
  const f = fixture(), indexes = buildItemIndexes(f.items);
  for (const key of [f.target._id, f.target.itemKey, f.target.externalId]) {
    assert.equal(indexes.byKey.get(key), f.target, key);
    assert.equal(getOpeningGrowthTargetByKey(f.items, key), f.target, key);
  }
  assert.equal(indexes.byId.get(f.target._id), f.target);
});
check('all five route targets and required raw materials agree with the authored alias', () => {
  const f = fixture(), details = buildDay1HeroRoutePlanDetails(f.actor, f.map, f.items);
  assert.equal(details.complete, true);
  assert.equal(details.targetItemIds.length, 5);
  assert.ok(details.targetItemIds.includes(f.target._id));
  assert.ok(!details.targetItemIds.includes(f.alternative._id));
  assert.ok(details.requiredItemIds.includes(f.a._id));
  assert.ok(details.requiredItemIds.includes(f.b._id));
});
check('initial fast-route fields and growth progress retain the same canonical target', () => {
  const f = fixture();
  const planned = mergeInitialRoutePlanFields(f.actor, buildInitialFastRoutePlan(f.actor, f.map, f.items));
  assert.ok(planned.routePlanTargetItemIds.includes(f.target._id));
  assert.ok(!planned.routePlanTargetItemIds.includes(f.alternative._id));
  const progress = getActorGrowthProgress(planned, f.items);
  assert.equal(progress.goalIssues.length, 0);
  assert.ok(progress.remaining.some(item => item._id === f.target._id));
  assert.equal(progress.openingComplete, false);
});
check('first catalog alias wins even if a later row uses it as its primary key', () => {
  const first = { _id: 'first-alias-row', itemKey: 'different-primary', externalId: 'edited-head-alias',
    name: '먼저 등록된 재료', type: '재료', tier: 1, spawnZones: ['a'] };
  const f = fixture({ ordered: [first] }), indexes = buildItemIndexes(f.items);
  assert.equal(indexes.byKey.get('edited-head-alias'), f.items[0]);
  assert.equal(getOpeningGrowthTargetByKey(f.items, 'edited-head-alias'), f.items[0]);
  assert.ok(getActorGrowthProgress(f.actor, f.items).goalIssues.some(row => row.reason === 'not_equipment'));
  assert.ok(candidates(f).every(row => row.goal !== true));
});
check('catalog order remains stable when a secondary alias collides with a later canonical ID', () => {
  const first = { _id: 'first-canonical-shadow', itemKey: 'first-primary', externalId: '64b000000000000000000001',
    name: '먼저 등록된 별칭', type: '재료', tier: 1, spawnZones: ['a'] };
  const f = fixture({ ordered: [first] }), indexes = buildItemIndexes(f.items);
  assert.equal(indexes.byKey.get(f.target._id), f.items[0]);
  assert.equal(indexes.byId.get(f.target._id), f.target, 'ID lookup is separate from first-alias lookup');
  assert.equal(getOpeningGrowthTargetByKey(f.items, f.target._id), f.items[0]);
});
check('a blank primary key does not hide a valid secondary alias', () => {
  const f = fixture({ primary: '   ', alias: 'secondary-without-primary' });
  assert.equal(candidates(f)[0].goal, true);
  assert.equal(candidates(f)[0].item._id, f.target._id);
});
check('all valid saved alias strings use Map semantics and preserve the declared item', () => {
  for (const alias of ['constructor', '__proto__', 'toString', '한글 별칭', ' spaced-alias ']) {
    const f = fixture({ alias });
    const rows = candidates(f);
    assert.equal(rows[0].goal, true, alias);
    assert.equal(rows[0].item._id, f.target._id, alias);
  }
  assert.equal(Object.prototype.polluted, undefined);
});
check('unknown keys still produce a fallback and a visible unresolved growth declaration', () => {
  const f = fixture(); f.actor.goalLoadouts.hero.headKey = 'unknown-key';
  assert.ok(candidates(f).every(row => row.goal !== true));
  assert.ok(getActorGrowthProgress(f.actor, f.items).goalIssues.some(row => row.reason === 'missing_target'));
  assert.equal(buildItemIndexes(f.items).byKey.get('unknown-key'), undefined);
});
check('current growth planning canonicalizes the alias before an atomic same-tier target craft', () => {
  const f = fixture();
  for (const item of [...f.otherSlots, f.alternative]) {
    f.actor.inventory = addItemToInventory(f.actor.inventory, item, item._id, 1, 1, rules);
    f.actor.equipped[item.equipSlot] = item._id;
  }
  f.actor.inventory = addItemToInventory(f.actor.inventory, f.a, f.a._id, 1, 1, rules);
  f.actor._actionCycleKey = 'alias:1';
  refreshActorGrowthPlan(f.actor, f.items, { mapObj: f.map, zoneGraph: { a: ['b'], b: ['a'] }, ruleset: rules });
  assert.equal(f.actor._growthPlan.targetId, f.target._id);
  assert.equal(f.actor._growthPlan.targetKey, f.target.itemKey);
  const metadata = Object.fromEntries(f.items.map(item => [item._id, item]));
  const result = tryAutoCraftFromInventory(f.actor, [f.target], {}, metadata, 1, 0, rules, f.items);
  assert.equal(result?.changed, true);
  assert.equal(result.craftedId, f.target._id);
  assert.equal(result.receipt.paidCost, 2);
  assert.equal(f.actor.simCredits, 18);
  assert.equal(invQty(f.actor.inventory, f.a._id), 0);
  assert.equal(invQty(f.actor.inventory, f.target._id), 1);
  assert.equal(f.actor.equipped.head, f.target._id);
  assert.equal(getActorGrowthProgress(f.actor, f.items).openingComplete, true);
});
check('lookups and route previews leave catalog, actor, saved bytes and ambient RNG unchanged', () => {
  const f = fixture(), before = structuredClone({ actor: f.actor, items: f.items });
  const saved = f.storage.getItem('eh_guest_item_profiles_v1'), random = Math.random;
  try {
    Math.random = () => { throw new Error('Route alias lookup consumed ambient RNG'); };
    buildItemIndexes(f.items); candidates(f);
    buildDay1HeroRoutePlanDetails(f.actor, f.map, f.items);
    getActorGrowthProgress(f.actor, f.items);
  } finally { Math.random = random; }
  assert.deepEqual({ actor: f.actor, items: f.items }, before);
  assert.equal(f.storage.getItem('eh_guest_item_profiles_v1'), saved);
});
console.log('RESULT opening-goal-alias passed=' + passed + ' failed=' + failed + ' scope=in-memory-authoring-route-and-controlled-craft; not full match/browser');
if (failed) process.exitCode = 1;
