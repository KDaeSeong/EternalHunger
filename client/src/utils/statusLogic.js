// client/src/utils/statusLogic.js
import { normalizeErStats, normalizeErStatDeltaMap, ER_STAT_KEYS, getEffectiveErStats } from './erStats';
import { applyMasteryStatBonuses } from './masteryLogic';

export const EFFECT_POISON = '중독';
export const EFFECT_BURN = '화상';
export const EFFECT_FOOD_POISON = '식중독';
export const EFFECT_SHIELD = '보호막';
export const EFFECT_REGEN = '재생';
export const EFFECT_FOCUS = '집중';
export const EFFECT_STIM = '각성';
export const EFFECT_AIRBORNE = '에어본';
export const EFFECT_HEAL_REDUCTION = '치유 감소';
export const EFFECT_STUN = '기절';
export const EFFECT_KNOCKBACK = '넉백';
export const EFFECT_SLOW = '이동 속도 감소';
export const EFFECT_LIFESTEAL = '흡혈';
export const EFFECT_HASTE = '이동 속도 증가';
export const EFFECT_COOLDOWN_UP = '쿨다운 증가';
export const EFFECT_COOLDOWN_DOWN = '쿨다운 감소';

const EFFECT_NAME_ALIASES = {
  중독: EFFECT_POISON,
  poison: EFFECT_POISON,
  poisoned: EFFECT_POISON,
  독: EFFECT_POISON,
  화상: EFFECT_BURN,
  burn: EFFECT_BURN,
  burning: EFFECT_BURN,
  식중독: EFFECT_FOOD_POISON,
  food_poison: EFFECT_FOOD_POISON,
  foodpoison: EFFECT_FOOD_POISON,
  'food poisoning': EFFECT_FOOD_POISON,
  보호막: EFFECT_SHIELD,
  shield: EFFECT_SHIELD,
  barrier: EFFECT_SHIELD,
  재생: EFFECT_REGEN,
  regen: EFFECT_REGEN,
  regeneration: EFFECT_REGEN,
  집중: EFFECT_FOCUS,
  focus: EFFECT_FOCUS,
  concentration: EFFECT_FOCUS,
  각성: EFFECT_STIM,
  stimulant: EFFECT_STIM,
  adrenaline: EFFECT_STIM,
  energize: EFFECT_STIM,
  '공중에 뜸': EFFECT_AIRBORNE,
  에어본: EFFECT_AIRBORNE,
  airborne: EFFECT_AIRBORNE,
  knockup: EFFECT_AIRBORNE,
  '치유 감소': EFFECT_HEAL_REDUCTION,
  치감: EFFECT_HEAL_REDUCTION,
  antiheal: EFFECT_HEAL_REDUCTION,
  'heal reduction': EFFECT_HEAL_REDUCTION,
  기절: EFFECT_STUN,
  stun: EFFECT_STUN,
  stunned: EFFECT_STUN,
  밀어짐: EFFECT_KNOCKBACK,
  넉백: EFFECT_KNOCKBACK,
  knockback: EFFECT_KNOCKBACK,
  pushed: EFFECT_KNOCKBACK,
  둔화: EFFECT_SLOW,
  '이동 속도 감소': EFFECT_SLOW,
  slow: EFFECT_SLOW,
  slowed: EFFECT_SLOW,
  흡혈: EFFECT_LIFESTEAL,
  lifesteal: EFFECT_LIFESTEAL,
  vamp: EFFECT_LIFESTEAL,
  가속: EFFECT_HASTE,
  '이동 속도 증가': EFFECT_HASTE,
  haste: EFFECT_HASTE,
  speedup: EFFECT_HASTE,
  '쿨다운 증가': EFFECT_COOLDOWN_UP,
  cooldown_up: EFFECT_COOLDOWN_UP,
  'cooldown up': EFFECT_COOLDOWN_UP,
  '쿨다운 감소': EFFECT_COOLDOWN_DOWN,
  cooldown_down: EFFECT_COOLDOWN_DOWN,
  'cooldown down': EFFECT_COOLDOWN_DOWN,
  cdr: EFFECT_COOLDOWN_DOWN,
};

