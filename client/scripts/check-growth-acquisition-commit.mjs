import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';
const { refreshActorGrowthPlan, getActorGrowthProgress } = await import('../src/app/simulation/_lib/growthPlanRuntime.js');
const { tryAutoCraftFromLoot } = await import('../src/app/simulation/_lib/craftRuntime.js');
const { applyLootCraftResult } = await import('../src/app/simulation/_lib/lootCraftResultRuntime.js');
const { prepareCraftTransaction, commitCraftTransaction } = await import('../src/app/simulation/_lib/craftTransactionRuntime.js');
const { buildItemMetaById, buildItemNameById } = await import('../src/app/simulation/_lib/itemOptionsRuntime.js');
const { getLootCraftOptions } = await import('../src/app/simulation/_lib/runEventRuntime.js');
const { openLegendaryCrateForActor } = await import('../src/app/simulation/_lib/phaseLegendaryCrateRuntime.js');
const { withSimulationRandom } = await import('../src/utils/simulationRandom.js');
const { getRuleset } = await import('../src/utils/rulesets.js');
const { runHuntAction } = await import('../src/app/simulation/_lib/phaseHuntActionRuntime.js');
const { tryImmediateCraftFromSpecial } = await import('../src/app/simulation/_lib/gearImmediateSpecialCraftRuntime.js');
const { tryAutoCraftFromInventory } = await import('../src/app/simulation/_lib/gearInventoryCraftRuntime.js');
const types = { head: '머리', weapon: '무기', clothes: '옷', arm: '팔', shoes: '신발' };
const gear = (id, slot, tier, ingredients = []) => ({ _id: id, itemKey: `${id}-key`, name: id,
  category: 'equipment', type: types[slot], equipSlot: slot, tier, weaponType: slot === 'weapon' ? '검' : '',
  recipe: { ingredients, creditsCost: tier === 5 ? 2 : tier === 6 ? 3 : 0 } });
const raw = (id, name) => ({ _id: id, name, category: 'material', type: '재료', tier: 1, spawnZones: ['a'] });
const materials = [raw('raw1', '미스릴'), raw('raw2', '운석')];
const basics = Object.keys(types).map(slot => gear(`basic-${slot}`, slot, 4));
const legend = gear('legend', 'head', 5, [{ itemId: 'raw1', qty: 1 }]);
const trans = gear('trans', 'head', 6, [{ itemId: 'legend', qty: 1 }, { itemId: 'raw2', qty: 1 }]);
const items = [...materials, ...basics, legend, trans], meta = buildItemMetaById(items), names = buildItemNameById(items);
const baseRules = getRuleset('ER_S11');
const ruleset = { ...baseRules, worldSpawns: { ...baseRules.worldSpawns, legendaryCrate: {
  ...baseRules.worldSpawns?.legendaryCrate, openChance: { day: { stay: 1 } },
  reward: { credits: { min: 0, max: 0 }, bonusDropChance: 1 },
} } };
const world = { mapObj: { zones: [{ zoneId: 'a' }] }, zoneGraph: { a: [] }, forbiddenIds: new Set(), ruleset };
function fixture({ supplies = true, direct = true } = {}) {
  const actor = { _id: 'actor', name: 'actor', hp: 100, maxHp: 100, weaponType: '검', zoneId: 'a', simCredits: 30,
    inventory: [...basics, ...(supplies ? materials : [])].map(item => ({ ...item, itemId: item._id, qty: 1 })),
    equipped: Object.fromEntries(basics.map(item => [item.equipSlot, item._id])), routePlanTargetItemIds: [],
    ...(direct ? { goalLoadouts: { legend: { headKey: legend.itemKey }, transcend: { headKey: trans._id } } } : {}) };
  refreshActorGrowthPlan(actor, items, world); return actor;
}
function loot(actor, id) {
  const result = withSimulationRandom(() => 0, () => tryAutoCraftFromLoot(actor.inventory, id, items,
    names, meta, 3, ruleset, getLootCraftOptions(actor, items)));
  assert.ok(result); assert.equal(applyLootCraftResult(actor, result, meta), true); return result;
}
let checks = 0;
const check = (name, fn) => { fn(); checks++; console.log(`PASS ${name}`); };

