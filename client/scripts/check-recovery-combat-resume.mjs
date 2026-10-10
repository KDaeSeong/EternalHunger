import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';
import { actor, runCombatScenario, skill } from './lib/run-combat-scenario.mjs';

const { resolvePvpAvoidanceMove } = await import('../src/app/simulation/_lib/phasePvpAvoidanceRuntime.js');
const { canSeeActor } = await import('../src/app/simulation/_lib/combatSpatialRuntime.js');
const { engageCombatParticipants, findNextCombatAction } = await import('../src/app/simulation/_lib/combatTimingRuntime.js');
const { createSeedRng } = await import('../src/app/simulation/_lib/randomSeedRuntime.js');
const { withSimulationRandom } = await import('../src/utils/simulationRandom.js');

// This is a controlled runtime regression, not natural-match or formation evidence.
// A real seeded PvP loop grants the initial intent; the real no-safe-path handler
// applies one longer-than-memory recovery hold at the first elapsed boundary.
const START_SEC = 100;
const DURATION_SEC = 9;
const HOLD_SEC = 5;
const ACTOR_ID = 'recovery-resume-actor';
const TARGET_ID = 'recovery-resume-fixed-target';
const INCOMING_ID = 'recovery-resume-incoming-enemy';
const ZONE_ID = 'recovery-resume-zone';
const SEED = 'recovery-combat-resume-20261010';
const CAST_SKILL = 'recovery-overlap-paid-cast';

function makeRows(control) {
  const recovering = actor(ACTOR_ID, {
    teamId: 'recovery-resume-team', zoneId: ZONE_ID,
    _spatial: { zoneId: ZONE_ID, x: 4, y: 4 },
    hp: 10000, maxHp: 10000,
    _actionReadyAtSec: START_SEC + 0.5,
    _basicAttackReadyAtSec: START_SEC + 0.75,
    stats: { maxHp: 10000, attackPower: 10000, defense: 0, attackSpeed: 4, attackRange: 1,
      sightRange: control === 'stale_sight' ? 8 : 20, moveSpeed: 4 },
    ...(control === 'cast_overlap' ? {
      characterSkills: { q: skill({ name: CAST_SKILL, slot: 'q', type: 'attack_skill', flatDamage: [500],
        range: 8, castDelaySec: 2, recoveryDelaySec: 0.25, cooldownSec: 30, resourceCost: 2 }) },
      uniqueResource: { enabled: true, name: '집중력', maxValue: 5, startValue: 5, regenPerSec: 0 },
      uniqueResourceValue: 5,
    } : {}),
  });
  const fixedTarget = actor(TARGET_ID, {
    teamId: 'recovery-resume-enemy-team', zoneId: ZONE_ID,
    _spatial: { zoneId: ZONE_ID, x: 9, y: 4 },
    hp: 1000000000, maxHp: 1000000000,
    // Its long ordinary action lock also prevents movement, while it remains a
    // living, visible, targetable recipient of the recovering actor's attacks.
    _actionReadyAtSec: START_SEC + 1000,
    _basicAttackReadyAtSec: START_SEC + 1000,
    stats: { maxHp: 1000000000, attackPower: 1, defense: 0, attackSpeed: 1, attackRange: 1, sightRange: 20, moveSpeed: 4 },
  });
  if (control !== 'incoming_vulnerability') return [recovering, fixedTarget];

  const incoming = actor(INCOMING_ID, {
    teamId: 'recovery-resume-enemy-team', zoneId: ZONE_ID,
    _spatial: { zoneId: ZONE_ID, x: 4, y: 6 },
    hp: 100000, maxHp: 100000,
    stats: { maxHp: 100000, attackPower: 250, defense: 0, attackSpeed: 4, attackRange: 1, sightRange: 20, moveSpeed: 4 },
  });
  return [recovering, fixedTarget, incoming];
}

function stripFunctions(value, ancestors = new WeakSet()) {
  if (typeof value === 'function' || typeof value === 'symbol' || value === undefined) return undefined;
  if (value === null || typeof value !== 'object') return value;
  assert.equal(ancestors.has(value), false, 'scenario evidence must be acyclic');
  ancestors.add(value);
  let result;
  if (Array.isArray(value)) result = value.map((entry) => stripFunctions(entry, ancestors));
  else {
    result = {};
    for (const key of Object.keys(value).sort()) {
      const child = stripFunctions(value[key], ancestors);
      if (child !== undefined) result[key] = child;
    }
  }
  ancestors.delete(value);
  return result;
}

