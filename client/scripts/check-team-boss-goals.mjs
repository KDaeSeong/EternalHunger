import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';
const { runPhaseActorActionPipeline } = await import('../src/app/simulation/_lib/phaseActorActionPipelineRuntime.js');
const { buildTeamCoordination } = await import('../src/app/simulation/_lib/teamTacticsRuntime.js');
const { refreshActorGrowthPlan, getActorGrowthCraftGoal } = await import('../src/app/simulation/_lib/growthPlanRuntime.js');
const { chooseAiMoveTargets } = await import('../src/app/simulation/_lib/aiMoveTargetRuntime.js');
const { createFieldResources } = await import('../src/app/simulation/_lib/fieldResourceRuntime.js');
const { applyLootCraftResult } = await import('../src/app/simulation/_lib/lootCraftResultRuntime.js');
const { invQty } = await import('../src/app/simulation/_lib/inventoryRules.js');
const { getRuleset } = await import('../src/utils/rulesets.js');
const { withSimulationRandom } = await import('../src/utils/simulationRandom.js');
const { createSeedRng } = await import('../src/app/simulation/_lib/randomSeedRuntime.js');
const { emitSimulationRunEvent } = await import('../src/app/simulation/_lib/logActionRuntime.js');
const { captureMovementObjective, describeMovementObjective, getAvailableMovementObjective } = await import('../src/app/simulation/_lib/movementObjectiveRuntime.js');
const { consumeBossAtZone } = await import('../src/app/simulation/_lib/spawnConsumersRuntime.js');
const { loadGuestSimulationItemCatalog } = await import('../src/app/simulation/_lib/guestSimulationBootstrap.js');
const { findSpecialResourceItem } = await import('../src/app/simulation/_lib/specialResourceRuntime.js');
const { getGuaranteedBossDrops } = await import('../src/app/simulation/_lib/bossRewardRuntime.js');
const { runPvpActionLoop } = await import('../src/app/simulation/_lib/phasePvpActionLoopRuntime.js');
const { advanceSpatialMovement } = await import('../src/app/simulation/_lib/combatSpatialRuntime.js');
const { advanceTimedWildlifeEffects, getWildlifeCombatRoster } = await import('../src/app/simulation/_lib/wildlifeCombatRuntime.js');
const { updateEffects } = await import('../src/utils/statusLogic.js');
const eventActions = await import('../src/app/simulation/_lib/runEventRuntime.js');

// Controlled recipes/world, not the missing evaluator match or official item balance.
const base = { _id: 'base', itemKey: 'base', name: '기본 모자', type: 'equipment', equipSlot: 'head', tier: 4, stats: { defense: 10 } };
const materials = [['_cloth', '천'], ['mithril', '미스릴'], ['force_core', '포스 코어'], ['vf_blood_sample', 'VF 혈액 샘플'], ['life_tree', '생명의 나무']]
  .map(([_id, name]) => ({ _id, name, type: 'material', tier: _id === '_cloth' ? 1 : 4, ...(_id === '_cloth' ? { spawnZones: ['b'] } : {}) }));
const recipe = (material) => ({ ...base, _id: `hat-${material._id}`, itemKey: `hat-${material._id}`, name: `${material.name} 모자`,
  tier: material._id === 'vf_blood_sample' ? 6 : 5, stats: { defense: 20 },
  recipe: { ingredients: [{ itemId: 'base', qty: 1 }, { itemId: material._id, qty: 1 }], resultQty: 1, creditsCost: 3 } });
