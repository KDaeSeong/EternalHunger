import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';

const { buildGuestSimulationMap, buildGuestSimulationRoster, loadGuestSimulationItemCatalog } = await import('../src/app/simulation/_lib/guestSimulationBootstrap.js');
const { buildInitialSimulationRoster } = await import('../src/app/simulation/_lib/simulationInitialRosterRuntime.js');
const { getDefaultSimulationSettings } = await import('../src/app/simulation/_lib/simulationPageRuntime.js');
const { getRuleset } = await import('../src/utils/rulesets.js');
const { buildCraftableItems, buildItemMetaById, buildItemNameById, buildItemKeyById } = await import('../src/app/simulation/_lib/itemOptionsRuntime.js');
const { addItemToInventory, invQty, inferEquipSlot } = await import('../src/app/simulation/_lib/inventoryRules.js');
const { tryAutoCraftFromInventory } = await import('../src/app/simulation/_lib/gearInventoryCraftRuntime.js');
const { tryAutoCraftFromLoot, prepareInventoryForCraftLoot } = await import('../src/app/simulation/_lib/craftRuntime.js');
const { autoEquipBest } = await import('../src/app/simulation/_lib/gearFallbackRuntime.js');
const { day1HeroGearDirector, lateGameGearDirector } = await import('../src/app/simulation/_lib/gearDirectorRuntime.js');
const { runRouteFarmAction } = await import('../src/app/simulation/_lib/phaseRouteFarmRuntime.js');
const { buildStarterLoadoutSurvivorsForPhase } = await import('../src/app/simulation/_lib/phaseSpawnRuntime.js');

const items = await loadGuestSimulationItemCatalog();
const byId = new Map(items.map((item) => [item._id, item]));
const names = buildItemNameById(items);
const meta = buildItemMetaById(items);
const keys = buildItemKeyById(items);
const craftables = buildCraftableItems(items);
const rules = getRuleset('ER_S11');
const add = (inv, itemId, qty = 1, config = rules) => addItemToInventory(inv, byId.get(itemId), itemId, qty, 1, config);

// Real catalog fixture, not a synthetic recipe: knife + branch -> military knife.
const target = byId.get('namu:단검:군용 나이프');
assert.ok(target?.recipe.ingredients.length);
const ingredients = target.recipe.ingredients;
const fixtureInventory = ingredients.reduce((inv, row) => add(inv, row.itemId, row.qty), []);
const actor = { _id: 'fixture', name: 'fixture', weaponType: '단검', inventory: fixtureInventory, _itemKeyById: keys };
const before = structuredClone(actor.inventory);
const crafted = tryAutoCraftFromInventory(actor, [target], names, meta, 1, 1, rules);
assert.equal(crafted?.craftedId, target._id);
assert.equal(crafted.craftedTier, target.tier);
for (const row of ingredients) assert.equal(invQty(actor.inventory, row.itemId), invQty(before, row.itemId) - row.qty);
assert.equal(actor.equipped.weapon, target._id, 'Crafted weapon must replace the consumed starter weapon.');
assert.equal(tryAutoCraftFromInventory(actor, [target], names, meta, 1, 2, rules), null, 'No second result without its ingredients.');

