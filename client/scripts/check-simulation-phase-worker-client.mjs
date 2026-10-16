import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';
import { MessageChannel } from 'node:worker_threads';

const { createSimulationPhaseWorkerClient } = await import('../src/app/simulation/_lib/simulationPhaseWorkerClientRuntime.js');
const { createSimulationPhaseWorkerCommand } = await import('../src/app/simulation/_lib/simulationPhaseWorkerInputRuntime.js');
const { createInitialSimulationFrame } = await import('../src/app/simulation/_lib/simulationFrameRuntime.js');
const { createSeedRng } = await import('../src/app/simulation/_lib/randomSeedRuntime.js');
const { subscribeObserverWorkMeasurements } = await import('../src/app/simulation/_lib/observerWorkMeasurementRuntime.js');

let checks = 0;
async function check(name, run) {
  await run();
  checks += 1;
  console.log(`PASS ${name}`);
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

async function until(predicate) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (predicate()) return;
    await new Promise((resolve) => setImmediate(resolve));
  }
  assert.fail('Timed out waiting for the worker harness.');
}

function createClock() {
  let nextId = 1;
  const frames = new Map();
  const timers = new Map();
  return {
    scheduleFrame(callback) { const id = nextId++; frames.set(id, callback); return id; },
    cancelFrame(id) { frames.delete(id); },
    scheduleTimeout(callback, ms) { const id = nextId++; timers.set(id, { callback, ms }); return id; },
    cancelTimeout(id) { timers.delete(id); },
    async runFrame() {
      const [id, callback] = frames.entries().next().value || [];
      if (id === undefined) return false;
      frames.delete(id);
      callback();
      await new Promise((resolve) => setImmediate(resolve));
      return true;
    },
    async runTimer(ms) {
      const row = [...timers].find(([, timer]) => timer.ms === ms);
      if (!row) return false;
      const [id, timer] = row;
      timers.delete(id);
      timer.callback();
      await new Promise((resolve) => setImmediate(resolve));
      return true;
    },
    get frameCount() { return frames.size; },
    get timerCount() { return timers.size; },
  };
}

function createWorkerHarness({ autoReady = true } = {}) {
  const channel = new MessageChannel();
  const listeners = new Map();
  const clientMessages = [];
  let terminated = false;
  let terminateCount = 0;
  const worker = {
    addEventListener(type, listener) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(listener);
    },
    removeEventListener(type, listener) { listeners.get(type)?.delete(listener); },
    postMessage(message) {
      channel.port1.postMessage(message);
    },
    terminate() {
      if (terminated) return;
      terminated = true;
      terminateCount += 1;
      channel.port1.close();
      channel.port2.close();
    },
    send(message) {
      if (!terminated) channel.port2.postMessage(message);
    },
    fail(error = new Error('worker error')) {
      for (const listener of listeners.get('error') || []) listener({ error, preventDefault() {} });
    },
    get terminated() { return terminated; },
    get terminateCount() { return terminateCount; },
    get clientMessages() { return clientMessages; },
    get listenerCount() { return [...listeners.values()].reduce((count, entries) => count + entries.size, 0); },
  };
  channel.port1.on('message', (data) => {
    for (const listener of listeners.get('message') || []) listener({ data });
  });
  channel.port2.on('message', (data) => clientMessages.push(data));
  if (autoReady) queueMicrotask(() => worker.send({ kind: 'ready' }));
  return worker;
}

function makeClient(workerFactory, clock = createClock()) {
  const created = [];
  const client = createSimulationPhaseWorkerClient({
    createWorker() {
      const worker = workerFactory();
      created.push(worker);
      return worker;
    },
    scheduleFrame: (callback) => clock.scheduleFrame(callback),
    cancelFrame: (id) => clock.cancelFrame(id),
    scheduleTimeout: (callback, ms) => clock.scheduleTimeout(callback, ms),
    cancelTimeout: (id) => clock.cancelTimeout(id),
    startupTimeoutMs: 5000,
  });
  return { client, clock, created };
}

async function startPhase(client, worker, command = { frame: { day: 1 } }, actions = {}, refs = {}, phaseCount = 1) {
  const run = client.runPhase({ command, actions, refs });
  await until(() => worker.clientMessages.filter((message) => message.kind === 'phase').length >= phaseCount);
  return { run };
}

