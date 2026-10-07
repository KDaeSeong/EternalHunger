import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const { createHighSpeedGrowthYield, runGrowthActionSteps } = await import('../src/app/simulation/_lib/growthActionSchedulingRuntime.js');
const { createSeedRng } = await import('../src/app/simulation/_lib/randomSeedRuntime.js');
const { getActiveSimulationRandom, runSimulationSteps, simulationRandom } = await import('../src/utils/simulationRandom.js');

let checks = 0;
const check = async (name, run) => { await run(); checks += 1; console.log(`PASS ${name}`); };
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};

await check('all lower speeds retain each original frame promise without clock reads or task substitution', async () => {
  let frameCalls = 0;
  const pause = Promise.resolve('original');
  for (const speed of [1, 2, 4, 8, 16]) {
    const request = createHighSpeedGrowthYield({ readSpeed: () => speed,
      now: () => assert.fail('Lower speeds must not read the policy clock.'),
      requestTaskYield: () => assert.fail('Keep the original frame scheduling.'),
      requestFrameYield: () => { frameCalls += 1; return pause; },
    });
    assert.equal(request(), pause); assert.equal(request(), pause);
  }
  assert.equal(frameCalls, 10); await pause;
});

await check('x32 alternates task opportunities with a bounded periodic frame request', async () => {
  let wall = 8;
  const calls = [];
  const request = createHighSpeedGrowthYield({ readSpeed: () => 32, visibility: () => 'visible', now: () => wall,
    requestFrameYield: () => { calls.push(['frame', wall]); return Promise.resolve('frame'); },
    requestTaskYield: () => { calls.push(['task', wall]); return Promise.resolve('task'); },
  });
  assert.equal(await request(), 'frame');
  for (wall of [16, 24, 32]) assert.equal(await request(), 'task');
  wall = 40; assert.equal(await request(), 'frame');
  assert.deepEqual(calls, [['frame', 8], ['task', 16], ['task', 24], ['task', 32], ['frame', 40]]);
});

await check('the next periodic deadline starts after the frame wait resolves, not before it', async () => {
  let wall = 0, frameCalls = 0, taskCalls = 0;
  const pause = deferred();
  const request = createHighSpeedGrowthYield({ readSpeed: () => 32, visibility: () => 'visible', now: () => wall,
    requestFrameYield: () => { frameCalls += 1; return pause.promise; },
    requestTaskYield: () => { taskCalls += 1; return Promise.resolve(); },
  });
  const pending = request(); wall = 1000; pause.resolve(); await pending;
  wall = 1008; await request(); assert.equal(frameCalls, 1); assert.equal(taskCalls, 1);
});

await check('one phase policy retains its deadline across distinct growth batches', async () => {
  let wall = 0, frames = 0, tasks = 0, completed = 0;
  const request = createHighSpeedGrowthYield({ readSpeed: () => 32, visibility: () => 'visible', now: () => wall,
    requestFrameYield: () => { frames += 1; return Promise.resolve(); },
    requestTaskYield: () => { tasks += 1; return Promise.resolve(); },
  });
  for (let batch = 0; batch < 4; batch += 1) {
    function* work() { wall += 8; completed += 1; yield; return batch; }
    assert.equal(await runSimulationSteps(null, runGrowthActionSteps(work(), { now: () => wall, requestYield: request })), batch);
  }
  assert.equal(completed, 4); assert.equal(frames, 1); assert.equal(tasks, 3);
});

await check('hidden and unsupported documents use tasks without depending on a frame or policy clock', async () => {
  for (const visibility of ['hidden', 'prerender', null]) {
    let tasks = 0;
    const pause = Promise.resolve();
    const request = createHighSpeedGrowthYield({ readSpeed: () => 32, visibility: () => visibility,
      now: () => assert.fail('No foreground deadline needed.'),
      requestFrameYield: () => assert.fail('A suspended RAF cannot block progress.'),
      requestTaskYield: () => { tasks += 1; return pause; },
    });
    assert.equal(request(), pause); await pause; assert.equal(tasks, 1);
  }
});

await check('headless execution retains null waits without creating timers', () => {
  const request = createHighSpeedGrowthYield({ readSpeed: () => 32, visibility: () => null,
    now: () => assert.fail('No clock in headless policy.'), requestTaskYield: () => null,
    requestFrameYield: () => assert.fail('No frame in headless policy.'),
  });
  assert.equal(request(), null);
});

