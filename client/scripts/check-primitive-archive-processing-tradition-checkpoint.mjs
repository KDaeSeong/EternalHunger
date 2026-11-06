import assert from 'node:assert/strict';
import './lib/register-simulation-modules.mjs';
const engine = await import('../src/app/games/primitive-archive/_lib/primitiveArchiveEngine.js');
const tradition = await import('../src/app/games/primitive-archive/_lib/primitiveArchiveProjectTradition.js');
const contract = await import('../src/app/games/primitive-archive/_lib/primitiveArchiveProcessing.js');
const checkpoint = await import('../src/app/games/primitive-archive/_lib/primitiveArchiveCheckpoint.js');
const clone = value => structuredClone(value);
const owner = 'guest', savedAt = '2026-11-05T00:00:00.000Z', key = checkpoint.checkpointStorageKey(owner);
class Storage {
  values = new Map(); fail = false;
  getItem(id) { return this.values.get(id) ?? null; }
  setItem(id, value) { if (this.fail) throw Error('quota'); this.values.set(id, String(value)); }
  removeItem(id) { this.values.delete(id); }
}
const jobs = values => Object.fromEntries(engine.TRIBE_JOBS.map(job => [job.id, values[job.id] || 0]));
function ready(stock = 0) {
  let state = engine.createNewState({ runId: 'processing-tradition-checkpoint', difficulty: 'easy', now: savedAt, rng: () => 0.5 });
  state.camp = { ...state.camp, fireLevel: 1, shelterLevel: 3, workbenchLevel: 1, fuel: 10 };
  state.inventory = { berry: 100, wood: 50, fiber: 30, stone: 30, clay: 30, pottery: stock };
  state.weather = { id: 'clear', name: '검사 맑음', temp: 20, cold: 0, actionMod: 0 };
  state.tribe.assignments = jobs({ forager: 2, builder: 1, artisan: 1 }); state.tribe.autoAssignments = jobs({});
  state.research.completed = { ...state.research.completed, GATHERING: true, HUNTING: true,
    CORDAGE: true, POTTERY: true, SETTLEMENT: true, FOOD_STORAGE: true };
  const actor = state.party[0].id;
  for (let i = 0; i < 3; i++) state = engine.runCampAction(state, actor, 'fuel', { rng: () => 0.5 });
  state = engine.configureTribeProcessAction(state, { actionId: 'kiln', targetStock: 20 });
  return engine.normalizeState(engine.ancestralRiteAction(state, actor, actor));
}
function reserved(stock = 0) {
  const state = ready(stock), next = engine.reserveProcessingTraditionAction(state, state.party[0].id);
  assert.equal(next.projectTradition.pending?.kind, 'processing', engine.processingTraditionSummary(state, state.party[0].id).reason);
  return next;
}
const morning = state => engine.advanceDay(state, { rng: () => 0.5 });
function roundTrip(source, storage = new Storage(), revision = 0, ownerKey = owner, forcePrevious = false) {
  assert.equal(checkpoint.writeCheckpoint(storage, ownerKey, source, { expectedRevision: revision, savedAt, forcePrevious }).status, 'ready');
  const result = checkpoint.readCheckpoint(storage, ownerKey); assert.equal(result.status, 'ready');
  return { storage, restored: engine.normalizeState(result.checkpoint.current) };
}
let groups = 0;
const failures = [];
function check(name, run) {
  try { run(); groups++; console.log('PASS ' + name); }
  catch (error) { failures.push(name); console.error('FAIL ' + name + ': ' + String(error.stack || error).slice(0, 1400)); }
}

check('unselected state and old project reservations preserve their exact v1 shapes without processing history', () => {
  const source = ready(); assert.equal(Object.hasOwn(source.projectTradition, 'processingRecords'), false);
  assert.deepEqual(Object.keys(source.projectTradition).sort(), ['version', 'runId', 'origin', 'lastReservedDay', 'pending', 'lastSettlement', 'records'].sort());
  const project = engine.reserveProjectTraditionAction(source, source.party[0].id);
  assert.ok(project.projectTradition.pending.projectId); assert.equal(Object.hasOwn(project.projectTradition.pending, 'kind'), false);
  const applied = morning(project), { restored } = roundTrip(applied);
  assert.deepEqual(restored.projectTradition, applied.projectTradition);
  assert.equal(Object.hasOwn(applied.projectTradition.lastSettlement, 'kind'), false);
  assert.equal(Object.hasOwn(applied.projectTradition, 'processingRecords'), false);
});