async function startCreatedPhase(client, workers, workerCount, command, phaseCount = 1, actions = {}, refs = {}) {
  const run = client.runPhase({ command, actions, refs });
  await until(() => workers.length >= workerCount
    && workers[workerCount - 1].clientMessages.filter((message) => message.kind === 'phase').length >= phaseCount);
  return { run, worker: workers[workerCount - 1] };
}

function transferCommand({ day, input, mainLogEntries = [] }) {
  const frame = { ...createInitialSimulationFrame(), day, phase: 'night', matchSec: day * 60,
    survivors: [{ _id: 'actor', hp: 100 + day }] };
  return createSimulationPhaseWorkerCommand({ input, state: { ...frame,
    autoSpeed: 32, selectedCharId: `actor-${day}`, showMarketPanel: day % 2 === 0,
    pendingTranscendPick: { actorId: 'actor', choice: `choice-${day}` } }, refs: {
    runRandomRef: { current: createSeedRng('phase-transfer') },
    fullLogEntriesRef: { current: mainLogEntries },
    startStarterLoadoutAppliedRef: { current: day > 0 },
    suddenDeathActiveRef: { current: false },
    suddenDeathEndAtSecRef: { current: 900 + day },
    suddenDeathForbiddenAnnouncedRef: { current: false },
  } });
}

function completeWorkerPhase(worker, refState = {}) {
  const phase = worker.clientMessages.filter((message) => message.kind === 'phase').at(-1);
  assert.ok(phase, 'A phase command has reached the native MessageChannel.');
  worker.send({ kind: 'complete', phaseId: phase.phaseId, seq: 1, refState });
}

await check('constructor, startup timeout, and postMessage serialization failures are startup-only', async () => {
  const constructorClient = createSimulationPhaseWorkerClient({ createWorker() { throw new Error('constructor'); } });
  await assert.rejects(constructorClient.runPhase({ command: {} }), (error) => error.code === 'PHASE_WORKER_STARTUP');
  constructorClient.dispose();

  const clock = createClock();
  const worker = createWorkerHarness({ autoReady: false });
  const { client } = makeClient(() => worker, clock);
  const timeoutRun = client.runPhase({ command: {} });
  const timeoutCheck = assert.rejects(timeoutRun, (error) => error.code === 'PHASE_WORKER_STARTUP');
  await until(() => clock.timerCount === 1);
  assert.equal(await clock.runTimer(5000), true);
  await timeoutCheck;
  assert.equal(worker.clientMessages.some((message) => message.kind === 'phase'), false);
  assert.equal(worker.terminateCount, 1);

  const serializationWorker = createWorkerHarness();
  const serializationClient = createSimulationPhaseWorkerClient({ createWorker: () => serializationWorker });
  await assert.rejects(serializationClient.runPhase({ command: { forbidden: () => {} } }),
    (error) => error.code === 'PHASE_WORKER_STARTUP');
  assert.equal(serializationWorker.clientMessages.some((message) => message.kind === 'phase'), false);
  assert.equal(serializationWorker.terminateCount, 1);
});

