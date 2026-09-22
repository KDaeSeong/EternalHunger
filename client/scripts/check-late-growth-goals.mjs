import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';

const { buildActorGrowthPlan, refreshActorGrowthPlan, getActorGrowthCraftGoal } = await import('../src/app/simulation/_lib/growthPlanRuntime.js');
const { getActorGrowthObservation } = await import('../src/app/simulation/_lib/growthObservationRuntime.js');
const { prepareActorPhaseActionPlan } = await import('../src/app/simulation/_lib/phaseActionQueueRuntime.js');
const { buildItemMetaById, buildItemNameById } = await import('../src/app/simulation/_lib/itemOptionsRuntime.js');
const { getRuleset } = await import('../src/utils/rulesets.js');
const { getCombatEquipment } = await import('../src/utils/battleEquipmentLogic.js');
const { normalizeInventory, invQty } = await import('../src/app/simulation/_lib/inventoryRules.js');
const { autoEquipBest } = await import('../src/app/simulation/_lib/gearFallbackRuntime.js');
const { tryAutoCraftFromInventory } = await import('../src/app/simulation/_lib/gearInventoryCraftRuntime.js');
const { createFieldResources } = await import('../src/app/simulation/_lib/fieldResourceRuntime.js');
const { runRouteFarmAction } = await import('../src/app/simulation/_lib/phaseRouteFarmRuntime.js');
const { applyLootCraftResult } = await import('../src/app/simulation/_lib/lootCraftResultRuntime.js');
const { withSimulationRandom } = await import('../src/utils/simulationRandom.js');
const { buildTeamMovementPlans } = await import('../src/app/simulation/_lib/teamTacticsRuntime.js');
const { runActorMovementDecisionPhase } = await import('../src/app/simulation/_lib/phaseActorMovementRuntime.js');
const { chooseAiMoveTargets } = await import('../src/app/simulation/_lib/aiMoveTargetRuntime.js');
const { countMissingSpecialNeed } = await import('../src/app/simulation/_lib/aiKioskSpecialItemsRuntime.js');

// HF2/HF6 focused acceptance gate, separate from the equipment-effect release.
// These are authored fixture recipes, not invented Eternal Return item stats.
const ruleset = getRuleset('ER_S11');
const cloth = { _id: 'late-cloth', name: '추가 천', type: '재료', tier: 1, spawnZones: ['b'] };
const stone = { _id: 'late-stone', name: '추가 돌', type: '재료', tier: 1, spawnZones: ['b'] };
const hero = { _id: 'late-hero', itemKey: 'late-hero-key', name: '초기 모자', type: '방어구', category: 'equipment',
  equipSlot: 'head', tier: 4, stats: { defense: 10 }, recipe: { ingredients: [{ itemId: cloth._id, qty: 1 }] } };
const gear = (id, materialId) => ({ _id: id, itemKey: `${id}-key`, name: id, type: '방어구', category: 'equipment',
  equipSlot: 'head', tier: 5, stats: { defense: 15 },
  recipe: { ingredients: [{ itemId: hero._id, qty: 1 }, { itemId: materialId, qty: 1 }], resultQty: 1, creditsCost: 3 } });
const other = gear('late-other', stone._id);
const selected = gear('late-selected', cloth._id);
const items = [cloth, stone, hero, other, selected];
const world = { mapObj: { zones: ['a', 'b'].map(zoneId => ({ zoneId, name: zoneId })) },
  zoneGraph: { a: ['b'], b: ['a'] }, forbiddenIds: new Set(), nextDay: 3, nextPhase: 'morning', ruleset };
const actor = () => ({ _id: 'late-actor', name: '후반 성장 시험', hp: 100, maxHp: 100, zoneId: 'a',
  weaponType: '단검', simCredits: 20, routePlanTargetItemIds: [hero._id],
  inventory: [{ ...structuredClone(hero), itemId: hero._id, qty: 1 }], equipped: { head: hero._id },
  goalLoadouts: { hero: { headKey: hero.itemKey }, legend: { headKey: selected.itemKey } } });
