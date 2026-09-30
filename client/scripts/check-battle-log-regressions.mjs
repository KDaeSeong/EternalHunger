import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import Module from 'node:module';
const { GUEST_ITEM_CATALOG } = await import('../src/app/simulation/_generated/guestItemCatalog.generated.js');
const { getRuleset } = await import('../src/utils/rulesets.js');
const { buildActorGrowthPlan, refreshActorGrowthPlan, getActorGrowthProgress, getGrowthRecipeWork } = await import('../src/app/simulation/_lib/growthPlanRuntime.js');
const { getActorGrowthObservation } = await import('../src/app/simulation/_lib/growthObservationRuntime.js');
const { tryAutoCraftFromInventory } = await import('../src/app/simulation/_lib/gearInventoryCraftRuntime.js');
const { tryAutoCraftFromLoot } = await import('../src/app/simulation/_lib/craftRuntime.js');
const { prepareActorPhaseActionPlan } = await import('../src/app/simulation/_lib/phaseActionQueueRuntime.js');
const { pickCatalogEquipmentItem } = await import('../src/app/simulation/_lib/gearCatalogRuntime.js');
const { buildStarterLoadoutSurvivorsForPhase } = await import('../src/app/simulation/_lib/phaseSpawnRuntime.js');
const { runActorMovementDecisionPhase } = await import('../src/app/simulation/_lib/phaseActorMovementRuntime.js');
const { buildPvpPhaseRuntime } = await import('../src/app/simulation/_lib/pvpPhaseRuntime.js');
const { runTeamCombatRound } = await import('../src/app/simulation/_lib/teamCombatRuntime.js');
const { buildDay1TargetCandidatesBySlot, buildItemIndexes } = await import('../src/app/simulation/_lib/routePlanBuilderRuntime.js');
const { getLateGrowthTargets } = await import('../src/app/simulation/_lib/lateGrowthTargetRuntime.js');
const { buildItemMetaById, buildItemNameById } = await import('../src/app/simulation/_lib/itemOptionsRuntime.js');
const { invQty } = await import('../src/app/simulation/_lib/inventoryRules.js');
import seedNormalization from '../../server/utils/defaultItemTreeNormalization.js';

const ruleset = getRuleset('ER_S11');
const catalog = structuredClone(GUEST_ITEM_CATALOG);
const names = buildItemNameById(catalog);
const meta = buildItemMetaById(catalog);
const world = { mapObj: { zones: ['a', 'b', 'c'].map((zoneId) => ({ zoneId, name: zoneId })) },
  zoneGraph: { a: ['b', 'c'], b: ['a', 'c'], c: ['a', 'b'] }, forbiddenIds: new Set(), ruleset };
const held = (item, qty = 1) => ({ ...structuredClone(item), itemId: item._id, qty });
const human = (id, teamId = 'a', extra = {}) => ({ _id: id, name: id, teamId, teamName: teamId,
  zoneId: 'a', hp: 500, maxHp: 500, stats: { attackPower: 20, defense: 10 },
  _spatial: { zoneId: 'a', x: 4, y: 4 }, inventory: [], simCredits: 1000, ...extra });
const material = (id) => ({ _id: id, name: id, type: '재료', tier: 1, spawnZones: ['a'] });
const gear = (id, slot, weaponType = '', tier = 4) => ({ _id: id, itemKey: id, name: id, type: 'equipment',
  equipSlot: slot, weaponType, tier, recipe: { ingredients: [{ itemId: 'raw', qty: 1 }] } });
let passed = 0, failed = 0;
async function check(name, run) {
  try { await run(); passed++; console.log(`PASS ${name}`); }
  catch (error) { failed++; console.error(`FAIL ${name}: ${error.stack}`); }
}
function readyActor(id, weaponType, target) {
  return human(id, 'a', { weaponType, routePlanTargetItemIds: [target._id],
    _actionCycleKey: '0:0', inventory: target.recipe.ingredients.map(({ itemId, qty }) => held(catalog.find((item) => item._id === itemId), qty)) });
}

