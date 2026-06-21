import {
  clampTier4,
  compactIO,
  safeTags,
} from './simulationCommon';
import { EQUIP_SLOTS } from './simulationConstants';
import {
  addItemToInventory,
  getInvItemId,
  inferItemCategory,
  normalizeInventory,
} from './inventoryRules';
import {
  ensureEquipped,
  normalizeRuntimeSurvivor,
} from './survivorRuntime';

function lootUnitPriority(entry, opts = {}) {
  const itemId = String(entry?.itemId || entry?.id || '').trim();
  const goalIds = new Set(
    (Array.isArray(opts?.goalItemIds) ? opts.goalItemIds : [])
      .map((id) => String(id || '').trim())
      .filter(Boolean)
  );
  const category = inferItemCategory(entry);
  const tier = clampTier4(entry?.tier || 1);
  const tags = safeTags(entry).map((t) => String(t || '').toLowerCase());
  const name = String(entry?.name || '').toLowerCase();
  const special = (
    tags.some((t) => t.includes('meteor') || t.includes('life_tree') || t.includes('mithril') || t.includes('force_core') || t.includes('vf')) ||
    name.includes('meteor') ||
    name.includes('mithril') ||
    name.includes('force core') ||
    name.includes('blood sample')
  );
  const goal = goalIds.has(itemId) || entry?.goalItem === true || tags.includes('craft_goal') || tags.includes('route_goal');
  const equipment = category === 'equipment';
  const consumable = category === 'consumable';

  return (
    (goal ? 120 : 0) +
    (special ? 95 : 0) +
    (equipment ? 70 : 0) +
    (consumable ? 16 : 0) +
    tier * (equipment ? 18 : special ? 14 : 8) +
    Math.min(12, Math.max(0, Number(entry?.qty || 1)))
  );
}

function pickUnitsFromInventory(inventory, n, opts = {}) {
  const list = Array.isArray(inventory) ? inventory.map((x) => ({ ...x })) : [];
  const picked = [];
  for (let k = 0; k < n; k++) {
    const candidates = list
      .map((entry, index) => ({
        index,
        qty: Math.max(0, Number(entry?.qty || 0)),
        score: lootUnitPriority(entry, opts),
        acquiredDay: Number(entry?.acquiredDay || 0),
      }))
      .filter((row) => row.qty > 0)
      .sort((a, b) => (
        (Number(b.score || 0) - Number(a.score || 0)) ||
        (Number(b.qty || 0) - Number(a.qty || 0)) ||
        (Number(b.acquiredDay || 0) - Number(a.acquiredDay || 0))
      ));
    if (!candidates.length) break;
    let idx = candidates[0].index;
    if (idx < 0) idx = 0;
    const it = list[idx];
    const id = String(it?.itemId || it?.id || '');
    if (!id) break;
    picked.push({ itemId: id, qty: 1, item: { ...it } });
    const nextQty = Math.max(0, Number(it?.qty || 0) - 1);
    if (nextQty <= 0) list.splice(idx, 1);
    else list[idx] = { ...it, qty: nextQty };
  }
  return picked;
}

function removePickedUnitsFromInventory(inventory, picked) {
  const list = Array.isArray(inventory) ? inventory.map((x) => ({ ...x })) : [];
  const need = compactIO(Array.isArray(picked) ? picked : []);
  for (const row of need) {
    const itemId = String(row?.itemId || '');
    let remaining = Math.max(0, Number(row?.qty || 0));
    if (!itemId || remaining <= 0) continue;
    for (let i = 0; i < list.length && remaining > 0; i += 1) {
      const curId = String(list[i]?.itemId || list[i]?.id || '');
      if (curId !== itemId) continue;
      const have = Math.max(0, Number(list[i]?.qty || 1));
      const take = Math.min(have, remaining);
      const nextQty = have - take;
      remaining -= take;
      if (nextQty <= 0) {
        list.splice(i, 1);
        i -= 1;
      } else {
        list[i] = { ...list[i], qty: nextQty };
      }
    }
  }
  return list;
}

function pruneEquippedAgainstInventory(actor) {
  if (!actor || typeof actor !== 'object') return actor;
  const invIds = new Set((Array.isArray(actor?.inventory) ? actor.inventory : []).map((x) => String(getInvItemId(x) || '')).filter(Boolean));
  const eq = ensureEquipped(actor);
  const nextEq = { ...eq };
  for (const slot of EQUIP_SLOTS) {
    const curId = String(eq?.[slot] || '');
    if (curId && !invIds.has(curId)) nextEq[slot] = null;
  }
  actor.equipped = nextEq;
  return actor;
}

