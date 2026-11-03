import { getCombatEquipment, getEquipmentStatValues } from './battleEquipmentLogic.js';
import { getStatGrowthLevel } from './erStats.js';
import { isDimensionRiftDefeated } from './dimensionRiftDefeatLogic.js';

const round = value => Math.round(value * 1e6) / 1e6;

export function synchronizeEquipmentHealth(actor) {
  if (!actor || !Number.isFinite(Number(actor.maxHp)) || Number(actor.maxHp) <= 0) return actor;
  const previousMax = Number(actor.maxHp);
  const previousBonus = Number(actor._equipmentMaxHpApplied || 0);
  const bonus = getCombatEquipment(actor).reduce((sum, item) => sum + Math.max(0,
    Number(getEquipmentStatValues(item, getStatGrowthLevel(actor)).hp || 0)), 0);
  const baseMax = Math.max(1, previousMax - previousBonus);
  const nextMax = Math.max(1, round(baseMax + bonus));
  const delta = nextMax - previousMax;
  actor.maxHp = nextMax;
  actor._equipmentMaxHpApplied = nextMax - baseMax;
  if (Number.isFinite(Number(actor.hp))) {
    // 체력 비율을 보존해 장비 교체 반복으로 회복하지 않고 사망·전투 불능을 유지한다.
    const hp = Math.max(0, Number(actor.hp));
    actor.hp = hp <= 0 ? 0 : isDimensionRiftDefeated(actor) ? Math.min(nextMax, hp)
      : Math.min(nextMax, round(hp * nextMax / previousMax));
  }
  if (Number.isFinite(actor._perkBaseMaxHp)) actor._perkBaseMaxHp += delta;
  return actor;
}
