import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';

const { createRandomIsolationInput, runRandomIsolationMatch } = await import('./lib/run-random-isolation-match.mjs');
const { GUEST_ITEM_PROFILE_KEY, readGuestItems } = await import('../src/app/simulation/_lib/guestItemProfileRuntime.js');
const { buildInitialFastRoutePlan, mergeInitialRoutePlanFields } = await import('../src/app/simulation/_lib/simulationInitialRosterRuntime.js');
const { createSimulationRunInput } = await import('../src/app/simulation/_lib/simulationReplayRuntime.js');
const { getActorGrowthProgress } = await import('../src/app/simulation/_lib/growthPlanRuntime.js');
const { getRuleset, getPhaseDurationSec } = await import('../src/utils/rulesets.js');
const { areEquipmentWeaponTypesCompatible, normalizeWeaponType } = await import('../src/utils/equipmentCatalog.js');
const { SIMULATION_ENGINE_VERSION } = await import('../src/app/simulation/_generated/simulationEngineVersion.js');

// Fresh 24-participant input, unchanged world resources and starting budgets.
// Only authored item profiles and selected actors' declared goals are changed.
const fixture = JSON.parse(await createRandomIsolationInput('custom-shared-growth-20261014'));
assert.equal(fixture.survivors.length, 24);
const originals = fixture.survivors.map(actor => ({ id: actor._id,
  credits: actor.simCredits, inventory: JSON.stringify(actor.inventory || []), weaponType: actor.weaponType }));
const rawId = 'namu:material:고철';
assert.ok(fixture.items.some(item => item._id === rawId), 'Use an existing field material, not a synthetic supply.');

const first = fixture.survivors[0];
const firstWeapon = normalizeWeaponType(first.weaponType);
assert.ok(firstWeapon, 'The five-slot participant needs a real weapon type.');
const secondIndex = fixture.survivors.findIndex((actor, index) => index > 0
  && normalizeWeaponType(actor.weaponType)
  && normalizeWeaponType(actor.weaponType) !== firstWeapon);
assert.ok(secondIndex > 0, 'The fixture must contain a second participant with a different weapon type.');
const second = fixture.survivors[secondIndex];
const secondWeapon = normalizeWeaponType(second.weaponType);

const batchId = 'guest-item-shared-growth-batch';
const slots = ['weapon', 'head', 'clothes', 'arm', 'shoes'];
const targets = new Map();
const profiles = [{ _id: batchId, name: '공유 묶음 중간재', type: '재료', tier: 2, stackMax: 10,
  recipe: { ingredients: [{ itemId: rawId, qty: 3 }], resultQty: 2, creditsCost: 1 } }];
for (const slot of slots) {
  const id = `guest-item-shared-growth-first-${slot}`;
  targets.set(`${first._id}:${slot}`, id);
  profiles.push({ _id: id, name: `첫 대원 ${slot} 목표`, type: slot === 'weapon' ? '무기' : '방어구',
    equipSlot: slot, ...(slot === 'weapon' ? { weaponType: firstWeapon } : {}), tier: 4, stackMax: 1,
    recipe: { ingredients: [{ itemId: batchId, qty: 1 }], resultQty: 1, creditsCost: 1 } });
}
const secondWeaponId = 'guest-item-shared-growth-second-weapon';
targets.set(`${second._id}:weapon`, secondWeaponId);
profiles.push({ _id: secondWeaponId, name: '둘째 대원 무기 목표', type: '무기', equipSlot: 'weapon',
  weaponType: secondWeapon, tier: 4, stackMax: 1,
  recipe: { ingredients: [{ itemId: batchId, qty: 1 }], resultQty: 1, creditsCost: 1 } });

const profileResult = readGuestItems(fixture.items, { getItem(key) {
  assert.equal(key, GUEST_ITEM_PROFILE_KEY);
  return JSON.stringify({ schemaVersion: 1, items: profiles });
} });
assert.equal(profileResult.ok, true, profileResult.error);
fixture.items.push(...profileResult.items);
assert.ok(areEquipmentWeaponTypesCompatible(first.weaponType, fixture.items.find(item => item._id === targets.get(`${first._id}:weapon`)).weaponType));
assert.ok(areEquipmentWeaponTypesCompatible(second.weaponType, fixture.items.find(item => item._id === secondWeaponId).weaponType));

function setGoals(actor, goals) {
  const goalLoadouts = { ...(actor.goalLoadouts || {}), hero: goals };
  const updated = { ...actor, goalLoadouts };
  return mergeInitialRoutePlanFields(updated, buildInitialFastRoutePlan(updated, fixture.map, fixture.items));
}