function ownBasicAttempts(result) {
  return result.events.filter((event) => event.kind === 'damage' && event.type === 'basic'
    && String(event.who || '') === ACTOR_ID);
}

function ownTeamStrikes(result) {
  return result.events.filter((event) => event.kind === 'team_strike'
    && String(event.who || '') === ACTOR_ID);
}

function makeEvidence(result, trace) {
  return stripFunctions({
    events: result.events,
    frames: result.frames,
    survivorEntries: [...result.survivorMap.entries()].sort(([a], [b]) => String(a).localeCompare(String(b))),
    randomState: result.randomState,
    newDeadIds: result.newDeadIds,
    roundKills: result.roundKills,
    roundAssists: result.roundAssists,
    holdTrace: trace,
  });
}

async function runCase(control, seed = SEED) {
  const inputRows = makeRows(control);
  const inputState = stripFunctions(structuredClone(inputRows));
  let holdApplied = false;
  let transitionApplied = false;
  let holdStartSec = null;
  let holdUntilSec = null;
  let intentAtHold = null;
  let positionAtHold = null;
  let lastSeenAtHold = null;
  let actionReadyAtHold = null;
  let basicReadyAtHold = null;
  let holdResult = null;
  let transitionEvidence = null;
  let postLockIntent = null;
  let postLockLastSeen = null;
  let postLockObserved = false;
  let pendingCastAtHold = null;
  const holdEvents = [];
  const lockedSamples = [];

  const result = await runCombatScenario(inputRows, {
    startSec: START_SEC,
    // The actual hold starts after the first elapsed boundary. Leave time for
    // the unlock planner pass, rather than ending the phase exactly at unlock.
    duration: control === 'stale_sight' ? HOLD_SEC + 1 : DURATION_SEC,
    seed,
    settings: control === 'cast_overlap' ? { skills: { characterSkills: true } } : {},
    onElapsed(liveMap, elapsedSec) {
      const nowSec = START_SEC + elapsedSec;
      const current = liveMap.get(ACTOR_ID);
      const target = liveMap.get(TARGET_ID);
      if (!current || !target) return;
      const holdEligible = control === 'cast_overlap' ? Boolean(current._pendingCharacterCast) : elapsedSec > 0;
      if (!holdApplied && elapsedSec > 0 && holdEligible) {
        holdApplied = true;
        holdStartSec = nowSec;
        intentAtHold = current._combatIntent ? structuredClone(current._combatIntent) : null;
        pendingCastAtHold = current._pendingCharacterCast ? structuredClone(current._pendingCharacterCast) : null;
        holdResult = resolvePvpAvoidanceMove({
          state: {
            actor: current,
            opponent: target,
            currentActionSec: () => nowSec,
            recoverSec: HOLD_SEC,
            survivorMap: liveMap,
            // Deliberately absent current-zone graph: the production safe-zone
            // picker must return no route and take its actual no-safe-path branch.
            zoneGraph: {},
            ruleset: { ai: { safeSearchDepth: 3 } },
          },
          actions: {
            atNow: () => ({ sec: nowSec, day: 1, phase: 'morning' }),
            emitRunEvent: (kind, payload, at) => holdEvents.push(structuredClone({ kind, payload, at })),
          },
          text: { holdRecoverSec: HOLD_SEC },
        });
        holdUntilSec = Number(current._recentCombatUntil || 0);
        positionAtHold = structuredClone(current._spatial);
        lastSeenAtHold = current._spatialLastSeen ? structuredClone(current._spatialLastSeen) : null;
        actionReadyAtHold = Number(current._actionReadyAtSec || 0);
        basicReadyAtHold = Number(current._basicAttackReadyAtSec || 0);
      }
      if (holdApplied && !transitionApplied && nowSec >= holdStartSec + 0.5 && control !== 'resume'
        && control !== 'incoming_vulnerability' && control !== 'cast_overlap') {
        transitionApplied = true;
        if (control === 'stale_sight') {
          // The live target exits the actor's sight while the actor is locked;
          // its last-seen point is allowed to expire normally, not refreshed.
          target._spatial = { zoneId: target.zoneId, x: 24, y: 12 };
          transitionEvidence = { kind: control, targetPosition: structuredClone(target._spatial), targetHp: target.hp,
            actorPosition: structuredClone(current._spatial), targetVisible: canSeeActor(current, target) };
        } else if (control === 'intent_space') {
          // A real authoritative space change invalidates the old engagement;
          // no intent or target is re-injected after this controlled transition.
          current._combatSpaceId = 'recovery-resume-isolated-space';
          current._spatial = { zoneId: current.zoneId, combatSpaceId: current._combatSpaceId, x: 4, y: 4 };
          transitionEvidence = { kind: control, actorPosition: structuredClone(current._spatial), targetPosition: structuredClone(target._spatial) };
        } else if (control === 'target_dead') {
          // Controlled authoritative elimination: subsequent scheduling must
          // reject the dead target rather than manufacture a resumed attack.
          target.hp = 0;
          transitionEvidence = { kind: control, targetHp: target.hp };
        }
      }
      if (holdApplied && nowSec < holdUntilSec) {
        lockedSamples.push({ sec: nowSec, intent: current._combatIntent ? structuredClone(current._combatIntent) : null,
          spatial: structuredClone(current._spatial), spatialLastSeen: current._spatialLastSeen ? structuredClone(current._spatialLastSeen) : null,
          actionReadyAtSec: Number(current._actionReadyAtSec || 0), basicAttackReadyAtSec: Number(current._basicAttackReadyAtSec || 0), hp: current.hp });
      } else if (holdApplied && nowSec > holdUntilSec) {
        postLockObserved = true;
        postLockIntent = current._combatIntent ? structuredClone(current._combatIntent) : null;
        postLockLastSeen = current._spatialLastSeen ? structuredClone(current._spatialLastSeen) : null;
      }
    },
  });

  return { result, trace: { inputState, holdApplied, transitionApplied, transitionEvidence, holdStartSec, holdUntilSec,
    intentAtHold, positionAtHold, lastSeenAtHold, actionReadyAtHold, basicReadyAtHold, postLockIntent, postLockLastSeen, postLockObserved,
    pendingCastAtHold, holdResult, holdEvents, lockedSamples } };
}

