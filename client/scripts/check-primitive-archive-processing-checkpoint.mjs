import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import './lib/register-simulation-modules.mjs';
const engine = await import('../src/app/games/primitive-archive/_lib/primitiveArchiveEngine.js');
const data = await import('../src/app/games/primitive-archive/_lib/primitiveArchiveData.js');
const checkpoint = await import('../src/app/games/primitive-archive/_lib/primitiveArchiveCheckpoint.js');
const processing = await import('../src/app/games/primitive-archive/_lib/primitiveArchiveProcessing.js');
const clone = value => structuredClone(value);
const savedAt = '2026-11-05T00:00:00.000Z';
const owner = 'guest';
const key = checkpoint.checkpointStorageKey(owner);
class Storage {
  values = new Map();
  fail = false;
  getItem(id) { return this.values.get(id) ?? null; }
  setItem(id, value) { if (this.fail) throw new Error('quota'); this.values.set(id, String(value)); }
  removeItem(id) { this.values.delete(id); }
}
function fixture(runId = 'processing-checkpoint') {
  const state = engine.createNewState({ runId, now: savedAt, rng: () => 0.5 });
  state.camp = { ...state.camp, fireLevel: 1, shelterLevel: 3, workbenchLevel: 1, fuel: 10 };
  state.weather = { id: 'clear', name: '검사 맑음', cold: 0, temp: 20, actionMod: 0 };
  state.inventory = { berry: 100, grain: 12, wood: 30, fiber: 20, stone: 20 };
  state.research.completed = { ...state.research.completed, SETTLEMENT: true, FOOD_STORAGE: true, WATERMILL: true };
  state.tribe.assignments = Object.fromEntries(engine.TRIBE_JOBS.map(job => [job.id, job.id === 'artisan' ? 2 : 0]));
  state.tribe.autoAssignments = Object.fromEntries(engine.TRIBE_JOBS.map(job => [job.id, 0]));
  state.tribe.processingPlan = { actionId: 'mill', targetStock: 4 };
  return state;
}
function roundTrip(source, storage = new Storage(), ownerKey = owner, revision = 0) {
  assert.equal(checkpoint.writeCheckpoint(storage, ownerKey, source, { expectedRevision: revision, savedAt }).status, 'ready');
  const loaded = checkpoint.readCheckpoint(storage, ownerKey);
  assert.equal(loaded.status, 'ready');
  return { storage, restored: engine.normalizeState(loaded.checkpoint.current) };
}
const receipt = () => ({ actionId: 'mill', targetStock: 4, workers: 2, batches: 2,
  stockBefore: 0, stockAfter: 4, spent: { grain: 6 }, gains: { milled_grain: 4 }, reason: '가공대가 실제 재료로 제분했습니다.' });
let checks = 0;
const failures = [];
async function check(name, run) {
  try { await run(); checks++; console.log('PASS ' + name); }
  catch (error) { failures.push(name); console.error('FAIL ' + name + ': ' + String(error.stack || error).slice(0, 1700)); }
}

await check('legacy omission defaults only the current plan and zero artisan without inventing historical processing', () => {
  const source = fixture();
  delete source.tribe.processingPlan; delete source.tribe.assignments.artisan; delete source.tribe.autoAssignments.artisan;
  source.tribe.lastProduction = { day: 1, gains: { berry: 2 }, assignments: { forager: 2 } };
  const before = clone(source), { restored } = roundTrip(source);
  assert.deepEqual(restored.tribe.processingPlan, { actionId: '', targetStock: 0 });
  assert.equal(restored.tribe.assignments.artisan, 0); assert.equal(restored.tribe.autoAssignments.artisan, 0);
  assert.deepEqual(restored.tribe.lastProduction, before.tribe.lastProduction);
  for (const field of ['inventory', 'party', 'projects', 'research', 'civics', 'founderHistory', 'lineage', 'projectTradition', 'meta']) {
    assert.deepEqual(restored[field], engine.normalizeState(before)[field]);
  }
  assert.equal(restored.day, before.day); assert.equal(restored.ap, before.ap); assert.deepEqual(source, before);
});

