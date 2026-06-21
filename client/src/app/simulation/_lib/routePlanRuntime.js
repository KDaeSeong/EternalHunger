import { compactIO, hash32 } from './simulationCommon';
import { EQUIP_SLOTS } from './simulationConstants';
import { inferEquipSlot, inferItemCategory } from './inventoryRules';
import { classifySpecialByName, pickGoalLoadoutKeys } from './craftRuntime';
import { findCrateZoneWeightsForItem, uniqStrings } from './mapTargeting';
import { normalizeWeaponType } from '../../../utils/equipmentCatalog';

function normId(v) {
  return String(v?._id || v?.itemId || v?.id || v || '').trim();
}

function normKey(it) {
  return String(it?.itemKey || it?.externalId || '').trim();
}

function buildItemIndexes(publicItems) {
  const byId = new Map();
  const byKey = new Map();
  for (const it of Array.isArray(publicItems) ? publicItems : []) {
    const id = normId(it);
    if (!id) continue;
    byId.set(id, it);
    const key = normKey(it);
    if (key && !byKey.has(key)) byKey.set(key, it);
  }
  return { byId, byKey };
}

function isEarlyRouteScorableItem(item) {
  if (!item || typeof item !== 'object') return true;
  const name = String(item?.name || item?.text || '');
  if (classifySpecialByName(name)) return false;

  const tags = Array.isArray(item?.tags) ? item.tags.map((t) => String(t || '').toLowerCase()) : [];
  if (tags.includes('food') || tags.includes('heal') || tags.includes('medical')) return false;

  const category = inferItemCategory(item);
  if (category === 'consumable') return false;
  if (category !== 'equipment') return true;

  const tier = Number(item?.tier || 1);
  return Number.isFinite(tier) ? tier <= 2 : true;
}

function collectRecipeIngredientWeights(target, indexes, opts = {}) {
  const maxDepth = Math.max(1, Math.floor(Number(opts.maxDepth ?? 4)));
  const byId = indexes?.byId instanceof Map ? indexes.byId : new Map();
  const out = new Map();
  const seen = new Map();
  const targetId = normId(target);

  function addScore(itemId, amount) {
    const id = String(itemId || '').trim();
    if (!id) return;
    out.set(id, (out.get(id) || 0) + Math.max(0, Number(amount || 0)));
  }

  function visit(itemId, depth, weight) {
    const id = String(itemId || '').trim();
    if (!id || depth > maxDepth) return;
    const prev = Number(seen.get(id) ?? -1);
    if (prev >= weight) return;
    seen.set(id, weight);

    const item = byId.get(id) || null;
    if (depth > 0 && isEarlyRouteScorableItem(item)) {
      const depthMul = depth <= 1 ? 1 : depth === 2 ? 0.78 : 0.55;
      addScore(id, weight * depthMul);
    }

    const ingredients = compactIO(item?.recipe?.ingredients || []);
    if (!ingredients.length) return;
    for (const ing of ingredients) {
      const qty = Math.max(1, Number(ing?.qty || 1));
      visit(ing.itemId, depth + 1, weight * Math.min(2.5, qty));
    }
  }

  if (targetId) visit(targetId, 0, 1);
  return out;
}

function zoneTie(actor, zoneId) {
  const seed = `${String(actor?._id || actor?.id || actor?.name || '')}:${String(zoneId || '')}`;
  return hash32(seed) % 10000;
}

