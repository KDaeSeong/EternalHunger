import { compactIO, hash32 } from './simulationCommon';
import { EQUIP_SLOTS, LUMIA_DEFAULT_EDGES } from './simulationConstants';
import { inferEquipSlot, inferItemCategory } from './inventoryRules';
import { classifySpecialByName } from './craftRuntime';
import { findCrateZoneWeightsForItem, uniqStrings } from './mapTargeting';
import { getRegionZoneWeightsForItem } from './lumiaRegionData';
import { normalizeWeaponType } from '../../../utils/equipmentCatalog';
import { isItemExcludedFromFieldFarming } from '../../../utils/erItemFilters';

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
  if (isItemExcludedFromFieldFarming(item)) return false;
  const name = String(item?.name || item?.text || '');
  if (classifySpecialByName(name)) return false;

  const tags = Array.isArray(item?.tags) ? item.tags.map((t) => String(t || '').toLowerCase()) : [];
  if (tags.includes('food')) return false;

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
    if (isItemExcludedFromFieldFarming(it)) continue;
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

function pickHeroGoalLoadoutBySlot(actor) {
  const g = actor?.goalLoadouts && typeof actor.goalLoadouts === 'object' ? actor.goalLoadouts : {};
  const h = g?.hero && typeof g.hero === 'object' ? g.hero : {};
  return {
    weapon: String(h.weaponKey || '').trim(),
    head: String(h.headKey || '').trim(),
    clothes: String(h.clothesKey || '').trim(),
    arm: String(h.armKey || '').trim(),
    shoes: String(h.shoesKey || '').trim(),
  };
}

function getItemRouteZoneIds(item, mapObj, forbiddenIds) {
  const out = new Set();
  const forb = forbiddenIds instanceof Set ? forbiddenIds : new Set();
  const zoneRows = Array.isArray(mapObj?.zones) ? mapObj.zones : [];
  const zoneIdSet = new Set(zoneRows.map((z) => String(z?.zoneId || '')).filter(Boolean));

  const crateWeights = findCrateZoneWeightsForItem(mapObj, normId(item), forb);
  for (const zoneId of crateWeights.keys()) {
    const zid = String(zoneId || '').trim();
    if (zid && zoneIdSet.has(zid) && !forb.has(zid)) out.add(zid);
  }

  const regionWeights = getRegionZoneWeightsForItem(item, mapObj?.zones, forb);
  for (const zoneId of regionWeights.keys()) {
    const zid = String(zoneId || '').trim();
    if (zid && zoneIdSet.has(zid) && !forb.has(zid)) out.add(zid);
  }

  const spawnZones = new Set((Array.isArray(item?.spawnZones) ? item.spawnZones : []).map((z) => String(z || '').trim()).filter(Boolean));
  if (spawnZones.size) {
    for (const zone of zoneRows) {
      const zid = String(zone?.zoneId || '').trim();
      const name = String(zone?.name || '').trim();
      if (zid && !forb.has(zid) && (spawnZones.has(zid) || spawnZones.has(name))) out.add(zid);
    }
  }

  return [...out];
}

function mergeRequirement(list, item, itemId, qty, mapObj, forbiddenIds) {
  const id = String(itemId || normId(item));
  if (!id) return;
  const found = list.get(id) || {
    item,
    itemId: id,
    name: String(item?.name || id),
    qty: 0,
    tier: Number(item?.tier || 0),
    zones: new Set(),
  };
  found.qty += Math.max(1, Number(qty || 1));
  for (const zoneId of getItemRouteZoneIds(item, mapObj, forbiddenIds)) found.zones.add(zoneId);
  list.set(id, found);
}

