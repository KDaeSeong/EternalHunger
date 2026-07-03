import { tierLabelKo } from './simulationCommon';
import {
  EQUIP_SLOTS,
  SLOT_ICON,
} from './simulationConstants';
import { worldPhaseIndex } from './worldTime';
import {
  addItemToInventory,
  canReceiveItem,
  consumeIngredientsFromInv,
  formatInvAddNote,
  normalizeInventory,
} from './inventoryRules';
import { pickBestEquipBySlot } from './craftRuntime';
import {
  catalogItemId,
  clampGearTier,
  getInvId,
  getInvTier,
  pickCatalogEquipmentItem,
  resolveActorWeaponType,
} from './gearCatalogRuntime';
import {
  allowAbstractGearFallback,
  autoEquipBest,
  countLowMaterials,
  consumeLowMaterials,
  day1AbstractFallbackMaxTier,
  isLowMaterialInvEntry,
  orderUpgradeSlotsByTier,
} from './gearFallbackRuntime';
import {
  computeLateGameUpgradeNeed,
  findInvItemIdBySpecialKind,
  invHasSpecialKind,
} from './gearUpgradeNeedRuntime';
import { tryAutoCraftFromInventory } from './gearInventoryCraftRuntime';
import {
  ensureRoomForEquipment,
  tryImmediateCraftFromSpecial,
} from './gearImmediateSpecialCraftRuntime';

// --- 전설/초월 세팅 목표(관전형 AI) ---
// - 목적: "파밍(크레딧) → 키오스크 구매 → 전설/초월 제작" 루프를 목표로 움직이게 함
// - craftGoal(레시피 목표)이 없더라도, 장비 티어가 낮으면 후반 세팅을 추구

// --- 목표 기반 이동(조합 목표 + 월드 스폰 + 키오스크) ---

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

  const wTypeNorm = resolveActorWeaponType(actor);

  // 목표 티어 결정
  const targetTier = up.wantTrans ? 6 : 5;
  const slotOrder = orderUpgradeSlotsByTier(inv, targetTier);
  const slotTier = (slot) => {
    const best = pickBestEquipBySlot(inv, slot);
    return best ? clampGearTier(Number(best?.tier || 1)) : 0;
  };

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
