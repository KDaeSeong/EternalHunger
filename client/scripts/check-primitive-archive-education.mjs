import assert from 'node:assert/strict';
import './lib/register-simulation-modules.mjs';

const engine = await import('../src/app/games/primitive-archive/_lib/primitiveArchiveEngine.js');
const checkpoint = await import('../src/app/games/primitive-archive/_lib/primitiveArchiveCheckpoint.js');
const clone = value => structuredClone(value);
const jobs = values => Object.fromEntries(engine.TRIBE_JOBS.map(job => [job.id, values[job.id] || 0]));
const observable = value => { const out = clone(value); delete out.log; delete out.updatedAt; return out; };
const freeze = value => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };
const civicId = 'LIBERALISM';
function seeded(run) {
  let seed = 0x12345678, implicitSeed = 0x80000000;
  const draws = [], implicitDraws = [];
  const rng = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; const n = seed / 2 ** 32; draws.push(n); return n; };
  const original = Math.random;
  Math.random = () => { implicitSeed = (Math.imul(implicitSeed, 1664525) + 1013904223) >>> 0; const n = implicitSeed / 2 ** 32; implicitDraws.push(n); return n; };
  try { return { state: run(rng), draws, implicitDraws }; } finally { Math.random = original; }
}
function fixture(assignments = { forager: 2, scholar: 4 }) {
  const state = seeded(rng => engine.createNewState({ runId: 'education-regression', difficulty: 'easy', now: '2026-11-06T00:00:00.000Z', rng })).state;
  state.camp = { ...state.camp, fireLevel: 1, shelterLevel: 3, workbenchLevel: 1, fuel: 20 };
  state.weather = { id: 'clear', name: '검사 맑음', cold: 0, temp: 20, actionMod: 0 };
  state.inventory = { berry: 100, wood: 30, fiber: 30, stone: 20, paper: 8 };
  state.tribe.population = 6; state.tribe.assignments = jobs(assignments); state.tribe.autoAssignments = jobs({});
  const byId = new Map(engine.TECH_TREE.map(row => [row.id, row]));
  const civicIds = new Set(engine.CIVIC_TREE.map(row => row.id));
  const complete = id => { const row = byId.get(id); assert.ok(row, id); for (const prior of row.prereqs || []) complete(prior);
    (civicIds.has(id) ? state.civics : state.research).completed[id] = true; };
  for (const id of ['GATHERING', 'HUNTING', 'SETTLEMENT', 'FOOD_STORAGE', 'PUBLIC_EDUCATION', 'PAPERMAKING']) complete(id);
  for (const id of byId.get(civicId).prereqs || []) complete(id);
  delete state.civics.completed[civicId]; state.civics.selectedCivicId = civicId; state.civics.progress[civicId] = 0;
  state.research.selectedTechId = engine.TECHNOLOGY_TREE.find(row => !state.research.completed[row.id]
    && row.prereqs.every(id => state.research.completed[id] || state.civics.completed[id]))?.id || state.research.selectedTechId;
  assert.equal(engine.researchSystemStatus(state).unlocked, true);
  // Use the same civic-to-research completion mirror as restored/current runs.
  return seeded(() => engine.normalizeState(state)).state;
}
const configure = (state, teachers) => engine.configureTribeEducationAction(state, { teachers });
function morning(state) {
  const before = clone(state), next = seeded(rng => engine.advanceDay(state, { rng }));
  assert.deepEqual(state, before, 'Daily settlement must preserve its caller.');
  return next;
}
function receipt(state) { const r = state.tribe.lastProduction.education; assert.ok(r, 'An active plan must explain its settlement.'); return r; }
function assertReceipt(r) {
  assert.equal(r.generalScholars + r.teachers, r.scholarsAvailable);
  assert.equal(r.paperBefore - r.paperAfter, r.teachers);
  assert.equal(Number(r.spent.paper || 0), r.teachers);
  assert.equal(r.progressAfter - r.progressBefore, r.appliedPoints);
  assert.ok(r.appliedPoints >= 0 && r.appliedPoints <= r.requestedPoints);
  assert.ok(r.requestedPoints <= 2 * r.teachers);
  assert.ok(typeof r.reason === 'string' && r.reason.length > 0);
}
class Storage {
  values = new Map(); getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, String(value)); } removeItem(key) { this.values.delete(key); }
}
const savedAt = '2026-11-06T00:00:00.000Z';
function save(state, storage = new Storage(), owner = 'guest', revision = 0) {
  assert.equal(checkpoint.writeCheckpoint(storage, owner, state, { expectedRevision: revision, savedAt, forcePrevious: revision > 0 }).status, 'ready');
  return { storage, restored: engine.normalizeState(checkpoint.readCheckpoint(storage, owner).checkpoint.current) };
}
let checks = 0; const failures = [];
function check(name, run) { try { run(); checks++; console.log(`PASS ${name}`); }
  catch (error) { failures.push({ name, error: String(error.stack || error).slice(0, 1500) }); console.error(`FAIL ${name}: ${String(error.message).slice(0, 700)}`); } }