check('JSON-restored legacy plan records consecutive real receipts without replanning', () => {
  const actor = JSON.parse(JSON.stringify(fixture()));
  assert.equal(Object.hasOwn(actor._growthPlan ?? {}, 'authoredTargetsByGroup'), false);
  // An old snapshot may still carry obsolete identity data. Neither commit
  // nor normal refresh uses it as authority for a new acquisition.
  actor._growthPlan.authoredTargetsByGroup = { legend: { head: { key: legend.itemKey, itemId: 'wrong-old-id' } } };
  loot(actor, 'raw1'); loot(actor, 'raw2');
  assert.deepEqual(actor._lateAcquiredItemIds, { legend: { head: 'legend' }, transcend: { head: 'trans' } });
  assert.equal(refreshActorGrowthPlan(actor, items, world)?.targetId || '', '');
  assert.equal(Object.hasOwn(actor._growthPlan ?? {}, 'authoredTargetsByGroup'), false);
});

check('real held hunt settlement and shared boss recipient retain legacy-plan acquisitions', () => {
  for (const shared of [false, true]) {
    const recipient = JSON.parse(JSON.stringify(fixture({ supplies: false })));
    delete recipient._growthPlan.authoredTargetsByGroup;
    recipient.teamId = 'team:1'; recipient.teamSlot = 1;
    const hunter = shared ? { ...fixture({ supplies: false, direct: false }), _id: 'hunter', teamId: 'team:1', teamSlot: 2 } : recipient;
    if (!shared) hunter._wildlifeHunt = { id: 'held-hunt' };
    const events = [];
    const result = withSimulationRandom(() => 0, () => runHuntAction({ state: {
      actor: hunter, publicItems: items, craftables: [legend, trans], itemNameById: names, itemMetaById: meta,
      ruleset, mapObj: world.mapObj, nextDay: 1, nextPhase: 'morning', phaseIdxNow: 1,
      preparedHunt: { defeated: true, damage: 0, kind: 'bear', log: 'test hunt',
        drops: materials.map(item => ({ itemId: item._id, qty: 1, item })) },
      preparedHuntRole: shared ? 'boss' : 'wildlife', rewardRoster: [hunter, recipient], isSoloMatch: !shared,
      damageAlreadyApplied: true, encounterId: `legacy-${shared}`, actualDamageTaken: 0,
    }, actions: {
      applyLootCraftResult: (who, crafted, metadata) => applyLootCraftResult(who, crafted, metadata),
      emitRunEvent: (type, payload) => events.push({ type, ...payload }),
    } }));
    assert.equal(result.died, false);
    assert.deepEqual(recipient._lateAcquiredItemIds, { legend: { head: 'legend' }, transcend: { head: 'trans' } });
    assert.equal(recipient.simCredits, 25); assert.equal(recipient.inventory.some(row => row.itemId === 'legend'), false);
    assert.equal(refreshActorGrowthPlan(JSON.parse(JSON.stringify(recipient)), items, world)?.targetId || '', '');
    if (shared) assert.deepEqual(events.find(event => event.type === 'hunt_settlement').sharedDrops.map(row => row.who), ['actor', 'actor']);
  }
});

check('transaction context is absent from enumerable payloads and lost copies fail closed', () => {
  for (const [copy, retainsContext] of [[value => value, true], [structuredClone, false], [value => JSON.parse(JSON.stringify(value)), false]]) {
    const actor = fixture(); delete actor._growthPlan.authoredTargetsByGroup;
    const catalog = [...items, { _id: 'catalog-only-sentinel', name: 'not a receipt' }];
    const prepared = prepareCraftTransaction(actor, legend, 3, ruleset, catalog);
    assert.equal(JSON.stringify(prepared).includes('catalog-only-sentinel'), false);
    assert.equal(Object.values(prepared).includes(catalog), false);
    assert.equal(commitCraftTransaction(actor, copy(prepared)).ok, true);
    assert.equal(actor._lateAcquiredItemIds?.legend?.head, retainsContext ? 'legend' : undefined);
    assert.equal(JSON.stringify(actor).includes('catalog-only-sentinel'), false);
    assert.equal(JSON.stringify(prepared.receipt).includes('catalog-only-sentinel'), false);
  }
  const actor = fixture(), prepared = prepareCraftTransaction(actor, legend, 3, ruleset);
  assert.equal(commitCraftTransaction(actor, prepared).ok, true);
  assert.equal(actor._lateAcquiredItemIds, undefined);
});

