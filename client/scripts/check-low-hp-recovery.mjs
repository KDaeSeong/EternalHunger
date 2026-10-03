import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';

const { runActorMovementDecisionPhase } = await import('../src/app/simulation/_lib/phaseActorMovementRuntime.js');
const { runSingleActorPhaseAction } = await import('../src/app/simulation/_lib/phaseActorActionStepRuntime.js');
const { runFieldLootPhase } = await import('../src/app/simulation/_lib/phaseFieldLootRuntime.js');
const { runRouteFarmAction } = await import('../src/app/simulation/_lib/phaseRouteFarmRuntime.js');
const { runActorQueuedActionStep } = await import('../src/app/simulation/_lib/phaseActorQueuedActionStepRuntime.js');
const { applyLootCraftResult: applyCommittedLootCraftResult } = await import('../src/app/simulation/_lib/lootCraftResultRuntime.js');
const { createFieldResources } = await import('../src/app/simulation/_lib/fieldResourceRuntime.js');
const { buildCraftableItems, buildItemMetaById, buildItemNameById } = await import('../src/app/simulation/_lib/itemOptionsRuntime.js');
const { createPhaseConsumableRuntime } = await import('../src/app/simulation/_lib/consumableRuntime.js');
const { emitCraftRunEvent, emitQueueRunEvent } = await import('../src/app/simulation/_lib/runEventRuntime.js');
const { getRuleset } = await import('../src/utils/rulesets.js');
const { withSimulationRandom } = await import('../src/utils/simulationRandom.js');
const { makeRegenEffect } = await import('../src/utils/statusLogic.js');
const { buildActorRecoveryPlan, craftActorRecoveryItem } = await import('../src/app/simulation/_lib/recoveryPlanRuntime.js');
const { refreshActorGrowthPlan } = await import('../src/app/simulation/_lib/growthPlanRuntime.js');
const { describeObserverReason } = await import('../src/app/simulation/_lib/teamObserverRuntime.js');
const { publishTeamRegroupDecision } = await import('../src/app/simulation/_lib/teamRegroupRuntime.js');
const { runPvpActionLoop } = await import('../src/app/simulation/_lib/phasePvpActionLoopRuntime.js');
const { engageCombatParticipants } = await import('../src/app/simulation/_lib/combatTimingRuntime.js');
const { emitConsumableRunEvent } = await import('../src/app/simulation/_lib/runEventRuntime.js');

const ruleset = getRuleset('ER_S11');
const mapObj = { _id: 'fresh-recovery-control', zones: ['a', 'b', 'c'].map(zoneId => ({ zoneId })) };
const zoneGraph = { a: ['b'], b: ['a', 'c'], c: ['b'] };
const food = (id, spawnZones = ['b'], extra = {}) => ({ _id: id, name: id, category: 'consumable',
  type: 'food', tier: 1, spawnZones, consumeEffect: { version: 1, heal: 45 }, ...extra });
const actor = (extra = {}) => ({ _id: 'injured', name: '저체력 통제', teamId: 'one', hp: 3, maxHp: 147,
  zoneId: 'a', inventory: [], equipped: {}, simCredits: 20, activeEffects: [], ...extra });
const state = (who, items, extra = {}) => ({ actor: who, phaseSurvivors: [who], publicItems: items,
  craftables: buildCraftableItems(items), itemMetaById: buildItemMetaById(items), itemNameById: buildItemNameById(items),
  itemKeyById: {}, mapObj, zoneGraph, zones: mapObj.zones, forbiddenIds: new Set(), ruleset,
  nextDay: 2, nextPhase: 'night', phaseIdxNow: 3, statusElapsedSec: 0, currentActionSec: () => 400,
  nextSpawn: { fieldResources: createFieldResources(mapObj, items, ruleset) }, ...extra });
