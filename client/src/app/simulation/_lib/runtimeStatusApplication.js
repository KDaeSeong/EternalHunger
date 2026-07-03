import {
  EFFECT_AIRBORNE,
  EFFECT_BURN,
  EFFECT_COOLDOWN_UP,
  EFFECT_HEAL_REDUCTION,
  EFFECT_KNOCKBACK,
  EFFECT_POISON,
  EFFECT_REGEN,
  EFFECT_SHIELD,
  EFFECT_SLOW,
  EFFECT_STUN,
  absorbShieldDamage,
  addOrRefreshEffect,
  canonicalizeEffectName,
  normalizeStatusEffectList,
  purgeNegativeEffects,
} from '../../../utils/statusLogic';
import { normalizeRuntimeEffect } from './runtimeStatusNormalization';

export function getEffectIndex(character, effectName) {
  const list = Array.isArray(character?.activeEffects) ? character.activeEffects : [];
  const key = canonicalizeEffectName(effectName);
  return list.findIndex((e) => canonicalizeEffectName(e?.name) === key);
}

export function hasActiveEffect(character, effectName) {
  return getEffectIndex(character, effectName) >= 0;
}

export function removeActiveEffect(character, effectName) {
  const list = Array.isArray(character?.activeEffects) ? character.activeEffects : [];
  const key = canonicalizeEffectName(effectName);
  const next = list.filter((e) => canonicalizeEffectName(e?.name || '') !== key);
  const removed = next.length !== list.length;
  if (removed) character.activeEffects = next;
  return removed;
}

export function applyStatusEffect(actor, effect, opts = {}) {
  if (!actor || typeof actor !== 'object') return { applied: false, reason: 'invalid' };
  const res = addOrRefreshEffect(actor, effect, opts);
  actor.activeEffects = Array.isArray(res?.character?.activeEffects)
    ? res.character.activeEffects.map((x) => normalizeRuntimeEffect(x)).filter(Boolean)
    : [];
  return res;
}

export function clearNegativeStatusEffects(actor, opts = {}) {
  if (!actor || typeof actor !== 'object') return { changed: false, removed: [] };
  const res = purgeNegativeEffects(actor, opts);
  actor.activeEffects = Array.isArray(res?.character?.activeEffects)
    ? res.character.activeEffects.map((x) => normalizeRuntimeEffect(x)).filter(Boolean)
    : [];
  return { changed: !!res?.changed, removed: Array.isArray(res?.removed) ? res.removed : [] };
}

export function applyShieldEffect(actor, shieldValue, duration = 2, sourceId = '') {
  const shield = Math.max(0, Math.floor(Number(shieldValue || 0)));
  if (!actor || shield <= 0) return { applied: false, shield: 0 };
  const res = applyStatusEffect(actor, {
    name: EFFECT_SHIELD,
    shieldValue: shield,
    remainingDuration: Math.max(1, Math.floor(Number(duration || 1))),
    stacks: 1,
    sourceId: String(sourceId || ''),
  });
  return { applied: !!res?.applied, shield };
}

export function applyRegenEffect(actor, recovery, duration = 2, sourceId = '') {
  const rec = Math.max(0, Math.floor(Number(recovery || 0)));
  if (!actor || rec <= 0) return { applied: false, recovery: 0 };
  const res = applyStatusEffect(actor, {
    name: EFFECT_REGEN,
    recovery: rec,
    remainingDuration: Math.max(1, Math.floor(Number(duration || 1))),
    stacks: 1,
    sourceId: String(sourceId || ''),
  });
  return { applied: !!res?.applied, recovery: rec };
}

export function applyRuntimeEffectPayloads(actor, effects) {
  const list = normalizeStatusEffectList(effects).map((x) => normalizeRuntimeEffect(x)).filter(Boolean);
  const results = [];
  list.forEach((effect) => {
    const res = applyStatusEffect(actor, effect);
    results.push({ ...res, effect });
  });
  return {
    results,
    applied: results.some((x) => !!x?.applied),
  };
}

export function consumeShieldDamage(actor, rawDamage) {
  const result = absorbShieldDamage(actor, rawDamage);
  actor.activeEffects = Array.isArray(result?.character?.activeEffects)
    ? result.character.activeEffects.map((x) => normalizeRuntimeEffect(x)).filter(Boolean)
    : [];
  return result;
}

export function clearPostCombatEffects(actor) {
  if (!actor || typeof actor !== 'object') return false;
  const res = clearNegativeStatusEffects(actor, {
    names: [
      EFFECT_POISON,
      EFFECT_BURN,
      EFFECT_AIRBORNE,
      EFFECT_HEAL_REDUCTION,
      EFFECT_STUN,
      EFFECT_KNOCKBACK,
      EFFECT_SLOW,
      EFFECT_COOLDOWN_UP,
    ],
    removeAllNegative: false,
  });
  actor.activeEffects = Array.isArray(actor.activeEffects) ? actor.activeEffects.map((x) => normalizeRuntimeEffect(x)).filter(Boolean) : [];
  return !!res.changed;
}
