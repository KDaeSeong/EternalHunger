import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';
const { runPhaseCombatEncounter } = await import('../src/app/simulation/_lib/phaseCombatEncounterRuntime.js');
const { collectTimedWildlifeOutcomes, releaseTimedWildlifeEncounter } = await import('../src/app/simulation/_lib/wildlifeCombatRuntime.js');
const { findNextCombatAction } = await import('../src/app/simulation/_lib/combatTimingRuntime.js');
const { findCharacterSkillChoice, startCharacterCast, finishCharacterCast } = await import('../src/app/simulation/_lib/characterCastRuntime.js');
const { makeShieldEffect, normalizeStatusEffect } = await import('../src/utils/statusEffectDefinitions.js');

const nowSec = 100;
const settings = { skills: { characterSkills: true } };
const ruleset = { ai: { escapeHpBelow: 0 }, pvp: { criticalFleeHpBelow: 0, criticalFleeChance: 0, teamCombatEnabled: true } };
const actor = (id, teamId, x, extra = {}) => ({ _id: id, name: id, teamId, zoneId: 'zone', hp: 1000, maxHp: 1000,
  inventory: [], tacticalSkill: 'none', _tacNextAbsSec: 1e9,
  stats: { maxHp: 1000, attackPower: 120, defense: 0, attackSpeed: 1, moveSpeed: 3, attackRange: 8, sightRange: 20 },
  _spatial: { zoneId: 'zone', x, y: 4 }, ...extra });

function makeHuntClaim(owner, source = 'wildlife') {
  const encounterId = `hunt:${owner._id}`;
  const target = { _id: `wildlife:${owner._id}`, name: '야생 목표', hp: 500, maxHp: 500, zoneId: 'zone',
    _wildlifeKind: source === 'boss' ? 'boss' : 'chicken', stats: { attackPower: 1, defense: 0, attackSpeed: 1, moveSpeed: 0, attackRange: 1 } };
  const claim = source === 'boss'
    ? { source: 'boss', key: 'test-boss', claimantId: owner._id, engagementId: encounterId }
    : { source: 'wildlife', claimantId: owner._id, engagementId: encounterId, zoneId: 'zone', hadSpeciesList: false };
  owner._wildlifeHunt = { id: encounterId, kind: target._wildlifeKind, zoneId: 'zone', target, claim,
    startedHp: owner.hp, damageDealt: 0, damageTaken: 0 };
  const nextSpawn = source === 'boss'
    ? { bosses: { 'test-boss': { alive: true, engagedBy: owner._id, engagementId: encounterId } } }
    : { wildlife: { zone: 3 } };
  return { encounterId, nextSpawn };
}

function releasePreparedAreaSkill({ source = 'wildlife', huntTeam = 'blue', huntOptions = {}, casterTeam = 'red', primaryTeam = 'blue',
  hunterCombatSpace = '', primaryCombatSpace = '', hunterEffects = [] } = {}) {
  const hunter = actor('hunter', huntTeam, 5.5, { _actionReadyAtSec: nowSec + 1, ...huntOptions,
    ...(hunterCombatSpace ? { _combatSpaceId: hunterCombatSpace } : {}),
    ...(hunterEffects.length ? { activeEffects: hunterEffects } : {}) });
  const claim = makeHuntClaim(hunter, source);
  const caster = actor('caster', casterTeam, 4, { _basicAttackReadyAtSec: 500,
    characterSkills: { q: { enabled: true, name: '준비된 광역 타격', type: 'attack_skill', flatDamage: [90],
      range: 8, radius: 2, targetPriority: 'lowest_hp', cooldownSec: 20, castDelaySec: 0, recoveryDelaySec: 0 } } });
  const primary = actor('primary', primaryTeam, 5, { hp: 400, _basicAttackReadyAtSec: 500,
    ...(primaryCombatSpace ? { _combatSpaceId: primaryCombatSpace } : {}) });
  const roster = [caster, primary, hunter];
  const survivorMap = new Map(roster.map((row) => [row._id, row]));
  const events = [];
  let clockSec = nowSec;
  const actions = { emitRunEvent: (kind, data, at) => events.push({ ...data, subkind: data.kind, kind, at }),
    atNow: () => ({ day: 1, phase: 'morning', sec: clockSec }), addLog: () => {} };
  const opponents = roster.filter((row) => row._id !== caster._id && row.teamId !== caster.teamId);
  const choice = findCharacterSkillChoice(caster, opponents, roster, nowSec, settings);
  assert.ok(choice, 'The fixture must select a real AoE skill plan.');
  assert.equal(choice.targetId, primary._id, 'The primary target must be distinct from the hunting owner.');
  assert.equal(startCharacterCast(caster, choice, nowSec, settings, actions), true);
  const preparedSkill = finishCharacterCast(caster, nowSec, actions);
  assert.ok(preparedSkill, 'The cast lifecycle must produce the prepared release payload.');

  const result = runPhaseCombatEncounter({ state: { actor: caster, target: primary, actionType: 'skill_release', preparedSkill,
    battleSettings: settings, currentActionSec: () => nowSec, phaseIdxNow: 1, ruleset, survivorMap,
    phaseSurvivors: roster, todaysSurvivors: roster, newDeadIds: [], roundAssists: {}, roundKills: {}, estimatePower: () => 1 }, actions });
  const liveCaster = survivorMap.get(caster._id);
  const livePrimary = survivorMap.get(primary._id);
  const liveHunter = survivorMap.get(hunter._id);
  const liveRoster = [...survivorMap.values()];
  const hit = events.find((event) => event.kind === 'damage' && event.targetId === hunter._id && event.type === 'skill');
  return { caster: liveCaster, primary: livePrimary, hunter: liveHunter, roster: liveRoster, survivorMap, events, result, hit,
    setNow: (sec) => { clockSec = sec; }, ...claim, actions };
}