check('commit resolves the actual recipient current declarations rather than preparation or old plan', () => {
  const actor = fixture({ direct: false });
  const prepared = prepareCraftTransaction(actor, legend, 3, ruleset, items);
  actor.goalLoadouts = { legend: { headKey: legend.itemKey } };
  assert.equal(commitCraftTransaction(actor, prepared).ok, true);
  assert.equal(actor._lateAcquiredItemIds.legend.head, legend._id);
  const changed = fixture(), staleGoal = prepareCraftTransaction(changed, legend, 3, ruleset, items);
  changed.goalLoadouts.legend.headKey = 'different-goal';
  assert.equal(commitCraftTransaction(changed, staleGoal).ok, true);
  assert.equal(changed._lateAcquiredItemIds, undefined);
});

check('filtered inventory and immediate-special candidates preserve the full ordered hero alias winner', () => {
  const blocker = { ...raw('alias-blocker', 'unrelated material'), itemKey: 'shared-hero' };
  const target = { ...legend, itemKey: 'shared-hero' };
  for (const immediate of [false, true]) for (const reversed of [false, true]) {
    const catalog = [...materials, ...basics, ...(reversed ? [target, blocker] : [blocker, target])];
    const actor = fixture(); actor.goalLoadouts = { hero: { headKey: 'shared-hero' } };
    delete actor._growthPlan;
    const result = immediate
      ? tryImmediateCraftFromSpecial(actor, 'mithril', 'raw1', catalog, buildItemNameById(catalog), buildItemMetaById(catalog), 3, 'morning', 4, ruleset)
      : tryAutoCraftFromInventory(actor, [target], buildItemNameById(catalog), buildItemMetaById(catalog), 3, 4, ruleset, catalog);
    assert.equal(result.changed, true);
    assert.equal(actor._openingAcquiredItemIds?.head, reversed ? legend._id : undefined);
    assert.equal(actor.simCredits, 28);
  }
});

check('late acquisition retains first-valid global tier-slot and primary-key alias semantics', () => {
  const target = { ...legend, itemKey: 'late-shared', externalId: 'secondary-alias' };
  for (const [first, acquired] of [
    [{ ...gear('invalid-first', 'head', 5), itemKey: 'late-shared', recipe: null }, true],
    [{ ...gear('tier-first', 'head', 6, [{ itemId: 'raw1', qty: 1 }]), itemKey: 'late-shared' }, false],
    [{ ...gear('slot-first', 'arm', 5, [{ itemId: 'raw1', qty: 1 }]), itemKey: 'late-shared' }, false],
  ]) {
    const actor = fixture(); delete actor._growthPlan;
    actor.goalLoadouts = { legend: { headKey: 'late-shared' } };
    const catalog = [...materials, ...basics, first, target];
    assert.equal(commitCraftTransaction(actor, prepareCraftTransaction(actor, target, 3, ruleset, catalog)).ok, true);
    assert.equal(actor._lateAcquiredItemIds?.legend?.head, acquired ? target._id : undefined);
  }
  const actor = fixture(); actor.goalLoadouts = { hero: { headKey: 'secondary-alias' }, legend: { headKey: 'secondary-alias' } };
  const catalog = [...materials, ...basics, target];
  assert.equal(commitCraftTransaction(actor, prepareCraftTransaction(actor, target, 3, ruleset, catalog)).ok, true);
  assert.equal(actor._openingAcquiredItemIds.head, target._id);
  assert.equal(actor._lateAcquiredItemIds, undefined);
});