async function runTwice(control) {
  const first = await runCase(control, SEED);
  const second = await runCase(control, SEED);
  assert.deepEqual(makeEvidence(first.result, first.trace), makeEvidence(second.result, second.trace),
    `${control}: identical seeded scenario must reproduce events, frames, final actors, and RNG`);
  assert.equal(first.trace.holdApplied, true, `${control}: the actual hold must be applied once`);
  assert.equal(first.trace.transitionApplied, ['stale_sight', 'intent_space', 'target_dead'].includes(control),
    `${control}: the controlled invalidation must happen only in its designated case`);
  assert.equal(first.trace.holdResult?.moved, false, `${control}: avoidance must take no-safe-path, not relocate`);
  assert.equal(first.trace.holdResult?.toZoneId, '', `${control}: no-safe-path must keep the actor in its zone`);
  assert.ok(first.trace.holdUntilSec - first.trace.holdStartSec > 3,
    `${control}: recovery must outlast the three-second spatial memory`);
  assert.equal(first.trace.holdEvents.filter((event) => event.kind === 'retreat'
    && event.payload?.retreatOutcome === 'no_safe_path').length, 1,
  `${control}: one actual no-safe-path receipt must explain the controlled recovery`);
  assert.ok(first.trace.intentAtHold, `${control}: the initial intent must come from ordinary seeded PvP engagement`);
  assert.equal(first.trace.intentAtHold.targetId, TARGET_ID,
    `${control}: the hold must preserve the real initial PvP target, not a test-injected intent`);
  assert.equal(first.trace.intentAtHold.enemyTeamId, 'recovery-resume-enemy-team',
    `${control}: the hold must preserve the real opposing team assignment`);
  assert.equal(Boolean(first.trace.pendingCastAtHold), control === 'cast_overlap',
    `${control}: only the cast-overlap control may apply recovery while an actual cast is pending`);
  first.repeatedRun = second;
  return first;
}