export const EFFECT_META = {
  [EFFECT_POISON]: {
    icon: '☠️',
    category: 'debuff',
    tags: ['negative', 'dot', 'poison'],
    defaultDotDamage: 8,
    stackMode: 'refresh_max',
    maxStacks: 2,
  },
  [EFFECT_BURN]: {
    icon: '🔥',
    category: 'debuff',
    tags: ['negative', 'dot', 'burn'],
    defaultDotDamage: 7,
    stackMode: 'refresh_max',
    maxStacks: 2,
  },
  [EFFECT_FOOD_POISON]: {
    icon: '🤢',
    category: 'debuff',
    tags: ['negative', 'dot', 'poison', 'food'],
    defaultDotDamage: 10,
    stackMode: 'refresh_only',
    maxStacks: 1,
    statMultipliers: { defense: 0.85 },
  },
  [EFFECT_SHIELD]: {
    icon: '🛡️',
    category: 'buff',
    tags: ['positive', 'shield'],
    stackMode: 'refresh_max',
    maxStacks: 1,
  },
  [EFFECT_REGEN]: {
    icon: '✨',
    category: 'buff',
    tags: ['positive', 'regen', 'recovery'],
    defaultRecovery: 6,
    stackMode: 'refresh_max',
    maxStacks: 2,
  },
  [EFFECT_FOCUS]: {
    icon: '📘',
    category: 'buff',
    tags: ['positive', 'focus'],
    stackMode: 'refresh_only',
    maxStacks: 1,
    statModifiers: { skillAmp: 8, maxHp: 5 },
  },
  [EFFECT_STIM]: {
    icon: '⚡',
    category: 'buff',
    tags: ['positive', 'stim', 'combat'],
    stackMode: 'refresh_only',
    maxStacks: 1,
    statModifiers: { attackSpeed: 0.04, sightRange: 0.2 },
  },
  [EFFECT_AIRBORNE]: {
    icon: '🌀',
    category: 'debuff',
    tags: ['negative', 'cc', 'airborne', 'action_block'],
    stackMode: 'refresh_max',
    maxStacks: 1,
  },
  [EFFECT_HEAL_REDUCTION]: {
    icon: '🩹',
    category: 'debuff',
    tags: ['negative', 'heal_reduction'],
    defaultHealReductionPct: 0.45,
    stackMode: 'refresh_max',
    maxStacks: 1,
  },
  [EFFECT_STUN]: {
    icon: '💫',
    category: 'debuff',
    tags: ['negative', 'cc', 'stun', 'action_block'],
    stackMode: 'refresh_max',
    maxStacks: 1,
  },
  [EFFECT_KNOCKBACK]: {
    icon: '↔️',
    category: 'debuff',
    tags: ['negative', 'cc', 'knockback', 'forced_move'],
    defaultKnockbackDistance: 1,
    stackMode: 'refresh_only',
    maxStacks: 1,
  },
  [EFFECT_SLOW]: {
    icon: '🐌',
    category: 'debuff',
    tags: ['negative', 'slow', 'move'],
    defaultMoveSpeedBonus: -0.18,
    stackMode: 'refresh_max',
    maxStacks: 1,
  },
  [EFFECT_LIFESTEAL]: {
    icon: '🩸',
    category: 'buff',
    tags: ['positive', 'lifesteal', 'combat'],
    defaultLifestealPct: 0.12,
    stackMode: 'refresh_max',
    maxStacks: 1,
  },
  [EFFECT_HASTE]: {
    icon: '🏃',
    category: 'buff',
    tags: ['positive', 'haste', 'move', 'cooldown'],
    defaultMoveSpeedBonus: 0.16,
    defaultCooldownRateBonus: 0.12,
    stackMode: 'refresh_max',
    maxStacks: 1,
  },
  [EFFECT_COOLDOWN_UP]: {
    icon: '⏫',
    category: 'debuff',
    tags: ['negative', 'cooldown'],
    defaultCooldownRatePenalty: 0.25,
    stackMode: 'refresh_max',
    maxStacks: 1,
  },
  [EFFECT_COOLDOWN_DOWN]: {
    icon: '⏬',
    category: 'buff',
    tags: ['positive', 'cooldown'],
    defaultCooldownRateBonus: 0.25,
    stackMode: 'refresh_max',
    maxStacks: 1,
  },
};

