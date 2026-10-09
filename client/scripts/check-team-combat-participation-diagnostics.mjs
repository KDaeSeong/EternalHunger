import assert from 'node:assert/strict';
import { createTeamCombatParticipationDiagnostics } from './lib/team-combat-participation-diagnostics.mjs';

let checks = 0;
const check = (name, run) => { run(); checks += 1; console.log(`PASS ${name}`); };
const freshRosters = () => ({
  roster: [
    { _id: 'watch', teamId: 'team-a' },
    { _id: 'buddy', teamId: 'team-a' },
    { _id: 'other', teamId: 'team-b' },
  ],
  comparisonRoster: [
    { _id: 'watch', teamId: 'team-a' },
    { _id: 'buddy', teamId: 'team-b' },
    { _id: 'other', teamId: 'team-a' },
  ],
});
const actor = (actorId, extra = {}) => ({
  actorId, teamId: actorId === 'buddy' ? 'team-a' : 'team-a', zoneId: 'zone-1', combatSpaceId: 'space-1',
  hp: 100, maxHp: 100, actionReadyAtSec: 0, basicAttackReadyAtSec: 0, recoveryUntilSec: 0,
  recoveryReason: '', pendingCast: null, hunt: null, bossAssistOwnerId: '', hasCombatIntent: true,
  intentEnemyTeamId: 'team-b', intentTargetId: 'other', basicAllowed: true, actionBlocked: false,
  riftDefeated: false, spatial: { x: 1, y: 2 }, ...extra,
});
const snapshot = (stage, extra = {}) => ({
  stage, nowSec: 10, scheduled: null, initiatorId: 'watch', targetId: 'other', onlyActorId: '',
  sides: [['watch', 'buddy'], ['other']], participants: ['watch', 'buddy'],
  actors: [actor('watch'), actor('buddy'), actor('other', { teamId: 'team-b' })], ...extra,
});
const collector = (overrides = {}) => {
  const rosters = freshRosters();
  return createTeamCombatParticipationDiagnostics({ roster: rosters.roster, actorIds: ['watch'],
    comparisonRoster: rosters.comparisonRoster, ...overrides });
};
const ACTOR_BRANCH_TEST_KEYS = ['dead_or_rift', 'wildlife_hunt', 'boss_assist', 'forced_control', 'pending_cast',
  'no_intent_patrol', 'no_opponents_last_seen', 'no_opponents_patrol', 'observed_out_of_range', 'basic_in_range', 'other'];

check('input rosters and watched IDs are owned at construction time', () => {
  const rosters = freshRosters();
  const actorIds = ['watch'];
  const diagnostics = createTeamCombatParticipationDiagnostics({ ...rosters, roster: rosters.roster, actorIds });
  rosters.roster[0].teamId = 'mutated-team';
  rosters.comparisonRoster[1].teamId = 'team-a';
  actorIds[0] = 'other'; actorIds.push('late-actor');
  const frame = snapshot('team_queue');
  diagnostics.observe(frame, { eventCursor: 1 });
  const out = diagnostics.summary();
  assert.deepEqual(out.actorIds, ['watch']);
  assert.equal(out.samplesByActor.watch[0].changedBuddyFacts.find(item => item.buddyId === 'buddy').reason, 'present');
});

check('dynamic team membership is reported as a changed-team fact', () => {
  const diagnostics = collector();
  diagnostics.observe(snapshot('team_queue', {
    actors: [actor('watch'), actor('buddy', { teamId: 'team-b' }), actor('other', { teamId: 'team-b' })],
    sides: [['watch'], ['other']], participants: ['watch'],
  }),
    { eventCursor: 'team-1' });
  const out = diagnostics.summary();
  assert.equal(out.countsByActor.watch.changedBuddyAbsence.team_changed, 1);
  assert.equal(out.samplesByActor.watch[0].changedBuddyFacts[0].reason, 'team_changed');
});

for (const [reason, buddyState] of [
  ['absent_runtime_roster', null],
  ['dead', actor('buddy', { hp: 0 })],
  ['dead', actor('buddy', { riftDefeated: true })],
  ['different_zone', actor('buddy', { zoneId: 'zone-2' })],
  ['different_space', actor('buddy', { combatSpaceId: 'space-2' })],
]) {
  check(`changed buddy absence category: ${reason}${buddyState?.riftDefeated ? ' (rift defeated)' : ''}`, () => {
    const diagnostics = collector();
    const actors = [actor('watch'), ...(buddyState ? [buddyState] : []), actor('other', { teamId: 'team-b' })];
    diagnostics.observe(snapshot('team_queue', { actors, sides: [['watch'], ['other']], participants: ['watch'] }),
      { eventCursor: reason });
    assert.equal(diagnostics.summary().countsByActor.watch.changedBuddyAbsence[reason], 1);
  });
}

check('dead-in-this-phase is retained and classified before dynamic team changes', () => {
  const diagnostics = collector();
  diagnostics.observe(snapshot('team_queue', {
    actors: [actor('watch'), actor('buddy', { teamId: 'team-b', deadInThisPhase: true }), actor('other', { teamId: 'team-b' })],
    sides: [['watch'], ['buddy', 'other']], participants: ['watch'],
  }), { eventCursor: 'dead-phase' });
  const out = diagnostics.summary();
  assert.equal(out.countsByActor.watch.changedBuddyAbsence.dead, 1);
  assert.equal(out.samplesByActor.watch[0].changedBuddyFacts[0].reason, 'dead');
});

