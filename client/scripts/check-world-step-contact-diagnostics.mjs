import assert from 'node:assert/strict';
import { createWorldStepContactDiagnostics } from './lib/world-step-contact-diagnostics.mjs';

let checks = 0;
const check = (name, run) => { run(); checks += 1; console.log(`PASS ${name}`); };
const actor = (actorId, overrides = {}) => ({ actorId, teamId: 'team-a', zoneId: 'zone-1', combatSpaceId: 'space-1',
  hp: 100, maxHp: 100, spatial: { x: 2, y: 3 }, intentTargetId: 'target', hasCombatIntent: true,
  actionReadyAtSec: 410, basicAttackReadyAtSec: 411, recoveryUntilSec: 412, recoveryReason: 'test',
  spatialMotion: { reason: 'approach', targetId: 'target', x: 9, y: 3, stopRange: 1 },
  spatialLastSeen: { targetId: 'target', x: 8, y: 3, seenAtSec: 409 }, ...overrides });
const world = (stepId, kind, fromSec, toSec) => ({ stepId, kind, fromSec, toSec });
const snap = (stage, step, { nowSec = stage === 'world_step_before' ? step.fromSec : step.toSec,
  actors = [actor('watch'), actor('target', { teamId: 'team-b', hp: 50, spatial: { x: 8, y: 3 } })],
  scheduled = null, truncated = false } = {}) => ({ stage, nowSec, worldStep: step, actors, scheduled, truncated });
const observePair = (diagnostics, step, beforeCursor, afterCursor, options = {}) => {
  diagnostics.observe(snap('world_step_before', step, options), { eventCursor: beforeCursor });
  diagnostics.observe(snap('world_step_after', step, options), { eventCursor: afterCursor });
};
const config = (overrides = {}) => ({ actorIds: ['watch'], fromSec: 400, toSec: 412, ...overrides });

check('input actor IDs and observed snapshots are copied into bounded owned facts', () => {
  const actorIds = ['watch'];
  const diagnostics = createWorldStepContactDiagnostics(config({ actorIds }));
  const before = snap('world_step_before', world('step-1', 'elapsed', 400, 401), {
    actors: [actor('watch', { intentZoneId: 'intent-zone', intentCombatSpaceId: 'intent-space', sightRange: 18,
      spatialMotion: { reason: 'approach', targetId: 'motion-target', x: 9, y: 3, stopRange: 1 },
      spatialLastSeen: { targetId: 'seen-target', x: 8, y: 3, seenAtSec: 409 },
      pendingCast: { targetId: 'cast-target', releaseAtSec: 410.5 } }),
    actor('target', { teamId: 'team-b', hp: 50 }), actor('motion-target'), actor('seen-target'), actor('cast-target')],
  });
  const after = snap('world_step_after', world('step-1', 'elapsed', 400, 401), {
    actors: [actor('watch', { hp: 90, spatial: { x: 4, y: 3 }, intentZoneId: 'intent-zone',
      intentCombatSpaceId: 'intent-space', sightRange: 18,
      spatialMotion: { reason: 'approach', targetId: 'motion-target', x: 9, y: 3, stopRange: 1 },
      spatialLastSeen: { targetId: 'seen-target', x: 8, y: 3, seenAtSec: 409 },
      pendingCast: { targetId: 'cast-target', releaseAtSec: 410.5 } }),
    actor('target'), actor('motion-target'), actor('seen-target'), actor('cast-target')],
  });
  diagnostics.observe(before, { eventCursor: 2 });
  diagnostics.observe(after, { eventCursor: 4 });
  actorIds[0] = 'other'; actorIds.push('late');
  before.actors[0].spatial.x = 999; after.actors[0].hp = 1;
  const first = diagnostics.summary([]);
  const second = diagnostics.summary([]);
  assert.deepEqual(first, second, 'summary must be repeatable and must not mutate collector state');
  assert.deepEqual(first.actorIds, ['watch']);
  assert.equal(first.steps[0].actors.find(row => row.actorId === 'watch').before.spatial.x, 2);
  assert.equal(first.steps[0].actors.find(row => row.actorId === 'watch').after.hp, 90);
  const copiedActor = first.steps[0].actors.find(row => row.actorId === 'watch').before;
  assert.equal(copiedActor.intent.zoneId, 'intent-zone');
  assert.equal(copiedActor.intent.combatSpaceId, 'intent-space');
  assert.equal(copiedActor.sightRange, 18);
  assert.deepEqual(first.steps[0].actors.map(row => row.actorId),
    ['watch', 'cast-target', 'motion-target', 'seen-target', 'target']);
  assert.equal(copiedActor.pendingCast.targetId, 'cast-target');
  assert.equal(first.steps[0].pairEventWindow.fromInclusive, 2);
  assert.equal(first.steps[0].pairEventWindow.toExclusive, 4);
});

