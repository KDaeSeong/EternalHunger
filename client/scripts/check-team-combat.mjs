import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';
const { releaseInstantSkill } = await import('./lib/release-instant-skill.mjs');
const { runTeamCombatRound, recordCombatContribution, commitRetreatCover } = await import('../src/app/simulation/_lib/teamCombatRuntime.js');
const { runPhaseCombatEncounter } = await import('../src/app/simulation/_lib/phaseCombatEncounterRuntime.js');
const { createPhaseCombatEliminationRuntime } = await import('../src/app/simulation/_lib/phaseCombatEliminationRuntime.js');
const { createPhaseCombatFleeRuntime } = await import('../src/app/simulation/_lib/phaseCombatFleeRuntime.js');
const { normalizeRevivedSurvivor } = await import('../src/app/simulation/_lib/survivorLifecycleRuntime.js');
const { getRuleset } = await import('../src/utils/rulesets.js');
const { buildRunActionSummary } = await import('../src/app/simulation/_lib/runActionSummary.js');
const originalRules = getRuleset('ER_S11');
const ruleset = { ...originalRules, ai: { ...originalRules.ai, escapeHpBelow: 0 },
  pvp: { ...originalRules.pvp, criticalFleeHpBelow: 0, earlyLethalFinishMax: 0, postBattleMoveChance: 0, restHealMax: 0, postBattleRestExtraHealMax: 0 } };
const row = (id, team = 'a', extra = {}) => ({ _id: id, name: id, teamId: team, teamName: team, zoneId: 'zone',
  _spatial: { zoneId: 'zone', x: 4, y: 4 },
  hp: 500, maxHp: 500, inventory: [], power: 100, stats: { attackPower: 20, defense: 10 }, tacticalSkill: 'none', _tacNextAbsSec: 9999, ...extra });
const fixture = (rows, extra = {}) => {
  const events = []; const newDeadIds = []; const roundKills = {}; const roundAssists = {};
  const survivorMap = new Map(rows.map((actor) => [actor._id, actor]));
  const state = { actor: rows[0], target: rows.find((actor) => actor.teamId !== rows[0].teamId), survivorMap, newDeadIds, roundKills, roundAssists,
    phaseSurvivors: rows, todaysSurvivors: [...rows], currentActionSec: () => 100, phaseIdxNow: 4, nextDay: 3,
    estimatePower: (actor) => actor.power || 100, pickUnbiasedBattle: (attacker) => ({ winner: attacker, log: 'test exchange' }),
    ruleset, publicItems: [], craftables: [], assistWindowPhases: 2, ...extra };
  const actions = { emitRunEvent: (kind, data, at) => events.push({ kind, ...data, at }), atNow: () => ({ day: 3, phase: 'morning', sec: 100 }) };
  return { state, actions, events, survivorMap, newDeadIds, roundKills, roundAssists, run: () => runPhaseCombatEncounter({ state, actions }) };
};
let checks = 0;
const check = (name, fn) => { fn(); checks++; console.log(`PASS ${name}`); };
const withRandom = (value, fn) => { const original = Math.random; Math.random = () => value; try { return fn(); } finally { Math.random = original; } };