check('an enemy-side changed buddy is not reported as own-side present', () => {
  const diagnostics = collector();
  diagnostics.observe(snapshot('team_queue', {
    actors: [actor('watch'), actor('buddy', { teamId: 'team-b' }), actor('other', { teamId: 'team-b' })],
    sides: [['watch'], ['buddy', 'other']], participants: ['watch'],
  }), { eventCursor: 'enemy-side' });
  const out = diagnostics.summary();
  assert.equal(out.countsByActor.watch.changedBuddyAbsence.team_changed, 1);
  assert.equal(out.countsByActor.watch.changedBuddyAbsence.present, 0);
});

check('field presence, queue membership and only-actor turn remain separate facts', () => {
  const diagnostics = collector();
  diagnostics.observe(snapshot('team_queue', {
    onlyActorId: 'other', sides: [['watch', 'buddy'], ['other']], participants: ['other'],
  }), { eventCursor: 8 });
  const out = diagnostics.summary();
  assert.deepEqual(out.countsByActor.watch.team_queue, { on_field: 1, queued: 0, other_actor_turn: 1 });
  assert.equal(out.countsByActor.watch.changedBuddyAbsence.present, 1);
});

check('schedule status counters capture cast, recovery, hunt, support, locks and turn ownership', () => {
  const diagnostics = collector();
  diagnostics.observe(snapshot('schedule', {
    scheduled: { actorId: 'other', targetId: 'watch', actionType: 'basic', atSec: 11 },
    actors: [actor('watch', {
      hunt: { encounterId: 'hunt-1', kind: 'wildlife' }, bossAssistOwnerId: 'boss-1',
      recoveryUntilSec: 20, recoveryReason: 'post-hit', pendingCast: { targetId: 'other', releaseAtSec: 15 },
      actionReadyAtSec: 12, basicAttackReadyAtSec: 13, basicAllowed: false, actionBlocked: true,
      hasCombatIntent: false,
    })],
  }), { eventCursor: 9 });
  assert.deepEqual(diagnostics.summary().countsByActor.watch.schedule, {
    hunt: 1, support: 1, recovery: 1, cast: 1, action_locked: 1, attack_locked: 1,
    no_intent: 1, self_turn: 0, other_turn: 1,
  });
});

check('expired recovery timestamps do not count from a stale recovery reason alone', () => {
  const diagnostics = collector();
  diagnostics.observe(snapshot('schedule', {
    actors: [actor('watch', { recoveryUntilSec: 5, recoveryReason: 'old-post-hit-lock' })],
  }), { eventCursor: 'expired-recovery' });
  assert.equal(diagnostics.summary().countsByActor.watch.schedule.recovery, 0);
});

check('schedule stage with no sides treats same-team, same-space live buddies as present facts', () => {
  const diagnostics = collector();
  diagnostics.observe(snapshot('schedule', { sides: [] }), { eventCursor: 'schedule-buddy' });
  const out = diagnostics.summary();
  assert.equal(out.countsByActor.watch.changedBuddyAbsence.present, 1);
  assert.equal(out.samplesByActor.watch[0].changedBuddyFacts[0].reason, 'present');
});

check('samples are bounded per actor with a three-per-stage split', () => {
  const diagnostics = collector();
  for (let index = 0; index < 8; index += 1) {
    diagnostics.observe(snapshot('schedule', {
      scheduled: { actorId: 'watch', targetId: 'other', actionType: 'basic', atSec: index },
      actors: [actor('watch', { intentTargetId: `target-${index}` })],
    }),
      { eventCursor: index });
    diagnostics.observe(snapshot('team_queue'), { eventCursor: `q-${index}` });
  }
  const samples = diagnostics.summary().samplesByActor.watch;
  assert.equal(samples.length, 6);
  const scheduleSamples = samples.filter(item => item.stage === 'schedule');
  const queueSamples = samples.filter(item => item.stage === 'team_queue');
  assert.equal(scheduleSamples.length, 3);
  assert.equal(queueSamples.length, 3);
  assert.deepEqual(scheduleSamples.map(item => item.eventCursor), [0, 1, 2]);
  assert.deepEqual(queueSamples.map(item => item.eventCursor), ['q-0', 'q-1', 'q-2']);
  assert.deepEqual(samples.map(item => item.stage), ['schedule', 'team_queue', 'schedule', 'team_queue', 'schedule', 'team_queue']);
});

check('unrelated queue observations do not consume field-diagnostic sample slots', () => {
  const diagnostics = collector();
  for (let index = 0; index < 5; index += 1) {
    diagnostics.observe(snapshot('team_queue', {
      sides: [['other'], ['buddy']], participants: ['other'],
    }), { eventCursor: index });
  }
  const out = diagnostics.summary();
  assert.deepEqual(out.samplesByActor.watch, []);
  assert.deepEqual(out.countsByActor.watch.team_queue, { on_field: 0, queued: 0, other_actor_turn: 0 });
  assert.equal(Object.values(out.countsByActor.watch.changedBuddyAbsence).reduce((sum, count) => sum + count, 0), 0,
    'An unrelated encounter cannot count a watched team as missing its buddies.');
});

check('duplicate scheduled states are skipped without retaining caller-owned snapshots', () => {
  const diagnostics = collector();
  const duplicate = snapshot('schedule', {
    scheduled: { actorId: 'watch', targetId: 'other', actionType: 'basic', atSec: 11 },
  });
  diagnostics.observe(duplicate, { eventCursor: 'first' });
  for (let index = 0; index < 25; index += 1) diagnostics.observe(duplicate, { eventCursor: `duplicate-${index}` });
  duplicate.scheduled.actorId = 'mutated'; duplicate.actors[0].pendingCast = { targetId: 'mutated', releaseAtSec: 999 };
  diagnostics.observe(snapshot('schedule', {
    scheduled: { actorId: 'watch', targetId: 'other', actionType: 'basic', atSec: 12 },
    actors: [actor('watch', { pendingCast: { targetId: 'other', releaseAtSec: 15 } })],
  }), { eventCursor: 'distinct-cast' });
  const samples = diagnostics.summary().samplesByActor.watch;
  assert.deepEqual(samples.map(item => item.eventCursor), ['first', 'distinct-cast']);
  assert.equal(samples[0].currentState.scheduled.actorId, 'watch');
  assert.equal(samples[0].currentState.actor.pendingCast, null);
  assert.equal(samples[1].currentState.actor.pendingCast.targetId, 'other');
});

