import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';
const { runPhaseCombatEncounter } = await import('../src/app/simulation/_lib/phaseCombatEncounterRuntime.js');
const { collectTimedWildlifeOutcomes, transferTimedBossEncounter, getWildlifeOwnerDamageDealt,
  getWildlifeOwnerDamageTaken } = await import('../src/app/simulation/_lib/wildlifeCombatRuntime.js');
const { findCharacterSkillChoice, startCharacterCast, finishCharacterCast } = await import('../src/app/simulation/_lib/characterCastRuntime.js');
const { createSeedRng } = await import('../src/app/simulation/_lib/randomSeedRuntime.js');
const { withSimulationRandom } = await import('../src/utils/simulationRandom.js');
const { normalizeStatusEffect } = await import('../src/utils/statusEffectDefinitions.js');

const nowSec = 100;
const settings = { skills: { characterSkills: true } };
const ruleset = { ai: { escapeHpBelow: 0, recoverHpBelow: 38, huntRetreatHpRatio: 0.22 },
  pvp: { criticalFleeHpBelow: 0, criticalFleeChance: 0, teamCombatEnabled: true } };
const actor = (id, teamId, x, extra = {}) => ({ _id: id, name: id, teamId, zoneId: 'zone', hp: 1000, maxHp: 1000,
  inventory: [], simCredits: 0, tacticalSkill: 'none', _tacNextAbsSec: 1e9,
  stats: { maxHp: 1000, attackPower: 120, defense: 0, attackSpeed: 1, moveSpeed: 3, attackRange: 8, sightRange: 20 },
  _spatial: { zoneId: 'zone', x, y: 4 }, ...extra });

function prepareHuntHit({ direct = false, includeSuccessor = false, hunterEffects = [], hunterReadyAt = nowSec + 1,
  basicReadyAt = 140, recoveryUntil = 0, casterIntent = null } = {}) {
  const hunter = actor('hunter', 'blue', 5.5, { _actionReadyAtSec: hunterReadyAt,
    _basicAttackReadyAtSec: basicReadyAt, _recentCombatUntil: recoveryUntil,
    ...(hunterEffects.length ? { activeEffects: structuredClone(hunterEffects) } : {}) });
  const encounterId = 'hunt:owner';
  const wildlifeTarget = { _id: 'wildlife:boss', name: '공유 보스', hp: 500, maxHp: 500, zoneId: 'zone',
    _wildlifeKind: 'boss', _basicAttackReadyAtSec: 123, _lastBasicAttackAtSec: 120,
    stats: { attackPower: 1, defense: 0, attackSpeed: 1, moveSpeed: 0, attackRange: 1 } };
  const encounter = { id: encounterId, kind: 'boss', isBossReward: true, zoneId: 'zone', target: wildlifeTarget,
    claim: { source: 'boss', key: 'test-boss', claimantId: hunter._id, engagementId: encounterId },
    startedHp: 900, startedHpByActor: {}, damageDealt: 40, damageTaken: 20,
    assistDamageDealt: { successor: 10 }, assistDamageTaken: { successor: 4 },
    actionKey: 'phase:2:cycle:owner-cycle' };
  hunter._wildlifeHunt = encounter;
  hunter._actionCycleKey = 'owner-cycle';
  const successor = includeSuccessor ? actor('successor', 'blue', 6, { hp: 800, maxHp: 1000,
    inventory: [{ itemId: 'kept', qty: 1 }], simCredits: 7, _actionCycleKey: 'successor-cycle' }) : null;
  if (includeSuccessor) encounter.startedHpByActor.successor = successor.hp;

  const caster = actor('caster', 'red', 4, { _basicAttackReadyAtSec: 500,
    characterSkills: { q: { enabled: true, name: '준비된 광역 타격', type: 'attack_skill', flatDamage: [90],
      range: 8, radius: 2, targetPriority: 'lowest_hp', cooldownSec: 20, castDelaySec: 0, recoveryDelaySec: 0 } },
    ...(casterIntent ? { _combatIntent: structuredClone(casterIntent) } : {}) });
  const primary = direct ? hunter : actor('primary', 'blue', 5, { hp: 400, _basicAttackReadyAtSec: 500 });
  const roster = [caster, ...(direct ? [] : [primary]), hunter, ...(successor ? [successor] : [])];
  const survivorMap = new Map(roster.map((row) => [row._id, row]));
  const nextSpawn = { bosses: { 'test-boss': { alive: true, zoneId: 'zone', engagedBy: hunter._id, engagementId: encounterId } } };
  const events = [];
  const actions = { emitRunEvent: (kind, data, at) => events.push({ ...data, subkind: data.kind, kind, at }),
    atNow: () => ({ day: 2, phase: 'night', sec: nowSec }), addLog: () => {} };
  const opponents = roster.filter((row) => row._id !== caster._id && row.teamId !== caster.teamId);
  const choice = findCharacterSkillChoice(caster, opponents, roster, nowSec, settings);
  assert.ok(choice, 'A real authored skill choice must prepare the fixture attack.');
  assert.equal(choice.targetId, direct ? hunter._id : primary._id, 'Only direct-mode makes the hunter the primary target.');
  assert.equal(startCharacterCast(caster, choice, nowSec, settings, actions), true);
  const preparedSkill = finishCharacterCast(caster, nowSec, actions);
  assert.ok(preparedSkill, 'The attack must pass through the real cast preparation/release API.');
  withSimulationRandom(createSeedRng(`hunt-pvp-handoff-${direct}-${includeSuccessor}`), () => runPhaseCombatEncounter({
    state: { actor: caster, target: primary, actionType: 'skill_release', preparedSkill,
      battleSettings: settings, currentActionSec: () => nowSec, phaseIdxNow: 2, ruleset, survivorMap,
      phaseSurvivors: roster, todaysSurvivors: roster, newDeadIds: [], roundAssists: {}, roundKills: {}, estimatePower: () => 1 },
    actions,
  }));
  const live = new Map([...survivorMap].map(([id, row]) => [id, row]));
  const hunterHit = events.find((event) => event.kind === 'damage' && event.targetId === hunter._id
    && event.hpDamage > 0 && (direct ? !Object.hasOwn(event, 'areaDistance') : Number.isFinite(event.areaDistance)));
  const liveHunter = live.get(hunter._id);
  return { caster: live.get(caster._id), primary: live.get(primary._id), hunter: liveHunter,
    successor: successor ? live.get(successor._id) : null, encounter: liveHunter._wildlifeHunt,
    encounterId, events, hunterHit, roster: [...live.values()], survivorMap: live, direct,
    nextSpawn, actions, preparedSkill };
}

