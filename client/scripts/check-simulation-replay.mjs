import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const { createRandomIsolationInput, runRandomIsolationMatch } = await import('./lib/run-random-isolation-match.mjs');
const { REPLAY_SCHEMA, cloneReplayData, compareSimulationReplay, createSimulationRunInput, prepareSimulationRunInput, resolveReplayMap,
  validateSimulationReplayOutcome, validateSimulationReplayRecord, validateSimulationRunInput } = await import('../src/app/simulation/_lib/simulationReplayRuntime.js');
const { emitSimulationRunEvent } = await import('../src/app/simulation/_lib/logActionRuntime.js');
const { finishSimulationGame } = await import('../src/app/simulation/_lib/finishGameRuntime.js');
const { classifySimulationReplayStorageError, saveSimulationReplay, listSimulationReplays, loadSimulationReplay } = await import('../src/app/simulation/_lib/simulationReplayStorage.js');
const { classifySimulationReplayDeletionError, deleteSimulationReplay } = await import('../src/app/simulation/_components/simulationReplayDeletionRuntime.js');
const { getRuleset } = await import('../src/utils/rulesets.js');

let checks = 0;
async function check(name, task) { await task(); checks += 1; console.log(`PASS ${name}`); }

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function quotaError(name = 'QuotaExceededError', message = 'quota exceeded') {
  const error = new Error(message);
  error.name = name;
  return error;
}

// Minimal asynchronous IndexedDB double for transaction atomicity checks. It
// deliberately models only the APIs used by simulationReplayStorage.js. The
// store is committed only on tx.complete, so an injected request failure can
// prove that both put and pruning roll back together without a browser quota.
function createReplayStorageFactory({ failPut = false, failCursorDelete = false, failDelete = false } = {}) {
  const records = new Map();
  let failPutPending = failPut;
  let failCursorDeletePending = failCursorDelete;
  let failDeletePending = failDelete;

  function request() {
    return { result: undefined, error: null, onsuccess: null, onerror: null };
  }

  function settleRequest(target, type, result, error) {
    target.result = result;
    target.error = error || null;
    queueMicrotask(() => {
      if (type === 'success') target.onsuccess?.({ target });
      else target.onerror?.({ target });
    });
  }

  class FakeTransaction {
    constructor(mode) {
      this.mode = mode;
      this.error = null;
      this.oncomplete = null;
      this.onabort = null;
      this.onerror = null;
      this.working = new Map(Array.from(records, ([id, value]) => [id, clone(value)]));
      this.operations = [];
      this.running = false;
      this.aborted = false;
      this.scheduled = false;
    }

    objectStore() {
      return new FakeObjectStore(this);
    }

    enqueue(operation) {
      this.operations.push(operation);
      if (!this.scheduled) {
        this.scheduled = true;
        queueMicrotask(() => this.run());
      }
    }

    abort(error) {
      if (this.aborted) return;
      this.error = error || quotaError('AbortError', 'transaction aborted');
      this.aborted = true;
      this.running = false;
      queueMicrotask(() => {
        this.onerror?.({ target: this });
        this.onabort?.({ target: this });
      });
    }

    run() {
      if (this.running || this.aborted) return;
      this.running = true;
      try {
        while (this.operations.length && !this.aborted) {
          const operation = this.operations.shift();
          operation();
        }
      } catch (error) {
        this.abort(error);
        return;
      }
      if (!this.aborted) {
        for (const [id, value] of this.working) records.set(id, clone(value));
        for (const id of records.keys()) if (!this.working.has(id)) records.delete(id);
        this.running = false;
        queueMicrotask(() => this.oncomplete?.({ target: this }));
      }
    }

    put(value) {
      const result = request();
      this.enqueue(() => {
        if (failPutPending) {
          failPutPending = false;
          this.abort(quotaError());
          settleRequest(result, 'error', undefined, this.error);
          return;
        }
        const id = String(value.id);
        this.working.set(id, clone(value));
        settleRequest(result, 'success', id);
      });
      return result;
    }

    delete(id) {
      const result = request();
      this.enqueue(() => {
        if (failDeletePending) {
          failDeletePending = false;
          this.abort(quotaError('QuotaExceededError', 'delete quota failure'));
          settleRequest(result, 'error', undefined, this.error);
          return;
        }
        this.working.delete(String(id));
        settleRequest(result, 'success', undefined);
      });
      return result;
    }

    get(id) {
      const result = request();
      this.enqueue(() => settleRequest(result, 'success', clone(this.working.get(String(id)))));
      return result;
    }

    cursorRequest() {
      const result = request();
      this.enqueue(() => {
        const rows = Array.from(this.working.values()).sort((a, b) => Number(b.finishedAt) - Number(a.finishedAt));
        for (const value of rows) {
          if (this.aborted) break;
          const cursor = new FakeCursor(this, value);
          result.result = cursor;
          result.onsuccess?.({ target: result });
        }
        if (!this.aborted) {
          result.result = null;
          result.onsuccess?.({ target: result });
        }
      });
      return result;
    }
  }

  class FakeCursor {
    constructor(tx, value) {
      this.tx = tx;
      this.value = value;
    }

    delete() {
      if (failCursorDeletePending) {
        failCursorDeletePending = false;
        this.tx.abort(quotaError('QuotaExceededError', 'cursor delete quota failure'));
        return request();
      }
      this.tx.working.delete(String(this.value.id));
      return request();
    }

    continue() {}
  }

  class FakeObjectStore {
    constructor(tx) { this.tx = tx; }
    put(value) { return this.tx.put(value); }
    get(id) { return this.tx.get(id); }
    delete(id) { return this.tx.delete(id); }
    index() { return { openCursor: () => this.tx.cursorRequest() }; }
  }

  class FakeDatabase {
    transaction(_storeName, mode) { return new FakeTransaction(mode); }
    close() {}
  }

  const database = new FakeDatabase();
  let initialized = false;
  const factory = {
    open(_name, _version) {
      const result = request();
      queueMicrotask(() => {
        result.result = database;
        if (!initialized && result.onupgradeneeded) {
          initialized = true;
          const upgradeStore = {
            createIndex() {},
          };
          result.result.createObjectStore = () => upgradeStore;
          result.onupgradeneeded({ target: result });
        }
        result.onsuccess?.({ target: result });
      });
      return result;
    },
    seed(value) { records.set(String(value.id), clone(value)); },
    snapshot() { return new Map(Array.from(records, ([id, value]) => [id, clone(value)])); },
  };
  return factory;
}

