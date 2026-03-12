// client/src/utils/statusLogic.js

export const EFFECT_BLEED = '출혈';
export const EFFECT_POISON = '중독';
export const EFFECT_BURN = '화상';
export const EFFECT_FOOD_POISON = '식중독';
export const EFFECT_SHIELD = '보호막';
export const EFFECT_REGEN = '재생';
export const EFFECT_FOCUS = '집중';
export const EFFECT_STIM = '각성';

const EFFECT_NAME_ALIASES = {
  출혈: EFFECT_BLEED,
  bleed: EFFECT_BLEED,
  bleeding: EFFECT_BLEED,
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
};

export const EFFECT_META = {
  [EFFECT_BLEED]: {
    icon: '🩸',
    category: 'debuff',
    tags: ['negative', 'dot', 'bleed', 'physical'],
    defaultDotDamage: 6,
    stackMode: 'refresh_max',
    maxStacks: 3,
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
    statMultipliers: { end: 0.5 },
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
    statModifiers: { int: 5, men: 2 },
  },
  [EFFECT_STIM]: {
    icon: '⚡',
    category: 'buff',
    tags: ['positive', 'stim', 'combat'],
    stackMode: 'refresh_only',
    maxStacks: 1,
    statModifiers: { agi: 3, luk: 2 },
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

export function normalizeStatusEffectList(effects) {
  const list = Array.isArray(effects) ? effects : (effects ? [effects] : []);
  return list.map((eff) => normalizeStatusEffect(eff)).filter(Boolean);
}

export function makeShieldEffect(shieldValue, duration = 2, sourceId = '', extra = {}) {
  return normalizeStatusEffect({
    ...extra,
    name: EFFECT_SHIELD,
    shieldValue: Math.max(0, Math.floor(Number(shieldValue || 0))),
    remainingDuration: Math.max(1, Math.floor(Number(duration || 1))),
    stacks: Math.max(1, Math.floor(Number(extra?.stacks || 1))),
    sourceId: String(sourceId || extra?.sourceId || ''),
  });
}

export function makeRegenEffect(recovery, duration = 2, sourceId = '', extra = {}) {
  return normalizeStatusEffect({
    ...extra,
    name: EFFECT_REGEN,
    recovery: Math.max(0, Math.floor(Number(recovery || 0))),
    remainingDuration: Math.max(1, Math.floor(Number(duration || 1))),
    stacks: Math.max(1, Math.floor(Number(extra?.stacks || 1))),
    sourceId: String(sourceId || extra?.sourceId || ''),
  });
}

export function makeStatBuffEffect(name, statModifiers = {}, duration = 2, sourceId = '', extra = {}) {
  const cleanedStats = Object.fromEntries(
    Object.entries(statModifiers && typeof statModifiers === 'object' ? statModifiers : {}).filter(([, v]) => Number.isFinite(Number(v)) && Number(v) !== 0)
  );
  return normalizeStatusEffect({
    ...extra,
    name: canonicalizeEffectName(name),
    statModifiers: cleanedStats,
    remainingDuration: Math.max(1, Math.floor(Number(duration || 1))),
    stacks: Math.max(1, Math.floor(Number(extra?.stacks || 1))),
    sourceId: String(sourceId || extra?.sourceId || ''),
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
  if (Number.isFinite(dur)) next.remainingDuration = Math.max(0, Math.floor(dur));

  const dot = Number(next?.dotDamage ?? meta?.defaultDotDamage ?? 0);
  next.dotDamage = Number.isFinite(dot) ? Math.max(0, Math.floor(dot)) : 0;

  const rec = Number(next?.recovery ?? next?.recover ?? meta?.defaultRecovery ?? 0);
  next.recovery = Number.isFinite(rec) ? Math.max(0, Math.floor(rec)) : 0;

  const shield = Number(next?.shieldValue ?? next?.shield ?? next?.absorb ?? next?.amount ?? 0);
  next.shieldValue = Number.isFinite(shield) ? Math.max(0, Math.floor(shield)) : 0;

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
  const effective = { ...(character?.stats || {}) };

  (Array.isArray(character?.activeEffects) ? character.activeEffects : []).forEach((raw) => {
    const effect = normalizeStatusEffect(raw);
    if (!effect) return;
    const stacks = Math.max(1, Number(effect?.stacks || 1));

    const meta = effectMetaByName(effect.name);
    const statMods = effect.statModifiers && typeof effect.statModifiers === 'object'
      ? effect.statModifiers
      : (meta?.statModifiers && typeof meta.statModifiers === 'object' ? meta.statModifiers : null);
    if (statMods) {
      Object.keys(statMods).forEach((stat) => {
        const delta = Number(statMods[stat] || 0);
        if (!Number.isFinite(delta)) return;
        effective[stat] = Number(effective[stat] || 0) + (delta * stacks);
      });
    }

    const multipliers = effect?.statMultipliers && typeof effect.statMultipliers === 'object'
      ? effect.statMultipliers
      : (meta?.statMultipliers || null);
    if (multipliers) {
      Object.keys(multipliers).forEach((stat) => {
        const mul = Number(multipliers[stat] || 1);
        if (!Number.isFinite(mul)) return;
        effective[stat] = Math.floor(Number(effective[stat] || 0) * mul);
      });
    }
  });

  Object.keys(effective).forEach((key) => {
    if (effective[key] < 1) effective[key] = 1;
  });

  return effective;
}

export function updateEffects(character, opts = {}) {
  const activeEffects = Array.isArray(character?.activeEffects)
    ? character.activeEffects.map((eff) => normalizeStatusEffect(eff)).filter(Boolean)
    : [];

  let hpChange = 0;
  const ticks = [];
  const expired = [];

  const nextEffects = activeEffects
    .map((eff) => {
      const meta = effectMetaByName(eff?.name);
      const tags = new Set([...(meta?.tags || []), ...safeTags(eff?.tags)]);
      const stacks = Math.max(1, Number(eff?.stacks || 1));
      const dotDamage = Math.max(0, Number(eff?.dotDamage || meta?.defaultDotDamage || 0));
      const recovery = Math.max(0, Number(eff?.recovery || meta?.defaultRecovery || 0));

      if (dotDamage > 0 && tags.has('dot')) {
        const dmg = dotDamage * stacks;
        hpChange -= dmg;
        ticks.push({ type: 'damage', name: eff.name, amount: dmg, stacks });
      }
      if (recovery > 0 && tags.has('regen')) {
        const heal = recovery * stacks;
        hpChange += heal;
        ticks.push({ type: 'heal', name: eff.name, amount: heal, stacks });
      }

      if (eff?.remainingDuration == null) return eff;
      const remainingDuration = Math.max(0, Number(eff.remainingDuration || 0) - 1);
      const next = normalizeStatusEffect({ ...eff, remainingDuration });
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
