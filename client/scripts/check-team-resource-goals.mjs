import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';
const { runPhaseActorActionPipeline } = await import('../src/app/simulation/_lib/phaseActorActionPipelineRuntime.js');
const { refreshActorGrowthPlan } = await import('../src/app/simulation/_lib/growthPlanRuntime.js');
const { buildTeamCoordination, pickTeamSafeZone } = await import('../src/app/simulation/_lib/teamTacticsRuntime.js');
const { chooseAiMoveTargets } = await import('../src/app/simulation/_lib/aiMoveTargetRuntime.js');
const { getActorGrowthCraftGoal } = await import('../src/app/simulation/_lib/growthPlanRuntime.js');
const { buildItemMetaById, buildItemNameById, buildItemKeyById, buildCraftableItems } = await import('../src/app/simulation/_lib/itemOptionsRuntime.js');
const { createFieldResources } = await import('../src/app/simulation/_lib/fieldResourceRuntime.js');
const { applyLootCraftResult } = await import('../src/app/simulation/_lib/lootCraftResultRuntime.js');
const { invQty } = await import('../src/app/simulation/_lib/inventoryRules.js');
const { getRuleset } = await import('../src/utils/rulesets.js');
const { withSimulationRandom } = await import('../src/utils/simulationRandom.js');
const eventActions = await import('../src/app/simulation/_lib/runEventRuntime.js');
const { emitSimulationRunEvent } = await import('../src/app/simulation/_lib/logActionRuntime.js');
const { pickupSpawnedCore } = await import('../src/app/simulation/_lib/spawnConsumersRuntime.js');
const { getAvailableMovementObjective, describeMovementObjective } = await import('../src/app/simulation/_lib/movementObjectiveRuntime.js');
const { buildTeamObserverModel } = await import('../src/app/simulation/_lib/teamObserverRuntime.js');
const { buildGuestSimulationMap } = await import('../src/app/simulation/_lib/guestSimulationBootstrap.js');
const { buildIsolationNavigation } = await import('./lib/run-random-isolation-match.mjs');
const { isHyperloopTransit } = await import('../src/app/simulation/_lib/mapGraphRuntime.js');

// Explicit recipe/world inputs, not the unavailable Marcus match or official item stats.
const hero = { _id: 'team-hero', itemKey: 'team-hero', name: '초기 모자', type: '방어구', category: 'equipment',
  equipSlot: 'head', tier: 4, stats: { defense: 10 } };
const cloth = { _id: 'team-cloth', name: '추가 천', type: '재료', tier: 1, spawnZones: ['b'] };
const tree = { _id: 'team-tree', name: '생명의 나무', type: '재료', tier: 4 };
const meteor = { _id: 'team-meteor', name: '운석', type: '재료', tier: 4 };
const gear = (id, name, materialId) => ({ ...hero, _id: id, itemKey: id, name, tier: 5, stats: { defense: 20 },
  recipe: { ingredients: [{ itemId: hero._id, qty: 1 }, { itemId: materialId, qty: 1 }], resultQty: 1, creditsCost: 3 } });
