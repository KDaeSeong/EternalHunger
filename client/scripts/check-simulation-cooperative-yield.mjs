import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const { requestSimulationFrameYield, requestSimulationMainThreadYield } = await import('../src/app/simulation/_lib/simulationCooperativeYieldRuntime.js');
const { requestSimulationWorkerTaskYield, createSimulationPhaseWorkerYieldPolicy } = await import('../src/app/simulation/_lib/simulationPhaseWorkerRuntime.js');
const { createSimulationFramePublicationLimiter } = await import('../src/app/simulation/_lib/simulationFramePublicationRuntime.js');
const { createSeedRng } = await import('../src/app/simulation/_lib/randomSeedRuntime.js');
const { captureObserverWorkerMeasurementToken, createObserverWorkerPhaseMeasurements,
  publishObserverWorkerMeasurement, readObserverWorkerMeasurementTime, subscribeObserverWorkMeasurements,
  measureObserverWork } = await import('../src/app/simulation/_lib/observerWorkMeasurementRuntime.js');
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

await check('frame publication limiter uses a 30Hz real-time boundary, permits x1 cadence, and forces phase finals', () => {
  const intervalMs = 1000 / 30;
  let now = 0, clockReads = 0;
  const limiter = createSimulationFramePublicationLimiter({ now: () => { clockReads += 1; return now; } });
  assert.equal(limiter.shouldPublish(), true, 'The first source frame is always publishable.');
  assert.equal(limiter.getLastObservationTimeMs(), 0);
  now = intervalMs - 1e-7;
  assert.equal(limiter.shouldPublish(), false, 'A time just below 30Hz is skipped.');
  assert.equal(limiter.getLastObservationTimeMs(), now, 'Skipped source frames still advance only numeric clock state.');
  now = intervalMs;
  assert.equal(limiter.shouldPublish(), true, 'The exact 1000/30ms boundary publishes.');
  now += 200;
  assert.equal(limiter.shouldPublish(), true, 'The natural 1x visible-clock cadence is below the cap.');
  assert.equal(limiter.shouldPublish({ force: true }), true, 'A phase-final frame publishes even at the same clock time.');
  assert.equal(limiter.getLastObservationTimeMs(), now);
  now += 10;
  assert.equal(limiter.shouldPublish(), false, 'Forced publication resets the interval baseline.');
  assert.equal(clockReads, 6, 'Publication decisions must read the clock exactly once each.');
});

await check('frame publication limiter falls back to full sends after invalid/backward clocks and resets per phase', () => {
  let now = 0;
  const limiter = createSimulationFramePublicationLimiter({ now: () => now });
  assert.equal(limiter.shouldPublish(), true);
  now = 20;
  assert.equal(limiter.shouldPublish(), false);
  now = 10;
  assert.equal(limiter.shouldPublish(), true, 'Backward relative to last observed time forces a send even if after last emitted time.');
  assert.equal(limiter.getLastObservationTimeMs(), null, 'Backward time clears the baseline.');
  now = 11;
  assert.equal(limiter.shouldPublish(), true, 'The first valid frame after reset is sent.');
  for (const invalid of [NaN, Infinity]) {
    now = invalid;
    assert.equal(limiter.shouldPublish(), true, 'Non-finite clock values conservatively publish.');
    assert.equal(limiter.getLastObservationTimeMs(), null);
    now = 100;
    assert.equal(limiter.shouldPublish(), true, 'The first finite value after an invalid clock is sent.');
  }
  let throwClock = false;
  const throwingClockLimiter = createSimulationFramePublicationLimiter({ now: () => {
    if (throwClock) throw new Error('clock unavailable');
    return 0;
  } });
  assert.equal(throwingClockLimiter.shouldPublish(), true);
  throwClock = true;
  assert.equal(throwingClockLimiter.shouldPublish(), true);
  assert.equal(throwingClockLimiter.getLastObservationTimeMs(), null);
  throwClock = false;
  assert.equal(throwingClockLimiter.shouldPublish(), true);

  const nextPhase = createSimulationFramePublicationLimiter({ now: () => 100 });
  assert.equal(nextPhase.shouldPublish(), true, 'A fresh phase owns a fresh first-frame baseline.');
});