const run = (who, items, extra = {}) => {
  const events = [], logs = [], input = state(who, items, extra);
  const emit = (kind, payload, at) => events.push(structuredClone({ kind, ...payload, at }));
  const actions = { emitRunEvent: emit, atNow: () => ({ sec: 400, day: 2, phase: 'night' }),
    addLog: text => logs.push(text), emitCraftRunEvent: (...args) => emitCraftRunEvent(emit, ...args),
    emitQueueRunEvent: (...args) => emitQueueRunEvent(emit, ...args) };
  actions.applyLootCraftResult = (who, crafted, meta, at, zoneId) => applyCommittedLootCraftResult(who, crafted, meta,
    { at, zoneId, addLog: actions.addLog, emitCraftRunEvent: actions.emitCraftRunEvent });
  const result = withSimulationRandom(() => 0, () => runSingleActorPhaseAction({ sourceActor: who, state: input, actions }));
  return { ...result, input, events, logs };
};

let passed = 0, failed = 0;
const check = (name, fn) => {
  try { fn(); passed++; console.log(`PASS ${name}`); }
  catch (error) { failed++; console.error(`FAIL ${name}: ${error.message}`); }
};

check('a safe HP-3 actor goes to a real healing source instead of waiting forever', () => {
  const ration = food('ration'), who = actor();
  const result = withSimulationRandom(() => 0, () => runActorMovementDecisionPhase({ state: state(who, [ration]) }));
  assert.equal(result.nextZoneId, 'b');
  assert.equal(result.moveReason, 'recovery_supply');
  assert.equal(result.actor.hp, 3, 'Planning and travel cannot grant free healing.');
});
check('recovery farming takes finite stock and the ordinary consumable path restores actual HP', () => {
  const ration = food('ration', ['a']), who = actor();
  const result = run(who, [ration]);
  assert.equal(result.actor.aiCurrentAction, 'rest', 'The successful loot is now waiting for ordinary item use.');
  const stock = result.input.nextSpawn.fieldResources.byZone.a.ration;
  assert.equal(stock.taken, 1); assert.equal(stock.initial - stock.remaining, 1);
  const inventoryQty = result.actor.inventory.filter(row => row.itemId === ration._id).reduce((sum, row) => sum + row.qty, 0);
  assert.equal(inventoryQty, 1, 'Do not hoard unneeded food during one recovery step.');
  assert.equal(result.actor.hp, 3);
  const consumer = createPhaseConsumableRuntime({ phaseIdxNow: 3, consCfg: ruleset.consumables });
  assert.equal(consumer.tryUseConsumable(result.actor, 'turn_start'), true);
  assert.equal(result.actor.hp, 48); assert.equal(result.actor.inventory.length, 0);
  assert.equal(consumer.tryUseConsumable(result.actor, 'turn_start'), false);
});
check('without obtainable healing, a safe injured member can return to its teammates', () => {
  const who = actor(), ally = actor({ _id: 'ally', hp: 147, zoneId: 'b' });
  const result = withSimulationRandom(() => 0, () => runActorMovementDecisionPhase({
    state: state(who, [], { phaseSurvivors: [who, ally] }) }));
  assert.equal(result.nextZoneId, 'b'); assert.equal(result.moveReason, 'recovery_regroup');
  assert.equal(result.actor.hp, 3);
});
check('healing takes priority without deleting an unfinished equipment goal', () => {
  const fiber = { _id: 'fiber', name: 'fiber', type: '재료', tier: 1, spawnZones: ['c'] };
  const head = { _id: 'head', name: 'head', type: '방어구', equipSlot: 'head', tier: 4,
    recipe: { ingredients: [{ itemId: fiber._id, qty: 1 }] } };
  const who = actor({ routePlanTargetItemIds: ['head'] }), items = [food('ration'), fiber, head];
  const result = run(who, items);
  assert.equal(result.actor.zoneId, 'b'); assert.equal(result.actor.hp, 3);
  assert.equal(result.actor._growthPlan.targetId, 'head');
  assert.deepEqual(result.actor.routePlanTargetItemIds, ['head']);
  assert.ok(result.events.some(row => row.kind === 'move' && row.reason === 'recovery_supply'));
});
check('ordinary equipment growth resumes after paid-for food restores usable HP', () => {
  const fiber = { _id: 'fiber', name: 'fiber', type: '재료', tier: 1, spawnZones: ['c'] };
  const head = { _id: 'head', name: 'head', type: '방어구', equipSlot: 'head', tier: 4,
    recipe: { ingredients: [{ itemId: 'fiber', qty: 1 }], creditsCost: 2 } };
  const items = [food('ration'), fiber, head], first = run(actor({ routePlanTargetItemIds: ['head'] }), items);
  const consumer = createPhaseConsumableRuntime({ phaseIdxNow: 3, consCfg: ruleset.consumables });
  assert.equal(consumer.tryUseConsumable(first.actor, 'turn_start'), true);
  assert.equal(first.actor.hp, 48);
  const next = run(first.actor, items, { nextSpawn: first.input.nextSpawn });
  assert.equal(next.actor.zoneId, 'c');
  assert.ok(next.events.some(row => row.kind === 'move' && row.reason === 'growth_farm'));
  assert.ok(next.events.some(row => row.kind === 'craft' && row.itemId === 'head'));
  assert.equal(next.actor.equipped.head, 'head');
  assert.equal(next.actor.simCredits, 18);
  assert.equal(next.input.nextSpawn.fieldResources.byZone.c.fiber.taken, 1);
});
check('arrival recomputes the healing search instead of using the old equipment plan', () => {
  const fiber = { _id: 'fiber', name: 'fiber', type: '재료', tier: 1, spawnZones: ['b'] };
  const head = { _id: 'head', name: 'head', type: '방어구', equipSlot: 'head', tier: 4,
    recipe: { ingredients: [{ itemId: 'fiber', qty: 1 }] } };
  const who = actor({ routePlanTargetItemIds: ['head'] }), items = [food('ration'), fiber, head];
  const input = state(who, items);
  refreshActorGrowthPlan(who, items, input);
  const beforeTravel = buildActorRecoveryPlan(who, items, input);
  assert.deepEqual(beforeTravel.currentZoneItemIds, []);
  who.zoneId = 'b';
  const result = withSimulationRandom(() => 0, () => runFieldLootPhase({
    state: { ...input, recoveryPlan: beforeTravel, didMove: true } }));
  assert.equal(result.loot.itemId, 'ration');
  assert.equal(who.hp, 3);
  assert.equal(input.nextSpawn.fieldResources.byZone.b.ration.taken, 1);
});
check('recovery farming works with an empty equipment route list', () => {
  const ration = food('ration', ['a']), who = actor(), input = state(who, [ration]);
  const plan = buildActorRecoveryPlan(who, [ration], input);
  const result = withSimulationRandom(() => 0, () => runRouteFarmAction({
    state: { ...input, fallbackRouteItemIds: [], recoveryPlan: plan } }));
  assert.equal(result.actor.inventory[0]?.itemId, 'ration');
  assert.equal(input.nextSpawn.fieldResources.byZone.a.ration.taken, 1);
  assert.equal(result.actor.hp, 3);
});
check('recovery ingredients cannot be consumed by a competing equipment auto-craft', () => {
  const raw = { _id: 'cloth', name: 'cloth', type: '재료', tier: 1, spawnZones: ['a'] };
  const remedy = food('remedy', [], { recipe: { ingredients: [{ itemId: 'cloth', qty: 1 }], creditsCost: 7 } });
  const head = { _id: 'head', name: 'head', type: '방어구', equipSlot: 'head', tier: 4,
    recipe: { ingredients: [{ itemId: 'cloth', qty: 1 }], creditsCost: 2 } };
  const result = run(actor({ routePlanTargetItemIds: ['head'] }), [raw, remedy, head]);
  assert.equal(result.actor.inventory[0]?.itemId, 'remedy');
  assert.equal(result.actor.simCredits, 13);
  assert.ok(result.events.some(row => row.kind === 'craft' && row.itemId === 'remedy'));
  assert.ok(!result.events.some(row => row.kind === 'craft' && row.itemId === 'head'));
  assert.equal(result.actor._growthPlan.targetId, 'head');
});
check('waiting for a held dose or real regeneration does not stockpile more food', () => {
  const ration = food('ration', ['a']);
  for (const extra of [{ inventory: [{ ...ration, itemId: 'ration', qty: 1 }],
    consumableUsedPhaseIdx: 3, consumableUsedCount: 1 },
  { activeEffects: [makeRegenEffect(10, 10, 'real-food')] }]) {
    const result = run(actor(extra), [ration]);
    assert.equal(result.input.nextSpawn.fieldResources.byZone.a.ration.taken, 0);
    assert.equal(result.actor.inventory.length, extra.inventory ? 1 : 0);
  }
});
check('a late enemy or forbidden source cancels queued recovery farming against the live roster', () => {
  const ration = food('ration', ['a']);
  for (const danger of ['enemy', 'forbidden']) {
    const who = actor(), input = state(who, [ration]);
    const plan = buildActorRecoveryPlan(who, [ration], input);
    const enemy = actor({ _id: 'enemy', teamId: 'other', hp: 147 });
    if (danger === 'enemy') input.movementRoster = [who, enemy];
    else input.forbiddenIds = new Set(['a']);
    withSimulationRandom(() => 0, () => runActorQueuedActionStep({ actor: who,
      actionPlan: { queuedActionType: 'routeFarm', recoveryPlan: plan,
        fallbackRouteItemIds: ['ration'], goalMissingIds: [] }, state: input }));
    assert.equal(input.nextSpawn.fieldResources.byZone.a.ration.taken, 0, danger);
    assert.equal(who.inventory.length, 0, danger);
  }
});
check('a depleted closest source replans to the stocked source without conjuring loot', () => {
  const ration = food('ration', ['b', 'c']), who = actor(), input = state(who, [ration]);
  input.nextSpawn.fieldResources.byZone.b.ration.remaining = 0;
  const plan = buildActorRecoveryPlan(who, [ration], input);
  assert.equal(plan.targetZoneId, 'c'); assert.equal(plan.nextStep, 'b');
  input.nextSpawn.fieldResources.byZone.c.ration.remaining = 0;
  assert.equal(buildActorRecoveryPlan(who, [ration], input).mode, 'unavailable');
  assert.equal(who.inventory.length, 0); assert.equal(who.hp, 3);
});
check('enemy, forbidden and disconnected paths cannot become healing routes', () => {
  const ration = food('ration', ['c']), who = actor();
  const enemy = actor({ _id: 'enemy', teamId: 'other', zoneId: 'b', hp: 147 });
  for (const extra of [{ phaseSurvivors: [who, enemy] }, { forbiddenIds: new Set(['b']) },
    { zoneGraph: { a: [], b: ['c'], c: ['b'] } }]) {
    const plan = buildActorRecoveryPlan(who, [ration], state(who, [ration], extra));
    assert.equal(plan.mode, 'unavailable'); assert.equal(plan.nextStep, 'a');
  }
});
check('expired, malformed and non-healing effects never justify an endless heal wait', () => {
  const items = [food('zero', ['b'], { consumeEffect: { version: 1, heal: 0 } }),
    food('invalid', ['b'], { consumeEffect: { version: 1, heal: -1 } }),
    food('buff', ['b'], { consumeEffect: { version: 1, shield: 20, durationSec: 5 } })];
  const who = actor({ activeEffects: [{ ...makeRegenEffect(10, 1, 'expired'), remainingDuration: 0 }] });
  assert.equal(buildActorRecoveryPlan(who, items, state(who, items)).mode, 'unavailable');
});
check('an active regeneration effect waits for real status healing without adding extra HP', () => {
  const who = actor({ activeEffects: [makeRegenEffect(10, 10, 'real-food')] });
  const plan = buildActorRecoveryPlan(who, [], state(who, []));
  assert.equal(plan.mode, 'wait'); assert.equal(plan.reason, 'healing_effect');
  const result = run(who, [], { statusElapsedSec: 1, startSec: 399 });
  assert.equal(result.actor.hp, 13);
  assert.equal(result.events.find(row => row.kind === 'heal').heal, 10);
  assert.equal(result.events.find(row => row.kind === 'rest').reason, 'healing_effect');
});
check('held healing respects its phase use limit and is consumed after the next phase', () => {
  const ration = food('ration'), who = actor({ inventory: [{ ...ration, itemId: 'ration', qty: 2 }],
    consumableUsedPhaseIdx: 3, consumableUsedCount: 1 });
  const plan = buildActorRecoveryPlan(who, [ration], state(who, [ration]));
  assert.equal(plan.reason, 'healing_item');
  const current = createPhaseConsumableRuntime({ phaseIdxNow: 3, consCfg: ruleset.consumables });
  assert.equal(current.tryUseConsumable(who, 'turn_start'), false); assert.equal(who.hp, 3);
  assert.equal(who.inventory[0].qty, 2);
  const next = createPhaseConsumableRuntime({ phaseIdxNow: 4, consCfg: ruleset.consumables });
  assert.equal(next.tryUseConsumable(who, 'turn_start'), true); assert.equal(who.hp, 48);
  assert.equal(who.inventory[0].qty, 1);
});
check('disabled consumption or a non-usable healing threshold cannot trap an actor waiting for food', () => {
  const ration = food('ration'), who = actor({ inventory: [{ ...ration, itemId: 'ration', qty: 1 }] });
  for (const consumables of [{ enabled: false }, { maxUsesPerPhase: 0 }, { aiUseHpBelow: 1 }]) {
    const plan = buildActorRecoveryPlan(who, [ration], state(who, [ration], { ruleset: { ...ruleset,
      consumables: { ...ruleset.consumables, ...consumables } } }));
    assert.equal(plan.mode, 'unavailable');
  }
});
check('an authored recovery craft pays exact materials and credits before ordinary consumption', () => {
  const raw = { _id: 'cloth', name: 'cloth', type: '재료', tier: 1, spawnZones: [] };
  const remedy = food('remedy', [], { recipe: { ingredients: [{ itemId: 'cloth', qty: 1 }], creditsCost: 7, resultQty: 1 } });
  const who = actor({ inventory: [{ ...raw, itemId: 'cloth', qty: 1 }] });
  const result = run(who, [raw, remedy]);
  const event = result.events.find(row => row.kind === 'craft' && row.itemId === 'remedy');
  assert.ok(event, 'The safe actor must actually craft, not pretend it is recovering.');
  assert.deepEqual(event.consumed, [{ itemId: 'cloth', qty: 1 }]); assert.equal(event.paidCost, 7);
  assert.equal(event.beforeCredits - event.afterCredits, 7); assert.equal(result.actor.simCredits, 13);
  assert.equal(result.actor.hp, 3); assert.equal(result.actor.inventory[0].itemId, 'remedy');
  const consumer = createPhaseConsumableRuntime({ phaseIdxNow: 3, consCfg: ruleset.consumables });
  assert.equal(consumer.tryUseConsumable(result.actor, 'turn_start'), true); assert.equal(result.actor.hp, 48);
});
check('a multi-step recovery recipe plans from actual intermediates and rejects unaffordable work', () => {
  const raw = { _id: 'cloth', name: 'cloth', type: '재료', tier: 1, spawnZones: ['b'] };
  const middle = { _id: 'woven', name: 'woven', type: '재료', tier: 2,
    recipe: { ingredients: [{ itemId: 'cloth', qty: 2 }], resultQty: 1, creditsCost: 3 } };
  const remedy = food('remedy', [], { recipe: { ingredients: [{ itemId: 'woven', qty: 1 }], creditsCost: 4 } });
  const items = [raw, middle, remedy], who = actor();
  const plan = buildActorRecoveryPlan(who, items, state(who, items));
  assert.equal(plan.targetId, 'remedy'); assert.equal(plan.nextStep, 'b');
  assert.deepEqual(plan.missing.map(({ itemId, need }) => ({ itemId, need })), [{ itemId: 'cloth', need: 2 }]);
  assert.equal(plan.plannedCredits, 7);
  who.inventory = [{ ...middle, itemId: 'woven', qty: 1 }];
  const ready = buildActorRecoveryPlan(who, items, state(who, items));
  assert.equal(ready.readyCraftId, 'remedy'); assert.equal(ready.plannedCredits, 4); assert.equal(ready.missing.length, 0);
  who.simCredits = 3;
  assert.equal(buildActorRecoveryPlan(who, items, state(who, items)).mode, 'unavailable');
});
check('recovery crafting revalidates inventory, capacity, life, status and duplicate action payment', () => {
  const raw = { _id: 'cloth', name: 'cloth', type: '재료', tier: 1 };
  const remedy = food('remedy', [], { recipe: { ingredients: [{ itemId: 'cloth', qty: 1 }], creditsCost: 7 } });
  const items = [raw, remedy], who = actor({ inventory: [{ ...raw, itemId: 'cloth', qty: 1 }] });
  const plan = buildActorRecoveryPlan(who, items, state(who, items));
  const empty = { ...structuredClone(who), inventory: [] }, emptyBefore = JSON.stringify(empty);
  assert.equal(craftActorRecoveryItem(empty, plan, items, 2, 3, ruleset), null); assert.equal(JSON.stringify(empty), emptyBefore);
  for (const row of [{ ...structuredClone(who), hp: 0 }, { ...structuredClone(who), activeEffects: [
    { name: '기절', remainingDuration: 10, durationUnit: 'sec' }] }]) {
    const before = JSON.stringify(row);
    assert.equal(craftActorRecoveryItem(row, plan, items, 2, 3, ruleset), null); assert.equal(JSON.stringify(row), before);
  }
  assert.ok(craftActorRecoveryItem(who, plan, items, 2, 3, ruleset));
  const crafted = JSON.stringify(who);
  assert.equal(craftActorRecoveryItem(who, plan, items, 2, 3, ruleset), null); assert.equal(JSON.stringify(who), crafted);
});
check('an oversized recovery output cannot discard excess, spend materials or fake healing', () => {
  const raw = { _id: 'cloth', name: 'cloth', type: '재료', tier: 1 };
  const remedy = food('remedy', [], { recipe: { ingredients: [{ itemId: 'cloth', qty: 1 }], resultQty: 7, creditsCost: 7 } });
  const who = actor({ inventory: [{ ...raw, itemId: 'cloth', qty: 1 }] });
  const limited = { ...ruleset, inventory: { ...ruleset.inventory, maxSlots: 1, autoDropLowValue: false } };
  const items = [raw, remedy], input = state(who, items, { ruleset: limited });
  const before = JSON.stringify(who);
  assert.equal(buildActorRecoveryPlan(who, items, input).mode, 'unavailable');
  assert.equal(craftActorRecoveryItem(who, { readyCraftId: 'remedy' }, items, 2, 3, limited), null);
  assert.equal(JSON.stringify(who), before);
});
check('planning is read-only, serializable and makes no random or network calls', () => {
  const who = actor(), items = [food('ration')], input = state(who, items);
  refreshActorGrowthPlan(who, items, input);
  const before = JSON.stringify({ who, items, spawn: input.nextSpawn }), oldRandom = Math.random;
  Math.random = () => { throw Error('The recovery planner cannot draw random values.'); };
  try {
    const plan = buildActorRecoveryPlan(who, items, input);
    assert.deepEqual(JSON.parse(JSON.stringify(plan)), plan);
    assert.equal(JSON.stringify({ who, items, spawn: input.nextSpawn }), before);
  } finally { Math.random = oldRandom; }
});
check('the observer gives specific recovery supply, effect, item and regroup reasons', () => {
  for (const [reason, text] of [['recovery_supply', /회복 음식·재료/], ['healing_effect', /회복 효과/],
    ['healing_item', /사용 가능 시간/], ['healing_unavailable', /회복 물자가 없어/], ['recovery_regroup', /동료에게 합류/]]) {
    assert.match(describeObserverReason({ reason }), text);
  }
});
check('specific recovery reasons keep the team recovery override instead of a false join replan', () => {
  const planned = { teamId: 'one', memberCount: 3, targetZoneId: 'c', atTargetCount: 2, distance: 2, stage: 'joining' };
  for (const reason of ['recovery_supply', 'recovery_craft', 'recovery_regroup', 'healing_unavailable']) {
    const who = actor();
    publishTeamRegroupDecision(who, planned, { from: 'a', to: 'b', reason });
    assert.equal(who._teamRegroup.status, 'recovery');
    assert.equal(who._teamRegroup.hp, 3);
  }
});

