import { getActorDimensionRiftId } from './combatSpaceLogic.js';

export function isDimensionRiftDefeated(actor) {
  const riftId = getActorDimensionRiftId(actor);
  const defeat = actor?._dimensionRiftDefeat;
  return Boolean(riftId && Number(actor.hp) > 0 && defeat?.riftId === riftId
    && defeat.enteredAtSec === actor._dimensionRiftEntry.enteredAtSec);
}

// Commit already mitigated damage. No HP-zero snapshot can be resurrected here.
// Arena defeat retains at most 1 HP (never raises fractional HP), blocks further
// participation, and leaves extraction to the ordinary world-objective observer.
export function commitRuntimeHpDamage(actor, amount, { atSec = null, by = '', cause = 'combat', sourceActorIds = [] } = {}) {
  const before = Number(actor?.hp);
  const damage = Number(amount);
  if (!actor || !Number.isFinite(before) || before <= 0 || !Number.isFinite(damage) || damage <= 0
    || isDimensionRiftDefeated(actor)) return { hpDamage: 0, defeat: null };
  const riftId = getActorDimensionRiftId(actor);
  let after = Math.max(0, before - damage);
  let defeat = null;
  const committedDeath = actor.deadAtPhaseIdx != null && Number(actor.deadAtPhaseIdx) >= 0 || Boolean(actor._deathBy);
  if (after <= 0 && riftId && !committedDeath) {
    after = Math.min(1, before);
    const enteredAtSec = actor._dimensionRiftEntry.enteredAtSec;
    defeat = { id: `${riftId}:${String(actor._id || actor.id || '')}:${enteredAtSec}:defeat`,
      riftId, who: String(actor._id || actor.id || ''), enteredAtSec,
      atSec: Number.isFinite(atSec) && atSec >= enteredAtSec ? atSec : null,
      by: String(by || ''), cause: String(cause || 'combat'), sourceActorIds: [...sourceActorIds],
      hpBefore: before, hpAfter: after, hpDamage: before - after };
    actor._dimensionRiftDefeat = defeat;
  }
  actor.hp = Math.round(after * 1e6) / 1e6;
  return { hpDamage: Math.round((before - actor.hp) * 1e6) / 1e6, defeat };
}