check('snapshot and returned summary mutation cannot alter retained owned samples', () => {
  const diagnostics = collector();
  const frame = snapshot('schedule', {
    scheduled: { actorId: 'watch', targetId: 'other', actionType: 'basic', atSec: 11 },
  });
  diagnostics.observe(frame, { eventCursor: { nested: 'not-retained' } });
  frame.scheduled.actorId = 'changed'; frame.actors[0].spatial.x = 999;
  frame.sides[0].push('late-actor');
  const first = diagnostics.summary();
  assert.equal(first.samplesByActor.watch[0].eventCursor, null);
  assert.equal(first.samplesByActor.watch[0].currentState.scheduled.actorId, 'watch');
  assert.equal(first.samplesByActor.watch[0].currentState.actor.spatial.x, 1);
  first.samplesByActor.watch[0].currentState.actor.spatial.x = -1;
  first.countsByActor.watch.schedule.self_turn = 99;
  const second = diagnostics.summary();
  assert.equal(second.samplesByActor.watch[0].currentState.actor.spatial.x, 1);
  assert.equal(second.countsByActor.watch.schedule.self_turn, 1);
});

check('state labels cannot expand the fixed counter schema', () => {
  const diagnostics = collector();
  diagnostics.observe(snapshot('schedule', {
    actors: [actor('watch', { hunt: { kind: 'arbitrary-hunt-label' }, recoveryReason: 'arbitrary-recovery-label' })],
  }), { eventCursor: 10 });
  const counts = diagnostics.summary().countsByActor.watch;
  assert.deepEqual(Object.keys(counts.schedule), [
    'hunt', 'support', 'recovery', 'cast', 'action_locked', 'attack_locked', 'no_intent', 'self_turn', 'other_turn',
  ]);
  assert.deepEqual(Object.keys(counts.changedBuddyAbsence), [
    'absent_runtime_roster', 'team_changed', 'dead', 'different_zone', 'different_space', 'present',
    'actor_absent_runtime_roster', 'truncated_roster',
  ]);
});

check('counter semantics distinguish candidates, relevant queues and aggregate snapshot facts', () => {
  const semantics = collector().summary().counterSemantics;
  assert.match(semantics.schedule, /PvP candidate before wildlife\/equipment arbitration/);
  assert.match(semantics.schedule, /not an executed turn/);
  assert.match(semantics.actor_schedule, /missing candidate row is unavailable/);
  assert.match(semantics.actor_schedule, /not global counts/);
  assert.match(semantics.post_world, /Fixed before\/after movement-reason buckets/);
  assert.match(semantics.post_world, /not proof of movement\/attack causation/);
  assert.match(semantics.team_queue, /unrelated encounters are excluded/);
  assert.match(semantics.team_queue, /Counts continue after sample limits/);
  assert.match(semantics.changedBuddyAbsence, /not per-encounter absence causes or elapsed seconds/);
  assert.match(semantics.arbitration, /not an executed attack/);
  assert.match(semantics.team_execution, /does not establish survival causality/);
});