function safeTags(value) {
  if (!Array.isArray(value)) return [];
  return value.map((x) => String(x || '').trim().toLowerCase()).filter(Boolean);
}

export function canonicalizeEffectName(name) {
  const raw = String(name || '').trim();
  if (!raw) return '';
  return EFFECT_NAME_ALIASES[raw.toLowerCase()] || EFFECT_NAME_ALIASES[raw] || raw;
}

function effectMetaByName(name) {
  return EFFECT_META[canonicalizeEffectName(name)] || null;
}

function normalizeEffectDurationSec(duration, fallbackSec = 10, extra = {}) {
  const raw = Number(extra?.durationSec ?? extra?.seconds ?? duration ?? fallbackSec);
  if (!Number.isFinite(raw)) return Math.max(1, Math.floor(Number(fallbackSec || 1)));
  const alreadySeconds = extra?.durationUnit === 'sec' || extra?.durationSec != null || extra?.seconds != null || raw > 10;
  const sec = alreadySeconds ? raw : raw * 10;
  return Math.max(1, Math.floor(sec));
}

export function normalizeStatusEffectList(effects) {
  const list = Array.isArray(effects) ? effects : (effects ? [effects] : []);
  return list.map((eff) => normalizeStatusEffect(eff)).filter(Boolean);
}

export function makeShieldEffect(shieldValue, duration = 2, sourceId = '', extra = {}) {
  return normalizeStatusEffect({
    ...extra,
    name: EFFECT_SHIELD,
    shieldValue: Math.max(0, Math.floor(Number(shieldValue || 0))),
    remainingDuration: normalizeEffectDurationSec(duration, 20, extra),
    durationUnit: 'sec',
    stacks: Math.max(1, Math.floor(Number(extra?.stacks || 1))),
    sourceId: String(sourceId || extra?.sourceId || ''),
  });
}

export function makeRegenEffect(recovery, duration = 2, sourceId = '', extra = {}) {
  return normalizeStatusEffect({
    ...extra,
    name: EFFECT_REGEN,
    recovery: Math.max(0, Math.floor(Number(recovery || 0))),
    remainingDuration: normalizeEffectDurationSec(duration, 20, extra),
    durationUnit: 'sec',
    stacks: Math.max(1, Math.floor(Number(extra?.stacks || 1))),
    sourceId: String(sourceId || extra?.sourceId || ''),
  });
}

export function makeStatBuffEffect(name, statModifiers = {}, duration = 2, sourceId = '', extra = {}) {
  const cleanedStats = normalizeErStatDeltaMap(Object.fromEntries(
    Object.entries(statModifiers && typeof statModifiers === 'object' ? statModifiers : {}).filter(([, v]) => Number.isFinite(Number(v)) && Number(v) !== 0)
  ));
  return normalizeStatusEffect({
    ...extra,
    name: canonicalizeEffectName(name),
    statModifiers: cleanedStats,
    remainingDuration: normalizeEffectDurationSec(duration, 20, extra),
    durationUnit: 'sec',
    stacks: Math.max(1, Math.floor(Number(extra?.stacks || 1))),
    sourceId: String(sourceId || extra?.sourceId || ''),
  });
}

export function makeStatusValueEffect(name, duration = 2, sourceId = '', extra = {}) {
  return normalizeStatusEffect({
    ...extra,
    name: canonicalizeEffectName(name),
    remainingDuration: normalizeEffectDurationSec(duration, 20, extra),
    durationUnit: 'sec',
    stacks: Math.max(1, Math.floor(Number(extra?.stacks || 1))),
    sourceId: String(sourceId || extra?.sourceId || ''),
  });
}

export function makeHealReductionEffect(reductionPct = 0.45, duration = 2, sourceId = '', extra = {}) {
  return makeStatusValueEffect(EFFECT_HEAL_REDUCTION, duration, sourceId, {
    ...extra,
    healReductionPct: Math.max(0, Math.min(0.95, Number(reductionPct || 0))),
  });
}

