import { areEquipmentWeaponTypesCompatible, normalizeWeaponType } from '../../../utils/equipmentCatalog.js';
import { getInvItemId, inferEquipSlot, inferItemCategory } from './inventoryRules.js';
import { getCraftRecipeTerms } from './gearRecipeGuardRuntime.js';
import { getActorEquipmentTier } from './growthEquipmentRuntime.js';

const slots = ['weapon', 'head', 'clothes', 'arm', 'shoes'];
const keyOf = (item) => String(item?.itemKey || item?.externalId || item?._id || '').trim();
const lockedCatalogs = new WeakMap();

// Called only after prepareSimulationRunInput has detached the catalogue
// through JSON. Never freeze an editor's array or infer ownership from identity.
// No brand or index is attached to actors, saved input, or published frames.
export function lockPreparedLateGrowthCatalog(items) {
  const pending = [items], visited = new Set();
  while (pending.length) {
    const value = pending.pop();
    if (!value || typeof value !== 'object' || visited.has(value)) continue;
    visited.add(value);
    for (const child of Object.values(value)) pending.push(child);
    Object.freeze(value);
  }
  lockedCatalogs.set(items, null);
  return items;
}

function lockedCatalogFacts(items) {
  if (!lockedCatalogs.has(items)) return null;
  if (lockedCatalogs.get(items)) return lockedCatalogs.get(items);
  const termsByItem = new Map(), byKey = new Map(), bySlotTier = new Map();
  for (let index = 0; index < items.length; index++) {
    if (!(index in items)) continue;
    const target = items[index], tier = Number(target.tier);
    if (![5, 6].includes(tier) || inferItemCategory(target) !== 'equipment') continue;
    const slot = inferEquipSlot(target);
    if (!slots.includes(slot)) continue;
    if (!termsByItem.has(target)) termsByItem.set(target, getCraftRecipeTerms(target));
    if (!termsByItem.get(target)) continue;
    const row = { target, slot, tier }, group = `${slot}:${tier}`;
    for (const key of [keyOf(target), String(target._id)]) if (!byKey.has(key)) byKey.set(key, row);
    if (!bySlotTier.has(group)) bySlotTier.set(group, []);
    bySlotTier.get(group).push(target);
  }
  const facts = { termsByItem, byKey, bySlotTier };
  lockedCatalogs.set(items, facts);
  return facts;
}

function inventoryFacts(actor, inventory) {
  const quantities = new Map();
  const entries = inventory.map((entry) => {
    const id = getInvItemId(entry);
    const raw = entry?.qty === undefined ? 1 : entry.qty;
    const qty = typeof raw === 'number' || (typeof raw === 'string' && raw.trim()) ? Number(raw) : NaN;
    if (id && Number.isSafeInteger(qty) && qty > 0) quantities.set(id, (quantities.get(id) || 0) + qty);
    return { entry, id, slot: inferEquipSlot(entry) };
  }).filter(Boolean); // Array holes, unlike explicit null entries, have no facts.
  const worn = new Set(Object.values(actor.equipped || {}).filter(Boolean).map(String));
  const tiers = Object.fromEntries(slots.map((slot) => [slot, 0]));
  for (const { entry, id, slot } of entries) {
    if (!Object.hasOwn(tiers, slot) || !(quantities.get(id) > 0)
      || (entry.craftComponent && !worn.has(id))
      || (slot === 'weapon' && !areEquipmentWeaponTypesCompatible(actor.weaponType, entry.weaponType))) continue;
    tiers[slot] = Math.max(tiers[slot], Number(entry.tier) || 0);
  }
  return { quantities, tiers };
}

function firstCatalogAlias(items, key) {
  const wanted = String(key || '').trim();
  if (!wanted) return null;
  return items.find(item => [item?._id, item?.itemKey, item?.externalId]
    .some(value => String(value ?? '').trim() === wanted)) || null;
}

