import {
  EFFECT_AIRBORNE,
  EFFECT_KNOCKBACK,
  EFFECT_REGEN,
  EFFECT_SHIELD,
  EFFECT_STUN,
  canonicalizeEffectName,
  effectMetaByName,
  normalizeStatusEffect,
  safeTags,
} from './statusEffectDefinitions';

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
