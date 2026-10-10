const STAGES = Object.freeze(['schedule', 'actor_schedule', 'team_queue', 'arbitration', 'post_world', 'team_execution']);
const ABSENCE_REASONS = Object.freeze([
  'absent_runtime_roster', 'team_changed', 'dead', 'different_zone', 'different_space', 'present',
  'actor_absent_runtime_roster', 'truncated_roster',
]);
const SCHEDULE_KEYS = Object.freeze([
  'hunt', 'support', 'recovery', 'cast', 'action_locked', 'attack_locked', 'no_intent', 'self_turn', 'other_turn',
]);
const TEAM_QUEUE_KEYS = Object.freeze(['on_field', 'queued', 'other_actor_turn']);
const ARBITRATION_KEYS = Object.freeze(['candidate', 'selected', 'deferred', 'wildlife_first', 'equipment_first']);
const ARBITRATION_ACTION_TYPES = Object.freeze(['basic', 'approach', 'skill_start', 'skill_release', 'skill_expire', 'status_boundary', 'other']);
const ACTOR_CANDIDATE_ACTION_TYPES = Object.freeze(['basic', 'approach', 'skill_start', 'skill_release', 'skill_expire', 'status_boundary', 'other', 'none']);
const EXECUTION_KEYS = Object.freeze(['invalidated_before_strike', 'no_valid_target', 'not_performed', 'performed_no_hp', 'hp_hit']);
const ACTOR_BRANCHES = Object.freeze(['dead_or_rift', 'wildlife_hunt', 'boss_assist', 'forced_control', 'pending_cast', 'recovery_locked',
  'no_intent_patrol', 'no_opponents_last_seen', 'no_opponents_patrol', 'observed_out_of_range', 'basic_in_range', 'other']);
const MOTION_BUCKETS = Object.freeze(['none', 'patrol', 'last_seen', 'chase', 'forced', 'other']);
const WORLD_PAIR_KEYS = Object.freeze(['matched', 'no_pending', 'identity_mismatch', 'time_mismatch']);
const WORLD_ACTOR_OUTCOMES = Object.freeze(['moved', 'stationary', 'changed_zone_space', 'missing_actor', 'truncated_roster', 'position_missing']);
const WORLD_TARGET_OUTCOMES = Object.freeze(['moved', 'stationary', 'changed_zone_space', 'no_target', 'missing_target', 'truncated_roster', 'position_missing']);

const idOf = actor => cleanId(actor?._id ?? actor?.id ?? actor?.actorId);
const cleanId = value => typeof value === 'string' && value.length > 0 ? value : '';
const teamOf = actor => cleanId(actor?.matchTeamId ?? actor?.teamId ?? actor?.squadId);
const finite = value => Number.isFinite(value) ? value : null;
const finiteNonnegative = value => Number.isFinite(value) && value >= 0 ? value : null;
const positive = value => typeof value === 'string' && value.length > 0;
const emptyCounts = keys => Object.fromEntries(keys.map(key => [key, 0]));
const motionBucket = value => {
  const reason = cleanId(value);
  if (MOTION_BUCKETS.includes(reason)) return reason;
  if (reason === 'approach') return 'chase';
  if (reason === 'forced_control') return 'forced';
  return reason ? 'other' : 'none';
};
const candidateActionBucket = candidate => {
  if (!candidate) return 'none';
  return ACTOR_CANDIDATE_ACTION_TYPES.includes(candidate.actionType) && candidate.actionType !== 'none'
    ? candidate.actionType : 'other';
};
const sameNumber = (left, right) => Number.isFinite(left) && Number.isFinite(right) && Math.abs(left - right) <= 1e-6;
const movementOutcome = (before, after, absentKey, truncated = false) => {
  if (!before || !after) return truncated ? 'truncated_roster' : absentKey;
  if (before.zoneId !== after.zoneId || before.combatSpaceId !== after.combatSpaceId) return 'changed_zone_space';
  if (!before.spatial || !after.spatial) return 'position_missing';
  return Math.hypot(after.spatial.x - before.spatial.x, after.spatial.y - before.spatial.y) > 1e-6 ? 'moved' : 'stationary';
};
const distanceBetween = (left, right) => left && right && left.zoneId === right.zoneId
  && left.combatSpaceId === right.combatSpaceId && left.spatial && right.spatial
  ? Math.hypot(left.spatial.x - right.spatial.x, left.spatial.y - right.spatial.y) : null;
