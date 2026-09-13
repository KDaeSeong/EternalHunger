import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';

const { assessTeamCombat, pickTeamSafeZone, buildTeamMovementPlans } = await import('../src/app/simulation/_lib/teamTacticsRuntime.js');
const { runActorMovementDecisionPhase } = await import('../src/app/simulation/_lib/phaseActorMovementRuntime.js');
const { resolveActorNextMoveZone } = await import('../src/app/simulation/_lib/actorMovementDecisionHelpers.js');
const { resolvePvpAvoidanceMove } = await import('../src/app/simulation/_lib/phasePvpAvoidanceRuntime.js');
const { createPhaseCombatFleeRuntime } = await import('../src/app/simulation/_lib/phaseCombatFleeRuntime.js');
const { buildRunActionSummary } = await import('../src/app/simulation/_lib/runActionSummary.js');
const { summarizeTeamRetreats } = await import('./lib/match-distribution-diagnostics.mjs');

const actor = (id, teamId = 'team:1', zoneId = 'a', power = 100) => ({
  _id: id, name: id, teamId, zoneId, power, hp: 100, maxHp: 100,
  stats: { attackPower: 20, defense: 10 }, inventory: [],
});
const estimatePower = (row) => row.power;
const me = actor('me');
const enemies = [1, 2, 3].map((n) => actor(`enemy${n}`, 'team:2'));
const ruleset = { ai: { recoverHpBelow: 38, fightAvoidMinRatio: 0.4, targetTtlMin: 1, targetTtlMax: 1 }, forbidden: { escapeMoveChance: 1 } };
let checks = 0;
const check = (name, fn) => { fn(); checks += 1; console.log(`PASS ${name}`); };

check('result summary distinguishes real team moves from waiting or queued intentions', () => {
  const summary = buildRunActionSummary([
    { kind: 'team_decision', reason: 'team_regroup', moved: true, teamId: 'team:1' },
    { kind: 'team_decision', reason: 'team_regroup', moved: false, teamId: 'team:1' },
    { kind: 'team_decision', reason: 'team_rotate', moved: true, teamId: 'team:2' },
    { kind: 'team_decision', reason: 'team_rotate', moved: false, teamId: 'team:2' },
    { kind: 'team_decision', reason: 'team_outnumbered', moved: true },
    { kind: 'move', reason: 'flee:team_outnumbered' },
    { kind: 'move', reason: 'avoid_power', teamAssessment: { shouldAvoid: true } },
    { kind: 'queue', chosen: 'moveTo', reason: 'team_regroup' },
  ]);
  assert.deepEqual(summary.team, { regroupMoves: 1, regroupHolds: 1, rotations: 1, retreats: 2 });
  assert.match(summary.teamLine, /협동 판단 2팀/);
});
check('team retreat diagnostics count only adjacent actual retreat reversals', () => {
  const direct = [
    { kind: 'move', who: 'direct', from: 'a', to: 'b', reason: 'flee:team_outnumbered', sec: 20 },
    { kind: 'team_decision', who: 'direct', from: 'a', to: 'b', reason: 'team_outnumbered', moved: true, sec: 20 },
    { kind: 'move', who: 'direct', from: 'b', to: 'a', reason: 'flee:team_outnumbered', sec: 40 },
    { kind: 'team_decision', who: 'direct', from: 'b', to: 'a', reason: 'team_outnumbered', moved: true, sec: 40 },
  ];
  const detour = [
    { kind: 'move', who: 'detour', from: 'a', to: 'b', reason: 'flee:team_outnumbered', sec: 20 },
    { kind: 'team_decision', who: 'detour', from: 'a', to: 'b', reason: 'team_outnumbered', moved: true, sec: 20 },
    { kind: 'move', who: 'detour', from: 'b', to: 'c', reason: 'growth_farm', sec: 40 },
    { kind: 'move', who: 'detour', from: 'c', to: 'b', reason: 'growth_farm', sec: 60 },
    { kind: 'move', who: 'detour', from: 'b', to: 'a', reason: 'flee:team_outnumbered', sec: 80 },
    { kind: 'team_decision', who: 'detour', from: 'b', to: 'a', reason: 'team_outnumbered', moved: true, sec: 80 },
  ];
  const overridden = [
    { kind: 'move', who: 'endgame', from: 'a', to: 'b', reason: 'endgame_rotate', sec: 20 },
    { kind: 'team_decision', who: 'endgame', from: 'a', to: 'b', reason: 'team_outnumbered', moved: true, sec: 20 },
    { kind: 'move', who: 'generic', from: 'a', to: 'b', reason: 'avoid_power', teamAssessment: { shouldAvoid: true }, sec: 20 },
  ];
  const summary = summarizeTeamRetreats([...direct, ...detour, ...overridden]);
  assert.equal(summary.total, 4);
  assert.equal(summary.reversals, 1);
  assert.equal(summary.reversalSamples[0].actorId, 'direct');
});