fixture.survivors[0] = setGoals(first, {
  weaponKey: targets.get(`${first._id}:weapon`), headKey: targets.get(`${first._id}:head`),
  clothesKey: targets.get(`${first._id}:clothes`), armKey: targets.get(`${first._id}:arm`),
  shoesKey: targets.get(`${first._id}:shoes`),
});
fixture.survivors[secondIndex] = setGoals(second, { weaponKey: secondWeaponId });
const firstGoalIds = slots.map(slot => targets.get(`${first._id}:${slot}`));
assert.deepEqual(firstGoalIds.filter(id => fixture.survivors[0].routePlanTargetItemIds.includes(id)).sort(), [...firstGoalIds].sort(),
  'The five distinct authored goals must remain in the actual initial route.');
assert.ok(fixture.survivors[secondIndex].routePlanTargetItemIds.includes(secondWeaponId),
  'The other compatible weapon goal must remain in its initial route.');
const secondInitialTargets = [...new Set(fixture.survivors[secondIndex].routePlanTargetItemIds.map(String))];
assert.ok(secondInitialTargets.length >= 1 && secondInitialTargets.includes(secondWeaponId),
  'The second participant keeps its authored weapon while the initial route may add natural slot targets.');
for (const actorIndex of [0, secondIndex]) {
  const actor = fixture.survivors[actorIndex];
  assert.equal(actor.simCredits, originals[actorIndex].credits);
  assert.equal(JSON.stringify(actor.inventory || []), originals[actorIndex].inventory);
  assert.ok(actor.routePlanRequiredItemIds.includes(rawId), 'Both plans must demand the same real raw leaf.');
}
assert.equal(fixture.survivors[0].simCredits, 15, 'No starting credit grant is allowed.');
assert.equal(JSON.stringify(fixture.survivors[0].inventory || []), '[]', 'No starting inventory grant is allowed.');

const savedInput = createSimulationRunInput({ activeMap: fixture.map, settings: fixture.settings,
  survivors: fixture.survivors, publicItems: fixture.items, runSeed: fixture.runSeed }, { getItem: () => null });
const savedInputBefore = JSON.stringify(savedInput);
const dayOneRules = getRuleset(savedInput.settings.rulesetId || 'ER_S11');
const deadline = getPhaseDurationSec(dayOneRules, 1, 'morning') + getPhaseDurationSec(dayOneRules, 1, 'night');
const goalActors = new Set([first._id, second._id]);
const recipeById = new Map(profileResult.items.map(item => [item._id, item.recipe]));
const crafts = new Map();
const lastProgress = new Map();
const rawPickups = new Map();
const stockRemaining = new Map();
const rawDepletions = [];
let cursor = 0;

console.log(`CUSTOM_SHARED_GROWTH_START engine=${SIMULATION_ENGINE_VERSION} participants=24 goals=5+2 `
  + `sharedLeaf=${rawId} initialCredits=${first.simCredits}/${second.simCredits} deadline=${deadline}s`);
const result = await runRandomIsolationMatch(null, { savedInput, stopAfterPhase: { day: 1, phase: 'night' },
  onFrame(frame, { events, publicItems }) {
    for (const event of events.slice(cursor)) {
      if (event.kind === 'field_resource' && event.itemId === rawId) {
        const key = `${event.zoneId}:${event.itemId}`;
        const remaining = stockRemaining.has(key) ? stockRemaining.get(key) : event.initial;
        assert.equal(event.remaining, remaining - event.qty, `real shared stock conservation at ${key}`);
        assert.ok(event.remaining >= 0);
        stockRemaining.set(key, event.remaining);
        if (event.remaining === 0) rawDepletions.push({ sec: event.at?.sec, zoneId: event.zoneId, who: event.who });
        if (goalActors.has(event.who)) rawPickups.set(event.who, (rawPickups.get(event.who) || 0) + event.qty);
      }
      const recipe = recipeById.get(event.itemId);
      if (event.kind !== 'craft' || !recipe) continue;
      assert.equal(event.receiptVersion, 1);
      assert.equal(event.qty, recipe.resultQty);
      assert.equal(event.paidCost, recipe.creditsCost);
      assert.equal(event.beforeCredits - event.afterCredits, recipe.creditsCost);
      assert.deepEqual(event.consumed, recipe.ingredients);
      const rows = crafts.get(event.who) || [];
      rows.push(event);
      crafts.set(event.who, rows);
    }
    cursor = events.length;
    for (const actor of frame.survivors) {
      if (!goalActors.has(actor._id)) continue;
      const progress = getActorGrowthProgress(actor, publicItems);
      lastProgress.set(actor._id, { sec: frame.matchSec, alive: true, completedSlots: progress.completedSlots,
        totalSlots: progress.totalSlots, openingComplete: progress.openingComplete,
        issues: progress.goalIssues, targetIds: progress.targetIds, targetId: actor._growthPlan?.targetId || '',
        blocked: actor._growthPlan?.blocked || '', equipped: { ...(actor.equipped || {}) }, credits: actor.simCredits });
    }
    for (const actor of frame.dead) if (goalActors.has(actor._id)) {
      const progress = getActorGrowthProgress(actor, publicItems);
      lastProgress.set(actor._id, { sec: frame.matchSec, alive: false, completedSlots: progress.completedSlots,
        totalSlots: progress.totalSlots, openingComplete: progress.openingComplete,
        issues: progress.goalIssues, targetIds: progress.targetIds, targetId: actor._growthPlan?.targetId || '',
        blocked: actor._growthPlan?.blocked || '', equipped: { ...(actor.equipped || {}) }, credits: actor.simCredits });
    }
  },
});

