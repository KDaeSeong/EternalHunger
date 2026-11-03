import { createCombatPowerSkillSnapshot, getCombatPowerBreakdown } from './combatPowerEstimateRuntime.js';

const idOf = item => String(item?.itemId || item?.id || item?._id || '');

export function createEquipmentSuitabilityEvaluator(actor) {
  let before;
  let skillSnapshot;
  const scores = new Map();
  return item => {
    if (!item || !item.equipSlot || !idOf(item)) return 0;
    if (scores.has(item)) return scores.get(item);
    if (before == null) {
      skillSnapshot = createCombatPowerSkillSnapshot(actor);
      before = getCombatPowerBreakdown(actor, {}, skillSnapshot).total;
    }
    const id = idOf(item);
    const candidate = { ...actor,
      inventory: [...(actor?.inventory || []).filter(row => idOf(row) !== id), item],
      equipped: { ...(actor?.equipped || {}), [item.equipSlot]: id },
    };
    const score = getCombatPowerBreakdown(candidate, {}, skillSnapshot).total - before;
    scores.set(item, score);
    return score;
  };
}