function expectPvpCancellation(fixture) {
  assert.ok(fixture.hit && fixture.hit.hpDamage > 0, 'The hunting owner must receive positive actual HP damage from splash.');
  assert.ok(fixture.hunter.hp < 1000);
  const outcome = collectTimedWildlifeOutcomes(fixture.roster).find((row) => row.actor === fixture.hunter);
  assert.equal(outcome?.type, 'cancel');
  assert.equal(outcome?.reason, '실험체 교전 개입');
  return outcome;
}

function closeHunt(fixture, outcome) {
  const beforeCooldown = Number(fixture.caster.skillState?.q?.cooldownUntil || 0);
  const released = releaseTimedWildlifeEncounter(fixture.hunter, fixture.nextSpawn, outcome.reason, fixture.actions, nowSec);
  assert.equal(released?.id, fixture.encounterId);
  assert.equal(fixture.hunter._wildlifeHunt, null);
  assert.ok(fixture.hunter._actionReadyAtSec >= nowSec + 2, 'Interruption preserves the normal post-hunt action delay.');
  assert.equal(fixture.caster.skillState.q.cooldownUntil, beforeCooldown, 'Ending the hunt must not refund the actual AoE cast cooldown.');
  assert.equal(fixture.events.filter((event) => event.kind === 'hunt_end' && event.encounterId === fixture.encounterId).length, 1);
  assert.equal(releaseTimedWildlifeEncounter(fixture.hunter, fixture.nextSpawn, outcome.reason, fixture.actions, nowSec), null);
  assert.equal(fixture.events.filter((event) => event.kind === 'hunt_end' && event.encounterId === fixture.encounterId).length, 1,
    'A settled claim cannot emit a duplicate end or reward.');
}

for (const source of ['wildlife', 'boss']) {
  const fixture = releasePreparedAreaSkill({ source });
  const outcome = expectPvpCancellation(fixture);
  closeHunt(fixture, outcome);
  if (source === 'wildlife') assert.equal(fixture.nextSpawn.wildlife.zone, 4, 'An interrupted ordinary claim returns once, without a defeat reward.');
  else {
    const boss = fixture.nextSpawn.bosses['test-boss'];
    assert.equal(boss.alive, true, 'An interrupted boss remains alive.');
    assert.equal(boss.engagedBy, undefined);
    assert.equal(boss.engagementId, undefined);
    assert.equal(boss.defeatedBy, undefined, 'An interrupted boss receives no defeat/reward record.');
  }
}

const ready = releasePreparedAreaSkill();
const readyOutcome = expectPvpCancellation(ready);
closeHunt(ready, readyOutcome);
const next = findNextCombatAction(ready.survivorMap, nowSec + 2);
assert.equal(next?.actorId, ready.hunter._id, 'After the normal action delay, the interrupted hunter re-enters the PvP scheduler.');
assert.equal(next?.actionType, 'basic');
assert.ok(next.atSec >= nowSec + 2);
const beforeReadyAttack = ready.caster.hp;
const cooldownBeforeReadyAttack = ready.caster.skillState.q.cooldownUntil;
ready.setNow(next.atSec);
runPhaseCombatEncounter({ state: { actor: ready.hunter, target: ready.survivorMap.get(next.targetId), actionType: 'basic',
  battleSettings: settings, currentActionSec: () => next.atSec, phaseIdxNow: 1, ruleset, survivorMap: ready.survivorMap,
  phaseSurvivors: [...ready.survivorMap.values()], todaysSurvivors: [...ready.survivorMap.values()], newDeadIds: [],
  roundAssists: {}, roundKills: {}, estimatePower: () => 1 }, actions: ready.actions });
