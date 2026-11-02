import assert from 'node:assert/strict';
import './lib/register-simulation-modules.mjs';
const engine = await import('../src/app/games/primitive-archive/_lib/primitiveArchiveEngine.js');
const checkpoint = await import('../src/app/games/primitive-archive/_lib/primitiveArchiveCheckpoint.js');
const clone = value => structuredClone(value);
const jobs = values => Object.fromEntries(engine.TRIBE_JOBS.map(job => [job.id, values[job.id] || 0]));
const owner = 'guest', savedAt = '2026-11-02T00:00:00.000Z';
const key = checkpoint.checkpointStorageKey(owner);
class Storage {
  values = new Map();
  fail = false;
  getItem(id) { return this.values.get(id) ?? null; }
  setItem(id, value) { if (this.fail) throw new Error('quota'); this.values.set(id, String(value)); }
  removeItem(id) { this.values.delete(id); }
}
function fixture(unlocked = true) {
  const state = engine.createNewState({ runId: 'work-policy-checkpoint', now: savedAt, rng: () => 0.5 });
  state.camp = { ...state.camp, fireLevel: 1, shelterLevel: 3, workbenchLevel: 1, fuel: 10 };
  state.weather = { id: 'clear', name: '검사 맑음', cold: 0, temp: 20, actionMod: 0 };
  state.inventory = { berry: 100, wood: 30, fiber: 20, stone: 20 };
  state.tribe.population = 6;
  state.tribe.assignments = jobs({}); state.tribe.autoAssignments = jobs({});
  state.research.completed = { ...state.research.completed, GATHERING: true, HUNTING: true, SETTLEMENT: true,
    FOOD_STORAGE: true, WRITING: true, ...(unlocked ? { STATE_WORKFORCE: true } : {}) };
  if (unlocked) state.civics.completed.STATE_WORKFORCE = true;
  state.research.selectedTechId = 'STONE_TOOLS';
  return engine.normalizeState(state);
}
function roundTrip(state) {
  const storage = new Storage();
  assert.equal(checkpoint.writeCheckpoint(storage, owner, state, { expectedRevision: 0, savedAt }).status, 'ready');
  const loaded = checkpoint.readCheckpoint(storage, owner);
  assert.equal(loaded.status, 'ready');
  return { storage, restored: engine.normalizeState(loaded.checkpoint.current) };
}
let checks = 0;
const failures = [];
function check(name, run) {
  try { run(); checks++; console.log(`PASS ${name}`); }
  catch (error) { failures.push(name); console.error(`FAIL ${name}: ${String(error.message).slice(0, 700)}`); }
}

check('an absent old-save field restores balanced without changing manual jobs, stock, original history or current progress', () => {
  const source = fixture();
  delete source.tribe.workPolicy;
  source.tribe.assignments = jobs({ forager: 3, builder: 1, scholar: 2 });
  delete source.tribe.autoAssignments;
  const before = clone(source);
  const { restored } = roundTrip(source);
  assert.equal(restored.tribe.workPolicy, 'balanced');
  assert.deepEqual(restored.tribe.assignments, before.tribe.assignments);
  assert.deepEqual(restored.tribe.autoAssignments, jobs({}));
  for (const field of ['inventory', 'party', 'projects', 'research', 'civics', 'founderHistory', 'lineage', 'projectTradition', 'meta']) {
    assert.deepEqual(restored[field], before[field]);
  }
  assert.equal(restored.ap, before.ap); assert.equal(restored.day, before.day);
  assert.deepEqual(source, before);
});

check('each explicit preference survives storage without work until the real morning allocation', () => {
  for (const id of ['construction', 'research']) {
    const source = fixture(), selected = engine.changeTribeWorkPolicyAction(source, id);
    const { restored } = roundTrip(selected);
    assert.equal(restored.tribe.workPolicy, id);
    assert.deepEqual(restored.tribe.assignments, source.tribe.assignments);
    assert.deepEqual(restored.inventory, source.inventory);
    assert.deepEqual(restored.projects, source.projects);
    assert.deepEqual(restored.research, source.research);
    assert.deepEqual(restored.meta, source.meta);
    assert.equal(restored.ap, source.ap); assert.equal(restored.day, source.day);
    const next = engine.advanceDay(restored, { rng: () => 0.5 });
    assert.equal(next.tribe.lastProduction.workPolicy, id);
    assert.equal(id === 'construction' ? next.tribe.lastProduction.projectWork : next.tribe.lastProduction.researchPoints,
      id === 'construction' ? 5 : 6);
  }
});