check('a real paid craft charge and exact pending provenance restore without another charge, action or material payment', () => {
  const source = ready(), before = clone(source), next = engine.reserveProcessingTraditionAction(source, source.party[0].id);
  assert.equal(source.ancestralFaith.active.remaining, 2); assert.equal(next.ancestralFaith.active.remaining, 1);
  assert.deepEqual(next.projectTradition.pending, { kind: 'processing', reservedDay: source.day, dueDay: source.day + 1,
    actionId: 'kiln', targetStock: 20, founderId: source.party[0].id });
  for (const field of ['inventory', 'party', 'founderHistory', 'projects', 'research', 'civics', 'meta']) assert.deepEqual(next[field], source[field]);
  assert.equal(next.ap, source.ap); assert.equal(next.day, source.day); assert.deepEqual(source, before);
  const { restored } = roundTrip(next); assert.deepEqual(restored.projectTradition, next.projectTradition);
  assert.deepEqual(restored.ancestralFaith, next.ancestralFaith);
  assert.deepEqual(tradition.reserveProcessingTradition(source, { actionId: 'kiln', targetStock: 20, founderId: source.party[0].id }), source,
    'An unconsumed two-use charge cannot be presented as a paid reservation');
});

check('one pending/day gate excludes the other destination and never refunds or consumes a second charge', () => {
  const source = ready(), actor = source.party[0].id;
  for (const first of [engine.reserveProjectTraditionAction(source, actor), engine.reserveProcessingTraditionAction(source, actor)]) {
    for (const action of [engine.reserveProjectTraditionAction, engine.reserveProcessingTraditionAction]) {
      const next = action(first, actor); assert.deepEqual(next.projectTradition, first.projectTradition);
      assert.deepEqual(next.ancestralFaith, first.ancestralFaith); assert.deepEqual(next.inventory, first.inventory);
    }
  }
});

check('due-day faith expiry retains a paid processing reservation and old project settlement cannot steal it', () => {
  const source = engine.normalizeState({ ...reserved(), day: 2 }); assert.equal(source.ancestralFaith.active, null);
  const { restored } = roundTrip(source);
  assert.deepEqual(tradition.settleProjectTradition(restored), restored);
  assert.equal(tradition.projectTraditionBonus(restored, { projectId: 'drying-rack', baseWork: 1, progressBefore: 0, work: 5 }), 0);
  assert.equal(tradition.processingTraditionBonus(restored, { actionId: 'kiln', targetStock: 20, workers: 1, baseBatches: 1,
    materialBatches: 3, neededBatches: 10, safeStockBatches: 10 }), 1);
});

check('actual extra paid production preserves fractional observations and credits only the one extra batch', () => {
  for (const stock of [0, 0.5, 0.3]) {
    const source = reserved(stock), before = clone(source), next = morning(source);
    const actual = next.tribe.lastProduction.processing, receipt = next.projectTradition.lastSettlement;
    assert.equal(actual.workers, 1); assert.equal(actual.batches, 2); assert.equal(actual.bonusBatches, 1);
    assert.deepEqual(actual.spent, { clay: 4, wood: 2 }); assert.deepEqual(actual.gains, { pottery: 4 });
    assert.equal(actual.stockBefore, stock); assert.equal(actual.stockAfter, stock + 4);
    assert.equal(receipt.kind, 'processing'); assert.equal(receipt.result, 'applied'); assert.equal(receipt.baseBatches, 1); assert.equal(receipt.bonusBatches, 1);
    assert.deepEqual(receipt.spent, actual.spent); assert.deepEqual(receipt.gains, actual.gains);
    assert.deepEqual(next.projectTradition.records, []);
    assert.deepEqual(next.projectTradition.processingRecords, [{ actionId: 'kiln', founderId: source.party[0].id,
      appliedBatches: 1, firstDay: 2, lastDay: 2 }]);
    assert.deepEqual(next.founderHistory, source.founderHistory);
    const { restored } = roundTrip(next); assert.deepEqual(restored.projectTradition, next.projectTradition);
    assert.deepEqual(restored.inventory, next.inventory); assert.deepEqual(source, before);
  }
});