const arbitration = (scheduler, due = true, extra = {}) => snapshot('arbitration', {
  scheduled: { actorId: 'watch', targetId: 'other', actionType: 'basic', atSec: 11 }, sides: [],
  arbitration: { selectedScheduler: scheduler, selectedActorId: scheduler === 'pvp' ? 'watch' : 'other',
    selectedActionType: 'basic', selectedAtSec: 11, decisionSec: due ? 11 : 10.5, scheduled: due }, ...extra,
});
check('unavailable watched actors and truncated buddies are not counted as actual buddy absence', () => {
  const missingActor = collector();
  missingActor.observe(snapshot('schedule', { actors: [actor('buddy')], sides: [] }));
  assert.equal(missingActor.summary().countsByActor.watch.changedBuddyAbsence.actor_absent_runtime_roster, 1);
  assert.equal(missingActor.summary().countsByActor.watch.changedBuddyAbsence.absent_runtime_roster, 0);
  const partial = collector();
  partial.observe(snapshot('schedule', { truncated: true, actors: [actor('watch')], sides: [] }));
  partial.observe(snapshot('schedule', { truncated: true, actors: [actor('buddy')], sides: [] }));
  partial.observe(snapshot('schedule', { truncated: true, actors: [actor('watch'), actor('buddy')], sides: [] }));
  assert.equal(partial.summary().countsByActor.watch.changedBuddyAbsence.truncated_roster, 2);
  assert.equal(partial.summary().countsByActor.watch.changedBuddyAbsence.absent_runtime_roster, 0);
  assert.equal(partial.summary().countsByActor.watch.changedBuddyAbsence.present, 1);
});
check('final arbitration separates reservation, deadline deferral and wildlife/equipment priority', () => {
  const diagnostics = collector();
  for (const state of [arbitration('pvp'), arbitration('pvp', false), arbitration('wildlife'), arbitration('equipment')]) {
    diagnostics.observe(state, { eventCursor: 10 });
  }
  diagnostics.observe(arbitration('pvp', true, {
    scheduled: { actorId: 'other', targetId: 'watch', actionType: 'basic', atSec: 11 },
  }));
  assert.deepEqual(diagnostics.summary().countsByActor.watch.arbitration,
    { candidate: 4, selected: 1, deferred: 1, wildlife_first: 1, equipment_first: 1 });
  assert.equal(diagnostics.summary().countsByActor.watch.schedule.self_turn, 0,
    'Final reservation facts must not inflate the separate pre-arbitration snapshot count.');
});
const execution = outcome => snapshot('team_execution', {
  resolution: { actorId: 'watch', targetId: 'other', encounterId: 'actual', outcome,
    hpBefore: 100, hpAfter: outcome === 'hp_hit' ? 90 : 100, hpDamage: outcome === 'hp_hit' ? 10 : 0 },
});
check('actual team resolution counters exclude other strikers, unknown labels and hypothetical queue membership', () => {
  const diagnostics = collector();
  diagnostics.observe(snapshot('team_queue'));
  for (const outcome of ['invalidated_before_strike', 'no_valid_target', 'not_performed', 'performed_no_hp', 'hp_hit']) {
    diagnostics.observe(execution(outcome));
  }
  diagnostics.observe(execution('unknown-label'));
  const other = execution('hp_hit'); other.resolution.actorId = 'buddy'; diagnostics.observe(other);
  assert.deepEqual(diagnostics.summary().countsByActor.watch.team_execution,
    { invalidated_before_strike: 1, no_valid_target: 1, not_performed: 1, performed_no_hp: 1, hp_hit: 1 });
  assert.equal(diagnostics.summary().countsByActor.watch.team_queue.queued, 1);
  assert.equal(diagnostics.summary().countsByActor.watch.changedBuddyAbsence.present, 1,
    'New point-in-time observations must not redefine the existing schedule/queue absence frequency.');
});
check('final-stage samples are separately bounded and do not retain or alias caller graphs', () => {
  const diagnostics = collector();
  for (let index = 0; index < 20; index++) {
    diagnostics.observe(arbitration(index % 2 ? 'pvp' : 'equipment', index % 3 !== 0, {
      scheduled: { actorId: 'watch', targetId: 'other', actionType: 'approach', atSec: index },
    }), { eventCursor: index });
    diagnostics.observe(execution('hp_hit'), { eventCursor: index });
  }
  const out = diagnostics.summary();
  assert.equal(out.samplesByActor.watch.length, 0);
  assert.equal(out.executionSamplesByActor.watch.length, 6);
  assert.equal(out.executionSamplesByActor.watch.filter(value => value.stage === 'arbitration').length, 3);
  assert.equal(out.executionSamplesByActor.watch.filter(value => value.stage === 'team_execution').length, 3);
  assert.equal(out.countsByActor.watch.arbitration.candidate, 20);
  assert.equal(out.countsByActor.watch.team_execution.hp_hit, 20);
  out.executionSamplesByActor.watch[0].currentState.arbitration.selectedActorId = 'mutated';
  assert.notEqual(diagnostics.summary().executionSamplesByActor.watch[0].currentState.arbitration.selectedActorId, 'mutated');
  const zero = collector({ sampleLimit: 0 }); zero.observe(execution('hp_hit')); zero.observe(arbitration('pvp'));
  assert.deepEqual(zero.summary().executionSamplesByActor.watch, []);
  assert.equal(zero.summary().countsByActor.watch.team_execution.hp_hit, 1);
});
check('action-type counters are fixed and retain the latest late basic without expanding sample bounds', () => {
  for (const sampleLimit of [1, 2, 6]) {
    const diagnostics = collector({ sampleLimit });
    for (let index = 0; index < 20; index++) {
      diagnostics.observe(arbitration('pvp', true, {
        scheduled: { actorId: 'watch', targetId: '', actionType: 'approach', atSec: index },
      }), { eventCursor: index });
    }
    for (let index = 20; index < 30; index++) diagnostics.observe(arbitration('pvp'), { eventCursor: index });
    const out = diagnostics.summary();
    assert.equal(out.countsByActor.watch.arbitrationByActionType.approach.selected, 20);
    assert.equal(out.countsByActor.watch.arbitrationByActionType.basic.selected, 10);
    assert.equal(out.executionSamplesByActor.watch.find(item => item.currentState.scheduled.actionType === 'basic').eventCursor, 29);
    assert.ok(out.executionSamplesByActor.watch.length <= Math.ceil(sampleLimit / 2));
    for (const key of Object.keys(out.countsByActor.watch.arbitration)) assert.equal(
      Object.values(out.countsByActor.watch.arbitrationByActionType).reduce((sum, counts) => sum + counts[key], 0),
      out.countsByActor.watch.arbitration[key]);
  }
  const diagnostics = collector();
  diagnostics.observe(arbitration('pvp', true, {
    scheduled: { actorId: 'watch', targetId: 'other', actionType: '__proto__', atSec: 11 },
  }));
  assert.equal(diagnostics.summary().countsByActor.watch.arbitrationByActionType.other.selected, 1);
  assert.deepEqual(Object.keys(diagnostics.summary().countsByActor.watch.arbitrationByActionType),
    ['basic', 'approach', 'skill_start', 'skill_release', 'skill_expire', 'status_boundary', 'other']);
});

const candidateFact = (extra = {}) => ({ actorId: 'watch', branch: 'observed_out_of_range',
  candidate: { actorId: 'watch', targetId: 'other', actionType: 'approach', atSec: 10.25 },
  opponentCount: 2, nearestTargetId: 'other', nearestDistance: 9, attackRange: 3, motionReason: 'approach', ...extra });