function hasUnacquiredDirectTarget(actor, items, target, owned) {
  const targetId = String(target?._id || '');
  const slot = inferEquipSlot(target);
  if (!targetId || !slots.includes(slot) || owned.has(targetId)) return false;
  const compatible = slot !== 'weapon' || areEquipmentWeaponTypesCompatible(actor.weaponType, target.weaponType);
  if (!compatible) return false;
  const heroKey = String(actor.goalLoadouts?.hero?.[`${slot}Key`] || '').trim();
  if (heroKey && String(firstCatalogAlias(items, heroKey)?._id || '') === targetId
    && actor._openingAcquiredItemIds?.[slot] !== targetId) return true;
  const lateTargets = getLateGrowthTargets(actor, items, { authoredOnly: true, includeAcquired: true }).targets;
  return lateTargets.some(row => String(row._id) === targetId
    && actor._lateAcquiredItemIds?.[Number(row.tier) === 5 ? 'legend' : 'transcend']?.[slot] !== targetId);
}

// A plan chooses an existing recipe, never grants its result. Authored choices
// win over automatic upgrades; catalog order must not decide between them.
export function getLateGrowthDecision(actor, items, { authoredOnly = false, includeAcquired = false } = {},
  providedInventoryFacts = null) {
  const inventory = Array.isArray(actor.inventory) ? actor.inventory : [];
  // Inventory, goals and weapon compatibility are always a fresh decision.
  // Only the explicitly owned, deeply frozen run catalogue can reuse facts;
  // ordinary callers still re-read edited recipes on every call.
  // The planner may reuse quantities/tiers from this same synchronous call.
  // Public target reads do not accept a supplied snapshot, and a later plan
  // must rebuild it after inventory, equipment or weapon changes.
  const { quantities, tiers } = providedInventoryFacts || inventoryFacts(actor, inventory);
  // Planning's quantity index also retains invalid/zero rows with quantity 0.
  // Such an entry is not ownership and cannot fulfill an authored target.
  const owned = new Set([...quantities].filter(([, qty]) => qty > 0).map(([id]) => id));
  const weapon = normalizeWeaponType(actor.weaponType || '');
  const requestedKeys = new Set(), automaticGroups = new Set();
  for (const slot of slots) for (const [group, tier] of [['legend', 5], ['transcend', 6]]) {
    const requested = String(actor.goalLoadouts?.[group]?.[`${slot}Key`] || '').trim();
    if (requested) requestedKeys.add(requested);
    else if (!authoredOnly && tiers[slot] < tier) automaticGroups.add(`${slot}:${tier}`);
  }
  if (!requestedKeys.size && !automaticGroups.size) return { targets: [], issues: [], authoredTargets: [] };
  const preparedCatalog = lockedCatalogFacts(items);
  const { termsByItem, byKey, bySlotTier } = preparedCatalog
    || { termsByItem: new Map(), byKey: new Map(), bySlotTier: new Map() };
  const catalogLength = items.length;
  for (let index = 0; !preparedCatalog && index < catalogLength; index += 1) {
    if (!(index in items)) continue; // Preserve the original filter's sparse-array boundary.
    const target = items[index];
    const tier = Number(target.tier);
    if (![5, 6].includes(tier) || inferItemCategory(target) !== 'equipment') continue;
    const slot = inferEquipSlot(target);
    if (!slots.includes(slot)) continue;
    const keys = [keyOf(target), String(target._id)], group = `${slot}:${tier}`;
    // Only parse recipes that this decision can use. Authored keys still search
    // globally across all eligible slots/tiers, retaining first-valid collisions.
    const needsAlias = keys.some((key) => requestedKeys.has(key) && !byKey.has(key));
    if (!automaticGroups.has(group) && !needsAlias) continue;
    if (!termsByItem.has(target)) termsByItem.set(target, getCraftRecipeTerms(target));
    const terms = termsByItem.get(target);
    if (!terms) continue;
    const row = { target, slot, tier };
    // Keep the first global alias/ID match, even when it belongs to another
    // slot: silently falling through would change authored-key collision rules.
    for (const key of keys) if (requestedKeys.has(key) && !byKey.has(key)) byKey.set(key, row);
    if (automaticGroups.has(group)) {
      if (!bySlotTier.has(group)) bySlotTier.set(group, []);
      bySlotTier.get(group).push(target);
    }
  }
  const compatibleWeapon = (target, slot) => slot !== 'weapon'
    || areEquipmentWeaponTypesCompatible(weapon, target.weaponType);
  const candidates = [], issues = [];
  for (const slot of slots) {
    const currentTier = tiers[slot];
    for (const [group, tier] of [['legend', 5], ['transcend', 6]]) {
      const requested = String(actor.goalLoadouts?.[group]?.[`${slot}Key`] || '').trim();
      if (requested) {
        const row = byKey.get(requested);
        const target = row?.target;
        if (!target || row.slot !== slot || row.tier !== tier || !compatibleWeapon(target, slot)) {
          issues.push({ slot, tier, key: requested, reason: 'invalid_target' });
        } else {
          const acquired = actor._lateAcquiredItemIds?.[group]?.[slot] === String(target._id);
          if (includeAcquired || (!owned.has(String(target._id)) && !acquired)) {
            candidates.push({ target, authored: true, slot, tier });
          }
        }
      } else if (!authoredOnly && currentTier < tier) {
        for (const target of bySlotTier.get(`${slot}:${tier}`) || []) {
          if (!compatibleWeapon(target, slot) || owned.has(String(target._id))) continue;
          // Custom recipes may legitimately skip a tier. An under-equipped
          // actor only attempts such an upgrade when its real inputs are owned.
          if (currentTier >= 4 || termsByItem.get(target).ingredients
            .every((row) => (quantities.get(row.itemId) || 0) >= row.qty)) {
            candidates.push({ target, authored: false, slot, tier });
          }
        }
      }
    }
  }
  // Sorting compares the same candidates many times. Inventory cannot change
  // during this synchronous call, but its score must be rebuilt on the next
  // action after a pickup, craft, death or resource allocation.
  const ingredientScores = new Map();
  const ownedIngredients = (item) => {
    if (!ingredientScores.has(item)) ingredientScores.set(item, termsByItem.get(item).ingredients
      .reduce((sum, row) => sum + Math.min(row.qty, quantities.get(row.itemId) || 0), 0));
    return ingredientScores.get(item);
  };
  candidates.sort((a, b) => Number(b.authored) - Number(a.authored) || a.tier - b.tier
    || ownedIngredients(b.target) - ownedIngredients(a.target)
    || slots.indexOf(a.slot) - slots.indexOf(b.slot) || String(a.target._id).localeCompare(String(b.target._id)));
  return { targets: candidates.map((row) => row.target), issues,
    authoredTargets: candidates.filter((row) => row.authored).map((row) => row.target) };
}