function summarizeRun(name, run) {
  const result = run.result;
  const finalActor = result.survivorMap.get(ACTOR_ID);
  const attempts = ownBasicAttempts(result);
  const strikes = ownTeamStrikes(result);
  const firstPositive = attempts.find((event) => Number(event.hpDamage ?? 0) > 0) || null;
  const castStart = result.events.find((event) => event.kind === 'skill_cast' && event.who === ACTOR_ID) || null;
  const castRelease = result.events.find((event) => event.kind === 'skill' && event.who === ACTOR_ID
    && event.phase === 'release') || null;
  const castDamage = castRelease && result.events.find((event) => event.kind === 'damage'
    && event.who === ACTOR_ID && event.castId === castRelease.castId && Number(event.hpDamage ?? 0) > 0);
  const castPayment = result.events.find((event) => event.kind === 'unique_resource' && event.who === ACTOR_ID
    && event.phase === 'cast_start') || null;
  const recoveryPositiveIncoming = result.events.filter((event) => event.kind === 'damage'
    && String(event.targetId || '') === ACTOR_ID && Number(event.hpDamage ?? 0) > 0
    && Number(event.at?.sec ?? event.at) >= run.trace.holdStartSec
    && Number(event.at?.sec ?? event.at) < run.trace.holdUntilSec).length;
  const sec = (event) => Number(event.at?.sec ?? event.at);
  return {
    name,
    holdStartSec: run.trace.holdStartSec,
    holdUntilSec: run.trace.holdUntilSec,
    finalFrameSec: result.frames.at(-1)?.sec ?? null,
    observedAfterUnlock: run.trace.postLockObserved,
    firstPositiveBasic: firstPositive ? { sec: sec(firstPositive), hpDamage: Number(firstPositive.hpDamage),
      distance: Number(firstPositive.distance), reach: Number(firstPositive.reach), targetId: String(firstPositive.targetId || '') } : null,
    paidCast: castStart ? { castId: castStart.castId, startedAtSec: castStart.startedAtSec,
      releaseAtSec: castStart.releaseAtSec, releaseReceiptAtSec: castRelease?.at?.sec ?? null,
      positiveHpDamageAtSec: castDamage?.at?.sec ?? null, hpDamage: Number(castDamage?.hpDamage || 0),
      resourceDelta: Number(castPayment?.delta || 0), cooldownUntil: Number(finalActor?.skillState?.q?.cooldownUntil || 0) } : null,
    totalOwnBasicAttempts: attempts.length,
    totalOwnTeamStrikes: strikes.length,
    ownBasicAttemptsDuringRecovery: attempts.filter((event) => sec(event) < run.trace.holdUntilSec).length,
    ownTeamStrikesDuringRecovery: strikes.filter((event) => sec(event) < run.trace.holdUntilSec).length,
    positiveIncomingHpHitsDuringRecovery: recoveryPositiveIncoming,
    castStartCount: result.events.filter((event) => event.kind === 'skill_cast' && event.who === ACTOR_ID).length,
    castReleaseCount: result.events.filter((event) => event.kind === 'skill' && event.who === ACTOR_ID
      && event.phase === 'release').length,
    finalIntent: finalActor?._combatIntent || null,
    finalLastSeen: finalActor?._spatialLastSeen || null,
    finalClock: { actionReadyAtSec: Number(finalActor?._actionReadyAtSec || 0),
      basicAttackReadyAtSec: Number(finalActor?._basicAttackReadyAtSec || 0),
      recentCombatUntil: Number(finalActor?._recentCombatUntil || 0),
      skillCooldownUntil: Number(finalActor?.skillState?.q?.cooldownUntil || 0),
      uniqueResourceValue: Number(finalActor?.uniqueResourceValue || 0) },
  };
}

function summarizeNamedCase(name, run) {
  return { name, repetitions: 2, deterministicReplay: true,
    runs: [summarizeRun(name, run), summarizeRun(name, run.repeatedRun)] };
}

