import assert from 'node:assert/strict';
import './lib/register-simulation-modules.mjs';

// Written during the user-requested verification pause. Do not run until resumed.
const { tryClaimDimensionRiftReward } = await import('../src/app/simulation/_lib/dimensionRiftRewardRuntime.js');
const { closeDimensionRiftsAtMatchEnd } = await import('../src/app/simulation/_lib/dimensionRiftMatchEndRuntime.js');
const { describeDimensionRiftMatchClosure } = await import('../src/app/simulation/_lib/dimensionRiftRewardPresentation.js');
const { advanceDimensionRiftContest, findActorDimensionRift } = await import('../src/app/simulation/_lib/dimensionRiftContestRuntime.js');
const { enterDimensionRiftSpace } = await import('../src/app/simulation/_lib/dimensionRiftSpaceRuntime.js');
const { buildDimensionRiftSpawn, listActiveDimensionRifts } = await import('../src/app/simulation/_lib/dimensionRiftRuntime.js');
const { runDimensionRiftPhase } = await import('../src/app/simulation/_lib/phaseDimensionRiftRuntime.js');
const { finalizeSimulationPhase } = await import('../src/app/simulation/_lib/phaseFinalizationRuntime.js');
const { cloneSpawnState, createInitialSpawnState } = await import('../src/app/simulation/_lib/spawnStateRuntime.js');
const { commitRuntimeHpDamage } = await import('../src/utils/dimensionRiftDefeatLogic.js');
const { getCombatSpaceId } = await import('../src/utils/combatSpaceLogic.js');
const { describeObserverEvent, buildTeamObserverModel } = await import('../src/app/simulation/_lib/teamObserverRuntime.js');
const { withSimulationRandom } = await import('../src/utils/simulationRandom.js');

let checks = 0;
async function check(name, run) { await run(); checks++; console.log(`PASS ${name}`); }
const item = { _id: 'meteor', name: '운석', type: 'material', tier: 4, tags: ['meteor'] };
const ruleset = { inventory: { maxSlots: 1, stackMax: { material: 6 }, autoDropLowValue: false },
  worldSpawns: { dimensionRift: { rewardCreditsByDay: { 2: 45 } } } };
const settings = { characterSkillsEnabled: true };
const actor = (id = 'a', extra = {}) => ({ _id: id, name: id, teamId: id, teamName: id,
  hp: 50, maxHp: 100, simCredits: 7, inventory: [], zoneId: 'z', activeEffects: [],
  stats: { maxHp: 100, attackPower: 20, defense: 0, attackSpeed: 1 },
  _spatial: { zoneId: 'z', x: 4, y: 4 }, ...extra });
const rift = (extra = {}) => ({ id: 'r', day: 2, phase: 'night', zoneId: 'z', resolved: false, entrants: [], ...extra });
const won = (extra = {}) => rift({ resolved: true, status: 'settled', winnerTeamId: 'a',
  resolution: { id: 'r:resolution', atSec: 145, winnerTeamId: 'a', winnerMemberIds: ['a'], reason: 'uncontested' }, ...extra });
const spawn = (rifts) => ({ ...createInitialSpawnState('map'), dimensionRifts: rifts });
const claim = (subject, rows, nowSec = 145, opts = {}) => withSimulationRandom(() => 0.5,
  () => tryClaimDimensionRiftReward(subject, rows, { publicItems: [item], ruleset, nowSec, day: 2, ...opts }));
const close = (world, rows, opts = {}) => closeDimensionRiftsAtMatchEnd(world, rows,
  { nowSec: 150, day: 2, phase: 'night', ruleset, battleSettings: settings, ...opts });
const resources = (rows) => structuredClone(rows.map(({ hp, maxHp, simCredits, inventory, skillState }) =>
  ({ hp, maxHp, simCredits, inventory, skillState })));
const noRandom = () => { throw new Error('Closing a match must not select loot or use RNG'); };

