import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';

const { createRandomIsolationInput, runRandomIsolationMatch } = await import('./lib/run-random-isolation-match.mjs');
const { createFormationSwapInput } = await import('./lib/strategy-comparison-contracts.mjs');
const { createSimulationRunInput } = await import('../src/app/simulation/_lib/simulationReplayRuntime.js');

const args = process.argv.slice(2);
assert.equal(args.length, 1, 'Use exactly --output=<new path>.');
assert.match(args[0], /^--output=.+$/, 'Use exactly --output=<new path>.');
const outputPath = args[0].slice('--output='.length).trim();
assert.ok(outputPath, 'The output path must be nonempty.');

const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const idOf = actor => String(actor?._id || actor?.id || '');
const nameOf = actor => String(actor?.name || actor?.nickname || actor?.charName || '').trim();
const stopAfterPhase = { day: 2, phase: 'morning' };
const sampleLimitPerActor = 256;
const eventLimitPerActor = 256;
const linkedEventsPerTransition = 32;
const watchedNames = ['백로', '윤슬'];
const boundedRelationIds = 32;
const relevantCandidateBranches = new Set(['forced_control', 'pending_cast', 'observed_out_of_range', 'basic_in_range']);
const engagedMotionReasons = new Set(['approach', 'last_seen', 'forced_control']);
const eventFields = ['kind', 'who', 'targetId', 'actorId', 'victimId', 'killerId', 'ownerId', 'chaserId', 'zoneId',
  'from', 'to', 'reason', 'actionType', 'source', 'mode', 'outcome', 'result', 'damage', 'hpDamage', 'hpBefore', 'hpAfter',
  'encounterId', 'atSec', 'escapeBonus', 'escaped', 'caught', 'fatal', 'preDamage'];

const boundedIds = rows => Array.isArray(rows)
  ? rows.slice(0, boundedRelationIds).map(value => String(value || '')).filter(Boolean) : [];

function compactActor(actor, nowSec) {
  if (!actor) return null;
  return {
    actorId: actor.actorId, teamId: actor.teamId, zoneId: actor.zoneId, combatSpaceId: actor.combatSpaceId,
    hp: actor.hp, maxHp: actor.maxHp, deadInThisPhase: actor.deadInThisPhase,
    actionReadyAtSec: actor.actionReadyAtSec, basicAttackReadyAtSec: actor.basicAttackReadyAtSec,
    recoveryUntilSec: actor.recoveryUntilSec, recoveryReason: actor.recoveryReason,
    recoveryLockedAtPass: Number(actor.recoveryUntilSec || 0) > Number(nowSec || 0),
    hasCombatIntent: actor.hasCombatIntent, intentEnemyTeamId: actor.intentEnemyTeamId, intentTargetId: actor.intentTargetId,
    pendingCast: actor.pendingCast, spatial: actor.spatial, spatialMotion: actor.spatialMotion,
    spatialLastSeen: actor.spatialLastSeen, attackRange: actor.attackRange, moveSpeed: actor.moveSpeed,
    moveAllowed: actor.moveAllowed, basicAllowed: actor.basicAllowed, actionBlocked: actor.actionBlocked,
  };
}

function compactTargetProjection(actor, actorsById) {
  const targetId = String(actor?.intentTargetId || '');
  const target = targetId ? actorsById.get(targetId) : null;
  return target ? { actorId: target.actorId, teamId: target.teamId, zoneId: target.zoneId,
    combatSpaceId: target.combatSpaceId, hp: target.hp, maxHp: target.maxHp,
    spatial: target.spatial ? { x: target.spatial.x, y: target.spatial.y } : null } : null;
}

function compactCandidate(fact) {
  if (!fact) return null;
  return {
    branch: fact.branch,
    actorBestConsideredCandidate: fact.candidate ? { ...fact.candidate } : null,
    opponentCount: fact.opponentCount,
    nearestTargetId: fact.nearestTargetId,
    nearestDistance: fact.nearestDistance,
    attackRange: fact.attackRange,
    motionReason: fact.motionReason,
  };
}

function engaged(actor, fact) {
  return Boolean(actor?.hasCombatIntent)
    || engagedMotionReasons.has(String(actor?.spatialMotion?.reason || ''))
    || relevantCandidateBranches.has(String(fact?.branch || ''));
}

