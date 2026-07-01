export const ER_STAT_FIELDS = [
  { key: 'maxHp', label: '체력', shortLabel: 'HP', defaultValue: 100, min: 1, step: 1 },
  { key: 'hpGrowth', label: '성장 체력', shortLabel: 'HP 성장', defaultValue: 4, min: 0, step: 0.1 },
  { key: 'attackPower', label: '공격력', shortLabel: '공격', defaultValue: 24, min: 0, step: 0.1 },
  { key: 'attackPowerGrowth', label: '성장 공격력', shortLabel: '공격 성장', defaultValue: 1.4, min: 0, step: 0.1 },
  { key: 'skillAmp', label: '스킬 증폭', shortLabel: '스증', defaultValue: 0, min: 0, step: 0.1 },
  { key: 'skillAmpGrowth', label: '성장 스킬 증폭', shortLabel: '스증 성장', defaultValue: 1.1, min: 0, step: 0.1 },
  { key: 'defense', label: '방어력', shortLabel: '방어', defaultValue: 14, min: 0, step: 0.1 },
  { key: 'defenseGrowth', label: '성장 방어력', shortLabel: '방어 성장', defaultValue: 0.8, min: 0, step: 0.1 },
  { key: 'attackSpeed', label: '공격속도', shortLabel: '공속', defaultValue: 0.72, min: 0.1, step: 0.01 },
  { key: 'attackSpeedGrowth', label: '성장 공격속도', shortLabel: '공속 성장', defaultValue: 0.015, min: 0, step: 0.001 },
  { key: 'attackRange', label: '사거리', shortLabel: '사거리', defaultValue: 1.5, min: 0.5, step: 0.1 },
  { key: 'sightRange', label: '시야', shortLabel: '시야', defaultValue: 8, min: 1, step: 0.1 },
];

export const ER_STAT_KEYS = ER_STAT_FIELDS.map((field) => field.key);

export const DEFAULT_ER_STATS = ER_STAT_FIELDS.reduce((acc, field) => {
  acc[field.key] = field.defaultValue;
  return acc;
}, {});

const STAT_FIELD_BY_KEY = ER_STAT_FIELDS.reduce((acc, field) => {
  acc[field.key] = field;
  return acc;
}, {});

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function clampStat(key, value) {
  const field = STAT_FIELD_BY_KEY[key] || {};
  const min = field.min ?? 0;
  const max = field.max ?? Infinity;
  const n = toNumber(value, field.defaultValue ?? 0);
  return Math.max(min, Math.min(max, n));
}

export function normalizeErStats(stats = {}, opts = {}) {
  const src = stats && typeof stats === 'object' ? stats : {};

  const out = {};
  ER_STAT_KEYS.forEach((key) => {
    const explicit = src?.[key] ?? src?.[key.toUpperCase?.()];
    out[key] = clampStat(key, explicit !== undefined ? explicit : DEFAULT_ER_STATS[key]);
  });

  if (opts.round !== false) {
    ER_STAT_KEYS.forEach((key) => {
      const step = STAT_FIELD_BY_KEY[key]?.step ?? 1;
      out[key] = step < 1 ? Number(out[key].toFixed(3)) : Math.round(out[key]);
    });
  }

  return out;
}

export function getStatGrowthLevel(character, explicitLevel) {
  const raw = explicitLevel ?? character?.level ?? character?.erLevel ?? character?.weaponMasteryLevel ?? 1;
  const level = Math.floor(toNumber(raw, 1));
  return Math.max(1, Math.min(20, level));
}

export function getEffectiveErStats(character, opts = {}) {
  const base = normalizeErStats(character?.stats || character || {}, { round: false });
  const level = getStatGrowthLevel(character, opts.level);
  const growthSteps = Math.max(0, level - 1);
  const out = { ...base };
  out.maxHp += base.hpGrowth * growthSteps;
  out.attackPower += base.attackPowerGrowth * growthSteps;
  out.skillAmp += base.skillAmpGrowth * growthSteps;
  out.defense += base.defenseGrowth * growthSteps;
  out.attackSpeed += base.attackSpeedGrowth * growthSteps;
  out.attackSpeed = Math.max(0.1, Math.min(3.0, out.attackSpeed));
  out.attackRange = Math.max(0.5, out.attackRange);
  out.sightRange = Math.max(1, out.sightRange);
  return out;
}

export function normalizeErStatDeltaMap(deltaMap = {}) {
  const src = deltaMap && typeof deltaMap === 'object' ? deltaMap : {};
  const out = {};
  Object.entries(src).forEach(([key, value]) => {
    const n = toNumber(value, 0);
    if (!n) return;
    if (!ER_STAT_KEYS.includes(key)) return;
    out[key] = toNumber(out[key], 0) + n;
  });
  return out;
}

export function getErStatLabel(key) {
  return STAT_FIELD_BY_KEY[key]?.shortLabel || STAT_FIELD_BY_KEY[key]?.label || String(key || '');
}

export function readErStat(characterOrStats, key, fallback = 0) {
  const stats = characterOrStats?.stats && typeof characterOrStats.stats === 'object'
    ? characterOrStats.stats
    : characterOrStats;
  const normalized = normalizeErStats(stats, { round: false });
  return toNumber(normalized?.[key], fallback);
}
