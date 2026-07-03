import {
  EFFECT_KNOCKBACK,
  getKnockbackDistance,
} from '../../../utils/statusLogic';
import { getMovementSpeedMasteryBonus } from '../../../utils/masteryLogic';
import {
  bfsNextStepToAnyTarget,
  getEarlyRoutePlanTarget,
  getEquipMoveSpeed,
  normalizeInventory,
  randInt,
  removeActiveEffect,
} from './simulationEngine';

export function initializeActorPhaseMovementState(actor, {
  itemKeyById,
  ruleset,
} = {}) {
  const updated = actor || {};

  updated.simCredits = updated.simCredits ?? 0;
  updated.droneLastOrderIndex = updated.droneLastOrderIndex ?? -9999;
  updated.droneLastOrderAbsSec = updated.droneLastOrderAbsSec ?? -99999;
  updated.kioskLastInteractAbsSec = updated.kioskLastInteractAbsSec ?? -99999;
  updated.aiTargetZoneId = updated.aiTargetZoneId ?? null;
  updated.aiTargetTTL = updated.aiTargetTTL ?? 0;
  updated.inventory = Array.isArray(updated.inventory) ? updated.inventory : [];
  updated.inventory = normalizeInventory(updated.inventory, ruleset);
  updated._itemKeyById = itemKeyById;

  return updated;
}

export function applyActorKnockbackMovement({
  actions = {},
  state = {},
} = {}) {
  const {
    actor,
    forbiddenIds = new Set(),
    zoneGraph = {},
    zones = [],
  } = state;
  const {
    addLog = () => {},
    atNow = () => null,
    emitRunEvent = () => {},
    getZoneName = (zoneId) => String(zoneId || ''),
  } = actions;

  const updated = actor || {};
  let currentZone = String(updated.zoneId || zones[0]?.zoneId || '__default__');
  let neighbors = Array.isArray(zoneGraph[currentZone]) ? zoneGraph[currentZone] : [];
  const knockbackDistance = getKnockbackDistance(updated);

  if (knockbackDistance > 0 && neighbors.length > 0) {
    const safeNeighbors = neighbors.filter((zoneId) => !forbiddenIds.has(String(zoneId)));
    const candidates = safeNeighbors.length ? safeNeighbors : neighbors;
    const pushedZone = String(candidates[Math.floor(Math.random() * candidates.length)] || currentZone);

    if (pushedZone && pushedZone !== currentZone) {
      updated.zoneId = pushedZone;
      removeActiveEffect(updated, EFFECT_KNOCKBACK);
      addLog(`↔️ [${updated.name}] 밀려남: ${getZoneName(currentZone)} → ${getZoneName(pushedZone)}`, 'system');
      emitRunEvent('move', {
        who: String(updated?._id || ''),
        name: updated?.name,
        from: currentZone,
        to: pushedZone,
        reason: 'knockback',
      }, atNow());
      currentZone = pushedZone;
      neighbors = Array.isArray(zoneGraph[currentZone]) ? zoneGraph[currentZone] : [];
    }
  }

  return {
    actor: updated,
    currentZone,
    neighbors,
  };
}

export function clearActorMoveTargetMemory(actor) {
  const updated = actor || {};

  updated.aiTargetZoneId = null;
  updated.aiTargetTTL = 0;
  updated.aiTargetObjectiveType = '';
  updated.aiTargetObjectiveSubkind = '';
  updated.aiTargetContestPressure = 0;

  return updated;
}

