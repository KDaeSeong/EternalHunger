import assert from 'node:assert/strict';
import { summarizeMovementReversalTrace } from './lib/movement-reversal-trace.mjs';

let checks = 0;
const check = (name, fn) => { fn(); checks += 1; console.log(`PASS ${name}`); };
const freezeDeep = (value) => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(freezeDeep);
    Object.freeze(value);
  }
  return value;
};
const move = (who, from, to, reason = 'team_rotate', extra = {}) => ({ kind: 'move', who, from, to, reason, ...extra });

check('event insertion order isolates actor reversals across cross-actor interleaving and pairs nearest decisions', () => {
  const events = freezeDeep([
    { kind: 'team_decision', who: 'a1', teamId: 't1', reason: 'old', from: 'a', to: 'b', moved: true, at: { sec: 1 } },
    move('a1', 'a', 'b', 'team_rotate', { teamId: 't1', at: { sec: 10 }, targetZoneId: 'goal-one',
      teamAssessment: { allyCount: 2, enemyCount: 0, allyPower: 80, enemyPower: 0, powerRatio: 1, shouldAvoid: false },
      decisionEvidence: { compared: true }, retreatOutcome: '',
      sharedGoalReason: 'core hunt', movementObjective: { type: 'natural_core', subkind: 'meteor', targetZoneId: 'goal-one',
        sourceIds: ['core-1'], resourceKinds: ['meteor'], beneficiary: { who: 'a1', targetItemId: 'legend' } } }),
    move('a2', 'x', 'y', 'team_rotate', { teamId: 't2', at: { sec: 11 } }),
    { kind: 'team_decision', who: 'a1', teamId: 't1', reason: 'team_rotate', from: 'a', to: 'b', moved: true, at: { sec: 10 },
      allyCount: 2, enemyCount: 0, allyPower: 80, enemyPower: 0, powerRatio: 1, shouldAvoid: false,
      comparison: { scope: 'team', ratio: 1 }, decisionEvidence: { compared: true }, retreatOutcome: '' },
    { kind: 'movement_goal', who: 'a1', teamId: 't1', at: { sec: 12 }, objective: { targetZoneId: 'goal-two' } },
    { kind: 'field_resource', who: 'a2', teamId: 't1', at: { sec: 13 }, itemId: 'ore', remaining: 0, depleted: true },
    { kind: 'spawn_state', at: { sec: 14 }, meteor: 1, lifeTree: 0 },
    move('a1', 'b', 'a', 'team_rotate', { teamId: 't1', at: { sec: 20 }, targetZoneId: 'goal-two',
      teamAssessment: { allyCount: 2, enemyCount: 0, allyPower: 80, enemyPower: 0, powerRatio: 1, shouldAvoid: false },
      decisionEvidence: { compared: true }, retreatOutcome: '',
      sharedGoalReason: 'rare resource appeared', movementObjective: { type: 'natural_core', subkind: 'meteor', targetZoneId: 'goal-two',
        sourceIds: ['core-2'], resourceKinds: ['meteor'], beneficiary: { who: 'a1', targetItemId: 'legend' } } }),
    { kind: 'team_decision', who: 'a1', teamId: 't1', reason: 'team_rotate', from: 'b', to: 'a', moved: true, at: { sec: 20 },
      allyCount: 2, enemyCount: 0, allyPower: 80, enemyPower: 0, powerRatio: 1, shouldAvoid: false,
      comparison: { scope: 'team', ratio: 1 }, decisionEvidence: { compared: true }, retreatOutcome: '' },
  ]);
  const before = structuredClone(events);
  const summary = summarizeMovementReversalTrace([{ _id: 'a1', teamId: 't1' }, { _id: 'a2', teamId: 't2' }], events,
    { maxContextEvents: 2 });
  assert.equal(summary.counts.teamRotate.total, 1);
  assert.deepEqual(summary.counts.teamRotate.byActor, { a1: 1 });
  assert.deepEqual(summary.counts.teamRotate.byTeam, { t1: 1 });
  const sample = summary.counts.teamRotate.samples[0];
  assert.equal(sample.previous.seq, 1);
  assert.equal(sample.current.seq, 7);
  assert.deepEqual(sample.previous.at, { sec: 10 });
  assert.equal(sample.previous.sourceReason, 'core hunt');
  assert.equal(sample.previous.teamDecision.seq, 3, 'same-second decision takes precedence over a closer stale event');
  assert.equal(sample.current.teamDecision.seq, 8);
  assert.equal(sample.previous.teamAssessment.allyPower, 80, 'the move keeps its actual nested team assessment');
  assert.equal(sample.previous.decisionEvidence.compared, true);
  assert.equal(sample.previous.retreatOutcome, '');
  assert.equal(sample.current.teamDecision.assessment.enemyCount, 0, 'the decision keeps actual flat assessment fields');
  assert.equal(sample.current.teamDecision.assessment.comparison.ratio, 1);
  assert.equal(sample.current.teamDecision.decisionEvidence.compared, true);
  assert.equal(sample.observations.targetChanged, true);
  assert.equal(sample.observations.sourceChanged, true);
  assert.equal(sample.observations.sourceReasonChanged, true);
  assert.equal(sample.observations.causeConfirmed, false);
  assert.equal(sample.context.length, 2);
  assert.deepEqual(sample.context.map((row) => row.scope), ['actor', 'actor'],
    'same-actor decision and goal context outrank team/world rows when the budget is tight');
  sample.current.movementObjective.sourceIds.push('mutated-output');
  sample.context[0].depleted = false;
  assert.deepEqual(events, before, 'Mutating trace output cannot mutate a frozen input stream.');
});