const ordinary = gear('team-ordinary', '천 모자', cloth._id), rare = gear('team-rare', '생명 모자', tree._id);
const items = [hero, cloth, tree, meteor, ordinary, rare];
const fixture = () => {
  const ruleset = structuredClone(getRuleset('ER_S11'));
  ruleset.worldSpawns.dimensionRift.enabled = false;
  const mapObj = { zones: ['a', 'b', 'c'].map((zoneId) => ({ zoneId, name: zoneId, hasKiosk: false })) };
  const state = { mapObj, zones: mapObj.zones, zoneGraph: { a: ['b', 'c'], b: ['a'], c: ['a'] },
    forbiddenIds: new Set(), nextDay: 3, nextPhase: 'morning', phaseIdxNow: 4, ruleset,
    publicItems: items, craftables: buildCraftableItems(items), itemMetaById: buildItemMetaById(items),
    itemNameById: buildItemNameById(items), itemKeyById: buildItemKeyById(items),
    actionIntervalSec: 20, statusElapsedSec: 0, currentActionSec: () => 500, kiosks: [], droneOffers: [],
    nextSpawn: { coreNodes: [{ id: 'tree-c', kind: 'life_tree', zoneId: 'c', picked: false }],
      fieldResources: createFieldResources(mapObj, items, ruleset) } };
  const roster = ['leader', 'crafter', 'escort'].map((_id, index) => ({ _id, name: _id, teamId: 'team:1', teamSlot: index + 1,
    zoneId: 'a', hp: 100, maxHp: 100, stats: { attackPower: 20, defense: 10 }, simCredits: 20,
    inventory: [{ ...structuredClone(hero), itemId: hero._id, qty: 1 }], equipped: { head: hero._id },
    routePlanTargetItemIds: [hero._id], goalLoadouts: { legend: { headKey: index === 1 ? rare.itemKey : ordinary.itemKey } } }));
  for (const actor of roster) refreshActorGrowthPlan(actor, items, state);
  return { state, roster };
};
const plan = ({ state, roster }) => buildTeamCoordination({ roster, zoneGraph: state.zoneGraph, forbiddenIds: state.forbiddenIds,
  day: state.nextDay, phase: state.nextPhase, spawnState: state.nextSpawn, ruleset: state.ruleset, publicItems: state.publicItems,
  isSoloMatch: state.isSoloMatch, estimatePower: () => 100, chooseLeaderMove: (actor) => chooseAiMoveTargets({ actor,
    craftGoal: getActorGrowthCraftGoal(actor, state.publicItems), mapObj: state.mapObj, spawnState: state.nextSpawn,
    forbiddenIds: state.forbiddenIds, day: state.nextDay, phase: state.nextPhase, ruleset: state.ruleset }) });
const tick = ({ state, roster, navigation }) => {
  const events = [], logs = [];
  const emitRunEvent = (kind, payload, at) => emitSimulationRunEvent({ kind, payload, at,
    actions: { enqueueRunEvent: (event) => events.push(structuredClone(event)) } });
  const actions = { atNow: () => ({ day: state.nextDay, phase: state.nextPhase, sec: state.currentActionSec() }), emitRunEvent,
    ...(navigation ? { isHyperloopTransit: (from, to) => isHyperloopTransit(navigation.baseGraph, navigation.loops, from, to) } : {}),
    addLog: (message) => logs.push(message),
    emitItemGainIfAny: (...args) => eventActions.emitItemGainIfAny(emitRunEvent, ...args),
    emitObjectiveRunEvent: (...args) => eventActions.emitObjectiveRunEvent(emitRunEvent, ...args),
    emitQueueRunEvent: (...args) => eventActions.emitQueueRunEvent(emitRunEvent, ...args),
    emitCraftRunEvent: (...args) => eventActions.emitCraftRunEvent(emitRunEvent, ...args) };
  actions.applyLootCraftResult = (actor, result, meta, at, zoneId) => applyLootCraftResult(actor, result, meta,
    { at, zoneId, addLog: actions.addLog, emitCraftRunEvent: actions.emitCraftRunEvent });
  const result = withSimulationRandom(() => 0, () => runPhaseActorActionPipeline({ state: { ...state, phaseSurvivors: roster }, actions }));
  return { ...result, events, logs };
};
let checks = 0;
const check = (name, run) => { run(); checks++; console.log(`PASS ${name}`); };

