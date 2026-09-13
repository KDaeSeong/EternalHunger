import assert from 'node:assert/strict';
import './lib/register-simulation-modules.mjs';

const { day1HeroGearDirector, lateGameGearDirector } = await import('../src/app/simulation/_lib/gearDirectorRuntime.js');
const { getValidRecipeIngredients } = await import('../src/app/simulation/_lib/gearRecipeGuardRuntime.js');
const { tryImmediateCraftFromSpecial } = await import('../src/app/simulation/_lib/gearImmediateSpecialCraftRuntime.js');
const { tryAutoCraftFromInventory } = await import('../src/app/simulation/_lib/gearInventoryCraftRuntime.js');
const { tryAutoCraftFromLoot } = await import('../src/app/simulation/_lib/craftRuntime.js');
const { pickCatalogEquipmentItem } = await import('../src/app/simulation/_lib/gearCatalogRuntime.js');
const { buildStarterLoadoutSurvivorsForPhase } = await import('../src/app/simulation/_lib/phaseSpawnRuntime.js');
const { runDay1HeroGearDirectorWithLogs } = await import('../src/app/simulation/_lib/phaseRouteProgressRuntime.js');
const { runProcurementAction } = await import('../src/app/simulation/_lib/phaseProcurementActionRuntime.js');
const { loadGuestSimulationItemCatalog, buildGuestSimulationRoster } = await import('../src/app/simulation/_lib/guestSimulationBootstrap.js');
const { buildItemMetaById, buildItemNameById } = await import('../src/app/simulation/_lib/itemOptionsRuntime.js');
const { getRuleset } = await import('../src/utils/rulesets.js');
const { addItemToInventory, invQty } = await import('../src/app/simulation/_lib/inventoryRules.js');

let passed = 0;
let failed = 0;
async function check(name, run) {
  try { await run(); passed += 1; console.log(`PASS ${name}`); }
  catch (error) { failed += 1; console.error(`FAIL ${name}: ${error.stack}`); }
}

const material = (id, extra = {}) => ({ _id: id, name: id, type: 'material', tier: 1, ...extra });
const gear = (id, tier = 5, extra = {}) => ({ _id: id, name: id, type: 'equipment', equipSlot: 'head', tier, ...extra });
const mithril = material('mithril', { name: '미스릴', tier: 4, tags: ['mithril'] });
const cloth = material('cloth', { name: '천' });
const recipe = { ingredients: [{ itemId: mithril._id, qty: 1 }, { itemId: cloth._id, qty: 2 }] };
const target = gear('helmet', 5, { recipe });
const ruleset = { inventory: { maxSlots: 10, stackMax: { material: 6, equipment: 1 }, autoDropLowValue: false } };
const held = (item, qty = 1) => ({ itemId: item._id, qty, name: item.name, type: item.type, tier: item.tier,
  ...(item.equipSlot ? { category: 'equipment', equipSlot: item.equipSlot } : {}) });
const actor = (extra = {}) => ({ _id: 'a', name: '제작자', hp: 100, simCredits: 100, weaponType: '단검',
  inventory: [held(mithril), held(cloth, 2)], _actionCycleKey: '4:20', day1Moves: 8, day1HeroDone: false, ...extra });
const special = (subject, items = [mithril, cloth, target], options = {}) => tryImmediateCraftFromSpecial(subject,
  options.kind || 'mithril', options.specialId || mithril._id, items,
  buildItemNameById(items || []), buildItemMetaById(items || []),
  options.day ?? 3, options.phase ?? 'morning', options.phaseIdx ?? 4, options.ruleset || ruleset);
const resources = (subject) => structuredClone({ inventory: subject.inventory, equipped: subject.equipped,
  hp: subject.hp, simCredits: subject.simCredits, day1HeroDone: subject.day1HeroDone,
  craftDay: subject._specialCraftDay, dayCount: subject._specialCraftDayCount,
  craftPhase: subject._specialCraftPhaseIdx, phaseCount: subject._specialCraftCount,
  pvp: subject._gatherPvpBonus, danger: subject._immediateDanger });
