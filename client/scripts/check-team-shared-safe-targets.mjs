import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';
const { buildTeamCoordination } = await import('../src/app/simulation/_lib/teamTacticsRuntime.js');
const { chooseAiMoveTargets } = await import('../src/app/simulation/_lib/aiMoveTargetRuntime.js');
const { runActorMovementDecisionPhase } = await import('../src/app/simulation/_lib/phaseActorMovementRuntime.js');
const { runPhaseActorActionPipeline } = await import('../src/app/simulation/_lib/phaseActorActionPipelineRuntime.js');
const { computeLateGameUpgradeNeed } = await import('../src/app/simulation/_lib/gearUpgradeNeedRuntime.js');
const { getRuleset } = await import('../src/utils/rulesets.js');
const { withSimulationRandom } = await import('../src/utils/simulationRandom.js');
const { createFieldResources } = await import('../src/app/simulation/_lib/fieldResourceRuntime.js');

// Real coordination -> movement and bounded single-action pipeline checks.
// No full match, substituted runtime, synthetic rewards or searched seed.
const meteor = { _id: 'shared-safe-meteor', name: '운석', type: '재료', tier: 4 };
const member = (_id, teamSlot, zoneId = 'a') => ({ _id, name: _id, teamId: 'friendly', teamSlot,
  mapId: 'shared-safe-map', zoneId, hp: 100, maxHp: 100, simCredits: 30, inventory: [],
  stats: { attackPower: 20, defense: 10 }, aiTargetZoneId: 'b', aiTargetTTL: 4,
  aiTargetReason: 'old-unsafe-core' });
const threat = (zoneId, extra = {}) => ({ ...member(`enemy-${zoneId}`, 1, zoneId), teamId: 'hostile',
  stats: { attackPower: 1000, defense: 1000 }, _actionReadyAtSec: 9999, ...extra });
function fixture({ graph = { a: ['b', 'c'], b: ['a'], c: ['a'] },
  nodes = [{ id: 'bad-core', kind: 'meteor', zoneId: 'b', picked: false },
    { id: 'safe-core', kind: 'meteor', zoneId: 'c', picked: false }],
  threats = [threat('b')], forbidden = [] } = {}) {
  const mapObj = { _id: 'shared-safe-map', zones: Object.keys(graph).map(zoneId => ({ zoneId, name: zoneId })) };
  const ruleset = structuredClone(getRuleset('ER_S11')); ruleset.worldSpawns.dimensionRift.enabled = false;
  const publicItems = [meteor];
  return { mapObj, zones: mapObj.zones, zoneGraph: graph, ruleset, publicItems,
    nextSpawn: { coreNodes: structuredClone(nodes), fieldResources: createFieldResources(mapObj, publicItems, ruleset) },
    members: [member('one', 1), member('two', 2)], threats,
    forbiddenIds: new Set(forbidden), itemMetaById: { [meteor._id]: meteor },
    itemNameById: { [meteor._id]: meteor.name }, itemKeyById: {}, craftables: [],
    nextDay: 3, nextPhase: 'morning', phaseIdxNow: 4, kiosks: [] };
}
function choose(input, actor) {
  return chooseAiMoveTargets({ actor, craftGoal: null,
    upgradeNeed: computeLateGameUpgradeNeed(actor, input.itemMetaById, input.itemNameById, 3, 'morning', input.ruleset),
    mapObj: input.mapObj, spawnState: input.nextSpawn, forbiddenIds: input.forbiddenIds,
    day: 3, phase: 'morning', kiosks: [], publicItems: input.publicItems, ruleset: input.ruleset, nowSec: 500 });
}
function plan(input, override) {
  const roster = [...input.members, ...input.threats];
  const before = structuredClone({ roster, spawn: input.nextSpawn, graph: input.zoneGraph,
    rules: input.ruleset, items: input.publicItems, map: input.mapObj });
  let leaderCalls = 0;
  const result = withSimulationRandom(() => 0, () => buildTeamCoordination({ roster,
    zoneGraph: input.zoneGraph, forbiddenIds: input.forbiddenIds, ruleset: input.ruleset,
    spawnState: input.nextSpawn, publicItems: input.publicItems, mapObj: input.mapObj, kiosks: [],
    day: 3, phase: 'morning', maxDepth: 3,
    getRotationHold: actor => Number(actor._actionReadyAtSec || 0) > 500
      ? { reason: 'action_wait', readyAtSec: actor._actionReadyAtSec } : null,
    chooseLeaderMove: actor => { leaderCalls++; return override ? override(actor, choose(input, actor)) : choose(input, actor); },
  }));
  assert.deepEqual({ roster, spawn: input.nextSpawn, graph: input.zoneGraph, rules: input.ruleset,
    items: input.publicItems, map: input.mapObj }, before, 'Planning cannot mutate party, source, graph or catalogue.');
  return { ...result, leaderCalls };
}
function move(input, planned, actor = input.members.find(row => row.hp > 0), extra = {}) {
  const protectedInputs = structuredClone({ spawn: input.nextSpawn, graph: input.zoneGraph,
    map: input.mapObj, rules: input.ruleset, items: input.publicItems });
  const beforeCredits = actor.simCredits, beforeItems = actor.inventory.map(row => [row.itemId, row.qty]);
  const result = withSimulationRandom(() => 0, () => runActorMovementDecisionPhase({ state: {
    ...input, actor, phaseSurvivors: [...input.members, ...input.threats],
    teamMovementPlan: planned.movementPlans.get(actor._id),
    teamRegroupDecision: planned.regroupDecisions.get(actor._id), ...extra,
  }, actions: { atNow: () => ({ day: 3, phase: 'morning', sec: 500 }) } }));
  assert.deepEqual({ spawn: input.nextSpawn, graph: input.zoneGraph, map: input.mapObj,
    rules: input.ruleset, items: input.publicItems }, protectedInputs);
  assert.equal(actor.simCredits, beforeCredits); assert.deepEqual(actor.inventory.map(row => [row.itemId, row.qty]), beforeItems);
  assert.ok(result.currentZone === actor.zoneId || input.zoneGraph[result.currentZone]?.includes(actor.zoneId),
    'A shared decision must still execute a real directed adjacent step.');
  assert.equal(actor.aiTargetZoneId, null, 'Shared movement or explicit wait must discard stale individual TTL.');
  return result;
}
function assertShared(input, planned, target, next = target, source = 'safe-core') {
  assert.equal(planned.movementPlans.size, input.members.filter(row => row.hp > 0).length);
  for (const actor of input.members.filter(row => row.hp > 0)) {
    const shared = planned.movementPlans.get(actor._id);
    assert.equal(shared.targetZoneId, target); assert.equal(shared.nextStep, next);
    if (source) assert.deepEqual(shared.objective.sourceIds, [source]);
    const actual = move(input, planned, actor);
    assert.equal(actual.actor.zoneId, next); assert.equal(actual.moveReason, 'team_rotate');
    if (source) assert.deepEqual(actual.movementObjective.sourceIds, [source]);
  }
}
function assertHeld(input, planned) {
  const partyIds = new Set(input.members.map(row => row._id));
  assert.equal([...planned.movementPlans.keys()].filter(id => partyIds.has(id)).length, 0,
    'The blocked party gets no movement plan; other teams retain their own decisions.');
  for (const actor of input.members.filter(row => row.hp > 0)) {
    assert.equal(planned.regroupDecisions.get(actor._id).stage, 'path_blocked');
    const actual = move(input, planned, actor);
    assert.equal(actual.actor.zoneId, 'a'); assert.equal(actual.moveReason, 'team_regroup_wait');
    assert.equal(actual.movementObjective, null);
  }
}
let passed = 0, failed = 0;
function check(name, run) {
  try { run(); passed++; console.log(`PASS ${name}`); }
  catch (error) { failed++; console.error(`FAIL ${name}: ${error.message}`); }
}

