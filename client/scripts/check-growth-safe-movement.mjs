import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';
const { runActorMovementDecisionPhase } = await import('../src/app/simulation/_lib/phaseActorMovementRuntime.js');
const { getRuleset } = await import('../src/utils/rulesets.js');
const { createFieldResources } = await import('../src/app/simulation/_lib/fieldResourceRuntime.js');
const { buildItemMetaById, buildItemNameById, buildItemKeyById, buildCraftableItems } = await import('../src/app/simulation/_lib/itemOptionsRuntime.js');
const { withSimulationRandom } = await import('../src/utils/simulationRandom.js');

// Real movement decisions only: no full match, source substitution or rewards.
const enemy = (id, zoneId, extra = {}) => ({ _id: id, name: id, mapId: 'safe-map', teamId: 'hostile',
  zoneId, hp: 100, maxHp: 100, inventory: [], stats: { attackPower: 1000, defense: 1000 }, ...extra });
function fixture({ graph = { a: ['b', 'c'], b: ['a'], c: ['a'] }, sources = ['b', 'c'],
  threats = [enemy('danger-b', 'b')], forbidden = [], late = false } = {}) {
  const raw = { _id: 'safe-raw', name: '안전 경로 원재료', type: '재료', tier: 1, spawnZones: sources };
  const hero = { _id: 'safe-hero', itemKey: 'safe-hero', name: '기초 모자', type: '방어구',
    category: 'equipment', equipSlot: 'head', tier: 4 };
  const target = { ...hero, _id: 'safe-target', itemKey: 'safe-target', name: '목표 모자', tier: late ? 5 : 4,
    recipe: { ingredients: [{ itemId: raw._id, qty: 1 }, ...(late ? [{ itemId: hero._id, qty: 1 }] : [])],
      resultQty: 1, creditsCost: 7 } };
  const publicItems = [raw, hero, target], mapObj = { _id: 'safe-map',
    zones: Object.keys(graph).map(zoneId => ({ zoneId, name: zoneId })) };
  const ruleset = structuredClone(getRuleset('ER_S11'));
  ruleset.worldSpawns.dimensionRift.enabled = false;
  const actor = { _id: 'safe-farmer', name: 'farmer', mapId: mapObj._id, teamId: 'friendly', zoneId: 'a',
    hp: 100, maxHp: 100, simCredits: 30, stats: { attackPower: 20, defense: 10 }, equipped: {},
    inventory: late ? [{ ...hero, itemId: hero._id, qty: 1 }] : [],
    routePlanTargetItemIds: [late ? hero._id : target._id],
    ...(late ? { goalLoadouts: { legend: { headKey: target.itemKey } } } : {}),
    aiTargetZoneId: 'b', aiTargetTTL: 4, aiTargetReason: 'stale-target' };
  return { actor, raw, target, publicItems, mapObj, zoneGraph: graph, ruleset,
    nextSpawn: { fieldResources: createFieldResources(mapObj, publicItems, ruleset) },
    threats, forbiddenIds: new Set(forbidden) };
}
function run(input, overrides = {}) {
  const protectedInputs = structuredClone({ mapObj: input.mapObj, graph: input.zoneGraph,
    items: input.publicItems, rules: input.ruleset, spawn: input.nextSpawn, threats: input.threats });
  const credits = input.actor.simCredits, events = [];
  const result = withSimulationRandom(() => 0, () => runActorMovementDecisionPhase({ state: {
    ...input, publicItems: input.publicItems, zones: input.mapObj.zones,
    craftables: buildCraftableItems(input.publicItems), itemMetaById: buildItemMetaById(input.publicItems),
    itemNameById: buildItemNameById(input.publicItems), itemKeyById: buildItemKeyById(input.publicItems),
    phaseSurvivors: [input.actor, ...input.threats], nextDay: 3, nextPhase: 'morning',
    isSoloMatch: true, kiosks: [], ...overrides,
  }, actions: { atNow: () => ({ day: overrides.nextDay || 3, phase: overrides.nextPhase || 'morning', sec: 500 }),
    emitRunEvent: (kind, payload) => events.push({ kind, payload }) } }));
  assert.deepEqual({ mapObj: input.mapObj, graph: input.zoneGraph, items: input.publicItems,
    rules: input.ruleset, spawn: input.nextSpawn, threats: input.threats }, protectedInputs,
  'Movement cannot change source, graph, stock, enemy, recipe or rules inputs.');
  assert.equal(input.actor.simCredits, credits, 'Travel cannot pay recipe fees.');
  if (result.actor._growthPlan?.targetId) {
    assert.equal(result.actor._growthPlan.targetId, input.target._id, 'Risk cannot choose a replacement recipe.');
    assert.equal(result.actor._growthPlan.plannedCredits, 7);
  }
  const from = result.currentZone, to = result.actor.zoneId;
  assert.ok(from === to || input.zoneGraph[from]?.includes(to), 'Every movement is a legal directed adjacent step.');
  input.actor = result.actor;
  return { ...result, events };
}
function expectMove(input, to, target = to, overrides) {
  const result = run(input, overrides);
  assert.equal(result.actor.zoneId, to);
  assert.equal(result.actor._growthPlan.targetZoneId, target);
  assert.equal(result.actor.aiTargetZoneId, null, 'Growth movement must clear stale target memory.');
  return result;
}
let passed = 0, failed = 0;
function check(name, test) {
  try { test(); passed++; console.log(`PASS ${name}`); }
  catch (error) { failed++; console.error(`FAIL ${name}: ${error.message}`); }
}