const items = [base, ...materials, ...materials.map(recipe)];
const byId = Object.fromEntries(items.map((item) => [item._id, item]));
const names = Object.fromEntries(items.map((item) => [item._id, item.name]));
const held = (id) => ({ ...structuredClone(byId[id]), itemId: id, qty: 1 });
function fixture(kind = 'alpha', material = 'mithril') {
  const ruleset = structuredClone(getRuleset('ER_S11'));
  ruleset.worldSpawns.dimensionRift.enabled = false;
  ruleset.inventory = { ...ruleset.inventory, autoDropLowValue: false, maxSlots: 10 };
  ruleset.worldSpawns.bosses[kind].reward = { credits: { min: 7, max: 7 }, bonusDropChance: 0 };
  const mapObj = { zones: ['a', 'b', 'c'].map((zoneId) => ({ zoneId, name: zoneId, hasKiosk: false })) };
  const roster = ['leader', 'crafter', 'escort'].map((_id, index) => ({ _id, name: _id, teamId: 'team:1', teamSlot: index + 1,
    zoneId: 'a', hp: 1000, maxHp: 1000, stats: { attackPower: 60, defense: 20, attackSpeed: 1, moveSpeed: 3.5, attackRange: 2, sightRange: 12 },
    simCredits: 20, inventory: [held('base')], equipped: { head: 'base' }, activeEffects: [], tacticalSkill: 'none',
    routePlanTargetItemIds: ['base'], goalLoadouts: { legend: { headKey: 'hat-_cloth' } } }));
  roster[1].goalLoadouts = { [material === 'vf_blood_sample' ? 'transcend' : 'legend']: { headKey: `hat-${material}` } };
  // VF remains a post-legend goal; preserve the real growth-stage policy.
  if (material === 'vf_blood_sample') { roster[1].inventory.push(held('hat-_cloth')); roster[1].equipped.head = 'hat-_cloth'; }
  const state = { mapObj, zones: mapObj.zones, zoneGraph: { a: ['b', 'c'], b: ['a'], c: ['a'] }, forbiddenIds: new Set(),
    nextDay: 5, nextPhase: 'morning', phaseIdxNow: 8, ruleset, publicItems: items, craftables: items.filter((item) => item.recipe),
    itemMetaById: byId, itemNameById: names, itemKeyById: Object.fromEntries(items.map((item) => [item._id, item.itemKey || ''])),
    actionIntervalSec: 20, statusElapsedSec: 0, currentActionSec: () => 960, kiosks: [], droneOffers: [],
    nextSpawn: { coreNodes: [], bosses: { [kind]: { alive: true, zoneId: 'c', spawnedDay: 5, spawnedPhase: 'morning' } },
      fieldResources: createFieldResources(mapObj, items, ruleset) } };
  for (const actor of roster) refreshActorGrowthPlan(actor, items, state);
  const events = [], logs = [];
  const emitRunEvent = (kind, payload, at) => emitSimulationRunEvent({ kind, payload, at,
    actions: { enqueueRunEvent: (event) => events.push(structuredClone(event)) } });
  const actions = { atNow: () => ({ day: 5, phase: 'morning', sec: state.currentActionSec() }), emitRunEvent, addLog: (message) => logs.push(message) };
  for (const name of ['emitItemGainIfAny', 'emitObjectiveRunEvent', 'emitQueueRunEvent', 'emitCraftRunEvent'])
    actions[name] = (...args) => eventActions[name](emitRunEvent, ...args);
  actions.applyLootCraftResult = (actor, result, meta, at, zoneId) => applyLootCraftResult(actor, result, meta,
    { at, zoneId, addLog: actions.addLog, emitCraftRunEvent: actions.emitCraftRunEvent });
  return { state, roster, events, logs, actions };
}
function plan(input) {
  const { state, roster } = input;
  return buildTeamCoordination({ roster, zoneGraph: state.zoneGraph, forbiddenIds: state.forbiddenIds, day: state.nextDay,
    phase: state.nextPhase, spawnState: state.nextSpawn, ruleset: state.ruleset, publicItems: state.publicItems,
    isSoloMatch: state.isSoloMatch, estimatePower: () => 100,
    chooseLeaderMove: (actor) => chooseAiMoveTargets({ actor, craftGoal: getActorGrowthCraftGoal(actor, state.publicItems),
      mapObj: state.mapObj, spawnState: state.nextSpawn, forbiddenIds: state.forbiddenIds, day: state.nextDay, phase: state.nextPhase, ruleset: state.ruleset }) });
}
function tick(input, now) {
  input.state.currentActionSec = () => now;
  const result = withSimulationRandom(() => 0, () => runPhaseActorActionPipeline({ state: { ...input.state, phaseSurvivors: input.roster }, actions: input.actions }));
  input.roster = result.updatedSurvivors;
  return result;
}
async function fight(input, duration = 14) {
  const start = input.state.currentActionSec();
  let offset = 0, advanced = 0, frames = 0, promise;
  withSimulationRandom(createSeedRng('team-boss-goal'), () => {
    promise = runPvpActionLoop({ state: { ...input.state, updatedSurvivors: input.roster, phaseSurvivors: input.roster,
      phaseDurationSec: duration, currentActionSec: () => start + offset, getPhaseRuntimeOffsetSec: () => offset,
      battleSettings: { characterSkillsEnabled: false } }, actions: { ...input.actions,
      atNow: () => ({ day: 5, phase: 'morning', sec: start + offset }),
      reserveActionSecond: (seconds) => { offset = Math.min(duration, Math.round((offset + seconds) * 1e6) / 1e6); },
      advanceWorld: ({ survivorMap }) => {
        const elapsedSec = offset - advanced;
        if (elapsedSec > 0) {
          advanceSpatialMovement(getWildlifeCombatRoster([...survivorMap.values()]), start + advanced, elapsedSec);
          for (const [id, actor] of survivorMap) survivorMap.set(id, updateEffects(actor, { elapsedSec, startSec: start + advanced }));
          advanceTimedWildlifeEffects([...survivorMap.values()], { elapsedSec, startSec: start + advanced });
        }
        advanced = offset;
      }, publishActionFrame: async () => { assert.ok(++frames < 2000); },
    } });
  });
  const result = await promise; input.roster = [...result.survivorMap.values()];
  return result;
}
let checks = 0;
const check = async (name, run) => { await run(); checks++; console.log(`PASS ${name}`); };

