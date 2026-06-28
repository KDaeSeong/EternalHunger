import { normalizeWeaponType } from '../../../utils/equipmentCatalog';
import {
  compactIO,
  tierLabelKo,
} from './simulationCommon';
import {
  EQUIP_SLOTS,
  SLOT_ICON,
  START_WEAPON_TYPES,
} from './simulationConstants';
import { isAtOrAfterWorldTime, worldPhaseIndex } from './worldTime';
import { canUseKioskAtWorldTime } from './marketRuntime';
import { getActorPerkEffects, perkNumber } from './perkRuntime';
import {
  addItemToInventory,
  canReceiveItem,
  consumeIngredientsFromInv,
  formatInvAddNote,
  getInvItemId,
  getInvRules,
  inferEquipSlot,
  inferItemCategory,
  invQty,
  normalizeInventory,
} from './inventoryRules';
import { ensureEquipped } from './survivorRuntime';
import {
  applyEquipTier,
  buildCraftDebugInfo,
  classifySpecialByName,
  computeCraftTierFromIngredients,
  normalizeGoalTier,
  pickBestEquipBySlot,
  pickGoalLoadoutBySlot,
} from './craftRuntime';

// --- 전설/초월 세팅 목표(관전형 AI) ---
// - 목적: "파밍(크레딧) → 키오스크 구매 → 전설/초월 제작" 루프를 목표로 움직이게 함
// - craftGoal(레시피 목표)이 없더라도, 장비 티어가 낮으면 후반 세팅을 추구
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

  // ✅ 캐릭터 목표(영웅/전설/초월)에 따라 후반 세팅(키오스크/특수재료) 욕구를 달리함
  const goalTier = normalizeGoalTier(actor?.goalGearTier ?? 6);
  const allowLegend = goalTier >= 5;
  const allowTrans = goalTier >= 6;

  // 키오스크가 2일차 낮부터 의미 있게 동작하므로, 목표도 그 시점부터 활성화
  const nearLegend = allowLegend && minTier >= 4 && minTier < 5;
  const nearTrans = allowTrans && minTier >= 5 && minTier < 6;
  const wantLegend = allowLegend && ((nearLegend && canUseKioskAtWorldTime(day, phase)) || isAtOrAfterWorldTime(day, phase, 2, 'day')) && minTier < 5;
  const wantTrans = allowTrans && ((nearTrans && canUseKioskAtWorldTime(day, phase)) || isAtOrAfterWorldTime(day, phase, 3, 'day')) && minTier < 6;
  const legendOverdue = allowLegend && ((nearLegend && isAtOrAfterWorldTime(day, phase, 1, 'night')) || isAtOrAfterWorldTime(day, phase, 2, 'day')) && minTier < 5;
  const transOverdue = allowTrans && ((nearTrans && isAtOrAfterWorldTime(day, phase, 3, 'day')) || isAtOrAfterWorldTime(day, phase, 3, 'night')) && minTier < 6;

  const legendCost = Math.max(0, Number(ruleset?.market?.kiosk?.prices?.legendaryByKey?.meteor ?? 200));
  const forceCost = Math.max(0, Number(ruleset?.market?.kiosk?.prices?.legendaryByKey?.force_core ?? 350));
  const transCost = Math.max(0, Number(ruleset?.market?.kiosk?.prices?.vf ?? 500));

  // 크레딧 파밍 필요(키오스크 구매/후반 세팅 가속)
  const needCreditsForLegend = wantLegend && simCredits < legendCost;
  const needCreditsForTrans = wantTrans && simCredits < transCost;
  const farmCredits = needCreditsForLegend || needCreditsForTrans;

  return {
    goalTier,
    tiers,
    minTier,
    simCredits,
    lowCount,
    wantLegend,
    wantTrans,
    nearLegend,
    nearTrans,
    legendOverdue,
    transOverdue,
    hasVf,
    hasLegendMatAny,
    farmCredits,
    legendCost,
    forceCost,
    transCost,
  };
}

// --- 목표 기반 이동(조합 목표 + 월드 스폰 + 키오스크) ---