for (const [id, weaponType, targetId] of [
  ['maki', '기관총', 'namu:돌격소총:아그니'],
  ['himari', '로켓발사기', 'namu:권총:일렉트론 블라스터'],
]) {
  await check(`${id} queues, crafts and equips its real completed weapon recipe`, () => {
    const target = catalog.find((item) => item._id === targetId);
    const who = readyActor(id, weaponType, target);
    const before = structuredClone(who.inventory);
    const plan = refreshActorGrowthPlan(who, catalog, world);
    assert.equal(plan.blocked, ''); assert.equal(plan.readyCraftId, targetId);
    const queue = prepareActorPhaseActionPlan({ state: { actor: who, ...world, publicItems: catalog,
      craftables: catalog, itemMetaById: meta, itemNameById: names, nextDay: 1, nextPhase: 'morning' } });
    assert.equal(queue.queuedActionType, 'craft');
    assert.deepEqual(who.inventory.map(({ itemId, qty }) => ({ itemId, qty })), before.map(({ itemId, qty }) => ({ itemId, qty })));
    assert.equal(tryAutoCraftFromInventory(who, catalog, names, meta, 1, 0, ruleset)?.craftedId, targetId);
    assert.equal(who.equipped.weapon, targetId); assert.equal(who.weaponType, weaponType);
    for (const row of target.recipe.ingredients) assert.equal(invQty(who.inventory, row.itemId), 0);
    assert.equal(getActorGrowthProgress(who, catalog).completedSlots, 1);
  });
}

await check('loot-triggered crafting uses the same equipment family without changing the combat type', () => {
  const target = catalog.find((item) => item._id === 'namu:돌격소총:아그니');
  const who = readyActor('maki-loot', '기관총', target);
  const original = Math.random;
  try {
    Math.random = () => 0;
    const result = tryAutoCraftFromLoot(who.inventory, target.recipe.ingredients[1].itemId, [target], names, meta,
      1, ruleset, { weaponType: who.weaponType, craftActor: who });
    assert.equal(result?.craftedId, target._id);
    assert.equal(who.weaponType, '기관총');
  } finally { Math.random = original; }
});

await check('opening and late authored routes accept compatible families and reject unrelated weapons', () => {
  const items = [material('raw'), gear('rifle', 'weapon', '돌격소총'), gear('bow', 'weapon', '활'),
    gear('legend-rifle', 'weapon', '돌격소총', 5)];
  const actor = human('route', 'a', { weaponType: '기관총', goalLoadouts: {
    hero: { weaponKey: 'rifle' }, legend: { weaponKey: 'legend-rifle' } } });
  const opening = () => buildDay1TargetCandidatesBySlot(actor, items, buildItemIndexes(items), world.mapObj);
  assert.deepEqual(opening().get('weapon').map(({ item }) => item._id), ['rifle']);
  assert.deepEqual(getLateGrowthTargets(actor, items).targets.map((item) => item._id), ['legend-rifle']);
  actor.goalLoadouts.hero.weaponKey = 'bow';
  assert.deepEqual(opening().get('weapon').map(({ item }) => item._id), ['rifle']);
});

await check('an incompatible ready focus advances to another planned slot and reports the real blocker', () => {
  const items = [material('raw'), gear('bow', 'weapon', '활'), gear('helmet', 'head')];
  const actor = human('blocked', 'a', { weaponType: '권총', inventory: [held(items[0])],
    _growthFocusId: 'bow', routePlanTargetItemIds: ['bow', 'helmet'] });
  const before = structuredClone(actor);
  assert.equal(buildActorGrowthPlan(actor, items, world).readyCraftId, 'helmet');
  assert.deepEqual(actor, before);
  assert.equal(getGrowthRecipeWork(actor, items, 'bow').blocked, 'weapon_mismatch');
  actor.routePlanTargetItemIds = ['bow'];
  refreshActorGrowthPlan(actor, items, world);
  assert.match(getActorGrowthObservation(actor, items, { ruleset }).materials, /무기 계열 불일치/);
});

await check('an unusable higher-tier weapon cannot count as completed opening growth', () => {
  const items = [material('raw'), gear('pistol', 'weapon', '권총'), gear('bow', 'weapon', '활', 5)];
  const actor = human('wrong-upgrade', 'a', { weaponType: '권총', routePlanTargetItemIds: ['pistol'], inventory: [held(items[2])] });
  assert.equal(getActorGrowthProgress(actor, items).completedSlots, 0);
});