check('expiry for changed/off plans, no labor, unusable quantity and material shortage has no invented contribution', () => {
  const variants = [
    s => engine.configureTribeProcessAction(s, { actionId: 'weave', targetStock: 20 }),
    s => engine.configureTribeProcessAction(s, { actionId: '', targetStock: 0 }),
    s => ({ ...s, tribe: { ...s.tribe, assignments: jobs({ forager: 3, builder: 1 }) } }),
    s => ({ ...s, inventory: { ...s.inventory, pottery: 'unusable' } }),
    s => ({ ...s, inventory: { ...s.inventory, clay: 0 } }),
  ];
  for (const change of variants) {
    const source = change(reserved()), next = morning(source), receipt = next.projectTradition.lastSettlement;
    assert.equal(receipt.kind, 'processing'); assert.equal(receipt.result, 'expired'); assert.equal(receipt.bonusBatches, 0);
    assert.equal(next.projectTradition.pending, null); assert.equal(Object.hasOwn(next.projectTradition, 'processingRecords'), false);
    assert.deepEqual(next.projectTradition.records, []);
    assert.deepEqual(roundTrip(next).restored.projectTradition, next.projectTradition);
  }
});

check('project and processing contributions share the total one-reservation-per-day bound', () => {
  let source = ready(); source = engine.reserveProjectTraditionAction(source, source.party[0].id);
  let next = morning(source); next = engine.ancestralRiteAction(next, next.party[0].id, next.party[0].id);
  next = engine.reserveProcessingTraditionAction(next, next.party[0].id); next = morning(next);
  assert.equal(next.projectTradition.records[0].appliedWork, 1);
  assert.equal(next.projectTradition.processingRecords[0].appliedBatches, 1);
  assert.equal(next.projectTradition.lastReservedDay, 2);
  assert.deepEqual(roundTrip(next).restored.projectTradition, next.projectTradition);
  const invalid = clone(next); invalid.projectTradition.processingRecords[0].appliedBatches = 2;
  invalid.projectTradition.processingRecords[0].firstDay = 2;
  assert.equal(checkpoint.isValidRunState(invalid), false);
  const sameDay = clone(next);
  sameDay.projectTradition.records[0].firstDay = 3; sameDay.projectTradition.records[0].lastDay = 3;
  assert.equal(checkpoint.isValidRunState(sameDay), false, 'Two destinations cannot claim the same definite application day');
});