function runRecoveryBoundaryCase(name) {
  const nowSec = 200.333333;
  const untilSec = name === 'boundary_normal_half_second' ? nowSec + 0.5 : 200.33333300000007;
  const subject = actor(`recovery-boundary-${name}-subject`, {
    teamId: 'recovery-boundary-subject-team', zoneId: ZONE_ID,
    _spatial: { zoneId: ZONE_ID, x: 4, y: 4 },
    _actionReadyAtSec: nowSec - 1,
    _basicAttackReadyAtSec: nowSec - 1,
    stats: { maxHp: 1000, attackPower: 100, defense: 0, attackSpeed: 1, attackRange: 1,
      sightRange: 20, moveSpeed: 1 },
  });
  const target = actor(`recovery-boundary-${name}-target`, {
    teamId: 'recovery-boundary-target-team', zoneId: ZONE_ID,
    _spatial: { zoneId: ZONE_ID, x: 5, y: 4 },
    _actionReadyAtSec: nowSec + 1000,
    _basicAttackReadyAtSec: nowSec + 1000,
    stats: { maxHp: 1000, attackPower: 1, defense: 0, attackSpeed: 1, attackRange: 1,
      sightRange: 20, moveSpeed: 1 },
  });
  const rows = [subject, target];
  const survivorMap = new Map(rows.map((row) => [row._id, row]));
  const inputState = stripFunctions(structuredClone(rows));
  const random = createSeedRng(`recovery-boundary-${name}-20261010`);
  return withSimulationRandom(random, () => {
    engageCombatParticipants(subject, target, rows, nowSec);
    const initialCandidate = findNextCombatAction(survivorMap, nowSec, [], {}, new Set());
    assert.equal(initialCandidate?.actionType, 'basic', `${name}: the normal initial encounter must establish an in-range candidate`);
    // Keep the stale-target control alive but out of sight; the unlock query
    // marks it unavailable for that query so only a normal last-seen approach
    // can be returned.
    if (name === 'boundary_stale_target') target._spatial = { zoneId: target.zoneId, x: 24, y: 24 };
    subject._recentCombatUntil = untilSec;
    const lockedSnapshot = { intent: structuredClone(subject._combatIntent), lastSeen: structuredClone(subject._spatialLastSeen),
      spatialMotion: subject._spatialMotion ? structuredClone(subject._spatialMotion) : null,
      actionReadyAtSec: Number(subject._actionReadyAtSec || 0), basicAttackReadyAtSec: Number(subject._basicAttackReadyAtSec || 0),
      recoveryUntilSec: Number(subject._recentCombatUntil || 0) };
    const rngBeforeLockedQuery = random.getState();
    const lockedCandidate = findNextCombatAction(survivorMap, nowSec, [], {}, new Set());
    const afterLockedQuery = { intent: structuredClone(subject._combatIntent), lastSeen: structuredClone(subject._spatialLastSeen),
      spatialMotion: subject._spatialMotion ? structuredClone(subject._spatialMotion) : null,
      actionReadyAtSec: Number(subject._actionReadyAtSec || 0), basicAttackReadyAtSec: Number(subject._basicAttackReadyAtSec || 0),
      recoveryUntilSec: Number(subject._recentCombatUntil || 0), randomState: random.getState() };
    const unlockCandidate = findNextCombatAction(survivorMap, lockedCandidate.atSec,
      name === 'boundary_stale_target' ? [target._id] : [], {}, new Set());
    return stripFunctions({ name, inputState, nowSec, untilSec, initialCandidate,
      lockedCandidate: { actorId: lockedCandidate.actorId, actionType: lockedCandidate.actionType, atSec: lockedCandidate.atSec },
      lockedSnapshot, afterLockedQuery,
      rngBeforeLockedQuery,
      unlockCandidate: unlockCandidate ? { actorId: unlockCandidate.actorId, targetId: unlockCandidate.targetId || '',
        actionType: unlockCandidate.actionType, atSec: unlockCandidate.atSec } : null,
      finalIntent: subject._combatIntent || null, finalLastSeen: subject._spatialLastSeen || null,
      finalClock: { actionReadyAtSec: Number(subject._actionReadyAtSec || 0),
        basicAttackReadyAtSec: Number(subject._basicAttackReadyAtSec || 0),
        recentCombatUntil: Number(subject._recentCombatUntil || 0) },
      rngAfterUnlockQuery: random.getState() });
  });
}

