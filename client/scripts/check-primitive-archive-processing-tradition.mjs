import assert from 'node:assert/strict';
import './lib/register-simulation-modules.mjs';
const engine = await import('../src/app/games/primitive-archive/_lib/primitiveArchiveEngine.js');
const checkpoint = await import('../src/app/games/primitive-archive/_lib/primitiveArchiveCheckpoint.js');
const clone = value => structuredClone(value);
const jobs = values => Object.fromEntries(engine.TRIBE_JOBS.map(job => [job.id, values[job.id] || 0]));
const stamp = state => ({ runId: state.runId, day: state.day, ap: state.ap, updatedAt: state.updatedAt });
const observable = state => { const result = clone(state); delete result.log; delete result.updatedAt; return result; };
function reproducible(run, high = false) {
  let seed = 0x12345678, implicitSeed = 0xcafef00d;
  const draws = [], implicitDraws = [];
  const rng = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const value = high ? 0.98 + seed / 2 ** 32 * 0.019 : seed / 2 ** 32; draws.push(value); return value; };
  const original = Math.random;
  Math.random = () => { implicitSeed = (Math.imul(implicitSeed, 1664525) + 1013904223) >>> 0;
    const value = implicitSeed / 2 ** 32; implicitDraws.push(value); return value; };
  try { return { state: run(rng), draws, implicitDraws }; }
  finally { Math.random = original; }
}
function fixture(actionId = 'weave', targetStock = 10) {
  let state = reproducible(rng => engine.createNewState({ runId: 'processing-tradition-check',
    now: '2026-11-06T00:00:00.000Z', rng })).state;
  state.camp = { ...state.camp, fireLevel: 1, shelterLevel: 3, workbenchLevel: 1, fuel: 10 };
  state.inventory = { berry: 100, wood: 50, fiber: 30, clay: 30, stone: 20 };
  state.weather = { id: 'clear', name: '검사 맑음', cold: 0, temp: 20, actionMod: 0 };
  for (const id of ['GATHERING', 'HUNTING', 'CORDAGE', 'POTTERY', 'SETTLEMENT', 'FOOD_STORAGE']) state.research.completed[id] = true;
  state.tribe.population = 6; state.tribe.assignments = jobs({ forager: 3, builder: 1, scholar: 1, artisan: 1 });
  state.tribe.autoAssignments = jobs({});
  for (let index = 0; index < 3; index++) {
    state = reproducible(rng => engine.runCampAction(state, state.party[0].id, 'fuel', { rng })).state;
  }
  assert.equal(state.founderHistory.members[0].tallies.camp, 3, 'The rite must come from real individual contributions.');
  state = reproducible(rng => engine.runSettlementDayAction(state, stamp(state), { rng })).state;
  state = engine.ancestralRiteAction(state, state.party[0].id, state.party[0].id);
  assert.equal(state.ancestralFaith.active?.domain, 'craft');
  assert.equal(state.ancestralFaith.active.remaining, 2);
  return engine.configureTribeProcessAction(state, { actionId, targetStock });
}
const reserve = (state, actorId = state.party[0].id) => engine.reserveProcessingTraditionAction(state, actorId);
function morning(state) {
  const before = clone(state);
  const result = reproducible(rng => engine.advanceDay(state, { rng }));
  assert.deepEqual(state, before, 'Actual processing must preserve the source and its historic receipts.');
  assert.equal(checkpoint.isValidRunState(result.state), true);
  return result;
}
let groups = 0;
const failures = [];
function check(name, run) {
  try { run(); groups++; console.log(`PASS ${name}`); }
  catch (error) { failures.push({ name, error: String(error.message).slice(0, 900) }); console.error(`FAIL ${name}: ${String(error.message).slice(0, 900)}`); }
}

