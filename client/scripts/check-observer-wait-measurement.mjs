import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';

const { measureObserverWait, measureObserverWork, subscribeObserverWorkMeasurements } =
  await import('../src/app/simulation/_lib/observerWorkMeasurementRuntime.js');
const { createObserverPerformanceProbe } = await import('../src/app/simulation/_lib/observerPerformanceRuntime.js');

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

let checks = 0;
function check(name, run) { run(); checks += 1; }
async function checkAsync(name, run) { await run(); checks += 1; }

await checkAsync('disabled instrumentation returns the exact request value with no extra clock or wrapper', async () => {
  const original = Promise.resolve('unchanged');
  assert.strictEqual(measureObserverWait('disabled', () => original), original);
  assert.equal(await measureObserverWait('headless', () => null), null);
});

await checkAsync('null, sync values and request throws keep their original contracts', async () => {
  let reads = 0;
  const failures = [];
  const dispose = subscribeObserverWorkMeasurements(() => { reads += 1; return 0; }, () => {},
    (entry) => failures.push(entry));
  try {
    assert.equal(measureObserverWait('null', () => null), null);
    const value = { value: 3 };
    assert.strictEqual(measureObserverWait('sync', () => value), value);
    const error = new Error('request failed');
    assert.throws(() => measureObserverWait('throw', () => { throw error; }), (actual) => actual === error);
    assert.equal(reads, 0);
    assert.deepEqual(failures, []);
  } finally { dispose(); }
});

await checkAsync('fulfilled and rejected async waits measure wall time without changing outcomes', async () => {
  let wall = 10;
  const waitEntries = [], workEntries = [];
  const dispose = subscribeObserverWorkMeasurements(() => wall, (entry) => workEntries.push(entry),
    (entry) => waitEntries.push(entry));
  try {
    const success = deferred();
    const fulfilled = measureObserverWait('yield', () => success.promise);
    wall = 14;
    success.resolve('ok');
    assert.equal(await fulfilled, 'ok');

    const expectedError = new Error('wait failed');
    const failure = deferred();
    const rejected = measureObserverWait('yield', () => failure.promise);
    wall = 21;
    failure.reject(expectedError);
    await assert.rejects(rejected, (actual) => actual === expectedError);

    measureObserverWork('compute', () => { wall += 2; });
    assert.deepEqual(waitEntries.map(({ name, duration }) => [name, duration]), [['yield', 4], ['yield', 7]]);
    assert.deepEqual(workEntries.map(({ name, duration }) => [name, duration]), [['compute', 2]]);
  } finally { dispose(); }
});

await checkAsync('thenables that return undefined are registered once and still awaited', async () => {
  let wall = 30, fulfillRegistrations = 0, rejectRegistrations = 0, settled = false;
  const entries = [];
  const dispose = subscribeObserverWorkMeasurements(() => wall, () => {}, (entry) => entries.push(entry));
  try {
    const fulfilled = measureObserverWait('undefined-return-fulfill', () => ({
      then(resolve) {
        fulfillRegistrations += 1;
        queueMicrotask(() => { wall = 34; settled = true; resolve('thenable value'); });
        return undefined;
      },
    }));
    assert.ok(fulfilled instanceof Promise);
    assert.equal(fulfillRegistrations, 1);
    assert.equal(settled, false, 'settlement is asynchronous in this fixture');
    assert.equal(await fulfilled, 'thenable value');
    assert.equal(settled, true);

    const failure = new Error('thenable rejection');
    const rejected = measureObserverWait('undefined-return-reject', () => ({
      then(_resolve, reject) {
        rejectRegistrations += 1;
        queueMicrotask(() => { wall = 39; reject(failure); });
        return undefined;
      },
    }));
    await assert.rejects(rejected, (actual) => actual === failure);
    assert.equal(rejectRegistrations, 1);
    assert.deepEqual(entries.map(({ name, duration }) => [name, duration]), [
      ['undefined-return-fulfill', 4], ['undefined-return-reject', 5],
    ]);
  } finally { dispose(); }
});

await checkAsync('then registration throws become one preserved rejection without retry', async () => {
  let wall = 50, registrations = 0;
  const entries = [];
  const dispose = subscribeObserverWorkMeasurements(() => wall++, () => {}, (entry) => entries.push(entry));
  const failure = new Error('registration failed');
  try {
    const result = measureObserverWait('registration-throw', () => ({
      then() { registrations += 1; throw failure; },
    }));
    await assert.rejects(result, (actual) => actual === failure);
    assert.equal(registrations, 1);
    assert.equal(entries.length, 1);
    assert.equal(entries[0].name, 'registration-throw');
  } finally { dispose(); }
});