await check('a teammate recipe sets a shared boss destination instead of the leader ordinary farming route', () => {
  const input = fixture(), before = structuredClone({ roster: input.roster, spawn: input.state.nextSpawn });
  assert.equal(input.roster[0]._growthPlan.nextStep, 'b');
  const result = withSimulationRandom(() => { throw new Error('Planning must not roll rewards or RNG.'); }, () => plan(input));
  for (const actor of input.roster) {
    const move = result.movementPlans.get(actor._id);
    assert.equal(move.targetZoneId, 'c'); assert.equal(move.objective.type, 'boss');
    assert.equal(move.objective.subkind, 'alpha'); assert.equal(move.objective.beneficiary.who, 'crafter');
    assert.equal(move.objective.beneficiary.materialId, 'mithril');
    assert.deepEqual(move.objective.sourceIds, ['alpha:5:morning']);
  }
  assert.deepEqual(input.roster, before.roster); assert.deepEqual(input.state.nextSpawn, before.spawn);
});

await check('the real guest catalog yields mithril material, never a similarly named finished armor', async () => {
  const catalog = await loadGuestSimulationItemCatalog();
  for (const ordered of [catalog, [...catalog].reverse()]) {
    const material = findSpecialResourceItem(ordered, 'mithril');
    assert.equal(material?._id, 'namu:material:미스릴');
    const input = fixture();
    assert.equal(getGuaranteedBossDrops('alpha', ordered, input.state.ruleset)[0]?.itemId, material._id);
    const reward = withSimulationRandom(() => 0.5, () => consumeBossAtZone(input.state.nextSpawn, 'c', ordered, 5, 'morning',
      input.roster[0], input.state.ruleset, { reserveOnly: true }));
    assert.deepEqual(reward.drops.map((row) => row.itemId), [material._id]);
    input.state.ruleset.worldSpawns.specialResourceDrops = { alpha: [] };
    const fallback = withSimulationRandom(() => 0.5, () => consumeBossAtZone(input.state.nextSpawn, 'c', ordered, 5, 'morning',
      input.roster[0], input.state.ruleset, { reserveOnly: true }));
    assert.deepEqual(fallback.drops.map((row) => row.itemId), [material._id]);
  }
  const equipmentOnly = catalog.filter((item) => item._id === 'namu:clothes:미스릴 갑옷');
  assert.equal(findSpecialResourceItem(equipmentOnly, 'mithril'), null);
  assert.deepEqual(getGuaranteedBossDrops('alpha', equipmentOnly, fixture().state.ruleset), []);
  const custom = fixture();
  custom.state.ruleset.worldSpawns.bosses.alpha.dropKeywords = ['미스릴 갑옷'];
  custom.state.ruleset.worldSpawns.specialResourceDrops = { alpha: [] };
  const explicit = withSimulationRandom(() => 0.5, () => consumeBossAtZone(custom.state.nextSpawn, 'c', equipmentOnly, 5, 'morning',
    custom.roster[0], custom.state.ruleset, { reserveOnly: true }));
  assert.equal(explicit.drops[0].itemId, 'namu:clothes:미스릴 갑옷', 'Explicit custom reward names still work.');
});

