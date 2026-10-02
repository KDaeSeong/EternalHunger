import { getCraftRecipeTerms } from './gearRecipeGuardRuntime.js';
import { getInvItemId, getInvRules, inferEquipSlot, invQty } from './inventoryRules';
import { getFieldItemSourceZones, getFieldResourceQty } from './fieldResourceRuntime';
import { bfsNextStepToAnyTarget } from './pathfindingRuntime';
import { getLateGrowthTargets } from './lateGrowthTargetRuntime.js';
import { prepareCraftTransaction } from './craftTransactionRuntime.js';
import { areEquipmentWeaponTypesCompatible } from '../../../utils/equipmentCatalog.js';
import { GROWTH_EQUIPMENT_SLOTS, getActorEquipmentTier, getGrowthEquipmentCatalog } from './growthEquipmentRuntime.js';

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
  const usableWeapon = (item) => inferEquipSlot(item) !== 'weapon'
    || areEquipmentWeaponTypesCompatible(actor.weaponType, item.weaponType);
  const fallbackFulfills = (entry, target) => {
    const slot = inferEquipSlot(target);
    return !actor.goalLoadouts?.hero?.[`${slot}Key`] && !entry.craftComponent
      && inferEquipSlot(entry) === slot && Number(entry.tier) >= Number(target.tier)
      && getInvItemId(entry) === actor._growthFallbackTargets?.[slot];
  };
  const fulfilled = (target) => usableWeapon(target) && inventory.some((entry) => invQty(inventory, getInvItemId(entry)) > 0
    && usableWeapon({ ...byId.get(getInvItemId(entry)), ...entry })
    && (getInvItemId(entry) === String(target._id)
      || fallbackFulfills(entry, target)
      || (!entry.craftComponent && inferEquipSlot(entry) === inferEquipSlot(target) && Number(entry.tier || 0) > Number(target.tier))));
  const remaining = targets.filter((target) => !fulfilled(target));
  return { targets, remaining, completedSlots: targets.length - remaining.length, totalSlots: targets.length };
}

// Shared read-only recipe accounting. Observation must not invoke the planner,
// choose a different branch, reserve inventory or change the actor's route.
export function getGrowthRecipeWork(actor, items, targetId, { ruleset, targetIds = [targetId] } = {}) {
  const byId = indexCatalog(items);
  const target = byId.get(String(targetId));
  const inventory = actor.inventory || [];
  const work = { craftIds: [], missing: [], reservedQtyById: {}, componentIds: [], readyCraftId: '', blocked: '',
    requiredCredits: 0, availableCredits: Number(actor?.simCredits ?? 0), plannedCredits: 0 };
  if (!target) return { ...work, blocked: 'invalid_recipe' };
  if (inferEquipSlot(target) === 'weapon' && !areEquipmentWeaponTypesCompatible(actor.weaponType, target.weaponType)) {
    return { ...work, blocked: 'weapon_mismatch' };
  }
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
  const affordable = materialReady.filter((id) => getCraftRecipeTerms(byId.get(id)).creditsCost <= work.availableCredits);
  work.readyCraftId = affordable[0] || '';
  // Material readiness alone can trap a full bag on the same focus forever.
  // Check the real consume-then-receive transaction; do not discard protected
  // items or grant equipment to make the plan appear viable. Non-full bags
  // keep the cheap path; the committing craft always revalidates all limits.
  if (!work.blocked && work.readyCraftId && ruleset && inventory.length >= getInvRules(ruleset).maxSlots) {
    const context = { _growthPlan: { targetIds, componentIds: work.componentIds } };
    work.readyCraftId = affordable.find((id) => prepareCraftTransaction(actor,
      markGrowthComponent(byId.get(id), context), 1, ruleset).ok) || '';
    if (!work.readyCraftId) work.blocked = 'inventory_full';
  }
  work.requiredCredits = materialReady.length ? getCraftRecipeTerms(byId.get(work.readyCraftId || materialReady[0])).creditsCost : 0;
  work.missing = [...missing].map(([id, qty]) => ({ itemId: id, name: byId.get(id)?.name || id, need: qty, have: invQty(inventory, id) }));
  if (!work.blocked && materialReady.length && !work.readyCraftId && !work.missing.length) work.blocked = 'insufficient_credits';
  return work;
}