await check('current, previous and distinct owners retain their own plans and receipts through recovery', () => {
  const first = fixture('processing-first'); first.tribe.lastProduction.processing = receipt();
  const { storage } = roundTrip(first);
  const second = fixture('processing-second'); second.tribe.processingPlan = { actionId: 'weave', targetStock: 3 };
  roundTrip(second, storage, owner, 1);
  const stored = checkpoint.readCheckpoint(storage, owner).checkpoint;
  assert.deepEqual(stored.current.tribe.processingPlan, second.tribe.processingPlan);
  assert.deepEqual(stored.previous.tribe.lastProduction, first.tribe.lastProduction);
  const other = fixture('processing-account'); other.tribe.processingPlan = { actionId: '', targetStock: 0 };
  roundTrip(other, storage, 'user:id:account-A');
  const recovered = checkpoint.restorePreviousCheckpoint(storage, owner, { expectedRevision: 2, savedAt });
  assert.equal(recovered.status, 'ready'); assert.deepEqual(recovered.checkpoint.current.tribe, first.tribe);
  assert.deepEqual(checkpoint.readCheckpoint(storage, 'user:id:account-A').checkpoint.current.tribe, other.tribe);
  assert.equal(checkpoint.readCheckpoint(storage, 'user:id:account-B').status, 'missing');
});

await check('explicit malformed plans and artisan counts fail before an existing checkpoint can change', () => {
  const source = fixture(), { storage } = roundTrip(source), original = storage.getItem(key);
  const invalidPlans = [undefined, null, [], {}, { actionId: 'mill' }, { actionId: '', targetStock: 1 },
    { actionId: 'mill', targetStock: 0 }, { actionId: 'other', targetStock: 1 }, { actionId: 'mill', targetStock: '1' },
    ...[-1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1].map(targetStock => ({ actionId: 'mill', targetStock })),
    { actionId: 'mill', targetStock: 1, workers: 2 }];
  const invalidStates = invalidPlans.map(plan => { const s = clone(source); s.tribe.processingPlan = plan; return s; });
  for (const count of [undefined, null, '1', -1, 1.5, NaN, Infinity, 25]) {
    const s = clone(source); s.tribe.assignments.artisan = count; invalidStates.push(s);
  }
  for (const count of [undefined, null, '0', 0.5, 1, -1, NaN]) {
    const s = clone(source); s.tribe.autoAssignments.artisan = count; invalidStates.push(s);
  }
  for (const field of ['assignments', 'autoAssignments']) {
    const s = clone(source); s.tribe[field] = []; s.tribe[field].artisan = '1'; invalidStates.push(s);
  }
  for (const invalid of invalidStates) {
    assert.equal(checkpoint.isValidRunState(invalid), false);
    assert.throws(() => engine.normalizeState(invalid), RangeError);
    assert.equal(checkpoint.writeCheckpoint(storage, owner, invalid, { expectedRevision: 1, savedAt }).status, 'invalid-state');
    assert.equal(storage.getItem(key), original);
  }
});

await check('historical processing remains immutable after later population, assignment, plan and recipe changes', () => {
  const source = fixture(); source.tribe.lastProduction.processing = receipt();
  const historic = clone(source.tribe.lastProduction);
  source.tribe.population = 1; source.tribe.assignments.artisan = 1;
  source.tribe.processingPlan = { actionId: '', targetStock: 0 };
  assert.deepEqual(roundTrip(source).restored.tribe.lastProduction, historic);
  // Validation preserves historical amounts instead of checking today's ratios.
  const oldRatio = receipt(); oldRatio.spent = { grain: 7 }; oldRatio.gains.milled_grain = 5; oldRatio.stockAfter = 5;
  assert.equal(processing.isValidTribeProcessingReceipt(oldRatio), true);
  assert.deepEqual(source.tribe.lastProduction, historic);
});