await check('the real pipeline moves, starts one shared boss, earns the item once and pays for the teammate recipe', async () => {
  for (const reverse of [false, true]) {
    const input = fixture(); if (reverse) input.roster.reverse();
    tick(input, 960);
    assert.ok(input.roster.every((actor) => actor.zoneId === 'c'));
    assert.equal(input.events.some((event) => event.kind === 'hunt_start'), false, 'Travel is not an instant boss kill.');
    assert.equal(input.roster.reduce((sum, actor) => sum + invQty(actor.inventory, 'mithril'), 0), 0);
    tick(input, 980);
    assert.equal(input.roster.filter((actor) => actor._wildlifeHunt).length, 1);
    assert.equal(input.events.filter((event) => event.kind === 'hunt_start').length, 1);
    await fight(input);
    const crafter = input.roster.find((actor) => actor._id === 'crafter');
    assert.equal(crafter.equipped.head, 'hat-mithril', input.logs.join('\n'));
    assert.equal(input.roster.reduce((sum, actor) => sum + actor.simCredits, 0), 64, '60 initial + 7 reward - 3 recipe.');
    assert.equal(input.events.filter((event) => event.kind === 'hunt_settlement' && event.defeated).length, 1);
    assert.equal(input.events.filter((event) => event.kind === 'gain' && event.itemId === 'mithril').length, 1);
    assert.equal(input.events.filter((event) => event.kind === 'hunt_assist').length, 2);
    assert.ok(input.logs.some((line) => /팀 공동 목표.*알파.*crafter의 미스릴 모자/.test(line)));
  }
});

await check('omega and Wickeline goals use the actual force-core and post-legend VF recipe need', () => {
  for (const [kind, material] of [['omega', 'force_core'], ['weakline', 'vf_blood_sample']]) {
    const input = fixture(kind, material), move = plan(input).movementPlans.get('leader');
    assert.equal(move.objective?.subkind, kind);
    assert.equal(move.objective?.beneficiary.materialId, material);
    assert.equal(move.objective?.beneficiary.targetItemId, `hat-${material}`);
    assert.match(describeMovementObjective(move.objective), /crafter의/);
  }
});

await check('co-located bosses do not replace the selected omega with the first alpha in the consumer order', async () => {
  const input = fixture('omega', 'force_core');
  input.state.nextSpawn.bosses.alpha = { alive: true, zoneId: 'c', spawnedDay: 5, spawnedPhase: 'morning' };
  tick(input, 960); tick(input, 980);
  assert.equal(input.events.find((event) => event.kind === 'hunt_start')?.subkind, 'omega');
  assert.equal(input.state.nextSpawn.bosses.alpha.engagedBy, undefined);
  await fight(input);
  assert.equal(input.state.nextSpawn.bosses.alpha.alive, true);
  assert.equal(input.state.nextSpawn.bosses.omega.alive, false);
  assert.equal(input.roster.find((actor) => actor._id === 'crafter').equipped.head, 'hat-force_core');
});

await check('configured guaranteed drops override the usual alpha-mithril assumption', () => {
  const input = fixture('alpha', 'life_tree');
  input.state.ruleset.worldSpawns.specialResourceDrops = { alpha: [null, { key: ' life_tree ', chance: 1 }] };
  const goal = plan(input).movementPlans.get('leader').objective;
  assert.equal(goal.subkind, 'alpha'); assert.equal(goal.beneficiary.materialId, 'life_tree');
  assert.deepEqual(goal.resourceKinds, ['life_tree']);
  assert.match(describeMovementObjective(goal), /생명의 나무 노림.*crafter의 생명의 나무 모자/);
  const reward = withSimulationRandom(() => 0.5, () => consumeBossAtZone(input.state.nextSpawn, 'c', items, 5, 'morning',
    input.roster[0], input.state.ruleset, { reserveOnly: true, bossObjective: goal }));
  assert.deepEqual(reward.drops.map((row) => row.itemId), ['life_tree']);
  assert.ok(!reward.log.includes('미스릴'), 'A custom drop must not retain the default reward claim.');
});