// Recompute remaining recipe work from actual inventory. Consumed raw materials
// represented by an owned intermediate are not requested a second time.
function planGrowthTarget(actor, items, target, base, { mapObj, forbiddenIds, zoneGraph, fieldResources, ruleset, distances }, strictSources = false) {
  const byId = indexCatalog(items);
  base = { ...base, targetId: String(target._id), targetKey: target.itemKey || target.externalId || String(target._id),
    targetSlot: inferEquipSlot(target), targetTier: Number(target.tier) || 0, targetName: target.name || '',
    targetIds: [...new Set([...base.targetIds, String(target._id)])] };
  Object.assign(base, getGrowthRecipeWork(actor, items, target._id, { ruleset, targetIds: base.targetIds }));
  let hasUnsafeSource = false;
  base.missing = base.missing.map((row) => {
    const sources = getGrowthItemZones(byId.get(row.itemId), mapObj, forbiddenIds, fieldResources);
    const zones = sources.filter((id) => distances.has(id));
    if (sources.length && !zones.length) hasUnsafeSource = true;
    return { ...row, zones };
  });
  const unavailable = (row) => !row.zones.length || row.zones.reduce((sum, zoneId) =>
    sum + getFieldResourceQty(fieldResources, zoneId, row.itemId), 0) < row.need;
  if (!base.blocked && base.missing.length && (base.openingComplete && !strictSources
    ? base.missing.every(unavailable) : base.missing.some(unavailable))) base.blocked = hasUnsafeSource ? 'no_safe_path' : 'no_material_source';
  if (base.blocked) return base;
  const current = String(actor.zoneId || '');
  base.currentZoneItemIds = base.missing.filter((row) => row.zones.includes(current)).map((row) => row.itemId);
  if (base.readyCraftId || base.currentZoneItemIds.length) {
    base.targetZoneId = current;
    base.nextStep = current;
    return base;
  }
  const candidates = new Map();
  for (const row of base.missing) for (const zone of row.zones) candidates.set(zone, (candidates.get(zone) || 0) + row.need);
  const ranked = [...candidates].map(([zoneId, need]) => {
    const route = bfsNextStepToAnyTarget(current, new Set([zoneId]), zoneGraph, forbiddenIds);
    return { zoneId, need, distance: distances.get(zoneId), ...route };
  }).filter((row) => row.nextStep && row.nextStep !== current);
  ranked.sort((a, b) => (a.distance - b.distance)
    || b.need - a.need || a.zoneId.localeCompare(b.zoneId));
  if (ranked.length) { base.targetZoneId = ranked[0].zoneId; base.nextStep = ranked[0].nextStep; }
  else if (!base.blocked) base.blocked = candidates.size ? 'no_safe_path' : 'no_material_source';
  return base;
}

