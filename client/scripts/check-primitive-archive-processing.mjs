import assert from 'node:assert/strict';
import './lib/register-simulation-modules.mjs';

const engine = await import('../src/app/games/primitive-archive/_lib/primitiveArchiveEngine.js');
const contract = await import('../src/app/games/primitive-archive/_lib/primitiveArchiveProcessing.js');
const checkpoint = await import('../src/app/games/primitive-archive/_lib/primitiveArchiveCheckpoint.js');
const clone = value => structuredClone(value);
const jobs = values => Object.fromEntries(engine.TRIBE_JOBS.map(job => [job.id, values[job.id] || 0]));
const observable = state => { const result = clone(state); delete result.updatedAt; delete result.log; return result; };
function reproducible(run) {
  let seed = 0x12345678, implicitSeed = 0x80000000;
  const draws = [], implicitDraws = [];
  const next = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; const value = seed / 2 ** 32; draws.push(value); return value; };
  const original = Math.random;
  Math.random = () => { implicitSeed = (Math.imul(implicitSeed, 1664525) + 1013904223) >>> 0;
    const value = implicitSeed / 2 ** 32; implicitDraws.push(value); return value; };
  try { return { state: run(next), draws, implicitDraws }; }
  finally { Math.random = original; }
}
function fixture(assignments = { forager: 2, builder: 2, scholar: 2 }) {
  const state = reproducible(rng => engine.createNewState({ runId: 'processing-check',
    now: '2026-11-05T00:00:00.000Z', rng })).state;
  state.camp = { ...state.camp, fireLevel: 1, shelterLevel: 3, workbenchLevel: 1, fuel: 20 };
  state.weather = { id: 'clear', name: '검사 맑음', cold: 0, temp: 20, actionMod: 0 };
  state.inventory = { berry: 100, wood: 30, fiber: 30, clay: 10, grain: 30, metal_ore: 20, metal_ingot: 20 };
  for (const id of ['GATHERING', 'HUNTING', 'SETTLEMENT', 'FOOD_STORAGE', 'POTTERY', 'CORDAGE',
    'BRONZE_WORKING', 'EARLY_IRONWORKING', 'WATERMILL', 'PAPERMAKING']) state.research.completed[id] = true;
  state.research.selectedTechId = 'STONE_TOOLS';
  state.tribe.population = 6; state.tribe.assignments = jobs(assignments); state.tribe.autoAssignments = jobs({});
  return state;
}
const configure = (state, actionId, targetStock) => engine.configureTribeProcessAction(state, { actionId, targetStock });
function morning(state) {
  const before = clone(state);
  const result = reproducible(rng => engine.advanceDay(state, { rng }));
  assert.deepEqual(state, before, 'Morning processing must not mutate any input state or receipt.');
  if (result.state.tribe.lastProduction.processing) {
    assert.equal(contract.isValidTribeProcessingReceipt(result.state.tribe.lastProduction.processing), true);
  }
  return result;
}
let checks = 0;
const failures = [];
function check(name, run) {
  try { run(); checks++; console.log(`PASS ${name}`); }
  catch (error) { failures.push({ name, error: String(error.message).slice(0, 800) }); console.error(`FAIL ${name}: ${String(error.message).slice(0, 800)}`); }
}

