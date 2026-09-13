import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';
const { releaseInstantSkill } = await import('./lib/release-instant-skill.mjs');
const status = await import('../src/utils/statusLogic.js');
const { calculateCombatDamage } = await import('../src/app/simulation/_lib/combatDamageRuntime.js');
const { resolveCombatWinnerOutcome } = await import('../src/app/simulation/_lib/phaseCombatDamageRuntime.js');
const { runPhaseCombatEncounter } = await import('../src/app/simulation/_lib/phaseCombatEncounterRuntime.js');
const { applyCharacterSkillOnBasicAttack } = await import('../src/app/simulation/_lib/characterSkillRuntime.js');
const { applyErWeaponSkillAfterCombat } = await import('../src/app/simulation/_lib/combatRuntime.js');
const { createPhaseCombatTacticalRuntime } = await import('../src/app/simulation/_lib/phaseCombatTacticalRuntime.js');
const { createPhaseCombatSkillSplashRuntime } = await import('../src/app/simulation/_lib/phaseCombatSkillSplashRuntime.js');
const { createPhaseCombatFleeRuntime } = await import('../src/app/simulation/_lib/phaseCombatFleeRuntime.js');
const { runActorMovementDecisionPhase, applyActorKnockbackMovement } = await import('../src/app/simulation/_lib/phaseActorMovementRuntime.js');
const { resolvePvpAvoidanceMove } = await import('../src/app/simulation/_lib/phasePvpAvoidanceRuntime.js');
const { pickTeamFocusTarget } = await import('../src/app/simulation/_lib/teamCombatRuntime.js');
const { runDetonationTickPhase } = await import('../src/app/simulation/_lib/phaseDetonationTickRuntime.js');
const { applyActorPhaseStatusTick } = await import('../src/app/simulation/_lib/phaseActorStatusRuntime.js');
const { applyStatusEffect, hasActiveEffect } = await import('../src/app/simulation/_lib/runtimeStatusApplication.js');
const { formatRuntimeEffectResultText } = await import('../src/app/simulation/_lib/runtimeStatusDisplay.js');
const { emitEffectRunEvents } = await import('../src/app/simulation/_lib/runEventRuntime.js');
const { getRuleset } = await import('../src/utils/rulesets.js');
const { createSeedRng } = await import('../src/app/simulation/_lib/randomSeedRuntime.js');
const { withSimulationRandom } = await import('../src/utils/simulationRandom.js');

const effect = (name, seconds = 3, extra = {}) => ({ name, remainingDuration: seconds, durationUnit: 'sec', ...extra });
const actor = (id = 'a', effects = [], extra = {}) => ({ _id: id, name: id, teamId: id, zoneId: 'zone', hp: 1000, maxHp: 1000,
  _spatial: { zoneId: 'zone', x: 4, y: 4 },
  inventory: [], tacticalSkill: 'none', stats: { maxHp: 1000, attackPower: 100, defense: 0, skillAmp: 0 },
  activeEffects: effects.map((name) => typeof name === 'string' ? effect(name) : name), ...extra });
const skill = (extra = {}) => ({ enabled: true, name: '검사 기술', type: 'attack_skill', flatDamage: [40], cooldownSec: 10, ...extra });
const ruleset = getRuleset('ER_S11');
const graph = { zone: ['safe'], safe: ['zone'] };
const record = () => { const events = []; return { events, actions: { emitRunEvent: (kind, data) => events.push({ kind, ...data }),
  atNow: () => ({ sec: 100, day: 3, phase: 'morning' }) } }; };
function strike(a, b, options = {}) {
  const log = record();
  releaseInstantSkill(a, [a, b], 100, options.battleSettings || {}, (target, preparedSkill) => {
    resolveCombatWinnerOutcome({ state: { actor: a, target, currentActionSec: () => 100, ...options, preparedSkill }, actions: log.actions });
  }, log.actions);
  resolveCombatWinnerOutcome({ state: { actor: a, target: b, currentActionSec: () => 100, ...options }, actions: log.actions });
  return log.events;
}
let checks = 0;
const check = (name, fn) => { withSimulationRandom(createSeedRng('combat-status'), fn); checks++; console.log(`PASS ${name}`); };

