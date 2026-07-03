import {
  EFFECT_AIRBORNE,
  EFFECT_COOLDOWN_DOWN,
  EFFECT_COOLDOWN_UP,
  EFFECT_HASTE,
  EFFECT_KNOCKBACK,
  EFFECT_SLOW,
  EFFECT_STUN,
  makeCooldownRateEffect,
  makeHealReductionEffect,
  makeLifestealEffect,
  makeMoveSpeedEffect,
  makeRegenEffect,
  makeShieldEffect,
  makeStatBuffEffect,
  makeStatusValueEffect,
} from '../../utils/statusLogic';
import {
  getTacBaseCdSec,
  getTacCooldownSec,
  getTacEffectNumber,
  getTacTrigger,
  normalizeSupportedTacSkill,
  TACTICAL_SKILL_OPTIONS_KO,
} from '../../utils/tacticalSkillCatalog.js';

export {
  getTacBaseCdSec,
  getTacCooldownSec,
  getTacEffectNumber,
  getTacTrigger,
  normalizeSupportedTacSkill,
  TACTICAL_SKILL_OPTIONS_KO,
};

export function buildTacStatusEffects(skillName, lv, sourceId = '', opts = {}) {
  const skill = normalizeSupportedTacSkill(skillName);
  const level = Math.max(1, Math.min(2, Math.floor(Number(lv || 1))));
  const sid = String(sourceId || `tac_${String(skill || '').replace(/\s+/g, '_')}`);
  const target = String(opts?.target || 'self');
  const shieldValue = getTacEffectNumber(skill, 'shieldValue', level, 0);
  const shieldDuration = getTacEffectNumber(skill, 'shieldDuration', level, 2);
  const regenRecovery = getTacEffectNumber(skill, 'regenRecovery', level, 0);
  const regenDuration = getTacEffectNumber(skill, 'regenDuration', level, 2);
  const tenacity = getTacEffectNumber(skill, 'tenacity', level, 0);
  const haste = getTacEffectNumber(skill, 'haste', level, 0);
  const lifestealPct = getTacEffectNumber(skill, 'lifestealPct', level, 0);
  const cooldownDownPct = getTacEffectNumber(skill, 'cooldownDownPct', level, 0);
  const cooldownUpPct = getTacEffectNumber(skill, 'cooldownUpPct', level, 0);
  const slowPct = getTacEffectNumber(skill, 'slowPct', level, 0);
  const stun = getTacEffectNumber(skill, 'stun', level, 0);
  const airborne = getTacEffectNumber(skill, 'airborne', level, 0);
  const knockback = getTacEffectNumber(skill, 'knockback', level, 0);
  const healReductionPct = getTacEffectNumber(skill, 'healReductionPct', level, 0);

  if (target === 'enemy') {
    return [
      stun > 0 ? makeStatusValueEffect(EFFECT_STUN, stun + 1, `${sid}_stun`, { tags: ['negative', 'cc', 'stun', 'action_block'] }) : null,
      airborne > 0 ? makeStatusValueEffect(EFFECT_AIRBORNE, airborne + 1, `${sid}_airborne`, { tags: ['negative', 'cc', 'airborne', 'action_block'] }) : null,
      knockback > 0 ? makeStatusValueEffect(EFFECT_KNOCKBACK, 2, `${sid}_knockback`, { knockbackDistance: knockback, tags: ['negative', 'cc', 'knockback', 'forced_move'] }) : null,
      slowPct > 0 ? makeMoveSpeedEffect(EFFECT_SLOW, -slowPct, 2, `${sid}_slow`, { tags: ['negative', 'slow', 'move'] }) : null,
      healReductionPct > 0 ? makeHealReductionEffect(healReductionPct, 2, `${sid}_antiheal`, { tags: ['negative', 'heal_reduction'] }) : null,
      cooldownUpPct > 0 ? makeCooldownRateEffect(EFFECT_COOLDOWN_UP, cooldownUpPct, 2, `${sid}_cooldown_up`, { tags: ['negative', 'cooldown'] }) : null,
    ].filter(Boolean);
  }

  return [
    shieldValue > 0 ? makeShieldEffect(shieldValue, shieldDuration, `${sid}_shield`) : null,
    regenRecovery > 0 ? makeRegenEffect(regenRecovery, regenDuration, `${sid}_regen`) : null,
    tenacity > 0 ? makeStatBuffEffect('집중', { defense: tenacity, maxHp: tenacity * 3 }, 2, `${sid}_tenacity`, { tags: ['positive', 'tenacity'] }) : null,
    haste > 0 ? makeStatusValueEffect(EFFECT_HASTE, 2, `${sid}_haste`, { moveSpeedBonus: Math.max(0.04, haste * 0.04), cooldownRateBonus: Math.max(0.04, haste * 0.03), tags: ['positive', 'haste', 'move', 'cooldown'] }) : null,
    haste > 0 ? makeStatBuffEffect('각성', { attackSpeed: haste * 0.02, sightRange: Math.max(0.1, haste * 0.08) }, 2, `${sid}_haste_stats`, { tags: ['positive', 'haste'] }) : null,
    lifestealPct > 0 ? makeLifestealEffect(lifestealPct, 2, `${sid}_lifesteal`, { tags: ['positive', 'lifesteal', 'combat'] }) : null,
    cooldownDownPct > 0 ? makeCooldownRateEffect(EFFECT_COOLDOWN_DOWN, cooldownDownPct, 2, `${sid}_cooldown_down`, { tags: ['positive', 'cooldown'] }) : null,
  ].filter(Boolean);
}
