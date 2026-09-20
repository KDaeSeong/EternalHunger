import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';
const { buildTeamMovementPlans, buildTeamCoordination, pickTeamSafeZone } = await import('../src/app/simulation/_lib/teamTacticsRuntime.js');
const { runActorMovementDecisionPhase } = await import('../src/app/simulation/_lib/phaseActorMovementRuntime.js');
const { runPhaseActorActionPipeline } = await import('../src/app/simulation/_lib/phaseActorActionPipelineRuntime.js');
const { publishTeamRegroupDecision, describeTeamRegroupDecision } = await import('../src/app/simulation/_lib/teamRegroupRuntime.js');
const { buildTeamObserverModel } = await import('../src/app/simulation/_lib/teamObserverRuntime.js');
const { refreshActorGrowthPlan } = await import('../src/app/simulation/_lib/growthPlanRuntime.js');
const { withSimulationRandom } = await import('../src/utils/simulationRandom.js');
const { resolveActorNextMoveZone } = await import('../src/app/simulation/_lib/actorMovementDecisionHelpers.js');
const { initializeSpatialPosition } = await import('../src/app/simulation/_lib/combatSpatialRuntime.js');
const { getCombatIntentOpponents } = await import('../src/app/simulation/_lib/combatTimingRuntime.js');

const actor = (id, zoneId, extra = {}) => ({ _id: id, name: id, teamId: 't', zoneId, hp: 100, maxHp: 100,
  stats: { attackPower: 20, defense: 10 }, inventory: [], _growthPlan: { openingComplete: true }, ...extra });
const graph = { a: ['b'], b: ['a', 'c'], c: ['b', 'd'], d: ['c', 'e'], e: ['d'] };
const squad = [actor('lone', 'a'), actor('anchor', 'e', { teamSlot: 1 }), actor('friend', 'e', { teamSlot: 2 })];
const options = { roster: squad, zoneGraph: graph, day: 2, phase: 'night', maxDepth: 3, estimatePower: () => 100 };
let checks = 0;
const check = (name, fn) => { fn(); checks += 1; console.log(`PASS ${name}`); };
const ruleset = { ai: { recoverHpBelow: 38, fightAvoidMinRatio: 0.4, targetTtlMin: 1, targetTtlMax: 1 }, forbidden: { escapeMoveChance: 1 } };
const record = () => {
  const events = [], logs = [];
  return { events, logs, actions: { atNow: () => ({ day: 2, phase: 'night', sec: 400 }),
    emitRunEvent: (kind, payload, at) => events.push(structuredClone({ kind, ...payload, at })),
    addLog: (text) => logs.push(text), getZoneName: (id) => `지역${id}` } };
};
const world = { mapObj: { zones: Object.keys(graph).map((zoneId) => ({ zoneId, name: zoneId })) },
  zoneGraph: graph, forbiddenIds: new Set() };
const move = (who, roster, extra = {}) => {
  const state = { ...world, actor: structuredClone(who), phaseSurvivors: structuredClone(roster), publicItems: [],
    craftables: [], itemKeyById: {}, itemMetaById: {}, itemNameById: {}, kiosks: [], zones: world.mapObj.zones,
    nextDay: 2, nextPhase: 'night', phaseIdxNow: 3, ruleset, ...extra };
  const plans = buildTeamCoordination({ ...options, roster: state.phaseSurvivors, zoneGraph: state.zoneGraph, forbiddenIds: state.forbiddenIds });
  state.teamMovementPlan = plans.movementPlans.get(who._id);
  state.teamRegroupDecision = plans.regroupDecisions.get(who._id);
  const rec = record(); let cost = 0;
  const result = runActorMovementDecisionPhase({ state, actions: { ...rec.actions, reserveActionSecond: (seconds) => { cost += seconds; } } });
  return { ...rec, ...result, cost };
};

check('a safe four-edge rally is reachable without extending retreat search or teleporting', () => {
  const plans = buildTeamMovementPlans(options);
  assert.ok(plans.has('lone'), 'A known safe rally four edges away must not disappear at the retreat-search depth limit.');
  assert.equal(plans.get('lone').targetZoneId, 'e');
  assert.equal(plans.get('lone').nextStep, 'b');
  assert.equal(pickTeamSafeZone(squad[0], squad, graph, new Set(), { maxDepth: 3, targetZoneId: 'e' }), null);
});