const possessions = who => structuredClone({ inventory: who.inventory, equipped: who.equipped, simCredits: who.simCredits, hp: who.hp });
let passed = 0, failed = 0;
async function check(name, run) {
  try { await run(); passed++; console.log(`PASS ${name}`); }
  catch (error) { failed++; console.error(`FAIL ${name}: ${error.message}`); }
}

await check('completed opening gear continues to the explicitly authored legendary target', () => {
  const who = actor(), before = structuredClone(who);
  const plan = buildActorGrowthPlan(who, items, world);
  assert.deepEqual(who, before, 'read-only planning cannot grant equipment or rewrite the actor');
  assert.equal(plan?.openingComplete, true, 'late growth must not pretend opening farming is unfinished');
  assert.equal(plan?.targetId, selected._id);
});

await check('late recipe work reserves the owned base and identifies the real missing material route', () => {
  const who = actor(), before = possessions(who);
  const plan = refreshActorGrowthPlan(who, items, world);
  assert.equal(plan?.targetId, selected._id);
  assert.deepEqual(plan.missing.map(row => row.itemId), [cloth._id]);
  assert.equal(plan.targetZoneId, 'b');
  assert.equal(plan.nextStep, 'b');
  assert.equal(plan.reservedQtyById[hero._id], 1);
  assert.deepEqual(possessions(who).equipped, before.equipped, 'reserving worn base gear must not unequip it');
  assert.equal(who.simCredits, before.simCredits, 'planning cannot spend recipe credits');
  assert.equal(who.inventory.some(row => row.itemId === selected._id), false);
});

await check('the actual action queue honors the legendary choice instead of catalog order', () => {
  const who = actor();
  const plan = prepareActorPhaseActionPlan({ state: { ...world, actor: who, publicItems: items,
    craftables: items.filter(item => item.recipe), itemMetaById: buildItemMetaById(items),
    itemNameById: buildItemNameById(items), currentActionSec: () => 500, phaseIdxNow: 4 } });
  assert.equal(plan.craftGoal?.target?._id, selected._id);
  assert.ok(plan.goalMissingIds.has(cloth._id));
  assert.equal(who.equipped.head, hero._id);
});

await check('observation exposes the chosen late target instead of reporting all growth complete', () => {
  const who = actor();
  refreshActorGrowthPlan(who, items, world);
  const before = structuredClone(who);
  const view = getActorGrowthObservation(who, items, { ruleset, zoneName: String });
  assert.deepEqual(who, before, 'rendering cannot choose or alter a growth plan');
  assert.equal(view?.targetId, selected._id);
  assert.match(view?.materials || '', /추가 천/);
});

await check('unfinished opening gear remains the first real recipe without free late gear', () => {
  const who = actor(); who.inventory = []; who.equipped = {};
  const before = structuredClone(who);
  const plan = buildActorGrowthPlan(who, items, world);
  assert.equal(plan.targetId, hero._id);
  assert.equal(plan.openingComplete, false);
  assert.deepEqual(who, before);
});

await check('a catalog without a higher recipe never invents an upgrade or pays out free resources', () => {
  const who = actor(), before = structuredClone(who);
  const plan = buildActorGrowthPlan(who, [cloth, hero], world);
  assert.equal(plan?.targetId || '', '');
  assert.deepEqual(who, before);
});

await check('a custom actor without an opening route can still follow an authored late recipe', () => {
  const who = actor(); delete who.routePlanTargetItemIds;
  const plan = refreshActorGrowthPlan(who, items, world);
  assert.equal(plan.targetId, selected._id); assert.equal(plan.openingComplete, true);
  assert.equal(getActorGrowthObservation(who, items).targetId, selected._id);
});

await check('authored choices and automatic upgrades are independent of catalog order', () => {
  for (const catalog of [items, [...items].reverse()]) {
    assert.equal(buildActorGrowthPlan(actor(), catalog, world).targetId, selected._id);
    const who = actor(); who.goalLoadouts = {};
    assert.equal(buildActorGrowthPlan(who, catalog, world).targetId, other._id);
  }
});

