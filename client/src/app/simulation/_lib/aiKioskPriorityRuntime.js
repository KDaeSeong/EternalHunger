import { invQty } from './inventoryRules.js';
import { isAtOrAfterWorldTime } from './worldTime.js';

function hasMissingSpecial(missingSpecialKeys, key) {
  if (missingSpecialKeys instanceof Set) return missingSpecialKeys.has(key);
  if (Array.isArray(missingSpecialKeys)) return missingSpecialKeys.includes(key);
  return false;
}

export function pickKioskPrioritySpecialAction({
  missingSpecialKeys = new Set(),
  specialItems = {},
  inv = [],
  simCredits = 0,
  up = null,
  curDay = 1,
  curPhase = 'day',
  allowVf = true,
  allowLegendary = true,
  shouldDeferVfForLegend = false,
  kioskSpecialPrice = () => 0,
} = {}) {
  const {
    meteorItem,
    lifeTreeItem,
    mithrilItem,
    forceCoreItem,
    surplusVfItem,
  } = specialItems;
  const has = (item, qty = 1) => (
    item?._id
      ? invQty(inv, String(item._id)) >= Math.max(1, Number(qty || 1))
      : false
  );
  const specialItemByKey = {
    meteor: meteorItem,
    life_tree: lifeTreeItem,
    mithril: mithrilItem,
    force_core: forceCoreItem,
    vf: surplusVfItem,
  };
  const canBuySpecialKeyNow = (key) => {
    const specialKey = String(key || '');
    if (specialKey === 'vf') {
      return !shouldDeferVfForLegend
        && allowVf
        && isAtOrAfterWorldTime(curDay, curPhase, 4, 'day');
    }
    return allowLegendary && isAtOrAfterWorldTime(curDay, curPhase, 2, 'day');
  };
  const makeSpecialBuy = (key, label) => {
    const specialKey = String(key || '');
    const item = specialItemByKey[specialKey] || null;
    if (!item?._id) return null;
    if (!canBuySpecialKeyNow(specialKey)) return null;
    const cost = kioskSpecialPrice(specialKey);
    if (simCredits < cost) return null;
    return { kind: 'buy', item, itemId: String(item._id), qty: 1, cost, label };
  };

  // 목표 장비가 포스 코어를 요구하면 구매보다 운석+생나 조합을 우선한다.
  if (
    hasMissingSpecial(missingSpecialKeys, 'force_core')
    && forceCoreItem?._id
    && allowLegendary
    && isAtOrAfterWorldTime(curDay, curPhase, 2, 'day')
  ) {
    if (has(meteorItem, 1) && has(lifeTreeItem, 1)) {
      return {
        kind: 'exchange',
        item: forceCoreItem,
        itemId: String(forceCoreItem._id),
        qty: 1,
        consume: [
          { itemId: String(meteorItem._id), qty: 1 },
          { itemId: String(lifeTreeItem._id), qty: 1 },
        ],
        label: '운석+생나→포스 코어 조합',
      };
    }

    const forceBuy = makeSpecialBuy('force_core', '포스 코어(목표)');
    if (forceBuy) return forceBuy;

    if (has(meteorItem, 1) && !has(lifeTreeItem, 1)) {
      const lifeBuy = makeSpecialBuy('life_tree', '포스 코어 재료(생나)');
      if (lifeBuy) return lifeBuy;
    }
    if (has(lifeTreeItem, 1) && !has(meteorItem, 1)) {
      const meteorBuy = makeSpecialBuy('meteor', '포스 코어 재료(운석)');
      if (meteorBuy) return meteorBuy;
    }

    return null;
  }

  if (hasMissingSpecial(missingSpecialKeys, 'vf')) {
    const vfBuy = makeSpecialBuy('vf', 'VF 혈액 샘플(목표)');
    if (vfBuy) return vfBuy;
  }

  for (const key of ['meteor', 'life_tree', 'mithril']) {
    if (!hasMissingSpecial(missingSpecialKeys, key)) continue;
    const buy = makeSpecialBuy(key, `전설 재료(${key})`);
    if (buy) return buy;
  }

  if (up?.wantTrans && !up?.hasVf) {
    const vfBuy = makeSpecialBuy('vf', 'VF 혈액 샘플(초월 목표)');
    if (vfBuy) return vfBuy;
  }

  if (up?.wantLegend && !up?.hasLegendMatAny) {
    const candidates = ['meteor', 'life_tree', 'mithril', 'force_core']
      .map((key) => ({ key, buy: makeSpecialBuy(key, `전설 재료(${key})`) }))
      .filter((row) => row.buy)
      .sort((a, b) => Number(a.buy.cost || 0) - Number(b.buy.cost || 0));
    if (candidates[0]?.buy) return candidates[0].buy;
  }

  return undefined;
}
