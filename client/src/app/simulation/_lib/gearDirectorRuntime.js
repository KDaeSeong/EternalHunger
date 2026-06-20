import { createEquipmentItem, normalizeWeaponType } from '../../../utils/equipmentCatalog';
import {
  clampTier4,
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
    const t = best ? clampTier4(Number(best?.tier || 1)) : 0;
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
      const curTier = curBest ? clampTier4(Number(curBest?.tier || 1)) : 0;
      const tgtTier = clampTier4(Number(it?.tier || 1));

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
      ? clampTier4(Number(target?.tier || computeCraftTierFromIngredients(ings, itemMetaById, itemNameById) || 1))
      : clampTier4(target?.tier || 1);
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
// ✅ 1일차 목표: "1회 이동"만으로 영웅(T4)까지 맞추기
// - 플레이어 간섭이 없으므로, 관전 템포를 위해 AI가 재료를 소모해 장비를 단계적으로 끌어올립니다.
// - 규칙(요청): 하급 재료 2개 → 일반(T1) 제작 / (장비 + 하급1) → 희귀(T3) / (희귀 + 하급1) → 영웅(T4)
//   ※ 여기서는 '하급 재료'를 (재료 카테고리 + 특수재료 제외 + tier<=2)로 간주합니다.
// ===============================

function getInvId(x) {
  return String(x?.itemId || x?.id || x?._id || '');
}

function getInvTier(x, itemMetaById) {
  const t0 = Number(x?.tier);
  if (Number.isFinite(t0) && t0 > 0) return clampTier4(t0);
  const id = getInvId(x);
  const m = id ? itemMetaById?.[id] : null;
  return clampTier4(m?.tier || 1);
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
    const goalKey = String(goal?.[s] || '').trim();
    if (goalKey) {
      const hit = inv.find((x) => String(x?.equipSlot || inferEquipSlot(x) || '').toLowerCase() === s && keyOfInv(x) === goalKey);
      if (hit) {
        nextEq[s] = String(getInvItemId(hit));
        continue;
      }
    }

    const best = pickBestEquipBySlot(inv, s);
    if (best) nextEq[s] = String(best?.itemId || best?.id || best?._id || '');
    else nextEq[s] = null;
  }
  actor.equipped = nextEq;
}