function eventInvolves(event, ids) {
  if (['who', 'targetId', 'actorId', 'victimId', 'killerId', 'ownerId', 'chaserId']
    .some(field => ids.has(String(event?.[field] || '')))) return true;
  if (Array.isArray(event?.participants) && event.participants.some(value => ids.has(String(value || '')))) return true;
  if (Array.isArray(event?.helpers) && event.helpers.some(value => ids.has(String(value || '')))) return true;
  return Array.isArray(event?.teams) && event.teams.some(team => Array.isArray(team)
    && team.some(value => ids.has(String(value || ''))));
}

function compactEvent(event, eventIndex) {
  const output = { eventIndex };
  for (const field of eventFields) {
    if (!Object.hasOwn(event, field)) continue;
    const value = event[field];
    if (value == null || ['string', 'number', 'boolean'].includes(typeof value)) output[field] = value;
  }
  if (event.at && Number.isFinite(event.at.sec)) output.at = { sec: event.at.sec };
  if (Array.isArray(event.participants)) output.participants = boundedIds(event.participants);
  if (Array.isArray(event.helpers)) output.helpers = boundedIds(event.helpers);
  if (Array.isArray(event.teams)) output.teams = event.teams.slice(0, 8).map(boundedIds);
  return output;
}

function transitionSignature(actor, candidate, nowSec) {
  const next = candidate?.actorBestConsideredCandidate;
  return JSON.stringify({
    intent: [Boolean(actor?.hasCombatIntent), String(actor?.intentEnemyTeamId || ''), String(actor?.intentTargetId || '')],
    branch: String(candidate?.branch || ''),
    recovery: [Number(actor?.recoveryUntilSec || 0), String(actor?.recoveryReason || ''),
      Number(actor?.recoveryUntilSec || 0) > Number(nowSec || 0)],
    candidate: [String(next?.actionType || ''), String(next?.targetId || '')],
    motion: [String(actor?.spatialMotion?.reason || ''), String(actor?.spatialMotion?.targetId || '')],
    lastSeenTargetId: String(actor?.spatialLastSeen?.targetId || ''),
  });
}

function runSummary(run) {
  return {
    partialPrefixOnly: true,
    stopAfterPhase,
    ending: run.evidence.ending || null,
    matchEndEvents: run.events.filter(event => event.kind === 'match_end').length,
    phases: run.evidence.phases,
    eventCount: run.evidence.eventCount,
    eventDigest: run.evidence.eventDigest,
    frameCount: run.evidence.frames,
    frameDigest: run.evidence.frameDigest,
    fullFrameArrayStreamSha256: run.frameCapture.wholeArrayStreamSha256,
    fullFrameJsonSha256ByOrdinal: run.frameCapture.frames,
    finalFrameDigest: digest(run.finalFrame),
    logCount: run.logs.length,
    logDigest: digest(run.logs),
    random: run.evidence.random,
    finalClock: { day: run.finalFrame.day, phase: run.finalFrame.phase, matchSec: run.finalFrame.matchSec },
  };
}

const fixture = JSON.parse(await createRandomIsolationInput('2202'));
const originalInput = createSimulationRunInput({ activeMap: fixture.map, settings: fixture.settings,
  publicItems: fixture.items, survivors: fixture.survivors, runSeed: fixture.runSeed }, { getItem: () => null });
const formation = createFormationSwapInput(originalInput);
const savedInput = formation.input;
const inputDigest = digest(savedInput);
const changedActorIds = new Set(formation.changes.map(change => change.actorId));
const watched = watchedNames.map(watchedName => {
  const actor = savedInput.initialFrame.survivors.find(row => nameOf(row) === watchedName);
  assert.ok(actor, `Fresh seed 2202 input must contain watched actor ${watchedName}.`);
  assert.ok(changedActorIds.has(idOf(actor)), `${watchedName} must be one of the actual formation-swapped actors.`);
  return { actorId: idOf(actor), name: watchedName };
});
assert.deepEqual([...changedActorIds].sort(), watched.map(row => row.actorId).sort(),
  'The formation condition must change exactly the two watched actors.');

