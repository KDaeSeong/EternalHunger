import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const { requestSimulationFrameYield, requestSimulationMainThreadYield } = await import('../src/app/simulation/_lib/simulationCooperativeYieldRuntime.js');
const { requestSimulationWorkerTaskYield, createSimulationPhaseWorkerYieldPolicy } = await import('../src/app/simulation/_lib/simulationPhaseWorkerRuntime.js');
const { createSeedRng } = await import('../src/app/simulation/_lib/randomSeedRuntime.js');
const { getActiveSimulationRandom, runSimulationSteps, simulationRandom } = await import('../src/utils/simulationRandom.js');

let checks = 0;
const check = async (name, run) => { await run(); checks += 1; console.log(`PASS ${name}`); };

function fakeBrowser(visibilityState = 'visible') {
  const frames = new Map(), timers = new Map(), listeners = new Set();
  let frameId = 0, timerId = 0;
  const documentRef = {
    visibilityState,
    addEventListener: (type, callback) => { assert.equal(type, 'visibilitychange'); listeners.add(callback); },
    removeEventListener: (type, callback) => { assert.equal(type, 'visibilitychange'); listeners.delete(callback); },
  };
  const windowRef = {
    document: documentRef,
    requestAnimationFrame: (callback) => { const id = frameId++; frames.set(id, callback); return id; },
    cancelAnimationFrame: (id) => frames.delete(id),
    setTimeout: (callback, delay) => { const id = timerId++; timers.set(id, { callback, delay }); return id; },
    clearTimeout: (id) => timers.delete(id),
  };
  const fireFrame = () => {
    const pending = [...frames.values()]; frames.clear();
    for (const callback of pending) callback(16);
  };
  const fireTimer = (delay) => {
    const next = [...timers.entries()].find(([, timer]) => timer.delay === delay);
    assert.ok(next, `Expected a timer with delay ${delay}`);
    timers.delete(next[0]); next[1].callback();
  };
  const hide = () => { documentRef.visibilityState = 'hidden'; for (const callback of [...listeners]) callback(); };
  const assertEmpty = () => { assert.equal(frames.size, 0); assert.equal(timers.size, 0); assert.equal(listeners.size, 0); };
  return { windowRef, documentRef, frames, timers, listeners, fireFrame, fireTimer, hide, assertEmpty };
}

await check('headless frame yields do not schedule host work', () => {
  assert.equal(requestSimulationFrameYield({ windowRef: null }), null);
  assert.equal(requestSimulationMainThreadYield({ windowRef: null }), null);
});

await check('worker task yield uses a supported scheduler without window or timer work', async () => {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const originalScheduler = Object.getOwnPropertyDescriptor(globalThis, 'scheduler');
  let calls = 0, timerCalls = 0;
  const expected = Promise.resolve('scheduler-result');
  const schedulerRef = { yield() { assert.equal(this, schedulerRef); calls += 1; return expected; } };
  const result = requestSimulationWorkerTaskYield({ schedulerRef, scheduleTimeout() { timerCalls += 1; } });
  assert.equal(result, expected, 'Return the scheduler promise itself, without wrapping it.');
  assert.equal(await result, 'scheduler-result');
  assert.equal(calls, 1); assert.equal(timerCalls, 0);
  assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis, 'window'), originalWindow);
  assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis, 'scheduler'), originalScheduler);
});

await check('worker task yield falls back to one zero-delay timer when scheduler is absent or invalid', async () => {
  for (const schedulerRef of [null, {}, { yield: true }]) {
    let scheduled = 0, delay = -1, callback;
    const result = requestSimulationWorkerTaskYield({ schedulerRef, scheduleTimeout(fn, ms) {
      scheduled += 1; callback = fn; delay = ms;
    } });
    assert.equal(scheduled, 1); assert.equal(delay, 0);
    let settled = false; result.then(() => { settled = true; });
    await Promise.resolve(); assert.equal(settled, false);
    callback(); assert.equal(await result, undefined); assert.equal(settled, true);
  }
});

await check('worker task yield propagates synchronous throws and asynchronous rejections', async () => {
  const syncError = new Error('scheduler threw');
  assert.throws(() => requestSimulationWorkerTaskYield({ schedulerRef: {
    yield() { throw syncError; },
  } }), error => error === syncError);
  const asyncError = new Error('scheduler rejected');
  const rejected = requestSimulationWorkerTaskYield({ schedulerRef: {
    yield() { return Promise.reject(asyncError); },
  } });
  await assert.rejects(rejected, error => error === asyncError);
});

