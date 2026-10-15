import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { createHandlerHarness } from './lib/hook-handler-harness.mjs';

const hookUrl = new URL('../src/app/simulation/_lib/useSimulationPhaseController.js', import.meta.url).href;
const executorUrl = new URL('../src/app/simulation/_lib/useSimulationPhaseExecutor.js', import.meta.url).href;
const finishUrl = new URL('../src/app/simulation/_lib/finishGameRuntime.js', import.meta.url).href;
const harnessUrl = new URL('./lib/hook-handler-harness.mjs', import.meta.url).href;
const probe = { apiCalls: [], gates: [], storedUserUpdates: 0, refreshes: 0 };

function stub(source) { return `data:text/javascript,${encodeURIComponent(source)}`; }

registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier === 'react') return { url: harnessUrl, shortCircuit: true };
  if (context.parentURL === finishUrl && specifier === '../../../utils/api') {
    return { url: stub(`
      export function apiPost(path, body) {
        const probe = globalThis.__phaseResultReadinessProbe;
        probe.apiCalls.push({ path, body });
        return probe.gates[probe.apiCalls.length - 1].promise;
      }
      export const captureAuthSession = () => ({ testSession: true });
      export const getUser = () => ({ id: 'test-user', username: 'test-user' });
      export const isCurrentAuthSession = () => true;
      export const refreshStoredAuthSession = async () => { globalThis.__phaseResultReadinessProbe.refreshes += 1; };
      export const updateStoredUser = () => { globalThis.__phaseResultReadinessProbe.storedUserUpdates += 1; return true; };
    `), shortCircuit: true };
  }
  if (context.parentURL === finishUrl && specifier === '../../../utils/hallOfFame') {
    return { url: stub(`export const LEGACY_HOF_KEY='test-hof'; export function emitHallOfFameSync(){}; export function writeHallOfFameState(){};`), shortCircuit: true };
  }
  if (context.parentURL === finishUrl && specifier === './lpRewardRuntime') {
    return { url: stub(`export const buildLpRewardSummary = () => ({ totalLP: 0, predictedWinnerId: '', predictedName: '', predictionCorrect: false, predictionBonusLP: 0 }); export const formatLpRewardBreakdown = () => '';`), shortCircuit: true };
  }
  if (context.parentURL === finishUrl && specifier === './localRunHistoryRuntime') {
    return { url: stub(`export const saveLocalSimulationRunBackup = ({clientRunId}) => ({ ok: true, record: { clientRunId } });`), shortCircuit: true };
  }
  if (context.parentURL === finishUrl && specifier === './userProgress') {
    return { url: stub(`export const mergeStoredUserProgress = (user, progress) => ({...user,...progress}); export const saveLocalHallOfFameBackup = () => {};`), shortCircuit: true };
  }
  if (context.parentURL === finishUrl && specifier === './tacticalEffectEvidenceRuntime') {
    return { url: stub(`export const readTacticalEffectReceipt = () => null;`), shortCircuit: true };
  }
  return nextResolve(specifier, context);
} });

globalThis.__phaseResultReadinessProbe = probe;

const { createInitialSimulationFrame } = await import('../src/app/simulation/_lib/simulationFrameRuntime.js');
const { createSeedRng } = await import('../src/app/simulation/_lib/randomSeedRuntime.js');
const { createRandomIsolationInput } = await import('./lib/run-random-isolation-match.mjs');
const { createSimulationRunInput, prepareSimulationRunInput } = await import('../src/app/simulation/_lib/simulationReplayRuntime.js');
const { emitSimulationRunEvent } = await import('../src/app/simulation/_lib/logActionRuntime.js');
const { useSimulationPhaseController } = await import(hookUrl);

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

