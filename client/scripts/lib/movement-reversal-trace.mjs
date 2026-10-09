const ROTATION_REASON = 'team_rotate';
const EXPLICIT_RETREAT_REASONS = new Set(['flee:team_outnumbered', 'flee:team_power_gap']);
const CONTEXT_KINDS = new Set([
  'movement_goal', 'resource_replan', 'growth_plan', 'field_resource', 'gain', 'craft', 'objective',
  'spawn_state', 'endgame_zone', 'death', 'revive', 'dimension_rift_space', 'elimination', 'retreat', 'team_decision',
]);
const GLOBAL_WORLD_KINDS = new Set(['spawn_state', 'endgame_zone']);
const OBJECTIVE_FIELDS = ['type', 'subkind', 'targetZoneId', 'sourceIds', 'resourceKinds', 'beneficiary'];
const ASSESSMENT_FIELDS = ['allyCount', 'enemyCount', 'allyPower', 'enemyPower', 'powerRatio', 'shouldAvoid',
  'comparison', 'reason'];

const text = (value) => value == null ? '' : String(value);
const finiteNumber = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};
const eventSecond = (event) => finiteNumber(event?.at?.sec ?? event?.sec);
const actorIdOf = (row) => text(row?._id || row?.id || row?.who);
const eventActorId = (event) => text(event?.who || event?.actorId || '');
const eventTeamId = (event) => text(event?.teamId || '');
const safeLimit = (value, fallback, ceiling) => {
  if (value === undefined) return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(ceiling, Math.max(0, Math.floor(number))) : fallback;
};

function clone(value) {
  if (value === undefined) return undefined;
  return structuredClone(value);
}

function teamFor(event, initialTeams) {
  return eventTeamId(event) || initialTeams.get(eventActorId(event)) || '';
}

function objectiveSnapshot(move) {
  const objective = move?.movementObjective;
  if (!objective || typeof objective !== 'object') {
    const type = text(move?.objectiveType);
    const subkind = text(move?.objectiveSubkind);
    if (!type && !subkind) return null;
    return { type, subkind, targetZoneId: text(move?.targetZoneId), sourceIds: [], resourceKinds: [], beneficiary: null };
  }
  return Object.fromEntries(OBJECTIVE_FIELDS.map((field) => [field,
    field === 'sourceIds' || field === 'resourceKinds'
      ? [...new Set((Array.isArray(objective[field]) ? objective[field] : []).map(text))].sort()
      : field === 'beneficiary' ? (objective[field] ? clone(objective[field]) : null)
        : text(objective[field]),
  ]));
}

function comparableObjective(snapshot) {
  if (!snapshot) return null;
  return JSON.stringify({ type: snapshot.type, subkind: snapshot.subkind,
    sourceIds: snapshot.sourceIds, resourceKinds: snapshot.resourceKinds,
    beneficiary: snapshot.beneficiary });
}

function comparableSource(snapshot) {
  if (!snapshot?.sourceIds?.length) return null;
  return JSON.stringify({ type: snapshot.type, subkind: snapshot.subkind, sourceIds: snapshot.sourceIds });
}

function comparableBeneficiary(snapshot) {
  if (!snapshot?.beneficiary) return null;
  return JSON.stringify(Object.fromEntries(['who', 'targetItemId', 'materialId']
    .map((field) => [field, text(snapshot.beneficiary[field])])));
}