check('one versus three uses local team power', () => {
  const result = assessTeamCombat(me, [me, ...enemies], { estimatePower });
  assert.equal(result.shouldAvoid, true);
  assert.equal(result.reason, 'team_outnumbered');
  assert.equal(result.powerRatio, 0.25);
});
check('allied numbers are support, not danger', () => {
  const result = assessTeamCombat(me, [me, actor('friend1'), actor('friend2'), enemies[0]], { estimatePower });
  assert.equal(result.shouldAvoid, false);
  assert.equal(result.allyCount, 3);
});
check('dead, distant and stale duplicate actors do not inflate strength', () => {
  const result = assessTeamCombat(me, [{ ...me, power: 999 }, { ...enemies[0], hp: 0 }, { ...enemies[1], zoneId: 'b' }], { estimatePower });
  assert.equal(result.allyPower, 100);
  assert.equal(result.enemyCount, 0);
});
check('safe ally zone beats equally safe empty zone', () => {
  const roster = [me, ...enemies, actor('friend1', 'team:1', 'c'), actor('friend2', 'team:1', 'c')];
  const result = pickTeamSafeZone(me, roster, { a: ['b', 'c'], b: ['a'], c: ['a'] }, new Set(), { estimatePower });
  assert.equal(result.nextStep, 'c');
});
check('safe endpoint does not allow passage through stronger enemy group', () => {
  const roster = [me, ...enemies.map((row) => ({ ...row, zoneId: 'b' }))];
  const blocked = pickTeamSafeZone(me, roster, { a: ['b'], b: ['a', 'c'], c: ['b'] }, new Set(), { estimatePower, targetZoneId: 'c' });
  assert.equal(blocked, null);
  const alternative = pickTeamSafeZone(me, roster, { a: ['b', 'd'], b: ['a', 'c'], c: ['b', 'd'], d: ['a', 'c'] }, new Set(), { estimatePower, targetZoneId: 'c' });
  assert.equal(alternative.nextStep, 'd');
});
check('forbidden start can escape; forbidden target cannot be selected', () => {
  const graph = { a: ['b'], b: ['a'] };
  assert.equal(pickTeamSafeZone(me, [me], graph, new Set(['a']), { estimatePower }).nextStep, 'b');
  assert.equal(pickTeamSafeZone(me, [me], graph, new Set(['b']), { estimatePower, targetZoneId: 'b' }), null);
});
check('one-decision exclusion rejects the just-left zone and its route', () => {
  const graph = { a: ['b'], b: ['a', 'c'], c: ['b'] };
  const fromB = { ...me, zoneId: 'b' };
  assert.equal(pickTeamSafeZone(fromB, [fromB], graph, new Set(), {
    estimatePower, allowStay: false, excludedZoneIds: ['a'],
  }).nextStep, 'c');
  assert.equal(pickTeamSafeZone(fromB, [fromB], graph, new Set(), {
    estimatePower, targetZoneId: 'a', excludedZoneIds: ['a'],
  }), null);
});

