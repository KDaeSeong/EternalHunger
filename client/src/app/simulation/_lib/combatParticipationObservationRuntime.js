import { canBasicAttackByStatus, canMoveByStatus, hasActionBlockStatus } from '../../../utils/statusLogic.js';
import { getCombatSpaceId, WORLD_COMBAT_SPACE } from '../../../utils/combatSpaceLogic.js';
import { isDimensionRiftDefeated } from '../../../utils/dimensionRiftDefeatLogic.js';
import { getActorTeamId } from './teamRuntime.js';
import { getSpatialPosition, getSpatialStats, getSpatialLastSeen } from './combatSpatialRuntime.js';

const idOf = actor => String(actor?._id || actor?.id || '');
const finite = value => Number.isFinite(Number(value)) ? Number(value) : 0;
const owned = value => {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(owned);
    Object.freeze(value);
  }
  return value;
};

// Optional headless diagnostics only. No live actor, event, item or skill graph
// escapes this boundary, and observing never reserves an action or draws RNG.
// A schedule snapshot is not an executed attack, nor proof of a missed turn.
export function observeCombatParticipation(observer, { stage, nowSec = 0, roster = [], newDeadIds = [],
  wildlifeAssistIds = new Map(), scheduled = null, actor = null, target = null, onlyActorId = '',
  sides = [], participants = [], arbitration = null, resolution = null, actorCandidates = [], worldStep = null } = {}) {
  if (typeof observer !== 'function') return;
  try {
  const deadIds = new Set(newDeadIds.map(String));
  const rows = Array.isArray(roster) ? roster : [];
  const snapshot = {
    stage, nowSec: finite(nowSec),
    scope: 'Read-only candidates, arbitration, shared-world before/after and actual team resolution facts; not missed-turn or survival causality acceptance.',
    truncated: rows.length > 512,
    actorCandidatesTruncated: actorCandidates.length > 512 || stage === 'actor_schedule' && rows.length > 512,
    actorCandidates: actorCandidates.slice(0, 512).map(row => ({ actorId: String(row.actorId || ''), branch: String(row.branch || ''),
      candidate: row.candidate ? { actorId: String(row.candidate.actorId || ''), targetId: String(row.candidate.targetId || ''),
        actionType: String(row.candidate.actionType || ''), atSec: finite(row.candidate.atSec) } : null,
      opponentCount: finite(row.opponentCount), nearestTargetId: String(row.nearestTargetId || ''),
      nearestDistance: Number.isFinite(row.nearestDistance) ? row.nearestDistance : null,
      attackRange: Number.isFinite(row.attackRange) ? row.attackRange : null, motionReason: String(row.motionReason || '') })),
    worldStep: worldStep ? { fromSec: finite(worldStep.fromSec), toSec: finite(worldStep.toSec),
      decisionSec: finite(worldStep.decisionSec),
      ...(typeof worldStep.stepId === 'string' ? { stepId: worldStep.stepId } : {}),
      ...(typeof worldStep.kind === 'string' ? { kind: worldStep.kind } : {}) } : null,
    scheduled: scheduled ? { actorId: String(scheduled.actorId || ''), targetId: String(scheduled.targetId || ''),
      actionType: String(scheduled.actionType || ''), atSec: finite(scheduled.atSec) } : null,
    initiatorId: idOf(actor), targetId: idOf(target), onlyActorId: String(onlyActorId || ''),
    arbitration: arbitration ? {
      selectedScheduler: String(arbitration.selectedScheduler || ''),
      selectedActorId: String(arbitration.selectedActorId || ''),
      selectedActionType: String(arbitration.selectedActionType || ''),
      selectedAtSec: finite(arbitration.selectedAtSec), decisionSec: finite(arbitration.decisionSec),
      scheduled: arbitration.scheduled === true,
    } : null,
    resolution: resolution ? {
      actorId: String(resolution.actorId || ''), targetId: String(resolution.targetId || ''),
      encounterId: String(resolution.encounterId || ''), outcome: String(resolution.outcome || ''),
      hpBefore: Number.isFinite(resolution.hpBefore) ? resolution.hpBefore : null,
      hpAfter: Number.isFinite(resolution.hpAfter) ? resolution.hpAfter : null,
      hpDamage: Number.isFinite(resolution.hpDamage) ? resolution.hpDamage : null,
    } : null,
    sides: sides.map(side => side.map(idOf)), participants: participants.map(idOf),
    actors: rows.slice(0, 512).map(row => {
      const point = getSpatialPosition(row);
      const stats = getSpatialStats(row);
      const seen = getSpatialLastSeen(row);
      return { actorId: idOf(row), teamId: getActorTeamId(row), zoneId: String(row?.zoneId || ''),
        combatSpaceId: getCombatSpaceId(row), hp: finite(row?.hp), maxHp: finite(row?.maxHp),
        deadInThisPhase: deadIds.has(idOf(row)),
        actionReadyAtSec: finite(row?._actionReadyAtSec), basicAttackReadyAtSec: finite(row?._basicAttackReadyAtSec),
        recoveryUntilSec: finite(row?._recentCombatUntil), recoveryReason: String(row?._recentCombatReason || ''),
        pendingCast: row?._pendingCharacterCast ? { targetId: String(row._pendingCharacterCast.targetId || ''),
          releaseAtSec: finite(row._pendingCharacterCast.releaseAtSec) } : null,
        hunt: row?._wildlifeHunt ? { encounterId: String(row._wildlifeHunt.id || ''), kind: String(row._wildlifeHunt.kind || '') } : null,
        bossAssistOwnerId: typeof wildlifeAssistIds.get === 'function' ? String(wildlifeAssistIds.get(idOf(row)) || '') : '',
        hasCombatIntent: Boolean(row?._combatIntent), intentEnemyTeamId: String(row?._combatIntent?.enemyTeamId || ''),
        intentTargetId: String(row?._combatIntent?.targetId || ''),
        intentZoneId: String(row?._combatIntent?.zoneId || ''),
        intentCombatSpaceId: String(row?._combatIntent?.combatSpaceId || (row?._combatIntent ? WORLD_COMBAT_SPACE : '')),
        basicAllowed: canBasicAttackByStatus(row), actionBlocked: hasActionBlockStatus(row), moveAllowed: canMoveByStatus(row),
        attackRange: stats.attackRange, sightRange: stats.sightRange, moveSpeed: stats.moveSpeed,
        spatialMotion: row?._spatialMotion ? { reason: String(row._spatialMotion.reason || ''),
          targetId: String(row._spatialMotion.targetId || ''), x: finite(row._spatialMotion.x), y: finite(row._spatialMotion.y),
          stopRange: finite(row._spatialMotion.stopRange) } : null,
        spatialLastSeen: seen ? { targetId: String(seen.targetId), x: finite(seen.x), y: finite(seen.y),
          seenAtSec: finite(seen.seenAtSec) } : null,
        riftDefeated: isDimensionRiftDefeated(row), spatial: point ? { x: finite(point.x), y: finite(point.y) } : null };
    }),
  };
  // A failed observer must not interrupt hit/death/claim settlement. Headless
  // hosts can capture a diagnostic error separately and fail their own check.
  observer(owned(snapshot));
  } catch { /* Projection and callback failure have no gameplay side effect. */ }
}