await check('a configured fallback-only reward uses the same primary catalog item as actual settlement', () => {
  const input = fixture('alpha', 'force_core');
  input.state.ruleset.worldSpawns.bosses.alpha.dropKeywords = ['포스 코어'];
  input.state.ruleset.worldSpawns.specialResourceDrops = { alpha: [] };
  const goal = plan(input).movementPlans.get('leader').objective;
  assert.equal(goal.beneficiary.materialId, 'force_core');
  const reward = withSimulationRandom(() => 0.5, () => consumeBossAtZone(input.state.nextSpawn, 'c', items, 5, 'morning',
    input.roster[0], input.state.ruleset, { reserveOnly: true, bossObjective: goal }));
  assert.equal(reward.drops[0].itemId, 'force_core'); assert.equal(reward.drops[0].qty, 1);
});

await check('rare secondary chances and an unbuildable boss catalog do not invent a guaranteed team recipe goal', () => {
  for (const scenario of ['secondary', 'missing-primary', 'mixed-fallback']) {
    const input = fixture(scenario === 'secondary' ? 'weakline' : 'alpha');
    if (scenario === 'missing-primary') input.state.ruleset.worldSpawns.bosses.alpha.dropKeywords = ['nonexistent'];
    if (scenario === 'mixed-fallback') input.state.ruleset.worldSpawns.specialResourceDrops = { alpha: [{ key: 'life_tree', chance: 0.1 }] };
    assert.ok([...plan(input).movementPlans.values()].every((move) => !move.objective?.beneficiary), scenario);
  }
});

await check('owned ingredients, completed equipment, and full recipient bags remove the boss recipe need', () => {
  for (const scenario of ['owned', 'finished', 'full']) {
    const input = fixture();
    if (scenario === 'owned') input.roster[1].inventory.push(held('mithril'));
    if (scenario === 'finished') input.roster[1].inventory.push(held('hat-mithril'));
    if (scenario === 'full') input.state.ruleset.inventory.maxSlots = 1;
    assert.ok([...plan(input).movementPlans.values()].every((move) => !move.objective?.beneficiary), scenario);
    assert.equal(input.state.nextSpawn.bosses.alpha.engagedBy, undefined);
  }
});

await check('dead, claimed, forbidden, unreachable and overwhelming enemy destinations are not team boss goals', () => {
  for (const scenario of ['dead', 'claimed', 'forbidden', 'unreachable', 'enemy', 'enemy-path']) {
    const input = fixture();
    if (scenario === 'dead') input.state.nextSpawn.bosses.alpha.alive = false;
    if (scenario === 'claimed') input.state.nextSpawn.bosses.alpha.engagedBy = 'another-hunter';
    if (scenario === 'forbidden') input.state.forbiddenIds.add('c');
    if (scenario === 'unreachable') input.state.zoneGraph.a = ['b'];
    if (scenario === 'enemy-path') input.state.zoneGraph = { a: ['b'], b: ['c'], c: [] };
    if (scenario.startsWith('enemy')) for (let i = 0; i < 4; i++) input.roster.push({ ...structuredClone(input.roster[0]),
      _id: `enemy-${i}`, teamId: `enemy:${i}`, zoneId: scenario === 'enemy' ? 'c' : 'b' });
    const plans = plan(input).movementPlans;
    assert.ok(input.roster.filter((actor) => actor.teamId === 'team:1').every((actor) => !plans.get(actor._id)?.objective?.beneficiary), scenario);
  }
});

await check('opening farming, regrouping, recovery, solo, endgame and other combat spaces retain priority', () => {
  for (const scenario of ['opening', 'split', 'recovery', 'ratio', 'solo', 'endgame', 'rift']) {
    const input = fixture();
    if (scenario === 'opening') input.roster[0]._growthPlan.openingComplete = false;
    if (scenario === 'split') input.roster[0].zoneId = 'b';
    if (scenario === 'recovery') input.roster[0].hp = 1;
    if (scenario === 'ratio') input.roster[0].hp = 150;
    if (scenario === 'solo') input.state.isSoloMatch = true;
    if (scenario === 'endgame') input.state.nextSpawn.endgame = { stage: 'final' };
    if (scenario === 'rift') for (const actor of input.roster) actor._combatSpaceId = 'dimension_rift:test';
    assert.ok([...plan(input).movementPlans.values()].every((move) => !move.objective?.beneficiary), scenario);
  }
});