check('a real paid three-deed teaching reserves one existing craft use without other economy, RNG or credit changes', () => {
  const state = fixture(); const before = clone(state); const original = Math.random;
  const executorId = state.party[1].id;
  Math.random = () => { throw Error('Reservation and summary cannot draw gameplay randomness'); };
  let selected;
  try {
    const summary = engine.processingTraditionSummary(state, executorId);
    assert.equal(summary.canReserve, true); assert.equal(summary.availableCharges, 2);
    assert.equal(summary.modeLabel, '생전 가르침'); assert.equal(summary.executorName, state.party[1].name);
    assert.equal(summary.founderName, state.party[0].name); assert.match(summary.evidenceText, /캠프 관리 3회/);
    selected = reserve(state, executorId);
    assert.deepEqual(observable(reserve(selected, executorId)), observable(selected));
  } finally { Math.random = original; }
  const expected = observable(before);
  expected.ancestralFaith.active.remaining = 1;
  expected.projectTradition.lastReservedDay = state.day;
  expected.projectTradition.pending = { kind: 'processing', reservedDay: state.day, dueDay: state.day + 1,
    founderId: state.party[0].id, actionId: 'weave', targetStock: 10 };
  assert.deepEqual(observable(selected), expected);
  assert.deepEqual(state, before);
  assert.equal(Object.hasOwn(selected.projectTradition, 'processingRecords'), false, 'A reservation is not an applied contribution.');
});

check('project and processing reservations compete for one shared daily slot in both directions', () => {
  const state = fixture();
  assert.equal(engine.projectTraditionSummary(state).canReserve, true);
  const project = engine.reserveProjectTraditionAction(state, state.party[0].id);
  assert.deepEqual(observable(reserve(project)), observable(project));
  const processing = reserve(state);
  assert.deepEqual(observable(engine.reserveProjectTraditionAction(processing, state.party[0].id)), observable(processing));
  const summary = engine.projectTraditionSummary(processing);
  assert.equal(summary.canReserve, false); assert.match(summary.pendingText, /방직.*목표 10개/);
  assert.doesNotMatch(summary.pendingText, /undefined|선택된 사업 없음/);
  assert.equal(processing.ancestralFaith.active.remaining, 1);
});

check('personal crafting consumes the very same paid uses and the reserved use is not charged again at dawn', () => {
  const state = fixture();
  const crafted = reproducible(rng => engine.runCraftAction(state, state.party[0].id, 'twine', { rng })).state;
  assert.equal(crafted.ancestralFaith.active.remaining, 1);
  const selected = reserve(crafted);
  assert.equal(selected.ancestralFaith.active, null);
  const next = morning(selected).state;
  assert.equal(next.tribe.lastProduction.processing.bonusBatches, 1);
  assert.equal(next.ancestralFaith.active, null);
});

check('actual basic workers and fully paid extra materials produce exactly one extra batch without personal deeds', () => {
  const source = fixture(); const selected = reserve(source);
  const plain = morning(source), actual = morning(selected);
  const base = plain.state.tribe.lastProduction.processing, receipt = actual.state.tribe.lastProduction.processing;
  assert.equal(base.workers, 1); assert.equal(base.batches, 1); assert.equal(Object.hasOwn(base, 'bonusBatches'), false);
  assert.equal(receipt.workers, 1); assert.equal(receipt.batches, 2); assert.equal(receipt.bonusBatches, 1);
  assert.equal(actual.state.inventory.fiber, plain.state.inventory.fiber - 3);
  assert.equal(actual.state.inventory.woven_cloth, plain.state.inventory.woven_cloth + 1);
  assert.deepEqual(receipt.spent, { fiber: 6 }); assert.deepEqual(receipt.gains, { woven_cloth: 2 });
  for (const field of ['party', 'counters', 'founderHistory', 'research', 'civics', 'meta']) assert.deepEqual(actual.state[field], plain.state[field]);
  assert.deepEqual(actual.state.tribe.assignments, plain.state.tribe.assignments);
  assert.deepEqual(actual.state.tribe.lastProduction.gains, plain.state.tribe.lastProduction.gains);
  assert.deepEqual(actual.draws, plain.draws); assert.deepEqual(actual.implicitDraws, plain.implicitDraws);
  assert.equal(actual.state.projectTradition.records.length, 0);
  assert.deepEqual(actual.state.projectTradition.processingRecords, [{ actionId: 'weave', founderId: source.party[0].id,
    appliedBatches: 1, firstDay: source.day + 1, lastDay: source.day + 1 }]);
  assert.equal(actual.state.projectTradition.lastSettlement.result, 'applied');
  assert.equal(actual.state.projectTradition.pending, null);
});

