import { getCraftRecipeTerms } from './gearRecipeGuardRuntime.js';
import { getInvItemId, inferEquipSlot, invQty } from './inventoryRules';
import { getFieldItemSourceZones, getFieldResourceQty } from './fieldResourceRuntime';
import { bfsNextStepToAnyTarget } from './pathfindingRuntime';
import { getLateGrowthTargets } from './lateGrowthTargetRuntime.js';

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
  const fulfilled = (target) => inventory.some((entry) => invQty(inventory, getInvItemId(entry)) > 0
    && (getInvItemId(entry) === String(target._id)
      || (!entry.craftComponent && inferEquipSlot(entry) === inferEquipSlot(target) && Number(entry.tier || 0) > Number(target.tier))));
  const remaining = targets.filter((target) => !fulfilled(target));
  return { targets, remaining, completedSlots: targets.length - remaining.length, totalSlots: targets.length };
}

// Shared read-only recipe accounting. Observation must not invoke the planner,
// choose a different branch, reserve inventory or change the actor's route.
export function getGrowthRecipeWork(actor, items, targetId) {
  const byId = indexCatalog(items);
  const target = byId.get(String(targetId));
  const inventory = actor.inventory || [];
  const work = { craftIds: [], missing: [], reservedQtyById: {}, componentIds: [], readyCraftId: '', blocked: '',
    requiredCredits: 0, availableCredits: Number(actor?.simCredits ?? 0), plannedCredits: 0 };
  if (!target) return { ...work, blocked: 'invalid_recipe' };
  const available = new Map(inventory.map((entry) => [getInvItemId(entry), invQty(inventory, getInvItemId(entry))]));
  const missing = new Map();
  const components = new Set();
  const craftIds = new Set();
  const reserved = {};
  function visit(id, qty, path) {
    if (!Number.isSafeInteger(qty) || qty <= 0) { work.blocked = 'invalid_recipe'; return; }
    const item = byId.get(id);
    const have = Math.min(qty, available.get(id) || 0);
    available.set(id, (available.get(id) || 0) - have);
    if (id !== target._id) { components.add(id); reserved[id] = (reserved[id] || 0) + qty; }
    const need = qty - have;
    if (need <= 0) return;
    if (!item || path.has(id) || path.size > 20) { work.blocked = 'invalid_recipe'; return; }
    if (Array.isArray(item.recipe?.ingredients) && item.recipe.ingredients.length) {
      const terms = getCraftRecipeTerms(item);
      if (!terms) { work.blocked = 'invalid_recipe'; return; }
      const batches = Math.ceil(need / terms.resultQty);
      const cost = batches * terms.creditsCost;
      if (!Number.isSafeInteger(batches * terms.resultQty) || !Number.isSafeInteger(work.plannedCredits + cost)) {
        work.blocked = 'invalid_recipe'; return;
      }
      const nextPath = new Set(path).add(id);
      for (const row of terms.ingredients) visit(String(row.itemId), batches * row.qty, nextPath);
      // Virtual surplus avoids farming a shared batch once for each branch.
      // Readiness below still uses actual inventory, never these future items.
      available.set(id, (available.get(id) || 0) + batches * terms.resultQty - need);
      work.plannedCredits += cost;
      craftIds.add(id);
    } else {
      missing.set(id, (missing.get(id) || 0) + need);
    }
  }
  visit(String(target._id), 1, new Set());
  work.craftIds = [...craftIds];
  work.componentIds = [...components];
  work.reservedQtyById = reserved;
  const materialReady = work.craftIds.filter((id) => getCraftRecipeTerms(byId.get(id))?.ingredients
    .every((row) => invQty(inventory, row.itemId) >= row.qty));
  work.readyCraftId = materialReady.find((id) => getCraftRecipeTerms(byId.get(id)).creditsCost <= work.availableCredits) || '';
  work.requiredCredits = materialReady.length ? getCraftRecipeTerms(byId.get(work.readyCraftId || materialReady[0])).creditsCost : 0;
  work.missing = [...missing].map(([id, qty]) => ({ itemId: id, name: byId.get(id)?.name || id, need: qty, have: invQty(inventory, id) }));
  if (!work.blocked && materialReady.length && !work.readyCraftId && !work.missing.length) work.blocked = 'insufficient_credits';
  return work;
}

