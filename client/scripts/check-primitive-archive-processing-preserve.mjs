import assert from 'node:assert/strict';
import './lib/register-simulation-modules.mjs';

const engine = await import('../src/app/games/primitive-archive/_lib/primitiveArchiveEngine.js');
const contract = await import('../src/app/games/primitive-archive/_lib/primitiveArchiveProcessing.js');
const checkpoint = await import('../src/app/games/primitive-archive/_lib/primitiveArchiveCheckpoint.js');

const initial = engine.createNewState({ runId: 'preserve-focused', now: '2026-11-11T00:00:00.000Z', rng: () => 0.5 });
assert.ok(engine.tribeProcessingSummary(initial).options.some(row => row.id === 'preserve'),
  'Existing manual preserve must be selectable as a communal processing plan.');
assert.equal(contract.TRIBE_PROCESS_ACTION_IDS.includes('preserve'), true);
const clone = value => structuredClone(value);
const jobs = values => Object.fromEntries(engine.TRIBE_JOBS.map(job => [job.id, values[job.id] || 0]));
const cost = { meat: 2, resin: 1, berry: 1, herb: 1 };
function observed(state) { const result = clone(state); delete result.updatedAt; delete result.log; return result; }
function deterministic(run) {
  let seed = 0x12345678, implicitSeed = 0x80000000;
  const draws = [], implicitDraws = [], original = Math.random;
  const rng = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const value = seed / 2 ** 32; draws.push(value); return value; };
  Math.random = () => { implicitSeed = (Math.imul(implicitSeed, 1664525) + 1013904223) >>> 0;
    const value = implicitSeed / 2 ** 32; implicitDraws.push(value); return value; };
  try { return { state: run(rng), draws, implicitDraws }; } finally { Math.random = original; }
}
function fixture(workers = 2) {
  const state = engine.createNewState({ runId: 'preserve-focused', now: '2026-11-11T00:00:00.000Z', rng: () => 0.5 });
  state.camp = { ...state.camp, fireLevel: 1, shelterLevel: 3, workbenchLevel: 1, fuel: 20 };
  state.weather = { id: 'clear', name: '검사 맑음', cold: 0, temp: 20, actionMod: 0 };
  state.inventory = { meat: 30, resin: 30, berry: 100, herb: 30, wood: 50, fiber: 30,
    clay: 20, grain: 30, metal_ore: 20, metal_ingot: 20 };
  for (const id of ['GATHERING', 'HUNTING', 'SETTLEMENT', 'FOOD_STORAGE', 'POTTERY', 'CORDAGE',
    'BRONZE_WORKING', 'EARLY_IRONWORKING', 'WATERMILL', 'PAPERMAKING']) state.research.completed[id] = true;
  state.tribe.population = 6; state.tribe.assignments = jobs({ artisan: workers, scholar: 6 - workers });
  state.tribe.autoAssignments = jobs({});
  return state;
}
const configure = (state, targetStock = 20, actionId = 'preserve') => engine.configureTribeProcessAction(state, { actionId, targetStock });
function morning(state) {
  const before = clone(state), result = deterministic(rng => engine.advanceDay(state, { rng }));
  assert.deepEqual(state, before, 'Settlement must not mutate its input.');
  assert.equal(checkpoint.isValidRunState(result.state), true);
  return result;
}
function taught() {
  let state = fixture(1);
  for (let i = 0; i < 3; i++) state = deterministic(rng => engine.runCampAction(state, state.party[0].id, 'fuel', { rng })).state;
  assert.equal(state.founderHistory.members[0].tallies.camp, 3);
  state = deterministic(rng => engine.runSettlementDayAction(state,
    { runId: state.runId, day: state.day, ap: state.ap, updatedAt: state.updatedAt }, { rng })).state;
  state = engine.ancestralRiteAction(state, state.party[0].id, state.party[0].id);
  assert.equal(state.ancestralFaith.active.domain, 'craft');
  assert.equal(state.ancestralFaith.active.remaining, 2);
  return configure(state);
}
const reserve = state => engine.reserveProcessingTraditionAction(state, state.party[0].id);
class Storage {
  values = new Map();
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, String(value)); }
}
function roundTrip(state) {
  const storage = new Storage();
  assert.equal(checkpoint.writeCheckpoint(storage, 'guest', state, { expectedRevision: 0,
    savedAt: '2026-11-11T00:00:00.000Z' }).status, 'ready');
  const read = checkpoint.readCheckpoint(storage, 'guest'); assert.equal(read.status, 'ready');
  return engine.normalizeState(read.checkpoint.current);
}
let checks = 1;
const failures = [];
function check(name, run) {
  try { run(); checks++; console.log(`PASS ${name}`); }
  catch (error) { failures.push(name); console.error(`FAIL ${name}: ${String(error.message).slice(0, 650)}`); }
}