await check('a full bag expires the one pending gift and all linked credits without spending either', () => {
  const row = actor('a', { inventory: [{ itemId: 'held', type: 'material', qty: 6 }] }); const subject = won();
  assert.equal(claim(subject, [row]).reason, 'inventory_full'); const before = resources([row]);
  const out = withSimulationRandom(noRandom, () => close(spawn([subject]), [row]));
  assert.equal(out.summary.expiredWorldGifts, 1); assert.equal(subject.rewardOffer.status, 'expired');
  assert.equal(subject.rewardOffer.remaining, 0); assert.equal(subject.rewardOffer.nextAttemptAtSec, null);
  assert.equal(subject.rewardClosure.pendingReason, 'inventory_full'); assert.equal(subject.rewardClosure.creditsGranted, 0);
  assert.deepEqual(resources([row]), before);
});
await check('moving away is not permission for an automatic last-frame reward', () => {
  const row = actor('a', { zoneId: 'away' }); const subject = won();
  assert.equal(claim(subject, [row]).reason, 'recipient_away'); close(spawn([subject]), [row]);
  row.zoneId = 'z'; assert.equal(claim(subject, [row], 200).reason, 'reward_closed');
  assert.equal(row.inventory.length, 0); assert.equal(row.simCredits, 7);
});
await check('missing catalog content closes without inventing an item or rerolling', () => {
  const row = actor(); const subject = won(); assert.equal(claim(subject, [row], 145, { publicItems: [] }).reason, 'missing_catalog_content');
  withSimulationRandom(noRandom, () => close(spawn([subject]), [row]));
  assert.equal(subject.rewardClosure.itemId, ''); assert.equal(subject.rewardClosure.expiredWorldGifts, 1);
  assert.equal(claim(subject, [row], 200).claimed, false);
});
await check('a valid unattempted win also closes its gift without choosing content', () => {
  const subject = won(); const row = actor(); const before = resources([row]);
  withSimulationRandom(noRandom, () => close(spawn([subject]), [row]));
  assert.equal(subject.rewardClosure.pendingReason, 'not_attempted'); assert.equal(subject.rewardOffer.choiceItemId, '');
  assert.deepEqual(resources([row]), before);
});
await check('already paid items, credits and the original receipt remain untouched', () => {
  const row = actor(); const subject = won(); assert.equal(claim(subject, [row]).claimed, true);
  const before = resources([row]); const receipt = structuredClone(subject.rewardReceipt);
  const out = close(spawn([subject]), [row]); assert.equal(out.summary.expiredWorldGifts, 0);
  assert.equal(subject.matchClosure.disposition, 'claimed'); assert.equal(subject.rewardClosure, undefined);
  assert.deepEqual(subject.rewardReceipt, receipt); assert.deepEqual(resources([row]), before);
});
await check('repeated closure and JSON restoration cannot duplicate expiry events or payments', () => {
  const subject = won(); const world = spawn([subject]); const row = actor(); const events = [];
  const actions = { emitRunEvent: (kind, data) => events.push({ kind, ...data }) };
  close(world, [row], { actions }); const before = structuredClone(world);
  assert.equal(close(world, [row], { actions, nowSec: 200 }).reason, 'already_closed');
  const restored = cloneSpawnState(JSON.parse(JSON.stringify(world)), 'map');
  assert.equal(close(restored, [row], { actions, nowSec: 200 }).reason, 'already_closed');
  assert.equal(claim(restored.dimensionRifts[0], [row], 200).claimed, false);
  assert.equal(events.filter((event) => event.kind === 'dimension_rift_reward_closed').length, 1);
  assert.deepEqual(world, before); assert.deepEqual(restored.dimensionRiftMatchClosure, world.dimensionRiftMatchClosure);
});
await check('a reentrant observer sees all reward and spawn locks already committed', () => {
  const subjects = [won(), won({ id: 'second', resolution: { id: 'second:resolution', atSec: 145,
    winnerTeamId: 'a', winnerMemberIds: ['a'] } })]; const world = spawn(subjects); const row = actor();
  close(world, [row], { actions: { emitRunEvent: () => {
    assert.ok(world.dimensionRiftMatchClosure);
    subjects.forEach((subject) => assert.equal(claim(subject, [row], 150).reason, 'reward_closed'));
    assert.equal(close(world, [row]).reason, 'already_closed');
  } } });
  assert.equal(row.simCredits, 7); assert.equal(row.inventory.length, 0);
});
await check('an unfinished contest closes without manufacturing a winner before admission ends', () => {
  const subject = rift({ openedAtSec: 100, entryClosesAtSec: 145, closesAtSec: 220 }); const row = actor();
  enterDimensionRiftSpace(row, subject, 100); const before = resources([row]);
  const out = close(spawn([subject]), [row], { nowSec: 110 });
  assert.equal(subject.resolution.reason, 'match_end'); assert.equal(subject.resolution.winnerTeamId, '');
  assert.equal(subject.rewardOffer, undefined); assert.equal(out.summary.unfinishedContests, 1);
  assert.equal(getCombatSpaceId(row), 'world'); assert.deepEqual(resources([row]), before);
});
await check('legacy resolved flags without a resolution never create another reward', () => {
  const subject = rift({ resolved: true, winnerTeamId: 'a' }); const world = spawn([subject]); const row = actor();
  close(world, [row]); assert.equal(subject.rewardOffer, undefined); assert.equal(subject.matchClosure.disposition, 'no_reward');
  assert.equal(claim(subject, [row], 200).claimed, false);
});
await check('malformed offers are quarantined intact and cannot be normalized into a new payment', () => {
  for (const override of [{ memberIds: ['a', 'a'] }, { creditsPerMember: '45' }, { remaining: 2 },
    { status: 'claimed' }, { memberIds: ['intruder'] }, { nextAttemptAtSec: NaN }]) {
    const subject = won(); claim(subject, [], 145); Object.assign(subject.rewardOffer, override);
    const original = structuredClone(subject.rewardOffer); const row = actor();
    assert.equal(claim(subject, [row], 170).claimed, false);
    const out = close(spawn([subject]), [row], { nowSec: 180 });
    assert.equal(out.summary.invalidRewards, 1); assert.deepEqual(subject.rewardOffer, original);
    assert.equal(subject.rewardClosure.disposition, 'invalid'); assert.equal(claim(subject, [row], 200).claimed, false);
    assert.equal(row.simCredits, 7); assert.equal(row.inventory.length, 0);
  }
});
await check('invalid result time or missing member IDs cannot create a gift', () => {
  for (const override of [{ atSec: NaN }, { atSec: 500 }, { winnerMemberIds: null }]) {
    const subject = won(); Object.assign(subject.resolution, override); const row = actor();
    assert.equal(claim(subject, [row], 150).claimed, false); close(spawn([subject]), [row]);
    assert.equal(subject.rewardClosure.disposition, 'invalid'); assert.equal(subject.rewardOffer, undefined);
  }
});
await check('invalid credit configuration is reported without inventing a payout amount', () => {
  const subject = won(); const out = close(spawn([subject]), [actor()],
    { ruleset: { worldSpawns: { dimensionRift: { rewardCreditsByDay: { 2: -1 } } } } });
  assert.equal(out.summary.invalidRewards, 1); assert.equal(subject.rewardClosure.issue, 'invalid_reward_credits');
  assert.equal(subject.rewardClosure.creditsPerMember, undefined);
});
await check('missing or temporarily dead recipients remain pending during a live match', () => {
  const subject = won(); assert.equal(claim(subject, [], 145).reason, 'no_living_recipient');
  assert.equal(claim(subject, [actor('a', { hp: 0 })], 170).reason, 'no_living_recipient');
  assert.equal(subject.rewardOffer.status, 'pending'); assert.equal(subject.rewardClosure, undefined);
  assert.equal(claim(subject, [actor()], 195).claimed, true);
});
await check('repeated roster identities cannot duplicate credits in a successful normal claim', () => {
  const row = actor(); const subject = won(); const out = claim(subject, [row, row]);
  assert.equal(out.claimed, true); assert.equal(out.receipt.credits.length, 1); assert.equal(row.simCredits, 52);
});
await check('match-end release preserves a real corpse and handles orphan arena membership', () => {
  const row = actor(); enterDimensionRiftSpace(row, rift({ id: 'missing' }), 100); row.hp = 0;
  close(spawn([]), [row]); assert.equal(row.hp, 0); assert.equal(getCombatSpaceId(row), 'world');
  assert.equal(row._lastDimensionRiftExit.reason, 'match_end');
  assert.equal(row._lastDimensionRiftDefeatReturn, undefined);
});
await check('match-end cleanup releases damaged entry clocks without fabricating defeat protection', () => {
  for (const enteredAtSec of [null, -1, 999]) {
    const row = actor(); const subject = rift(); enterDimensionRiftSpace(row, subject, 100);
    row._dimensionRiftEntry.enteredAtSec = enteredAtSec; const before = resources([row]);
    close(spawn([subject]), [row]); assert.equal(getCombatSpaceId(row), 'world');
    assert.equal(row._lastDimensionRiftExit.reason, 'match_end'); assert.ok(row._lastDimensionRiftExit.entryIssue);
    assert.equal(row._lastDimensionRiftDefeatReturn, undefined); assert.deepEqual(resources([row]), before);
  }
});
await check('defeat return at match end uses the existing one-time protection without healing', () => {
  const row = actor(); const subject = rift(); enterDimensionRiftSpace(row, subject, 100);
  commitRuntimeHpDamage(row, 1000, { atSec: 149, by: 'b' }); const world = spawn([subject]);
  close(world, [row]); assert.equal(row.hp, 1); assert.equal(row.safeZoneUntil, 153);
  assert.equal(row._lastDimensionRiftExit.exitCause, 'match_end');
  close(world, [row], { nowSec: 200 }); assert.equal(row.safeZoneUntil, 153);
});
await check('closed spawn state cannot reopen an arena, select an objective, or resume reward retries', () => {
  const subject = rift(); const row = actor(); const world = spawn([subject]); close(world, [row]);
  subject.resolved = false; // Even an inconsistent flag cannot override the closure receipt.
  assert.equal(enterDimensionRiftSpace(row, subject, 200), null);
  assert.equal(advanceDimensionRiftContest(subject, [row], { nowSec: 200 }).resolution, null);
  assert.deepEqual(listActiveDimensionRifts(world), []); assert.equal(findActorDimensionRift(world, row), null);
  assert.equal(runDimensionRiftPhase({ state: { nextSpawn: world, currentActionSec: () => 200, updatedSurvivors: [row] } }).ran, false);
  withSimulationRandom(noRandom, () => buildDimensionRiftSpawn(world, [{ zoneId: 'z' }], new Set(), 3, 'night', 'squad', 'map'));
  assert.equal(world.dimensionRifts.length, 1);
  assert.equal(createInitialSpawnState('map').dimensionRiftMatchClosure, null);
});
await check('invalid closure clocks leave authoritative state untouched', () => {
  for (const nowSec of [NaN, Infinity, -1, null]) {
    const world = spawn([won()]); const before = structuredClone(world);
    assert.equal(close(world, [actor()], { nowSec }).closed, false); assert.deepEqual(world, before);
  }
});
await check('the actual finalizer releases and cancels before persistence, final frame and match_end', async () => {
  const row = actor(); const subject = rift(); enterDimensionRiftSpace(row, subject, 100);
  row._pendingCharacterCast = { def: { name: 'Q', slot: 'q', type: 'attack_skill' }, stage: 1,
    targetId: 'b', combatSpaceId: 'dimension_rift:r', zoneId: 'z', startedAtSec: 101,
    releaseAtSec: 120, recoveryUntilSec: 121, previousActionReadyAtSec: 100, castId: 'a:1' };
  row.skillState = { q: { cooldownUntil: 180, stage: 'casting' } }; row._actionReadyAtSec = 121;
  const world = spawn([subject]); const order = []; let frame; let finishOptions;
  await finalizeSimulationPhase({ state: { survivorMap: new Map([['a', row]]), nextSpawn: world,
    phaseStartSec: 100, getPhaseRuntimeOffsetSec: () => 10, phaseDurationSec: 120,
    nextDay: 2, nextPhase: 'night', ruleset, battleSettings: settings }, actions: {
    runVisibleClockToPhaseEnd: () => { throw new Error('Finalization must not run a future display interval'); },
    emitRunEvent: (kind, data, at) => { order.push(kind); assert.equal(at.sec, 110);
      if (kind === 'skill_cancel') assert.equal(data.reason, 'combat_space'); },
    persistSimEquipmentsFromChars: (rows) => { order.push('persist'); assert.equal(getCombatSpaceId(rows[0]), 'world');
      assert.equal(rows[0]._pendingCharacterCast, null); assert.equal(rows[0].skillState.q.cooldownUntil, 180); return Promise.resolve(); },
    publishFinalFrame: (value) => { frame = value; order.push('frame'); },
    finishGame: (_rows, _kills, _assists, options) => { finishOptions = options; order.push('finish'); },
  } });
  assert.ok(order.indexOf('skill_cancel') < order.indexOf('persist'));
  assert.ok(order.indexOf('persist') < order.indexOf('frame')); assert.ok(order.indexOf('frame') < order.indexOf('match_end'));
  assert.equal(order.at(-1), 'finish'); assert.equal(frame.matchSec, 110);
  assert.equal(frame.spawnState.dimensionRifts[0].rewardOffer, undefined);
  assert.deepEqual(finishOptions.ending.dimensionRifts, world.dimensionRiftMatchClosure);
});
await check('the actual finalizer keeps pending gifts while wipe revival defers the match end', async () => {
  const subject = won(); const world = spawn([subject]); const row = actor(); claim(subject, [], 145);
  const out = await finalizeSimulationPhase({ state: { survivorMap: new Map([['a', row]]), nextSpawn: world,
    dead: [actor('b', { hp: 0, deadAtPhaseIdx: 3 })], canReviveThisMatch: true, phaseIdxNow: 3,
    wipeProtectionCutoffIdx: 4, phaseStartSec: 100, phaseDurationSec: 100, ruleset },
    actions: { finishGame: () => { throw new Error('Revival protection still defers the ending'); } } });
  assert.equal(out.shouldReturn, false); assert.equal(world.dimensionRiftMatchClosure, null);
  assert.equal(subject.rewardOffer.status, 'pending'); assert.equal(subject.rewardClosure, undefined);
});
await check('ordinary multi-team phase completion does not expire pending gifts', async () => {
  const subject = won(); const world = spawn([subject]); claim(subject, [], 145);
  const rows = [actor(), actor('b')]; await finalizeSimulationPhase({ state: { nextSpawn: world,
    survivorMap: new Map(rows.map((row) => [row._id, row])), phaseStartSec: 100, phaseDurationSec: 100 },
    actions: { finishGame: () => { throw new Error('Two living teams cannot be finished'); } } });
  assert.equal(world.dimensionRiftMatchClosure, null); assert.equal(subject.rewardOffer.status, 'pending');
});
await check('no-survivor finalization closes pending rewards without reviving a recipient', async () => {
  const row = actor('a', { hp: 0, _deathAt: 150 }); const subject = won(); const world = spawn([subject]); let options;
  await finalizeSimulationPhase({ state: { nextSpawn: world, dead: [row], phaseStartSec: 100,
    getPhaseRuntimeOffsetSec: () => 50 }, actions: { finishGame: (rows, _k, _a, opts) => {
    assert.deepEqual(rows, []); options = opts;
  } } });
  assert.equal(options.ending.outcome, 'no_survivors'); assert.equal(options.ending.dimensionRifts.expiredWorldGifts, 1);
  assert.equal(row.hp, 0); assert.equal(row.simCredits, 7);
});
await check('the result and team observer explain expiry as nonpayment, not a successful reward', () => {
  const subject = won(); const row = actor(); const events = [];
  const out = close(spawn([subject]), [row], { actions: { emitRunEvent: (kind, data, at) => events.push({ kind, ...data, at }) } });
  assert.match(describeDimensionRiftMatchClosure(out.summary), /미수령 선물 1개 만료/);
  assert.match(describeDimensionRiftMatchClosure(out.summary), /크레딧 미지급/);
  const event = events.find((entry) => entry.kind === 'dimension_rift_reward_closed');
  assert.match(describeObserverEvent(event), /경기 종료/);
  const model = buildTeamObserverModel({ survivors: [row], events, teamId: 'a', matchSec: 150, isGameOver: true });
  assert.ok(model.turningPoints.some((entry) => entry.kind === 'dimension_rift_reward_closed'));
  assert.equal(describeDimensionRiftMatchClosure(null), '');
  assert.equal(describeDimensionRiftMatchClosure({ expiredWorldGifts: 0, invalidRewards: 0, unfinishedContests: 0 }), '');
});

console.log(`Dimension-rift match-end checks: ${checks}`);
