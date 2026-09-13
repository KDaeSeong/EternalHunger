// Team identity and map-region identity are independent of an encounter space.
// Legacy actors without this field remain in the ordinary shared world.
export const WORLD_COMBAT_SPACE = 'world';
export function getCombatSpaceId(actor) {
  return String(actor?._combatSpaceId || WORLD_COMBAT_SPACE);
}
export function shareCombatSpace(first, second) {
  return getCombatSpaceId(first) === getCombatSpaceId(second);
}

export function getActorDimensionRiftId(actor) {
  const entry = actor?._dimensionRiftEntry;
  if (!entry?.riftId || !Number.isFinite(entry.enteredAtSec) || entry.enteredAtSec < 0) return '';
  return getCombatSpaceId(actor) === `dimension_rift:${String(entry.riftId)}` ? String(entry.riftId) : '';
}