function checkRecoveryBoundary(name) {
  const first = runRecoveryBoundaryCase(name);
  const second = runRecoveryBoundaryCase(name);
  assert.deepEqual(first, second, `${name}: fresh identical input and seed must reproduce boundary evidence and RNG`);
  assert.equal(first.lockedCandidate?.actionType, 'status_boundary', `${name}: recovery lock must schedule a boundary`);
  assert.ok(first.lockedCandidate.atSec > first.nowSec, `${name}: boundary must be strictly in the future`);
  assert.ok(first.lockedCandidate.atSec >= first.untilSec, `${name}: boundary may not precede recovery expiry`);
  assert.deepEqual(first.afterLockedQuery.intent, first.lockedSnapshot.intent, `${name}: locked query must preserve intent`);
  assert.deepEqual(first.afterLockedQuery.lastSeen, first.lockedSnapshot.lastSeen, `${name}: locked query must preserve memory`);
  assert.deepEqual(first.afterLockedQuery.spatialMotion, first.lockedSnapshot.spatialMotion, `${name}: locked query must preserve motion`);
  assert.equal(first.afterLockedQuery.actionReadyAtSec, first.lockedSnapshot.actionReadyAtSec, `${name}: action clock must remain unchanged`);
  assert.equal(first.afterLockedQuery.basicAttackReadyAtSec, first.lockedSnapshot.basicAttackReadyAtSec, `${name}: basic clock must remain unchanged`);
  assert.deepEqual(first.afterLockedQuery.randomState, first.rngBeforeLockedQuery, `${name}: locked scheduler must not consume RNG`);
  assert.deepEqual(first.rngAfterUnlockQuery, first.rngBeforeLockedQuery, `${name}: requery must not consume RNG`);
  assert.ok(first.unlockCandidate && first.unlockCandidate.atSec >= first.lockedCandidate.atSec,
    `${name}: unlock must run a fresh legal planner candidate at or after the boundary`);
  if (name === 'boundary_stale_target') {
    assert.equal(first.unlockCandidate.actionType, 'approach', 'a living target excluded from this query may only yield a normal last-seen approach');
    assert.notEqual(first.unlockCandidate.actionType, 'basic', 'a target unavailable to this query cannot produce an attack candidate');
  } else {
    assert.equal(first.unlockCandidate.actionType, 'basic', 'visible in-range target must become attackable at the recovery boundary');
    assert.equal(first.unlockCandidate.targetId, first.finalIntent?.targetId,
      'the resumed basic must still reference the actual engaged target');
  }
  return first;
}

const caseSummaries = [];
const resumed = await runTwice('resume');
const resumeActor = resumed.result.survivorMap.get(ACTOR_ID);
const resumeTarget = resumed.result.survivorMap.get(TARGET_ID);
assert.equal(resumeActor?.zoneId, ZONE_ID, 'the recovering actor must remain in its original zone');
assert.equal(resumeTarget?.hp > 0, true, 'the fixed target must remain alive for the whole controlled pursuit');
assert.ok(resumed.trace.lockedSamples.length > 0, 'the loop must actually advance during the recovery lock');
assert.ok(resumed.trace.lockedSamples.every((sample) => sample.intent?.enemyTeamId === resumed.trace.intentAtHold.enemyTeamId),
  'a still-valid visible enemy intent must survive the recovery lock');
assert.ok(resumed.trace.lockedSamples.every((sample) => JSON.stringify(sample.spatial) === JSON.stringify(resumed.trace.positionAtHold)),
  'the actor must not move voluntarily while its recovery lock is active');
assert.ok(resumed.trace.lockedSamples.every((sample) => JSON.stringify(sample.spatialLastSeen) === JSON.stringify(resumed.trace.lastSeenAtHold)),
  'a still-visible fixed target must not lose or refresh last-seen contact during the recovery lock');
assert.ok(resumed.trace.lockedSamples.every((sample) => sample.actionReadyAtSec === resumed.trace.actionReadyAtHold
  && sample.basicAttackReadyAtSec === resumed.trace.basicReadyAtHold),
  'recovery must not rewrite or bypass the actor’s ordinary personal action clocks');

const resumeAttempts = ownBasicAttempts(resumed.result);
const resumeStrikes = ownTeamStrikes(resumed.result);
const personalReadyAt = Math.max(resumed.trace.actionReadyAtHold, resumed.trace.basicReadyAtHold);
assert.ok(resumeAttempts.every((event) => Number(event.at?.sec ?? event.at) >= Math.max(resumed.trace.holdUntilSec, personalReadyAt)),
  'no own basic attempt, including zero-HP damage, may occur during recovery');
assert.ok(resumeStrikes.every((event) => Number(event.at?.sec ?? event.at) >= Math.max(resumed.trace.holdUntilSec, personalReadyAt)),
  'no own team-strike dispatch may occur during recovery');