const graph = { a: ['b'], b: ['a', 'c'], c: ['b'] };
const squad = [me, { ...actor('friend1', 'team:1', 'b'), teamSlot: 1 }, { ...actor('friend2', 'team:1', 'b'), teamSlot: 2 }];
const plan = (extra = {}) => buildTeamMovementPlans({ roster: squad, zoneGraph: graph, estimatePower, day: 3, ...extra });
check('opening routes and solo matches are not overridden', () => {
  assert.equal(plan({ day: 1 }).size, 0);
  assert.equal(plan({ isSoloMatch: true }).size, 0);
  assert.equal(plan({ day: 2, phase: 'morning', roster: squad.map((row) => ({ ...row, routePlanIndex: 0, routePlanZoneIds: ['a', 'b'] })) }).size, 0);
});
check('split team converges on same occupied rally zone without chasing each other', () => {
  const plans = plan();
  assert.equal(plans.size, 3);
  assert.equal(plans.get('me').nextStep, 'b');
  assert.equal(plans.get('friend1').nextStep, 'b');
  assert.ok([...plans.values()].every((row) => row.targetZoneId === 'b' && row.mode === 'team_regroup'));
});
check('rally plan is input-order independent and does not mutate input', () => {
  const before = structuredClone(squad);
  const sorted = (value) => [...value.entries()].sort(([a], [b]) => a.localeCompare(b));
  assert.deepEqual(sorted(plan()), sorted(plan({ roster: [...squad].reverse() })));
  assert.deepEqual(squad, before);
});
check('grouped team uses one leader decision and one reachable next step', () => {
  let decisions = 0;
  const plans = plan({ roster: squad.map((row) => ({ ...row, zoneId: 'a' })), chooseLeaderMove: () => { decisions += 1; return { targets: ['c'], objectiveType: 'boss' }; } });
  assert.equal(decisions, 1);
  assert.equal(plans.size, 3);
  assert.ok([...plans.values()].every((row) => row.nextStep === 'b' && row.targetZoneId === 'c' && row.mode === 'team_rotate'));
});
check('unreachable rally never produces a teleport plan', () => {
  const plans = plan({ zoneGraph: { a: [], b: [] } });
  assert.equal(plans.has('me'), false);
});
check('dead or forbidden-area leader is not chosen as rally anchor', () => {
  const plans = plan({ roster: [{ ...me, hp: 0, teamSlot: 1 }, ...squad.slice(1), actor('remote', 'team:1', 'a')], forbiddenIds: new Set(['a']) });
  assert.ok([...plans.values()].every((row) => row.targetZoneId === 'b' && row.leaderId !== 'me'));
});