const knife = gear('knife', 1, { equipSlot: 'weapon', weaponType: '단검' });
const shoes = gear('shoes', 1, { equipSlot: 'shoes' });
function start(items = [knife, shoes], subject = actor({ inventory: [] }), customRules = ruleset) {
  const logs = [];
  const ref = { current: false };
  const run = (survivors = [subject]) => buildStarterLoadoutSurvivorsForPhase({
    state: { nextDay: 1, nextPhase: 'morning', survivors, publicItems: items, ruleset: customRules },
    refs: { startStarterLoadoutAppliedRef: ref }, actions: { addLog: (message) => logs.push(message) },
  });
  return { run, ref, logs };
}

await check('forced early route completion cannot create gear without recipes', () => {
  for (const day of [1, 2]) for (const allowAbstractFallback of [true, false]) {
    const subject = actor({ inventory: [] });
    const before = resources(subject);
    const result = day1HeroGearDirector(subject, [gear('unearned', 4)], {}, {}, day, 'morning', ruleset,
      { forceRouteCompletion: true, allowAbstractFallback, routeCompletionTier: 4 });
    assert.equal(result.changed, false);
    assert.equal(result.reason, 'recipe_catalog_missing');
    assert.deepEqual(resources(subject), before);
  }
});

await check('ordinary early and late fallback flags cannot trade arbitrary materials for gear', () => {
  for (const director of [day1HeroGearDirector, lateGameGearDirector]) {
    const subject = actor();
    const before = resources(subject);
    const result = director(subject, [gear('free', 5)], {}, {}, 4, 'night',
      { ...ruleset, ai: { allowAbstractGearFallback: true } }, { allowAbstractFallback: true });
    assert.equal(result.changed, false);
    assert.deepEqual(resources(subject), before);
  }
});

await check('real recipes stay with ordinary crafting, not a second director action', () => {
  const subject = actor();
  const before = resources(subject);
  assert.equal(day1HeroGearDirector(subject, [target]).reason, 'recipe_growth_managed');
  assert.equal(lateGameGearDirector(subject, [target]).changed, false);
  assert.deepEqual(resources(subject), before);
  assert.equal(tryAutoCraftFromInventory(subject, [target], {}, {}, 3, 4, ruleset)?.craftedId, target._id);
});

await check('actual route wrapper reports missing recipes without a false craft success', () => {
  const subject = actor();
  const messages = [];
  const run = (current) => runDay1HeroGearDirectorWithLogs({ state: { actor: current, publicItems: [], day: 1 },
    options: { forceRouteCompletion: true }, actions: { addLog: (...args) => messages.push(args) } });
  assert.equal(run(subject).changed, false);
  assert.equal(messages.length, 1);
  assert.equal(messages[0][1], 'system');
  assert.match(messages[0][0], /제작법/);
  run(JSON.parse(JSON.stringify(subject)));
  assert.equal(messages.length, 1);
});

await check('a rare material alone never substitutes for the rest of its recipe', () => {
  const subject = actor({ inventory: [held(mithril)] });
  const before = structuredClone(subject);
  const result = special(subject);
  assert.equal(result.changed, false);
  assert.equal(result.pvpBonus, 0);
  assert.deepEqual(subject, before);
});

await check('missing catalogs, empty recipes and unrelated recipes never enable special fallback', () => {
  for (const items of [null, [], [gear('no-recipe')], [gear('empty', 5, { recipe: { ingredients: [] } })],
    [gear('unrelated', 5, { recipe: { ingredients: [{ itemId: cloth._id, qty: 1 }] } })]]) {
    const subject = actor();
    const before = resources(subject);
    const result = special(subject, items);
    assert.equal(result.changed, false);
    assert.equal(result.reason, 'special_recipe_missing');
    assert.equal(result.pvpBonus, 0);
    assert.deepEqual(resources(subject), before);
  }
});

await check('valid special recipe consumes every ingredient and grants no abstract bonus', () => {
  const subject = actor();
  const result = special(subject);
  assert.equal(result.craftedId, target._id);
  assert.equal(invQty(subject.inventory, mithril._id), 0);
  assert.equal(invQty(subject.inventory, cloth._id), 0);
  assert.equal(subject.equipped.head, target._id);
  assert.equal(result.pvpBonus, 0);
  assert.equal(subject._specialCraftDayCount, 1);
  assert.equal(subject._specialCraftCount, 1);
});

