import { canBasicAttackByStatus, hasActionBlockStatus } from '../../../utils/statusLogic.js';
import { getCombatSpaceId } from '../../../utils/combatSpaceLogic.js';
import { isDimensionRiftDefeated } from '../../../utils/dimensionRiftDefeatLogic.js';
import { getActorTeamId } from './teamRuntime.js';
import { getSpatialPosition } from './combatSpatialRuntime.js';

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
  sides = [], participants = [] } = {}) {
  if (typeof observer !== 'function') return;
  const deadIds = new Set(newDeadIds.map(String));
  const rows = Array.isArray(roster) ? roster : [];
  const snapshot = {
    stage, nowSec: finite(nowSec),
    scope: 'Read-only scheduler/queue state; not executed actions, missed-turn causality or acceptance.',
    truncated: rows.length > 512,
    scheduled: scheduled ? { actorId: String(scheduled.actorId || ''), targetId: String(scheduled.targetId || ''),
      actionType: String(scheduled.actionType || ''), atSec: finite(scheduled.atSec) } : null,
    initiatorId: idOf(actor), targetId: idOf(target), onlyActorId: String(onlyActorId || ''),
    sides: sides.map(side => side.map(idOf)), participants: participants.map(idOf),
    actors: rows.slice(0, 512).map(row => {
      const point = getSpatialPosition(row);
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
        basicAllowed: canBasicAttackByStatus(row), actionBlocked: hasActionBlockStatus(row),
        riftDefeated: isDimensionRiftDefeated(row), spatial: point ? { x: finite(point.x), y: finite(point.y) } : null };
    }),
  };
  // A failed observer must not interrupt hit/death/claim settlement. Headless
  // hosts can capture a diagnostic error separately and fail their own check.
  try { observer(owned(snapshot)); } catch { /* No gameplay side effect. */ }
}
