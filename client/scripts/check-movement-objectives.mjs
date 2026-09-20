import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';

const { captureMovementObjective: capture, getAvailableMovementObjective: available, isMovementObjectiveAvailable,
  describeMovementObjective: describe, publishMovementObjective: publish, movementObjectivesOverlap: overlaps } = await import('../src/app/simulation/_lib/movementObjectiveRuntime.js');
const { buildTeamMovementPlans } = await import('../src/app/simulation/_lib/teamTacticsRuntime.js');
const { resolveActorMoveTargetMemory } = await import('../src/app/simulation/_lib/actorMovementDecisionHelpers.js');
const { runActorMovementDecisionPhase } = await import('../src/app/simulation/_lib/phaseActorMovementRuntime.js');
const { buildTeamObserverModel, describeObserverEvent } = await import('../src/app/simulation/_lib/teamObserverRuntime.js');
const { clearRuntimeCombatFields, applyAiRecoveryWindow } = await import('../src/app/simulation/_lib/survivorLifecycleRuntime.js');
const { createSimulationFrame } = await import('../src/app/simulation/_lib/simulationFrameRuntime.js');

let checks = 0;
const check = (name, fn) => { fn(); checks += 1; console.log(`PASS ${name}`); };
const freeze = (value) => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };
const items = [{ _id: 'mithril', name: '미스릴' }, { _id: 'force', name: '포스 코어' }];
const world = () => ({ coreNodes: [
  { id: 'meteor-a', kind: 'meteor', zoneId: 'a', picked: false },
  { id: 'tree-c', kind: 'life_tree', zoneId: 'c', picked: false },
], bosses: { alpha: { alive: true, zoneId: 'c', spawnedDay: 2 } },
legendaryCrates: [{ id: 'legend-c', zoneId: 'c', opened: false }],
transcendCrates: [{ id: 'trans-c', zoneId: 'c', opened: false }],
dimensionRifts: [{ id: 'rift-c', zoneId: 'c', resolved: false, entryClosesAtSec: 300, maxTeams: 2, entrantTeamIds: [] }] });
const corePlan = { targets: ['c', 'a'], reason: '특수 재료 오브젝트', objectiveType: 'natural_core', objectiveSubkind: 'core', contestPressure: 0.5 };
const bossPlan = { targets: ['c'], reason: '알파', objectiveType: 'boss', objectiveSubkind: 'alpha' };
const coreGoal = () => capture(corePlan, 'c', { spawnState: world() });
const actor = (id, teamId = 'team:1', extra = {}) => ({ _id: id, name: id, teamId, zoneId: 'a', hp: 100, maxHp: 100,
  stats: { attackPower: 20, defense: 10 }, inventory: [], ...extra });
const graph = { a: ['b'], b: ['a', 'c'], c: ['b'] };
const ruleset = { ai: { recoverHpBelow: 38, fightAvoidMinRatio: 0.4, targetTtlMin: 2, targetTtlMax: 2 }, forbidden: { escapeMoveChance: 1 } };
const zoneName = (id) => ({ a: '학교', b: '성당', c: '병원' })[id] || id;
const model = (survivors, extra = {}) => buildTeamObserverModel({ survivors, spawnState: world(), teamId: 'team:1', matchSec: 220, zoneName, ...extra });
const goalActor = (id, teamId = 'team:1', extra = {}) => actor(id, teamId, { _movementObjective: { ...coreGoal(), atSec: 200, shared: true }, ...extra });

