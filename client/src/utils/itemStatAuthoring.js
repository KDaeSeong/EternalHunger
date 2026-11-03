import equipmentStatContract from '../../../shared/equipmentStatContract.cjs';

export const ITEM_STAT_FIELDS = [
  ['atk', '공격'], ['def', '방어'], ['hp', '체력'], ['skillAmp', '스킬증폭'],
  ['atkSpeed', '공속'], ['critChance', '치명'], ['cdr', '쿨감'],
  ['lifesteal', '생명력 흡수'], ['omnisyphon', '모든 피해 흡혈'],
  ['moveSpeed', '이속 비율'], ['moveSpeedFlat', '고정 이속'],
  ['armorPen', '방어 관통 비율'], ['armorPenFlat', '고정 방어 관통'],
  ['adaptiveForce', '맞춤형 능력치'], ['atkPerLevel', '레벨당 공격'],
  ['defPerLevel', '레벨당 방어'], ['hpPerLevel', '레벨당 체력'],
  ['skillAmpPerLevel', '레벨당 스킬증폭'],
];

// Draft loading and saving share the complete field set. Never save level-scaled totals.
export function buildItemStatFields(item = {}) {
  const canonical = equipmentStatContract.normalizeEquipmentItem(item);
  return { equipmentStatVersion: equipmentStatContract.EQUIPMENT_STAT_VERSION,
    stats: Object.fromEntries(equipmentStatContract.EQUIPMENT_STAT_KEYS.map(key => {
      const value = Number(canonical?.stats?.[key] ?? 0);
      return [key, Number.isFinite(value) ? value : 0];
    })) };
}