await check('a live worker receives immutable input once and only phase-local state and logs afterward', async () => {
  const clock = createClock();
  const workers = [];
  const { client, created } = makeClient(() => {
    const worker = createWorkerHarness(); workers.push(worker); return worker;
  }, clock);
  const input = { schema: 'fixture.run.v1', immutable: { map: 'map-copy', catalog: ['a', 'b'] } };
  const mainLogEntries = [{ text: 'start', type: 'system' }, { text: 'older phase', type: 'normal' }];
  const firstCommand = transferCommand({ day: 1, input, mainLogEntries });
  const first = await startCreatedPhase(client, workers, 1, firstCommand);
  firstCommand.frame.survivors[0].hp = -500;
  firstCommand.ui.pendingTranscendPick.choice = 'producer mutation';
  const firstPosted = workers[0].clientMessages.find((message) => message.kind === 'phase').command;
  assert.deepEqual(firstPosted.input, input, 'The first phase carries the complete immutable run input.');
  assert.equal(firstPosted.frame.survivors[0].hp, 101, 'Native transport owns a detached frame snapshot.');
  assert.equal(firstPosted.ui.pendingTranscendPick.choice, 'choice-1', 'Native transport owns detached UI state.');
  completeWorkerPhase(workers[0], { random: { seed: 'phase-transfer', draws: 6 } });
  await first.run;

  mainLogEntries.push({ text: 'newly accumulated', type: 'normal' });
  const second = await startCreatedPhase(client, workers, 1,
    transferCommand({ day: 2, input, mainLogEntries }), 2);
  const postedPhases = workers[0].clientMessages.filter((message) => message.kind === 'phase');
  const secondPosted = postedPhases[1].command;
  assert.equal(secondPosted.input, undefined, 'A prepared worker must not receive the immutable input again.');
  assert.deepEqual(secondPosted.frame, transferCommand({ day: 2, input, mainLogEntries }).frame);
  assert.deepEqual(secondPosted.ui, transferCommand({ day: 2, input, mainLogEntries }).ui);
  assert.deepEqual(secondPosted.random, transferCommand({ day: 2, input, mainLogEntries }).random);
  assert.deepEqual(secondPosted.refState, transferCommand({ day: 2, input, mainLogEntries }).refState);
  assert.deepEqual(secondPosted.logEntries, [], 'The worker starts with an empty phase-local log journal.');
  assert.deepEqual(mainLogEntries, [
    { text: 'start', type: 'system' }, { text: 'older phase', type: 'normal' },
    { text: 'newly accumulated', type: 'normal' },
  ], 'Transport must not truncate or consume the main-thread full log journal.');
  completeWorkerPhase(workers[0], { random: { seed: 'phase-transfer', draws: 7 } });
  await second.run;

  const nextRun = await startCreatedPhase(client, workers, 2,
    transferCommand({ day: 0, input, mainLogEntries }));
  assert.equal(created.length, 2, 'Day zero replaces the worker for a fresh run.');
  const replacementCommand = workers[1].clientMessages.find((message) => message.kind === 'phase').command;
  assert.deepEqual(replacementCommand.input, input, 'A replacement worker receives the new run input in full.');
  assert.deepEqual(replacementCommand.logEntries, []);
  completeWorkerPhase(workers[1], { random: { seed: 'phase-transfer', draws: 5 } });
  await nextRun.run;
  client.dispose();
});

await check('new workers receive input again after serialization and execution failures', async () => {
  const input = { schema: 'fixture.run.v1', immutable: { map: 'retry-map' } };
  const logs = [{ text: 'main log stays owned', type: 'normal' }];

  {
    const workers = [];
    const { client } = makeClient(() => {
      const worker = createWorkerHarness(); workers.push(worker); return worker;
    });
    const invalid = transferCommand({ day: 1, input, mainLogEntries: logs });
    invalid.uncloneable = () => {};
    await assert.rejects(client.runPhase({ command: invalid }),
      (error) => ['PHASE_WORKER_STARTUP', 'PHASE_WORKER_EXECUTION'].includes(error.code));
    assert.equal(workers[0].terminateCount, 1);
    const retry = await startCreatedPhase(client, workers, 2,
      transferCommand({ day: 1, input, mainLogEntries: logs }));
    assert.deepEqual(workers[1].clientMessages.find((message) => message.kind === 'phase').command.input, input);
    completeWorkerPhase(workers[1]);
    await retry.run;
    client.dispose();
  }

  {
    const workers = [];
    const { client } = makeClient(() => {
      const worker = createWorkerHarness(); workers.push(worker); return worker;
    });
    const failed = await startCreatedPhase(client, workers, 1,
      transferCommand({ day: 1, input, mainLogEntries: logs }));
    workers[0].send({ kind: 'failed', phaseId: 1, seq: 1, message: 'fixture execution failure' });
    await assert.rejects(failed.run, (error) => error.code === 'PHASE_WORKER_EXECUTION');
    assert.equal(workers[0].terminateCount, 1);
    const retry = await startCreatedPhase(client, workers, 2,
      transferCommand({ day: 1, input, mainLogEntries: logs }));
    assert.deepEqual(workers[1].clientMessages.find((message) => message.kind === 'phase').command.input, input);
    completeWorkerPhase(workers[1]);
    await retry.run;
    client.dispose();
  }
  assert.deepEqual(logs, [{ text: 'main log stays owned', type: 'normal' }]);
});