check('an already selected safe team route cannot be cancelled by an unrelated movement coin flip', () => {
  let draws = 0;
  const result = withSimulationRandom(() => { draws += 1; return 0.999999; }, () => move(squad[0], squad));
  assert.equal(result.nextZoneId, 'b'); assert.equal(result.moveReason, 'team_regroup');
  assert.equal(draws, 0);
});

check('actual movement reaches a distant rally one edge at a time and records arrival only there', () => {
  let lone = structuredClone(squad[0]); const distances = [];
  for (const expected of ['b', 'c', 'd', 'e']) {
    const result = move(lone, [lone, ...squad.slice(1)]);
    assert.equal(result.nextZoneId, expected); assert.ok(graph[lone.zoneId].includes(expected));
    assert.ok(result.moveEtaSec >= 1);
    if (result.moveEtaSec > 1) assert.equal(result.cost, result.moveEtaSec);
    assert.equal(result.moveReason, 'team_regroup');
    const evidence = result.events.find((event) => event.kind === 'team_regroup').regroupEvidence;
    distances.push(evidence.distance);
    assert.equal(evidence.status, expected === 'e' ? 'arrived' : 'joining');
    assert.equal(evidence.companionsAtTarget, 2);
    lone = result.actor;
  }
  assert.deepEqual(distances, [4, 3, 2, 1]);
});

check('committed steps still reject a non-edge or a newly forbidden region', () => {
  for (const [committedNextStep, forbiddenIds] of [['e', new Set()], ['b', new Set(['b'])]]) {
    const result = withSimulationRandom(() => { throw new Error('A rejected committed step must not fall back to random movement.'); }, () =>
      resolveActorNextMoveZone({ state: { actor: squad[0], currentZone: 'a', neighbors: ['b'], zoneGraph: graph, committedNextStep, forbiddenIds } }));
    assert.equal(result.nextZoneId, 'a'); assert.equal(result.willMove, false);
  }
});

check('the one-decision retreat reversal guard still interrupts a committed regroup', () => {
  const lone = { ...squad[0], _retreatAvoidZoneId: 'b', _retreatAvoidDecisions: 1 };
  const result = move(lone, [lone, ...squad.slice(1)]);
  assert.equal(result.nextZoneId, 'a'); assert.equal(result.actor._teamRegroup.status, 'reentry');
  assert.equal(result.actor._retreatAvoidZoneId, '');
  assert.equal(move(result.actor, [result.actor, ...squad.slice(1)]).nextZoneId, 'b');
});

check('a longer safe detour is preferred to crossing an enemy', () => {
  const detour = { ...graph, a: ['b', 'x'], e: ['d', 'x'], x: ['a', 'e'] };
  const enemy = actor('enemy', 'x', { teamId: 'enemy' });
  const result = move(squad[0], [...squad, enemy], { zoneGraph: detour });
  assert.equal(result.nextZoneId, 'b'); assert.equal(result.actor._teamRegroup.distance, 4);
});

for (const [name, extra, roster, expected] of [
  ['enemy', {}, [...squad, actor('enemy', 'c', { teamId: 'enemy' })], 'enemy_path'],
  ['forbidden', { forbiddenIds: new Set(['c']) }, squad, 'forbidden_path'],
  ['disconnected', { zoneGraph: { a: ['b'], b: ['a'], e: [] } }, squad, 'disconnected'],
]) check(`${name} blockage is distinguished and cannot fall back to wandering down the rejected rally path`, () => {
  const result = move(squad[0], roster, extra);
  assert.equal(result.didMove, false); assert.equal(result.nextZoneId, 'a');
  assert.equal(result.moveReason, 'team_regroup_wait');
  assert.equal(result.actor._teamRegroup.status, expected);
  assert.equal(result.events.some((event) => event.kind === 'move'), false);
});

check('the rally planner is deterministic, input-order independent and read-only', () => {
  const before = structuredClone(squad);
  const normalize = (result) => Object.fromEntries(Object.entries(result).map(([key, value]) => [key, [...value].sort(([a], [b]) => a.localeCompare(b))]));
  assert.deepEqual(normalize(buildTeamCoordination(options)), normalize(buildTeamCoordination({ ...options, roster: [...squad].reverse() })));
  assert.deepEqual(squad, before);
});