// Both views come from this one synchronous decision. Do not persist its
// inventory scores or target choices across an acquisition or later action.
export function getLateGrowthTargets(actor, items, options = {}) {
  const { targets, issues } = getLateGrowthDecision(actor, items, options);
  return { targets, issues };
}

// Movement and earned-loot allocation read the same real recipe candidates.
// Keep the active plan first, then only valid authored later choices. Never
// turn automatic catalogue options or wrong-slot/tier keys into loot claims.
export function getActorResourceRecipeTargets(actor, items) {
  const targets = new Map();
  const current = items.find(item => String(item._id) === String(actor?._growthPlan?.targetId || ''));
  const owned = current
    ? new Set(inventoryFacts(actor, Array.isArray(actor?.inventory) ? actor.inventory : []).quantities.keys()) : new Set();
  const unacquiredDirect = current && hasUnacquiredDirectTarget(actor, items, current, owned);
  // A preceding loot receipt may already have completed a higher-tier result
  // before the next growth action refreshes the plan. Do not allocate another
  // scarce material to its obsolete lower-tier focus. The shared tier check
  // excludes unusable weapons and unworn crafting components. An unacquired
  // direct goal remains eligible even when the actor owns better gear.
  const superseded = current && inferItemCategory(current) === 'equipment' && slots.includes(inferEquipSlot(current))
    && getActorEquipmentTier(actor, inferEquipSlot(current)) > Number(current.tier || 0) && !unacquiredDirect;
  if (current && !superseded) targets.set(String(current._id), current);
  if (actor?._growthPlan?.openingComplete) {
    for (const target of getLateGrowthTargets(actor, items, { authoredOnly: true }).targets) {
      targets.set(String(target._id), target);
    }
  }
  return [...targets.values()];
}
