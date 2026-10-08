import { findItemByKeywords } from './simulationCommon';
import { classifySpecialByName } from './craftRuntime';
import { getInvItemId, invQty } from './inventoryRules';
import { isMarketItemAllowed } from '../../../utils/marketItemPolicy.js';

function findItemByTag(items, tagKey) {
  const key = String(tagKey || '').toLowerCase();
  return items.find((item) => (
    Array.isArray(item?.tags)
    && item.tags.some((tag) => String(tag).toLowerCase() === key)
  )) || null;
}

export function resolveKioskSpecialItems(publicItems = [], missing = []) {
  const items = Array.isArray(publicItems) ? publicItems : [];
  const needs = Array.isArray(missing) ? missing : [];
  const forGoal = (key, fallback) => {
    const rows = needs.filter(row => String(row?.itemId || '').trim()
      && String(row.special || classifySpecialByName(row.name)
        || (String(row.name || '').includes('전술 강화 모듈') ? 'tac_skill_module' : '')) === key);
    if (!rows.length) return fallback();
    // Names/tags identify a special kind, not a recipe ingredient. Never
    // substitute another ID when the explicit required stock is unavailable.
    for (const row of rows) {
      const found = items.find(item => String(item?._id || '') === String(row.itemId || ''));
      if (found) return found;
    }
    return null;
  };
  return {
    meteorItem: forGoal('meteor', () => findItemByTag(items, 'meteor') || findItemByKeywords(items, ['운석', 'meteor'])),
    lifeTreeItem: forGoal('life_tree', () => findItemByTag(items, 'life_tree') || findItemByKeywords(items, ['생명의 나무', 'tree of life', 'life tree'])),
    mithrilItem: forGoal('mithril', () => findItemByTag(items, 'mithril') || findItemByKeywords(items, ['미스릴', 'mythril', 'mithril'])),
    forceCoreItem: forGoal('force_core', () => findItemByTag(items, 'force_core') || findItemByKeywords(items, ['포스 코어', 'force core'])),
    tacModuleItem: forGoal('tac_skill_module', () => findItemByTag(items, 'tac_skill_module') || findItemByKeywords(items, ['전술 강화 모듈', 'tac. skill module', 'tactical'])),
    surplusVfItem: forGoal('vf', () => findItemByKeywords(items, ['vf', '혈액', '샘플', 'blood sample'])),
  };
}

// Exchange inputs come from the actor's inventory and the allowed catalogue.
// Keep the old preferred ID first, then try other owned IDs of the same kind.
export function resolveKioskExchangeInputs(publicItems = [], inventory = [], specialItems = {}) {
  const items = Array.isArray(publicItems) ? publicItems : [];
  const inv = Array.isArray(inventory) ? inventory : [];
  const owned = (preferred, tag, keywords) => {
    const seen = new Set();
    return (preferred ? [preferred, ...items] : items).filter(item => {
      const id = String(item?._id || '');
      if (!id || seen.has(id) || invQty(inv, id) < 1) return false;
      if (!findItemByTag([item], tag) && !findItemByKeywords([item], keywords)) return false;
      if (inv.some(entry => getInvItemId(entry) === id && !isMarketItemAllowed(entry, 'kiosk'))) return false;
      seen.add(id);
      return true;
    });
  };
  return {
    meteor: owned(specialItems.meteorItem, 'meteor', ['운석', 'meteor']),
    life_tree: owned(specialItems.lifeTreeItem, 'life_tree', ['생명의 나무', 'tree of life', 'life tree']),
    force_core: owned(specialItems.forceCoreItem, 'force_core', ['포스 코어', 'force core']),
  };
}

export const resolveKioskForceCoreInputs = resolveKioskExchangeInputs;

export function itemCreditPrice(item, fallback) {
  const value = Number(item?.baseCreditValue ?? item?.value ?? item?.price ?? fallback);
  return (Number.isFinite(value) && value > 0) ? value : Math.max(0, Number(fallback || 0));
}

export function countMissingSpecialNeed(miss = [], specialKey = '') {
  const wantedKey = String(specialKey || '');
  return (Array.isArray(miss) ? miss : []).reduce((sum, row) => {
    const key = String(row?.special || classifySpecialByName(row?.name) || '');
    if (key !== wantedKey) return sum;
    return sum + Math.max(0, Number(row?.need || 1) - Number(row?.have || 0));
  }, 0);
}