await check('a rotation clock still holds the whole team before the new boss trip', () => {
  const input = fixture(); input.roster[1]._growthReadyAtSec = 970;
  tick(input, 960);
  assert.ok(input.roster.every((actor) => actor.zoneId === 'a'));
  assert.equal(input.state.nextSpawn.bosses.alpha.engagedBy, undefined);
  tick(input, 970);
  assert.ok(input.roster.every((actor) => actor.zoneId === 'c'));
});

await check('multi-hop travel does not reserve, damage or grant a distant boss reward', () => {
  const input = fixture(); input.state.zoneGraph = { a: ['b'], b: ['a', 'c'], c: ['b'] };
  tick(input, 960);
  assert.ok(input.roster.every((actor) => actor.zoneId === 'b'));
  assert.equal(input.state.nextSpawn.bosses.alpha.engagedBy, undefined);
  assert.equal(input.events.some((event) => ['hunt_start', 'hunt_exchange', 'hunt_settlement'].includes(event.kind)), false);
  assert.equal(input.roster.reduce((sum, actor) => sum + invQty(actor.inventory, 'mithril'), 0), 0);
  tick(input, 980);
  assert.ok(input.roster.every((actor) => actor.zoneId === 'c'));
  assert.equal(input.state.nextSpawn.bosses.alpha.engagedBy, undefined);
});

await check('dead, moved or replaced boss sources invalidate goals instead of silently chasing a new spawn', () => {
  for (const scenario of ['dead', 'moved', 'respawn']) {
    const input = fixture(), goal = plan(input).movementPlans.get('leader').objective;
    if (scenario === 'dead') input.state.nextSpawn.bosses.alpha.alive = false;
    if (scenario === 'moved') input.state.nextSpawn.bosses.alpha.zoneId = 'b';
    if (scenario === 'respawn') input.state.nextSpawn.bosses.alpha.spawnedDay = 6;
    assert.equal(getAvailableMovementObjective(goal, { spawnState: input.state.nextSpawn }), null, scenario);
    assert.equal(captureMovementObjective({ objectiveType: 'boss', objectiveSubkind: 'alpha', objectiveSourceIds: goal.sourceIds }, 'c',
      { spawnState: input.state.nextSpawn, ruleset: input.state.ruleset, publicItems: items }), null, scenario);
    const reward = withSimulationRandom(() => { throw new Error('Stale goals must not roll another reward.'); }, () =>
      consumeBossAtZone(input.state.nextSpawn, 'c', items, 5, 'morning', input.roster[0], input.state.ruleset,
        { reserveOnly: true, bossObjective: goal }));
    assert.equal(reward, null, scenario);
  }
});

await check('source and recipient identity survive order changes and JSON, while a natural recipe keeps the safer tie', () => {
  const input = fixture(), expected = plan(input).movementPlans.get('leader').objective;
  input.roster.reverse();
  assert.deepEqual(plan(input).movementPlans.get('leader').objective, expected);
  input.roster = JSON.parse(JSON.stringify(input.roster)); input.state.nextSpawn = JSON.parse(JSON.stringify(input.state.nextSpawn));
  assert.deepEqual(plan(input).movementPlans.get('leader').objective, expected);
  input.roster.find((actor) => actor._id === 'escort').goalLoadouts.legend.headKey = 'hat-life_tree';
  for (const actor of input.roster) refreshActorGrowthPlan(actor, items, input.state);
  input.state.nextSpawn.coreNodes.push({ id: 'tree-b', kind: 'life_tree', zoneId: 'b', picked: false });
  assert.equal(plan(input).movementPlans.get('leader').objective.type, 'natural_core');
});

