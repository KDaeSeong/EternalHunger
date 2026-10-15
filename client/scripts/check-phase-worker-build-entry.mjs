import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import { TextDecoder, TextEncoder } from 'node:util';

const clientRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const buildRoot = path.join(clientRoot, '.next');
const chunksRoot = path.join(buildRoot, 'static', 'chunks');
assert.ok(statSync(buildRoot).isDirectory(), 'A completed client/.next build is required.');
const buildId = readFileSync(path.join(buildRoot, 'BUILD_ID'), 'utf8').trim();
assert.ok(buildId, 'The production build must have a BUILD_ID.');

const engineModulePath = path.join(clientRoot, 'src', 'app', 'simulation', '_generated', 'simulationEngineVersion.js');
const engineModule = readFileSync(engineModulePath, 'utf8');
const sourceEngineVersion = engineModule.match(/SIMULATION_ENGINE_VERSION\s*=\s*'([a-f0-9]{64})'/)?.[1];
assert.ok(sourceEngineVersion, 'Could not read generated simulation engine version.');
const engineSourcePaths = ['src/app/simulation/tacticalSkillTable.js', '../shared/marketItemPolicy.cjs'];
for (const directory of ['src/app/simulation/_lib', 'src/utils']) {
  for (const name of readdirSync(path.join(clientRoot, directory))) {
    if (name.endsWith('.js')) engineSourcePaths.push(`${directory}/${name}`);
  }
}
const sourceHash = createHash('sha256');
for (const relativePath of engineSourcePaths.sort()) {
  const absolutePath = path.resolve(clientRoot, relativePath);
  const source = readFileSync(absolutePath, 'utf8').replaceAll('\r\n', '\n');
  sourceHash.update(relativePath).update('\0').update(source).update('\0');
}
const currentSourceEngineVersion = sourceHash.digest('hex');
assert.equal(sourceEngineVersion, currentSourceEngineVersion,
  'Generated simulation engine version is stale; run the normal prebuild generation before checking a production build.');

const apiSource = readFileSync(path.join(clientRoot, 'src', 'utils', 'api.js'), 'utf8');
const apiBaseLookup = apiSource.match(/export function getApiBase\(\)\s*\{([\s\S]*?)\n\}/)?.[1];
assert.ok(apiBaseLookup, 'Could not isolate getApiBase for the Worker-safe API lookup check.');
assert.ok(/const browserWindow\s*=\s*globalThis\.window\s*;/.test(apiBaseLookup),
  'API base lookup must use the Worker-safe runtime globalThis.window check.');