function makeStorageRecord(id, finishedAt, input) {
  return {
    schema: REPLAY_SCHEMA,
    id,
    finishedAt,
    input,
    events: [{ kind: 'match_end', outcome: 'all_dead' }],
    finalFrame: { survivors: [], dead: [] },
    random: { state: finishedAt },
    summary: { ending: { outcome: 'all_dead', atSec: 1 }, participantCount: 24 },
  };
}

function seedTenRecords(factory, input) {
  const records = [];
  for (let index = 0; index < 10; index += 1) {
    const record = makeStorageRecord(`existing-${index}`, 1000 + index, input);
    factory.seed(record);
    records.push(record);
  }
  return records;
}
const fixture = JSON.parse(await createRandomIsolationInput('1101'));
// A deliberately longer, valid custom-roster match exercises archival beyond
// the UI's 5000-event cap. The default roster no longer guarantees that volume
// after typed damage (4908 events, all captured); do not weaken the cap gate.
fixture.survivors = fixture.survivors.map((actor) => ({ ...actor, hp: actor.hp * 2, maxHp: actor.maxHp * 2,
  stats: { ...actor.stats, maxHp: actor.stats.maxHp * 2 } }));
const input = createSimulationRunInput({ ...fixture, activeMap: fixture.map, publicItems: fixture.items });

