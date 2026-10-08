import { getCraftRecipeTerms } from './gearRecipeGuardRuntime.js';
import { canReceiveItem, getInvItemId, getInvRules, inferEquipSlot, inferItemCategory } from './inventoryRules';
import { getFieldItemSourceZones, getFieldResourceQty } from './fieldResourceRuntime';
import { bfsNextStepToAnyTarget } from './pathfindingRuntime';
import { getLateGrowthTargets } from './lateGrowthTargetRuntime.js';
import { prepareCraftTransaction } from './craftTransactionRuntime.js';
import { areEquipmentWeaponTypesCompatible } from '../../../utils/equipmentCatalog.js';
import { GROWTH_EQUIPMENT_SLOTS, getGrowthEquipmentCatalog } from './growthEquipmentRuntime.js';

const catalogCache = new WeakMap();
const catalogKeyCache = new WeakMap();
function indexCatalog(items) {
  if (!catalogCache.has(items)) catalogCache.set(items, new Map(items.map((item) => [String(item._id), item])));
  return catalogCache.get(items);
}

function indexCatalogKeys(items) {
  if (!catalogKeyCache.has(items)) {
    const byKey = new Map();
    for (const item of items) {
      for (const key of [item.itemKey, item.externalId, item._id]) {
        const value = String(key ?? '').trim();
        if (value && !byKey.has(value)) byKey.set(value, item);
      }
    }
    catalogKeyCache.set(items, byKey);
  }
  return catalogKeyCache.get(items);
}

function indexInventoryQuantities(inventory) {
  const quantities = new Map();
  for (const entry of inventory) {
    const id = getInvItemId(entry);
    if (!quantities.has(id)) quantities.set(id, 0);
    if (!id) continue;
    const raw = entry?.qty === undefined ? 1 : entry.qty;
    const qty = typeof raw === 'number' || (typeof raw === 'string' && raw.trim()) ? Number(raw) : NaN;
    if (Number.isSafeInteger(qty) && qty > 0) quantities.set(id, quantities.get(id) + qty);
  }
  return quantities;
}

export function getGrowthItemZones(item, mapObj, forbiddenIds = new Set(), fieldResources = null) {
  return getFieldItemSourceZones(item, mapObj)
    .filter((id) => !forbiddenIds.has(id) && getFieldResourceQty(fieldResources, id, item._id) > 0);
}

function actorEquipmentTiers(actor, inventory, inventoryQuantities) {
  const tiers = Object.fromEntries(GROWTH_EQUIPMENT_SLOTS.map((slot) => [slot, 0]));
  const worn = new Set(Object.values(actor?.equipped || {}).filter(Boolean).map(String));
  for (const entry of inventory) {
    const slot = inferEquipSlot(entry);
    if (!Object.hasOwn(tiers, slot)) continue;
    const id = getInvItemId(entry);
    if (!(inventoryQuantities.get(id) > 0)
      || (entry.craftComponent && !worn.has(id))
      || (slot === 'weapon' && !areEquipmentWeaponTypesCompatible(actor?.weaponType, entry.weaponType))) continue;
    tiers[slot] = Math.max(tiers[slot], Number(entry.tier) || 0);
  }
  return tiers;
}