check('lifecycle and from discontinuity reset edges while same-zone moves are ignored', () => {
  const events = [
    move('dead', 'a', 'b'), { kind: 'death', who: 'dead', teamId: 't1' }, move('dead', 'b', 'a'),
    move('revived', 'a', 'b'), { kind: 'revive', who: 'revived', teamId: 't1' }, move('revived', 'b', 'a'),
    move('rift', 'a', 'b'), { kind: 'dimension_rift_space', who: 'rift', teamId: 't1' }, move('rift', 'b', 'a'),
    move('mismatch', 'a', 'b'), move('mismatch', 'c', 'a'),
    move('hold', 'a', 'b'), move('hold', 'b', 'b'), move('hold', 'b', 'a'),
  ];
  const summary = summarizeMovementReversalTrace([], events);
  assert.equal(summary.counts.teamRotate.total, 1, 'the same-zone hold does not erase the prior nonzero edge');
});

check('explicit outnumbered and power-gap reversals are counted fully with separate sample budgets', () => {
  const events = [];
  for (let index = 0; index < 5; index += 1) {
    events.push(move(`retreat-${index}`, 'a', 'b', 'flee:team_outnumbered', { teamId: 'retreat-team' }));
    events.push(move(`retreat-${index}`, 'b', 'a', 'flee:team_outnumbered', { teamId: 'retreat-team' }));
    events.push(move(`rotation-${index}`, 'c', 'd', 'team_rotate', { teamId: 'rotation-team' }));
    events.push(move(`rotation-${index}`, 'd', 'c', 'team_rotate', { teamId: 'rotation-team' }));
  }
  events.push(move('power-gap', 'x', 'y', 'flee:team_power_gap', { teamId: 'power-team' }));
  events.push(move('power-gap', 'y', 'x', 'flee:team_power_gap', { teamId: 'power-team' }));
  const summary = summarizeMovementReversalTrace([], events, {
    maxRotationSamples: 1, maxExplicitOutnumberedSamples: 2, maxExplicitPowerGapSamples: 1,
  });
  assert.equal(summary.counts.teamRotate.total, 5);
  assert.equal(summary.counts.teamRotate.samples.length, 1);
  assert.equal(summary.counts.explicitOutnumbered.total, 5);
  assert.equal(summary.counts.explicitOutnumbered.samples.length, 2);
  assert.equal(summary.counts.explicitOutnumbered.byTeam['retreat-team'], 5);
  assert.equal(summary.counts.explicitPowerGap.total, 1);
  assert.equal(summary.counts.explicitPowerGap.samples.length, 1);
});

check('missing or invalid timestamps do not reorder events and remain visible in samples', () => {
  const events = [
    move('untimed', 'a', 'b', 'team_rotate'),
    move('untimed', 'b', 'a', 'team_rotate', { at: { sec: 'not-a-number' }, sec: -1 }),
  ];
  const summary = summarizeMovementReversalTrace([], events);
  assert.equal(summary.counts.teamRotate.total, 1);
  assert.equal(summary.counts.teamRotate.samples[0].previous.seq, 0);
  assert.equal(summary.counts.teamRotate.samples[0].previous.at, null);
  assert.deepEqual(summary.counts.teamRotate.samples[0].current.at, { sec: 'not-a-number' });
});

