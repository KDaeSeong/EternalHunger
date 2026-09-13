import { normalizeErStats, normalizeErStatDeltaMap, ER_STAT_KEYS, getEffectiveErStats } from './erStats.js';
import { applyMasteryStatBonuses } from './masteryLogic.js';
import { effectMetaByName, getActiveStatusEffects } from './statusEffectDefinitions.js';
import { getPassiveSkillStatModifiers } from './characterPassiveStats.js';

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

  getActiveStatusEffects(character).forEach((effect) => {
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

  // Each field owns its minimum. In particular 0% must stay 0%, and a
  // fractional attack speed or range must not be promoted to one.
  return normalizeErStats(effective, { round: false });
}