check('only pairs intersecting the selected time window are retained', () => {
  const diagnostics = createWorldStepContactDiagnostics(config());
  observePair(diagnostics, world('outside', 'elapsed', 398, 399), 0, 1);
  observePair(diagnostics, world('inside', 'growth', 399.5, 400.5), 1, 2);
  observePair(diagnostics, world('outside-after', 'elapsed', 413, 414), 2, 3);
  const out = diagnostics.summary([]);
  assert.equal(out.counts.matchedPairs, 3);
  assert.equal(out.counts.outsideWindowPairs, 2);
  assert.deepEqual(out.steps.map(row => row.stepId), ['inside']);
  assert.deepEqual(out.steps[0].intersection, { fromSec: 400, toSec: 400.5 });
});

check('gap and world-step event windows retain exact cursor boundaries and event indexes', () => {
  const diagnostics = createWorldStepContactDiagnostics(config());
  observePair(diagnostics, world('preceding', 'elapsed', 399, 399.5), 0, 1);
  observePair(diagnostics, world('contact', 'elapsed', 400, 401), 2, 5);
  const events = [
    { kind: 'battle', who: 'unrelated', targetId: 'elsewhere' },
    { kind: 'damage', type: 'basic', who: 'watch', targetId: 'target', damage: 20,
      hpDamage: 20, hpBefore: 100, hpAfter: 80, absorbed: 0 },
    { kind: 'damage', type: 'basic', who: 'target', targetId: 'watch', damage: 15,
      hpDamage: 0, hpBefore: 100, hpAfter: 100, blockedReason: 'protected', absorbed: 0 },
    { kind: 'team_strike', who: 'watch', targetId: 'target', damage: 7 },
    { kind: 'battle', who: 'unrelated', targetId: 'elsewhere' },
  ];
  const out = diagnostics.summary(events);
  assert.deepEqual(out.steps[0].gapEventWindow, { kind: 'between_pairs', fromInclusive: 1,
    toExclusive: 2, previousStepId: 'preceding', stepId: 'contact', fromSec: 399.5, toSec: 400 });
  assert.deepEqual(out.steps[0].pairEventWindow, { kind: 'world_step', fromInclusive: 2,
    toExclusive: 5, stepId: 'contact', fromSec: 400, toSec: 401 });
  assert.deepEqual(out.eventSamples.map(row => row.eventIndex), [1, 2, 3]);
  assert.deepEqual(out.eventSamples.map(row => row.window), ['between_pairs', 'world_step', 'world_step']);
});

check('direct sender and receiver HP receipts stay separate from team strikes', () => {
  const diagnostics = createWorldStepContactDiagnostics(config());
  observePair(diagnostics, world('damage', 'elapsed', 400, 401), 0, 5);
  const events = [
    { kind: 'damage', who: 'watch', targetId: 'target', type: 'basic', damage: 20,
      hpDamage: 20, hpBefore: 100, hpAfter: 80, absorbed: 0 },
    { kind: 'damage', who: 'watch', targetId: 'target', type: 'basic', damage: 0,
      hpDamage: 0, hpBefore: 80, hpAfter: 80, blockedReason: 'immune', absorbed: 0 },
    { kind: 'damage', who: 'target', targetId: 'watch', type: 'basic', damage: 12,
      hpDamage: 0, hpBefore: 100, hpAfter: 100, blockedReason: 'invulnerable', absorbed: 0 },
    { kind: 'team_strike', who: 'watch', targetId: 'target', damage: 7, participants: ['watch', 'buddy'] },
    { kind: 'death', who: 'target', by: 'watch', victimId: 'target', killerId: 'watch',
      causeName: 'basic attack', reason: 'combat' },
  ];
  const out = diagnostics.summary(events);
  const counts = out.eventCounts.watch;
  events[0].hpDamage = 999;
  assert.equal(out.eventSamples[0].hpDamage, 20, 'summary samples must own copied event facts');
  const deathSample = out.eventSamples.find(row => row.kind === 'death');
  assert.equal(deathSample.by, 'watch');
  assert.equal(deathSample.victimId, 'target');
  assert.equal(deathSample.causeName, 'basic attack');
  assert.deepEqual(deathSample.relatedByWatchedIds, ['watch']);
  assert.equal(counts.sent.positiveHpReceipts, 1);
  assert.equal(counts.sent.zeroBlocked, 1);
  assert.equal(counts.sent.teamStrikes, 1);
  assert.equal(counts.sent.hpDamage, 20, 'direct damage events exclude team-strike receipts');
  assert.equal(counts.received.zeroBlocked, 1);
  assert.equal(counts.received.positiveHpReceipts, 0);
  assert.equal(counts.received.hpDamage, 0);
  assert.equal(counts.sent.events, 3, 'death by/watch relation does not increment who-based sent.events');
  assert.equal(counts.received.events, 1, 'death by/watch relation does not increment targetId-based received.events');
  assert.equal(out.counterSemantics.hpReceipts.includes('only from kind=damage'), true);
});