assert.ok(resumeAttempts.length > 0, 'after recovery the actor must resume its ordinary own basic');
const resumeHits = resumeAttempts.filter((event) => Number(event.hpDamage ?? 0) > 0);
assert.ok(resumeHits.length > 0, 'resumption must produce positive HP damage, not merely a scheduled attempt');
for (const event of resumeHits) {
  assert.equal(event.zoneId, ZONE_ID, 'the positive hit must stay in the controlled encounter zone');
  assert.ok(Number(event.distance) <= Number(event.reach) + 1e-6, 'the hit receipt must prove actual range');
  assert.equal(event.fromPosition?.zoneId, ZONE_ID, 'the actual attacker position must be in the encounter zone');
  assert.equal(event.targetPosition?.zoneId, ZONE_ID, 'the actual target position must be in the encounter zone');
}
assert.ok(resumeHits.every((event) => Number(event.at?.sec ?? event.at) >= Math.max(resumed.trace.holdUntilSec,
  personalReadyAt)), 'every successful hit must also respect the actor’s ordinary personal clocks');
caseSummaries.push(summarizeNamedCase('resume', resumed));

const castOverlap = await runTwice('cast_overlap');
const castActor = castOverlap.result.survivorMap.get(ACTOR_ID);
const castTarget = castOverlap.result.survivorMap.get(TARGET_ID);
const castStarts = castOverlap.result.events.filter((event) => event.kind === 'skill_cast' && event.who === ACTOR_ID
  && event.slot === 'q' && event.skill === CAST_SKILL);
assert.equal(castStarts.length, 1, 'the ordinary AI scheduler must start exactly one paid character cast');
const castStart = castStarts[0];
assert.ok(castOverlap.trace.pendingCastAtHold, 'the real no-safe-path hold must be applied only after the cast is pending');
assert.equal(castOverlap.trace.pendingCastAtHold.castId, castStart.castId, 'the held pending cast must be the actual emitted cast');
assert.ok(castStart.startedAtSec < castOverlap.trace.holdStartSec, 'the actual cast must begin before recovery starts');
assert.ok(castStart.releaseAtSec > castOverlap.trace.holdStartSec && castStart.releaseAtSec <= castOverlap.trace.holdUntilSec,
  'the already-paid cast must be scheduled to release during the recovery hold');
const castRelease = castOverlap.result.events.find((event) => event.kind === 'skill' && event.who === ACTOR_ID
  && event.phase === 'release' && event.castId === castStart.castId && event.targetId === TARGET_ID);
assert.ok(castRelease, 'the same cast must reach its ordinary release receipt');
assert.equal(castRelease.at.sec, castStart.releaseAtSec, 'release must happen at the original scheduled release time');
const castHit = castOverlap.result.events.find((event) => event.kind === 'damage' && event.who === ACTOR_ID
  && event.targetId === TARGET_ID && event.castId === castStart.castId && Number(event.hpDamage ?? 0) > 0);
assert.ok(castHit, 'the already-started cast must produce actual positive target HP damage');
assert.equal(castHit.at.sec, castStart.releaseAtSec, 'the positive HP hit must be resolved at the cast release time');
assert.ok(Number(castHit.distance) <= Number(castHit.reach) + 1e-6, 'the cast hit must remain within its real release range');
assert.equal(castHit.zoneId, ZONE_ID, 'the cast must resolve in its unchanged encounter zone');
assert.ok(castActor?.skillState?.q?.cooldownUntil > castOverlap.trace.holdUntilSec,
  'the cast-start cooldown payment must survive release and the recovery hold');
assert.equal(castActor?.skillState?.q?.cooldownUntil, castStart.startedAtSec + 30,
  'the retained cooldown must be the original cast-start cooldown, not a reset deadline');
const paidCast = castOverlap.result.events.find((event) => event.kind === 'unique_resource' && event.who === ACTOR_ID
  && event.phase === 'cast_start' && event.slot === 'q');
assert.ok(paidCast, 'the cast must emit its actual start-time resource receipt');
assert.equal(paidCast.delta, -2, 'the cast must retain its paid resource cost');
assert.equal(castActor?.uniqueResourceValue, 3, 'the held cast must not refund or duplicate its paid resource');
assert.equal(castTarget?.hp < 1000000000, true, 'the controlled target must retain the actual cast damage');
const castStartsDuringHold = castOverlap.result.events.filter((event) => event.kind === 'skill_cast'
  && event.who === ACTOR_ID && Number(event.at?.sec ?? event.at) >= castOverlap.trace.holdStartSec
  && Number(event.at?.sec ?? event.at) < castOverlap.trace.holdUntilSec);
