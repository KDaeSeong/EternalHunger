import { buildErBehaviorModifier } from '../../../utils/erMeta';
import { normalizeErStats } from '../../../utils/erStats';
import { getRegenValue, getShieldValue } from '../../../utils/statusLogic';
import { getPerkAggressionBias } from './perkRuntime';
import { getCombatEquipment } from '../../../utils/battleEquipmentLogic.js';

function combatScoreForMovePower(actor) {
  const stats = normalizeErStats(actor?.stats || {});
  const maxHp = Math.max(1, Number(actor?.maxHp || stats.maxHp || 100));
  const hp = Math.max(1, Math.min(maxHp, Number(actor?.hp ?? maxHp)));
  const base =
    Number(stats.attackPower || 0) +
    Number(stats.skillAmp || 0) * 0.35 +
    Number(stats.defense || 0) * 0.85 +
    Number(stats.attackSpeed || 0) * 10 +
    Number(stats.attackRange || 0) * 1.5 +
    Number(stats.sightRange || 0) * 0.4 +
    Number(stats.maxHp || 0) * 0.08;
  const shield = Math.max(0, getShieldValue(actor));
  const regen = Math.max(0, getRegenValue(actor));
  const sustain = Math.min(28, shield * 0.65 + regen * 1.35);

  return (base * (0.5 + hp / Math.max(1, maxHp * 2))) + sustain;
}

function summarizeEquipTierForMovePower(actor) {
  // Use the same equipped items as actual damage. Stored spares contribute
  // nothing; legacy actors without an equipped map still resolve one per slot.
  const inv = getCombatEquipment(actor);
  let weaponTier = 0;
  let armorTierSum = 0;
  for (const item of inv) {
    const slot = String(item?.equipSlot || '');
    const value = Number(item?.tier || 1);
    const tier = Number.isFinite(value) ? Math.max(1, value) : 1;
    const type = String(item?.type || '').toLowerCase();
    if (slot === 'weapon' || ['weapon', '무기', 'armory', '병기'].includes(type) || item?.tags?.includes('weapon')) weaponTier = Math.max(weaponTier, tier);
    else if (slot === 'head' || slot === 'clothes' || slot === 'arm' || slot === 'shoes') armorTierSum += tier;
  }
  return { weaponTier, armorTierSum, equippedCount: inv.length };
}

function estimateMovePower(actor, context = {}) {
  const base = combatScoreForMovePower(actor);
  const { weaponTier, armorTierSum } = summarizeEquipTierForMovePower(actor);
  const ruleset = context?.ruleset || {};
  const battleSettings = context?.battleSettings || {};
  const weaponPower = Number(ruleset?.ai?.powerWeaponPerTier ?? 3);
  const armorPower = Number(ruleset?.ai?.powerArmorPerTier ?? 1.5);
  const er = buildErBehaviorModifier(actor, battleSettings);
  return base + weaponTier * weaponPower + armorTierSum * armorPower + Number(er?.powerScore || 0);
}

function shouldAvoidCombatByMovePower(me, opponent, context = {}) {
  const ruleset = context?.ruleset || {};
  const battleSettings = context?.battleSettings || {};
  const myPower = estimateMovePower(me, context);
  const opponentPower = estimateMovePower(opponent, context);
  const ratio = myPower / Math.max(1, myPower + opponentPower);
  const aggroBias = Math.max(0, getPerkAggressionBias(me));
  const er = buildErBehaviorModifier(me, battleSettings);
  const minRatioBase = Number(ruleset?.ai?.fightAvoidMinRatio ?? 0.40);
  const absDeltaBase = Number(ruleset?.ai?.fightAvoidAbsDelta ?? 10);
  const minRatio = Math.max(0.18, minRatioBase - aggroBias * 0.08 - Number(er?.aggressionBias || 0) * 0.18 - Number(er?.escapeBonus || 0) * 0.10);
  const absDelta = Math.max(0, absDeltaBase + aggroBias * 12 + Number(er?.chaseBonus || 0) * 18);
  if (ratio < minRatio || (opponentPower - myPower) >= absDelta) {
    return { myP: myPower, opP: opponentPower, ratio, scope: 'duel', minRatio, absDelta };
  }
  return null;
}

export {
  combatScoreForMovePower,
  estimateMovePower,
  shouldAvoidCombatByMovePower,
  summarizeEquipTierForMovePower,
};
