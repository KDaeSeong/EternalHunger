import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Opening cadence is intentionally different from the old twenty-second
// rules. Compare current production execution modes, not an obsolete match
// outcome. Opening deadline/recipe contracts are checked separately, and old
// saved replays remain protected by the generated engine-version gate.
const root = fileURLToPath(new URL('../../', import.meta.url));
const digest = value => createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');
const seed = process.argv.find(arg => arg.startsWith('--seed='))?.slice(7) || '1101';
const worker = process.argv.find(arg => arg.startsWith('--worker='))?.slice(9);

if (worker) {
  const { createRandomIsolationInput, runRandomIsolationMatch } = await import('./lib/run-random-isolation-match.mjs');
  const { getActiveSimulationRandom, withSimulationRandom } = await import('../src/utils/simulationRandom.js');
  const { createSeedRng } = await import('../src/app/simulation/_lib/randomSeedRuntime.js');
  const { SIMULATION_ENGINE_VERSION } = await import('../src/app/simulation/_generated/simulationEngineVersion.js');
  const { createObserverPerformanceProbe } = await import('../src/app/simulation/_lib/observerPerformanceRuntime.js');
  const input = await createRandomIsolationInput(seed);
  let yields = 0, frameYields = 0, syntheticTime = 0;
  const visible = worker === 'visible-cooperative', cooperative = worker === 'cooperative' || visible;
  const timers = new Map(), frames = new Map(), listeners = new Set(); let hostId = 0;
  const originalWindow = globalThis.window, originalScheduler = globalThis.scheduler, originalPerformance = globalThis.performance;
  if (cooperative) {
    // Inject only host scheduling/time and unrelated UI randomness. All
    // production growth, shared stocks, combat, frames and RNG code still runs.
    const uiSource = createSeedRng('unrelated-ui');
    const hostNoise = () => {
      assert.equal(getActiveSimulationRandom(), null, 'Browser waits must release the game RNG.');
      withSimulationRandom(uiSource, () => uiSource()); Math.random();
    };
    globalThis.window = { document: { visibilityState: visible ? 'visible' : 'hidden',
      addEventListener: (type, callback) => { assert.equal(type, 'visibilitychange'); listeners.add(callback); },
      removeEventListener: (type, callback) => { assert.equal(type, 'visibilitychange'); listeners.delete(callback); } } };
    if (visible) Object.assign(globalThis.window, {
      // A deterministic host fixture, not real browser frame timing. Dispatch
      // RAF and its follow-up task separately; hold the watchdog for cancellation.
      requestAnimationFrame: callback => {
        const id = hostId++; frames.set(id, callback);
        queueMicrotask(() => { if (frames.delete(id)) { hostNoise(); frameYields += 1; callback(syntheticTime); } });
        return id;
      },
      cancelAnimationFrame: id => frames.delete(id),
      setTimeout: (callback, delay) => {
        const id = hostId++; timers.set(id, callback);
        if (delay === 0) queueMicrotask(() => { if (timers.delete(id)) { hostNoise(); callback(); } });
        return id;
      },
      clearTimeout: id => timers.delete(id),
    });
    globalThis.performance = { now: () => syntheticTime += 9 };
    globalThis.scheduler = { yield: () => Promise.resolve().then(() => {
      yields += 1;
      hostNoise();
    }) };
  }
  // Exercise enabled diagnostic subscriptions as well as scheduler/UI noise.
  // This independent fake clock proves non-interference, never browser timing.
  let diagnosticTime = 0;
  const probe = createObserverPerformanceProbe({
    windowRef: { requestAnimationFrame: () => 1, cancelAnimationFrame: () => {} },
    performanceRef: { now: () => diagnosticTime++ }, documentRef: {},
  });
  probe.start({ label: 'synthetic-node-determinism' });
  let result, diagnostic;
  try { result = await runRandomIsolationMatch(input, { noisy: cooperative }); }
  finally {
    diagnostic = probe.stop();
    globalThis.window = originalWindow; globalThis.scheduler = originalScheduler; globalThis.performance = originalPerformance;
  }
  if (cooperative) assert.ok(yields > 1000, 'Exercise repeated scheduling, not only the synchronous fallback.');
  if (visible) assert.ok(frameYields > 1000, 'Exercise repeated visible frame deadlines, not only task yields.');
  assert.equal(frames.size, 0); assert.equal(timers.size, 0); assert.equal(listeners.size, 0);
  assert.ok(diagnostic.workBreakdown.stages.some(stage => stage.name === 'growth.teamCoordination' && stage.count > 0));
  console.log(JSON.stringify({ worker, engine: SIMULATION_ENGINE_VERSION, yields, frameYields,
    diagnosticScope: 'enabled probe with independent fake clock; not browser performance',
    diagnosticStages: diagnostic.workBreakdown.stages.map(stage => ({ name: stage.name, count: stage.count })),
    outcome: { inputDigest: digest(input), evidence: result.evidence, finalFrameDigest: digest(result.finalFrame), logDigest: digest(result.logs) },
  }));
} else {
  const results = [];
  for (const mode of ['headless', 'cooperative', 'visible-cooperative']) {
    const output = execFileSync(process.execPath, [fileURLToPath(import.meta.url), `--worker=${mode}`, `--seed=${seed}`], {
      cwd: root, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024, stdio: ['ignore', 'pipe', 'inherit'],
    });
    const result = JSON.parse(output.trim()); results.push(result);
    console.log(JSON.stringify({ completed: mode, ...result }));
  }
  assert.deepEqual(results[1].outcome, results[0].outcome, 'Browser checkpoints and UI noise must retain the current production match.');
  assert.deepEqual(results[2].outcome, results[0].outcome, 'Visible frame deadlines must retain the current production match.');
  console.log(JSON.stringify({ pass: true, seed, matches: 3, cooperativeYields: results[1].yields,
    visibleTaskYields: results[2].yields, visibleFrameYields: results[2].frameYields,
    scope: 'current headless versus hidden and visible cooperative complete 24-actor fixture: input, events, every published frame, ending, logs and RNG; deterministic host scheduling, not historical output dependency, real browser performance or human evaluation' }));
}
