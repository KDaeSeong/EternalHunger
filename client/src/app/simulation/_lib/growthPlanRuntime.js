import { compactIO } from './simulationCommon';
import { getInvItemId, inferEquipSlot, invQty } from './inventoryRules';
import { getFieldItemSourceZones, getFieldResourceQty } from './fieldResourceRuntime';
import { bfsNextStepToAnyTarget } from './pathfindingRuntime';

const catalogCache = new WeakMap();
function indexCatalog(items) {
  if (!catalogCache.has(items)) catalogCache.set(items, new Map(items.map((item) => [String(item._id), item])));
  return catalogCache.get(items);
}

export function getGrowthItemZones(item, mapObj, forbiddenIds = new Set(), fieldResources = null) {
  return getFieldItemSourceZones(item, mapObj)
    .filter((id) => !forbiddenIds.has(id) && getFieldResourceQty(fieldResources, id, item._id) > 0);
}

// Read-only progress shared by planning and observation; never run the planner
// merely to render a card (planning also chooses destinations and reservations).
export function getActorGrowthProgress(actor, items = []) {
  if (!actor || !Array.isArray(items) || !items.length) return { targets: [], remaining: [], completedSlots: 0, totalSlots: 0 };
  const byId = indexCatalog(items);
  const targets = [...new Set(actor.routePlanTargetItemIds || [])].map((id) => byId.get(String(id))).filter(Boolean);
  const inventory = actor.inventory || [];
  const fulfilled = (target) => inventory.some((entry) => getInvItemId(entry) === String(target._id)
    || (!entry.craftComponent && inferEquipSlot(entry) === inferEquipSlot(target) && Number(entry.tier || 0) > Number(target.tier)));
  const remaining = targets.filter((target) => !fulfilled(target));
  return { targets, remaining, completedSlots: targets.length - remaining.length, totalSlots: targets.length };
}