await check('duplicate recipe ingredients require their combined quantity', () => {
  const duplicate = gear('double', 5, { recipe: { ingredients: [
    { itemId: mithril._id, qty: 1 }, { itemId: cloth._id, qty: 1 }, { itemId: cloth._id, qty: 2 },
  ] } });
  const subject = actor();
  assert.equal(special(subject, [duplicate]).changed, false);
  subject.inventory[1].qty = 3;
  assert.equal(special(subject, [duplicate]).craftedId, duplicate._id);
  assert.equal(invQty(subject.inventory, cloth._id), 0);
});

await check('all five special material kinds require their own exact recipe', () => {
  for (const kind of ['mithril', 'meteor', 'life_tree', 'force_core', 'vf']) {
    const core = material(kind, { tier: 4 });
    const resultItem = gear(`result-${kind}`, kind === 'vf' ? 6 : 5, { recipe: { ingredients: [
      { itemId: core._id, qty: 1 }, { itemId: cloth._id, qty: 2 },
    ] } });
    const subject = actor({ inventory: [held(core), held(cloth, 2)] });
    const result = special(subject, [core, cloth, resultItem], { kind, specialId: core._id, day: 4 });
    assert.equal(result.craftedId, resultItem._id, kind);
    assert.equal(result.pvpBonus, 0, kind);
    assert.equal(invQty(subject.inventory, core._id), 0, kind);
  }
});

await check('unlock time, day/phase limits, opening growth and death remain enforced', () => {
  const cases = [
    [actor(), { day: 1 }, 'before_unlock'],
    [actor({ _specialCraftDay: 3, _specialCraftDayCount: 1 }), {}, 'craft_limit'],
    [actor({ _specialCraftPhaseIdx: 4, _specialCraftCount: 1 }), {}, 'craft_limit'],
    [actor({ _growthPlan: { openingComplete: false } }), {}, 'opening_growth_pending'],
    [actor({ hp: 0 }), {}, 'actor_inactive'],
    [actor({ inventory: [held(cloth, 2)] }), {}, 'special_material_missing'],
  ];
  for (const [subject, options, reason] of cases) {
    const before = structuredClone(subject);
    assert.equal(special(subject, undefined, options).reason, reason);
    assert.deepEqual(subject, before);
  }
});

await check('capacity failure does not consume ingredients or reset craft limits', () => {
  const subject = actor({ inventory: [held(mithril, 2), held(cloth, 3)],
    _specialCraftDay: 2, _specialCraftDayCount: 1, _specialCraftPhaseIdx: 2, _specialCraftCount: 1 });
  const before = structuredClone(subject);
  const result = special(subject, undefined, { ruleset: { inventory: { ...ruleset.inventory, maxSlots: 2 } } });
  assert.equal(result.changed, false);
  assert.deepEqual(subject, before);
});

await check('JSON retry cannot craft twice within one action even with high limits', () => {
  const customRules = { ...ruleset, equipment: { immediateSpecialCraft: { perDayMax: 5, perPhaseMax: 5 } } };
  const subject = actor();
  assert.equal(special(subject, undefined, { ruleset: customRules }).changed, true);
  const restored = JSON.parse(JSON.stringify(subject));
  restored.inventory = actor().inventory;
  const before = structuredClone(restored);
  assert.equal(special(restored, undefined, { ruleset: customRules }).changed, false);
  assert.deepEqual(restored, before);
});