// Actual world action loop, not a manual call to the consumption helper. Both
// opponents have an established fight but are still action-locked throughout.
async function runLockedRecovery(extra = {}, consumables = ruleset.consumables) {
  const ration = food('ration', []);
  const who = actor({ inventory: [{ ...ration, itemId: ration._id, qty: 2 }],
    _actionReadyAtSec: 201, tacticalSkill: 'none', _tacNextAbsSec: 1e9,
    stats: { maxHp: 147, attackPower: 1, defense: 0, attackSpeed: 1 }, ...extra });
  const enemy = actor({ _id: 'enemy', teamId: 'two', hp: 147, _actionReadyAtSec: 201,
    tacticalSkill: 'none', _tacNextAbsSec: 1e9, stats: who.stats });
  const events = [], emit = (kind, payload, at) => events.push({ kind, ...payload, at });
  let offset = 0, pending;
  withSimulationRandom(() => 0.5, () => {
    engageCombatParticipants(who, enemy, [who, enemy], 100);
    pending = runPvpActionLoop({ state: { updatedSurvivors: [who, enemy], phaseSurvivors: [who, enemy],
      phaseDurationSec: 5, nextDay: 1, nextPhase: 'morning', phaseIdxNow: 3,
      ruleset: { ...ruleset, consumables }, currentActionSec: () => 100 + offset,
      getPhaseRuntimeOffsetSec: () => offset }, actions: {
      reserveActionSecond: seconds => { offset = Math.min(5, offset + seconds); },
      atNow: () => ({ sec: 100 + offset, day: 1, phase: 'morning' }),
      emitRunEvent: emit, emitConsumableRunEvent: (...args) => emitConsumableRunEvent(emit, ...args),
    } });
  });
  const result = await pending;
  assert.equal(events.filter(event => event.kind === 'damage').length, 0, 'Food cannot unlock an attack.');
  assert.equal(result.survivorMap.get(who._id)._actionReadyAtSec, 201);
  return { who: result.survivorMap.get(who._id), events };
}
async function checkAsync(name, runCheck) {
  try { await runCheck(); passed++; console.log(`PASS ${name}`); }
  catch (error) { failed++; console.error(`FAIL ${name}: ${error.message}`); }
}
await checkAsync('the real world loop consumes food during a growth lock without unlocking combat or a second dose', async () => {
  const result = await runLockedRecovery();
  assert.equal(result.who.hp, 48); assert.equal(result.who.inventory[0].qty, 1);
  const uses = result.events.filter(event => event.kind === 'use');
  assert.equal(uses.length, 1); assert.equal(uses[0].heal, 45);
});
await checkAsync('a growth-locked stunned actor cannot consume food', async () => {
  const result = await runLockedRecovery({ activeEffects: [{ name: '기절', remainingDuration: 10 }] });
  assert.equal(result.who.hp, 3); assert.equal(result.who.inventory[0].qty, 2);
  assert.equal(result.events.filter(event => event.kind === 'use').length, 0);
});
await checkAsync('a growth lock cannot bypass disabled automatic consumption', async () => {
  const result = await runLockedRecovery({}, { ...ruleset.consumables, enabled: false });
  assert.equal(result.who.hp, 3); assert.equal(result.who.inventory[0].qty, 2);
});
await checkAsync('a growth lock cannot bypass an already exhausted phase consumption budget', async () => {
  const result = await runLockedRecovery({ consumableUsedPhaseIdx: 3, consumableUsedCount: 1 });
  assert.equal(result.who.hp, 3); assert.equal(result.who.inventory[0].qty, 2);
});

console.log(`LOW_HP_RECOVERY_CHECKS ${passed}/${passed + failed}`);
if (failed) process.exitCode = 1;
