export { normalizeRuntimeEffect } from './runtimeStatusNormalization';
export {
  applyRegenEffect,
  applyRuntimeEffectPayloads,
  applyShieldEffect,
  applyStatusEffect,
  clearNegativeStatusEffects,
  clearPostCombatEffects,
  consumeShieldDamage,
  getEffectIndex,
  hasActiveEffect,
  removeActiveEffect,
} from './runtimeStatusApplication';
export {
  collectRuntimeEffectResultTexts,
  describeRuntimeEffect,
  formatRuntimeEffectBadge,
  formatRuntimeEffectResultText,
  getVisibleRuntimeEffects,
  isInternalRuntimeEffect,
  isVisibleErRuntimeStatus,
  logRuntimeEffectResults,
  shouldLogRuntimeEffectApplication,
  shouldLogRuntimeEffectExpiry,
  shouldLogRuntimeEffectTick,
  shouldShowRuntimeEffectOnBoard,
} from './runtimeStatusDisplay';