async function execute(observe) {
  const frameCapture = { count: 0, frames: [], wholeArrayHash: createHash('sha256'), wholeArrayStreamSha256: null };
  frameCapture.wholeArrayHash.update('[');
  const transitionsByActor = new Map(watched.map(({ actorId }) => [actorId, []]));
  const previousByActor = new Map();
  const passCounts = Object.fromEntries(watched.map(({ actorId }) => [actorId,
    { seen: 0, engaged: 0, transitions: 0, retainedTransitions: 0, evictedTransitions: 0 }]));
  const runInputDigest = digest(savedInput);
  const run = await runRandomIsolationMatch(null, {
    savedInput: structuredClone(savedInput), stopAfterPhase,
    onFrame(frame) {
      const serialized = JSON.stringify(frame);
      assert.notEqual(serialized, undefined, 'Every actual frame must be JSON-serializable.');
      const frameIndex = frameCapture.count;
      if (frameIndex) frameCapture.wholeArrayHash.update(',');
      frameCapture.wholeArrayHash.update(serialized);
      frameCapture.frames.push({ frameIndex, utf8ByteLength: Buffer.byteLength(serialized, 'utf8'),
        sha256: createHash('sha256').update(serialized).digest('hex') });
      frameCapture.count += 1;
    },
    ...(observe ? { onCombatDiagnostic(snapshot, { eventCursor: eventBoundaryExclusive }) {
      if (snapshot.stage !== 'actor_schedule') return;
      const actorsById = new Map(snapshot.actors.map(actor => [actor.actorId, actor]));
      const candidatesById = new Map(snapshot.actorCandidates.map(fact => [fact.actorId, fact]));
      for (const { actorId } of watched) {
        const actor = compactActor(actorsById.get(actorId), snapshot.nowSec);
        const candidate = compactCandidate(candidatesById.get(actorId));
        const intentTarget = compactTargetProjection(actor, actorsById);
        const isEngaged = engaged(actor, candidate);
        const counts = passCounts[actorId];
        counts.seen += 1;
        counts.engaged += Number(isEngaged);
        const previous = previousByActor.get(actorId) || null;
        const signature = transitionSignature(actor, candidate, snapshot.nowSec);
        const changed = !previous || signature !== previous.signature;
        if (changed && (isEngaged || previous?.engaged)) {
          const samples = transitionsByActor.get(actorId);
          samples.push({ eventBoundaryExclusive, nowSec: snapshot.nowSec,
            endpoint: 'after_this_actor_candidate_pass', transition: previous ? 'identity_change' : 'first_engaged_observation',
            engagedNow: isEngaged, engagedAtPreviousPass: Boolean(previous?.engaged),
            eventJoinWindow: { fromInclusive: previous?.eventBoundaryExclusive ?? 0, toExclusive: eventBoundaryExclusive },
            previous: previous ? { eventBoundaryExclusive: previous.eventBoundaryExclusive, nowSec: previous.nowSec,
              state: previous.state, intentTarget: previous.intentTarget, candidate: previous.candidate } : null,
            state: actor, intentTarget, candidate });
          counts.transitions += 1;
          if (samples.length > sampleLimitPerActor) { samples.shift(); counts.evictedTransitions += 1; }
          counts.retainedTransitions = samples.length;
        }
        previousByActor.set(actorId, { eventBoundaryExclusive, nowSec: snapshot.nowSec,
          engaged: isEngaged, signature, state: actor, intentTarget, candidate });
      }
    } } : {}),
  });
  assert.equal(digest(savedInput), runInputDigest, 'The runner/observer must not mutate the saved replay input.');
  assert.equal(run.events.filter(event => event.kind === 'match_end').length, 0,
    'This diagnostic must stop at the requested phase, not claim a completed match.');
  frameCapture.wholeArrayHash.update(']');
  frameCapture.wholeArrayStreamSha256 = frameCapture.wholeArrayHash.digest('hex');
  assert.equal(frameCapture.count, run.evidence.frames, 'Hash every actual prefix frame in callback order.');
  return { ...run, frameCapture, transitionsByActor, passCounts };
}

const beforeInput = structuredClone(savedInput);
const plain = await execute(false);
assert.deepEqual(savedInput, beforeInput);
const observed = await execute(true);
assert.deepEqual(savedInput, beforeInput);
assert.deepEqual(observed.evidence, plain.evidence, 'Observer on/off must preserve prefix counts, digests and RNG.');
assert.deepEqual(observed.events, plain.events, 'Observer on/off must preserve every prefix event.');
assert.equal(observed.frameCapture.count, plain.frameCapture.count, 'Observer on/off must preserve frame count.');
assert.deepEqual(observed.frameCapture.frames, plain.frameCapture.frames,
  'Observer on/off must preserve every full-frame JSON byte length and SHA-256 in callback order.');
assert.equal(observed.frameCapture.wholeArrayStreamSha256, plain.frameCapture.wholeArrayStreamSha256,
  'Observer on/off must preserve the ordered full-frame JSON array stream digest.');
assert.deepEqual(observed.finalFrame, plain.finalFrame, 'Observer on/off must preserve the complete final prefix frame.');
assert.deepEqual(observed.logs, plain.logs, 'Observer on/off must preserve the complete prefix logs.');

