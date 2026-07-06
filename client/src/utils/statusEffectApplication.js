import {
  EFFECT_SHIELD,
  canonicalizeEffectName,
  effectMetaByName,
  normalizeStatusEffect,
  safeTags,
} from './statusEffectDefinitions.js';
import { applyHealingModifier } from './statusEffectSelectors.js';

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
    const next = { ...prev, ...normalized };
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