check('configuration and previews are pure, free, deterministic, and included in the tribe summary', () => {
  const state = freeze(fixture()), before = clone(state), original = Math.random;
  Math.random = () => { throw new Error('Education configuration or preview consumed RNG'); };
  try {
    const selected = configure(state, 2), expected = observable(state); expected.tribe.educationPlan = { teachers: 2 };
    assert.deepEqual(observable(selected), expected);
    const snapshot = clone(selected), summary = engine.tribeEducationSummary(selected);
    assert.deepEqual(engine.tribeEducationSummary(selected), summary);
    assert.deepEqual(selected, snapshot); assert.deepEqual(state, before);
    assert.equal(configure(selected, 2), selected);
    for (const teachers of [-1, 25, 0.5, NaN, Infinity, '2', null]) assert.equal(configure(selected, teachers), selected);
    const ended = freeze({ ...clone(selected), ended: true });
    assert.deepEqual(configure(ended, 1), ended); assert.equal(engine.advanceDay(ended), ended);
    assert.deepEqual(configure(selected, 0).tribe.educationPlan, { teachers: 0 });
  } finally { Math.random = original; }
  // Full tribe summaries already normalize the complete run and draw weather RNG.
  // Education must add no draws to that existing path.
  const selected = configure(state, 2), off = seeded(() => engine.tribeSummary(state)), on = seeded(() => engine.tribeSummary(selected));
  assert.deepEqual(on.state.education, engine.tribeEducationSummary(selected));
  assert.deepEqual(on.draws, off.draws); assert.deepEqual(on.implicitDraws, off.implicitDraws);
});

check('actual teachers spend paper once and cannot also produce general scholar RP', () => {
  const source = fixture(), baseline = morning(configure(source, 0)), school = morning(configure(source, 2));
  const r = receipt(school.state); assertReceipt(r); assert.equal(r.teachers, 2); assert.equal(r.appliedPoints, 4);
  assert.equal(r.civicId, civicId);
  assert.equal(school.state.tribe.lastProduction.researchRequested, baseline.state.tribe.lastProduction.researchRequested - r.teachers);
  assert.equal(school.state.inventory.paper, baseline.state.inventory.paper - r.teachers);
  for (const field of ['party', 'equipment', 'founderHistory', 'ancestralFaith', 'projectTradition', 'lineage', 'counters', 'meta', 'devTools']) {
    assert.deepEqual(school.state[field], baseline.state[field], `${field} cannot gain fabricated personal credit or penalties.`);
  }
  assert.equal(school.state.ap, baseline.state.ap); assert.deepEqual(school.draws, baseline.draws); assert.deepEqual(school.implicitDraws, baseline.implicitDraws);
});