const originalRandom = Math.random;
const originalFetch = globalThis.fetch;
let apiCalls = 0;
globalThis.fetch = () => { apiCalls += 1; throw new Error('No network permitted in guest farming checks.'); };
try {
  Math.random = () => 0;
  const lootCraft = tryAutoCraftFromLoot(fixtureInventory, ingredients[1].itemId, [target], names, meta, 1, rules, { weaponType: '단검' });
  assert.equal(lootCraft?.craftedTier, target.tier, 'Loot crafting must retain the catalog tier.');
  assert.equal(lootCraft?.craftedId, target._id);
  assert.equal(tryAutoCraftFromLoot(fixtureInventory, ingredients[1].itemId, [target], names, meta, 1, rules, { weaponType: '망치' }), null, 'Loot crafting must respect the actor weapon type.');

  // Full inventory may still craft when consumption creates the required space.
  const materialTarget = items.find((item) => item.type === '재료' && item.recipe.ingredients.length === 2 && item.recipe.ingredients.every((row) => byId.get(row.itemId)?.type === '재료'));
  assert.ok(materialTarget, 'A two-material recipe is required for the capacity regression.');
  const compactRules = { ...rules, inventory: { ...rules.inventory, maxSlots: 2 } };
  const fullInventory = materialTarget.recipe.ingredients.reduce((inv, row) => add(inv, row.itemId, row.qty, compactRules), []);
  const materialActor = { name: 'full inventory', inventory: fullInventory };
  assert.equal(materialActor.inventory.length, 2);
  assert.equal(tryAutoCraftFromInventory(materialActor, [materialTarget], names, meta, 1, 1, compactRules)?.craftedId, materialTarget._id);

  const heldIngredient = materialTarget.recipe.ingredients[0];
  const arrivingIngredient = materialTarget.recipe.ingredients[1];
  const extraMaterial = items.find((item) => item.type === '재료' && item.tier === 1 && !materialTarget.recipe.ingredients.some((row) => row.itemId === item._id));
  const blockedBag = [
    ...add([], heldIngredient.itemId, heldIngredient.qty),
    ...add([], extraMaterial._id),
  ].map((item) => ({ ...item, goalItem: true }));
  const arriving = { item: byId.get(arrivingIngredient.itemId), itemId: arrivingIngredient.itemId, qty: arrivingIngredient.qty };
  const room = prepareInventoryForCraftLoot({ inventory: blockedBag }, arriving, [materialTarget], compactRules);
  assert.equal(room.dropped?.itemId, extraMaterial._id, 'Only unrelated cheap route material may make room for a completable recipe.');
  assert.equal(invQty(room.inventory, heldIngredient.itemId), heldIngredient.qty);
  assert.equal(blockedBag.length, 2, 'Bag planning must not mutate the input.');
  const protectedBag = [blockedBag[0], { itemId: 'protected', name: '아이기스의 정수', category: 'material', tier: 1, qty: 1 }];
  assert.equal(prepareInventoryForCraftLoot({ inventory: protectedBag }, arriving, [materialTarget], compactRules).dropped, undefined, 'Special materials must remain protected.');

  const emptyActor = { name: 'no free gear', weaponType: '단검', day1Moves: 5, inventory: [] };
  assert.equal(day1HeroGearDirector(emptyActor, items, names, meta, 1, 'morning', rules, { allowAbstractFallback: true, forceRouteCompletion: true }).changed, false);
  assert.deepEqual(emptyActor.inventory, [], 'Catch-up must not create gear without recipes.');
  assert.equal(lateGameGearDirector(emptyActor, items, names, meta, 4, 'morning', rules, { allowAbstractFallback: true }).changed, false);

  let randomState = 1101;
  Math.random = () => {
    randomState = (Math.imul(randomState, 1664525) + 1013904223) >>> 0;
    return randomState / 4294967296;
  };
  const map = buildGuestSimulationMap();
  const { shuffledChars } = buildInitialSimulationRoster({
    charList: buildGuestSimulationRoster(), routeItems: items, initialMap: map,
    initialZoneIds: map.zones.map((zone) => zone.zoneId), loadedSettings: getDefaultSimulationSettings(),
  });
  const roster = buildStarterLoadoutSurvivorsForPhase({
    refs: { startStarterLoadoutAppliedRef: { current: false } },
    state: { nextDay: 1, nextPhase: 'morning', publicItems: items, ruleset: rules, survivors: shuffledChars },
  });
  let gains = 0;
  let crafts = 0;
  const craftingTeams = new Set();
  const equippedCrafters = new Set();
  // This is a bounded isolated farming test. It uses the actual roster, route
  // map and loot/craft functions; full-match timing/combat is tested in-browser.
  for (const survivor of roster) {
    survivor._itemKeyById = keys;
    assert.ok(survivor.routePlanZoneIds?.length, `${survivor.name} needs a route`);
    assert.ok(survivor.routePlanTargetItemIds?.every((id) => byId.has(id)));
    const recordCraft = (result) => {
      if (!result?.craftedId) return;
      crafts += 1;
      craftingTeams.add(survivor.teamId);
      const slot = inferEquipSlot(byId.get(result.craftedId));
      if (slot && survivor.equipped?.[slot] === result.craftedId) equippedCrafters.add(survivor._id);
    };
    for (let step = 0; step < 60 && !equippedCrafters.has(survivor._id); step += 1) {
      survivor.zoneId = survivor.routePlanZoneIds[step % survivor.routePlanZoneIds.length];
      const routeIds = survivor.routePlanItemIdsByZone?.[survivor.zoneId] || [];
      runRouteFarmAction({
        state: {
          actor: survivor, craftables, fallbackRouteItemIds: routeIds,
          goalMissingIds: routeIds.filter((id) => invQty(survivor.inventory, id) < Number(survivor.routePlanRequiredQtyById?.[id] || 1)),
          itemMetaById: meta, itemNameById: names, mapObj: map, nextDay: 1, nextPhase: 'morning', publicItems: items, ruleset: rules,
        },
        actions: {
          emitItemGainIfAny: (qty) => { gains += Math.max(0, qty); },
          applyLootCraftResult: (who, result) => {
            if (!result?.inventory) return;
            who.inventory = result.inventory;
            autoEquipBest(who, meta);
            recordCraft(result);
          },
        },
      });
      recordCraft(tryAutoCraftFromInventory(survivor, craftables, names, meta, 1, step, rules));
    }
    assert.ok(equippedCrafters.has(survivor._id), `${survivor.name} must farm, craft and equip real gear: ${JSON.stringify({ weapon: survivor.weaponType, inventory: survivor.inventory, debug: survivor._craftDebug, route: survivor.routePlanItemIdsByZone })}`);
  }
  assert.equal(craftingTeams.size, 8, 'Every team must be able to farm and craft.');
  assert.equal(apiCalls, 0);
  console.log(JSON.stringify({ catalogItems: items.length, recipes: craftables.length, ingredientGains: gains, recipeCrafts: crafts, craftingTeams: craftingTeams.size, equippedCrafters: equippedCrafters.size, apiCalls, freeGearBlocked: true }, null, 2));
} finally {
  Math.random = originalRandom;
  globalThis.fetch = originalFetch;
}