const watchedEventsByActor = Object.fromEntries(watched.map(({ actorId, name }) => [name,
  { events: [], omitted: 0, capPerActor: eventLimitPerActor }]));
for (let eventIndex = 0; eventIndex < observed.events.length; eventIndex += 1) {
  const event = observed.events[eventIndex];
  for (const { actorId, name } of watched) {
    if (!eventInvolves(event, new Set([actorId]))) continue;
    const entry = watchedEventsByActor[name];
    if (entry.events.length < eventLimitPerActor) entry.events.push(compactEvent(event, eventIndex));
    else { entry.events.shift(); entry.events.push(compactEvent(event, eventIndex)); entry.omitted += 1; }
  }
}
for (const { actorId, name } of watched) {
  const actorIds = new Set([actorId]);
  for (const transition of observed.transitionsByActor.get(actorId)) {
    const from = Math.max(0, transition.eventJoinWindow.fromInclusive);
    const to = Math.min(observed.events.length, transition.eventJoinWindow.toExclusive);
    const linked = [];
    let relatedEventCount = 0;
    for (let eventIndex = from; eventIndex < to; eventIndex += 1) {
      const event = observed.events[eventIndex];
      if (!eventInvolves(event, actorIds)) continue;
      relatedEventCount += 1;
      if (linked.length < linkedEventsPerTransition) linked.push(compactEvent(event, eventIndex));
    }
    transition.relatedEvents = linked;
    transition.relatedEventCount = relatedEventCount;
    transition.relatedEventsOmitted = Math.max(0, relatedEventCount - linked.length);
  }
}
const output = {
  schema: 'eternal-hunger.combat-contact-prefix.v1',
  engineVersion: savedInput.engineVersion,
  seed: savedInput.runSeed,
  inputDigest,
  formation: { changes: formation.changes, derivedChanges: formation.derivedChanges },
  watched,
  stopAfterPhase,
  scope: 'Fresh saved-input day-2 morning prefix only. Candidate-pass endpoint transitions for engaged watched actors; not a full match, not a paired world-step trace, and not evidence that a candidate executed or caused survival/winner outcomes. Frames are not retained or raw-object deep-compared: every complete frame JSON is streamed in callback order into a per-frame UTF-8 byte-length/SHA-256 vector and an ordered JSON-array-stream SHA-256.',
  observationNeutrality: {
    exact: true,
    compared: ['all events', 'every full-frame JSON byte length and SHA-256 by callback ordinal',
      'ordered full-frame JSON-array stream SHA-256', 'event/frame counts and canonical digests', 'complete final prefix frame',
      'complete prefix logs', 'RNG state', 'saved input unchanged'],
    plain: runSummary(plain),
    observed: runSummary(observed),
  },
  candidatePassDiagnostics: {
    semantics: 'Each actor_best_considered_candidate is that actor’s highest-priority candidate among those considered in one existing production pass, not the global selected candidate and not a completed action. State is sampled after the planner’s existing candidate pass; this is not a world-step before/after interval. Transition signatures cover intent, branch, recovery, candidate action/target, motion reason/target and last-seen target identity; coordinates and timestamps are not signatures. The bounded ring keeps the newest transitions, including the latest one.',
    sampleLimitPerActor,
    passCounts: observed.passCounts,
    transitions: Object.fromEntries(watched.map(({ actorId, name }) => [name, observed.transitionsByActor.get(actorId)])),
  },
  watchedEvents: {
    eventBoundarySemantics: 'snapshot eventBoundaryExclusive is the insertion boundary: the number of events already present when the snapshot callback runs. Each event has a separate zero-based eventIndex into the returned event array.',
    joinRule: 'For each transition, relatedEvents is matched from the exact returned prefix event array using eventIndex in [fromInclusive,toExclusive), corresponding to the immediately previous candidate-pass boundary and this pass boundary. These are insertion-index bounds, not timestamps.',
    omittedSemantics: 'Each watched actor retains the newest 256 related events; omitted counts older matching events evicted from that actor’s bounded ring.',
    linkedEventsPerTransition,
    perActor: watchedEventsByActor,
  },
};

writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`, { flag: 'wx' });
console.log(`COMBAT_CONTACT_PREFIX ${JSON.stringify({ outputPath, inputDigest, actors: watched,
  partialPrefixOnly: true, stopAfterPhase, observerExact: true,
  eventCount: observed.evidence.eventCount, frameCount: observed.evidence.frames,
  fullFrameArrayStreamSha256: observed.frameCapture.wholeArrayStreamSha256,
  samples: observed.passCounts })}`);