check('plan configuration and current-stock preview have no economy, assignment, RNG or personal credit effects', () => {
  const state = fixture(); state.ap = 0;
  const before = clone(state);
  const original = Math.random;
  Math.random = () => { throw new Error('Configuration or preview drew randomness'); };
  try {
    const selected = configure(state, 'kiln', 3);
    const expected = observable(before); expected.tribe.processingPlan = { actionId: 'kiln', targetStock: 3 };
    assert.deepEqual(observable(selected), expected);
    const summary = engine.tribeProcessingSummary(selected);
    assert.equal(summary.workers, 0); assert.equal(summary.currentStock, 0);
    assert.equal(summary.expectedBatches, 0); assert.equal(summary.canConfigure, true);
    assert.deepEqual(summary.options.map(row => row.id).sort(), [...contract.TRIBE_PROCESS_ACTION_IDS].sort());
    assert.match(summary.timingText, /현재 재고/);
    assert.deepEqual(state, before);
    for (const invalid of [null, undefined, {}, { actionId: 'missing', targetStock: 3 },
      { actionId: 'kiln', targetStock: 0 }, { actionId: 'kiln', targetStock: 1.5 },
      { actionId: '', targetStock: 1 }]) assert.equal(engine.configureTribeProcessAction(selected, invalid), selected);
    assert.equal(configure(selected, 'kiln', 3), selected);
    const ended = { ...selected, ended: true };
    assert.equal(configure(ended, 'weave', 3), ended);
  } finally { Math.random = original; }
  const selected = configure(state, 'kiln', 3);
  assert.deepEqual(reproducible(() => engine.tribeSummary(selected)).state.processing, engine.tribeProcessingSummary(selected));
});

check('all community processes reuse the actual manual process inputs, outputs and real technology gates', () => {
  for (const actionId of contract.TRIBE_PROCESS_ACTION_IDS) {
    const source = fixture({ forager: 4, artisan: 2 });
    const option = engine.tribeProcessingSummary(source).options.find(row => row.id === actionId);
    assert.ok(option.unlocked);
    const stock = Number(source.inventory[option.outputItemId] || 0);
    const plan = configure(source, actionId, stock + option.outputQuantity);
    const baseline = morning(source).state;
    const next = morning(plan).state;
    const manual = reproducible(rng => engine.runUtilityAction(clone(source), source.party[0].id, actionId, { rng })).state;
    const receipt = next.tribe.lastProduction.processing;
    assert.equal(receipt.batches, 1);
    assert.equal(receipt.stockAfter - receipt.stockBefore, option.outputQuantity);
    for (const id of new Set([...Object.keys(source.inventory), ...Object.keys(manual.inventory)])) {
      const manualDelta = Number(manual.inventory[id] || 0) - Number(source.inventory[id] || 0);
      const communityDelta = Number(next.inventory[id] || 0) - Number(baseline.inventory[id] || 0);
      assert.equal(communityDelta, manualDelta, `${actionId}/${id} must use the actual manual recipe.`);
    }
    assert.deepEqual(next.party, baseline.party);
    for (const field of ['counters', 'founderHistory', 'ancestralFaith', 'projectTradition', 'research', 'civics', 'meta']) {
      assert.deepEqual(next[field], baseline[field], `${actionId} must not create personal actions or credits.`);
    }
    assert.equal(next.ap, baseline.ap);
    assert.deepEqual(next.tribe.lastProduction.gains, baseline.tribe.lastProduction.gains, 'Raw-production receipt meaning is unchanged.');
    assert.equal(next.camp.fuel, baseline.camp.fuel, 'Recipe wood is not a second camp-fuel charge.');
  }
});

check('real workers moved from construction or study trade their former work for processing', () => {
  const source = fixture();
  const baseline = morning(source).state;
  for (const sourceJob of ['builder', 'scholar']) {
    let selected = configure(source, 'weave', 3);
    for (let index = 0; index < 2; index++) {
      selected = engine.adjustTribeJobAction(selected, sourceJob, -1);
      selected = engine.adjustTribeJobAction(selected, 'artisan', 1);
    }
    const next = morning(selected).state;
    const sameWorkersOff = clone(selected); sameWorkersOff.tribe.processingPlan = { actionId: '', targetStock: 0 };
    const withoutProcessing = morning(sameWorkersOff).state;
    assert.equal(Object.values(next.tribe.assignments).reduce((sum, count) => sum + count, 0), 6);
    assert.equal(next.tribe.lastProduction.processing.batches, 2);
    assert.equal(next.inventory.fiber, withoutProcessing.inventory.fiber - 6);
    assert.equal(next.inventory.woven_cloth, 2);
    if (sourceJob === 'builder') {
      assert.equal(next.tribe.lastProduction.projectWork, 0);
      assert.equal(baseline.tribe.lastProduction.projectWork, 2);
    } else {
      assert.equal(next.tribe.lastProduction.researchPoints, 0);
      assert.equal(baseline.tribe.lastProduction.researchPoints, 2);
    }
    assert.deepEqual(next.tribe.autoAssignments, jobs({}));
  }
});

