import { EQUIP_SLOTS } from './simulationConstants';
import {
  getInvItemId,
  inferEquipSlot,
  inferItemCategory,
} from './inventoryRules';
import { ensureEquipped } from './survivorRuntime';
import {
  classifySpecialByName,
  pickBestEquipBySlot,
  pickGoalLoadoutBySlot,
} from './craftRuntime';
import {
  clampGearTier,
  getInvId,
  getInvTier,
} from './gearCatalogRuntime';

const GEAR_SLOT_PRIORITY = { weapon: 0, head: 1, clothes: 2, arm: 3, shoes: 4 };

function isLowMaterialInvEntry(x, itemMetaById, itemNameById) {
  if (!x || typeof x !== 'object') return false;
  const id = getInvId(x);
  if (!id) return false;

  const cat = String(x?.category || inferItemCategory(x) || 'material');
  if (cat !== 'material') return false;

  const name = String(x?.name || itemNameById?.[id] || itemMetaById?.[id]?.name || '');
  if (!name) return false;
  if (classifySpecialByName(name)) return false;

  const tier = getInvTier(x, itemMetaById);
  return tier <= 2;
}

function countLowMaterials(inventory, itemMetaById, itemNameById) {
  return (Array.isArray(inventory) ? inventory : []).reduce((sum, x) => {
    if (!isLowMaterialInvEntry(x, itemMetaById, itemNameById)) return sum;
    return sum + Math.max(0, Number(x?.qty ?? 1));
  }, 0);
}

function orderUpgradeSlotsByTier(inv, targetTier) {
  function slotTier(slot) {
    const best = pickBestEquipBySlot(inv, slot);
    return best ? clampGearTier(Number(best?.tier || 1)) : 0;
  }

  const baseOrder = EQUIP_SLOTS.slice().sort((a, b) => (slotTier(a) - slotTier(b)) || ((GEAR_SLOT_PRIORITY[a] ?? 99) - (GEAR_SLOT_PRIORITY[b] ?? 99)));
  if (Number(targetTier || 0) >= 6 && slotTier('weapon') < Number(targetTier || 0)) {
    return ['weapon', ...baseOrder.filter((slot) => slot !== 'weapon')];
  }
  return baseOrder;
}

function consumeLowMaterials(inventory, need, itemMetaById, itemNameById) {
  const want = Math.max(0, Math.floor(Number(need || 0)));
  if (want <= 0) return { inventory: Array.isArray(inventory) ? [...inventory] : [], consumed: 0 };

  const list = Array.isArray(inventory) ? inventory.map((x) => ({ ...x })) : [];
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
    return String(x?.itemKey || x?.externalId || kmap?.[id] || '').trim();
  }

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

export {
  allowAbstractGearFallback,
  autoEquipBest,
  countLowMaterials,
  consumeLowMaterials,
  day1AbstractFallbackMaxTier,
  isLowMaterialInvEntry,
  orderUpgradeSlotsByTier,
};