await check('malformed recipes are rejected by immediate, inventory and loot crafting alike', () => {
  const invalidRows = [
    [{ itemId: mithril._id, qty: 1 }, { itemId: '', qty: 2 }],
    [{ itemId: mithril._id, qty: 1 }, { itemId: cloth._id, qty: 0 }],
    [{ itemId: mithril._id, qty: 1 }, { itemId: cloth._id, qty: 0.5 }],
    [{ itemId: mithril._id, qty: 1 }, { itemId: cloth._id, qty: NaN }],
    [{ itemId: mithril._id, qty: 1 }, { itemId: cloth._id, qty: null }],
    [{ itemId: mithril._id, qty: 1 }, { itemId: target._id, qty: 1 }],
  ];
  for (const ingredients of invalidRows) {
    const bad = { ...target, recipe: { ingredients } };
    const subject = actor();
    const before = resources(subject);
    assert.equal(getValidRecipeIngredients(bad), null);
    assert.equal(special(subject, [bad]).changed, false);
    assert.equal(tryAutoCraftFromInventory(subject, [bad], {}, {}, 3, 4, ruleset), null);
    assert.equal(tryAutoCraftFromLoot(subject.inventory, mithril._id, [bad], {}, {}, 3, ruleset), null);
    assert.deepEqual(resources(subject), before);
  }
});

await check('deleted and generated recipe targets cannot re-enter real crafting', () => {
  for (const bad of [{ ...target, lockedByAdmin: 'deleted' }, { ...target, _id: 'eq_generated' }]) {
    assert.equal(getValidRecipeIngredients(bad), null);
    const subject = actor();
    assert.equal(special(subject, [bad]).changed, false);
    assert.equal(tryAutoCraftFromInventory(subject, [bad], {}, {}, 3, 4, ruleset), null);
    assert.equal(tryAutoCraftFromLoot(subject.inventory, mithril._id, [bad], {}, {}, 3, ruleset), null);
  }
});

await check('real procurement exposes recipe failure without inventing equipment', () => {
  const subject = actor({ inventory: [] });
  const logs = [];
  const result = runProcurementAction({ state: { actor: subject, queuedActionType: 'kioskBuy',
    queuedKioskAction: { kind: 'buy', item: mithril, itemId: mithril._id, qty: 1, cost: 10 },
    publicItems: [mithril, gear('no-recipe')], craftables: [], itemNameById: {}, itemMetaById: {},
    nextDay: 3, nextPhase: 'morning', phaseIdxNow: 4, ruleset,
  }, actions: { addLog: (message) => logs.push(message) } });
  assert.equal(result.didProcure, true);
  assert.equal(subject.simCredits, 90);
  assert.equal(invQty(subject.inventory, mithril._id), 1);
  assert.equal(subject.inventory.length, 1);
  assert.ok(logs.some((line) => line.includes('제작법')));
  assert.equal(subject._gatherPvpBonus, undefined);
});

await check('missing catalog or weapon type returns no fabricated weapon', () => {
  for (const items of [[], [shoes], [{ ...knife, weaponType: '망치' }],
    [{ ...knife, lockedByAdmin: 'deleted' }], [{ ...knife, _id: 'wpn_generated' }]]) {
    assert.equal(pickCatalogEquipmentItem(items, { slot: 'weapon', tier: 1, weaponType: '단검' }), null);
  }
});

await check('preferred high-tier source cannot replace or hide an actual T1 item', () => {
  const high = { ...knife, _id: 'high', tier: 5, source: 'openapi' };
  assert.equal(pickCatalogEquipmentItem([high], { slot: 'weapon', tier: 1, weaponType: '단검', allowNearestTier: true }), null);
  assert.equal(pickCatalogEquipmentItem([high, knife], { slot: 'weapon', tier: 1, weaponType: '단검', allowNearestTier: false })._id, knife._id);
});

await check('explicit nearest tier selection may go lower, never higher', () => {
  const lower = { ...shoes, tier: 2 };
  assert.equal(pickCatalogEquipmentItem([lower], { slot: 'shoes', tier: 4, allowNearestTier: false }), null);
  assert.equal(pickCatalogEquipmentItem([lower], { slot: 'shoes', tier: 4, allowNearestTier: true }).tier, 2);
  assert.equal(pickCatalogEquipmentItem([lower], { slot: 'shoes', tier: 1, allowNearestTier: true }), null);
});