check('generic core captures the chosen final zone and actual tree, not another candidate meteor', () => {
  assert.deepEqual(coreGoal(), { type: 'natural_core', subkind: 'core', targetZoneId: 'c', sourceIds: ['tree-c'], resourceKinds: ['life_tree'] });
  assert.equal(describe(coreGoal()), '생명의 나무 확보');
  assert.equal(capture({ ...corePlan, objectiveSubkind: 'meteor' }, 'c', { spawnState: world() }), null);
});
check('boss reward intention uses configured drops and actual catalog, never presumed loot', () => {
  assert.equal(describe(capture(bossPlan, 'c', { spawnState: world(), publicItems: items })), '알파 공략 · 미스릴 노림');
  assert.equal(describe(capture(bossPlan, 'c', { spawnState: world(), publicItems: [] })), '알파 공략');
  const custom = { worldSpawns: { specialResourceDrops: { alpha: [{ key: 'force_core', chance: 0.2 }, { key: 'mithril', chance: 0 }] } } };
  assert.equal(describe(capture(bossPlan, 'c', { spawnState: world(), ruleset: custom, publicItems: items })), '알파 공략 · 포스 코어 노림');
});
check('opened, killed, consumed, missing and unknown sources cannot be captured as live objectives', () => {
  const spawnState = world(); spawnState.coreNodes[1].picked = true; spawnState.bosses.alpha.alive = false;
  spawnState.legendaryCrates[0].opened = true;
  for (const plan of [corePlan, bossPlan, { objectiveType: 'legendary_crate' }, { objectiveType: 'unknown' }]) assert.equal(capture(plan, 'c', { spawnState }), null);
  assert.equal(capture(corePlan, 'c'), null);
});
check('a later spawn at the same zone cannot resurrect an expired source decision', () => {
  const goal = coreGoal(); const spawnState = world(); spawnState.coreNodes[1].picked = true;
  spawnState.coreNodes.push({ id: 'new-tree', kind: 'life_tree', zoneId: 'c', picked: false });
  assert.equal(available(goal, { spawnState }), null);
  const boss = capture(bossPlan, 'c', { spawnState }); spawnState.bosses.alpha.spawnedDay = 4;
  assert.equal(available(boss, { spawnState }), null);
});
check('partly consumed sources lose their stale resource label and contested identity', () => {
  const spawnState = world(); spawnState.coreNodes.push({ id: 'meteor-c', kind: 'meteor', zoneId: 'c', picked: false });
  const goal = capture(corePlan, 'c', { spawnState }); const before = structuredClone(goal);
  spawnState.coreNodes[1].picked = true;
  const current = available(goal, { spawnState });
  assert.equal(describe(current), '운석 확보'); assert.deepEqual(current.sourceIds, ['meteor-c']);
  assert.equal(overlaps(current, coreGoal()), false); assert.deepEqual(goal, before);
});
check('forbidden destinations hide current goals at the same frame boundary', () => {
  assert.equal(available(coreGoal(), { spawnState: world(), forbiddenIds: new Set(['c']) }), null);
  assert.equal(available(coreGoal(), { spawnState: world(), forbiddenIds: ['c'] }), null);
});
check('both crate classes are concrete goals only until that exact crate is opened', () => {
  for (const [type, field, label] of [['legendary_crate', 'legendaryCrates', '전설 상자 확보'], ['transcend_crate', 'transcendCrates', '초월 장비 선택 상자 확보']]) {
    const spawnState = world(); const goal = capture({ objectiveType: type }, 'c', { spawnState });
    assert.equal(describe(goal), label); assert.equal(isMovementObjectiveAvailable(goal, { spawnState }), true);
    spawnState[field][0].opened = true; assert.equal(available(goal, { spawnState }), null);
  }
});
check('rift entry deadline, capacity, membership and resolution invalidate intentions correctly', () => {
  const spawnState = world(); const goal = capture({ objectiveType: 'dimension_rift' }, 'c', { spawnState });
  assert.ok(available(goal, { spawnState, nowSec: 299, teamId: 'team:1' }));
  assert.equal(available(goal, { spawnState, nowSec: 300 }), null);
  spawnState.dimensionRifts[0].entrantTeamIds = ['team:2', 'team:3'];
  assert.equal(available(goal, { spawnState, nowSec: 299, teamId: 'team:1' }), null);
  assert.ok(available(goal, { spawnState, nowSec: 299, teamId: 'team:2' }));
  assert.equal(available(goal, { spawnState, nowSec: 299, teamId: 'team:2', actor: { _lastDimensionRiftExit: { riftId: 'rift-c' } } }), null);
  spawnState.dimensionRifts[0].resolved = true; assert.equal(available(goal, { spawnState, nowSec: 299, teamId: 'team:2' }), null);
});
check('capture and presentation are read-only and consume no randomness', () => {
  const spawnState = freeze(world()); const plan = freeze(structuredClone(bossPlan)); const before = JSON.stringify(spawnState);
  const original = Math.random;
  try { Math.random = () => { throw new Error('observer consumed randomness'); };
    const goal = freeze(capture(plan, 'c', { spawnState, publicItems: freeze(items) }));
    assert.ok(available(goal, { spawnState })); assert.ok(describe(goal));
    assert.equal(model(freeze([goalActor('a'), goalActor('b', 'team:2')]), { spawnState }).objectives.length, 1);
  } finally { Math.random = original; }
  assert.equal(JSON.stringify(spawnState), before);
});
check('publishing logs a new goal once, keeps owned snapshots, and records cancellation separately', () => {
  const who = actor('a'); const goal = coreGoal(); const events = []; const logs = [];
  const emitRunEvent = (kind, payload, at) => events.push({ kind, ...payload, at });
  const options = { emitRunEvent, addLog: (text) => logs.push(text), zoneName, teamId: 'team:1', shared: true };
  publish(who, goal, { ...options, at: { sec: 200 } }); publish(who, goal, { ...options, at: { sec: 201 } });
  assert.equal(events.length, 1); assert.equal(logs.length, 1); assert.match(logs[0], /생명의 나무 확보 · 병원.*아직 획득 전/);
  goal.sourceIds.push('unrelated'); assert.deepEqual(who._movementObjective.sourceIds, ['tree-c']);
  publish(who, null, { ...options, at: { sec: 202 } }); publish(who, null, { ...options, at: { sec: 203 } });
  assert.equal(events.length, 2); assert.equal(events[1].objective, null); assert.equal(events[1].previousObjective.targetZoneId, 'c');
  assert.equal(events[0].objective.atSec, 200); assert.equal(who._movementObjective, null);
});
check('observer counts teams targeting the same live source, not all inhabitants of the region', () => {
  const roster = [goalActor('a'), goalActor('b'), goalActor('e1', 'team:2'), goalActor('e2', 'team:2'),
    actor('resident', 'team:3', { zoneId: 'c' }), goalActor('dead', 'team:4', { hp: 0 }),
    goalActor('future', 'team:5', { _movementObjective: { ...coreGoal(), atSec: 221 } }),
    goalActor('inside', 'team:6', { _combatSpaceId: 'dimension_rift:other', _dimensionRiftEntry: { riftId: 'other', enteredAtSec: 190 } }),
    goalActor('invalid-space-entry', 'team:7', { _combatSpaceId: 'dimension_rift:other' })];
  const current = model(roster); assert.equal(current.objectives.length, 1);
  assert.deepEqual(current.objectives[0].members, ['a', 'b']); assert.equal(current.objectives[0].competingTeams, 1);
  assert.equal(current.objectives[0].zone, '병원'); assert.equal(current.objectives[0].label, '생명의 나무 확보');
});
check('current goals vanish on world changes, while dated goal and acquisition history remains', () => {
  const spawnState = world(); spawnState.coreNodes[1].picked = true;
  const events = [{ kind: 'movement_goal', who: 'a', objective: { ...coreGoal(), shared: true }, at: { sec: 200 } },
    { kind: 'objective', who: 'a', objective: 'natural_core', itemName: '생명의 나무', success: true, qty: 1, zoneId: 'c', at: { sec: 201 } }];
  const current = model([goalActor('a')], { spawnState, events });
  assert.equal(current.objectives.length, 0); assert.equal(current.recent.length, 2);
  assert.match(current.recent[0].text, /1개 획득/); assert.match(current.recent[1].text, /아직 획득 전/);
});
check('old, missing or malformed goal snapshots do not create phantom objectives', () => {
  for (const value of [undefined, null, {}, { ...coreGoal(), atSec: NaN }, { ...coreGoal(), atSec: 200, sourceIds: null }])
    assert.equal(model([actor('a', 'team:1', { _movementObjective: value })]).objectives.length, 0);
  assert.equal(model([goalActor('a')], { spawnState: undefined }).objectives.length, 0);
  assert.equal(model([goalActor('a')], { isGameOver: true }).objectives.length, 0);
});
check('boss defeat and failed pickups are not misrepresented as obtained rare material', () => {
  assert.match(describeObserverEvent({ kind: 'objective', who: 'a', objective: 'boss', subkind: 'alpha', success: true }), /알파 공략 · 처치 완료/);
  assert.doesNotMatch(describeObserverEvent({ kind: 'objective', who: 'a', objective: 'boss', subkind: 'alpha', success: true }), /미스릴|획득/);
  assert.match(describeObserverEvent({ kind: 'objective', who: 'a', objective: 'natural_core', itemName: '생명의 나무', qty: 1, success: false }), /획득 실패/);
});
check('current goals survive frame and JSON serialization without reference aliasing', () => {
  const who = goalActor('a'); const spawnState = world();
  const frame = createSimulationFrame({ day: 2, phase: 'night', matchSec: 220, survivors: [who], spawnState });
  const restored = JSON.parse(JSON.stringify(frame));
  who._movementObjective.sourceIds.length = 0; spawnState.coreNodes[1].picked = true;
  assert.equal(model(restored.survivors, { spawnState: restored.spawnState }).objectives[0].label, '생명의 나무 확보');
});

