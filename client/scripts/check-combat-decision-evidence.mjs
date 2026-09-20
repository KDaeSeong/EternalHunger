import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';
const { estimateMovePower, summarizeEquipTierForMovePower, shouldAvoidCombatByMovePower } = await import('../src/app/simulation/_lib/movePowerRuntime.js');
const { assessTeamCombat } = await import('../src/app/simulation/_lib/teamTacticsRuntime.js');
const { captureCombatDecisionEvidence: capture, describeCombatDecisionContext: context } = await import('../src/app/simulation/_lib/combatDecisionEvidenceRuntime.js');
const { runActorMovementDecisionPhase } = await import('../src/app/simulation/_lib/phaseActorMovementRuntime.js');
const { resolvePvpAvoidanceMove } = await import('../src/app/simulation/_lib/phasePvpAvoidanceRuntime.js');
const { createPhaseCombatFleeRuntime } = await import('../src/app/simulation/_lib/phaseCombatFleeRuntime.js');
const { describeObserverEvent, buildTeamObserverModel } = await import('../src/app/simulation/_lib/teamObserverRuntime.js');
const { emitQueueRunEvent } = await import('../src/app/simulation/_lib/runEventRuntime.js');
const { prepareActorPhaseActionPlan } = await import('../src/app/simulation/_lib/phaseActionQueueRuntime.js');
const { isCombatDetailLog } = await import('../src/app/simulation/_lib/logPresentation.js');

let checks = 0;
const check = (name, fn) => { fn(); checks += 1; console.log(`PASS ${name}`); };
const actor = (id, teamId = 'team:1', extra = {}) => ({ _id: id, name: id, teamId, zoneId: 'a',
  hp: 100, maxHp: 100, stats: { attackPower: 20, defense: 10 }, inventory: [], ...extra });
const item = (id, equipSlot, tier) => ({ itemId: id, name: id, equipSlot, tier });
const me = actor('me');
const enemies = [1, 2, 3].map((id) => actor(`enemy${id}`, 'team:2'));
const at = { day: 3, phase: 'morning', sec: 620.25 };
const graph = { a: ['b'], b: ['a', 'c'], c: ['b'] };
const ruleset = { ai: { recoverHpBelow: 38, fightAvoidMinRatio: 0.4, targetTtlMin: 1, targetTtlMax: 1 }, forbidden: { escapeMoveChance: 1 } };
const recorder = () => {
  const events = [], logs = [];
  const typedLogs = [];
  return { events, logs, typedLogs, actions: { atNow: () => ({ ...at }), addLog: (text, type) => { logs.push(text); typedLogs.push({ text, type }); },
    emitRunEvent: (kind, payload, stamp) => events.push(structuredClone({ kind, ...payload, at: stamp })) } };
};
const movement = (who, roster, extra = {}, actionOverrides = {}) => {
  const records = recorder();
  const result = runActorMovementDecisionPhase({ state: { actor: structuredClone(who), phaseSurvivors: structuredClone(roster),
    craftables: [], itemKeyById: {}, itemMetaById: {}, itemNameById: {}, kiosks: [], mapObj: { zones: Object.keys(graph).map((zoneId) => ({ zoneId })) },
    nextDay: 3, nextPhase: 'morning', phaseIdxNow: 4, ruleset, zoneGraph: graph, zones: [{ zoneId: 'a' }], ...extra }, actions: { ...records.actions, ...actionOverrides } });
  return { ...records, ...result };
};

