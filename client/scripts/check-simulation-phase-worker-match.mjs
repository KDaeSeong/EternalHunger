import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { Worker } from 'node:worker_threads';

const { createRandomIsolationInput } = await import('./lib/run-random-isolation-match.mjs');
const { appendSimulationLog, appendVisibleRunEvents, emitSimulationRunEvent } = await import('../src/app/simulation/_lib/logActionRuntime.js');
const { createSimulationEventActions } = await import('../src/app/simulation/_lib/simulationEventActionsRuntime.js');
const { createInitialSimulationFrame, createSimulationFrame, SIMULATION_FRAME_FIELDS } = await import('../src/app/simulation/_lib/simulationFrameRuntime.js');
const { runGuardedPhaseAdvance } = await import('../src/app/simulation/_lib/phaseControllerGuards.js');
const { getActorTeamId } = await import('../src/app/simulation/_lib/teamRuntime.js');
const { createSeedRng } = await import('../src/app/simulation/_lib/randomSeedRuntime.js');
const { createSimulationRunInput, prepareSimulationRunInput, semanticRunEvents } = await import('../src/app/simulation/_lib/simulationReplayRuntime.js');
const { normalizeAutoSpeed } = await import('../src/app/simulation/_lib/simulationSpeedRuntime.js');
const { createSimulationPhaseWorkerClient } = await import('../src/app/simulation/_lib/simulationPhaseWorkerClientRuntime.js');
const { createSimulationPhaseWorkerCommand } = await import('../src/app/simulation/_lib/simulationPhaseWorkerInputRuntime.js');
const { runSimulationPhaseCycle } = await import('../src/app/simulation/_lib/simulationPhaseCycleRuntime.js');
const { subscribeObserverWorkMeasurements } = await import('../src/app/simulation/_lib/observerWorkMeasurementRuntime.js');

const taskYield = () => new Promise((resolve) => setImmediate(resolve));
const now = () => Number.NaN;
const args = process.argv.slice(2);
assert.ok(args.every((arg) => arg === '--finite-transport'), `Unknown arguments: ${args.filter((arg) => arg !== '--finite-transport').join(' ')}`);
assert.ok(new Set(args).size === args.length, 'Duplicate arguments are not supported.');
const finiteTransport = args.includes('--finite-transport');
const clockNow = finiteTransport ? () => performance.now() : now;
const wait = async () => {};
const WORKER_MEASUREMENT_ENTRY_LIMIT = 64;

function scalarWorkerDiagnostics(value) {
  if (!value || typeof value !== 'object') return null;
  const scalarStats = (stats) => ({ count: stats?.count, measuredCount: stats?.measuredCount,
    totalMs: stats?.totalMs ?? null, maxMs: stats?.maxMs ?? null });
  return {
    schema: value.schema,
    status: value.status,
    elapsedMs: value.elapsedMs ?? null,
    stages: (Array.isArray(value.stages) ? value.stages : []).slice(0, 24).map((row) => ({
      name: typeof row?.name === 'string' ? row.name.slice(0, 80) : '', ...scalarStats(row),
    })),
    hostWaits: { task: scalarStats(value.hostWaits?.task), display: scalarStats(value.hostWaits?.display) },
    messagesBeforeTerminal: (Array.isArray(value.messagesBeforeTerminal) ? value.messagesBeforeTerminal : [])
      .slice(0, 32).map((row) => ({ kind: typeof row?.kind === 'string' ? row.kind.slice(0, 80) : '', ...scalarStats(row) })),
  };
}

