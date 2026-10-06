import { getGrowthRecipeWork } from './growthPlanRuntime.js';
import { commitProcurementTransaction } from './procurementTransactionRuntime.js';
import { classifySpecialByName, isSpecialCoreKind } from './craftRuntime.js';
import { isDefaultKioskItem } from '../../../utils/marketItemPolicy.js';
import { isAtOrAfterWorldTime } from './worldTime.js';
import { canUseKioskAtWorldTime, kioskLegendaryPrice } from './marketRuntime.js';
import { applyPerkDiscount, getActorPerkEffects } from './perkRuntime.js';
import { resolveKioskSpecialItems, resolveKioskForceCoreInputs } from './aiKioskSpecialItemsRuntime.js';
import { pickKioskPrioritySpecialAction } from './aiKioskPriorityRuntime.js';
import { pickKioskSurplusBuyAction } from './aiKioskSurplusRuntime.js';

// Preview the same atomic receipt as settlement, then account for every
// remaining recipe step. Quotes never pay, reserve, consume or draw randomness.
export function createKioskRecipeOfferValidator({ actor, targetId = '', publicItems = [],
  ruleset, day = 1, requireComplete = false, validateWithoutRecipe = true } = {}) {
  let beforeWork;
  return (offer, followingOffer = null) => {
    if (!ruleset || (!targetId && !validateWithoutRecipe)) return true;
    if (targetId) {
      beforeWork ??= getGrowthRecipeWork(actor, publicItems, targetId, { ruleset });
      if (beforeWork.blocked) return false;
    }
    const preview = { ...actor, _procurementActionKey: undefined };
    for (const step of followingOffer ? [offer, followingOffer] : [offer]) {
      // These are separate future actions; only the preview's dedup key resets.
      preview._procurementActionKey = undefined;
      const receipt = commitProcurementTransaction({ actor: preview, offer: step, day, ruleset,
        actionType: step.kind === 'exchange' ? 'kioskExchange' : 'kioskBuy' });
      if (!receipt.ok) return false;
    }
    if (!targetId) return true;
    const afterWork = getGrowthRecipeWork(preview, publicItems, targetId, { ruleset });
    const outstanding = new Map(beforeWork.missing.map(row => [row.itemId, row.need]));
    return !afterWork.blocked && afterWork.plannedCredits <= preview.simCredits
      && afterWork.missing.every(row => row.need <= (outstanding.get(row.itemId) || 0))
      && (!requireComplete || (!afterWork.missing.length && !!afterWork.readyCraftId));
  };
}

export function getAvailableDefaultKioskItems(publicItems = [], marketRules, day, phase) {
  const categories = marketRules?.kiosk?.categories || {};
  return publicItems.filter(item => {
    if (!isDefaultKioskItem(item)) return false;
    const keys = [classifySpecialByName(item.name), ...(Array.isArray(item.tags) ? item.tags : []).map(tag => String(tag).toLowerCase())];
    if (keys.includes('vf')) return categories.vf !== false && isAtOrAfterWorldTime(day, phase, 4, 'day');
    return !keys.some(isSpecialCoreKind) || categories.legendary !== false;
  });
}

export function quoteDefaultKioskGoalAction({ actor, craftGoal, publicItems = [], ruleset,
  marketRules = ruleset?.market, day, phase, upgradeNeed = null, shouldDeferVfForLegend, includeSurplus = false } = {}) {
  if (!canUseKioskAtWorldTime(day, phase)) return null;
  const mr = marketRules?.kiosk || {}, perk = getActorPerkEffects(actor);
  const discount = value => applyPerkDiscount(value, perk.kioskDiscountPct, perk.marketDiscountPct);
  const missingSpecialKeys = new Set((craftGoal?.missing || [])
    .map(row => String(row.special || classifySpecialByName(row.name) || '')).filter(Boolean));
  const availableItems = getAvailableDefaultKioskItems(publicItems, marketRules, day, phase);
  const specialItems = resolveKioskSpecialItems(availableItems, craftGoal?.missing);
  const forceCoreInputs = missingSpecialKeys.has('force_core')
    ? resolveKioskForceCoreInputs(availableItems, actor?.inventory, specialItems) : null;
  const isOfferUsable = createKioskRecipeOfferValidator({ actor, targetId: String(craftGoal?.target?._id || ''),
    publicItems, ruleset, day });
  const priority = pickKioskPrioritySpecialAction({ missingSpecialKeys, specialItems, forceCoreInputs,
    inv: actor?.inventory, simCredits: Number(actor?.simCredits || 0), up: upgradeNeed,
    curDay: day, curPhase: phase, allowVf: mr.categories?.vf !== false,
    allowLegendary: mr.categories?.legendary !== false,
    shouldDeferVfForLegend: shouldDeferVfForLegend ?? (Number(upgradeNeed?.goalTier || 0) >= 6
      && Math.max(0, Number(upgradeNeed?.minTier || 0)) < 5),
    kioskSpecialPrice: key => discount(key === 'vf' ? Number(mr.prices?.vf ?? 500)
      : kioskLegendaryPrice(key, mr.prices?.legendaryByKey)),
    isOfferUsable });
  if (priority !== undefined || !includeSurplus) return priority;
  return pickKioskSurplusBuyAction({ ...specialItems, spendSurplus: upgradeNeed?.spendSurplus,
    mr, simCredits: Number(actor?.simCredits || 0), inv: actor?.inventory, ruleset, up: upgradeNeed,
    curDay: day, curPhase: phase, allowVf: mr.categories?.vf !== false,
    allowLegendary: mr.categories?.legendary !== false, applyKioskCost: discount,
    tacIsLvMax: String(ruleset?.ai?.tacModuleUpgradeMode || 'level') === 'level'
      && Number(actor?.tacticalSkillLevel || 1) >= 2,
    quoteOnly: true, isOfferUsable });
}