check('a teammate\'s real rare recipe can set the shared destination instead of the leader\'s ordinary material', () => {
  const input = fixture(), before = structuredClone({ roster: input.roster, spawn: input.state.nextSpawn });
  const result = withSimulationRandom(() => { throw new Error('Concrete team recipe selection must not draw randomness.'); }, () => plan(input));
  assert.equal(input.roster[0]._growthPlan.nextStep, 'b');
  assert.equal(input.roster[1]._growthPlan.missing[0].itemId, tree._id);
  for (const actor of input.roster) {
    const move = result.movementPlans.get(actor._id);
    assert.equal(move.targetZoneId, 'c');
    assert.equal(move.objective.beneficiary.who, 'crafter');
    assert.deepEqual(move.objective.sourceIds, ['tree-c']);
  }
  assert.deepEqual(input.roster, before.roster); assert.deepEqual(input.state.nextSpawn, before.spawn);
});

check('the real action pipeline collects once for the needing teammate and pays its actual recipe in either actor order', () => {
  for (const reverse of [false, true]) {
    const input = fixture(); if (reverse) input.roster.reverse();
    const result = tick(input);
    assert.ok(result.updatedSurvivors.every((actor) => actor.zoneId === 'c'));
    const crafter = result.updatedSurvivors.find((actor) => actor._id === 'crafter');
    assert.equal(crafter.equipped.head, rare._id); assert.equal(crafter.simCredits, 17);
    assert.equal(invQty(crafter.inventory, tree._id), 0); assert.equal(invQty(crafter.inventory, hero._id), 0);
    const gains = result.events.filter((event) => event.kind === 'gain' && event.itemId === tree._id);
    assert.equal(gains.length, 1); assert.equal(gains[0].who, 'crafter');
    assert.equal(input.state.nextSpawn.coreNodes[0].picked, true);
    assert.ok(result.updatedSurvivors.filter((actor) => actor._id !== 'crafter').every((actor) => actor.equipped.head === hero._id));
  }
});

check('a team goal names the recipient and recipe, then disappears when that exact source is collected', () => {
  const input = fixture(), goal = plan(input).movementPlans.get('leader').objective;
  assert.match(describeMovementObjective(goal), /생명의 나무 확보.*crafter의 생명 모자 제작 재료/);
  const result = tick(input);
  assert.ok(result.logs.some((line) => /팀 공동 목표.*생명의 나무.*crafter의 생명 모자/.test(line)));
  const event = result.events.find((row) => row.kind === 'movement_goal' && row.objective?.beneficiary);
  assert.equal(event.objective.beneficiary.targetItemId, rare._id);
  assert.equal(getAvailableMovementObjective(goal, { spawnState: input.state.nextSpawn }), null);
  const model = buildTeamObserverModel({ survivors: result.updatedSurvivors, dead: [], spawnState: input.state.nextSpawn,
    publicItems: items, events: result.events, teamId: 'team:1', matchSec: 500 });
  assert.equal(model.objectives.length, 0, 'A finished source is not an active goal in the observer.');
  input.state.nextSpawn.coreNodes.push({ id: 'new-tree-c', kind: 'life_tree', zoneId: 'c', picked: false });
  assert.equal(getAvailableMovementObjective(goal, { spawnState: input.state.nextSpawn }), null);
});

check('an already owned ingredient or completed target cannot invent another rare need', () => {
  for (const owned of [tree, rare]) {
    const input = fixture(), crafter = input.roster[1];
    crafter.inventory.push({ ...structuredClone(owned), itemId: owned._id, qty: 1 });
    const result = plan(input);
    assert.ok([...result.movementPlans.values()].every((move) => !move.objective?.beneficiary));
  }
});

check('forbidden, unreachable, overwhelmed, picked and missing sources never become a shared recipe destination', () => {
  for (const scenario of ['forbidden', 'unreachable', 'overwhelmed', 'picked', 'missing']) {
    const input = fixture();
    if (scenario === 'forbidden') input.state.forbiddenIds.add('c');
    if (scenario === 'unreachable') input.state.zoneGraph.a = ['b'];
    if (scenario === 'picked') input.state.nextSpawn.coreNodes[0].picked = true;
    if (scenario === 'missing') input.state.nextSpawn.coreNodes = [];
    if (scenario === 'overwhelmed') for (let i = 0; i < 4; i++) input.roster.push({ ...structuredClone(input.roster[0]),
      _id: `enemy-${i}`, teamId: `enemy:${i}`, zoneId: 'c' });
    const result = plan(input);
    assert.ok(input.roster.filter((actor) => actor.teamId === 'team:1').every((actor) =>
      !result.movementPlans.get(actor._id)?.objective?.beneficiary), scenario);
  }
});