await check('guaranteed stack quantity changes which teammate recipe is actually completable', () => {
  const input = fixture();
  input.state.publicItems = structuredClone(items);
  input.state.publicItems.find((item) => item._id === 'hat-mithril').recipe.ingredients[1].qty = 2;
  input.roster[2].goalLoadouts.legend.headKey = 'hat-force_core';
  for (const actor of input.roster) refreshActorGrowthPlan(actor, input.state.publicItems, input.state);
  input.state.nextSpawn.bosses.omega = { alive: true, zoneId: 'c', spawnedDay: 5, spawnedPhase: 'morning' };
  input.state.ruleset.worldSpawns.specialResourceDrops = { alpha: [{ key: 'mithril', chance: 1, qty: 1 }],
    omega: [{ key: 'force_core', chance: 1, qty: 1 }] };
  assert.equal(plan(input).movementPlans.get('leader').objective.subkind, 'omega');
  input.state.ruleset.worldSpawns.specialResourceDrops.alpha[0].qty = 2;
  const goal = plan(input).movementPlans.get('leader').objective;
  assert.equal(goal.subkind, 'alpha'); assert.equal(goal.beneficiary.who, 'crafter');
});

await check('a same-region ordinary farming need cannot permanently suppress the selected boss hunt', () => {
  const input = fixture();
  input.state.publicItems = structuredClone(items);
  input.state.publicItems.find((item) => item._id === '_cloth').spawnZones = ['b', 'c'];
  input.state.nextSpawn.fieldResources = createFieldResources(input.state.mapObj, input.state.publicItems, input.state.ruleset);
  tick(input, 960); tick(input, 980);
  assert.equal(input.events.filter((event) => event.kind === 'hunt_start' && event.subkind === 'alpha').length, 1);
});

function distantBossFixture() {
  const input = fixture();
  input.state.mapObj = { zones: ['a', 'b', 'c', 'd', 'e'].map(zoneId => ({ zoneId, name: zoneId, hasKiosk: false })) };
  input.state.zones = input.state.mapObj.zones;
  input.state.zoneGraph = { a: ['b'], b: ['a', 'c'], c: ['b', 'd'], d: ['c', 'e'], e: ['d'] };
  input.state.nextSpawn.bosses.alpha.zoneId = 'e';
  input.state.nextSpawn.fieldResources = createFieldResources(input.state.mapObj, items, input.state.ruleset);
  for (const actor of input.roster) refreshActorGrowthPlan(actor, items, input.state);
  return input;
}

await check('a concrete teammate boss recipe can choose a safe destination beyond the retreat radius', () => {
  const input = distantBossFixture(), before = structuredClone({ roster: input.roster, spawn: input.state.nextSpawn });
  const result = withSimulationRandom(() => { throw new Error('Routing cannot pre-roll a boss reward.'); }, () => plan(input));
  for (const actor of input.roster) {
    const move = result.movementPlans.get(actor._id);
    assert.equal(move?.objective?.type, 'boss'); assert.equal(move.objective.subkind, 'alpha');
    assert.equal(move.targetZoneId, 'e'); assert.equal(move.nextStep, 'b');
    assert.equal(move.objective.beneficiary.who, 'crafter');
  }
  assert.deepEqual(input.roster, before.roster); assert.deepEqual(input.state.nextSpawn, before.spawn);
});

await check('distant boss travel performs four real moves before combat and single paid teammate crafting', async () => {
  const input = distantBossFixture();
  let now = 960;
  for (const next of ['b', 'c', 'd', 'e']) {
    tick(input, now);
    assert.ok(input.roster.every(actor => actor.zoneId === next));
    assert.equal(input.state.nextSpawn.bosses.alpha.engagedBy, undefined);
    assert.equal(input.events.some(event => ['hunt_start', 'hunt_exchange', 'hunt_settlement'].includes(event.kind)), false);
    assert.equal(input.roster.reduce((sum, actor) => sum + invQty(actor.inventory, 'mithril'), 0), 0);
    now = Math.max(now + 20, ...input.roster.map(actor => Math.max(actor._growthReadyAtSec || 0, actor._actionReadyAtSec || 0)));
  }
  tick(input, now);
  assert.equal(input.events.filter(event => event.kind === 'hunt_start' && event.subkind === 'alpha').length, 1);
  await fight(input);
  assert.equal(input.events.filter(event => event.kind === 'hunt_settlement' && event.defeated).length, 1);
  assert.equal(input.events.filter(event => event.kind === 'gain' && event.itemId === 'mithril').length, 1);
  assert.equal(input.roster.find(actor => actor._id === 'crafter').equipped.head, 'hat-mithril');
  const receipts = input.events.filter(event => event.kind === 'craft');
  const selected = receipts.filter(event => event.itemId === 'hat-mithril');
  assert.equal(selected.length, 1); assert.equal(selected[0].paidCost, 3);
  assert.deepEqual(selected[0].consumed, byId['hat-mithril'].recipe.ingredients);
  assert.equal(input.roster.reduce((sum, actor) => sum + actor.simCredits, 0),
    60 + 7 - receipts.reduce((sum, event) => sum + event.paidCost, 0),
    'Account for the real side crafts at the intermediate cloth region as well as the boss recipe.');
});

