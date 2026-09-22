import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';
const { createRandomIsolationInput } = await import('./lib/run-random-isolation-match.mjs');
const { buildTeamCoordination } = await import('../src/app/simulation/_lib/teamTacticsRuntime.js');
const { runActorMovementDecisionPhase } = await import('../src/app/simulation/_lib/phaseActorMovementRuntime.js');
const { runPhaseActorActionPipeline } = await import('../src/app/simulation/_lib/phaseActorActionPipelineRuntime.js');
const { describeTeamRegroupDecision } = await import('../src/app/simulation/_lib/teamRegroupRuntime.js');
const { refreshActorGrowthPlan, getActorGrowthProgress } = await import('../src/app/simulation/_lib/growthPlanRuntime.js');
const { buildBaseZoneGraph, buildHyperloopZoneGraph, isHyperloopTransit } = await import('../src/app/simulation/_lib/mapGraphRuntime.js');
const { buildCraftableItems, buildItemMetaById, buildItemNameById, buildItemKeyById } = await import('../src/app/simulation/_lib/itemOptionsRuntime.js');
const { createFieldResources, getFieldResourceQty } = await import('../src/app/simulation/_lib/fieldResourceRuntime.js');
const { applyLootCraftResult } = await import('../src/app/simulation/_lib/lootCraftResultRuntime.js');
const { autoEquipBest } = await import('../src/app/simulation/_lib/gearFallbackRuntime.js');
const { invQty, inferEquipSlot, normalizeInventory } = await import('../src/app/simulation/_lib/inventoryRules.js');
const { getRuleset } = await import('../src/utils/rulesets.js');
const { withSimulationRandom } = await import('../src/utils/simulationRandom.js');
const { createSeedRng } = await import('../src/app/simulation/_lib/randomSeedRuntime.js');
const { emitCraftRunEvent, emitItemGainIfAny, emitQueueRunEvent } = await import('../src/app/simulation/_lib/runEventRuntime.js');

// Substitute scenario, NOT the missing evaluator/Marcus match. Initial owned
// equipment is explicit test input; production rules never award that loadout.
console.log('Preparing real Lumia map/catalog control (not the original evaluator input).');
const fixture = JSON.parse(await createRandomIsolationInput('regroup-lumia-control'));
const mapObj = fixture.map, ruleset = getRuleset('ER_S11');
const baseGraph = buildBaseZoneGraph(mapObj, mapObj.zones);
const loops = mapObj.zones.filter((zone) => zone.hasHyperloop).map((zone) => zone.zoneId);
const zoneGraph = buildHyperloopZoneGraph(baseGraph, mapObj.zones, loops);
const zoneName = (id) => mapObj.zones.find((zone) => zone.zoneId === id)?.name || id;
const HOSPITAL = 'hospital', GAS = 'gas_station';
const makeWorld = (items = fixture.items) => ({ mapObj, zones: mapObj.zones, zoneGraph, ruleset,
  publicItems: items, craftables: buildCraftableItems(items), itemMetaById: buildItemMetaById(items),
  itemNameById: buildItemNameById(items), itemKeyById: buildItemKeyById(items),
  forbiddenIds: new Set(), nextSpawn: { fieldResources: createFieldResources(mapObj, items, ruleset) },
  nextDay: 2, nextPhase: 'night', phaseIdxNow: 3, kiosks: [], droneOffers: [],
  actionIntervalSec: 20, statusElapsedSec: 0, hyperloopDelaySec: 3 });
