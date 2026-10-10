const HARD_MAX_STEPS = 512;
const HARD_MAX_RELATED_ACTORS = 128;
const HARD_MAX_EVENT_SAMPLES = 4096;
const HARD_MAX_ISSUES = 128;

const finiteOrNull = value => value === null || value === undefined || value === ''
  ? null : Number.isFinite(Number(value)) ? Number(value) : null;
const idOf = value => String(value ?? '').trim();
const clonePoint = value => value && Number.isFinite(Number(value.x)) && Number.isFinite(Number(value.y))
  ? { x: Number(value.x), y: Number(value.y) } : null;

function clampLimit(value, fallback, maximum) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(0, Math.min(maximum, Math.floor(number)));
}

function compactActor(actor) {
  if (!actor || typeof actor !== 'object') return null;
  const intentTargetId = idOf(actor.intentTargetId || actor.combatIntent?.targetId);
  const spatialMotion = actor.spatialMotion && typeof actor.spatialMotion === 'object'
    ? { reason: idOf(actor.spatialMotion.reason), targetId: idOf(actor.spatialMotion.targetId),
      x: finiteOrNull(actor.spatialMotion.x), y: finiteOrNull(actor.spatialMotion.y),
      stopRange: finiteOrNull(actor.spatialMotion.stopRange) } : null;
  const spatialLastSeen = actor.spatialLastSeen && typeof actor.spatialLastSeen === 'object'
    ? { targetId: idOf(actor.spatialLastSeen.targetId), x: finiteOrNull(actor.spatialLastSeen.x),
      y: finiteOrNull(actor.spatialLastSeen.y), seenAtSec: finiteOrNull(actor.spatialLastSeen.seenAtSec) } : null;
  return {
    actorId: idOf(actor.actorId || actor._id || actor.id),
    teamId: idOf(actor.teamId), zoneId: idOf(actor.zoneId), combatSpaceId: idOf(actor.combatSpaceId),
    hp: finiteOrNull(actor.hp), maxHp: finiteOrNull(actor.maxHp),
    deadInThisPhase: actor.deadInThisPhase === true, riftDefeated: actor.riftDefeated === true,
    spatial: clonePoint(actor.spatial),
    intent: actor.hasCombatIntent === true || actor.combatIntent || intentTargetId
      ? { active: actor.hasCombatIntent === true || Boolean(actor.combatIntent || intentTargetId),
        enemyTeamId: idOf(actor.intentEnemyTeamId || actor.combatIntent?.enemyTeamId), targetId: intentTargetId,
        zoneId: idOf(actor.intentZoneId || actor.combatIntent?.zoneId),
        combatSpaceId: idOf(actor.intentCombatSpaceId || actor.combatIntent?.combatSpaceId) }
      : null,
    spatialMotion, spatialLastSeen,
    actionReadyAtSec: finiteOrNull(actor.actionReadyAtSec), basicAttackReadyAtSec: finiteOrNull(actor.basicAttackReadyAtSec),
    recoveryUntilSec: finiteOrNull(actor.recoveryUntilSec), recoveryReason: idOf(actor.recoveryReason),
    pendingCast: actor.pendingCast && typeof actor.pendingCast === 'object'
      ? { targetId: idOf(actor.pendingCast.targetId), releaseAtSec: finiteOrNull(actor.pendingCast.releaseAtSec) } : null,
    attackRange: finiteOrNull(actor.attackRange), sightRange: finiteOrNull(actor.sightRange),
    moveSpeed: finiteOrNull(actor.moveSpeed),
    basicAllowed: actor.basicAllowed === true, moveAllowed: actor.moveAllowed === true,
    actionBlocked: actor.actionBlocked === true,
  };
}

function compactEvent(event, eventIndex, window) {
  const fields = ['kind', 'who', 'targetId', 'by', 'victimId', 'killerId', 'ownerId', 'actorId',
    'causeName', 'cause', 'type', 'skill', 'castId', 'blockedReason', 'reason', 'damage', 'hpDamage',
    'hpBefore', 'hpAfter', 'maxHpBefore', 'maxHpAfter', 'absorbed', 'zoneId', 'combatSpaceId',
    'encounterId', 'outcome', 'atSec'];
  const output = { eventIndex, window };
  for (const key of fields) {
    if (!Object.hasOwn(event, key)) continue;
    const value = event[key];
    if (value == null || ['string', 'number', 'boolean'].includes(typeof value)) output[key] = value;
  }
  if (event.at && Number.isFinite(Number(event.at.sec))) output.at = { sec: Number(event.at.sec) };
  return output;
}