function futureBossFixture() {
  const input = fixture('weakline', 'vf_blood_sample'), crafter = input.roster[1];
  crafter.inventory = [held('base')]; crafter.equipped.head = 'base';
  crafter.goalLoadouts = { legend: { headKey: 'hat-_cloth' }, transcend: { headKey: 'hat-vf_blood_sample' } };
  for (const stock of Object.values(input.state.nextSpawn.fieldResources.byZone)) {
    for (const source of Object.values(stock)) { source.remaining = 0; source.taken = source.initial; }
  }
  for (const actor of input.roster) refreshActorGrowthPlan(actor, items, input.state);
  return input;
}

await check('a blocked first legend recipe cannot hide the authored transcend VF boss destination', () => {
  const input = futureBossFixture(), crafter = input.roster[1];
  assert.equal(crafter._growthPlan.targetId, 'hat-_cloth'); assert.equal(crafter._growthPlan.blocked, 'no_material_source');
  const before = structuredClone({ roster: input.roster, spawn: input.state.nextSpawn });
  const moves = withSimulationRandom(() => { throw new Error('Authored future boss routing must not draw RNG.'); }, () => plan(input)).movementPlans;
  for (const actor of input.roster) {
    const move = moves.get(actor._id);
    assert.equal(move?.targetZoneId, 'c'); assert.equal(move?.objective?.subkind, 'weakline');
    assert.equal(move.objective.beneficiary.who, 'crafter'); assert.equal(move.objective.beneficiary.targetItemId, 'hat-vf_blood_sample');
  }
  assert.deepEqual(input.roster, before.roster); assert.deepEqual(input.state.nextSpawn, before.spawn);
});

await check('the future boss destination executes travel, one real Wickeline fight and paid VF crafting in either actor order', async () => {
  for (const reverse of [false, true]) {
    const input = futureBossFixture(); if (reverse) input.roster.reverse();
    tick(input, 960);
    assert.ok(input.roster.every(actor => actor.zoneId === 'c'));
    assert.equal(input.events.some(event => event.kind === 'hunt_start'), false);
    assert.equal(input.roster.reduce((sum, actor) => sum + invQty(actor.inventory, 'vf_blood_sample'), 0), 0);
    tick(input, 980);
    assert.equal(input.events.filter(event => event.kind === 'hunt_start' && event.subkind === 'weakline').length, 1);
    await fight(input);
    const crafter = input.roster.find(actor => actor._id === 'crafter');
    assert.equal(crafter.equipped.head, 'hat-vf_blood_sample', input.logs.join('\n'));
    assert.equal(invQty(crafter.inventory, 'base'), 0); assert.equal(invQty(crafter.inventory, 'vf_blood_sample'), 0);
    assert.equal(invQty(crafter.inventory, 'hat-_cloth'), 0);
    assert.equal(input.roster.reduce((sum, actor) => sum + actor.simCredits, 0), 64);
    assert.equal(input.events.filter(event => event.kind === 'hunt_settlement' && event.defeated).length, 1);
    assert.equal(input.events.filter(event => event.kind === 'gain' && event.itemId === 'vf_blood_sample').length, 1);
    const receipts = input.events.filter(event => event.kind === 'craft' && event.itemId === 'hat-vf_blood_sample');
    assert.equal(receipts.length, 1); assert.equal(receipts[0].paidCost, 3);
    assert.deepEqual(receipts[0].consumed, byId['hat-vf_blood_sample'].recipe.ingredients);
    assert.ok(input.logs.some(line => /팀 공동 목표.*위클라인.*crafter의 VF 혈액 샘플 모자/.test(line)));
  }
});

console.log(`TEAM_BOSS_GOAL_CHECKS ${checks}/${checks}`);