function clearRuntimeCombatFields(actor) {
  if (!actor || typeof actor !== 'object') return actor;
  actor.lastDamagedBy = '';
  actor.lastDamagedPhaseIdx = -9999;
  actor._deathAt = undefined;
  actor._deathBy = undefined;
  actor._detLogLastMilestone = null;
  actor._gatherPvpBonus = 0;
  actor._gatherPvpBonusUntilPhaseIdx = -9999;
  actor._immediateDanger = 0;
  actor._immediateDangerUntilPhaseIdx = -9999;
  actor.aiTargetZoneId = '';
  actor.aiTargetTTL = 0;
  actor.safeZoneUntil = 0;
  actor._recentCombatUntil = 0;
  actor._recentCombatWith = '';
  actor._recentCombatReason = '';
  return actor;
}

function applyAiRecoveryWindow(actor, absSec, opts = {}) {
  if (!actor || typeof actor !== 'object') return actor;
  const now = Number.isFinite(Number(absSec)) ? Number(absSec) : 0;
  const recoverSec = Math.max(0, Number(opts?.recoverSec ?? 0));
  const safeZoneSec = Math.max(0, Number(opts?.safeZoneSec ?? 0));
  const reason = String(opts?.reason || '');
  const opponentId = String(opts?.opponentId || '');
  const retargetZoneId = String(opts?.retargetZoneId || '');
  const retargetTtl = Math.max(0, Math.floor(Number(opts?.retargetTtl ?? 0)));
  actor.aiTargetZoneId = retargetZoneId || '';
  actor.aiTargetTTL = retargetZoneId ? retargetTtl : 0;
  actor._recentCombatUntil = Math.max(0, now + recoverSec, Number(actor?._recentCombatUntil || 0));
  actor._recentCombatWith = opponentId;
  actor._recentCombatReason = reason;
  if (safeZoneSec > 0) {
    actor.safeZoneUntil = Math.max(Number(actor?.safeZoneUntil || 0), now + safeZoneSec);
  }
  return actor;
}

function isAiRecoveryLocked(actor, absSec) {
  return Number(actor?._recentCombatUntil || 0) > Number(absSec || 0);
}

function normalizeDeadSnapshot(actor, ruleset) {
  if (!actor || typeof actor !== 'object') return actor;
  const dead = normalizeRuntimeSurvivor(actor);
  dead.inventory = normalizeInventory(dead.inventory, ruleset);
  pruneEquippedAgainstInventory(dead);
  clearRuntimeCombatFields(dead);
  dead.hp = 0;
  return dead;
}

function normalizeRevivedSurvivor(actor, revivedHp, zoneId, phaseIdxNow, ruleset, absSec = 0, reviveKit = null) {
  if (!actor || typeof actor !== 'object') return actor;
  const revived = normalizeRuntimeSurvivor(actor);
  revived.inventory = normalizeInventory(revived.inventory, ruleset);
  pruneEquippedAgainstInventory(revived);
  clearRuntimeCombatFields(revived);
  revived.hp = Math.max(1, Math.min(Number(revived.maxHp || revivedHp || 1), Number(revivedHp || 1)));
  revived.zoneId = String(zoneId || revived.zoneId || '');
  revived.activeEffects = [];
  revived.statusImmunities = Array.isArray(revived.statusImmunities) ? [...revived.statusImmunities] : [];
  revived.statusResists = revived.statusResists && typeof revived.statusResists === 'object' ? { ...revived.statusResists } : {};
  revived.revivedOnce = true;
  revived.revivedAtPhaseIdx = phaseIdxNow;
  revived.deadAtPhaseIdx = undefined;
  revived.reviveEligible = false;
  applyAiRecoveryWindow(revived, absSec, { reason: 'revive', recoverSec: 8, safeZoneSec: 10 });
  if (reviveKit && reviveKit._id) {
    revived.inventory = addItemToInventory(revived.inventory, reviveKit, String(reviveKit._id), 1, 1, ruleset);
  }
  pruneEquippedAgainstInventory(revived);
  return revived;
}

export {
  pickUnitsFromInventory,
  removePickedUnitsFromInventory,
  pruneEquippedAgainstInventory,
  clearRuntimeCombatFields,
  applyAiRecoveryWindow,
  isAiRecoveryLocked,
  normalizeDeadSnapshot,
  normalizeRevivedSurvivor,
};
