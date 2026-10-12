import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const { createMatchDistributionFrameTracker, summarizeGrowthPlanEvents, summarizeInitialGoalCompletion, summarizeMovement } = await import('./lib/match-distribution-frame-tracker.mjs');

let checks = 0;
const check = (name, run) => { run(); checks++; console.log(`PASS ${name}`); };
const items = [
  { _id: 'hero-head', itemKey: 'hero-head', name: '목표 투구', type: '방어구', category: 'equipment', equipSlot: 'head', tier: 4 },
  { _id: 'hero-weapon', itemKey: 'hero-weapon', name: '목표 무기', type: 'equipment', category: 'equipment', equipSlot: 'weapon', tier: 4 },
  { _id: 'hero-clothes', itemKey: 'hero-clothes', name: '목표 옷', type: '방어구', category: 'equipment', equipSlot: 'clothes', tier: 4 },
  { _id: 'hero-arm', itemKey: 'hero-arm', name: '목표 팔', type: '방어구', category: 'equipment', equipSlot: 'arm', tier: 4 },
  { _id: 'hero-shoes', itemKey: 'hero-shoes', name: '목표 신발', type: '방어구', category: 'equipment', equipSlot: 'shoes', tier: 4 },
  { _id: 'invalid', itemKey: 'invalid', name: '삭제된 목표', type: '방어구', category: 'equipment', equipSlot: 'head', tier: 4, lockedByAdmin: 'deleted' },
];
const goalActor = (id, extra = {}) => ({ _id: id, name: id, teamId: `team:${id}`, hp: 100, maxHp: 100, zoneId: 'a',
  routePlanTargetItemIds: ['hero-head'], goalLoadouts: { hero: { headKey: 'hero-head' } }, inventory: [], equipped: {}, ...extra });
const equippedGoal = (actor) => ({ ...actor, inventory: [{ itemId: 'hero-head', equipSlot: 'head', tier: 4, qty: 1 }], equipped: { head: 'hero-head' } });
const fiveSlotHero = (actor) => ({ ...actor,
  routePlanTargetItemIds: ['hero-weapon', 'hero-head', 'hero-clothes', 'hero-arm', 'hero-shoes'],
  goalLoadouts: { hero: { weaponKey: 'hero-weapon', headKey: 'hero-head', clothesKey: 'hero-clothes', armKey: 'hero-arm', shoesKey: 'hero-shoes' } },
  inventory: ['hero-weapon', 'hero-head', 'hero-clothes', 'hero-arm', 'hero-shoes'].map((itemId) => ({ itemId, qty: 1 })),
  equipped: { weapon: 'hero-weapon', head: 'hero-head', clothes: 'hero-clothes', arm: 'hero-arm', shoes: 'hero-shoes' },
});
const frame = (matchSec, survivors, dead = []) => ({ matchSec, survivors, dead });
const trackerFor = (initialActors, extra = {}) => createMatchDistributionFrameTracker({ initialActors, items, firstDayDeadlineSec: 100, ...extra });
const regroupActor = (id, zoneId, extra = {}) => ({ _id: id, name: id, teamId: 'team:1', hp: 100, maxHp: 100,
  zoneId, _combatSpaceId: 'world', _teamRegroup: { version: 1, teamId: 'team:1', combatSpaceId: 'world', memberCount: 2,
    status: 'joining', targetZoneId: 'b', at: { sec: 5 } }, ...extra });
const episodeOf = (report, outcome) => report.regroup.episodes.find((episode) => episode.outcome === outcome);

check('growth denominator retains all initial actors and separates configured goal participants', () => {
  const actors = [goalActor('configured'), goalActor('missing', { goalLoadouts: { hero: { clothesKey: 'absent' } }, routePlanTargetItemIds: ['absent'] }),
    goalActor('no-goal', { goalLoadouts: {}, routePlanTargetItemIds: [] })];
  const tracker = trackerFor(actors);
  tracker.observe(frame(1, actors));
  const growth = tracker.report().growth;
  assert.equal(growth.total, 3);
  assert.equal(growth.goalParticipants, 2);
  assert.equal(growth.complete, 0);
  assert.equal(growth.rows.find((row) => row.actorId === 'missing').totalSlots, 1);
});

