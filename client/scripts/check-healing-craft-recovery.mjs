import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';

const status = await import('../src/utils/statusLogic.js');
const { applyActorPhaseStatusTick } = await import('../src/app/simulation/_lib/phaseActorStatusRuntime.js');
const { createPhaseCombatTacticalRuntime } = await import('../src/app/simulation/_lib/phaseCombatTacticalRuntime.js');
const { buildTeamObserverModel } = await import('../src/app/simulation/_lib/teamObserverRuntime.js');
const { buildActorGrowthPlan, refreshActorGrowthPlan, getActorGrowthProgress } = await import('../src/app/simulation/_lib/growthPlanRuntime.js');
const { getActorGrowthObservation } = await import('../src/app/simulation/_lib/growthObservationRuntime.js');
const { tryAutoCraftFromInventory } = await import('../src/app/simulation/_lib/gearInventoryCraftRuntime.js');
const { tryAutoCraftFromLoot } = await import('../src/app/simulation/_lib/craftRuntime.js');
const { buildItemIndexes, buildDay1TargetCandidatesBySlot } = await import('../src/app/simulation/_lib/routePlanBuilderRuntime.js');
const { getLootCraftOptions } = await import('../src/app/simulation/_lib/runEventRuntime.js');
const { applyLootCraftResult } = await import('../src/app/simulation/_lib/lootCraftResultRuntime.js');
const { runPhaseActorActionPipeline } = await import('../src/app/simulation/_lib/phaseActorActionPipelineRuntime.js');
const { invQty } = await import('../src/app/simulation/_lib/inventoryRules.js');
const { createFieldResources } = await import('../src/app/simulation/_lib/fieldResourceRuntime.js');
const { buildCraftableItems, buildItemMetaById, buildItemNameById } = await import('../src/app/simulation/_lib/itemOptionsRuntime.js');
const { createSeedRng } = await import('../src/app/simulation/_lib/randomSeedRuntime.js');
const { withSimulationRandom } = await import('../src/utils/simulationRandom.js');
const { getRuleset } = await import('../src/utils/rulesets.js');

const ruleset = getRuleset('ER_S11');
const slots = ['weapon', 'head', 'clothes', 'arm', 'shoes'];
const raw = (id, spawnZones = ['a']) => ({ _id: id, name: id, type: '재료', tier: 1, spawnZones });
const gear = (id, slot, ids, extra = {}) => ({ _id: id, name: id, type: slot === 'weapon' ? '무기' : '방어구',
  category: 'equipment', equipSlot: slot, weaponType: slot === 'weapon' ? '권총' : '', tier: 4,
  lockedByAdmin: true, recipe: { ingredients: ids.map(itemId => ({ itemId, qty: 1 })) }, ...extra });
const held = (item, qty = 1) => ({ ...structuredClone(item), itemId: item._id, qty });
const actor = (extra = {}) => ({ _id: 'recovery', name: '복구 시험', teamId: 'training',
  hp: 100, maxHp: 100, weaponType: '권총', zoneId: 'a', simCredits: 30, inventory: [], equipped: {}, ...extra });
const world = { mapObj: { zones: [{ zoneId: 'a' }, { zoneId: 'b' }] }, zoneGraph: { a: ['b'], b: ['a'] },
  forbiddenIds: new Set(), ruleset };
const craft = (who, items) => tryAutoCraftFromInventory(who, buildCraftableItems(items),
  buildItemNameById(items), buildItemMetaById(items), 4, 6, ruleset);
let checks = 0;
const check = (name, run) => { run(); checks++; console.log(`PASS ${name}`); };