await check('missing, wrong-slot and wrong-weapon authored targets are explicit and never replaced by free gear', () => {
  for (const target of [null, { ...selected, equipSlot: 'shoes' }, { ...selected, equipSlot: 'weapon', type: '무기', weaponType: '양손검' }]) {
    const who = actor(); who.goalLoadouts = target?.equipSlot === 'weapon'
      ? { legend: { weaponKey: selected.itemKey } } : { legend: { headKey: selected.itemKey } };
    if (target?.equipSlot === 'weapon') who.inventory = [];
    who.routePlanTargetItemIds = [];
    const catalog = [cloth, hero, ...(target ? [target] : [])];
    const before = possessions(who);
    const plan = refreshActorGrowthPlan(who, catalog, world);
    assert.equal(plan.targetId, ''); assert.equal(plan.blocked, 'invalid_target');
    assert.equal(plan.goalIssues[0].reason, 'invalid_target');
    assert.deepEqual(possessions(who).equipped, before.equipped);
    assert.equal(who.simCredits, before.simCredits);
    assert.match(getActorGrowthObservation(who, catalog).label, /확인 필요/);
  }
});

await check('zero-quantity opening gear is not a completed slot', () => {
  const who = actor(); who.inventory[0].qty = 0;
  const plan = buildActorGrowthPlan(who, items, world);
  assert.equal(plan.openingComplete, false); assert.equal(plan.targetId, hero._id);
});

await check('the worn recipe base keeps its stats and effects through reservation and normalization', () => {
  const who = actor();
  who.inventory[0].equipmentEffects = [{ version: 1, kind: 'rupture', delaySec: 0.8, cooldownSec: 8, radius: 2,
    damage: { base: 20, perLevel: 0, attackPowerRatio: 0, skillAmpRatio: 0 } }];
  const before = structuredClone(getCombatEquipment(who)[0]);
  refreshActorGrowthPlan(who, items, world);
  who.inventory = normalizeInventory(who.inventory, ruleset);
  autoEquipBest(who, buildItemMetaById(items));
  const worn = getCombatEquipment(who)[0];
  assert.equal(who.equipped.head, hero._id); assert.equal(worn.craftComponent, false);
  assert.deepEqual(worn.stats, before.stats); assert.deepEqual(worn.equipmentEffects, before.equipmentEffects);
  assert.equal(who._growthPlan.reservedQtyById[hero._id], 1);
});

await check('the real craft path consumes the base and material once and equips the authored result', () => {
  const who = actor(); who.zoneId = 'b';
  who.inventory.push({ ...cloth, itemId: cloth._id, qty: 1 });
  const meta = buildItemMetaById(items), names = buildItemNameById(items);
  const queue = prepareActorPhaseActionPlan({ state: { ...world, actor: who, publicItems: items, craftables: items,
    itemMetaById: meta, itemNameById: names, currentActionSec: () => 500, phaseIdxNow: 4 } });
  assert.equal(queue.queuedActionType, 'craft'); assert.equal(queue.queuedAtomicAction.itemId, selected._id);
  assert.equal(who.simCredits, 20); assert.equal(invQty(who.inventory, hero._id), 1);
  const crafted = tryAutoCraftFromInventory(who, items, names, meta, 3, 4, ruleset);
  assert.equal(crafted.craftedId, selected._id); assert.equal(who.simCredits, 17);
  assert.equal(invQty(who.inventory, hero._id), 0); assert.equal(invQty(who.inventory, cloth._id), 0);
  assert.equal(who.equipped.head, selected._id);
  const after = possessions(who);
  assert.equal(tryAutoCraftFromInventory(who, items, names, meta, 3, 4, ruleset), null);
  assert.deepEqual(possessions(who), after);
  refreshActorGrowthPlan(who, items, world);
  assert.equal(who._growthPlan.openingComplete, true);
  assert.equal(getActorGrowthObservation(who, items).status, 'complete');
});

await check('failed payment preserves worn gear, material, credits and a truthful cost explanation', () => {
  const who = actor(); who.simCredits = 2; who.inventory.push({ ...cloth, itemId: cloth._id, qty: 1 });
  refreshActorGrowthPlan(who, items, world);
  const before = possessions(who);
  assert.equal(who._growthPlan.blocked, 'insufficient_credits');
  assert.equal(tryAutoCraftFromInventory(who, items, buildItemNameById(items), buildItemMetaById(items), 3, 4, ruleset), null);
  assert.deepEqual(possessions(who), before);
  assert.match(getActorGrowthObservation(who, items, { ruleset }).materials, /필요 3Cr.*보유 2Cr/);
});

