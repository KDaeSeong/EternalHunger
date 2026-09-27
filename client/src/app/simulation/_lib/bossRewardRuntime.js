import { normalizeMatchKey } from './simulationCommon.js';
import { findMaterialByKeywords, findSpecialResourceItem, getSpecialDropRules } from './specialResourceRuntime.js';

const primaryKeywords = {
  alpha: ['미스릴', 'mithril'],
  omega: ['포스 코어', 'force core', 'forcecore'],
  weakline: ['vf 혈액', 'vf 샘플', 'blood sample', '혈액 샘플', 'vf'],
};

// Both planning and actual settlement use the same catalog/configuration gate.
export function findBossPrimaryDrop(kind, publicItems, ruleset) {
  if (!Object.hasOwn(primaryKeywords, kind)) return null;
  const custom = ruleset?.worldSpawns?.bosses?.[kind]?.dropKeywords;
  const keywords = Array.isArray(custom) ? custom : primaryKeywords[kind];
  const material = findMaterialByKeywords(publicItems, keywords);
  if (material) return material;
  // Preserve deliberately named custom rewards, but never substitute finished
  // equipment just because its name contains a missing resource keyword.
  const exact = new Set((Array.isArray(custom) ? custom : []).map(normalizeMatchKey).filter(Boolean));
  return (Array.isArray(publicItems) ? publicItems : []).find((item) => exact.has(normalizeMatchKey(item?.name || item?.text))) || null;
}

// A team recipe goal should not rely on a lucky secondary drop. These are
// conservative minimum quantities, with no roll, perk consumption or reward.
export function getGuaranteedBossDrops(kind, publicItems, ruleset) {
  const primary = findBossPrimaryDrop(kind, publicItems, ruleset);
  if (!primary?._id) return [];
  const rules = getSpecialDropRules(kind, ruleset).map((rule) => ({ ...rule,
    item: findSpecialResourceItem(publicItems, String(rule?.key || '').trim()) })).filter((rule) => rule.item?._id);
  const guaranteed = new Map();
  for (const rule of rules) {
    if (!(Number(rule.chance) >= 1)) continue;
    const itemId = String(rule.item._id), previous = guaranteed.get(itemId);
    guaranteed.set(itemId, { item: rule.item, itemId, qty: (previous?.qty || 0) + Math.max(1, Math.floor(Number(rule.qty || 1))) });
  }
  // If all possible rolls are the primary item (or none exist), its fallback
  // guarantees at least one. Even a zero-chance rule can receive a perk bonus,
  // so a different configured secondary item prevents this guarantee.
  if (rules.every((rule) => String(rule.item._id) === String(primary._id))) {
    const itemId = String(primary._id);
    guaranteed.set(itemId, { item: primary, itemId, qty: Math.max(1, guaranteed.get(itemId)?.qty || 0) });
  }
  return [...guaranteed.values()];
}