const actorSchedule = (extra = {}) => snapshot('actor_schedule', { actorCandidates: [candidateFact()], ...extra });
const selectedPvp = ({ actorId = 'watch', targetId = 'other', actionType = 'basic', atSec = 11,
  nowSec = 10, decisionSec = 11, actorExtra = {}, targetExtra = {}, truncated = false } = {}) => snapshot('arbitration', {
  nowSec, truncated, scheduled: { actorId, targetId, actionType, atSec }, sides: [],
  arbitration: { selectedScheduler: 'pvp', selectedActorId: actorId, selectedActionType: actionType,
    selectedAtSec: atSec, decisionSec, scheduled: true },
  actors: [actor('watch', { attackRange: 2, spatial: { x: 1, y: 2 }, ...actorExtra }),
    actor('other', { teamId: 'team-b', attackRange: 2, spatial: { x: 11, y: 2 }, ...targetExtra })],
});
const postWorld = ({ actorId = 'watch', targetId = 'other', actionType = 'basic', atSec = 11,
  fromSec = 10, toSec = atSec, nowSec = toSec, decisionSec = 11, actors = null, truncated = false } = {}) => snapshot('post_world', {
  nowSec, truncated, scheduled: { actorId, targetId, actionType, atSec },
  worldStep: { fromSec, toSec, decisionSec },
  ...(actors ? { actors } : { actors: [actor('watch', { attackRange: 2, spatial: { x: 5, y: 2 },
    spatialMotion: { reason: 'approach', targetId: 'other', x: 11, y: 2, stopRange: 2 } }),
  actor('other', { teamId: 'team-b', attackRange: 2, spatial: { x: 11, y: 2 } })] }),
});

check('actor_schedule is a per-watched-actor top candidate, not the global winner, with fixed branch/motion buckets', () => {
  const diagnostics = collector();
  diagnostics.observe(actorSchedule({ scheduled: { actorId: 'other', targetId: 'watch', actionType: 'basic', atSec: 11 },
    actorCandidates: [candidateFact({ branch: 'observed_out_of_range', motionReason: 'approach' })] }), { eventCursor: 'per-actor' });
  diagnostics.observe(actorSchedule({ actorCandidates: [candidateFact({ branch: '__proto__', motionReason: 'surprise',
    candidate: { actorId: 'other', targetId: 'watch', actionType: 'basic', atSec: 10.5 } })] }), { eventCursor: 'invalid' });
  const out = diagnostics.summary();
  assert.deepEqual(out.countsByActor.watch.actor_schedule, {
    candidate: 1, no_candidate: 0,
    byActionType: { basic: 0, approach: 1, skill_start: 0, skill_release: 0, skill_expire: 0,
      status_boundary: 0, other: 0, none: 0 },
    availability: { candidate_row: 2, missing_candidate_row: 0, truncated: 0, actor_missing: 0, invalid_candidate_actor: 1 },
    branches: { dead_or_rift: 0, wildlife_hunt: 0, boss_assist: 0, forced_control: 0, pending_cast: 0,
      no_intent_patrol: 0, no_opponents_last_seen: 0, no_opponents_patrol: 0, observed_out_of_range: 1,
      basic_in_range: 0, other: 1 },
    motion: { none: 0, patrol: 0, last_seen: 0, chase: 1, forced: 0, other: 1 },
  });
  assert.equal(out.causalSamplesByActor.watch[0].currentState.candidate.actionType, 'approach');
  assert.equal(out.causalSamplesByActor.watch[0].currentState.actionType, 'approach');
  assert.equal(out.causalSamplesByActor.watch[1].currentState.candidateActorMismatch, true);
  assert.equal(out.causalSamplesByActor.watch[1].currentState.candidateValid, false);
  assert.equal(out.causalSamplesByActor.watch[1].retainedAs, undefined,
    'A mismatched actor candidate cannot occupy the latest-basic retention slot.');
  assert.match(out.counterSemantics.actor_schedule, /single best candidate/);
  assert.match(out.counterSemantics.actor_schedule, /not the global winner/);
});

check('actor_schedule input snapshots are reduced to bounded owned facts and missing/truncated rows stay unavailable', () => {
  const diagnostics = collector();
  const fact = candidateFact({ motionReason: 'patrol' });
  const frame = actorSchedule({ actorCandidates: [fact] });
  diagnostics.observe(frame, { eventCursor: 'owned' });
  fact.candidate.targetId = 'mutated'; frame.actors[0].spatial.x = 99;
  frame.actorCandidates.push(candidateFact({ candidate: { actorId: 'watch', actionType: 'basic', atSec: 12 } }));
  diagnostics.observe(snapshot('actor_schedule', { actorCandidates: [] }), { eventCursor: 'missing' });
  const out = diagnostics.summary();
  assert.equal(out.countsByActor.watch.actor_schedule.candidate, 1);
  assert.equal(out.countsByActor.watch.actor_schedule.no_candidate, 0,
    'A missing candidate row is not evidence that the planner found no candidate.');
  assert.deepEqual(out.countsByActor.watch.actor_schedule.availability,
    { candidate_row: 1, missing_candidate_row: 1, truncated: 0, actor_missing: 0, invalid_candidate_actor: 0 });
  assert.equal(out.causalSamplesByActor.watch[0].currentState.candidate.targetId, 'other');
  assert.equal(out.causalSamplesByActor.watch[0].currentState.actor.spatial.x, 1);

  const truncated = collector();
  truncated.observe(actorSchedule({ actorCandidatesTruncated: true, actors: [], actorCandidates: [candidateFact({ candidate: null })] }));
  const truncatedCounts = truncated.summary().countsByActor.watch.actor_schedule;
  assert.equal(truncatedCounts.no_candidate, 1, 'An explicit null candidate row is a genuine no-candidate result.');
  assert.deepEqual(truncatedCounts.availability,
    { candidate_row: 1, missing_candidate_row: 0, truncated: 1, actor_missing: 1, invalid_candidate_actor: 0 });
  assert.equal(truncatedCounts.byActionType.none, 1);
});

