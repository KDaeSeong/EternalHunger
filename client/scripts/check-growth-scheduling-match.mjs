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
  let yields = 0, syntheticTime = 0;
  const originalWindow = globalThis.window, originalScheduler = globalThis.scheduler, originalPerformance = globalThis.performance;
  if (worker === 'cooperative') {
    // Inject only host scheduling/time and unrelated UI randomness. All
    // production growth, shared stocks, combat, frames and RNG code still runs.
    const uiSource = createSeedRng('unrelated-ui');
    globalThis.window = { document: { visibilityState: 'hidden' } };
    globalThis.performance = { now: () => syntheticTime += 9 };
    globalThis.scheduler = { yield: () => Promise.resolve().then(() => {
      yields += 1;
      assert.equal(getActiveSimulationRandom(), null, 'Browser waits must release the game RNG.');
      withSimulationRandom(uiSource, () => uiSource());
      Math.random();
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
  try { result = await runRandomIsolationMatch(input, { noisy: worker === 'cooperative' }); }
  finally {
    diagnostic = probe.stop();
    globalThis.window = originalWindow; globalThis.scheduler = originalScheduler; globalThis.performance = originalPerformance;
  }
  assert.ok(diagnostic.workBreakdown.stages.some(stage => stage.name === 'growth.teamCoordination' && stage.count > 0));
  if (worker === 'cooperative') assert.ok(yields > 1000, 'Exercise repeated real scheduling, not only the synchronous fallback.');
  console.log(JSON.stringify({ worker, engine: SIMULATION_ENGINE_VERSION, yields,
    diagnosticScope: 'enabled probe with independent fake clock; not browser performance',
    diagnosticStages: diagnostic.workBreakdown.stages.map(stage => ({ name: stage.name, count: stage.count })),
    outcome: { inputDigest: digest(input), evidence: result.evidence, finalFrameDigest: digest(result.finalFrame), logDigest: digest(result.logs) },
  }));
} else {
  const results = [];
  for (const mode of ['headless', 'cooperative']) {
    const output = execFileSync(process.execPath, [fileURLToPath(import.meta.url), `--worker=${mode}`, `--seed=${seed}`], {
      cwd: root, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024, stdio: ['ignore', 'pipe', 'inherit'],
    });
    const result = JSON.parse(output.trim()); results.push(result);
    console.log(JSON.stringify({ completed: mode, ...result }));
  }
  assert.deepEqual(results[1].outcome, results[0].outcome, 'Browser checkpoints and UI noise must retain the current production match.');
  console.log(JSON.stringify({ pass: true, seed, matches: 2, cooperativeYields: results[1].yields,
    scope: 'current headless versus cooperative complete 24-actor fixture with enabled diagnostics: input, events, every published frame, ending, logs and RNG; deliberate opening-rule change, not historical outcome preservation, browser performance or human evaluation' }));
}
