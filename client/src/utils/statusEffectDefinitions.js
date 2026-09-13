import { normalizeErStatDeltaMap } from './erStats.js';

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
export const EFFECT_ROOT = '속박';
export const EFFECT_SILENCE = '침묵';
export const EFFECT_INVULNERABLE = '무적';
export const EFFECT_UNTARGETABLE = '대상 지정 불가';
export const EFFECT_BLIND = '실명';
export const EFFECT_EVADE = '회피';
export const EFFECT_KNOCKBACK = '넉백';
export const EFFECT_SLOW = '이동 속도 감소';
export const EFFECT_LIFESTEAL = '흡혈';
export const EFFECT_HASTE = '이동 속도 증가';
export const EFFECT_COOLDOWN_UP = '쿨다운 증가';
export const EFFECT_COOLDOWN_DOWN = '쿨다운 감소';
export const EFFECT_MOVEMENT_IMMUNE = '이동 방해 면역';
export const EFFECT_UNSTOPPABLE = '저지 불가';
export const EFFECT_CC_IMMUNE = '모든 방해 면역';
export const EFFECT_HARMFUL_IMMUNE = '해로운 효과 면역';
export const EFFECT_CLEANSE = '해로운 효과 제거';
export const EFFECT_FEAR = '공포';
export const EFFECT_CHARM = '매혹';
export const EFFECT_TAUNT = '도발';
export const EFFECT_SLEEP = '수면';
export const EFFECT_POLYMORPH = '변이';
export const EFFECT_SUPPRESSION = '제압';
export const EFFECT_STASIS = '경직';

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
  속박: EFFECT_ROOT,
  root: EFFECT_ROOT,
  rooted: EFFECT_ROOT,
  침묵: EFFECT_SILENCE,
  silence: EFFECT_SILENCE,
  silenced: EFFECT_SILENCE,
  무적: EFFECT_INVULNERABLE,
  invulnerable: EFFECT_INVULNERABLE,
  invulnerability: EFFECT_INVULNERABLE,
  '대상 지정 불가': EFFECT_UNTARGETABLE,
  untargetable: EFFECT_UNTARGETABLE,
  실명: EFFECT_BLIND,
  blind: EFFECT_BLIND,
  blinded: EFFECT_BLIND,
  회피: EFFECT_EVADE,
  evade: EFFECT_EVADE,
  evasion: EFFECT_EVADE,
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
  movement_cc_immune: EFFECT_MOVEMENT_IMMUNE,
  unstoppable: EFFECT_UNSTOPPABLE,
  cc_immune: EFFECT_CC_IMMUNE,
  harmful_immune: EFFECT_HARMFUL_IMMUNE,
  cleanse: EFFECT_CLEANSE,
  fear: EFFECT_FEAR,
  charm: EFFECT_CHARM,
  taunt: EFFECT_TAUNT,
  sleep: EFFECT_SLEEP,
  polymorph: EFFECT_POLYMORPH,
  suppression: EFFECT_SUPPRESSION,
  stasis: EFFECT_STASIS,
};