check('an equal-distance safe source replaces the hostile source in the actual movement phase', () => {
  expectMove(fixture(), 'c');
});
check('a farther safe source is preferred over a hostile adjacent source', () => {
  expectMove(fixture({ graph: { a: ['b', 'x'], b: [], x: ['c'], c: [] } }), 'x', 'c');
});
check('a safe destination uses its safe directed detour beyond the old three-step limit', () => {
  const input = fixture({ graph: { a: ['x', 's'], x: ['d'], s: ['t'], t: ['u'], u: ['d'], d: [] },
    sources: ['d'], threats: [enemy('unsafe-intermediate', 'x')] });
  expectMove(input, 's', 'd');
  expectMove(input, 't', 'd');
});
check('all unsafe material routes wait in place without random wandering or stale target memory', () => {
  const result = expectMove(fixture({ threats: [enemy('danger-b', 'b'), enemy('danger-c', 'c')] }), 'a', '');
  assert.equal(result.moveReason, 'growth_blocked');
  assert.equal(result.actor._growthPlan.blocked, 'no_safe_path');
});
check('the next action retries a previously unsafe source after its threat leaves', () => {
  const input = fixture({ threats: [enemy('danger-b', 'b'), enemy('danger-c', 'c')] });
  expectMove(input, 'a', '');
  input.threats[1].zoneId = 'away';
  expectMove(input, 'c');
  assert.equal(input.actor._growthPlan.blocked, '');
});
check('stock depletion and forbidden alternatives are reread at the next actual action', () => {
  const input = fixture({ threats: [enemy('danger-b', 'b'), enemy('danger-c', 'c')] });
  expectMove(input, 'a', '');
  input.threats[0].zoneId = 'away';
  input.threats[1].zoneId = 'away';
  input.nextSpawn.fieldResources.byZone.b[input.raw._id].remaining = 0;
  expectMove(input, 'c');
  const closed = fixture({ forbidden: ['b'], threats: [] });
  expectMove(closed, 'c');
});
check('a forbidden safe alternative is not substituted or teleported into', () => {
  const input = fixture({ forbidden: ['c'] });
  expectMove(input, 'a', '');
  input.threats[0].zoneId = 'away';
  expectMove(input, 'b');
});
check('ordinary no-threat routes preserve source ranking and existing directed tie order', () => {
  expectMove(fixture({ threats: [] }), 'b');
  expectMove(fixture({ graph: { a: ['z', 'y'], z: ['d'], y: ['d'], d: [] }, sources: ['d'], threats: [] }), 'z', 'd');
});
check('friendly, dead, other-map and other-combat-space actors do not invent hostile pressure', () => {
  for (const extra of [{ teamId: 'friendly' }, { hp: 0 }, { mapId: 'other-map' }, { _combatSpaceId: 'dimension_rift:other' }]) {
    expectMove(fixture({ threats: [enemy('not-a-live-local-enemy', 'b', extra)] }), 'b');
  }
});
check('equal and favorable pressure remain legal under the existing safe-route contract', () => {
  const equal = fixture({ threats: [enemy('equal-opponent', 'b', { stats: { attackPower: 20, defense: 10 } })] });
  expectMove(equal, 'b');
  const strong = fixture(); strong.actor.stats = { attackPower: 2000, defense: 2000 };
  expectMove(strong, 'b');
});
check('first-morning PvP grace preserves farming while first night uses normal safety', () => {
  expectMove(fixture(), 'b', 'b', { nextDay: 1, nextPhase: 'morning' });
  expectMove(fixture(), 'c', 'c', { nextDay: 1, nextPhase: 'night' });
});
check('ready crafting stays in place without changing its fee or materials', () => {
  const input = fixture(); input.actor.inventory = [{ ...input.raw, itemId: input.raw._id, qty: 1 }];
  const result = expectMove(input, 'a'); assert.equal(result.moveReason, 'growth_craft');
});
check('an active committed late-team plan retains precedence over individual growth routing', () => {
  const input = fixture({ late: true });
  const result = run(input, { isSoloMatch: false, teamMovementPlanCommitted: true,
    teamMovementPlan: { mode: 'team_rotate', leaderId: 'leader', targetZoneId: 'b', nextStep: 'b' } });
  assert.equal(result.actor.zoneId, 'b'); assert.equal(result.moveReason, 'team_rotate');
});
check('current-zone flee, recovery and forbidden escape retain their existing precedence', () => {
  const flee = fixture({ threats: [enemy('current-danger', 'a')] });
  assert.ok(run(flee).moveReason.startsWith('flee:'));
  const recovery = fixture({ threats: [] }); recovery.actor.hp = 20;
  assert.equal(run(recovery).recovering, true);
  const escape = fixture({ forbidden: ['a'] }); assert.equal(run(escape).mustEscape, true);
});
check('announced endgame movement retains precedence over a hostile growth route', () => {
  const input = fixture(); input.nextSpawn.endgame = { stage: 'approach', zoneIds: ['a', 'b', 'c'],
    finalZoneId: 'b', singleZoneAtSec: 500 };
  const result = run(input); assert.equal(result.actor.zoneId, 'b'); assert.equal(result.moveReason, 'endgame_rotate');
});
console.log(`GROWTH_SAFE_MOVEMENT_CHECKS ${passed}/${passed + failed}`);
if (failed) process.exitCode = 1;