await check('malformed processing receipts reject writes without erasing legacy receipt omissions', () => {
  const source = fixture(), { storage } = roundTrip(source), original = storage.getItem(key);
  const mutations = [r => { r.workers = 25; }, r => { r.batches = 3; }, r => { r.stockAfter = 3; },
    r => { r.workers = 1.5; }, r => { r.batches = 1.5; }, r => { r.targetStock = 4.5; },
    r => { r.spent.grain = -1; }, r => { r.gains.milled_grain = NaN; }, r => { r.spent = []; },
    r => { r.spent.grain = 1.5; }, r => { r.gains.milled_grain = 4.5; r.stockAfter = 4.5; },
    r => { r.stockBefore = null; }, r => { r.stockAfter = null; },
    r => { r.stockBefore = null; r.stockAfter = null; },
    r => { r.stockBefore = -0.5; r.stockAfter = 3.5; },
    r => { r.stockBefore = Infinity; r.stockAfter = Infinity; },
    r => { r.stockBefore = Number.MAX_SAFE_INTEGER + 1; r.stockAfter = Number.MAX_SAFE_INTEGER + 1; },
    r => { r.gains.extra_output = 1; }, r => { r.reason = ''; }, r => { r.reason = 'x'.repeat(301); },
    r => { r.reason = 'line\nbreak'; }, r => { r.extra = 1; }, r => { r.batches = 0; }];
  const invalidReceipts = [undefined, null, [], {}, ...mutations.map(mutate => { const r = receipt(); mutate(r); return r; })];
  for (const invalidReceipt of invalidReceipts) {
    const invalid = clone(source); invalid.tribe.lastProduction.processing = invalidReceipt;
    assert.equal(checkpoint.isValidRunState(invalid), false);
    assert.throws(() => data.normalizeTribeState(invalid.tribe), RangeError);
    assert.equal(checkpoint.writeCheckpoint(storage, owner, invalid, { expectedRevision: 1, savedAt }).status, 'invalid-state');
    assert.equal(storage.getItem(key), original);
  }
  assert.equal(checkpoint.isValidRunState(source), true);
});

await check('corrupt current or previous processing preserves exact stored bytes and blocks replacement and recovery', () => {
  for (const position of ['current', 'previous']) {
    const source = fixture('corrupt-first'), { storage } = roundTrip(source);
    roundTrip(fixture('corrupt-second'), storage, owner, 1);
    const envelope = JSON.parse(storage.getItem(key)); envelope[position].tribe.processingPlan = null;
    const corrupt = JSON.stringify(envelope); storage.setItem(key, corrupt);
    assert.equal(checkpoint.readCheckpoint(storage, owner).status, 'corrupt');
    assert.equal(checkpoint.writeCheckpoint(storage, owner, source, { expectedRevision: 2, savedAt }).status, 'corrupt');
    assert.equal(checkpoint.restorePreviousCheckpoint(storage, owner, { expectedRevision: 2, savedAt }).status, 'corrupt');
    assert.equal(storage.getItem(key), corrupt);
  }
});

await check('quota and stale revisions keep the exact current and previous snapshots intact', () => {
  const source = fixture(), { storage } = roundTrip(source), original = storage.getItem(key);
  const changed = fixture('replacement');
  storage.fail = true;
  assert.equal(checkpoint.writeCheckpoint(storage, owner, changed, { expectedRevision: 1, savedAt }).status, 'unavailable');
  assert.equal(storage.getItem(key), original); storage.fail = false;
  assert.equal(checkpoint.writeCheckpoint(storage, owner, changed, { expectedRevision: 0, savedAt }).status, 'conflict');
  assert.equal(storage.getItem(key), original);
});

await check('same-object mutation is observed on every normalization and never mutates earlier normalized plans', () => {
  const source = fixture(), before = clone(source), normalized = engine.normalizeState(source);
  assert.deepEqual(source, before);
  source.tribe.processingPlan.targetStock = 8;
  assert.equal(engine.normalizeState(source).tribe.processingPlan.targetStock, 8);
  assert.equal(normalized.tribe.processingPlan.targetStock, 4);
  source.tribe.processingPlan.targetStock = -1;
  assert.throws(() => engine.normalizeState(source), RangeError);
  source.tribe.processingPlan.targetStock = 4;
  source.tribe.lastProduction.processing = receipt(); engine.normalizeState(source);
  source.tribe.lastProduction.processing.gains.milled_grain = 3;
  assert.throws(() => engine.normalizeState(source), RangeError);
});

await check('the real morning processing receipt survives checkpoint round trip without repeating production', () => {
  const source = fixture(), next = engine.advanceDay(source, { rng: () => 0.5 });
  const actual = next.tribe.lastProduction.processing;
  assert.ok(actual, 'Real morning must write a processing receipt');
  assert.equal(actual.actionId, 'mill'); assert.equal(actual.workers, 2); assert.equal(actual.batches, 2);
  assert.equal(actual.stockBefore, 0); assert.equal(actual.stockAfter, 4);
  assert.deepEqual(actual.spent, { grain: 6 }); assert.deepEqual(actual.gains, { milled_grain: 4 });
  const { restored } = roundTrip(next);
  assert.deepEqual(restored.tribe.lastProduction.processing, actual);
  assert.deepEqual(restored.inventory, next.inventory); assert.equal(restored.day, next.day); assert.equal(restored.ap, next.ap);
  assert.equal(source.inventory.grain, 12);
});

