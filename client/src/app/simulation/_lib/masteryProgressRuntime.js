import { getEffectiveErStats, normalizeErStats } from '../../../utils/erStats';
import {
  addMasteryXp,
  addMultipleMasteryXp,
  getCraftMasteryXp,
  getMasteryLabel,
  getPvpKillMasteryEntries,
  getPvpMasteryEntries,
} from '../../../utils/masteryLogic';

export function applyLevelGrowth(actor, result) {
  if (!actor || !result?.characterLeveledUp) return;
  const before = Math.max(1, Number(result.beforeCharacterLevel || 1));
  const after = Math.max(before, Number(result.afterCharacterLevel || before));
  const steps = Math.max(0, after - before);
  if (steps <= 0) return;
  const stats = normalizeErStats(actor?.stats);
  const hpGain = Math.max(0, Math.round(Number(stats?.hpGrowth || 0) * steps));
  const effectiveMaxHp = Math.max(1, Math.round(Number(getEffectiveErStats(actor)?.maxHp || stats.maxHp || 100)));
  if (hpGain > 0) {
    actor.maxHp = Math.max(effectiveMaxHp, Number(actor.maxHp || stats.maxHp || 100) + hpGain);
    actor.hp = Math.min(Number(actor.maxHp || 1), Math.max(0, Number(actor.hp || 0) + hpGain));
  } else {
    actor.maxHp = Math.max(effectiveMaxHp, Number(actor.maxHp || stats.maxHp || 100));
  }
}

export function logMasteryResult(actor, result, reason = '', addLog = null) {
  if (!actor || !result) return result;
  applyLevelGrowth(actor, result);
  const reasonText = reason ? ` · ${reason}` : '';
  if (result.leveledUp) {
    addLog?.(`⚙️ [${actor?.name}] ${getMasteryLabel(result.category)} 숙련도 Lv.${result.afterLevel} 달성${reasonText}`, 'highlight');
  }
  if (result.characterLeveledUp) {
    addLog?.(`⬆️ [${actor?.name}] Lv.${result.afterCharacterLevel} 달성${reasonText}`, 'highlight');
  }
  return result;
}

export function grantMastery(actor, category, amount, reason = '', addLog = null) {
  const result = addMasteryXp(actor, category, amount);
  return logMasteryResult(actor, result, reason, addLog);
}

export function grantMasteries(actor, entries = [], reason = '', addLog = null) {
  const results = addMultipleMasteryXp(actor, entries);
  results.forEach((result) => logMasteryResult(actor, result, reason, addLog));
  return results;
}

export function grantCraftMastery(actor, crafted, itemMetaById, reason = '제작', addLog = null) {
  if (!actor || !crafted?.craftedId) return [];
  const craftedId = String(crafted.craftedId || '');
  const meta = itemMetaById?.[craftedId] || {};
  return grantMasteries(actor, getCraftMasteryXp(meta, crafted), reason, addLog);
}

export function grantPvpDamageMastery(actor, payload = {}, reason = '교전', addLog = null) {
  return grantMasteries(actor, getPvpMasteryEntries(payload), reason, addLog);
}

export function grantPvpKillMastery(actor, opponent, reason = '처치', addLog = null) {
  return grantMasteries(actor, getPvpKillMasteryEntries(opponent), reason, addLog);
}
