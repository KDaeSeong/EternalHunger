import { normalizeErStats, normalizeErStatDeltaMap, ER_STAT_KEYS, getEffectiveErStats } from './erStats.js';
import { applyMasteryStatBonuses } from './masteryLogic.js';
import { effectMetaByName, normalizeStatusEffect } from './statusEffectDefinitions.js';

function getPassiveSkillStatModifiers(character) {
  const passive = character?.characterSkills?.passive;
  if (!passive || typeof passive !== 'object' || passive.enabled !== true) return null;
  const statMods = passive.statModifiers && typeof passive.statModifiers === 'object'
    ? passive.statModifiers
    : null;
  return statMods ? normalizeErStatDeltaMap(statMods) : null;
}

export function getEffectiveStats(character) {
  const effective = applyMasteryStatBonuses(getEffectiveErStats(character), character);
  const passiveStatMods = getPassiveSkillStatModifiers(character);
  if (passiveStatMods) {
    Object.keys(passiveStatMods).forEach((stat) => {
      const delta = Number(passiveStatMods[stat] || 0);
      if (!Number.isFinite(delta)) return;
      effective[stat] = Number(effective[stat] || 0) + delta;
    });
  }

  (Array.isArray(character?.activeEffects) ? character.activeEffects : []).forEach((raw) => {
    const effect = normalizeStatusEffect(raw);
    if (!effect) return;
    const stacks = Math.max(1, Number(effect?.stacks || 1));

    const meta = effectMetaByName(effect.name);
    const statMods = effect.statModifiers && typeof effect.statModifiers === 'object'
      ? effect.statModifiers
      : (meta?.statModifiers && typeof meta.statModifiers === 'object' ? meta.statModifiers : null);
    const normalizedStatMods = statMods ? normalizeErStatDeltaMap(statMods) : null;
    if (normalizedStatMods) {
      Object.keys(normalizedStatMods).forEach((stat) => {
        const delta = Number(normalizedStatMods[stat] || 0);
        if (!Number.isFinite(delta)) return;
        effective[stat] = Number(effective[stat] || 0) + (delta * stacks);
      });
    }

    const multipliers = effect?.statMultipliers && typeof effect.statMultipliers === 'object'
      ? effect.statMultipliers
      : (meta?.statMultipliers || null);
    if (multipliers) {
      Object.keys(multipliers).forEach((stat) => {
        if (!ER_STAT_KEYS.includes(stat)) return;
        const mul = Number(multipliers[stat] || 1);
        if (!Number.isFinite(mul)) return;
        effective[stat] = Number(effective[stat] || 0) * mul;
      });
    }
  });

  Object.keys(effective).forEach((key) => {
    if (key === 'attackSpeed') effective[key] = Math.max(0.1, effective[key]);
    else if (key === 'skillAmp') effective[key] = Math.max(0, effective[key]);
    else if (effective[key] < 1) effective[key] = 1;
  });

  return normalizeErStats(effective, { round: false });
}
