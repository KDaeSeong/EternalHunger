import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { createHash } from 'node:crypto';
import { createHandlerHarness } from './lib/hook-handler-harness.mjs';

const hookUrl = new URL('../src/app/simulation/_lib/useSimulationLogs.js', import.meta.url).href;
const harnessUrl = new URL('./lib/hook-handler-harness.mjs', import.meta.url).href;
const baseline = process.argv.includes('--baseline');
registerHooks({ load(url, context, nextLoad) {
  if (url !== hookUrl) return nextLoad(url, context);
  let source = readFileSync(new URL(url), 'utf8');
  if (baseline) {
    const reset = '    fullLogEntriesRef.current = [];';
    assert.equal(source.split(reset).length - 1, 1, 'The negative control removes only the phase-entry release.');
    source = source.replace(reset, '');
  }
  return { format: 'module', shortCircuit: true,
    source: source.replaceAll("from 'react'", `from '${harnessUrl}'`) };
} });
const { useSimulationLogs } = await import(hookUrl);
const { beginSimulationPhase } = await import('../src/app/simulation/_lib/phasePreparationRuntime.js');
const { createPhaseDeathRuntime } = await import('../src/app/simulation/_lib/phaseDeathRuntime.js');
const { createSimulationPhaseWorkerClient } = await import('../src/app/simulation/_lib/simulationPhaseWorkerClientRuntime.js');
const { finishSimulationGame } = await import('../src/app/simulation/_lib/finishGameRuntime.js');
const { captureSimulationReplayResult, compareSimulationReplay } = await import('../src/app/simulation/_lib/simulationReplayRuntime.js');
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const withoutTimestamp = events => events.map(({ ts, ...event }) => event);
const originalGlobals = { window: globalThis.window, document: globalThis.document,
  createUrl: URL.createObjectURL, revokeUrl: URL.revokeObjectURL };