const originalRandom = Math.random;
try {
  Math.random = () => 0;
  const remember = (who, aiMove, extra = {}) => resolveActorMoveTargetMemory({ state: { actor: who, aiMove, currentZone: 'a',
    day: 3, phase: 'night', ruleset, spawnState: world(), publicItems: items, nowSec: 200, ...extra } });
  check('held destination keeps its own reason and concrete metadata despite a different proposed plan', () => {
    const first = remember(actor('a'), corePlan); const held = remember(first.actor, { ...bossPlan, targets: ['b'] });
    assert.equal(held.holdTarget, 'c'); assert.equal(held.moveReason, '특수 재료 오브젝트:ttl');
    assert.equal(held.moveObjectiveType, 'natural_core'); assert.deepEqual(held.moveObjective.sourceIds, ['tree-c']);
  });
  check('held non-objective movement cannot borrow a new boss label or pressure', () => {
    const first = remember(actor('a'), { targets: ['b'], reason: 'wander' }); const held = remember(first.actor, { ...bossPlan, contestPressure: 0.8 });
    assert.equal(held.holdTarget, 'b'); assert.equal(held.moveReason, 'wander:ttl');
    assert.equal(held.moveObjectiveType, ''); assert.equal(held.moveObjectiveSubkind, ''); assert.equal(held.moveContestPressure, 0); assert.equal(held.moveObjective, null);
  });
  check('consumed or forbidden sources invalidate target memory before TTL expires', () => {
    for (const kind of ['picked', 'forbidden']) {
      const first = remember(actor('a'), corePlan); const spawnState = world(); if (kind === 'picked') spawnState.coreNodes[1].picked = true;
      const next = remember(first.actor, { targets: ['b'], reason: 'wander' }, { spawnState, forbiddenIds: new Set(kind === 'forbidden' ? ['c'] : []) });
      assert.equal(next.holdTarget, 'b'); assert.equal(next.moveObjective, null); assert.equal(next.moveObjectiveType, '');
    }
  });
  const squad = [actor('a'), actor('b'), actor('c')];
  const plans = () => buildTeamMovementPlans({ roster: squad, zoneGraph: graph, day: 3, phase: 'night',
    spawnState: world(), ruleset, publicItems: items, chooseLeaderMove: () => corePlan });
  const move = (who, extra = {}, roster = squad) => {
    const events = [];
    const result = runActorMovementDecisionPhase({ state: { actor: structuredClone(who), phaseSurvivors: structuredClone(roster),
      craftables: [], itemKeyById: {}, itemMetaById: {}, itemNameById: {}, kiosks: [],
      mapObj: { zones: Object.keys(graph).map((zoneId) => ({ zoneId })) }, nextDay: 3, nextPhase: 'night', phaseIdxNow: 5,
      ruleset, zoneGraph: graph, zones: Object.keys(graph).map((zoneId) => ({ zoneId })), nextSpawn: world(), ...extra },
    actions: { atNow: () => ({ sec: 200, day: 3, phase: 'night' }), getZoneName: zoneName,
      emitRunEvent: (kind, payload, at) => events.push({ kind, ...payload, at }) } });
    return { ...result, events };
  };
  check('shared leader decision reaches all members, with final destination distinct from intermediate movement', () => {
    const shared = plans(); assert.equal(shared.size, 3);
    for (const who of squad) {
      const plan = shared.get(who._id); assert.equal(plan.nextStep, 'b'); assert.equal(plan.targetZoneId, 'c');
      const result = move(who, { teamMovementPlan: plan });
      assert.equal(result.nextZoneId, 'b'); assert.equal(result.actor._movementObjective.targetZoneId, 'c');
      assert.equal(result.actor._movementObjective.shared, true);
      const moveEvent = result.events.find((event) => event.kind === 'move');
      assert.equal(moveEvent.targetZoneId, 'c'); assert.match(describeObserverEvent(moveEvent, { zoneName }), /목적지 병원/);
      assert.match(describeObserverEvent(result.events.find((event) => event.kind === 'team_decision'), { zoneName }), /생명의 나무 확보/);
    }
  });
  check('source consumed after team planning cannot be published as the old active goal', () => {
    const spawnState = world(); spawnState.coreNodes.forEach((node) => { node.picked = true; });
    const result = move(goalActor('a'), { teamMovementPlan: plans().get('a'), nextSpawn: spawnState });
    assert.ok(!result.actor._movementObjective || !result.actor._movementObjective.sourceIds.includes('tree-c'));
    assert.equal(result.events.find((event) => event.kind === 'movement_goal' && event.objective?.sourceIds.includes('tree-c')), undefined);
  });
  check('the actual movement log prunes a partly consumed shared resource goal', () => {
    const spawnState = world(); spawnState.coreNodes.push({ id: 'meteor-c', kind: 'meteor', zoneId: 'c', picked: false });
    const objective = capture(corePlan, 'c', { spawnState }); spawnState.coreNodes[1].picked = true;
    const result = move(goalActor('a'), { teamMovementPlan: { ...plans().get('a'), objective }, nextSpawn: spawnState });
    assert.equal(describe(result.actor._movementObjective), '운석 확보');
    assert.doesNotMatch(describeObserverEvent(result.events.find((event) => event.kind === 'move')), /생명의 나무/);
  });
  check('recovery, regrouping, forbidden escape and final-zone rotation cancel the previous resource goal', () => {
    for (const [who, extra] of [
      [goalActor('a', 'team:1', { hp: 20 }), { teamMovementPlan: plans().get('a') }],
      [goalActor('a'), { teamMovementPlan: { mode: 'team_regroup', nextStep: 'b', targetZoneId: 'b', leaderId: 'b' } }],
      [goalActor('a'), { forbiddenIds: new Set(['a']), teamMovementPlan: plans().get('a') }],
      [goalActor('a'), { nextSpawn: { ...world(), endgame: { zoneIds: ['a', 'b', 'c'], finalZoneId: 'c', singleZoneAtSec: 0, stage: 'final' } }, teamMovementPlan: plans().get('a') }],
    ]) {
      const result = move(who, extra); assert.equal(result.actor._movementObjective, null);
      assert.equal(result.events.find((event) => event.kind === 'movement_goal')?.objective, null);
    }
  });
  check('outnumbered retreat clears the old resource goal rather than claiming pursuit', () => {
    const who = goalActor('a'); const roster = [who, ...[1, 2, 3].map((n) => actor(`enemy${n}`, 'team:2'))];
    const result = move(who, { teamMovementPlan: plans().get('a') }, roster);
    assert.equal(result.fleeInterruptReason, 'team_outnumbered'); assert.equal(result.actor._movementObjective, null);
  });
} finally { Math.random = originalRandom; }

check('death/revival cleanup and PvP recovery remove pre-interruption goals and target metadata', () => {
  for (const clear of [clearRuntimeCombatFields, (who) => applyAiRecoveryWindow(who, 200, { recoverSec: 8, retargetZoneId: 'b', retargetTtl: 1, reason: 'avoid_power' })]) {
    const who = goalActor('a', 'team:1', { aiTargetObjective: coreGoal(), aiTargetObjectiveType: 'natural_core', aiTargetObjectiveSubkind: 'core', aiTargetContestPressure: 0.5 });
    clear(who); assert.equal(who._movementObjective, null); assert.equal(who.aiTargetObjective, null);
    assert.equal(who.aiTargetObjectiveType, ''); assert.equal(who.aiTargetContestPressure, 0);
  }
});
console.log(JSON.stringify({ checks, pass: true, scope: 'HF2 concrete source planning, same-frame observer validity, lifecycle and actual movement integration; not human readability approval' }));