function freshDirectionCounts() {
  return { events: 0, positiveHpReceipts: 0, zeroBlocked: 0, zeroAbsorbed: 0, zeroOther: 0,
    invalidHpReceipts: 0, hpDamage: 0, teamStrikes: 0 };
}

function classifyDamage(event) {
  const hpDamage = finiteOrNull(event.hpDamage);
  const hpBefore = finiteOrNull(event.hpBefore);
  const hpAfter = finiteOrNull(event.hpAfter);
  if (hpDamage === null || hpBefore === null || hpAfter === null) return { bucket: 'invalidHpReceipts', hpDamage: 0 };
  const delta = hpBefore - hpAfter;
  if (hpDamage > 0 && delta > 0 && Math.abs(delta - hpDamage) <= 1e-6) {
    return { bucket: 'positiveHpReceipts', hpDamage };
  }
  if (hpDamage === 0 && delta === 0 && idOf(event.blockedReason)) return { bucket: 'zeroBlocked', hpDamage: 0 };
  if (hpDamage === 0 && delta === 0 && Number(event.absorbed) > 0) return { bucket: 'zeroAbsorbed', hpDamage: 0 };
  if (hpDamage === 0 && delta === 0) return { bucket: 'zeroOther', hpDamage: 0 };
  return { bucket: 'invalidHpReceipts', hpDamage: 0 };
}