check('spare armor cannot inflate strength or change the equipped item', () => {
  const base = actor('gear', 'team:1', { inventory: [item('head', 'head', 2)], equipped: { head: 'head' } });
  const spare = structuredClone(base); spare.inventory.push(item('spare', 'head', 9));
  assert.equal(estimateMovePower(base), estimateMovePower(spare));
  assert.equal(summarizeEquipTierForMovePower(spare).armorTierSum, 2);
  assert.equal(spare.equipped.head, 'head');
});
check('explicit empty slots stay empty; missing legacy slots pick only one item', () => {
  const inv = [item('w1', 'weapon', 2), item('w2', 'weapon', 5), item('h1', 'head', 2), item('h2', 'head', 4)];
  assert.deepEqual(summarizeEquipTierForMovePower(actor('empty', 'team:1', { inventory: inv, equipped: { weapon: null, head: null } })),
    { weaponTier: 0, armorTierSum: 0, equippedCount: 0 });
  assert.deepEqual(summarizeEquipTierForMovePower(actor('legacy', 'team:1', { inventory: inv })),
    { weaponTier: 5, armorTierSum: 4, equippedCount: 2 });
});
check('team snapshot excludes distant, dead, duplicate and other combat spaces', () => {
  const roster = [{ ...me, hp: 2 }, ...enemies, { ...enemies[0] }, actor('far', 'team:2', { zoneId: 'c' }),
    actor('dead', 'team:2', { hp: 0 }), actor('rift', 'team:2', { _combatSpaceId: 'dimension-rift:test' })];
  const evidence = capture({ actor: me, roster, at, comparison: assessTeamCombat(me, roster).comparison });
  assert.equal(evidence.localAllyCount, 1); assert.equal(evidence.localEnemyCount, 3);
  assert.equal(evidence.allies.hp, 100); assert.equal(evidence.enemies.hp, 300);
  assert.equal(new Set(evidence.enemies.ids).size, 3);
});
check('exact team comparison is preserved before rounding at a threshold', () => {
  const roster = [me, enemies[0]];
  const result = assessTeamCombat(me, roster, { estimatePower: (row) => row._id === 'me' ? 39.999 : 60.001 });
  assert.equal(result.powerRatio, 0.4); assert.equal(result.shouldAvoid, true);
  assert.equal(result.comparison.ratio, 0.39999);
  assert.equal(result.comparison.minRatio, 0.4);
});
check('duel evidence distinguishes comparison target from other local enemies', () => {
  const opponent = actor('strong', 'team:2', { hp: 80 });
  const e = capture({ actor: me, opponent, roster: [me, opponent, ...enemies], at,
    comparison: { scope: 'duel', myP: 20, opP: 70, ratio: 2 / 9, minRatio: 0.4, absDelta: 10 } });
  assert.equal(e.localEnemyCount, 4); assert.deepEqual(e.enemies.ids, ['strong']);
  assert.match(context(e), /본인\/비교 상대/);
});
check('snapshot owns its state and consumes no random input', () => {
  const who = actor('me', 'team:1', { inventory: [item('head', 'head', 3)] });
  const roster = [who, ...enemies], before = structuredClone(roster), oldRandom = Math.random;
  Math.random = () => { throw Error('presentation must not draw RNG'); };
  try {
    const e = capture({ actor: who, roster, at });
    assert.deepEqual(roster, before);
    who.hp = 1; who.inventory[0].tier = 8; roster.pop();
    assert.equal(e.actor.hp, 100); assert.equal(e.allies.armorTierTotal, 3); assert.equal(e.enemies.count, 3);
    assert.deepEqual(JSON.parse(JSON.stringify(e)), e);
  } finally { Math.random = oldRandom; }
});
check('movement low HP priority records the actual absolute threshold, not gear causation', () => {
  const who = actor('me', 'team:1', { hp: 25 });
  const result = movement(who, [who, ...enemies]);
  assert.equal(result.decisionEvidence.reason, 'low_hp'); assert.equal(result.decisionEvidence.hpThreshold, 38);
  assert.equal(result.decisionEvidence.comparison, null); assert.equal(result.retreatOutcome, 'moved');
  assert.deepEqual(result.decisionEvidence.at, at);
  const event = result.events.find((row) => row.kind === 'move');
  assert.ok(result.logs.some((text) => text.includes(context(event.decisionEvidence, event.retreatOutcome))));
  assert.match(describeObserverEvent(event), /내 HP 25\/100.*체력 기준 38 이하/);
  assert.ok(result.typedLogs.some((log) => log.text.includes(context(event.decisionEvidence, event.retreatOutcome)) && isCombatDetailLog(log)));
});
check('hyperloop retreat retains the same evidence in visible combat detail logs', () => {
  const result = movement(me, [me, ...enemies], {}, { isHyperloopTransit: () => true });
  const event = result.events.find((row) => row.kind === 'move');
  assert.equal(event.transport, 'hyperloop');
  assert.ok(result.typedLogs.some((log) => log.text.includes('하이퍼루프')
    && log.text.includes(context(event.decisionEvidence, event.retreatOutcome)) && isCombatDetailLog(log)));
});
check('actual outnumbered movement carries the same comparison to the observer', () => {
  const result = movement(me, [me, ...enemies]);
  const e = result.decisionEvidence;
  assert.equal(e.scope, 'team'); assert.equal(e.localAllyCount, 1); assert.equal(e.localEnemyCount, 3);
  assert.ok(e.comparison.ratio < e.comparison.minRatio);
  assert.deepEqual(result.events.find((row) => row.kind === 'team_decision').decisionEvidence, e);
});
check('no safe route emits a held retreat instead of claiming departure', () => {
  const result = movement(me, [me, ...enemies], { zoneGraph: { a: [] } });
  assert.equal(result.didMove, false); assert.equal(result.retreatOutcome, 'no_safe_path');
  assert.ok(!result.events.some((row) => row.kind === 'move'));
  assert.match(describeObserverEvent(result.events.find((row) => row.kind === 'retreat')), /안전한 이동 경로 없음/);
});
check('endgame override does not inherit a discarded flee reason or evidence', () => {
  const result = movement(me, [me, ...enemies], { nextSpawn: { endgame: { zoneIds: ['a', 'b', 'c'], finalZoneId: 'c', singleZoneAtSec: 0, stage: 'final' } } });
  assert.equal(result.moveReason, 'endgame_rotate'); assert.equal(result.decisionEvidence, null);
  assert.ok(!result.events.some((row) => row.decisionEvidence));
});
check('movement control is reported as a blocked retreat, not a successful escape', () => {
  const who = actor('me', 'team:1', { activeEffects: [{ name: '기절', remainingDuration: 10, durationUnit: 'sec' }] });
  const result = movement(who, [who, ...enemies]);
  assert.equal(result.didMove, false); assert.equal(result.retreatOutcome, 'status_blocked');
  assert.equal(result.events.find((row) => row.kind === 'team_decision').reason, 'status_move_block');
  assert.match(describeObserverEvent(result.events.find((row) => row.kind === 'retreat')), /후퇴 불가: 이동 제한 상태/);
});
check('queue serialization retains owned evidence and observer text after actor changes', () => {
  const e = movement(me, [me, ...enemies]).decisionEvidence;
  const records = recorder();
  emitQueueRunEvent(records.actions.emitRunEvent, me, { chosen: 'flee', reason: 'flee:team_outnumbered',
    decisionEvidence: e, retreatOutcome: 'no_safe_path' }, at);
  e.actor.hp = 1; e.enemies.ids.length = 0;
  const event = records.events[0]; assert.equal(event.decisionEvidence.actor.hp, 100);
  assert.equal(event.decisionEvidence.enemies.ids.length, 3);
  assert.match(describeObserverEvent(event), /현장 아군 1명 \/ 적군 3명.*후퇴 보류/);
  assert.doesNotMatch(describeObserverEvent(event), /성공 여부는 후속/);
  const model = buildTeamObserverModel({ survivors: [{ ...me, hp: 7 }, ...enemies], events: [event],
    teamId: 'team:1', matchSec: at.sec + 10 });
  assert.equal(model.members.find((row) => row.id === 'me').hp, 7);
  assert.match(model.members.find((row) => row.id === 'me').decision.text, /내 HP 100\/100/);
});
check('actual action-plan wiring forwards movement evidence into the queue event', () => {
  const result = movement(me, [me, ...enemies]); const records = recorder();
  prepareActorPhaseActionPlan({ state: { ...result, actor: result.actor, ruleset, craftables: [], publicItems: [],
    itemKeyById: {}, itemNameById: {}, itemMetaById: {}, kiosks: [], zoneGraph: graph,
    nextDay: 3, nextPhase: 'morning', phaseIdxNow: 4 }, actions: { ...records.actions,
    emitQueueRunEvent: (who, payload, stamp) => emitQueueRunEvent(records.actions.emitRunEvent, who, payload, stamp) } });
  assert.deepEqual(records.events.find((row) => row.kind === 'queue')?.decisionEvidence, result.decisionEvidence);
});
check('pre-combat avoidance preserves the real duel comparison and hold result', () => {
  const opponent = actor('strong', 'team:2', { stats: { attackPower: 300, defense: 100 } });
  const records = recorder(), survivorMap = new Map([me, opponent].map((row) => [row._id, structuredClone(row)]));
  const avoidanceInfo = shouldAvoidCombatByMovePower(me, opponent, { ruleset });
  assert.ok(avoidanceInfo);
  const result = resolvePvpAvoidanceMove({ state: { actor: me, opponent, survivorMap, zoneGraph: { a: [] },
    ruleset, avoidanceInfo }, actions: records.actions });
  assert.equal(result.moved, false);
  const event = records.events.find((row) => row.kind === 'retreat');
  assert.equal(event.decisionEvidence.comparison.myP, avoidanceInfo.myP);
  assert.equal(event.decisionEvidence.comparison.absDelta, avoidanceInfo.absDelta);
  assert.equal(event.retreatOutcome, 'no_safe_path');
});
const flee = (random, extra = {}, who = actor('me', 'team:1', { hp: 25 })) => {
  const records = recorder(), opponent = actor('enemy', 'team:2');
  const survivorMap = new Map([who, opponent].map((row) => [row._id, structuredClone(row)]));
  const runtime = createPhaseCombatFleeRuntime({ actions: records.actions, state: { survivorMap,
    zoneGraph: graph, ruleset, currentActionSec: () => at.sec, estimatePower: estimateMovePower, ...extra.state }, tactical: extra.tactical });
  const oldRandom = Math.random; Math.random = () => random;
  try { return { ...records, survivorMap, result: runtime.resolveFleeSequence(who, opponent, { reason: 'low_hp', hpThreshold: 42, ...extra.options }) }; }
  finally { Math.random = oldRandom; }
};
check('failed escape retains the pre-attempt HP and explicitly reports failure', () => {
  const result = flee(0.99);
  assert.equal(result.result.escaped, false);
  const event = result.events.find((row) => row.kind === 'chase');
  assert.equal(event.retreatOutcome, 'escape_failed'); assert.equal(event.decisionEvidence.actor.hp, 25);
  assert.equal(result.survivorMap.get('me').zoneId, 'a');
  assert.match(describeObserverEvent(event), /도주 실패.*내 HP 25\/100/);
});
check('caught pursuit reports movement without falsely claiming a successful escape', () => {
  const result = flee(0);
  assert.equal(result.result.caught, true);
  const event = result.events.find((row) => row.kind === 'chase');
  assert.equal(event.retreatOutcome, 'caught');
  assert.match(describeObserverEvent(event), /지역은 벗어났지만 추격에 붙잡힘/);
  assert.equal(event.decisionEvidence.actor.hp, 25);
  assert.ok(result.survivorMap.get('me').hp < 25);
});
check('healing during escape does not rewrite the initial low-HP reason', () => {
  const result = flee(0.99, { tactical: { canUseTac: () => true } }, actor('me', 'team:1', { hp: 25, tacticalSkill: '치유의 바람' }));
  assert.ok(result.survivorMap.get('me').hp > 25);
  assert.equal(result.events.find((row) => row.kind === 'chase').decisionEvidence.actor.hp, 25);
});
check('combat with no safe path emits no fake move and no escape protection', () => {
  const result = flee(0, { state: { zoneGraph: { a: [] } } });
  assert.equal(result.result, null); assert.ok(!result.events.some((row) => row.kind === 'move'));
  assert.equal(result.events.find((row) => row.kind === 'retreat').retreatOutcome, 'no_safe_path');
  assert.equal(result.survivorMap.get('me').safeZoneUntil || 0, 0);
  assert.equal(result.survivorMap.get('me')._recentCombatUntil || 0, 0);
});
check('dead actors cannot produce a retreat event or gain protection', () => {
  const result = flee(0, {}, actor('me', 'team:1', { hp: 0 }));
  assert.equal(result.result, null); assert.equal(result.events.length, 0);
});
check('legacy events never invent missing HP or equipment evidence', () => {
  assert.doesNotMatch(describeObserverEvent({ kind: 'move', who: 'me', from: 'a', to: 'b', reason: 'avoid_power' }), /내 HP|장비 등급/);
});
console.log(JSON.stringify({ pass: true, checks, scope: 'decision evidence, equipment scoring, movement/queue and retreat execution; not human acceptance or match balance' }));