function tryAutoCraftFromInventory(actor, craftables, itemNameById, itemMetaById, day, phaseIdxNow, ruleset) {
  if (!actor || typeof actor !== 'object') return null;
  if (Number(actor?._invCraftPhaseIdx ?? -9999) === Number(phaseIdxNow || 0)) return null;

  const inv0 = Array.isArray(actor?.inventory) ? actor.inventory : [];
  const actorWNorm = normalizeWeaponType(String(actor?.weaponType || '').trim());
  const perkFx = getActorPerkEffects(actor);
  const goalWeightBonus = Math.max(0, perkNumber(perkFx.goalWeightPlus || 0));
  const craftBias = Math.max(0, perkNumber(perkFx.craftChancePlus || 0));

  const kmap = (actor?._itemKeyById && typeof actor._itemKeyById === 'object') ? actor._itemKeyById : {};
  const goalBySlot = pickGoalLoadoutBySlot(actor);
  const goalKeys = new Set(Object.values(goalBySlot).map((x) => String(x || '').trim()).filter(Boolean));
  const keyOfId = (id) => String(kmap?.[String(id || '')] || '').trim();

  const candidates = (Array.isArray(craftables) ? craftables : [])
    .filter((it) => Array.isArray(it?.recipe?.ingredients) && it.recipe.ingredients.length > 0)
    .filter((it) => {
      const ings = compactIO(it?.recipe?.ingredients || []);
      if (!ings.length) return false;
      return ings.every((ing) => invQty(inv0, ing.itemId) >= Number(ing.qty || 1));
    })
    .filter((it) => {
      const cat = inferItemCategory(it);
      if (cat !== 'equipment') return true;
      const slot = String(it?.equipSlot || inferEquipSlot(it) || '').toLowerCase();
      if (slot === 'weapon') {
        const w = String(it?.weaponType || '').toLowerCase();
        // 무기 타입이 명시된 경우: 캐릭터 선호 무기와 다르면 제작 우선순위에서 제외
        if (w && actorWNorm && w !== actorWNorm) return false;
      }
      // 같은 슬롯에 이미 동급 이상이 있으면 제작하지 않음(재료 낭비 방지)
      const curBest = slot ? pickBestEquipBySlot(inv0, slot) : null;
      const curTier = curBest ? clampGearTier(Number(curBest?.tier || 1)) : 0;
      const tgtTier = clampGearTier(Number(it?.tier || 1));

      // 목표 장비면(같은 티어라도) 목표와 다를 때 1회 교체 제작을 허용
      const wantKey = String(goalBySlot?.[slot] || '').trim();
      const candKey = String(it?.itemKey || it?.externalId || '').trim();
      const wantGoal = !!(wantKey && candKey && wantKey === candKey);
      if (wantGoal) {
        const eqId = String(ensureEquipped(actor)?.[slot] || '');
        const eqKey = eqId ? keyOfId(eqId) : '';
        if (eqKey && eqKey === candKey) return false;
        if (inv0.some((x) => String(getInvItemId(x)) === String(it?._id))) return false;
        return true;
      }

      return tgtTier > curTier;
    })
    .sort((a, b) => {
      const ka = String(a?.itemKey || a?.externalId || '').trim();
      const kb = String(b?.itemKey || b?.externalId || '').trim();
      const ga = (goalKeys.size > 0 && ka && goalKeys.has(ka)) ? 1 : 0;
      const gb = (goalKeys.size > 0 && kb && goalKeys.has(kb)) ? 1 : 0;
      if (gb != ga) return gb - ga;

      const perkScoreA = (ga ? (goalWeightBonus * 100) : 0) + (Number(a?.tier || 1) * craftBias * 4);
      const perkScoreB = (gb ? (goalWeightBonus * 100) : 0) + (Number(b?.tier || 1) * craftBias * 4);
      if (perkScoreB !== perkScoreA) return perkScoreB - perkScoreA;

      const ca = inferItemCategory(a) === 'equipment' ? 1 : 0;
      const cb = inferItemCategory(b) === 'equipment' ? 1 : 0;
      if (cb !== ca) return cb - ca;
      return (Number(b?.tier || 1) - Number(a?.tier || 1)) || String(a?.name || '').localeCompare(String(b?.name || ''));
    });

  for (const target of candidates) {
    const ings = compactIO(target?.recipe?.ingredients || []);
    const cat = inferItemCategory(target);
    const craftTier = (cat === 'equipment')
      ? clampGearTier(Number(target?.tier || computeCraftTierFromIngredients(ings, itemMetaById, itemNameById) || 1))
      : clampGearTier(target?.tier || 1);
    const craftedItem0 = (cat === 'equipment') ? applyEquipTier(target, craftTier) : target;

    // 목표 장비라면 같은 티어 교체를 허용(장비 슬롯 1개 유지 정책에 막히지 않게)
    let craftedItem = craftedItem0;
    if (cat === 'equipment') {
      const slot = String(target?.equipSlot || inferEquipSlot(target) || '').toLowerCase();
      const wantKey = String(goalBySlot?.[slot] || '').trim();
      const candKey = String(target?.itemKey || target?.externalId || '').trim();
      if (wantKey && candKey && wantKey === candKey) {
        craftedItem = { ...craftedItem0, _forceReplaceSameTier: true };
      }
    }

    if (!canReceiveItem(inv0, craftedItem, craftedItem?._id, 1, ruleset)) continue;

    let inv = consumeIngredientsFromInv(inv0, ings);
    inv = addItemToInventory(inv, craftedItem, craftedItem?._id, 1, day, ruleset);
    const meta = inv?._lastAdd;
    const got = Math.max(0, Number(meta?.acceptedQty ?? 1));
    if (got <= 0) continue;

    actor.inventory = inv;
    autoEquipBest(actor, itemMetaById);
    actor._invCraftPhaseIdx = Number(phaseIdxNow || 0);

    const ingText = ings.map((x) => `${itemNameById?.[String(x.itemId)] || String(x.itemId)} x${x.qty}`).join(' + ');
    const tierText = (cat === 'equipment') ? ` (${tierLabelKo(craftTier)})` : '';
    actor._craftDebug = {
      code: 'crafted',
      targetName: String(craftedItem?.name || ''),
      missing: [],
      phaseIdx: Number(phaseIdxNow || 0),
      text: `${craftedItem?.name || '아이템'} 제작 완료`,
    };
    return { changed: true, craftedId: String(craftedItem?._id || ''), craftedTier: Number(craftTier || craftedItem?.tier || 1), craftedName: String(craftedItem?.name || ''), log: `🛠️ [${actor?.name}] 인벤 조합: ${ingText} → ${craftedItem?.name || '아이템'}${tierText} x1` };
  }

  actor._invCraftPhaseIdx = Number(phaseIdxNow || 0);
  actor._craftDebug = {
    ...buildCraftDebugInfo(actor, craftables, itemNameById, ruleset),
    phaseIdx: Number(phaseIdxNow || 0),
  };
  return null;
}