check('unfinished opening equipment, separation, recovery, solo and endgame keep their earlier priorities', () => {
  for (const scenario of ['opening', 'split', 'recovery', 'solo', 'endgame']) {
    const input = fixture();
    if (scenario === 'opening') input.roster[0]._growthPlan.openingComplete = false;
    if (scenario === 'split') input.roster[0].zoneId = 'b';
    if (scenario === 'recovery') input.roster[0].hp = 12;
    if (scenario === 'solo') input.state.isSoloMatch = true;
    if (scenario === 'endgame') input.state.nextSpawn.endgame = { stage: 'final' };
    assert.ok([...plan(input).movementPlans.values()].every((move) => !move.objective?.beneficiary), scenario);
  }
});

check('a full recipient inventory cannot cause a resource to be reserved and lost', () => {
  const input = fixture(); input.state.ruleset.inventory = { ...input.state.ruleset.inventory, maxSlots: 1, autoDropLowValue: false };
  assert.ok([...plan(input).movementPlans.values()].every((move) => !move.objective?.beneficiary));
  assert.equal(input.state.nextSpawn.coreNodes[0].picked, false);
});

check('the team yields only its selected source, without granting it remotely or protecting it from enemies', () => {
  const input = fixture(), goal = plan(input).movementPlans.get('leader').objective;
  const leader = input.roster[0], crafter = input.roster[1];
  assert.equal(pickupSpawnedCore(input.state.nextSpawn, 'c', items, 3, 'morning', leader, input.state.ruleset,
    { deferredSourceIds: goal.sourceIds }), null);
  assert.equal(input.state.nextSpawn.coreNodes[0].picked, false);
  assert.equal(invQty(crafter.inventory, tree._id), 0);
  const enemy = { ...leader, _id: 'enemy', name: 'enemy', teamId: 'other' };
  const reward = pickupSpawnedCore(input.state.nextSpawn, 'c', items, 3, 'morning', enemy, input.state.ruleset);
  assert.equal(reward.itemId, tree._id); assert.equal(input.state.nextSpawn.coreNodes[0].pickedBy, 'enemy');
  assert.equal(getAvailableMovementObjective(goal, { spawnState: input.state.nextSpawn }), null);
});

check('a targeted tree is picked before an unrelated meteor in the same region without consuming both', () => {
  const input = fixture();
  input.state.nextSpawn.coreNodes.unshift({ id: 'meteor-c', kind: 'meteor', zoneId: 'c', picked: false });
  const goal = plan(input).movementPlans.get('crafter').objective;
  assert.deepEqual(goal.sourceIds, ['tree-c']);
  const reward = pickupSpawnedCore(input.state.nextSpawn, 'c', items, 3, 'morning', input.roster[1], input.state.ruleset,
    { preferredSourceIds: goal.sourceIds });
  assert.equal(reward.itemId, tree._id); assert.equal(input.state.nextSpawn.coreNodes[0].picked, false);
});

check('the same policy supports an actual meteor recipe, not just a label for trees', () => {
  const input = fixture();
  const meteorGear = gear('team-meteor-hat', '운석 모자', meteor._id);
  const catalog = [...items, meteorGear];
  input.roster[1].goalLoadouts.legend.headKey = meteorGear._id;
  refreshActorGrowthPlan(input.roster[1], catalog, input.state);
  input.state.nextSpawn.coreNodes = [{ id: 'meteor-c', kind: 'meteor', zoneId: 'c', picked: false }];
  const result = buildTeamCoordination({ roster: input.roster, zoneGraph: input.state.zoneGraph, day: 3,
    spawnState: input.state.nextSpawn, publicItems: catalog, ruleset: input.state.ruleset });
  const goal = result.movementPlans.get('leader').objective;
  assert.equal(goal.beneficiary.targetItemId, meteorGear._id); assert.match(describeMovementObjective(goal), /운석 확보/);
});

