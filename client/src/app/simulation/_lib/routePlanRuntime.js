import { compactIO, hash32 } from './simulationCommon';
import { EQUIP_SLOTS } from './simulationConstants';
import { inferEquipSlot, inferItemCategory } from './inventoryRules';
import { classifySpecialByName, pickGoalLoadoutKeys } from './craftRuntime';
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

function buildDay1HeroRoutePlanDetails(actor, mapObj, publicItems, opts = {}) {
  const zoneIds = uniqStrings(
    (Array.isArray(mapObj?.zones) ? mapObj.zones : [])
      .map((z) => String(z?.zoneId || ''))
      .filter(Boolean)
  );
  const empty = { zoneIds: [], itemIdsByZone: {}, targetItemIds: [], requiredItemIds: [], requiredQtyById: {}, droneItemIds: [], complete: false, source: '' };
  if (!zoneIds.length) return empty;

  const indexes = buildItemIndexes(publicItems);
  const candidatesBySlot = buildDay1TargetCandidatesBySlot(actor, publicItems, indexes, mapObj, opts);
  if (EQUIP_SLOTS.some((slot) => !(candidatesBySlot.get(slot) || []).length)) return empty;

  const droneLimit = Math.max(0, Math.floor(Number(opts.droneFallbackLimit ?? 1)));
  const beamLimit = Math.max(20, Math.floor(Number(opts.beamLimit ?? 64)));
  const conn = buildRouteConnectionInfo(mapObj);
  const maxRoutes = Math.max(20, Math.floor(Number(opts.maxRoutes ?? 96)));
  const routes = buildRoutePairs(zoneIds)
    .sort((a, b) => {
      const delta = conn.routePenalty(a) - conn.routePenalty(b);
      if (delta) return delta;
      return zoneTie(actor, a.join('>')) - zoneTie(actor, b.join('>'));
    })
    .slice(0, maxRoutes);
  let best = null;

  for (const route of routes) {
    const routeSet = new Set(route);
    let states = [{ reqs: new Map(), picks: [] }];
    for (const slot of EQUIP_SLOTS) {
      const optsForSlot = (candidatesBySlot.get(slot) || []);
      const next = [];
      for (const state of states) {
        for (const cand of optsForSlot) {
          const reqs = addRequirementsToState(state.reqs, cand.requirements);
          next.push({ reqs, picks: [...state.picks, { slot, item: cand.item, goal: cand.goal }] });
        }
      }
      next.sort((a, b) => {
        const sa = requirementStatsForRoute(a.reqs, routeSet);
        const sb = requirementStatsForRoute(b.reqs, routeSet);
        return (sa.missing.length - sb.missing.length)
          || (sa.missingQty - sb.missingQty)
          || (sa.totalQty - sb.totalQty);
      });
      states = next.slice(0, beamLimit);
    }

    for (const state of states) {
      const stats = requirementStatsForRoute(state.reqs, routeSet);
      const penalty = conn.routePenalty(route);
      const score = {
        feasible: stats.missing.length <= droneLimit && stats.missingQty <= droneLimit,
        missingCount: stats.missing.length,
        missingQty: stats.missingQty,
        penalty,
        totalQty: stats.totalQty,
        coveredQty: stats.coveredQty,
      };
      const row = { route, state, stats, score };
      if (!best) {
        best = row;
        continue;
      }
      const a = row.score;
      const b = best.score;
      const cmp = (a.feasible === b.feasible ? 0 : (a.feasible ? -1 : 1))
        || (a.missingCount - b.missingCount)
        || (a.missingQty - b.missingQty)
        || (a.penalty - b.penalty)
        || (b.coveredQty - a.coveredQty)
        || (a.totalQty - b.totalQty)
        || (zoneTie(actor, row.route.join('>')) - zoneTie(actor, best.route.join('>')));
      if (cmp < 0) best = row;
    }
  }

  if (!best) return empty;

  const itemIdsByZone = {};
  for (const zoneId of best.route) itemIdsByZone[String(zoneId)] = [];
  const requiredQtyById = {};
  const requiredItemIds = [];
  for (const req of best.state.reqs.values()) {
    const id = String(req.itemId || '').trim();
    if (!id) continue;
    requiredItemIds.push(id);
    requiredQtyById[id] = Math.max(1, Math.floor(Number(req.qty || 1)));
    const zones = req.zones instanceof Set ? [...req.zones] : (Array.isArray(req.zones) ? req.zones : []);
    const assigned = best.route.find((z) => zones.includes(String(z))) || '';
    if (assigned) itemIdsByZone[String(assigned)] = uniqStrings([...(itemIdsByZone[String(assigned)] || []), id]);
  }

  const missing = best.stats.missing.map((req) => ({
    itemId: String(req.itemId || ''),
    name: String(req.name || req.itemId || ''),
    qty: Math.max(1, Math.floor(Number(req.qty || 1))),
  })).filter((req) => req.itemId);

  return {
    zoneIds: best.route,
    itemIdsByZone,
    targetItemIds: best.state.picks.map((p) => normId(p.item)).filter(Boolean),
    targetItemKeys: best.state.picks.map((p) => normKey(p.item)).filter(Boolean),
    targetNamesBySlot: Object.fromEntries(best.state.picks.map((p) => [p.slot, String(p.item?.name || '')])),
    requiredItemIds: uniqStrings(requiredItemIds),
    requiredQtyById,
    droneItemIds: missing.map((m) => m.itemId),
    missing,
    complete: best.score.feasible,
    source: best.score.feasible ? 'day1_hero_2zone' : 'day1_hero_2zone_partial',
    routePenalty: best.score.penalty,
  };
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
      const regionWeights = getRegionZoneWeightsForItem(indexes.byId.get(itemId), mapObj?.zones, forbiddenIds);
      for (const [zoneId, regionWeight] of regionWeights.entries()) {
        addZoneScore(zoneId, ingredientWeight * (1.2 + Math.min(6, Number(regionWeight || 0)) / 3), itemId);
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
  buildDay1HeroRoutePlanDetails,
  buildEarlyRoutePlan,
  buildEarlyRoutePlanDetails,
  getEarlyRoutePlanTarget,
  normalizeRoutePlanZoneIds,
};