check('post_world pairs exact selected PvP identity/time and reports before/after movement and range', () => {
  const diagnostics = collector();
  diagnostics.observe(selectedPvp({ actorExtra: {
    spatialMotion: { reason: 'approach', targetId: 'other', x: 11, y: 2, stopRange: 2 },
    spatialLastSeen: { targetId: 'other', x: 11, y: 2, seenAtSec: 10 },
  } }), { eventCursor: 'before' });
  diagnostics.observe(postWorld(), { eventCursor: 'after' });
  const out = diagnostics.summary();
  assert.deepEqual(out.countsByActor.watch.post_world.pairing, { matched: 1, no_pending: 0, identity_mismatch: 0, time_mismatch: 0 });
  assert.equal(out.countsByActor.watch.post_world.actorMovement.moved, 1);
  assert.equal(out.countsByActor.watch.post_world.targetMovement.stationary, 1);
  assert.equal(out.countsByActor.watch.post_world.motionBefore.chase, 1);
  assert.equal(out.countsByActor.watch.post_world.motionAfter.chase, 1);
  const sample = out.causalSamplesByActor.watch.find(item => item.stage === 'post_world');
  assert.equal(sample.currentState.distanceBefore, 10);
  assert.equal(sample.currentState.distanceAfter, 6);
  assert.equal(sample.currentState.attackRangeBefore, 2);
  assert.equal(sample.currentState.motionReasonBefore, 'chase');
  assert.equal(sample.currentState.motionReasonAfter, 'chase');
  assert.match(out.counterSemantics.post_world, /exact world interval/);
  assert.match(out.counterSemantics.post_world, /not proof of movement\/attack causation or a successful attack/);
});

check('post_world motion buckets stay idempotent after minimal-actor normalization', () => {
  for (const [raw, expected] of [['', 'none'], ['none', 'none'], ['patrol', 'patrol'],
    ['last_seen', 'last_seen'], ['approach', 'chase'], ['chase', 'chase'],
    ['forced_control', 'forced'], ['forced', 'forced'], ['unknown', 'other']]) {
    const diagnostics = collector();
    diagnostics.observe(selectedPvp({ actorExtra: {
      spatialMotion: { reason: raw, targetId: 'other', x: 11, y: 2, stopRange: 2 },
    } }));
    diagnostics.observe(postWorld({ actors: [actor('watch', { attackRange: 2, spatial: { x: 5, y: 2 },
      spatialMotion: { reason: raw, targetId: 'other', x: 11, y: 2, stopRange: 2 } }),
    actor('other', { teamId: 'team-b', attackRange: 2, spatial: { x: 11, y: 2 } })] }));
    const counts = diagnostics.summary().countsByActor.watch.post_world;
    assert.equal(counts.pairing.matched, 1);
    assert.equal(counts.motionBefore[expected], 1, `${raw}: pre-world bucket`);
    assert.equal(counts.motionAfter[expected], 1, `${raw}: post-world bucket`);
  }
});

check('post_world rejects stale actor, target, action, candidate time and world-step time pairs', () => {
  const rejected = [
    ['identity_mismatch', postWorld({ targetId: 'buddy' })],
    ['identity_mismatch', postWorld({ actionType: 'approach' })],
    ['identity_mismatch', postWorld({ actorId: 'buddy' })],
    ['identity_mismatch', postWorld({ atSec: 12, toSec: 12, decisionSec: 12 })],
    ['time_mismatch', postWorld({ fromSec: 9 })],
    ['time_mismatch', postWorld({ toSec: 10.5 })],
    ['time_mismatch', postWorld({ decisionSec: 10.5 })],
    ['time_mismatch', postWorld({ nowSec: 10.5 })],
  ];
  for (const [key, after] of rejected) {
    const diagnostics = collector();
    diagnostics.observe(selectedPvp()); diagnostics.observe(after);
    const counts = diagnostics.summary().countsByActor.watch.post_world.pairing;
    assert.equal(counts[key], 1);
    assert.equal(counts.matched, 0);
    assert.equal(diagnostics.summary().causalSamplesByActor.watch.filter(item => item.stage === 'post_world').length, 0);
  }
});

check('post_world requires a selected PvP reservation and a fresh pending boundary', () => {
  const diagnostics = collector();
  diagnostics.observe(arbitration('wildlife'));
  diagnostics.observe(postWorld());
  diagnostics.observe(selectedPvp());
  diagnostics.observe(arbitration('equipment'));
  diagnostics.observe(postWorld());
  const pair = diagnostics.summary().countsByActor.watch.post_world.pairing;
  assert.equal(pair.no_pending, 2);
  assert.equal(pair.matched, 0);

  const stale = collector();
  stale.observe(selectedPvp());
  stale.observe(actorSchedule());
  stale.observe(postWorld());
  assert.equal(stale.summary().countsByActor.watch.post_world.pairing.no_pending, 1,
    'Any intervening stage invalidates the one-step pending reservation.');
  const unknownStage = collector();
  unknownStage.observe(selectedPvp());
  unknownStage.observe({ stage: 'unrelated_observer_stage' });
  unknownStage.observe(postWorld());
  assert.equal(unknownStage.summary().countsByActor.watch.post_world.pairing.no_pending, 1,
    'Unknown intervening observations also invalidate pending pair state.');
});