function pickFallbackRouteTargets(actor, publicItems) {
  const actorWeaponType = normalizeWeaponType(String(actor?.weaponType || '').trim());
  const bySlot = new Map();

  for (const it of Array.isArray(publicItems) ? publicItems : []) {
    if (!Array.isArray(it?.recipe?.ingredients) || !it.recipe.ingredients.length) continue;
    if (inferItemCategory(it) !== 'equipment') continue;

    const slot = String(it?.equipSlot || inferEquipSlot(it) || '').toLowerCase();
    if (!EQUIP_SLOTS.includes(slot)) continue;

    const tier = Number(it?.tier || 1);
    if (!Number.isFinite(tier) || tier < 2 || tier > 4) continue;

    if (slot === 'weapon') {
      const itemWeaponType = normalizeWeaponType(String(it?.weaponType || '').trim());
      if (actorWeaponType && itemWeaponType && itemWeaponType !== actorWeaponType) continue;
    }

    const list = bySlot.get(slot) || [];
    list.push(it);
    bySlot.set(slot, list);
  }

  const actorKey = String(actor?._id || actor?.id || actor?.name || '');
  const targets = [];
  for (const slot of EQUIP_SLOTS) {
    const list = bySlot.get(slot) || [];
    if (!list.length) continue;
    list.sort((a, b) => {
      const tierDelta = Number(b?.tier || 1) - Number(a?.tier || 1);
      if (tierDelta) return tierDelta;
      const ha = hash32(`${actorKey}:${slot}:${normId(a)}`);
      const hb = hash32(`${actorKey}:${slot}:${normId(b)}`);
      return ha - hb;
    });
    targets.push(list[0]);
  }
  return targets;
}

function buildEarlyRoutePlanDetails(actor, mapObj, publicItems, opts = {}) {
  const zoneIds = uniqStrings(
    (Array.isArray(mapObj?.zones) ? mapObj.zones : [])
      .map((z) => String(z?.zoneId || ''))
      .filter(Boolean)
  );
  const empty = { zoneIds: [], itemIdsByZone: {} };
  if (!zoneIds.length) return empty;

  const indexes = buildItemIndexes(publicItems);
  const goalKeys = pickGoalLoadoutKeys(actor);
  const targetItems = goalKeys
    .map((key) => indexes.byKey.get(String(key || '').trim()) || null)
    .filter(Boolean);
  if (!targetItems.length) targetItems.push(...pickFallbackRouteTargets(actor, publicItems));
  if (!targetItems.length) return empty;

  const forbiddenIds = opts.forbiddenIds instanceof Set ? opts.forbiddenIds : new Set();
  const zoneScore = new Map();
  const zoneItems = new Map();

  function addZoneScore(zoneId, score, itemId = '') {
    const zid = String(zoneId || '').trim();
    if (!zid || forbiddenIds.has(zid)) return;
    if (!zoneIds.includes(zid)) return;
    zoneScore.set(zid, (zoneScore.get(zid) || 0) + Math.max(0, Number(score || 0)));
    const id = String(itemId || '').trim();
    if (id) {
      const list = zoneItems.get(zid) || [];
      list.push(id);
      zoneItems.set(zid, list);
    }
  }

  for (const target of targetItems) {
    const ingredientWeights = collectRecipeIngredientWeights(target, indexes, opts);
    for (const [itemId, ingredientWeight] of ingredientWeights.entries()) {
      const crateWeights = findCrateZoneWeightsForItem(mapObj, itemId, forbiddenIds);
      for (const [zoneId, crateWeight] of crateWeights.entries()) {
        addZoneScore(zoneId, ingredientWeight * (1 + Math.min(5, Number(crateWeight || 0)) / 3), itemId);
      }
    }
  }

  const routeLength = Math.max(1, Math.floor(Number(opts.routeLength ?? 4)));
  const ranked = [...zoneScore.entries()]
    .filter(([, score]) => Number(score || 0) > 0)
    .sort((a, b) => {
      const delta = Number(b[1] || 0) - Number(a[1] || 0);
      if (Math.abs(delta) > 0.0001) return delta;
      return zoneTie(actor, a[0]) - zoneTie(actor, b[0]);
    })
    .map(([zoneId]) => String(zoneId))
    .slice(0, routeLength);

  const routeZoneIds = uniqStrings(ranked);
  const itemIdsByZone = {};
  for (const zoneId of routeZoneIds) {
    itemIdsByZone[String(zoneId)] = uniqStrings(zoneItems.get(String(zoneId)) || []);
  }

  return { zoneIds: routeZoneIds, itemIdsByZone };
}

function buildEarlyRoutePlan(actor, mapObj, publicItems, opts = {}) {
  return buildEarlyRoutePlanDetails(actor, mapObj, publicItems, opts).zoneIds;
}

function isEarlyRouteActive(day, phase) {
  const d = Math.max(0, Number(day || 0));
  const p = String(phase || '');
  const isDayPhase = p === 'morning' || p === 'day';
  return d === 1 || (d === 2 && isDayPhase);
}