const preparedSquad = (world) => fixture.survivors.slice(0, 3).map((source, index) => {
  const actor = { ...structuredClone(source), _id: ['lone', 'anchor', 'friend'][index],
    name: ['병원 단독 대원', '주유소 동료 1', '주유소 동료 2'][index], teamId: 'controlled-team', teamSlot: index + 1,
    zoneId: index ? GAS : HOSPITAL, hp: source.maxHp, _itemKeyById: world.itemKeyById,
    inventory: normalizeInventory(source.routePlanTargetItemIds.map((id) => ({
      ...structuredClone(world.publicItems.find((item) => item._id === id)), itemId: id, qty: 1 })), ruleset),
    equipped: {}, _growthReadyAtSec: 0, _actionReadyAtSec: 0 };
  autoEquipBest(actor, world.itemMetaById);
  assert.equal(refreshActorGrowthPlan(actor, world.publicItems, world).openingComplete, true);
  assert.equal(getActorGrowthProgress(actor, world.publicItems).completedSlots, 5);
  assert.equal(Object.values(actor.equipped).filter(Boolean).length, 5);
  return actor;
});
const coordination = (roster, world) => buildTeamCoordination({ roster, zoneGraph: world.zoneGraph,
  forbiddenIds: world.forbiddenIds, day: 2, phase: 'night', publicItems: world.publicItems,
  ruleset, spawnState: world.nextSpawn, maxDepth: ruleset.ai.safeSearchDepth });
const record = (sec) => {
  const events = [], logs = [];
  const emitRunEvent = (kind, payload, at) => events.push(structuredClone({ kind, ...payload, at }));
  const actions = { atNow: () => ({ day: 2, phase: 'night', sec }), emitRunEvent,
    addLog: (message) => logs.push(message), getZoneName: zoneName,
    isHyperloopTransit: (from, to) => isHyperloopTransit(baseGraph, loops, from, to),
    emitCraftRunEvent: (...args) => emitCraftRunEvent(emitRunEvent, ...args),
    emitItemGainIfAny: (...args) => emitItemGainIfAny(emitRunEvent, ...args),
    emitQueueRunEvent: (...args) => emitQueueRunEvent(emitRunEvent, ...args) };
  actions.applyLootCraftResult = (actor, crafted, meta, at, zoneId) => applyLootCraftResult(actor, crafted, meta,
    { at, zoneId, addLog: actions.addLog, emitCraftRunEvent: actions.emitCraftRunEvent });
  return { events, logs, actions };
};
const move = (source, roster, world, sec = 400) => {
  const plans = coordination(roster, world), rec = record(sec); let cost = 0;
  const result = runActorMovementDecisionPhase({ state: { ...world, actor: structuredClone(source), phaseSurvivors: roster,
    teamMovementPlan: plans.movementPlans.get(source._id), teamRegroupDecision: plans.regroupDecisions.get(source._id) },
  actions: { ...rec.actions, reserveActionSecond: (seconds) => { cost += seconds; } } });
  return { ...result, ...rec, cost };
};
const tick = (roster, world, sec) => {
  const rec = record(sec);
  const result = withSimulationRandom(createSeedRng(`regroup-lumia:${sec}`), () => runPhaseActorActionPipeline({
    state: { ...world, phaseSurvivors: roster, currentActionSec: () => sec }, actions: rec.actions }));
  assert.deepEqual(result.newlyDead, []);
  return { ...result, ...rec };
};
let checks = 0;
const check = (name, fn) => { fn(); checks += 1; console.log(`PASS ${name}`); };

check('the control uses the actual hospital/gas-station hyperloop edge, not a fabricated adjacent road', () => {
  assert.equal(zoneName(HOSPITAL), '병원'); assert.equal(zoneName(GAS), '주유소');
  assert.equal(baseGraph[HOSPITAL].includes(GAS), false);
  assert.equal(isHyperloopTransit(baseGraph, loops, HOSPITAL, GAS), true);
  assert.ok(zoneGraph[HOSPITAL].includes(GAS));
});

check('a ready lone member joins two gas-station allies with a three-second travel cost and no new gear', () => {
  const world = makeWorld(), squad = preparedSquad(world), before = structuredClone(squad);
  let draws = 0;
  const result = withSimulationRandom(() => { draws += 1; return 0.999999; }, () => move(squad[0], squad, world));
  assert.equal(result.nextZoneId, GAS); assert.equal(result.moveReason, 'team_regroup');
  assert.equal(result.usedHyperloopMove, true); assert.equal(result.moveEtaSec, 3); assert.equal(result.cost, 3);
  assert.equal(draws, 0, 'A committed safe regroup must not depend on another movement coin flip.');
  assert.equal(result.actor._teamRegroup.status, 'arrived');
  assert.equal(result.actor._teamRegroup.companionsAtTarget, 2);
  assert.match(describeTeamRegroupDecision(result.actor._teamRegroup, zoneName), /주유소.*현장 동료 2명/);
  assert.deepEqual(result.actor.inventory, before[0].inventory); assert.deepEqual(result.actor.equipped, before[0].equipped);
  assert.deepEqual(squad, before, 'Movement/planning must not rewrite the source fixture or other members.');
});