check('same-region three-versus-three spends six real actions and focuses targets', () => withRandom(0, () => {
  const f = fixture([row('a1'), row('a2'), row('a3'), row('b1', 'b'), row('b2', 'b'), row('b3', 'b')]);
  const result = f.run();
  assert.equal(result.teamRound.strikes.length, 6);
  assert.equal(new Set(result.teamRound.strikes.map((hit) => hit.who)).size, 6);
  assert.deepEqual(result.teamRound.strikes.filter((hit) => hit.teamId === 'a').map((hit) => hit.targetId), ['b1', 'b1', 'b1']);
  assert.ok(result.teamRound.strikes.every((hit) => hit.damage > 0));
  assert.ok([...f.survivorMap.values()].every((actor) => actor._basicAttackReadyAtSec > 100 && actor._lastBasicAttackAtSec === 100));
  assert.ok([...f.survivorMap.values()].every((actor) => Number(actor._actionReadyAtSec || 0) <= 100), 'A basic attack must not impose a shared eight-second skill lock.');
  const hp = [...f.survivorMap.values()].map((actor) => actor.hp);
  const again = f.run();
  assert.equal(again.teamRound.strikes.length, 0); assert.deepEqual([...f.survivorMap.values()].map((actor) => actor.hp), hp);
}));
check('dead, remote, travelling and stunned allies cannot contribute attacks', () => withRandom(0, () => {
  const f = fixture([row('a1'), row('a2'), row('dead', 'a', { hp: 0 }), row('remote', 'a', { zoneId: 'far' }),
    row('travelling', 'a', { _actionReadyAtSec: 101 }), row('stunned', 'a', { activeEffects: [{ name: '기절', remainingDuration: 10 }] }), row('b1', 'b')]);
  const result = f.run();
  assert.deepEqual(result.teamRound.strikes.map((hit) => hit.who).sort(), ['a1', 'a2', 'b1']);
}));
check('an ally physically joining deals more damage than the same ally being remote', () => withRandom(0, () => {
  const joined = fixture([row('a1'), row('a2'), row('a3'), row('b1', 'b')]); joined.run();
  const remote = fixture([row('a1'), row('a2', 'a', { zoneId: 'far' }), row('a3', 'a', { zoneId: 'far' }), row('b1', 'b')]); remote.run();
  assert.ok(joined.survivorMap.get('b1').hp < remote.survivorMap.get('b1').hp);
  console.log(JSON.stringify({ comparison: 'same power and matchup, local versus remote allies', localEnemyHp: joined.survivorMap.get('b1').hp, remoteEnemyHp: remote.survivorMap.get('b1').hp }));
}));
check('a participating support skill changes an injured teammates survival in the actual exchange', () => withRandom(0, () => {
  const run = (enabled) => {
    const healer = row('a0healer', 'a', { characterSkills: enabled ? { w: { enabled: true, slot: 'w', type: 'heal_skill', name: '팀 회복',
      supportTargetScope: 'ally', cooldownSec: 10, heal: [100, 100, 100, 100, 100] } } : {} });
    const wounded = row('a1wounded', 'a', { hp: 50 });
    // 60 attack / 10 defense produces a genuinely lethal 55 HP hit at 50 HP.
    const f = fixture([healer, wounded, row('b1', 'b', { stats: { attackPower: 60, defense: 10 } })], { battleSettings: { skills: { characterSkills: true } } });
    releaseInstantSkill(healer, [...f.survivorMap.values()], 100, f.state.battleSettings, (target, preparedSkill) => {
      runPhaseCombatEncounter({ state: { ...f.state, actor: healer, target, preparedSkill, actionType: 'skill_release' }, actions: f.actions });
    }, f.actions);
    f.run(); return f;
  };
  const withSupport = run(true); const without = run(false);
  assert.ok(withSupport.survivorMap.get('a1wounded').hp > 0);
  assert.equal(without.survivorMap.get('a1wounded').hp, 0);
  assert.equal(withSupport.survivorMap.get('a0healer').skillState.w.cooldownUntil, 110);
  assert.ok(withSupport.events.some((event) => event.kind === 'skill' && event.heal > 0));
}));
check('dead or newly stunned participants lose their pending strike and focus switches after death', () => {
  const actors = [row('a1'), row('a2'), row('a3'), row('b1', 'b', { hp: 20 }), row('b2', 'b')];
  const map = new Map(actors.map((actor) => [actor._id, actor])); const dead = [];
  const result = runTeamCombatRound({ actor: actors[0], target: actors[3], survivorMap: map, newDeadIds: dead, nowSec: 100, random: () => 0,
    resolveStrike: (attacker, victim) => { if (attacker._id === 'a1') { victim.hp = 0; dead.push(victim._id); map.get('a2').activeEffects = [{ name: '기절', remainingDuration: 5 }]; } },
  });
  assert.ok(!result.strikes.some((hit) => ['a2', 'b1'].includes(hit.who)));
  assert.equal(result.strikes.find((hit) => hit.who === 'a3').targetId, 'b2');
});
check('all contributing allies receive one assist, and duplicate elimination cannot pay twice', () => {
  const actors = [row('killer'), row('assist1'), row('assist2'), row('outsider', 'c'), row('victim', 'b', { hp: 0, simCredits: 100 })];
  const f = fixture(actors);
  for (const actor of actors.slice(1, 4)) recordCombatContribution(actors[4], actor, 10, 4, 99);
  const runtime = createPhaseCombatEliminationRuntime({ state: { ...f.state, pvpCfg: ruleset.pvp }, actions: f.actions });
  const result = runtime.applyCombatElimination(actors[0], actors[4], { deferAftermath: true });
  assert.deepEqual(result.assistIds.sort(), ['assist1', 'assist2']);
  assert.deepEqual(f.roundAssists, { assist1: 1, assist2: 1 });
  const inventory = structuredClone(actors[0].inventory); const credits = actors[0].simCredits;
  assert.equal(runtime.applyCombatElimination(actors[0], actors[4]).duplicate, true);
  assert.equal(f.roundKills.killer, 1); assert.equal(actors[0].simCredits, credits); assert.deepEqual(actors[0].inventory, inventory);
});
check('expired contributions and contributions from a previous life cannot become assists', () => {
  const victim = row('victim', 'b'); recordCombatContribution(victim, row('old'), 10, 1, 10);
  const actors = [row('killer'), row('old'), victim]; const f = fixture(actors);
  const result = createPhaseCombatEliminationRuntime({ state: f.state, actions: f.actions }).applyCombatElimination(actors[0], victim, { deferAftermath: true });
  assert.deepEqual(result.assistIds, []);
  const revived = normalizeRevivedSurvivor(victim, 100, 'zone', 5, ruleset, 110);
  assert.deepEqual(revived._combatContributions, {}); assert.equal(revived.lastDamagedBy, '');
});
check('cover spends an available ally action and excludes stale, distant or disabled helpers', () => {
  const flee = row('flee', 'a', { hp: 30 }); const chase = row('chase', 'b'); const helper = row('helper');
  const rows = [flee, chase, helper, { ...helper }, row('far', 'a', { zoneId: 'far' }), row('stun', 'a', { activeEffects: [{ name: '기절', remainingDuration: 5 }] })];
  const result = commitRetreatCover(flee, chase, rows, { nowSec: 100, estimatePower: (actor) => actor.power });
  assert.deepEqual(result.helpers, ['helper']); assert.equal(result.bonus, 0.12);
  assert.equal(rows[3]._actionReadyAtSec, 108);
  assert.equal(commitRetreatCover(flee, chase, rows, { nowSec: 100, estimatePower: (actor) => actor.power }).bonus, 0);
});
check('actual retreat succeeds with paid cover at a roll that fails without cover', () => withRandom(0.30, () => {
  const run = (withHelper) => {
    const flee = row('flee', 'a', { hp: 100, maxHp: 100 }); const chase = row('chase', 'b'); const helper = row('helper');
    const rows = withHelper ? [flee, chase, helper] : [flee, chase];
    const events = [];
    const runtime = createPhaseCombatFleeRuntime({ state: { currentActionSec: () => 100, estimatePower: () => 100,
      ruleset: { ai: { escapeBaseChance: 0.22, chaseBaseChance: 0 }, pvp: { teamRoundCooldownSec: 8 } },
      totalZonesCount: 10, zoneGraph: { zone: ['safe'], safe: ['zone'] }, survivorMap: new Map(rows.map((actor) => [actor._id, actor])) },
      actions: { emitRunEvent: (kind, payload) => events.push({ kind, ...payload }) } });
    return { result: runtime.resolveFleeSequence(flee, chase), flee, helper, events };
  };
  const covered = run(true); const alone = run(false);
  assert.equal(covered.result.escaped, true); assert.equal(covered.result.caught, false); assert.equal(covered.flee.zoneId, 'safe');
  assert.equal(alone.result.escaped, false); assert.equal(alone.flee.zoneId, 'zone');
  assert.equal(covered.helper._actionReadyAtSec, 108); assert.equal(covered.events.filter((event) => event.kind === 'team_cover').length, 1);
}));
check('a dead simultaneous killer receives no heal or recovery resurrection', () => {
  const f = fixture([row('killer', 'a', { hp: 0 }), row('victim', 'b', { hp: 0 })]);
  f.actions.applyErTraitAfterBattle = (actor) => { actor.hp = 100; };
  createPhaseCombatEliminationRuntime({ state: f.state, actions: f.actions }).applyCombatElimination(f.state.actor, f.state.target);
  assert.equal(f.state.actor.hp, 0); assert.equal(f.state.actor._recentCombatUntil, undefined);
});
check('result summary counts actual team actions rather than hypothetical support', () => {
  const summary = buildRunActionSummary([{ kind: 'team_engagement' }, { kind: 'team_strike', damage: 21, reason: 'focus_fire' },
    { kind: 'team_cover', helpers: ['a', 'a', 'b'] }, { kind: 'elimination', assistIds: ['a', 'b'] }, { kind: 'queue', chosen: 'team_attack' }]);
  assert.deepEqual(summary.teamCombat, { rounds: 1, strikes: 1, focusFire: 1, cover: 2, damage: 21, assists: 2 });
  assert.match(summary.teamCombatLine, /팀원 공격 1회/);
});
console.log(`TEAM_COMBAT_CHECKS ${checks}/${checks}`);