function eventSummary(event, seq, scope) {
  const result = { seq, at: clone(event?.at ?? (event?.sec !== undefined ? { sec: event.sec } : null)),
    kind: text(event?.kind), scope };
  for (const key of ['who', 'teamId', 'from', 'to', 'reason', 'sharedGoalReason', 'targetZoneId',
    'objectiveType', 'objectiveSubkind', 'subkind', 'itemId', 'qty', 'source', 'zoneId', 'remaining', 'initial',
    'depleted', 'blocked', 'targetId', 'targetName', 'openingComplete', 'method', 'by', 'paid', 'cost', 'success',
    'credits', 'encounterId', 'outcome', 'retreatOutcome', 'moved', 'leaderId', ...ASSESSMENT_FIELDS]) {
    if (event?.[key] !== undefined) result[key] = clone(event[key]);
  }
  for (const key of ['movementObjective', 'objective', 'previousObjective', 'missing', 'goalIssues', 'receipt',
    'forbiddenZoneIds', 'forbiddenAddedNow', 'teamAssessment', 'decisionEvidence']) {
    if (event?.[key] !== undefined) result[key] = clone(event[key]);
  }
  return result;
}

function sharedSourceMatch(event, objectives) {
  const otherActorObjective = text(event?.objective);
  const zoneId = text(event?.zoneId);
  const subkind = text(event?.subkind);
  for (const objective of objectives.filter(Boolean)) {
    // A hunt encounter receipt ID is not the spawned boss/source identity.
    const exactSourceId = text(event?.sourceId || event?.id);
    const exactSourceMatch = exactSourceId && objective.sourceIds?.includes(exactSourceId);
    const sameZone = zoneId && zoneId === text(objective.targetZoneId);
    if (event?.kind === 'objective' && otherActorObjective === objective.type
      && (exactSourceMatch || (sameZone && (!subkind || subkind === text(objective.subkind)
        || objective.resourceKinds?.includes(subkind))))) {
      return exactSourceMatch ? 'source_id' : 'zone_and_kind_only';
    }
    if (event?.kind === 'field_resource' && sameZone && objective.beneficiary?.materialId
      && text(event?.itemId) === text(objective.beneficiary.materialId)) return 'zone_and_material';
  }
  return '';
}

function classifyScope(event, actorId, teamId, initialTeams, objectives) {
  const kind = text(event?.kind);
  if (GLOBAL_WORLD_KINDS.has(kind) || kind.startsWith('endgame_') || kind.startsWith('spawn_')) return 'global_world';
  if (eventActorId(event) === actorId) return 'actor';
  const rowTeam = teamFor(event, initialTeams);
  if (teamId && rowTeam === teamId) return 'team';
  if (teamId && rowTeam && rowTeam !== teamId && sharedSourceMatch(event, objectives)) return 'shared_source_event';
  if (!eventActorId(event) && !eventTeamId(event)) return 'unattributed';
  return 'unattributed';
}

function pairTeamDecisions(indexedEvents, maxDistance) {
  const pairsByMoveSeq = new Map();
  const usedDecisionSeqs = new Set();
  const lifecycleKinds = new Set(['death', 'revive', 'dimension_rift_space']);
  const byActor = new Map();
  for (const row of indexedEvents) {
    const actorId = eventActorId(row.event);
    if (!actorId) continue;
    if (!byActor.has(actorId)) byActor.set(actorId, []);
    byActor.get(actorId).push(row);
  }
  for (const rows of byActor.values()) {
    for (let index = 0; index < rows.length; index += 1) {
      const { event: move, seq: moveSeq } = rows[index];
      if (move?.kind !== 'move') continue;
      const moveFrom = text(move?.from), moveTo = text(move?.to);
      const moveMoved = moveFrom !== moveTo;
      const moveSec = eventSecond(move);
      for (let nextIndex = index + 1; nextIndex < rows.length; nextIndex += 1) {
        const candidate = rows[nextIndex];
        const { event, seq } = candidate;
        if (seq - moveSeq > maxDistance || event?.kind === 'move' || lifecycleKinds.has(text(event?.kind))) break;
        if (usedDecisionSeqs.has(seq) || event?.kind !== 'team_decision') continue;
        const decisionSec = eventSecond(event);
        if (text(event?.from) !== moveFrom || text(event?.to) !== moveTo
          || Boolean(event?.moved) !== moveMoved
          || moveSec === null || decisionSec === null || decisionSec !== moveSec) continue;
        usedDecisionSeqs.add(seq);
        pairsByMoveSeq.set(moveSeq, candidate);
        break;
      }
    }
  }
  return pairsByMoveSeq;
}