check('one-sided valid timestamps leave team-decision pairing unconfirmed', () => {
  const events = [
    move('one-sided', 'a', 'b', 'team_rotate', { at: { sec: 30 } }),
    move('one-sided', 'b', 'a', 'team_rotate', { at: { sec: 40 } }),
    { kind: 'team_decision', who: 'one-sided', from: 'b', to: 'a', moved: true, reason: 'team_rotate', at: { sec: 'invalid' } },
  ];
  const summary = summarizeMovementReversalTrace([], events);
  const sample = summary.counts.teamRotate.samples[0];
  assert.equal(summary.counts.teamRotate.total, 1);
  assert.equal(sample.current.teamDecision, null);
  assert.equal(sample.current.teamDecisionPairStatus, 'unmatched_or_insufficient_evidence');
});

check('missing team and objective metadata stays unknown instead of being inferred', () => {
  const summary = summarizeMovementReversalTrace([], [move('bare', 'a', 'b'), move('bare', 'b', 'a')]);
  const sample = summary.counts.teamRotate.samples[0];
  assert.equal(sample.teamId, '');
  assert.equal(sample.previous.sourceReason, '');
  assert.equal(sample.current.targetZoneId, '');
  assert.equal(sample.observations.targetChanged, null);
  assert.equal(sample.observations.sourceChanged, null);
  assert.equal(sample.observations.sourceReasonChanged, null);
  assert.equal(sample.previous.teamDecision, null);
});

check('team decisions pair only to the following same-actor edge and do not cross a later move', () => {
  const events = [
    { kind: 'team_decision', who: 'actor', from: 'a', to: 'b', moved: true, reason: 'stale', at: { sec: 1 } },
    move('actor', 'a', 'b', 'team_rotate', { at: { sec: 10 }, sharedGoalReason: 'first' }),
    move('other', 'a', 'b', 'team_rotate', { at: { sec: 10 } }),
    { kind: 'team_decision', who: 'other', from: 'a', to: 'b', moved: true, reason: 'other actor', at: { sec: 10 } },
    { kind: 'team_decision', who: 'actor', from: 'a', to: 'c', moved: true, reason: 'wrong edge', at: { sec: 10 } },
    { kind: 'team_decision', who: 'actor', from: 'a', to: 'b', moved: true, reason: 'correct edge', at: { sec: 10 } },
    move('actor', 'b', 'a', 'team_rotate', { at: { sec: 20 }, sharedGoalReason: 'second' }),
    { kind: 'team_decision', who: 'actor', from: 'b', to: 'a', moved: true, reason: 'wrong time', at: { sec: 21 } },
  ];
  const summary = summarizeMovementReversalTrace([], events, { maxTeamDecisionDistance: 8 });
  const sample = summary.counts.teamRotate.samples.find((row) => row.actorId === 'actor');
  assert.ok(sample);
  assert.equal(sample.previous.teamDecision.reason, 'correct edge', 'the following edge match beats a stale preceding match');
  assert.equal(sample.current.teamDecision, null, 'a decision at a different valid second cannot be borrowed');
  assert.equal(summary.counts.teamRotate.total, 1);
});

check('infinite limits remain bounded and dangerous actor/team keys count as own properties', () => {
  const events = [];
  events.push(move('__proto__', 'a', 'b', 'team_rotate', { teamId: 'constructor' }));
  for (let index = 0; index < 30; index += 1) events.push({ kind: 'growth_plan', who: '__proto__', teamId: 'constructor', targetId: String(index) });
  events.push({ kind: 'spawn_state' });
  events.push(move('__proto__', 'b', 'a', 'team_rotate', { teamId: 'constructor' }));
  const summary = summarizeMovementReversalTrace([{ _id: '__proto__', teamId: 'constructor' }], events, {
    maxContextEvents: Infinity, maxRotationSamples: Infinity,
  });
  const bucket = summary.counts.teamRotate;
  assert.equal(bucket.total, 1);
  assert.equal(bucket.samples.length, 1);
  assert.equal(bucket.samples[0].context.length, 24, 'Infinity falls back to the finite default context cap');
  assert.equal(bucket.samples[0].contextMeta.truncated, true);
  assert.equal(bucket.samples[0].contextMeta.omittedCount, 7);
  assert.equal(Object.hasOwn(bucket.byActor, '__proto__'), true);
  assert.equal(bucket.byActor['__proto__'], 1);
  assert.equal(Object.hasOwn(bucket.byTeam, 'constructor'), true);
  assert.equal(bucket.byTeam.constructor, 1);
});