// ===============================
// 레시피 데이터 누락 시 장비 fallback
// - 실제 ER 흐름에서는 craftRuntime의 레시피 제작이 우선입니다.
// - 아래 로직은 imported recipe가 없는 개발/데이터 누락 상황에서만 선택적으로 사용합니다.
// ===============================

function getInvId(x) {
  return String(x?.itemId || x?.id || x?._id || '');
}

function clampGearTier(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 1;
  return Math.max(1, Math.min(6, Math.floor(n)));
}

const GEAR_SLOT_PRIORITY = { weapon: 0, head: 1, clothes: 2, arm: 3, shoes: 4 };

function getInvTier(x, itemMetaById) {
  const t0 = Number(x?.tier);
  if (Number.isFinite(t0) && t0 > 0) return clampGearTier(t0);
  const id = getInvId(x);
  const m = id ? itemMetaById?.[id] : null;
  return clampGearTier(m?.tier || 1);
}

function isLowMaterialInvEntry(x, itemMetaById, itemNameById) {
  if (!x || typeof x !== 'object') return false;
  const id = getInvId(x);
  if (!id) return false;

  const cat = String(x?.category || inferItemCategory(x) || 'material');
  if (cat !== 'material') return false;

  const name = String(x?.name || itemNameById?.[id] || itemMetaById?.[id]?.name || '');
  if (!name) return false;
  if (classifySpecialByName(name)) return false; // 운석/생나/포스코어/미스릴/VF 제외

  const tier = getInvTier(x, itemMetaById);
  return tier <= 2;
}

function countLowMaterials(inventory, itemMetaById, itemNameById) {
  return (Array.isArray(inventory) ? inventory : []).reduce((sum, x) => {
    if (!isLowMaterialInvEntry(x, itemMetaById, itemNameById)) return sum;
    return sum + Math.max(0, Number(x?.qty ?? 1));
  }, 0);
}

function resolveActorWeaponType(actor) {
  const preferred = normalizeWeaponType(String(actor?.weaponType || '').trim());
  if (preferred) return preferred;
  const fallback = START_WEAPON_TYPES[Math.floor(Math.random() * START_WEAPON_TYPES.length)];
  return normalizeWeaponType(fallback);
}

function catalogItemId(item) {
  return String(item?._id || item?.itemId || item?.id || '').trim();
}

function isGeneratedCatalogEquipment(item) {
  const id = catalogItemId(item);
  return id.startsWith('wpn_') || id.startsWith('eq_');
}

function catalogItemKey(item) {
  return String(item?.itemKey || item?.externalId || '').trim();
}

function isPreferredCatalogSource(item) {
  const key = catalogItemKey(item).toLowerCase();
  const tags = Array.isArray(item?.tags) ? item.tags.map((x) => String(x || '').toLowerCase()) : [];
  const source = String(item?.source || '').toLowerCase();
  return key.startsWith('namu:') || tags.includes('namu') || source.includes('openapi') || source.includes('namu') || String(item?.erCode || '').trim();
}

function getCatalogWeaponType(item) {
  const rawList = [
    item?.weaponType,
    item?.itemSubType,
    ...(Array.isArray(item?.tags) ? item.tags : []),
  ];
  for (const raw of rawList) {
    const normalized = normalizeWeaponType(String(raw || '').trim());
    if (normalized) return normalized;
  }
  return '';
}

function cloneCatalogGear(item, opts = {}) {
  if (!item || typeof item !== 'object') return null;
  const tier = clampGearTier(item?.tier || 1);
  return {
    ...item,
    tier,
    rarity: item?.rarity || tierLabelKo(tier),
    equipSlot: String(item?.equipSlot || inferEquipSlot(item) || '').toLowerCase(),
    _forceReplaceSameTier: opts?.forceReplaceSameTier === true,
  };
}