class TestWorker {
  constructor() {
    this.listeners = new Map();
    this.terminated = false;
    queueMicrotask(() => this.dispatch('message', { data: { kind: 'ready' } }));
  }
  addEventListener(type, listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(listener);
  }
  removeEventListener(type, listener) { this.listeners.get(type)?.delete(listener); }
  dispatch(type, event) { for (const listener of this.listeners.get(type) || []) listener(event); }
  postMessage(message) {
    if (message.kind !== 'phase') return;
    const actor = { _id: 'winner-1', id: 'winner-1', name: 'Synthetic winner', hp: 120,
      maxHp: 120, teamId: 'team-a', teamName: 'Synthetic team', alive: true,
      matchTeamId: 'team-a', matchTeamName: 'Synthetic team', matchTeamRosterIds: ['winner-1'],
      matchTeamRosterNames: ['Synthetic winner'], matchTeamOriginalSize: 1, matchTeamCapacity: 1 };
    const finalFrame = { ...createInitialSimulationFrame(), day: 1, phase: 'morning', matchSec: 1,
      survivors: [actor], dead: [], killCounts: {}, assistCounts: {}, forbiddenAddedNow: [],
      forbiddenZoneIds: [], frameMapId: 'test-map' };
    const random = createSeedRng('phase-result-readiness').getState();
    const ending = { outcome: 'last_team', atSec: 1, day: 1, phase: 'morning', winnerTeamId: 'team-a' };
    queueMicrotask(() => {
      this.dispatch('message', { data: { kind: 'frame', phaseId: message.phaseId, seq: 1, frame: finalFrame } });
      this.dispatch('message', { data: { kind: 'action', phaseId: message.phaseId, seq: 2, name: 'emitRunEvent',
        args: ['match_end', ending, { day: 1, phase: 'morning', sec: 1 }] } });
      this.dispatch('message', { data: { kind: 'finish', phaseId: message.phaseId, seq: 3,
        args: [[actor], {}, {}, { finalDead: [], ending }], refState: {
          startStarterLoadoutApplied: false, suddenDeathActive: false, suddenDeathEndAtSec: null,
          suddenDeathForbiddenAnnounced: false, random,
        } } });
      this.dispatch('message', { data: { kind: 'complete', phaseId: message.phaseId, seq: 4,
        refState: { startStarterLoadoutApplied: false, suddenDeathActive: false, suddenDeathEndAtSec: null,
          suddenDeathForbiddenAnnounced: false, random } } });
    });
  }
  terminate() { this.terminated = true; }
}

const oldGlobals = { Worker: globalThis.Worker, document: globalThis.document,
  window: globalThis.window, localStorage: globalThis.localStorage,
  probe: globalThis.__phaseResultReadinessProbe };
globalThis.Worker = TestWorker;
globalThis.document = { visibilityState: 'visible', addEventListener() {}, removeEventListener() {} };
globalThis.window = { setTimeout, clearTimeout };
const testStorage = new Map();
globalThis.localStorage = { getItem: (key) => testStorage.get(key) ?? null,
  setItem: (key, value) => testStorage.set(key, String(value)) };

let apiGate = deferred();
const fixture = JSON.parse(await createRandomIsolationInput('1101'));
const savedInput = createSimulationRunInput({ activeMap: fixture.map, runSeed: fixture.runSeed,
  settings: fixture.settings, publicItems: fixture.items, survivors: fixture.survivors,
  dead: [], kiosks: [], droneOffers: [], spawnState: null });
const preparedRun = prepareSimulationRunInput(savedInput);
const frame = { ...createInitialSimulationFrame(), ...preparedRun.state, day: 0, phase: 'night', matchSec: 0,
  forbiddenAddedNow: [], forbiddenZoneIds: [], frameMapId: String(preparedRun.state.activeMapId || '') };
const refs = {
  runInputRef: { current: savedInput }, runRandomRef: { current: null }, autoSpeedRef: { current: 32 },
  isAdvancingRef: { current: false }, mapPreparationRef: { current: null }, activeMapRef: { current: preparedRun.state.activeMap },
  activeMapIdRef: { current: preparedRun.state.activeMapId }, startStarterLoadoutAppliedRef: { current: false },
  suddenDeathActiveRef: { current: false }, suddenDeathEndAtSecRef: { current: null },
  suddenDeathForbiddenAnnouncedRef: { current: false }, fullLogsRef: { current: [] }, fullLogEntriesRef: { current: [] },
  logSeqRef: { current: 0 }, fullRunEventsRef: { current: [] }, isFinishingRef: { current: false },
  devRunTaintedRef: { current: false }, proceedPhaseGuardedRef: { current: null },
};
const ui = { ...frame, day: 0, phase: 'night', matchSec: 0, runSeed: fixture.runSeed, settings: fixture.settings,
  survivors: frame.survivors, dead: [], killCounts: {}, assistCounts: {}, autoPlay: false, autoSpeed: 32,
  isAdvancing: false, isGameOver: false, loading: false, showMarketPanel: false, pendingTranscendPick: null,
  replayMode: false, evaluationMode: false, devRunTainted: false, runEvents: [] };