check('regeneration displays only HP restored, including observer recovery history', () => {
  const who = actor({ hp: 98, activeEffects: [status.makeRegenEffect(10, 2, 'food-regen')] });
  const logs = [], events = [];
  const result = applyActorPhaseStatusTick({ state: { actor: who, elapsedSec: 1, startSec: 30 },
    actions: { addLog: text => logs.push(text), emitRunEvent: (kind, data, at) => events.push({ kind, ...data, at }),
      atNow: () => ({ sec: 31 }) } });
  assert.equal(result.actor.hp, 100);
  assert.equal(events[0].heal, 2);
  assert.match(logs[0], /회복 HP \+2/);
  const view = buildTeamObserverModel({ survivors: [result.actor], events, teamId: who.teamId, matchSec: 31 });
  assert.ok(view.recent.some(row => /실제 회복 HP \+2/.test(row.text)));
  logs.length = 0; events.length = 0;
  applyActorPhaseStatusTick({ state: { actor: result.actor, elapsedSec: 1 },
    actions: { addLog: text => logs.push(text), emitRunEvent: (kind, data) => events.push({ kind, ...data }) } });
  assert.equal(events.filter(event => event.kind === 'heal').length, 0);
  assert.ok(logs.every(text => !/HP \+/.test(text)));
});
check('multiple heal sources share the HP ceiling and retain heal-reduction accounting', () => {
  const who = actor({ hp: 97, activeEffects: [status.makeRegenEffect(10, 2, 'one'), status.makeRegenEffect(10, 2, 'two')] });
  const result = status.updateEffects(who, { returnMeta: true, elapsedSec: 1 });
  assert.equal(result.hpChange, 3);
  assert.equal(result.ticks.filter(tick => tick.type === 'heal').reduce((sum, tick) => sum + tick.amount, 0), 3);
  const reduced = status.updateEffects(actor({ hp: 50, activeEffects: [status.makeRegenEffect(10, 2, 'one'),
    status.makeHealReductionEffect(0.5, 2, 'wound')] }), { returnMeta: true, elapsedSec: 1 });
  assert.equal(reduced.character.hp, 55);
  assert.equal(reduced.ticks.find(tick => tick.type === 'heal').amount, 5);
});
check('simultaneous damage and regeneration preserve the existing HP result without overhealing receipts', () => {
  const result = status.updateEffects(actor({ hp: 98, activeEffects: [status.makeRegenEffect(10, 2, 'one'),
    { name: '중독', dotDamage: 4, tags: ['negative', 'dot'], remainingDuration: 2, durationUnit: 'sec' }] }),
  { returnMeta: true, elapsedSec: 1 });
  assert.equal(result.character.hp, 100);
  assert.equal(result.ticks.find(tick => tick.type === 'heal').amount, 6);
});
check('tactical self-healing records the actual capped amount instead of its nominal strength', () => {
  const who = actor({ hp: 58, maxHp: 60, tacticalSkill: '프로토콜 위반', tacticalSkillLevel: 1 });
  const events = [], logs = [];
  const runtime = createPhaseCombatTacticalRuntime({ state: { absNow: 10, ruleset },
    actions: { emitRunEvent: (kind, data) => events.push({ kind, ...data }), addLog: text => logs.push(text) } });
  runtime.applyCombatTacAttack(who, actor({ _id: 'enemy', teamId: 'other' }), 1);
  assert.equal(who.hp, 60);
  assert.equal(events.find(event => event.kind === 'skill').heal, 2);
  assert.ok(logs.some(text => /HP \+2 \(58→60\/60\)/.test(text)));
});
check('a blocked high-tier goal chooses a reachable custom basic recipe and explains it in the observer', () => {
  const items = [raw('missing', []), raw('fiber', ['b']), gear('unreachable', 'head', ['missing']),
    gear('custom-head', 'head', ['fiber'], { tier: 2 })];
  const who = actor({ routePlanTargetItemIds: ['unreachable'] }), before = JSON.stringify(who);
  const plan = buildActorGrowthPlan(who, items, world);
  assert.equal(plan.targetId, 'custom-head'); assert.equal(plan.nextStep, 'b'); assert.equal(plan.stage, 'recovery');
  assert.equal(JSON.stringify(who), before);
  refreshActorGrowthPlan(who, items, world);
  assert.match(getActorGrowthObservation(who, items).label, /기본 장비 보완/);
});
check('forbidden, depleted and insufficient field stock force a different complete recipe', () => {
  const items = [raw('remote', ['b']), raw('local'), gear('old-goal', 'head', ['remote', 'remote']), gear('custom-head', 'head', ['local'])];
  for (const reason of ['forbidden', 'depleted', 'insufficient']) {
    const fieldResources = createFieldResources(world.mapObj, items, ruleset);
    if (reason !== 'forbidden') fieldResources.byZone.b.remote.remaining = reason === 'depleted' ? 0 : 1;
    const plan = buildActorGrowthPlan(actor({ routePlanTargetItemIds: ['old-goal'] }), items,
      { ...world, fieldResources, forbiddenIds: new Set(reason === 'forbidden' ? ['b'] : []) });
    assert.equal(plan.targetId, 'custom-head'); assert.equal(plan.blocked, '');
  }
});
check('a ready custom upgrade uses independent materials while the active route retains its own inputs', () => {
  const items = [raw('head-fiber'), raw('future', ['b']), raw('metal'), gear('head-goal', 'head', ['head-fiber', 'future']),
    gear('custom-arm', 'arm', ['metal'], { tier: 3, recipe: { ingredients: [{ itemId: 'metal', qty: 1 }], creditsCost: 7 } })];
  const who = actor({ routePlanTargetItemIds: ['head-goal'], inventory: [held(items[0]), held(items[2])] });
  refreshActorGrowthPlan(who, items, world);
  const result = craft(who, items);
  assert.equal(result.craftedId, 'custom-arm'); assert.equal(who.equipped.arm, 'custom-arm');
  assert.equal(who.simCredits, 23); assert.equal(invQty(who.inventory, 'head-fiber'), 1);
});
check('automatic side crafting does not steal reserved inputs or craft an incompatible weapon', () => {
  const items = [raw('fiber'), raw('future', ['b']), gear('head-goal', 'head', ['fiber', 'future']),
    gear('side-arm', 'arm', ['fiber']), gear('wrong-weapon', 'weapon', ['fiber'], { weaponType: '활' })];
  const who = actor({ routePlanTargetItemIds: ['head-goal'], inventory: [held(items[0])] });
  refreshActorGrowthPlan(who, items, world);
  const before = JSON.stringify({ inventory: who.inventory, credits: who.simCredits });
  assert.equal(craft(who, items), null);
  assert.equal(JSON.stringify({ inventory: who.inventory, credits: who.simCredits }), before);
});
check('an unrelated high-tier loot weapon cannot prevent a real compatible weapon craft', () => {
  const fiber = raw('fiber'), wrong = gear('wrong', 'weapon', [], { tier: 6, weaponType: '활' });
  const target = gear('pistol', 'weapon', ['fiber'], { tier: 2 });
  const who = actor({ routePlanTargetItemIds: [target._id], inventory: [held(wrong), held(fiber)] });
  refreshActorGrowthPlan(who, [fiber, wrong, target], world);
  assert.equal(craft(who, [fiber, wrong, target]).craftedId, target._id);
  assert.equal(who.equipped.weapon, target._id);
});
check('a partially reachable recipe gives way to a complete local recipe before wasting a search', () => {
  const items = [raw('near'), raw('isolated', ['b']), gear('dead-end', 'head', ['near', 'isolated']), gear('local', 'head', ['near'])];
  const plan = buildActorGrowthPlan(actor({ routePlanTargetItemIds: ['dead-end'] }), items,
    { ...world, zoneGraph: { a: [], b: [] } });
  assert.equal(plan.targetId, 'local'); assert.equal(plan.stage, 'recovery');
  assert.deepEqual(plan.currentZoneItemIds, ['near']);
});
check('loot-triggered custom crafting follows the same focus, cost and real consumption rules', () => {
  const items = [raw('future', ['b']), raw('metal'), gear('head-goal', 'head', ['future']),
    gear('custom-arm', 'arm', ['metal'], { tier: 3, recipe: { ingredients: [{ itemId: 'metal', qty: 1 }], creditsCost: 7 } })];
  const who = actor({ routePlanTargetItemIds: ['head-goal'], inventory: [held(items[1])] });
  refreshActorGrowthPlan(who, items, world);
  const result = withSimulationRandom(() => 0, () => tryAutoCraftFromLoot(who.inventory, 'metal', items,
    buildItemNameById(items), buildItemMetaById(items), 4, ruleset, getLootCraftOptions(who)));
  assert.equal(result.craftedId, 'custom-arm'); assert.equal(who.simCredits, 30);
  assert.equal(applyLootCraftResult(who, result, buildItemMetaById(items)), true);
  assert.equal(who.simCredits, 23); assert.equal(who.equipped.arm, 'custom-arm'); assert.equal(invQty(who.inventory, 'metal'), 0);
});
check('an administrator item ID without a key resolves an explicitly selected hero recipe', () => {
  const items = [raw('fiber'), gear('custom-id', 'head', ['fiber'], { tier: 3 })];
  const who = actor({ goalLoadouts: { hero: { headKey: 'custom-id' } } });
  assert.equal(buildDay1TargetCandidatesBySlot(who, items, buildItemIndexes(items), world.mapObj).get('head')[0].item._id, 'custom-id');
});
check('custom late recipes can skip a tier when their real inputs are already owned', () => {
  const base = gear('base', 'head', [], { tier: 2 }), fiber = raw('fiber');
  const target = gear('custom-legend', 'head', ['base', 'fiber'], { tier: 5 });
  const who = actor({ inventory: [held(base), held(fiber)], equipped: { head: 'base' } });
  assert.equal(refreshActorGrowthPlan(who, [base, fiber, target], world).targetId, target._id);
  assert.equal(craft(who, [base, fiber, target]).craftedId, target._id);
  assert.equal(who.equipped.head, target._id);
});
check('24 stranded actors finish all five custom tier-4 slots through actual late-game actions and finite stock', () => {
  const fiber = raw('training-fiber', ['a', 'b']), unavailable = raw('training-missing', []);
  const items = [fiber, unavailable], targetIds = [];
  for (const slot of slots) {
    const old = gear(`stranded-${slot}`, slot, [unavailable._id]); items.push(old); targetIds.push(old._id);
    for (let tier = 2; tier <= 4; tier++) items.push(gear(`custom-${slot}-${tier}`, slot,
      tier === 2 ? [fiber._id] : [`custom-${slot}-${tier - 1}`, fiber._id], { tier,
        recipe: { ingredients: (tier === 2 ? [fiber._id] : [`custom-${slot}-${tier - 1}`, fiber._id])
          .map(itemId => ({ itemId, qty: 1 })), creditsCost: 1 } }));
  }
  const mapObj = { ...world.mapObj, fieldResourceStock: { a: { [fiber._id]: 200 }, b: { [fiber._id]: 200 } } };
  const nextSpawn = { fieldResources: createFieldResources(mapObj, items, ruleset) };
  const names = buildItemNameById(items), meta = buildItemMetaById(items), craftables = buildCraftableItems(items);
  let actors = Array.from({ length: 24 }, (_, index) => actor({ _id: `stranded-${index}`, simCredits: 20,
    routePlanTargetItemIds: [...targetIds] }));
  const receipts = [];
  withSimulationRandom(createSeedRng('late-custom-recovery'), () => {
    for (let cycle = 0; cycle < 80 && !actors.every(who => slots.every(slot => who.equipped?.[slot] === `custom-${slot}-4`)); cycle++) {
      actors = runPhaseActorActionPipeline({ state: { phaseSurvivors: actors, publicItems: items, craftables,
        itemMetaById: meta, itemNameById: names, mapObj, zones: mapObj.zones, zoneGraph: world.zoneGraph,
        forbiddenIds: new Set(), ruleset, nextDay: 4, nextPhase: 'morning', phaseIdxNow: 6,
        actionIntervalSec: 20, statusElapsedSec: 0, currentActionSec: () => 1000 + cycle * 20, nextSpawn },
      actions: { emitCraftRunEvent: (id, result) => receipts.push(result.receipt),
        applyLootCraftResult: (who, result) => applyLootCraftResult(who, result, meta,
          { emitCraftRunEvent: (id, crafted) => receipts.push(crafted.receipt) }) } }).updatedSurvivors;
    }
  });
  assert.equal(actors.length, 24);
  for (const who of actors) {
    assert.ok(slots.every(slot => who.equipped[slot] === `custom-${slot}-4`), `${who._id} needs all five real crafted slots`);
    assert.equal(who.simCredits, 5);
    assert.equal(getActorGrowthProgress(who, items).completedSlots, 5);
  }
  assert.equal(receipts.length, 360);
  assert.ok(receipts.every(receipt => receipt.paidCost === 1 && receipt.qty === 1));
  const taken = nextSpawn.fieldResources.byZone.a[fiber._id].taken + nextSpawn.fieldResources.byZone.b[fiber._id].taken;
  assert.equal(taken, 360 + actors.reduce((sum, who) => sum + invQty(who.inventory, fiber._id), 0));
});
console.log(`HEALING_CRAFT_RECOVERY_CHECKS ${checks}/${checks}`);