check('reservation guards preserve current economy for paused, terminal, actor, AP, quantity and incomplete-batch cases', () => {
  for (const mutate of [state => { state.ended = true; }, state => { state.ap = 0; },
    state => { state.party[0].hp = 0; }, state => { state.tribe.assignments.artisan = 0; },
    state => { state.research.completed.CORDAGE = false; }, state => { state.inventory.fiber = 3; },
    state => { state.inventory.fiber = NaN; }, state => { state.inventory.woven_cloth = -1; },
    state => { state.tribe.processingPlan = { actionId: '', targetStock: 0 }; },
    state => { state.tribe.processingPlan.targetStock = 1; }, state => { state.ancestralFaith.active = null; }]) {
    const state = fixture(); mutate(state); const before = clone(state);
    const result = reproducible(() => reserve(state));
    assert.deepEqual(observable(result.state), observable(before));
    assert.deepEqual(state, before); assert.deepEqual(result.draws, []); assert.deepEqual(result.implicitDraws, []);
  }
});

check('changed action, changed target and disabled plan expire the paid reservation without transferring or refunding it', () => {
  for (const [actionId, targetStock, reason] of [['kiln', 10, 'target_changed'], ['weave', 11, 'target_changed'], ['', 0, 'no_plan']]) {
    const selected = reserve(fixture());
    const changed = engine.configureTribeProcessAction(selected, { actionId, targetStock });
    assert.equal(changed.ancestralFaith.active.remaining, 1);
    assert.equal(changed.projectTradition.pending.actionId, 'weave');
    const next = morning(changed).state;
    assert.equal(next.projectTradition.lastSettlement.result, 'expired');
    assert.equal(next.projectTradition.lastSettlement.reason, reason);
    assert.equal(next.projectTradition.pending, null);
    assert.equal(Object.hasOwn(next.projectTradition, 'processingRecords'), false);
    if (!actionId) assert.equal(Object.hasOwn(next.tribe.lastProduction, 'processing'), false, 'Off plans gain only the real expiry receipt, not invented production.');
  }
});

check('actual morning material, worker, technology, target and unusable-quantity failures produce precise zero-credit expiry', () => {
  for (const [mutate, reason] of [
    [state => { state.inventory.fiber = 3; }, 'materials'],
    [state => { state.tribe.assignments.artisan = 0; }, 'no_workers'],
    [state => { state.research.completed.CORDAGE = false; }, 'locked'],
    [state => { state.inventory.woven_cloth = 9; }, 'no_room'],
    [state => { state.inventory.fiber = NaN; }, 'quantity'],
  ]) {
    const selected = reserve(fixture()); mutate(selected);
    const next = morning(selected).state;
    assert.equal(next.projectTradition.lastSettlement.reason, reason);
    assert.equal(next.projectTradition.lastSettlement.bonusBatches, 0);
    assert.equal(Object.hasOwn(next.tribe.lastProduction.processing, 'bonusBatches'), false);
    assert.equal(Object.hasOwn(next.projectTradition, 'processingRecords'), false);
  }
});

check('fractional stock and material remainders survive real base-plus-tradition batches and target rounding', () => {
  for (const stock of [0.3, 0.5]) {
    const source = fixture('kiln', 3);
    source.inventory.pottery = stock; source.inventory.clay = 4.5; source.inventory.wood = 20.5;
    const next = morning(reserve(source)).state;
    const receipt = next.tribe.lastProduction.processing;
    assert.equal(receipt.batches, 2); assert.equal(receipt.bonusBatches, 1);
    assert.equal(receipt.stockBefore, stock); assert.equal(receipt.stockAfter, stock + 4);
    assert.equal(next.inventory.pottery, stock + 4); assert.equal(next.inventory.clay, 0.5);
    assert.deepEqual(receipt.spent, { clay: 4, wood: 2 });
  }
});

check('safe-stock limits block the extra batch without invalidating real basic production or the receipt', () => {
  const source = fixture('kiln', Number.MAX_SAFE_INTEGER);
  const selected = reserve(source);
  selected.inventory.pottery = Number.MAX_SAFE_INTEGER - 3;
  const next = morning(selected).state;
  assert.equal(next.tribe.lastProduction.processing.batches, 1);
  assert.equal(Object.hasOwn(next.tribe.lastProduction.processing, 'bonusBatches'), false);
  assert.equal(next.projectTradition.lastSettlement.reason, 'stock_limit');
  assert.equal(next.inventory.pottery, Number.MAX_SAFE_INTEGER - 1);
});