check('consecutive real loot crafts retain both authored acquisitions before planner refresh', () => {
  const actor = fixture(), first = loot(actor, 'raw1');
  assert.equal(actor._lateAcquiredItemIds.legend.head, legend._id);
  assert.equal(first.receipt.paidCost, 2);
  const second = loot(actor, 'raw2');
  assert.deepEqual(second.receipt.consumed, [{ itemId: 'legend', qty: 1 }, { itemId: 'raw2', qty: 1 }]);
  assert.equal(second.receipt.paidCost, 3); assert.equal(actor.simCredits, 25);
  assert.deepEqual(actor._lateAcquiredItemIds, { legend: { head: 'legend' }, transcend: { head: 'trans' } });
  const restored = JSON.parse(JSON.stringify(actor));
  assert.equal(refreshActorGrowthPlan(restored, items, world)?.targetId || '', '');
  assert.equal(restored.inventory.some(item => item.itemId === 'legend'), false);
  assert.equal(restored.equipped.head, 'trans');
});

check('actual legendary crate bonus then main crafting does not lose a consumed authored result', () => {
  const actor = fixture({ supplies: false }), events = [];
  const result = withSimulationRandom(() => 0, () => openLegendaryCrateForActor({ state: {
    actor, craftables: items, publicItems: items, itemNameById: names, itemMetaById: meta, ruleset,
    nextDay: 3, nextPhase: 'morning', phaseIdxNow: 4,
    nextSpawn: { legendaryCrates: [{ zoneId: 'a', opened: false }] },
  }, actions: { applyLootCraftResult: (who, crafted, metadata) => applyLootCraftResult(who, crafted, metadata),
    emitRunEvent: (kind, payload) => events.push({ kind, ...payload }) } }));
  assert.equal(result.opened, true);
  assert.equal(actor.simCredits, 25); assert.equal(actor.equipped.head, 'trans');
  assert.deepEqual(actor._lateAcquiredItemIds, { legend: { head: 'legend' }, transcend: { head: 'trans' } });
  assert.equal(refreshActorGrowthPlan(actor, items, world)?.targetId || '', '');
  assert.equal(events.filter(event => event.kind === 'craft').length, 1);
});

check('failed, stale and repeated transactions cannot create acquisitions or spend twice', () => {
  const actor = fixture({ supplies: false }), before = JSON.stringify(actor);
  const missing = prepareCraftTransaction(actor, legend, 3, ruleset, items);
  assert.equal(missing.ok, false); assert.equal(commitCraftTransaction(actor, missing).ok, false);
  assert.equal(JSON.stringify(actor), before);
  const funded = fixture(), prepared = prepareCraftTransaction(funded, legend, 3, ruleset, items);
  assert.equal(prepared.ok, true); assert.equal(funded._lateAcquiredItemIds, undefined);
  funded.simCredits--;
  assert.equal(commitCraftTransaction(funded, prepared).reason, 'stale_transaction');
  assert.equal(funded._lateAcquiredItemIds, undefined);
  const live = prepareCraftTransaction(funded, legend, 3, ruleset, items);
  assert.equal(commitCraftTransaction(funded, live).ok, true);
  const saved = JSON.stringify(funded);
  assert.equal(commitCraftTransaction(funded, live).ok, false); assert.equal(JSON.stringify(funded), saved);
});

check('automatic recommendations and different declarations acquire no authored receipt', () => {
  const automatic = fixture({ direct: false }); loot(automatic, 'raw1');
  assert.equal(automatic._lateAcquiredItemIds, undefined); assert.equal(automatic._openingAcquiredItemIds, undefined);
  const changed = fixture(); changed.goalLoadouts.legend.headKey = 'different-goal';
  loot(changed, 'raw1'); assert.equal(changed._lateAcquiredItemIds, undefined);
  const fresh = fixture(); assert.equal(fresh._lateAcquiredItemIds, undefined);
});

