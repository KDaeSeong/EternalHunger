import { shuffleArray } from './simulationCommon';
import { invQty } from './inventoryRules';

function normCatalogItemId(value) {
  return String(value?._id || value || '').trim();
}

function isTacSkillModuleItem(item) {
  const name = String(item?.name || '');
  const tags = Array.isArray(item?.tags) ? item.tags : [];
  return name.includes('전술 강화 모듈')
    || tags.some((tag) => String(tag).toLowerCase().includes('tac_skill_module'));
}

function catalogItem(findById, itemId, row) {
  return findById(itemId) || row?.itemId || null;
}

export function pickKioskCatalogAction({
  catalog = [],
  actor = null,
  miss = [],
  hasMeaningfulNeed = false,
  applyKioskCost = (value) => value,
  findById = () => null,
  ruleset = null,
} = {}) {
  if (!catalog.length) return null;

  const inv = Array.isArray(actor?.inventory) ? actor.inventory : [];
  const credits = Math.max(0, Number(actor?.simCredits || 0));
  const missingRows = Array.isArray(miss) ? miss : [];
  const missIds = new Set(missingRows.map((m) => String(m?.itemId || '')).filter(Boolean));

  // 1) 목표 기반: 부족한 아이템(정확히 itemId 매칭)이 카탈로그에 있으면 우선 수행
  for (const row of catalog) {
    const itemId = normCatalogItemId(row?.itemId);
    if (!itemId || !missIds.has(itemId)) continue;

    const mode = String(row?.mode || 'sell');
    if (mode === 'sell') {
      const cost = applyKioskCost(Math.max(0, Number(row?.priceCredits || 0)));
      if (credits >= cost) {
        return { kind: 'buy', item: catalogItem(findById, itemId, row), itemId, qty: 1, cost, label: '카탈로그 구매' };
      }
    }
    if (mode === 'exchange') {
      const giveId = normCatalogItemId(row?.exchange?.giveItemId);
      const giveQty = Math.max(1, Number(row?.exchange?.giveQty || 1));
      if (giveId && invQty(inv, giveId) >= giveQty) {
        return { kind: 'exchange', item: catalogItem(findById, itemId, row), itemId, qty: 1, consume: [{ itemId: giveId, qty: giveQty }], label: '카탈로그 교환' };
      }
    }
  }

  // 2) 교환 우선: 가진 재료로 가능한 exchange를 실행(경제 안정화 위해 확률 게이트)
  const exchanges = catalog.filter((row) => String(row?.mode) === 'exchange');
  if (exchanges.length && Math.random() < (hasMeaningfulNeed ? 0.82 : 0.60)) {
    for (const row of shuffleArray(exchanges)) {
      const itemId = normCatalogItemId(row?.itemId);
      const giveId = normCatalogItemId(row?.exchange?.giveItemId);
      const giveQty = Math.max(1, Number(row?.exchange?.giveQty || 1));
      if (!itemId || !giveId) continue;
      if (invQty(inv, giveId) >= giveQty) {
        return { kind: 'exchange', item: catalogItem(findById, itemId, row), itemId, qty: 1, consume: [{ itemId: giveId, qty: giveQty }], label: '카탈로그 교환' };
      }
    }
  }

  // 3) 환급(키오스크 buy = 유저 sell): 가진 아이템을 credits로 환전(낮은 확률)
  const refunds = catalog.filter((row) => String(row?.mode) === 'buy');
  if (refunds.length && Math.random() < (hasMeaningfulNeed ? 0.10 : 0.18)) {
    for (const row of shuffleArray(refunds)) {
      const itemId = normCatalogItemId(row?.itemId);
      const gain = Math.max(0, Number(row?.priceCredits || 0));
      if (!itemId || gain <= 0) continue;
      if (invQty(inv, itemId) >= 1) {
        return { kind: 'sell', item: catalogItem(findById, itemId, row), itemId, qty: 1, credits: gain, label: '카탈로그 환급' };
      }
    }
  }

  // 4) 구매(sell = 유저 buy): 저가 항목만 가끔 구매
  const buys = catalog.filter((row) => String(row?.mode) === 'sell');
  if (buys.length && Math.random() < (hasMeaningfulNeed ? 0.34 : 0.18)) {
    const isLevelModeMax = String(ruleset?.ai?.tacModuleUpgradeMode || 'level') === 'level'
      && Number(actor?.tacticalSkillLevel || 1) >= 2;
    for (const row of shuffleArray(buys)) {
      const itemId = normCatalogItemId(row?.itemId);
      const cost = applyKioskCost(Math.max(0, Number(row?.priceCredits || 0)));
      if (!itemId) continue;

      // (level 모드) 전술 스킬 레벨이 MAX면 모듈을 랜덤 구매하지 않음(낭비 방지)
      const item = catalogItem(findById, itemId, row);
      if (isLevelModeMax && isTacSkillModuleItem(item)) continue;
      if (cost <= 0 || credits >= cost) {
        return { kind: 'buy', item, itemId, qty: 1, cost, label: '카탈로그 구매' };
      }
    }
  }

  return null;
}