check('same-actor cooldown decisions survive unrelated other-team events before context budgeting', () => {
  const events = [move('actor', 'a', 'b', 'team_rotate', { teamId: 'team-a', at: { sec: 10 } })];
  for (let index = 0; index < 30; index += 1) {
    events.push({ kind: 'gain', who: `unrelated-${index}`, teamId: 'team-b', at: { sec: 11 + index }, itemId: 'junk' });
  }
  events.push({ kind: 'team_decision', who: 'actor', teamId: 'team-a', from: 'b', to: 'b', moved: false,
    reason: 'retreat_cooldown', retreatOutcome: 'cooldown_hold', at: { sec: 45 }, allyCount: 2, enemyCount: 0 });
  events.push(move('actor', 'b', 'a', 'team_rotate', { teamId: 'team-a', at: { sec: 50 } }));
  const summary = summarizeMovementReversalTrace([
    { _id: 'actor', teamId: 'team-a' }, { _id: 'unrelated-0', teamId: 'team-b' },
  ], events, { maxContextEvents: 1 });
  const sample = summary.counts.teamRotate.samples[0];
  assert.equal(sample.context.length, 1);
  assert.equal(sample.context[0].kind, 'team_decision');
  assert.equal(sample.context[0].reason, 'retreat_cooldown');
  assert.equal(sample.context[0].retreatOutcome, 'cooldown_hold');
  assert.equal(sample.context[0].allyCount, 2, 'flat assessment values are retained as observed');
  assert.equal(sample.contextMeta.excludedUnrelatedCount, 30);
  assert.equal(sample.contextMeta.truncated, false);
});

check('other-team objective and matching field depletion are labeled shared source without inferred depletion', () => {
  const events = [
    move('actor', 'a', 'b', 'team_rotate', { teamId: 'team-a', at: { sec: 10 }, targetZoneId: 'core-zone',
      movementObjective: { type: 'natural_core', subkind: 'meteor', targetZoneId: 'core-zone', sourceIds: ['CORE_2_1'],
        resourceKinds: ['meteor'], beneficiary: { who: 'actor', materialId: 'meteor-item' } } }),
    { kind: 'objective', who: 'rival', teamId: 'team-b', objective: 'natural_core', zoneId: 'core-zone',
      subkind: 'meteor', itemId: 'meteor-item', qty: 1, success: true, at: { sec: 12 } },
    { kind: 'field_resource', who: 'rival', teamId: 'team-b', zoneId: 'core-zone', itemId: 'meteor-item',
      remaining: 0, depleted: true, at: { sec: 13 } },
    move('actor', 'b', 'a', 'team_rotate', { teamId: 'team-a', at: { sec: 20 }, targetZoneId: 'core-zone',
      movementObjective: { type: 'natural_core', subkind: 'meteor', targetZoneId: 'core-zone', sourceIds: ['CORE_2_1'],
        resourceKinds: ['meteor'], beneficiary: { who: 'actor', materialId: 'meteor-item' } } }),
  ];
  const summary = summarizeMovementReversalTrace([
    { _id: 'actor', teamId: 'team-a' }, { _id: 'rival', teamId: 'team-b' },
  ], events);
  const sample = summary.counts.teamRotate.samples[0];
  assert.deepEqual(sample.context.map((row) => row.scope), ['shared_source_event', 'shared_source_event']);
  assert.equal(sample.context[0].objective, 'natural_core');
  assert.equal(sample.context[0].subkind, 'meteor');
  assert.equal(sample.context[0].success, true);
  assert.equal(sample.context[0].sharedSourceMatch, 'zone_and_kind_only');
  assert.equal(sample.context[1].sharedSourceMatch, 'zone_and_material');
  assert.equal(sample.context[1].depleted, true, 'only the event’s recorded depletion flag is copied');
});