await check('input owns all starting actors, inventories, rules, catalogs, map and initial world', () => {
  assert.equal(input.publicItems.length, 774);
  assert.equal(input.initialFrame.survivors.length, 24);
  const restored = prepareSimulationRunInput(cloneReplayData(input)).state;
  assert.deepEqual(restored.survivors, input.initialFrame.survivors);
  assert.deepEqual(restored.settings.simulationRuleset, getRuleset(input.settings.rulesetId));
  fixture.survivors[0].hp = 1;
  fixture.items[0].name = 'changed after start';
  assert.notEqual(input.initialFrame.survivors[0].hp, 1);
  assert.notEqual(input.publicItems[0].name, 'changed after start');
});

await check('legacy map and local rule overrides resolve once, then survive external changes', () => {
  const map = { ...input.map };
  delete map.crateAllowDeny;
  delete map.mutantWildlifeSpawnZoneId;
  const storedMap = resolveReplayMap(map, { getItem: (key) => key.includes('mutant') ? 'forest' : '{"alley":["transcend_pick"]}' });
  assert.deepEqual(resolveReplayMap(storedMap, { getItem: () => '{}' }).crateAllowDeny, storedMap.crateAllowDeny);
  assert.equal(resolveReplayMap(storedMap, { getItem: () => 'alley' }).mutantWildlifeSpawnZoneId, 'forest');
  const savedWindow = globalThis.window;
  try {
    globalThis.window = { localStorage: { getItem: () => '{"tickSec":7}' } };
    const overridden = createSimulationRunInput({ ...fixture, survivors: input.initialFrame.survivors,
      activeMap: storedMap, publicItems: input.publicItems });
    assert.equal(overridden.settings.simulationRuleset.tickSec, 7);
    globalThis.window.localStorage.getItem = () => '{"tickSec":99}';
    const restored = prepareSimulationRunInput(overridden).state;
    assert.equal(getRuleset(restored.settings.rulesetId, restored.settings.simulationRuleset).tickSec, 7);
  } finally { globalThis.window = savedWindow; }
});

await check('custom map geometry, directed topology and rules survive an archive round trip', () => {
  const customInput = cloneReplayData(input);
  customInput.map = {
    _id: 'custom-triangle',
    name: '삼각 생존 구역',
    zones: [
      { zoneId: 'alpha', name: '알파', polygon: [{ x: 100, y: 100 }, { x: 300, y: 100 }, { x: 200, y: 300 }] },
      { zoneId: 'beta', name: '베타', polygon: [{ x: 400, y: 100 }, { x: 600, y: 100 }, { x: 500, y: 300 }] },
      { zoneId: 'gamma', name: '감마', center: { x: 350, y: 500 } },
    ],
    zoneConnections: [{ fromZoneId: 'alpha', toZoneId: 'beta', bidirectional: false }],
    forbiddenZoneConfig: { enabled: true, startPhase: 5, damagePerTick: 9 },
    spawns: { animals: [{ species: 'wolf', zoneId: 'gamma', weight: 3 }], mutants: [] },
    crateAllowDeny: { beta: ['transcend_pick'] },
  };
  customInput.initialFrame.survivors = customInput.initialFrame.survivors.slice(0, 2).map((actor, index) => ({
    ...actor, zoneId: index ? 'beta' : 'alpha', route: [index ? 'beta' : 'alpha'], routeIndex: 0,
  }));
  customInput.initialFrame.dead = [];
  customInput.settings.simulationRuleset = { ...customInput.settings.simulationRuleset, tickSec: 13, customRuleMarker: 'kept' };
  const jsonArchive = JSON.stringify(customInput);
  const archivedInput = JSON.parse(jsonArchive);
  const beforePrepare = cloneReplayData(archivedInput);
  const prepared = prepareSimulationRunInput(archivedInput);

  assert.deepEqual(archivedInput, beforePrepare, 'preparing a replay must not mutate its archived input');
  assert.deepEqual(prepared.state.activeMap, beforePrepare.map);
  assert.deepEqual(prepared.state.zones[0].polygon, beforePrepare.map.zones[0].polygon);
  assert.equal(prepared.state.settings.simulationRuleset.customRuleMarker, 'kept');
  assert.deepEqual(prepared.state.zoneGraph, { alpha: ['beta'], beta: [], gamma: [] },
    'no Lumia road or fallback ring may be injected into an explicit custom topology');
  assert.equal(prepared.helpers.isHyperloopTransit('alpha', 'gamma'), false);
});

