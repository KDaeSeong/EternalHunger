import {
  normalizeWeaponType,
  normalizeWeaponTypes,
} from '../../../utils/equipmentCatalog';
import {
  EFFECT_BURN,
  EFFECT_FOOD_POISON,
  EFFECT_POISON,
  getMoveSpeedStatusBonus,
} from '../../../utils/statusLogic';
import { itemDisplayName, safeTags, shortText } from './simulationCommon';
import { EQUIP_SLOTS, SLOT_ICON } from './simulationConstants';
import { getActorPerkEffects, perkNumber } from './perkRuntime';
import { getInvItemId, inferEquipSlot } from './inventoryRules';
import { normalizeRuntimeEffect } from './runtimeStatus';
import { normalizeSupportedTacSkill } from '../tacticalSkillTable';
import { getWeaponMasteryLevel } from '../../../utils/erMeta';
import { normalizeErStats } from '../../../utils/erStats';
import { normalizeMasteryState } from '../../../utils/masteryLogic';

function ensureEquipped(obj) {
  const eq = obj?.equipped;
  const nextEq = {
    weapon: eq && typeof eq === 'object' ? (eq.weapon ?? null) : null,
    head: eq && typeof eq === 'object' ? (eq.head ?? null) : null,
    clothes: eq && typeof eq === 'object' ? (eq.clothes ?? null) : null,
    arm: eq && typeof eq === 'object' ? (eq.arm ?? null) : null,
    shoes: eq && typeof eq === 'object' ? (eq.shoes ?? null) : null,
  };

  const inv = Array.isArray(obj?.inventory) ? obj.inventory : [];
  const readTier = (it) => {
    const t = Number(it?.tier ?? it?.t ?? 1);
    return Number.isFinite(t) ? Math.max(1, Math.min(6, Math.floor(t))) : 1;
  };
  const byId = (id) => {
    const sid = String(id || '');
    if (!sid) return null;
    return inv.find((it) => String(getInvItemId(it)) === sid) || null;
  };
  const bestBySlot = (slot) => {
    const s = String(slot || '').toLowerCase();
    const candidates = inv.filter((it) => String(it?.equipSlot || inferEquipSlot(it) || '').toLowerCase() === s);
    if (!candidates.length) return null;
    candidates.sort((a, b) => (
      (readTier(b) - readTier(a)) ||
      (Number(b?.acquiredDay ?? 0) - Number(a?.acquiredDay ?? 0))
    ));
    return candidates[0] || null;
  };

  for (const slot of EQUIP_SLOTS) {
    const current = byId(nextEq[slot]);
    const best = bestBySlot(slot);
    if (!best) {
      nextEq[slot] = current ? String(getInvItemId(current)) : null;
      continue;
    }
    if (!current || readTier(best) > readTier(current)) {
      nextEq[slot] = String(getInvItemId(best));
    } else {
      nextEq[slot] = String(getInvItemId(current));
    }
  }
  return nextEq;
}

function normalizeRuntimeInventory(list) {
  return (Array.isArray(list) ? list : [])
    .filter((it) => it && typeof it === 'object')
    .map((it) => {
      const next = { ...it };
      const qty = Number(next?.qty ?? 1);
      next.qty = Number.isFinite(qty) && qty > 0 ? Math.floor(qty) : 1;
      const itemId = String(next?.itemId || next?.id || next?._id || '').trim();
      if (itemId) next.itemId = itemId;
      if (next?.equipSlot != null) next.equipSlot = String(next.equipSlot || '').toLowerCase();
      if (next?.weaponType != null) next.weaponType = normalizeWeaponType(next.weaponType) || String(next.weaponType || '');
      if (!Array.isArray(next?.tags)) next.tags = safeTags(next);
      return next;
    });
}

function normalizeRuntimeSurvivorList(list, opts = {}) {
  return (Array.isArray(list) ? list : [])
    .map((it) => normalizeRuntimeSurvivor(it, opts))
    .filter((it) => it && typeof it === 'object' && String(it?._id || '').trim());
}

function buildRuntimeSurvivorMap(list, opts = {}) {
  const map = new Map();
  normalizeRuntimeSurvivorList(list, opts).forEach((it) => {
    map.set(String(it._id), it);
  });
  return map;
}