check('explicit invalid values are rejected by both engine and checkpoint before overwriting protected bytes', () => {
  const source = fixture(), { storage } = roundTrip(source);
  const original = storage.getItem(key);
  for (const value of [null, '', 'construction ', 'missing', 1, false, {}, [], { id: 'research' }]) {
    const invalid = clone(source); invalid.tribe.workPolicy = value;
    assert.equal(checkpoint.isValidRunState(invalid), false);
    assert.throws(() => engine.normalizeState(invalid), RangeError);
    assert.equal(checkpoint.writeCheckpoint(storage, owner, invalid, { expectedRevision: 1, savedAt }).status, 'invalid-state');
    assert.equal(storage.getItem(key), original);
  }
});

check('a corrupt stored policy preserves its exact bytes and prevents replacement with an apparently clean run', () => {
  const source = fixture(), { storage } = roundTrip(source);
  const envelope = JSON.parse(storage.getItem(key));
  envelope.current.tribe.workPolicy = 'invalid-stored-policy';
  const corrupt = JSON.stringify(envelope);
  storage.setItem(key, corrupt);
  assert.equal(checkpoint.readCheckpoint(storage, owner).status, 'corrupt');
  assert.equal(checkpoint.writeCheckpoint(storage, owner, source, { expectedRevision: 1, savedAt }).status, 'corrupt');
  assert.equal(storage.getItem(key), corrupt);
});

check('changing a later policy or manual job never rewrites the completed morning receipt', () => {
  const built = engine.advanceDay(engine.changeTribeWorkPolicyAction(fixture(), 'construction'), { rng: () => 0.5 });
  const receipt = clone(built.tribe.lastProduction);
  assert.equal(receipt.assignments.builder, 5);
  let changed = engine.changeTribeWorkPolicyAction(built, 'research');
  changed = engine.adjustTribeJobAction(changed, 'builder', -1);
  changed = engine.adjustTribeJobAction(changed, 'forager', 1);
  assert.equal(changed.tribe.workPolicy, 'research');
  assert.equal(changed.tribe.assignments.builder, 4);
  assert.deepEqual(changed.tribe.lastProduction, receipt);
  const { restored } = roundTrip(changed);
  assert.equal(restored.tribe.workPolicy, 'research');
  assert.equal(restored.tribe.lastProduction.workPolicy, 'construction');
  assert.deepEqual(restored.tribe.lastProduction.assignments, receipt.assignments);
  assert.deepEqual(built.tribe.lastProduction, receipt);
});

check('old receipts preserve either missing field without inventing a past choice or past workforce', () => {
  const built = engine.advanceDay(engine.changeTribeWorkPolicyAction(fixture(), 'construction'), { rng: () => 0.5 });
  for (const omitted of [['workPolicy', 'assignments'], ['workPolicy'], ['assignments']]) {
    const source = engine.changeTribeWorkPolicyAction(clone(built), 'research');
    for (const field of omitted) delete source.tribe.lastProduction[field];
    const receipt = clone(source.tribe.lastProduction);
    const { restored } = roundTrip(source);
    assert.deepEqual(restored.tribe.lastProduction, receipt);
    for (const field of omitted) assert.equal(Object.hasOwn(restored.tribe.lastProduction, field), false);
    assert.equal(restored.tribe.workPolicy, 'research');
  }
});

check('past actual staffing survives a later real worker reduction and a different selected policy', () => {
  const built = engine.advanceDay(engine.changeTribeWorkPolicyAction(fixture(), 'construction'), { rng: () => 0.5 });
  const receipt = clone(built.tribe.lastProduction);
  let later = engine.prepareSuccessorAction(built, built.party[0].id, { rng: () => 0.5 });
  later = engine.prepareSuccessorAction(later, later.party[1].id, { rng: () => 0.5 });
  later = engine.changeTribeWorkPolicyAction(later, 'research');
  assert.equal(later.tribe.population, 4);
  assert.equal(Object.values(receipt.assignments).reduce((sum, count) => sum + count, 0), 6);
  const { restored } = roundTrip(later);
  assert.equal(restored.tribe.population, 4);
  assert.equal(restored.tribe.workPolicy, 'research');
  assert.equal(restored.tribe.lastProduction.workPolicy, 'construction');
  assert.deepEqual(restored.tribe.lastProduction, receipt);
  assert.deepEqual(built.tribe.lastProduction, receipt);
});