check('growth report classifies valid, invalid, and absent initial goals separately', () => {
  const actors = [goalActor('valid'), goalActor('invalid', {
    goalLoadouts: { hero: { headKey: 'invalid' } }, routePlanTargetItemIds: ['invalid'],
  }), goalActor('absent', { goalLoadouts: {}, routePlanTargetItemIds: [] })];
  const tracker = trackerFor(actors);
  tracker.observe(frame(1, actors));
  const growth = tracker.report().growth;
  assert.deepEqual([growth.validGoalParticipants, growth.invalidGoalParticipants, growth.noGoalParticipants], [1, 1, 1]);
  assert.equal(growth.rows.find((row) => row.actorId === 'valid').initialGoalStatus, 'valid');
  assert.equal(growth.rows.find((row) => row.actorId === 'invalid').initialGoalStatus, 'invalid');
  assert.equal(growth.rows.find((row) => row.actorId === 'absent').initialGoalStatus, 'none');
});

check('initial-goal completion and slot-completion events are separately reported', () => {
  const actor = goalActor('initial-goal');
  const tracker = trackerFor([actor]);
  tracker.observe(frame(1, [actor]));
  tracker.observe(frame(2, [equippedGoal(actor)]));
  const growth = tracker.report().growth;
  assert.equal(growth.complete, 1);
  assert.equal(growth.goalParticipants, 1);
  assert.equal(growth.completeShare, 1);
  assert.equal(growth.rows[0].completeAtSec, 2);
  const events = summarizeGrowthPlanEvents([
    { kind: 'growth_plan', who: 'initial-goal', completedSlots: 2, totalSlots: 2, openingComplete: true },
    { kind: 'growth_plan', who: 'invalid-goal', completedSlots: 2, totalSlots: 2, openingComplete: false },
    { kind: 'growth_plan', who: 'partial', completedSlots: 1, totalSlots: 2, openingComplete: false },
    { kind: 'growth_plan', who: 'initial-goal', completedSlots: 2, totalSlots: 2, openingComplete: true },
  ]);
  assert.equal(events.slotCompleteEvents, 3);
  assert.equal(events.slotCompleteEventActors, 2);
  assert.equal(events.planOpeningCompleteEvents, 2);
  assert.equal(events.planOpeningCompleteEventActors, 1);
});

check('goal completion share excludes no-goal actors but keeps invalid goals and deaths visible', () => {
  const valid = goalActor('valid');
  const dead = goalActor('dead');
  const invalid = goalActor('invalid', { goalLoadouts: { hero: { headKey: 'invalid' } }, routePlanTargetItemIds: ['invalid'] });
  const absent = goalActor('absent', { goalLoadouts: {}, routePlanTargetItemIds: [] });
  const tracker = trackerFor([valid, dead, invalid, absent]);
  tracker.observe(frame(1, [equippedGoal(valid), dead, invalid, absent]));
  tracker.observe(frame(2, [equippedGoal(valid), invalid, absent], [{ ...dead, hp: 0 }]));
  const growth = tracker.report().growth;
  assert.deepEqual([growth.complete, growth.goalParticipants, growth.completeShare], [1, 3, 0.333]);
  assert.deepEqual([growth.validGoalParticipants, growth.invalidGoalParticipants, growth.noGoalParticipants], [2, 1, 1]);
  assert.equal(growth.diedBeforeCompletion, 1);
  assert.equal(growth.rows.find((row) => row.actorId === 'invalid').initialGoalIssues[0].reason, 'unavailable_target');
  assert.deepEqual(summarizeInitialGoalCompletion([growth]), {
    complete: 1, goalParticipants: 3, completeShare: 0.333, validGoalParticipants: 2,
    invalidGoalParticipants: 1, noGoalParticipants: 1, diedBeforeCompletion: 1,
    goalIdentityChanged: 0, beforeFirstNightEnd: 1, beforeFirstNightEndShare: 0.333,
  });
});

check('initial target progress records its first completion time and counts a pre-deadline completion', () => {
  const actor = goalActor('early');
  const tracker = trackerFor([actor]);
  tracker.observe(frame(10, [actor]));
  tracker.observe(frame(20, [equippedGoal(actor)]));
  const growth = tracker.report().growth;
  assert.equal(growth.complete, 1);
  assert.equal(growth.beforeFirstNightEnd, 1);
  assert.equal(growth.rows[0].completeAtSec, 20);
  assert.equal(growth.rows[0].heroEquippedAtSec, null);
});

check('inventory goal completion does not imply actual equipped hero gear', () => {
  const actor = goalActor('inventory-only', { inventory: [{ itemId: 'hero-head', equipSlot: 'head', tier: 4, qty: 1 }] });
  const tracker = trackerFor([actor]);
  tracker.observe(frame(20, [actor]));
  const row = tracker.report().growth.rows[0];
  assert.equal(row.completeAtSec, 20);
  assert.equal(row.heroEquippedAtSec, null);
  assert.equal(tracker.report().growth.fiveSlotHeroEquipped, 0);
});