check('moving food workers has a real production cost and explicit artisans remain manual under every policy', () => {
  const source = fixture({ forager: 4, artisan: 2 });
  const allFood = fixture({ forager: 6 });
  for (const policyId of ['balanced', 'construction', 'research']) {
    const state = configure(clone(source), 'weave', 10);
    state.civics.completed.STATE_WORKFORCE = true; state.research.completed.STATE_WORKFORCE = true;
    state.tribe.workPolicy = policyId;
    const next = morning(state).state;
    assert.equal(next.tribe.assignments.artisan, 2); assert.equal(next.tribe.autoAssignments.artisan, 0);
    assert.equal(next.tribe.lastProduction.gains.berry, 2);
    assert.equal(morning(allFood).state.tribe.lastProduction.gains.berry, 3);
  }
  const mixed = configure(fixture({ forager: 2, artisan: 2 }), 'weave', 10);
  mixed.tribe.autoAssignments.forager = 2;
  const next = morning(mixed).state;
  assert.equal(next.tribe.assignments.artisan, 2); assert.equal(next.tribe.autoAssignments.artisan, 0);
});

check('future locked plans save without running and developer preview never unlocks actual production', () => {
  for (const removeTech of ['SETTLEMENT', 'POTTERY']) {
    const state = fixture({ forager: 4, artisan: 2 });
    state.research.completed[removeTech] = false;
    state.devTools = { ...state.devTools, enabled: true, unlockSpecializedActions: true };
    const selected = configure(state, 'kiln', 3);
    assert.equal(selected.tribe.processingPlan.actionId, 'kiln');
    const preview = engine.tribeProcessingSummary(selected);
    assert.equal(preview.expectedBatches, 0); assert.equal(preview.canConfigure, true);
    assert.equal(preview.options.find(row => row.id === 'kiln').unlocked, false);
    assert.match(preview.blockedReason, /연구/);
    const next = morning(selected).state;
    assert.equal(next.tribe.lastProduction.processing.batches, 0);
    assert.equal(next.inventory.pottery || 0, 0);
  }
});

check('complete material batches and target rounding bound actual execution without partial or unpaid outputs', () => {
  const state = fixture({ forager: 2, artisan: 4 });
  const rounded = morning(configure(state, 'kiln', 3)).state;
  assert.equal(rounded.tribe.lastProduction.processing.batches, 2);
  assert.deepEqual(rounded.tribe.lastProduction.processing.spent, { clay: 4, wood: 2 });
  assert.equal(rounded.inventory.pottery, 4);
  const limited = clone(state); limited.inventory.clay = 3;
  const next = morning(configure(limited, 'kiln', 20)).state;
  assert.equal(next.tribe.lastProduction.processing.batches, 1);
  assert.equal(next.inventory.pottery, 2); assert.equal(next.inventory.clay, 1);
  for (const mutate of [s => { s.inventory.clay = 1; }, s => { s.inventory.wood = 0; s.tribe.assignments = jobs({ artisan: 4, scholar: 2 }); },
    s => { s.inventory.pottery = 3; }, s => { s.tribe.assignments = jobs({ forager: 6 }); }]) {
    const blocked = clone(state); mutate(blocked);
    const result = morning(configure(blocked, 'kiln', 3)).state.tribe.lastProduction.processing;
    assert.equal(result.batches, 0); assert.deepEqual(result.spent, {}); assert.deepEqual(result.gains, {}); assert.ok(result.reason);
  }
  const nearLimit = clone(state); nearLimit.inventory.pottery = Number.MAX_SAFE_INTEGER - 1;
  const bounded = morning(configure(nearLimit, 'kiln', Number.MAX_SAFE_INTEGER)).state;
  assert.equal(bounded.inventory.pottery, nearLimit.inventory.pottery);
  assert.equal(bounded.tribe.lastProduction.processing.batches, 0);
  assert.match(bounded.tribe.lastProduction.processing.reason, /한도/);
});

