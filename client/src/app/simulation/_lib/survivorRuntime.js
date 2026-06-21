import { normalizeWeaponType } from '../../../utils/equipmentCatalog';
import {
  EFFECT_BLEED,
  EFFECT_BURN,
  EFFECT_FOOD_POISON,
  EFFECT_POISON,
} from '../../../utils/statusLogic';
import { itemDisplayName, safeTags, shortText } from './simulationCommon';
import { EQUIP_SLOTS, SLOT_ICON } from './simulationConstants';
import { getActorPerkEffects, perkNumber } from './perkRuntime';
import { getInvItemId } from './inventoryRules';
import { normalizeRuntimeEffect } from './runtimeStatus';
import { normalizeSupportedTacSkill } from '../tacticalSkillTable';
import { getWeaponMasteryLevel } from '../../../utils/erMeta';

function ensureEquipped(obj) {
  const eq = obj?.equipped;
  if (eq && typeof eq === 'object') {
    return {
      weapon: eq.weapon ?? null,
      head: eq.head ?? null,
      clothes: eq.clothes ?? null,
      arm: eq.arm ?? null,
      shoes: eq.shoes ?? null,
    };
  }
  return { weapon: null, head: null, clothes: null, arm: null, shoes: null };
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
  const hpDefault = opts.hpDefault != null ? Number(opts.hpDefault) : 100;
  const maxHpDefault = opts.maxHpDefault != null ? Number(opts.maxHpDefault) : 100;
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
  if (perkNumber(perkFx?.bleedImmune || 0) > 0) statusImmunities.add(EFFECT_BLEED);
  if (perkNumber(perkFx?.poisonImmune || 0) > 0) {
    statusImmunities.add(EFFECT_POISON);
    statusImmunities.add(EFFECT_FOOD_POISON);
  }
  if (perkNumber(perkFx?.burnImmune || 0) > 0) statusImmunities.add(EFFECT_BURN);

  const statusResists = {
    ...(base?.statusResists && typeof base.statusResists === 'object' ? base.statusResists : {}),
  };
  statusResists[EFFECT_BLEED] = Math.max(0, Number(statusResists[EFFECT_BLEED] || 0), Number(perkFx?.bleedResistPct || 0));
  statusResists[EFFECT_POISON] = Math.max(0, Number(statusResists[EFFECT_POISON] || 0), Number(perkFx?.poisonResistPct || 0));
  statusResists[EFFECT_FOOD_POISON] = Math.max(0, Number(statusResists[EFFECT_FOOD_POISON] || 0), Number(perkFx?.poisonResistPct || 0));
  statusResists[EFFECT_BURN] = Math.max(0, Number(statusResists[EFFECT_BURN] || 0), Number(perkFx?.burnResistPct || 0));
  const weaponMasteryXp = Math.max(0, Math.floor(Number(base?.weaponMasteryXp || 0)));
  const weaponMasteryLevel = getWeaponMasteryLevel({ ...base, weaponMasteryXp });

  return {
    ...base,
    inventory: normalizeRuntimeInventory(base?.inventory),
    equipped: ensureEquipped(base),
    activeEffects: Array.isArray(base?.activeEffects) ? base.activeEffects.map((x) => normalizeRuntimeEffect(x)).filter(Boolean) : [],
    cooldowns: base?.cooldowns && typeof base.cooldowns === 'object' ? { ...base.cooldowns } : { portableSafeZone: 0, cnotGate: 0 },
    hp: Math.max(0, Math.min(maxHp, hp)),
    maxHp,
    simCredits: Number.isFinite(Number(base?.simCredits)) ? Number(base.simCredits) : 0,
    tacticalSkill: normalizeSupportedTacSkill(base?.tacticalSkill),
    tacticalSkillLevel: Math.max(1, Math.min(2, Number(base?.tacticalSkillLevel || 1))),
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
  return Math.max(0, ms + perkMs);
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
  const eq = c?.equipped || null;

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
    return Number.isFinite(t) ? Math.max(1, Math.floor(t)) : 1;
  };

  if (eq && typeof eq === 'object') {
    const w = pickById(eq.weapon);
    const h = pickById(eq.head);
    const c2 = pickById(eq.clothes);
    const a = pickById(eq.arm);
    const s = pickById(eq.shoes);

    const weaponTier = w ? readTier(w) : 0;
    const armorTierSum = (h ? readTier(h) : 0) + (c2 ? readTier(c2) : 0) + (a ? readTier(a) : 0) + (s ? readTier(s) : 0);
    return { weaponTier, armorTierSum };
  }

  let weaponTier = 0;
  let armorTierSum = 0;
  const armorSlots = new Set(['head', 'clothes', 'arm', 'shoes']);
  for (const it of inv) {
    const slot = String(it?.equipSlot || '');
    const tp = String(it?.type || '').toLowerCase();
    const t = readTier(it);
    if (slot === 'weapon' || tp === 'weapon' || tp === '무기') weaponTier = Math.max(weaponTier, t);
    else if (armorSlots.has(slot)) armorTierSum += t;
  }
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