function day1HeroGearDirector(actor, publicItems, itemNameById, itemMetaById, day, phase, ruleset) {
  const d = Number(day || 0);
  const ph = String(phase || '').toLowerCase();
  if (d !== 1) return { changed: false, logs: [] };
  if (actor?.day1HeroDone) return { changed: false, logs: [] };

  // ✅ 관전형 요구사항(사용자): "1일차 밤"까지는 전원 영웅(T4) 세팅을 반드시 완료
  // - 파밍 RNG/재료 부족/이동 실패로 목표가 누락되는 것을 방지
  // - 낮에는 재료 소모 방식(단계적 제작/강화)을 유지하되, 밤에는 부족한 슬롯을 강제로 채움
  if (ph.includes('night')) {
    const logs = [];
    let inv = Array.isArray(actor?.inventory) ? actor.inventory : [];
    inv = normalizeInventory(inv, ruleset);

    const wTypeNorm = resolveActorWeaponType(actor);

    for (const slot of EQUIP_SLOTS) {
      const best = pickBestEquipBySlot(inv, slot);
      const curTier = best ? clampTier4(Number(best?.tier || 1)) : 0;
      if (curTier >= 4) continue;
      const gear = createEquipmentItem({ slot, day: d, tier: 4, weaponType: slot === 'weapon' ? wTypeNorm : '' });
      inv = addItemToInventory(inv, gear, gear.itemId, 1, d, ruleset);
      logs.push(`✅ [${actor?.name}] 강제 세팅(1일차 밤): ${SLOT_ICON[slot] || '🧩'} 영웅 장비 획득`);
    }

    actor.inventory = inv;
    autoEquipBest(actor, itemMetaById);
    actor.day1HeroDone = true;
    logs.push(`🏁 [${actor?.name}] 1일차 밤 보정 완료: 영웅 장비 세트 확정`);
    return { changed: true, logs };
  }

  // 낮에는 기존 방식 유지: 최소 1회 이동 + 재료 소모로 단계적 달성
  if (Math.max(0, Number(actor?.day1Moves || 0)) < 1) return { changed: false, logs: [] };

  const logs = [];
  let inv = Array.isArray(actor?.inventory) ? actor.inventory : [];
  inv = normalizeInventory(inv, ruleset);

  const wTypeNorm = resolveActorWeaponType(actor);

  // 1) 비어있는 방어구 슬롯을 먼저 채움(머리/옷/팔) — 2재료씩
  for (const slot of ['head', 'clothes', 'arm']) {
    const has = !!pickBestEquipBySlot(inv, slot);
    const low = countLowMaterials(inv, itemMetaById, itemNameById);
    if (!has && low >= 2) {
      const dec = consumeLowMaterials(inv, 2, itemMetaById, itemNameById);
      inv = dec.inventory;
      const gear = createEquipmentItem({ slot, day: d, tier: 1, weaponType: '' });
      inv = addItemToInventory(inv, gear, gear.itemId, 1, d, ruleset);
      logs.push(`🛠️ [${actor?.name}] 제작: ${SLOT_ICON[slot] || '🧩'} ${gear?.name || '장비'} (일반)`);
    }
  }

  // 2) 무기/신발 포함 5부위 업그레이드(희귀→영웅) — 1재료씩
  // - 1일차 목표를 위해 한 페이즈에서 과도하게 반복하지 않도록 슬롯당 최대 2단계만 진행
  for (const slot of EQUIP_SLOTS) {
    for (let step = 0; step < 2; step += 1) {
      const it = pickBestEquipBySlot(inv, slot);
      if (!it) break;
      const curTier = clampTier4(Number(it?.tier || 1));
      if (curTier >= 4) break;

      const low = countLowMaterials(inv, itemMetaById, itemNameById);
      if (low < 1) break;

      // T1/2 -> T3, T3 -> T4
      const nextTier = curTier >= 3 ? 4 : 3;
      const dec = consumeLowMaterials(inv, 1, itemMetaById, itemNameById);
      if (dec.consumed < 1) break;
      inv = dec.inventory;

      const gear = createEquipmentItem({ slot, day: d, tier: nextTier, weaponType: slot === 'weapon' ? wTypeNorm : '' });
      inv = addItemToInventory(inv, gear, gear.itemId, 1, d, ruleset);
      logs.push(`⬆️ [${actor?.name}] 강화: ${SLOT_ICON[slot] || '🧩'} ${tierLabelKo(nextTier)} 장비 획득`);
    }
  }

  actor.inventory = inv;
  autoEquipBest(actor, itemMetaById);

  const done = EQUIP_SLOTS.every((s) => {
    const it = pickBestEquipBySlot(inv, s);
    return it && clampTier4(Number(it?.tier || 1)) >= 4;
  });

  if (done) {
    actor.day1HeroDone = true;
    logs.push(`✅ [${actor?.name}] 1일차 목표 달성: 영웅 장비 세트 완성(이동 ${Math.max(0, Number(actor?.day1Moves || 0))}회)`);
  }

  return { changed: logs.length > 0, logs };
}