assert.ok(ready.survivorMap.get(ready.caster._id).hp < beforeReadyAttack, 'The scheduled action must produce real PvP HP damage.');
assert.ok(ready.events.some((event) => event.kind === 'damage' && event.who === ready.hunter._id && event.type === 'basic'
  && event.hpDamage > 0), 'The interrupted hunter must execute its own real basic attack.');
assert.equal(ready.survivorMap.get(ready.caster._id).skillState.q.cooldownUntil, cooldownBeforeReadyAttack,
  'The already-spent AoE cast cooldown remains spent after the hunter retaliates.');
console.log('PASS actual AoE HP hit interrupts a hunting owner and restores ordinary PvP scheduling');

const recovering = releasePreparedAreaSkill({ huntOptions: { _recentCombatUntil: nowSec + 5 } });
const recoveringOutcome = expectPvpCancellation(recovering);
closeHunt(recovering, recoveringOutcome);
const recoveryBefore = { hp: recovering.hunter.hp, actionReadyAtSec: recovering.hunter._actionReadyAtSec,
  basicAttackReadyAtSec: recovering.hunter._basicAttackReadyAtSec, recoveryUntil: recovering.hunter._recentCombatUntil };
recovering.setNow(nowSec + 2);
runPhaseCombatEncounter({ state: { actor: recovering.hunter, target: recovering.caster, actionType: 'basic',
  battleSettings: settings, currentActionSec: () => nowSec + 2, phaseIdxNow: 1, ruleset, survivorMap: recovering.survivorMap,
  phaseSurvivors: [...recovering.survivorMap.values()], todaysSurvivors: [...recovering.survivorMap.values()], newDeadIds: [],
  roundAssists: {}, roundKills: {}, estimatePower: () => 1 }, actions: recovering.actions });
const recoveryAfter = recovering.survivorMap.get(recovering.hunter._id);
assert.equal(recoveryAfter.hp, recoveryBefore.hp, 'A recovery-locked hunter cannot get a free counterattack.');
assert.equal(recovering.events.some((event) => event.kind === 'damage' && event.who === recoveryAfter._id && event.type === 'basic'), false);
assert.equal(recoveryAfter._actionReadyAtSec, recoveryBefore.actionReadyAtSec);
assert.equal(recoveryAfter._basicAttackReadyAtSec, recoveryBefore.basicAttackReadyAtSec);
assert.equal(recoveryAfter._recentCombatUntil, recoveryBefore.recoveryUntil);
console.log('PASS recovery lock suppresses counterattacks while still releasing the interrupted hunt');

for (const [label, extra] of [
  ['fully absorbed shield', { hunterEffects: [makeShieldEffect(10000, 10)] }],
  ['invulnerability', { hunterEffects: [normalizeStatusEffect({ name: '무적', remainingDuration: 10, durationUnit: 'sec' })] }],
  ['friendly target', { casterTeam: 'blue', primaryTeam: 'red' }],
]) {
  const fixture = releasePreparedAreaSkill(extra);
  assert.ok(!fixture.hit || fixture.hit.hpDamage === 0, `${label}: no actual hostile HP loss.`);
  assert.equal(collectTimedWildlifeOutcomes(fixture.roster).some((row) => row.actor === fixture.hunter
    && row.type === 'cancel' && row.reason === '실험체 교전 개입'), false, `${label}: no PvP interruption.`);
  assert.ok(fixture.hunter._wildlifeHunt, `${label}: the valid claim remains open.`);
}
console.log('PASS no-HP-loss and friendly AoE cases do not interrupt valid hunts');

const separated = releasePreparedAreaSkill({ hunterCombatSpace: 'dimension_rift:isolated' });
assert.equal(separated.hit, undefined, 'A hunter in another combat space is not included in the actual splash hit.');
assert.equal(collectTimedWildlifeOutcomes(separated.roster).some((row) => row.actor === separated.hunter
  && row.type === 'cancel' && row.reason === '실험체 교전 개입'), false,
  'Spatial separation alone is not labeled as PvP intervention.');
console.log('PASS a spatially separate hunter is not recorded as a PvP splash victim');