function pickCatalogEquipmentItem(publicItems, opts = {}) {
  const slot = String(opts?.slot || '').toLowerCase();
  if (!slot) return null;
  const targetTier = clampGearTier(opts?.tier || 1);
  const preferredWeaponType = slot === 'weapon' ? normalizeWeaponType(String(opts?.weaponType || '').trim()) : '';
  const avoid = new Set((Array.isArray(opts?.avoidItemIds) ? opts.avoidItemIds : []).map((id) => String(id || '').trim()).filter(Boolean));

  const all = (Array.isArray(publicItems) ? publicItems : [])
    .filter((item) => {
      const id = catalogItemId(item);
      if (!id || avoid.has(id) || isGeneratedCatalogEquipment(item)) return false;
      if (String(item?.lockedByAdmin || '') === 'deleted') return false;
      if (String(item?.equipSlot || inferEquipSlot(item) || '').toLowerCase() !== slot) return false;
      return true;
    });
  if (!all.length) return null;

  const typed = (preferredWeaponType && slot === 'weapon')
    ? all.filter((item) => getCatalogWeaponType(item) === preferredWeaponType)
    : all;
  const typePool = typed.length ? typed : all;
  const preferredSourcePool = typePool.filter(isPreferredCatalogSource);
  const sourcePool = preferredSourcePool.length ? preferredSourcePool : typePool;

  const exact = sourcePool.filter((item) => clampGearTier(item?.tier || 1) === targetTier);
  let pool = exact;
  if (!pool.length && opts?.allowNearestTier !== false) {
    const lower = sourcePool
      .filter((item) => clampGearTier(item?.tier || 1) <= targetTier)
      .sort((a, b) => clampGearTier(b?.tier || 1) - clampGearTier(a?.tier || 1));
    const higher = sourcePool
      .filter((item) => clampGearTier(item?.tier || 1) > targetTier)
      .sort((a, b) => clampGearTier(a?.tier || 1) - clampGearTier(b?.tier || 1));
    if (lower.length) {
      const bestTier = clampGearTier(lower[0]?.tier || 1);
      pool = lower.filter((item) => clampGearTier(item?.tier || 1) === bestTier);
    } else if (higher.length) {
      const bestTier = clampGearTier(higher[0]?.tier || 1);
      pool = higher.filter((item) => clampGearTier(item?.tier || 1) === bestTier);
    }
  }
  if (!pool.length) return null;

  const named = pool
    .filter((item) => String(item?.name || '').trim())
    .sort((a, b) => {
      const sa = isPreferredCatalogSource(a) ? 1 : 0;
      const sb = isPreferredCatalogSource(b) ? 1 : 0;
      if (sb !== sa) return sb - sa;
      return String(a?.name || '').localeCompare(String(b?.name || ''));
    });
  const finalPool = named.length ? named : pool;
  const picked = finalPool[Math.floor(Math.random() * finalPool.length)] || finalPool[0];
  return cloneCatalogGear(picked, { forceReplaceSameTier: opts?.forceReplaceSameTier === true });
}

function consumeLowMaterials(inventory, need, itemMetaById, itemNameById) {
  const want = Math.max(0, Math.floor(Number(need || 0)));
  if (want <= 0) return { inventory: Array.isArray(inventory) ? [...inventory] : [], consumed: 0 };

  const list = Array.isArray(inventory) ? inventory.map((x) => ({ ...x })) : [];
  // qty 많은 것부터 먼저 소모
  list.sort((a, b) => Math.max(0, Number(b?.qty ?? 1)) - Math.max(0, Number(a?.qty ?? 1)));

  let remaining = want;
  for (let i = 0; i < list.length && remaining > 0; i++) {
    if (!isLowMaterialInvEntry(list[i], itemMetaById, itemNameById)) continue;
    const q = Math.max(0, Number(list[i]?.qty ?? 1));
    if (q <= 0) continue;
    const take = Math.min(q, remaining);
    const next = q - take;
    remaining -= take;
    if (next <= 0) {
      list.splice(i, 1);
      i -= 1;
    } else {
      list[i] = { ...list[i], qty: next };
    }
  }

  return { inventory: list, consumed: want - remaining };
}

function autoEquipBest(actor, itemMetaById) {
  if (!actor || typeof actor !== 'object') return;
  const inv = Array.isArray(actor?.inventory) ? actor.inventory : [];
  const eq = ensureEquipped(actor);
  const nextEq = { ...eq };

  const kmap = (actor?._itemKeyById && typeof actor._itemKeyById === 'object') ? actor._itemKeyById : {};
  const goal = pickGoalLoadoutBySlot(actor);

  function keyOfInv(x) {
    const id = String(getInvItemId(x) || '');
    const k = String(x?.itemKey || x?.externalId || kmap?.[id] || '').trim();
    return k;
  };

  for (const s of EQUIP_SLOTS) {
    const best = pickBestEquipBySlot(inv, s);
    const goalKey = String(goal?.[s] || '').trim();
    if (goalKey) {
      const hit = inv.find((x) => String(x?.equipSlot || inferEquipSlot(x) || '').toLowerCase() === s && keyOfInv(x) === goalKey);
      if (hit && (!best || getInvTier(hit, itemMetaById) >= getInvTier(best, itemMetaById))) {
        nextEq[s] = String(getInvItemId(hit));
        continue;
      }
    }

    if (best) nextEq[s] = String(best?.itemId || best?.id || best?._id || '');
    else nextEq[s] = null;
  }
  actor.equipped = nextEq;
}

function allowAbstractGearFallback(ruleset, opts = {}) {
  return opts?.allowAbstractFallback === true || ruleset?.ai?.allowAbstractGearFallback === true;
}