check('malformed new receipt fields reject writes and preserve corrupt stored bytes without weakening old receipts', () => {
  const source = engine.advanceDay(engine.changeTribeWorkPolicyAction(fixture(), 'construction'), { rng: () => 0.5 });
  const { storage } = roundTrip(source);
  const original = storage.getItem(key);
  const mutations = [
    receipt => { receipt.workPolicy = undefined; },
    receipt => { receipt.workPolicy = null; },
    receipt => { receipt.workPolicy = 'missing'; },
    receipt => { receipt.assignments = undefined; },
    receipt => { receipt.assignments = null; },
    receipt => { receipt.assignments = []; },
    receipt => { receipt.assignments = { unsupported: 1 }; },
    receipt => { receipt.assignments = { builder: '2' }; },
    receipt => { receipt.assignments = { builder: 1.5 }; },
    receipt => { receipt.assignments = { builder: -1 }; },
    receipt => { receipt.assignments = { builder: 25 }; },
    receipt => { receipt.assignments = { forager: 24, scholar: 1 }; },
    receipt => { receipt.assignments = { scholar: NaN }; },
    receipt => { receipt.assignments = { scholar: Infinity }; },
  ];
  for (const mutate of mutations) {
    const invalid = clone(source); mutate(invalid.tribe.lastProduction);
    assert.equal(checkpoint.isValidRunState(invalid), false);
    assert.throws(() => engine.normalizeState(invalid), RangeError);
    assert.equal(checkpoint.writeCheckpoint(storage, owner, invalid, { expectedRevision: 1, savedAt }).status, 'invalid-state');
    assert.equal(storage.getItem(key), original);
  }
  const envelope = JSON.parse(original);
  envelope.current.tribe.lastProduction.assignments = { unsupported: 1 };
  const corrupt = JSON.stringify(envelope); storage.setItem(key, corrupt);
  assert.equal(checkpoint.readCheckpoint(storage, owner).status, 'corrupt');
  assert.equal(checkpoint.writeCheckpoint(storage, owner, source, { expectedRevision: 1, savedAt }).status, 'corrupt');
  assert.equal(storage.getItem(key), corrupt);
});

check('quota failures and new-run replacement keep the previous preference recoverable and the new run balanced', () => {
  const selected = engine.changeTribeWorkPolicyAction(fixture(), 'construction');
  const { storage } = roundTrip(selected);
  const original = storage.getItem(key);
  storage.fail = true;
  const research = engine.changeTribeWorkPolicyAction(selected, 'research');
  assert.equal(checkpoint.writeCheckpoint(storage, owner, research, { expectedRevision: 1, savedAt }).status, 'unavailable');
  assert.equal(storage.getItem(key), original);
  storage.fail = false;
  const next = engine.createNewState({ runId: 'work-policy-new-run', now: savedAt, rng: () => 0.5 });
  assert.equal(checkpoint.writeCheckpoint(storage, owner, next, { expectedRevision: 1, savedAt }).status, 'ready');
  const loaded = checkpoint.readCheckpoint(storage, owner).checkpoint;
  assert.equal(loaded.current.tribe.workPolicy, 'balanced');
  assert.equal(loaded.previous.tribe.workPolicy, 'construction');
  const recovered = checkpoint.restorePreviousCheckpoint(storage, owner, { expectedRevision: 2, savedAt });
  assert.equal(recovered.status, 'ready');
  assert.equal(recovered.checkpoint.current.tribe.workPolicy, 'construction');
  assert.deepEqual(recovered.checkpoint.current.projects, selected.projects);
});

check('locked and ended preferences cannot buy progression or revive a run across a save cycle', () => {
  const source = fixture(false);
  const blocked = engine.changeTribeWorkPolicyAction(source, 'research');
  assert.equal(roundTrip(blocked).restored.tribe.workPolicy, 'balanced');
  const ended = { ...engine.changeTribeWorkPolicyAction(fixture(), 'construction'), ended: true };
  const restored = roundTrip(ended).restored;
  const repeated = engine.changeTribeWorkPolicyAction(restored, 'research');
  assert.equal(repeated.tribe.workPolicy, 'construction');
  assert.deepEqual(engine.advanceDay(repeated), repeated);
  assert.deepEqual(repeated.inventory, ended.inventory);
  assert.deepEqual(repeated.research, ended.research);
  assert.deepEqual(repeated.meta, ended.meta);
});

console.log(JSON.stringify({ passed: failures.length === 0, checks, failures,
  scope: 'Real optional-state validation and isolated in-memory checkpoint round trips, quota failure and previous-run recovery. No account writes or browser persistence claim.' }));
if (failures.length) process.exitCode = 1;
