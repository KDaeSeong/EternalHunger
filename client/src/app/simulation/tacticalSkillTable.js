import { makeRegenEffect, makeShieldEffect, makeStatBuffEffect } from '../../utils/statusLogic';
import {
  getTacBaseCdSec,
  getTacEffectNumber,
  getTacTrigger,
  normalizeSupportedTacSkill,
  TACTICAL_SKILL_OPTIONS_KO,
} from '../../utils/tacticalSkillCatalog.js';

export {
  getTacBaseCdSec,
  getTacEffectNumber,
  getTacTrigger,
  normalizeSupportedTacSkill,
  TACTICAL_SKILL_OPTIONS_KO,
};

export function buildTacStatusEffects(skillName, lv, sourceId = '') {
  const skill = normalizeSupportedTacSkill(skillName);
  const level = Math.max(1, Math.min(2, Math.floor(Number(lv || 1))));
  const sid = String(sourceId || `tac_${String(skill || '').replace(/\s+/g, '_')}`);
  const shieldValue = getTacEffectNumber(skill, 'shieldValue', level, 0);
  const shieldDuration = getTacEffectNumber(skill, 'shieldDuration', level, 2);
  const regenRecovery = getTacEffectNumber(skill, 'regenRecovery', level, 0);
  const regenDuration = getTacEffectNumber(skill, 'regenDuration', level, 2);
  const tenacity = getTacEffectNumber(skill, 'tenacity', level, 0);
  const haste = getTacEffectNumber(skill, 'haste', level, 0);

  return [
    shieldValue > 0 ? makeShieldEffect(shieldValue, shieldDuration, `${sid}_shield`) : null,
    regenRecovery > 0 ? makeRegenEffect(regenRecovery, regenDuration, `${sid}_regen`) : null,
    tenacity > 0 ? makeStatBuffEffect('집중', { end: tenacity, men: tenacity }, 2, `${sid}_tenacity`, { tags: ['positive', 'tenacity'] }) : null,
    haste > 0 ? makeStatBuffEffect('각성', { agi: haste, dex: Math.max(1, Math.floor(haste / 2)) }, 2, `${sid}_haste`, { tags: ['positive', 'haste'] }) : null,
  ].filter(Boolean);
}