function day1AbstractFallbackMaxTier(ruleset) {
  const configured = Number(ruleset?.ai?.day1AbstractFallbackMaxTier ?? 4);
  if (Number.isFinite(configured)) return Math.max(1, Math.min(4, Math.floor(configured)));
  return 4;
}

function day1HeroGearDirector(actor, publicItems, itemNameById, itemMetaById, day, phase, ruleset, opts = {}) {
  const d = Number(day || 0);
  const ph = String(phase || '').toLowerCase();
  const forceRouteCompletion = opts?.forceRouteCompletion === true;
  const canUseEarlyRouteFallback = d === 1 || (forceRouteCompletion && d === 2);
  if (!canUseEarlyRouteFallback) return { changed: false, logs: [] };
  if (!allowAbstractGearFallback(ruleset, opts) && !forceRouteCompletion) return { changed: false, logs: [] };

  // 레시피 데이터가 빈약하거나 루트 파밍 판정만 있고 조합까지 이어지지 않는 경우의 안전망입니다.
  if (!ph.includes('morning') && !ph.includes('day') && !ph.includes('night')) return { changed: false, logs: [] };

  // 기본 fallback은 최소 1회 이동 후 작동합니다. routeFarm 호출은 파밍 액션 자체를 시작 신호로 인정합니다.
  if (Math.max(0, Number(actor?.day1Moves || 0)) < 1 && !forceRouteCompletion) return { changed: false, logs: [] };

  const maxFallbackTier = day1AbstractFallbackMaxTier(ruleset);
  const logs = [];
  let inv = Array.isArray(actor?.inventory) ? actor.inventory : [];
  inv = normalizeInventory(inv, ruleset);

  const wTypeNorm = resolveActorWeaponType(actor);

  if (forceRouteCompletion) {
    const targetTier = Math.max(1, Math.min(4, Math.floor(Number(opts?.routeCompletionTier ?? maxFallbackTier))));
    if (actor?.day1HeroDone && EQUIP_SLOTS.every((slot) => {
      const it = pickBestEquipBySlot(inv, slot);
      return it && getInvTier(it, itemMetaById) >= targetTier;
    })) {
      actor.inventory = inv;
      autoEquipBest(actor, itemMetaById);
      return { changed: false, logs: [] };
    }
    const completedSlots = [];

    for (const slot of EQUIP_SLOTS) {
      const cur = pickBestEquipBySlot(inv, slot);
      const curTier = cur ? getInvTier(cur, itemMetaById) : 0;
      if (curTier >= targetTier) continue;

      const gear = pickCatalogEquipmentItem(publicItems, {
        slot,
        tier: targetTier,
        weaponType: slot === 'weapon' ? wTypeNorm : '',
        avoidItemIds: inv.map(getInvId),
        allowNearestTier: true,
        forceReplaceSameTier: true,
      });
      if (!gear) continue;
      inv = ensureRoomForEquipment(inv, ruleset, itemMetaById, itemNameById);
      inv = addItemToInventory(inv, gear, catalogItemId(gear), 1, d, ruleset);
      const meta = inv?._lastAdd;
      const got = Math.max(0, Number(meta?.acceptedQty ?? 1));
      if (got > 0) completedSlots.push(`${SLOT_ICON[slot] || '🧩'}${tierLabelKo(gear?.tier || targetTier)}`);
    }

    actor.inventory = inv;
    autoEquipBest(actor, itemMetaById);

    const done = EQUIP_SLOTS.every((s) => {
      const it = pickBestEquipBySlot(inv, s);
      return it && getInvTier(it, itemMetaById) >= targetTier;
    });

    if (completedSlots.length > 0) {
      logs.push(`🧭 [${actor?.name}] 1일차 루트 파밍 제작: ${completedSlots.join(', ')} 장비 확보`);
    }
    if (done) {
      actor.day1HeroDone = true;
      logs.push(`✅ [${actor?.name}] 1일차 낮 루트 파밍 완료: ${tierLabelKo(targetTier)} 장비 5부위 완성`);
    }

    return { changed: logs.length > 0, logs };
  }

  if (actor?.day1HeroDone && EQUIP_SLOTS.every((slot) => {
    const it = pickBestEquipBySlot(inv, slot);
    return it && clampGearTier(Number(it?.tier || 1)) >= maxFallbackTier;
  })) {
    actor.inventory = inv;
    autoEquipBest(actor, itemMetaById);
    return { changed: false, logs: [] };
  }

  // 1) 비어있는 방어구 슬롯을 먼저 채움(머리/옷/팔) — 2재료씩
  for (const slot of ['head', 'clothes', 'arm']) {
    const has = !!pickBestEquipBySlot(inv, slot);
    const low = countLowMaterials(inv, itemMetaById, itemNameById);
    if (!has && low >= 2) {
      const dec = consumeLowMaterials(inv, 2, itemMetaById, itemNameById);
      inv = dec.inventory;
      const gear = pickCatalogEquipmentItem(publicItems, {
        slot,
        tier: 1,
        avoidItemIds: inv.map(getInvId),
        allowNearestTier: true,
      });
      if (!gear) continue;
      inv = addItemToInventory(inv, gear, catalogItemId(gear), 1, d, ruleset);
      logs.push(`🛠️ [${actor?.name}] 루트 제작 보정: ${SLOT_ICON[slot] || '🧩'} ${gear?.name || '장비'} (${tierLabelKo(gear?.tier || 1)})`);
    }
  }

  // 2) 무기/신발 포함 5부위 업그레이드 — 1재료씩
  // - 실제 레시피가 없을 때 쓰는 안전망이며, 현재 룰에서는 1일차 루트 완성 목표인 T4까지 보정합니다.
  for (const slot of EQUIP_SLOTS) {
    for (let step = 0; step < 2; step += 1) {
      const it = pickBestEquipBySlot(inv, slot);
      if (!it) break;
      const curTier = clampGearTier(Number(it?.tier || 1));
      if (curTier >= maxFallbackTier) break;

      const low = countLowMaterials(inv, itemMetaById, itemNameById);
      if (low < 1) break;

      const nextTier = Math.min(maxFallbackTier, curTier >= 3 ? 4 : 3);
      if (nextTier <= curTier) break;
      const dec = consumeLowMaterials(inv, 1, itemMetaById, itemNameById);
      if (dec.consumed < 1) break;
      inv = dec.inventory;

      const gear = pickCatalogEquipmentItem(publicItems, {
        slot,
        tier: nextTier,
        weaponType: slot === 'weapon' ? wTypeNorm : '',
        avoidItemIds: inv.map(getInvId),
        allowNearestTier: true,
      });
      if (!gear) break;
      inv = addItemToInventory(inv, gear, catalogItemId(gear), 1, d, ruleset);
      logs.push(`⬆️ [${actor?.name}] 루트 장비 갱신: ${SLOT_ICON[slot] || '🧩'} ${gear?.name || '장비'} (${tierLabelKo(gear?.tier || nextTier)})`);
    }
  }

  actor.inventory = inv;
  autoEquipBest(actor, itemMetaById);

  const done = EQUIP_SLOTS.every((s) => {
    const it = pickBestEquipBySlot(inv, s);
    return it && clampGearTier(Number(it?.tier || 1)) >= maxFallbackTier;
  });

  if (done) {
    actor.day1HeroDone = true;
    const tierName = tierLabelKo(maxFallbackTier);
    logs.push(`✅ [${actor?.name}] 1일차 루트 파밍 보정 완료: ${tierName} 이하 장비 기반 확보(이동 ${Math.max(0, Number(actor?.day1Moves || 0))}회)`);
  }

  return { changed: logs.length > 0, logs };
}