const originalRandom = Math.random;
try {
  Math.random = () => 0;
  check('unreachable movement target holds position in the actual movement resolver', () => {
    const result = resolveActorNextMoveZone({ state: { actor: me, currentZone: 'a', day: 3, phase: 'morning', moveTargets: ['c'], neighbors: [], zoneGraph: { a: [], c: [] }, ruleset } });
    assert.equal(result.nextZoneId, 'a');
  });
  const move = (who, roster, extra = {}) => {
    const events = [];
    const result = runActorMovementDecisionPhase({
      state: { actor: structuredClone(who), phaseSurvivors: structuredClone(roster), craftables: [], itemKeyById: {}, itemMetaById: {}, itemNameById: {}, kiosks: [], mapObj: { zones: Object.keys(graph).map((zoneId) => ({ zoneId })) }, nextDay: 3, nextPhase: 'morning', phaseIdxNow: 4, ruleset, zoneGraph: graph, zones: [{ zoneId: 'a' }], ...extra },
      actions: { emitRunEvent: (kind, payload) => events.push({ kind, ...payload }) },
    });
    return { ...result, events };
  };
  check('actual movement retreats from one-versus-three and records its reason', () => {
    const result = move(me, [me, ...enemies]);
    assert.equal(result.fleeInterruptReason, 'team_outnumbered');
    assert.equal(result.nextZoneId, 'b');
    assert.equal(result.actor._retreatAvoidZoneId, 'a');
    assert.equal(result.actor._retreatAvoidDecisions, 1);
    assert.equal(result.events.find((row) => row.kind === 'team_decision').reason, 'team_outnumbered');
  });
  check('consecutive outnumbered retreats choose a third zone instead of reversing', () => {
    const first = move(me, [me, ...enemies]);
    const movedEnemies = enemies.map((row) => ({ ...row, zoneId: 'b' }));
    const second = move(first.actor, [first.actor, ...movedEnemies]);
    assert.equal(second.fleeInterruptReason, 'team_outnumbered');
    assert.equal(second.nextZoneId, 'c');
    assert.equal(second.actor._retreatAvoidZoneId, 'b');
    assert.equal(second.actor._retreatAvoidDecisions, 1);
  });
  check('an unrelated hold cannot consume retreat memory before the next retreat', () => {
    const first = move(me, [me, ...enemies]);
    const held = move(first.actor, [first.actor], {
      teamMovementPlan: { mode: 'team_regroup', nextStep: 'b', targetZoneId: 'b', leaderId: 'me' },
    });
    assert.equal(held.nextZoneId, 'b');
    assert.equal(held.actor._retreatAvoidZoneId, 'a');
    assert.equal(held.actor._retreatAvoidDecisions, 1);

    const movedEnemies = enemies.map((row) => ({ ...row, zoneId: 'b' }));
    const second = move(held.actor, [held.actor, ...movedEnemies]);
    assert.equal(second.fleeInterruptReason, 'team_outnumbered');
    assert.equal(second.nextZoneId, 'c');
  });
  check('ordinary immediate return holds once, reports why, then expires', () => {
    const cooling = { ...me, zoneId: 'b', _retreatAvoidZoneId: 'a', _retreatAvoidDecisions: 1 };
    const teamMovementPlan = { mode: 'team_rotate', nextStep: 'a', targetZoneId: 'a', objectiveType: 'boss' };
    const held = move(cooling, [cooling], { teamMovementPlan });
    assert.equal(held.nextZoneId, 'b');
    assert.equal(held.retreatCooldownHeld, true);
    assert.equal(held.actor._retreatAvoidZoneId, '');
    assert.equal(held.events.find((row) => row.kind === 'team_decision').reason, 'retreat_cooldown');
    const released = move(held.actor, [held.actor], { teamMovementPlan });
    assert.equal(released.nextZoneId, 'a');
    assert.equal(released.retreatCooldownHeld, false);
  });
  check('forbidden-zone escape overrides retreat return memory', () => {
    const cooling = { ...me, zoneId: 'b', _retreatAvoidZoneId: 'a', _retreatAvoidDecisions: 1 };
    const result = move(cooling, [cooling], { forbiddenIds: new Set(['b']) });
    assert.equal(result.mustEscape, true);
    assert.equal(result.nextZoneId, 'a');
  });
  check('endgame rotation overrides a latent power flee without publishing a false retreat', () => {
    const endgame = { zoneIds: ['a', 'b', 'c'], finalZoneId: 'c', singleZoneAtSec: 0, stage: 'final' };
    const result = move(me, [me, ...enemies], { nextSpawn: { endgame } });
    assert.equal(result.fleeInterruptReason, 'team_outnumbered');
    assert.equal(result.moveReason, 'endgame_rotate');
    assert.equal(result.nextZoneId, 'b');
    assert.equal(result.events.find((row) => row.kind === 'move')?.reason, 'endgame_rotate');
    assert.equal(result.events.some((row) => row.kind === 'team_decision' && row.reason === 'team_outnumbered'), false);
  });
  check('actual movement holds a regroup anchor and records an honest non-move', () => {
    const who = squad[1];
    const result = move(who, squad, { teamMovementPlan: plan().get(who._id) });
    assert.equal(result.nextZoneId, 'b');
    const event = result.events.find((row) => row.kind === 'team_decision');
    assert.equal(event.reason, 'team_regroup');
    assert.equal(event.moved, false);
  });
  check('an active team plan skips discarded personal targeting while preserving team metadata', () => {
    const previousRandom = Math.random;
    let randomDraws = 0;
    Math.random = () => { randomDraws += 1; return 0; };
    try {
      const fullGear = ['weapon', 'head', 'clothes', 'arm', 'shoes']
        .map((equipSlot) => ({ itemId: `gear:${equipSlot}`, equipSlot, tier: 6, qty: 1 }));
      const who = {
        ...actor('friend1', 'team:1', 'a'),
        inventory: fullGear,
        aiTargetZoneId: 'c', aiTargetTTL: 5,
        aiTargetObjectiveType: 'personal', aiTargetObjectiveSubkind: 'stale',
        aiTargetContestPressure: 0.9,
      };
      const result = move(who, [actor('me', 'team:1', 'a'), who], {
        nextPhase: 'night',
        nextSpawn: { wildlife: { b: 1 } },
        teamMovementPlan: {
          mode: 'team_rotate', nextStep: 'b', targetZoneId: 'b', leaderId: 'me',
          objectiveType: 'wildlife', objectiveSubkind: 'hunt', contestPressure: 0.4,
        },
      });
      assert.equal(result.moveReason, 'team_rotate');
      assert.equal(result.nextZoneId, 'b');
      assert.equal(result.holdTarget, null);
      assert.equal(result.actor.aiTargetZoneId, null);
      assert.equal(result.actor.aiTargetTTL, 0);
      assert.equal(result.moveObjectiveType, 'wildlife');
      assert.equal(result.moveObjectiveSubkind, 'hunt');
      assert.equal(result.moveContestPressure, 0.4);
      assert.equal(result.actor._objectiveContestType, 'wildlife');
      assert.equal(result.actor._objectiveContestSubkind, 'hunt');
      assert.equal(result.actor._objectiveContestPressure, 0.4);
      const moveEvent = result.events.find((row) => row.kind === 'move');
      assert.equal(moveEvent?.objectiveType, 'wildlife');
      assert.equal(moveEvent?.objectiveSubkind, 'hunt');
      assert.equal(moveEvent?.contestPressure, 0.4);
      assert.equal(randomDraws, 1, 'only the committed graph movement chance draws randomness');

      randomDraws = 0;
      const personalActor = { ...actor('solo', 'team:1', 'a'), inventory: fullGear };
      const personal = move(personalActor, [personalActor], {
        nextPhase: 'night',
        nextSpawn: { wildlife: { b: 1 } },
      });
      assert.equal(personal.holdTarget, 'b');
      assert.equal(personal.actor.aiTargetZoneId, 'b');
      assert.equal(personal.actor.aiTargetTTL, 1);
      assert.equal(personal.nextZoneId, 'b');
      assert.equal(randomDraws, 2, 'personal objective and committed movement each draw once');
    } finally {
      Math.random = previousRandom;
    }
  });
  check('low health overrides regroup and does not wander into enemies', () => {
    const hurt = { ...me, hp: 20 };
    const result = move(hurt, [hurt, ...enemies.map((row) => ({ ...row, zoneId: 'b' }))], { teamMovementPlan: { mode: 'team_regroup', nextStep: 'b', targetZoneId: 'b' }, nextDay: 1 });
    assert.equal(result.recovering, true);
    assert.equal(result.nextZoneId, 'a');
  });
  check('intermediate shared route step is not mistaken for objective arrival', () => {
    const result = move(me, [me], { teamMovementPlan: { mode: 'team_rotate', nextStep: 'b', targetZoneId: 'c', objectiveType: 'boss', contestPressure: 0.8 } });
    assert.equal(result.nextZoneId, 'b');
    assert.equal(Number(result.actor._objectiveContestPressure || 0), 0);
  });
  check('pre-combat retreat uses living allied cover, not lowest head count', () => {
    const who = structuredClone(me);
    const roster = [who, ...enemies, actor('friend1', 'team:1', 'c'), actor('friend2', 'team:1', 'c')];
    const result = resolvePvpAvoidanceMove({ state: { actor: who, survivorMap: new Map(roster.map((row) => [row._id, row])), ruleset, estimatePower, zoneGraph: { a: ['b', 'c'], b: ['a'], c: ['a'] } } });
    assert.equal(result.toZoneId, 'c');
    assert.equal(who._retreatAvoidZoneId, 'a');
  });
  check('combat escape destination follows the same ally-aware rule', () => {
    const roster = [me, ...enemies, actor('friend1', 'team:1', 'c'), actor('friend2', 'team:1', 'c')];
    const runtime = createPhaseCombatFleeRuntime({ state: { estimatePower, survivorMap: new Map(roster.map((row) => [row._id, row])), zoneGraph: { a: ['b', 'c'], b: ['a'], c: ['a'] } } });
    assert.equal(runtime.pickSparseSafeNeighbor('a', me), 'c');
  });
  check('combat escape picker also refuses the just-left zone', () => {
    const cooling = { ...me, zoneId: 'b', _retreatAvoidZoneId: 'a', _retreatAvoidDecisions: 1 };
    const roster = [cooling, ...enemies.map((row) => ({ ...row, zoneId: 'b' }))];
    const runtime = createPhaseCombatFleeRuntime({ state: { estimatePower, survivorMap: new Map(roster.map((row) => [row._id, row])), zoneGraph: graph } });
    assert.equal(runtime.pickSparseSafeNeighbor('b', cooling), 'c');
  });
} finally { Math.random = originalRandom; }
console.log(JSON.stringify({ checks, pass: true, scope: 'team tactics and actual movement/retreat integration; not match balance' }));
