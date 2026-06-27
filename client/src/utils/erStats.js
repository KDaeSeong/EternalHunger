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
export const LEGACY_STAT_KEYS = ['str', 'agi', 'int', 'men', 'luk', 'dex', 'sht', 'end'];

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

function hasAnyKey(src, keys) {
  return keys.some((key) => src?.[key] !== undefined || src?.[key?.toUpperCase?.()] !== undefined);
}

function old(src, key) {
  return toNumber(src?.[key] ?? src?.[key.toUpperCase?.()] ?? 0, 0);
}

export function deriveErStatsFromLegacyStats(stats = {}) {
  const str = old(stats, 'str');
  const agi = old(stats, 'agi');
  const int = old(stats, 'int');
  const men = old(stats, 'men');
  const luk = old(stats, 'luk');
  const dex = old(stats, 'dex');
  const sht = old(stats, 'sht');
  const end = old(stats, 'end');
  const rangedLike = sht >= Math.max(str, int, end);
  const mageLike = int >= Math.max(str, sht, end);

  return {
    maxHp: 72 + end * 1.1 + men * 0.35 + str * 0.18,
    hpGrowth: 2.8 + end * 0.035 + men * 0.01,
    attackPower: 12 + Math.max(str, sht) * 0.34 + dex * 0.08,
    attackPowerGrowth: 0.9 + Math.max(str, sht) * 0.012,
    skillAmp: mageLike ? int * 0.48 + men * 0.12 : int * 0.22 + men * 0.05,
    skillAmpGrowth: 0.6 + int * 0.012,
    defense: 8 + end * 0.28 + agi * 0.08,
    defenseGrowth: 0.45 + end * 0.01,
    attackSpeed: 0.55 + agi * 0.004 + dex * 0.002,
    attackSpeedGrowth: 0.008 + agi * 0.00012,
    attackRange: rangedLike ? 4.2 + Math.min(1.4, sht * 0.015) : 1.35 + Math.min(0.45, dex * 0.006),
    sightRange: 6.8 + dex * 0.025 + luk * 0.02,
  };
}

export function normalizeErStats(stats = {}, opts = {}) {
  const src = stats && typeof stats === 'object' ? stats : {};
  const hasNew = hasAnyKey(src, ER_STAT_KEYS);
  const hasLegacy = hasAnyKey(src, LEGACY_STAT_KEYS);
  const derived = hasLegacy ? deriveErStatsFromLegacyStats(src) : {};
  const base = hasNew ? { ...DEFAULT_ER_STATS, ...derived } : (hasLegacy ? { ...DEFAULT_ER_STATS, ...derived } : { ...DEFAULT_ER_STATS });

  const out = {};
  ER_STAT_KEYS.forEach((key) => {
    const explicit = src?.[key] ?? src?.[key.toUpperCase?.()];
    out[key] = clampStat(key, explicit !== undefined ? explicit : base[key]);
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

export function legacyStatDeltaToErStatDelta(key, value) {
  const v = toNumber(value, 0);
  if (!v) return {};
  switch (String(key || '').toLowerCase()) {
    case 'str':
      return { attackPower: v * 1.4 };
    case 'sht':
    case 'shoot':
      return { attackPower: v * 1.25, attackRange: v * 0.03 };
    case 'int':
      return { skillAmp: v * 1.7 };
    case 'men':
      return { skillAmp: v * 0.55, maxHp: v * 2.5 };
    case 'end':
      return { defense: v * 0.9, maxHp: v * 3 };
    case 'agi':
      return { attackSpeed: v * 0.012, defense: v * 0.25 };
    case 'dex':
      return { attackSpeed: v * 0.006, attackPower: v * 0.35, sightRange: v * 0.03 };
    case 'luk':
      return { sightRange: v * 0.04 };
    default:
      return { [key]: v };
  }
}

export function normalizeErStatDeltaMap(deltaMap = {}) {
  const src = deltaMap && typeof deltaMap === 'object' ? deltaMap : {};
  const out = {};
  Object.entries(src).forEach(([key, value]) => {
    const n = toNumber(value, 0);
    if (!n) return;
    if (ER_STAT_KEYS.includes(key)) {
      out[key] = toNumber(out[key], 0) + n;
      return;
    }
    const mapped = legacyStatDeltaToErStatDelta(key, n);
    Object.entries(mapped).forEach(([nextKey, nextValue]) => {
      if (!ER_STAT_KEYS.includes(nextKey)) return;
      out[nextKey] = toNumber(out[nextKey], 0) + toNumber(nextValue, 0);
    });
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