// ===============================
// fallback 후반 세팅: 전설(T5)/초월(T6) 제작 디렉터
// - 실제 전설/초월 레시피가 없는 데이터 누락 상황에서만 사용합니다.
// - 기본 시뮬레이션 경로는 실제 레시피 조합과 키오스크/드론 구매입니다.
// ===============================
function lateGameGearDirector(actor, publicItems, itemNameById, itemMetaById, day, phase, ruleset, opts = {}) {
  if (!actor || typeof actor !== 'object') return { changed: false, logs: [] };
  if (!allowAbstractGearFallback(ruleset, opts)) return { changed: false, logs: [] };

  const d = Number(day || 0);
  const ph = String(phase || '');
  const logs = [];

  const phaseIdx = worldPhaseIndex(d, ph);
  if (Number(actor?.lateGameCraftPhaseIdx) === Number(phaseIdx)) return { changed: false, logs };

  let inv = Array.isArray(actor?.inventory) ? actor.inventory : [];
  inv = normalizeInventory(inv, ruleset);

  const up = computeLateGameUpgradeNeed(actor, itemMetaById, itemNameById, d, ph, ruleset);
  if (!up?.wantLegend && !up?.wantTrans) return { changed: false, logs };

  // 하급 재료 1개는 필수
  if (Number(up.lowCount || 0) < 1) return { changed: false, logs };

  // 어떤 슬롯을 올릴지: 현재 최저 티어 슬롯부터
  const slotOrder = EQUIP_SLOTS.slice();
  function slotTier(slot) {
    const best = pickBestEquipBySlot(inv, slot);
    return best ? clampGearTier(Number(best?.tier || 1)) : 0;
  };
  slotOrder.sort((a, b) => (slotTier(a) - slotTier(b)) || ((GEAR_SLOT_PRIORITY[a] ?? 99) - (GEAR_SLOT_PRIORITY[b] ?? 99)));
  const wTypeNorm = resolveActorWeaponType(actor);

  // 목표 티어 결정
  const targetTier = up.wantTrans ? 6 : 5;

  // 재료 선택(우선순위)
  const vfId = findInvItemIdBySpecialKind(inv, 'vf', itemMetaById, itemNameById);
  const forceId = findInvItemIdBySpecialKind(inv, 'force_core', itemMetaById, itemNameById);
  const mithrilId = findInvItemIdBySpecialKind(inv, 'mithril', itemMetaById, itemNameById);
  const meteorId = findInvItemIdBySpecialKind(inv, 'meteor', itemMetaById, itemNameById);
  const lifeId = findInvItemIdBySpecialKind(inv, 'life_tree', itemMetaById, itemNameById);

  let specialId = '';
  let specialLabel = '';
  if (targetTier === 6) {
    specialId = vfId;
    specialLabel = 'VF';
    if (!specialId) return { changed: false, logs };
  } else {
    specialId = forceId || mithrilId || meteorId || lifeId;
    specialLabel = forceId ? '포스코어' : mithrilId ? '미스릴' : meteorId ? '운석' : lifeId ? '생나' : '';
    if (!specialId) return { changed: false, logs };
  }

  // 업그레이드가 필요한 슬롯 선택
  const slotPick = slotOrder.find((s) => slotTier(s) < targetTier) || slotOrder[0];
  if (!slotPick) return { changed: false, logs };

  // 인벤토리 공간(장비 교체 로직이 있으므로 canReceiveItem로 먼저 가드)
  const gear = pickCatalogEquipmentItem(publicItems, {
    slot: slotPick,
    tier: targetTier,
    weaponType: slotPick === 'weapon' ? wTypeNorm : '',
    avoidItemIds: inv.map(getInvId),
    allowNearestTier: true,
  });
  if (!gear) return { changed: false, logs };
  if (!canReceiveItem(inv, gear, catalogItemId(gear), 1, ruleset)) return { changed: false, logs };

  // 재료 소모: 하급 1 + 특수 1
  const decLow = consumeLowMaterials(inv, 1, itemMetaById, itemNameById);
  if (decLow.consumed < 1) return { changed: false, logs };
  inv = decLow.inventory;
  inv = consumeIngredientsFromInv(inv, [{ itemId: String(specialId), qty: 1 }]);

  inv = addItemToInventory(inv, gear, catalogItemId(gear), 1, d, ruleset);
  const meta = inv?._lastAdd;
  const got = Math.max(0, Number(meta?.acceptedQty ?? 1));
  if (got > 0) {
    logs.push(`🛠️ [${actor?.name}] 후반 제작: ${specialLabel}+하급재료 → ${SLOT_ICON[slotPick] || '🧩'} ${gear?.name || '장비'} (${tierLabelKo(gear?.tier || targetTier)})${formatInvAddNote(meta, 1, inv, ruleset)}`);
    actor.inventory = inv;
    autoEquipBest(actor, itemMetaById);
    actor.lateGameCraftPhaseIdx = phaseIdx;
    return { changed: true, logs };
  }

  return { changed: false, logs };
}