function assertInterrupted(fixture, { direct = false } = {}) {
  assert.equal(fixture.direct, direct, 'The claimed primary/splash case must match the actual prepared attack.');
  assert.ok(fixture.hunterHit, 'The hunting owner must take actual positive HP damage.');
  assert.equal(fixture.hunterHit.type, 'skill');
  assert.equal(fixture.encounter.pvpInterruptedOwnerId, fixture.hunter._id);
  assert.equal(fixture.encounter.pvpInterruptedBy, fixture.caster._id);
  assert.equal(fixture.encounter.pvpInterruptedAtSec, nowSec);
  const outcome = collectTimedWildlifeOutcomes([...fixture.survivorMap.values()])
    .find((row) => row.actor._id === fixture.hunter._id);
  assert.equal(outcome?.type, 'cancel');
  assert.equal(outcome?.reason, '실험체 교전 개입');
  if (direct) assert.equal(Object.hasOwn(fixture.hunterHit, 'areaDistance'), false,
    'A primary-hit assertion must not accidentally accept an AoE event.');
  return outcome;
}

// Isolated integration fixture: the primary cast is resolved through the real
// prepared-skill path; the following attacker death is a controlled setup for
// checking boss handoff, not natural-match victory or hunt-interruption causality.
const casterIntent = { zoneId: 'zone', combatSpaceId: 'world', enemyTeamId: 'blue',
  targetId: 'primary', focusTargetId: 'primary' };
const handoffFixture = prepareHuntHit({ includeSuccessor: true, casterIntent });
assertInterrupted(handoffFixture);
assert.deepEqual(handoffFixture.caster._combatIntent, casterIntent,
  'The AoE callback must not retarget the attacker away from its existing focus.');
assert.equal(handoffFixture.successor._combatIntent, undefined,
  'An unhit boss teammate stays eligible for the normal successor selector.');