export function createWorldStepContactDiagnostics({ actorIds = [], fromSec, toSec, maxSteps = 256,
  maxRelatedActors = 64, maxEventSamples = 256 } = {}) {
  const windowStart = Number(fromSec);
  const windowEnd = Number(toSec);
  if (!Number.isFinite(windowStart) || !Number.isFinite(windowEnd) || windowEnd < windowStart) {
    throw new TypeError('fromSec and toSec must be finite and ordered.');
  }

  const stepLimit = clampLimit(maxSteps, 256, HARD_MAX_STEPS);
  const actorLimit = clampLimit(maxRelatedActors, 64, HARD_MAX_RELATED_ACTORS);
  const eventLimit = clampLimit(maxEventSamples, 256, HARD_MAX_EVENT_SAMPLES);
  const suppliedIds = Array.isArray(actorIds) ? actorIds.map(idOf).filter(Boolean) : [];
  const uniqueIds = [...new Set(suppliedIds)];
  const watchedIds = uniqueIds.slice(0, actorLimit);
  const inputActorIdsTruncated = uniqueIds.length > watchedIds.length;
  const enabled = watchedIds.length > 0;
  const watchedSet = new Set(watchedIds);

  const counters = {
    observations: 0, ignoredStages: 0, invalidSnapshots: 0, beforeSnapshots: 0, afterSnapshots: 0,
    matchedPairs: 0, outsideWindowPairs: 0, retainedPairs: 0,
    duplicateBefore: 0, duplicateAfter: 0, mismatchedAfter: 0, unmatchedBefore: 0, orphanAfter: 0,
    cursorReversals: 0, cursorInvalid: 0, cursorOutOfRange: 0, timeReversals: 0, timeInvalid: 0,
    stepHistoryEvictions: 0, actorFactsTruncated: 0, relatedActorLimitOmissions: 0,
    missingRelatedActorOccurrences: 0, snapshotTruncated: 0,
    stepSamplesTruncated: 0, eventSamplesTruncated: 0, invalidEventWindows: 0, issueSamplesTruncated: 0,
  };
  const issues = [];
  const stepSamples = [];
  const eventWindows = [];
  const stepHistory = new Map();
  const historyCap = Math.max(32, Math.min(1024, stepLimit * 2 || 32));
  let pendingBefore = null;
  let previousComplete = null;
  let lastCursor = null;
  let lastSnapshotTime = null;

  const issue = (code, details = {}) => {
    if (issues.length < HARD_MAX_ISSUES) issues.push({ code, ...details });
    else counters.issueSamplesTruncated += 1;
  };
  const rememberStepId = (stepId, stage) => {
    if (!stepHistory.has(stepId) && stepHistory.size >= historyCap) {
      const oldest = stepHistory.keys().next().value;
      stepHistory.delete(oldest);
      counters.stepHistoryEvictions += 1;
    }
    stepHistory.set(stepId, stage);
  };

  function captureActors(snapshot) {
    const rows = Array.isArray(snapshot.actors) ? snapshot.actors : [];
    const byId = new Map(rows.map(row => [idOf(row?.actorId || row?._id || row?.id), row]).filter(([id]) => id));
    const selectedIds = new Set();
    const referencedIds = new Set();
    for (const id of watchedIds) selectedIds.add(id);

    for (const id of watchedIds) {
      const actor = byId.get(id);
      for (const targetId of [actor?.intentTargetId, actor?.combatIntent?.targetId,
        actor?.spatialMotion?.targetId, actor?.spatialLastSeen?.targetId, actor?.pendingCast?.targetId]) {
        if (idOf(targetId)) {
          const referenceId = idOf(targetId);
          selectedIds.add(referenceId);
          if (!watchedSet.has(referenceId)) referencedIds.add(referenceId);
        }
      }
    }
    for (const id of [snapshot.scheduled?.actorId, snapshot.scheduled?.targetId, snapshot.initiatorId,
      snapshot.targetId, snapshot.onlyActorId]) {
      if (!idOf(id)) continue;
      const referenceId = idOf(id);
      selectedIds.add(referenceId);
      if (!watchedSet.has(referenceId)) referencedIds.add(referenceId);
    }

    const watchedActors = watchedIds.map(id => byId.get(id)).filter(Boolean);
    const relatedRows = rows.filter(row => {
      if (!row) return false;
      const rowZone = idOf(row.zoneId);
      const rowSpace = idOf(row.combatSpaceId);
      return watchedActors.some(actor => idOf(actor.zoneId) === rowZone && idOf(actor.combatSpaceId) === rowSpace);
    });
    for (const row of relatedRows) {
      const id = idOf(row.actorId || row._id || row.id);
      if (id) selectedIds.add(id);
    }

    const prioritized = [...watchedIds];
    for (const id of selectedIds) if (!watchedSet.has(id) && !prioritized.includes(id)) prioritized.push(id);
    const retainedIds = prioritized.slice(0, actorLimit);
    const retainedSet = new Set(retainedIds);
    const actorRows = rows.filter(row => retainedSet.has(idOf(row?.actorId || row?._id || row?.id)))
      .map(compactActor).filter(Boolean).sort((a, b) => a.actorId.localeCompare(b.actorId));
    const sourceActorListTruncated = snapshot.truncated === true || snapshot.actorCandidatesTruncated === true;
    const absentActorIds = watchedIds.filter(id => !byId.has(id));
    const absentRelatedActorIds = [...referencedIds].filter(id => !byId.has(id)).sort();
    const missingActorIds = sourceActorListTruncated ? [] : absentActorIds;
    const unknownActorIds = sourceActorListTruncated ? absentActorIds : [];
    const missingRelatedActorIds = sourceActorListTruncated ? [] : absentRelatedActorIds;
    const unknownRelatedActorIds = sourceActorListTruncated ? absentRelatedActorIds : [];
    const omittedActorIds = prioritized.filter(id => byId.has(id) && !retainedSet.has(id)).sort();
    const omittedRelatedActorIds = [...referencedIds].filter(id => byId.has(id) && !retainedSet.has(id)).sort();
    return { actors: actorRows, missingActorIds, unknownActorIds, missingRelatedActorIds,
      unknownRelatedActorIds, omittedActorIds, omittedRelatedActorIds,
      sourceActorListTruncated, truncated: omittedActorIds.length > 0 || sourceActorListTruncated,
      omittedActorCount: omittedActorIds.length };
  }

  function validateCursor(eventCursor, nowSec) {
    if (!Number.isSafeInteger(eventCursor) || eventCursor < 0) {
      counters.cursorInvalid += 1;
      issue('invalid_event_cursor', { eventCursor: Number.isFinite(Number(eventCursor)) ? Number(eventCursor) : null });
      return false;
    }
    let valid = true;
    if (lastCursor !== null && eventCursor < lastCursor) {
      counters.cursorReversals += 1;
      issue('event_cursor_reversed', { previous: lastCursor, current: eventCursor });
      valid = false;
    }
    if (lastSnapshotTime !== null && nowSec < lastSnapshotTime) {
      counters.timeReversals += 1;
      issue('snapshot_time_reversed', { previous: lastSnapshotTime, current: nowSec });
      valid = false;
    }
    if (lastCursor === null || eventCursor >= lastCursor) lastCursor = eventCursor;
    if (lastSnapshotTime === null || nowSec >= lastSnapshotTime) lastSnapshotTime = nowSec;
    return valid;
  }

  const validStep = snapshot => {
    const step = snapshot?.worldStep;
    if (!step || !['elapsed', 'growth'].includes(String(step.kind || ''))
      || step.stepId === undefined || step.stepId === null || !String(step.stepId).trim()) return null;
    const from = Number(step.fromSec);
    const to = Number(step.toSec);
    const now = Number(snapshot.nowSec);
    if (![from, to, now].every(Number.isFinite)) return null;
    return { stepId: String(step.stepId), kind: String(step.kind), fromSec: from, toSec: to, nowSec: now };
  };

  function observe(snapshot, { eventCursor } = {}) {
    if (!enabled) return;
    counters.observations += 1;
    if (!snapshot || typeof snapshot !== 'object') {
      counters.invalidSnapshots += 1; issue('invalid_snapshot'); return;
    }
    const stage = String(snapshot.stage || '');
    if (stage !== 'world_step_before' && stage !== 'world_step_after') {
      counters.ignoredStages += 1; return;
    }
    const tuple = validStep(snapshot);
    if (!tuple) {
      counters.invalidSnapshots += 1; issue('invalid_world_step', { stage });
      if (stage === 'world_step_before' && pendingBefore) {
        counters.unmatchedBefore += 1;
        issue('before_replaced_by_invalid_before', { stepId: pendingBefore.stepId });
        pendingBefore = null;
      }
      return;
    }
    const cursorValid = validateCursor(eventCursor, tuple.nowSec);
    if (!cursorValid) {
      if (pendingBefore) {
        counters.unmatchedBefore += 1;
        issue('before_discarded_after_invalid_observation', { stepId: pendingBefore.stepId });
        pendingBefore = null;
      }
      return;
    }
    if (tuple.nowSec !== (stage === 'world_step_before' ? tuple.fromSec : tuple.toSec)
      || tuple.toSec < tuple.fromSec) {
      counters.timeInvalid += 1;
      issue('world_step_time_mismatch', { stage, stepId: tuple.stepId, fromSec: tuple.fromSec,
        toSec: tuple.toSec, nowSec: tuple.nowSec });
      if (pendingBefore) {
        counters.unmatchedBefore += 1;
        issue('before_discarded_after_time_mismatch', { stepId: pendingBefore.stepId });
        pendingBefore = null;
      }
      return;
    }

    if (stage === 'world_step_before') {
      counters.beforeSnapshots += 1;
      if (stepHistory.has(tuple.stepId)) {
        counters.duplicateBefore += 1;
        issue('duplicate_step_id', { stage, stepId: tuple.stepId });
      }
      if (pendingBefore) {
        counters.unmatchedBefore += 1;
        issue('unmatched_before_replaced', { stepId: pendingBefore.stepId, replacedBy: tuple.stepId });
      }
      if (previousComplete && tuple.fromSec < previousComplete.toSec) {
        counters.timeReversals += 1;
        issue('world_step_start_reversed', { previousToSec: previousComplete.toSec, fromSec: tuple.fromSec,
          stepId: tuple.stepId });
        pendingBefore = null;
        return;
      }
      rememberStepId(tuple.stepId, 'before');
      pendingBefore = { ...tuple, eventCursor, actorFacts: captureActors(snapshot), scheduled: snapshot.scheduled
        ? { actorId: idOf(snapshot.scheduled.actorId), targetId: idOf(snapshot.scheduled.targetId),
          actionType: idOf(snapshot.scheduled.actionType), atSec: finiteOrNull(snapshot.scheduled.atSec) } : null };
      return;
    }

    counters.afterSnapshots += 1;
    if (stepHistory.has(tuple.stepId) && stepHistory.get(tuple.stepId) === 'closed') {
      counters.duplicateAfter += 1;
      issue('duplicate_step_after', { stepId: tuple.stepId });
      return;
    }
    if (!pendingBefore) {
      counters.orphanAfter += 1;
      issue('after_without_before', { stepId: tuple.stepId });
      return;
    }
    const before = pendingBefore;
    if (tuple.stepId !== before.stepId || tuple.kind !== before.kind
      || tuple.fromSec !== before.fromSec || tuple.toSec !== before.toSec) {
      counters.mismatchedAfter += 1;
      issue('mismatched_after', { expected: { stepId: before.stepId, kind: before.kind,
        fromSec: before.fromSec, toSec: before.toSec }, actual: { stepId: tuple.stepId, kind: tuple.kind,
        fromSec: tuple.fromSec, toSec: tuple.toSec } });
      return;
    }
    if (eventCursor < before.eventCursor) {
      counters.cursorReversals += 1;
      issue('pair_event_cursor_reversed', { stepId: tuple.stepId, before: before.eventCursor, after: eventCursor });
      pendingBefore = null;
      return;
    }
    if (previousComplete && tuple.toSec < previousComplete.toSec) {
      counters.timeReversals += 1;
      issue('world_step_end_reversed', { previousToSec: previousComplete.toSec, toSec: tuple.toSec,
        stepId: tuple.stepId });
      pendingBefore = null;
      return;
    }

    pendingBefore = null;
    rememberStepId(tuple.stepId, 'closed');
    counters.matchedPairs += 1;
    const previous = previousComplete;
    previousComplete = { stepId: tuple.stepId, toSec: tuple.toSec, eventCursor };
    const overlapsWindow = tuple.toSec >= windowStart && tuple.fromSec <= windowEnd;
    if (!overlapsWindow) {
      counters.outsideWindowPairs += 1;
      return;
    }
    if (stepSamples.length >= stepLimit) {
      counters.stepSamplesTruncated += 1;
      return;
    }

    const afterFacts = captureActors(snapshot);
    counters.actorFactsTruncated += before.actorFacts.omittedActorCount + afterFacts.omittedActorCount;
    counters.relatedActorLimitOmissions += before.actorFacts.omittedRelatedActorIds.length
      + afterFacts.omittedRelatedActorIds.length;
    counters.missingRelatedActorOccurrences += before.actorFacts.missingRelatedActorIds.length
      + afterFacts.missingRelatedActorIds.length;
    if (before.actorFacts.truncated || afterFacts.truncated) counters.snapshotTruncated += 1;
    const intersection = { fromSec: Math.max(windowStart, tuple.fromSec), toSec: Math.min(windowEnd, tuple.toSec) };
    const windows = [];
    if (previous && previous.eventCursor <= before.eventCursor) {
      windows.push({ kind: 'between_pairs', fromInclusive: previous.eventCursor,
        toExclusive: before.eventCursor, previousStepId: previous.stepId, stepId: tuple.stepId,
        fromSec: previous.toSec, toSec: tuple.fromSec });
    } else if (previous && previous.eventCursor > before.eventCursor) {
      counters.invalidEventWindows += 1;
      issue('between_pair_cursor_reversed', { previous: previous.eventCursor, current: before.eventCursor,
        stepId: tuple.stepId });
    }
    windows.push({ kind: 'world_step', fromInclusive: before.eventCursor, toExclusive: eventCursor,
      stepId: tuple.stepId, fromSec: tuple.fromSec, toSec: tuple.toSec });
    eventWindows.push(...windows);

    const beforeById = new Map(before.actorFacts.actors.map(actor => [actor.actorId, actor]));
    const afterById = new Map(afterFacts.actors.map(actor => [actor.actorId, actor]));
    const comparisonIds = [...new Set([...watchedIds, ...beforeById.keys(), ...afterById.keys()])];
    const actorChanges = comparisonIds.map(actorId => ({ actorId,
      before: beforeById.get(actorId) || null, after: afterById.get(actorId) || null }))
      .filter(row => row.before || row.after);
    stepSamples.push({ stepId: tuple.stepId, kind: tuple.kind, fromSec: tuple.fromSec, toSec: tuple.toSec,
      intersection, beforeCursor: before.eventCursor, afterCursor: eventCursor,
      gapEventWindow: windows.find(row => row.kind === 'between_pairs') || null,
      pairEventWindow: windows.find(row => row.kind === 'world_step') || null,
      scheduled: before.scheduled,
      beforeMissingActorIds: before.actorFacts.missingActorIds, afterMissingActorIds: afterFacts.missingActorIds,
      beforeUnknownActorIds: before.actorFacts.unknownActorIds, afterUnknownActorIds: afterFacts.unknownActorIds,
      beforeMissingRelatedActorIds: before.actorFacts.missingRelatedActorIds,
      afterMissingRelatedActorIds: afterFacts.missingRelatedActorIds,
      beforeUnknownRelatedActorIds: before.actorFacts.unknownRelatedActorIds,
      afterUnknownRelatedActorIds: afterFacts.unknownRelatedActorIds,
      beforeOmittedActorIds: before.actorFacts.omittedActorIds,
      afterOmittedActorIds: afterFacts.omittedActorIds,
      beforeOmittedRelatedActorIds: before.actorFacts.omittedRelatedActorIds,
      afterOmittedRelatedActorIds: afterFacts.omittedRelatedActorIds,
      relatedActorTruncated: before.actorFacts.truncated || afterFacts.truncated,
      omittedActorCount: before.actorFacts.omittedActorCount + afterFacts.omittedActorCount,
      actors: actorChanges });
    counters.retainedPairs += 1;
  }

  function summary(events) {
    if (!Array.isArray(events)) throw new TypeError('summary(events) requires this run’s actual event array.');
    const sourceEvents = events;
    const summaryCounters = { ...counters };
    const summaryIssues = issues.map(row => structuredClone(row));
    let summaryIssueSamplesTruncated = counters.issueSamplesTruncated;
    const summaryIssue = (code, details = {}) => {
      if (summaryIssues.length < HARD_MAX_ISSUES) summaryIssues.push({ code, ...details });
      else summaryIssueSamplesTruncated += 1;
    };
    const directionCounts = Object.fromEntries(watchedIds.map(id => [id, { sent: freshDirectionCounts(),
      received: freshDirectionCounts() }]));
    const eventSamples = [];
    const seenEventIndexes = new Set();
    let eventSamplesOmitted = 0;
    let invalidEventIndexes = 0;
    let invalidSummaryEventWindows = 0;
    let cursorOutOfRange = 0;

    for (const window of eventWindows) {
      const from = window.fromInclusive;
      const to = window.toExclusive;
      if (!Number.isSafeInteger(from) || !Number.isSafeInteger(to) || from < 0 || to < from) {
        invalidSummaryEventWindows += 1;
        summaryIssue('invalid_event_window', { kind: window.kind, stepId: window.stepId, fromInclusive: from, toExclusive: to });
        continue;
      }
      if (to > sourceEvents.length) {
        cursorOutOfRange += 1;
        summaryIssue('event_cursor_exceeds_supplied_events', { kind: window.kind, stepId: window.stepId,
          toExclusive: to, actualEventCount: sourceEvents.length });
      }
      const boundedTo = Math.min(to, sourceEvents.length);
      for (let eventIndex = from; eventIndex < boundedTo; eventIndex += 1) {
        const event = sourceEvents[eventIndex];
        if (!event || typeof event !== 'object') { invalidEventIndexes += 1; continue; }
        const senderId = idOf(event.who);
        const recipientId = idOf(event.targetId);
        const byRelatedIds = watchedIds.filter(id => id === idOf(event.by) || id === idOf(event.killerId));
        const senders = watchedIds.filter(id => id === senderId);
        const recipients = watchedIds.filter(id => id === recipientId);
        if (!senders.length && !recipients.length && !byRelatedIds.length) continue;
        if (seenEventIndexes.has(eventIndex)) continue;
        seenEventIndexes.add(eventIndex);
        for (const id of senders) tally(directionCounts[id].sent, event);
        for (const id of recipients) tally(directionCounts[id].received, event);
        if (eventSamples.length < eventLimit) {
          eventSamples.push({ ...compactEvent(event, eventIndex, window.kind), stepId: window.stepId,
            senderWatchedIds: senders, recipientWatchedIds: recipients, relatedByWatchedIds: byRelatedIds });
        } else eventSamplesOmitted += 1;
      }
    }
    const hasPendingBefore = Boolean(pendingBefore);
    if (hasPendingBefore) {
      summaryCounters.unmatchedBefore += 1;
      summaryIssue('unfinished_before_at_summary', { stepId: pendingBefore.stepId });
    }
    summaryCounters.invalidEventWindows += invalidSummaryEventWindows;
    summaryCounters.cursorOutOfRange += cursorOutOfRange;
    summaryCounters.eventSamplesTruncated += eventSamplesOmitted;
    summaryCounters.issueSamplesTruncated = summaryIssueSamplesTruncated;
    return {
      schema: 'eternal-hunger.world-step-contact-diagnostics.v1',
      enabled, actorIds: [...watchedIds], actorIdsTruncated: inputActorIdsTruncated,
      window: { fromSec: windowStart, toSec: windowEnd },
      limits: { maxSteps: stepLimit, maxRelatedActors: actorLimit, maxEventSamples: eventLimit,
        issueSamples: HARD_MAX_ISSUES },
      counts: summaryCounters,
      truncation: { steps: summaryCounters.stepSamplesTruncated > 0,
        relatedActors: summaryCounters.actorFactsTruncated > 0 || inputActorIdsTruncated,
        snapshots: summaryCounters.snapshotTruncated > 0, eventSamples: eventSamplesOmitted > 0,
        stepHistory: summaryCounters.stepHistoryEvictions > 0,
        issueList: summaryIssueSamplesTruncated > 0 },
      unmatchedBeforeAtEnd: hasPendingBefore,
      unmatchedStepIds: hasPendingBefore ? [pendingBefore.stepId] : [],
      steps: stepSamples.map(row => structuredClone(row)),
      eventSamples: eventSamples.map(row => structuredClone(row)),
      eventCounts: Object.fromEntries(Object.entries(directionCounts).map(([id, value]) => [id, {
        sent: { ...value.sent }, received: { ...value.received },
      }])),
      counterSemantics: {
        actorPresence: 'before/afterMissingActorIds and before/afterMissingRelatedActorIds are absent from an actor list declared complete; related absences may reflect death, departure, or stale references and are not product-defect counts. UnknownActorIds/UnknownRelatedActorIds are absent from a source-truncated list and cannot be called absent from the source. OmittedActorIds/OmittedRelatedActorIds were present in the supplied list but excluded by this collector retention cap. These categories are distinct.',
        sentReceivedEvents: 'sent.events counts only event rows whose who equals the watched actor; received.events counts only rows whose targetId equals it. by/victimId/killerId links are sample-only and never increment either direction.',
        hpReceipts: 'HP receipt counts and hpDamage are computed only from kind=damage records with consistent hpBefore, hpAfter, and hpDamage. Team-strike rows are counted separately and do not add HP receipts.',
        teamStrikes: 'team_strike is a separate event count; participants or team membership are never treated as an individual damage sender.',
      },
      suppliedEventCount: sourceEvents.length,
      invalidEventIndexes,
      eventSamplesOmitted,
      issues: summaryIssues,
    };
  }

  return { observe, summary };
}

function tally(counts, event) {
  counts.events += 1;
  if (event.kind === 'damage') {
    const result = classifyDamage(event);
    counts[result.bucket] += 1;
    counts.hpDamage += result.hpDamage;
    return;
  }
  if (event.kind === 'team_strike') {
    counts.teamStrikes += 1;
  }
}
