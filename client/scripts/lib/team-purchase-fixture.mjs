import './register-simulation-modules.mjs';
const { runPhaseActorActionPipeline } = await import('../../src/app/simulation/_lib/phaseActorActionPipelineRuntime.js');
const { refreshActorGrowthPlan, getActorGrowthCraftGoal } = await import('../../src/app/simulation/_lib/growthPlanRuntime.js');
const { buildTeamCoordination } = await import('../../src/app/simulation/_lib/teamTacticsRuntime.js');
const { chooseAiMoveTargets } = await import('../../src/app/simulation/_lib/aiMoveTargetRuntime.js');
const { computeLateGameUpgradeNeed } = await import('../../src/app/simulation/_lib/gearUpgradeNeedRuntime.js');
const { buildItemMetaById, buildItemNameById, buildItemKeyById, buildCraftableItems } = await import('../../src/app/simulation/_lib/itemOptionsRuntime.js');
const { createFieldResources } = await import('../../src/app/simulation/_lib/fieldResourceRuntime.js');
const { applyLootCraftResult } = await import('../../src/app/simulation/_lib/lootCraftResultRuntime.js');
const { getRuleset } = await import('../../src/utils/rulesets.js');
const { withSimulationRandom } = await import('../../src/utils/simulationRandom.js');
const { emitSimulationRunEvent } = await import('../../src/app/simulation/_lib/logActionRuntime.js');
const eventActions = await import('../../src/app/simulation/_lib/runEventRuntime.js');

// Explicit mid-match recipe, inventory and earned-credit conditions. This is
// not a default-balance match, a prepared outcome, or the unavailable Marcus input.
export const hero = { _id: 'purchase-hero', itemKey: 'purchase-hero', name: '초기 모자', type: '방어구',
  category: 'equipment', equipSlot: 'head', tier: 4, stats: { defense: 10 } };
export const cloth = { _id: 'purchase-cloth', name: '추가 천', type: '재료', tier: 1, spawnZones: ['b'] };
export const tree = { _id: 'purchase-tree', name: '생명의 나무', type: '재료', tier: 4 };
export const gear = (id, name, ingredient) => ({ ...hero, _id: id, itemKey: id, name, tier: 5,
  recipe: { ingredients: [{ itemId: hero._id, qty: 1 }, { itemId: ingredient, qty: 1 }], resultQty: 1, creditsCost: 3 } });
export const ordinary = gear('purchase-ordinary', '천 모자', cloth._id);
export const rare = gear('purchase-rare', '생명 모자', tree._id);
export const items = [hero, cloth, tree, ordinary, rare];
export function fixture() {
  const ruleset = structuredClone(getRuleset('ER_S11'));
  ruleset.worldSpawns.dimensionRift.enabled = false;
  const mapObj = { _id: 'purchase-map', zones: ['a', 'b', 'c'].map(zoneId => ({ zoneId, name: zoneId, hasKiosk: zoneId === 'c' })) };
  const state = { mapObj, zones: mapObj.zones, zoneGraph: { a: ['b', 'c'], b: ['a'], c: ['a'] },
    forbiddenIds: new Set(), nextDay: 3, nextPhase: 'morning', phaseIdxNow: 4, ruleset,
    publicItems: items, craftables: buildCraftableItems(items), itemMetaById: buildItemMetaById(items),
    itemNameById: buildItemNameById(items), itemKeyById: buildItemKeyById(items),
    actionIntervalSec: 20, statusElapsedSec: 0, currentActionSec: () => 500, kiosks: [], droneOffers: [],
    nextSpawn: { coreNodes: [], fieldResources: createFieldResources(mapObj, items, ruleset) } };
  const roster = ['leader', 'crafter', 'escort'].map((_id, index) => ({ _id, name: _id, teamId: 'team:1', teamSlot: index + 1,
    zoneId: 'a', hp: 100, maxHp: 100, stats: { attackPower: 20, defense: 10 }, simCredits: index === 1 ? 260 : 20,
    inventory: [{ ...structuredClone(hero), itemId: hero._id, qty: 1 }], equipped: { head: hero._id },
    routePlanTargetItemIds: [hero._id], goalLoadouts: { legend: { headKey: index === 1 ? rare.itemKey : ordinary.itemKey } } }));
  for (const actor of roster) refreshActorGrowthPlan(actor, items, state);
  return { state, roster };
}
export function plan({ state, roster }) {
  return buildTeamCoordination({ roster, zoneGraph: state.zoneGraph, forbiddenIds: state.forbiddenIds,
    day: state.nextDay, phase: state.nextPhase, spawnState: state.nextSpawn, ruleset: state.ruleset,
    publicItems: state.publicItems, isSoloMatch: state.isSoloMatch,
    mapObj: state.mapObj, kiosks: state.kiosks,
    getRotationHold: state.getRotationHold,
    estimatePower: () => 100, chooseLeaderMove: actor => chooseAiMoveTargets({ actor,
      craftGoal: getActorGrowthCraftGoal(actor, state.publicItems),
      upgradeNeed: computeLateGameUpgradeNeed(actor, state.itemMetaById, state.itemNameById, state.nextDay, state.nextPhase, state.ruleset),
      mapObj: state.mapObj, spawnState: state.nextSpawn, forbiddenIds: state.forbiddenIds, kiosks: state.kiosks, publicItems: state.publicItems,
      day: state.nextDay, phase: state.nextPhase, ruleset: state.ruleset }) });
}
export function tick(input, random = () => 0) {
  const { state, roster } = input, events = [], logs = [];
  const emitRunEvent = (kind, payload, at) => emitSimulationRunEvent({ kind, payload, at,
    actions: { enqueueRunEvent: event => events.push(structuredClone(event)) } });
  const actions = { atNow: () => ({ day: state.nextDay, phase: state.nextPhase, sec: state.currentActionSec() }),
    emitRunEvent, addLog: message => logs.push(message),
    emitItemGainIfAny: (...args) => eventActions.emitItemGainIfAny(emitRunEvent, ...args),
    emitObjectiveRunEvent: (...args) => eventActions.emitObjectiveRunEvent(emitRunEvent, ...args),
    emitQueueRunEvent: (...args) => eventActions.emitQueueRunEvent(emitRunEvent, ...args),
    emitCraftRunEvent: (...args) => eventActions.emitCraftRunEvent(emitRunEvent, ...args) };
  actions.applyLootCraftResult = (actor, result, meta, at, zoneId) => applyLootCraftResult(actor, result, meta,
    { at, zoneId, addLog: actions.addLog, emitCraftRunEvent: actions.emitCraftRunEvent });
  return { ...withSimulationRandom(random, () => runPhaseActorActionPipeline({ state: { ...state, phaseSurvivors: roster }, actions })), events, logs };
}
export function refresh(input, catalog = input.state.publicItems) {
  Object.assign(input.state, { publicItems: catalog, craftables: buildCraftableItems(catalog),
    itemMetaById: buildItemMetaById(catalog), itemNameById: buildItemNameById(catalog), itemKeyById: buildItemKeyById(catalog) });
  input.state.nextSpawn.fieldResources = createFieldResources(input.state.mapObj, catalog, input.state.ruleset);
  for (const actor of input.roster) refreshActorGrowthPlan(actor, catalog, input.state);
}
