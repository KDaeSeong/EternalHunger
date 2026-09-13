import assert from 'node:assert/strict';
import './lib/register-simulation-modules.mjs';

// Written only during the verification pause; this script has not been run.
const { assessDimensionRiftRecipients, expireEliminatedDimensionRiftReward } = await import('../src/app/simulation/_lib/dimensionRiftRecipientRuntime.js');
const { getRevivePhaseConfig } = await import('../src/app/simulation/_lib/revivalPolicyRuntime.js');
const { runPhaseRevival } = await import('../src/app/simulation/_lib/phaseRevivalRuntime.js');
const { tryClaimDimensionRiftReward, expireDimensionRiftReward } = await import('../src/app/simulation/_lib/dimensionRiftRewardRuntime.js');
const { runDimensionRiftPhase } = await import('../src/app/simulation/_lib/phaseDimensionRiftRuntime.js');
const { runPhaseWorldResolution } = await import('../src/app/simulation/_lib/phaseWorldResolutionRuntime.js');
const { closeDimensionRiftsAtMatchEnd } = await import('../src/app/simulation/_lib/dimensionRiftMatchEndRuntime.js');
const { buildDimensionRiftSpawn } = await import('../src/app/simulation/_lib/dimensionRiftRuntime.js');
const { cloneSpawnState, createInitialSpawnState } = await import('../src/app/simulation/_lib/spawnStateRuntime.js');
const { describeDimensionRiftRewardClosure, describeDimensionRiftMatchClosure } = await import('../src/app/simulation/_lib/dimensionRiftRewardPresentation.js');
const { describeObserverEvent } = await import('../src/app/simulation/_lib/teamObserverRuntime.js');
const { withSimulationRandom } = await import('../src/utils/simulationRandom.js');

let checks = 0;
function check(name, run) { run(); checks++; console.log(`PASS ${name}`); }
const actor = (id = 'a', extra = {}) => ({ _id: id, name: id, teamId: 'a', teamName: 'A',
  hp: 50, maxHp: 100, simCredits: 7, inventory: [], zoneId: 'z', activeEffects: [],
  stats: { maxHp: 100, attackPower: 20, defense: 0, attackSpeed: 1 }, ...extra });
const dead = (extra = {}) => actor('a', { hp: 0, _deathAt: 149, deadAtPhaseIdx: 3, revivedOnce: false, ...extra });
const won = () => ({ id: 'r', day: 2, phase: 'night', zoneId: 'z', resolved: true, status: 'settled',
  resolution: { id: 'r:resolution', atSec: 145, winnerTeamId: 'a', winnerMemberIds: ['a'] } });
const world = (subjects) => ({ ...createInitialSpawnState('map'), dimensionRifts: subjects });
const base = { phaseIdxNow: 3, nowSec: 150, canReviveThisMatch: true, rosterComplete: true };
const assess = (subject, rows, opts = {}) => assessDimensionRiftRecipients(subject, rows, { ...base, ...opts });
const expire = (subject, rows, opts = {}) => expireEliminatedDimensionRiftReward(subject, rows, { ...base, ...opts });
const claim = (subject, rows, nowSec = 150) => withSimulationRandom(() => 0.5,
  () => tryClaimDimensionRiftReward(subject, rows, { nowSec, publicItems: [{ _id: 'meteor', name: '운석', type: 'material' }] }));
const resources = (rows) => structuredClone(rows.map(({ hp, simCredits, inventory, skillState, revivedOnce }) =>
  ({ hp, simCredits, inventory, skillState, revivedOnce })));
const noRandom = () => { throw new Error('Assessing or expiring recipients must not consume RNG'); };
const revive = (rows, survivors, opts = {}) => withSimulationRandom(() => 0.5, () => runPhaseRevival({ state: {
  canReviveThisMatch: true, dead: rows, survivors, phaseIdxNow: 2, phaseStartSec: 150,
  mapObj: { zones: [{ zoneId: 'z' }] }, ruleset: {}, ...opts,
} }));

