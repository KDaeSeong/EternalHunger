// Frozen route search from b7f827e3; independent equivalence oracle, not production code.
import { EQUIP_SLOTS } from '../../src/app/simulation/_lib/simulationConstants.js';
import { uniqStrings } from '../../src/app/simulation/_lib/mapTargeting.js';
import {
  addRequirementsToState,
  buildDay1TargetCandidatesBySlot,
  buildItemIndexes,
  buildRouteConnectionInfo,
  buildRoutePairs,
  normId,
  normKey,
  requirementStatsForRoute,
  zoneTie,
} from './legacy-route-plan-builder.mjs';

export function legacyHeroRoutePlan(actor, mapObj, publicItems, opts = {}) {
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
  const droneMaxTier = Math.max(1, Math.floor(Number(opts.droneMaxTier ?? 1)));
  const isDroneFallbackReq = (req) => Math.max(1, Number(req?.tier || 1)) <= droneMaxTier;
  const sumReqQty = (reqs) => (Array.isArray(reqs) ? reqs : [])
    .reduce((sum, req) => sum + Math.max(1, Math.floor(Number(req?.qty || 1))), 0);
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
          next.push({ reqs, picks: [...state.picks, { slot, item: cand.item, goal: cand.goal }], stats: requirementStatsForRoute(reqs, routeSet) });
        }
      }
      next.sort((a, b) => {
        const sa = a.stats;
        const sb = b.stats;
        return (sa.missing.length - sb.missing.length)
          || (sa.missingQty - sb.missingQty)
          || (sa.totalQty - sb.totalQty);
      });
      states = next.slice(0, beamLimit);
    }

    for (const state of states) {
      const stats = state.stats;
      const droneFallbackMissing = stats.missing.filter(isDroneFallbackReq);
      const droneBlockedMissing = stats.missing.length - droneFallbackMissing.length;
      const droneFallbackMissingQty = sumReqQty(droneFallbackMissing);
      const penalty = conn.routePenalty(route);
      const score = {
        feasible: droneBlockedMissing <= 0 && droneFallbackMissing.length <= droneLimit && droneFallbackMissingQty <= droneLimit,
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
    tier: Math.max(1, Number(req.tier || 1)),
  })).filter((req) => req.itemId);

  return {
    zoneIds: best.route,
    itemIdsByZone,
    targetItemIds: best.state.picks.map((p) => normId(p.item)).filter(Boolean),
    targetItemKeys: best.state.picks.map((p) => normKey(p.item)).filter(Boolean),
    targetNamesBySlot: Object.fromEntries(best.state.picks.map((p) => [p.slot, String(p.item?.name || '')])),
    requiredItemIds: uniqStrings(requiredItemIds),
    requiredQtyById,
    droneItemIds: missing.filter(isDroneFallbackReq).map((m) => m.itemId),
    missing,
    complete: best.score.feasible,
    source: best.score.feasible ? 'day1_hero_2zone' : 'day1_hero_2zone_partial',
    routePenalty: best.score.penalty,
  };
}