// Recompute remaining recipe work from actual inventory. Consumed raw materials
// represented by an owned intermediate are not requested a second time.
export function buildActorGrowthPlan(actor, items, { mapObj, forbiddenIds = new Set(), zoneGraph = {}, attemptedTargets = [], nextSpawn, fieldResources = nextSpawn?.fieldResources } = {}) {
  if (!actor || !Array.isArray(items) || !items.length) return null;
  const byId = indexCatalog(items);
  const progress = getActorGrowthProgress(actor, items);
  const openingComplete = progress.remaining.length === 0;
  const late = openingComplete ? getLateGrowthTargets(actor, items) : { targets: [], issues: [] };
  const targets = openingComplete ? late.targets : progress.targets;
  const remaining = openingComplete ? late.targets : progress.remaining;
  if (!progress.targets.length && !targets.length && !late.issues.length) return null;
  const target = remaining.find((item) => item._id === actor._growthFocusId) || remaining[0];
  const base = { targetIds: openingComplete ? (target ? [target._id] : []) : targets.map((item) => item._id), completedSlots: progress.completedSlots,
    totalSlots: progress.totalSlots, openingComplete, stage: openingComplete ? 'late' : 'opening',
    goalIssues: late.issues, targetId: target?._id || '', targetKey: target?.itemKey || target?.externalId || '',
    targetSlot: target ? inferEquipSlot(target) : '',
    targetName: target?.name || '', craftIds: [], missing: [], reservedQtyById: {}, componentIds: [],
    readyCraftId: '', currentZoneItemIds: [], targetZoneId: '', nextStep: '', blocked: '' };
  if (!target) return { ...base, blocked: late.issues.length ? 'invalid_target' : '' };
  Object.assign(base, getGrowthRecipeWork(actor, items, target._id));
  base.missing = base.missing.map((row) => ({ ...row, zones: getGrowthItemZones(byId.get(row.itemId), mapObj, forbiddenIds, fieldResources) }));
  if (!base.blocked && base.missing.length && (openingComplete
    ? base.missing.every((row) => !row.zones.length) : base.missing.some((row) => !row.zones.length))) base.blocked = 'no_material_source';
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
  const worn = new Set(Object.values(actor.equipped || {}).filter(Boolean).map(String));
  // The old route goal marker must not permanently protect already-obsolete
  // ingredients. Only this planner's markers and generated route tags change.
  actor.inventory = (actor.inventory || []).map((entry) => {
    const needed = components.has(getInvItemId(entry));
    const tags = (entry.tags || []).filter((tag) => !['route_goal', 'growth_goal'].includes(tag));
    return { ...entry, craftComponent: needed && !!inferEquipSlot(entry) && !worn.has(getInvItemId(entry)),
      goalItem: needed || (!!entry.goalItem && !entry._growthReserved && !(entry.tags || []).includes('route_goal')),
      _growthReserved: needed, tags: needed ? [...tags, 'growth_goal'] : tags };
  });
  return plan;
}

export function getActorGrowthCraftGoal(actor, items = []) {
  const plan = actor?._growthPlan;
  const target = plan?.targetId && items.find((item) => String(item._id) === String(plan.targetId));
  // Growth displays the outstanding quantity. Procurement's existing contract
  // subtracts `have` from the total `need`; adapt without mutating the plan.
  return target ? { target, tier: Number(target.tier),
    missing: plan.missing.map(row => ({ ...row, need: row.need + row.have })) } : null;
}

export function markGrowthComponent(item, actor) {
  if (item && actor?._growthPlan?.targetIds?.includes(String(item._id || item.itemId))) return { ...item, _forceReplaceSameTier: true };
  if (!item || !actor?._growthPlan?.componentIds?.includes(String(item._id || item.itemId))) return item;
  return { ...item, craftComponent: !!inferEquipSlot(item), goalItem: true, _growthReserved: true,
    tags: [...new Set([...(item.tags || []), 'growth_goal'])] };
}
