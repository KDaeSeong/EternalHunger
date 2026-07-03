import { isAtOrAfterWorldTime } from './worldTime';
import { canReceiveItem, invQty } from './inventoryRules';
import { kioskLegendaryPrice } from './marketRuntime';

export function pickKioskSurplusBuyAction({
  spendSurplus = false,
  mr = {},
  simCredits = 0,
  inv = [],
  ruleset = null,
  up = null,
  curDay = 1,
  curPhase = 'day',
  allowVf = true,
  allowLegendary = true,
  surplusVfItem = null,
  meteorItem = null,
  lifeTreeItem = null,
  mithrilItem = null,
  forceCoreItem = null,
  tacModuleItem = null,
  applyKioskCost = (value) => value,
  tacIsLvMax = false,
} = {}) {
  if (!spendSurplus) return null;

  const surplusBuyChance = Math.min(
    0.98,
    Number(mr?.surplus?.buyChance ?? 0.72) + Math.max(0, simCredits - 500) / 3200
  );
  const buyRows = [];
  const pushBuy = (item, cost, label, key = '') => {
    if (!item?._id) return;
    const itemId = String(item._id);
    const safeCost = Math.max(0, Number(cost || 0));
    if (safeCost <= 0 || simCredits < safeCost) return;
    if (!canReceiveItem(inv, item, itemId, 1, ruleset)) return;
    const have = invQty(inv, itemId);
    const holdLimit = key === 'vf' ? 1 : key === 'tac' ? 1 : 2;
    if (have >= holdLimit) return;
    buyRows.push({ item, itemId, cost: safeCost, label, key, have });
  };

  if (allowVf && up?.wantTrans && isAtOrAfterWorldTime(curDay, curPhase, 4, 'day')) {
    pushBuy(surplusVfItem, applyKioskCost(Number(mr?.prices?.vf ?? 500)), 'surplus VF', 'vf');
  }

  if (allowLegendary && (up?.wantLegend || up?.surplusLegendBudget)) {
    const cores = [
      { key: 'meteor', item: meteorItem, cost: applyKioskCost(kioskLegendaryPrice('meteor', mr?.prices?.legendaryByKey)) },
      { key: 'life_tree', item: lifeTreeItem, cost: applyKioskCost(kioskLegendaryPrice('life_tree', mr?.prices?.legendaryByKey)) },
      { key: 'mithril', item: mithrilItem, cost: applyKioskCost(kioskLegendaryPrice('mithril', mr?.prices?.legendaryByKey)) },
      { key: 'force_core', item: forceCoreItem, cost: applyKioskCost(kioskLegendaryPrice('force_core', mr?.prices?.legendaryByKey)) },
    ].sort((a, b) => (a.cost - b.cost) || String(a.key).localeCompare(String(b.key)));
    for (const row of cores) pushBuy(row.item, row.cost, `surplus legendary ${row.key}`, row.key);
  }

  if (!tacIsLvMax) {
    pushBuy(tacModuleItem, applyKioskCost(Number(mr?.prices?.tacModule ?? 10)), 'surplus tactical module', 'tac');
  }

  if (!buyRows.length || Math.random() >= surplusBuyChance) return null;

  const picked = buyRows
    .sort((a, b) => (a.have - b.have) || (a.cost - b.cost) || String(a.key).localeCompare(String(b.key)))[0];
  return { kind: 'buy', item: picked.item, itemId: picked.itemId, qty: 1, cost: picked.cost, label: picked.label };
}