export const EFFECT_META = {
  [EFFECT_SLEEP]: {
    icon: '💤', category: 'debuff', tags: ['negative', 'cc', 'action_block', 'wake_on_hit'],
    // Project defaults; the supplied reference does not specify these values.
    defaultWakeDamagePct: 0.2, stackMode: 'refresh_max', maxStacks: 1,
  },
  [EFFECT_POLYMORPH]: {
    icon: '🐑', category: 'debuff', tags: ['negative', 'cc', 'basic_block', 'skill_block', 'polymorph'],
    defaultMoveSpeedBonus: -0.5, stackMode: 'refresh_max', maxStacks: 1,
  },
  [EFFECT_SUPPRESSION]: {
    icon: '🔒', category: 'debuff', tags: ['negative', 'cc', 'action_block', 'movement_interrupt'],
    stackMode: 'refresh_max', maxStacks: 1,
  },
  [EFFECT_STASIS]: {
    icon: '⏸️', category: 'buff', tags: ['positive', 'action_block', 'untargetable', 'damage_immune', 'collar_pause'],
    stackMode: 'refresh_max', maxStacks: 1,
  },
  ...Object.fromEntries([[EFFECT_FEAR, 'fear', '😨'], [EFFECT_CHARM, 'charm', '💗'], [EFFECT_TAUNT, 'taunt', '🎯']]
    .map(([name, forcedControl, icon]) => [name, { icon, forcedControl, category: 'debuff',
      tags: ['negative', 'cc', 'skill_block', 'voluntary_block', ...(forcedControl === 'taunt' ? [] : ['basic_block'])],
      stackMode: 'refresh_max', maxStacks: 1 }])),
  ...Object.fromEntries([EFFECT_MOVEMENT_IMMUNE, EFFECT_UNSTOPPABLE, EFFECT_CC_IMMUNE, EFFECT_HARMFUL_IMMUNE]
    .map((name) => [name, { icon: '🛡️', category: 'buff', tags: ['positive', 'status_protection'], stackMode: 'refresh_max', maxStacks: 1 }])),
  [EFFECT_CLEANSE]: { icon: '✨', category: 'action', tags: ['positive', 'cleanse'], maxStacks: 1 },
  [EFFECT_ROOT]: {
    icon: '⛓️', category: 'debuff', tags: ['negative', 'cc', 'move_block'],
    stackMode: 'refresh_max', maxStacks: 1,
  },
  [EFFECT_SILENCE]: {
    icon: '🔇', category: 'debuff', tags: ['negative', 'cc', 'skill_block'],
    stackMode: 'refresh_max', maxStacks: 1,
  },
  [EFFECT_INVULNERABLE]: {
    icon: '🛡️', category: 'buff', tags: ['positive', 'damage_immune'],
    stackMode: 'refresh_max', maxStacks: 1,
  },
  [EFFECT_UNTARGETABLE]: {
    icon: '👻', category: 'buff', tags: ['positive', 'untargetable'],
    stackMode: 'refresh_max', maxStacks: 1,
  },
  [EFFECT_BLIND]: {
    icon: '🙈', category: 'debuff', tags: ['negative', 'cc', 'basic_miss'],
    stackMode: 'refresh_max', maxStacks: 1,
  },
  [EFFECT_EVADE]: {
    icon: '💨', category: 'buff', tags: ['positive', 'basic_evade'],
    stackMode: 'refresh_max', maxStacks: 1,
  },
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
    tags: ['negative', 'cc', 'slow', 'move'],
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

export function safeTags(value) {
  if (!Array.isArray(value)) return [];
  return value.map((x) => String(x || '').trim().toLowerCase()).filter(Boolean);
}

export function canonicalizeEffectName(name) {
  const raw = String(name || '').trim();
  if (!raw) return '';
  return EFFECT_NAME_ALIASES[raw.toLowerCase()] || EFFECT_NAME_ALIASES[raw] || raw;
}

export function effectMetaByName(name) {
  return EFFECT_META[canonicalizeEffectName(name)] || null;
}

function normalizeEffectDurationSec(duration, fallbackSec = 10, extra = {}) {
  const raw = Number(extra?.durationSec ?? extra?.seconds ?? duration ?? fallbackSec);
  if (!Number.isFinite(raw)) return Math.max(1, Math.floor(Number(fallbackSec || 1)));
  const alreadySeconds = extra?.durationUnit === 'sec' || extra?.durationSec != null || extra?.seconds != null || raw > 10;
  const sec = alreadySeconds ? raw : raw * 10;
  return Math.max(0.000001, Math.round(sec * 1e6) / 1e6);
}

export function normalizeStatusEffectList(effects) {
  const list = Array.isArray(effects) ? effects : (effects ? [effects] : []);
  return list.map((eff) => normalizeStatusEffect(eff)).filter(Boolean);
}

// Effects without a duration are persistent. An explicitly expired effect
// must never confer stats, immunities, shields or action restrictions.
export function getStoredActiveStatusEffects(character) {
  return normalizeStatusEffectList(character?.activeEffects)
    .filter((effect) => effect.remainingDuration == null || Number(effect.remainingDuration) > 0);
}

// Classification follows the user's supplied categories. Classifying a name
// does not implement its movement, targeting or special skill behaviour.
const MOVEMENT_CONTROL_NAMES = new Set(['공포', EFFECT_STUN, EFFECT_KNOCKBACK, '도발', EFFECT_SLOW,
  '매혹', EFFECT_ROOT, EFFECT_AIRBORNE, '제압', '춤']);
const CONTROL_NAMES = new Set([...MOVEMENT_CONTROL_NAMES, '수면', '공격 속도 감소', '변이', '붙잡힘',
  '시야 차단', EFFECT_BLIND, EFFECT_SILENCE, '정신 이상']);
const DURATION_RESIST_EXCLUSIONS = new Set([EFFECT_KNOCKBACK, '붙잡힘', EFFECT_AIRBORNE, '제압']);
const PROTECTION_NAMES = new Set([EFFECT_MOVEMENT_IMMUNE, EFFECT_UNSTOPPABLE, EFFECT_CC_IMMUNE, EFFECT_HARMFUL_IMMUNE]);

export function isCrowdControlEffect(effect) {
  const name = canonicalizeEffectName(effect?.name || effect);
  return CONTROL_NAMES.has(name) || safeTags(effect?.tags).includes('cc') || safeTags(effectMetaByName(name)?.tags).includes('cc');
}

export function isHarmfulStatusEffect(effect) {
  const meta = effectMetaByName(effect?.name);
  return isCrowdControlEffect(effect) || safeTags(effect?.tags).includes('negative')
    || safeTags(meta?.tags).includes('negative') || String(effect?.category || meta?.category || '') === 'debuff';
}

export function canReduceControlDuration(effect) {
  return isCrowdControlEffect(effect) && !DURATION_RESIST_EXCLUSIONS.has(canonicalizeEffectName(effect?.name));
}

function protectionNames(character, stored) {
  return new Set([...(Array.isArray(character?.statusImmunities) ? character.statusImmunities : []),
    ...stored.flatMap((effect) => [effect.name, ...effect.grantsImmunity])].map(canonicalizeEffectName).filter((name) => PROTECTION_NAMES.has(name)));
}

function protectionReason(effect, protections) {
  if (PROTECTION_NAMES.has(canonicalizeEffectName(effect?.name))) return '';
  if (protections.has(EFFECT_HARMFUL_IMMUNE) && isHarmfulStatusEffect(effect)) return EFFECT_HARMFUL_IMMUNE;
  if (protections.has(EFFECT_CC_IMMUNE) && isCrowdControlEffect(effect)) return EFFECT_CC_IMMUNE;
  if (protections.has(EFFECT_MOVEMENT_IMMUNE) && (MOVEMENT_CONTROL_NAMES.has(canonicalizeEffectName(effect?.name))
    || safeTags(effect?.tags).includes('movement_cc'))) return EFFECT_MOVEMENT_IMMUNE;
  if (protections.has(EFFECT_UNSTOPPABLE) && isCrowdControlEffect(effect)) return EFFECT_UNSTOPPABLE;
  return '';
}

export function getStatusProtectionReason(character, effect, stored = getStoredActiveStatusEffects(character)) {
  return protectionReason(effect, protectionNames(character, stored));
}

export function getActiveStatusEffects(character) {
  const stored = getStoredActiveStatusEffects(character);
  const protections = protectionNames(character, stored);
  if (!protections.size) return stored;
  // Ignoring is not cleansing: retained effects keep ticking and can resume
  // for their remaining duration when temporary protection expires.
  return stored.filter((effect) => !protectionReason(effect, protections));
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
  if (next.remainingDuration != null && Number.isFinite(dur)) {
    const alreadySeconds = next?.durationUnit === 'sec' || next?.durationSec != null || dur > 10;
    next.remainingDuration = Math.max(0, Math.round((alreadySeconds ? dur : dur * 10) * 1e6) / 1e6);
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

  if (next.wakeDamagePct != null || meta?.defaultWakeDamagePct != null) {
    const wakeDamagePct = Number(next.wakeDamagePct ?? meta.defaultWakeDamagePct);
    next.wakeDamagePct = Number.isFinite(wakeDamagePct) ? Math.max(0, Math.min(1, wakeDamagePct)) : 0;
  }

  const lifestealPct = Number(next?.lifestealPct ?? next?.lifestealPlus ?? meta?.defaultLifestealPct ?? 0);
  next.lifestealPct = Number.isFinite(lifestealPct) ? Math.max(0, Math.min(1, lifestealPct)) : 0;

  const cooldownRateBonus = Number(next?.cooldownRateBonus ?? next?.cooldownDownPct ?? next?.cooldownReductionPct ?? meta?.defaultCooldownRateBonus ?? 0);
  next.cooldownRateBonus = Number.isFinite(cooldownRateBonus) ? Math.max(0, Math.min(1.5, cooldownRateBonus)) : 0;

  const cooldownRatePenalty = Number(next?.cooldownRatePenalty ?? next?.cooldownUpPct ?? meta?.defaultCooldownRatePenalty ?? 0);
  next.cooldownRatePenalty = Number.isFinite(cooldownRatePenalty) ? Math.max(0, Math.min(1.5, cooldownRatePenalty)) : 0;

  const knockbackDistance = Number(next?.knockbackDistance ?? next?.distance ?? meta?.defaultKnockbackDistance ?? 0);
  const roundedKnockbackDistance = Math.round(knockbackDistance * 1e6) / 1e6;
  next.knockbackDistance = Number.isFinite(knockbackDistance)
    ? Math.max(0, Number.isFinite(roundedKnockbackDistance) ? roundedKnockbackDistance : knockbackDistance) : 0;

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