check('unfinished growth keeps the real recipe while ready allies have a full-map escort route', () => {
  const items = [
    { _id: 'raw', name: '부족 재료', type: '재료', category: 'material', tier: 1, spawnZones: ['e'], recipe: { ingredients: [] } },
    { _id: 'hat', name: '목표 모자', type: '머리', category: 'equipment', equipSlot: 'head', tier: 2, recipe: { ingredients: [{ itemId: 'raw', qty: 1 }] } },
  ];
  const farmer = actor('farmer', 'e', { routePlanTargetItemIds: ['hat'] });
  refreshActorGrowthPlan(farmer, items, world);
  const roster = [actor('ready', 'a'), farmer];
  const plans = buildTeamCoordination({ ...options, roster, day: 1 });
  assert.equal(plans.movementPlans.get('ready').nextStep, 'b');
  assert.equal(plans.movementPlans.has('farmer'), false);
  const result = move(farmer, roster, { publicItems: items });
  assert.equal(result.nextZoneId, 'e'); assert.equal(result.moveReason, 'growth_farm');
  assert.equal(result.actor._teamRegroup.status, 'growing');
  assert.match(describeTeamRegroupDecision(result.actor._teamRegroup), /목표 모자.*부족 재료 ×1/);
  assert.deepEqual(result.actor.inventory, []);
  assert.deepEqual(result.actor.routePlanTargetItemIds, ['hat']);
});

check('legacy opening routes and solo matches keep their original movement policy', () => {
  const roster = squad.map((row) => ({ ...row, _growthPlan: null, routePlanIndex: 0, routePlanZoneIds: ['a', 'e'] }));
  const opening = buildTeamCoordination({ ...options, roster, day: 1 });
  assert.equal(opening.movementPlans.size, 0);
  assert.ok([...opening.regroupDecisions.values()].every((row) => row.stage === 'opening'));
  const solo = buildTeamCoordination({ ...options, isSoloMatch: true });
  assert.equal(solo.movementPlans.size, 0); assert.equal(solo.regroupDecisions.size, 0);
});

check('low HP, control, forbidden escape and endgame override regroup without claiming arrival', () => {
  const hurt = { ...squad[0], hp: 12 };
  const recovery = move(hurt, [hurt, ...squad.slice(1)]);
  assert.equal(recovery.actor._teamRegroup.status, 'recovery');
  assert.match(describeTeamRegroupDecision(recovery.actor._teamRegroup), /HP 12\/100.*38/);
  const stunned = { ...squad[0], activeEffects: [{ name: '기절', remainingDuration: 10, durationUnit: 'sec' }] };
  const held = move(stunned, [stunned, ...squad.slice(1)]);
  assert.equal(held.didMove, false); assert.equal(held.actor._teamRegroup.status, 'status');
  const escape = move(squad[0], squad, { forbiddenIds: new Set(['a']) });
  assert.equal(escape.actor._teamRegroup.status, 'forbidden');
  const final = move(squad[0], squad, { nextSpawn: { endgame: { zoneIds: Object.keys(graph), finalZoneId: 'e', singleZoneAtSec: 0, stage: 'final' } } });
  assert.equal(final.actor._teamRegroup.status, 'endgame');
  assert.equal(final.actor._teamRegroup.status === 'arrived', false);
});

check('repeated scheduler cooldowns preserve the committed join instead of spamming wait events', () => {
  const result = move(squad[0], squad); const rec = record();
  const planned = buildTeamCoordination({ ...options, roster: [result.actor, ...squad.slice(1)] }).regroupDecisions.get('lone');
  for (let i = 0; i < 30; i += 1) publishTeamRegroupDecision(result.actor, planned, { ...rec.actions, status: 'action_wait', at: { sec: 401 + i / 4 } });
  assert.equal(rec.events.length, 0); assert.equal(result.actor._teamRegroup.status, 'joining');
});

check('evidence owns its inputs and the observer keeps it separate from later action queue text', () => {
  const result = move(squad[0], squad); const event = result.events.find((row) => row.kind === 'team_regroup');
  const old = structuredClone(event);
  result.actor.hp = 3; result.actor.zoneId = 'd'; result.actor._teamRegroup.targetZoneId = 'other';
  assert.deepEqual(event, old);
  const events = [event, { kind: 'queue', who: 'lone', chosen: 'craft', reason: 'growth_craft', at: { sec: 401 } }];
  const model = buildTeamObserverModel({ survivors: [result.actor, ...squad.slice(1)], events, teamId: 't', matchSec: 402 });
  const member = model.members.find((row) => row.id === 'lone');
  assert.match(member.coordination.text, /4구역 거리/); assert.equal(member.coordination.sec, 400);
  assert.match(member.decision.text, /제작/);
  assert.equal(buildTeamObserverModel({ survivors: squad, events, teamId: 't', matchSec: 399 }).members[0].coordination, null);
});

