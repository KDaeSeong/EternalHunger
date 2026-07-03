import { pickWeighted } from './simulationCommon';
import { EQUIP_SLOTS } from './simulationConstants';
import { isAtOrAfterWorldTime } from './worldTime';
import { applyPerkDiscount, getActorPerkEffects, perkNumber } from './perkRuntime';
import { invQty } from './inventoryRules';
import { ensureEquipped } from './survivorRuntime';
import {
  classifySpecialByName,
  isSpecialCoreKind,
  normalizeGoalTier,
} from './craftRuntime';

function clampGearTier(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(6, Math.floor(n)));
}

function pickMissingBasicItemId(craftGoal) {
  const miss = Array.isArray(craftGoal?.missing) ? craftGoal.missing : [];
  const hit = miss.find((m) => m?.itemId && !m?.special);
  return hit?.itemId ? String(hit.itemId) : '';
}

function lowestEquippedTier(actor, publicItems = []) {
  const eq = ensureEquipped(actor);
  const items = Array.isArray(publicItems) ? publicItems : [];
  const tiers = EQUIP_SLOTS.map((slot) => {
    const itemId = String(eq?.[slot] || '');
    if (!itemId) return 0;
    const item = items.find((it) => String(it?._id || '') === itemId) || null;
    return clampGearTier(Number(item?.tier || 0));
  }).filter((v) => Number.isFinite(v) && v > 0);
  return tiers.length ? Math.min(...tiers) : 0;
}

