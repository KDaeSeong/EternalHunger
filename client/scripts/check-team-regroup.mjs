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
const { createFieldResources, collectFieldResourceLoot } = await import('../src/app/simulation/_lib/fieldResourceRuntime.js');

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
const unfinishedRecipeItems = () => [
  { _id: 'raw', name: '부족 재료', type: '재료', category: 'material', tier: 1, spawnZones: ['e'], recipe: { ingredients: [] } },
  { _id: 'hat', name: '목표 모자', type: '머리', category: 'equipment', equipSlot: 'head', tier: 2, recipe: { ingredients: [{ itemId: 'raw', qty: 1 }] } },
];
const move = (who, roster, extra = {}) => {
  const { omitRegroupObservation = false, ...stateExtra } = extra;
  const state = { ...world, actor: structuredClone(who), phaseSurvivors: structuredClone(roster), publicItems: [],
    craftables: [], itemKeyById: {}, itemMetaById: {}, itemNameById: {}, kiosks: [], zones: world.mapObj.zones,
    nextDay: 2, nextPhase: 'night', phaseIdxNow: 3, ruleset, ...stateExtra };
  const plans = buildTeamCoordination({ ...options, roster: state.phaseSurvivors, zoneGraph: state.zoneGraph,
    forbiddenIds: state.forbiddenIds, spawnState: state.nextSpawn, ruleset: state.ruleset,
    publicItems: state.publicItems, mapObj: state.mapObj, kiosks: state.kiosks, day: state.nextDay, phase: state.nextPhase });
  state.teamMovementPlan = plans.movementPlans.get(who._id);
  state.teamRegroupDecision = omitRegroupObservation ? null : plans.regroupDecisions.get(who._id);
  const rec = record(); let cost = 0;
  const result = runActorMovementDecisionPhase({ state, actions: { ...rec.actions, reserveActionSecond: (seconds) => { cost += seconds; } } });
  return { ...rec, ...result, cost, teamMovementPlan: state.teamMovementPlan };
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

  let leaderChoices = 0;
  const gathered = [lone, ...squad.slice(1)];
  const shared = buildTeamCoordination({ ...options, roster: gathered, chooseLeaderMove: () => {
    leaderChoices += 1; return { targets: ['d'], reason: 'shared_goal' };
  } });
  assert.equal(leaderChoices, 1, 'Only a fully gathered, ready squad may choose one common objective.');
  for (const member of gathered) {
    const plan = shared.movementPlans.get(member._id);
    assert.equal(shared.regroupDecisions.get(member._id).stage, 'together');
    assert.equal(plan.mode, 'team_rotate'); assert.equal(plan.targetZoneId, 'd');
    assert.equal(plan.nextStep, 'd'); assert.equal(plan.sourceReason, 'shared_goal');
  }

  const unfinished = gathered.map((member, index) => index === 0
    ? { ...member, _growthPlan: { openingComplete: false, blocked: '', targetId: 'real-recipe',
      targetName: '목표 모자', completedSlots: 3, totalSlots: 5 } } : member);
  const beforeWait = structuredClone(unfinished); let waitLeaderChoices = 0, draws = 0;
  const held = withSimulationRandom(() => { draws += 1; return 0.5; }, () => buildTeamCoordination({
    ...options, roster: unfinished, chooseLeaderMove: () => {
      waitLeaderChoices += 1;
      throw new Error('A co-located unfinished member must defer the common goal.');
    },
  }));
  assert.deepEqual([...held.regroupDecisions].map(([id, decision]) => [id, decision.stage])
    .sort(([a], [b]) => a.localeCompare(b)), [
    ['anchor', 'growth_wait'], ['friend', 'growth_wait'], ['lone', 'growing'],
  ]);
  const expectedWaitingFor = [{ who: 'lone', name: 'lone', targetName: '목표 모자', completedSlots: 3, totalSlots: 5 }];
  for (const id of ['anchor', 'friend']) assert.deepEqual(held.regroupDecisions.get(id).waitingFor, expectedWaitingFor);
  assert.equal(held.regroupDecisions.get('lone').targetZoneId, 'e');
  assert.equal(held.movementPlans.has('lone'), false);
  assert.ok([...held.movementPlans.values()].every((plan) => plan.mode !== 'team_rotate' && plan.nextStep === 'e'));
  assert.equal(waitLeaderChoices, 0); assert.equal(draws, 0);
  assert.deepEqual(unfinished, beforeWait, 'Planning must not mutate roster positions, inventory or the real growth plan.');

  const readyDecision = held.regroupDecisions.get('anchor'), readyRecord = record();
  publishTeamRegroupDecision(unfinished[1], readyDecision, { ...readyRecord.actions, at: { day: 2, phase: 'night', sec: 400 } });
  const readyEvent = readyRecord.events[0], readyEvidence = structuredClone(readyEvent.regroupEvidence);
  assert.equal(readyEvidence.status, 'growth_wait');
  assert.deepEqual(readyEvidence.waitingFor, expectedWaitingFor);
  const readyText = describeTeamRegroupDecision(readyEvidence, (id) => id);
  assert.match(readyText, /성장.*대기/); assert.doesNotMatch(readyText, /공동 행동 계획/);
  assert.match(readyText, /lone.*목표 모자.*3\/5/);

  publishTeamRegroupDecision(unfinished[1], structuredClone(readyDecision), {
    ...readyRecord.actions, status: 'action_wait', at: { day: 2, phase: 'night', sec: 400.25 },
  });
  assert.equal(readyRecord.events.length, 1, 'Scheduler cooldown must not replace growth-wait evidence with action_wait.');

  publishTeamRegroupDecision(unfinished[1], structuredClone(readyDecision), {
    ...readyRecord.actions, at: { day: 2, phase: 'night', sec: 401 },
  });
  assert.equal(readyRecord.events.length, 1, 'An identical growth-wait decision must be semantically deduplicated.');
  readyDecision.waitingFor[0].completedSlots = 4;
  assert.deepEqual(readyEvent.regroupEvidence, readyEvidence, 'Published waiting evidence must own its roster snapshot.');
  publishTeamRegroupDecision(unfinished[1], { ...structuredClone(readyDecision), waitingFor: [
    { ...expectedWaitingFor[0], completedSlots: 4 },
  ] }, { ...readyRecord.actions, status: 'action_wait', at: { day: 2, phase: 'night', sec: 402 } });
  assert.equal(readyRecord.events.length, 2, 'A real progress change must publish updated waiting evidence.');
  assert.equal(readyRecord.events[1].regroupEvidence.waitingFor[0].completedSlots, 4);
  const completedDecision = { ...structuredClone(readyDecision), stage: 'together', waitingFor: [] };
  publishTeamRegroupDecision(unfinished[1], completedDecision, {
    ...readyRecord.actions, status: 'action_wait', at: { day: 2, phase: 'night', sec: 403 },
  });
  assert.equal(readyRecord.events.length, 3, 'Completion must replace the stale growth-wait with physical gathering status.');
  assert.equal(readyRecord.events[2].regroupEvidence.status, 'together');

  const farmerRecord = record();
  publishTeamRegroupDecision(unfinished[0], held.regroupDecisions.get('lone'), { ...farmerRecord.actions,
    growthPlan: unfinished[0]._growthPlan, at: { day: 2, phase: 'night', sec: 400 } });
  const farmerEvidence = farmerRecord.events[0].regroupEvidence;
  assert.equal(farmerEvidence.status, 'growing');
  assert.match(describeTeamRegroupDecision(farmerEvidence), /목표 모자.*확보 3\/5/);

  const completed = unfinished.map((member, index) => index === 0
    ? { ...member, _growthPlan: { ...member._growthPlan, openingComplete: true } } : member);
  let resumedLeaderChoices = 0;
  const resumed = buildTeamCoordination({ ...options, roster: completed, chooseLeaderMove: () => {
    resumedLeaderChoices += 1; return { targets: ['d'], reason: 'shared_goal' };
  } });
  assert.equal(resumedLeaderChoices, 1);
  for (const member of completed) {
    const plan = resumed.movementPlans.get(member._id);
    assert.equal(resumed.regroupDecisions.get(member._id).stage, 'together');
    assert.equal(plan.mode, 'team_rotate'); assert.equal(plan.targetZoneId, 'd');
    assert.equal(plan.sourceReason, 'shared_goal');
  }
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

check('a live threat keeps regroup off the dangerous route, then a cleared threat permits delayed reentry', () => {
  const detour = { ...graph, a: ['b', 'x'], e: ['d', 'x'], x: ['a', 'e'] };
  const retreating = { ...squad[0], _retreatAvoidZoneId: 'b', _retreatAvoidDecisions: 1 };
  const enemy = actor('enemy', 'b', { teamId: 'enemy', stats: { attackPower: 500, defense: 100 } });
  const threatenedRoster = [retreating, ...squad.slice(1), enemy];
  const threatened = move(retreating, threatenedRoster, { zoneGraph: detour });
  assert.equal(threatened.nextZoneId, 'x', 'The current enemy blocks the shorter route through b.');
  assert.equal(threatened.moveReason, 'team_regroup');
  assert.ok(![retreating.zoneId, threatened.nextZoneId].includes('b'));

  const cleared = { ...squad[0], _retreatAvoidZoneId: 'b', _retreatAvoidDecisions: 1 };
  const first = move(cleared, [cleared, ...squad.slice(1)]);
  assert.equal(first.nextZoneId, 'a'); assert.equal(first.actor._teamRegroup.status, 'reentry');
  const allowed = move(first.actor, [first.actor, ...squad.slice(1)]);
  assert.equal(allowed.nextZoneId, 'b', 'Once the threat is absent and the one-turn guard expires, regroup may resume.');
  assert.equal(allowed.actor._teamRegroup.status, 'joining');
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

check('ready teammates choose a reachable rendezvous instead of waiting forever at an unreachable majority', () => {
  const directed = { a: [], b: ['a'], c: ['b'] };
  const roster = [actor('lone', 'a'), actor('anchor', 'c', { teamSlot: 1 }), actor('friend', 'c', { teamSlot: 2 })];
  const plans = buildTeamCoordination({ ...options, roster, zoneGraph: directed });
  assert.equal(plans.regroupDecisions.get('lone').targetZoneId, 'a');
  assert.equal(plans.regroupDecisions.get('lone').stage, 'waiting');
  assert.equal(plans.movementPlans.get('anchor').nextStep, 'b');
  assert.equal(plans.movementPlans.get('friend').nextStep, 'b');
  assert.equal(plans.movementPlans.get('anchor').targetZoneId, 'a');
  assert.deepEqual(plans.regroupDecisions.get('anchor').rallySelection, {
    reason: 'reachable_rendezvous', previousZoneId: 'c', previousReachableCount: 2, reachableCount: 3,
  });
  const first = move(roster[1], roster, { zoneGraph: directed });
  assert.equal(first.nextZoneId, 'b');
  assert.equal(first.actor._teamRegroup.status, 'joining');
  const midway = [roster[0], first.actor, { ...roster[2], zoneId: 'b' }];
  const arrived = move(first.actor, midway, { zoneGraph: directed });
  assert.equal(arrived.nextZoneId, 'a');
  assert.equal(arrived.actor._teamRegroup.status, 'arrived');
});

check('rendezvous reachability preserves hazards, direction, unfinished recipes and input order', () => {
  const directed = { a: [], b: ['a'], c: ['b'] };
  const ready = [actor('lone', 'a'), actor('anchor', 'c', { teamSlot: 1 }), actor('friend', 'c', { teamSlot: 2 })];
  const normalize = result => [...result.regroupDecisions].sort(([a], [b]) => a.localeCompare(b));
  const before = structuredClone(ready);
  const safe = buildTeamCoordination({ ...options, roster: ready, zoneGraph: directed });
  assert.deepEqual(normalize(safe), normalize(buildTeamCoordination({ ...options, roster: [...ready].reverse(), zoneGraph: directed })));
  for (const setup of [
    { roster: [...ready, actor('enemy', 'b', { teamId: 'enemy' })] },
    { forbiddenIds: new Set(['b']) },
    { zoneGraph: { a: [], b: [], c: ['b'] } },
  ]) {
    const result = buildTeamCoordination({ ...options, roster: ready, zoneGraph: directed, ...setup });
    assert.equal(result.regroupDecisions.get('lone').targetZoneId, 'c');
    assert.equal(result.regroupDecisions.get('lone').stage, 'path_blocked');
    assert.equal(result.regroupDecisions.get('lone').rallySelection, undefined);
  }
  const farmers = ready.map((row, index) => index ? { ...row, _growthPlan: { openingComplete: false, targetId: 'real-recipe' } } : row);
  const growing = buildTeamCoordination({ ...options, roster: farmers, zoneGraph: directed });
  assert.equal(growing.regroupDecisions.get('lone').targetZoneId, 'c');
  assert.equal(growing.movementPlans.has('anchor'), false);
  assert.deepEqual(ready, before);
});

check('a reachable rendezvous retains decision-time counts and owned observation data', () => {
  const directed = { a: [], b: ['a'], c: ['b'] };
  const roster = [actor('lone', 'a'), actor('anchor', 'c', { teamSlot: 1 }), actor('friend', 'c', { teamSlot: 2 })];
  const result = move(roster[1], roster, { zoneGraph: directed });
  const event = result.events.find(row => row.kind === 'team_regroup');
  const evidence = structuredClone(event.regroupEvidence);
  assert.match(describeTeamRegroupDecision(evidence), /합류 지점 재선정.*3\/3명.*2\/3명/);
  result.actor._teamRegroup.rallySelection.reachableCount = 99;
  assert.deepEqual(event.regroupEvidence, evidence);
  const model = buildTeamObserverModel({ survivors: [roster[0], result.actor, roster[2]], events: [event], teamId: 't', matchSec: 400 });
  assert.match(model.members.find(row => row.id === 'anchor').coordination.text, /합류 지점 재선정.*3\/3명.*2\/3명/);
});

check('ready allies can gather when no safe join route reaches their unfinished farmer', () => {
  const roster = [actor('farmer', 'e', { teamSlot: 1,
    _growthPlan: { openingComplete: false, targetId: 'real-recipe' } }),
  actor('anchor', 'a', { teamSlot: 2 }), actor('friend', 'b', { teamSlot: 3 })];
  const connected = { e: ['d'], d: ['e', 'a'], a: ['d', 'b'], b: ['a'] };
  for (const extra of [
    { zoneGraph: { e: [], a: ['b'], b: ['a'] } },
    { zoneGraph: connected, forbiddenIds: new Set(['d']) },
    { zoneGraph: connected, roster: [...roster, actor('enemy', 'd', { teamId: 'enemy' })] },
  ]) {
    const setup = { ...options, roster, ...extra }, before = structuredClone(setup.roster);
    const result = buildTeamCoordination(setup);
    assert.equal(result.regroupDecisions.get('anchor').targetZoneId, 'a');
    assert.equal(result.regroupDecisions.get('anchor').stage, 'waiting');
    assert.equal(result.movementPlans.get('friend').nextStep, 'a');
    assert.equal(result.regroupDecisions.get('farmer').stage, 'growing');
    assert.equal(result.movementPlans.has('farmer'), false);
    assert.deepEqual(result.regroupDecisions.get('friend').rallySelection, {
      reason: 'reachable_rendezvous', previousZoneId: 'e', previousReachableCount: 1, reachableCount: 2,
    });
    const reversed = buildTeamCoordination({ ...setup, roster: [...setup.roster].reverse() });
    assert.deepEqual(result.regroupDecisions, reversed.regroupDecisions);
    assert.deepEqual(setup.roster, before);
    const moved = move(roster[2], setup.roster, extra);
    assert.equal(moved.nextZoneId, 'a'); assert.equal(moved.actor._teamRegroup.status, 'arrived');
    assert.deepEqual(moved.actor.inventory, roster[2].inventory);
  }
});

check('an escortable farmer remains first and an unsafe or impossible alternative is not a new rally', () => {
  const roster = [actor('farmer', 'e', { teamSlot: 3,
    _growthPlan: { openingComplete: false, targetId: 'real-recipe' } }),
  actor('anchor', 'a', { teamSlot: 1 }), actor('friend', 'b', { teamSlot: 2 })];
  const connected = { e: ['d'], d: ['e', 'a'], a: ['d', 'b'], b: ['a'] };
  for (const extra of [
    { zoneGraph: connected },
    { zoneGraph: { e: [], a: [], b: [] } },
    { zoneGraph: { e: [], a: ['b'], b: ['a'] }, roster: [...roster,
      actor('enemy-a', 'a', { teamId: 'enemy' }), actor('enemy-b', 'b', { teamId: 'enemy' })] },
  ]) {
    const result = buildTeamCoordination({ ...options, roster, ...extra });
    assert.equal(result.regroupDecisions.get('anchor').targetZoneId, 'e');
    assert.equal(result.regroupDecisions.get('farmer').stage, 'growing');
    assert.equal(result.movementPlans.has('farmer'), false);
    assert.equal(result.regroupDecisions.get('anchor').rallySelection, undefined);
  }
});

check('unfinished growth keeps the real recipe while ready allies have a full-map escort route', () => {
  const items = unfinishedRecipeItems();
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

check('a co-located real-recipe farmer and ready ally keep growth waiting through actual movement decisions', () => {
  const items = [...unfinishedRecipeItems(),
    { _id: 'ready-weapon', name: '준비 무기', type: '무기', category: 'equipment', equipSlot: 'weapon', weaponType: '단검', tier: 4 },
    { _id: 'ready-clothes', name: '준비 옷', type: '방어구', category: 'equipment', equipSlot: 'clothes', tier: 4 },
    { _id: 'ready-arm', name: '준비 팔', type: '방어구', category: 'equipment', equipSlot: 'arm', tier: 4 },
    { _id: 'ready-shoes', name: '준비 신발', type: '방어구', category: 'equipment', equipSlot: 'shoes', tier: 4 },
  ];
  const farmer = actor('farmer', 'e', { routePlanTargetItemIds: ['hat'], simCredits: 137 });
  refreshActorGrowthPlan(farmer, items, world);
  assert.equal(farmer._growthPlan.targetId, 'hat'); assert.equal(farmer._growthPlan.targetName, '목표 모자');
  assert.equal(farmer._growthPlan.completedSlots, 0); assert.equal(farmer._growthPlan.totalSlots, 1);
  assert.deepEqual(farmer._growthPlan.missing.map(({ itemId, need }) => ({ itemId, need })), [{ itemId: 'raw', need: 1 }]);
  const readyGearIds = ['ready-weapon', 'hat', 'ready-clothes', 'ready-arm', 'ready-shoes'];
  const ready = actor('ready', 'e', { teamSlot: 1, simCredits: 211, weaponType: '단검',
    routePlanTargetItemIds: readyGearIds, equipped: Object.fromEntries([
      ['weapon', 'ready-weapon'], ['head', 'hat'], ['clothes', 'ready-clothes'], ['arm', 'ready-arm'], ['shoes', 'ready-shoes'],
    ]), inventory: readyGearIds.map((id) => ({ ...items.find((item) => item._id === id), itemId: id })) });
  refreshActorGrowthPlan(ready, items, world);
  assert.equal(ready._growthPlan.openingComplete, true);
  const roster = [farmer, ready], before = structuredClone(roster);
  const randomTape = [0.125, 0.875, 0.25, 0.75, 0.375, 0.625, 0.5, 0.0625];
  const withDrawTrace = (run) => {
    const draws = [];
    const result = withSimulationRandom(() => {
      const value = randomTape[draws.length % randomTape.length]; draws.push(value);
      return value;
    }, run);
    return { draws, result };
  };
  const teamFarmerRun = withDrawTrace(() => move(farmer, roster, { publicItems: items }));
  const readyRun = withDrawTrace(() => move(ready, roster, { publicItems: items }));
  const readyObservationControl = withDrawTrace(() => move(ready, roster, { publicItems: items, omitRegroupObservation: true }));
  const soloFarmer = structuredClone(farmer);
  const soloFarmerRun = withDrawTrace(() => move(soloFarmer, [soloFarmer], { publicItems: items }));
  assert.deepEqual(readyRun.result.teamMovementPlan, readyObservationControl.result.teamMovementPlan,
    'Omitting only the regroup observation must preserve the same committed movement plan.');
  assert.deepEqual(readyRun.draws, readyObservationControl.draws,
    'Growth-wait observation must add no RNG beyond the same committed movement plan.');
  assert.equal(readyRun.draws.length, 0, 'A ready actor following a committed regroup step must bypass ordinary movement RNG.');
  assert.ok(teamFarmerRun.draws.length > 0, 'The active growth actor retains the ordinary individual target-memory decisions.');
  assert.deepEqual(teamFarmerRun.draws, soloFarmerRun.draws,
    'Co-location must add no random draws to the farmer relative to the same non-regroup growth control.');
  const movementSnapshot = (result) => ({ nextZoneId: result.nextZoneId, didMove: result.didMove,
    moveReason: result.moveReason, moveTargets: result.moveTargets, moveEtaSec: result.moveEtaSec,
    zoneId: result.actor.zoneId, inventory: result.actor.inventory, simCredits: result.actor.simCredits,
    growthPlan: result.actor._growthPlan, routePlanTargetItemIds: result.actor.routePlanTargetItemIds });
  assert.deepEqual(movementSnapshot(teamFarmerRun.result), movementSnapshot(soloFarmerRun.result),
    'Ignore regroup observation, and compare actual growth movement/state against the no-regroup control.');
  const farmerResult = teamFarmerRun.result, readyResult = readyRun.result;
  assert.equal(farmerResult.nextZoneId, 'e'); assert.equal(farmerResult.didMove, false);
  assert.equal(farmerResult.moveReason, 'growth_farm'); assert.equal(farmerResult.actor._teamRegroup.status, 'growing');
  assert.equal(readyResult.nextZoneId, 'e'); assert.equal(readyResult.didMove, false);
  assert.equal(readyResult.actor._growthPlan.openingComplete, true);
  assert.equal(readyResult.moveReason, 'team_regroup'); assert.equal(readyResult.actor._teamRegroup.status, 'growth_wait');
  assert.deepEqual(readyResult.actor._teamRegroup.waitingFor, [{ who: 'farmer', name: 'farmer', targetName: '목표 모자',
    completedSlots: 0, totalSlots: 1 }]);
  for (const result of [farmerResult, readyResult]) {
    assert.deepEqual(result.actor.inventory.map(({ itemId, qty }) => [itemId, qty]),
      result.actor._id === 'farmer' ? [] : readyGearIds.map((id) => [id, 1]));
    assert.equal(result.actor.simCredits, result.actor._id === 'farmer' ? 137 : 211);
    assert.equal(result.actor.zoneId, 'e'); assert.equal(result.moveEtaSec, 1, 'A no-op keeps the movement phase one-second baseline without reserving travel time.');
    assert.equal(result.events.some((event) => ['move', 'field_resource', 'craft'].includes(event.kind)), false);
  }
  assert.deepEqual(roster, before, 'Both movement decisions must leave the shared pre-action fixture untouched.');
});

check('a depleted direct growth goal releases the ready squad to regroup, then resumes safely when stock returns', () => {
  const items = [...unfinishedRecipeItems().map((item) => item._id === 'hat' ? { ...item, itemKey: 'direct-hat', tier: 4 } : item),
    { _id: 'ready-weapon', name: '준비 무기', type: '무기', category: 'equipment', equipSlot: 'weapon', weaponType: '단검', tier: 4 },
    { _id: 'ready-clothes', name: '준비 옷', type: '방어구', category: 'equipment', equipSlot: 'clothes', tier: 4 },
    { _id: 'ready-arm', name: '준비 팔', type: '방어구', category: 'equipment', equipSlot: 'arm', tier: 4 },
    { _id: 'ready-shoes', name: '준비 신발', type: '방어구', category: 'equipment', equipSlot: 'shoes', tier: 4 },
  ];
  const mapObj = { zones: world.mapObj.zones, fieldResourceStock: { e: { raw: 1 } } };
  const fieldResources = createFieldResources(mapObj, items, ruleset);
  const nextSpawn = { fieldResources };
  const state = { mapObj, zoneGraph: graph, forbiddenIds: new Set(), ruleset, nextSpawn };
  let farmer = actor('direct-farmer', 'e', { routePlanTargetItemIds: ['hat'],
    goalLoadouts: { hero: { headKey: 'direct-hat' } }, simCredits: 50 });
  const readyGearIds = ['ready-weapon', 'hat', 'ready-clothes', 'ready-arm', 'ready-shoes'];
  const makeReady = (id, zoneId, teamSlot, simCredits) => actor(id, zoneId, { teamSlot, simCredits, weaponType: '단검',
    routePlanTargetItemIds: readyGearIds, equipped: Object.fromEntries([
      ['weapon', 'ready-weapon'], ['head', 'hat'], ['clothes', 'ready-clothes'], ['arm', 'ready-arm'], ['shoes', 'ready-shoes'],
    ]), inventory: readyGearIds.map((itemId) => ({ ...items.find((item) => item._id === itemId), itemId, qty: 1 })) });
  const readyA = makeReady('ready-a', 'a', 1, 70);
  let readyB = makeReady('ready-b', 'b', 2, 80);
  let roster = [farmer, readyA, readyB];
  const refresh = () => {
    for (const member of roster) refreshActorGrowthPlan(member, items, { ...state, fieldResources });
  };
  const runMove = (member, extra = {}) => move(member, roster, { ...state, publicItems: items, ...extra });
  const noRewards = (result, before) => {
    assert.deepEqual(result.actor.inventory, before.inventory,
      `${result.actor._id} must not receive remote or unearned items.`);
    assert.equal(result.actor.simCredits, before.simCredits, `${result.actor._id} must not receive team funds.`);
    assert.equal(result.events.some((event) => ['gain', 'field_resource', 'craft', 'procurement'].includes(event.kind)), false,
      'Coordination and movement must not award, collect, craft or buy anything.');
  };

  refresh();
  assert.equal(readyA._growthPlan.openingComplete, true);
  assert.equal(readyB._growthPlan.openingComplete, true);
  assert.equal(farmer._growthPlan.targetId, 'hat');
  assert.equal(farmer._growthPlan.openingComplete, false);
  assert.equal(farmer._growthPlan.blocked, '');
  assert.equal(fieldResources.byZone.e.raw.remaining, 1);
  const escorting = buildTeamCoordination({ ...options, roster, zoneGraph: graph, spawnState: nextSpawn,
    ruleset, publicItems: items, mapObj, forbiddenIds: state.forbiddenIds });
  assert.equal(escorting.movementPlans.get('ready-a').targetZoneId, 'e',
    'A reachable, unfinished direct-goal farmer remains the escort target while its finite source is available.');

  // A competing actor's accepted pickup exhausts the one finite field unit
  // before this team's next fresh planning pass; the callback deliberately
  // does not credit any roster member or simulate a natural supply event.
  assert.equal(collectFieldResourceLoot(fieldResources,
    { zoneId: 'e', itemId: 'raw', item: items.find((item) => item._id === 'raw'), qty: 1 }, (qty) => qty), 1);
  assert.equal(fieldResources.byZone.e.raw.remaining, 0);
  assert.equal(fieldResources.byZone.e.raw.taken, 1);
  refresh();
  assert.equal(farmer.goalLoadouts.hero.headKey, 'direct-hat');
  assert.equal(farmer._growthPlan.targetId, 'hat');
  assert.equal(farmer._growthPlan.openingComplete, false);
  assert.equal(farmer._growthPlan.blocked, 'no_material_source',
    'Stock depletion by itself must be identified before adding the forbidden-zone constraint.');
  assert.deepEqual(farmer._growthPlan.goalIssues, [], 'A valid authored direct target must not become a malformed-goal warning when stock runs out.');
  state.forbiddenIds = new Set(['e']);
  refresh();
  assert.equal(farmer.goalLoadouts.hero.headKey, 'direct-hat');
  assert.equal(farmer._growthPlan.openingComplete, false);
  assert.ok(farmer._growthPlan.blocked, 'The depleted/forbidden recipe must not remain falsely farmable.');
  const beforeEscape = { inventory: structuredClone(farmer.inventory), simCredits: farmer.simCredits };
  const escape = runMove(farmer);
  assert.equal(escape.actor.zoneId, 'd', 'Forbidden-area escape overrides the blocked direct recipe.');
  assert.equal(escape.actor._growthPlan.targetId, farmer._growthPlan.targetId);
  noRewards(escape, beforeEscape);
  farmer = escape.actor;
  roster = roster.map((member) => member._id === farmer._id ? escape.actor : member);

  // The source remains depleted and is now disconnected. Fresh coordination
  // must not send the ready pair back to it or freeze them at a stale rally.
  state.forbiddenIds = new Set();
  state.zoneGraph = { a: ['b'], b: ['a', 'c'], c: ['b', 'd'], d: ['c'], e: [] };
  refresh();
  assert.equal(farmer._growthPlan.blocked !== '', true);
  const disconnected = buildTeamCoordination({ ...options, roster, zoneGraph: state.zoneGraph,
    spawnState: nextSpawn, ruleset, publicItems: items, mapObj, forbiddenIds: state.forbiddenIds });
  assert.equal(disconnected.regroupDecisions.get('direct-farmer').targetZoneId, 'a');
  assert.equal(disconnected.regroupDecisions.get('direct-farmer').stage, 'joining');
  assert.equal(disconnected.movementPlans.get('ready-b').nextStep, 'a',
    'A ready teammate at b must receive an adjacent regroup step toward its teammate already at a.');
  const beforeReadyJoin = { inventory: structuredClone(readyB.inventory), simCredits: readyB.simCredits };
  const readyJoin = runMove(readyB);
  assert.equal(readyJoin.nextZoneId, 'a');
  assert.equal(readyJoin.moveReason, 'team_regroup');
  noRewards(readyJoin, beforeReadyJoin);
  readyB = readyJoin.actor;
  roster = roster.map((member) => member._id === readyB._id ? readyB : member);
  const beforeJoin = { inventory: structuredClone(farmer.inventory), simCredits: farmer.simCredits };
  const join = runMove(farmer);
  assert.equal(join.nextZoneId, 'c', `The blocked farmer rejoins the reachable ready pair instead of following the unavailable source: ${JSON.stringify({
    from: join.currentZone, nextZoneId: join.nextZoneId, moveReason: join.moveReason,
    decision: disconnected.regroupDecisions.get('direct-farmer'), teamMovementPlan: join.teamMovementPlan,
    growthTarget: join.actor._growthPlan?.targetId, growthBlocked: join.actor._growthPlan?.blocked,
  })}`);
  assert.equal(join.moveReason, 'team_regroup');
  noRewards(join, beforeJoin);
  farmer = join.actor;
  roster = roster.map((member) => member._id === farmer._id ? join.actor : member);

  // Restore the graph edge and re-seed one stock unit in this controlled test
  // fixture; natural stock regeneration is neither implemented nor verified
  // here. The same authored key must resume; teammates cannot receive the
  // ingredient or craft result on its behalf.
  state.zoneGraph = graph;
  fieldResources.byZone.e.raw.remaining = 1;
  fieldResources.byZone.e.raw.taken = 0;
  refresh();
  assert.equal(farmer.goalLoadouts.hero.headKey, 'direct-hat');
  assert.equal(farmer._growthPlan.targetId, 'hat');
  assert.equal(farmer._growthPlan.openingComplete, false);
  assert.equal(farmer._growthPlan.blocked, '');
  assert.equal(farmer._growthPlan.targetZoneId, 'e');
  const resumed = buildTeamCoordination({ ...options, roster, zoneGraph: graph, spawnState: nextSpawn,
    ruleset, publicItems: items, mapObj, forbiddenIds: state.forbiddenIds });
  assert.equal(resumed.regroupDecisions.get('direct-farmer').stage, 'growing');
  assert.equal(resumed.regroupDecisions.get('ready-a').targetZoneId, 'c',
    'The ready squad can resume escorting the direct goal from the farmer’s fresh reachable zone.');
  const beforeResume = { inventory: structuredClone(farmer.inventory), simCredits: farmer.simCredits };
  const resume = runMove(farmer);
  assert.equal(resume.moveReason, 'growth_farm');
  assert.equal(resume.nextZoneId, 'd');
  assert.equal(resume.actor._growthPlan.targetId, 'hat');
  noRewards(resume, beforeResume);
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

check('action_wait publishes growth-wait transitions from every prior same-route status', () => {
  const waitingFor = [{ who: 'farmer', name: '농부', targetName: '목표 모자', completedSlots: 4, totalSlots: 5 }];
  const transitions = [
    { previous: 'growing', from: 'e', to: 'e', growthPlan: { openingComplete: false, targetId: 'old-goal',
      targetName: '완료된 과거 목표', completedSlots: 4, totalSlots: 5, missing: [{ itemId: 'old-material', name: '과거 재료', need: 1 }] } },
    { previous: 'joining', from: 'c', to: 'd' },
    { previous: 'arrived', from: 'd', to: 'e' },
    { previous: 'waiting', from: 'd', to: 'd' },
  ];
  const stale = [];
  for (const [index, transition] of transitions.entries()) {
    const member = actor(`ready-${transition.previous}`, 'e');
    if (transition.growthPlan) member._growthPlan = transition.growthPlan;
    const rec = record(), targetZoneId = 'e';
    const previousPlan = { teamId: 't', stage: transition.previous === 'growing' ? 'growing' : 'joining',
      memberCount: 2, targetZoneId, atTargetCount: 2, distance: 1 };
    publishTeamRegroupDecision(member, previousPlan, { ...rec.actions, reason: 'team_regroup',
      from: transition.from, to: transition.to, growthPlan: transition.growthPlan, at: { sec: 410 + index } });
    const previousEvidence = structuredClone(member._teamRegroup);
    const nextPlan = { teamId: 't', stage: 'growth_wait', memberCount: 2, targetZoneId,
      atTargetCount: 2, distance: 0, waitingFor };
    publishTeamRegroupDecision(member, nextPlan, { ...rec.actions, reason: 'team_regroup', status: 'action_wait',
      from: transition.from, to: transition.to, growthPlan: { openingComplete: true }, at: { sec: 420 + index } });
    const evidence = member._teamRegroup, description = describeTeamRegroupDecision(evidence, (id) => id);
    const defects = [];
    if (rec.events.length !== 2) defects.push(`events=${rec.events.length}`);
    if (evidence.status !== 'growth_wait') defects.push(`status=${evidence.status}`);
    if (evidence === previousEvidence || JSON.stringify(evidence) === JSON.stringify(previousEvidence)) defects.push('stale evidence retained');
    if (evidence.growth !== null) defects.push('old growth summary retained');
    if (JSON.stringify(evidence.waitingFor) !== JSON.stringify(waitingFor)) defects.push('waiting roster missing/old');
    if (!description.includes('농부') || !description.includes('4/5')) defects.push('ready ally progress not described');
    if (transition.previous === 'growing' && description.includes('완료된 과거 목표')) defects.push('completed growth text retained');
    if (defects.length) stale.push({ from: transition.previous, defects });
  }
  assert.deepEqual(stale, [], 'A new growth wait must replace stale same-route status and its explanation.');
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

check('rotation readiness is stable, names the actual blockers and makes no premature leader choice', () => {
  const roster = squad.map((row) => ({ ...structuredClone(row), zoneId: 'a' }));
  const before = structuredClone(roster);
  const plan = (rows) => buildTeamCoordination({ ...options, roster: rows,
    getRotationHold: (row) => row._id === 'friend' ? { reason: 'action_wait', readyAtSec: 410 } : null,
    chooseLeaderMove: () => { throw new Error('Do not choose or roll a new destination while the squad is waiting.'); } });
  const first = plan(roster), reverse = plan([...roster].reverse());
  assert.equal(first.movementPlans.size, 0);
  for (const row of roster) {
    const decision = first.regroupDecisions.get(row._id);
    assert.equal(decision.stage, 'rotation_wait');
    assert.deepEqual(decision.waitingFor, [{ who: 'friend', name: 'friend', reason: 'action_wait', readyAtSec: 410 }]);
    assert.deepEqual(decision, reverse.regroupDecisions.get(row._id));
  }
  assert.deepEqual(roster, before);
});

check('rotation waiting cannot override recovery, nearby enemies, unfinished farming, solo play or a dead ally', () => {
  const gathered = squad.map((row) => ({ ...structuredClone(row), zoneId: 'a' }));
  for (const extra of [
    { roster: gathered.map((row, i) => i === 1 ? { ...row, hp: 12 } : row) },
    { roster: [...gathered, actor('enemy', 'a', { teamId: 'enemy' })] },
    { roster: gathered.map((row, i) => i === 1 ? { ...row, _growthPlan: { openingComplete: false } } : row) },
    { isSoloMatch: true },
    { roster: gathered.map((row) => row._id === 'friend' ? { ...row, hp: 0 } : row) },
  ]) {
    const result = buildTeamCoordination({ ...options, roster: gathered, ruleset,
      getRotationHold: (row) => row._id === 'friend' ? { reason: 'hunt' } : null,
      chooseLeaderMove: () => ({ targets: ['b'], reason: 'next_goal' }), ...extra });
    assert.ok([...result.regroupDecisions.values()].every((decision) => decision.stage !== 'rotation_wait'));
  }
});

console.log(JSON.stringify({ pass: true, checks, scope: 'controlled team regroup paths; not original evaluator reproduction or balance acceptance' }));