check('changed declarations drop old receipts and higher equipment never completes an unacquired exact goal', () => {
  const actor = fixture(); loot(actor, 'raw1'); loot(actor, 'raw2');
  actor.goalLoadouts.legend.headKey = 'different-goal';
  refreshActorGrowthPlan(actor, items, world); assert.equal(actor._lateAcquiredItemIds.legend, undefined);
  const opening = fixture(); opening.goalLoadouts = { hero: { headKey: legend._id } };
  opening.inventory = opening.inventory.filter(item => item.itemId !== 'basic-head');
  opening.inventory.push({ ...trans, itemId: trans._id, qty: 1 }); opening.equipped.head = trans._id;
  assert.equal(getActorGrowthProgress(opening, items).openingComplete, false);
  assert.equal(opening._openingAcquiredItemIds, undefined);
});

check('opening acquisition is committed immediately and survives paid upgrade consumption', () => {
  const actor = fixture(); actor.goalLoadouts = { hero: { headKey: legend.itemKey } };
  refreshActorGrowthPlan(actor, items, world);
  loot(actor, 'raw1'); assert.equal(actor._openingAcquiredItemIds.head, 'legend');
  loot(actor, 'raw2'); assert.equal(actor.simCredits, 25);
  assert.equal(actor.inventory.some(item => item.itemId === 'legend'), false);
  assert.equal(getActorGrowthProgress(JSON.parse(JSON.stringify(actor)), items).openingComplete, true);
});

check('a full bag rejects the whole result without payment or authored acquisition', () => {
  const actor = fixture();
  actor.inventory = [{ ...trans, itemId: 'trans', qty: 1 }, { ...materials[0], itemId: 'raw1', qty: 2 }];
  actor.equipped = { head: 'trans' };
  const smallBag = { ...ruleset, inventory: { ...ruleset.inventory, maxSlots: 2, autoDropLowValue: false } };
  const before = JSON.stringify(actor);
  const rejected = prepareCraftTransaction(actor, { ...legend, craftComponent: true }, 3, smallBag, items);
  assert.equal(rejected.reason, 'inventory_full');
  assert.equal(commitCraftTransaction(actor, rejected).ok, false);
  assert.equal(JSON.stringify(actor), before);
  assert.equal(actor._lateAcquiredItemIds, undefined);
});

check('duplicate and cross-field aliases follow catalog first-wins in both catalog orders', () => {
  for (const fields of [['itemKey', 'itemKey'], ['externalId', 'itemKey'], ['itemKey', 'externalId']]) {
    for (const reversed of [false, true]) {
      const first = { ...gear('collision-a', 'head', 4, [{ itemId: 'raw1', qty: 1 }]), itemKey: 'a-key', [fields[0]]: 'shared' };
      const second = { ...gear('collision-b', 'head', 5, [{ itemId: first._id, qty: 1 }, { itemId: 'raw2', qty: 1 }]),
        itemKey: 'b-key', [fields[1]]: 'shared' };
      const catalog = [...materials, ...basics, ...(reversed ? [second, first] : [first, second])];
      const actor = fixture(); actor.goalLoadouts = { hero: { headKey: 'shared' } };
      refreshActorGrowthPlan(actor, catalog, world);
      const canonical = reversed ? second._id : first._id;
      assert.equal(Object.hasOwn(actor._growthPlan, 'authoredTargetsByGroup'), false);
      for (const rawId of ['raw1', 'raw2']) {
        const crafted = withSimulationRandom(() => 0, () => tryAutoCraftFromLoot(actor.inventory, rawId, catalog,
          buildItemNameById(catalog), buildItemMetaById(catalog), 3, ruleset, getLootCraftOptions(actor, catalog)));
        assert.ok(crafted); assert.equal(applyLootCraftResult(actor, crafted, buildItemMetaById(catalog)), true);
      }
      assert.equal(actor._openingAcquiredItemIds.head, canonical);
      assert.equal(refreshActorGrowthPlan(actor, catalog, world).openingComplete, true);
      assert.equal(actor._openingAcquiredItemIds.head, canonical);
    }
  }
});

