import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';

const { runGrowthActionSteps } = await import('../src/app/simulation/_lib/growthActionSchedulingRuntime.js');
const { runPhaseActorActionPipeline, runPhaseActorActionPipelineSteps } = await import('../src/app/simulation/_lib/phaseActorActionPipelineRuntime.js');
const { createPhaseActionTimeline } = await import('../src/app/simulation/_lib/phaseActionTimelineRuntime.js');
const { runPvpActionLoop } = await import('../src/app/simulation/_lib/phasePvpActionLoopRuntime.js');
const { createSeedRng } = await import('../src/app/simulation/_lib/randomSeedRuntime.js');
const { getActiveSimulationRandom, runSimulationSteps, simulationRandom } = await import('../src/utils/simulationRandom.js');
const { subscribeObserverWorkMeasurements } = await import('../src/app/simulation/_lib/observerWorkMeasurementRuntime.js');

let checks = 0;
const check = async (name, run) => { await run(); checks += 1; console.log(`PASS ${name}`); };
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const clock = () => { let time = 0; return () => time += 9; };

await check('budgeted slices preserve order and do not run ahead of an unresolved wait', async () => {
  const pauses = [], events = [];
  function* steps() { for (let i = 0; i < 3; i += 1) { events.push(i); yield; } return 'done'; }
  const done = runSimulationSteps(null, runGrowthActionSteps(steps(), {
    now: clock(), requestYield: () => { const next = deferred(); pauses.push(next); return next.promise; },
  }));
  for (let i = 0; i < 3; i += 1) {
    assert.deepEqual(events, Array.from({ length: i + 1 }, (_, n) => n));
    assert.equal(pauses.length, i + 1);
    pauses[i].resolve(); await Promise.resolve();
  }
  assert.equal(await done, 'done');
});

await check('fast work finishes without a browser wait or a spurious final yield', async () => {
  function* steps() { yield; yield; return 3; }
  const value = await runSimulationSteps(null, runGrowthActionSteps(steps(), {
    now: () => 0, requestYield: () => assert.fail('No wait needed below budget.'),
  }));
  assert.equal(value, 3);
});

await check('headless fallback drains all checkpoints without scheduling host work', async () => {
  function* steps() { yield; yield; return 3; }
  assert.equal(await runSimulationSteps(null, runGrowthActionSteps(steps(), { now: clock() })), 3);
});

await check('a slow indivisible actor completes once before yielding', async () => {
  let time = 0, calls = 0, waits = 0;
  function* steps() { calls += 1; time += 50; yield; return calls; }
  const result = await runSimulationSteps(null, runGrowthActionSteps(steps(), {
    now: () => time, requestYield: () => { waits += 1; assert.equal(calls, 1); return Promise.resolve(); },
  }));
  assert.equal(result, 1); assert.equal(waits, 1);
});

await check('slice diagnostics exclude elapsed browser-wait time', async () => {
  const records = []; let time = 0;
  const stop = subscribeObserverWorkMeasurements(() => time, record => records.push(record));
  function* steps() { time += 10; yield; time += 2; return true; }
  try {
    await runSimulationSteps(null, runGrowthActionSteps(steps(), {
      now: () => time, requestYield: () => { time += 1000; return Promise.resolve(); },
    }));
  } finally { stop(); }
  assert.deepEqual(records.map(row => [row.name, row.duration]), [['growth.slice', 10], ['growth.slice', 2]]);
});

await check('match randomness is absent during waits and resumes at the same draw', async () => {
  const source = createSeedRng('growth-slices'), expected = createSeedRng('growth-slices'), values = [];
  function* steps() { for (let i = 0; i < 4; i += 1) { values.push(simulationRandom()); yield; } }
  await runSimulationSteps(source, runGrowthActionSteps(steps(), {
    now: clock(), requestYield: () => Promise.resolve().then(() => {
      assert.equal(getActiveSimulationRandom(), null);
      for (let i = 0; i < 10; i += 1) Math.random();
    }),
  }));
  assert.deepEqual(values, Array.from({ length: 4 }, () => expected()));
  assert.deepEqual(source.getState(), expected.getState());
});

await check('failed waits close the inner iterator and propagate the original error', async () => {
  let closed = false; const error = new Error('wait failed');
  function* steps() { try { yield; assert.fail('Must not resume.'); } finally { closed = true; } }
  await assert.rejects(runSimulationSteps(null, runGrowthActionSteps(steps(), {
    now: clock(), requestYield: () => Promise.reject(error),
  })), value => value === error);
  assert.equal(closed, true);
});

await check('explicit cancellation closes the inner iterator without extra work', () => {
  let closed = false;
  function* steps() { try { yield; assert.fail('Cancelled.'); } finally { closed = true; } }
  const iterator = runGrowthActionSteps(steps(), { now: clock(), requestYield: () => Promise.resolve() });
  assert.equal(iterator.next().done, false); iterator.return(); assert.equal(closed, true);
});

await check('growth work errors do not schedule another wait', async () => {
  const error = new Error('actor failed');
  function* steps() { yield; throw error; }
  await assert.rejects(runSimulationSteps(null, runGrowthActionSteps(steps(), {
    now: () => 0, requestYield: () => assert.fail('No wait after an error.'),
  })), value => value === error);
});