assert.ok(!/typeof\s+window\s*!==?\s*['"]undefined['"]|(?<![.\w$])window\.location/.test(apiBaseLookup),
  'Do not restore a compile-time-foldable window guard or an unguarded window.location read.');

const chunkNames = readdirSync(chunksRoot).filter(name => /^\d+\.[a-f0-9]+\.js$/.test(name));
const workerCandidates = chunkNames.filter(name => {
  const source = readFileSync(path.join(chunksRoot, name), 'utf8');
  return source.includes('importScripts(') && source.includes('self.webpackChunk_N_E')
    && /globalThis\.postMessage\(\{kind:["']ready["']\}\)/.test(source);
});
assert.equal(workerCandidates.length, 1,
  `Expected exactly one production Webpack worker bootstrap; found ${workerCandidates.length}.`);

const workerName = workerCandidates[0];
const workerPath = path.join(chunksRoot, workerName);
const workerSource = readFileSync(workerPath, 'utf8');
const buildChunkNames = readdirSync(chunksRoot).filter(name => name.endsWith('.js'));
const mainWorkerEntries = buildChunkNames.filter(name => {
  const source = readFileSync(path.join(chunksRoot, name), 'utf8');
  return source.includes('PHASE_WORKER_STARTUP') && source.includes('PHASE_WORKER_EXECUTION');
});
assert.ok(mainWorkerEntries.length > 0, 'Current production build has no phase-worker host/executor entry chunk.');
const simulationManifestPath = path.join(buildRoot, 'server', 'app', 'simulation', 'page_client-reference-manifest.js');
const simulationManifest = readFileSync(simulationManifestPath, 'utf8');
const routeChunkNames = buildChunkNames.filter(name => simulationManifest.includes(name));
assert.ok(mainWorkerEntries.some(name => routeChunkNames.includes(name)),
  'The /simulation production route does not reference its phase-worker host/executor chunk.');
assert.ok(routeChunkNames.some(name => readFileSync(path.join(chunksRoot, name), 'utf8').includes(sourceEngineVersion)),
  `The /simulation production route does not reference a chunk with current engine version ${sourceEngineVersion}; build is stale.`);
const workerDependencySources = new Map([[workerName, workerSource]]);
const allowedImports = new Set();
const startupMessages = [];
const phaseMessages = { frames: 0, actions: 0, finishes: 0, completes: 0, failures: 0, lastSeq: 0,
  phaseId: null, frameFields: '', finalFrame: null, failure: '' };
const listeners = new Map();
const topLevelErrors = [];
const onUnhandledRejection = reason => topLevelErrors.push({ name: String(reason?.name || 'Error'),
  message: String(reason?.message || reason), stack: String(reason?.stack || '') });
let importCount = 0;
let phaseTimersEnabled = false;
const workerTimerSet = new Set();
const nativeSetTimeout = setTimeout;
const nativeClearTimeout = clearTimeout;

const sandbox = {
  addEventListener(type, listener) {
    assert.equal(type, 'message', `Unexpected worker listener: ${String(type)}`);
    assert.equal(typeof listener, 'function');
    listeners.set(type, listener);
    sandbox.__workerMessageListener = listener;
  },
  postMessage(message) {
    if (message?.kind === 'ready') {
      assert.deepEqual(Object.keys(message).sort(), ['kind'], 'READY must contain exactly its contract key.');
      startupMessages.push({ kind: message.kind });
      return;
    }
    assert.equal(message?.phaseId, 1, 'The compiled Worker must preserve the command phase identity.');
    assert.equal(message?.seq, phaseMessages.lastSeq + 1, 'Every compiled Worker message must remain FIFO.');
    if (message?.kind === 'frame') {
      phaseMessages.frames += 1;
      phaseMessages.phaseId ??= message.phaseId;
      phaseMessages.lastSeq = message.seq;
      phaseMessages.frameFields = Object.keys(message.frame || {}).sort().join(',');
      phaseMessages.finalFrame = message.frame || null;
    } else if (message?.kind === 'action') {
      phaseMessages.actions += 1;
      phaseMessages.phaseId ??= message.phaseId;
      phaseMessages.lastSeq = message.seq;
    } else if (message?.kind === 'finish') {
      phaseMessages.finishes += 1;
      phaseMessages.phaseId ??= message.phaseId;
      phaseMessages.lastSeq = message.seq;
    } else if (message?.kind === 'complete') {
      phaseMessages.completes += 1;
      phaseMessages.phaseId ??= message.phaseId;
      phaseMessages.lastSeq = message.seq;
    } else if (message?.kind === 'failed') {
      phaseMessages.failures += 1;
      phaseMessages.phaseId ??= message.phaseId;
      phaseMessages.lastSeq = message.seq;
      phaseMessages.failure = String(message.message || 'Worker phase failed.').slice(0, 300);
    }
  },
  importScripts(url) {
    importCount += 1;
    assert.equal(typeof url, 'string', 'Worker imports must resolve to a same-origin string URL.');
    assert.match(url, /^\/_next\/static\/chunks\/\d+-[a-f0-9]+\.js$/,
      `Blocked non-build importScripts target: ${String(url)}`);
    const name = url.slice('/_next/static/chunks/'.length);
    const resolved = path.resolve(chunksRoot, name);
    const relative = path.relative(chunksRoot, resolved);
    assert.ok(relative && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative),
      `Blocked import outside current build chunks: ${url}`);
    assert.ok(statSync(resolved).isFile(), `Referenced current shared chunk is missing: ${name}`);
    allowedImports.add(name);
    const sharedSource = readFileSync(resolved, 'utf8');
    workerDependencySources.set(name, sharedSource);
    vm.runInContext(sharedSource, context, {
      filename: path.join('.next', 'static', 'chunks', name), timeout: 5000,
    });
  },
  setTimeout(callback, delay, ...args) {
    if (!phaseTimersEnabled) throw new Error('Worker bootstrap unexpectedly requested a timer.');
    const timer = nativeSetTimeout(() => {
      workerTimerSet.delete(timer);
      callback(...args);
    }, delay);
    workerTimerSet.add(timer);
    return timer;
  },
  clearTimeout(timer) { nativeClearTimeout(timer); workerTimerSet.delete(timer); },
  performance,
  structuredClone,
  TextEncoder,
  TextDecoder,
  fetch() { throw new Error('Network access is disabled in the build-entry check.'); },
  XMLHttpRequest() { throw new Error('Network access is disabled in the build-entry check.'); },
  WebSocket() { throw new Error('Network access is disabled in the build-entry check.'); },
};
const context = vm.createContext(sandbox, { name: 'isolated-phase-worker-build' });
sandbox.self = vm.runInContext('globalThis', context);

try {
  process.on('unhandledRejection', onUnhandledRejection);
  vm.runInContext(workerSource, context, {
    filename: path.join('.next', 'static', 'chunks', workerName), timeout: 10000,
  });
  // Webpack's entry waits for Promise.all(sharedChunks) before running the
  // worker module. Let that native microtask chain reach its startup message.
  await new Promise(resolve => setImmediate(resolve));
} catch (error) {
  topLevelErrors.push({ name: String(error?.name || 'Error'), message: String(error?.message || error),
    stack: String(error?.stack || '') });
} finally {
  process.off('unhandledRejection', onUnhandledRejection);
}

assert.ok([...workerDependencySources.values()].some(source => source.includes(sourceEngineVersion)),
  `Production Worker/shared chunks do not contain current engine version ${sourceEngineVersion}; build is stale.`);

if (topLevelErrors.length) {
  const firstError = topLevelErrors[0];
  console.error(`FAIL buildId=${buildId} sourceEngineVersion=${sourceEngineVersion} worker=${workerName} error=${firstError.name}: ${firstError.message}`);
  process.exitCode = 1;
} else {
  assert.ok(importCount > 0, 'Worker bootstrap did not load any shared chunks.');
  assert.ok(listeners.has('message'), 'Worker bootstrap did not register its message listener.');
  assert.equal(startupMessages.length, 1, 'Worker bootstrap must publish exactly one startup message.');
  assert.equal(startupMessages[0].kind, 'ready', 'Worker bootstrap did not reach the ready handshake.');

  // Build a fresh saved input and command with the same registered source
  // helpers used by the simulation Worker path, then cross the JSON boundary.
  await import('./lib/register-simulation-modules.mjs');
  const { createRandomIsolationInput } = await import('./lib/run-random-isolation-match.mjs');
  const { createSimulationRunInput, prepareSimulationRunInput } = await import('../src/app/simulation/_lib/simulationReplayRuntime.js');
  const { createInitialSimulationFrame } = await import('../src/app/simulation/_lib/simulationFrameRuntime.js');
  const { createSimulationPhaseWorkerCommand } = await import('../src/app/simulation/_lib/simulationPhaseWorkerInputRuntime.js');
  const fixture = JSON.parse(await createRandomIsolationInput('1101'));
  const savedInput = createSimulationRunInput({ activeMap: fixture.map, runSeed: fixture.runSeed,
    settings: fixture.settings, publicItems: fixture.items, survivors: fixture.survivors,
    dead: [], kiosks: [], droneOffers: [], spawnState: null });
  const prepared = prepareSimulationRunInput(savedInput);
  const initialState = { ...createInitialSimulationFrame(), ...prepared.state,
    forbiddenAddedNow: [], forbiddenZoneIds: [], frameMapId: String(prepared.state.activeMapId || ''),
    autoSpeed: 32, selectedCharId: prepared.state.survivors?.[0]?._id || '',
    showMarketPanel: false, pendingTranscendPick: null };
  const command = createSimulationPhaseWorkerCommand({ input: savedInput, state: initialState, refs: {
    startStarterLoadoutAppliedRef: { current: false }, suddenDeathActiveRef: { current: false },
    suddenDeathEndAtSecRef: { current: null }, suddenDeathForbiddenAnnouncedRef: { current: false },
    fullLogEntriesRef: { current: [] }, runRandomRef: { current: null },
  } });
  sandbox.__phaseCommandJson = JSON.stringify({ kind: 'phase', phaseId: 1, command });
  phaseTimersEnabled = true;
  vm.runInContext('globalThis.__workerMessageListener({data: JSON.parse(globalThis.__phaseCommandJson)})', context, { timeout: 10000 });
  const smokeDeadline = Date.now() + 60_000;
  while (phaseMessages.completes === 0 && phaseMessages.failures === 0 && Date.now() < smokeDeadline) {
    await new Promise(resolve => nativeSetTimeout(resolve, 25));
    if (topLevelErrors.length) break;
  }
  for (const timer of workerTimerSet) nativeClearTimeout(timer);
  workerTimerSet.clear();
  if (phaseMessages.failures || phaseMessages.completes !== 1 || topLevelErrors.length) {
    const reason = phaseMessages.failures ? `phase-failed:${phaseMessages.failure}`
      : topLevelErrors.length ? `vm-error:${topLevelErrors[0].name}:${topLevelErrors[0].message}`
        : 'timeout-60s';
    console.error(`FAIL isolated Node vm production Worker first-phase smoke (not browser execution); buildId=${buildId} sourceEngineVersion=${sourceEngineVersion} reason=${reason} phaseId=${phaseMessages.phaseId ?? 'none'} lastSeq=${phaseMessages.lastSeq} frames=${phaseMessages.frames} actions=${phaseMessages.actions} completes=${phaseMessages.completes} failures=${phaseMessages.failures}`);
    process.exitCode = 1;
  } else {
  assert.equal(phaseMessages.phaseId, 1, 'Fresh Worker phase must preserve phaseId 1.');
  assert.ok(phaseMessages.frames > 0, 'Fresh Worker first phase must publish at least one frame.');
  assert.ok(phaseMessages.finalFrame && Number.isFinite(phaseMessages.finalFrame.matchSec),
    'Fresh Worker first phase must retain a final frame with a finite match clock.');
  const finalMatchSec = phaseMessages.finalFrame.matchSec;
  phaseMessages.finalFrame = null;
  console.log(`PASS isolated Node vm production Worker READY + fresh first-phase smoke (not browser or performance acceptance); buildId=${buildId} sourceEngineVersion=${sourceEngineVersion} commandSeq=1 frames=${phaseMessages.frames} frameFields=${phaseMessages.frameFields} finalMatchSec=${finalMatchSec} complete=${phaseMessages.completes} failures=${phaseMessages.failures}`);
  }
}