check('a resolved later goal cannot overwrite another group through a colliding alias', () => {
  const first = { ...gear('group-first', 'head', 4, [{ itemId: 'raw1', qty: 1 }]), itemKey: 'shared' };
  const second = { ...gear('group-second', 'head', 5, [{ itemId: first._id, qty: 1 }, { itemId: 'raw2', qty: 1 }]), itemKey: 'shared' };
  const catalog = [...materials, ...basics, first, second];
  const actor = fixture(); actor.goalLoadouts = { hero: { headKey: 'shared' }, legend: { headKey: second._id } };
  refreshActorGrowthPlan(actor, catalog, world);
  const craft = rawId => {
    const result = withSimulationRandom(() => 0, () => tryAutoCraftFromLoot(actor.inventory, rawId, catalog,
      buildItemNameById(catalog), buildItemMetaById(catalog), 3, ruleset, getLootCraftOptions(actor, catalog)));
    assert.ok(result); assert.equal(applyLootCraftResult(actor, result, buildItemMetaById(catalog)), true);
  };
  craft('raw1'); refreshActorGrowthPlan(actor, catalog, world); craft('raw2');
  assert.equal(actor._openingAcquiredItemIds.head, first._id);
  assert.equal(actor._lateAcquiredItemIds.legend.head, second._id);
  refreshActorGrowthPlan(actor, catalog, world);
  assert.equal(actor._openingAcquiredItemIds.head, first._id);
});

check('successful non-equipment output cannot create a direct equipment acquisition', () => {
  const actor = fixture();
  const consumable = { ...legend, category: 'consumable', type: '소모품' };
  const prepared = prepareCraftTransaction(actor, consumable, 3, ruleset, items);
  assert.equal(prepared.ok, true); assert.equal(commitCraftTransaction(actor, prepared).ok, true);
  assert.equal(actor._openingAcquiredItemIds, undefined); assert.equal(actor._lateAcquiredItemIds, undefined);
});

check('later direct acquisitions survive consecutive loot crafts while another opening slot remains unfinished', () => {
  const actor = fixture();
  const missingRaw = raw('opening-missing', '옷 원재료');
  const opening = gear('opening-clothes', 'clothes', 4, [{ itemId: missingRaw._id, qty: 1 }]);
  const catalog = [...items, missingRaw, opening];
  actor.inventory = actor.inventory.filter(item => item.itemId !== 'basic-clothes');
  delete actor.equipped.clothes;
  actor.goalLoadouts.hero = { clothesKey: opening._id };
  const plan = refreshActorGrowthPlan(actor, catalog, world);
  assert.equal(plan.openingComplete, false); assert.equal(plan.targetId, opening._id);
  assert.equal(Object.hasOwn(plan, 'authoredTargetsByGroup'), false);
  assert.equal(JSON.stringify(plan).includes('authoredTargetsByGroup'), false);
  const receipts = [];
  for (const rawId of ['raw1', 'raw2']) {
    const crafted = withSimulationRandom(() => 0, () => tryAutoCraftFromLoot(actor.inventory, rawId, catalog,
      buildItemNameById(catalog), buildItemMetaById(catalog), 3, ruleset, getLootCraftOptions(actor, catalog)));
    assert.ok(crafted); assert.equal(applyLootCraftResult(actor, crafted, buildItemMetaById(catalog)), true);
    receipts.push(crafted.receipt);
  }
  assert.equal(actor.simCredits, 25);
  assert.deepEqual(receipts.map(receipt => receipt.itemId), ['legend', 'trans']);
  assert.deepEqual(actor._lateAcquiredItemIds, { legend: { head: 'legend' }, transcend: { head: 'trans' } });
  assert.equal(getActorGrowthProgress(actor, catalog).openingComplete, false);
  const restored = JSON.parse(JSON.stringify(actor));
  const refreshed = refreshActorGrowthPlan(restored, catalog, world);
  assert.equal(refreshed.targetId, opening._id); assert.equal(refreshed.openingComplete, false);
  assert.deepEqual(restored._lateAcquiredItemIds, actor._lateAcquiredItemIds);
});
console.log(`PASS ${checks} committed growth acquisition checks`);