await check('logged weapon types receive real T1 starters from the bundled catalog', () => {
  const types = ['철퇴', '산탄총', '석궁', '도끼', '기관총', '로켓발사기', '기관단총', '유탄발사기', '박격포', '한손검'];
  const survivors = types.map((weaponType) => human(weaponType, 'a', { weaponType }));
  const logs = [];
  const result = buildStarterLoadoutSurvivorsForPhase({
    state: { survivors, publicItems: catalog, ruleset, nextDay: 1, nextPhase: 'morning' },
    refs: { startStarterLoadoutAppliedRef: { current: false } }, actions: { addLog: (message) => logs.push(message) },
  });
  for (const actor of result) {
    assert.deepEqual(actor._starterLoadoutIssues, [], actor.weaponType);
    assert.equal(meta[actor.equipped.weapon].tier, 1, actor.weaponType);
    assert.equal(actor.weaponType, actor._id);
    assert.ok(catalog.some((item) => item._id === actor.equipped.weapon));
  }
  assert.ok(logs.some((message) => /기관총.*호환 계열 돌격소총/.test(message)));
});

await check('native T1 takes priority, compatible T1 beats native T4, and neither fabricates a starter', () => {
  const native = { ...gear('native', 'weapon', '기관총', 1), recipe: { ingredients: [] } };
  const compatible = { ...gear('namu:compatible', 'weapon', '돌격소총', 1), recipe: { ingredients: [] } };
  const options = { slot: 'weapon', tier: 1, weaponType: '기관총', allowNearestTier: false };
  assert.equal(pickCatalogEquipmentItem([compatible, native], options)._id, native._id);
  assert.equal(pickCatalogEquipmentItem([compatible, { ...native, tier: 4 }], options)._id, compatible._id);
  assert.equal(pickCatalogEquipmentItem([{ ...native, tier: 4 }], options), null);
  const tagged = { ...native, weaponType: '', itemSubType: 'coverage_seed', tags: ['namu', 'weapon', '기관총'] };
  const picked = pickCatalogEquipmentItem([tagged], options);
  assert.equal(picked._id, native._id); assert.equal(picked.weaponType, '기관총');
  assert.equal(pickCatalogEquipmentItem([{ ...tagged, tags: ['namu', 'weapon'] }], options), null);
});

await check('opening farm time ignores PvP power and head-count threats while night retreat remains active', () => {
  const items = [material('raw'), gear('helmet', 'head')];
  const actor = human('farmer', 'a', { routePlanTargetItemIds: ['helmet'] });
  const enemies = [1, 2, 3].map((id) => human(`enemy${id}`, 'b'));
  const move = (nextPhase, extra = {}) => runActorMovementDecisionPhase({ state: {
    ...world, actor: structuredClone(actor), phaseSurvivors: structuredClone([actor, ...enemies]),
    publicItems: items, craftables: items, itemMetaById: buildItemMetaById(items), itemNameById: buildItemNameById(items),
    itemKeyById: {}, kiosks: [], zones: world.mapObj.zones, nextDay: 1, nextPhase, ...extra,
  } });
  assert.equal(buildPvpPhaseRuntime({ nextDay: 1, nextPhase: 'morning' }).battleProb, 0);
  const opening = move('morning');
  assert.equal(opening.fleeInterruptReason, ''); assert.equal(opening.moveReason, 'growth_farm');
  assert.equal(opening.nextZoneId, 'a');
  assert.equal(move('night').fleeInterruptReason, 'team_outnumbered');
  const wounded = move('morning', { actor: { ...actor, hp: 20 } });
  assert.equal(wounded.fleeInterruptReason, ''); assert.equal(wounded.recovering, true);
  const escape = move('morning', { forbiddenIds: new Set(['a']) });
  assert.equal(escape.mustEscape, true); assert.notEqual(escape.nextZoneId, 'a');
});

