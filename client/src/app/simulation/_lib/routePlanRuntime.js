import { EQUIP_SLOTS } from './simulationConstants';
import { pickGoalLoadoutKeys } from './craftRuntime';
import { findCrateZoneWeightsForItem, uniqStrings } from './mapTargeting';
import { getRegionZoneWeightsForItem } from './lumiaRegionData';
import {
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
} from './routePlanBuilderRuntime';

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
