import {
  clampTier4,
  findItemByKeywords,
  randInt,
} from './simulationCommon';
import { isAtOrAfterWorldTime } from './worldTime';
import { applyPerkDiscount, getActorPerkEffects, perkNumber } from './perkRuntime';
import { invQty } from './inventoryRules';
import {
  canUseKioskAtWorldTime,
  hasKioskAtZone,
  kioskLegendaryPrice,
} from './marketRuntime';
import {
  classifySpecialByName,
  getOneSpecialShortMissing,
  isSpecialCoreKind,
} from './craftRuntime';
import { getLegendaryCoreCandidates } from './legendaryRuntime';
import { pickFromAllCrates } from './lootRuntime';
import { getRegionZoneWeightsForItem } from './lumiaRegionData';
import { chooseAiMoveTargets } from './aiMoveTargetRuntime';
import {
  lowestEquippedTier,
  pickMissingBasicItemId,
  rollDroneOrder,
} from './aiDroneRuntime';
import { pickKioskCatalogAction } from './aiKioskCatalogRuntime';
import { pickKioskExchangeAction } from './aiKioskExchangeRuntime';
import { pickKioskPrioritySpecialAction } from './aiKioskPriorityRuntime';
import { pickKioskSurplusBuyAction } from './aiKioskSurplusRuntime';
import { resolveKioskSpecialItems } from './aiKioskSpecialItemsRuntime';

