import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { registerHooks } from 'node:module';
import { fileURLToPath } from 'node:url';

// Freeze the four changed execution paths, not the entire engine or its test
// harness. The reference never resolves to moving HEAD. This checks outcome
// preservation; it does not bypass the product replay-version gate.
const referenceCommit = 'f6683b9e4efc05c8adb1685309ae297869264306';
const referenceFiles = ['phaseActorActionPipelineRuntime.js', 'phaseActionTimelineRuntime.js',
  'simulationPhaseCycleRuntime.js', 'phasePvpActionLoopRuntime.js'];
const root = fileURLToPath(new URL('../../', import.meta.url));
const digest = value => createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');
const seed = process.argv.find(arg => arg.startsWith('--seed='))?.slice(7) || '1101';
const worker = process.argv.find(arg => arg.startsWith('--worker='))?.slice(9);

if (worker) {
  const sources = new Map();
  if (worker === 'reference') {
    for (const file of referenceFiles) {
      const source = execFileSync('git', ['show', `${referenceCommit}:client/src/app/simulation/_lib/${file}`], { cwd: root, encoding: 'utf8' });
      sources.set(new URL(`../src/app/simulation/_lib/${file}`, import.meta.url).href, source);
    }
    registerHooks({ load(url, context, nextLoad) {
      return sources.has(url) ? { format: 'module', source: sources.get(url), shortCircuit: true } : nextLoad(url, context);
    } });
  }
  const { createRandomIsolationInput, runRandomIsolationMatch } = await import('./lib/run-random-isolation-match.mjs');
  const { getActiveSimulationRandom, withSimulationRandom } = await import('../src/utils/simulationRandom.js');
  const { createSeedRng } = await import('../src/app/simulation/_lib/randomSeedRuntime.js');
  const { SIMULATION_ENGINE_VERSION } = await import('../src/app/simulation/_generated/simulationEngineVersion.js');
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
  let result;
  try { result = await runRandomIsolationMatch(input, { noisy: worker === 'cooperative' }); }
  finally {
    globalThis.window = originalWindow; globalThis.scheduler = originalScheduler; globalThis.performance = originalPerformance;
  }
  if (worker === 'cooperative') assert.ok(yields > 1000, 'Exercise repeated real scheduling, not only the synchronous fallback.');
  console.log(JSON.stringify({ worker, engine: SIMULATION_ENGINE_VERSION, yields,
    referenceCommit: worker === 'reference' ? referenceCommit : null,
    referenceSources: [...sources].map(([url, source]) => ({ file: url.split('/').at(-1), sha256: digest(source) })),
    outcome: { inputDigest: digest(input), evidence: result.evidence, finalFrameDigest: digest(result.finalFrame), logDigest: digest(result.logs) },
  }));
} else {
  const results = [];
  for (const mode of ['reference', 'headless', 'cooperative']) {
    const output = execFileSync(process.execPath, [fileURLToPath(import.meta.url), `--worker=${mode}`, `--seed=${seed}`], {
      cwd: root, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024, stdio: ['ignore', 'pipe', 'inherit'],
    });
    const result = JSON.parse(output.trim()); results.push(result);
    console.log(JSON.stringify({ completed: mode, ...result }));
  }
  assert.deepEqual(results[1].outcome, results[0].outcome, 'Current synchronous fallback must retain the pre-change match.');
  assert.deepEqual(results[2].outcome, results[0].outcome, 'Browser checkpoints and UI noise must retain the pre-change match.');
  console.log(JSON.stringify({ pass: true, seed, referenceCommit, matches: 3, cooperativeYields: results[2].yields,
    scope: 'frozen pre-change execution paths versus current complete 24-actor fixture: input, events, every published frame, ending, logs and RNG; not browser performance or human evaluation' }));
}