check('an active action lock still synchronizes the team before it can chase or collect a resource', () => {
  const input = fixture(); input.roster[1]._growthReadyAtSec = 510;
  const held = tick(input);
  assert.ok(held.updatedSurvivors.every((actor) => actor.zoneId === 'a'));
  assert.equal(input.state.nextSpawn.coreNodes[0].picked, false);
  input.roster = held.updatedSurvivors; input.state.currentActionSec = () => 510;
  const ready = tick(input);
  assert.ok(ready.updatedSurvivors.every((actor) => actor.zoneId === 'c'));
  assert.equal(ready.updatedSurvivors.find((actor) => actor._id === 'crafter').equipped.head, rare._id);
});

check('a distant material is neither received nor spent before the team actually reaches its region', () => {
  const input = fixture(); input.state.zoneGraph = { a: ['b'], b: ['a', 'c'], c: ['b'] };
  const first = tick(input);
  assert.ok(first.updatedSurvivors.every((actor) => actor.zoneId === 'b'));
  assert.equal(input.state.nextSpawn.coreNodes[0].picked, false);
  assert.equal(first.events.some((event) => event.kind === 'gain' && event.itemId === tree._id), false);
  input.roster = first.updatedSurvivors; input.state.currentActionSec = () => 520;
  const second = tick(input), crafter = second.updatedSurvivors.find((actor) => actor._id === 'crafter');
  assert.ok(second.updatedSurvivors.every((actor) => actor.zoneId === 'c'));
  assert.equal(crafter.equipped.head, rare._id);
});

check('collecting a rare material cannot bypass a missing recipe payment', () => {
  const input = fixture(); input.roster[1].simCredits = 0;
  const result = tick(input), crafter = result.updatedSurvivors.find((actor) => actor._id === 'crafter');
  assert.equal(invQty(crafter.inventory, tree._id), 1); assert.equal(crafter.simCredits, 0);
  assert.equal(crafter.equipped.head, hero._id); assert.equal(invQty(crafter.inventory, rare._id), 0);
});

function distantLumiaFixture() {
  const input = fixture(), mapObj = buildGuestSimulationMap();
  input.navigation = buildIsolationNavigation(mapObj);
  Object.assign(input.state, { mapObj, zones: input.navigation.zones, zoneGraph: input.navigation.zoneGraph,
    forbiddenIds: new Set(['gas_station', 'temple', 'stream']) });
  input.state.nextSpawn.coreNodes = [{ id: 'tree-forest', kind: 'life_tree', zoneId: 'forest', picked: false }];
  input.state.nextSpawn.fieldResources = createFieldResources(mapObj, items, input.state.ruleset);
  for (const actor of input.roster) {
    actor.zoneId = 'alley';
    refreshActorGrowthPlan(actor, items, input.state);
  }
  return input;
}