check('missed-day and actual night-end reservations expire, while a pre-ended run invents no dawn settlement', () => {
  const selected = reserve(fixture());
  const delayed = clone(selected); delayed.day += 1;
  assert.equal(morning(delayed).state.projectTradition.lastSettlement.reason, 'missed_day');
  const ended = { ...clone(selected), ended: true };
  const result = reproducible(rng => engine.advanceDay(ended, { rng }));
  assert.equal(result.state, ended); assert.equal(ended.projectTradition.lastSettlement, null);
  assert.match(engine.processingTraditionSummary(ended).pendingText, /런 종료로 예약 실행 안 됨/);
  assert.deepEqual(result.draws, []);
  const fatal = clone(selected); fatal.inventory = { fiber: 30 }; fatal.camp.fuel = 0;
  fatal.weather = { id: 'snow', name: '눈', temp: -8, cold: 12, actionMod: 0 };
  fatal.party = fatal.party.map(member => ({ ...member, hp: 1, hunger: 98, bodyTemp: 30 }));
  const next = morning(fatal).state;
  assert.equal(next.ended, true); assert.equal(next.projectTradition.lastSettlement.reason, 'ended');
  assert.equal(next.projectTradition.lastSettlement.bonusBatches, 0);
});

check('actual failed-hunt death changes teaching into blessing without increasing effect or adding personal deeds', () => {
  let state = fixture(); const founderId = state.party[0].id;
  state.party[0].hp = 1;
  state = reproducible(rng => engine.runHuntAction(state, founderId, 'plains', { rng }), true).state;
  assert.equal(state.party[0].hp, 0);
  const history = clone(state.founderHistory);
  const actorId = state.party[1].id;
  assert.equal(engine.processingTraditionSummary(state, actorId).modeLabel, '시조신의 가호');
  const next = morning(reserve(state, actorId)).state;
  assert.equal(next.tribe.lastProduction.processing.bonusBatches, 1);
  assert.deepEqual(next.founderHistory, history);
});

check('double invocation, later production and new plan previews cannot replay or rewrite the first contribution', () => {
  const selected = reserve(fixture()); const token = stamp(selected);
  const next = reproducible(rng => engine.runSettlementDayAction(selected, token, { rng })).state;
  const prior = clone(next.projectTradition); const receipt = next.projectTradition.lastSettlement;
  const duplicate = reproducible(rng => engine.runSettlementDayAction(next, token, { rng }));
  assert.equal(duplicate.state, next); assert.deepEqual(duplicate.draws, []);
  const later = morning(engine.configureTribeProcessAction(next, { actionId: 'kiln', targetStock: 10 })).state;
  assert.deepEqual(next.projectTradition, prior);
  assert.deepEqual(later.projectTradition, prior);
  assert.equal(later.projectTradition.lastSettlement, receipt);
  assert.doesNotMatch(engine.projectTraditionSummary(next).lastSettlementText, /undefined/);
  assert.match(engine.processingTraditionSummary(later).records[0].text, /실제 추가 가공 1묶음/);
});

check('missing legacy tradition stays disabled and default processing leaves the old project contract unchanged', () => {
  const raw = fixture(); delete raw.projectTradition;
  const restored = reproducible(() => engine.normalizeState(raw)).state;
  assert.equal(engine.processingTraditionSummary(restored).enabled, false);
  assert.deepEqual(observable(reserve(restored)), observable(restored));
  const source = fixture(); const selected = engine.reserveProjectTraditionAction(source, source.party[0].id);
  const next = morning(selected).state;
  assert.equal(next.tribe.lastProduction.projectTraditionWork, 1);
  assert.equal(Object.hasOwn(next.projectTradition, 'processingRecords'), false);
  assert.equal(Object.hasOwn(next.tribe.lastProduction.processing, 'bonusBatches'), false);
});

console.log(JSON.stringify({ groups, pass: failures.length === 0, failures }));
if (failures.length) process.exitCode = 1;
