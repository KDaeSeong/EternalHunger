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

console.log(`PASS ${checks} team combat participation diagnostic checks`);