await check('cooperative timeline keeps fractional boundaries and idempotent growth identical', async () => {
  const sync = [], sliced = [];
  const options = output => ({ durationSec: 60.25, intervalSec: 20,
    onElapsed: (at, elapsed) => output.push(['elapsed', at, elapsed]) });
  const original = createPhaseActionTimeline({ ...options(sync), onGrowth: at => sync.push(['growth', at]) });
  const cooperative = createPhaseActionTimeline({ ...options(sliced), onGrowthSteps: function* (at) {
    yield Promise.resolve(); sliced.push(['growth', at]);
  } });
  for (const target of [0, 0, 19.25, 20, 20, 60.25, 100, 0]) {
    assert.equal(await runSimulationSteps(null, cooperative.advanceToSteps(target)), original.advanceTo(target));
  }
  assert.deepEqual(sliced, sync);
  assert.deepEqual(sliced.filter(row => row[0] === 'growth').map(row => row[1]), [0, 20, 40, 60]);
  assert.deepEqual(sliced.at(-1), ['elapsed', 60, 0.25]);
});

await check('no elapsed tick or second growth invocation can overtake a pending batch', async () => {
  const pause = deferred(), events = [];
  const timeline = createPhaseActionTimeline({ durationSec: 1, onGrowthSteps: function* (at) {
    events.push(['start', at]); yield pause.promise; events.push(['end', at]);
  }, onElapsed: (at, delta) => events.push(['elapsed', at, delta]) });
  const done = runSimulationSteps(null, timeline.advanceToSteps(1));
  assert.deepEqual(events, [['start', 0]]);
  assert.throws(() => timeline.advanceToSteps(1).next(), /already advancing/);
  pause.resolve(); await done;
  assert.deepEqual(events, [['start', 0], ['end', 0], ['elapsed', 0, 1]]);
});

await check('cooperative timelines reject accidental synchronous advancement before consuming work', () => {
  let calls = 0;
  const timeline = createPhaseActionTimeline({ durationSec: 1, onGrowthSteps: function* () { calls += 1; yield; } });
  assert.throws(() => timeline.advanceTo(1), /requires advanceToSteps/); assert.equal(calls, 0);
});

await check('interrupted batches cannot double-spend shared resources on a retry', () => {
  let stock = 2, closed = false;
  const timeline = createPhaseActionTimeline({ durationSec: 1, onGrowthSteps: function* () {
    try { stock -= 1; yield; stock -= 1; } finally { closed = true; }
  } });
  const steps = timeline.advanceToSteps(1); steps.next(); steps.return();
  assert.equal(closed, true); assert.equal(stock, 1);
  assert.throws(() => timeline.advanceToSteps(1).next(), /interrupted/); assert.equal(stock, 1);
});

await check('failed growth does not advance the clock and cannot be replayed on a partial world', async () => {
  let ticks = 0; const error = new Error('growth interrupted');
  const timeline = createPhaseActionTimeline({ durationSec: 1,
    onGrowthSteps: function* () { yield Promise.reject(error); }, onElapsed: () => ticks += 1 });
  await assert.rejects(runSimulationSteps(null, timeline.advanceToSteps(1)), value => value === error);
  assert.equal(ticks, 0); assert.throws(() => timeline.advanceToSteps(1).next(), /interrupted/);
});

await check('pipeline checkpoints preserve held actors and empty-input return values', async () => {
  for (const roster of [null, [], [
    { _id: 'dead', hp: 0, inventory: [] },
    { _id: 'travel', hp: 100, inventory: [], _growthReadyAtSec: 30 },
    { _id: 'cast', hp: 100, inventory: [], _pendingCharacterCast: {} },
  ]]) {
    const state = { phaseSurvivors: roster, actionIntervalSec: 20, currentActionSec: () => 20 };
    const expected = runPhaseActorActionPipeline({ state: { ...state, phaseSurvivors: structuredClone(roster) } });
    const result = await runSimulationSteps(null, runGrowthActionSteps(runPhaseActorActionPipelineSteps({ state }), {
      now: clock(), requestYield: () => Promise.resolve(),
    }));
    assert.deepEqual(result, expected);
  }
});

for (const kind of ['generator', 'promise']) await check(`PvP waits for ${kind} world boundaries before publishing or progressing`, async () => {
  let offset = 0, waiting = false, calls = 0; const frames = [];
  function* world() {
    assert.equal(waiting, false); waiting = true; const before = offset;
    yield Promise.resolve().then(() => { assert.equal(offset, before); });
    calls += 1; waiting = false;
  }
  await runPvpActionLoop({ state: { updatedSurvivors: [], phaseDurationSec: 2,
    currentActionSec: () => offset, getPhaseRuntimeOffsetSec: () => offset }, actions: {
    ...(kind === 'generator' ? { advanceWorldSteps: world } : { advanceWorld: () => runSimulationSteps(null, world()) }),
    reserveActionSecond: seconds => { assert.equal(waiting, false); offset += seconds; },
    resolveWorldObjectives: () => assert.equal(waiting, false),
    publishActionFrame: () => { assert.equal(waiting, false); frames.push(offset); },
  } });
  assert.deepEqual(frames, [0, 1, 2]); assert.equal(calls, 6);
});

await check('a failed in-loop world update cannot publish a partially processed frame', async () => {
  let offset = 0, objectives = 0; const frames = [], error = new Error('world failed');
  await assert.rejects(runPvpActionLoop({ state: { updatedSurvivors: [], phaseDurationSec: 2,
    currentActionSec: () => offset, getPhaseRuntimeOffsetSec: () => offset }, actions: {
    reserveActionSecond: seconds => offset += seconds,
    advanceWorldSteps: function* () { if (offset > 0) yield Promise.reject(error); },
    resolveWorldObjectives: () => objectives += 1,
    publishActionFrame: () => frames.push(offset),
  } }), value => value === error);
  assert.deepEqual(frames, [0]); assert.equal(objectives, 0);
});

console.log(JSON.stringify({ checks, pass: true, scope: 'cooperative growth, RNG, timeline, cancellation and PvP publication contracts; not browser timing or full-match equivalence' }));
