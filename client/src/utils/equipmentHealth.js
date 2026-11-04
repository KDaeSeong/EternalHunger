import { getCombatEquipment } from './battleEquipmentLogic.js';
import { isDimensionRiftDefeated } from './dimensionRiftDefeatLogic.js';

const finite = value => Number.isFinite(Number(value)) ? Number(value) : 0;
const round = value => Number.isFinite(value * 1e6) ? Math.round(value * 1e6) / 1e6 : value;

// Use the real five slots, not the score API's highest-tier spare items.
export function getEquipmentHealthBonus(actor) {
  const bonus = getCombatEquipment(actor).reduce((sum, item) => {
    const qty = item.qty;
    if (qty !== undefined && !((typeof qty === 'number' || typeof qty === 'string' && qty.trim())
      && Number.isSafeInteger(Number(qty)) && Number(qty) > 0)) return sum;
    return sum + finite(item.stats?.hp);
  }, 0);
  return Number.isFinite(bonus) ? bonus : 0;
}

export function getEquipmentMaxHpAtBase(actor, baseMax) {
  const total = Number(baseMax) + getEquipmentHealthBonus(actor);
  return Number.isFinite(total) ? Math.max(1, round(total)) : NaN;
}

export function synchronizeEquipmentHealth(actor) {
  const previousMax = Number(actor?.maxHp);
  if (!actor || !Number.isFinite(previousMax) || previousMax <= 0) return actor;
  const previousBonus = finite(actor._equipmentMaxHpApplied);
  const bonus = getEquipmentHealthBonus(actor);
  if (!bonus && !previousBonus) return actor;
  const baseMax = Math.max(1, previousMax - previousBonus);
  const nextMax = getEquipmentMaxHpAtBase(actor, baseMax);
  if (!Number.isFinite(nextMax)) return actor;
  const delta = nextMax - previousMax;
  actor.maxHp = nextMax;
  actor._equipmentMaxHpApplied = nextMax - baseMax;
  // Preserve the wounded ratio; changing equipment is not a healing action.
  // Defeated arena participants retain their committed HP until extraction.
  if (delta && Number.isFinite(Number(actor.hp))) {
    const hp = Math.max(0, Number(actor.hp));
    actor.hp = hp <= 0 ? 0 : isDimensionRiftDefeated(actor) ? Math.min(nextMax, hp)
      : Math.min(nextMax, round(hp * nextMax / previousMax));
  }
  // Perk reapplication uses a base which already contains equipped HP.
  if (Number.isFinite(actor._perkBaseMaxHp)) actor._perkBaseMaxHp += delta;
  return actor;
}
