import { assessTeamCombat } from './teamTacticsRuntime.js';
import { estimateMovePower } from './movePowerRuntime.js';
import { getFieldResourceQty } from './fieldResourceRuntime.js';

// One synchronous movement decision. Reuse the existing safe-route pressure
// contract, but search all material destinations with one finite directed BFS.
// Source stock, recipe accounting, actor state and the supplied roster stay owned
// by their callers. Neither power facts nor paths survive this call.
export function getGrowthSafeRoute({ actor, growthPlan, roster = [], zoneGraph = {},
  forbiddenIds = new Set(), fieldResources, estimatePower = estimateMovePower } = {}) {
  const current = String(actor?.zoneId || '');
  if (!current || !growthPlan?.targetId || growthPlan.blocked || growthPlan.readyCraftId) return null;
  const candidates = new Map();
  for (const row of growthPlan.missing || []) for (const value of row.zones || []) {
    const zoneId = String(value);
    if (forbiddenIds.has(zoneId) || getFieldResourceQty(fieldResources, zoneId, row.itemId) <= 0) continue;
    candidates.set(zoneId, (candidates.get(zoneId) || 0) + row.need);
  }
  // A missing source is still the growth planner's own replan/fallback case.
  // Only an existing material route can be blocked by this risk check.
  if (!candidates.size) return null;
  const power = new Map(), assessments = new Map();
  const fixedPower = row => {
    if (!power.has(row)) power.set(row, estimatePower(row));
    return power.get(row);
  };
  const assessmentAt = zoneId => {
    if (!assessments.has(zoneId)) assessments.set(zoneId,
      assessTeamCombat(actor, roster, { zoneId, estimatePower: fixedPower }));
    return assessments.get(zoneId);
  };
  const pressure = info => info.enemyPower / Math.max(1, info.allyPower);
  // Same acceptance threshold as pickTeamSafeZone; do not add a balance knob.
  const maxPressure = Math.max(1, pressure(assessmentAt(current)));
  const routes = new Map([[current, { zoneId: current, nextStep: current, distance: 0 }]]);
  const queue = [routes.get(current)], assessed = new Set([current]);
  for (let index = 0; index < queue.length; index++) {
    const route = queue[index];
    // Preserve the ordinary growth BFS's neighbor order when every edge is safe.
    for (const value of zoneGraph[route.zoneId] || []) {
      const zoneId = String(value || '');
      if (!zoneId || assessed.has(zoneId) || forbiddenIds.has(zoneId)) continue;
      assessed.add(zoneId);
      if (pressure(assessmentAt(zoneId)) > maxPressure) continue;
      const next = { zoneId, nextStep: route.distance === 0 ? zoneId : route.nextStep,
        distance: route.distance + 1 };
      routes.set(zoneId, next); queue.push(next);
    }
  }
  const ranked = [...candidates].map(([zoneId, need]) => ({ ...routes.get(zoneId), zoneId, need }))
    .filter(route => route.nextStep);
  ranked.sort((a, b) => a.distance - b.distance || b.need - a.need || a.zoneId.localeCompare(b.zoneId));
  return ranked.length
    ? { targetZoneId: ranked[0].zoneId, nextStep: ranked[0].nextStep, blocked: '' }
    : { targetZoneId: '', nextStep: current, blocked: 'no_safe_path' };
}