async function exercise(transport) {
  const frames = new Map(), timers = new Map(), blobs = new Map(), downloads = [];
  let nextId = 0, terminated = 0;
  globalThis.window = {
    localStorage: { getItem: () => null, setItem() {} }, navigator: { userAgent: 'fixture' },
    requestAnimationFrame(callback) { const id = ++nextId; frames.set(id, callback); return id; },
    cancelAnimationFrame(id) { frames.delete(id); },
    setTimeout(callback) { const id = ++nextId; timers.set(id, callback); return id; },
    clearTimeout(id) { timers.delete(id); },
  };
  globalThis.document = { body: { appendChild() {} }, createElement: () => ({
    click() { downloads.push(blobs.get(this.href)); }, remove() {},
  }) };
  URL.createObjectURL = blob => { const url = `blob:log-retention-${++nextId}`; blobs.set(url, blob); return url; };
  URL.revokeObjectURL = url => blobs.delete(url);
  const props = { day: 0, phase: 'night', matchSec: 0, isGameOver: false,
    exportState: { settings: { rulesetId: 'ER_S11', matchMode: 'squad' } }, runInputRef: { current: { fixture: 'input-preserved' } } };
  const harness = createHandlerHarness(useSimulationLogs, props);
  let hook = harness.flush();
  const flush = () => {
    while (frames.size) {
      const ready = [...frames.values()]; frames.clear();
      for (const callback of ready) callback(0);
      hook = harness.flush();
    }
    hook = harness.flush();
  };
  let resultSummary, replay, winner;
  const phaseViews = [], entryCounts = [], entryCountsAtBoundary = [], deathChecks = [];
  const finish = async (alive, kills, assists, options) => finishSimulationGame({
    finalSurvivors: alive, latestKillCounts: kills, latestAssistCounts: assists, options,
    refs: { fullLogsRef: hook.fullLogsRef, isFinishingRef: { current: false } },
    state: { ...props, ...props.exportState, day: 2, matchSec: 400, runEvents: hook.fullRunEventsRef.current,
      dead: [], runSeed: 'bounded-log-retention-fixture', evaluationMode: true },
    actions: { addLog: (...args) => hook.addLog(...args), setWinner: value => { winner = value; },
      setResultSummary: value => { resultSummary = typeof value === 'function' ? value(resultSummary) : value; },
      completeReplay() { replay = captureSimulationReplayResult({ events: hook.fullRunEventsRef.current,
        finalFrame: { survivors: alive, dead: [], matchSec: 400 }, random: { fixture: 'rng-preserved' }, ending: options.ending }); } },
  });
  const actions = {
    resetPhaseLogs() { hook.resetPhaseLogs(); flush(); entryCountsAtBoundary.push(hook.fullLogEntriesRef.current.length); },
    addLog: (...args) => hook.addLog(...args), emitRunEvent: (...args) => hook.emitRunEvent(...args), finishGame: finish,
  };
  function produce(phase, dispatch) {
    const workerEntries = { current: [] };
    const entries = transport === 'worker-adapter' ? workerEntries : hook.fullLogEntriesRef;
    const addLog = (text, type = 'normal') => {
      if (transport === 'worker-adapter') entries.current.push({ text: String(text || ''), type: String(type || 'normal') });
      dispatch('addLog', text, type);
    };
    // Use the production phase-start call, not a test-only replacement reset.
    beginSimulationPhase({ state: { day: Math.floor(phase / 2), phase: phase % 2 ? 'morning' : 'night',
      matchSec: phase * 100, autoSpeed: 1, settings: props.exportState.settings },
      refs: { autoSpeedRef: { current: 1 } }, actions: { addLog, resetPhaseLogs: () => dispatch('resetPhaseLogs') } });
    const death = createPhaseDeathRuntime({ addLog, fullLogEntriesRef: entries,
      phaseDeathLogStartIndex: entries.current.length, phaseIdxNow: phase,
      currentActionSec: () => phase * 100, atNow: () => ({ sec: phase * 100 }), emitRunEvent() {} });
    const victim = { _id: 'fixture-dead', name: '검증대원' };
    assert.equal(death.hasDirectDeathLogForActor(victim), false);
    for (let index = 0; index < 16; index++) addLog(`phase=${phase} line=${index} preserved text`, index % 2 ? 'combat-detail' : 'normal');
    addLog('💀 [검증대원] 사망: 직접 기록', 'death');
    assert.equal(death.hasDirectDeathLogForActor(victim), true);
    const before = hook.fullLogsRef.current.length;
    death.addFallbackDeathLog(victim);
    assert.equal(hook.fullLogsRef.current.length, before);
    death.addFallbackDeathLog({ _id: 'fixture-other', name: '보조대원' });
    death.addFallbackDeathLog({ _id: 'fixture-other', name: '보조대원' });
    assert.equal(hook.fullLogsRef.current.length, before + 1);
    deathChecks.push({ oldPhaseExcluded: true, directDeduplicated: true, fallbackOnce: true });
    dispatch('emitRunEvent', 'fixture_state', { who: 'fixture-alive', value: phase }, { sec: phase * 100 });
  }
  const alive = [{ _id: 'fixture-alive', name: '생존대원', teamId: 'fixture-team', teamName: '검증팀', hp: 100 }];
  const finishArgs = [alive, { 'fixture-alive': 2 }, { 'fixture-alive': 1 },
    { ending: { reason: 'last_team', day: 2, atSec: 400, winnerTeamId: 'fixture-team' } }];
  let client;
  if (transport === 'worker-adapter') client = createSimulationPhaseWorkerClient({ createWorker() {
    const listeners = new Map();
    const send = data => listeners.get('message')?.({ data: structuredClone(data) });
    queueMicrotask(() => send({ kind: 'ready' }));
    return { addEventListener(type, callback) { listeners.set(type, callback); },
      removeEventListener(type, callback) { if (listeners.get(type) === callback) listeners.delete(type); },
      terminate() { terminated++; }, postMessage(message) {
        if (message.kind !== 'phase') return;
        let seq = 0;
        produce(message.phaseId - 1, (name, ...args) => send({ kind: 'action', phaseId: message.phaseId, seq: ++seq, name, args }));
        if (message.phaseId === 4) send({ kind: 'finish', phaseId: message.phaseId, seq: ++seq, args: finishArgs, refState: {} });
        send({ kind: 'complete', phaseId: message.phaseId, seq: ++seq, refState: {} });
      } };
  } });
  for (let phase = 0; phase < 4; phase++) {
    if (client) await client.runPhase({ command: { input: {}, frame: { day: phase + 1 } }, actions });
    else { produce(phase, (name, ...args) => actions[name](...args)); if (phase === 3) await finish(...finishArgs); }
    flush(); phaseViews.push(structuredClone(hook.logs)); entryCounts.push(hook.fullLogEntriesRef.current.length);
  }
  client?.dispose();
  const exported = hook.exportBattleLog('json');
  assert.equal(exported.ok, true);
  const downloaded = JSON.parse(await downloads.at(-1).text());
  delete downloaded.summary.exportedAt;
  downloaded.runEvents = withoutTimestamp(downloaded.runEvents);
  assert.deepEqual(downloaded.input, props.runInputRef.current);
  assert.deepEqual(downloaded.logs.map(row => row.text), hook.fullLogsRef.current);
  const expectedReplay = JSON.parse(JSON.stringify(replay));
  assert.equal(compareSimulationReplay(expectedReplay, captureSimulationReplayResult({
    events: hook.fullRunEventsRef.current, finalFrame: replay.finalFrame, random: replay.random, ending: replay.summary.ending,
  })).matched, true);
  assert.equal(hook.runEvents[0], hook.fullRunEventsRef.current[0], 'Visible and complete journals share owned event snapshots.');
  const preserved = { fullLogs: [...hook.fullLogsRef.current], phaseViews, events: withoutTimestamp(hook.fullRunEventsRef.current),
    downloaded, replay, resultSummary, winner, deathChecks };
  const facts = { transport, entryCountsAtBoundary, entryCounts, fullTextCount: preserved.fullLogs.length,
    events: preserved.events.length, preservedDigest: digest(preserved), workerTerminated: terminated };
  harness.unmount();
  for (const [id, callback] of timers) { timers.delete(id); callback(); }
  assert.equal(frames.size, 0); assert.equal(timers.size, 0); assert.equal(blobs.size, 0);
  assert.equal(harness.writesAfterUnmount, 0);
  return { preserved, facts };
}
try {
  const main = await exercise('main-sync'), worker = await exercise('worker-adapter');
  assert.deepEqual(main.preserved, worker.preserved);
  console.log(`LOG_RETENTION_PRESERVATION ${JSON.stringify({ baseline, exact: true, cases: [main.facts, worker.facts] })}`);
  for (const result of [main, worker]) {
    assert.deepEqual(result.facts.entryCountsAtBoundary, [0, 0, 0, 0], 'Phase start must release only old death-log helper entries.');
    assert.deepEqual(result.facts.entryCounts, [19, 19, 19, 20], 'Only current-phase helper objects may remain, including the final result log.');
    assert.equal(result.facts.fullTextCount, 77, 'The complete text journal must retain every phase and the final result.');
  }
  console.log('SIMULATION_LOG_RETENTION_CHECKS 2/2; real hook/phase/death/finish/replay/export, synthetic Worker adapter; no browser heap or native match proof');
} finally {
  globalThis.window = originalGlobals.window; globalThis.document = originalGlobals.document;
  URL.createObjectURL = originalGlobals.createUrl; URL.revokeObjectURL = originalGlobals.revokeUrl;
}