assert.equal(result.finalFrame.matchSec, deadline, 'This is a bounded first-night observation, not a full match.');
assert.equal(JSON.stringify(savedInput), savedInputBefore, 'The actual run must not mutate the saved input.');
assert.ok(result.events.some(event => event.kind === 'battle'), 'The unchanged natural roster should reach combat during the sample.');
const authoredGoals = new Map([[first._id, firstGoalIds], [second._id, [secondWeaponId]]]);
const equippedTierBySlot = (actor, slot) => {
  const equippedId = String(actor.equipped?.[slot] || '');
  const inventoryItem = (actor.inventory || []).find(entry => String(entry.itemId || entry.id || entry._id || '') === equippedId);
  const item = fixture.items.find(row => String(row._id) === equippedId);
  return { equippedId, item: item ? { ...item, ...inventoryItem } : inventoryItem };
};
const terminalGrowth = [];
for (const [actorId, declaredIds] of authoredGoals) {
  const actor = [...result.finalFrame.survivors, ...result.finalFrame.dead].find(row => row._id === actorId);
  assert.ok(actor, `The terminal frame must retain goal actor ${actorId}, alive or dead.`);
  const progress = getActorGrowthProgress(actor, fixture.items);
  assert.ok(declaredIds.every(id => progress.targetIds.includes(id)),
    `Growth reporting must preserve every authored custom target for ${actorId}.`);
  assert.equal(progress.totalSlots, progress.targetIds.length,
    `Growth slot count must include the actual route targets for ${actorId}, including permitted natural additions.`);
  assert.equal(progress.completedSlots, progress.targets.length - progress.remaining.length,
    `Reported growth completion must match the runtime's inventory-based target semantics for ${actorId}.`);
  const actualEquipped = progress.targets.filter(target => {
    const slot = target.equipSlot;
    const { equippedId, item } = equippedTierBySlot(actor, slot);
    return !!equippedId && !!item && (equippedId === String(target._id)
      || (item.equipSlot === slot && Number(item.tier || 0) > Number(target.tier || 0)
        && (slot !== 'weapon' || areEquipmentWeaponTypesCompatible(actor.weaponType, item.weaponType))));
  }).map(target => target._id);
  terminalGrowth.push({ actorId, alive: result.finalFrame.survivors.some(row => row._id === actorId),
    declaredTargetIds: declaredIds, routeTargetIds: progress.targetIds, reportedCompletedSlots: progress.completedSlots,
    reportedTotalSlots: progress.totalSlots, equipped: { ...(actor.equipped || {}) },
    actualEquippedSatisfiedIds: actualEquipped });
}
for (const actor of [fixture.survivors[0], fixture.survivors[secondIndex]]) {
  const rows = crafts.get(actor._id) || [];
  assert.equal(new Set(rows.map(event => event.actionKey)).size, rows.length, 'No authored craft receipt may execute twice.');
}
const observedStock = result.events.filter(event => event.kind === 'field_resource' && event.itemId === rawId);
assert.ok(observedStock.length > 0, 'The actual map must expose the declared shared leaf during the bounded sample.');
const summary = [first, second].map(actor => ({ id: actor._id,
  goals: actor._id === first._id ? firstGoalIds : [secondWeaponId],
  rawPickedQty: rawPickups.get(actor._id) || 0,
  customCrafts: (crafts.get(actor._id) || []).map(event => ({ itemId: event.itemId, sec: event.at.sec,
    paidCost: event.paidCost, qty: event.qty })),
  lastProgress: lastProgress.get(actor._id) || { alive: false, reason: 'not-observed-before-sample-end' },
}));
console.log(`CUSTOM_SHARED_GROWTH_OBSERVATION ${JSON.stringify({ engine: SIMULATION_ENGINE_VERSION,
  deadline, actualSec: result.finalFrame.matchSec, events: result.events.length, frames: result.evidence.frames,
  sharedLeafPickups: observedStock.length, sharedStockZones: stockRemaining.size, participants: summary,
  sharedLeafDepletions: rawDepletions,
  terminalGrowth,
  scope: 'Fresh 24-participant first-night actual-loop observation; one five-slot authored profile plus a distinct compatible weapon goal sharing one real field leaf. No completion, survival, or winner rate assertion.' })}`);
