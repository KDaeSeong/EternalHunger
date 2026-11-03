const importedStats = require('./importedEquipmentStats.generated.json');

const EQUIPMENT_STAT_VERSION = 2;
const RATIO_KEYS = ['critChance', 'cdr', 'lifesteal', 'omnisyphon', 'armorPen'];
const POINT_KEYS = ['atk', 'def', 'hp', 'skillAmp', 'atkSpeed', 'moveSpeed', 'moveSpeedFlat',
  'adaptiveForce', 'armorPenFlat', 'atkPerLevel', 'defPerLevel', 'hpPerLevel', 'skillAmpPerLevel'];
const EQUIPMENT_STAT_KEYS = [...POINT_KEYS, ...RATIO_KEYS];
const GROWTH_FIELDS = [['atk', 'atkPerLevel', 'attackPower'], ['def', 'defPerLevel', 'defense'],
  ['hp', 'hpPerLevel', 'maxHp'], ['skillAmp', 'skillAmpPerLevel', null]];
const finite = value => Number.isFinite(Number(value)) ? Number(value) : 0;
const itemKey = item => [item?.itemKey, item?.externalId, item?.key, item?.itemId, item?.id, item?._id]
  .map(value => String(value || '').trim()).find(value => value.startsWith('namu:')) || '';

function normalizeEquipmentItem(item) {
  if (!item || typeof item !== 'object') return item;
  if (Number(item.equipmentStatVersion || 0) >= EQUIPMENT_STAT_VERSION) return item;
  const key = itemKey(item);
  if (!item.stats && !importedStats[key]) return item;
  const originalStats = item.stats || {};
  const stats = { ...originalStats };
  const legacy = Number(item.equipmentStatVersion || 0) < EQUIPMENT_STAT_VERSION;
  const reference = legacy && key ? importedStats[key] : null;
  for (const field of [...RATIO_KEYS, 'atkSpeed', 'attackSpeed']) {
    if (!Object.hasOwn(stats, field)) continue;
    const value = finite(stats[field]);
    // 외부 위키의 구형 수치는 퍼센트 포인트이고 자체 생성 장비는 소수 가산값이다.
    stats[field] = legacy && key ? value / 100
      : ['atkSpeed', 'attackSpeed'].includes(field) ? legacy && value > 3 ? value / 100 : value
      : value > 1 ? value / 100 : value;
  }
  if (reference) {
    for (const [field, value] of Object.entries(reference.stats)) {
      const before = originalStats[field];
      const original = reference.legacyStats[field];
      // 원본과 다른 편집값은 보존하고, 누락되었거나 구형 원본과 같은 필드만 복구한다.
      if (before == null || finite(before) === finite(original)) stats[field] = value;
    }
  }
  return { ...item, stats, equipmentStatVersion: EQUIPMENT_STAT_VERSION };
}

function equipmentStatsAtLevel(item, level = 1) {
  const source = normalizeEquipmentItem(item)?.stats || {};
  if (!GROWTH_FIELDS.some(([field, growth, alias]) => finite(source[growth])
    || source[field] == null && alias && source[alias] != null)) return source;
  const stats = { ...source };
  const atLevel = Math.max(1, Math.min(20, Math.floor(finite(level) || 1)));
  for (const [field, growth, alias] of GROWTH_FIELDS) {
    stats[field] = finite(source[field] ?? source[alias]) + finite(source[growth]) * atLevel;
  }
  return stats;
}

module.exports = { EQUIPMENT_STAT_VERSION, EQUIPMENT_STAT_KEYS, normalizeEquipmentItem, equipmentStatsAtLevel };
