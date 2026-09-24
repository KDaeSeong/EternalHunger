import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const { requestSimulationFrameYield, requestSimulationMainThreadYield } = await import('../src/app/simulation/_lib/simulationCooperativeYieldRuntime.js');
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
  assert.match(cycle, /const phaseSetupYield = requestSimulationFrameYield\(\)/);
  assert.match(cycle, /if \(phaseSetupYield\) yield phaseSetupYield/);
  assert.match(cycle, /requestMainThreadYield:\s*requestSimulationMainThreadYield/);
  assert.match(cycle, /const phaseFinalizationYield = requestSimulationMainThreadYield\(\)/);
});

console.log(JSON.stringify({ checks, pass: true, scope: 'scheduler ownership, fallback, RNG and wiring contracts; not browser timing or paint proof' }));