export function makeMoveSpeedEffect(name, moveSpeedBonus = 0, duration = 2, sourceId = '', extra = {}) {
  return makeStatusValueEffect(name, duration, sourceId, {
    ...extra,
    moveSpeedBonus: Number.isFinite(Number(moveSpeedBonus)) ? Number(moveSpeedBonus) : 0,
  });
}

export function makeLifestealEffect(lifestealPct = 0.12, duration = 2, sourceId = '', extra = {}) {
  return makeStatusValueEffect(EFFECT_LIFESTEAL, duration, sourceId, {
    ...extra,
    lifestealPct: Math.max(0, Math.min(1, Number(lifestealPct || 0))),
  });
}

export function makeCooldownRateEffect(name, amount = 0.25, duration = 2, sourceId = '', extra = {}) {
  const canon = canonicalizeEffectName(name);
  const value = Math.max(0, Math.min(1.5, Number(amount || 0)));
  return makeStatusValueEffect(canon, duration, sourceId, {
    ...extra,
    cooldownRateBonus: canon === EFFECT_COOLDOWN_DOWN ? value : Number(extra?.cooldownRateBonus || 0),
    cooldownRatePenalty: canon === EFFECT_COOLDOWN_UP ? value : Number(extra?.cooldownRatePenalty || 0),
  });
}

export function normalizeStatusEffect(effect) {
  if (!effect || typeof effect !== 'object') return null;
  const meta = effectMetaByName(effect?.name);
  const next = { ...effect };
  next.name = canonicalizeEffectName(next.name);
  next.category = String(next.category || meta?.category || '').trim();
  next.tags = Array.from(
    new Set([
      ...safeTags(meta?.tags),
      ...safeTags(next.tags),
    ])
  );

  const dur = Number(next?.remainingDuration);
  if (Number.isFinite(dur)) {
    const alreadySeconds = next?.durationUnit === 'sec' || next?.durationSec != null || dur > 10;
    next.remainingDuration = Math.max(0, Math.floor(alreadySeconds ? dur : dur * 10));
    next.durationUnit = 'sec';
  }

  const dot = Number(next?.dotDamage ?? meta?.defaultDotDamage ?? 0);
  next.dotDamage = Number.isFinite(dot) ? Math.max(0, Math.floor(dot)) : 0;

  const rec = Number(next?.recovery ?? next?.recover ?? meta?.defaultRecovery ?? 0);
  next.recovery = Number.isFinite(rec) ? Math.max(0, Math.floor(rec)) : 0;

  const shield = Number(next?.shieldValue ?? next?.shield ?? next?.absorb ?? next?.amount ?? 0);
  next.shieldValue = Number.isFinite(shield) ? Math.max(0, Math.floor(shield)) : 0;

  const healReduction = Number(next?.healReductionPct ?? next?.healCutPct ?? next?.antiHealPct ?? meta?.defaultHealReductionPct ?? 0);
  next.healReductionPct = Number.isFinite(healReduction) ? Math.max(0, Math.min(0.95, healReduction)) : 0;

  const moveSpeedBonus = Number(next?.moveSpeedBonus ?? next?.moveSpeedPlus ?? meta?.defaultMoveSpeedBonus ?? 0);
  next.moveSpeedBonus = Number.isFinite(moveSpeedBonus) ? Math.max(-0.75, Math.min(1.5, moveSpeedBonus)) : 0;

  const lifestealPct = Number(next?.lifestealPct ?? next?.lifestealPlus ?? meta?.defaultLifestealPct ?? 0);
  next.lifestealPct = Number.isFinite(lifestealPct) ? Math.max(0, Math.min(1, lifestealPct)) : 0;

  const cooldownRateBonus = Number(next?.cooldownRateBonus ?? next?.cooldownDownPct ?? next?.cooldownReductionPct ?? meta?.defaultCooldownRateBonus ?? 0);
  next.cooldownRateBonus = Number.isFinite(cooldownRateBonus) ? Math.max(0, Math.min(1.5, cooldownRateBonus)) : 0;

  const cooldownRatePenalty = Number(next?.cooldownRatePenalty ?? next?.cooldownUpPct ?? meta?.defaultCooldownRatePenalty ?? 0);
  next.cooldownRatePenalty = Number.isFinite(cooldownRatePenalty) ? Math.max(0, Math.min(1.5, cooldownRatePenalty)) : 0;

  const knockbackDistance = Number(next?.knockbackDistance ?? next?.distance ?? meta?.defaultKnockbackDistance ?? 0);
  next.knockbackDistance = Number.isFinite(knockbackDistance) ? Math.max(0, Math.floor(knockbackDistance)) : 0;

  const stacks = Number(next?.stacks ?? 1);
  const maxStacks = Math.max(1, Number(next?.maxStacks ?? meta?.maxStacks ?? 1));
  next.maxStacks = maxStacks;
  next.stacks = Number.isFinite(stacks) ? Math.max(1, Math.min(maxStacks, Math.floor(stacks))) : 1;
  next.stackMode = String(next?.stackMode || meta?.stackMode || 'replace').trim();
  next.sourceId = next?.sourceId != null ? String(next.sourceId || '') : '';
  next.grantsImmunity = Array.isArray(next?.grantsImmunity)
    ? next.grantsImmunity.map((x) => canonicalizeEffectName(x)).filter(Boolean)
    : [];
  return next;
}