check('revival, explicit clearing and combat-space changes do not resurrect an earlier join plan', () => {
  const result = move(squad[0], squad); const event = result.events.find((row) => row.kind === 'team_regroup');
  const inspect = (who, extraEvents = []) => buildTeamObserverModel({ survivors: [who, ...squad.slice(1)],
    events: [event, ...extraEvents], teamId: 't', matchSec: 402 }).members.find((row) => row.id === 'lone').coordination;
  assert.equal(inspect(result.actor, [{ kind: 'revive', who: 'lone', at: { sec: 401 } }]), null);
  assert.equal(inspect(result.actor, [{ kind: 'team_regroup', who: 'lone', cleared: true, at: { sec: 401 } }]), null);
  assert.equal(inspect({ ...result.actor, _combatSpaceId: 'dimension-rift:test' }), null);
  assert.equal(inspect({ ...result.actor, hp: 0 }), null);
  const rec = record();
  publishTeamRegroupDecision(result.actor, null, { ...rec.actions, at: { sec: 402 } });
  assert.equal(result.actor._teamRegroup, null); assert.equal(rec.events[0].cleared, true);
});

for (const [status, extra] of [
  ['hunt', { _wildlifeHunt: { target: { name: '늑대' } } }],
  ['cast', { _pendingCharacterCast: { releaseAtSec: 100 } }],
  ['status', { activeEffects: [{ name: '기절', remainingDuration: 10, durationUnit: 'sec' }] }],
  ['action_wait', { _growthReadyAtSec: 100 }],
]) check(`the actual scheduled pipeline records ${status} without moving or granting anything`, () => {
  const roster = squad.map((row, index) => ({ ...structuredClone(row), _growthReadyAtSec: 100, ...(index === 0 ? extra : {}) }));
  const rec = record(); const before = roster.map((row) => ({ zone: row.zoneId, hp: row.hp, inventory: structuredClone(row.inventory) }));
  const result = runPhaseActorActionPipeline({ state: { ...world, phaseSurvivors: roster, publicItems: [],
    itemMetaById: {}, itemNameById: {}, craftables: [], ruleset, nextDay: 2, nextPhase: 'night', actionIntervalSec: 20,
    currentActionSec: () => 10 }, actions: rec.actions });
  assert.equal(result.updatedSurvivors[0]._teamRegroup.status, status);
  assert.deepEqual(result.updatedSurvivors.map((row) => ({ zone: row.zoneId, hp: row.hp, inventory: row.inventory })), before);
  assert.ok(rec.events.every((row) => row.kind === 'team_regroup'));
});

check('an actual active combat intent explains delayed regroup without cancelling the fight', () => {
  const enemy = actor('enemy', 'a', { teamId: 'enemy', _growthReadyAtSec: 100 });
  const roster = [...squad.map((row) => ({ ...structuredClone(row), _growthReadyAtSec: 100 })), enemy];
  for (const row of [roster[0], enemy]) row._spatial = { ...initializeSpatialPosition(row), x: 1, y: 1 };
  roster[0]._combatIntent = { zoneId: 'a', combatSpaceId: 'world', enemyTeamId: 'enemy' };
  assert.equal(getCombatIntentOpponents(roster[0], roster, 10).length, 1);
  const before = structuredClone(roster[0]._combatIntent); const rec = record();
  const result = runPhaseActorActionPipeline({ state: { ...world, phaseSurvivors: roster, publicItems: [],
    itemMetaById: {}, itemNameById: {}, craftables: [], ruleset, nextDay: 2, nextPhase: 'night', actionIntervalSec: 20,
    currentActionSec: () => 10 }, actions: rec.actions });
  assert.equal(result.updatedSurvivors[0]._teamRegroup.status, 'combat');
  assert.deepEqual(result.updatedSurvivors[0]._combatIntent, before);
  assert.equal(result.updatedSurvivors[0].zoneId, 'a');
});

check('absent coordination remains a no-op for untouched alive or dead actors', () => {
  for (const hp of [100, 0]) {
    const row = Object.freeze({ _id: 'idle', hp, zoneId: 'a' });
    const events = [];
    publishTeamRegroupDecision(row, null, { emitRunEvent: (...args) => events.push(args) });
    assert.equal(Object.hasOwn(row, '_teamRegroup'), false); assert.deepEqual(events, []);
  }
});

console.log(JSON.stringify({ pass: true, checks, scope: 'controlled team regroup paths; not original evaluator reproduction or balance acceptance' }));