const cloneSimple = value => {
  if (Array.isArray(value)) return value.map(cloneSimple);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, cloneSimple(item)]));
  }
  return value;
};

const rosterIndex = roster => {
  const index = new Map();
  for (const actor of Array.isArray(roster) ? roster : []) {
    const actorId = idOf(actor);
    if (actorId) index.set(actorId, { teamId: teamOf(actor) });
  }
  return index;
};

const sameRosterTeam = (index, leftId, rightId) => {
  const left = index.get(leftId);
  const right = index.get(rightId);
  return Boolean(left && right && left.teamId && left.teamId === right.teamId);
};

const minimalActor = actor => ({
  actorId: idOf(actor),
  teamId: cleanId(actor?.teamId ?? actor?.matchTeamId),
  zoneId: cleanId(actor?.zoneId),
  combatSpaceId: cleanId(actor?.combatSpaceId),
  hp: finite(actor?.hp),
  maxHp: finite(actor?.maxHp),
  actionReadyAtSec: finite(actor?.actionReadyAtSec),
  basicAttackReadyAtSec: finite(actor?.basicAttackReadyAtSec),
  recoveryUntilSec: finite(actor?.recoveryUntilSec),
  recoveryReason: cleanId(actor?.recoveryReason),
  pendingCast: actor?.pendingCast && typeof actor.pendingCast === 'object'
    ? { targetId: cleanId(actor.pendingCast.targetId), releaseAtSec: finite(actor.pendingCast.releaseAtSec) } : null,
  hunt: actor?.hunt && typeof actor.hunt === 'object'
    ? { encounterId: cleanId(actor.hunt.encounterId), kind: cleanId(actor.hunt.kind) } : null,
  bossAssistOwnerId: cleanId(actor?.bossAssistOwnerId),
  hasCombatIntent: typeof actor?.hasCombatIntent === 'boolean' ? actor.hasCombatIntent : null,
  intentEnemyTeamId: cleanId(actor?.intentEnemyTeamId),
  intentTargetId: cleanId(actor?.intentTargetId),
  basicAllowed: typeof actor?.basicAllowed === 'boolean' ? actor.basicAllowed : null,
  actionBlocked: typeof actor?.actionBlocked === 'boolean' ? actor.actionBlocked : null,
  deadInThisPhase: actor?.deadInThisPhase === true,
  riftDefeated: actor?.riftDefeated === true,
  spatial: actor?.spatial && Number.isFinite(actor.spatial.x) && Number.isFinite(actor.spatial.y)
    ? { x: actor.spatial.x, y: actor.spatial.y } : null,
  spatialMotion: actor?.spatialMotion && typeof actor.spatialMotion === 'object' ? {
    reason: motionBucket(actor.spatialMotion.reason), targetId: cleanId(actor.spatialMotion.targetId),
    x: finite(actor.spatialMotion.x), y: finite(actor.spatialMotion.y), stopRange: finite(actor.spatialMotion.stopRange),
  } : null,
  spatialLastSeen: actor?.spatialLastSeen && typeof actor.spatialLastSeen === 'object' ? {
    targetId: cleanId(actor.spatialLastSeen.targetId), x: finite(actor.spatialLastSeen.x), y: finite(actor.spatialLastSeen.y),
    seenAtSec: finite(actor.spatialLastSeen.seenAtSec),
  } : null,
  attackRange: finite(actor?.attackRange),
  moveSpeed: finite(actor?.moveSpeed),
  moveAllowed: typeof actor?.moveAllowed === 'boolean' ? actor.moveAllowed : null,
});

const sampleCursor = value => typeof value === 'string' || typeof value === 'number' ? value : null;
const scheduleSignature = (actor, actorId, scheduled, nowSec) => JSON.stringify({
  exists: Boolean(actor),
  ready: actor && nowSec !== null && actor.actionReadyAtSec !== null ? actor.actionReadyAtSec <= nowSec : null,
  attackReady: actor && nowSec !== null && actor.basicAttackReadyAtSec !== null ? actor.basicAttackReadyAtSec <= nowSec : null,
  recoveryLocked: actor && nowSec !== null && actor.recoveryUntilSec !== null ? actor.recoveryUntilSec > nowSec : null,
  actionBlocked: actor?.actionBlocked ?? null,
  basicAllowed: actor?.basicAllowed ?? null,
  cast: Boolean(actor?.pendingCast),
  castTarget: actor?.pendingCast?.targetId ?? '',
  hunt: actor?.hunt?.kind ?? '',
  support: Boolean(actor?.bossAssistOwnerId),
  hasCombatIntent: actor?.hasCombatIntent ?? null,
  intentEnemyTeamId: actor?.intentEnemyTeamId ?? '',
  intentTargetId: actor?.intentTargetId ?? '',
  selected: scheduled?.actorId === actorId,
  scheduledActorId: scheduled?.actorId ?? '',
  actionType: scheduled?.actionType ?? '',
});