await check('worker task-yield fixture releases RNG and observes intervening controls without changing draws or game time; not browser fairness proof', async () => {
  const source = createSeedRng('worker-task-boundary'), expected = createSeedRng('worker-task-boundary');
  const events = [], clock = { seconds: 37 }, controls = { speed: 1, visibility: 'visible' };
  let resume;
  const schedulerRef = { yield() { return new Promise(resolve => { resume = resolve; }); } };
  function* steps() {
    events.push({ kind: 'before', sec: clock.seconds, draw: simulationRandom(), ...controls });
    yield requestSimulationWorkerTaskYield({ schedulerRef });
    events.push({ kind: 'after', sec: clock.seconds, draw: simulationRandom(), ...controls });
  }
  const done = runSimulationSteps(source, steps());
  assert.equal(getActiveSimulationRandom(), null, 'The match RNG is released while the task-yield promise is pending.');
  assert.equal(typeof resume, 'function');
  controls.speed = 4; controls.visibility = 'hidden';
  resume(); await done;
  const expectedEvents = [
    { kind: 'before', sec: 37, draw: expected(), speed: 1, visibility: 'visible' },
    { kind: 'after', sec: 37, draw: expected(), speed: 4, visibility: 'hidden' },
  ];
  assert.deepEqual(events, expectedEvents);
  assert.deepEqual(source.getState(), expected.getState());
  assert.equal(getActiveSimulationRandom(), null);
});

await check('phase routine yields coalesce before 8ms and yield at the deterministic boundary', async () => {
  let now = 0, calls = 0;
  const policy = createSimulationPhaseWorkerYieldPolicy({ now: () => now,
    taskYield: () => { calls += 1; return Promise.resolve(); }, wait: async () => {} });
  assert.equal(policy.requestMainThreadYield(), null);
  assert.equal(policy.waitForVisibleTick(0), null, 'A zero display delay shares the routine-yield budget.');
  now = 7;
  assert.equal(policy.requestMainThreadYield(), null);
  now = 8;
  await policy.requestMainThreadYield();
  assert.equal(calls, 1, 'Exactly one task yield occurs at 8ms.');
  assert.equal(policy.waitForVisibleTick(0), null,
    'A zero display tick immediately after a completed routine yield adds no second task.');
  assert.equal(calls, 1);
  now = 15;
  assert.equal(policy.requestMainThreadYield(), null, 'Successful yield completion resets the interval.');
  now = 16;
  await policy.requestMainThreadYield();
  assert.equal(calls, 2);
});

await check('each worker phase owns an independent 8ms routine-yield baseline', async () => {
  let now = 0, calls = 0;
  const createPolicy = () => createSimulationPhaseWorkerYieldPolicy({ now: () => now,
    taskYield: () => { calls += 1; return Promise.resolve(); }, wait: async () => {} });
  const firstPhase = createPolicy();
  now = 8;
  await firstPhase.requestMainThreadYield();
  now = 9;
  const nextPhase = createPolicy();
  now = 16;
  await firstPhase.requestMainThreadYield();
  assert.equal(nextPhase.requestMainThreadYield(), null,
    'The new phase baseline starts at its own creation time, not the prior phase yield.');
  assert.equal(calls, 2);
  now = 17;
  await nextPhase.requestMainThreadYield();
  assert.equal(calls, 3);
});

await check('explicit frame/growth yields and positive display waits remain unconditional and completion resets the budget', async () => {
  let now = 0, taskCalls = 0, waitCalls = 0, finishWait;
  const policy = createSimulationPhaseWorkerYieldPolicy({ now: () => now,
    taskYield: () => { taskCalls += 1; return Promise.resolve(); },
    wait: (ms) => { waitCalls += 1; assert.equal(ms, 12); return new Promise(resolve => { finishWait = resolve; }); } });
  await policy.requestFrameYield();
  now = 1;
  await policy.requestTaskYield();
  assert.equal(taskCalls, 2, 'Explicit frame and growth task boundaries are never coalesced.');
  const positiveWait = policy.waitForVisibleTick(12);
  assert.equal(waitCalls, 1, 'Positive display time is always awaited.');
  now = 100;
  finishWait();
  await positiveWait;
  now = 107;
  assert.equal(policy.requestMainThreadYield(), null, 'Positive-wait completion is the new interval origin.');
  now = 108;
  await policy.requestMainThreadYield();
  assert.equal(taskCalls, 3);
});