await check('invalid, legacy and engine-incompatible records fail before initialization', () => {
  assert.throws(() => validateSimulationRunInput({ runSeed: '1101' }), /시작 조건/);
  assert.throws(() => validateSimulationRunInput({ ...input, engineVersion: 'old' }), /업데이트/);
  const corrupt = cloneReplayData(input);
  corrupt.initialFrame.survivors[1]._id = corrupt.initialFrame.survivors[0]._id;
  assert.throws(() => validateSimulationRunInput(corrupt), /손상/);
});

await check('full event journal includes last events beyond the 5000-row view and uses pure updaters', () => {
  const refs = { fullRunEventsRef: { current: [] } };
  let visible = [];
  for (let i = 0; i < 5102; i += 1) {
    emitSimulationRunEvent({ kind: i === 5101 ? 'match_end' : 'action', payload: { i }, refs,
      actions: { setRunEvents: (update) => {
        const count = refs.fullRunEventsRef.current.length;
        const next = update(visible);
        assert.deepEqual(update(visible), next);
        assert.equal(refs.fullRunEventsRef.current.length, count);
        visible = next;
      } } });
  }
  assert.equal(visible.length, 5000);
  assert.equal(refs.fullRunEventsRef.current.length, 5102);
  assert.equal(refs.fullRunEventsRef.current[0].i, 0);
  assert.equal(refs.fullRunEventsRef.current.at(-1).kind, 'match_end');
});

await check('storage unavailable reports failure instead of claiming a durable save', async () => {
  const record = { schema: REPLAY_SCHEMA, id: 'storage-unavailable', input,
    events: [{ kind: 'match_end' }], finalFrame: { survivors: [], dead: [] }, random: {},
    summary: { ending: { outcome: 'all_dead', atSec: 1 } } };
  await assert.rejects(saveSimulationReplay(record, null), /브라우저/);
});

await check('storage failures are classified into safe user recovery guidance', () => {
  assert.equal(classifySimulationReplayStorageError(quotaError()).kind, 'quota');
  assert.match(classifySimulationReplayStorageError(quotaError()).text, /저장 공간.*부족/);
  assert.equal(classifySimulationReplayStorageError(Object.assign(new Error('newer database'), { name: 'VersionError' })).kind, 'unavailable');
  assert.equal(classifySimulationReplayStorageError(Object.assign(new Error('denied'), { name: 'NotAllowedError' })).kind, 'unavailable');
  assert.equal(classifySimulationReplayStorageError(Object.assign(new Error('unsupported'), { name: 'NotSupportedError' })).kind, 'unavailable');
});

await check('successful archive evicts only the oldest record at the ten-record limit', async () => {
  const factory = createReplayStorageFactory();
  const existing = seedTenRecords(factory, input);
  const newest = makeStorageRecord('newest', 2000, input);
  await saveSimulationReplay(newest, factory);
  const rows = await listSimulationReplays(factory);
  assert.equal(rows.length, 10);
  assert.equal(rows[0].id, 'newest');
  assert.ok(!rows.some((row) => row.id === existing[0].id), 'the oldest record should be pruned');
  for (const record of existing.slice(1)) assert.deepEqual(await loadSimulationReplay(record.id, factory), record);
});

await check('re-saving the same id is idempotent', async () => {
  const factory = createReplayStorageFactory();
  const record = makeStorageRecord('same-id', 2000, input);
  await saveSimulationReplay(record, factory);
  await saveSimulationReplay(record, factory);
  const rows = await listSimulationReplays(factory);
  assert.equal(rows.filter((row) => row.id === record.id).length, 1);
});

await check('put quota abort preserves all ten existing records and rejects the failed record', async () => {
  const factory = createReplayStorageFactory({ failPut: true });
  const existing = seedTenRecords(factory, input);
  const before = await listSimulationReplays(factory);
  const failed = makeStorageRecord('failed-put', 2000, input);
  await assert.rejects(saveSimulationReplay(failed, factory), (error) => error?.name === 'QuotaExceededError');
  assert.deepEqual(await listSimulationReplays(factory), before);
  for (const record of existing) assert.deepEqual(await loadSimulationReplay(record.id, factory), record);
  await assert.rejects(loadSimulationReplay(failed.id, factory), /찾을 수 없습니다/);
});

