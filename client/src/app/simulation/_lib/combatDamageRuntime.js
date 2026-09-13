import { getCombatEquipment } from '../../../utils/battleEquipmentLogic.js';
import { getEffectiveErStats } from '../../../utils/erStats.js';
import { getEffectiveStats, getLifestealPercent, applyHealingModifier, getDamageBlockReason } from '../../../utils/statusLogic.js';
import { simulationRandom } from '../../../utils/simulationRandom.js';

const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const clamp = (value, low = 0, high = 1) => Math.max(low, Math.min(high, finite(value)));
const ratio = (value) => { const n = finite(value); return n > 1 ? n / 100 : n; };
const RATIO_STATS = ['critChance', 'critDamageIncrease', 'basicAttackAmp', 'damageIncrease', 'damageReduction',
  'basicDamageReduction', 'skillDamageReduction', 'criticalDamageReduction', 'armorPen', 'lifesteal', 'omnisyphon', 'finalDamageIncrease'];

export function getCombatStats(actor) {
  const stats = { ...getEffectiveStats(actor) };
  const base = getEffectiveErStats(actor);
  let bonusAttack = Math.max(0, stats.attackPower - base.attackPower);
  for (const item of getCombatEquipment(actor)) {
    const gear = item.stats || {};
    const attack = finite(gear.atk ?? gear.attackPower);
    bonusAttack += attack;
    stats.attackPower += attack;
    stats.defense += finite(gear.def ?? gear.defense);
    // Existing item catalogs store skillAmp in hundreds, unlike actor stats.
    stats.skillAmp += finite(gear.skillAmp) * 100;
    stats.attackSpeed += finite(gear.atkSpeed ?? gear.attackSpeed);
    for (const key of RATIO_STATS) stats[key] += ratio(gear[key]);
    for (const key of ['armorPenFlat', 'adaptiveForce', 'finalDamageFlat']) stats[key] += finite(gear[key]);
  }
  const adaptive = Math.max(0, stats.adaptiveForce);
  stats.adaptiveTarget = stats.skillAmp > bonusAttack ? 'skillAmp' : 'attackPower';
  stats[stats.adaptiveTarget] += adaptive * (stats.adaptiveTarget === 'skillAmp' ? 2 : 1);
  stats.bonusAttackPower = bonusAttack + (stats.adaptiveTarget === 'attackPower' ? adaptive : 0);
  stats.attackPower = Math.max(0, stats.attackPower);
  stats.defense = Math.max(0, stats.defense);
  stats.skillAmp = Math.max(0, stats.skillAmp);
  stats.attackSpeed = Math.max(0.1, stats.attackSpeed);
  return stats;
}

// Project combat contract derived from the user-provided reference, not a
// claim of current live-game parity. Percentage bonuses have a neutral 1x;
// penetration cannot take defense below zero in this simulator.
export function calculateCombatDamage(attacker, defender, { type = 'basic', baseDamage,
  critical, random = simulationRandom } = {}) {
  if (!['basic', 'skill', 'true'].includes(type)) throw new Error(`Unsupported damage type: ${type}`);
  const offense = getCombatStats(attacker);
  const defense = getCombatStats(defender);
  const raw = Math.max(0, finite(baseDamage, type === 'basic' ? offense.attackPower : 0));
  const appliedDefense = Math.max(0, defense.defense * (1 - clamp(offense.armorPen)) - Math.max(0, offense.armorPenFlat));
  const blockedReason = getDamageBlockReason(attacker, defender, { type });
  const isCritical = !blockedReason && type === 'basic' && (critical ?? (offense.critChance > 0 && random() < clamp(offense.critChance)));
  const criticalMultiplier = isCritical ? Math.max(1, 1.75 + offense.critDamageIncrease) : 1;
  const defenseMultiplier = type === 'true' ? 1 : 100 / (100 + appliedDefense);
  const generalMultiplier = type === 'true' ? 1 : Math.max(0.1, 1 + offense.damageIncrease - defense.damageReduction);
  const typeMultiplier = type === 'basic'
    ? Math.max(0.1, 1 + offense.basicAttackAmp - defense.basicDamageReduction) * (isCritical ? 1 - clamp(defense.criticalDamageReduction) : 1)
    : type === 'skill' ? 1 - clamp(defense.skillDamageReduction) : 1;
  const finalMultiplier = type === 'true' ? 1 : Math.max(0, 1 + offense.finalDamageIncrease);
  const damage = raw > 0 && !blockedReason ? Math.max(0, Math.round(raw * criticalMultiplier * defenseMultiplier * generalMultiplier * typeMultiplier * finalMultiplier
    + (type === 'true' ? 0 : offense.finalDamageFlat))) : 0;
  return { type, raw, appliedDefense, critical: Boolean(isCritical), criticalMultiplier, defenseMultiplier,
    generalMultiplier, typeMultiplier, finalMultiplier, damage, ...(blockedReason ? { blockedReason } : {}) };
}

// Pass actual HP removed, not requested damage, shield absorption, or overkill.
export function applyCombatDamageLifesteal(actor, hpDamage, { type = 'basic', area = false, targetKind = 'experiment', addLog = () => {} } = {}) {
  if (!actor || Number(actor.hp || 0) <= 0 || hpDamage <= 0) return 0;
  const stats = getCombatStats(actor);
  const pct = clamp(stats.omnisyphon + getLifestealPercent(actor) + (type === 'basic' ? stats.lifesteal : 0));
  const raw = hpDamage * pct * (area ? 0.5 : 1) * (targetKind === 'wildlife' ? 0.6 : 1);
  const maxHp = Math.max(1, finite(actor.maxHp, stats.maxHp));
  const heal = Math.min(Math.max(0, maxHp - actor.hp), applyHealingModifier(actor, raw));
  if (heal <= 0) return 0;
  actor.hp += heal;
  addLog(`🩸 [${actor.name}] 흡혈: HP +${heal}`, 'combat-detail');
  return heal;
}