check('paper and existing scholars bound actual teachers; fractional stock never purchases a partial teacher', () => {
  for (const paper of [0, 0.5, 1, 1.5, 2]) {
    const source = fixture(); source.inventory.paper = paper;
    const baseline = morning(configure(source, 0)).state, next = morning(configure(source, 4)).state, r = receipt(next);
    assertReceipt(r); assert.equal(r.teachers, Math.min(4, Math.floor(paper)));
    assert.equal(next.inventory.paper, baseline.inventory.paper - r.teachers);
    assert.equal(next.tribe.lastProduction.researchRequested, baseline.tribe.lastProduction.researchRequested - r.teachers);
  }
  const source = fixture({ forager: 5, scholar: 1 }), next = morning(configure(source, 4)).state;
  assert.equal(receipt(next).teachers, 1); assertReceipt(receipt(next));
});

check('explicit malformed raw paper never funds school or gets overwritten by paper processing', () => {
  for (const raw of [true, false, '2', [1], {}, null, undefined, NaN, Infinity, -1, Number.MAX_SAFE_INTEGER + 1]) {
    const source = configure(fixture({ forager: 2, scholar: 2, artisan: 2 }), 2);
    source.inventory.paper = raw;
    const before = clone(source), summary = engine.tribeEducationSummary(source);
    assert.equal(summary.paperStock, null); assert.equal(summary.teachers, 0);
    assert.equal(summary.expectedPoints, 0); assert.deepEqual(source, before);
    const next = morning(source).state, r = receipt(next);
    assert.equal(r.paperBefore, null); assert.equal(r.paperAfter, null);
    assert.equal(r.teachers, 0); assert.equal(r.appliedPoints, 0); assert.deepEqual(r.spent, {});
    assert.deepEqual(next.inventory.paper, raw, 'School cannot cast or replace malformed raw paper.');
    const selected = engine.configureTribeProcessAction(source, { actionId: 'paper', targetStock: 8 });
    const processSummary = engine.tribeProcessingSummary(selected);
    assert.equal(processSummary.currentStock, null); assert.equal(processSummary.expectedBatches, 0);
    const processed = morning(selected).state, process = processed.tribe.lastProduction.processing;
    assert.equal(process.batches, 0); assert.deepEqual(process.spent, {}); assert.deepEqual(process.gains, {});
    assert.deepEqual(processed.inventory.paper, raw, 'Paper processing cannot overwrite malformed output stock.');
    assert.equal(processed.inventory.wood, next.inventory.wood); assert.equal(processed.inventory.fiber, next.inventory.fiber);
    assert.deepEqual(source, before);
  }
  const omitted = configure(fixture(), 2); delete omitted.inventory.paper;
  assert.equal(engine.tribeEducationSummary(omitted).paperStock, 0);
});

check('remaining civic progress limits actual CP and prevents paying teachers for a completed target', () => {
  const source = fixture();
  for (const row of engine.CIVIC_TREE) if (row.id !== civicId) source.civics.completed[row.id] = true;
  const target = engine.CIVIC_TREE.find(row => row.id === civicId);
  source.civics.progress[civicId] = target.cost - 0.5;
  const next = morning(configure(source, 4)).state, r = receipt(next); assertReceipt(r);
  assert.equal(r.appliedPoints, 0.5); assert.equal(r.teachers, 1);
  assert.equal(r.spent.paper, 1); assert.equal(next.inventory.paper, source.inventory.paper - 1);
  const complete = clone(source); complete.civics.completed[civicId] = true;
  const baseline = morning(configure(complete, 0)).state, blocked = morning(configure(complete, 4)).state;
  assert.equal(receipt(blocked).teachers, 0); assert.equal(receipt(blocked).appliedPoints, 0);
  assert.equal(blocked.inventory.paper, baseline.inventory.paper);
  assert.equal(blocked.tribe.lastProduction.researchRequested, baseline.tribe.lastProduction.researchRequested);
});