function rollKioskInteraction(mapObj, zoneId, kiosks, publicItems, curDay, curPhase, actor, craftGoal, itemNameById, marketRules, ruleset = null, upgradeNeed = null, absSecNow = 0) {
  const mr = marketRules?.kiosk || {};
  const perkFx = getActorPerkEffects(actor);
  const perkChanceBonus = Math.max(0, perkNumber(perkFx.kioskChancePlus || 0)) + Math.max(0, perkNumber(perkFx.goalWeightPlus || 0)) * 0.01;
  const applyKioskCost = (value) => applyPerkDiscount(value, perkFx.kioskDiscountPct, perkFx.marketDiscountPct);
  // 실제 ER 일반 Kiosk는 시작부터 접근 가능하고, 시뮬은 위치/크레딧 조건으로만 제어합니다.
  if (!canUseKioskAtWorldTime(curDay, curPhase)) return null;

  // 위치 게이트: 키오스크는 특정 시설(병원/성당/경찰서/소방서/양궁장/절/창고/연구소/호텔/학교) 구역에만 존재
  if (!hasKioskAtZone(kiosks, mapObj, zoneId)) return null;

  const simCredits = Math.max(0, Number(actor?.simCredits || 0));
  // 실제 ER 일반 Kiosk는 별도 사용 쿨다운보다 크레딧/행동 점유로 제어된다.
  // 시뮬도 1 tick 1 행동 규칙만 적용하고, 별도 cooldown gate는 두지 않는다.
  const items = Array.isArray(publicItems) ? publicItems : [];
  const findById = (id) => items.find((x) => String(x?._id) === String(id)) || null;

  const miss = Array.isArray(craftGoal?.missing) ? craftGoal.missing : [];
  const up = (upgradeNeed && typeof upgradeNeed === 'object') ? upgradeNeed : null;
  const oneSpecialShort = getOneSpecialShortMissing(craftGoal);
  const hasNeed = miss.length > 0;
  const hasUpgradeNeed = !!up?.wantLegend || !!up?.wantTrans || !!up?.farmCredits || !!up?.spendSurplus;
  const legendOverdue = !!up?.legendOverdue;
  const transOverdue = !!up?.transOverdue;
  const nearLegend = !!up?.nearLegend;
  const nearTrans = !!up?.nearTrans;
  const spendSurplus = !!up?.spendSurplus;
  const hasMeaningfulNeed = hasNeed || hasUpgradeNeed;
  const shouldDeferVfForLegend = Number(up?.goalTier || 0) >= 6 && Math.max(0, Number(up?.minTier || 0)) < 5;
  const missingSpecialKeys = new Set(
    miss
      .map((m) => String(m?.special || classifySpecialByName(m?.name) || ''))
      .filter((key) => key === 'vf' || isSpecialCoreKind(key))
  );
  const cats = mr?.categories || {};
  const allowVf = cats?.vf !== false;
  const allowLegendary = cats?.legendary !== false;
  const allowBasic = cats?.basic !== false;


  // 목표(조합) 기반이면 더 적극적으로 이용(룰셋)
  const chanceNeed = Number(mr?.chanceNeed ?? 0.42);
  const chanceIdle = Number(mr?.chanceIdle ?? 0.16);
  const needCount = Math.max(0, miss.length);
  const earlyProcureBonus = (curDay <= 2) ? 0.08 : 0;
  const savedPlanLegendBonus = oneSpecialShort ? (oneSpecialShort?.special === 'vf' ? 0.18 : 0.15) : 0;
  const pacingPressure = (legendOverdue ? 0.14 : (nearLegend ? 0.05 : 0)) + (transOverdue ? 0.18 : (nearTrans ? 0.06 : 0));
  const surplusPressure = spendSurplus
    ? Math.min(0.30, 0.10 + Math.max(0, simCredits - 250) / 2400)
    : 0;
  const urgencyBonus = hasMeaningfulNeed
    ? Math.min(0.24,
        needCount * 0.04
        + (up?.wantLegend ? 0.03 : 0)
        + (up?.wantTrans ? 0.05 : 0)
        + (up?.farmCredits ? 0.02 : 0)
        + (spendSurplus ? 0.10 : 0)
      )
    : 0;
  const affordableNeedBonus = hasMeaningfulNeed
    ? (simCredits >= Number(mr?.prices?.basic ?? 10) ? 0.12 : 0)
    : 0;
  const chance = hasMeaningfulNeed
    ? Math.min(0.995, chanceNeed + earlyProcureBonus + urgencyBonus + affordableNeedBonus + savedPlanLegendBonus + pacingPressure + surplusPressure + perkChanceBonus)
    : Math.min(0.75, chanceIdle + ((curDay <= 2 && simCredits >= Number(mr?.prices?.basic ?? 10)) ? 0.04 : 0) + (legendOverdue ? 0.04 : 0) + surplusPressure + perkChanceBonus);

  // ✅ 서버(어드민)에서 편집한 키오스크 카탈로그가 있으면 그대로 사용(우선)
  // - 카탈로그는 각 키오스크 문서(Kiosk.catalog)에 저장되며, /public/kiosks로 내려옵니다.
  const kioskDoc = (Array.isArray(kiosks) ? kiosks : []).find((k) => {
    const mid = String(k?.mapId?._id || k?.mapId || '').trim();
    const zid = String(k?.zoneId || '').trim();
    return mid && String(mapObj?._id || '').trim() === mid && String(zoneId || '').trim() === zid;
  });
  let catalog = Array.isArray(kioskDoc?.catalog) ? kioskDoc.catalog : [];

  // 카탈로그 가격이 과도하게 크면(예: 800~1200) 시뮬 기본 규칙으로 fallback
  if (catalog.length && catalog.some((r) => Number(r?.priceCredits || 0) > 650)) catalog = [];

  const hasCatalogNeed = catalog.some((r) => {
    const itemId = String(r?.itemId?._id || r?.itemId || '').trim();
    return itemId && miss.some((m) => String(m?.itemId || '') === itemId);
  });
  const kioskSpecialPrice = (key) => {
    const k = String(key || '');
    if (k === 'vf') return applyKioskCost(Number(mr?.prices?.vf ?? 500));
    return applyKioskCost(kioskLegendaryPrice(k, mr?.prices?.legendaryByKey));
  };
  const canBuyMissingSpecialNow = [...missingSpecialKeys].some((key) => {
    if (key === 'vf') return !shouldDeferVfForLegend && allowVf && isAtOrAfterWorldTime(curDay, curPhase, 4, 'day') && simCredits >= kioskSpecialPrice('vf');
    return allowLegendary && isAtOrAfterWorldTime(curDay, curPhase, 2, 'day') && simCredits >= kioskSpecialPrice(key);
  });
  const canBuyUpgradeSpecialNow = (
    (!shouldDeferVfForLegend && allowVf && up?.wantTrans && !up?.hasVf && isAtOrAfterWorldTime(curDay, curPhase, 4, 'day') && simCredits >= kioskSpecialPrice('vf'))
    || (allowLegendary && up?.wantLegend && !up?.hasLegendMatAny && isAtOrAfterWorldTime(curDay, curPhase, 2, 'day') && simCredits >= Math.min(
      kioskSpecialPrice('meteor'),
      kioskSpecialPrice('life_tree'),
      kioskSpecialPrice('mithril'),
      kioskSpecialPrice('force_core')
    ))
  );
  const canBuyForceCoreComponentNow = missingSpecialKeys.has('force_core')
    && allowLegendary
    && isAtOrAfterWorldTime(curDay, curPhase, 2, 'day')
    && simCredits >= Math.min(kioskSpecialPrice('meteor'), kioskSpecialPrice('life_tree'));
  const shouldForceKioskAttempt = canBuyMissingSpecialNow || canBuyUpgradeSpecialNow || canBuyForceCoreComponentNow;
  if (!hasCatalogNeed && !shouldForceKioskAttempt) {
    // 업그레이드 목표(전설/초월)만 있어도 키오스크를 '조금 더 자주' 사용
    if (Math.random() >= chance) return null;
  }
  const pickedByCatalog = pickKioskCatalogAction({
    catalog,
    actor,
    miss,
    hasMeaningfulNeed,
    applyKioskCost,
    findById,
    ruleset,
  });
  if (pickedByCatalog) return pickedByCatalog;

  // --- 우선 교환/환급 규칙(키오스크 핵심) ---
  // - 포스 코어 → 미스릴
  // - 미스릴 → 전술 강화 모듈
  // - 전술 강화 모듈 → 크레딧 환급
  // - 운석 ↔ 생명의 나무 (상호 교환)
  const specialItems = resolveKioskSpecialItems(items);
  const {
    meteorItem,
    lifeTreeItem,
    mithrilItem,
    forceCoreItem,
    tacModuleItem,
    surplusVfItem,
  } = specialItems;
  const tacUpgradeMode = String(ruleset?.ai?.tacModuleUpgradeMode || 'level'); // 'level' | 'stack'
  const TAC_MAX_LV = 2;
  const tacSkillLv = Math.max(1, Math.min(TAC_MAX_LV, Math.floor(Number(actor?.tacticalSkillLevel || 1))));
  const tacIsLvMax = (tacUpgradeMode === 'level') && (tacSkillLv >= TAC_MAX_LV);

  const inv = Array.isArray(actor?.inventory) ? actor.inventory : [];
  const prioritySpecialAction = pickKioskPrioritySpecialAction({
    missingSpecialKeys,
    specialItems,
    inv,
    simCredits,
    up,
    curDay,
    curPhase,
    allowVf,
    allowLegendary,
    shouldDeferVfForLegend,
    kioskSpecialPrice,
  });
  if (prioritySpecialAction !== undefined) return prioritySpecialAction;

  const surplusBuy = pickKioskSurplusBuyAction({
    spendSurplus,
    mr,
    simCredits,
    inv,
    ruleset,
    up,
    curDay,
    curPhase,
    allowVf,
    allowLegendary,
    surplusVfItem,
    meteorItem,
    lifeTreeItem,
    mithrilItem,
    forceCoreItem,
    tacModuleItem,
    applyKioskCost,
    tacIsLvMax,
  });
  if (surplusBuy) return surplusBuy;

  const tacModuleHave = tacModuleItem?._id ? invQty(inv, String(tacModuleItem._id)) : 0;
  const exchangeAction = pickKioskExchangeAction({
    specialItems,
    inv,
    miss,
    up,
    mr,
    tacUpgradeMode,
    tacIsLvMax,
    tacSkillLv,
    tacMaxLevel: TAC_MAX_LV,
  });
  if (exchangeAction) return exchangeAction;

  // 0-C-0) Saved Plan식 추천: 목표 상위 장비가 '특수 재료 1개만 부족'하면 그 재료를 최우선 구매
  if (oneSpecialShort) {
    const key = String(oneSpecialShort.special || '');
    if (!(key === 'vf' && shouldDeferVfForLegend)) {
      const onePick = (key === 'meteor') ? meteorItem : (key === 'life_tree') ? lifeTreeItem : (key === 'mithril') ? mithrilItem : (key === 'force_core') ? forceCoreItem : (key === 'vf' ? findItemByKeywords(items, ['vf', '혈액', '샘플', 'blood sample']) : tacModuleItem);
      const oneCost = (key === 'vf')
        ? applyKioskCost(Number(mr?.prices?.vf ?? 500))
        : ((key === 'meteor' || key === 'life_tree' || key === 'mithril' || key === 'force_core')
          ? applyKioskCost(kioskLegendaryPrice(String(key), mr?.prices?.legendaryByKey))
          : applyKioskCost(Number(mr?.prices?.tacModule ?? 10)));
      const oneOk = key === 'vf'
        ? Number(mr?.buySuccess?.vf ?? 0.95)
        : Number(mr?.buySuccess?.legendary ?? 0.95);
      if (onePick?._id && simCredits >= oneCost && Math.random() < Math.min(0.995, oneOk + 0.06)) {
        return { kind: 'buy', item: onePick, itemId: String(onePick._id), qty: 1, cost: oneCost, label: `추천 특수재료(${key})` };
      }
    }
  }

  // 0-C) 목표 기반 구매: 운석/생나/미스릴/포코/모듈
  // - 가격은 아이템 baseCreditValue를 우선 사용(없으면 기존 룰셋 fallback).
  const tacModuleTargetMin = (tacUpgradeMode === 'level') ? (tacSkillLv >= TAC_MAX_LV ? 0 : 1) : 1;
  const tacModuleWant = tacModuleItem && (tacModuleHave < tacModuleTargetMin) && (simCredits >= Number(mr?.prices?.tacModule ?? 10)) && (Math.random() < 0.35);
  const wantSpecial = tacModuleWant
    ? ({ name: '전술 강화 모듈', special: 'tac_skill_module' })
    : miss.find((m) => isSpecialCoreKind(m?.special) || isSpecialCoreKind(classifySpecialByName(m?.name)) || (!tacIsLvMax && String(m?.name||'').includes('전술 강화 모듈')));
  if (wantSpecial) {
    const key = wantSpecial.special || classifySpecialByName(wantSpecial.name);
    const pick = (key === 'meteor') ? meteorItem : (key === 'life_tree') ? lifeTreeItem : (key === 'mithril') ? mithrilItem : (key === 'force_core') ? forceCoreItem : tacModuleItem;
    if (pick && pick._id) {
      const cost = (key === 'meteor' || key === 'life_tree' || key === 'mithril' || key === 'force_core')
        ? applyKioskCost(kioskLegendaryPrice(String(key), mr?.prices?.legendaryByKey))
        : Number(mr?.prices?.tacModule ?? 10);
      const ok = Number(mr?.buySuccess?.legendary ?? 0.85);
      const pressureOk = Math.min(0.995, ok + (legendOverdue ? 0.08 : 0) + (transOverdue ? 0.08 : 0) + (oneSpecialShort ? 0.03 : 0));
      if (simCredits >= cost && Math.random() < pressureOk) {
        return { kind: 'buy', item: pick, itemId: String(pick._id), qty: 1, cost, label: '특수재료 구매' };
      }
    }
  }

  // 0-D) 업그레이드 목표(전설/초월) 기반 구매: 목표 레시피가 없어도 후반 세팅을 위해 특수재료를 확보
  // - ER 참고: 크레딧으로 키오스크에서 특수 재료 구매 가능
  // - 우선순위: 초월 목표면 VF → 전설 재료(아무거나)
  if (up && isAtOrAfterWorldTime(curDay, curPhase, 2, 'day')) {
    const buyOkLegend = Number(mr?.buySuccess?.legendary ?? 0.85);
    const buyOkVf = Number(mr?.buySuccess?.vf ?? 0.85);

    // (A) 초월: VF 혈액 샘플
    if (!shouldDeferVfForLegend && allowVf && up.wantTrans && !up.hasVf && isAtOrAfterWorldTime(curDay, curPhase, 4, 'day')) {
      const vfItem2 = findItemByKeywords(items, ['vf', '혈액', '샘플', 'blood sample']);
      const cost = applyKioskCost(Number(mr?.prices?.vf ?? 500));
      if (vfItem2?._id && simCredits >= cost && Math.random() < buyOkVf) {
        return { kind: 'buy', item: vfItem2, itemId: String(vfItem2._id), qty: 1, cost, label: 'VF 혈액 샘플(업그레이드)' };
      }
    }

    // (B) 전설: 4대 전설 재료 중 "가장 싼" 것부터 확보
    if (allowLegendary && up.wantLegend && !up.hasLegendMatAny) {
      const cand = [];
      if (meteorItem?._id) cand.push({ key: 'meteor', it: meteorItem, cost: applyKioskCost(kioskLegendaryPrice('meteor', mr?.prices?.legendaryByKey)) });
      if (lifeTreeItem?._id) cand.push({ key: 'life_tree', it: lifeTreeItem, cost: applyKioskCost(kioskLegendaryPrice('life_tree', mr?.prices?.legendaryByKey)) });
      if (mithrilItem?._id) cand.push({ key: 'mithril', it: mithrilItem, cost: applyKioskCost(kioskLegendaryPrice('mithril', mr?.prices?.legendaryByKey)) });
      if (forceCoreItem?._id) cand.push({ key: 'force_core', it: forceCoreItem, cost: applyKioskCost(kioskLegendaryPrice('force_core', mr?.prices?.legendaryByKey)) });
      cand.sort((a, b) => (a.cost - b.cost) || String(a.key).localeCompare(String(b.key)));
      const pick = cand[0] || null;
      const legendBuyBias = (curDay <= 3 ? 0.06 : 0) + (miss.length >= 2 ? 0.04 : 0) + (legendOverdue ? 0.08 : 0) + (nearLegend ? 0.03 : 0);
      if (pick?.it?._id && simCredits >= pick.cost && Math.random() < Math.min(0.99, buyOkLegend + legendBuyBias)) {
        return { kind: 'buy', item: pick.it, itemId: String(pick.it._id), qty: 1, cost: Math.max(0, Number(pick.cost || 0)), label: `특수재료(${pick.key})` };
      }
    }
  }

  // 1) 목표 기반: VF 혈액 샘플 (룰셋 가격/성공률)
  const needVf = miss.find((m) => m?.special === 'vf' || classifySpecialByName(m?.name) === 'vf');
  if (!shouldDeferVfForLegend && needVf && isAtOrAfterWorldTime(curDay, curPhase, 4, 'day')) {
    const vfItem = findById(needVf.itemId) || findItemByKeywords(items, ['vf', '혈액', '샘플', 'sample']);
    const cost = applyKioskCost(Number(mr?.prices?.vf ?? 500));
    const ok = Number(mr?.buySuccess?.vf ?? 0.85);
    if (allowVf && vfItem && simCredits >= cost && Math.random() < ok) {
      return { kind: 'buy', item: vfItem, itemId: String(vfItem._id), qty: 1, cost, label: 'VF 혈액 샘플' };
    }
  }

  // 2) 목표 기반: 전설 재료(룰셋 가격/성공률)
  const needCore = miss.find((m) => isSpecialCoreKind(m?.special) || isSpecialCoreKind(classifySpecialByName(m?.name)));
  if (needCore) {
    const key = needCore.special || classifySpecialByName(needCore.name);
    const coreNameMap = { meteor: '운석', life_tree: '생명의 나무', mithril: '미스릴', force_core: '포스 코어' };
    const label = coreNameMap[key] || '전설 재료';

    const candidates = getLegendaryCoreCandidates(items);
    const found = findById(needCore.itemId) || (candidates.find((c) => c.key === key)?.item || null);
    const cost = applyKioskCost(kioskLegendaryPrice(key, mr?.prices?.legendaryByKey));

    if (found) {
      // 구매 우선
      const ok = Number(mr?.buySuccess?.legendary ?? 0.85);
      const needBuyOk = Math.min(0.995, ok + (legendOverdue ? 0.08 : 0) + (transOverdue ? 0.05 : 0));
      if (allowLegendary && simCredits >= cost && Math.random() < needBuyOk) {
        return { kind: 'buy', item: found, itemId: String(found._id), qty: 1, cost, label };
      }
    }
  }

  // 3) 목표 기반: 일반 재료(맵 상자풀에 존재하는 재료만 구매)
  const needBasic = miss.find((m) => {
    if (!m?.itemId || m?.special) return false;
    const it = findById(m.itemId) || { _id: String(m.itemId), name: String(m?.name || '') };
    return getRegionZoneWeightsForItem(it, mapObj?.zones, new Set()).size > 0;
  });
  if (needBasic) {
    const it = findById(needBasic.itemId);
    const cost = applyKioskCost(Number(mr?.prices?.basic ?? 10));
    const ok = Number(mr?.buySuccess?.basic ?? 0.75);
    if (allowBasic && it && simCredits >= cost && Math.random() < ok) {
      const needQty = Math.max(1, Math.min(3, Math.max(1, Number(needBasic.need || 1) - Number(needBasic.have || 0))));
      return { kind: 'buy', item: it, itemId: String(it._id), qty: needQty, cost, label: '재료 보급' };
    }
  }

  // 4) fallback: 기존 랜덤 로직 (VF/전설 재료/기본 보급)

  // 4-1) 4일차 낮 이후: VF 혈액 샘플(500 크레딧) 구매 가능
  if (isAtOrAfterWorldTime(curDay, curPhase, 4, 'day')) {
    const vfChance = Number(mr?.fallback?.vfChance ?? 0.25);
    if (!shouldDeferVfForLegend && allowVf && Math.random() < vfChance) {
      const vf = findItemByKeywords(items, ['vf', '혈액', '샘플', 'sample']);
      const cost = applyKioskCost(Number(mr?.prices?.vf ?? 500));
      if (vf && simCredits >= cost) return { kind: 'buy', item: vf, itemId: String(vf._id), qty: 1, cost, label: 'VF 혈액 샘플' };
    }
  }

  // 4-2) 2일차 낮 이후: 운석/생나 키오스크 구매/교환 가능(미스릴/포스코어도 포함)
  const lgChance = Number(mr?.fallback?.legendaryChance ?? 0.20);
  if (allowLegendary && Math.random() < lgChance) {
    const cores = getLegendaryCoreCandidates(items);
    if (cores.length) {
      const picked = cores[Math.floor(Math.random() * cores.length)];
      const cost = applyKioskCost(kioskLegendaryPrice(picked.key, mr?.prices?.legendaryByKey));

      // 구매
      const ok = Number(mr?.buySuccess?.legendaryFallback ?? mr?.buySuccess?.legendary ?? 0.7);
      if (simCredits >= cost && Math.random() < ok) {
        return { kind: 'buy', item: picked.item, itemId: String(picked.item._id), qty: 1, cost, label: picked.label };
      }
    }
  }

  // 4-3) 기본 보급(하급 재료)
  const basicChance = Number(mr?.fallback?.basicChance ?? 0.35);
  if (allowBasic && Math.random() < basicChance) {
    const entry = pickFromAllCrates(mapObj, publicItems);
    if (entry?.itemId) {
      const it = findById(entry.itemId);
      const cost = applyKioskCost(Number(mr?.prices?.basic ?? 10));
      if (it && simCredits >= cost) {
        const qty = Math.max(1, randInt(entry?.minQty ?? 1, entry?.maxQty ?? 1));
        return { kind: 'buy', item: it, itemId: String(it._id), qty, cost, label: '보급품' };
      }
    }
  }

  return null;
}


export {
  chooseAiMoveTargets,
  pickMissingBasicItemId,
  rollKioskInteraction,
  lowestEquippedTier,
  rollDroneOrder,
};