check('per-actor action-type totals are fixed, reject mismatched candidates and count explicit null only as none', () => {
  const diagnostics = collector();
  for (const actionType of ['basic', 'approach', 'skill_start', 'skill_release', 'skill_expire', 'status_boundary', 'unrecognized']) {
    diagnostics.observe(actorSchedule({ actorCandidates: [candidateFact({ candidate: {
      actorId: 'watch', targetId: 'other', actionType, atSec: 11,
    } })] }));
  }
  diagnostics.observe(actorSchedule({ actorCandidates: [candidateFact({ candidate: null })] }));
  diagnostics.observe(actorSchedule({ actorCandidates: [candidateFact({ candidate: {
    actorId: 'other', targetId: 'watch', actionType: 'basic', atSec: 12,
  } })] }));
  const counts = diagnostics.summary().countsByActor.watch.actor_schedule;
  assert.deepEqual(counts.byActionType,
    { basic: 1, approach: 1, skill_start: 1, skill_release: 1, skill_expire: 1, status_boundary: 1, other: 1, none: 1 });
  assert.equal(counts.candidate, 7);
  assert.equal(counts.no_candidate, 1);
  assert.equal(counts.availability.invalid_candidate_actor, 1);
  assert.deepEqual(Object.keys(counts.byActionType),
    ['basic', 'approach', 'skill_start', 'skill_release', 'skill_expire', 'status_boundary', 'other', 'none']);
});

check('post_world movement buckets distinguish stationary, changed zone/space and absent/truncated actors', () => {
  const diagnostics = collector();
  const record = post => { diagnostics.observe(selectedPvp()); diagnostics.observe(post); };
  record(postWorld({ actors: [actor('watch', { spatial: { x: 1, y: 2 }, attackRange: 2 }),
    actor('other', { teamId: 'team-b', spatial: { x: 11, y: 2 } })] }));
  record(postWorld({ actors: [actor('watch', { zoneId: 'zone-2', spatial: { zoneId: 'zone-2', x: 1, y: 2 } }),
    actor('other', { teamId: 'team-b', spatial: { x: 11, y: 2 } })] }));
  record(postWorld({ truncated: true, actors: [actor('watch', { spatial: { x: 1, y: 2 } })] }));
  const out = diagnostics.summary();
  assert.equal(out.countsByActor.watch.post_world.actorMovement.stationary, 2);
  assert.equal(out.countsByActor.watch.post_world.actorMovement.changed_zone_space, 1);
  assert.equal(out.countsByActor.watch.post_world.targetMovement.truncated_roster, 1);
  assert.equal(out.causalSamplesByActor.watch.filter(item => item.stage === 'post_world').length, 1,
    'Repeated basic snapshots replace the retained latest-basic slot rather than filling the sample cap.');
});

check('targetless patrol reservations use no_target rather than implying a missing target', () => {
  const diagnostics = collector();
  diagnostics.observe(selectedPvp({ targetId: '', actionType: 'approach' }));
  diagnostics.observe(postWorld({ targetId: '', actionType: 'approach' }));
  const counts = diagnostics.summary().countsByActor.watch.post_world.targetMovement;
  assert.equal(counts.no_target, 1);
  assert.equal(counts.missing_target, 0);
  assert.deepEqual(Object.keys(counts),
    ['moved', 'stationary', 'changed_zone_space', 'no_target', 'missing_target', 'truncated_roster', 'position_missing']);
});

check('causal samples are capped at three per new stage and preserve latest basic and last chase', () => {
  const diagnostics = collector();
  for (let index = 0; index < 10; index++) {
    const actionType = index === 7 || index === 8 ? 'basic' : 'approach';
    const motionReason = index === 9 ? 'last_seen' : index >= 7 ? 'none' : 'patrol';
    diagnostics.observe(actorSchedule({ actorCandidates: [candidateFact({ candidate: {
      actorId: 'watch', targetId: 'other', actionType, atSec: 11 + index }, motionReason })] }), { eventCursor: `a${index}` });
    const atSec = 11 + index;
    diagnostics.observe(selectedPvp({ atSec, decisionSec: atSec, actionType,
      actorExtra: { spatialMotion: { reason: motionReason === 'last_seen' ? 'last_seen' : motionReason === 'patrol' ? 'patrol' : '' } } }),
    { eventCursor: `pre${index}` });
    diagnostics.observe(postWorld({ atSec, toSec: atSec, decisionSec: atSec, actionType,
      actors: [actor('watch', { attackRange: 2, spatial: { x: 5 + index, y: 2 },
        spatialMotion: { reason: motionReason === 'last_seen' ? 'last_seen' : motionReason === 'patrol' ? 'patrol' : 'approach' } }),
      actor('other', { teamId: 'team-b', spatial: { x: 11, y: 2 } })] }), { eventCursor: `p${index}` });
  }
  const out = diagnostics.summary(); const samples = out.causalSamplesByActor.watch;
  const actorSamples = samples.filter(item => item.stage === 'actor_schedule');
  const worldSamples = samples.filter(item => item.stage === 'post_world');
  assert.equal(actorSamples.length, 3); assert.equal(worldSamples.length, 3);
  assert.equal(actorSamples.find(item => item.retainedAs?.includes('latest_basic')).eventCursor, 'a8');
  assert.equal(worldSamples.find(item => item.retainedAs?.includes('latest_basic')).eventCursor, 'p8');
  assert.equal(actorSamples.find(item => item.retainedAs?.includes('last_chase')).eventCursor, 'a9');
  assert.equal(worldSamples.find(item => item.retainedAs?.includes('last_chase')).eventCursor, 'p9');
  const overlap = collector();
  overlap.observe(actorSchedule({ actorCandidates: [candidateFact({ motionReason: 'last_seen', candidate: {
    actorId: 'watch', targetId: 'other', actionType: 'basic', atSec: 11,
  } })] }));
  overlap.observe(selectedPvp({ actionType: 'basic', actorExtra: {
    spatialMotion: { reason: 'last_seen', targetId: 'other', x: 11, y: 2, stopRange: 2 },
  } }));
  overlap.observe(postWorld({ actionType: 'basic', actors: [actor('watch', {
    spatialMotion: { reason: 'last_seen', targetId: 'other', x: 11, y: 2, stopRange: 2 },
  }), actor('other', { teamId: 'team-b' })] }));
  const overlapping = overlap.summary().causalSamplesByActor.watch;
  for (const stage of ['actor_schedule', 'post_world']) {
    const sample = overlapping.find(item => item.stage === stage);
    assert.ok(sample.retainedAs.includes('latest_basic'));
    assert.ok(sample.retainedAs.includes('last_chase'));
  }
  assert.ok(out.samplesByActor.watch.length <= 6);
  assert.ok(out.executionSamplesByActor.watch.length <= 6);
  assert.ok(samples.length <= 6);
  assert.equal(out.overallSampleLimit, 18);
});