function teamDecisionSummary(picked) {
  if (!picked) return null;
  const { event, seq } = picked;
  const assessment = Object.fromEntries(ASSESSMENT_FIELDS.filter((field) => Object.hasOwn(event, field))
    .map((field) => [field, clone(event[field])]));
  return {
    seq,
    at: clone(event?.at ?? (event?.sec !== undefined ? { sec: event.sec } : null)),
    reason: text(event?.reason),
    teamId: eventTeamId(event),
    leaderId: text(event?.leaderId),
    targetZoneId: text(event?.targetZoneId),
    sharedGoalReason: text(event?.sharedGoalReason),
    assessment: Object.keys(assessment).length ? assessment : null,
    teamAssessment: clone(event?.teamAssessment ?? null),
    decisionEvidence: clone(event?.decisionEvidence ?? null),
    retreatOutcome: text(event?.retreatOutcome),
    movementObjective: clone(event?.movementObjective ?? null),
  };
}

function boundedContext(indexedEvents, leftSeq, rightSeq, { actorId, teamId, initialTeams, maxContextEvents,
  previousMove, currentMove }) {
  const objectives = [objectiveSnapshot(previousMove), objectiveSnapshot(currentMove)];
  const candidates = indexedEvents.filter(({ event, seq }) => seq > leftSeq && seq < rightSeq
    && (CONTEXT_KINDS.has(text(event?.kind)) || text(event?.kind).startsWith('spawn_')
      || text(event?.kind).startsWith('endgame_')));
  const relevant = [], omittedByScope = {};
  let excludedUnrelatedCount = 0;
  for (const row of candidates) {
    const scope = classifyScope(row.event, actorId, teamId, initialTeams, objectives);
    if (scope === 'unattributed') { excludedUnrelatedCount += 1; continue; }
    const urgentRetreat = row.event?.kind === 'retreat'
      || (row.event?.kind === 'team_decision' && eventActorId(row.event) === actorId
        && (/retreat|cooldown|flee|recover/i.test(text(row.event?.reason))
          || Boolean(row.event?.retreatOutcome)));
    const priority = urgentRetreat ? 0 : scope === 'actor' ? 1 : scope === 'team' ? 2
      : scope === 'shared_source_event' ? 3 : 4;
    relevant.push({ ...row, scope, priority });
  }
  const selected = relevant.slice().sort((left, right) => left.priority - right.priority || left.seq - right.seq)
    .slice(0, maxContextEvents).sort((left, right) => left.seq - right.seq);
  for (const row of relevant) {
    if (!selected.includes(row)) {
      const key = row.scope;
      omittedByScope[key] = (Object.hasOwn(omittedByScope, key) ? omittedByScope[key] : 0) + 1;
    }
  }
  return {
    events: selected.map(({ event, seq, scope }) => ({ ...eventSummary(event, seq, scope),
      ...(scope === 'shared_source_event' ? { sharedSourceMatch: sharedSourceMatch(event, objectives) } : {}) })),
    meta: { candidateCount: relevant.length, returnedCount: selected.length,
      omittedCount: relevant.length - selected.length, omittedByScope,
      excludedUnrelatedCount, truncated: relevant.length > selected.length },
  };
}