check('zero and shield-absorbed packets are not reported as positive HP damage', () => {
  const diagnostics = createWorldStepContactDiagnostics(config());
  observePair(diagnostics, world('zero', 'elapsed', 400, 401), 0, 3);
  const out = diagnostics.summary([
    { kind: 'damage', who: 'watch', targetId: 'target', damage: 10,
      hpDamage: 0, hpBefore: 100, hpAfter: 100, absorbed: 10 },
    { kind: 'damage', who: 'watch', targetId: 'target', damage: 0,
      hpDamage: 0, hpBefore: 100, hpAfter: 100 },
    { kind: 'damage', who: 'watch', targetId: 'target', damage: 10,
      hpDamage: 5, hpBefore: 100, hpAfter: 99 },
  ]);
  assert.equal(out.eventCounts.watch.sent.zeroAbsorbed, 1);
  assert.equal(out.eventCounts.watch.sent.zeroOther, 1);
  assert.equal(out.eventCounts.watch.sent.invalidHpReceipts, 1);
  assert.equal(out.eventCounts.watch.sent.positiveHpReceipts, 0);
});

check('duplicate and mismatched step identities are counted and never silently paired', () => {
  const diagnostics = createWorldStepContactDiagnostics(config());
  const duplicate = world('duplicate', 'elapsed', 400, 401);
  diagnostics.observe(snap('world_step_before', duplicate), { eventCursor: 0 });
  diagnostics.observe(snap('world_step_before', duplicate), { eventCursor: 0 });
  diagnostics.observe(snap('world_step_after', duplicate), { eventCursor: 1 });
  diagnostics.observe(snap('world_step_after', duplicate), { eventCursor: 1 });

  const expected = world('expected', 'growth', 401, 402);
  diagnostics.observe(snap('world_step_before', expected), { eventCursor: 1 });
  diagnostics.observe(snap('world_step_after', world('wrong', 'growth', 401, 402)), { eventCursor: 2 });
  diagnostics.observe(snap('world_step_after', expected), { eventCursor: 2 });
  const out = diagnostics.summary([]);
  assert.equal(out.counts.duplicateBefore, 1);
  assert.equal(out.counts.duplicateAfter, 1);
  assert.equal(out.counts.unmatchedBefore, 1);
  assert.equal(out.counts.mismatchedAfter, 1);
  assert.equal(out.counts.matchedPairs, 2);
  assert.deepEqual(out.steps.map(row => row.stepId), ['duplicate', 'expected']);
});

check('orphan after snapshots and unfinished before snapshots remain explicit', () => {
  const diagnostics = createWorldStepContactDiagnostics(config());
  diagnostics.observe(snap('world_step_after', world('orphan', 'elapsed', 400, 401)), { eventCursor: 0 });
  diagnostics.observe(snap('world_step_before', world('unfinished', 'growth', 401, 402)), { eventCursor: 0 });
  const first = diagnostics.summary([]);
  assert.equal(first.counts.orphanAfter, 1);
  assert.equal(first.unmatchedBeforeAtEnd, true);
  assert.deepEqual(first.unmatchedStepIds, ['unfinished']);
  const second = diagnostics.summary([]);
  assert.equal(second.counts.unmatchedBefore, first.counts.unmatchedBefore,
    'summary must not mutate counts across calls');
});