export function createTeamCombatParticipationDiagnostics({ roster, actorIds, comparisonRoster, sampleLimit = 6 } = {}) {
  const startingRoster = rosterIndex(roster);
  const otherRoster = rosterIndex(comparisonRoster);
  const watchedIds = [...new Set((Array.isArray(actorIds) ? actorIds : []).map(cleanId).filter(Boolean))];
  const boundedLimit = Number.isInteger(sampleLimit) ? Math.max(0, Math.min(sampleLimit, 6)) : 6;
  const scheduleLimit = Math.ceil(boundedLimit / 2);
  const queueLimit = boundedLimit - scheduleLimit;
  const changedBuddies = new Map(watchedIds.map(actorId => {
    const buddies = new Set();
    for (const candidateId of new Set([...startingRoster.keys(), ...otherRoster.keys()])) {
      if (candidateId === actorId) continue;
      if (sameRosterTeam(startingRoster, actorId, candidateId) && !sameRosterTeam(otherRoster, actorId, candidateId)) {
        buddies.add(candidateId);
      }
    }
    return [actorId, [...buddies]];
  }));
  const counts = new Map(watchedIds.map(actorId => [actorId, {
    schedule: emptyCounts(SCHEDULE_KEYS),
    actor_schedule: { candidate: 0, no_candidate: 0, byActionType: emptyCounts(ACTOR_CANDIDATE_ACTION_TYPES),
      availability: { candidate_row: 0, missing_candidate_row: 0, truncated: 0, actor_missing: 0, invalid_candidate_actor: 0 },
      branches: emptyCounts(ACTOR_BRANCHES), motion: emptyCounts(MOTION_BUCKETS) },
    team_queue: emptyCounts(TEAM_QUEUE_KEYS),
    arbitration: emptyCounts(ARBITRATION_KEYS),
    arbitrationByActionType: Object.fromEntries(ARBITRATION_ACTION_TYPES.map(type => [type, emptyCounts(ARBITRATION_KEYS)])),
    team_execution: emptyCounts(EXECUTION_KEYS),
    post_world: { pairing: emptyCounts(WORLD_PAIR_KEYS), motionBefore: emptyCounts(MOTION_BUCKETS),
      motionAfter: emptyCounts(MOTION_BUCKETS), actorMovement: emptyCounts(WORLD_ACTOR_OUTCOMES),
      targetMovement: emptyCounts(WORLD_TARGET_OUTCOMES) },
    changedBuddyAbsence: emptyCounts(ABSENCE_REASONS),
  }]));
  const samples = new Map(watchedIds.map(actorId => [actorId, []]));
  const executionSamples = new Map(watchedIds.map(actorId => [actorId, []]));
  const causalSamples = new Map(watchedIds.map(actorId => [actorId, []]));
  const pendingPreWorld = new Map();
  const scheduleSignatures = new Map(watchedIds.map(actorId => [actorId, new Set()]));
  const arbitrationSignatures = new Map(watchedIds.map(actorId => [actorId, new Set()]));

  const retainCausalSample = (actorId, sample, slot = '') => {
    const actorSamples = causalSamples.get(actorId);
    if (!actorSamples) return;
    const stageSamples = actorSamples.filter(item => item.stage === sample.stage);
    const limit = 3;
    const isBasic = sample.stage === 'actor_schedule' && sample.currentState.candidateValid === true
      && sample.currentState.actionType === 'basic'
      || sample.stage === 'post_world' && sample.currentState.scheduled.actionType === 'basic';
    const isChase = sample.stage === 'actor_schedule'
      ? ['chase', 'last_seen'].includes(sample.currentState.motionReason)
        || sample.currentState.branch === 'no_opponents_last_seen'
      : ['chase', 'last_seen'].includes(sample.currentState.motionReasonBefore)
        || ['chase', 'last_seen'].includes(sample.currentState.motionReasonAfter)
        || sample.currentState.branch === 'no_opponents_last_seen';
    const roles = [...new Set([...(isBasic ? ['latest_basic'] : []), ...(isChase ? ['last_chase'] : []), ...(slot ? [slot] : [])])];
    const replaceByRole = new Set(roles);
    if (roles.length) {
      const replaced = stageSamples.filter(item => (item.retainedAs ?? []).some(role => replaceByRole.has(role)));
      if (replaced.length) {
        for (const item of replaced) {
          const remaining = (item.retainedAs ?? []).filter(role => !replaceByRole.has(role));
          if (remaining.length) item.retainedAs = remaining;
          else actorSamples.splice(actorSamples.indexOf(item), 1);
        }
        if (actorSamples.filter(item => item.stage === sample.stage).length >= limit) {
          const replace = [...actorSamples].reverse().find(item => item.stage === sample.stage && !(item.retainedAs ?? []).length);
          if (replace) actorSamples.splice(actorSamples.indexOf(replace), 1);
        }
        if (actorSamples.filter(item => item.stage === sample.stage).length < limit) {
          actorSamples.push({ ...sample, retainedAs: roles });
        }
        return;
      }
    }
    if (stageSamples.length < limit) {
      actorSamples.push({ ...sample, ...(roles.length ? { retainedAs: roles } : {}) });
      return;
    }
    if (!roles.length) return;
    const replace = [...stageSamples].reverse().find(item => !(item.retainedAs ?? []).length);
    if (replace) actorSamples[actorSamples.indexOf(replace)] = { ...sample, retainedAs: roles };
  };

  const observe = (snapshot, { eventCursor } = {}) => {
    // These observations belong to the separate shared-world collector. They
    // describe the work inside an existing reservation, not a new arbitration.
    if (snapshot?.stage === 'world_step_before' || snapshot?.stage === 'world_step_after') return;
    if (!snapshot || !STAGES.includes(snapshot.stage)) {
      pendingPreWorld.clear();
      return;
    }
    const stage = snapshot.stage;
    const nowSec = finite(snapshot.nowSec);
    const actors = Array.isArray(snapshot.actors) ? snapshot.actors.map(minimalActor).filter(actor => actor.actorId) : [];
    const actorsById = new Map(actors.map(actor => [actor.actorId, actor]));
    const sides = Array.isArray(snapshot.sides)
      ? snapshot.sides.map(side => Array.isArray(side) ? side.map(cleanId).filter(Boolean) : []) : [];
    const participants = Array.isArray(snapshot.participants) ? snapshot.participants.map(cleanId).filter(Boolean) : [];
    const scheduled = snapshot.scheduled && typeof snapshot.scheduled === 'object' ? {
      actorId: cleanId(snapshot.scheduled.actorId),
      targetId: cleanId(snapshot.scheduled.targetId),
      actionType: cleanId(snapshot.scheduled.actionType),
      atSec: finite(snapshot.scheduled.atSec),
    } : null;
    const initiatorId = cleanId(snapshot.initiatorId);
    const targetId = cleanId(snapshot.targetId);
    const onlyActorId = cleanId(snapshot.onlyActorId);
    const arbitration = snapshot.arbitration && typeof snapshot.arbitration === 'object' ? {
      selectedScheduler: cleanId(snapshot.arbitration.selectedScheduler),
      selectedActorId: cleanId(snapshot.arbitration.selectedActorId),
      selectedActionType: cleanId(snapshot.arbitration.selectedActionType),
      selectedAtSec: finite(snapshot.arbitration.selectedAtSec), decisionSec: finite(snapshot.arbitration.decisionSec),
      scheduled: snapshot.arbitration.scheduled === true,
    } : null;
    const resolution = snapshot.resolution && typeof snapshot.resolution === 'object' ? {
      actorId: cleanId(snapshot.resolution.actorId), targetId: cleanId(snapshot.resolution.targetId),
      encounterId: cleanId(snapshot.resolution.encounterId), outcome: cleanId(snapshot.resolution.outcome),
      hpBefore: finite(snapshot.resolution.hpBefore), hpAfter: finite(snapshot.resolution.hpAfter),
      hpDamage: finite(snapshot.resolution.hpDamage),
    } : null;
    const worldStep = snapshot.worldStep && typeof snapshot.worldStep === 'object' ? {
      fromSec: finite(snapshot.worldStep.fromSec), toSec: finite(snapshot.worldStep.toSec),
      decisionSec: finite(snapshot.worldStep.decisionSec),
    } : null;
    const actorCandidates = new Map();
    for (const row of Array.isArray(snapshot.actorCandidates) ? snapshot.actorCandidates : []) {
      const candidateActorId = cleanId(row?.actorId);
      if (!candidateActorId || !counts.has(candidateActorId) || actorCandidates.has(candidateActorId)) continue;
      const rawCandidate = row?.candidate && typeof row.candidate === 'object' ? row.candidate : null;
      actorCandidates.set(candidateActorId, {
        actorId: candidateActorId,
        branch: ACTOR_BRANCHES.includes(row.branch) ? row.branch : 'other',
        candidate: rawCandidate ? {
          actorId: cleanId(rawCandidate.actorId), targetId: cleanId(rawCandidate.targetId),
          actionType: cleanId(rawCandidate.actionType), atSec: finite(rawCandidate.atSec),
        } : null,
        candidateActorMismatch: Boolean(rawCandidate && cleanId(rawCandidate.actorId) !== candidateActorId),
        candidateValid: Boolean(rawCandidate && cleanId(rawCandidate.actorId) === candidateActorId),
        actionType: candidateActionBucket(rawCandidate ? {
          actorId: cleanId(rawCandidate.actorId), targetId: cleanId(rawCandidate.targetId),
          actionType: cleanId(rawCandidate.actionType), atSec: finite(rawCandidate.atSec),
        } : null),
        opponentCount: Number.isFinite(row.opponentCount) ? Math.max(0, Math.floor(row.opponentCount)) : null,
        nearestTargetId: cleanId(row.nearestTargetId), nearestDistance: finiteNonnegative(row.nearestDistance),
        attackRange: finiteNonnegative(row.attackRange), motionReason: motionBucket(row.motionReason),
      });
    }
    const sideSet = new Set(sides.flat());
    const participantSet = new Set(participants);

    // A new arbitration boundary invalidates any unconsumed pre-world sample.
    // Only the immediately following exact post-world reservation may pair.
    if (stage !== 'post_world') pendingPreWorld.clear();

    if (stage === 'actor_schedule') {
      for (const actorId of watchedIds) {
        const fact = actorCandidates.get(actorId);
        const actorCounts = counts.get(actorId).actor_schedule;
        if (snapshot.truncated === true || snapshot.actorCandidatesTruncated === true) actorCounts.availability.truncated += 1;
        if (!fact) {
          actorCounts.availability.missing_candidate_row += 1;
          continue;
        }
        actorCounts.availability.candidate_row += 1;
        if (!actorsById.has(actorId)) actorCounts.availability.actor_missing += 1;
        if (fact.candidateActorMismatch) actorCounts.availability.invalid_candidate_actor += 1;
        actorCounts.candidate += Number(fact.candidateValid);
        actorCounts.no_candidate += Number(!fact.candidate);
        if (fact.candidateValid) actorCounts.byActionType[fact.actionType] += 1;
        else if (!fact.candidate) actorCounts.byActionType.none += 1;
        actorCounts.branches[fact.branch] += 1;
        actorCounts.motion[fact.motionReason] += 1;
        retainCausalSample(actorId, { stage, eventCursor: sampleCursor(eventCursor), nowSec,
          currentState: { ...fact, actor: actorsById.get(actorId) ?? null }, changedBuddyFacts: [] });
      }
      return;
    }

    if (stage === 'post_world') {
      const selectedId = scheduled?.actorId || '';
      const pending = pendingPreWorld.get(selectedId);
      const pendingEntries = [...pendingPreWorld.entries()];
      for (const [actorId] of pendingEntries) pendingPreWorld.delete(actorId);
      for (const [actorId] of pendingEntries) {
        if (actorId !== selectedId) counts.get(actorId).post_world.pairing.identity_mismatch += 1;
      }
      if (!selectedId || !counts.has(selectedId)) return;
      const actorCounts = counts.get(selectedId).post_world;
      if (!pending) { actorCounts.pairing.no_pending += 1; return; }
      const sameCandidate = pending.candidate.actorId === scheduled.actorId
        && pending.candidate.targetId === scheduled.targetId
        && pending.candidate.actionType === scheduled.actionType
        && sameNumber(pending.candidate.atSec, scheduled.atSec);
      if (!sameCandidate) { actorCounts.pairing.identity_mismatch += 1; return; }
      const sameTime = worldStep && sameNumber(nowSec, worldStep.toSec)
        && sameNumber(worldStep.fromSec, pending.nowSec)
        && sameNumber(worldStep.toSec, pending.candidate.atSec)
        && sameNumber(worldStep.toSec, scheduled.atSec)
        && sameNumber(worldStep.decisionSec, pending.arbitration.decisionSec);
      if (!sameTime) { actorCounts.pairing.time_mismatch += 1; return; }

      const postActor = actorsById.get(selectedId) ?? null;
      const postTarget = scheduled.targetId ? actorsById.get(scheduled.targetId) ?? null : null;
      const actorMovement = movementOutcome(pending.actor, postActor, 'missing_actor', pending.truncated || snapshot.truncated === true);
      const targetMovement = scheduled.targetId ? movementOutcome(pending.target, postTarget, 'missing_target',
        pending.truncated || snapshot.truncated === true) : 'no_target';
      actorCounts.pairing.matched += 1;
      const motionBefore = motionBucket(pending.motionReason);
      const motionAfter = motionBucket(postActor?.spatialMotion?.reason);
      actorCounts.motionBefore[motionBefore] += 1;
      actorCounts.motionAfter[motionAfter] += 1;
      actorCounts.actorMovement[actorMovement] += 1;
      actorCounts.targetMovement[targetMovement] += 1;
      const beforeDistance = distanceBetween(pending.actor, pending.target);
      const afterDistance = distanceBetween(postActor, postTarget);
      retainCausalSample(selectedId, { stage, eventCursor: sampleCursor(eventCursor), nowSec,
          currentState: {
          scheduled, worldStep, motionReasonBefore: pending.motionReason,
          motionReasonAfter: motionAfter, actorMovement, targetMovement,
          distanceBefore: finite(beforeDistance), distanceAfter: finite(afterDistance),
          attackRangeBefore: pending.attackRange, attackRangeAfter: postActor?.attackRange ?? null,
          actorBefore: pending.actor, actorAfter: postActor, targetBefore: pending.target, targetAfter: postTarget,
        }, changedBuddyFacts: [] });
      return;
    }

    for (const actorId of watchedIds) {
      const actor = actorsById.get(actorId);
      const ownSide = sides.find(side => side.includes(actorId));
      // A different team's encounter says nothing about this actor's missing
      // buddies. Keep queue facts local to a watched actor actually on the side.
      if (stage === 'team_queue' && !ownSide) continue;
      // These stages concern a specific candidate or actual queued striker,
      // not every actor whose roster happens to appear in the snapshot.
      if (stage === 'arbitration' && (!arbitration || scheduled?.actorId !== actorId)) continue;
      if (stage === 'team_execution' && (!resolution || resolution.actorId !== actorId
        || !EXECUTION_KEYS.includes(resolution.outcome))) continue;
      const actorCounts = counts.get(actorId);
      const buddyFacts = [];
      for (const buddyId of changedBuddies.get(actorId) ?? []) {
        const buddy = actorsById.get(buddyId);
        let reason;
        if (snapshot.truncated === true && (!actor || !buddy)) reason = 'truncated_roster';
        else if (!actor) reason = 'actor_absent_runtime_roster';
        else if (!buddy) reason = 'absent_runtime_roster';
        else if (buddy.hp !== null && buddy.hp <= 0 || buddy.deadInThisPhase || buddy.riftDefeated) reason = 'dead';
        else if (actor && buddy.teamId !== actor.teamId) reason = 'team_changed';
        else if (actor && buddy.zoneId !== actor.zoneId) reason = 'different_zone';
        else if (actor && buddy.combatSpaceId !== actor.combatSpaceId) reason = 'different_space';
        else if (ownSide?.includes(buddyId)) reason = 'present';
        else if (['schedule', 'arbitration'].includes(stage) && !sideSet.size && actor && buddy.teamId === actor.teamId
          && buddy.zoneId === actor.zoneId && buddy.combatSpaceId === actor.combatSpaceId) reason = 'present';
        else reason = 'absent_runtime_roster';
        if (stage === 'schedule' || stage === 'team_queue') actorCounts.changedBuddyAbsence[reason] += 1;
        buddyFacts.push({ buddyId, reason });
      }

      if (stage === 'arbitration' || stage === 'team_execution') {
        let currentState;
        if (stage === 'arbitration') {
          const stageCounts = actorCounts.arbitration;
          const actionType = ARBITRATION_ACTION_TYPES.includes(scheduled.actionType) ? scheduled.actionType : 'other';
          const actionCounts = actorCounts.arbitrationByActionType[actionType];
          stageCounts.candidate += 1;
          actionCounts.candidate += 1;
          const outcome = !arbitration.scheduled ? 'deferred'
            : arbitration.selectedScheduler === 'pvp' && arbitration.selectedActorId === actorId ? 'selected'
              : arbitration.selectedScheduler === 'wildlife' ? 'wildlife_first'
                : arbitration.selectedScheduler === 'equipment' ? 'equipment_first' : '';
          if (outcome) { stageCounts[outcome] += 1; actionCounts[outcome] += 1; }
          if (arbitration.scheduled && arbitration.selectedScheduler === 'pvp'
            && arbitration.selectedActorId === actorId
            && arbitration.selectedActionType === scheduled.actionType
            && sameNumber(arbitration.selectedAtSec, scheduled.atSec)) {
            pendingPreWorld.set(actorId, {
              candidate: { ...scheduled }, nowSec,
              arbitration: { ...arbitration }, actor: actor ?? null,
              target: scheduled.targetId ? actorsById.get(scheduled.targetId) ?? null : null,
              motionReason: actor?.spatialMotion?.reason || 'none', attackRange: actor?.attackRange ?? null,
              truncated: snapshot.truncated === true,
            });
          }
          currentState = { scheduled, arbitration, actor: actor ?? null };
        } else {
          actorCounts.team_execution[resolution.outcome] += 1;
          currentState = { resolution, onlyActorId, actor: actor ?? null };
        }
        const actorSamples = executionSamples.get(actorId);
        const stageLimit = stage === 'arbitration' ? scheduleLimit : queueLimit;
        if (!stageLimit) continue;
        const sample = { stage, eventCursor: sampleCursor(eventCursor), nowSec,
          currentState: cloneSimple(currentState), changedBuddyFacts: buddyFacts };
        // Early patrol approaches must not consume every sample before a late
        // basic candidate. Keep one latest-basic slot within the same bound.
        if (stage === 'arbitration' && scheduled.actionType === 'basic') {
          const latestBasic = actorSamples.findIndex(item => item.stage === stage && item.currentState.scheduled.actionType === 'basic');
          if (latestBasic >= 0) actorSamples[latestBasic] = sample;
          else if (actorSamples.filter(item => item.stage === stage).length < stageLimit) actorSamples.push(sample);
          else {
            const replaceIndex = actorSamples.findLastIndex(item => item.stage === stage);
            actorSamples[replaceIndex] = sample;
          }
          continue;
        }
        if (actorSamples.filter(item => item.stage === stage).length >= stageLimit) continue;
        if (stage === 'arbitration') {
          const signature = JSON.stringify({ scheduler: arbitration.selectedScheduler,
            selected: arbitration.scheduled, actionType: scheduled.actionType, targetId: scheduled.targetId, atSec: scheduled.atSec,
            actorId: arbitration.selectedActorId, actorState: scheduleSignature(actor, actorId, scheduled, nowSec) });
          const seen = arbitrationSignatures.get(actorId);
          if (seen.has(signature)) continue;
          seen.add(signature);
        }
        actorSamples.push(sample);
        continue;
      }

      if (stage === 'schedule') {
        const stageCounts = actorCounts.schedule;
        if (actor?.hunt) stageCounts.hunt += 1;
        if (actor && positive(actor.bossAssistOwnerId)) stageCounts.support += 1;
        if (actor && actor.recoveryUntilSec !== null && nowSec !== null && actor.recoveryUntilSec > nowSec) {
          stageCounts.recovery += 1;
        }
        if (actor?.pendingCast) stageCounts.cast += 1;
        if (actor && (actor.actionBlocked === true || actor.actionReadyAtSec !== null && nowSec !== null && actor.actionReadyAtSec > nowSec)) {
          stageCounts.action_locked += 1;
        }
        if (actor && (actor.basicAllowed === false || actor.basicAttackReadyAtSec !== null && nowSec !== null && actor.basicAttackReadyAtSec > nowSec)) {
          stageCounts.attack_locked += 1;
        }
        if (actor?.hasCombatIntent === false) stageCounts.no_intent += 1;
        if (scheduled && scheduled.actorId === actorId) stageCounts.self_turn += 1;
        else if (scheduled) stageCounts.other_turn += 1;
      } else {
        const stageCounts = actorCounts.team_queue;
        if (sideSet.has(actorId)) stageCounts.on_field += 1;
        if (participantSet.has(actorId)) stageCounts.queued += 1;
        if (sideSet.has(actorId) && onlyActorId && onlyActorId !== actorId) stageCounts.other_actor_turn += 1;
      }

      const actorSamples = samples.get(actorId);
      const stageCount = actorSamples.filter(sample => sample.stage === stage).length;
      const stageLimit = stage === 'schedule' ? scheduleLimit : queueLimit;
      if (stageCount >= stageLimit) continue;
      if (stage === 'team_queue' && !sideSet.has(actorId)) continue;
      if (stage === 'schedule') {
        const signature = scheduleSignature(actor, actorId, scheduled, nowSec);
        const seen = scheduleSignatures.get(actorId);
        if (seen.has(signature)) continue;
        seen.add(signature);
      }
      const currentState = stage === 'schedule' ? {
        scheduled,
        actor: actor ?? null,
      } : {
        initiatorId, targetId, onlyActorId,
        onField: sideSet.has(actorId), queued: participantSet.has(actorId),
        actor: actor ?? null,
      };
      actorSamples.push({
        stage,
        eventCursor: sampleCursor(eventCursor),
        nowSec,
        currentState: cloneSimple(currentState),
        changedBuddyFacts: buddyFacts,
      });
    }
  };

  const summary = () => ({
    scope: 'Bounded per-actor candidate, selected-reservation world movement and actual team-resolution facts; not global missed-turn, duration or survival-causality acceptance.',
    counterSemantics: {
      schedule: 'self_turn/other_turn identify the PvP candidate before wildlife/equipment arbitration and decision deadline checks; not an executed turn.',
      actor_schedule: 'Each watched actor contributes its own single best candidate from that one planner pass; candidates are not the global winner and are not executed actions. Fixed per-actor action-type, branch and movement buckets are not global counts. A missing candidate row is unavailable, not a no-candidate result; explicit null candidate rows alone count as no_candidate/none. Candidate actor mismatches are invalid and excluded from candidate/action totals.',
      team_queue: 'Only queues with the watched actor on a side are counted; unrelated encounters are excluded. Counts continue after sample limits.',
      arbitration: 'Only the watched PvP candidate is counted after wildlife/equipment arbitration and deadline checks; selected means dispatch reservation, not an executed attack.',
      arbitrationByActionType: 'Fixed action-type buckets split basic from approach/patrol and other reservations. A selected approach is not a basic attack. One latest-basic sample is retained within the unchanged stage sample cap.',
      post_world: 'Pairs only an immediately preceding selected PvP reservation with the same actor/target/action/time and exact world interval including post-snapshot time. Fixed before/after movement-reason buckets and movement/visibility-relevant geometry are recorded after time advances, not proof of movement/attack causation or a successful attack; targetMovement.no_target denotes patrol reservations without a target, not a missing target.',
      causalSamples: 'At most three actor_schedule and three post_world samples per watched actor (six total), preserving the latest basic and latest chase/last-seen sample when present. Existing schedule/queue and arbitration/execution sample limits remain unchanged.',
      team_execution: 'Only the watched queued striker is counted at actual recheck/target/resolve points. performed_no_hp is not a positive HP hit; hp_hit does not establish survival causality.',
      changedBuddyAbsence: 'Snapshot-level facts accumulated across schedule and relevant queues, not per-encounter absence causes or elapsed seconds. actor_absent_runtime_roster and truncated_roster are unavailable comparisons, not positive evidence of buddy absence.',
    },
    actorIds: [...watchedIds],
    sampleLimit: boundedLimit,
    executionSampleLimit: boundedLimit,
    causalSampleLimit: 6,
    overallSampleLimit: 18,
    countsByActor: Object.fromEntries(watchedIds.map(actorId => [actorId, cloneSimple(counts.get(actorId))])),
    samplesByActor: Object.fromEntries(watchedIds.map(actorId => [actorId, cloneSimple(samples.get(actorId))])),
    executionSamplesByActor: Object.fromEntries(watchedIds.map(actorId => [actorId, cloneSimple(executionSamples.get(actorId))])),
    causalSamplesByActor: Object.fromEntries(watchedIds.map(actorId => [actorId, cloneSimple(causalSamples.get(actorId))])),
  });

  return Object.freeze({ observe, summary });
}