export function getEffectValueTotal(character, effectName, valueKey) {
  const key = canonicalizeEffectName(effectName);
  const prop = String(valueKey || '').trim();
  if (!key || !prop) return 0;
  const list = Array.isArray(character?.activeEffects) ? character.activeEffects : [];
  return list.reduce((sum, raw) => {
    const eff = normalizeStatusEffect(raw);
    if (!eff || canonicalizeEffectName(eff?.name) !== key) return sum;
    const stacks = Math.max(1, Number(eff?.stacks || 1));
    const value = Number(eff?.[prop] || 0);
    if (!Number.isFinite(value) || value <= 0) return sum;
    return sum + (value * stacks);
  }, 0);
}

export function getShieldValue(character) {
  return Math.max(0, getEffectValueTotal(character, EFFECT_SHIELD, 'shieldValue'));
}

export function getRegenValue(character) {
  return Math.max(0, getEffectValueTotal(character, EFFECT_REGEN, 'recovery'));
}

function getActiveEffects(character) {
  return (Array.isArray(character?.activeEffects) ? character.activeEffects : [])
    .map((eff) => normalizeStatusEffect(eff))
    .filter(Boolean);
}

export function getHealReductionPct(character) {
  const total = getActiveEffects(character).reduce((sum, eff) => {
    const stacks = Math.max(1, Number(eff?.stacks || 1));
    return sum + Math.max(0, Number(eff?.healReductionPct || 0)) * stacks;
  }, 0);
  return Math.max(0, Math.min(0.95, total));
}

export function applyHealingModifier(character, amount) {
  const raw = Math.max(0, Number(amount || 0));
  if (raw <= 0) return 0;
  const mult = 1 - getHealReductionPct(character);
  return Math.max(0, Math.floor(raw * Math.max(0, mult)));
}

export function getMoveSpeedStatusBonus(character) {
  const total = getActiveEffects(character).reduce((sum, eff) => {
    const stacks = Math.max(1, Number(eff?.stacks || 1));
    return sum + Number(eff?.moveSpeedBonus || 0) * stacks;
  }, 0);
  return Math.max(-0.75, Math.min(1.5, total));
}

export function getCooldownTickMultiplier(character) {
  const effects = getActiveEffects(character);
  const bonus = effects.reduce((sum, eff) => sum + Math.max(0, Number(eff?.cooldownRateBonus || 0)) * Math.max(1, Number(eff?.stacks || 1)), 0);
  const penalty = effects.reduce((sum, eff) => sum + Math.max(0, Number(eff?.cooldownRatePenalty || 0)) * Math.max(1, Number(eff?.stacks || 1)), 0);
  return Math.max(0.25, Math.min(2.5, 1 + bonus - penalty));
}

export function getLifestealPercent(character) {
  const total = getActiveEffects(character).reduce((sum, eff) => {
    const stacks = Math.max(1, Number(eff?.stacks || 1));
    return sum + Math.max(0, Number(eff?.lifestealPct || 0)) * stacks;
  }, 0);
  return Math.max(0, Math.min(1, total));
}