check('real leader alternatives retry unsafe b and bind every shared movement to c and safe-core', () => {
  const input = fixture(), result = plan(input); assert.equal(result.leaderCalls, 1); assertShared(input, result, 'c');
});
check('an already safe first candidate retains its order and concrete source', () => {
  const input = fixture(); input.nextSpawn.coreNodes.reverse(); assertShared(input, plan(input), 'c');
});
check('a picked first source is unavailable even when an external proposal still lists it', () => {
  const input = fixture({ threats: [] }); input.nextSpawn.coreNodes[0].picked = true;
  assertShared(input, plan(input, (_actor, proposed) => ({ ...proposed, targets: ['b', 'c'] })), 'c');
});
check('explicit source restrictions cannot be dropped to invent another source at c', () => {
  const input = fixture(); assertHeld(input, plan(input, (_actor, proposed) => ({ ...proposed,
    targets: ['b', 'c'], objectiveSourceIds: ['bad-core'] })));
});
check('all unsafe alternatives explicitly wait instead of restoring individual unsafe TTL', () => {
  const input = fixture({ threats: [threat('b'), threat('c')] }); assertHeld(input, plan(input));
});
check('all forbidden or missing concrete alternatives use the existing blocked wait contract', () => {
  const input = fixture({ forbidden: ['b', 'c'] });
  assertHeld(input, plan(input, () => ({ targets: ['b', 'c'], objectiveType: 'natural_core', objectiveSubkind: 'core' })));
  const missing = fixture({ nodes: [], threats: [] });
  assertHeld(missing, plan(missing, () => ({ targets: ['b'], objectiveType: 'natural_core', objectiveSubkind: 'core' })));
});
check('current-zone concrete alternatives remain legal shared objectives', () => {
  const input = fixture({ nodes: [{ id: 'bad-core', kind: 'meteor', zoneId: 'b', picked: false },
    { id: 'here-core', kind: 'meteor', zoneId: 'a', picked: false }] });
  assertShared(input, plan(input), 'a', 'a', 'here-core');
});
check('a concrete safe alternative can require more than three directed edges', () => {
  const input = fixture({ graph: { a: ['b', 'x'], b: [], x: ['y'], y: ['z'], z: ['d'], d: [] },
    nodes: [{ id: 'bad-core', kind: 'meteor', zoneId: 'b', picked: false },
      { id: 'safe-core', kind: 'meteor', zoneId: 'd', picked: false }] });
  assertShared(input, plan(input), 'd', 'x');
});
check('generic roaming without a captured objective retains the configured depth limit', () => {
  const input = fixture({ threats: [], graph: { a: ['x'], x: ['y'], y: ['z'], z: ['d'], d: [] }, nodes: [] });
  const result = plan(input, () => ({ targets: ['d'], reason: 'generic roaming' }));
  for (const decision of result.regroupDecisions.values()) assert.equal(decision.blocked, 'replanned',
    'A nearby roaming limit is not evidence of an enemy on an empty path.');
  assertHeld(input, result);
});
check('every member must be eligible for the selected concrete rift', () => {
  const input = fixture({ threats: [], nodes: [] });
  input.ruleset.worldSpawns.dimensionRift.enabled = true;
  input.ruleset.worldSpawns.dimensionRift.contestChance = 1;
  input.nextSpawn.dimensionRifts = ['b', 'c'].map(zoneId => ({ id: `rift-${zoneId}`, zoneId,
    day: 3, phase: 'morning', resolved: false, entrantTeamIds: [], maxTeams: 2, entryClosesAtSec: 1000 }));
  input.members[1]._lastDimensionRiftExit = { riftId: 'rift-b' };
  assertShared(input, plan(input), 'c', 'c', 'rift-c');
});
check('a not-ready member still holds the whole prepared squad without choosing any objective', () => {
  const input = fixture(); input.members[1]._actionReadyAtSec = 600;
  const result = plan(input); assert.equal(result.leaderCalls, 0); assert.equal(result.movementPlans.size, 0);
  for (const decision of result.regroupDecisions.values()) assert.equal(decision.stage, 'rotation_wait');
});
check('dead leaders are excluded and other combat spaces do not add hostile pressure', () => {
  const input = fixture(); input.members.unshift({ ...member('dead-leader', 0), hp: 0 });
  assertShared(input, plan(input), 'c');
  const separate = fixture({ threats: [threat('b', { _combatSpaceId: 'dimension_rift:elsewhere' })] });
  assertShared(separate, plan(separate), 'b', 'b', 'bad-core');
});
check('separated regroup paths and favorable party pressure preserve their prior behavior', () => {
  const input = fixture(); input.members[1].zoneId = 'c'; const result = plan(input);
  assert.equal(result.leaderCalls, 0); assert.equal(result.movementPlans.get('two').targetZoneId, 'a');
  const strong = fixture(); for (const actor of strong.members) actor.stats = { attackPower: 2000, defense: 2000 };
  assertShared(strong, plan(strong), 'b', 'b', 'bad-core');
});
check('announced endgame movement still overrides a safe shared material target', () => {
  const input = fixture(); input.nextSpawn.endgame = { stage: 'approach', zoneIds: ['a', 'b', 'c'],
    finalZoneId: 'b', singleZoneAtSec: 500 };
  const result = plan(input), actual = move(input, result);
  assert.equal(actual.actor.zoneId, 'b'); assert.equal(actual.moveReason, 'endgame_rotate');
});
check('the real scheduled actor pipeline retries the safe alternative for the complete party', () => {
  const input = fixture({ graph: { a: ['b', 'x'], b: ['a'], x: ['a', 'c'], c: ['x'] } });
  const result = withSimulationRandom(() => 0, () => runPhaseActorActionPipeline({ state: { ...input,
    phaseSurvivors: [...input.members, ...input.threats], actionIntervalSec: 20, currentActionSec: () => 500,
  }, actions: { atNow: () => ({ day: 3, phase: 'morning', sec: 500 }) } }));
  for (const actor of result.updatedSurvivors.filter(row => row.teamId === 'friendly')) {
    assert.equal(actor.zoneId, 'x'); assert.deepEqual(actor._movementObjective.sourceIds, ['safe-core']);
    assert.equal(actor.simCredits, 30); assert.equal(actor.inventory.length, 0);
  }
});
check('the real scheduled actor pipeline holds the complete party when every source is unsafe', () => {
  const input = fixture({ threats: [threat('b'), threat('c')] });
  const result = withSimulationRandom(() => 0, () => runPhaseActorActionPipeline({ state: { ...input,
    phaseSurvivors: [...input.members, ...input.threats], actionIntervalSec: 20, currentActionSec: () => 500,
  }, actions: { atNow: () => ({ day: 3, phase: 'morning', sec: 500 }) } }));
  for (const actor of result.updatedSurvivors.filter(row => row.teamId === 'friendly')) {
    assert.equal(actor.zoneId, 'a'); assert.equal(actor._movementObjective, null);
    assert.equal(actor.inventory.length, 0); assert.equal(actor.simCredits, 30);
  }
});
console.log(`TEAM_SHARED_SAFE_TARGET_CHECKS ${passed}/${passed + failed}`);
if (failed) process.exitCode = 1;