await check('finishing legendary equipment advances to an authored transcend recipe without downgrading', () => {
  const trans = { ...gear('late-trans', stone._id), tier: 6,
    recipe: { ingredients: [{ itemId: selected._id, qty: 1 }, { itemId: stone._id, qty: 1 }] } };
  const who = actor(); who.inventory = [{ ...selected, itemId: selected._id, qty: 1 }];
  who.equipped.head = selected._id; who.goalLoadouts.transcend = { headKey: trans.itemKey };
  const catalog = [...items, trans];
  assert.equal(buildActorGrowthPlan(who, catalog, world).targetId, trans._id);
  who.inventory = [{ ...trans, itemId: trans._id, qty: 1 }]; who.equipped.head = trans._id;
  assert.equal(buildActorGrowthPlan(who, catalog, world).targetId, '');
});

await check('late field farming consumes shared stock and the real recipe, with no hidden grant', () => {
  const who = actor(); who.zoneId = 'b';
  const nextSpawn = { fieldResources: createFieldResources(world.mapObj, items, ruleset) };
  const initialStock = nextSpawn.fieldResources.byZone.b[cloth._id].remaining;
  const meta = buildItemMetaById(items), names = buildItemNameById(items), receipts = [];
  refreshActorGrowthPlan(who, items, { ...world, nextSpawn });
  withSimulationRandom(() => 0, () => runRouteFarmAction({ state: { ...world, actor: who, publicItems: items,
    craftables: items.filter(item => item.recipe), itemMetaById: meta, itemNameById: names, nextSpawn,
    fallbackRouteItemIds: [cloth._id], goalMissingIds: [cloth._id] },
  actions: { applyLootCraftResult: (subject, result) => applyLootCraftResult(subject, result, meta,
    { emitCraftRunEvent: (id, crafted) => receipts.push(crafted.receipt) }) } }));
  assert.equal(nextSpawn.fieldResources.byZone.b[cloth._id].remaining, initialStock - 1);
  assert.equal(who.equipped.head, selected._id); assert.equal(who.simCredits, 17);
  assert.equal(invQty(who.inventory, hero._id), 0); assert.equal(receipts.length, 1);
  assert.equal(receipts[0].paidCost, 3);
});

await check('late upgrades do not block team regrouping or override its actual movement', () => {
  const who = actor(); who.zoneId = 'b'; who.teamId = 'team:1'; who.teamSlot = 2;
  const ally = { ...actor(), _id: 'late-ally', teamId: 'team:1', teamSlot: 1 };
  for (const member of [who, ally]) refreshActorGrowthPlan(member, items, world);
  assert.equal(who._growthPlan.nextStep, 'b');
  const roster = [ally, who];
  const plans = buildTeamMovementPlans({ roster, ...world, day: 3, phase: 'morning', estimatePower: () => 10 });
  assert.equal(plans.get(who._id).nextStep, 'a');
  const moved = withSimulationRandom(() => 0, () => runActorMovementDecisionPhase({ state: { ...world,
    actor: who, phaseSurvivors: roster, publicItems: items, craftables: items, zones: world.mapObj.zones,
    itemMetaById: buildItemMetaById(items), itemNameById: buildItemNameById(items),
    teamMovementPlan: plans.get(who._id), currentActionSec: () => 500 } }));
  assert.equal(moved.nextZoneId, 'a'); assert.equal(moved.moveReason, 'team_regroup');
});