function makeReversal(kind, previous, current, options) {
  const actorId = eventActorId(current.event);
  const teamId = eventTeamId(current.event) || eventTeamId(previous.event) || options.initialTeams.get(actorId) || '';
  const previousObjective = objectiveSnapshot(previous.event);
  const currentObjective = objectiveSnapshot(current.event);
  const previousTarget = text(previous.event?.targetZoneId);
  const currentTarget = text(current.event?.targetZoneId);
  const previousReason = text(previous.event?.sharedGoalReason);
  const currentReason = text(current.event?.sharedGoalReason);
  const currentPair = teamDecisionSummary(options.teamDecisionsByMoveSeq.get(current.seq));
  const previousPair = teamDecisionSummary(options.teamDecisionsByMoveSeq.get(previous.seq));
  const targetChanged = previousTarget && currentTarget ? previousTarget !== currentTarget : null;
  const previousObjectiveKey = comparableObjective(previousObjective);
  const currentObjectiveKey = comparableObjective(currentObjective);
  const objectiveChanged = previousObjectiveKey !== null && currentObjectiveKey !== null
    ? previousObjectiveKey !== currentObjectiveKey : null;
  const previousSource = comparableSource(previousObjective), currentSource = comparableSource(currentObjective);
  const sourceChanged = previousSource !== null && currentSource !== null ? previousSource !== currentSource : null;
  const previousBeneficiary = comparableBeneficiary(previousObjective), currentBeneficiary = comparableBeneficiary(currentObjective);
  const beneficiaryChanged = previousBeneficiary !== null && currentBeneficiary !== null
    ? previousBeneficiary !== currentBeneficiary : null;
  return {
    kind,
    actorId,
    teamId,
    previous: { seq: previous.seq, at: clone(previous.event?.at ?? (previous.event?.sec !== undefined ? { sec: previous.event.sec } : null)),
      from: text(previous.event?.from), to: text(previous.event?.to), reason: text(previous.event?.reason),
      sourceReason: previousReason, targetZoneId: previousTarget,
      objectiveType: text(previous.event?.objectiveType), objectiveSubkind: text(previous.event?.objectiveSubkind),
      movementObjective: clone(previous.event?.movementObjective ?? null),
      teamAssessment: clone(previous.event?.teamAssessment ?? null),
      decisionEvidence: clone(previous.event?.decisionEvidence ?? null),
      retreatOutcome: text(previous.event?.retreatOutcome), teamDecision: previousPair,
      teamDecisionPairStatus: previousPair ? 'matched_exact' : 'unmatched_or_insufficient_evidence' },
    current: { seq: current.seq, at: clone(current.event?.at ?? (current.event?.sec !== undefined ? { sec: current.event.sec } : null)),
      from: text(current.event?.from), to: text(current.event?.to), reason: text(current.event?.reason),
      sourceReason: currentReason, targetZoneId: currentTarget,
      objectiveType: text(current.event?.objectiveType), objectiveSubkind: text(current.event?.objectiveSubkind),
      movementObjective: clone(current.event?.movementObjective ?? null),
      teamAssessment: clone(current.event?.teamAssessment ?? null),
      decisionEvidence: clone(current.event?.decisionEvidence ?? null),
      retreatOutcome: text(current.event?.retreatOutcome), teamDecision: currentPair,
      teamDecisionPairStatus: currentPair ? 'matched_exact' : 'unmatched_or_insufficient_evidence' },
    observations: {
      targetChanged,
      sourceChanged,
      beneficiaryChanged,
      objectiveChanged,
      sourceReasonChanged: previousReason && currentReason ? previousReason !== currentReason : null,
      causeConfirmed: false,
      interpretation: 'observed_reversal_only',
    },
    ...(() => {
      const context = boundedContext(options.indexedEvents, previous.seq, current.seq,
        { ...options, actorId, teamId, previousMove: previous.event, currentMove: current.event });
      return { context: context.events, contextMeta: context.meta };
    })(),
  };
}

function emptyBucket() {
  return { total: 0, byActor: {}, byTeam: {}, byReason: {}, samples: [] };
}

function addCount(bucket, reversal, reason = '') {
  bucket.total += 1;
  const increment = (target, key) => {
    const value = (Object.hasOwn(target, key) ? target[key] : 0) + 1;
    Object.defineProperty(target, key, { value, enumerable: true, configurable: true, writable: true });
  };
  increment(bucket.byActor, reversal.actorId);
  if (reversal.teamId) increment(bucket.byTeam, reversal.teamId);
  if (reason) increment(bucket.byReason, reason);
}