await check('native MessageChannel delivery isolates producer mutations and RAF keeps only the latest frame', async () => {
  const clock = createClock();
  const worker = createWorkerHarness();
  const { client } = makeClient(() => worker, clock);
  const published = [];
  const { run } = await startPhase(client, worker, { frame: { day: 1 } }, { setSimulationFrame: (frame) => published.push(frame) });
  void run;

  const producer = { day: 1, survivors: [{ hp: 90 }] };
  worker.send({ kind: 'frame', phaseId: 1, seq: 1, frame: producer });
  producer.survivors[0].hp = 1;
  const second = { day: 2, survivors: [{ hp: 80 }] };
  worker.send({ kind: 'frame', phaseId: 1, seq: 2, frame: second });
  second.survivors[0].hp = 2;
  await until(() => clock.frameCount === 1);
  assert.equal(published.length, 0);
  assert.equal(await clock.runFrame(), true);
  assert.deepEqual(published, [{ day: 2, survivors: [{ hp: 80 }] }]);
  assert.equal(clock.frameCount, 0);
  assert.equal(clock.timerCount, 0);

  client.dispose();
  await assert.rejects(run, (error) => error.code === 'PHASE_WORKER_DISPOSED');
});

await check('FIFO actions survive frame coalescing and finish flushes before restoring refs and invoking host once', async () => {
  const clock = createClock();
  const worker = createWorkerHarness();
  const { client } = makeClient(() => worker, clock);
  const order = [];
  const finishGate = deferred();
  const random = createSeedRng('worker-finish').getState();
  const refs = {
    startStarterLoadoutAppliedRef: { current: false },
    suddenDeathActiveRef: { current: false },
    suddenDeathEndAtSecRef: { current: null },
    suddenDeathForbiddenAnnouncedRef: { current: false },
    runRandomRef: { current: null },
  };
  const actions = {
    setSimulationFrame(frame) { order.push(`frame:${frame.day}`); },
    addLog(message) { order.push(`log:${message}`); },
    emitRunEvent(kind) { order.push(`event:${kind}`); },
    finishGame(...args) {
      order.push(`finish:${refs.startStarterLoadoutAppliedRef.current}:${refs.runRandomRef.current.getState().draws}`);
      assert.deepEqual(args, [['winner'], { a: 2 }, { b: 3 }, { finalDead: [] }]);
      return finishGate.promise;
    },
  };
  const { run } = await startPhase(client, worker, { frame: { day: 1 } }, actions, refs);
  worker.send({ kind: 'frame', phaseId: 1, seq: 1, frame: { day: 4 } });
  worker.send({ kind: 'action', phaseId: 1, seq: 2, name: 'addLog', args: ['ordered'] });
  worker.send({ kind: 'action', phaseId: 1, seq: 3, name: 'emitRunEvent', args: ['spawn_state'] });
  worker.send({ kind: 'frame', phaseId: 1, seq: 4, frame: { day: 5 } });
  worker.send({ kind: 'finish', phaseId: 1, seq: 5,
    args: [['winner'], { a: 2 }, { b: 3 }, { finalDead: [] }],
    refState: { startStarterLoadoutApplied: true, suddenDeathActive: true, suddenDeathEndAtSec: 99,
      suddenDeathForbiddenAnnounced: true, random } });
  await until(() => order.some((entry) => entry.startsWith('finish:')));
  assert.deepEqual(order, ['log:ordered', 'event:spawn_state', 'frame:5', `finish:true:${random.draws}`]);

  worker.send({ kind: 'complete', phaseId: 1, seq: 6,
    refState: { startStarterLoadoutApplied: true, suddenDeathActive: true, suddenDeathEndAtSec: 99,
      suddenDeathForbiddenAnnounced: true, random } });
  let resolved = false;
  run.then(() => { resolved = true; });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(resolved, false, 'completion waits for the one host finish result');
  finishGate.resolve();
  await run;
  assert.equal(order.filter((entry) => entry.startsWith('finish:')).length, 1);
  assert.equal(worker.terminateCount, 1);
  assert.equal(refs.runRandomRef.current.getState().draws, random.draws);
});

await check('100ms fallback publishes a pending frame when RAF does not run', async () => {
  const clock = createClock();
  const worker = createWorkerHarness();
  const { client } = makeClient(() => worker, clock);
  const published = [];
  const { run } = await startPhase(client, worker, { frame: { day: 1 } }, { setSimulationFrame: (frame) => published.push(frame) });
  worker.send({ kind: 'frame', phaseId: 1, seq: 1, frame: { day: 6 } });
  await until(() => clock.timerCount === 1);
  assert.equal(await clock.runTimer(100), true);
  assert.deepEqual(published, [{ day: 6 }]);
  client.dispose();
  await assert.rejects(run, (error) => error.code === 'PHASE_WORKER_DISPOSED');
});