check('locked civics and unavailable workers return to the existing research path', () => {
  const locked = fixture(); delete locked.civics.completed.PUBLIC_EDUCATION; delete locked.research.completed.PUBLIC_EDUCATION;
  assert.deepEqual(configure(locked, 1), locked);
  assert.deepEqual(configure(locked, 0).tribe.educationPlan, { teachers: 0 });
  for (const mutate of [s => { delete s.civics.completed.PUBLIC_EDUCATION; delete s.research.completed.PUBLIC_EDUCATION; },
    s => { s.tribe.assignments = jobs({ forager: 6 }); }, s => { s.camp.workbenchLevel = 0; }]) {
    const active = configure(fixture(), 2); mutate(active);
    const baseline = morning(configure(active, 0)).state, next = morning(active).state;
    assert.equal(receipt(next).teachers, 0); assert.equal(next.inventory.paper, baseline.inventory.paper);
    assert.equal(next.tribe.lastProduction.researchRequested, baseline.tribe.lastProduction.researchRequested);
  }
});

check('paper processing occurs after school and cannot fund that same morning', () => {
  const source = fixture({ forager: 2, scholar: 2, artisan: 2 }); source.inventory.paper = 0;
  const selected = engine.configureTribeProcessAction(configure(source, 2), { actionId: 'paper', targetStock: 8 });
  const baseline = morning(engine.configureTribeProcessAction(configure(source, 0), { actionId: 'paper', targetStock: 8 })).state;
  const first = morning(selected).state, firstReceipt = clone(receipt(first));
  assert.equal(firstReceipt.teachers, 0); assert.equal(firstReceipt.appliedPoints, 0);
  const process = first.tribe.lastProduction.processing;
  assert.equal(process.actionId, 'paper'); assert.ok(process.batches > 0);
  assert.equal(process.spent.wood, process.batches); assert.equal(process.spent.fiber, process.batches);
  assert.equal(process.gains.paper, process.batches * 2);
  assert.deepEqual(first.tribe.lastProduction.foodSpent, baseline.tribe.lastProduction.foodSpent);
  assert.deepEqual(first.lineage, baseline.lineage); assert.deepEqual(first.projectTradition, baseline.projectTradition);
  const second = morning(first).state; assert.ok(receipt(second).teachers > 0); assertReceipt(receipt(second));
  assert.deepEqual(first.tribe.lastProduction.education, firstReceipt);
});

check('omitted legacy plans equal explicit zero without inventing historical receipts', () => {
  const old = fixture(); delete old.tribe.educationPlan;
  const explicit = clone(old); explicit.tribe.educationPlan = { teachers: 0 };
  const a = morning(old), b = morning(explicit);
  assert.deepEqual(observable(a.state), observable(b.state)); assert.deepEqual(a.draws, b.draws); assert.deepEqual(a.implicitDraws, b.implicitDraws);
  assert.equal(Object.hasOwn(a.state.tribe.lastProduction, 'education'), false);
  const restored = save(old).restored;
  assert.deepEqual(restored.tribe.educationPlan, { teachers: 0 });
  assert.deepEqual(restored.tribe.lastProduction, engine.normalizeState(old).tribe.lastProduction);
});

check('daily tokens and actual save-resume preserve one education settlement per boundary', () => {
  const source = configure(fixture(), 2), token = { runId: source.runId, day: source.day, ap: source.ap, updatedAt: source.updatedAt };
  const first = seeded(rng => engine.runSettlementDayAction(source, token, { rng })); assertReceipt(receipt(first.state));
  const duplicate = seeded(rng => engine.runSettlementDayAction(first.state, token, { rng }));
  assert.equal(duplicate.state, first.state); assert.deepEqual(duplicate.draws, []); assert.deepEqual(duplicate.implicitDraws, []);
  const restored = save(source).restored, uninterrupted = morning(source), resumed = morning(restored);
  assert.deepEqual(observable(resumed.state), observable(uninterrupted.state));
  assert.deepEqual(resumed.draws, uninterrupted.draws); assert.deepEqual(resumed.implicitDraws, uninterrupted.implicitDraws);
  const settledRestore = save(first.state).restored;
  assert.deepEqual(settledRestore.tribe.lastProduction.education, first.state.tribe.lastProduction.education);
  const again = seeded(rng => engine.runSettlementDayAction(settledRestore, token, { rng }));
  assert.deepEqual(observable(again.state), observable(settledRestore)); assert.deepEqual(again.draws, []);
});