check('actual revival and recipient assessment share custom day and phase parsing', () => {
  const reviveCfg = { autoCutoff: { day: 4, phase: 'night' }, paidStart: { day: 5, phase: 'day' },
    paidCutoff: { day: 6, timeOfDay: 'night' }, teamWipeProtectionCutoff: { day: 3, phase: 'night' } };
  const cfg = getRevivePhaseConfig(reviveCfg); const actual = revive([], [], { reviveCfg });
  assert.equal(cfg.autoReviveIdx, 7); assert.equal(cfg.paidReviveStartIdx, 8);
  assert.equal(cfg.paidReviveCutoffIdx, 11); assert.equal(actual.reviveCutoffIdx, cfg.reviveCutoffIdx);
  assert.equal(actual.wipeProtectionCutoffIdx, cfg.wipeProtectionCutoffIdx);
});
check('an explicitly non-reviving match expires confirmed recipients without touching resources', () => {
  const subject = won(); const rows = [dead()]; const before = resources(rows);
  const out = withSimulationRandom(noRandom, () => expire(subject, rows, { canReviveThisMatch: false }));
  assert.equal(out.expired, true); assert.equal(out.closure.reason, 'recipients_eliminated');
  assert.equal(out.closure.creditsGranted, 0); assert.equal(out.closure.itemsGranted, 0);
  assert.equal(out.closure.eligibilityEvidence.canReviveThisMatch, false); assert.deepEqual(resources(rows), before);
});
check('unknown revival policy is not treated as revival disabled', () => {
  const subject = won(); assert.equal(expire(subject, [dead()], { canReviveThisMatch: undefined }).reason, 'unknown_revival_policy');
  assert.equal(subject.rewardClosure, undefined);
});
check('an absent eligible identity cannot be inferred dead from the rest of its team', () => {
  const subject = won(); const before = structuredClone(subject);
  assert.equal(expire(subject, [actor('helper')], { phaseIdxNow: 12 }).reason, 'unknown_recipient');
  assert.deepEqual(subject, before);
});
check('current living identity wins over an old corpse snapshot', () => {
  const out = assess(won(), [actor()], { dead: [dead()], phaseIdxNow: 12 });
  assert.equal(out.reason, 'living_recipient'); assert.equal(out.permanentlyEliminated, false);
});
check('a corpse predating the win is stale evidence, even after every revival cutoff', () => {
  assert.equal(expire(won(), [dead({ _deathAt: 140 })], { phaseIdxNow: 12 }).reason, 'unconfirmed_death');
});
check('transient zero HP and malformed death records are not confirmed elimination', () => {
  for (const extra of [{ deadAtPhaseIdx: undefined }, { deadAtPhaseIdx: -1 }, { hp: NaN },
    { _deathAt: null }, { _deathAt: '149' }, { hp: -1 }, { hp: '' }, { hp: '0' }, { hp: false }, { deadAtPhaseIdx: '3' }]) {
    assert.equal(expire(won(), [dead(extra)], { phaseIdxNow: 12 }).expired, false);
  }
});
check('future death times, future phases and changed team membership do not expire an offer', () => {
  for (const extra of [{ _deathAt: 151 }, { deadAtPhaseIdx: 4 }, { teamId: 'other' }]) {
    assert.equal(expire(won(), [dead(extra)]).expired, false);
  }
});
check('team-wipe protection keeps a recipient and the actual revival can restore them', () => {
  const row = dead({ deadAtPhaseIdx: 2 }); const out = assess(won(), [row], { phaseIdxNow: 2 });
  assert.equal(out.permanentlyEliminated, false); assert.ok(out.proof.recipients[0].paths.includes('auto'));
  assert.equal(revive([row], []).revivedNow.length, 1);
});
check('revivedOnce does not remove a live corpse-interaction path', () => {
  const row = dead({ deadAtPhaseIdx: 2, revivedOnce: true }); const helper = actor('helper');
  const out = assess(won(), [row, helper], { phaseIdxNow: 2 });
  assert.deepEqual(out.proof.recipients[0].paths, ['corpse_interaction']);
  assert.equal(revive([row], [helper]).revivedNow.length, 1);
});
check('the corpse interaction minimum duration boundary remains inclusive', () => {
  const row = dead({ deadAtPhaseIdx: 2, revivedOnce: true }); const helper = actor('helper');
  assert.equal(assess(won(), [row, helper], { phaseIdxNow: 2, nowSec: 174 }).permanentlyEliminated, false);
  assert.equal(assess(won(), [row, helper], { phaseIdxNow: 2, nowSec: 174.000001 }).permanentlyEliminated, true);
  assert.equal(revive([row], [helper], { phaseStartSec: 174 }).revivedNow.length, 1);
});
check('a completely known wiped team cannot pay or auto-revive after wipe protection ends', () => {
  const row = dead(); const out = expire(won(), [row, actor('enemy', { teamId: 'enemy' })]);
  assert.equal(out.expired, true); assert.equal(out.closure.eligibilityEvidence.teamCanRecover, false);
  assert.deepEqual(out.closure.eligibilityEvidence.recipients[0].paths, []);
});
check('an unadmitted living teammate keeps future paid revival possible despite no current credits or kiosk', () => {
  const out = assess(won(), [dead(), actor('helper', { simCredits: 0, zoneId: 'away' })], { phaseIdxNow: 4 });
  assert.equal(out.permanentlyEliminated, false); assert.deepEqual(out.proof.recipients[0].paths, ['kiosk_paid']);
});
check('a gap before paid revival opens is not permanent elimination', () => {
  const reviveCfg = { autoCutoff: { day: 1, phase: 'night' }, teamWipeProtectionCutoff: { day: 1, phase: 'night' },
    paidStart: { day: 4, phase: 'day' } };
  assert.equal(assess(won(), [dead(), actor('helper')], { phaseIdxNow: 4, reviveCfg }).permanentlyEliminated, false);
});
check('paid revival cutoff stays inclusive and only the next phase removes the path', () => {
  const rows = [dead(), actor('helper')];
  assert.equal(assess(won(), rows, { phaseIdxNow: 8 }).permanentlyEliminated, false);
  assert.equal(assess(won(), rows, { phaseIdxNow: 9 }).permanentlyEliminated, true);
});
check('a custom auto revival later than paid cutoff is still preserved', () => {
  const out = assess(won(), [dead(), actor('helper')], { phaseIdxNow: 9,
    reviveCfg: { autoCutoff: { day: 6, timeOfDay: 'night' } } });
  assert.equal(out.permanentlyEliminated, false); assert.deepEqual(out.proof.recipients[0].paths, ['auto']);
});
check('extended wipe protection can restore a team even after the nominal auto phase', () => {
  const reviveCfg = { teamWipeProtectionCutoff: { day: 6, timeOfDay: 'day' } }; const row = dead();
  assert.equal(assess(won(), [row], { phaseIdxNow: 9, reviveCfg }).permanentlyEliminated, false);
  assert.equal(revive([row], [], { phaseIdxNow: 9, reviveCfg }).revivedNow.length, 1);
});
check('an incomplete roster or a missing recorded teammate preserves a possible revival path', () => {
  assert.equal(assess(won(), [dead()], { rosterComplete: false }).permanentlyEliminated, false);
  const row = dead({ matchTeamRosterIds: ['a', 'missing'] });
  assert.equal(assess(won(), [row]).permanentlyEliminated, false);
  // A globally closed set of all revival windows does not require guessing teammates.
  assert.equal(assess(won(), [row], { phaseIdxNow: 9 }).permanentlyEliminated, true);
});
check('once revived, the recipient can become permanently eliminated after corpse revival closes', () => {
  const out = expire(won(), [dead({ revivedOnce: true }), actor('helper')]);
  assert.equal(out.expired, true); assert.equal(out.closure.eligibilityEvidence.recipients[0].revivedOnce, true);
});
check('the phase observer expires before the retry deadline and records it only once', () => {
  const subject = won(); claim(subject, [], 145); assert.equal(subject.rewardOffer.nextAttemptAtSec, 165);
  const spawn = world([subject]); const row = dead(); const events = []; const logs = [];
  const options = { state: { nextSpawn: spawn, nextDay: 2, nextPhase: 'night', phaseIdxNow: 3,
    currentActionSec: () => 150, updatedSurvivors: [row], revivalContext: { canReviveThisMatch: true, rosterComplete: true } },
    actions: { emitRunEvent: (kind, data) => events.push({ kind, ...data }), addLog: (text) => logs.push(text) } };
  runDimensionRiftPhase(options); runDimensionRiftPhase(options);
  assert.equal(subject.rewardOffer.status, 'expired'); assert.equal(subject.rewardClosure.atSec, 150);
  assert.equal(events.filter((event) => event.kind === 'dimension_rift_reward_closed').length, 1);
  assert.equal(events.some((event) => ['gain', 'dimension_rift_reward'].includes(event.kind)), false);
  assert.ok(logs.some((text) => text.includes('부활 불가')));
});
check('legacy observer callers without revival context do not accidentally disable revival', () => {
  const subject = won(); runDimensionRiftPhase({ state: { nextSpawn: world([subject]), phaseIdxNow: 3,
    nextDay: 2, nextPhase: 'night', currentActionSec: () => 150, updatedSurvivors: [dead()] } });
  assert.equal(subject.rewardClosure, undefined); assert.equal(subject.rewardOffer.status, 'pending');
});
check('the world-resolution entry point forwards confirmed dead roster and revival context', () => {
  const subject = won(); runPhaseWorldResolution({ state: { nextSpawn: world([subject]), deferTimeTicks: true,
    phaseIdxNow: 3, nextDay: 2, nextPhase: 'night', currentActionSec: () => 150,
    updatedSurvivors: [actor('enemy', { teamId: 'enemy' })],
    revivalContext: { dead: [dead()], canReviveThisMatch: true, rosterComplete: true } } });
  assert.equal(subject.rewardClosure.reason, 'recipients_eliminated');
});
check('JSON and eventual match end preserve the original expiry without a later payout or duplicate event', () => {
  const subject = won(); expire(subject, [dead()]); const receipt = structuredClone(subject.rewardClosure);
  const restored = cloneSpawnState(JSON.parse(JSON.stringify(world([subject]))), 'map'); const events = [];
  assert.equal(expire(restored.dimensionRifts[0], [dead()]).reason, 'reward_closed');
  assert.equal(claim(restored.dimensionRifts[0], [actor()], 200).claimed, false);
  const ending = closeDimensionRiftsAtMatchEnd(restored, [], { nowSec: 300,
    actions: { emitRunEvent: (kind) => events.push(kind) } });
  assert.deepEqual(restored.dimensionRifts[0].rewardClosure, receipt);
  assert.equal(events.includes('dimension_rift_reward_closed'), false);
  assert.equal(ending.summary.expiredWorldGifts, 1); assert.equal(ending.summary.expiredForElimination, 1);
});
check('future spawning retains early-expiry evidence and result text distinguishes its cause', () => {
  const subject = won(); expire(subject, [dead()]); const spawn = world([subject]);
  withSimulationRandom(() => 0.5, () => buildDimensionRiftSpawn(spawn, [{ zoneId: 'z' }], new Set(), 4, 'night', 'squad', 'map'));
  assert.ok(spawn.dimensionRifts.some((entry) => entry.id === 'r'));
  const result = closeDimensionRiftsAtMatchEnd(spawn, [], { nowSec: 300 });
  assert.match(describeDimensionRiftMatchClosure(result.summary), /경기 중 만료 1개/);
  assert.match(describeDimensionRiftRewardClosure(subject.rewardClosure), /전원 탈락 · 부활 불가/);
  assert.doesNotMatch(describeObserverEvent({ kind: 'dimension_rift_reward_closed', ...subject.rewardClosure }), /경기 종료/);
});
check('invalid offers and invalid clock rules cannot be erased by the elimination path', () => {
  assert.equal(expireDimensionRiftReward(won(), { nowSec: 150, reason: 'recipients_eliminated' }).reason, 'invalid_expiry_evidence');
  assert.equal(expireDimensionRiftReward(won(), { nowSec: 150, reason: 'recipients_eliminated',
    eligibilityEvidence: { nowSec: 150, recipients: [null] } }).reason, 'invalid_expiry_evidence');
  const subject = won(); claim(subject, [], 145); subject.rewardOffer.remaining = 2;
  const before = structuredClone(subject); assert.equal(expire(subject, [dead()]).expired, false); assert.deepEqual(subject, before);
  assert.equal(expire(won(), [dead()], { reviveCfg: { paidCutoff: { day: Infinity } } }).reason, 'invalid_revival_policy');
});

console.log(`Dimension-rift recipient checks: ${checks}`);