check('actual immutable receipts explain material, labor, target rounding and safe-stock limits separately', () => {
  const receiptFor = (state, target = 20) => morning(configure(state, 'kiln', target)).state.tribe.lastProduction.processing;
  const materials = fixture({ artisan: 4, scholar: 2 }); materials.inventory.clay = 3;
  const partialMorning = morning(configure(materials, 'kiln', 20)).state;
  const partial = partialMorning.tribe.lastProduction.processing;
  assert.equal(partial.batches, 1);
  assert.match(partial.reason, /재료 부족: 점토 잔여 1개\(다음 묶음 2개 필요\)/);
  assert.doesNotMatch(partial.reason, /하루 일손 한도|목표 .*도달/);
  const fuel = fixture({ artisan: 4, scholar: 2 }); fuel.inventory.wood = 1;
  const fuelLimited = receiptFor(fuel);
  assert.equal(fuelLimited.batches, 1);
  assert.match(fuelLimited.reason, /나무 잔여 0개\(다음 묶음 1개 필요\)/);
  const labor = receiptFor(fixture({ artisan: 2, scholar: 4 }));
  assert.equal(labor.batches, 2);
  assert.match(labor.reason, /하루 일손 한도: 가공대 2명/);
  assert.doesNotMatch(labor.reason, /재료 부족|목표 .*도달/);
  const target = receiptFor(fixture({ artisan: 4, scholar: 2 }), 3);
  assert.equal(target.batches, 2);
  assert.equal(target.stockAfter, 4);
  assert.match(target.reason, /목표 3개 도달: 0→4개, 묶음 생산으로 1개 초과/);
  assert.doesNotMatch(target.reason, /재료 부족|하루 일손 한도/);
  const exact = receiptFor(fixture({ artisan: 4, scholar: 2 }), 4);
  assert.match(exact.reason, /목표 4개 도달/); assert.doesNotMatch(exact.reason, /초과/);
  const nearLimit = fixture({ artisan: 4, scholar: 2 }); nearLimit.inventory.pottery = Number.MAX_SAFE_INTEGER - 3;
  const safe = receiptFor(nearLimit, Number.MAX_SAFE_INTEGER);
  assert.equal(safe.batches, 1);
  assert.match(safe.reason, /안전한 재고 수량 한도/);
  assert.doesNotMatch(safe.reason, /재료 부족|하루 일손 한도|목표 .*도달/);
  const historic = clone(partial);
  const changed = configure({ ...partialMorning, inventory: { ...partialMorning.inventory, clay: 100 } }, 'weave', 3);
  assert.equal(engine.tribeProcessingSummary(changed).receipt, partial);
  assert.doesNotMatch(morning(changed).state.tribe.lastProduction.processing.reason, /점토 잔여/);
  assert.deepEqual(partial, historic, 'Later material, plan and preview changes cannot rewrite the actual stop reason.');
});