await check('visibility and speed changes invalidate stale foreground deadlines', async () => {
  let wall = 0, speed = 32, visible = 'visible';
  const calls = [];
  const request = createHighSpeedGrowthYield({ readSpeed: () => speed, visibility: () => visible, now: () => wall,
    requestFrameYield: () => { calls.push('frame'); return Promise.resolve(); },
    requestTaskYield: () => { calls.push('task'); return Promise.resolve(); },
  });
  await request(); wall = 8; await request();
  visible = 'hidden'; await request(); visible = 'visible'; await request();
  speed = 16; await request(); speed = 32; await request();
  assert.deepEqual(calls, ['frame', 'task', 'task', 'frame', 'frame', 'frame']);
});

await check('rollback and unavailable clocks conservatively retain a frame request', async () => {
  let wall = 100, frames = 0;
  const request = createHighSpeedGrowthYield({ readSpeed: () => 32, visibility: () => 'visible',
    now: () => { if (wall === 'throw') throw new Error('host clock'); return wall; },
    requestFrameYield: () => { frames += 1; return Promise.resolve(); },
    requestTaskYield: () => assert.fail('An uncertain deadline must not defer the frame.'),
  });
  await request();
  for (wall of [99, NaN, Infinity, 'throw']) await request();
  assert.equal(frames, 5);
});

await check('separate phase policies do not share their frame history', async () => {
  let frames = 0;
  const options = { readSpeed: () => 32, visibility: () => 'visible', now: () => 0,
    requestFrameYield: () => { frames += 1; return Promise.resolve(); }, requestTaskYield: () => Promise.resolve(),
  };
  const first = createHighSpeedGrowthYield(options), second = createHighSpeedGrowthYield(options);
  await first(); await first(); await second(); assert.equal(frames, 2);
});

await check('unresolved periodic frames cannot allow actions, shared costs or RNG draws to overtake them', async () => {
  let wall = 0;
  const pause = deferred(), events = [], source = createSeedRng('growth-policy-pending');
  const request = createHighSpeedGrowthYield({ readSpeed: () => 32, visibility: () => 'visible', now: () => wall,
    requestFrameYield: () => pause.promise, requestTaskYield: () => Promise.resolve(),
  });
  function* work() { wall += 8; events.push(simulationRandom()); yield; wall += 8; events.push(simulationRandom()); }
  const pending = runSimulationSteps(source, runGrowthActionSteps(work(), { now: () => wall, requestYield: request }));
  assert.equal(events.length, 1); assert.equal(getActiveSimulationRandom(), null);
  const before = source.getState(); await Promise.resolve(); assert.deepEqual(source.getState(), before);
  pause.resolve(); await pending; assert.equal(events.length, 2);
});

await check('request failures preserve the original error and close the growth iterator once', async () => {
  for (const synchronous of [true, false]) {
    let closed = 0, steps = 0, wall = 0;
    const failure = new Error('frame request failure');
    const request = createHighSpeedGrowthYield({ readSpeed: () => 32, visibility: () => 'visible', now: () => wall,
      requestFrameYield: () => { if (synchronous) throw failure; return Promise.reject(failure); },
    });
    function* work() { try { steps += 1; wall += 8; yield; assert.fail('No action after failure.'); } finally { closed += 1; } }
    await assert.rejects(runSimulationSteps(null, runGrowthActionSteps(work(), { now: () => wall, requestYield: request })), error => error === failure);
    assert.equal(steps, 1); assert.equal(closed, 1); assert.equal(getActiveSimulationRandom(), null);
  }
});

await check('task request failures after a completed frame preserve errors, action order and RNG release', async () => {
  for (const synchronous of [true, false]) {
    let closed = 0, completed = 0, wall = 0;
    const failure = new Error('task request failure'), source = createSeedRng('growth-task-failure');
    const request = createHighSpeedGrowthYield({ readSpeed: () => 32, visibility: () => 'visible', now: () => wall,
      requestFrameYield: () => Promise.resolve(),
      requestTaskYield: () => { if (synchronous) throw failure; return Promise.reject(failure); },
    });
    function* work() {
      try { for (let i = 0; i < 3; i += 1) { wall += 8; completed += 1; simulationRandom(); yield; } }
      finally { closed += 1; }
    }
    await assert.rejects(runSimulationSteps(source, runGrowthActionSteps(work(), { now: () => wall, requestYield: request })), error => error === failure);
    assert.equal(completed, 2); assert.equal(closed, 1); assert.equal(getActiveSimulationRandom(), null);
    assert.equal(source.getState().draws, 2);
  }
});