// ===============================
// ✅ 즉시 제작: 특수 재료 획득 즉시 전설(T5)/초월(T6) 장비 제작
// - 운석/생나/미스릴/포스코어: 전설(T5)
// - VF 혈액 샘플: 초월(T6)
// - 인벤이 꽉 차면 하급 재료 1스택을 버리고 공간을 만듭니다.
// - 과도한 로그/과속 방지를 위해 페이즈당 최대 2회까지만 허용합니다.
// ===============================
function ensureRoomForEquipment(inv, ruleset, itemMetaById, itemNameById) {
  const list = Array.isArray(inv) ? [...inv] : [];
  const rules = getInvRules(ruleset);
  if (list.length < Number(rules.maxSlots || 10)) return list;

  // 1) 장비가 아닌 것(재료/소모품)부터 버림
  for (let i = list.length - 1; i >= 0; i -= 1) {
    const it = list[i];
    const cat = inferItemCategory(it);
    if (cat === 'equipment') continue;
    // 특수 재료(VF/운석/생나/미스릴/포코)는 버리지 않음
    const nm = String(it?.name || itemNameById?.[String(it?.itemId || it?.id || '')] || itemMetaById?.[String(it?.itemId || it?.id || '')]?.name || '');
    const sk = classifySpecialByName(nm);
    if (sk) continue;

    const q = Math.max(1, Number(it?.qty || 1));
    if (q > 1) list[i] = { ...it, qty: q - 1 };
    else list.splice(i, 1);
    return list;
  }

  // 2) 그래도 꽉 차면: 마지막 아이템 1개를 제거(최후 수단)
  list.pop();
  return list;
}

