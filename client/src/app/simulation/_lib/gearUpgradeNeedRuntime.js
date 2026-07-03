import { EQUIP_SLOTS } from './simulationConstants';
import { isAtOrAfterWorldTime } from './worldTime';
import { canUseKioskAtWorldTime } from './marketRuntime';
import {
  classifySpecialByName,
  normalizeGoalTier,
  pickBestEquipBySlot,
} from './craftRuntime';
import { clampGearTier } from './gearCatalogRuntime';
import { countLowMaterials } from './gearFallbackRuntime';

function invHasSpecialKind(inventory, kind, itemMetaById, itemNameById) {
  const list = Array.isArray(inventory) ? inventory : [];
  const k = String(kind || '');
  if (!k) return false;
  return list.some((x) => {
    const id = String(x?.itemId || x?.id || '');
    const name = String(x?.name || itemNameById?.[id] || itemMetaById?.[id]?.name || '');
    if (!name) return false;
    if (Math.max(0, Number(x?.qty ?? 1)) <= 0) return false;
    return classifySpecialByName(name) === k;
  });
}

function findInvItemIdBySpecialKind(inventory, kind, itemMetaById, itemNameById) {
  const list = Array.isArray(inventory) ? inventory : [];
  const k = String(kind || '');
  if (!k) return '';
  const hit = list.find((x) => {
    const id = String(x?.itemId || x?.id || '');
    const name = String(x?.name || itemNameById?.[id] || itemMetaById?.[id]?.name || '');
    if (!name) return false;
    if (Math.max(0, Number(x?.qty ?? 1)) <= 0) return false;
    return classifySpecialByName(name) === k;
  });
  return hit ? String(hit?.itemId || hit?.id || '') : '';
}

function computeLateGameUpgradeNeed(actor, itemMetaById, itemNameById, day, phase, ruleset) {
  const inv = Array.isArray(actor?.inventory) ? actor.inventory : [];
  const tiers = {};
  let minTier = 99;
  for (const slot of EQUIP_SLOTS) {
    const best = pickBestEquipBySlot(inv, slot);
    const t = best ? clampGearTier(Number(best?.tier || 1)) : 0;
    tiers[slot] = t;
    minTier = Math.min(minTier, t || 0);
  }
  if (!Number.isFinite(minTier) || minTier === 99) minTier = 0;

  const simCredits = Math.max(0, Number(actor?.simCredits || 0));
  const lowCount = countLowMaterials(inv, itemMetaById, itemNameById);

  const hasVf = invHasSpecialKind(inv, 'vf', itemMetaById, itemNameById);
  const hasMeteor = invHasSpecialKind(inv, 'meteor', itemMetaById, itemNameById);
  const hasLife = invHasSpecialKind(inv, 'life_tree', itemMetaById, itemNameById);
  const hasMithril = invHasSpecialKind(inv, 'mithril', itemMetaById, itemNameById);
  const hasForce = invHasSpecialKind(inv, 'force_core', itemMetaById, itemNameById);
  const hasLegendMatAny = hasMeteor || hasLife || hasMithril || hasForce;

  const goalTier = normalizeGoalTier(actor?.goalGearTier ?? 6);
  const allowLegend = goalTier >= 5;
  const allowTrans = goalTier >= 6;
  const transGateOpen = isAtOrAfterWorldTime(day, phase, 4, 'day');

  const nearLegend = allowLegend && minTier >= 4 && minTier < 5;
  const nearTrans = allowTrans && transGateOpen && minTier >= 5 && minTier < 6;
  const wantLegend = allowLegend && ((nearLegend && canUseKioskAtWorldTime(day, phase)) || isAtOrAfterWorldTime(day, phase, 2, 'day')) && minTier < 5;
  const wantTrans = allowTrans && transGateOpen && minTier >= 5 && minTier < 6;
  const prepareTransCredits = allowTrans && !transGateOpen && minTier >= 5 && minTier < 6 && simCredits < Math.max(0, Number(ruleset?.market?.kiosk?.prices?.vf ?? 500));
  const legendOverdue = allowLegend && ((nearLegend && isAtOrAfterWorldTime(day, phase, 1, 'night')) || isAtOrAfterWorldTime(day, phase, 2, 'day')) && minTier < 5;
  const transOverdue = allowTrans && transGateOpen && minTier >= 5 && minTier < 6;

  const legendCost = Math.max(0, Number(ruleset?.market?.kiosk?.prices?.legendaryByKey?.meteor ?? 200));
  const mithrilCost = Math.max(0, Number(ruleset?.market?.kiosk?.prices?.legendaryByKey?.mithril ?? 250));
  const forceCost = Math.max(0, Number(ruleset?.market?.kiosk?.prices?.legendaryByKey?.force_core ?? 350));
  const transCost = Math.max(0, Number(ruleset?.market?.kiosk?.prices?.vf ?? 500));

  const needCreditsForLegend = wantLegend && simCredits < legendCost;
  const needCreditsForTrans = (wantTrans || prepareTransCredits) && simCredits < transCost;
  const farmCredits = needCreditsForLegend || needCreditsForTrans;
  const canMarketNow = canUseKioskAtWorldTime(day, phase);
  const surplusLegendBudget = simCredits >= Math.max(legendCost, 200);
  const surplusTransBudget = simCredits >= Math.max(transCost, 500);
  const canSpendForLegend = allowLegend && minTier < 5;
  const canSpendForTrans = allowTrans && transGateOpen && minTier >= 5 && minTier < 6;
  const spendSurplus = canMarketNow && ((canSpendForLegend && surplusLegendBudget) || (canSpendForTrans && surplusTransBudget));

  return {
    goalTier,
    tiers,
    minTier,
    simCredits,
    lowCount,
    wantLegend,
    wantTrans,
    prepareTransCredits,
    transGateOpen,
    nearLegend,
    nearTrans,
    legendOverdue,
    transOverdue,
    hasVf,
    hasLegendMatAny,
    farmCredits,
    spendSurplus,
    surplusLegendBudget,
    surplusTransBudget,
    legendCost,
    mithrilCost,
    forceCost,
    transCost,
  };
}

export {
  computeLateGameUpgradeNeed,
  findInvItemIdBySpecialKind,
  invHasSpecialKind,
};