// Recompute remaining recipe work from actual inventory. Consumed raw materials
// represented by an owned intermediate are not requested a second time.
export function buildActorGrowthPlan(actor, items, { mapObj, forbiddenIds = new Set(), zoneGraph = {}, attemptedTargets = [], nextSpawn, fieldResources = nextSpawn?.fieldResources } = {}) {
  if (!actor || !Array.isArray(items) || !items.length) return null;
  const byId = indexCatalog(items);
  const { targets, remaining } = getActorGrowthProgress(actor, items);
  if (!targets.length) return null;
  const inventory = actor.inventory || [];
  const target = remaining.find((item) => item._id === actor._growthFocusId) || remaining[0];
  const base = { targetIds: targets.map((item) => item._id), completedSlots: targets.length - remaining.length,
    totalSlots: targets.length, openingComplete: remaining.length === 0, targetId: target?._id || '',
    targetName: target?.name || '', craftIds: [], missing: [], reservedQtyById: {}, componentIds: [],
    readyCraftId: '', currentZoneItemIds: [], targetZoneId: '', nextStep: '', blocked: '' };
  if (!target) return base;
  const available = new Map(inventory.map((entry) => [getInvItemId(entry), invQty(inventory, getInvItemId(entry))]));
  const missing = new Map();
  const components = new Set();
  const craftIds = new Set();
  const reserved = {};
  function visit(id, qty, path) {
    const item = byId.get(id);
    const have = Math.min(qty, available.get(id) || 0);
    available.set(id, (available.get(id) || 0) - have);
    if (id !== target._id) { components.add(id); reserved[id] = (reserved[id] || 0) + qty; }
    const need = qty - have;
    if (need <= 0) return;
    if (!item || path.has(id) || path.size > 20) { base.blocked = 'invalid_recipe'; return; }
    const ingredients = compactIO(item.recipe?.ingredients || []);
    if (ingredients.length) {
      const nextPath = new Set(path).add(id);
      for (const row of ingredients) visit(String(row.itemId), need * row.qty, nextPath);
      craftIds.add(id);
    } else {
      missing.set(id, (missing.get(id) || 0) + need);
    }
  }
  visit(String(target._id), 1, new Set());
  base.craftIds = [...craftIds];
  base.componentIds = [...components];
  base.reservedQtyById = reserved;
  base.readyCraftId = base.craftIds.find((id) => compactIO(byId.get(id)?.recipe?.ingredients || [])
    .every((row) => invQty(inventory, row.itemId) >= row.qty)) || '';
  base.missing = [...missing].map(([id, qty]) => ({ itemId: id, name: byId.get(id)?.name || id, need: qty,
    have: invQty(inventory, id), zones: getGrowthItemZones(byId.get(id), mapObj, forbiddenIds, fieldResources) }));
  if (!base.blocked && base.missing.some((row) => !row.zones.length)) base.blocked = 'no_material_source';
  if (base.blocked) {
    const attempted = [...attemptedTargets, target._id];
    const alternative = remaining.find((row) => !attempted.includes(row._id));
    if (alternative) return buildActorGrowthPlan({ ...actor, _growthFocusId: alternative._id }, items,
      { mapObj, forbiddenIds, zoneGraph, fieldResources, attemptedTargets: attempted });
    return base;
  }
  const current = String(actor.zoneId || '');
  base.currentZoneItemIds = base.missing.filter((row) => row.zones.includes(current)).map((row) => row.itemId);
  if (base.readyCraftId || base.currentZoneItemIds.length) {
    base.targetZoneId = current;
    base.nextStep = current;
    return base;
  }
  const candidates = new Map();
  for (const row of base.missing) for (const zone of row.zones) candidates.set(zone, (candidates.get(zone) || 0) + row.need);
  const distances = new Map([[current, 0]]);
  const frontier = [current];
  for (let i = 0; i < frontier.length; i++) {
    const zone = frontier[i];
    for (const next of zoneGraph[zone] || []) {
      if (forbiddenIds.has(next) || distances.has(next)) continue;
      distances.set(next, distances.get(zone) + 1);
      frontier.push(next);
    }
  }
  const ranked = [...candidates].map(([zoneId, need]) => {
    const route = bfsNextStepToAnyTarget(current, new Set([zoneId]), zoneGraph, forbiddenIds);
    return { zoneId, need, distance: distances.get(zoneId), ...route };
  }).filter((row) => row.nextStep && row.nextStep !== current);
  ranked.sort((a, b) => (a.distance - b.distance)
    || b.need - a.need || a.zoneId.localeCompare(b.zoneId));
  if (ranked.length) { base.targetZoneId = ranked[0].zoneId; base.nextStep = ranked[0].nextStep; }
  else if (!base.blocked) base.blocked = candidates.size ? 'no_safe_path' : 'no_material_source';
  if (base.blocked) {
    const attempted = [...attemptedTargets, target._id];
    const alternative = remaining.find((row) => !attempted.includes(row._id));
    if (alternative) return buildActorGrowthPlan({ ...actor, _growthFocusId: alternative._id }, items,
      { mapObj, forbiddenIds, zoneGraph, fieldResources, attemptedTargets: attempted });
  }
  return base;
}

export function refreshActorGrowthPlan(actor, items, options) {
  const plan = buildActorGrowthPlan(actor, items, options);
  actor._growthPlan = plan;
  if (!plan) return null;
  actor._growthFocusId = plan.targetId;
  const components = new Set(plan.componentIds);
  // The old route goal marker must not permanently protect already-obsolete
  // ingredients. Only this planner's markers and generated route tags change.
  actor.inventory = (actor.inventory || []).map((entry) => {
    const needed = components.has(getInvItemId(entry));
    const tags = (entry.tags || []).filter((tag) => !['route_goal', 'growth_goal'].includes(tag));
    return { ...entry, craftComponent: needed && !!inferEquipSlot(entry),
      goalItem: needed || (!!entry.goalItem && !entry._growthReserved && !(entry.tags || []).includes('route_goal')),
      _growthReserved: needed, tags: needed ? [...tags, 'growth_goal'] : tags };
  });
  return plan;
}

export function markGrowthComponent(item, actor) {
  if (item && actor?._growthPlan?.targetIds?.includes(String(item._id || item.itemId))) return { ...item, _forceReplaceSameTier: true };
  if (!item || !actor?._growthPlan?.componentIds?.includes(String(item._id || item.itemId))) return item;
  return { ...item, craftComponent: !!inferEquipSlot(item), goalItem: true, _growthReserved: true,
    tags: [...new Set([...(item.tags || []), 'growth_goal'])] };
}