await check('stale phases are ignored; duplicate and gap sequences fail without replay', async () => {
  for (const invalidSeqs of [[2], [1, 1]]) {
    const worker = createWorkerHarness();
    const { client, created } = makeClient(() => worker);
    const published = [];
    const { run } = await startPhase(client, worker, { frame: { day: 1 } }, { setSimulationFrame: (frame) => published.push(frame) });
    worker.send({ kind: 'frame', phaseId: 99, seq: 1, frame: { day: 99 } });
    for (const seq of invalidSeqs) worker.send({ kind: 'frame', phaseId: 1, seq, frame: { day: seq } });
    await assert.rejects(run, (error) => error.code === 'PHASE_WORKER_EXECUTION');
    assert.deepEqual(published, invalidSeqs.length === 1 && invalidSeqs[0] === 2 ? [] : [{ day: 1 }],
      'failure flushes only a previously accepted owned frame, never the invalid message');
    assert.equal(created.length, 1, 'an execution failure does not retry or create a replacement worker');
    assert.equal(worker.terminateCount, 1);
  }
});

await check('dispose rejects an active phase, terminates once, and ignores late worker messages', async () => {
  const worker = createWorkerHarness();
  const { client } = makeClient(() => worker);
  const published = [];
  const { run } = await startPhase(client, worker, { frame: { day: 1 } }, { setSimulationFrame: (frame) => published.push(frame) });
  client.dispose();
  await assert.rejects(run, (error) => error.code === 'PHASE_WORKER_DISPOSED');
  worker.send({ kind: 'frame', phaseId: 1, seq: 1, frame: { day: 7 } });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(published.length, 0);
  assert.equal(worker.terminateCount, 1);
});

await check('dispose during ready removes startup timer and every worker listener', async () => {
  const clock = createClock();
  const worker = createWorkerHarness({ autoReady: false });
  const { client } = makeClient(() => worker, clock);
  const run = client.runPhase({ command: {} });
  const rejected = assert.rejects(run, (error) => error.code === 'PHASE_WORKER_DISPOSED');
  await until(() => worker.listenerCount === 3 && clock.timerCount === 1);
  client.dispose();
  await rejected;
  assert.equal(worker.listenerCount, 0);
  assert.equal(clock.timerCount, 0);
  assert.equal(worker.terminateCount, 1);
  assert.equal(worker.clientMessages.some((message) => message.kind === 'phase'), false);
});