check('legacy fractional stock and materials retain exact observations while paying complete process batches', () => {
  for (const stock of [0.5, 0.3]) {
    const state = configure(fixture({ artisan: 2, scholar: 4 }), 'kiln', 3);
    state.inventory.pottery = stock;
    state.inventory.clay = 3.5; state.inventory.wood = 3.5;
    assert.equal(checkpoint.isValidRunState(state), true, 'Existing fractional inventory remains a supported save.');
    assert.equal(engine.tribeProcessingSummary(state).currentStock, stock);
    const next = morning(state).state;
    const receipt = next.tribe.lastProduction.processing;
    assert.equal(receipt.batches, 1);
    assert.deepEqual(receipt.spent, { clay: 2, wood: 1 });
    assert.deepEqual(receipt.gains, { pottery: 2 });
    assert.equal(next.inventory.clay, 1.5); assert.equal(next.inventory.wood, 2.5);
    assert.equal(next.inventory.pottery, stock + 2);
    assert.equal(receipt.stockBefore, stock);
    assert.equal(receipt.stockAfter, Number(next.inventory.pottery), 'Receipt observes the actual result rather than subtracting floating-point quantities.');
    assert.equal(checkpoint.isValidRunState(next), true);
  }
  for (const raw of ['2', null]) {
    const state = configure(fixture({ artisan: 2, scholar: 4 }), 'kiln', 10);
    state.inventory.pottery = raw;
    const next = morning(state).state;
    assert.equal(next.tribe.lastProduction.processing.stockBefore, Number(raw ?? 0));
    assert.equal(next.inventory.pottery, Number(raw ?? 0) + 4);
  }
});

check('unusable selected or material quantities pause without spending, rounding inventory or poisoning new receipts', () => {
  for (const id of ['pottery', 'clay', 'wood']) {
    for (const value of ['bad', NaN, Infinity, -1, Number.MAX_SAFE_INTEGER + 1]) {
      const state = fixture({ artisan: 2, scholar: 4 }); state.inventory[id] = value;
      const selected = configure(state, 'kiln', 10);
      const preview = engine.tribeProcessingSummary(selected);
      assert.equal(preview.expectedBatches, 0);
      assert.equal(preview.currentStock, id === 'pottery' ? null : 0);
      assert.match(preview.statusText, /수량/);
      const baseline = morning(state).state;
      const next = morning(selected).state;
      const receipt = next.tribe.lastProduction.processing;
      assert.equal(receipt.batches, 0); assert.deepEqual(receipt.spent, {}); assert.deepEqual(receipt.gains, {});
      assert.equal(receipt.stockBefore, id === 'pottery' ? null : 0);
      assert.equal(receipt.stockAfter, receipt.stockBefore);
      assert.equal(contract.isValidTribeProcessingReceipt(receipt), true);
      assert.deepEqual(next.inventory, baseline.inventory, 'A rejected process must leave all inventory exactly as the old boundary would.');
      assert.deepEqual(next.party, baseline.party);
      assert.deepEqual(next.counters, baseline.counters);
    }
  }
});

check('preview promises only current stock while actual morning materials can feed a real process after construction', () => {
  const state = configure(fixture({ forager: 2, builder: 2, artisan: 2 }), 'kiln', 3);
  state.inventory.wood = 3;
  const preview = engine.tribeProcessingSummary(state);
  assert.equal(preview.expectedBatches, 2);
  const next = morning(state).state;
  assert.equal(next.tribe.lastProduction.projectWork, 2);
  assert.equal(next.tribe.lastProduction.projectStarted, true);
  assert.equal(next.tribe.lastProduction.processing.batches, 1, 'Builders pay wood first; only the actual morning remainder can be processed.');
  assert.equal(next.inventory.wood, 0);
  const future = configure(fixture({ forager: 4, artisan: 2 }), 'kiln', 3);
  future.inventory.wood = 0;
  assert.equal(engine.tribeProcessingSummary(future).expectedBatches, 0);
  assert.equal(morning(future).state.tribe.lastProduction.processing.batches, 2);
});