// ===============================
// ✅ 후반 세팅: 전설(T5)/초월(T6) 제작 디렉터
// - 규칙(요청):
//   * 하급 재료 1 + (운석/생나/미스릴/포스코어) -> 전설(5)
//   * 하급 재료 1 + VF 혈액 샘플 -> 초월(6)
// - 목적: "파밍(크레딧) → 키오스크 구매 → 전설/초월 제작" 루프를 실제로 실행
// - 페이즈당 1회만 수행(과속/로그 스팸 방지)
// ===============================
function lateGameGearDirector(actor, publicItems, itemNameById, itemMetaById, day, phase, ruleset) {
  if (!actor || typeof actor !== 'object') return { changed: false, logs: [] };

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
    return best ? clampTier4(Number(best?.tier || 1)) : 0;
  };
  slotOrder.sort((a, b) => (slotTier(a) - slotTier(b)) || String(a).localeCompare(String(b)));
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
  const gear = createEquipmentItem({ slot: slotPick, day: d, tier: targetTier, weaponType: slotPick === 'weapon' ? wTypeNorm : '' });
  if (!canReceiveItem(inv, gear, gear.itemId, 1, ruleset)) return { changed: false, logs };

  // 재료 소모: 하급 1 + 특수 1
  const decLow = consumeLowMaterials(inv, 1, itemMetaById, itemNameById);
  if (decLow.consumed < 1) return { changed: false, logs };
  inv = decLow.inventory;
  inv = consumeIngredientsFromInv(inv, [{ itemId: String(specialId), qty: 1 }]);

  inv = addItemToInventory(inv, gear, gear.itemId, 1, d, ruleset);
  const meta = inv?._lastAdd;
  const got = Math.max(0, Number(meta?.acceptedQty ?? 1));
  if (got > 0) {
    logs.push(`🛠️ [${actor?.name}] 후반 제작: ${specialLabel}+하급재료 → ${SLOT_ICON[slotPick] || '🧩'} ${gear?.name || '장비'} (${tierLabelKo(targetTier)})${formatInvAddNote(meta, 1, inv, ruleset)}`);
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

function tryImmediateCraftFromSpecial(actor, specialKind, specialItemId, itemNameById, itemMetaById, curDay, curPhase, phaseIdxNow, ruleset) {
  if (!actor || typeof actor !== 'object') return { changed: false, logs: [], pvpBonus: 0 };
  const k = String(specialKind || '');
  if (!k) return { changed: false, logs: [], pvpBonus: 0 };

  const targetTier = (k === 'vf') ? 6 : 5;
  const inv0 = Array.isArray(actor?.inventory) ? actor.inventory : [];

  // 페이즈당 과도한 즉시 제작 방지
  if (Number(actor?._specialCraftPhaseIdx ?? -9999) !== phaseIdxNow) {
    actor._specialCraftPhaseIdx = phaseIdxNow;
    actor._specialCraftCount = 0;
  }
  const cnt = Math.max(0, Number(actor?._specialCraftCount || 0));
  if (cnt >= 2) return { changed: false, logs: [], pvpBonus: 0 };

  const sid = String(specialItemId || '');
  if (!sid) return { changed: false, logs: [], pvpBonus: 0 };
  if (invQty(inv0, sid) <= 0) return { changed: false, logs: [], pvpBonus: 0 };

  let inv = normalizeInventory(inv0, ruleset);

  // 어떤 슬롯을 올릴지: 현재 최저 티어 슬롯부터
  function slotTier(slot) {
    const best = pickBestEquipBySlot(inv, slot);
    return best ? clampTier4(Number(best?.tier || 1)) : 0;
  };
  const slotOrder = EQUIP_SLOTS.slice().sort((a, b) => (slotTier(a) - slotTier(b)) || String(a).localeCompare(String(b)));
  const slotPick = slotOrder.find((s) => slotTier(s) < targetTier) || null;
  if (!slotPick) return { changed: false, logs: [], pvpBonus: 0 };

  // 무기 타입은 캐릭터 선호 기준으로
  const wTypeNorm = resolveActorWeaponType(actor);

  const gear = createEquipmentItem({ slot: slotPick, day: Number(curDay || 0), tier: targetTier, weaponType: slotPick === 'weapon' ? wTypeNorm : '' });

  // 공간 확보
  inv = ensureRoomForEquipment(inv, ruleset, itemMetaById, itemNameById);
  if (!canReceiveItem(inv, gear, gear.itemId, 1, ruleset)) return { changed: false, logs: [], pvpBonus: 0 };

  // 재료 소모(특수 재료 1개)
  inv = consumeIngredientsFromInv(inv, [{ itemId: sid, qty: 1 }]);

  inv = addItemToInventory(inv, gear, gear.itemId, 1, Number(curDay || 0), ruleset);
  const meta = inv?._lastAdd;
  const got = Math.max(0, Number(meta?.acceptedQty ?? 1));
  if (got <= 0) return { changed: false, logs: [], pvpBonus: 0 };

  actor.inventory = inv;
  autoEquipBest(actor, itemMetaById);
  actor._specialCraftCount = cnt + 1;

  const label = (k === 'vf') ? 'VF→초월' : (k === 'force_core') ? '포스코어→전설' : (k === 'mithril') ? '미스릴→전설' : (k === 'meteor') ? '운석→전설' : (k === 'life_tree') ? '생나→전설' : '특수재료→전설';
  const logs = [`⚒️ [${actor?.name}] 즉시 제작: ${label} → ${SLOT_ICON[slotPick] || '🧩'} ${gear?.name || '장비'} (${tierLabelKo(targetTier)})${formatInvAddNote(meta, 1, inv, ruleset)}`];

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
  ensureRoomForEquipment,
  tryImmediateCraftFromSpecial,
};