await check('frame source observation and action FIFO stay independent of skipped publications', () => {
  const intervalMs = 1000 / 30;
  let now = 0, seq = 0;
  const limiter = createSimulationFramePublicationLimiter({ now: () => now });
  const observed = [], messages = [];
  const publishSource = (frame, { observe, force = false } = {}) => {
    observe(frame);
    if (!limiter.shouldPublish({ force })) return false;
    messages.push(structuredClone({ kind: 'frame', seq: ++seq, frame }));
    return true;
  };
  const observe = frame => observed.push(frame.state);
  const borrowed = { state: 'first' };
  assert.equal(publishSource(borrowed, { observe }), true);
  messages.push({ kind: 'action', seq: ++seq, name: 'addLog' });
  now = 5;
  borrowed.state = 'skipped-mutated';
  assert.equal(publishSource(borrowed, { observe }), false);
  now = intervalMs;
  borrowed.state = 'next-published';
  assert.equal(publishSource(borrowed, { observe }), true);
  now = intervalMs;
  borrowed.state = 'final';
  assert.equal(publishSource(borrowed, { observe, force: true }), true);
  messages.push({ kind: 'finish', seq: ++seq });

  assert.deepEqual(observed, ['first', 'skipped-mutated', 'next-published', 'final'],
    'Every source frame is observed even when its UI publication is skipped.');
  assert.deepEqual(messages.map(row => [row.kind, row.seq]), [
    ['frame', 1], ['action', 2], ['frame', 3], ['frame', 4], ['finish', 5],
  ], 'Skipped frames consume no sequence and the final frame precedes finish.');
  assert.deepEqual(messages.filter(row => row.kind === 'frame').map(row => row.frame.state),
    ['first', 'next-published', 'final'], 'Only synchronous structured-clone sends cross the ownership boundary.');
  assert.deepEqual(messages.filter(row => row.kind === 'frame')[0].frame, { state: 'first' },
    'Later borrowed-source mutation cannot alter an already-published frame.');
});

await check('worker measurement tokens are opaque, stale-safe, and disabled paths read no clock', () => {
  let clocks = 0, callbacks = 0;
  const unsubscribe = subscribeObserverWorkMeasurements(() => { clocks += 1; return 4; }, () => {}, () => {}, () => { callbacks += 1; });
  const oldToken = captureObserverWorkerMeasurementToken();
  assert.equal(typeof oldToken, 'object');
  assert.equal(readObserverWorkerMeasurementTime(oldToken), 4);
  assert.equal(publishObserverWorkerMeasurement(oldToken, { value: 1 }), true);
  assert.equal(callbacks, 1);
  unsubscribe();
  const before = clocks;
  assert.equal(readObserverWorkerMeasurementTime(oldToken), null);
  assert.equal(publishObserverWorkerMeasurement(oldToken, { value: 2 }), false);
  assert.equal(clocks, before, 'A stale token does not read its old clock.');
  let disabledClockCalls = 0;
  const disabledUnsubscribe = subscribeObserverWorkMeasurements(() => { disabledClockCalls += 1; return 1; }, () => {}, () => {});
  assert.equal(captureObserverWorkerMeasurementToken(), null);
  assert.equal(readObserverWorkerMeasurementTime({}), null);
  disabledUnsubscribe();
  assert.equal(disabledClockCalls, 0);
  assert.equal(measureObserverWork('disabled.identity', () => 7), 7);
  assert.equal(disabledClockCalls, 0);
  let invalidClockCalls = 0;
  const invalidUnsubscribe = subscribeObserverWorkMeasurements(() => { invalidClockCalls += 1; return 2; }, () => {}, () => {}, true);
  assert.equal(captureObserverWorkerMeasurementToken(), null);
  assert.equal(readObserverWorkerMeasurementTime(true), null);
  assert.equal(readObserverWorkerMeasurementTime(null), null);
  assert.equal(publishObserverWorkerMeasurement(true, {}), false);
  assert.equal(publishObserverWorkerMeasurement(null, {}), false);
  assert.equal(invalidClockCalls, 0, 'Truthy non-function callbacks and invalid tokens never read a clock.');
  invalidUnsubscribe();
});