await check('legacy fractional output stock is observed exactly and remains valid through actual processing and checkpoint restoration', () => {
  for (const stock of [0.5, 0.3]) {
    const source = fixture('legacy-fraction-' + stock);
    source.research.completed.POTTERY = true;
    source.tribe.processingPlan = { actionId: 'kiln', targetStock: 2 };
    source.inventory.pottery = stock; source.inventory.clay = 10;
    const before = clone(source);
    assert.equal(checkpoint.isValidRunState(source), true);
    const next = engine.advanceDay(source, { rng: () => 0.5 });
    const actual = next.tribe.lastProduction.processing;
    assert.equal(actual.stockBefore, stock); assert.equal(actual.stockAfter, stock + 2);
    assert.equal(actual.batches, 1); assert.deepEqual(actual.spent, { clay: 2, wood: 1 });
    assert.deepEqual(actual.gains, { pottery: 2 });
    assert.equal(checkpoint.isValidRunState(next), true);
    const { restored } = roundTrip(next);
    assert.deepEqual(restored.tribe.lastProduction.processing, actual);
    assert.equal(restored.inventory.pottery, stock + 2);
    assert.deepEqual(source, before);
  }
});

await check('unusable selected stock is explicitly unobserved and unusable materials stop processing without changing existing morning inventory', () => {
  for (const field of ['pottery', 'clay']) {
    for (const amount of ['bad', NaN, Infinity, -1, Number.MAX_SAFE_INTEGER + 1]) {
      const source = fixture('unusable-stock-' + field);
      source.research.completed.POTTERY = true;
      source.tribe.processingPlan = { actionId: 'kiln', targetStock: 10 };
      source.inventory.pottery = 0; source.inventory.clay = 10; source.inventory[field] = amount;
      const before = clone(source), off = clone(source); off.tribe.processingPlan = { actionId: '', targetStock: 0 };
      const baseline = engine.advanceDay(off, { rng: () => 0.5 });
      const next = engine.advanceDay(source, { rng: () => 0.5 });
      const actual = next.tribe.lastProduction.processing;
      assert.equal(actual.batches, 0, field + ':' + String(amount));
      assert.deepEqual(actual.spent, {}); assert.deepEqual(actual.gains, {}); assert.ok(actual.reason.trim());
      assert.equal(actual.stockBefore, field === 'pottery' ? null : 0);
      assert.equal(actual.stockAfter, field === 'pottery' ? null : 0);
      assert.equal(processing.isValidTribeProcessingReceipt(actual), true);
      assert.equal(checkpoint.isValidRunState(next), true);
      assert.deepEqual(next.inventory, baseline.inventory);
      assert.deepEqual(source, before);
    }
  }
  const unobserved = { ...receipt(), workers: 1, batches: 0, stockBefore: null, stockAfter: null,
    spent: {}, gains: {}, reason: '산출품 재고 수량을 확인할 수 없어 가공하지 않았습니다.' };
  assert.equal(processing.isValidTribeProcessingReceipt(unobserved), true);
  for (const patch of [
    { stockBefore: 0 }, { stockAfter: 0 }, { batches: 1 }, { spent: { grain: 3 } }, { gains: { milled_grain: 2 } },
    { actionId: '', targetStock: 0 },
  ]) assert.equal(processing.isValidTribeProcessingReceipt({ ...unobserved, ...patch }), false);
});

await check('legacy numeric conversion keeps string and null stock compatible with existing resource helpers', () => {
  for (const field of ['pottery', 'clay']) {
    for (const amount of ['2', null]) {
      const source = fixture('converted-stock-' + field);
      source.research.completed.POTTERY = true;
      source.tribe.processingPlan = { actionId: 'kiln', targetStock: 10 };
      source.inventory.pottery = 0; source.inventory.clay = 10; source.inventory[field] = amount;
      const before = clone(source), next = engine.advanceDay(source, { rng: () => 0.5 });
      const actual = next.tribe.lastProduction.processing;
      const batches = field === 'pottery' ? 2 : amount === null ? 0 : 1;
      const stockBefore = field === 'pottery' ? Number(amount ?? 0) : 0;
      assert.equal(actual.batches, batches); assert.equal(actual.stockBefore, stockBefore);
      assert.equal(actual.stockAfter, stockBefore + batches * 2);
      assert.equal(checkpoint.isValidRunState(next), true);
      assert.deepEqual(roundTrip(next).restored.tribe.lastProduction.processing, actual);
      assert.deepEqual(source, before);
    }
  }
});