assert.ok(handoffFixture.events.some((event) => event.kind === 'damage' && event.targetId === 'successor'
  && event.hpDamage > 0), 'The buddy is a real in-area survivor, not removed from the splash roster.');
const encounterIdBeforeRestore = handoffFixture.encounter.id;
const bossHpBeforeRestore = handoffFixture.encounter.target.hp;
const targetReadyBeforeRestore = handoffFixture.encounter.target._basicAttackReadyAtSec;
const targetLastAttackBeforeRestore = handoffFixture.encounter.target._lastBasicAttackAtSec;
const damageBeforeRestore = handoffFixture.encounter.damageDealt;
const takenBeforeRestore = handoffFixture.encounter.damageTaken;
const casterCooldownBeforeRestore = handoffFixture.caster.skillState.q.cooldownUntil;
const moneyBeforeRestore = [handoffFixture.hunter.simCredits, handoffFixture.successor.simCredits];
const inventoryBeforeRestore = structuredClone([handoffFixture.hunter.inventory, handoffFixture.successor.inventory]);
const successorStartedHpBeforeRestore = handoffFixture.encounter.startedHpByActor.successor;

// Marker and claim are JSON-safe and remain bound to the same owner on restore.
const restoredRows = JSON.parse(JSON.stringify([...handoffFixture.survivorMap.values()]));
const restoredRoster = restoredRows;
const restoredMap = new Map(restoredRows.map((row) => [row._id, row]));
const restoredOwner = restoredMap.get(handoffFixture.hunter._id);
const restoredSuccessor = restoredMap.get(handoffFixture.successor._id);
const restoredCaster = restoredMap.get(handoffFixture.caster._id);
const restoredEncounter = restoredOwner._wildlifeHunt;
const restoredSpawn = JSON.parse(JSON.stringify(handoffFixture.nextSpawn));
assert.equal(restoredEncounter.id, encounterIdBeforeRestore);
assert.equal(restoredEncounter.pvpInterruptedOwnerId, restoredOwner._id);
assert.equal(collectTimedWildlifeOutcomes(restoredRoster).find((row) => row.actor._id === restoredOwner._id)?.reason,
  '실험체 교전 개입', 'JSON restore must preserve this owner’s unresolved hostile-hit marker.');
const mismatchedOwner = structuredClone(restoredOwner);
mismatchedOwner._combatIntent = null;
mismatchedOwner._wildlifeHunt.pvpInterruptedOwnerId = 'different-owner';
assert.deepEqual(collectTimedWildlifeOutcomes([mismatchedOwner]), [],
  'A marker bound to someone else cannot cancel this owner in isolation.');

// Controlled source death occurs only after the actual hit/marker; the existing
// successor selector, not a mocked choice or rewritten readiness, must transfer.
restoredCaster.hp = 0;
const transferEvents = [];
const transferActions = { atNow: () => ({ day: 2, phase: 'night', sec: nowSec }), addLog: () => {},
  emitRunEvent: (kind, data, at) => transferEvents.push({ ...data, subkind: data.kind, kind, at }) };
const transferred = transferTimedBossEncounter(restoredOwner, restoredSpawn, restoredRoster, {
  nowSec, phaseIdxNow: 3, reason: '통제된 공격자 사망', ruleset, forbiddenIds: new Set(), actions: transferActions,
});
assert.equal(transferred, restoredSuccessor, 'The actual eligible live teammate must receive the existing encounter.');
assert.equal(restoredOwner._wildlifeHunt, null);
assert.equal(restoredSuccessor._wildlifeHunt, restoredEncounter);
assert.equal(restoredEncounter.id, encounterIdBeforeRestore);
assert.equal(restoredEncounter.target.hp, bossHpBeforeRestore);
assert.equal(restoredEncounter.target._basicAttackReadyAtSec, targetReadyBeforeRestore);
assert.equal(restoredEncounter.target._lastBasicAttackAtSec, targetLastAttackBeforeRestore);
assert.equal(restoredEncounter.damageDealt, damageBeforeRestore);
assert.equal(restoredEncounter.damageTaken, takenBeforeRestore);
assert.equal(restoredEncounter.assistDamageDealt.hunter, damageBeforeRestore - 10);
assert.equal(Object.hasOwn(restoredEncounter.assistDamageDealt, 'successor'), false);
assert.equal(getWildlifeOwnerDamageDealt(restoredEncounter), 10);
assert.equal(restoredEncounter.assistDamageTaken.hunter, takenBeforeRestore - 4);
assert.equal(Object.hasOwn(restoredEncounter.assistDamageTaken, 'successor'), false);
assert.equal(getWildlifeOwnerDamageTaken(restoredEncounter), 4);
assert.equal(restoredEncounter.startedHpByActor.hunter, 900);
assert.equal(restoredEncounter.startedHp, successorStartedHpBeforeRestore);
assert.equal(restoredEncounter.claim.claimantId, restoredSuccessor._id);
assert.equal(restoredSpawn.bosses['test-boss'].engagedBy, restoredSuccessor._id);
assert.equal(restoredSpawn.bosses['test-boss'].engagementId, encounterIdBeforeRestore);
assert.equal(restoredEncounter.target._wildlifeOwnerId, restoredSuccessor._id);
assert.ok(restoredOwner._actionReadyAtSec >= nowSec + 2,
  'The interrupted old owner still pays the normal handoff action delay.');
