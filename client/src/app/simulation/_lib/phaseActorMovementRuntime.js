import {
  EFFECT_KNOCKBACK,
  getKnockbackDistance,
} from '../../../utils/statusLogic';
import {
  normalizeInventory,
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