function normalizeRoutePlanZoneIds(routePlanZoneIds) {
  return uniqStrings((Array.isArray(routePlanZoneIds) ? routePlanZoneIds : []).map((z) => String(z || '').trim()).filter(Boolean));
}

function getEarlyRoutePlanTarget(actor, forbiddenIds, day, phase) {
  if (!isEarlyRouteActive(day, phase)) return '';
  const plan = normalizeRoutePlanZoneIds(actor?.routePlanZoneIds);
  if (!plan.length) return '';

  const forb = forbiddenIds instanceof Set ? forbiddenIds : new Set();
  const startIdx = Math.max(0, Math.floor(Number(actor?.routePlanIndex || 0)));
  for (let i = startIdx; i < plan.length; i += 1) {
    const zoneId = String(plan[i] || '');
    if (zoneId && !forb.has(zoneId)) return zoneId;
  }
  return '';
}

function getRouteZoneItemIds(actor, zoneId) {
  const byZone = actor?.routePlanItemIdsByZone && typeof actor.routePlanItemIdsByZone === 'object'
    ? actor.routePlanItemIdsByZone
    : {};
  return uniqStrings((Array.isArray(byZone?.[String(zoneId || '')]) ? byZone[String(zoneId || '')] : []).map((id) => String(id || '').trim()).filter(Boolean));
}

function advanceEarlyRouteProgress(actor, zoneId, opts = {}) {
  if (!actor || typeof actor !== 'object') return actor;
  const plan = normalizeRoutePlanZoneIds(actor.routePlanZoneIds);
  if (!plan.length) {
    actor.routePlanIndex = 0;
    actor._routePlanProgress = {
      beforeIndex: 0,
      afterIndex: 0,
      planLength: 0,
      zoneId: String(zoneId || actor.zoneId || '').trim(),
      searched: opts?.searched === true,
      advanced: false,
    };
    return actor;
  }

  const current = String(zoneId || actor.zoneId || '').trim();
  const missingSet = new Set(
    (Array.isArray(opts?.missingItemIds) ? opts.missingItemIds : [])
      .map((id) => String(id || '').trim())
      .filter(Boolean)
  );
  const searched = opts?.searched === true;
  const maxSearches = Math.max(1, Math.floor(Number(opts?.maxSearches ?? 2)));
  const searchCounts = actor.routePlanSearchCounts && typeof actor.routePlanSearchCounts === 'object'
    ? { ...actor.routePlanSearchCounts }
    : {};
  let idx = Math.max(0, Math.floor(Number(actor.routePlanIndex || 0)));
  const beforeIndex = idx;
  let lastSearchCount = Math.max(0, Math.floor(Number(searchCounts[current] || 0)));
  while (idx < plan.length && String(plan[idx] || '') === current) {
    const zoneItemIds = uniqStrings(
      (Array.isArray(opts?.routeItemIds) && opts.routeItemIds.length ? opts.routeItemIds : getRouteZoneItemIds(actor, current))
        .map((id) => String(id || '').trim())
        .filter(Boolean)
    );
    const stillNeedsZone = missingSet.size > 0 && zoneItemIds.some((id) => missingSet.has(id));
    if (stillNeedsZone) {
      const count = Math.max(0, Math.floor(Number(searchCounts[current] || 0)));
      const nextCount = searched ? count + 1 : count;
      searchCounts[current] = nextCount;
      lastSearchCount = nextCount;
      if (nextCount < maxSearches) break;
    }
    idx += 1;
  }
  const afterIndex = Math.min(plan.length, idx);
  actor.routePlanIndex = afterIndex;
  actor.routePlanSearchCounts = searchCounts;
  actor._routePlanProgress = {
    beforeIndex,
    afterIndex,
    planLength: plan.length,
    zoneId: current,
    searched,
    searchCount: lastSearchCount,
    maxSearches,
    advanced: afterIndex > beforeIndex,
    completed: afterIndex >= plan.length,
  };
  return actor;
}

export {
  advanceEarlyRouteProgress,
  buildEarlyRoutePlan,
  buildEarlyRoutePlanDetails,
  getEarlyRoutePlanTarget,
  normalizeRoutePlanZoneIds,
};