export function resolveActorMoveTargetMemory({
  state = {},
} = {}) {
  const {
    actor,
    aiMove,
    currentZone,
    day,
    forbiddenIds = new Set(),
    mustEscape = false,
    phase,
    ruleset,
  } = state;
  let updated = actor || {};
  const hasAiMoveTargets = Array.isArray(aiMove?.targets) && aiMove.targets.length > 0;
  const earlyRouteTarget = getEarlyRoutePlanTarget(updated, forbiddenIds, day, phase);
  const earlyRoutePriorityPhase = Number(day || 0) === 1;
  const preferEarlyRoutePlan = !!earlyRouteTarget && (
    (!hasAiMoveTargets)
    || earlyRoutePriorityPhase
  );
  const plannedMove = preferEarlyRoutePlan
    ? { targets: [earlyRouteTarget], reason: hasAiMoveTargets ? 'early_route:priority' : 'early_route' }
    : aiMove;
  const aiCfg = ruleset?.ai || {};
  const ttlMin = Math.max(1, Number(aiCfg?.targetTtlMin ?? 2));
  const ttlMax = Math.max(ttlMin, Number(aiCfg?.targetTtlMax ?? 4));
  const clearOnReach = aiCfg?.clearOnReach !== false;
  const plannedObjectiveType = String(plannedMove?.objectiveType || '');
  const plannedObjectiveSubkind = String(plannedMove?.objectiveSubkind || '');
  const plannedContestPressure = Math.max(0, Number(plannedMove?.contestPressure || 0));

  let holdTarget = null;

  if (mustEscape) {
    updated = clearActorMoveTargetMemory(updated);
  } else {
    const saved = String(updated.aiTargetZoneId || '');
    const ttlNow = Math.max(0, Number(updated.aiTargetTTL || 0));

    if (saved && ttlNow > 0 && !forbiddenIds.has(saved)) {
      holdTarget = saved;
      updated.aiTargetTTL = ttlNow - 1;
      if (clearOnReach && String(currentZone) === saved) {
        holdTarget = null;
        updated = clearActorMoveTargetMemory(updated);
      }
    }

    if (!holdTarget && Array.isArray(plannedMove?.targets) && plannedMove.targets.length > 0) {
      const pickedTarget = plannedMove.targets
        .map((zoneId) => String(zoneId || ''))
        .find((zoneId) => zoneId && !forbiddenIds.has(String(zoneId))) || '';
      if (pickedTarget) {
        updated.aiTargetZoneId = pickedTarget;
        updated.aiTargetTTL = randInt(ttlMin, ttlMax);
        updated.aiTargetObjectiveType = plannedObjectiveType;
        updated.aiTargetObjectiveSubkind = plannedObjectiveSubkind;
        updated.aiTargetContestPressure = plannedContestPressure;
        holdTarget = pickedTarget;
      }
    }
  }

  return {
    actor: updated,
    holdTarget,
    moveContestPressure: Math.max(0, Number(updated.aiTargetContestPressure || plannedContestPressure || 0)),
    moveObjectiveSubkind: String(updated.aiTargetObjectiveSubkind || plannedObjectiveSubkind || ''),
    moveObjectiveType: String(updated.aiTargetObjectiveType || plannedObjectiveType || ''),
    moveReason: holdTarget ? `${String(plannedMove?.reason || 'goal')}:ttl` : String(plannedMove?.reason || ''),
    moveTargets: holdTarget ? [holdTarget] : (Array.isArray(plannedMove?.targets) ? plannedMove.targets : []),
    plannedMove,
  };
}

export function resolveActorNextMoveZone({
  state = {},
} = {}) {
  const {
    actor,
    currentZone,
    day,
    fleeInterruptReason = '',
    forbiddenIds = new Set(),
    moveTargets = [],
    mustEscape = false,
    neighbors = [],
    phase,
    recovering = false,
    ruleset,
    zoneGraph = {},
  } = state;

  const updated = actor || {};
  const forbidCfg = ruleset?.forbidden || {};
  const escapeMoveChance = Math.min(1, Math.max(0, Number(forbidCfg.escapeMoveChance ?? 0.85)));
  const curDet = Number.isFinite(Number(updated.detonationSec)) ? Number(updated.detonationSec) : 999;
  const dangerForceSec = Math.max(0, Number(ruleset?.detonation?.criticalSec ?? 5) + 2);
  const escapeChance = (mustEscape && curDet <= dangerForceSec) ? 1 : escapeMoveChance;

  const equipMs = getEquipMoveSpeed(updated);
  const masteryMs = getMovementSpeedMasteryBonus(updated);
  const msMoveBonus = Math.min(0.18, equipMs * 0.9 + masteryMs);
  let baseMoveChance = mustEscape
    ? escapeChance
    : (fleeInterruptReason ? 1 : (recovering ? 0.95 : (moveTargets.length ? 0.88 : 0.6)));
  if (!mustEscape && Number(day || 0) === 1 && String(phase || '') === 'morning') {
    baseMoveChance = Math.max(baseMoveChance, 0.92);
  }
  const moveChance = Math.min(0.98, baseMoveChance + msMoveBonus);
  let willMove = Math.random() < moveChance;

  if (!mustEscape && Number(day || 0) === 1 && String(phase || '') === 'morning' && Math.max(0, Number(updated.day1Moves || 0)) < 1) {
    if (neighbors.length > 0) willMove = true;
  }

  let nextZoneId = currentZone;
  if (willMove) {
    if (mustEscape) {
      if (neighbors.length > 0) {
        const safeNeighbors = neighbors.filter((zoneId) => !forbiddenIds.has(String(zoneId)));
        const candidates = safeNeighbors.length ? safeNeighbors : neighbors;
        nextZoneId = String(candidates[Math.floor(Math.random() * candidates.length)] || currentZone);
      } else {
        nextZoneId = currentZone;
      }
    } else if (moveTargets.length) {
      const targetSet = new Set(moveTargets.map((zoneId) => String(zoneId)));
      const stepRes = bfsNextStepToAnyTarget(currentZone, targetSet, zoneGraph, forbiddenIds);
      const picked = stepRes.nextStep || (targetSet.has(currentZone) ? currentZone : String(moveTargets[0] || currentZone));
      if (picked && !forbiddenIds.has(String(picked))) nextZoneId = String(picked);
    } else if (neighbors.length > 0) {
      const safeNeighbors = neighbors.filter((zoneId) => !forbiddenIds.has(String(zoneId)));
      const candidates = safeNeighbors.length ? safeNeighbors : neighbors;
      nextZoneId = String(candidates[Math.floor(Math.random() * candidates.length)] || currentZone);
    } else {
      nextZoneId = currentZone;
    }
  }

  return {
    moveChance,
    nextZoneId,
    willMove,
  };
}