// Read-only progress shared by planning and observation; never run the planner
// merely to render a card (planning also chooses destinations and reservations).
function getActorGrowthProgressWithQuantities(actor, items = [], providedInventoryQuantities = null) {
  if (!actor) return { targets: [], remaining: [], completedSlots: 0, totalSlots: 0, targetIds: [], goalIssues: [], openingComplete: true };
  items = Array.isArray(items) ? items : [];
  const byId = indexCatalog(items);
  const routeIds = [...new Set((Array.isArray(actor.routePlanTargetItemIds) ? actor.routePlanTargetItemIds : [])
    .map((id) => String(id ?? '').trim()).filter(Boolean))];
  let requested = routeIds.map((id) => ({ id, key: id, item: byId.get(id), slot: '' }));
  // The initial route builder can choose a fallback when an authored hero
  // key is missing, wrong-slot or has an unusable recipe. That route is not
  // proof that the requested loadout was fulfilled. Resolve the actual key
  // here, retaining the declaration even when no catalog item exists.
  for (const slot of GROWTH_EQUIPMENT_SLOTS) {
    const key = String(actor.goalLoadouts?.hero?.[`${slot}Key`] || '').trim();
    if (!key) continue;
    const item = indexCatalogKeys(items).get(key);
    requested = requested.filter((row) => row.slot || (row.id !== key && row.id !== String(item?._id || '')
      && (!row.item || inferEquipSlot(row.item) !== slot)));
    requested.push({ id: item ? String(item._id) : key, key, item, slot });
  }
  const goalIssues = [];
  const targets = [];
  for (const { id, key, item, slot } of requested) {
    const actualSlot = item && inferEquipSlot(item);
    const reason = !item ? 'missing_target'
      : item.lockedByAdmin === 'deleted' || id.startsWith('wpn_') || id.startsWith('eq_') ? 'unavailable_target'
      : inferItemCategory(item) !== 'equipment' || !GROWTH_EQUIPMENT_SLOTS.includes(actualSlot) ? 'not_equipment'
      : slot && actualSlot !== slot ? 'slot_mismatch'
      : actualSlot === 'weapon' && !areEquipmentWeaponTypesCompatible(actor.weaponType, item.weaponType) ? 'weapon_mismatch' : '';
    if (reason) goalIssues.push({ stage: 'opening', itemId: id, key, slot: slot || actualSlot || '', reason });
    else targets.push(item);
  }
  const inventory = actor.inventory || [];
  const inventoryQuantities = providedInventoryQuantities || indexInventoryQuantities(inventory);
  const usableWeapon = (item) => inferEquipSlot(item) !== 'weapon'
    || areEquipmentWeaponTypesCompatible(actor.weaponType, item.weaponType);
  const fallbackFulfills = (entry, target) => {
    const slot = inferEquipSlot(target);
    return !actor.goalLoadouts?.hero?.[`${slot}Key`] && !entry.craftComponent
      && inferEquipSlot(entry) === slot && Number(entry.tier) >= Number(target.tier)
      && getInvItemId(entry) === actor._growthFallbackTargets?.[slot];
  };
  const fulfilled = (target) => usableWeapon(target) && inventory.some((entry) => inventoryQuantities.get(getInvItemId(entry)) > 0
    && usableWeapon({ ...byId.get(getInvItemId(entry)), ...entry })
    && (getInvItemId(entry) === String(target._id)
      || fallbackFulfills(entry, target)
      || (!entry.craftComponent && inferEquipSlot(entry) === inferEquipSlot(target) && Number(entry.tier || 0) > Number(target.tier))));
  const remaining = targets.filter((target) => !fulfilled(target));
  return { targets, remaining, completedSlots: targets.length - remaining.length, totalSlots: requested.length,
    targetIds: [...new Set(requested.map((row) => row.id))], goalIssues,
    openingComplete: remaining.length === 0 && goalIssues.length === 0 };
}

export function getActorGrowthProgress(actor, items = []) {
  return getActorGrowthProgressWithQuantities(actor, items);
}

