// client/src/utils/statusLogic.js
export {
  EFFECT_AIRBORNE,
  EFFECT_BURN,
  EFFECT_COOLDOWN_DOWN,
  EFFECT_COOLDOWN_UP,
  EFFECT_FOCUS,
  EFFECT_FOOD_POISON,
  EFFECT_HASTE,
  EFFECT_HEAL_REDUCTION,
  EFFECT_KNOCKBACK,
  EFFECT_LIFESTEAL,
  EFFECT_META,
  EFFECT_POISON,
  EFFECT_REGEN,
  EFFECT_SHIELD,
  EFFECT_SLOW,
  EFFECT_STIM,
  EFFECT_STUN,
  canonicalizeEffectName,
  makeCooldownRateEffect,
  makeHealReductionEffect,
  makeLifestealEffect,
  makeMoveSpeedEffect,
  makeRegenEffect,
  makeShieldEffect,
  makeStatBuffEffect,
  makeStatusValueEffect,
  normalizeStatusEffect,
  normalizeStatusEffectList,
} from './statusEffectDefinitions';

export {
  applyHealingModifier,
  getCooldownTickMultiplier,
  getEffectStacks,
  getEffectValueTotal,
  getHealReductionPct,
  getKnockbackDistance,
  getLifestealPercent,
  getMoveSpeedStatusBonus,
  getRegenValue,
  getShieldValue,
  hasActionBlockStatus,
} from './statusEffectSelectors';

export {
  absorbShieldDamage,
  addOrRefreshEffect,
  hasEffectImmunity,
  purgeNegativeEffects,
  updateEffects,
} from './statusEffectApplication';

export { getEffectiveStats } from './statusEffectiveStats';