check('five-slot hero equipment time requires all five real equipped slots at tier four or higher', () => {
  const actor = fiveSlotHero(goalActor('full-hero'));
  const tracker = trackerFor([actor]);
  tracker.observe(frame(10, [actor]));
  const growth = tracker.report().growth;
  assert.equal(growth.rows[0].completeAtSec, 10);
  assert.equal(growth.rows[0].heroEquippedAtSec, 10);
  assert.equal(growth.fiveSlotHeroEquipped, 1);
});

check('completion at the first-night deadline is not counted as before the deadline', () => {
  const actor = goalActor('deadline');
  const tracker = trackerFor([actor]);
  tracker.observe(frame(100, [equippedGoal(actor)]));
  const growth = tracker.report().growth;
  assert.equal(growth.complete, 1);
  assert.equal(growth.beforeFirstNightEnd, 0);
  assert.equal(growth.rows[0].completeAtSec, 100);
});

check('zero-quantity inventory cannot complete a requested goal', () => {
  const actor = goalActor('zero-qty', { inventory: [{ itemId: 'hero-head', equipSlot: 'head', tier: 4, qty: 0 }] });
  const tracker = trackerFor([actor]);
  tracker.observe(frame(20, [actor]));
  assert.equal(tracker.report().growth.rows[0].completeAtSec, null);
});

check('changed requested target identity cannot borrow completion from the initial goal', () => {
  const actor = goalActor('changed-target');
  const tracker = trackerFor([actor]);
  tracker.observe(frame(10, [{ ...equippedGoal(actor), goalLoadouts: { hero: { headKey: 'invalid' } }, routePlanTargetItemIds: ['invalid'] }]));
  assert.equal(tracker.report().growth.rows[0].completeAtSec, null);
});

check('a goal actor who dies before completion remains incomplete and is marked dead-before-completion', () => {
  const actor = goalActor('died');
  const tracker = trackerFor([actor]);
  tracker.observe(frame(10, [actor]));
  tracker.observe(frame(20, [], [{ ...actor, hp: 0 }]));
  const row = tracker.report().growth.rows[0];
  assert.equal(row.completeAtSec, null);
  assert.equal(row.diedBeforeCompletion, true);
});

check('only an explicitly intended split same-space teammate pair starts a regroup episode', () => {
  const a = regroupActor('a', 'a');
  const b = regroupActor('b', 'b', { _teamRegroup: null });
  const tracker = trackerFor([a, b]);
  tracker.observe(frame(5, [a, b]));
  assert.equal(tracker.report().regroup.started, 1);
  const noIntent = trackerFor([a, { ...b, teamId: 'team:2' }]);
  noIntent.observe(frame(5, [a, { ...b, teamId: 'team:2' }]));
  assert.equal(noIntent.report().regroup.started, 0);
});

check('full regroup completes only when every starting member shares space and zone', () => {
  const intent = (status) => ({ version: 1, teamId: 'team:1', combatSpaceId: 'world', memberCount: 3,
    status, targetZoneId: 'a', at: { sec: 5 } });
  const members = [regroupActor('a', 'a', { _teamRegroup: intent('joining') }),
    regroupActor('b', 'b', { _teamRegroup: intent('waiting') }), regroupActor('c', 'c', { _teamRegroup: null })];
  const tracker = trackerFor(members);
  tracker.observe(frame(5, members));
  tracker.observe(frame(10, [regroupActor('a', 'a', { _teamRegroup: intent('joining') }),
    regroupActor('b', 'a', { _teamRegroup: intent('arrived') }), regroupActor('c', 'c', { _teamRegroup: null })]));
  assert.equal(tracker.report().regroup.completed, 0, 'pair contact is partial, not full-team completion');
  tracker.observe(frame(15, members.map((actor) => ({ ...actor, zoneId: 'a', _teamRegroup: intent('arrived') }))));
  assert.equal(tracker.report().regroup.completed, 1);
  assert.equal(episodeOf(tracker.report(), 'completed')?.endedAtSec, 15);
});