function upsertRuntimeSurvivor(runtimeMap, survivor, opts = {}) {
  if (!(runtimeMap instanceof Map)) return null;
  const next = normalizeRuntimeSurvivor(survivor, opts);
  const id = String(next?._id || '').trim();
  if (!id) return null;
  runtimeMap.set(id, next);
  return next;
}

function normalizeRuntimeSurvivor(obj, opts = {}) {
  const base = obj && typeof obj === 'object' ? obj : {};
  const normalizedStats = normalizeErStats(base?.stats);
  const hpDefault = opts.hpDefault != null ? Number(opts.hpDefault) : 100;
  const maxHpDefault = opts.maxHpDefault != null ? Number(opts.maxHpDefault) : Number(normalizedStats.maxHp || 100);
  const hpRaw = Number(base?.hp);
  const maxHpRaw = Number(base?.maxHp);
  const hp = Number.isFinite(hpRaw) ? hpRaw : hpDefault;
  const maxHp = Number.isFinite(maxHpRaw) && maxHpRaw > 0 ? maxHpRaw : maxHpDefault;
  const perkFx = getActorPerkEffects(base);
  const statusImmunities = new Set(
    Array.isArray(base?.statusImmunities)
      ? base.statusImmunities.map((x) => String(x || '').trim()).filter(Boolean)
      : []
  );
  if (perkNumber(perkFx?.poisonImmune || 0) > 0) {
    statusImmunities.add(EFFECT_POISON);
    statusImmunities.add(EFFECT_FOOD_POISON);
  }
  if (perkNumber(perkFx?.burnImmune || 0) > 0) statusImmunities.add(EFFECT_BURN);

  const statusResists = {
    ...(base?.statusResists && typeof base.statusResists === 'object' ? base.statusResists : {}),
  };
  statusResists[EFFECT_POISON] = Math.max(0, Number(statusResists[EFFECT_POISON] || 0), Number(perkFx?.poisonResistPct || 0));
  statusResists[EFFECT_FOOD_POISON] = Math.max(0, Number(statusResists[EFFECT_FOOD_POISON] || 0), Number(perkFx?.poisonResistPct || 0));
  statusResists[EFFECT_BURN] = Math.max(0, Number(statusResists[EFFECT_BURN] || 0), Number(perkFx?.burnResistPct || 0));
  const masteryState = normalizeMasteryState(base);
  const weaponMasteryXp = Math.max(0, Math.floor(Number(masteryState?.weaponMasteryXp || 0)));
  const weaponMasteryLevel = Math.max(1, Math.min(20, Number(masteryState?.weaponMasteryLevel || getWeaponMasteryLevel({ ...base, weaponMasteryXp }))));
  const runWeaponType = normalizeWeaponType(base?.runWeaponType);
  const weaponType = runWeaponType || normalizeWeaponType(base?.weaponType);

  return {
    ...base,
    stats: normalizedStats,
    inventory: normalizeRuntimeInventory(base?.inventory),
    equipped: ensureEquipped(base),
    activeEffects: Array.isArray(base?.activeEffects) ? base.activeEffects.map((x) => normalizeRuntimeEffect(x)).filter(Boolean) : [],
    cooldowns: {
      portableSafeZone: 0,
      cnotGate: 0,
      weaponSkill: 0,
      ...(base?.cooldowns && typeof base.cooldowns === 'object' ? base.cooldowns : {}),
    },
    skillState: base?.skillState && typeof base.skillState === 'object' ? { ...base.skillState } : {},
    hp: Math.max(0, Math.min(maxHp, hp)),
    maxHp,
    satiety: Math.max(0, Math.min(100, Number.isFinite(Number(base?.satiety)) ? Number(base.satiety) : 70)),
    simCredits: Number.isFinite(Number(base?.simCredits)) ? Number(base.simCredits) : 0,
    goalGearTier: 6,
    tacticalSkill: normalizeSupportedTacSkill(base?.tacticalSkill),
    tacticalSkillLevel: Math.max(1, Math.min(2, Number(base?.tacticalSkillLevel || 1))),
    weaponType,
    runWeaponType,
    erWeapons: normalizeWeaponTypes(base?.erWeapons),
    mastery: masteryState.mastery,
    masteryXp: masteryState.totalXp,
    erLevel: masteryState.level,
    level: masteryState.level,
    weaponMasteryXp,
    weaponMasteryLevel,
    zoneId: String(base?.zoneId || ''),
    mapId: base?.mapId != null ? String(base.mapId || '') : '',
    day1Moves: Math.max(0, Number(base?.day1Moves || 0)),
    day1HeroDone: !!base?.day1HeroDone,
    droneLastOrderIndex: Number.isFinite(Number(base?.droneLastOrderIndex)) ? Number(base.droneLastOrderIndex) : -9999,
    droneLastOrderAbsSec: Number.isFinite(Number(base?.droneLastOrderAbsSec)) ? Number(base.droneLastOrderAbsSec) : -99999,
    kioskLastInteractAbsSec: Number.isFinite(Number(base?.kioskLastInteractAbsSec)) ? Number(base.kioskLastInteractAbsSec) : -99999,
    safeZoneUntil: Number.isFinite(Number(base?.safeZoneUntil)) ? Number(base.safeZoneUntil) : 0,
    aiTargetZoneId: base?.aiTargetZoneId != null ? String(base.aiTargetZoneId || '') : '',
    aiTargetTTL: Math.max(0, Number(base?.aiTargetTTL || 0)),
    routePlanZoneIds: Array.isArray(base?.routePlanZoneIds)
      ? base.routePlanZoneIds.map((z) => String(z || '').trim()).filter(Boolean)
      : [],
    routePlanItemIdsByZone: base?.routePlanItemIdsByZone && typeof base.routePlanItemIdsByZone === 'object'
      ? Object.fromEntries(Object.entries(base.routePlanItemIdsByZone).map(([z, ids]) => [
          String(z || ''),
          Array.isArray(ids) ? ids.map((id) => String(id || '').trim()).filter(Boolean) : [],
        ]))
      : {},
    routePlanTargetItemIds: Array.isArray(base?.routePlanTargetItemIds)
      ? base.routePlanTargetItemIds.map((id) => String(id || '').trim()).filter(Boolean)
      : [],
    routePlanRequiredItemIds: Array.isArray(base?.routePlanRequiredItemIds)
      ? base.routePlanRequiredItemIds.map((id) => String(id || '').trim()).filter(Boolean)
      : [],
    routePlanRequiredQtyById: base?.routePlanRequiredQtyById && typeof base.routePlanRequiredQtyById === 'object'
      ? Object.fromEntries(Object.entries(base.routePlanRequiredQtyById).map(([id, qty]) => [String(id || ''), Math.max(1, Math.floor(Number(qty || 1)))]))
      : {},
    routePlanDroneItemIds: Array.isArray(base?.routePlanDroneItemIds)
      ? base.routePlanDroneItemIds.map((id) => String(id || '').trim()).filter(Boolean)
      : [],
    routePlanTargetNamesBySlot: base?.routePlanTargetNamesBySlot && typeof base.routePlanTargetNamesBySlot === 'object'
      ? Object.fromEntries(Object.entries(base.routePlanTargetNamesBySlot).map(([slot, name]) => [String(slot || ''), String(name || '')]))
      : {},
    routePlanSearchCounts: base?.routePlanSearchCounts && typeof base.routePlanSearchCounts === 'object'
      ? Object.fromEntries(Object.entries(base.routePlanSearchCounts).map(([z, v]) => [String(z || ''), Math.max(0, Math.floor(Number(v || 0)))]))
      : {},
    routePlanIndex: Math.max(0, Math.floor(Number(base?.routePlanIndex || 0))),
    routePlanSource: String(base?.routePlanSource || ''),
    _recentCombatUntil: Number.isFinite(Number(base?._recentCombatUntil)) ? Number(base._recentCombatUntil) : 0,
    _recentCombatWith: String(base?._recentCombatWith || ''),
    _recentCombatReason: String(base?._recentCombatReason || ''),
    detonationSec: Number.isFinite(Number(base?.detonationSec)) ? Number(base.detonationSec) : undefined,
    detonationMaxSec: Number.isFinite(Number(base?.detonationMaxSec)) ? Number(base.detonationMaxSec) : undefined,
    statusImmunities: Array.from(statusImmunities),
    statusResists,
  };
}