export function hasActionBlockStatus(character) {
  return getActiveEffects(character).some((eff) => {
    const tags = new Set([...(effectMetaByName(eff?.name)?.tags || []), ...safeTags(eff?.tags)]);
    return tags.has('action_block') || eff?.name === EFFECT_STUN || eff?.name === EFFECT_AIRBORNE;
  });
}

export function getKnockbackDistance(character) {
  return getActiveEffects(character).reduce((max, eff) => {
    const tags = new Set([...(effectMetaByName(eff?.name)?.tags || []), ...safeTags(eff?.tags)]);
    if (!tags.has('knockback') && eff?.name !== EFFECT_KNOCKBACK) return max;
    return Math.max(max, Math.max(0, Number(eff?.knockbackDistance || 0)));
  }, 0);
}

export function getEffectStacks(character, effectName) {
  const key = canonicalizeEffectName(effectName);
  const list = Array.isArray(character?.activeEffects) ? character.activeEffects : [];
  const found = list.find((eff) => canonicalizeEffectName(eff?.name) === key);
  return Math.max(0, Number(found?.stacks || 0));
}

function collectImmunities(character) {
  const out = new Set();
  const fromActor = Array.isArray(character?.statusImmunities) ? character.statusImmunities : [];
  fromActor.forEach((key) => {
    const canon = canonicalizeEffectName(key);
    if (canon) out.add(canon);
  });
  (Array.isArray(character?.activeEffects) ? character.activeEffects : []).forEach((eff) => {
    (Array.isArray(eff?.grantsImmunity) ? eff.grantsImmunity : []).forEach((key) => {
      const canon = canonicalizeEffectName(key);
      if (canon) out.add(canon);
    });
  });
  return out;
}

function getStatusResist(character, effectName) {
  const key = canonicalizeEffectName(effectName);
  const map = character?.statusResists && typeof character.statusResists === 'object'
    ? character.statusResists
    : {};
  const raw = Number(map?.[key] || 0);
  if (!Number.isFinite(raw)) return 0;
  const ratio = Math.abs(raw) > 1 ? raw / 100 : raw;
  return Math.max(0, Math.min(0.95, ratio));
}

export function hasEffectImmunity(character, effectLike, opts = {}) {
  const key = canonicalizeEffectName(effectLike?.name || effectLike);
  if (!key) return { immune: false, resisted: false, resistRoll: 0 };
  const immunities = collectImmunities(character);
  if (immunities.has(key)) return { immune: true, resisted: false, resistRoll: 1 };
  const resist = getStatusResist(character, key);
  const rng = typeof opts?.random === 'function' ? opts.random : Math.random;
  if (resist > 0 && rng() < resist) return { immune: false, resisted: true, resistRoll: resist };
  return { immune: false, resisted: false, resistRoll: resist };
}

export function addOrRefreshEffect(character, effect, opts = {}) {
  const normalized = normalizeStatusEffect(effect);
  const baseList = Array.isArray(character?.activeEffects)
    ? character.activeEffects.map((eff) => normalizeStatusEffect(eff)).filter(Boolean)
    : [];
  if (!normalized) {
    return { character: { ...(character || {}), activeEffects: baseList }, applied: false, reason: 'invalid' };
  }

  const immunity = hasEffectImmunity(character, normalized, opts);
  if (immunity.immune) {
    return { character: { ...(character || {}), activeEffects: baseList }, applied: false, reason: 'immune', effect: normalized };
  }
  if (immunity.resisted) {
    return {
      character: { ...(character || {}), activeEffects: baseList },
      applied: false,
      reason: 'resisted',
      effect: normalized,
      resistRoll: immunity.resistRoll,
    };
  }

  const idx = baseList.findIndex((eff) => canonicalizeEffectName(eff?.name) === normalized.name);
  let activeEffects = baseList;
  let applied = false;
  let stacked = false;
  let refreshed = false;

  if (idx >= 0) {
    const prev = baseList[idx];
    let next = { ...prev, ...normalized };
    switch (normalized.stackMode) {
      case 'refresh_max':
        next.remainingDuration = Math.max(Number(prev?.remainingDuration || 0), Number(normalized?.remainingDuration || 0));
        next.stacks = Math.min(Number(prev?.maxStacks || normalized.maxStacks || 1), Math.max(Number(prev?.stacks || 1), Number(normalized?.stacks || 1)));
        refreshed = true;
        break;
      case 'stack_refresh':
        next.remainingDuration = Math.max(Number(prev?.remainingDuration || 0), Number(normalized?.remainingDuration || 0));
        next.stacks = Math.min(Number(prev?.maxStacks || normalized.maxStacks || 1), Number(prev?.stacks || 1) + Math.max(1, Number(normalized?.stacks || 1)));
        stacked = next.stacks > Number(prev?.stacks || 1);
        refreshed = true;
        break;
      case 'refresh_only':
        next.remainingDuration = Math.max(Number(prev?.remainingDuration || 0), Number(normalized?.remainingDuration || 0));
        next.stacks = Math.max(1, Number(prev?.stacks || 1));
        refreshed = true;
        break;
      default:
        refreshed = true;
        break;
    }
    activeEffects = [...baseList];
    activeEffects[idx] = normalizeStatusEffect(next);
    applied = true;
  } else {
    activeEffects = [...baseList, normalized];
    applied = true;
    stacked = Number(normalized?.stacks || 1) > 1;
  }

  return {
    character: { ...(character || {}), activeEffects },
    applied,
    refreshed,
    stacked,
    effect: activeEffects.find((eff) => canonicalizeEffectName(eff?.name) === normalized.name) || normalized,
  };
}

