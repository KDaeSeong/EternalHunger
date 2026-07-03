import { findItemByKeywords } from './simulationCommon';
import { classifySpecialByName } from './craftRuntime';

function findItemByTag(items, tagKey) {
  const key = String(tagKey || '').toLowerCase();
  return items.find((item) => (
    Array.isArray(item?.tags)
    && item.tags.some((tag) => String(tag).toLowerCase() === key)
  )) || null;
}

export function resolveKioskSpecialItems(publicItems = []) {
  const items = Array.isArray(publicItems) ? publicItems : [];
  return {
    meteorItem: findItemByTag(items, 'meteor') || findItemByKeywords(items, ['운석', 'meteor']),
    lifeTreeItem: findItemByTag(items, 'life_tree') || findItemByKeywords(items, ['생명의 나무', 'tree of life', 'life tree']),
    mithrilItem: findItemByTag(items, 'mithril') || findItemByKeywords(items, ['미스릴', 'mythril', 'mithril']),
    forceCoreItem: findItemByTag(items, 'force_core') || findItemByKeywords(items, ['포스 코어', 'force core']),
    tacModuleItem: findItemByTag(items, 'tac_skill_module') || findItemByKeywords(items, ['전술 강화 모듈', 'tac. skill module', 'tactical']),
    surplusVfItem: findItemByKeywords(items, ['vf', '혈액', '샘플', 'blood sample']),
  };
}

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