await check('an authored mithril recipe points to alpha instead of an unrelated natural core', () => {
  const mithril = { _id: 'late-mithril', name: '미스릴', type: '재료', tier: 5 };
  const rare = { ...selected, recipe: { ingredients: [{ itemId: hero._id, qty: 1 }, { itemId: mithril._id, qty: 1 }] } };
  const catalog = [cloth, hero, mithril, rare], who = actor();
  refreshActorGrowthPlan(who, catalog, world);
  assert.equal(who._growthPlan.blocked, 'no_material_source');
  const choice = chooseAiMoveTargets({ actor: who, craftGoal: { target: rare, missing: who._growthPlan.missing },
    upgradeNeed: { wantLegend: true, minTier: 4, goalTier: 6 }, mapObj: world.mapObj, forbiddenIds: new Set(),
    day: 3, phase: 'morning', ruleset, isSoloMatch: true,
    spawnState: { coreNodes: [{ id: 'unrelated', kind: 'life_tree', zoneId: 'a', picked: false }],
      bosses: { alpha: { alive: true, zoneId: 'b' } } } });
  assert.deepEqual(choice.targets, ['b']); assert.equal(choice.objectiveSubkind, 'alpha');
  assert.match(choice.reason, /미스릴/);
});

await check('forbidden and exhausted supplies cannot remain active late routes or regain stock', () => {
  for (const restricted of [true, false]) {
    const who = actor(), nextSpawn = { fieldResources: createFieldResources(world.mapObj, items, ruleset) };
    if (!restricted) nextSpawn.fieldResources.byZone.b[cloth._id].remaining = 0;
    const before = structuredClone(nextSpawn);
    const plan = refreshActorGrowthPlan(who, items, { ...world, nextSpawn, forbiddenIds: new Set(restricted ? ['b'] : []) });
    assert.equal(plan.targetId, selected._id); assert.equal(plan.targetZoneId, '');
    assert.equal(plan.blocked, 'no_material_source'); assert.deepEqual(nextSpawn, before);
  }
});

await check('late plan and observation round-trip through JSON without reading randomness or changing possessions', () => {
  const who = actor(); refreshActorGrowthPlan(who, items, world);
  const json = JSON.stringify(who), restored = JSON.parse(json);
  withSimulationRandom(() => { throw new Error('observation must not draw randomness'); }, () => {
    assert.deepEqual(getActorGrowthObservation(who, items, { ruleset }), getActorGrowthObservation(restored, items, { ruleset }));
  });
  assert.equal(JSON.stringify(who), json);
  assert.deepEqual(buildActorGrowthPlan(who, items, world), buildActorGrowthPlan(restored, items, world));
});

await check('invalid quantities cannot satisfy a goal and legacy item IDs are consumed by the same contract', () => {
  for (const qty of [0, -1, 0.5, NaN, Infinity, true, null, '']) {
    const who = actor(); who.inventory[0].qty = qty;
    assert.equal(invQty(who.inventory, hero._id), 0);
    assert.equal(buildActorGrowthPlan(who, items, world).openingComplete, false);
  }
  const who = actor(); delete who.inventory[0].itemId;
  who.inventory.push({ ...cloth, qty: 1 });
  refreshActorGrowthPlan(who, items, world);
  const crafted = tryAutoCraftFromInventory(who, items, buildItemNameById(items), buildItemMetaById(items), 3, 4, ruleset);
  assert.equal(crafted.craftedId, selected._id);
  assert.equal(invQty(who.inventory, hero._id), 0); assert.equal(invQty(who.inventory, cloth._id), 0);
  assert.equal(who.equipped.head, selected._id); assert.equal(who.simCredits, 17);
});

await check('the procurement boundary does not subtract already-held rare material twice', () => {
  const mithril = { _id: 'late-mithril', name: '미스릴', type: '재료', tier: 5 };
  const rare = { ...selected, recipe: { ingredients: [{ itemId: hero._id, qty: 1 }, { itemId: mithril._id, qty: 4 }] } };
  const catalog = [cloth, hero, mithril, rare], who = actor();
  who.inventory.push({ ...mithril, itemId: mithril._id, qty: 2 });
  refreshActorGrowthPlan(who, catalog, world);
  assert.equal(who._growthPlan.missing[0].need, 2, 'growth cards display the remaining quantity');
  const before = structuredClone(who._growthPlan);
  const goal = getActorGrowthCraftGoal(who, catalog);
  assert.equal(countMissingSpecialNeed(goal.missing, 'mithril'), 2, 'procurement expects total requirement minus actual held quantity');
  assert.deepEqual(who._growthPlan, before);
});

console.log(`LATE_GROWTH_GOAL_CHECKS ${passed}/${passed + failed}`);
if (failed) process.exitCode = 1;