function tryImmediateCraftFromSpecial(actor, specialKind, specialItemId, publicItems, itemNameById, itemMetaById, curDay, curPhase, phaseIdxNow, ruleset) {
  if (!actor || typeof actor !== 'object') return { changed: false, logs: [], pvpBonus: 0 };
  const k = String(specialKind || '');
  if (!k) return { changed: false, logs: [], pvpBonus: 0 };

  const targetTier = (k === 'vf') ? 6 : 5;
  const craftRule = ruleset?.equipment?.immediateSpecialCraft || ruleset?.immediateSpecialCraft || {};
  const defaultGate = k === 'vf' ? { day: 4, timeOfDay: 'day' } : { day: 2, timeOfDay: 'night' };
  const gate = (k === 'vf' ? craftRule.transGate : craftRule.legendGate) || defaultGate;
  const gateDay = Math.max(1, Number(gate?.day ?? defaultGate.day));
  const gateTimeOfDay = String(gate?.timeOfDay || gate?.phase || defaultGate.timeOfDay);
  if (!isAtOrAfterWorldTime(curDay, curPhase, gateDay, gateTimeOfDay)) return { changed: false, logs: [], pvpBonus: 0 };

  const inv0 = Array.isArray(actor?.inventory) ? actor.inventory : [];

  // Avoid runaway instant crafting from early lucky core chains.
  const dayKey = Math.max(0, Number(curDay || 0));
  if (Number(actor?._specialCraftDay ?? -9999) !== dayKey) {
    actor._specialCraftDay = dayKey;
    actor._specialCraftDayCount = 0;
  }
  const dayCnt = Math.max(0, Number(actor?._specialCraftDayCount || 0));
  const maxPerDay = Math.max(0, Math.floor(Number(craftRule.perDayMax ?? 1)));
  if (maxPerDay <= 0 || dayCnt >= maxPerDay) return { changed: false, logs: [], pvpBonus: 0 };

  if (Number(actor?._specialCraftPhaseIdx ?? -9999) !== phaseIdxNow) {
    actor._specialCraftPhaseIdx = phaseIdxNow;
    actor._specialCraftCount = 0;
  }
  const cnt = Math.max(0, Number(actor?._specialCraftCount || 0));
  const maxPerPhase = Math.max(0, Math.floor(Number(craftRule.perPhaseMax ?? 1)));
  if (maxPerPhase <= 0 || cnt >= maxPerPhase) return { changed: false, logs: [], pvpBonus: 0 };

  const sid = String(specialItemId || '');
  if (!sid) return { changed: false, logs: [], pvpBonus: 0 };
  if (invQty(inv0, sid) <= 0) return { changed: false, logs: [], pvpBonus: 0 };

  let inv = normalizeInventory(inv0, ruleset);

  // 어떤 슬롯을 올릴지: 현재 최저 티어 슬롯부터
  function slotTier(slot) {
    const best = pickBestEquipBySlot(inv, slot);
    return best ? clampGearTier(Number(best?.tier || 1)) : 0;
  };
  const slotOrder = EQUIP_SLOTS.slice().sort((a, b) => (slotTier(a) - slotTier(b)) || ((GEAR_SLOT_PRIORITY[a] ?? 99) - (GEAR_SLOT_PRIORITY[b] ?? 99)));
  const slotPick = slotOrder.find((s) => slotTier(s) < targetTier) || null;
  if (!slotPick) return { changed: false, logs: [], pvpBonus: 0 };

  // 무기 타입은 캐릭터 선호 기준으로
  const wTypeNorm = resolveActorWeaponType(actor);

  const gear = pickCatalogEquipmentItem(publicItems, {
    slot: slotPick,
    tier: targetTier,
    weaponType: slotPick === 'weapon' ? wTypeNorm : '',
    avoidItemIds: inv.map(getInvId),
    allowNearestTier: true,
  });
  if (!gear) return { changed: false, logs: [], pvpBonus: 0 };

  // 공간 확보
  inv = ensureRoomForEquipment(inv, ruleset, itemMetaById, itemNameById);
  if (!canReceiveItem(inv, gear, catalogItemId(gear), 1, ruleset)) return { changed: false, logs: [], pvpBonus: 0 };

  // 재료 소모(특수 재료 1개)
  inv = consumeIngredientsFromInv(inv, [{ itemId: sid, qty: 1 }]);

  inv = addItemToInventory(inv, gear, catalogItemId(gear), 1, Number(curDay || 0), ruleset);
  const meta = inv?._lastAdd;
  const got = Math.max(0, Number(meta?.acceptedQty ?? 1));
  if (got <= 0) return { changed: false, logs: [], pvpBonus: 0 };

  actor.inventory = inv;
  autoEquipBest(actor, itemMetaById);
  actor._specialCraftCount = cnt + 1;
  actor._specialCraftDayCount = dayCnt + 1;

  const label = (k === 'vf') ? 'VF→초월' : (k === 'force_core') ? '포스코어→전설' : (k === 'mithril') ? '미스릴→전설' : (k === 'meteor') ? '운석→전설' : (k === 'life_tree') ? '생나→전설' : '특수재료→전설';
  const logs = [`⚒️ [${actor?.name}] 즉시 제작: ${label} → ${SLOT_ICON[slotPick] || '🧩'} ${gear?.name || '장비'} (${tierLabelKo(gear?.tier || targetTier)})${formatInvAddNote(meta, 1, inv, ruleset)}`];

  // 수집/제작은 소음이 커서 교전을 유발(다음 페이즈 + 즉시 표적)
  const pvpBonus = (k === 'vf') ? 0.55 : 0.35;

  return { changed: true, logs, inventory: inv, pvpBonus };
}

export {
  invHasSpecialKind,
  findInvItemIdBySpecialKind,
  computeLateGameUpgradeNeed,
  tryAutoCraftFromInventory,
  getInvId,
  getInvTier,
  isLowMaterialInvEntry,
  countLowMaterials,
  consumeLowMaterials,
  autoEquipBest,
  day1HeroGearDirector,
  lateGameGearDirector,
  pickCatalogEquipmentItem,
  ensureRoomForEquipment,
  tryImmediateCraftFromSpecial,
};