check('manual preservation retains its exact recipe, technology, personal costs and existing utility RNG contract', () => {
  const state = fixture(), actor = state.party[0], before = clone(state);
  const row = engine.utilityActionRows(state, actor.id).find(option => option.id === 'preserve');
  assert.equal(row.available, true); assert.equal(row.techId, 'FOOD_STORAGE');
  assert.equal(row.staminaCost, 14); assert.equal(row.hungerAdd, 2);
  const result = deterministic(rng => engine.runUtilityAction(state, actor.id, 'preserve', { rng }));
  const next = result.state;
  assert.deepEqual(result.draws, []);
  const existingUtility = deterministic(rng => engine.runUtilityAction(state, actor.id, 'paper', { rng }));
  assert.deepEqual(result.implicitDraws, existingUtility.implicitDraws);
  for (const [id, amount] of Object.entries(cost)) assert.equal(next.inventory[id], state.inventory[id] - amount);
  assert.equal(next.inventory.packed_ration, 1); assert.equal(next.ap, state.ap - 1);
  assert.equal(next.party[0].stamina, actor.stamina - 14); assert.equal(next.party[0].hunger, actor.hunger + 2);
  assert.equal(next.counters.preserve, 1); assert.ok(next.log.some(line => /식량 보존 완료/.test(line)));
  const locked = clone(state); delete locked.research.completed.FOOD_STORAGE;
  assert.equal(engine.utilityActionRows(locked, actor.id).find(option => option.id === 'preserve').available, false);
  const denied = deterministic(rng => engine.runUtilityAction(locked, actor.id, 'preserve', { rng })).state;
  assert.deepEqual(denied.inventory, locked.inventory); assert.equal(denied.ap, locked.ap);
  assert.deepEqual(state, before);
});

check('communal plan is configurable before research but requires actual settlement and storage unlocks', () => {
  const state = fixture(); delete state.research.completed.FOOD_STORAGE;
  const selected = deterministic(() => configure(state)).state;
  assert.deepEqual(selected.tribe.processingPlan, { actionId: 'preserve', targetStock: 20 });
  assert.equal(engine.tribeProcessingSummary(selected).options.find(row => row.id === 'preserve').unlocked, false);
  assert.equal(morning(selected).state.tribe.lastProduction.processing.batches, 0);
  const noSettlement = configure(fixture()); delete noSettlement.research.completed.SETTLEMENT;
  assert.equal(morning(noSettlement).state.tribe.lastProduction.processing.batches, 0);
  assert.equal(engine.tribeProcessingSummary(configure(fixture())).options.find(row => row.id === 'preserve').unlocked, true);
});

check('real artisans, target stock and material amounts independently cap one paid batch per worker', () => {
  for (const [workers, target, meat, expected] of [[0, 20, 30, 0], [1, 20, 30, 1], [3, 20, 30, 3],
    [3, 1, 30, 1], [3, 20, 3, 1]]) {
    const source = fixture(workers); source.inventory.meat = meat;
    const baseline = morning(source), next = morning(configure(source, target));
    const receipt = next.state.tribe.lastProduction.processing;
    assert.equal(receipt.workers, workers); assert.equal(receipt.batches, expected);
    assert.equal(next.state.inventory.packed_ration || 0, expected);
    for (const [id, amount] of Object.entries(cost)) assert.equal(next.state.inventory[id], baseline.state.inventory[id] - amount * expected);
    assert.deepEqual(next.draws, baseline.draws); assert.deepEqual(next.implicitDraws, baseline.implicitDraws);
    assert.deepEqual(next.state.party, baseline.state.party);
    assert.deepEqual(next.state.counters, baseline.state.counters);
    assert.deepEqual(next.state.founderHistory, baseline.state.founderHistory);
    assert.equal(contract.isValidTribeProcessingReceipt(receipt), true);
  }
});

check('feeding spends the real berries before preservation and no future ration repairs the preceding night', () => {
  const source = fixture(); source.inventory = { meat: 2, resin: 1, berry: 2, herb: 1 };
  const next = morning(configure(source)).state;
  assert.equal(next.tribe.lastProduction.foodProvided, 2);
  assert.equal(next.tribe.lastProduction.foodSpent.berry, 2);
  assert.equal(next.tribe.lastProduction.processing.batches, 0);
  assert.equal(next.inventory.packed_ration || 0, 0); assert.equal(next.inventory.meat, 2);
  const fatal = configure(fixture()); fatal.camp.fuel = 0;
  fatal.weather = { id: 'snow', name: '검사 눈', temp: -8, cold: 12, actionMod: 0 };
  fatal.party = fatal.party.map(member => ({ ...member, hp: 1, hunger: 98, bodyTemp: 30 }));
  const ended = morning(fatal).state;
  assert.equal(ended.ended, true); assert.ok(ended.party.every(member => member.hp === 0 && member.deathRecord?.source === 'night'));
  assert.equal(ended.tribe.lastProduction.processing.batches, 0);
  assert.equal(ended.inventory.packed_ration || 0, 0);
});