check('scheduled travel reserves only the moving member and keeps the normal twenty-second growth cycle', () => {
  const world = makeWorld(), squad = preparedSquad(world), result = tick(squad, world, 400);
  const lone = result.updatedSurvivors.find((actor) => actor._id === 'lone');
  assert.equal(lone.zoneId, GAS); assert.equal(lone._actionReadyAtSec, 403); assert.equal(lone._growthReadyAtSec, 420);
  assert.ok(result.updatedSurvivors.every((actor) => actor.zoneId === GAS && actor._growthReadyAtSec === 420));
  assert.ok(result.events.filter((event) => event.kind === 'action_cycle').every((event) => event.at.sec === 400));
  assert.equal(result.events.filter((event) => event.kind === 'move').length, 1);
  // The engine commits the region at decision time and locks actions for travel;
  // this does not assert continuous map animation or a delayed region transition.
});

check('an existing action lock ends at its actual ready time, not on a later day or random opportunity', () => {
  const world = makeWorld(); let squad = preparedSquad(world);
  squad.forEach((actor) => { actor._growthReadyAtSec = 420; });
  for (const sec of [400, 419.75]) {
    const held = tick(squad, world, sec); squad = held.updatedSurvivors;
    assert.equal(squad[0].zoneId, HOSPITAL); assert.equal(squad[0]._teamRegroup.status, 'action_wait');
    assert.equal(held.events.some((event) => event.kind === 'move'), false);
  }
  const ready = tick(squad, world, 420);
  assert.equal(ready.updatedSurvivors[0].zoneId, GAS);
  assert.equal(ready.updatedSurvivors[0]._actionReadyAtSec, 423);
  assert.equal(ready.events.find((event) => event.kind === 'move').at.sec, 420);
});

check('actual low HP and movement control explain a hold instead of reporting successful regroup', () => {
  const world = makeWorld(), squad = preparedSquad(world);
  squad[0].hp = 12;
  const hurt = move(squad[0], squad, world);
  assert.equal(hurt.actor._teamRegroup.status, 'recovery'); assert.equal(hurt.actor.hp, 12);
  assert.match(describeTeamRegroupDecision(hurt.actor._teamRegroup, zoneName), /HP 12\/\d+.*회복 기준 30 이하/);
  squad[0].hp = squad[0].maxHp;
  squad[0].activeEffects = [{ name: '기절', remainingDuration: 10, durationUnit: 'sec' }];
  const controlled = move(squad[0], squad, world);
  assert.equal(controlled.nextZoneId, HOSPITAL); assert.equal(controlled.actor._teamRegroup.status, 'status');
});

check('an enemy or forbidden gas station cannot pull the lone member into that unsafe rally', () => {
  for (const danger of ['enemy', 'forbidden']) {
    const world = makeWorld(), squad = preparedSquad(world);
    if (danger === 'forbidden') world.forbiddenIds.add(GAS);
    else squad.push({ ...structuredClone(squad[1]), _id: 'enemy', teamId: 'enemy-team' });
    const result = move(squad[0], squad, world);
    assert.equal(result.nextZoneId, HOSPITAL);
    assert.equal(result.actor._teamRegroup.targetZoneId, HOSPITAL);
    assert.equal(result.actor._teamRegroup.status, 'waiting');
  }
});