await check('cancelling a growth batch at its frame wait cannot resume actions after late settlement', async () => {
  let wall = 0, completed = 0, closed = 0;
  const pause = deferred();
  const request = createHighSpeedGrowthYield({ readSpeed: () => 32, visibility: () => 'visible', now: () => wall,
    requestFrameYield: () => pause.promise, requestTaskYield: () => assert.fail('No work after cancellation.'),
  });
  function* work() {
    try { wall += 8; completed += 1; yield; assert.fail('Cancelled action batch.'); }
    finally { closed += 1; }
  }
  const iterator = runGrowthActionSteps(work(), { now: () => wall, requestYield: request });
  const first = iterator.next(); assert.equal(first.done, false); assert.equal(completed, 1);
  iterator.return(); assert.equal(closed, 1);
  pause.resolve(); await first.value;
  assert.equal(iterator.next().done, true); assert.equal(completed, 1); assert.equal(closed, 1);
});

const modelResults = [];
await check('a deterministic refresh-rate model reduces forced RAF waits without losing any checkpoint or random draw', async () => {
  for (const hz of [30, 60, 120]) {
    const run = async (optimized) => {
      // Integer host ticks avoid a floating-point 7.999...ms budget deciding
      // whether two identical 4ms checkpoints require an extra yield. Read a
      // quantized scheduling clock; this is not a real refresh-rate benchmark.
      let wallTicks = 0, frameWaits = 0, taskWaits = 0;
      const now = () => Math.floor(wallTicks / 240);
      const source = createSeedRng('growth-policy-model'), events = [];
      const hostNoise = () => { assert.equal(getActiveSimulationRandom(), null); Math.random(); };
      const frame = () => Promise.resolve().then(() => {
        hostNoise(); frameWaits += 1;
        const frameTicks = 240000 / hz;
        wallTicks = (Math.floor(wallTicks / frameTicks) + 1) * frameTicks;
      });
      const task = () => Promise.resolve().then(() => { hostNoise(); taskWaits += 1; wallTicks += 48; });
      const request = optimized ? createHighSpeedGrowthYield({ readSpeed: () => 32, visibility: () => 'visible',
        now, requestFrameYield: frame, requestTaskYield: task }) : frame;
      function* work() {
        for (let i = 0; i < 200; i += 1) { wallTicks += 960; events.push({ index: i, draw: simulationRandom() }); yield; }
        return { sharedStock: 200 - events.length, checkpoints: events.length };
      }
      const ending = await runSimulationSteps(source, runGrowthActionSteps(work(), { now, requestYield: request }));
      return { events, ending, rng: source.getState(), frameWaits, taskWaits, modeledWallMs: wallTicks / 240 };
    };
    const original = await run(false), current = await run(true);
    assert.deepEqual(current.events, original.events); assert.deepEqual(current.ending, original.ending);
    assert.deepEqual(current.rng, original.rng);
    assert.equal(current.frameWaits + current.taskWaits, original.frameWaits);
    assert.ok(current.taskWaits > 0); assert.ok(current.frameWaits < original.frameWaits);
    assert.ok(current.modeledWallMs < original.modeledWallMs);
    modelResults.push({ hz, originalFrameWaits: original.frameWaits, currentFrameWaits: current.frameWaits,
      currentTaskWaits: current.taskWaits, sameCheckpointsAndRng: true });
  }
});

await check('production phase creates one speed-aware policy and keeps action-frame and setup yields', () => {
  const cycle = fs.readFileSync(new URL('../src/app/simulation/_lib/simulationPhaseCycleRuntime.js', import.meta.url), 'utf8');
  assert.match(cycle, /const requestGrowthYield = createHighSpeedGrowthYield\(/);
  assert.match(cycle, /readSpeed:[\s\S]*?autoSpeedRef\?\.current \|\| autoSpeed/);
  assert.match(cycle, /\{ requestYield: requestGrowthYield \}/);
  assert.match(cycle, /const phaseSetupYield = requestSimulationFrameYield\(\)/);
  assert.match(cycle, /requestMainThreadYield:\s*requestSimulationMainThreadYield/);
});

console.log(JSON.stringify({ checks, pass: true, modelResults,
  scope: 'phase-local x32-only scheduling, bounded frame requests, lower-speed behavior, pending/error/RNG ownership and synthetic refresh-rate workload; not actual browser throughput or full-match equivalence' }));