await check('normal starter grants exact T1 gear and retains the deliberate starter food', () => {
  const steak = { _id: 'steak', name: '스테이크', type: 'food', tier: 1 };
  const flow = start([knife, shoes, steak]);
  const [subject] = flow.run();
  assert.equal(subject.equipped.weapon, knife._id);
  assert.equal(subject.equipped.shoes, shoes._id);
  assert.equal(invQty(subject.inventory, steak._id), 1);
  assert.deepEqual(subject._starterLoadoutIssues, []);
  assert.match(flow.logs.at(-1), /무기 1\/1명, 신발 1\/1명/);
});

await check('missing T1 starter records gaps rather than granting a stronger substitute', () => {
  const flow = start([{ ...knife, tier: 4 }, shoes]);
  const [subject] = flow.run();
  assert.equal(subject.equipped.weapon, null);
  assert.equal(subject.equipped.shoes, shoes._id);
  assert.deepEqual(subject._starterLoadoutIssues, [{ slot: 'weapon', reason: 'catalog_item_missing' }]);
  assert.ok(flow.logs.some((line) => line.includes('항목 누락')));
  assert.match(flow.logs.at(-1), /무기 0\/1명, 신발 1\/1명/);
});

await check('full starter bag never equips or reports an item it failed to receive', () => {
  const subject = actor({ inventory: [held(cloth), held(mithril)] });
  const flow = start([knife, shoes], subject, { inventory: { ...ruleset.inventory, maxSlots: 2 } });
  const [result] = flow.run();
  assert.equal(result.inventory.length, 2);
  assert.equal(result.equipped.weapon, null);
  assert.equal(result.equipped.shoes, null);
  assert.equal(result._starterLoadoutIssues.length, 2);
  assert.ok(result._starterLoadoutIssues.every((issue) => issue.reason === 'inventory_rejected'));
  assert.match(flow.logs.at(-1), /무기 0\/1명, 신발 0\/1명/);
});

await check('starter remains once-only and retains its missing-data evidence', () => {
  const flow = start([]);
  const first = flow.run();
  const messages = flow.logs.length;
  assert.equal(flow.run(first), first);
  assert.equal(flow.logs.length, messages);
  assert.equal(first[0]._starterLoadoutIssues.length, 2);
});

await check('bundled catalog provides actual T1 starters for every canonical actor', async () => {
  const items = await loadGuestSimulationItemCatalog();
  const roster = buildGuestSimulationRoster();
  assert.ok(roster.length > 0);
  for (const subject of roster) {
    const flow = start(items, subject, getRuleset('ER_S11'));
    const [result] = flow.run();
    assert.deepEqual(result._starterLoadoutIssues, [], subject.name);
    for (const slot of ['weapon', 'shoes']) {
      const item = items.find((candidate) => candidate._id === result.equipped[slot]);
      assert.ok(item, `${subject.name}: ${slot}`);
      assert.equal(Number(item.tier), 1, `${subject.name}: ${slot}`);
    }
  }
});

await check('bundled rare recipe still consumes all real components', async () => {
  const items = await loadGuestSimulationItemCatalog();
  const byId = new Map(items.map((item) => [item._id, item]));
  const actual = items.find((item) => item.equipSlot === 'head' && item.tier === 5
    && getValidRecipeIngredients(item)?.some((row) => byId.get(row.itemId)?.name === '미스릴')
    && item.recipe.ingredients.length > 1);
  assert.ok(actual);
  const specialId = actual.recipe.ingredients.find((row) => byId.get(row.itemId)?.name === '미스릴').itemId;
  const actualRules = getRuleset('ER_S11');
  const subject = actor({ inventory: actual.recipe.ingredients.reduce((inventory, row) =>
    addItemToInventory(inventory, byId.get(row.itemId), row.itemId, row.qty, 3, actualRules), []) });
  const result = special(subject, [actual], { specialId, ruleset: actualRules });
  assert.equal(result.craftedId, actual._id);
  for (const row of actual.recipe.ingredients) assert.equal(invQty(subject.inventory, row.itemId), 0);
  assert.equal(result.pvpBonus, 0);
});

console.log(`Recipe-only gear: ${passed} passed, ${failed} failed`);
if (failed) process.exitCode = 1;