for (const field of ['pvpInterruptedBy', 'pvpInterruptedAtSec', 'pvpInterruptedOwnerId']) {
  assert.equal(Object.hasOwn(restoredEncounter, field), false, `A legitimate transfer must clear ${field}.`);
}
assert.deepEqual(collectTimedWildlifeOutcomes(restoredRoster), [],
  'The new owner must not inherit a stale interruption that immediately cancels the transferred hunt.');
assert.equal(transferEvents.filter((event) => event.kind === 'hunt_transfer').length, 1);
assert.equal(transferEvents.some((event) => ['hunt_end', 'hunt_settlement', 'hunt_reward'].includes(event.kind)), false);
assert.equal(restoredSpawn.bosses['test-boss'].alive, true);
assert.equal(restoredCaster.skillState.q.cooldownUntil, casterCooldownBeforeRestore,
  'The completed AoE cast remains spent after its victim’s later transfer.');
assert.deepEqual([restoredOwner.simCredits, restoredSuccessor.simCredits], moneyBeforeRestore,
  'Handoff must not create an unearned reward.');
assert.deepEqual([restoredOwner.inventory, restoredSuccessor.inventory], inventoryBeforeRestore,
  'Handoff must not duplicate or synthesize inventory rewards.');
assert.equal(transferTimedBossEncounter(restoredOwner, restoredSpawn, restoredRoster, {
  nowSec, phaseIdxNow: 3, reason: '중복 호출', ruleset, forbiddenIds: new Set(), actions: transferActions,
}), null);
assert.equal(transferEvents.filter((event) => event.kind === 'hunt_transfer').length, 1,
  'The old owner cannot transfer or settle the same claim twice.');
console.log('PASS owner-bound AoE interruption survives JSON restore and transfers one live boss encounter without stale cancellation');

const directFixture = prepareHuntHit({ direct: true });
assertInterrupted(directFixture, { direct: true });
console.log('PASS a prepared primary hit directly interrupts a surviving hunting owner');

for (const [name, status] of [
  ['stun', normalizeStatusEffect({ name: '기절', remainingDuration: 8, durationUnit: 'sec' })],
  ['forced control', normalizeStatusEffect({ name: '도발', remainingDuration: 8, durationUnit: 'sec', sourceActorId: 'caster' })],
]) {
  const fixture = prepareHuntHit({ hunterEffects: [status], hunterReadyAt: 103, basicReadyAt: 140, recoveryUntil: 106 });
  assertInterrupted(fixture);
  assert.deepEqual(fixture.hunter.activeEffects, [status], `${name}: the interruption must not clear or rewrite CC.`);
  assert.equal(fixture.hunter._actionReadyAtSec, 103, `${name}: marker creation must not lower action readiness.`);
  assert.equal(fixture.hunter._basicAttackReadyAtSec, 140, `${name}: marker creation must not reset the basic clock.`);
  assert.equal(fixture.hunter._recentCombatUntil, 106, `${name}: marker creation must not shorten AI recovery.`);
}
console.log('PASS stun, forced control and recovery/readiness state remain owned by their normal gates');