export function absorbShieldDamage(character, rawDamage) {
  const incoming = Math.max(0, Math.floor(Number(rawDamage || 0)));
  const list = Array.isArray(character?.activeEffects)
    ? character.activeEffects.map((eff) => normalizeStatusEffect(eff)).filter(Boolean)
    : [];
  if (incoming <= 0 || !list.length) {
    return {
      character: { ...(character || {}), activeEffects: list },
      damage: incoming,
      absorbed: 0,
      broken: false,
      depleted: [],
    };
  }

  let remain = incoming;
  let absorbed = 0;
  let broken = false;
  const depleted = [];
  const nextEffects = [];

  list.forEach((eff) => {
    if (!eff) return;
    if (canonicalizeEffectName(eff?.name) !== EFFECT_SHIELD) {
      nextEffects.push(eff);
      return;
    }
    const cur = Math.max(0, Number(eff?.shieldValue || 0));
    if (cur <= 0) return;
    if (remain <= 0) {
      nextEffects.push(eff);
      return;
    }
    const soak = Math.min(cur, remain);
    remain -= soak;
    absorbed += soak;
    const left = cur - soak;
    if (left > 0) nextEffects.push(normalizeStatusEffect({ ...eff, shieldValue: left }));
    else {
      broken = true;
      depleted.push(eff);
    }
  });

  return {
    character: { ...(character || {}), activeEffects: nextEffects },
    damage: remain,
    absorbed,
    broken,
    depleted,
  };
}

export function purgeNegativeEffects(character, opts = {}) {
  const names = new Set(
    (Array.isArray(opts?.names) ? opts.names : [])
      .map((x) => canonicalizeEffectName(x))
      .filter(Boolean)
  );
  const removeAllNegative = opts?.removeAllNegative === true;
  const list = Array.isArray(character?.activeEffects)
    ? character.activeEffects.map((eff) => normalizeStatusEffect(eff)).filter(Boolean)
    : [];
  const removed = [];
  const kept = list.filter((eff) => {
    const meta = effectMetaByName(eff?.name);
    const isNegative = safeTags(eff?.tags).includes('negative') || safeTags(meta?.tags).includes('negative') || String(eff?.category || meta?.category || '') === 'debuff';
    const shouldRemove = names.has(canonicalizeEffectName(eff?.name)) || (removeAllNegative && isNegative);
    if (shouldRemove) removed.push(eff);
    return !shouldRemove;
  });
  return {
    character: { ...(character || {}), activeEffects: kept },
    removed,
    changed: removed.length > 0,
  };
}