function assertWorkerMeasurementSummary(entries, dropped, phases) {
  assert.equal(dropped, 0, 'Worker measurement event cap must not be exceeded.');
  assert.ok(entries.length <= WORKER_MEASUREMENT_ENTRY_LIMIT, 'Worker measurement event list must remain bounded.');
  const starts = entries.filter((entry) => entry.kind === 'start');
  const terminals = entries.filter((entry) => entry.kind === 'terminal');
  assert.equal(entries.length, phases * 2, 'Every worker phase must have exactly one request and terminal measurement.');
  assert.equal(starts.length, phases, 'Worker measurement request count differs from phase count.');
  assert.equal(terminals.length, phases, 'Worker measurement terminal count differs from phase count.');
  assert.equal(new Set(starts.map((entry) => entry.id)).size, phases, 'Worker measurement ids must be unique.');
  assert.equal(new Set(starts.map((entry) => entry.phaseId)).size, phases, 'Worker measurement phase ids must be unique.');
  for (const start of starts) {
    assert.ok(Number.isSafeInteger(start.id) && start.id > 0 && Number.isSafeInteger(start.phaseId) && start.phaseId > 0,
      'Worker measurement request ids must be positive safe integers.');
    const matches = terminals.filter((entry) => entry.id === start.id && entry.phaseId === start.phaseId);
    assert.equal(matches.length, 1, 'Each request must have exactly one matching terminal id/phase pair.');
    const terminal = matches[0];
    assert.ok(terminal.clientElapsedMs === null || (Number.isFinite(terminal.clientElapsedMs) && terminal.clientElapsedMs >= 0),
      'Worker client elapsed time must be null or a finite nonnegative scalar.');
    assert.equal(terminal.diagnostics?.schema, 'eh-worker-phase-performance.v1', 'Worker diagnostic schema is incomplete.');
    assert.equal(terminal.diagnostics?.status, 'complete', 'Worker diagnostic terminal status must be complete.');
    const diagnostics = terminal.diagnostics;
    assert.ok(diagnostics.elapsedMs === null || (Number.isFinite(diagnostics.elapsedMs) && diagnostics.elapsedMs >= 0),
      'Worker elapsed time must be null or a finite nonnegative scalar.');
    assert.ok(diagnostics.stages.length <= 24 && diagnostics.messagesBeforeTerminal.length <= 32,
      'Worker diagnostic row caps must be respected.');
    const checkStats = (stats) => {
      assert.ok(Number.isSafeInteger(stats.count) && stats.count >= 0
        && Number.isSafeInteger(stats.measuredCount) && stats.measuredCount >= 0 && stats.measuredCount <= stats.count,
      'Worker diagnostic counters must be bounded nonnegative integers.');
      for (const duration of [stats.totalMs, stats.maxMs]) {
        assert.ok(duration === null || (Number.isFinite(duration) && duration >= 0),
          'Worker diagnostic durations must be null or finite nonnegative scalars.');
      }
    };
    for (const row of diagnostics.stages) {
      assert.ok(typeof row.name === 'string' && row.name.length <= 80, 'Worker stage name must be bounded.');
      checkStats(row);
    }
    for (const row of diagnostics.messagesBeforeTerminal) {
      assert.ok(typeof row.kind === 'string' && row.kind.length <= 80, 'Worker message kind must be bounded.');
      checkStats(row);
    }
    checkStats(diagnostics.hostWaits.task);
    checkStats(diagnostics.hostWaits.display);
  }
  return { phases, pairs: starts.length, stageRows: terminals.reduce((sum, entry) => sum + entry.diagnostics.stages.length, 0),
    messageRows: terminals.reduce((sum, entry) => sum + entry.diagnostics.messagesBeforeTerminal.length, 0) };
}

function hashFrame(hash, frame) {
  const serialized = JSON.stringify(frame);
  hash.update(`${Buffer.byteLength(serialized)}:`);
  hash.update(serialized);
  hash.update('\n');
}