check('event cursor reversal rejects the pending pair and marks the issue', () => {
  const diagnostics = createWorldStepCombatDiagnosticsForTest();
  diagnostics.observe(snap('world_step_before', world('cursor-reversed', 'elapsed', 400, 401)), { eventCursor: 5 });
  diagnostics.observe(snap('world_step_after', world('cursor-reversed', 'elapsed', 400, 401)), { eventCursor: 4 });
  const out = diagnostics.summary([]);
  assert.equal(out.counts.cursorReversals, 1);
  assert.equal(out.counts.matchedPairs, 0);
  assert.ok(out.issues.some(row => row.code === 'event_cursor_reversed'));
});

check('time reversal and before/after nowSec mismatches do not form valid pairs', () => {
  const diagnostics = createWorldStepContactDiagnostics(config());
  const reverse = world('time-reversed', 'elapsed', 400, 401);
  diagnostics.observe(snap('world_step_before', reverse), { eventCursor: 0 });
  diagnostics.observe(snap('world_step_after', reverse, { nowSec: 399.5 }), { eventCursor: 1 });
  const wrongNow = world('wrong-now', 'growth', 401, 402);
  diagnostics.observe(snap('world_step_before', wrongNow, { nowSec: 400.5 }), { eventCursor: 1 });
  diagnostics.observe(snap('world_step_after', wrongNow), { eventCursor: 2 });
  const out = diagnostics.summary([]);
  assert.equal(out.counts.timeReversals, 1);
  assert.equal(out.counts.timeInvalid, 1);
  assert.equal(out.counts.matchedPairs, 0);
});

check('disabled collector is inert and missing watched actors are reported, not invented', () => {
  const disabled = createWorldStepContactDiagnostics(config({ actorIds: [] }));
  observePair(disabled, world('disabled', 'elapsed', 400, 401), 0, 0);
  assert.equal(disabled.summary([]).enabled, false);
  assert.equal(disabled.summary([]).counts.observations, 0);

  const missing = createWorldStepContactDiagnostics(config());
  observePair(missing, world('missing', 'elapsed', 400, 401), 0, 0, { actors: [actor('target')] });
  assert.deepEqual(missing.summary([]).steps[0].beforeMissingActorIds, ['watch']);
});

check('watched absence, absent references, source-truncated uncertainty, and cap omission stay distinct', () => {
  const missingReference = createWorldStepContactDiagnostics(config());
  const missingStep = world('missing-reference', 'elapsed', 400, 401);
  const watchedWithDeadOrStaleTarget = actor('watch', { intentTargetId: 'departed-target',
    combatIntent: { targetId: 'departed-target' }, spatialMotion: { targetId: 'departed-target', reason: 'approach' },
    spatialLastSeen: { targetId: 'departed-target', seenAtSec: 399 }, pendingCast: { targetId: 'departed-target' } });
  const missingActors = [watchedWithDeadOrStaleTarget];
  missingReference.observe(snap('world_step_before', missingStep, { actors: missingActors }), { eventCursor: 0 });
  missingReference.observe(snap('world_step_after', missingStep, { actors: missingActors }), { eventCursor: 0 });
  const missingOut = missingReference.summary([]);
  assert.deepEqual(missingOut.steps[0].beforeMissingActorIds, []);
  assert.deepEqual(missingOut.steps[0].beforeMissingRelatedActorIds, ['departed-target']);
  assert.deepEqual(missingOut.steps[0].beforeUnknownRelatedActorIds, []);
  assert.equal(missingOut.counts.missingRelatedActorOccurrences, 2,
    'complete-list absence is recorded per snapshot but does not imply a product defect');

  const missingWatched = createWorldStepContactDiagnostics(config());
  const watchedStep = world('watched-absent', 'elapsed', 400, 401);
  const partialActors = [actor('target')];
  missingWatched.observe(snap('world_step_before', watchedStep, { actors: partialActors }), { eventCursor: 0 });
  missingWatched.observe(snap('world_step_after', watchedStep, { actors: partialActors }), { eventCursor: 0 });
  const watchedOut = missingWatched.summary([]);
  assert.deepEqual(watchedOut.steps[0].beforeMissingActorIds, ['watch']);
  assert.deepEqual(watchedOut.steps[0].beforeMissingRelatedActorIds, []);

  const sourceTruncated = createWorldStepContactDiagnostics(config());
  const truncatedStep = world('source-truncated', 'elapsed', 400, 401);
  const truncatedActors = [watchedWithDeadOrStaleTarget];
  sourceTruncated.observe(snap('world_step_before', truncatedStep, { actors: truncatedActors, truncated: true }),
    { eventCursor: 0 });
  sourceTruncated.observe(snap('world_step_after', truncatedStep, { actors: truncatedActors, truncated: true }),
    { eventCursor: 0 });
  const truncatedOut = sourceTruncated.summary([]);
  assert.deepEqual(truncatedOut.steps[0].beforeMissingRelatedActorIds, []);
  assert.deepEqual(truncatedOut.steps[0].beforeUnknownRelatedActorIds, ['departed-target']);
  assert.deepEqual(truncatedOut.steps[0].beforeUnknownActorIds, []);

  const capLimited = createWorldStepContactDiagnostics(config({ maxRelatedActors: 1 }));
  const capStep = world('collector-cap', 'elapsed', 400, 401);
  const capActors = [actor('watch', { intentTargetId: 'target' }), actor('target')];
  capLimited.observe(snap('world_step_before', capStep, { actors: capActors }), { eventCursor: 0 });
  capLimited.observe(snap('world_step_after', capStep, { actors: capActors }), { eventCursor: 0 });
  const capOut = capLimited.summary([]);
  assert.deepEqual(capOut.steps[0].beforeMissingRelatedActorIds, []);
  assert.deepEqual(capOut.steps[0].beforeOmittedRelatedActorIds, ['target']);
  assert.deepEqual(capOut.steps[0].beforeOmittedActorIds, ['target']);
  assert.equal(capOut.counts.relatedActorLimitOmissions, 2);
});