let lastFrame = null;
const readinessCaptures = [];
let replayCallbackCalls = 0;
const actions = {
  prepareRun: () => null,
  normalizeAutoSpeed: Number,
  setAutoPlay(value) { ui.autoPlay = value; },
  setIsAdvancing(value) { ui.isAdvancing = value; },
  setRunEvents(events) {
    const owned = structuredClone(events);
    refs.fullRunEventsRef.current = owned;
    ui.runEvents = owned.slice(-5000);
  },
  emitRunEvent(kind, payload, at) {
    emitSimulationRunEvent({ kind, payload, at, state: ui, refs: { fullRunEventsRef: refs.fullRunEventsRef },
      actions: { enqueueOwnedRunEvent: () => {} } });
  },
  addLog(text, type) { refs.fullLogsRef.current.push(String(text || '')); refs.fullLogEntriesRef.current.push({ text: String(text || ''), type: String(type || 'normal') }); },
  setSimulationFrame(next) { lastFrame = next; Object.assign(ui, next); },
  setCredits() {}, setIsGameOver(value) { ui.isGameOver = value; },
  setShowResultModal(value) { ui.showResultModal = value; },
  setWinner(value) { ui.winner = value; },
  setResultSummary(value) { ui.resultSummary = typeof value === 'function' ? value(ui.resultSummary) : value; },
  completeReplay(snapshot) { replayCallbackCalls += 1; readinessCaptures.push({ ...snapshot, finalFrame: lastFrame, input: refs.runInputRef.current }); },
};

const previousWorker = globalThis.Worker;
const previousDocument = globalThis.document;
const previousWindow = globalThis.window;
let controller;
const hook = createHandlerHarness(() => {
  controller = useSimulationPhaseController({ actions, helpers: {}, refs, state: ui });
  return null;
}, {});