/**
 * Trace same-actor reverse edges in an existing event stream. Event array order
 * is authoritative; timestamps are retained as evidence, never used to sort.
 * This helper is observation-only and does not invoke simulation code.
 */
export function summarizeMovementReversalTrace(initialActors = [], events = [], {
  maxContextEvents = 24,
  maxTeamDecisionDistance = 4,
  maxRotationSamples = 4,
  maxExplicitOutnumberedSamples = 4,
  maxExplicitPowerGapSamples = 2,
} = {}) {
  const indexedEvents = Array.from(events || [], (event, seq) => ({ event, seq }));
  const initialTeams = new Map((Array.isArray(initialActors) ? initialActors : [])
    .map((actor) => [actorIdOf(actor), text(actor?.teamId || '')]).filter(([id]) => id));
  const limits = {
    maxContextEvents: safeLimit(maxContextEvents, 24, 256),
    maxTeamDecisionDistance: safeLimit(maxTeamDecisionDistance, 4, 64),
    maxRotationSamples: safeLimit(maxRotationSamples, 4, 32),
  };
  const teamDecisionsByMoveSeq = pairTeamDecisions(indexedEvents, limits.maxTeamDecisionDistance);
  const rotation = emptyBucket();
  const explicitOutnumbered = emptyBucket();
  const explicitPowerGap = emptyBucket();
  const lastMoveByActor = new Map();
  const lifecycleKinds = new Set(['death', 'revive', 'dimension_rift_space']);

  for (const current of indexedEvents) {
    const { event, seq } = current;
    const actorId = eventActorId(event);
    if (lifecycleKinds.has(text(event?.kind))) {
      if (actorId) lastMoveByActor.delete(actorId);
      continue;
    }
    if (event?.kind !== 'move' || !actorId) continue;
    const from = text(event?.from), to = text(event?.to);
    if (!from || !to || from === to) continue;

    const previous = lastMoveByActor.get(actorId);
    if (previous && text(previous.event?.to) === from && text(previous.event?.from) === to) {
      const previousReason = text(previous.event?.reason);
      const reason = text(event?.reason);
      const traceOptions = { ...limits, initialTeams, indexedEvents, teamDecisionsByMoveSeq };
      if (previousReason === ROTATION_REASON && reason === ROTATION_REASON) {
        const identity = { actorId, teamId: eventTeamId(event) || eventTeamId(previous.event) || initialTeams.get(actorId) || '' };
        addCount(rotation, identity);
        if (rotation.samples.length < limits.maxRotationSamples) {
          rotation.samples.push(makeReversal('team_rotate', previous, current, traceOptions));
        }
      } else if (EXPLICIT_RETREAT_REASONS.has(previousReason) && EXPLICIT_RETREAT_REASONS.has(reason)) {
        const identity = { actorId, teamId: eventTeamId(event) || eventTeamId(previous.event) || initialTeams.get(actorId) || '' };
        const bucket = reason === 'flee:team_outnumbered' || previousReason === 'flee:team_outnumbered'
          ? explicitOutnumbered : explicitPowerGap;
        addCount(bucket, identity, `${previousReason}->${reason}`);
        const sampleLimit = bucket === explicitOutnumbered
          ? safeLimit(maxExplicitOutnumberedSamples, 4, 32)
          : safeLimit(maxExplicitPowerGapSamples, 2, 32);
        if (bucket.samples.length < sampleLimit) {
          bucket.samples.push(makeReversal('explicit_team_retreat', previous, current, traceOptions));
        }
      }
    }
    // Ignore same-zone moves, matching movement summaries that count only real
    // edges. A from/to discontinuity remains the new continuity point.
    lastMoveByActor.set(actorId, current);
  }

  return {
    order: 'input_event_insertion_order',
    counts: { teamRotate: rotation, explicitOutnumbered, explicitPowerGap },
    interpretation: 'Counts describe observed same-actor reverse edges; they do not establish a bug or its cause.',
  };
}