await check('invalid/backward diagnostic clocks yield conservatively and failures propagate unchanged', async () => {
  let now = NaN, calls = 0;
  const syncError = new Error('coalesced task threw');
  const policy = createSimulationPhaseWorkerYieldPolicy({ now: () => now,
    taskYield: () => { calls += 1; return Promise.resolve(); }, wait: () => Promise.resolve() });
  await policy.requestMainThreadYield();
  now = 0;
  await policy.requestMainThreadYield();
  now = 10;
  await policy.requestMainThreadYield();
  now = 9;
  await policy.requestMainThreadYield();
  assert.equal(calls, 4, 'Invalid time and a backward clock each force a real task yield.');

  const syncPolicy = createSimulationPhaseWorkerYieldPolicy({ now: () => 0,
    taskYield: () => { throw syncError; }, wait: () => { throw syncError; } });
  assert.throws(() => syncPolicy.requestFrameYield(), error => error === syncError);
  assert.throws(() => syncPolicy.waitForVisibleTick(1), error => error === syncError);
  const asyncError = new Error('coalesced task rejected');
  const rejectedPolicy = createSimulationPhaseWorkerYieldPolicy({ now: () => 0,
    taskYield: () => Promise.reject(asyncError), wait: () => Promise.reject(asyncError) });
  await assert.rejects(rejectedPolicy.requestFrameYield(), error => error === asyncError);
  await assert.rejects(rejectedPolicy.waitForVisibleTick(1), error => error === asyncError);
});

await check('due routine yield blocks frame/event/draw continuation, releases RNG, and observes intervening controls', async () => {
  const source = createSeedRng('worker-coalesced-boundary'), expected = createSeedRng('worker-coalesced-boundary');
  let now = 0, controls = { speed: 1, visibility: 'visible' }, resume;
  const policy = createSimulationPhaseWorkerYieldPolicy({ now: () => now,
    taskYield: () => new Promise(resolve => { resume = resolve; }), wait: async () => {} });
  const seen = [];
  function* steps() {
    seen.push({ sec: 37, draw: simulationRandom(), ...controls });
    now = 8;
    yield policy.requestMainThreadYield();
    seen.push({ kind: 'frame', sec: 37, draw: simulationRandom(), ...controls });
    seen.push({ kind: 'event', sec: 37, draw: simulationRandom(), ...controls });
  }
  const done = runSimulationSteps(source, steps());
  assert.equal(getActiveSimulationRandom(), null);
  assert.equal(typeof resume, 'function');
  assert.equal(seen.length, 1, 'No frame, event, or further RNG draw runs before the due task yield completes.');
  controls = { speed: 4, visibility: 'hidden' };
  now = 9;
  resume();
  await done;
  assert.deepEqual(seen, [
    { sec: 37, draw: expected(), speed: 1, visibility: 'visible' },
    { kind: 'frame', sec: 37, draw: expected(), speed: 4, visibility: 'hidden' },
    { kind: 'event', sec: 37, draw: expected(), speed: 4, visibility: 'hidden' },
  ]);
  assert.deepEqual(source.getState(), expected.getState());
  assert.equal(getActiveSimulationRandom(), null);
});

await check('visible phase boundaries resume in a task after RAF, never in the RAF callback', async () => {
  const browser = fakeBrowser(); let resumed = false, schedulerCalls = 0;
  const pause = requestSimulationFrameYield({ ...browser, schedulerRef: { yield: () => { schedulerCalls += 1; return Promise.resolve(); } } });
  pause.then(() => { resumed = true; });
  assert.equal(browser.frames.size, 1);
  assert.equal(browser.frames.has(0), true, 'A zero RAF handle remains valid.');
  assert.equal(browser.timers.has(0), true, 'A zero watchdog handle remains valid.');
  await Promise.resolve(); assert.equal(resumed, false);
  browser.fireFrame(); await Promise.resolve();
  assert.equal(resumed, false, 'Promise continuations in RAF would block the rendering opportunity.');
  browser.fireTimer(0); await pause;
  assert.equal(resumed, true); assert.equal(schedulerCalls, 0); browser.assertEmpty();
});

await check('a hidden page uses the existing scheduler without waiting for suspended RAF', async () => {
  const browser = fakeBrowser('hidden'); let calls = 0;
  await requestSimulationFrameYield({ ...browser, schedulerRef: { yield: () => { calls += 1; return Promise.resolve(); } } });
  assert.equal(calls, 1); browser.assertEmpty();
});

await check('unsupported or incomplete RAF APIs retain the timer fallback', async () => {
  const browser = fakeBrowser(); delete browser.windowRef.cancelAnimationFrame;
  const pause = requestSimulationFrameYield({ ...browser, schedulerRef: null });
  assert.equal(browser.frames.size, 0); assert.equal(browser.timers.size, 1);
  browser.fireTimer(0); await pause; browser.assertEmpty();
});

await check('hidden transition releases a pending frame and ignores a stale RAF callback', async () => {
  const browser = fakeBrowser(); let completions = 0;
  const pause = requestSimulationFrameYield({ ...browser, schedulerRef: null }).then(() => { completions += 1; });
  const staleFrame = [...browser.frames.values()][0];
  browser.hide(); await pause; browser.assertEmpty();
  staleFrame(16); await Promise.resolve();
  assert.equal(completions, 1); browser.assertEmpty();
});