check('real paid craft tradition adds exactly one fully paid preservation batch after basic work', () => {
  const state = taught(), before = clone(state), selected = deterministic(() => reserve(state)).state;
  assert.equal(selected.ancestralFaith.active.remaining, 1);
  assert.deepEqual(selected.inventory, state.inventory); assert.equal(selected.ap, state.ap);
  assert.deepEqual(observed(reserve(selected)), observed(selected));
  const ordinary = morning(state), bonus = morning(selected);
  const receipt = bonus.state.tribe.lastProduction.processing;
  assert.equal(receipt.batches, 2); assert.equal(receipt.bonusBatches, 1);
  assert.deepEqual(receipt.spent, { meat: 4, resin: 2, berry: 2, herb: 2 });
  assert.deepEqual(receipt.gains, { packed_ration: 2 });
  for (const [id, amount] of Object.entries(cost)) assert.equal(bonus.state.inventory[id], ordinary.state.inventory[id] - amount);
  assert.deepEqual(bonus.draws, ordinary.draws);
  assert.deepEqual(bonus.implicitDraws, ordinary.implicitDraws);
  assert.equal(bonus.state.projectTradition.lastSettlement.bonusBatches, 1);
  assert.equal(bonus.state.projectTradition.pending, null); assert.deepEqual(state, before);
});

check('missing base work, materials or remaining target never creates free tradition food or a refund', () => {
  for (const change of [state => { state.tribe.assignments = jobs({ scholar: 6 }); },
    state => { state.inventory.herb = 0; }, state => { state.inventory.packed_ration = 20; }]) {
    const selected = reserve(taught()); change(selected);
    const next = morning(selected).state;
    assert.equal(next.tribe.lastProduction.processing.batches, 0);
    assert.equal(next.projectTradition.lastSettlement.bonusBatches, 0);
    assert.equal(next.projectTradition.lastSettlement.result, 'expired');
    assert.equal(next.projectTradition.pending, null);
    assert.equal(Object.hasOwn(next.projectTradition, 'processingRecords'), false);
  }
});

check('disabled or changed plans and a missed morning expire the prepaid use without carryover', () => {
  for (const change of [state => engine.configureTribeProcessAction(state, { actionId: '', targetStock: 0 }),
    state => configure(state, 21), state => configure(state, 20, 'weave'), state => ({ ...state, day: state.day + 1 })]) {
    const selected = reserve(taught()), changed = change(selected), next = morning(changed).state;
    assert.equal(changed.ancestralFaith.active.remaining, 1);
    assert.equal(next.projectTradition.lastSettlement.result, 'expired');
    assert.equal(next.projectTradition.lastSettlement.bonusBatches, 0);
    assert.equal(next.projectTradition.pending, null);
    assert.equal(Object.hasOwn(next.projectTradition, 'processingRecords'), false);
  }
});

check('pending and settled preserve survive JSON and actual checkpoint restoration without duplicate dawn production', () => {
  const pending = reserve(taught());
  const restored = roundTrip(JSON.parse(JSON.stringify(pending)));
  assert.deepEqual(restored.projectTradition.pending, pending.projectTradition.pending);
  const next = morning(restored).state, loaded = roundTrip(next);
  assert.deepEqual(loaded.tribe.lastProduction.processing, next.tribe.lastProduction.processing);
  assert.deepEqual(loaded.projectTradition, next.projectTradition);
  assert.deepEqual(observed(engine.normalizeState(JSON.parse(JSON.stringify(loaded)))), observed(loaded));
});

check('old six plans and absent plans retain valid receipts and a neutral economy', () => {
  for (const id of ['kiln', 'weave', 'smelt', 'forge', 'mill', 'paper']) {
    const source = fixture(1), option = engine.tribeProcessingSummary(source).options.find(row => row.id === id);
    const next = morning(configure(source, Number(source.inventory[option.outputItemId] || 0) + option.outputQuantity, id)).state;
    assert.equal(next.tribe.lastProduction.processing.batches, 1);
    assert.equal(next.tribe.lastProduction.processing.actionId, id);
    assert.deepEqual(roundTrip(next).tribe.lastProduction.processing, next.tribe.lastProduction.processing);
  }
  const disabled = fixture(), legacy = clone(disabled); delete legacy.tribe.processingPlan;
  const a = morning(disabled), b = morning(legacy);
  assert.deepEqual(a.draws, b.draws); assert.deepEqual(a.implicitDraws, b.implicitDraws);
  assert.deepEqual(observed(a.state), observed(b.state));
  assert.equal(Object.hasOwn(a.state.tribe.lastProduction, 'processing'), false);
});

console.log(JSON.stringify({ pass: failures.length === 0, checks, failures,
  scope: 'Fresh actual manual and communal processing, prepaid tradition and checkpoint contracts; no prior result fixtures or browser acceptance.' }));
if (failures.length) process.exitCode = 1;