await check('cursor-delete abort rolls back put and pruning, preserving the existing ten', async () => {
  const factory = createReplayStorageFactory({ failCursorDelete: true });
  const existing = seedTenRecords(factory, input);
  const before = await listSimulationReplays(factory);
  const failed = makeStorageRecord('failed-prune', 2000, input);
  await assert.rejects(saveSimulationReplay(failed, factory), (error) => error?.name === 'QuotaExceededError');
  assert.deepEqual(await listSimulationReplays(factory), before);
  for (const record of existing) assert.deepEqual(await loadSimulationReplay(record.id, factory), record);
  await assert.rejects(loadSimulationReplay(failed.id, factory), /찾을 수 없습니다/);
});

await check('individual replay deletion commits only after transaction completion and is idempotent', async () => {
  const factory = createReplayStorageFactory();
  const existing = seedTenRecords(factory, input);
  await deleteSimulationReplay(existing[0].id, factory);
  assert.equal((await listSimulationReplays(factory)).length, 9);
  await deleteSimulationReplay(existing[0].id, factory);
  assert.equal((await listSimulationReplays(factory)).length, 9, 'deleting an absent ID must not change other records');
});

await check('individual replay deletion abort preserves every remaining record', async () => {
  const factory = createReplayStorageFactory({ failDelete: true });
  const existing = seedTenRecords(factory, input);
  await assert.rejects(deleteSimulationReplay(existing[0].id, factory), (error) => error?.name === 'QuotaExceededError');
  for (const record of existing) assert.deepEqual(await loadSimulationReplay(record.id, factory), record);
});