await check('worker phase collector bounds records, separates sequential waits, and preserves results/errors', async () => {
  let now = 0, sent = [], resolveWait;
  const collector = createObserverWorkerPhaseMeasurements({ now: () => now,
    send: message => { sent.push(message); now += 2; return 'sent'; },
    taskYield: () => new Promise(resolve => { resolveWait = resolve; }), wait: () => Promise.resolve('waited') });
  const workValue = collector.work('one', () => { now += 3; return 19; });
  assert.equal(workValue, 19);
  measureObserverWork('one', () => { now += 1; return 20; });
  for (let i = 0; i < 30; i += 1) collector.work(`stage-${i}`, () => { now += 1; });
  assert.equal(collector.send({ kind: 'event' }), 'sent');
  const task = collector.taskYield();
  assert.equal(typeof resolveWait, 'function');
  now += 4; resolveWait('yielded');
  assert.equal(await task, 'yielded');
  assert.equal(await collector.wait(10), 'waited');
  const snapshot = collector.snapshot('complete');
  assert.equal(snapshot.schema, 'eh-worker-phase-performance.v1');
  assert.equal(snapshot.status, 'complete');
  assert.ok(snapshot.stages.length <= 24);
  assert.equal(snapshot.stages.find(row => row.name === 'one').count, 2);
  assert.equal(snapshot.messagesBeforeTerminal[0].kind, 'event');
  assert.equal(snapshot.messagesBeforeTerminal[0].count, 1);
  assert.equal(snapshot.hostWaits.task.count, 1);
  assert.equal(snapshot.hostWaits.display.count, 1);
  assert.equal(snapshot.terminalMessageTiming, 'excluded; snapshot precedes terminal send');
  const syncError = new Error('work sync');
  assert.throws(() => collector.work('throws', () => { throw syncError; }), error => error === syncError);
  const rejectError = new Error('wait reject');
  const rejectCollector = createObserverWorkerPhaseMeasurements({ now: () => now, send: () => {},
    taskYield: () => Promise.reject(rejectError), wait: () => Promise.reject(rejectError) });
  await assert.rejects(rejectCollector.taskYield(), error => error === rejectError);
  await assert.rejects(rejectCollector.wait(1), error => error === rejectError);
  rejectCollector.dispose(); collector.dispose();
});

await check('worker phase collector invalid clock uses null measurements and task yield releases RNG', async () => {
  let now = 10, resume;
  const collector = createObserverWorkerPhaseMeasurements({ now: () => now, send: () => {},
    taskYield: () => new Promise(resolve => { resume = resolve; }), wait: () => Promise.resolve() });
  collector.work('clocked', () => { now = 9; });
  const snapshot = collector.snapshot('failed');
  assert.equal(snapshot.elapsedMs, null);
  assert.equal(snapshot.stages[0].totalMs, null);
  const source = createSeedRng('worker-measured-yield'), expected = createSeedRng('worker-measured-yield');
  let draw;
  function* steps() { draw = simulationRandom(); yield collector.taskYield(); }
  const done = runSimulationSteps(source, steps());
  assert.equal(draw, expected());
  assert.equal(getActiveSimulationRandom(), null);
  resume(); await done;
  assert.deepEqual(source.getState(), expected.getState());
  assert.equal(getActiveSimulationRandom(), null);
  collector.dispose();
});

await check('worker phase collector bounds stage/message/name records and disposal stops clock reads', () => {
  let now = 0, clockCalls = 0, sendCalls = 0;
  const collector = createObserverWorkerPhaseMeasurements({ now: () => { clockCalls += 1; return now++; },
    send: () => { sendCalls += 1; }, taskYield: () => Promise.resolve(), wait: () => Promise.resolve() });
  for (let i = 0; i < 30; i += 1) collector.work(i === 0 ? 'x'.repeat(100) : `stage-${i}`, () => {});
  for (let i = 0; i < 40; i += 1) collector.send({ kind: `message-${i}` });
  const snapshot = collector.snapshot('complete');
  assert.equal(snapshot.stages.length, 24);
  assert.ok(snapshot.stages.every(row => row.name.length <= 80));
  assert.equal(snapshot.stages[0].name.length, 80);
  assert.equal(snapshot.messagesBeforeTerminal.length, 32);
  const beforeDispose = clockCalls;
  collector.dispose();
  assert.equal(collector.snapshot('disposed').elapsedMs, null);
  collector.send({ kind: 'after-dispose' });
  assert.equal(clockCalls, beforeDispose, 'Disposed diagnostics do not read the clock.');
  assert.equal(sendCalls, 41, 'Disposal does not suppress the wrapped authoritative send.');
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
  assert.ok(/const yieldPolicy = createSimulationPhaseWorkerYieldPolicy\(\{[\s\S]*taskYield: measurements\?\.taskYield \|\| taskYield,[\s\S]*wait: measurements\?\.wait \|\| wait, now \}\)/.test(worker),
    'The Worker creates a fresh scheduling-only yield policy and conditionally instruments requested phases.');
  assert.ok(/requestMainThreadYield: yieldPolicy\.requestMainThreadYield/.test(worker)
    && /requestFrameYield: yieldPolicy\.requestFrameYield/.test(worker)
    && /waitForVisibleTick: yieldPolicy\.waitForVisibleTick/.test(worker),
  'Only routine Worker task yields are coalesced; explicit frame yields and visible-clock waits use policy boundaries.');
  assert.ok(/requestTaskYield: yieldPolicy\.requestTaskYield, requestFrameYield: yieldPolicy\.requestFrameYield/.test(worker),
    'Growth task/frame yields remain explicit actual task boundaries.');
});

console.log(JSON.stringify({ checks, pass: true, scope: 'scheduler ownership, fallback, RNG and wiring contracts; not browser timing or paint proof' }));