check('a real Lumia detour to a spawned recipe ingredient is not limited by nearby retreat search depth', () => {
  const input = distantLumiaFixture(), before = structuredClone({ roster: input.roster, spawn: input.state.nextSpawn });
  const safeRoute = pickTeamSafeZone(input.roster[0], input.roster, input.state.zoneGraph, input.state.forbiddenIds,
    { estimatePower: () => 100, maxDepth: input.state.zones.length, targetZoneId: 'forest', travelParty: input.roster });
  assert.equal(safeRoute.distance, 4); assert.equal(safeRoute.nextStep, 'police');
  assert.equal(pickTeamSafeZone(input.roster[0], input.roster, input.state.zoneGraph, input.state.forbiddenIds,
    { estimatePower: () => 100, maxDepth: 3, targetZoneId: 'forest', travelParty: input.roster }), null,
  'The nearby retreat policy must retain its separate depth limit.');
  const result = withSimulationRandom(() => { throw new Error('Safe recipe routing must not draw randomness.'); }, () => plan(input));
  for (const actor of input.roster) {
    const move = result.movementPlans.get(actor._id);
    assert.equal(move?.objective?.beneficiary?.who, 'crafter');
    assert.equal(move.targetZoneId, 'forest'); assert.equal(move.nextStep, 'police');
    assert.deepEqual(move.objective.sourceIds, ['tree-forest']);
  }
  assert.deepEqual(input.roster, before.roster); assert.deepEqual(input.state.nextSpawn, before.spawn);
});

check('the four-edge Lumia detour executes as shared adjacent steps before one real pickup and paid craft', () => {
  const input = distantLumiaFixture(), events = [];
  let now = 500, steps = 0;
  while (input.roster[0].zoneId !== 'forest') {
    assert.ok(++steps <= 4, 'A finite safe recipe route must not become a wandering loop.');
    const from = input.roster[0].zoneId;
    const next = pickTeamSafeZone(input.roster[0], input.roster, input.state.zoneGraph, input.state.forbiddenIds,
      { maxDepth: input.state.zones.length, targetZoneId: 'forest', travelParty: input.roster }).nextStep;
    input.state.currentActionSec = () => now;
    const result = tick(input); events.push(...result.events); input.roster = result.updatedSurvivors;
    assert.ok(input.state.zoneGraph[from].includes(next)); assert.ok(!input.state.forbiddenIds.has(next));
    assert.ok(input.roster.every(actor => actor.zoneId === next), `The whole team must take ${from} -> ${next}.`);
    if (next !== 'forest') {
      assert.equal(input.state.nextSpawn.coreNodes[0].picked, false);
      assert.equal(events.some(event => event.kind === 'gain' && event.itemId === tree._id), false);
      assert.ok(input.roster.every(actor => invQty(actor.inventory, rare._id) === 0));
    }
    now = Math.max(now + 20, ...input.roster.map(actor => Math.max(actor._growthReadyAtSec || 0, actor._actionReadyAtSec || 0)));
  }
  assert.equal(steps, 4);
  const crafter = input.roster.find(actor => actor._id === 'crafter');
  assert.equal(crafter.equipped.head, rare._id); assert.equal(crafter.simCredits, 17);
  assert.equal(invQty(crafter.inventory, hero._id), 0); assert.equal(invQty(crafter.inventory, tree._id), 0);
  assert.equal(events.filter(event => event.kind === 'gain' && event.itemId === tree._id).length, 1);
  const receipt = events.find(event => event.kind === 'craft' && event.itemId === rare._id);
  assert.ok(receipt, JSON.stringify(events.filter(event => ['craft', 'gain'].includes(event.kind))));
  assert.equal(receipt.paidCost, 3); assert.deepEqual(receipt.consumed, rare.recipe.ingredients);
  assert.equal(input.state.nextSpawn.coreNodes[0].pickedBy, 'crafter');
});

check('distant recipe routing still rejects forbidden and overwhelmed paths and replans a spent source', () => {
  for (const scenario of ['forbidden_path', 'enemy_path', 'spent']) {
    const input = distantLumiaFixture();
    if (scenario === 'forbidden_path') input.state.forbiddenIds.add('police');
    if (scenario === 'enemy_path') for (let i = 0; i < 4; i++) input.roster.push({ ...structuredClone(input.roster[0]),
      _id: `blocking-enemy-${i}`, teamId: 'blocking-enemies', zoneId: 'police' });
    if (scenario === 'spent') {
      const goal = plan(input).movementPlans.get('leader').objective;
      input.state.nextSpawn.coreNodes[0].picked = true;
      assert.equal(getAvailableMovementObjective(goal, { spawnState: input.state.nextSpawn }), null);
    }
    const result = plan(input);
    assert.ok(input.roster.filter(actor => actor.teamId === 'team:1').every(actor =>
      !result.movementPlans.get(actor._id)?.objective?.beneficiary), scenario);
    assert.equal(input.roster.filter(actor => actor.teamId === 'team:1').reduce((sum, actor) => sum + invQty(actor.inventory, tree._id), 0), 0);
  }
});

