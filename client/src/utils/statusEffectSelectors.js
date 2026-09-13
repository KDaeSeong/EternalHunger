import {
  EFFECT_AIRBORNE,
  EFFECT_KNOCKBACK,
  EFFECT_REGEN,
  EFFECT_SHIELD,
  EFFECT_STUN,
  canonicalizeEffectName,
  effectMetaByName,
  getActiveStatusEffects,
  safeTags,
} from './statusEffectDefinitions.js';
import { getCombatSpaceId, shareCombatSpace } from './combatSpaceLogic.js';
import { isDimensionRiftDefeated } from './dimensionRiftDefeatLogic.js';

export function getEffectValueTotal(character, effectName, valueKey) {
  const key = canonicalizeEffectName(effectName);
  const prop = String(valueKey || '').trim();
  if (!key || !prop) return 0;
  return getActiveStatusEffects(character).reduce((sum, eff) => {
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

const getActiveEffects = getActiveStatusEffects;

function hasStatusTag(character, tag) {
  return getActiveEffects(character).some((effect) => effect.tags.includes(tag));
}

export function hasMovementInterruptStatus(character) {
  return hasStatusTag(character, 'movement_interrupt');
}

export function getCollarPausedSeconds(character, elapsedSec, offsetSec = 0) {
  const elapsed = Math.max(0, Number(elapsedSec) || 0);
  const offset = Math.max(0, Number(offsetSec) || 0);
  return getActiveEffects(character).reduce((max, effect) => {
    if (!effect.tags.includes('collar_pause')) return max;
    const remaining = effect.remainingDuration == null ? Infinity : Number(effect.remainingDuration) - offset;
    return Math.max(max, Math.min(elapsed, Math.max(0, remaining)));
  }, 0);
}

export function isForcedControlEffect(effect) {
  return Boolean(effectMetaByName(effect?.name)?.forcedControl);
}

export function getForcedControlEffect(character) {
  return getActiveEffects(character).filter(isForcedControlEffect)
    .reduce((latest, effect) => !latest || Number(effect.controlSerial || 0) >= Number(latest.controlSerial || 0)
      ? { ...effect, mode: effectMetaByName(effect.name).forcedControl } : latest, null);
}

export function canActVoluntarilyByStatus(character) {
  return !hasActionBlockStatus(character) && !hasStatusTag(character, 'voluntary_block');
}

export function canBasicAttackByStatus(character, target = null) {
  // Only the selected forced command controls basics. Older fear/charm may
  // remain timed underneath a newer taunt without vetoing that taunt's attack.
  if (hasActionBlockStatus(character) || getActiveEffects(character)
    .some((effect) => !isForcedControlEffect(effect) && effect.tags.includes('basic_block'))) return false;
  const control = getForcedControlEffect(character);
  if (!control) return true;
  return control.mode === 'taunt' && (!target
    || Boolean(control.sourceActorId) && String(target._id || target.id || '') === String(control.sourceActorId));
}

export function canMoveByStatus(character, { forced = false } = {}) {
  return !hasActionBlockStatus(character) && !hasStatusTag(character, 'move_block')
    && (forced || !hasStatusTag(character, 'voluntary_block'));
}

export function canUseSkillByStatus(character, { includesMovement = false } = {}) {
  return !hasActionBlockStatus(character) && !hasStatusTag(character, 'skill_block')
    && (!includesMovement || canMoveByStatus(character));
}

export function isTargetableByStatus(character) {
  return !isDimensionRiftDefeated(character) && !hasStatusTag(character, 'untargetable');
}

export function getDamageBlockReason(attacker, defender, { type = 'skill', existingEffect = false } = {}) {
  if (isDimensionRiftDefeated(defender) || (!existingEffect && isDimensionRiftDefeated(attacker))) return 'rift_defeated';
  if (!existingEffect && attacker && defender && !shareCombatSpace(attacker, defender)) return 'combat_space';
  if (!existingEffect && !isTargetableByStatus(defender)) return 'untargetable';
  if (hasStatusTag(defender, 'damage_immune')) return 'invulnerable';
  if (type === 'basic' && hasStatusTag(attacker, 'basic_miss')) return 'blind';
  if (type === 'basic' && hasStatusTag(defender, 'basic_evade')) return 'evade';
  return '';
}

// Use the state at the START of the interval. End-of-interval state already
// lacks effects expiring exactly at that boundary and would charge damage early.
export function getNewDamageProtectedSeconds(character, elapsedSec, offsetSec = 0) {
  const elapsed = Math.max(0, Number(elapsedSec) || 0);
  const offset = Math.max(0, Number(offsetSec) || 0);
  return getActiveEffects(character).reduce((max, effect) => {
    if (!effect.tags.includes('damage_immune') && !effect.tags.includes('untargetable')) return max;
    const remaining = effect.remainingDuration == null ? Infinity : Number(effect.remainingDuration) - offset;
    return Math.max(max, Math.min(elapsed, Math.max(0, remaining)));
  }, 0);
}

export function getHealReductionPct(character) {
  const total = getActiveEffects(character).reduce((sum, eff) => {
    const stacks = Math.max(1, Number(eff?.stacks || 1));
    return sum + Math.max(0, Number(eff?.healReductionPct || 0)) * stacks;
  }, 0);
  return Math.max(0, Math.min(0.95, total));
}

export function applyHealingModifier(character, amount) {
  if (isDimensionRiftDefeated(character)) return 0;
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
  if (isDimensionRiftDefeated(character)) return true;
  return getActiveEffects(character).some((eff) => {
    const tags = new Set([...(effectMetaByName(eff?.name)?.tags || []), ...safeTags(eff?.tags)]);
    return tags.has('action_block') || eff?.name === EFFECT_STUN || eff?.name === EFFECT_AIRBORNE;
  });
}

export function getKnockbackDistance(character) {
  return getActiveEffects(character).reduce((max, eff) => {
    if (eff.knockbackConsumed || eff.knockbackTargetSpaceId && eff.knockbackTargetSpaceId !== getCombatSpaceId(character)) return max;
    const tags = new Set([...(effectMetaByName(eff?.name)?.tags || []), ...safeTags(eff?.tags)]);
    if (!tags.has('knockback') && eff?.name !== EFFECT_KNOCKBACK) return max;
    return Math.max(max, Math.max(0, Number(eff?.knockbackDistance || 0)));
  }, 0);
}

export function getEffectStacks(character, effectName) {
  const key = canonicalizeEffectName(effectName);
  const list = getActiveEffects(character);
  const found = list.find((eff) => canonicalizeEffectName(eff?.name) === key);
  return Math.max(0, Number(found?.stacks || 0));
}
