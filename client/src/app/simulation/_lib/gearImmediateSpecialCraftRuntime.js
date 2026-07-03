import { tierLabelKo } from './simulationCommon';
import { EQUIP_SLOTS, SLOT_ICON } from './simulationConstants';
import { isAtOrAfterWorldTime } from './worldTime';
import {
  addItemToInventory,
  canReceiveItem,
  consumeIngredientsFromInv,
  formatInvAddNote,
  getInvRules,
  inferItemCategory,
  invQty,
  normalizeInventory,
} from './inventoryRules';
import {
  classifySpecialByName,
  pickBestEquipBySlot,
} from './craftRuntime';
import {
  catalogItemId,
  clampGearTier,
  getInvId,
  pickCatalogEquipmentItem,
  resolveActorWeaponType,
} from './gearCatalogRuntime';
import {
  autoEquipBest,
  orderUpgradeSlotsByTier,
} from './gearFallbackRuntime';

export function ensureRoomForEquipment(inv, ruleset, itemMetaById, itemNameById) {
  const list = Array.isArray(inv) ? [...inv] : [];
  const rules = getInvRules(ruleset);
  if (list.length < Number(rules.maxSlots || 10)) return list;

  // 장비가 아닌 것(재료/소모품)부터 버리되, 특수 재료는 보존한다.
  for (let i = list.length - 1; i >= 0; i -= 1) {
    const item = list[i];
    const category = inferItemCategory(item);
    if (category === 'equipment') continue;
    const itemId = String(item?.itemId || item?.id || '');
    const name = String(item?.name || itemNameById?.[itemId] || itemMetaById?.[itemId]?.name || '');
    const specialKind = classifySpecialByName(name);
    if (specialKind) continue;

    const qty = Math.max(1, Number(item?.qty || 1));
    if (qty > 1) list[i] = { ...item, qty: qty - 1 };
    else list.splice(i, 1);
    return list;
  }

  list.pop();
  return list;
}

export function tryImmediateCraftFromSpecial(actor, specialKind, specialItemId, publicItems, itemNameById, itemMetaById, curDay, curPhase, phaseIdxNow, ruleset) {
  if (!actor || typeof actor !== 'object') return { changed: false, logs: [], pvpBonus: 0 };
  const kind = String(specialKind || '');
  if (!kind) return { changed: false, logs: [], pvpBonus: 0 };

  const targetTier = (kind === 'vf') ? 6 : 5;
  const craftRule = ruleset?.equipment?.immediateSpecialCraft || ruleset?.immediateSpecialCraft || {};
  const defaultGate = kind === 'vf' ? { day: 4, timeOfDay: 'day' } : { day: 2, timeOfDay: 'day' };
  const gate = (kind === 'vf' ? craftRule.transGate : craftRule.legendGate) || defaultGate;
  const gateDay = Math.max(1, Number(gate?.day ?? defaultGate.day));
  const gateTimeOfDay = String(gate?.timeOfDay || gate?.phase || defaultGate.timeOfDay);
  if (!isAtOrAfterWorldTime(curDay, curPhase, gateDay, gateTimeOfDay)) {
    return { changed: false, logs: [], pvpBonus: 0 };
  }

  const inv0 = Array.isArray(actor?.inventory) ? actor.inventory : [];
  const dayKey = Math.max(0, Number(curDay || 0));
  if (Number(actor?._specialCraftDay ?? -9999) !== dayKey) {
    actor._specialCraftDay = dayKey;
    actor._specialCraftDayCount = 0;
  }
  const dayCount = Math.max(0, Number(actor?._specialCraftDayCount || 0));
  const maxPerDay = Math.max(0, Math.floor(Number(craftRule.perDayMax ?? 1)));
  if (maxPerDay <= 0 || dayCount >= maxPerDay) return { changed: false, logs: [], pvpBonus: 0 };

  if (Number(actor?._specialCraftPhaseIdx ?? -9999) !== phaseIdxNow) {
    actor._specialCraftPhaseIdx = phaseIdxNow;
    actor._specialCraftCount = 0;
  }
  const count = Math.max(0, Number(actor?._specialCraftCount || 0));
  const maxPerPhase = Math.max(0, Math.floor(Number(craftRule.perPhaseMax ?? 1)));
  if (maxPerPhase <= 0 || count >= maxPerPhase) return { changed: false, logs: [], pvpBonus: 0 };

  const specialId = String(specialItemId || '');
  if (!specialId) return { changed: false, logs: [], pvpBonus: 0 };
  if (invQty(inv0, specialId) <= 0) return { changed: false, logs: [], pvpBonus: 0 };

  let inv = normalizeInventory(inv0, ruleset);
  if (kind === 'vf' && EQUIP_SLOTS.some((slot) => {
    const best = pickBestEquipBySlot(inv, slot);
    return !best || clampGearTier(Number(best?.tier || 1)) < 5;
  })) {
    return { changed: false, logs: [], pvpBonus: 0 };
  }

  const slotOrder = orderUpgradeSlotsByTier(inv, targetTier);
  const slotTier = (slot) => {
    const best = pickBestEquipBySlot(inv, slot);
    return best ? clampGearTier(Number(best?.tier || 1)) : 0;
  };
  const slotPick = slotOrder.find((slot) => slotTier(slot) < targetTier) || null;
  if (!slotPick) return { changed: false, logs: [], pvpBonus: 0 };

  const gear = pickCatalogEquipmentItem(publicItems, {
    slot: slotPick,
    tier: targetTier,
    weaponType: slotPick === 'weapon' ? resolveActorWeaponType(actor) : '',
    avoidItemIds: inv.map(getInvId),
    allowNearestTier: true,
  });
  if (!gear) return { changed: false, logs: [], pvpBonus: 0 };

  inv = ensureRoomForEquipment(inv, ruleset, itemMetaById, itemNameById);
  if (!canReceiveItem(inv, gear, catalogItemId(gear), 1, ruleset)) return { changed: false, logs: [], pvpBonus: 0 };

  inv = consumeIngredientsFromInv(inv, [{ itemId: specialId, qty: 1 }]);
  inv = addItemToInventory(inv, gear, catalogItemId(gear), 1, Number(curDay || 0), ruleset);
  const meta = inv?._lastAdd;
  const got = Math.max(0, Number(meta?.acceptedQty ?? 1));
  if (got <= 0) return { changed: false, logs: [], pvpBonus: 0 };

  actor.inventory = inv;
  autoEquipBest(actor, itemMetaById);
  actor._specialCraftCount = count + 1;
  actor._specialCraftDayCount = dayCount + 1;

  const label = (kind === 'vf')
    ? 'VF→초월'
    : (kind === 'force_core')
      ? '포스코어→전설'
      : (kind === 'mithril')
        ? '미스릴→전설'
        : (kind === 'meteor')
          ? '운석→전설'
          : (kind === 'life_tree')
            ? '생나→전설'
            : '특수재료→전설';
  const logs = [`⚒️ [${actor?.name}] 즉시 제작: ${label} → ${SLOT_ICON[slotPick] || '🧩'} ${gear?.name || '장비'} (${tierLabelKo(gear?.tier || targetTier)})${formatInvAddNote(meta, 1, inv, ruleset)}`];
  const pvpBonus = (kind === 'vf') ? 0.55 : 0.35;

  return { changed: true, logs, inventory: inv, pvpBonus };
}