check('original member death censors the episode instead of awarding regroup success', () => {
  const a = regroupActor('a', 'a'), b = regroupActor('b', 'b');
  const tracker = trackerFor([a, b]);
  tracker.observe(frame(5, [a, b]));
  const growthWait = (actor) => ({ ...actor, _teamRegroup: { ...actor._teamRegroup, status: 'growth_wait', at: { sec: 6 } } });
  const waiting = [growthWait(a), growthWait(b)];
  tracker.observe(frame(6, waiting));
  assert.equal(tracker.report().regroup.started, 1);
  tracker.observe(frame(8, [waiting[0]], [{ ...waiting[1], hp: 0 }]));
  const regroup = tracker.report().regroup;
  assert.equal(episodeOf({ regroup }, 'member_death')?.endedAtSec, 8);
  assert.equal(regroup.started, 1, 'A later status label must not remove the started attempt from the denominator.');
  assert.equal(regroup.outcomes.member_death, 1);
  assert.equal(regroup.completed, 0);
  assert.equal(regroup.completionShare, 0);
});

check('revived roster cannot reuse pre-death intent as a new regroup attempt', () => {
  const a = regroupActor('a', 'a'), b = regroupActor('b', 'b');
  const tracker = trackerFor([a, b]);
  tracker.observe(frame(5, [a, b]));
  tracker.observe(frame(8, [a], [{ ...b, hp: 0 }]));
  tracker.observe(frame(10, [a, b]));
  assert.equal(tracker.report().regroup.started, 1);
  const fresh = { ...b, _teamRegroup: { ...b._teamRegroup, at: { sec: 11 } } };
  tracker.observe(frame(11, [a, fresh]));
  assert.equal(tracker.report().regroup.started, 2);
  assert.equal(tracker.report().regroup.outcomes.member_death, 1);
});

check('unsupported or future regroup evidence cannot start an episode', () => {
  const a = regroupActor('a', 'a'), b = regroupActor('b', 'b', { _teamRegroup: null });
  for (const record of [{ ...a._teamRegroup, version: 9 }, { ...a._teamRegroup, at: { sec: 100 } },
    { ...a._teamRegroup, status: 'growth_wait' }]) {
    const tracker = trackerFor([a, b]);
    tracker.observe(frame(5, [{ ...a, _teamRegroup: record }, b]));
    assert.equal(tracker.report().regroup.started, 0);
  }
});

check('combat-space change and roster change end episodes with distinct outcomes', () => {
  const a = regroupActor('a', 'a'), b = regroupActor('b', 'b');
  const spaceTracker = trackerFor([a, b]);
  spaceTracker.observe(frame(5, [a, b]));
  spaceTracker.observe(frame(8, [a, { ...b, _combatSpaceId: 'dimension_rift:r1' }]));
  assert.ok(episodeOf(spaceTracker.report(), 'space_change'));
  const rosterTracker = trackerFor([a, b]);
  rosterTracker.observe(frame(5, [a, b]));
  const growthWait = (actor) => ({ ...actor, _teamRegroup: { ...actor._teamRegroup, status: 'growth_wait', at: { sec: 6 } } });
  const waiting = [growthWait(a), growthWait(b)];
  rosterTracker.observe(frame(6, waiting));
  assert.equal(rosterTracker.report().regroup.started, 1);
  rosterTracker.observe(frame(8, [waiting[0], { ...waiting[1], teamId: 'team:2' }]));
  const regroup = rosterTracker.report().regroup;
  assert.ok(episodeOf({ regroup }, 'roster_change'));
  assert.equal(regroup.started, 1, 'Roster changes end but do not erase a previously started attempt.');
  assert.equal(regroup.outcomes.roster_change, 1);
  assert.equal(regroup.completed, 0);
});

check('cleared intent and open episodes remain explicit outcomes in the all-started denominator', () => {
  const a = regroupActor('a', 'a'), b = regroupActor('b', 'b');
  const cleared = trackerFor([a, b]);
  cleared.observe(frame(5, [a, b]));
  cleared.observe(frame(8, [{ ...a, _teamRegroup: null }, { ...b, _teamRegroup: null }]));
  assert.ok(episodeOf(cleared.report(), 'intent_cleared'));
  const unfinished = trackerFor([a, b]);
  unfinished.observe(frame(5, [a, b]));
  const report = unfinished.report();
  assert.ok(episodeOf(report, 'unfinished'));
  assert.equal(report.regroup.started, 1);
  assert.equal(report.regroup.completionShare, 0);
});

