import { getActorDimensionRiftId, getCombatSpaceId, shareCombatSpace } from '../../../utils/combatSpaceLogic.js';
import { isDimensionRiftDefeated } from '../../../utils/dimensionRiftDefeatLogic.js';
import { canMoveByStatus, isTargetableByStatus } from '../../../utils/statusLogic.js';
import { normalizeCharacterSkillMovementMode } from '../../../utils/characterSkillCompilerCore.js';
import { getSpatialPosition, SPATIAL_REGION_SIZE } from './combatSpatialRuntime.js';

const round = (value) => Math.round(Number(value) * 1e6) / 1e6;
const idOf = (actor) => String(actor?._id || actor?.id || '');
const insideRegion = (value) => Math.max(0, Math.min(SPATIAL_REGION_SIZE, value));

function hasValidTimedCombatSpace(actor, nowSec) {
  const combatSpaceId = getCombatSpaceId(actor);
  if (!combatSpaceId.startsWith('dimension_rift:')) return true;
  const riftId = getActorDimensionRiftId(actor);
  const enteredAtSec = Number(actor?._dimensionRiftEntry?.enteredAtSec);
  return Boolean(riftId) && Number.isFinite(Number(nowSec)) && Number(nowSec) >= enteredAtSec;
}

export const MAX_CHARACTER_SKILL_MOVEMENT_DISTANCE = 10;

export function getCharacterSkillMovementEstimate(actor, target, def, { ignoreStatus = false, nowSec = null } = {}) {
  const requestedDistance = Number(def?.movementDistance || 0);
  if (!actor || !target || idOf(actor) === idOf(target) || def?.includesMovement !== true
    || !Number.isFinite(requestedDistance) || requestedDistance <= 0
    || requestedDistance > MAX_CHARACTER_SKILL_MOVEMENT_DISTANCE
    || !Number.isFinite(Number(actor.hp)) || Number(actor.hp) <= 0
    || !Number.isFinite(Number(target.hp)) || Number(target.hp) <= 0
    || isDimensionRiftDefeated(actor) || isDimensionRiftDefeated(target)
    || !isTargetableByStatus(target) || !shareCombatSpace(actor, target)
    || !hasValidTimedCombatSpace(actor, nowSec) || !hasValidTimedCombatSpace(target, nowSec)
    || String(actor.zoneId) !== String(target.zoneId)
    || !ignoreStatus && !canMoveByStatus(actor)) return null;

  const from = getSpatialPosition(actor);
  const targetPosition = getSpatialPosition(target);
  if (!from || !targetPosition) return null;

  const movementMode = normalizeCharacterSkillMovementMode(def.movementMode);
  const towardDx = targetPosition.x - from.x;
  const towardDy = targetPosition.y - from.y;
  const targetDistance = Math.hypot(towardDx, towardDy);
  let ux;
  let uy;
  let travel;
  let stoppedAtTarget = false;
  let clipped = false;

  if (movementMode === 'toward_target') {
    if (targetDistance <= 1e-9) return null;
    ux = towardDx / targetDistance;
    uy = towardDy / targetDistance;
    travel = Math.min(requestedDistance, targetDistance);
    stoppedAtTarget = travel + 1e-9 < requestedDistance;
  } else {
    ux = targetDistance > 1e-9 ? -towardDx / targetDistance : 1;
    uy = targetDistance > 1e-9 ? -towardDy / targetDistance : 0;
    const edgeX = ux > 0 ? (SPATIAL_REGION_SIZE - from.x) / ux : ux < 0 ? -from.x / ux : Infinity;
    const edgeY = uy > 0 ? (SPATIAL_REGION_SIZE - from.y) / uy : uy < 0 ? -from.y / uy : Infinity;
    travel = Math.max(0, Math.min(requestedDistance, edgeX, edgeY));
    clipped = travel + 1e-9 < requestedDistance;
  }

  const to = {
    ...from,
    x: round(insideRegion(from.x + ux * travel)),
    y: round(insideRegion(from.y + uy * travel)),
  };
  const actualDistance = round(Math.hypot(to.x - from.x, to.y - from.y));
  if (actualDistance <= 0) return null;
  return {
    movementMode,
    requestedDistance: round(requestedDistance),
    actualDistance,
    stoppedAtTarget,
    clipped,
    from: { ...from },
    targetPosition: { ...targetPosition },
    to,
  };
}

export function resolveCharacterSkillMovement(actor, target, def, {
  nowSec = 0,
  castId = '',
  stage = 1,
} = {}, actions = {}) {
  if (!Number.isFinite(Number(nowSec)) || Number(nowSec) < 0) return null;
  const estimate = getCharacterSkillMovementEstimate(actor, target, def, { nowSec });
  if (!estimate) return null;
  const stableCastId = String(castId || `${idOf(actor)}:${def?.slot || 'skill'}:${stage}:${round(nowSec)}`);
  const receiptId = `character-skill-movement:${stableCastId}`;
  if (actor._lastCharacterSkillMovementReceipt?.id === receiptId) return null;

  const receipt = {
    id: receiptId,
    castId: stableCastId,
    who: idOf(actor),
    targetId: idOf(target),
    sourceKind: 'character_skill',
    reason: 'character_skill_movement',
    skill: String(def?.name || ''),
    slot: String(def?.slot || ''),
    stage: Number(stage) || 1,
    zoneId: String(actor.zoneId || ''),
    combatSpaceId: getCombatSpaceId(actor),
    atSec: round(nowSec),
    ...estimate,
  };

  // The receipt is committed before notifying observers, so callback re-entry
  // cannot apply one release twice.
  actor._lastCharacterSkillMovementReceipt = receipt;
  actor._spatial = { ...estimate.to };
  actor._spatialMotion = null;
  actions.emitRunEvent?.('spatial_displacement', receipt, actions.at || { sec: round(nowSec) });
  const label = estimate.movementMode === 'away_from_target' ? '후퇴' : '돌진';
  actions.addLog?.(`↔️ [${actor.name || receipt.who}] ${receipt.skill} ${label} ${estimate.actualDistance}m${estimate.stoppedAtTarget ? ' · 대상 위치에서 멈춤' : estimate.clipped ? ' · 전장 경계에서 멈춤' : ''}`, 'combat-detail');
  return receipt;
}