let pending;
let redFailure = null;
async function waitUntil(predicate, label) {
  for (let i = 0; i < 200; i += 1) {
    if (predicate()) return;
    await new Promise((resolve) => setImmediate(resolve));
  }
  throw new Error(`timed out waiting for ${label}`);
}
async function waitForPhaseSettlement(phasePromise) {
  let status = 'pending';
  phasePromise.then(() => { status = 'resolved'; }, (error) => { status = error; });
  await waitUntil(() => status !== 'pending', 'phase guard settlement');
  assert.equal(status, 'resolved', 'phase guard should resolve after local result readiness');
}
function resetForRun(input) {
  refs.runInputRef.current = input;
  refs.runRandomRef.current = null;
  refs.fullRunEventsRef.current = [];
  refs.fullLogsRef.current = [];
  refs.fullLogEntriesRef.current = [];
  refs.logSeqRef.current = 0;
  refs.isAdvancingRef.current = false;
  refs.isFinishingRef.current = false;
  ui.day = 0; ui.phase = 'night'; ui.matchSec = 0; ui.runSeed = fixture.runSeed;
  ui.settings = fixture.settings; ui.survivors = preparedRun.state.survivors; ui.dead = [];
  ui.killCounts = {}; ui.assistCounts = {}; ui.isAdvancing = false; ui.isGameOver = false;
  ui.showResultModal = false; ui.resultSummary = null; ui.winner = null; ui.runEvents = [];
  hook.render();
}
async function runDeferredFinish(gate, input) {
  apiGate = gate;
  probe.gates.push(gate);
  resetForRun(input);
  pending = controller.proceedPhaseGuarded();
  await waitUntil(() => probe.apiCalls.length === probe.gates.length, 'deferred /game/end call');
  await waitForPhaseSettlement(pending);
  assert.equal(refs.isAdvancingRef.current, false, 'phase lock should release while account response remains deferred');
  assert.equal(ui.isAdvancing, false);
  assert.equal(ui.isGameOver, true, 'result UI should be ready before account persistence settles');
  assert.equal(ui.showResultModal, true, 'result modal should already be visible');
  assert.equal(readinessCaptures.length, probe.gates.length, 'completeReplay should capture each result before account persistence');
  assert.equal(readinessCaptures.at(-1).input, input, 'replay completion should retain the captured start input');
  assert.equal(readinessCaptures.at(-1).finalFrame, lastFrame, 'replay completion should see the final published frame');
  assert.equal(readinessCaptures.at(-1).events.at(-1)?.kind, 'match_end', 'replay completion should see the final event');
  return { input, journal: refs.fullRunEventsRef.current };
}
try {
  hook.render();
  const first = await runDeferredFinish(apiGate, savedInput);
  assert.equal(probe.apiCalls[0].path, '/game/end');
  assert.equal(replayCallbackCalls, 1);
  assert.ok(readinessCaptures[0].random, 'RNG state should be present in the captured replay snapshot');

  // A newer input makes the first response stale for result/log UI, but the account receipt remains session-valid.
  const newerInput = { ...savedInput, staleGuard: 'new-input' };
  refs.runInputRef.current = newerInput;
  ui.resultSummary = { marker: 'new-run-result' };
  ui.showResultModal = false;
  refs.fullLogsRef.current.push('new-run-log');
  const staleInputLogs = refs.fullLogsRef.current.slice();
  apiGate.resolve({ rewardStatus: 'saved', lpEarnedApplied: 777, lpBreakdown: { base: 777 },
    user: { id: 'test-user', username: 'test-user', lp: 900 } });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(ui.resultSummary.marker, 'new-run-result', 'stale input response must not overwrite the newer result panel');
  assert.equal(ui.showResultModal, false, 'stale input response must not reopen the result modal');
  assert.deepEqual(refs.fullLogsRef.current, staleInputLogs, 'stale input response must not append to newer logs');
  assert.equal(probe.storedUserUpdates, 1, 'session-valid account receipt should still update stored user progress');

  // A fresh run with the same input object but a replacement journal must also reject stale UI writes.
  const sameInput = { ...savedInput, staleGuard: 'same-input-new-journal' };
  const sameJournalGate = deferred();
  const second = await runDeferredFinish(sameJournalGate, sameInput);
  refs.fullRunEventsRef.current = second.journal.slice();
  ui.resultSummary = { marker: 'new-journal-result' };
  ui.showResultModal = false;
  refs.fullLogsRef.current.push('new-journal-log');
  const staleJournalLogs = refs.fullLogsRef.current.slice();
  sameJournalGate.resolve({ rewardStatus: 'saved', lpEarnedApplied: 888, lpBreakdown: { base: 888 }, user: null });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(ui.resultSummary.marker, 'new-journal-result', 'same-input/new-journal response must not overwrite newer result');
  assert.equal(ui.showResultModal, false, 'same-input/new-journal response must not reopen result modal');
  assert.deepEqual(refs.fullLogsRef.current, staleJournalLogs, 'same-input/new-journal response must not append newer logs');

  // Same originating input and journal accepts its receipt normally.
  const liveInput = { ...savedInput, staleGuard: 'current-run' };
  const liveGate = deferred();
  await runDeferredFinish(liveGate, liveInput);
  const liveJournal = refs.fullRunEventsRef.current;
  liveGate.resolve({ rewardStatus: 'saved', lpEarnedApplied: 42, lpBreakdown: { base: 42, predictionBonus: 0 }, user: null });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(ui.resultSummary.rewardLP, 42, 'same-run response should update the result summary');
  assert.equal(ui.resultSummary.saveStatus.userStats, 'success');
  assert.ok(refs.fullLogsRef.current.some((line) => line.includes('LP +42')), 'same-run response should append its receipt log');
  assert.equal(refs.fullRunEventsRef.current, liveJournal, 'same-run receipt must not replace the journal');

  // Network rejection is consumed by finish runtime and must not become an unhandled rejection.
  const rejectedGate = deferred();
  const rejectedInput = { ...savedInput, staleGuard: 'rejected-run' };
  await runDeferredFinish(rejectedGate, rejectedInput);
  const observedUnhandled = [];
  const onUnhandled = (error) => observedUnhandled.push(error);
  process.on('unhandledRejection', onUnhandled);
  const originalConsoleError = console.error;
  console.error = () => {};
  try {
    rejectedGate.reject(new Error('deferred test network rejection'));
    await new Promise((resolve) => setImmediate(resolve));
    await new Promise((resolve) => setImmediate(resolve));
  } finally {
    console.error = originalConsoleError;
    process.off('unhandledRejection', onUnhandled);
  }
  assert.equal(observedUnhandled.length, 0, 'network rejection must be observed without an unhandled rejection');
  assert.equal(ui.resultSummary.saveStatus.userStats, 'error', 'same-run network rejection should mark save status error');
} catch (error) {
  redFailure = error;
} finally {
  // Release every deferred test double so actual finish callbacks settle cleanly.
  for (const gate of probe.gates) gate.resolve({ rewardStatus: 'test-cleanup', lpEarnedApplied: 0, lpBreakdown: {}, user: null });
  if (pending) await pending.catch(() => {});
  hook.unmount();
  if (previousWorker === undefined) delete globalThis.Worker; else globalThis.Worker = previousWorker;
  if (previousDocument === undefined) delete globalThis.document; else globalThis.document = previousDocument;
  if (previousWindow === undefined) delete globalThis.window; else globalThis.window = previousWindow;
  if (oldGlobals.localStorage === undefined) delete globalThis.localStorage; else globalThis.localStorage = oldGlobals.localStorage;
  if (oldGlobals.probe === undefined) delete globalThis.__phaseResultReadinessProbe;
  else globalThis.__phaseResultReadinessProbe = oldGlobals.probe;
}

if (redFailure) {
  console.error(`EXPECTED_RED phase-result-readiness: ${redFailure.message}`);
  console.error(`OBSERVED phaseLock=${refs.isAdvancingRef.current} apiCalls=${probe.apiCalls.length} replayCaptureCalls=${replayCallbackCalls} resultVisible=${ui.showResultModal}`);
  process.exitCode = 1;
} else {
  console.log(`PASS phase-result-readiness deferredReceipts=${probe.apiCalls.length} replayCaptureCalls=${replayCallbackCalls} storedUserUpdates=${probe.storedUserUpdates}`);
}