check('new counter keys and motion/branch buckets cannot be expanded by caller labels', () => {
  const diagnostics = collector();
  diagnostics.observe(actorSchedule({ actorCandidates: [candidateFact({ branch: 'constructor', motionReason: 'constructor' })] }));
  diagnostics.observe(selectedPvp()); diagnostics.observe(postWorld());
  const counts = diagnostics.summary().countsByActor.watch;
  assert.deepEqual(Object.keys(counts.actor_schedule.branches), [...ACTOR_BRANCH_TEST_KEYS]);
  assert.deepEqual(Object.keys(counts.actor_schedule.byActionType),
    ['basic', 'approach', 'skill_start', 'skill_release', 'skill_expire', 'status_boundary', 'other', 'none']);
  assert.deepEqual(Object.keys(counts.actor_schedule.motion), ['none', 'patrol', 'last_seen', 'chase', 'forced', 'other']);
  assert.deepEqual(Object.keys(counts.post_world.pairing), ['matched', 'no_pending', 'identity_mismatch', 'time_mismatch']);
  assert.deepEqual(Object.keys(counts.actor_schedule.availability),
    ['candidate_row', 'missing_candidate_row', 'truncated', 'actor_missing', 'invalid_candidate_actor']);
  assert.deepEqual(Object.keys(counts.post_world.motionBefore), ['none', 'patrol', 'last_seen', 'chase', 'forced', 'other']);
  assert.equal(counts.actor_schedule.branches.other, 1);
  assert.equal(counts.actor_schedule.motion.other, 1);
});

check('summary copies causal samples and diagnostics retain no original nested spatial objects', () => {
  const diagnostics = collector();
  const pre = selectedPvp({ actorExtra: { spatial: { x: 1, y: 2 }, spatialMotion: { reason: 'approach', x: 9, y: 2 } } });
  diagnostics.observe(pre);
  const post = postWorld(); diagnostics.observe(post);
  pre.actors[0].spatialMotion.x = -100; post.actors[0].spatial.x = -100;
  const first = diagnostics.summary();
  const sample = first.causalSamplesByActor.watch.find(item => item.stage === 'post_world');
  assert.equal(sample.currentState.actorBefore.spatialMotion.x, 9);
  assert.equal(sample.currentState.actorAfter.spatial.x, 5);
  sample.currentState.actorAfter.spatial.x = -1;
  assert.equal(diagnostics.summary().causalSamplesByActor.watch.find(item => item.stage === 'post_world')
    .currentState.actorAfter.spatial.x, 5);
});

check('new stages do not alter existing frequency counters or existing 6+6 sample policies', () => {
  const diagnostics = collector();
  for (let index = 0; index < 12; index++) {
    diagnostics.observe(actorSchedule(), { eventCursor: `actor${index}` });
    diagnostics.observe(snapshot('schedule', { scheduled: { actorId: 'watch', targetId: 'other', actionType: 'basic', atSec: 11 + index } }));
    diagnostics.observe(arbitration('pvp', true, { scheduled: { actorId: 'watch', targetId: 'other', actionType: 'basic', atSec: 11 + index },
      arbitration: { selectedScheduler: 'pvp', selectedActorId: 'watch', selectedActionType: 'basic', selectedAtSec: 11 + index,
        decisionSec: 11 + index, scheduled: true } }));
    diagnostics.observe(execution('hp_hit'));
  }
  const out = diagnostics.summary();
  assert.equal(out.countsByActor.watch.schedule.self_turn, 12,
    'The unchanged schedule stage still counts its own observed pre-arbitration candidate.');
  assert.equal(out.countsByActor.watch.arbitration.candidate, 12);
  assert.equal(out.countsByActor.watch.team_execution.hp_hit, 12);
  assert.ok(out.samplesByActor.watch.length <= 6);
  assert.ok(out.executionSamplesByActor.watch.length <= 6);
  assert.equal(out.causalSamplesByActor.watch.filter(item => item.stage === 'actor_schedule').length, 1,
    'Repeated chase candidates replace their latest-chase sample while the existing counts continue.');
  assert.equal(out.causalSamplesByActor.watch.filter(item => item.stage === 'post_world').length, 0);
});

console.log(`PASS ${checks} team combat participation diagnostic checks`);