function getEquipMoveSpeed(actor) {
  const inv = Array.isArray(actor?.inventory) ? actor.inventory : [];
  const eq = ensureEquipped(actor);
  const ids = [eq.weapon, eq.head, eq.clothes, eq.arm, eq.shoes].map((x) => String(x || '')).filter(Boolean);
  const used = new Set();

  function sumFromItem(it) {
    if (!it || typeof it !== 'object') return 0;
    const st = it.stats && typeof it.stats === 'object' ? it.stats : {};
    const v = Number(st.moveSpeed || 0);
    return Number.isFinite(v) ? v : 0;
  };

  let ms = 0;

  for (const id of ids) {
    const it = inv.find((x) => String(getInvItemId(x)) === id);
    if (it) {
      used.add(String(getInvItemId(it)));
      ms += sumFromItem(it);
    }
  }

  const shoes = inv.find((x) => String(x?.equipSlot || '') === 'shoes' && !used.has(String(getInvItemId(x))));
  if (shoes) ms += sumFromItem(shoes);

  const perkMs = perkNumber(getActorPerkEffects(actor)?.moveSpeedPlus || 0);
  const permanentMs = Number(actor?.permanentMoveSpeed || actor?.itemPermanentBonuses?.moveSpeed || 0);
  const statusMs = getMoveSpeedStatusBonus(actor);
  return Math.max(-0.75, ms + perkMs + (Number.isFinite(permanentMs) ? permanentMs : 0) + statusMs);
}