export function getEffectiveStats(character) {
  const effective = applyMasteryStatBonuses(getEffectiveErStats(character), character);

  (Array.isArray(character?.activeEffects) ? character.activeEffects : []).forEach((raw) => {
    const effect = normalizeStatusEffect(raw);
    if (!effect) return;
    const stacks = Math.max(1, Number(effect?.stacks || 1));

    const meta = effectMetaByName(effect.name);
    const statMods = effect.statModifiers && typeof effect.statModifiers === 'object'
      ? effect.statModifiers
      : (meta?.statModifiers && typeof meta.statModifiers === 'object' ? meta.statModifiers : null);
    const normalizedStatMods = statMods ? normalizeErStatDeltaMap(statMods) : null;
    if (normalizedStatMods) {
      Object.keys(normalizedStatMods).forEach((stat) => {
        const delta = Number(normalizedStatMods[stat] || 0);
        if (!Number.isFinite(delta)) return;
        effective[stat] = Number(effective[stat] || 0) + (delta * stacks);
      });
    }

    const multipliers = effect?.statMultipliers && typeof effect.statMultipliers === 'object'
      ? effect.statMultipliers
      : (meta?.statMultipliers || null);
    if (multipliers) {
      Object.keys(multipliers).forEach((stat) => {
        if (!ER_STAT_KEYS.includes(stat)) return;
        const mul = Number(multipliers[stat] || 1);
        if (!Number.isFinite(mul)) return;
        effective[stat] = Number(effective[stat] || 0) * mul;
      });
    }
  });

  Object.keys(effective).forEach((key) => {
    if (key === 'attackSpeed') effective[key] = Math.max(0.1, effective[key]);
    else if (key === 'skillAmp') effective[key] = Math.max(0, effective[key]);
    else if (effective[key] < 1) effective[key] = 1;
  });

  return normalizeErStats(effective, { round: false });
}

export function updateEffects(character, opts = {}) {
  const activeEffects = Array.isArray(character?.activeEffects)
    ? character.activeEffects.map((eff) => normalizeStatusEffect(eff)).filter(Boolean)
    : [];

  let hpChange = 0;
  const ticks = [];
  const expired = [];
  const elapsedSec = Math.max(1, Math.floor(Number(opts?.elapsedSec ?? opts?.deltaSec ?? 1)));
  const tickCount = Math.max(1, elapsedSec);

  const nextEffects = activeEffects
    .map((eff) => {
      const meta = effectMetaByName(eff?.name);
      const tags = new Set([...(meta?.tags || []), ...safeTags(eff?.tags)]);
      const stacks = Math.max(1, Number(eff?.stacks || 1));
      const dotDamage = Math.max(0, Number(eff?.dotDamage || meta?.defaultDotDamage || 0));
      const recovery = Math.max(0, Number(eff?.recovery || meta?.defaultRecovery || 0));
      const remainingBefore = Number(eff?.remainingDuration);
      const activeSec = Number.isFinite(remainingBefore)
        ? Math.max(0, Math.min(elapsedSec, Math.floor(remainingBefore)))
        : tickCount;

      if (activeSec > 0 && dotDamage > 0 && tags.has('dot')) {
        const dmg = dotDamage * stacks * activeSec;
        hpChange -= dmg;
        ticks.push({ type: 'damage', name: eff.name, amount: dmg, stacks, seconds: activeSec });
      }
      if (activeSec > 0 && recovery > 0 && tags.has('regen')) {
        const heal = applyHealingModifier(character, recovery * stacks * activeSec);
        hpChange += heal;
        ticks.push({ type: 'heal', name: eff.name, amount: heal, stacks, seconds: activeSec });
      }

      if (eff?.remainingDuration == null) return eff;
      const remainingDuration = Math.max(0, Number(eff.remainingDuration || 0) - elapsedSec);
      const next = normalizeStatusEffect({ ...eff, remainingDuration, durationUnit: 'sec' });
      if (remainingDuration <= 0) expired.push(next);
      return next;
    })
    .filter((eff) => Number(eff?.remainingDuration ?? 1) > 0);

  const maxHp = Math.max(1, Number(character?.maxHp || character?.hp || 100));
  const nextCharacter = {
    ...(character || {}),
    activeEffects: nextEffects,
    hp: Math.max(0, Math.min(maxHp, Number(character?.hp || 0) + hpChange)),
  };

  if (!opts?.returnMeta) return nextCharacter;
  return {
    character: nextCharacter,
    hpChange,
    ticks,
    expired,
  };
}