check('several real alternating reservation days preserve feasible overlapping history windows through completion and reload', () => {
  let state = ready();
  const actor = state.party[0].id;
  // Same founder/process applies on days 2 and 4, with real project work on
  // day 3. The aggregate process interval overlaps that project day legally.
  for (const destination of ['processing', 'project', 'processing']) {
    if (state.ancestralFaith.lastRiteDay !== state.day) state = engine.ancestralRiteAction(state, actor, actor);
    state = destination === 'processing' ? engine.reserveProcessingTraditionAction(state, actor)
      : engine.reserveProjectTraditionAction(state, actor);
    assert.ok(state.projectTradition.pending);
    assert.equal(state.projectTradition.pending?.kind === 'processing', destination === 'processing');
    state = roundTrip(state).restored;
    state = morning(state);
    state = roundTrip(state).restored;
  }
  // The remaining project work now needs only one ordinary builder day.
  state = roundTrip(morning(state)).restored;
  state = engine.ancestralRiteAction(state, actor, actor);
  state = engine.reserveProcessingTraditionAction(state, actor);
  assert.equal(state.projectTradition.pending?.kind, 'processing');
  state = roundTrip(morning(roundTrip(state).restored)).restored;
  assert.equal(state.projectTradition.processingRecords[0].appliedBatches, 3);
  assert.equal(state.projectTradition.processingRecords[0].firstDay, 2);
  assert.equal(state.projectTradition.processingRecords[0].lastDay, 6);
  assert.ok(state.projects.completed['drying-rack']);
  assert.ok(state.projectTradition.records[0].completedDay > 0);
  assert.equal(checkpoint.isValidRunState(state), true);
  // Paired aggregate validation: the project endpoints 3/5 leave day 4 for
  // the process interior. Requiring an additional project use makes only
  // that bounded interior impossible; the overall elapsed-day cap still fits.
  const evidence = clone(state); evidence.day = 20;
  evidence.ancestralFaith.lastRiteDay = 19; evidence.ancestralFaith.active = null;
  const raw = evidence.projectTradition; raw.lastReservedDay = 19;
  raw.pending = { kind: 'processing', reservedDay: 19, dueDay: 20, actionId: 'kiln', targetStock: 20, founderId: actor };
  raw.records[0] = { ...raw.records[0], appliedWork: 2, firstDay: 3, lastDay: 5 };
  assert.equal(tradition.isValidProjectTradition(raw, evidence), true);
  raw.records[0].appliedWork = 3;
  assert.equal(tradition.isValidProjectTradition(raw, evidence), false);
});

check('current, previous, owner and quota/conflict boundaries preserve complete processing provenance', () => {
  const source = reserved(), applied = morning(source), { storage } = roundTrip(source);
  roundTrip(applied, storage, 1, owner, true);
  const current = checkpoint.readCheckpoint(storage, owner).checkpoint;
  assert.deepEqual(current.previous.projectTradition, source.projectTradition);
  assert.deepEqual(current.current.projectTradition, applied.projectTradition);
  const original = storage.getItem(key); storage.fail = true;
  assert.equal(checkpoint.writeCheckpoint(storage, owner, source, { expectedRevision: 2, savedAt }).status, 'unavailable');
  assert.equal(storage.getItem(key), original); storage.fail = false;
  assert.equal(checkpoint.writeCheckpoint(storage, owner, source, { expectedRevision: 1, savedAt }).status, 'conflict');
  assert.equal(storage.getItem(key), original);
  roundTrip(ready(), storage, 0, 'user:id:other-owner');
  assert.deepEqual(checkpoint.readCheckpoint(storage, owner).checkpoint.current.projectTradition, applied.projectTradition);
  const restored = checkpoint.restorePreviousCheckpoint(storage, owner, { expectedRevision: 2, savedAt });
  assert.equal(restored.status, 'ready'); assert.deepEqual(restored.checkpoint.current.projectTradition, source.projectTradition);
});

check('malformed pending charge/founder/day/plan data fails before any protected bytes can change', () => {
  const source = reserved(), { storage } = roundTrip(source), original = storage.getItem(key);
  const changes = [
    s => { s.projectTradition.pending.kind = 'other'; }, s => { s.projectTradition.pending.targetStock = 1.5; },
    s => { s.projectTradition.pending.actionId = 'other'; }, s => { s.projectTradition.pending.founderId = 'missing'; },
    s => { s.projectTradition.pending.reservedDay = 0; }, s => { s.projectTradition.pending.dueDay = 3; },
    s => { s.ancestralFaith.active.remaining = 2; }, s => { s.projectTradition.processingRecords = []; },
    s => { s.projectTradition.processingRecords = undefined; }, s => { s.projectTradition.processingRecords = null; },
  ];
  for (const change of changes) {
    const invalid = clone(source); change(invalid); assert.equal(checkpoint.isValidRunState(invalid), false);
    assert.throws(() => engine.normalizeState(invalid), RangeError);
    assert.equal(checkpoint.writeCheckpoint(storage, owner, invalid, { expectedRevision: 1, savedAt }).status, 'invalid-state');
    assert.equal(storage.getItem(key), original);
  }
});