// Run the actual persistence hook with controlled API and authentication inputs.
// This exercises its handoff guards, not browser storage or a live account.
const hookUrl = new URL('../src/app/games/primitive-archive/_hooks/usePrimitiveArchivePersistence.js', import.meta.url).href;
let serverHarness;
const reactStub = `export const useState = value => [value, () => {}]; export const useRef = value => ({current:value});`;
const apiStub = `const h=()=>globalThis.__processingServerHarness;
export const captureAuthSession=()=>h().session; export const isCurrentAuthSession=s=>s===h().session;
export const clearApiGetCache=()=>{}; export const updateStoredUser=()=>{};
export const apiGet=(...args)=>h().get(...args); export const apiPut=(...args)=>h().put(...args); export const apiPost=()=>{throw Error('Unexpected record write');};`;
registerHooks({ resolve(specifier, context, nextResolve) {
  if (context.parentURL === hookUrl && ['react', '../../../../utils/api'].includes(specifier)) {
    return { url: 'data:text/javascript,' + encodeURIComponent(specifier === 'react' ? reactStub : apiStub), shortCircuit: true };
  }
  return nextResolve(specifier, context);
} });
const { default: invokePersistence } = await import(hookUrl);
function serverView(current, payload = fixture('server-saved')) {
  const calls = { replacements: [], state: [], results: [], messages: [], puts: [] };
  const ref = { current };
  serverHarness = { session: {}, get: async url => url.includes('?gameSlug=')
    ? { saves: [{ slotKey: engine.QUICK_SAVE_SLOT, id: 'fixture-slot' }] }
    : { save: { version: engine.SAVE_VERSION, payload: { state: clone(payload) } } },
  put: async (_url, body) => { calls.puts.push(clone(body)); } };
  globalThis.__processingServerHarness = serverHarness;
  const storage = new Storage(); roundTrip(current, storage);
  const hook = invokePersistence({ latestStateRef: ref, state: current, token: 'fixture-token',
    replaceRun: next => { calls.replacements.push(next); return checkpoint.writeCheckpoint(storage, owner, next, { expectedRevision: 1, forcePrevious: true, savedAt }); },
    setState: next => calls.state.push(next), setActionResult: value => calls.results.push(value),
    setNewRunDifficulty: () => {}, showToast: value => calls.messages.push(value) });
  return { hook, calls, ref, storage, harness: serverHarness };
}
await check('actual server save/load handoff preserves plans, processing receipts and the protected previous run', async () => {
  const source = fixture(); source.tribe.lastProduction.processing = receipt();
  const view = serverView(source, source); await view.hook.saveRun();
  assert.deepEqual(view.calls.puts[0].payload.state.tribe, source.tribe);
  await view.hook.loadRun(); assert.equal(view.calls.replacements.length, 1);
  assert.deepEqual(view.calls.replacements[0].tribe, source.tribe);
  assert.deepEqual(checkpoint.readCheckpoint(view.storage, owner).checkpoint.previous.tribe, source.tribe);
  const invalid = clone(source); invalid.tribe.processingPlan = null;
  const bad = serverView(source, invalid), original = bad.storage.getItem(key); await bad.hook.loadRun();
  assert.equal(bad.calls.replacements.length, 0); assert.equal(bad.storage.getItem(key), original);
});
await check('actual server handoff rejects stale owner or state responses before replacing checkpoints', async () => {
  for (const stale of ['owner', 'state']) {
    const view = serverView(fixture());
    let release;
    view.harness.get = async () => new Promise(resolve => { release = resolve; });
    const original = view.storage.getItem(key), request = view.hook.loadRun();
    if (stale === 'owner') view.harness.session = {};
    else view.ref.current = fixture('newer-current-state');
    release({ saves: [{ slotKey: engine.QUICK_SAVE_SLOT, id: 'fixture-slot' }] }); await request;
    assert.equal(view.calls.replacements.length, 0); assert.equal(view.storage.getItem(key), original);
  }
});
delete globalThis.__processingServerHarness;
console.log(JSON.stringify({ passed: failures.length === 0, checks, failures,
  scope: 'Real processing normalization, checkpoint/current/previous/owner protection and persistence-hook handoff with in-memory storage and controlled API. No browser or live server/account claim.' }));
if (failures.length) process.exitCode = 1;