const futureGear = { ...gear('team-future-tree', '지정 초월 생명 모자', tree._id), tier: 6 };
function futureRecipeFixture() {
  const input = fixture(), catalog = [...items, futureGear];
  Object.assign(input.state, { publicItems: catalog, craftables: buildCraftableItems(catalog),
    itemMetaById: buildItemMetaById(catalog), itemNameById: buildItemNameById(catalog), itemKeyById: buildItemKeyById(catalog) });
  for (const stock of Object.values(input.state.nextSpawn.fieldResources.byZone)) {
    for (const source of Object.values(stock)) { source.remaining = 0; source.taken = source.initial; }
  }
  input.roster[1].goalLoadouts = { legend: { headKey: ordinary.itemKey }, transcend: { headKey: futureGear.itemKey } };
  for (const actor of input.roster) refreshActorGrowthPlan(actor, catalog, input.state);
  return input;
}

check('a blocked first recipe cannot hide an authored later recipe that a spawned resource can complete', () => {
  const input = futureRecipeFixture(), before = structuredClone({ roster: input.roster, spawn: input.state.nextSpawn });
  assert.equal(input.roster[1]._growthPlan.targetId, ordinary._id);
  assert.equal(input.roster[1]._growthPlan.blocked, 'no_material_source');
  const moves = withSimulationRandom(() => { throw new Error('Future recipe selection must be read-only, without RNG.'); }, () => plan(input)).movementPlans;
  for (const actor of input.roster) {
    const move = moves.get(actor._id);
    assert.equal(move?.targetZoneId, 'c'); assert.equal(move?.objective?.beneficiary?.who, 'crafter');
    assert.equal(move.objective.beneficiary.targetItemId, futureGear._id); assert.deepEqual(move.objective.sourceIds, ['tree-c']);
  }
  assert.deepEqual(input.roster, before.roster); assert.deepEqual(input.state.nextSpawn, before.spawn);
});

check('the team reaches and consumes a future recipe source once, without free lower-tier gear or actor-order dependence', () => {
  for (const reverse of [false, true]) {
    const input = futureRecipeFixture(); if (reverse) input.roster.reverse();
    const result = tick(input), crafter = result.updatedSurvivors.find(actor => actor._id === 'crafter');
    assert.ok(result.updatedSurvivors.every(actor => actor.zoneId === 'c'));
    assert.equal(crafter.equipped.head, futureGear._id); assert.equal(crafter.simCredits, 17);
    assert.equal(invQty(crafter.inventory, hero._id), 0); assert.equal(invQty(crafter.inventory, tree._id), 0);
    assert.equal(invQty(crafter.inventory, ordinary._id), 0); assert.equal(invQty(crafter.inventory, rare._id), 0);
    assert.equal(input.state.nextSpawn.coreNodes[0].pickedBy, 'crafter');
    assert.equal(result.events.filter(event => event.kind === 'gain' && event.itemId === tree._id).length, 1);
    const receipts = result.events.filter(event => event.kind === 'craft' && event.itemId === futureGear._id);
    assert.equal(receipts.length, 1); assert.equal(receipts[0].paidCost, 3); assert.deepEqual(receipts[0].consumed, futureGear.recipe.ingredients);
    assert.ok(result.updatedSurvivors.filter(actor => actor._id !== 'crafter').every(actor => actor.equipped.head === hero._id));
    assert.ok(result.logs.some(line => /팀 공동 목표.*crafter의 지정 초월 생명 모자/.test(line)));
  }
});