check('malformed applied provenance and optional bonus fields cannot forge work or weaken old exact receipts', () => {
  const source = morning(reserved()), { storage } = roundTrip(source), original = storage.getItem(key);
  const changes = [
    s => { s.projectTradition.lastSettlement.bonusBatches = 2; }, s => { s.projectTradition.lastSettlement.baseBatches = 0; },
    s => { s.projectTradition.lastSettlement.stockAfter = 3; }, s => { s.projectTradition.lastSettlement.spent.clay = 1.5; },
    s => { s.projectTradition.lastSettlement.founderId = 'missing'; }, s => { s.projectTradition.processingRecords.push(clone(s.projectTradition.processingRecords[0])); },
    s => { s.projectTradition.processingRecords[0].appliedBatches = 2; }, s => { s.projectTradition.processingRecords[0].firstDay = 1; },
    s => { s.tribe.lastProduction.processing.bonusBatches = undefined; }, s => { s.tribe.lastProduction.processing.bonusBatches = 1.5; },
    s => { s.tribe.lastProduction.processing.bonusBatches = 2; }, s => { delete s.tribe.lastProduction.processing.bonusBatches; },
    s => { delete s.projectTradition; }, s => { s.projectTradition.lastSettlement.spent.clay += 1; },
  ];
  for (const change of changes) {
    const invalid = clone(source); change(invalid); assert.equal(checkpoint.isValidRunState(invalid), false);
    assert.throws(() => engine.normalizeState(invalid), RangeError);
    assert.equal(checkpoint.writeCheckpoint(storage, owner, invalid, { expectedRevision: 1, savedAt }).status, 'invalid-state');
    assert.equal(storage.getItem(key), original);
  }
  const old = clone(source.tribe.lastProduction.processing); old.batches = 1; old.stockAfter = 2;
  old.spent = { clay: 2, wood: 1 }; old.gains = { pottery: 2 }; delete old.bonusBatches;
  assert.equal(contract.isValidTribeProcessingReceipt(old), true);
});

check('corrupt current or previous provenance blocks writes and recovery while preserving exact bytes', () => {
  for (const position of ['current', 'previous']) {
    const source = reserved(), applied = morning(source), { storage } = roundTrip(source);
    roundTrip(applied, storage, 1, owner, true);
    const envelope = JSON.parse(storage.getItem(key)); envelope[position].projectTradition.pending = { kind: 'processing' };
    const corrupt = JSON.stringify(envelope); storage.setItem(key, corrupt);
    assert.equal(checkpoint.readCheckpoint(storage, owner).status, 'corrupt');
    assert.equal(checkpoint.writeCheckpoint(storage, owner, source, { expectedRevision: 2, savedAt }).status, 'corrupt');
    assert.equal(checkpoint.restorePreviousCheckpoint(storage, owner, { expectedRevision: 2, savedAt }).status, 'corrupt');
    assert.equal(storage.getItem(key), corrupt);
  }
});

check('normalization observes later mutations, clones nested receipts and never reconstructs legacy processing history', () => {
  const source = morning(reserved()), before = clone(source), normalized = engine.normalizeState(source);
  normalized.projectTradition.lastSettlement.spent.clay = 999;
  normalized.projectTradition.processingRecords[0].appliedBatches = 999;
  assert.deepEqual(source, before);
  source.projectTradition.lastSettlement.bonusBatches = 2; assert.throws(() => engine.normalizeState(source), RangeError);
  const legacy = ready(); delete legacy.projectTradition;
  const restored = roundTrip(legacy).restored;
  assert.equal(restored.projectTradition.origin, 'legacy_disabled'); assert.equal(Object.hasOwn(restored.projectTradition, 'processingRecords'), false);
  assert.deepEqual(engine.reserveProcessingTraditionAction(restored, restored.party[0].id).projectTradition, restored.projectTradition);
});
console.log(JSON.stringify({ passed: failures.length === 0, groups, failures,
  scope: 'Actual rite, shared reservation, morning processing and strict checkpoint/current/previous/owner/corrupt protection in memory. No browser, live server or account writes.' }));
if (failures.length) process.exitCode = 1;