assert.equal(castStartsDuringHold.length, 0, 'the recovery hold must not grant a new voluntary cast');
assert.ok(ownBasicAttempts(castOverlap.result).every((event) => Number(event.at?.sec ?? event.at) >= castOverlap.trace.holdUntilSec),
  'the recovery hold must not grant an own basic attack while the paid cast is pending or after its release');
assert.ok(castOverlap.trace.lockedSamples.every((sample) => JSON.stringify(sample.spatial) === JSON.stringify(castOverlap.trace.positionAtHold)),
  'the actor must not move voluntarily while the paid cast overlaps recovery');
caseSummaries.push(summarizeNamedCase('cast_overlap', castOverlap));

for (const control of ['stale_sight', 'intent_space', 'target_dead']) {
  const result = await runTwice(control);
  const victim = result.result.survivorMap.get(TARGET_ID);
  const actorFinal = result.result.survivorMap.get(ACTOR_ID);
  assert.ok(result.trace.transitionEvidence, `${control}: the negative control must apply its real world-state transition`);
  assert.equal(ownBasicAttempts(result.result).length, 0, `${control}: no own basic may attack an invalid target`);
  assert.equal(ownTeamStrikes(result.result).length, 0, `${control}: no own team-strike may attack an invalid target`);
  if (control === 'stale_sight') {
    assert.ok(victim?.hp > 0, 'the stale-sight control target remains alive but outside sight');
    assert.equal(result.trace.transitionEvidence.targetVisible, false, 'the stale-sight control must truly leave actor vision');
    assert.ok(result.trace.holdUntilSec < result.result.frames.at(-1)?.sec && result.trace.postLockObserved,
      'the stale-sight control must observe an actual elapsed step after the recovery-unlock planner boundary');
    assert.ok(result.trace.postLockIntent == null, 'the expired out-of-sight engagement must not survive recovery');
    assert.ok(result.trace.postLockLastSeen == null, 'the stale spatial contact must expire without refreshing unseen coordinates');
    assert.ok(actorFinal?._combatIntent == null, 'expired last-seen memory must not keep a stale engagement alive');
  } else if (control === 'intent_space') {
    assert.ok(victim?.hp > 0, 'the space control target remains alive in the original space');
    assert.equal(actorFinal?._combatSpaceId, 'recovery-resume-isolated-space', 'the actor must remain in its changed space');
    assert.ok(actorFinal?._combatIntent == null, 'the old-space intent must not survive the controlled space change');
  } else {
    assert.equal(victim?.hp, 0, 'the actual target-death control must leave the target dead');
    assert.ok(actorFinal?.hp > 0, 'the recovering actor remains alive after target elimination');
  }
  caseSummaries.push(summarizeNamedCase(control, result));
}

const incoming = await runTwice('incoming_vulnerability');
const incomingHits = incoming.result.events.filter((event) => event.kind === 'damage' && event.type === 'basic'
  && String(event.who || '') === INCOMING_ID && String(event.targetId || '') === ACTOR_ID
  && Number(event.hpDamage ?? 0) > 0
  && Number(event.at?.sec ?? event.at) >= incoming.trace.holdStartSec
  && Number(event.at?.sec ?? event.at) < incoming.trace.holdUntilSec);
assert.ok(incomingHits.length > 0,
  'AI recovery must not grant immunity: a live opposing teammate must land positive HP damage during the hold');
assert.ok(ownBasicAttempts(incoming.result).every((event) => Number(event.at?.sec ?? event.at) >= Math.max(incoming.trace.holdUntilSec, personalReadyAt)),
  'the recovering actor still may not attack during its hold in the incoming-damage control');
caseSummaries.push(summarizeNamedCase('incoming_vulnerability', incoming));

for (const name of ['boundary_stale_target', 'boundary_normal_half_second', 'boundary_tiny_visible']) {
  const evidence = checkRecoveryBoundary(name);
  caseSummaries.push({ name, repetitions: 2, deterministicReplay: true, evidence });
}

console.log(`RECOVERY_COMBAT_RESUME ${JSON.stringify({ caseCount: caseSummaries.length, repetitionsPerCase: 2,
  totalRuns: caseSummaries.length * 2, cases: caseSummaries })}`);
console.log('PASS: recovery lock preserves visible intent, blocks voluntary action, resumes normal combat, and grants no incoming immunity');