check('a completable active recipe keeps priority when the same source also completes an authored later recipe', () => {
  const input = futureRecipeFixture(), crafter = input.roster[1];
  crafter.goalLoadouts.legend.headKey = rare.itemKey;
  refreshActorGrowthPlan(crafter, input.state.publicItems, input.state);
  assert.equal(crafter._growthPlan.targetId, rare._id);
  assert.equal(plan(input).movementPlans.get('leader').objective.beneficiary.targetItemId, rare._id);
  const result = tick(input), receiver = result.updatedSurvivors.find(actor => actor._id === 'crafter');
  assert.equal(receiver.equipped.head, rare._id); assert.equal(receiver.simCredits, 17);
  assert.equal(invQty(receiver.inventory, futureGear._id), 0);
  assert.equal(result.events.filter(event => event.kind === 'craft' && event.itemId === rare._id).length, 1);
});

check('invalid slot/tier keys, automatic alternatives and satisfied later recipes cannot claim a future resource', () => {
  for (const scenario of ['automatic', 'invalid', 'wrong_slot', 'wrong_tier', 'material_owned', 'equipment_owned']) {
    const input = futureRecipeFixture(), crafter = input.roster[1];
    if (scenario === 'automatic') crafter.goalLoadouts.transcend = {};
    if (scenario === 'invalid') crafter.goalLoadouts.transcend.headKey = 'absent-future-recipe';
    if (scenario === 'wrong_slot') crafter.goalLoadouts.transcend = { armKey: futureGear.itemKey };
    if (scenario === 'wrong_tier') crafter.goalLoadouts.transcend.headKey = ordinary.itemKey;
    if (scenario === 'material_owned' || scenario === 'equipment_owned') {
      const item = scenario === 'material_owned' ? tree : futureGear;
      crafter.inventory.push({ ...structuredClone(item), itemId: item._id, qty: 1 });
    }
    const before = structuredClone({ roster: input.roster, spawn: input.state.nextSpawn });
    const moves = plan(input).movementPlans;
    assert.ok([...moves.values()].every(move => !move.objective?.beneficiary), scenario);
    assert.deepEqual(input.roster, before.roster); assert.deepEqual(input.state.nextSpawn, before.spawn);
  }
});

check('a future shared recipe still pays real credits and cannot craft from a partial material quantity', () => {
  for (const scenario of ['no_credits', 'needs_two']) {
    const input = futureRecipeFixture(), crafter = input.roster[1];
    if (scenario === 'no_credits') crafter.simCredits = 0;
    else {
      const target = structuredClone(futureGear); target.recipe.ingredients[1].qty = 2;
      const catalog = input.state.publicItems.map(item => item._id === target._id ? target : item);
      Object.assign(input.state, { publicItems: catalog, craftables: buildCraftableItems(catalog),
        itemMetaById: buildItemMetaById(catalog), itemNameById: buildItemNameById(catalog), itemKeyById: buildItemKeyById(catalog) });
    }
    for (const actor of input.roster) refreshActorGrowthPlan(actor, input.state.publicItems, input.state);
    const result = tick(input), receiver = result.updatedSurvivors.find(actor => actor._id === 'crafter');
    assert.ok(result.updatedSurvivors.every(actor => actor.zoneId === 'c'));
    assert.equal(receiver.equipped.head, hero._id); assert.equal(invQty(receiver.inventory, tree._id), 1);
    assert.equal(invQty(receiver.inventory, hero._id), 1); assert.equal(invQty(receiver.inventory, futureGear._id), 0);
    assert.equal(receiver.simCredits, scenario === 'no_credits' ? 0 : 20);
    assert.equal(result.events.filter(event => event.kind === 'craft').length, 0);
    assert.equal(result.events.filter(event => event.kind === 'gain' && event.itemId === tree._id).length, 1);
  }
});

console.log(`TEAM_RESOURCE_GOAL_CHECKS ${checks}/${checks}`);