check('stun, root, silence, immunity and misses have distinct permissions', () => {
  for (const [name, move, cast, block, target] of [
    ['기절', false, false, true, true], ['airborne', false, false, true, true],
    ['root', false, true, false, true], ['silence', true, false, false, true],
    ['invulnerable', true, true, false, true], ['untargetable', true, true, false, false],
    ['blind', true, true, false, true], ['evasion', true, true, false, true],
  ]) {
    const a = actor('a', [name]);
    assert.equal(status.canMoveByStatus(a), move, name);
    assert.equal(status.canUseSkillByStatus(a), cast, name);
    assert.equal(status.hasActionBlockStatus(a), block, name);
    assert.equal(status.isTargetableByStatus(a), target, name);
  }
});
check('expired effects grant no restriction, stat, shield, stacks or immunity', () => {
  const a = actor('a', [effect('기절', 0), effect('무적', 0), effect('보호막', 0, { shieldValue: 900 }),
    effect('expired', 0, { statModifiers: { attackPower: 900 }, grantsImmunity: ['속박'] })]);
  assert.equal(status.canMoveByStatus(a), true); assert.equal(status.getEffectiveStats(a).attackPower, 100);
  assert.equal(status.getShieldValue(a), 0); assert.equal(status.getEffectStacks(a, '보호막'), 0);
  assert.equal(hasActiveEffect(a, '기절'), false);
  assert.equal(status.absorbShieldDamage(a, 50).damage, 50);
  assert.equal(status.addOrRefreshEffect(a, effect('속박')).applied, true);
  assert.equal(status.addOrRefreshEffect(a, effect('기절', 0)).applied, false);
});
check('blind and evade miss only basic damage without a critical random draw', () => {
  for (const [a, b, reason] of [[actor('a', ['실명']), actor('b'), 'blind'], [actor(), actor('b', ['회피']), 'evade']]) {
    a.stats.critChance = 1;
    const hit = calculateCombatDamage(a, b, { random: () => { throw new Error('Miss consumed critical roll'); } });
    assert.equal(hit.damage, 0); assert.equal(hit.blockedReason, reason);
    assert.equal(calculateCombatDamage(a, b, { type: 'skill', baseDamage: 40 }).damage, 40);
  }
});
check('invulnerability blocks all three damage types but remains targetable and susceptible to CC', () => {
  const b = actor('b', ['무적']);
  for (const type of ['basic', 'skill', 'true']) assert.equal(calculateCombatDamage(actor(), b, { type, baseDamage: 100 }).damage, 0);
  assert.equal(pickTeamFocusTarget(actor(), [b]), b);
  assert.equal(applyStatusEffect(b, effect('기절')).applied, true);
  assert.equal(status.hasActionBlockStatus(b), true);
});
check('untargetability blocks new effects and targeted damage without deleting existing DOT', () => {
  const b = actor('b', [effect('중독', 5, { dotDamage: 8 }), effect('대상 지정 불가', 5)]);
  const before = structuredClone(b.activeEffects);
  assert.equal(applyStatusEffect(b, effect('기절')).reason, 'untargetable');
  assert.equal(applyStatusEffect(b, effect('보호막', 5, { shieldValue: 99 })).applied, false);
  assert.equal(status.updateEffects(b, { elapsedSec: 2 }).hp, 984);
  assert.equal(b.activeEffects.length, before.length);
  assert.equal(pickTeamFocusTarget(actor(), [b]), null);
  assert.deepEqual(strike(actor(), b), []);
});
check('a rejected effect explains untargetability in both visible text and saved events', () => {
  const b = actor('b', ['대상 지정 불가']); const rejected = applyStatusEffect(b, effect('기절'));
  assert.match(formatRuntimeEffectResultText(rejected), /대상 지정 불가/);
  const log = record(); emitEffectRunEvents(log.actions.emitRunEvent, b, [rejected]);
  assert.equal(log.events[0].outcome, 'skipped'); assert.equal(log.events[0].blockedReason, 'untargetable');
});
check('invulnerability protects only its remaining part of a batched existing DOT tick', () => {
  const a = actor('a', [effect('중독', 5, { dotDamage: 8 }), effect('무적', 2)]);
  const full = status.updateEffects(a, { elapsedSec: 5 });
  let stepped = structuredClone(a);
  for (let second = 0; second < 5; second++) stepped = status.updateEffects(stepped, { elapsedSec: 1 });
  assert.equal(full.hp, 976); assert.deepEqual(full, stepped);
  assert.equal(a.hp, 1000);
});
check('actual phase status tick expires control and permits a later attack', () => {
  let a = actor('a', [effect('기절', 2)]); const b = actor('b');
  a = applyActorPhaseStatusTick({ state: { actor: a, elapsedSec: 1 } }).actor;
  assert.deepEqual(strike(a, b), []); assert.equal(b.hp, 1000);
  a = applyActorPhaseStatusTick({ state: { actor: a, elapsedSec: 1 } }).actor;
  assert.ok(strike(a, b).some((event) => event.kind === 'damage')); assert.equal(b.hp, 900);
});
check('actual root permits basic and stationary skill while silence permits basic only', () => {
  for (const [name, hp, used] of [['속박', 860, true], ['침묵', 900, false], ['기절', 1000, false]]) {
    const a = actor('a', [name], { characterSkills: { q: skill() } }); const b = actor('b');
    strike(a, b); assert.equal(b.hp, hp, name); assert.equal(!!a.skillState?.q?.cooldownUntil, used, name);
  }
});
check('root rejects movement skills without reserving their cooldown but allows stationary skills', () => {
  const a = actor('a', ['속박'], { characterSkills: { q: skill({ includesMovement: true }), w: skill({ name: '제자리 기술' }) } });
  const b = actor('b'); strike(a, b);
  assert.equal(b.hp, 860); assert.equal(a.skillState.q.cooldownUntil, undefined); assert.equal(a.skillState.w.cooldownUntil, 110);
});
check('actual miss packets neither damage shields nor heal through lifesteal', () => {
  const a = actor('a', ['실명'], { hp: 500, stats: { attackPower: 100, defense: 0, lifesteal: 1 }, characterSkills: { q: skill() } });
  const b = actor('b', [effect('보호막', 5, { shieldValue: 200 })]);
  const log = record(); const tactical = createPhaseCombatTacticalRuntime({ state: { absNow: 100 } });
  releaseInstantSkill(a, [a, b], 100, {}, (target, preparedSkill) => {
    resolveCombatWinnerOutcome({ state: { actor: a, target, preparedSkill, currentActionSec: () => 100 }, actions: log.actions, tactical });
  }, log.actions);
  resolveCombatWinnerOutcome({ state: { actor: a, target: b, currentActionSec: () => 100 }, actions: log.actions, tactical });
  assert.equal(a.hp, 500); assert.equal(b.hp, 1000); assert.equal(status.getShieldValue(b), 160);
  const miss = log.events.find((row) => row.kind === 'damage' && row.type === 'basic');
  assert.equal(miss.blockedReason, 'blind'); assert.equal(miss.hpDamage, 0); assert.equal(miss.absorbed, 0);
  assert.equal(b.lastDamagedBy, undefined);
});
check('untargetable actors are excluded from actual skill retarget and support pools', () => {
  const a = actor('a', [], { characterSkills: { q: skill({ targetPriority: 'lowest_hp' }) } });
  const hidden = actor('hidden', ['대상 지정 불가'], { hp: 1 }); const visible = actor('visible');
  const result = applyCharacterSkillOnBasicAttack(a, hidden, 100, { nowSec: 100, splashTargets: [visible] });
  assert.equal(result.results[0].targetId, 'visible');
  const healer = actor('healer', [], { characterSkills: { w: skill({ type: 'heal_skill', heal: [100], supportTargetScope: 'ally' }) } });
  const healed = applyCharacterSkillOnBasicAttack(healer, visible, 100, { nowSec: 100, supportTargets: [hidden] });
  assert.equal(healed.applied, false); assert.equal(hidden.hp, 1); assert.equal(healer.skillState.w.cooldownUntil, undefined);
});
check('splash commit rechecks current target immunity even after a hit was prepared', () => {
  const a = actor(); const b = actor('b', ['무적']); const c = actor('c', ['대상 지정 불가']); const d = actor('d', ['회피']);
  const rt = createPhaseCombatSkillSplashRuntime({ state: { survivorMap: new Map([a, b, c, d].map((row) => [row._id, row])) } });
  assert.deepEqual(rt.getCharacterSkillSplashTargets(a, b).map((row) => row._id), ['d']);
  assert.equal(rt.applyCharacterSkillSplashDamage(a, [b, c, d].map((target) => ({ target, damage: 40, packet: { type: 'skill' } }))), 40);
  assert.deepEqual([b.hp, c.hp, d.hp], [1000, 1000, 960]);
  assert.equal(rt.applyCharacterSkillSplashDamage(a, [{ target: d, damage: 40, packet: { type: 'basic' } }]), 0);
});
check('actual team focus skips untargetable allies while root and silence still take basic turns', () => {
  const a = actor('a', ['속박'], { teamId: 'one' }); const ally = actor('ally', ['침묵'], { teamId: 'one' });
  const b = actor('b', [], { teamId: 'two' }); const hidden = actor('hidden', ['대상 지정 불가'], { teamId: 'two', hp: 1 });
  const rows = [a, ally, b, hidden]; const log = record();
  runPhaseCombatEncounter({ state: { actor: a, target: b, survivorMap: new Map(rows.map((row) => [row._id, row])),
    currentActionSec: () => 100, ruleset: { ai: { escapeHpBelow: 0 }, pvp: { criticalFleeHpBelow: 0 } } }, actions: log.actions });
  const hits = log.events.filter((event) => event.kind === 'team_strike');
  assert.ok(hits.some((event) => event.who === 'a')); assert.ok(hits.some((event) => event.who === 'ally'));
  assert.ok(hits.every((event) => event.targetId !== 'hidden')); assert.equal(hidden.hp, 1);
});
check('tactical casting distinguishes root mobility from silence and retains existing shields', () => {
  const rt = createPhaseCombatTacticalRuntime({ state: { absNow: 100 } });
  const root = actor('a', ['속박'], { hp: 30, tacticalSkill: '블링크' });
  assert.equal(rt.canUseTac(root), false); root.tacticalSkill = '붉은 폭풍'; assert.equal(rt.canUseTac(root), false);
  root.tacticalSkill = '치유의 바람'; assert.equal(rt.canUseTac(root), true);
  rt.applyCombatTacAttack(root, actor('b'), 0); assert.ok(status.getRegenValue(root) > 0);
  assert.ok(status.updateEffects(root, { elapsedSec: 1 }).hp > 30);
  const silent = actor('silent', ['침묵', effect('보호막', 3, { shieldValue: 20 })], { tacticalSkill: '초월' });
  assert.equal(rt.shieldBlock(silent, 100), 80); assert.equal(silent._tacNextAbsSec, undefined);
  const immune = actor('immune', ['무적', effect('보호막', 3, { shieldValue: 20 })], { tacticalSkill: '초월' });
  assert.equal(rt.shieldBlock(immune, 100), 0); assert.equal(status.getShieldValue(immune), 20);
});
check('weapon skill cannot spend cooldown or apply follow-up effects during silence', () => {
  const a = actor('a', ['침묵'], { weaponType: '양손검', weaponMasteryLevel: 20 }); const b = actor('b');
  const before = structuredClone(a);
  assert.equal(applyErWeaponSkillAfterCombat(a, b, { damageDealt: 100, nowSec: 100 }).applied, false);
  assert.deepEqual(a, before); assert.equal(b.hp, 1000);
});
function movement(a, extra = {}) {
  const log = record();
  const result = runActorMovementDecisionPhase({ state: { actor: a, phaseSurvivors: [a], craftables: [], publicItems: [],
    itemKeyById: {}, itemMetaById: {}, itemNameById: {}, kiosks: [], mapObj: { zones: [{ zoneId: 'zone' }, { zoneId: 'safe' }] },
    nextDay: 3, nextPhase: 'morning', phaseIdxNow: 6, nextSpawn: {}, ruleset, zoneGraph: graph,
    zones: [{ zoneId: 'zone' }, { zoneId: 'safe' }], forbiddenIds: new Set(['zone']), ...extra }, actions: log.actions });
  return { ...result, events: log.events };
}
check('actual ordinary and forbidden escape movement remain blocked until root expires', () => {
  const a = actor('a', ['속박']);
  const rooted = movement(a); assert.equal(rooted.didMove, false); assert.equal(rooted.nextZoneId, 'zone');
  assert.ok(rooted.events.some((row) => row.kind === 'action_blocked'));
  const free = status.updateEffects(a, { elapsedSec: 3 }); const moved = movement(free);
  assert.equal(moved.didMove, true); assert.equal(free.zoneId, 'safe');
});
check('root does not cancel externally applied knockback', () => {
  const a = actor('a', ['속박', effect('넉백', 3, { knockbackDistance: 1 })]);
  applyActorKnockbackMovement({ state: { actor: a, zoneGraph: graph } });
  assert.equal(a.zoneId, 'safe'); assert.equal(status.canMoveByStatus(a), false);
});
check('failed avoidance and forced flee cannot move a rooted actor or grant recovery protection', () => {
  const a = actor('a', ['속박']); const b = actor('b'); const rows = [a, b];
  const state = { actor: a, opponent: b, survivorMap: new Map(rows.map((row) => [row._id, row])), zoneGraph: graph, ruleset,
    currentActionSec: () => 100, totalZonesCount: 10 };
  assert.equal(resolvePvpAvoidanceMove({ state }).blocked, true);
  const rt = createPhaseCombatFleeRuntime({ state, tactical: createPhaseCombatTacticalRuntime({ state: { absNow: 100 } }) });
  assert.equal(rt.resolveFleeSequence(a, b, { forceAttempt: true }), null);
  assert.equal(a.zoneId, 'zone'); assert.equal(a._aiRecoverUntilSec, undefined); assert.equal(a._tacNextAbsSec, undefined);
});
check('a rooted pursuer cannot follow even a successful forced escape', () => {
  const flee = actor('flee'); const chaser = actor('chaser', ['속박']);
  const rt = createPhaseCombatFleeRuntime({ state: { currentActionSec: () => 100, zoneGraph: graph, totalZonesCount: 10,
    ruleset: { ai: { chaseBaseChance: 1 } }, survivorMap: new Map([flee, chaser].map((row) => [row._id, row])) } });
  const result = rt.resolveFleeSequence(flee, chaser, { forceAttempt: true });
  assert.equal(result.escaped, true); assert.equal(result.caught, false); assert.equal(flee.zoneId, 'safe'); assert.equal(chaser.zoneId, 'zone');
});
check('invulnerability prevents forbidden damage but is not a collar timer pause', () => {
  const a = actor('a', ['무적'], { detonationSec: 1, gadgetEnergy: 0 });
  const state = { updatedSurvivors: [a], forbiddenIds: new Set(['zone']), phaseDurationSec: 1, phaseIdxNow: 6, ruleset, suddenDeathActive: true };
  assert.equal(runDetonationTickPhase({ state }).updatedSurvivors[0].hp, 1000);
  assert.equal(runDetonationTickPhase({ state: { ...state, updatedSurvivors: [actor('unprotected')] } }).updatedSurvivors[0].hp, 950);
  const detonation = runDetonationTickPhase({ state: { ...state, useDetonation: true } });
  assert.equal(detonation.newlyDead.length, 1); assert.equal(detonation.newlyDead[0].hp, 0);
});
check('root blocks emergency teleport and stun blocks both emergency gadget activations', () => {
  const run = (effects) => runDetonationTickPhase({ state: { updatedSurvivors: [actor('a', effects,
    { detonationSec: 5, gadgetEnergy: 100, cooldowns: {} })], useDetonation: true, zoneGraph: graph,
    forbiddenIds: new Set(['zone']), phaseDurationSec: 1, ruleset } }).updatedSurvivors[0];
  assert.equal(run([]).zoneId, 'safe');
  assert.equal(run(['속박']).zoneId, 'zone');
  const stunned = run(['기절']); assert.equal(stunned.zoneId, 'zone'); assert.equal(stunned.gadgetEnergy, 100);
});
check('elapsed environmental damage uses the interval start protection including the expiry second', () => {
  for (const name of ['무적', '대상 지정 불가']) {
    const before = actor('a', [effect(name, 2)]);
    const after = status.updateEffects(before, { elapsedSec: 5 });
    const state = { updatedSurvivors: [after], intervalStartActors: [before], forbiddenIds: new Set(['zone']),
      phaseDurationSec: 5, phaseIdxNow: 6, ruleset, suddenDeathActive: true };
    assert.equal(runDetonationTickPhase({ state }).updatedSurvivors[0].hp, 850, name);
    let stepped = before;
    for (let second = 0; second < 5; second++) {
      const end = status.updateEffects(stepped, { elapsedSec: 1 });
      stepped = runDetonationTickPhase({ state: { ...state, updatedSurvivors: [end], intervalStartActors: [stepped], phaseDurationSec: 1 } }).updatedSurvivors[0];
    }
    assert.equal(stepped.hp, 850, name);
    assert.equal(before.hp, 1000);
  }
});
console.log(`COMBAT_STATUS_CHECKS ${checks}/${checks}`);