await check('a missing RAF callback falls back after a bounded wait with no retained handles', async () => {
  const browser = fakeBrowser();
  const pause = requestSimulationFrameYield({ ...browser, schedulerRef: null });
  const staleFrame = [...browser.frames.values()][0];
  browser.fireTimer(100); await pause; browser.assertEmpty();
  staleFrame(16); browser.assertEmpty();
});

await check('timeout between RAF and its follow-up task settles only once and removes both timers', async () => {
  const browser = fakeBrowser(); let completions = 0;
  const pause = requestSimulationFrameYield({ ...browser, schedulerRef: null }).then(() => { completions += 1; });
  browser.fireFrame();
  const staleTimer = [...browser.timers.values()].find((timer) => timer.delay === 0).callback;
  browser.fireTimer(100); await pause; browser.assertEmpty();
  staleTimer(); await Promise.resolve(); assert.equal(completions, 1); browser.assertEmpty();
});

await check('a failed RAF request uses a task fallback and removes the watchdog/listener', async () => {
  const browser = fakeBrowser(); browser.windowRef.requestAnimationFrame = () => { throw new Error('frame unavailable'); };
  const pause = requestSimulationFrameYield({ ...browser, schedulerRef: null });
  browser.fireTimer(0); await pause; browser.assertEmpty();
});

await check('frame waits release the match RNG and do not change event order, time, or draw count', async () => {
  const browser = fakeBrowser(), source = createSeedRng('frame-boundary'), expected = createSeedRng('frame-boundary');
  const events = [], clock = { seconds: 20 };
  function* steps() {
    events.push({ seconds: clock.seconds, draw: simulationRandom() });
    yield requestSimulationFrameYield({ ...browser, schedulerRef: null });
    events.push({ seconds: clock.seconds, draw: simulationRandom() });
  }
  const done = runSimulationSteps(source, steps());
  assert.equal(getActiveSimulationRandom(), null);
  browser.fireFrame(); await Promise.resolve();
  assert.equal(getActiveSimulationRandom(), null); assert.equal(events.length, 1);
  browser.fireTimer(0); await done;
  assert.deepEqual(events, [{ seconds: 20, draw: expected() }, { seconds: 20, draw: expected() }]);
  assert.deepEqual(source.getState(), expected.getState());
  assert.equal(getActiveSimulationRandom(), null); browser.assertEmpty();
});

await check('phase preparation requests a frame opportunity; action-frame scheduling stays unchanged', () => {
  const cycle = fs.readFileSync(new URL('../src/app/simulation/_lib/simulationPhaseCycleRuntime.js', import.meta.url), 'utf8');
  const worker = fs.readFileSync(new URL('../src/app/simulation/_lib/simulationPhaseWorkerRuntime.js', import.meta.url), 'utf8');
  assert.ok(/const phaseSetupYield = \(actions\.requestFrameYield \|\| requestSimulationFrameYield\)\(\)/.test(cycle),
    'Phase setup retains the native frame-yield default and accepts the worker override.');
  assert.ok(/if \(phaseSetupYield\) yield phaseSetupYield/.test(cycle), 'A configured phase setup yield is awaited.');
  assert.ok(/requestMainThreadYield:\s*actions\.requestMainThreadYield \|\| requestSimulationMainThreadYield/.test(cycle),
    'The action loop retains the native task-yield default and accepts the worker override.');
  assert.ok(/const phaseFinalizationYield = \(actions\.requestMainThreadYield \|\| requestSimulationMainThreadYield\)\(\)/.test(cycle),
    'Phase finalization retains the native task-yield default and accepts the worker override.');
  assert.ok(/const yieldPolicy = createSimulationPhaseWorkerYieldPolicy\(\{ taskYield, wait, now \}\)/.test(worker),
    'The Worker creates a fresh scheduling-only yield policy for each phase.');
  assert.ok(/requestMainThreadYield: yieldPolicy\.requestMainThreadYield/.test(worker)
    && /requestFrameYield: yieldPolicy\.requestFrameYield/.test(worker)
    && /waitForVisibleTick: yieldPolicy\.waitForVisibleTick/.test(worker),
  'Only routine Worker task yields are coalesced; explicit frame yields and visible-clock waits use policy boundaries.');
  assert.ok(/requestTaskYield: yieldPolicy\.requestTaskYield, requestFrameYield: yieldPolicy\.requestFrameYield/.test(worker),
    'Growth task/frame yields remain explicit actual task boundaries.');
});

console.log(JSON.stringify({ checks, pass: true, scope: 'scheduler ownership, fallback, RNG and wiring contracts; not browser timing or paint proof' }));