await check('worker terminal diagnostics stay complete when async host finish rejects, without changing FIFO or RNG state', async () => {
  const worker = createWorkerHarness();
  const { client, created } = makeClient(() => worker);
  const finishResult = deferred();
  let now = 10;
  const diagnostics = [];
  const work = [];
  const unsubscribe = subscribeObserverWorkMeasurements(() => now, entry => work.push(entry), null,
    entry => diagnostics.push(entry));
  let finishCalls = 0;
  const order = [];
  const finishRandom = createSeedRng('finish-reject').getState();
  const refs = { runRandomRef: { current: createSeedRng('before-finish') } };
  const { run } = await startPhase(client, worker, { frame: { day: 1 } }, {
    addLog(text) { order.push(`log:${text}`); },
    setSimulationFrame(frame) { order.push(`frame:${frame.day}`); },
    finishGame() {
      finishCalls += 1;
      order.push(`finish:${refs.runRandomRef.current.getState().seed}`);
      return finishResult.promise;
    },
  }, refs);
  const rejected = assert.rejects(run, (error) => error.code === 'PHASE_WORKER_EXECUTION'
    && error.cause?.message === 'host finish rejected');
  worker.send({ kind: 'frame', phaseId: 1, seq: 1, frame: { day: 4 } });
  worker.send({ kind: 'action', phaseId: 1, seq: 2, name: 'addLog', args: ['ordered'] });
  worker.send({ kind: 'finish', phaseId: 1, seq: 3,
    args: [[], {}, {}, {}], refState: { random: finishRandom } });
  await until(() => finishCalls === 1);
  assert.deepEqual(order, ['log:ordered', 'frame:4', `finish:${finishRandom.seed}`]);
  now = 40;
  worker.send({ kind: 'complete', phaseId: 1, seq: 4,
    refState: { random: finishRandom }, diagnostics: {
      schema: 'eh-worker-phase-performance.v1', status: 'complete', elapsedMs: 3,
    } });
  await until(() => diagnostics.some(entry => entry.kind === 'terminal'));
  assert.equal(diagnostics.length, 2);
  assert.equal(diagnostics[1].diagnostics.status, 'complete',
    'terminal records the Worker complete message, not the later host promise outcome');
  assert.equal(diagnostics[1].clientElapsedMs, 30);
  assert.deepEqual(refs.runRandomRef.current.getState(), finishRandom);
  assert.deepEqual(worker.clientMessages.map(message => message.kind), ['controls', 'phase']);
  assert.equal(worker.clientMessages.find(message => message.kind === 'phase').diagnostics, true);
  assert.deepEqual(work.map(entry => entry.name), ['worker.postMessage.controls', 'worker.postMessage.phase']);
  finishResult.reject(new Error('host finish rejected'));
  await rejected;
  assert.equal(worker.listenerCount, 0, 'client failure detaches the native terminal listener');
  worker.send({ kind: 'complete', phaseId: 1, seq: 5,
    refState: { random: createSeedRng('duplicate-terminal').getState() }, diagnostics: {
      schema: 'eh-worker-phase-performance.v1', status: 'complete', elapsedMs: 99,
    } });
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(diagnostics.map(entry => entry.kind), ['start', 'terminal'],
    'after client failure the detached listener cannot record a later terminal');
  assert.deepEqual(refs.runRandomRef.current.getState(), finishRandom,
    'a late terminal cannot overwrite the already accepted RNG snapshot');
  assert.deepEqual(order, ['log:ordered', 'frame:4', `finish:${finishRandom.seed}`]);
  assert.equal(created.length, 1);
  assert.equal(finishCalls, 1);
  assert.equal(worker.terminateCount, 1);
  unsubscribe();
});

await check('a concurrent run is rejected during ready and only one phase is posted', async () => {
  const worker = createWorkerHarness({ autoReady: false });
  const { client } = makeClient(() => worker);
  const first = client.runPhase({ command: { frame: { day: 1 } } });
  const firstOutcome = first.then(() => null, (error) => error);
  const second = client.runPhase({ command: { frame: { day: 1 } } });
  const secondOutcome = second.then(() => null, (error) => error);
  let secondError = null;
  try {
    secondError = await Promise.race([
      secondOutcome,
      new Promise((resolve) => setImmediate(() => resolve('still-waiting'))),
    ]);
    if (secondError !== 'still-waiting') {
      assert.equal(secondError?.code, 'PHASE_WORKER_EXECUTION');
      worker.send({ kind: 'ready' });
      await until(() => worker.clientMessages.filter((message) => message.kind === 'phase').length === 1);
      assert.equal(worker.clientMessages.filter((message) => message.kind === 'phase').length, 1);
    }
  } finally {
    client.dispose();
    await Promise.all([firstOutcome, secondOutcome]);
  }
  assert.notEqual(secondError, 'still-waiting',
    'runPhase must reserve the in-flight slot before awaiting ready; current code accepts both calls.');
  assert.equal(worker.clientMessages.filter((message) => message.kind === 'phase').length, 1);
});

await check('inactive worker diagnostics neither read a diagnostic clock nor add a protocol field', async () => {
  let clockReads = 0;
  const unsubscribe = subscribeObserverWorkMeasurements(() => { clockReads += 1; throw new Error('inactive clock'); }, () => {});
  const worker = createWorkerHarness();
  const { client } = makeClient(() => worker);
  try {
    const { run } = await startPhase(client, worker);
    const phase = worker.clientMessages.find(message => message.kind === 'phase');
    assert.equal(Object.hasOwn(phase, 'diagnostics'), false);
    completeWorkerPhase(worker);
    await run;
    assert.equal(clockReads, 0);
    assert.deepEqual(worker.clientMessages.map(message => message.kind), ['controls', 'phase']);
  } finally { client.dispose(); unsubscribe(); }
});