export function buildActorGrowthPlan(actor, items, { mapObj, forbiddenIds = new Set(), zoneGraph = {}, attemptedTargets = [], nextSpawn, fieldResources = nextSpawn?.fieldResources, ruleset = {} } = {}) {
  if (!actor || !Array.isArray(items) || !items.length) return null;
  const progress = getActorGrowthProgress(actor, items);
  const tierBySlot = Object.fromEntries(GROWTH_EQUIPMENT_SLOTS.map((slot) => [slot, getActorEquipmentTier(actor, slot)]));
  const openingComplete = progress.remaining.length === 0;
  const late = openingComplete ? getLateGrowthTargets(actor, items) : { targets: [], issues: [] };
  const remaining = openingComplete ? late.targets : [...progress.remaining].sort((a, b) =>
    tierBySlot[inferEquipSlot(a)] - tierBySlot[inferEquipSlot(b)]
    || Number(b._id === actor._growthFocusId) - Number(a._id === actor._growthFocusId));
  const base = { targetIds: openingComplete ? [] : progress.targets.map((item) => String(item._id)),
    completedSlots: progress.completedSlots, totalSlots: progress.totalSlots, openingComplete,
    stage: openingComplete ? 'late' : 'opening', goalIssues: late.issues,
    targetId: '', targetKey: '', targetSlot: '', targetTier: 0, targetName: '', craftIds: [], missing: [],
    reservedQtyById: {}, componentIds: [], readyCraftId: '', currentZoneItemIds: [],
    targetZoneId: '', nextStep: '', blocked: '' };
  const current = String(actor.zoneId || '');
  const distances = new Map([[current, 0]]), frontier = [current];
  for (let i = 0; i < frontier.length; i++) for (const next of zoneGraph[frontier[i]] || []) {
    if (forbiddenIds.has(next) || distances.has(next)) continue;
    distances.set(next, distances.get(frontier[i]) + 1); frontier.push(next);
  }
  const context = { mapObj, forbiddenIds, zoneGraph, fieldResources, ruleset, distances };
  const plans = [];
  let viable;
  const needsBasicGear = GROWTH_EQUIPMENT_SLOTS.some((slot) => tierBySlot[slot] < 4);
  for (const target of remaining) {
    if (attemptedTargets.includes(target._id)) continue;
    const plan = planGrowthTarget(actor, items, target, base, context);
    plans.push(plan);
    if (!plan.blocked) {
      if (!openingComplete || !needsBasicGear) return plan;
      viable = plan;
      break;
    }
  }
  if (!remaining.length && late.issues.length) return { ...base, blocked: 'invalid_target' };

  // A depleted/unsafe authored route must not lock all five slots for the
  // rest of a match. Fill missing basic gear with existing, obtainable recipes,
  // including administrator additions without an itemKey or a tier-4 result.
  const recovery = [];
  for (const target of getGrowthEquipmentCatalog(items)) {
    const slot = inferEquipSlot(target);
    const currentTier = tierBySlot[slot];
    if (currentTier >= 4 || Number(target.tier) <= currentTier || Number(target.tier) > 4
      || (slot === 'weapon' && !areEquipmentWeaponTypesCompatible(actor.weaponType, target.weaponType))) continue;
    const plan = planGrowthTarget(actor, items, target, { ...base, openingComplete: false, stage: 'recovery' }, context, true);
    if (!plan.blocked) recovery.push({ plan, currentTier, tier: Number(target.tier) });
  }
  recovery.sort((a, b) => a.currentTier - b.currentTier
    || Number(Boolean(b.plan.readyCraftId)) - Number(Boolean(a.plan.readyCraftId))
    || a.plan.missing.reduce((sum, row) => sum + row.need, 0) - b.plan.missing.reduce((sum, row) => sum + row.need, 0)
    || a.plan.plannedCredits - b.plan.plannedCredits || b.tier - a.tier
    || a.plan.targetId.localeCompare(b.plan.targetId));
  if (recovery.length) return recovery[0].plan;
  if (viable) return viable;
  // A late recipe's missing field source may still be supplied by a core or
  // boss. Preserve its ranked need; retain opening capacity-replanning order.
  if (plans.length) return openingComplete ? plans[0] : plans.at(-1);
  return progress.targets.length || late.issues.length ? base : null;
}

export function refreshActorGrowthPlan(actor, items, options) {
  const plan = buildActorGrowthPlan(actor, items, options);
  actor._growthPlan = plan;
  if (!plan) return null;
  actor._growthFocusId = plan.targetId;
  if (plan.stage === 'recovery') actor._growthFallbackTargets = {
    ...(actor._growthFallbackTargets || {}), [plan.targetSlot]: plan.targetId,
  };
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