const RAW = 'control:hospital-part', HAT = 'control:custom-head';
const unfinishedControl = (hasSource = true) => {
  const raw = { _id: RAW, name: '통제용 머리 장비 부품', type: '재료', category: 'material', tier: 1,
    spawnZones: hasSource ? [HOSPITAL] : [], recipe: { ingredients: [] } };
  const hat = { _id: HAT, name: '통제용 커스텀 머리 장비', type: '방어구', category: 'equipment',
    equipSlot: 'head', tier: 4, recipe: { ingredients: [{ itemId: RAW, qty: 1 }] } };
  const world = makeWorld([...fixture.items, raw, hat]), squad = preparedSquad(world), actor = squad[0];
  actor.routePlanTargetItemIds = actor.routePlanTargetItemIds.map((id) => inferEquipSlot(world.itemMetaById[id]) === 'head' ? HAT : id);
  actor.inventory = actor.inventory.filter((item) => inferEquipSlot(item) !== 'head');
  actor._growthFocusId = HAT;
  autoEquipBest(actor, world.itemMetaById); refreshActorGrowthPlan(actor, world.publicItems, world);
  assert.equal(getActorGrowthProgress(actor, world.publicItems).completedSlots, 4);
  assert.equal(actor.equipped.head, null);
  return { world, squad };
};

check('a 4/5 member keeps the exact hospital recipe and ready gas-station allies escort it', () => {
  const { world, squad } = unfinishedControl(), plans = coordination(squad, world);
  assert.equal(plans.movementPlans.has('lone'), false);
  for (const id of ['anchor', 'friend']) {
    assert.equal(plans.movementPlans.get(id).targetZoneId, HOSPITAL);
    assert.equal(plans.movementPlans.get(id).nextStep, HOSPITAL);
  }
  const farmer = move(squad[0], squad, world);
  assert.equal(farmer.nextZoneId, HOSPITAL); assert.equal(farmer.actor._teamRegroup.status, 'growing');
  assert.match(describeTeamRegroupDecision(farmer.actor._teamRegroup, zoneName), /확보 4\/5.*부족: 통제용 머리 장비 부품 ×1/);
  assert.equal(invQty(farmer.actor.inventory, HAT), 0);
  const escort = move(squad[1], squad, world);
  assert.equal(escort.nextZoneId, HOSPITAL); assert.equal(escort.moveEtaSec, 3);
});

check('the empty custom slot is filled by a paid recipe, and escort plans use the same pre-action roster', () => {
  const { world, squad } = unfinishedControl();
  const initialStock = getFieldResourceQty(world.nextSpawn.fieldResources, HOSPITAL, RAW);
  assert.ok(initialStock > 0 && Number.isFinite(initialStock));
  const result = tick(squad, world, 400), actor = result.updatedSurvivors[0];
  assert.ok(result.updatedSurvivors.every((row) => row.zoneId === HOSPITAL));
  assert.equal(actor.equipped.head, HAT); assert.equal(invQty(actor.inventory, HAT), 1);
  assert.equal(invQty(actor.inventory, RAW), 0);
  assert.equal(getActorGrowthProgress(actor, world.publicItems).completedSlots, 5);
  assert.equal(getFieldResourceQty(world.nextSpawn.fieldResources, HOSPITAL, RAW), initialStock - 1);
  const crafts = result.events.filter((event) => event.kind === 'craft' && event.who === 'lone' && event.itemId === HAT);
  assert.equal(crafts.length, 1);
  assert.equal(result.events.filter((event) => event.kind === 'field_resource' && event.who === 'lone' && event.itemId === RAW).length, 1);
  assert.equal(result.events.filter((event) => event.kind === 'move' && event.reason === 'team_regroup').length, 2);
});

check('a custom recipe with no source stays visibly incomplete and never invents equipment to enable regroup', () => {
  const { world, squad } = unfinishedControl(false), actor = squad[0];
  assert.equal(actor._growthPlan.blocked, 'no_material_source');
  assert.equal(getFieldResourceQty(world.nextSpawn.fieldResources, HOSPITAL, RAW), 0);
  const result = tick(squad, world, 400), lone = result.updatedSurvivors[0];
  assert.equal(lone.zoneId, GAS); assert.equal(lone.equipped.head, null);
  assert.equal(invQty(lone.inventory, HAT), 0); assert.equal(invQty(lone.inventory, RAW), 0);
  assert.equal(getActorGrowthProgress(lone, world.publicItems).completedSlots, 4);
  assert.equal(lone._growthPlan.blocked, 'no_material_source');
  assert.equal(result.events.some((event) => event.kind === 'craft' && event.itemId === HAT), false);
});

console.log(`LUMIA_REGROUP_CONTROL_CHECKS ${checks}/${checks}`);