await check('storage failure keeps the current in-memory replay and user-visible error contract', async () => {
  const hookSource = await readFile(new URL('../src/app/simulation/_lib/useSimulationReplay.js', import.meta.url), 'utf8');
  const controllerSource = await readFile(new URL('../src/app/simulation/_lib/useSimulationPageController.js', import.meta.url), 'utf8');
  const modalSource = await readFile(new URL('../src/app/simulation/_components/SimulationResultModal.js', import.meta.url), 'utf8');
  const historySource = await readFile(new URL('../src/app/simulation/_components/SimulationReplayHistory.js', import.meta.url), 'utf8');
  const deletionSource = await readFile(new URL('../src/app/simulation/_components/simulationReplayDeletionRuntime.js', import.meta.url), 'utf8');
  const storageSource = await readFile(new URL('../src/app/simulation/_lib/simulationReplayStorage.js', import.meta.url), 'utf8');
  assert.match(hookSource, /savedRecordRef\.current = record;\s*retryableRecord = record;\s*await saveSimulationReplay\(record\);/,
    'the current record must be retained before durable storage');
  assert.match(hookSource, /setReplayStatus\(\{ kind: 'error', storageKind: classified\.kind, canRetrySave: Boolean\(retryableRecord\),/,
    'only a validated in-memory record may expose storage retry');
  assert.match(hookSource, /validateSimulationReplayRecord\(record\);\s*savedRecordRef\.current = record;/,
    'invalid output must not masquerade as a retryable storage failure');
  assert.match(controllerSource, /canReplayCurrent = Boolean\(replay\.savedRecordRef\.current\)/,
    'the current replay action must remain enabled after storage failure');
  assert.match(modalSource, /role="status"/, 'the replay status must be exposed to the UI');
  const storageDatabaseName = storageSource.match(/DATABASE_NAME\s*=\s*'([^']+)'/)?.[1];
  const deletionDatabaseName = deletionSource.match(/DATABASE_NAME\s*=\s*'([^']+)'/)?.[1];
  assert.ok(storageDatabaseName, 'storage must expose a statically auditable database name');
  assert.equal(deletionDatabaseName, storageDatabaseName, 'deletion must target the existing replay database');
  assert.match(deletionSource, /tx\.oncomplete = \(\) => resolve\(\)/, 'deletion must resolve only after transaction completion');
  assert.equal(classifySimulationReplayDeletionError(quotaError('BlockedError', 'blocked')).kind, 'blocked');
  assert.match(classifySimulationReplayDeletionError(quotaError('BlockedError', 'blocked')).text, /삭제하지 못했습니다/);
  assert.match(historySource, /pendingDeleteId/, 'deletion must require an inline confirmation state');
  assert.match(historySource, /삭제 확인/, 'the UI must expose deletion confirmation');
  assert.match(historySource, /취소/, 'the UI must expose deletion cancellation');
  assert.match(historySource, /연결된 5분 평가 기록은.*보존/, 'deleting a replay must disclose that evaluation storage is retained');
  assert.match(historySource, /<button type="button" disabled=\{disabled \|\| busy\} onClick=\{\(\) => setPendingDeleteId\(run\.id\)\}>기록 삭제<\/button>/,
    'unavailable legacy records must remain deletable');
  const evaluationPanelSource = historySource.slice(historySource.indexOf('sim-evaluation-panel'));
  const replayRowsSource = historySource.slice(historySource.indexOf('<ul>'), historySource.indexOf('<section className="sim-run-comparison"'));
  assert.match(replayRowsSource, />5분 평가 기록<\/button>/,
    'the existing 5분 평가 기록 entry point must remain available');
  assert.match(replayRowsSource, /(?:evaluation|평가)[\s\S]{0,500}(?:status|상태|진행 중|완료)/i,
    'each replay row must expose its evaluation status');
  assert.match(historySource, /진행 중/, 'the evaluation UI must name the in-progress state');
  assert.match(historySource, /완료/, 'the evaluation UI must name the completed state');
  assert.match(evaluationPanelSource, /(?:대상 경기|평가 대상)/, 'the evaluation panel must identify its target replay');
  assert.match(evaluationPanelSource, /runId|runSeed/, 'the target replay metadata must remain tied to the archived run');
  assert.match(evaluationPanelSource, /(?:참가자|participantCount|종료|ending)/,
    'the evaluation panel must show replay context beyond an opaque evaluation ID');
  assert.match(evaluationPanelSource, /관찰[\s\S]{0,100}\/\s*12/, 'the evaluation panel must show observed X/12 progress');
  assert.match(evaluationPanelSource, /미관측/, 'unobserved questions must remain explicitly selectable');
  assert.match(evaluationPanelSource, /reasoning/);
  assert.match(evaluationPanelSource, /판단 이유|이동·합류·교전·후퇴 이유/,
    'the reasoning question must state whose decision and what rationale is being judged');
  assert.match(evaluationPanelSource, /평가 닫기/, 'the evaluation panel must provide its own close action');
  assert.match(historySource, /setEvaluation\(null\)/, 'closing evaluation must clear the selected evaluation');
  assert.match(historySource, /useRef\(/, 'the replay history must keep a stable evaluation panel ref');
  assert.match(historySource, /evaluationPanelRef/, 'the evaluation panel ref must be named and auditable');
  assert.match(historySource, /<section ref=\{evaluationPanelRef\} className="sim-evaluation-panel"/,
    'the evaluation panel must own its ref');
  assert.match(historySource, /scrollIntoView|scrollTop|scrollTo/, 'opening an evaluation must scroll the panel into view');
  assert.match(hookSource, /async function retrySaveReplay\(\)/, 'failed records must have a durable-save retry path');
  assert.match(modalSource, /보관 다시 시도/, 'the result UI must expose storage retry');
  assert.match(modalSource, /onRetryReplaySave,/, 'the result UI must receive the retry callback');
});

await check('archive output requires a terminal event and explicit ending, which replay comparison includes', () => {
  const base = { events: [{ kind: 'match_end', outcome: 'last_team' }],
    finalFrame: { survivors: [], dead: [] }, random: { state: 1 },
    summary: { ending: { outcome: 'last_team', atSec: 12, winnerTeamId: 'team:1' } } };
  assert.deepEqual(validateSimulationReplayOutcome(cloneReplayData(base)), base);
  const record = { ...cloneReplayData(base), schema: REPLAY_SCHEMA, id: 'complete-record', input };
  assert.equal(validateSimulationReplayRecord(record), record);
  const changedEnding = cloneReplayData(base);
  changedEnding.summary.ending.winnerTeamId = 'team:2';
  const comparison = compareSimulationReplay(base, changedEnding);
  assert.equal(comparison.sameEnding, false);
  assert.equal(comparison.matched, false);
  assert.throws(() => validateSimulationReplayOutcome({ ...base, events: [{ kind: 'move' }] }), /손상/);
  assert.throws(() => validateSimulationReplayOutcome({ ...base, summary: {} }), /손상/);
});

await check('actual replay completion captures all events before returning and never accesses account storage or APIs', async () => {
  let completed;
  let summary;
  const savedWindow = globalThis.window;
  const savedFetch = globalThis.fetch;
  let externalAccess = 0;
  const externalReads = [];
  globalThis.window = { localStorage: { getItem: (key) => {
    externalAccess += 1;
    const error = new Error(`Unexpected external input: ${key}`);
    externalReads.push(error.stack);
    throw error;
  } } };
  globalThis.fetch = () => { externalAccess += 1; throw new Error('No account request during replay'); };
  try {
    const first = await runRandomIsolationMatch(null, { savedInput: cloneReplayData(input), onFinish: async (data) => {
      await finishSimulationGame({ ...data, state: { ...data.state, replayMode: true },
        actions: { setResultSummary: (value) => { summary = typeof value === 'function' ? value(summary) : value; },
          completeReplay: () => { completed = { events: data.refs.fullRunEventsRef.current, finalFrame: data.finalFrame, random: data.random }; } },
      });
    } });
    console.log(`REPLAY_JOURNAL_COUNTS ${JSON.stringify({ engine: first.events.length, captured: completed.events.length, ending: first.evidence.ending })}`);
    assert.ok(completed.events.length > 5000, `Long-journal fixture produced ${first.events.length} events and captured ${completed.events.length}.`);
    assert.equal(completed.events[0].kind, 'run_start');
    assert.equal(completed.events.at(-1).kind, 'match_end');
    assert.equal(summary.rewardStatus, 'replay');
    assert.equal(summary.rewardLP, 0);
    assert.equal(externalAccess, 0, externalReads.join('\n'));
    completed.summary = { ending: first.evidence.ending };
    const second = await runRandomIsolationMatch(null, { savedInput: cloneReplayData(input), noisy: true });
    assert.equal(externalAccess, 0, `Replay observer must also use the saved input only.\n${externalReads.join('\n')}`);
    const actual = { events: second.events, finalFrame: second.finalFrame, random: second.evidence.random,
      summary: { ending: second.evidence.ending } };
    const comparison = compareSimulationReplay(cloneReplayData(completed), cloneReplayData(actual));
    assert.equal(comparison.matched, true);
    assert.equal(comparison.sameEnding, true);
    assert.deepEqual(second.finalFrame, first.finalFrame);
    assert.equal(second.evidence.frameDigest, first.evidence.frameDigest);
    const altered = cloneReplayData(actual);
    altered.events[5].kind = 'changed';
    assert.equal(compareSimulationReplay(completed, altered).firstDifference, 5);
    altered.events = actual.events;
    altered.finalFrame.survivors[0].hp = -1;
    assert.equal(compareSimulationReplay(completed, altered).matched, false);
    altered.finalFrame = actual.finalFrame;
    altered.summary.ending.cause = 'tampered';
    assert.equal(compareSimulationReplay(completed, altered).sameEnding, false);
    console.log(`SAVED_INPUT_REPLAY ${JSON.stringify({ ...first.evidence, comparison, externalAccess, inputBytes: JSON.stringify(input).length })}`);
  } finally { globalThis.window = savedWindow; globalThis.fetch = savedFetch; }
});

console.log(`SIMULATION_REPLAY_CHECKS ${checks}/${checks}`);