function collectRecipeLeafRequirements(target, indexes, mapObj, opts = {}) {
  const byId = indexes?.byId instanceof Map ? indexes.byId : new Map();
  const forbiddenIds = opts.forbiddenIds instanceof Set ? opts.forbiddenIds : new Set();
  const maxDepth = Math.max(1, Math.floor(Number(opts.maxDepth ?? 5)));
  const out = new Map();

  function visit(itemId, qty, depth, seen) {
    const id = String(itemId || '').trim();
    if (!id) return;
    const item = byId.get(id) || null;
    if (!item || seen.has(id) || depth >= maxDepth) {
      mergeRequirement(out, item || { _id: id, name: id }, id, qty, mapObj, forbiddenIds);
      return;
    }

    const ingredients = compactIO(item?.recipe?.ingredients || []);
    if (!ingredients.length) {
      if (depth > 0 && isEarlyRouteScorableItem(item)) {
        mergeRequirement(out, item, id, qty, mapObj, forbiddenIds);
      }
      return;
    }

    const nextSeen = new Set(seen);
    nextSeen.add(id);
    for (const ing of ingredients) {
      visit(ing.itemId, qty * Math.max(1, Number(ing.qty || 1)), depth + 1, nextSeen);
    }
  }

  visit(normId(target), 1, 0, new Set());
  return [...out.values()].map((req) => ({
    ...req,
    qty: Math.max(1, Math.floor(Number(req.qty || 1))),
    zones: [...req.zones],
  }));
}

function buildRouteConnectionInfo(mapObj) {
  const direct = new Set();
  const add = (a0, b0) => {
    const a = String(a0 || '').trim();
    const b = String(b0 || '').trim();
    if (!a || !b || a === b) return;
    direct.add(`${a}::${b}`);
  };
  for (const c of Array.isArray(mapObj?.zoneConnections) ? mapObj.zoneConnections : []) {
    const a = String(c?.fromZoneId || '').trim();
    const b = String(c?.toZoneId || '').trim();
    add(a, b);
    if (c?.bidirectional !== false) add(b, a);
  }

  const zoneSet = new Set(
    (Array.isArray(mapObj?.zones) ? mapObj.zones : [])
      .map((z) => String(z?.zoneId || '').trim())
      .filter(Boolean)
  );
  const defaultZoneHits = [...zoneSet].filter((zoneId) => (
    LUMIA_DEFAULT_EDGES.some(([a, b]) => zoneId === a || zoneId === b)
  )).length;
  const shouldMergeLumiaDefaults = zoneSet.size > 0 && defaultZoneHits >= Math.min(8, zoneSet.size);
  if (shouldMergeLumiaDefaults) {
    for (const [a, b] of LUMIA_DEFAULT_EDGES) {
      if (!zoneSet.has(a) || !zoneSet.has(b)) continue;
      add(a, b);
      add(b, a);
    }
  }

  const hyper = new Set((Array.isArray(mapObj?.zones) ? mapObj.zones : [])
    .filter((z) => z?.hasHyperloop === true || z?.hyperloop === true)
    .map((z) => String(z?.zoneId || '').trim())
    .filter(Boolean));
  const serverPad = String(mapObj?.hyperloopDeviceZoneId || '').trim();
  if (serverPad) hyper.add(serverPad);

  return {
    routePenalty(route) {
      const ids = Array.isArray(route) ? route.map((z) => String(z || '').trim()).filter(Boolean) : [];
      let penalty = 0;
      for (let i = 0; i < ids.length - 1; i += 1) {
        const a = ids[i];
        const b = ids[i + 1];
        if (direct.has(`${a}::${b}`) || hyper.has(a)) continue;
        penalty += 1;
      }
      return penalty;
    },
  };
}

function requirementStatsForRoute(requirements, routeSet) {
  const missing = [];
  let missingQty = 0;
  let coveredQty = 0;
  let totalQty = 0;
  for (const req of requirements instanceof Map ? requirements.values() : []) {
    const qty = Math.max(1, Math.floor(Number(req?.qty || 1)));
    totalQty += qty;
    const covered = (Array.isArray(req?.zones) ? req.zones : [...(req?.zones || [])])
      .some((z) => routeSet.has(String(z || '')));
    if (covered) coveredQty += qty;
    else {
      missing.push(req);
      missingQty += qty;
    }
  }
  return { missing, missingQty, coveredQty, totalQty };
}

function cloneRequirementMap(reqs) {
  const out = new Map();
  for (const [id, req] of reqs instanceof Map ? reqs.entries() : []) {
    out.set(String(id), {
      ...req,
      zones: new Set(Array.isArray(req.zones) ? req.zones : [...(req.zones || [])]),
    });
  }
  return out;
}