check('actor, step, and event limits report truncation without dropping receipt counts', () => {
  const diagnostics = createWorldStepContactDiagnostics(config({ maxSteps: 1, maxRelatedActors: 2, maxEventSamples: 1 }));
  const crowded = [actor('watch'), actor('target'), actor('buddy'), actor('other')];
  observePair(diagnostics, world('one', 'elapsed', 400, 401), 0, 3, { actors: crowded });
  observePair(diagnostics, world('two', 'elapsed', 401, 402), 3, 6, { actors: crowded });
  const events = [
    { kind: 'damage', who: 'watch', targetId: 'target', hpDamage: 2, hpBefore: 10, hpAfter: 8 },
    { kind: 'damage', who: 'watch', targetId: 'target', hpDamage: 3, hpBefore: 8, hpAfter: 5 },
    { kind: 'team_strike', who: 'watch', targetId: 'target', damage: 4 },
    { kind: 'damage', who: 'watch', targetId: 'target', hpDamage: 1, hpBefore: 5, hpAfter: 4 },
    { kind: 'damage', who: 'watch', targetId: 'target', hpDamage: 2, hpBefore: 4, hpAfter: 2 },
    { kind: 'team_strike', who: 'watch', targetId: 'target', damage: 1 },
  ];
  const out = diagnostics.summary(events);
  assert.equal(out.steps.length, 1);
  assert.equal(out.counts.stepSamplesTruncated, 1);
  assert.equal(out.truncation.steps, true);
  assert.equal(out.truncation.relatedActors, true);
  assert.equal(out.truncation.eventSamples, true);
  assert.equal(out.eventSamples.length, 1);
  assert.equal(out.eventSamplesOmitted, 2);
  assert.equal(out.eventCounts.watch.sent.positiveHpReceipts, 2);
  assert.equal(out.eventCounts.watch.sent.hpDamage, 5);
  assert.equal(out.eventCounts.watch.sent.teamStrikes, 1);
});

check('summary requires this run actual event array and flags cursor beyond its length', () => {
  const diagnostics = createWorldStepContactDiagnostics(config());
  observePair(diagnostics, world('out-of-range', 'elapsed', 400, 401), 2, 4);
  assert.throws(() => diagnostics.summary(), /actual event array/);
  const out = diagnostics.summary([]);
  assert.equal(out.counts.cursorOutOfRange, 1);
  assert.ok(out.issues.some(row => row.code === 'event_cursor_exceeds_supplied_events'));
});

console.log(`WORLD_STEP_CONTACT_DIAGNOSTICS ${JSON.stringify({ passed: checks, total: checks })}`);

function createWorldStepCombatDiagnosticsForTest() {
  return createWorldStepContactDiagnostics(config());
}