await check('opted phase diagnostics preserve native FIFO and original command ownership', async () => {
  let now = 10;
  const recorded = [], work = [], actions = [];
  const unsubscribe = subscribeObserverWorkMeasurements(() => now, entry => work.push(entry), null, entry => recorded.push(entry));
  const worker = createWorkerHarness();
  const { client } = makeClient(() => worker);
  const command = { frame: { day: 1 }, input: { nested: { retained: true } } };
  const original = structuredClone(command);
  try {
    const { run } = await startPhase(client, worker, command, { addLog: text => actions.push(text) });
    const phase = worker.clientMessages.find(message => message.kind === 'phase');
    assert.equal(phase.diagnostics, true);
    assert.deepEqual(command, original);
    now = 60;
    const diagnostics = { schema: 'eh-worker-phase-performance.v1', status: 'complete', elapsedMs: 40 };
    worker.send({ kind: 'action', phaseId: phase.phaseId, seq: 1, name: 'addLog', args: ['one'] });
    worker.send({ kind: 'complete', phaseId: phase.phaseId, seq: 2, refState: {}, diagnostics });
    await run;
    assert.deepEqual(actions, ['one']);
    assert.deepEqual(recorded.map(entry => entry.kind), ['start', 'terminal']);
    assert.equal(recorded[0].id, recorded[1].id);
    assert.equal(recorded[1].clientElapsedMs, 50);
    assert.deepEqual(recorded[1].diagnostics, diagnostics);
    assert.deepEqual(work.map(entry => entry.name), ['worker.postMessage.controls', 'worker.postMessage.phase']);
    assert.deepEqual(worker.clientMessages.map(message => message.kind), ['controls', 'phase']);
  } finally { client.dispose(); unsubscribe(); }
});

await check('late phase measurements cannot read or publish into a replacement probe', async () => {
  const oldEntries = [], nextEntries = [];
  const unsubscribeOld = subscribeObserverWorkMeasurements(() => 1, () => {}, null, entry => oldEntries.push(entry));
  const worker = createWorkerHarness();
  const { client } = makeClient(() => worker);
  let unsubscribeNext;
  let nextClockReads = 0;
  try {
    const first = await startPhase(client, worker);
    unsubscribeOld();
    unsubscribeNext = subscribeObserverWorkMeasurements(() => { nextClockReads += 1; return 50; }, () => {}, null, entry => nextEntries.push(entry));
    completeWorkerPhase(worker);
    await first.run;
    assert.deepEqual(oldEntries.map(entry => entry.kind), ['start']);
    assert.equal(nextClockReads, 0);
    assert.equal(nextEntries.length, 0);
    const second = await startPhase(client, worker, { frame: { day: 2 } }, {}, {}, 2);
    completeWorkerPhase(worker);
    await second.run;
    assert.deepEqual(nextEntries.map(entry => entry.kind), ['start', 'terminal']);
    assert.notEqual(oldEntries[0].id, nextEntries[0].id);
  } finally { client.dispose(); unsubscribeOld(); unsubscribeNext?.(); }
});

await check('failed and disposed phases close their diagnostic request once without changing game errors', async () => {
  const entries = [];
  const unsubscribe = subscribeObserverWorkMeasurements(() => 10, () => {}, null, entry => entries.push(entry));
  const worker = createWorkerHarness();
  const { client } = makeClient(() => worker);
  try {
    const { run } = await startPhase(client, worker);
    const rejected = assert.rejects(run, error => error.code === 'PHASE_WORKER_EXECUTION');
    worker.send({ kind: 'failed', phaseId: 1, seq: 1, message: 'engine failure',
      diagnostics: { schema: 'eh-worker-phase-performance.v1', status: 'failed', elapsedMs: 3 } });
    await rejected;
    assert.deepEqual(entries.map(entry => entry.kind), ['start', 'terminal']);
    assert.equal(entries[1].diagnostics.status, 'failed');
  } finally { client.dispose(); unsubscribe(); }
  const disposedEntries = [];
  const unsubscribeDisposed = subscribeObserverWorkMeasurements(() => 20, () => {}, null, entry => disposedEntries.push(entry));
  const disposedWorker = createWorkerHarness();
  const disposedClient = makeClient(() => disposedWorker).client;
  try {
    const { run } = await startPhase(disposedClient, disposedWorker);
    const rejected = assert.rejects(run, error => error.code === 'PHASE_WORKER_DISPOSED');
    disposedClient.dispose();
    await rejected;
    assert.deepEqual(disposedEntries.map(entry => entry.kind), ['start', 'client-failure']);
  } finally { disposedClient.dispose(); unsubscribeDisposed(); }
});

console.log(`PASS ${checks} simulation phase worker client checks`);