check('current, previous and distinct owners preserve plans, historical receipts and developer fairness', () => {
  const first = morning(configure(fixture(), 2)).state, originalReceipt = clone(receipt(first));
  const { storage } = save(first), second = configure(clone(first), 1);
  second.devTools = { ...second.devTools, enabled: false, used: true };
  save(second, storage, 'guest', 1); save(configure(fixture(), 3), storage, 'user:id:school-A');
  const loaded = checkpoint.readCheckpoint(storage, 'guest').checkpoint;
  assert.deepEqual(loaded.previous.tribe.lastProduction.education, originalReceipt);
  assert.equal(engine.normalizeState(loaded.current).devTools.used, true);
  const restored = checkpoint.restorePreviousCheckpoint(storage, 'guest', { expectedRevision: 2, savedAt });
  assert.equal(restored.status, 'ready'); assert.deepEqual(restored.checkpoint.current.tribe, first.tribe);
  assert.equal(checkpoint.readCheckpoint(storage, 'user:id:school-A').checkpoint.current.tribe.educationPlan.teachers, 3);
  assert.equal(checkpoint.readCheckpoint(storage, 'user:id:school-B').status, 'missing');
  const historic = clone(first); historic.tribe.population = 1; historic.tribe.assignments = jobs({ scholar: 1 }); historic.tribe.educationPlan = { teachers: 0 };
  assert.deepEqual(save(historic).restored.tribe.lastProduction.education, originalReceipt);
});

check('malformed plans and receipts fail closed while preserving exact stored bytes', () => {
  const valid = morning(configure(fixture(), 2)).state, { storage } = save(valid), key = checkpoint.checkpointStorageKey('guest'), bytes = storage.getItem(key);
  const mutations = [s => { s.tribe.educationPlan = null; }, s => { s.tribe.educationPlan = {}; },
    ...[-1, 25, 0.5, NaN, Infinity, '1', null].map(n => s => { s.tribe.educationPlan.teachers = n; }),
    s => { s.tribe.educationPlan.extra = true; }, s => { s.tribe.lastProduction.education = null; },
    s => { s.tribe.lastProduction.education.spent.paper = -1; }, s => { s.tribe.lastProduction.education.teachers = 1.5; },
    s => { s.tribe.lastProduction.education.progressAfter += 1; }, s => { s.tribe.lastProduction.education.paperAfter += 1; },
    s => { s.tribe.lastProduction.education.civicId = 'missing'; }, s => { s.tribe.lastProduction.education.extra = true; }];
  for (const mutate of mutations) {
    const invalid = clone(valid); mutate(invalid);
    assert.equal(checkpoint.isValidRunState(invalid), false);
    assert.throws(() => engine.normalizeState(invalid), RangeError);
    assert.equal(checkpoint.writeCheckpoint(storage, 'guest', invalid, { expectedRevision: 1, savedAt }).status, 'invalid-state');
    assert.equal(storage.getItem(key), bytes);
  }
  save(configure(clone(valid), 1), storage, 'guest', 1);
  const healthy = storage.getItem(key);
  for (const position of ['current', 'previous']) {
    const envelope = JSON.parse(healthy); envelope[position].tribe.educationPlan = null;
    const corrupt = JSON.stringify(envelope); storage.setItem(key, corrupt);
    assert.equal(checkpoint.readCheckpoint(storage, 'guest').status, 'corrupt');
    assert.equal(checkpoint.writeCheckpoint(storage, 'guest', valid, { expectedRevision: 2, savedAt }).status, 'corrupt');
    assert.equal(checkpoint.restorePreviousCheckpoint(storage, 'guest', { expectedRevision: 2, savedAt }).status, 'corrupt');
    assert.equal(storage.getItem(key), corrupt);
  }
});

console.log(JSON.stringify({ checks, pass: failures.length === 0, failures }));
if (failures.length) process.exitCode = 1;