function rollDroneOrder(droneOffers, mapObj, publicItems, curDay, curPhase, actor, phaseIdxNow, craftGoal, itemNameById, marketRules, absSecNow = 0) {
  const dm = marketRules?.drone || {};
  if (dm?.enabled === false) return null;
  const perkFx = getActorPerkEffects(actor);
  const perkChanceBonus = Math.max(0, perkNumber(perkFx.droneChancePlus || 0)) + Math.max(0, perkNumber(perkFx.craftChancePlus || 0)) * 0.01;
  const applyDroneCost = (value) => applyPerkDiscount(value, perkFx.droneDiscountPct, perkFx.marketDiscountPct);

  const invCount = Array.isArray(actor?.inventory) ? actor.inventory.length : 0;
  const credits = Math.max(0, Number(actor?.simCredits || 0));
  const items = Array.isArray(publicItems) ? publicItems : [];
  const routeDroneWindow = Number(curDay || 0) === 1 || (Number(curDay || 0) === 2 && String(curPhase || '').toLowerCase() === 'morning');
  const routeDroneNeedId = routeDroneWindow
    ? (Array.isArray(actor?.routePlanDroneItemIds) ? actor.routePlanDroneItemIds : [])
        .map((id) => String(id || '').trim())
        .filter(Boolean)
        .find((id) => {
          const needQty = Math.max(1, Math.floor(Number(actor?.routePlanRequiredQtyById?.[id] || 1)));
          return invQty(actor?.inventory, id) < needQty;
        }) || ''
    : '';
  const needId = routeDroneNeedId || pickMissingBasicItemId(craftGoal);
  const hasRouteDroneNeed = !!routeDroneNeedId;
  const hasNeed = !!needId;
  const goalTier = normalizeGoalTier(actor?.goalGearTier ?? 6);
  const legendOverdue = goalTier >= 5 && isAtOrAfterWorldTime(curDay, curPhase, 2, 'night') && lowestEquippedTier(actor, publicItems) < 5;
  const transOverdue = goalTier >= 6 && isAtOrAfterWorldTime(curDay, curPhase, 4, 'day') && lowestEquippedTier(actor, publicItems) < 6;

  const needLow = Number(dm?.chanceNeedLowInv ?? 0.55);
  const needDef = Number(dm?.chanceNeedDefault ?? 0.38);
  const lowInv = Number(dm?.chanceLowInv ?? 0.30);
  const inv2 = Number(dm?.chanceInv2 ?? 0.20);
  const def = Number(dm?.chanceDefault ?? 0.10);
  const routeNeedChance = Math.max(0, Math.min(0.98, Number(dm?.chanceRoutePlanNeed ?? 0.94)));
  const droneBaseChance = hasRouteDroneNeed ? routeNeedChance : (hasNeed ? (invCount <= 2 ? needLow : needDef) : (invCount <= 1 ? lowInv : invCount == 2 ? inv2 : def));
  const surplusMinCredits = Math.max(0, Number(dm?.surplusMinCredits ?? 180));
  const surplusCreditPressure = credits >= Math.max(900, surplusMinCredits * 5)
    ? 0.42
    : credits >= Math.max(600, surplusMinCredits * 3)
      ? 0.30
      : credits >= Math.max(350, surplusMinCredits * 2)
        ? 0.18
        : credits >= surplusMinCredits
          ? 0.08
          : 0;
  const droneUrgency = hasRouteDroneNeed
    ? Math.min(0.04, (credits >= Number(dm?.price ?? 10) ? 0.03 : 0) + (invCount <= 2 ? 0.01 : 0))
    : hasNeed
    ? Math.min(0.24, ((curDay <= 2) ? 0.08 : 0) + ((credits >= Number(dm?.price ?? 10)) ? 0.10 : 0) + (invCount <= 2 ? 0.06 : 0))
    : ((curDay <= 2 && invCount <= 1) ? 0.05 : 0);
  const pacingPressure = (legendOverdue ? 0.12 : 0) + (transOverdue ? 0.16 : 0) + ((goalTier >= 5 && hasNeed && curDay <= 2) ? 0.04 : 0);
  const baseChance = Math.min(0.98, droneBaseChance + droneUrgency + pacingPressure + surplusCreditPressure + perkChanceBonus);
  if (Math.random() >= baseChance) return null;

  const pool = [];
  function isSpecialName(name) {
    const kind = classifySpecialByName(name);
    return kind === 'vf' || isSpecialCoreKind(kind);
  }

  if (hasRouteDroneNeed) {
    const routeNeedItem = items.find((x) => String(x?._id) === String(routeDroneNeedId));
    const routeNeedPrice = applyDroneCost(Math.max(0, Number(dm?.routeNeedFallbackPrice ?? dm?.needFallbackPrice ?? dm?.price ?? 10)));
    if (routeNeedItem && !isSpecialName(routeNeedItem?.name) && credits >= routeNeedPrice) {
      return {
        kind: 'drone',
        offerId: null,
        item: routeNeedItem,
        itemId: String(routeNeedItem._id),
        qty: 1,
        cost: routeNeedPrice,
        source: 'route_plan_drone',
      };
    }
  }

  if (Array.isArray(droneOffers) && droneOffers.length) {
    for (const offer of droneOffers) {
      const price = applyDroneCost(Math.max(0, Number(offer?.price ?? offer?.cost ?? 0)));
      const itemId = String(offer?.itemId ?? offer?.item?._id ?? '');
      const item = offer?.item || (itemId ? items.find((x) => String(x?._id) === itemId) : null);
      if (!itemId || !item) continue;

      const nm = String(item?.name || '');
      if (isSpecialName(nm)) continue;
      if (credits < price) continue;

      let weight = Math.max(1, Number(offer?.weight ?? 1));
      const mul = Math.max(1, Number(dm?.needWeightMul ?? 8));
      if (hasRouteDroneNeed && String(itemId) === String(routeDroneNeedId)) weight *= (mul + Math.max(10, Number(dm?.routeNeedWeightBonus ?? 16)) + (legendOverdue ? 4 : 0) + (transOverdue ? 6 : 0));
      else if (hasNeed && String(itemId) === String(needId)) weight *= (mul + (legendOverdue ? 4 : 0) + (transOverdue ? 6 : 0));

      pool.push({ kind: 'offer', offerId: offer?.offerId ?? offer?._id ?? null, item, itemId, price, weight, source: hasRouteDroneNeed && String(itemId) === String(routeDroneNeedId) ? 'route_plan_drone' : '' });
    }
  }

  if (hasNeed && !pool.some((p) => String(p?.itemId) === String(needId))) {
    const it = items.find((x) => String(x?._id) === String(needId));
    const nfPrice = applyDroneCost(Math.max(0, Number(hasRouteDroneNeed ? (dm?.routeNeedFallbackPrice ?? dm?.needFallbackPrice ?? 10) : (dm?.needFallbackPrice ?? 10))));
    if (it && !isSpecialName(it?.name) && credits >= nfPrice) {
      const w = Math.max(1, Number(hasRouteDroneNeed ? (dm?.routeNeedFallbackWeight ?? 18) : (dm?.needFallbackWeight ?? 5)));
      pool.push({ kind: hasRouteDroneNeed ? 'routeNeedFallback' : 'needFallback', offerId: null, item: it, itemId: String(it._id), price: nfPrice, weight: w, source: hasRouteDroneNeed ? 'route_plan_drone' : 'craft_need' });
    }
  }

  if (!pool.length && items.length) {
    const fallbackKeywords = Array.isArray(dm?.fallbackKeywords) ? dm.fallbackKeywords : ['천', '가죽', '철', '돌', '나뭇', 'wood', 'leather', 'fabric', 'iron', 'stone'];
    for (const it of items) {
      const name = String(it?.name || '');
      if (!name) continue;
      if (isSpecialName(name)) continue;

      const low = name.toLowerCase();
      const ok = fallbackKeywords.some((k) => low.includes(String(k).toLowerCase()));
      if (!ok) continue;

      const price = applyDroneCost(Math.max(0, Number(dm?.price ?? 10)));
      if (credits >= price) {
        pool.push({ kind: 'fallback', offerId: null, item: it, itemId: String(it._id), price, weight: 1 });
      }
    }
  }

  if (!pool.length) return null;
  const picked = pickWeighted(pool);
  if (!picked?.itemId) return null;

  return {
    kind: 'drone',
    offerId: picked.offerId,
    item: picked.item,
    itemId: String(picked.itemId),
    qty: 1,
    cost: Math.max(0, Number(picked.price || 0)),
    source: String(picked.source || ''),
  };
}

export {
  lowestEquippedTier,
  pickMissingBasicItemId,
  rollDroneOrder,
};