function addRequirementsToState(baseReqs, addList) {
  const out = cloneRequirementMap(baseReqs);
  for (const req of Array.isArray(addList) ? addList : []) {
    const id = String(req?.itemId || '').trim();
    if (!id) continue;
    const prev = out.get(id) || {
      ...req,
      qty: 0,
      zones: new Set(),
    };
    prev.qty = Math.max(0, Number(prev.qty || 0)) + Math.max(1, Number(req.qty || 1));
    const zones = prev.zones instanceof Set ? prev.zones : new Set(Array.isArray(prev.zones) ? prev.zones : []);
    for (const z of Array.isArray(req.zones) ? req.zones : []) zones.add(String(z || ''));
    prev.zones = zones;
    out.set(id, prev);
  }
  return out;
}

function buildDay1TargetCandidatesBySlot(actor, publicItems, indexes, mapObj, opts = {}) {
  const actorWeaponType = normalizeWeaponType(String(actor?.weaponType || '').trim());
  const heroGoalBySlot = pickHeroGoalLoadoutBySlot(actor);
  const candidateLimit = Math.max(3, Math.floor(Number(opts.candidateLimit ?? 8)));
  const bySlot = new Map();

  for (const slot of EQUIP_SLOTS) {
    const goalKey = String(heroGoalBySlot?.[slot] || '').trim();
    const goalItem = goalKey ? indexes.byKey.get(goalKey) || null : null;
    const goalSlot = goalItem ? String(goalItem?.equipSlot || inferEquipSlot(goalItem) || '').toLowerCase() : '';
    if (goalItem && goalSlot === slot) {
      const requirements = collectRecipeLeafRequirements(goalItem, indexes, mapObj, opts);
      if (requirements.length) {
        bySlot.set(slot, [{
          item: goalItem,
          requirements,
          goal: true,
        }]);
        continue;
      }
    }

    const candidates = [];
    for (const it of Array.isArray(publicItems) ? publicItems : []) {
      if (!it?._id) continue;
      if (isItemExcludedFromFieldFarming(it)) continue;
      if (!Array.isArray(it?.recipe?.ingredients) || !it.recipe.ingredients.length) continue;
      if (inferItemCategory(it) !== 'equipment') continue;
      const itemSlot = String(it?.equipSlot || inferEquipSlot(it) || '').toLowerCase();
      if (itemSlot !== slot) continue;
      if (Number(it?.tier || 0) !== 4) continue;
      if (slot === 'weapon') {
        const itemWeaponType = normalizeWeaponType(String(it?.weaponType || '').trim());
        if (actorWeaponType && itemWeaponType && itemWeaponType !== actorWeaponType) continue;
      }

      const requirements = collectRecipeLeafRequirements(it, indexes, mapObj, opts);
      if (!requirements.length) continue;
      const noZoneCount = requirements.filter((r) => !Array.isArray(r.zones) || r.zones.length === 0).length;
      const highTierCount = requirements.filter((r) => Number(r.tier || 0) >= 5).length;
      const totalQty = requirements.reduce((sum, r) => sum + Math.max(1, Number(r.qty || 1)), 0);
      const zoneCount = new Set(requirements.flatMap((r) => Array.isArray(r.zones) ? r.zones : [])).size;
      const score = highTierCount * 10000 + noZoneCount * 1000 + totalQty * 4 + Math.max(0, zoneCount - 2) * 3;
      candidates.push({ item: it, requirements, goal: false, score });
    }

    candidates.sort((a, b) => Number(a.score || 0) - Number(b.score || 0) || String(a.item?.name || '').localeCompare(String(b.item?.name || ''), 'ko'));
    bySlot.set(slot, candidates.slice(0, candidateLimit));
  }

  return bySlot;
}

function buildRoutePairs(zoneIds) {
  const ids = uniqStrings(zoneIds);
  const out = [];
  if (ids.length <= 1) return ids.length ? [[ids[0]]] : [];
  for (let i = 0; i < ids.length; i += 1) {
    for (let j = 0; j < ids.length; j += 1) {
      if (i === j) continue;
      out.push([ids[i], ids[j]]);
    }
  }
  return out;
}

export {
  addRequirementsToState,
  buildDay1TargetCandidatesBySlot,
  buildItemIndexes,
  buildRouteConnectionInfo,
  buildRoutePairs,
  collectRecipeIngredientWeights,
  normId,
  normKey,
  pickFallbackRouteTargets,
  requirementStatsForRoute,
  zoneTie,
};