function digest(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function makeHarness(savedInput, { nowFn = now } = {}) {
  const prepared = prepareSimulationRunInput(savedInput);
  const frame = { ...createInitialSimulationFrame(), ...prepared.state,
    forbiddenAddedNow: [], forbiddenZoneIds: [], frameMapId: String(prepared.state.activeMapId || '') };
  const state = { ...frame, autoSpeed: 32, selectedCharId: frame.survivors[0]?._id || '',
    showMarketPanel: false, pendingTranscendPick: null, loading: false, isGameOver: false };
  const refs = {
    activeMapRef: { current: prepared.state.activeMap },
    activeMapIdRef: { current: prepared.state.activeMapId },
    autoSpeedRef: { current: 32 },
    runRandomRef: { current: null },
    fullLogsRef: { current: [] },
    fullLogEntriesRef: { current: [] },
    logSeqRef: { current: 0 },
    fullRunEventsRef: { current: [] },
    isAdvancingRef: { current: false },
    startStarterLoadoutAppliedRef: { current: false },
    suddenDeathActiveRef: { current: false },
    suddenDeathEndAtSecRef: { current: null },
    suddenDeathForbiddenAnnouncedRef: { current: false },
  };
  const frameHash = createHash('sha256');
  const frameDigests = [];
  const counters = { frames: 0, phases: 0, finishCalls: 0, blockedStorageCalls: 0,
    blockedAccountCalls: 0, blockedPaidApiCalls: 0 };
  let visibleLogs = [];
  let visibleEvents = [];
  let finalFrame = null;
  let finish = null;
  let lastFrameSec = -Infinity;

  const addLog = (text, type) => appendSimulationLog({ text, type, refs,
    actions: { setLogs: (update) => { visibleLogs = update(visibleLogs); } } });
  const emitRunEvent = (kind, payload, at) => emitSimulationRunEvent({ kind, payload, at, state, refs,
    actions: { enqueueOwnedRunEvent: (event) => { visibleEvents = appendVisibleRunEvents(visibleEvents, [event]); } } });
  const eventActions = createSimulationEventActions({ addLog, emitRunEvent });

  function setFrame(nextFrame) {
    assert.deepEqual(Object.keys(nextFrame).sort(), [...SIMULATION_FRAME_FIELDS].sort(), 'Every published frame must contain the full frame schema.');
    assert.ok(Number.isFinite(nextFrame.matchSec) && nextFrame.matchSec >= lastFrameSec, 'Baseline frame clock must be finite and monotonic.');
    lastFrameSec = nextFrame.matchSec;
    finalFrame = nextFrame;
    Object.assign(state, nextFrame);
    counters.frames += 1;
    hashFrame(frameHash, nextFrame);
    frameDigests.push(digest(nextFrame));
  }

  function setRunEvents(rows) {
    refs.fullRunEventsRef.current = structuredClone(rows);
    visibleEvents = rows.slice(-5000);
  }

  function recordFinish(finalSurvivors, latestKillCounts, latestAssistCounts, options) {
    counters.finishCalls += 1;
    finish = {
      finalSurvivors: structuredClone(finalSurvivors),
      latestKillCounts: structuredClone(latestKillCounts),
      latestAssistCounts: structuredClone(latestAssistCounts),
      options: structuredClone(options),
      finalFrame: structuredClone(finalFrame),
      events: semanticRunEvents(refs.fullRunEventsRef.current),
      logs: structuredClone(refs.fullLogsRef.current),
      logEntries: structuredClone(refs.fullLogEntriesRef.current),
      random: refs.runRandomRef.current?.getState?.() || null,
    };
  }

  const actions = {
    ...eventActions,
    addLog,
    emitRunEvent,
    normalizeAutoSpeed,
    resetPhaseLogs: () => { visibleLogs = []; },
    applyUserEconomyProgress: () => { counters.blockedAccountCalls += 1; },
    persistSimEquipmentsFromChars: () => {
      counters.blockedStorageCalls += 1;
      return Promise.resolve();
    },
    setPendingTranscendPick: (value) => { state.pendingTranscendPick = value; },
    finishGame: recordFinish,
    setSimulationFrame: setFrame,
    requestMainThreadYield: taskYield,
    requestFrameYield: taskYield,
    growthYieldOptions: { visibility: () => 'visible', now: nowFn, requestTaskYield: taskYield, requestFrameYield: taskYield },
    visibleClockNow: nowFn,
    visibleClockVisibility: () => 'visible',
    waitForVisibleTick: (ms) => ms > 0 ? wait(ms) : taskYield(),
    setIsAdvancing: () => {},
    setRunEvents,
  };
  for (const field of ['day', 'phase', 'matchSec', 'dead', 'survivors', 'spawnState', 'killCounts', 'assistCounts']) {
    actions[`set${field[0].toUpperCase()}${field.slice(1)}`] = (value) => {
      state[field] = typeof value === 'function' ? value(state[field]) : value;
    };
  }

  return { prepared, state, refs, actions, counters, frameHash, get finish() { return finish; },
    frameDigests, get finalFrame() { return finalFrame; }, get visibleEvents() { return visibleEvents; } };
}

async function runBaseline(savedInput, { nowFn = now } = {}) {
  const harness = makeHarness(savedInput, { nowFn });
  for (let count = 0; !harness.finish && count < 20; count += 1) {
    await runGuardedPhaseAdvance({ refs: harness.refs, state: harness.state, actions: harness.actions,
      proceedPhase: async () => {
        harness.counters.phases += 1;
        await runSimulationPhaseCycle({ actions: harness.actions, helpers: harness.prepared.helpers,
          refs: harness.refs, state: harness.state });
      } });
  }
  assert.ok(harness.finish, 'Baseline did not naturally finish within 20 phases.');
  console.log(`BASELINE_COMPLETE phases=${harness.counters.phases} frames=${harness.counters.frames}`);
  return harness;
}

async function runWorker(savedInput, { finiteTransport: useFiniteTransport = false, nowFn = now } = {}) {
  const harness = makeHarness(savedInput, { nowFn });
  const allWorkerFramesHash = createHash('sha256');
  const workerFrameDigests = [];
  const sourceFrameReceipts = [];
  let allWorkerFrames = 0;
  let workerClockMonotonic = true;
  let lastWorkerFrameSec = -Infinity;
  let didMutatePostMessageInput = false;
  const workerMeasurementEntries = [];
  let droppedWorkerMeasurementEntries = 0;
  let worker;
  const client = createSimulationPhaseWorkerClient({
    createWorker: () => {
      const rawWorker = new Worker(new URL('./lib/simulation-phase-worker-host.mjs', import.meta.url), {
        workerData: { finiteTransport: useFiniteTransport },
      });
      const adapters = new Map();
      worker = {
        addEventListener(type, callback) {
          const adapter = type === 'message'
            ? (data) => {
              if (useFiniteTransport && data?.kind === 'source-proof') {
                sourceFrameReceipts.push({ sourceDigest: data.sourceDigest, phaseId: data.phaseId,
                  sourceIndex: data.sourceIndex, emitted: data.emitted, force: data.force, atMs: data.atMs });
                return;
              }
              callback({ data });
            }
            : (error) => callback({ error, preventDefault() {} });
          adapters.set(callback, { type, adapter });
          rawWorker.on(type, adapter);
        },
        removeEventListener(type, callback) {
          const entry = adapters.get(callback);
          if (entry?.type === type) rawWorker.off(type, entry.adapter);
          adapters.delete(callback);
        },
        terminate: rawWorker.terminate.bind(rawWorker),
        postMessage(message) {
          rawWorker.postMessage(message);
          if (message?.kind === 'phase' && !didMutatePostMessageInput) {
            const owned = message.command?.input;
            assert.ok(owned && owned !== savedInput, 'Worker command must own its input before transfer.');
            owned.map.zones[0].name = 'POST_TRANSFER_MUTATION';
            owned.initialFrame.survivors[0].hp = -987654;
            didMutatePostMessageInput = true;
          }
        },
      };
      rawWorker.on('message', (message) => {
        if (message?.kind !== 'frame') return;
        allWorkerFrames += 1;
        if (!message.frame || !Number.isFinite(message.frame.matchSec) || message.frame.matchSec < lastWorkerFrameSec
          || JSON.stringify(Object.keys(message.frame).sort()) !== JSON.stringify([...SIMULATION_FRAME_FIELDS].sort())) {
          workerClockMonotonic = false;
        }
        lastWorkerFrameSec = message.frame?.matchSec;
        hashFrame(allWorkerFramesHash, message.frame);
        workerFrameDigests.push(digest(message.frame));
      });
      return worker;
    },
    scheduleFrame: (callback) => setImmediate(callback),
    cancelFrame: clearImmediate,
  });
  const unsubscribeWorkerMeasurements = subscribeObserverWorkMeasurements(nowFn, () => {}, null, (entry) => {
    if (workerMeasurementEntries.length >= WORKER_MEASUREMENT_ENTRY_LIMIT) {
      droppedWorkerMeasurementEntries += 1;
      return;
    }
    workerMeasurementEntries.push({ kind: entry?.kind, id: entry?.id, phaseId: entry?.phaseId,
      clientElapsedMs: entry?.clientElapsedMs ?? null,
      diagnostics: entry?.kind === 'terminal' ? scalarWorkerDiagnostics(entry.diagnostics) : null });
  });

  try {
    for (let count = 0; !harness.finish && count < 20; count += 1) {
      await runGuardedPhaseAdvance({ refs: harness.refs, state: harness.state, actions: harness.actions,
        proceedPhase: async () => {
          harness.counters.phases += 1;
          const command = createSimulationPhaseWorkerCommand({ input: structuredClone(savedInput),
            state: harness.state, refs: harness.refs });
          assert.deepEqual(command.input, savedInput, 'Each worker phase must begin from the same saved input.');
          await client.runPhase({ command, actions: harness.actions, refs: harness.refs });
          console.log(`WORKER_PHASE_COMPLETE ${harness.counters.phases}`);
        } });
    }
    assert.ok(harness.finish, 'Worker did not naturally finish within 20 phases.');
  } finally {
    try {
      client.dispose();
      // The client terminates after the finish action. Keep this fallback for startup/assertion failures.
      if (!harness.finish) await worker?.terminate?.();
    } finally {
      unsubscribeWorkerMeasurements();
    }
  }
  return { ...harness, allWorkerFrames, allWorkerFramesHash: allWorkerFramesHash.digest('hex'),
    workerFrameDigests, didMutatePostMessageInput, workerClockMonotonic, workerMeasurementEntries,
    droppedWorkerMeasurementEntries, sourceFrameReceipts };
}

const fixture = JSON.parse(await createRandomIsolationInput('1101'));
const savedInput = createSimulationRunInput({ activeMap: fixture.map, runSeed: fixture.runSeed,
  settings: fixture.settings, publicItems: fixture.items, survivors: fixture.survivors,
  dead: [], kiosks: [], droneOffers: [], spawnState: null });
const inputBefore = JSON.stringify(savedInput);
const baseline = await runBaseline(savedInput, { nowFn: clockNow });
const workerRun = await runWorker(savedInput, { finiteTransport, nowFn: clockNow });

assert.equal(JSON.stringify(savedInput), inputBefore, 'A run must not mutate its owned saved input.');
assert.equal(workerRun.didMutatePostMessageInput, true, 'The native Worker send must be followed by an input mutation probe.');
assert.equal(workerRun.counters.phases, baseline.counters.phases, 'Worker phase count differs.');
assert.equal(baseline.counters.finishCalls, 1, 'Baseline finish callback must run exactly once.');
assert.equal(workerRun.counters.finishCalls, 1, 'Worker finish callback must run exactly once.');
const baselineFrameHash = baseline.frameHash.digest('hex');
if (finiteTransport) {
  assert.equal(workerRun.sourceFrameReceipts.length, baseline.counters.frames,
    'Every source frame callback must have exactly one test-only source proof.');
  assert.deepEqual(workerRun.sourceFrameReceipts.map((receipt) => receipt.sourceDigest), baseline.frameDigests,
    'All finite-clock Worker source frames must exactly match the fresh full-frame baseline.');
  const receiptsByPhase = new Map();
  for (const receipt of workerRun.sourceFrameReceipts) {
    assert.ok(Number.isSafeInteger(receipt.phaseId) && receipt.phaseId > 0
      && Number.isSafeInteger(receipt.sourceIndex) && receipt.sourceIndex > 0,
    'Source proof phase and index must be positive integers.');
    assert.match(receipt.sourceDigest, /^[0-9a-f]{64}$/, 'Source proof must contain a SHA-256 digest.');
    assert.ok(Number.isFinite(receipt.atMs), 'Finite-clock source proof timestamps must be finite.');
    const phaseRows = receiptsByPhase.get(receipt.phaseId) || [];
    phaseRows.push(receipt);
    receiptsByPhase.set(receipt.phaseId, phaseRows);
  }
  assert.equal(receiptsByPhase.size, workerRun.counters.phases, 'Every completed phase must expose its source frames.');
  const emittedReceipts = [];
  const phaseFinalDigests = [];
  let routineIntervals = 0;
  let minRoutineGapMs = Infinity;
  for (let phaseId = 1; phaseId <= workerRun.counters.phases; phaseId += 1) {
    const phaseRows = receiptsByPhase.get(phaseId) || [];
    assert.ok(phaseRows.length > 0, `Phase ${phaseId} must expose source frames.`);
    for (let index = 0; index < phaseRows.length; index += 1) {
      assert.equal(phaseRows[index].sourceIndex, index + 1, 'Source frame indices must be contiguous within each phase.');
      assert.equal(phaseRows[index].force, index === 0 || index === phaseRows.length - 1,
        'Only the first and final source frames may bypass the routine transport interval.');
      if (index > 0) assert.ok(phaseRows[index].atMs >= phaseRows[index - 1].atMs,
        'Finite source timestamps must be monotonic within each phase.');
    }
    const phaseEmitted = phaseRows.filter((receipt) => receipt.emitted);
    assert.ok(phaseEmitted.length > 0, `Phase ${phaseId} must transmit at least one frame.`);
    assert.equal(phaseRows[0].force, true, 'The first source frame of each phase must remain forced.');
    assert.equal(phaseRows[0].emitted, true, 'The first source frame of each phase must be transmitted.');
    assert.equal(phaseRows.at(-1).force, true, 'The phase-final source frame must remain forced.');
    assert.equal(phaseRows.at(-1).emitted, true, 'The phase-final forced frame must be transmitted.');
    assert.equal(phaseEmitted.at(-1).sourceDigest, phaseRows.at(-1).sourceDigest,
      'The last transmitted frame in each phase must be its final source frame.');
    phaseFinalDigests.push(phaseRows.at(-1).sourceDigest);
    for (let index = 1; index < phaseEmitted.length; index += 1) {
      const current = phaseEmitted[index], previous = phaseEmitted[index - 1];
      if (current.force) continue;
      const gap = current.atMs - previous.atMs;
      routineIntervals += 1;
      minRoutineGapMs = Math.min(minRoutineGapMs, gap);
      assert.ok(gap + 1e-6 >= 1000 / 30,
        'Routine transmitted frames must respect the 30 Hz minimum interval; first/final force frames are exempt.');
    }
    emittedReceipts.push(...phaseEmitted);
  }
  assert.ok(workerRun.sourceFrameReceipts.some((receipt) => !receipt.emitted),
    'Finite-clock transport must skip at least one intermediate source frame.');
  assert.ok(routineIntervals > 0, 'The fixture must include routine transmissions for the cap assertion.');
  assert.deepEqual(workerRun.workerFrameDigests, emittedReceipts.map((receipt) => receipt.sourceDigest),
    'Actual Worker frame messages must exactly match the ordered emitted source-frame subset.');
  let sourceCursor = 0;
  for (const transmittedDigest of workerRun.workerFrameDigests) {
    while (sourceCursor < workerRun.sourceFrameReceipts.length
      && workerRun.sourceFrameReceipts[sourceCursor].sourceDigest !== transmittedDigest) sourceCursor += 1;
    assert.ok(sourceCursor < workerRun.sourceFrameReceipts.length,
      'Every transmitted frame must be an unchanged, ordered source-frame subsequence.');
    sourceCursor += 1;
  }
  assert.equal(workerRun.allWorkerFrames, emittedReceipts.length, 'Transmitted frame count must match emitted source receipts.');
  let publishedFinalCursor = 0;
  for (const phaseFinalDigest of phaseFinalDigests) {
    while (publishedFinalCursor < workerRun.frameDigests.length
      && workerRun.frameDigests[publishedFinalCursor] !== phaseFinalDigest) publishedFinalCursor += 1;
    assert.ok(publishedFinalCursor < workerRun.frameDigests.length,
      'Each phase-final forced frame must flush to the host in phase order.');
    publishedFinalCursor += 1;
  }
  assert.equal(workerRun.finish.finalFrame && digest(workerRun.finish.finalFrame),
    workerRun.sourceFrameReceipts.at(-1)?.sourceDigest, 'The forced final source frame must flush before finishGame.');
  console.log(`SIMULATION_PHASE_WORKER_FINITE_TRANSPORT sourceFrames=${workerRun.sourceFrameReceipts.length} transmittedFrames=${workerRun.allWorkerFrames} skippedFrames=${workerRun.sourceFrameReceipts.filter((receipt) => !receipt.emitted).length} routineIntervals=${routineIntervals} minRoutineGapMs=${Number.isFinite(minRoutineGapMs) ? minRoutineGapMs.toFixed(3) : 'none'}`);
} else {
  assert.equal(workerRun.allWorkerFrames, baseline.counters.frames, 'Worker frame messages were lost or duplicated.');
  assert.equal(workerRun.allWorkerFramesHash, baselineFrameHash, 'All worker frame messages differ from native baseline snapshots.');
}
assert.equal(workerRun.workerClockMonotonic, true, 'Every direct worker frame must have a full schema and monotonic clock.');
let workerFrameCursor = 0;
for (const publishedDigest of workerRun.frameDigests) {
  while (workerFrameCursor < workerRun.workerFrameDigests.length
    && workerRun.workerFrameDigests[workerFrameCursor] !== publishedDigest) workerFrameCursor += 1;
  assert.ok(workerFrameCursor < workerRun.workerFrameDigests.length,
    'Each coalesced UI publication must be an unchanged, ordered native worker frame.');
  workerFrameCursor += 1;
}
assert.deepEqual(workerRun.finish.events, baseline.finish.events, 'Semantic event journal differs.');
assert.deepEqual(workerRun.finish.logs, baseline.finish.logs, 'Full log output differs.');
assert.deepEqual(workerRun.finish.logEntries, baseline.finish.logEntries, 'Structured log entries differ.');
assert.deepEqual(workerRun.finish.finalFrame, baseline.finish.finalFrame, 'Final frame differs.');
assert.deepEqual(workerRun.finish.finalFrame, workerRun.finalFrame, 'Final frame must have been published before finishGame.');
assert.deepEqual(workerRun.finish.random, baseline.finish.random, 'Final gameplay RNG state differs.');
assert.deepEqual(workerRun.finish.options.ending, baseline.finish.options.ending, 'Ending summary differs.');
assert.deepEqual(workerRun.finish.finalSurvivors, baseline.finish.finalSurvivors, 'Final surviving team differs.');
assert.deepEqual(workerRun.finish.latestKillCounts, baseline.finish.latestKillCounts, 'Kill counts differ.');
assert.deepEqual(workerRun.finish.latestAssistCounts, baseline.finish.latestAssistCounts, 'Assist counts differ.');
assert.equal(workerRun.finish.finalFrame.matchSec, workerRun.finish.options.ending.atSec,
  'Final frame must be ready before finishGame is called.');
assert.equal(workerRun.finish.events.at(-1)?.kind, 'match_end', 'Final event must be ready before finishGame is called.');
assert.equal(workerRun.finish.events[0]?.kind, 'run_start', 'The run_start guard event must be present first.');
assert.equal(workerRun.finish.events.filter((event) => event.kind === 'match_end').length, 1,
  'A naturally finished match must have exactly one match_end event.');
assert.ok(workerRun.finish.finalSurvivors.length > 0, 'A natural team match must produce a winning survivor roster.');
assert.ok(workerRun.finish.finalSurvivors.some((actor) => getActorTeamId(actor) === workerRun.finish.options.ending.winnerTeamId),
  'Ending winner must agree with the surviving finish roster.');
assert.ok(workerRun.finish.options.ending.outcome, 'Natural ending needs an outcome.');
assert.ok(workerRun.finish.random && workerRun.finish.random.draws === baseline.finish.random.draws,
  'Final gameplay RNG state must be ready before finishGame is called.');
assert.ok(workerRun.counters.blockedStorageCalls > 0, 'Persistence path should be exercised only through its blocked test callback.');
assert.equal(workerRun.counters.blockedPaidApiCalls, 0, 'No paid API callback is available to the test.');
assert.equal(baseline.counters.blockedPaidApiCalls, 0, 'No paid API callback is available to the baseline.');
const workerMeasurementSummary = assertWorkerMeasurementSummary(workerRun.workerMeasurementEntries,
  workerRun.droppedWorkerMeasurementEntries, workerRun.counters.phases);
if (finiteTransport) {
  const sourceFramesByPhase = new Map();
  for (const receipt of workerRun.sourceFrameReceipts) {
    sourceFramesByPhase.set(receipt.phaseId, (sourceFramesByPhase.get(receipt.phaseId) || 0) + 1);
  }
  const terminalByPhase = new Map(workerRun.workerMeasurementEntries
    .filter((entry) => entry.kind === 'terminal').map((entry) => [entry.phaseId, entry]));
  for (const [phaseId, sourceFrameCount] of sourceFramesByPhase) {
    const terminal = terminalByPhase.get(phaseId);
    assert.ok(terminal, `Phase ${phaseId} must have a Worker diagnostic terminal.`);
    const projection = terminal.diagnostics?.stages.find((row) => row.name === 'worker.projectFrame');
    assert.ok(projection, `Phase ${phaseId} must retain its Worker projection stage within the bounded stage list.`);
    assert.equal(projection.count, sourceFrameCount,
      `Phase ${phaseId} must time every source-frame projection exactly once, including frames skipped by publication limiting.`);
    assert.equal(projection.measuredCount, sourceFrameCount,
      `Phase ${phaseId} must have finite timing for every source-frame projection under the finite clock.`);
  }
}

console.log(`SIMULATION_PHASE_WORKER_DIAGNOSTICS schema=eh-worker-phase-performance.v1 phases=${workerMeasurementSummary.phases} pairs=${workerMeasurementSummary.pairs} stages=${workerMeasurementSummary.stageRows} messages=${workerMeasurementSummary.messageRows}`);
if (finiteTransport) {
  console.log(`SIMULATION_PHASE_WORKER_MATCH phases=${workerRun.counters.phases} transmittedFrames=${workerRun.allWorkerFrames} publishedFrames=${workerRun.counters.frames} events=${workerRun.finish.events.length} logs=${workerRun.finish.logEntries.length}`);
  console.log(`SIMULATION_PHASE_WORKER_MATCH transmittedFrameSha256=${workerRun.allWorkerFramesHash} eventsSha256=${digest(workerRun.finish.events)} logsSha256=${digest(workerRun.finish.logEntries)}`);
} else {
  console.log(`SIMULATION_PHASE_WORKER_MATCH phases=${workerRun.counters.phases} allFrames=${workerRun.allWorkerFrames} publishedFrames=${workerRun.counters.frames} events=${workerRun.finish.events.length} logs=${workerRun.finish.logEntries.length}`);
  console.log(`SIMULATION_PHASE_WORKER_MATCH frameSha256=${workerRun.allWorkerFramesHash} eventsSha256=${digest(workerRun.finish.events)} logsSha256=${digest(workerRun.finish.logEntries)}`);
}
console.log(`SIMULATION_PHASE_WORKER_MATCH ending=${workerRun.finish.options.ending.outcome}@${workerRun.finish.options.ending.atSec}s rngDraws=${workerRun.finish.random.draws} blockedStorage=${workerRun.counters.blockedStorageCalls} blockedAccount=${workerRun.counters.blockedAccountCalls} blockedPaidApi=${workerRun.counters.blockedPaidApiCalls}`);
