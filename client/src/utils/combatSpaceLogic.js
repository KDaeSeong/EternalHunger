// Combat requires both the same normalized map and the same encounter space.
// Legacy actors without a map share one unknown map, never an explicit map.
// Missing encounter-space fields still use the ordinary world identifier.
export const WORLD_COMBAT_SPACE = 'world';
export function getCombatMapId(actor) {
  return actor?.mapId != null ? String(actor.mapId || '') : '';
}
export function getCombatSpaceId(actor) {
  return String(actor?._combatSpaceId || WORLD_COMBAT_SPACE);
}
export function shareCombatSpace(first, second) {
  return getCombatMapId(first) === getCombatMapId(second) && getCombatSpaceId(first) === getCombatSpaceId(second);
}

export function getActorDimensionRiftId(actor) {
  const entry = actor?._dimensionRiftEntry;
  if (!entry?.riftId || !Number.isFinite(entry.enteredAtSec) || entry.enteredAtSec < 0) return '';
  return getCombatSpaceId(actor) === `dimension_rift:${String(entry.riftId)}` ? String(entry.riftId) : '';
}