check('boss objective receipts retain encounter, credits, outcome and success fields', () => {
  const events = [
    move('actor', 'a', 'b', 'team_rotate', { teamId: 'team-a', at: { sec: 10 }, targetZoneId: 'boss-zone',
      movementObjective: { type: 'boss', subkind: 'alpha', targetZoneId: 'boss-zone', sourceIds: ['alpha:2:night'],
        resourceKinds: [], beneficiary: null } }),
    { kind: 'objective', who: 'rival', teamId: 'team-b', objective: 'boss', zoneId: 'boss-zone', subkind: 'alpha',
      encounterId: 'alpha:2:night', success: true, credits: 42, outcome: 'defeated', receipt: { paid: 10 }, at: { sec: 12 } },
    move('actor', 'b', 'a', 'team_rotate', { teamId: 'team-a', at: { sec: 20 }, targetZoneId: 'boss-zone',
      movementObjective: { type: 'boss', subkind: 'alpha', targetZoneId: 'boss-zone', sourceIds: ['alpha:2:night'],
        resourceKinds: [], beneficiary: null } }),
  ];
  const sample = summarizeMovementReversalTrace([], events).counts.teamRotate.samples[0];
  assert.equal(sample.context[0].sharedSourceMatch, 'zone_and_kind_only', 'a hunt receipt ID is not a spawned source ID');
  assert.equal(sample.context[0].encounterId, 'alpha:2:night');
  assert.equal(sample.context[0].credits, 42);
  assert.equal(sample.context[0].outcome, 'defeated');
  assert.deepEqual(sample.context[0].receipt, { paid: 10 });
});

check('unchanged source and changed recipe beneficiary are distinct observations', () => {
  const objective = { type: 'natural_core', subkind: 'meteor', targetZoneId: 'core', sourceIds: ['same-core'],
    resourceKinds: ['meteor'], beneficiary: { who: 'actor', targetItemId: 'old-recipe', materialId: 'meteor' } };
  const events = [move('actor', 'a', 'b', 'team_rotate', { movementObjective: objective }),
    move('actor', 'b', 'a', 'team_rotate', { movementObjective: { ...objective,
      beneficiary: { who: 'actor', targetItemId: 'new-recipe', materialId: 'meteor' } } })];
  const sample = summarizeMovementReversalTrace([], events).counts.teamRotate.samples[0];
  assert.equal(sample.observations.sourceChanged, false);
  assert.equal(sample.observations.beneficiaryChanged, true);
  assert.equal(sample.observations.objectiveChanged, true);
});

check('matching unknown-time edges do not become exact team decision evidence', () => {
  const events = [move('actor', 'a', 'b'),
    { kind: 'team_decision', who: 'actor', from: 'a', to: 'b', moved: true, allyCount: 3 },
    move('actor', 'b', 'a'),
    { kind: 'team_decision', who: 'actor', from: 'b', to: 'a', moved: true, allyCount: 3 }];
  const sample = summarizeMovementReversalTrace([], events).counts.teamRotate.samples[0];
  assert.equal(sample.previous.teamDecision, null);
  assert.equal(sample.current.teamDecision, null);
  assert.equal(sample.previous.teamDecisionPairStatus, 'unmatched_or_insufficient_evidence');
});

check('explicit source IDs can match while typed goals without IDs remain source-unknown', () => {
  const objective = { type: 'boss', subkind: 'alpha', targetZoneId: 'boss', sourceIds: ['spawn-source'] };
  const events = [move('actor', 'a', 'b', 'team_rotate', { teamId: 'one', movementObjective: objective }),
    { kind: 'objective', who: 'rival', teamId: 'two', objective: 'boss', sourceId: 'spawn-source',
      encounterId: 'different-receipt', subkind: 'alpha', success: true },
    move('actor', 'b', 'a', 'team_rotate', { teamId: 'one', movementObjective: objective })];
  const sample = summarizeMovementReversalTrace([], events).counts.teamRotate.samples[0];
  assert.equal(sample.context[0].sharedSourceMatch, 'source_id');
  const typed = summarizeMovementReversalTrace([], [
    move('actor', 'a', 'b', 'team_rotate', { objectiveType: 'boss', objectiveSubkind: 'alpha' }),
    move('actor', 'b', 'a', 'team_rotate', { objectiveType: 'boss', objectiveSubkind: 'omega' })]).counts.teamRotate.samples[0];
  assert.equal(typed.observations.sourceChanged, null);
  assert.equal(typed.observations.objectiveChanged, true);
});

console.log(JSON.stringify({ checks, pass: true, scope: 'pure event-only reversal tracing; no simulation execution' }));