await check('scheduled 3v3 displays local rosters but spends only the scheduled actors attack', () => {
  const actors = [human('a1'), human('a2'), human('a3'), human('b1', 'b'), human('b2', 'b'), human('b3', 'b'),
    human('remote', 'a', { zoneId: 'c' }), human('dead', 'b', { hp: 0 })];
  const events = [], logs = [];
  const result = runTeamCombatRound({ actor: actors[0], target: actors[3],
    survivorMap: new Map(actors.map((actor) => [actor._id, actor])), nowSec: 100, onlyActorId: 'a1', random: () => 0,
    resolveStrike: (_, victim) => { victim.hp -= 5; },
    emitRunEvent: (kind, data) => events.push({ kind, ...data }), addLog: (message) => logs.push(message),
  });
  assert.equal(result.strikes.length, 1); assert.deepEqual(result.participants, ['a1']);
  const engagement = events.find((event) => event.kind === 'team_engagement');
  assert.deepEqual(engagement.teams.map((side) => side.length), [3, 3]);
  assert.match(logs[0], /3명 ↔ b 3명/);
  assert.equal(actors[3].hp, 495);
  assert.ok(actors.filter((actor) => actor._id !== 'b1' && actor._id !== 'dead').every((actor) => actor.hp === 500));
});

await check('crossbow normalization preserves recipe, identity, stats and unrelated equipment', () => {
  const root = { key: 'namu:석궁:석궁', name: '석궁', weaponType: '석궁', tier: 2, rarity: 'rare', stats: { atk: 8 } };
  const other = { ...root, key: 'namu:석궁:other', name: 'other' };
  const items = seedNormalization.normalizeDefaultItemTree([root, other]);
  const normalized = items.find((item) => item.key === root.key);
  assert.equal(normalized.tier, 1); assert.equal(normalized.rarity, 'common'); assert.equal(normalized.stats.atk, 8);
  assert.equal(items.find((item) => item.key === other.key).tier, 2);
  assert.deepEqual(root, { key: 'namu:석궁:석궁', name: '석궁', weaponType: '석궁', tier: 2, rarity: 'rare', stats: { atk: 8 } });
  assert.equal(seedNormalization.getStarterCatalogCorrection({ ...root, recipeKeys: [{ key: other.key, qty: 1 }] }), null);
  assert.equal(seedNormalization.getStarterCatalogCorrection({ ...root, tier: 4 }), null);
});

await check('missing-mode seeding repairs only starter metadata through both server entry points', async () => {
  const existing = { _id: 'existing-crossbow', itemKey: 'namu:석궁:석궁', externalId: 'namu:석궁:석궁',
    name: '석궁', tier: 2, rarity: 'rare', equipSlot: '', stats: { atk: 99 }, recipe: { ingredients: [] } };
  const calls = [];
  const fakeItem = { find: async () => [existing], bulkWrite: async (ops) => { calls.push(...ops); } };
  const require = createRequire(import.meta.url);
  const originalLoad = Module._load;
  let seed;
  try {
    Module._load = function (request, parent, isMain) {
      if (request === '../models/Item' && parent?.filename.endsWith('/server/utils/defaultItemTree.js')) return fakeItem;
      return originalLoad.call(this, request, parent, isMain);
    };
    seed = require('../../server/utils/defaultItemTree.js');
  } finally { Module._load = originalLoad; }
  const offset = seed.DEFAULT_ITEM_TREE.findIndex((item) => item.key === existing.itemKey);
  await seed.upsertDefaultItemTreeBatch({ mode: 'missing', offset, limit: 1 });
  assert.deepEqual(calls[0], { updateOne: { filter: { _id: existing._id },
    update: { $set: { tier: 1, rarity: 'common', equipSlot: 'weapon' } } } });
  calls.length = 0;
  await seed.upsertDefaultItemTree({ mode: 'missing' });
  const repair = calls.find((op) => op.updateOne?.filter._id === existing._id);
  assert.deepEqual(repair.updateOne.update.$set, { tier: 1, rarity: 'common', equipSlot: 'weapon' });
  assert.equal(existing.stats.atk, 99);
});

console.log(`BATTLE_LOG_REGRESSION_CHECKS ${passed}/${passed + failed}`);
if (failed) process.exitCode = 1;
