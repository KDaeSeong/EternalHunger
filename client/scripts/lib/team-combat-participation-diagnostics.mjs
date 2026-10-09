const STAGES = Object.freeze(['schedule', 'team_queue']);
const ABSENCE_REASONS = Object.freeze([
  'absent_runtime_roster', 'team_changed', 'dead', 'different_zone', 'different_space', 'present',
]);
const SCHEDULE_KEYS = Object.freeze([
  'hunt', 'support', 'recovery', 'cast', 'action_locked', 'attack_locked', 'no_intent', 'self_turn', 'other_turn',
]);
const TEAM_QUEUE_KEYS = Object.freeze(['on_field', 'queued', 'other_actor_turn']);

const idOf = actor => cleanId(actor?._id ?? actor?.id ?? actor?.actorId);
const cleanId = value => typeof value === 'string' && value.length > 0 ? value : '';
const teamOf = actor => cleanId(actor?.matchTeamId ?? actor?.teamId ?? actor?.squadId);
const finite = value => Number.isFinite(value) ? value : null;
const positive = value => typeof value === 'string' && value.length > 0;
const emptyCounts = keys => Object.fromEntries(keys.map(key => [key, 0]));
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
    team_queue: emptyCounts(TEAM_QUEUE_KEYS),
    changedBuddyAbsence: emptyCounts(ABSENCE_REASONS),
  }]));
  const samples = new Map(watchedIds.map(actorId => [actorId, []]));
  const scheduleSignatures = new Map(watchedIds.map(actorId => [actorId, new Set()]));

  const observe = (snapshot, { eventCursor } = {}) => {
    if (!snapshot || !STAGES.includes(snapshot.stage)) return;
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
    const sideSet = new Set(sides.flat());
    const participantSet = new Set(participants);

    for (const actorId of watchedIds) {
      const actor = actorsById.get(actorId);
      const ownSide = sides.find(side => side.includes(actorId));
      // A different team's encounter says nothing about this actor's missing
      // buddies. Keep queue facts local to a watched actor actually on the side.
      if (stage === 'team_queue' && !ownSide) continue;
      const actorCounts = counts.get(actorId);
      const buddyFacts = [];
      for (const buddyId of changedBuddies.get(actorId) ?? []) {
        const buddy = actorsById.get(buddyId);
        let reason;
        if (!buddy) reason = 'absent_runtime_roster';
        else if (buddy.hp !== null && buddy.hp <= 0 || buddy.deadInThisPhase || buddy.riftDefeated) reason = 'dead';
        else if (actor && buddy.teamId !== actor.teamId) reason = 'team_changed';
        else if (actor && buddy.zoneId !== actor.zoneId) reason = 'different_zone';
        else if (actor && buddy.combatSpaceId !== actor.combatSpaceId) reason = 'different_space';
        else if (ownSide?.includes(buddyId)) reason = 'present';
        else if (stage === 'schedule' && !sideSet.size && actor && buddy.teamId === actor.teamId
          && buddy.zoneId === actor.zoneId && buddy.combatSpaceId === actor.combatSpaceId) reason = 'present';
        else reason = 'absent_runtime_roster';
        actorCounts.changedBuddyAbsence[reason] += 1;
        buddyFacts.push({ buddyId, reason });
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
    scope: 'Snapshot frequency of current runtime facts; not executed turns, durations or causal acceptance.',
    counterSemantics: {
      schedule: 'self_turn/other_turn identify the PvP candidate before wildlife/equipment arbitration and decision deadline checks; not an executed turn.',
      team_queue: 'Only queues with the watched actor on a side are counted; unrelated encounters are excluded. Counts continue after sample limits.',
      changedBuddyAbsence: 'Snapshot-level facts accumulated across schedule and relevant queues, not per-encounter absence causes or elapsed seconds.',
    },
    actorIds: [...watchedIds],
    sampleLimit: boundedLimit,
    countsByActor: Object.fromEntries(watchedIds.map(actorId => [actorId, cloneSimple(counts.get(actorId))])),
    samplesByActor: Object.fromEntries(watchedIds.map(actorId => [actorId, cloneSimple(samples.get(actorId))])),
  });

  return Object.freeze({ observe, summary });
}