// Shared read-only recipe accounting. Observation must not invoke the planner,
// choose a different branch, reserve inventory or change the actor's route.
function getGrowthRecipeWorkWithQuantities(actor, items, targetId, { ruleset, targetIds = [targetId] } = {},
  providedInventoryQuantities = null) {
  const byId = indexCatalog(items);
  const target = byId.get(String(targetId));
  const inventory = actor.inventory || [];
  const work = { craftIds: [], missing: [], reservedQtyById: {}, componentIds: [], readyCraftId: '', blocked: '',
    requiredCredits: 0, availableCredits: Number(actor?.simCredits ?? 0), plannedCredits: 0 };
  if (!target) return { ...work, blocked: 'invalid_recipe' };
  if (inferEquipSlot(target) === 'weapon' && !areEquipmentWeaponTypesCompatible(actor.weaponType, target.weaponType)) {
    return { ...work, blocked: 'weapon_mismatch' };
  }
  // Terms are immutable accounting inputs within this synchronous call only.
  // A new call must re-read edited recipes; atomic receipts still revalidate.
  const recipeTermsById = new Map();
  const recipeTermsFor = (id) => {
    if (!recipeTermsById.has(id)) recipeTermsById.set(id, getCraftRecipeTerms(byId.get(id)));
    return recipeTermsById.get(id);
  };
  const inventoryQuantities = providedInventoryQuantities || indexInventoryQuantities(inventory);
  const availableOverrides = new Map();
  const availableQty = (id) => availableOverrides.has(id) ? availableOverrides.get(id) : inventoryQuantities.get(id);
  const missing = new Map();
  const components = new Set();
  const craftIds = new Set();
  const reserved = {};
  function visit(id, qty, path) {
    if (!Number.isSafeInteger(qty) || qty <= 0) { work.blocked = 'invalid_recipe'; return; }
    const item = byId.get(id);
    const have = Math.min(qty, availableQty(id) || 0);
    availableOverrides.set(id, (availableQty(id) || 0) - have);
    if (id !== target._id) { components.add(id); reserved[id] = (reserved[id] || 0) + qty; }
    const need = qty - have;
    if (need <= 0) return;
    if (!item || path.has(id) || path.size > 20) { work.blocked = 'invalid_recipe'; return; }
    if (Array.isArray(item.recipe?.ingredients) && item.recipe.ingredients.length) {
      const terms = recipeTermsFor(id);
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
      availableOverrides.set(id, (availableQty(id) || 0) + batches * terms.resultQty - need);
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
  const materialReady = work.craftIds.filter((id) => recipeTermsFor(id)?.ingredients
    .every((row) => (inventoryQuantities.get(row.itemId) || 0) >= row.qty));
  const affordable = materialReady.filter((id) => recipeTermsFor(id).creditsCost <= work.availableCredits);
  work.readyCraftId = affordable[0] || '';
  // A full bag or a partially receivable output stack can trap the focus on
  // an impossible craft. Preview the real atomic receipt without discarding
  // surplus, spending materials or granting gear. New single-item outputs in
  // non-full bags keep the cheap path; committing always revalidates limits.
  // Ruleset-free callers only account for recipes; do not guess their limits.
  if (!work.blocked && work.readyCraftId && ruleset) {
    const previewCapacity = inventory.length >= getInvRules(ruleset).maxSlots
      || affordable.some(id => recipeTermsFor(id).resultQty > 1 || inventoryQuantities.get(id) > 0);
    if (previewCapacity) {
      const context = { _growthPlan: { targetIds, componentIds: work.componentIds } };
      work.readyCraftId = affordable.find((id) => prepareCraftTransaction(actor,
        markGrowthComponent(byId.get(id), context), 1, ruleset).ok) || '';
      if (!work.readyCraftId) {
        // A missing ingredient can unlock another component that consumes the
        // crowded stack first. Keep that real farming route if it can receive
        // stock; reject only when neither crafting nor further pickup can fit.
        const canContinueFarming = [...missing.keys()].some(id => canReceiveItem(inventory,
          markGrowthComponent(byId.get(id), context), id, 1, ruleset));
        if (!canContinueFarming) work.blocked = 'inventory_full';
      }
    }
  }
  work.requiredCredits = materialReady.length ? recipeTermsFor(work.readyCraftId || materialReady[0]).creditsCost : 0;
  work.missing = [...missing].map(([id, qty]) => ({ itemId: id, name: byId.get(id)?.name || id,
    need: qty, have: inventoryQuantities.get(id) || 0 }));
  if (!work.blocked && materialReady.length && !work.readyCraftId && !work.missing.length) work.blocked = 'insufficient_credits';
  return work;
}

export function getGrowthRecipeWork(actor, items, targetId, options = {}) {
  return getGrowthRecipeWorkWithQuantities(actor, items, targetId, options);
}

// Recompute remaining recipe work from actual inventory. Consumed raw materials
// represented by an owned intermediate are not requested a second time.
function planGrowthTarget(actor, items, target, base, { mapObj, forbiddenIds, zoneGraph, fieldResources, ruleset,
  distances, sourceZones, routes, inventoryQuantities }, strictSources = false) {
  const byId = indexCatalog(items);
  base = { ...base, targetId: String(target._id), targetKey: target.itemKey || target.externalId || String(target._id),
    targetSlot: inferEquipSlot(target), targetTier: Number(target.tier) || 0, targetName: target.name || '',
    targetIds: [...new Set([...base.targetIds, String(target._id)])] };
  Object.assign(base, getGrowthRecipeWorkWithQuantities(actor, items, target._id,
    { ruleset, targetIds: base.targetIds }, inventoryQuantities));
  let hasUnsafeSource = false;
  base.missing = base.missing.map((row) => {
    const item = byId.get(row.itemId);
    if (!sourceZones.has(item)) sourceZones.set(item, getGrowthItemZones(item, mapObj, forbiddenIds, fieldResources));
    const sources = sourceZones.get(item);
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
    if (!routes.has(zoneId)) routes.set(zoneId, bfsNextStepToAnyTarget(current, new Set([zoneId]), zoneGraph, forbiddenIds));
    const route = routes.get(zoneId);
    return { zoneId, need, distance: distances.get(zoneId), ...route };
  }).filter((row) => row.nextStep && row.nextStep !== current);
  ranked.sort((a, b) => (a.distance - b.distance)
    || b.need - a.need || a.zoneId.localeCompare(b.zoneId));
  if (ranked.length) { base.targetZoneId = ranked[0].zoneId; base.nextStep = ranked[0].nextStep; }
  else if (!base.blocked) base.blocked = candidates.size ? 'no_safe_path' : 'no_material_source';
  return base;
}

export function buildActorGrowthPlan(actor, items, { mapObj, forbiddenIds = new Set(), zoneGraph = {}, attemptedTargets = [], nextSpawn, fieldResources = nextSpawn?.fieldResources, ruleset = {} } = {}) {
  if (!actor || !Array.isArray(items)) return null;
  const inventory = Array.isArray(actor.inventory) ? actor.inventory : [];
  const inventoryQuantities = indexInventoryQuantities(inventory);
  const progress = getActorGrowthProgressWithQuantities(actor, items, inventoryQuantities);
  const tierBySlot = actorEquipmentTiers(actor, inventory, inventoryQuantities);
  const openingComplete = progress.openingComplete;
  const late = openingComplete ? getLateGrowthTargets(actor, items) : { targets: [], issues: [] };
  const remaining = openingComplete ? late.targets : [...progress.remaining].sort((a, b) =>
    // Finish a viable recipe before spreading intermediates across empty
    // slots. Blocked/attempted focuses still fall through to real replanning.
    Number(String(b._id) === String(actor._growthFocusId)) - Number(String(a._id) === String(actor._growthFocusId))
    || tierBySlot[inferEquipSlot(a)] - tierBySlot[inferEquipSlot(b)]);
  const base = { targetIds: openingComplete ? [] : progress.targetIds,
    completedSlots: progress.completedSlots, totalSlots: progress.totalSlots, openingComplete,
    stage: openingComplete ? 'late' : 'opening', goalIssues: [...progress.goalIssues, ...late.issues],
    targetId: '', targetKey: '', targetSlot: '', targetTier: 0, targetName: '', craftIds: [], missing: [],
    reservedQtyById: {}, componentIds: [], readyCraftId: '', currentZoneItemIds: [],
    targetZoneId: '', nextStep: '', blocked: '' };
  const current = String(actor.zoneId || '');
  const distances = new Map([[current, 0]]), frontier = [current];
  for (let i = 0; i < frontier.length; i++) for (const next of zoneGraph[frontier[i]] || []) {
    if (forbiddenIds.has(next) || distances.has(next)) continue;
    distances.set(next, distances.get(frontier[i]) + 1); frontier.push(next);
  }
  // These reads are shared only while evaluating this actor's alternatives.
  // A later action must re-read depleted stock, changed zones and forbidden
  // paths; never attach this lookup to an actor, saved frame or global cache.
  const context = { mapObj, forbiddenIds, zoneGraph, fieldResources, ruleset, distances, inventoryQuantities,
    sourceZones: new Map(), routes: new Map() };
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
  for (const target of needsBasicGear ? getGrowthEquipmentCatalog(items) : []) {
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
  if (progress.goalIssues.length) return { ...base, blocked: 'invalid_target' };
  return progress.totalSlots || late.issues.length ? base : null;
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