await checkAsync('diagnostic clock and callback failures cannot change wait results', async () => {
  const failure = new Error('original rejection');
  let reads = 0;
  const dispose = subscribeObserverWorkMeasurements(() => {
    reads += 1;
    if (reads === 2) throw new Error('end clock failed');
    return 0;
  }, () => {}, () => { throw new Error('wait callback failed'); });
  try {
    const promise = Promise.resolve(9);
    assert.equal(await measureObserverWait('clock-failure', () => promise), 9);
    const rejected = Promise.reject(failure);
    await assert.rejects(measureObserverWait('callback-failure', () => rejected), (actual) => actual === failure);
  } finally { dispose(); }

  const clockError = new Error('start clock failed');
  const clockDispose = subscribeObserverWorkMeasurements(() => { throw clockError; }, () => {}, () => assert.fail());
  try {
    const original = Promise.resolve('original promise');
    assert.strictEqual(measureObserverWait('clock-start-failure', () => original), original);
    assert.equal(await original, 'original promise');
  } finally { clockDispose(); }
});

await checkAsync('disposed and replaced recorders do not read clocks on late settlements', async () => {
  let oldReads = 0, newReads = 0;
  const oldEntries = [], newEntries = [];
  const disposeOld = subscribeObserverWorkMeasurements(() => { oldReads += 1; return oldReads; }, () => {},
    (entry) => oldEntries.push(entry));
  let resolveLate, lateRegistrations = 0;
  const pending = measureObserverWait('late', () => ({ then(resolve) {
    lateRegistrations += 1; resolveLate = resolve; return undefined;
  } }));
  assert.equal(lateRegistrations, 1);
  assert.equal(oldReads, 1, 'one initial clock read starts the wait');
  disposeOld();
  resolveLate('settled');
  assert.equal(await pending, 'settled');
  assert.equal(oldReads, 1, 'disposal prevents the completion clock read');
  assert.deepEqual(oldEntries, []);

  const disposeBeforeRestart = subscribeObserverWorkMeasurements(() => { oldReads += 1; return oldReads; }, () => {},
    (entry) => oldEntries.push(entry));
  let resolveReplaced, replacedRegistrations = 0;
  const replacedWait = measureObserverWait('replaced', () => ({ then(resolve) {
    replacedRegistrations += 1; resolveReplaced = resolve; return undefined;
  } }));
  assert.equal(replacedRegistrations, 1);
  const disposeNew = subscribeObserverWorkMeasurements(() => { newReads += 1; return newReads; }, () => {},
    (entry) => newEntries.push(entry));
  resolveReplaced('same value');
  assert.equal(await replacedWait, 'same value');
  assert.equal(oldReads, 2, 'replaced recorder is not consulted at completion');
  assert.deepEqual(oldEntries, []);
  disposeBeforeRestart();
  let resolveCurrent;
  const currentWait = measureObserverWait('current', () => ({ then(resolve) { resolveCurrent = resolve; } }));
  resolveCurrent('current value');
  assert.equal(await currentWait, 'current value');
  assert.equal(newReads, 2);
  assert.deepEqual(newEntries.map((entry) => entry.name), ['current']);
  disposeNew();
});

await checkAsync('performance probe reports bounded waits separately from synchronous work', async () => {
  let wall = 0, nextRafId = 1;
  const frames = new Set();
  const performanceRef = { now: () => wall, memory: null };
  const windowRef = { performance: performanceRef,
    requestAnimationFrame: () => { const id = nextRafId++; frames.add(id); return id; },
    cancelAnimationFrame: (id) => frames.delete(id), setTimeout: () => 1, clearTimeout: () => {} };
  const documentRef = { visibilityState: 'visible', getElementsByTagName: () => ({ length: 0 }) };
  const probe = createObserverPerformanceProbe({ windowRef, documentRef, performanceRef });
  probe.start({ label: 'wait-measurement' });
  measureObserverWork('sync-stage', () => { wall += 2; });
  const wait = deferred();
  const measured = measureObserverWait('task-yield', () => wait.promise);
  wall += 5;
  wait.resolve(true);
  assert.equal(await measured, true);
  for (let index = 0; index < 30; index += 1) {
    await measureObserverWait(`bounded-${index}-${'x'.repeat(100)}`, () => Promise.resolve(index));
  }
  const result = probe.stop();
  assert.deepEqual(result.workBreakdown.stages.map(({ name, count, totalMs, maxMs }) => ({ name, count, totalMs, maxMs })),
    [{ name: 'sync-stage', count: 1, totalMs: 2, maxMs: 2 }]);
  assert.equal(result.waitBreakdown.scope, 'async_wait_settlements_separate_from_synchronous_work');
  assert.equal(result.waitBreakdown.waits.length, 24);
  assert.deepEqual(result.waitBreakdown.waits[0], { name: 'task-yield', count: 1, totalMs: 5, maxMs: 5 });
  assert.ok(result.waitBreakdown.waits.every((row) => row.name.length <= 80
    && Number.isSafeInteger(row.count) && Number.isFinite(row.totalMs) && Number.isFinite(row.maxMs)));
  assert.equal(frames.size, 0);
});

check('work measurement API remains synchronous and returns its exact value', () => {
  const value = {};
  assert.strictEqual(measureObserverWork('unchanged', () => value), value);
});

console.log(JSON.stringify({ pass: true, checks, scope: 'isolated wait measurement contracts; no historical fixture, match, browser timing, or build' }));