check('tribe and retired-household meals are paid before milling; new food cannot repair the preceding night', () => {
  const state = configure(fixture({ artisan: 2, scholar: 4 }), 'mill', 10);
  state.inventory = { grain: 3 };
  const next = morning(state).state;
  assert.equal(next.tribe.lastProduction.foodProvided, 2);
  assert.equal(next.tribe.lastProduction.processing.batches, 0, 'Grain paid as rations cannot be spent again by the mill.');
  let household = fixture({ forager: 6 });
  household = reproducible(rng => engine.prepareSuccessorAction(household, household.party[0].id, { rng })).state;
  household = engine.retireFounderAction(household, household.party[0].id);
  household = reproducible(rng => engine.prepareSuccessorAction(household, household.party[1].id, { rng })).state;
  assert.equal(household.tribe.population, 4);
  household.tribe.assignments = jobs({ artisan: 1, scholar: 3 });
  const retired = household.lineage.members.find(member => member.stage === 'retired');
  assert.ok(retired); retired.retiredSnapshot.hunger = 60;
  household = configure(household, 'mill', 10);
  household.inventory = { grain: 4 };
  const withHousehold = morning(household).state;
  assert.equal(withHousehold.tribe.lastProduction.foodNeed, 2, 'Retired and prepared household members retain real communal rations.');
  assert.equal(withHousehold.inventory.grain, 2);
  assert.equal(withHousehold.tribe.lastProduction.processing.batches, 0);
  assert.equal(withHousehold.lineage.members.find(member => member.actorId === retired.actorId).retiredSnapshot.hunger, 40);
  const fatal = configure(fixture({ artisan: 2, scholar: 4 }), 'mill', 10);
  fatal.inventory = { grain: 3 };
  fatal.camp.fuel = 0;
  fatal.weather = { id: 'snow', name: '눈', temp: -8, cold: 12, actionMod: 0 };
  fatal.party = fatal.party.map(member => ({ ...member, hp: 1, hunger: 98, bodyTemp: 30 }));
  const ended = morning(fatal).state;
  assert.equal(ended.ended, true);
  assert.equal(ended.tribe.lastProduction.processing.batches, 0);
  assert.ok(ended.party.every(member => member.hp === 0 && member.deathRecord?.source === 'night'));
});

check('paid successor preparation reduces real processing labor and preserves already-issued receipts', () => {
  const state = configure(fixture({ artisan: 6 }), 'weave', 20);
  const first = morning(state).state;
  const receipt = first.tribe.lastProduction.processing; const before = clone(receipt);
  const prepared = reproducible(rng => engine.prepareSuccessorAction(first, first.party[0].id, { rng })).state;
  assert.equal(prepared.tribe.population, 5); assert.equal(prepared.tribe.assignments.artisan, 5);
  const second = morning(prepared).state;
  assert.equal(second.tribe.lastProduction.processing.workers, 5);
  assert.ok(second.tribe.lastProduction.processing.batches <= 5);
  assert.deepEqual(receipt, before);
  const changed = configure(first, 'kiln', 3);
  assert.equal(changed.tribe.lastProduction.processing, receipt, 'Changing the future plan cannot rewrite the historical process.');
});

check('inactive plans preserve old-day economics and RNG, and settlement stamps reject duplicate processing', () => {
  const old = fixture(); delete old.tribe.processingPlan;
  const explicit = clone(old); explicit.tribe.processingPlan = { actionId: '', targetStock: 0 };
  const a = morning(old), b = morning(explicit);
  assert.deepEqual(observable(a.state), observable(b.state)); assert.deepEqual(a.draws, b.draws); assert.deepEqual(a.implicitDraws, b.implicitDraws);
  assert.equal(Object.hasOwn(a.state.tribe.lastProduction, 'processing'), false);
  const selected = configure(fixture({ forager: 4, artisan: 2 }), 'weave', 10);
  const token = { runId: selected.runId, day: selected.day, ap: selected.ap, updatedAt: selected.updatedAt };
  const next = reproducible(rng => engine.runSettlementDayAction(selected, token, { rng })).state;
  const before = clone(next);
  const duplicate = reproducible(rng => engine.runSettlementDayAction(next, token, { rng }));
  assert.equal(duplicate.state, next); assert.deepEqual(next, before); assert.deepEqual(duplicate.draws, []); assert.deepEqual(duplicate.implicitDraws, []);
});

console.log(JSON.stringify({ checks, pass: failures.length === 0, failures }));
if (failures.length) process.exitCode = 1;