function getEquipSummary(char) {
  const eq = ensureEquipped(char);
  const inv = Array.isArray(char?.inventory) ? char.inventory : [];
  const parts = EQUIP_SLOTS.map((slot) => {
    const icon = SLOT_ICON[slot] || '🧩';
    const id = String(eq?.[slot] || '');
    if (!id) return { full: `${icon} -`, short: `${icon} -` };
    const it = inv.find((x) => getInvItemId(x) === id);
    const name = it ? itemDisplayName(it) : '?';
    return { full: `${icon} ${name}`, short: `${icon} ${shortText(name)}` };
  });
  return { full: parts.map((p) => p.full).join(' | '), short: parts.map((p) => p.short).join(' | ') };
}

function getEquipTierSummary(c) {
  const inv = Array.isArray(c?.inventory) ? c.inventory : [];
  const eq = ensureEquipped(c);

  function pickById(id) {
    if (!id) return null;
    const sid = String(id);
    return inv.find((it) => {
      const iid = String(it?.itemId || it?.id || it?._id || '');
      return iid && iid === sid;
    }) || null;
  };

  function readTier(it) {
    const t = Number(it?.tier ?? it?.t ?? 1);
    return Number.isFinite(t) ? Math.max(1, Math.min(6, Math.floor(t))) : 1;
  };

  function bestTierBySlot(slot) {
    const s = String(slot || '').toLowerCase();
    let best = 0;
    for (const it of inv) {
      const slotName = String(it?.equipSlot || inferEquipSlot(it) || '').toLowerCase();
      const tp = String(it?.type || '').toLowerCase();
      if (slotName === s || (s === 'weapon' && (tp === 'weapon' || tp === '무기' || tp === '臾닿린'))) {
        best = Math.max(best, readTier(it));
      }
    }
    return best;
  }

  const weaponEquipped = pickById(eq?.weapon);
  const weaponTier = Math.max(weaponEquipped ? readTier(weaponEquipped) : 0, bestTierBySlot('weapon'));
  const armorTierSum = ['head', 'clothes', 'arm', 'shoes'].reduce((sum, slot) => {
    const equipped = pickById(eq?.[slot]);
    return sum + Math.max(equipped ? readTier(equipped) : 0, bestTierBySlot(slot));
  }, 0);
  return { weaponTier, armorTierSum };
}

export {
  buildRuntimeSurvivorMap,
  ensureEquipped,
  getEquipMoveSpeed,
  getEquipSummary,
  getEquipTierSummary,
  normalizeRuntimeInventory,
  normalizeRuntimeSurvivor,
  normalizeRuntimeSurvivorList,
  upsertRuntimeSurvivor,
};