check('frozen frames and returned reports are read-only and independently owned', () => {
  const actor = goalActor('frozen');
  const a = regroupActor('a', 'a'), b = regroupActor('b', 'b');
  const inputFrame = frame(5, [actor, a, b]);
  const before = structuredClone(inputFrame);
  const freeze = (value) => { if (!value || typeof value !== 'object' || Object.isFrozen(value)) return; Object.values(value).forEach(freeze); Object.freeze(value); };
  freeze(inputFrame);
  const tracker = trackerFor([actor, a, b]);
  tracker.observe(inputFrame);
  assert.deepEqual(inputFrame, before);
  const first = tracker.report();
  first.growth.rows[0].actorId = 'corrupt';
  first.regroup.episodes[0].memberIds.push('corrupt');
  assert.equal(tracker.report().growth.rows[0].actorId, 'frozen');
  assert.ok(!tracker.report().regroup.episodes[0].memberIds.includes('corrupt'));
});

check('movement summary reports a reasoned A-B-A reversal with elapsed time', () => {
  const summary = summarizeMovement([{ _id: 'walker', zoneId: 'A' }], [
    { kind: 'move', who: 'walker', from: 'A', to: 'B', reason: 'growth_farm', at: { sec: 10 } },
    { kind: 'move', who: 'walker', from: 'B', to: 'A', reason: 'flee:team_outnumbered', at: { sec: 25 } },
  ]);
  assert.equal(summary.moves, 2);
  assert.equal(summary.reversals, 1);
  assert.equal(summary.reversalPairs['growth_farm->flee:team_outnumbered'], 1);
  assert.equal(summary.reversalSamples[0].elapsedSec, 15);
  assert.equal(summary.classification, 'observed movement reversals, not automatic bugs');
});

check('movement summary ignores same-zone events and breaks continuity on from mismatch', () => {
  const summary = summarizeMovement([{ _id: 'walker', zoneId: 'A' }], [
    { kind: 'move', who: 'walker', from: 'A', to: 'A', reason: 'wait', at: { sec: 2 } },
    { kind: 'move', who: 'walker', from: 'A', to: 'B', reason: 'growth_farm', at: { sec: 10 } },
    { kind: 'move', who: 'walker', from: 'C', to: 'A', reason: 'return', at: { sec: 20 } },
  ]);
  assert.equal(summary.moves, 2);
  assert.equal(summary.reversals, 0);
  assert.ok(summary.continuityBreaks >= 1);
});

check('death and revive events break movement chains across actor lifecycle segments', () => {
  const summary = summarizeMovement([{ _id: 'walker', zoneId: 'A' }], [
    { kind: 'move', who: 'walker', from: 'A', to: 'B', reason: 'growth_farm', at: { sec: 10 } },
    { kind: 'death', who: 'walker', at: { sec: 15 } },
    { kind: 'revive', who: 'walker', at: { sec: 20 } },
    { kind: 'move', who: 'walker', from: 'B', to: 'A', reason: 'growth_return', at: { sec: 25 } },
  ]);
  assert.equal(summary.reversals, 0);
  assert.ok(summary.continuityBreaks >= 1);
});

const verificationRunner = fileURLToPath(new URL('./run-eternal-hunger-verification.mjs', import.meta.url));
function assertRejectedRunnerArguments(args) {
  const child = spawnSync(process.execPath, [verificationRunner, 'distribution-varied', ...args],
    { encoding: 'utf8', windowsHide: true, timeout: 5000 });
  assert.equal(child.error, undefined, 'Argument rejection must finish without starting a match.');
  assert.equal(child.status, 1);
  assert.match(child.stderr, /Use distribution-varied <comma-separated roster seeds>/);
  assert.ok(!child.stdout.includes('VERIFICATION_RESULT'), 'Reject before creating a verification run or spawning npm.');
}

check('varied resume rejects a missing seed argument and extra arguments before starting a run', () => {
  assertRejectedRunnerArguments(['BASELINE:roster-C']);
  assertRejectedRunnerArguments(['BASELINE:roster-C', '5502', 'extra']);
});

check('varied resume rejects shell operators and empty identifiers', () => {
  for (const args of [['bad&seed', '5502'], ['BASELINE:roster-C', '5502;echo'],
    ['BASELINE:roster-C,', '5502'], ['', '5502'], ['BASELINE:roster-C', '']]) {
    assertRejectedRunnerArguments(args);
  }
});

check('varied resume rejects whitespace and final line breaks accepted by a loose dollar anchor', () => {
  for (const suffix of [' ', '\n', '\r\n', '\u2028', '\u2029']) {
    assertRejectedRunnerArguments([`BASELINE:roster-C${suffix}`, '5502']);
    assertRejectedRunnerArguments(['BASELINE:roster-C', `5502${suffix}`]);
  }
});

console.log(`MATCH_DISTRIBUTION_METRIC_CHECKS ${checks}/${checks}`);
