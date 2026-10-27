import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import './lib/register-simulation-modules.mjs';
const engine = await import('../src/app/games/primitive-archive/_lib/primitiveArchiveEngine.js');
const checkpointApi = await import('../src/app/games/primitive-archive/_lib/primitiveArchiveCheckpoint.js');
const hookUrl = new URL('../src/app/games/primitive-archive/_hooks/usePrimitiveArchiveCheckpoint.js', import.meta.url).href;
const reactHookStub = `
  const same = (a, b) => Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((item, i) => Object.is(item, b[i]));
  export function useState(initial) {
    const harness = globalThis.__primitiveArchiveHookHarness;
    const index = harness.stateCursor++;
    if (!(index in harness.stateValues)) harness.stateValues[index] = initial;
    if (!harness.stateSetters[index]) harness.stateSetters[index] = (value) => {
      if (harness.unmounted) harness.postUnmountStateUpdates.push(index);
      harness.stateValues[index] = typeof value === 'function' ? value(harness.stateValues[index]) : value;
    };
    return [harness.stateValues[index], harness.stateSetters[index]];
  }
  export function useRef(initial) {
    const harness = globalThis.__primitiveArchiveHookHarness;
    const index = harness.refCursor++;
    if (!(index in harness.refValues)) harness.refValues[index] = { current: initial };
    return harness.refValues[index];
  }
  export function useCallback(callback, deps) {
    const harness = globalThis.__primitiveArchiveHookHarness;
    const index = harness.callbackCursor++;
    const prior = harness.callbackValues[index];
    if (!prior || !same(prior.deps, deps)) harness.callbackValues[index] = { callback, deps };
    return harness.callbackValues[index].callback;
  }
  export function useEffect(callback, deps) {
    const harness = globalThis.__primitiveArchiveHookHarness;
    const index = harness.effectCursor++;
    const prior = harness.effectValues[index];
    if (!prior || !same(prior.deps, deps)) harness.pendingEffects.push({ index, callback, deps, prior });
  }
`;
const apiHookStub = `export const AUTH_SYNC_EVENT = 'fixture-auth-sync';`;
const asDataModule = (source) => `data:text/javascript,${encodeURIComponent(source)}`;
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (context.parentURL === hookUrl && specifier === 'react') {
      return { url: asDataModule(reactHookStub), shortCircuit: true };
    }
    if (context.parentURL === hookUrl && specifier === '../../../../utils/api') {
      return { url: asDataModule(apiHookStub), shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
});
const { default: invokeCheckpointHook } = await import(hookUrl);

const serverHookUrl = new URL('../src/app/games/primitive-archive/_hooks/usePrimitiveArchivePersistence.js', import.meta.url).href;
const serverReactStub = `
  export function useState(initial) {
    const harness = globalThis.__primitiveArchiveServerHarness;
    const index = harness.stateValues.length;
    harness.stateValues.push(initial);
    return [initial, (value) => harness.stateWrites.push({ index, value })];
  }
  export function useRef(initial) {
    const ref = { current: initial };
    globalThis.__primitiveArchiveServerHarness.refs.push(ref);
    return ref;
  }
`;
const serverApiStub = `
  const harness = () => globalThis.__primitiveArchiveServerHarness;
  export const captureAuthSession = () => harness().authSession;
  export const isCurrentAuthSession = (session) => session === harness().authSession;
  export const clearApiGetCache = (path) => harness().cacheClears.push(path);
  export const apiGet = (path, options) => harness().get(path, options);
  export const apiPut = (path, payload, options) => harness().put(path, payload, options);
  export const apiPost = (path, payload, options) => harness().post(path, payload, options);
  export const updateStoredUser = () => {};
`;
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (context.parentURL === serverHookUrl && specifier === 'react') {
      return { url: asDataModule(serverReactStub), shortCircuit: true };
    }
    if (context.parentURL === serverHookUrl && specifier === '../../../../utils/api') {
      return { url: asDataModule(serverApiStub), shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
});
const { default: invokePersistenceHook } = await import(serverHookUrl);

class MemoryStorage {
  values = new Map();
  failGet = false;
  failSet = false;
  failRemove = false;
  writes = 0;

  getItem(key) {
    if (this.failGet) throw new Error('security read blocked');
    return this.values.has(key) ? this.values.get(key) : null;
  }

  setItem(key, value) {
    if (this.failSet) throw new Error('quota exceeded');
    this.writes += 1;
    this.values.set(key, String(value));
  }

  removeItem(key) {
    if (this.failRemove) throw new Error('security removal blocked');
    this.values.delete(key);
  }

  snapshot() {
    return [...this.values.entries()].sort(([a], [b]) => a.localeCompare(b));
  }
}

const locksByStorage = new WeakMap();
function memoryLocks(storage) {
  if (locksByStorage.has(storage)) return locksByStorage.get(storage);
  const held = new Map();
  const manager = {
    request(name, options, callback) {
      assert.equal(options.mode, 'exclusive');
      assert.equal(options.ifAvailable, true);
      if (held.has(name)) return Promise.resolve(callback(null));
      const token = {};
      held.set(name, token);
      let task;
      try { task = callback({ name, mode: 'exclusive' }); }
      catch (error) { held.delete(name); return Promise.reject(error); }
      return Promise.resolve(task).finally(() => {
        if (held.get(name) === token) held.delete(name);
      });
    },
    heldCount: () => held.size,
  };
  locksByStorage.set(storage, manager);
  return manager;
}

class MemoryWindow {
  listeners = new Map();
  removeCalls = 0;

  constructor(localStorage) {
    this.localStorage = localStorage;
    this.navigator = { locks: memoryLocks(localStorage) };
  }
  addEventListener(type, listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(listener);
  }
  removeEventListener(type, listener) {
    this.removeCalls += 1;
    this.listeners.get(type)?.delete(listener);
  }
  listenerCount(type = null) {
    if (type) return this.listeners.get(type)?.size || 0;
    return [...this.listeners.values()].reduce((total, listeners) => total + listeners.size, 0);
  }
  dispatch(type, detail = {}, values = {}) {
    const event = { type, detail, ...values };
    for (const listener of [...(this.listeners.get(type) || [])]) listener(event);
    return event;
  }
}

function hookHarness({ storage = new MemoryStorage(), state = fixture(), hydrated = true, user = null, token = null, latestStateRef = null, windowInstance = null, controlMicrotasks = false } = {}) {
  const react = {
    callbackCursor: 0,
    callbackValues: [],
    effectCursor: 0,
    effectValues: [],
    pendingEffects: [],
    refCursor: 0,
    refValues: [],
    stateCursor: 0,
    stateSetters: [],
    stateValues: [],
    unmounted: false,
    postUnmountStateUpdates: [],
    beginRender() {
      this.callbackCursor = 0;
      this.effectCursor = 0;
      this.pendingEffects = [];
      this.refCursor = 0;
      this.stateCursor = 0;
    },
    runEffects() {
      for (const pending of this.pendingEffects) {
        pending.prior?.cleanup?.();
        const cleanup = pending.callback();
        this.effectValues[pending.index] = { deps: pending.deps, callback: pending.callback, cleanup };
      }
      this.pendingEffects = [];
    },
    replayEffects() {
      const effects = this.effectValues.map((effect, index) => ({ ...effect, index }));
      effects.forEach((effect) => effect.cleanup?.());
      for (const effect of effects) {
        const cleanup = effect.callback();
        this.effectValues[effect.index] = { deps: effect.deps, callback: effect.callback, cleanup };
      }
    },
    sameDeps(a, b) {
      return Array.isArray(a) && Array.isArray(b) && a.length === b.length
        && a.every((value, index) => Object.is(value, b[index]));
    },
  };
  const window = windowInstance || new MemoryWindow(storage);
  assert.strictEqual(window.localStorage, storage, 'A shared fake window must use the supplied storage object.');
  globalThis.window = window;
  globalThis.__primitiveArchiveHookHarness = react;
  const pendingMicrotasks = [];
  const originalQueueMicrotask = globalThis.queueMicrotask;
  if (controlMicrotasks) globalThis.queueMicrotask = (callback) => pendingMicrotasks.push(callback);
  let currentState = state;
  const writes = { restored: [], stateCalls: [], postUnmountRestores: [], postUnmountStateCalls: [] };
  const props = { hydrated, user, token, latestStateRef };
  const onRestore = (next, context) => {
    if (react.unmounted) writes.postUnmountRestores.push({ state: next, ...context });
    writes.restored.push({ state: next, ...context });
  };
  const render = (changes = {}) => {
    globalThis.window = window;
    globalThis.__primitiveArchiveHookHarness = react;
    Object.assign(props, changes);
    react.beginRender();
    const value = invokeCheckpointHook({
      ...props,
      state: currentState,
      setState: (next) => {
        if (react.unmounted) writes.postUnmountStateCalls.push(next);
        currentState = next;
        if (props.latestStateRef) props.latestStateRef.current = next;
        writes.stateCalls.push(next);
      },
      onRestore,
    });
    react.runEffects();
    return value;
  };
  return {
    react,
    get state() { return currentState; },
    get window() { return window; },
    render,
    replayEffects() { react.replayEffects(); },
    pendingMicrotaskCount() { return pendingMicrotasks.length; },
    drainMicrotasks({ restoreQueue = false, limit = Infinity } = {}) {
      let drained = 0;
      while (pendingMicrotasks.length && drained < limit) {
        if (drained >= 1000) throw new Error('Controlled hook microtask queue exceeded 1000 callbacks.');
        const callback = pendingMicrotasks.shift();
        callback();
        drained += 1;
      }
      if (restoreQueue && controlMicrotasks) globalThis.queueMicrotask = originalQueueMicrotask;
      return drained;
    },
    restoreMicrotaskQueue() {
      if (controlMicrotasks) globalThis.queueMicrotask = originalQueueMicrotask;
    },
    updateState(next) {
      currentState = next;
      if (props.latestStateRef) props.latestStateRef.current = next;
    },
    storage,
    writes,
    unmount() {
      if (react.unmounted) return { listeners: window.listenerCount(), removeCalls: window.removeCalls };
      react.unmounted = true;
      react.pendingEffects = [];
      for (const effect of react.effectValues) {
        if (!effect) continue;
        const cleanup = effect.cleanup;
        effect.cleanup = undefined;
        cleanup?.();
      }
      return { listeners: window.listenerCount(), removeCalls: window.removeCalls };
    },
  };
}

function fixture(runId = 'checkpoint-run-a', overrides = {}) {
  const base = engine.createNewState({
    rng: () => 0.5,
    runId,
    now: '2026-10-20T00:00:00.000Z',
  });
  return engine.normalizeState({
    ...base,
    day: 8,
    ap: 3,
    inventory: { ...base.inventory, berry: 7, wood: 4 },
    party: base.party.map((member) => ({ ...member, hp: 71, hunger: 28, stamina: 66, bodyTemp: 35.5 })),
    ...overrides,
  });
}

function legacyEnvelope(ownerKey, state, revision = 1, savedAt = at(1)) {
  return JSON.stringify({
    schemaVersion: 1,
    gameSlug: engine.GAME_SLUG,
    saveVersion: engine.SAVE_VERSION,
    owner: ownerKey,
    revision,
    savedAt,
    current: state,
    previous: null,
  });
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  Object.values(value).forEach(deepFreeze);
  return value;
}

function snapshotState(state) {
  return {
    runId: state.runId,
    day: state.day,
    ap: state.ap,
    ended: state.ended,
    victory: state.victory,
    inventory: state.inventory,
    party: state.party,
    research: state.research,
    meta: state.meta,
  };
}

function fullRunSnapshot(state) {
  const snapshot = structuredClone(state);
  delete snapshot.updatedAt;
  return snapshot;
}

const ownerA = checkpointApi.checkpointOwner({ user: { id: 'archive-user-a' }, authenticated: true });
const ownerB = checkpointApi.checkpointOwner({ user: { id: 'archive-user-b' }, authenticated: true });
const guestOwner = checkpointApi.checkpointOwner({ authenticated: false });
const at = (second) => `2026-10-20T00:00:${String(second).padStart(2, '0')}.000Z`;
const checks = [];
const failures = [];
function check(name, run) {
  try {
    run();
    checks.push(name);
    console.log(`PASS ${name}`);
  } catch (error) {
    failures.push({ name, message: error.message });
    console.error(`FAIL ${name}: ${error.message}`);
  }
}

async function checkAsync(name, run) {
  try {
    await run();
    checks.push(name);
    console.log(`PASS ${name}`);
  } catch (error) {
    failures.push({ name, message: error.message });
    console.error(`FAIL ${name}: ${error.message}`);
  }
}

async function settleHookEffects() {
  await Promise.resolve();
  await Promise.resolve();
}

async function settleWriterOwnership(harness) {
  for (let attempt = 0; attempt < 16; attempt += 1) {
    await settleHookEffects();
    harness.drainMicrotasks();
    const view = harness.render();
    if (view.ready && view.exclusive) return view;
    assert.notEqual(view.status, 'conflict', 'A released same-context writer must not be mistaken for another live tab.');
  }
  assert.fail('Writer acquisition did not settle after bounded effect and lock-release turns.');
}

function serverPersistenceHarness({ state = fixture('server-current'), latestStateRef = { current: state }, authSession = {}, get } = {}) {
  const calls = { get: [], put: [], post: [], setState: [], difficulty: [], actionResult: [], toast: [], cacheClears: [], messages: [] };
  const harness = {
    authSession,
    cacheClears: calls.cacheClears,
    get(path, options) { calls.get.push({ path, options }); return get(path, options); },
    put(path, payload, options) { calls.put.push({ path, payload, options }); return Promise.resolve({}); },
    post(path, payload, options) { calls.post.push({ path, payload, options }); return Promise.resolve({}); },
    refs: [],
    stateValues: [],
    stateWrites: [],
  };
  globalThis.__primitiveArchiveServerHarness = harness;
  const view = invokePersistenceHook({
    latestStateRef,
    replaceRun: (next) => { calls.setState.push(next); return { ok: true, status: 'ready' }; },
    setActionResult: (value) => calls.actionResult.push(value),
    setNewRunDifficulty: (value) => calls.difficulty.push(value),
    setState: (value) => calls.setState.push(value),
    showToast: (value) => calls.toast.push(value),
    state,
    token: 'fixture-token',
  });
  return { calls, harness, latestStateRef, view };
}

const saveList = { saves: [{ id: 'fixture-save-id', slotKey: engine.QUICK_SAVE_SLOT }] };
const saveDetail = (state) => ({ save: { version: engine.SAVE_VERSION, payload: { state } } });

function expectWrite(storage, ownerKey, state, expectedRevision, savedAt) {
  const result = checkpointApi.writeCheckpoint(storage, ownerKey, state, { expectedRevision, savedAt });
  assert.equal(result.ok, true, `${result.status}: ${result.error || ''}`);
  assert.equal(result.status, 'ready');
  return result;
}

check('checkpoint owners separate authenticated users, guests and unknown identities', () => {
  assert.ok(ownerA && ownerB && guestOwner);
  assert.notEqual(ownerA, ownerB);
  assert.notEqual(ownerA, guestOwner);
  assert.notEqual(ownerB, guestOwner);
  assert.equal(checkpointApi.checkpointOwner({ user: { username: '   ' }, authenticated: true }), null);
  assert.equal(checkpointApi.checkpointOwner({ user: { id: 'known-case' }, authenticated: null }), null);
});

check('v1 records migrate to v2 with an exact non-cryptographic source fingerprint and keep the legacy bytes', () => {
  const storage = new MemoryStorage();
  const legacyKey = checkpointApi.legacyCheckpointStorageKey(ownerA);
  const state = fixture('legacy-source-run', { day: 14 });
  const originalLegacy = legacyEnvelope(ownerA, state, 3, at(2));
  storage.setItem(legacyKey, originalLegacy);

  const legacy = checkpointApi.readCheckpoint(storage, ownerA);
  assert.equal(legacy.status, 'ready');
  assert.equal(legacy.legacy, true);
  assert.equal(legacy.legacyFingerprintTracked, true);
  assert.equal(legacy.legacyFingerprint.length, originalLegacy.length);
  const migrated = expectWrite(storage, ownerA, fixture('legacy-source-run', { day: 15 }), legacy.revision, at(3));
  const v2Key = checkpointApi.checkpointStorageKey(ownerA);
  const v2Raw = storage.getItem(v2Key);
  const v2Envelope = JSON.parse(v2Raw);
  assert.equal(v2Envelope.schemaVersion, 2);
  assert.deepEqual(v2Envelope.legacyFingerprint, legacy.legacyFingerprint);
  assert.equal(migrated.revision, 4);
  assert.equal(storage.getItem(legacyKey), originalLegacy, 'Migration must never rewrite or remove the v1 source.');
  assert.equal(checkpointApi.readCheckpoint(storage, ownerA).status, 'ready');
});

check('a later v1-tab write conflicts with v2 reads and mutations without overwriting either source', () => {
  const storage = new MemoryStorage();
  const legacyKey = checkpointApi.legacyCheckpointStorageKey(ownerA);
  const v2Key = checkpointApi.checkpointStorageKey(ownerA);
  const firstLegacy = legacyEnvelope(ownerA, fixture('legacy-concurrent-run'), 1, at(4));
  storage.setItem(legacyKey, firstLegacy);
  const source = checkpointApi.readCheckpoint(storage, ownerA);
  expectWrite(storage, ownerA, fixture('legacy-concurrent-run', { day: 9 }), source.revision, at(5));
  const v2Bytes = storage.getItem(v2Key);
  const changedLegacy = legacyEnvelope(ownerA, fixture('old-tab-new-run', { day: 12 }), 2, at(6));
  storage.setItem(legacyKey, changedLegacy);

  const read = checkpointApi.readCheckpoint(storage, ownerA);
  assert.equal(read.status, 'conflict');
  assert.equal(read.error, 'legacy-checkpoint-changed');
  assert.equal(checkpointApi.writeCheckpoint(storage, ownerA, fixture('must-not-replace'), { expectedRevision: 2 }).status, 'conflict');
  assert.equal(checkpointApi.restorePreviousCheckpoint(storage, ownerA, { expectedRevision: 2 }).status, 'conflict');
  assert.equal(storage.getItem(v2Key), v2Bytes, 'A stale or changed legacy source must not replace the v2 bytes.');
  assert.equal(storage.getItem(legacyKey), changedLegacy, 'The v1 source must remain byte-for-byte untouched.');
});

check('a corrupt v2 source never falls back to a valid legacy checkpoint', () => {
  const storage = new MemoryStorage();
  const legacyKey = checkpointApi.legacyCheckpointStorageKey(ownerA);
  const v2Key = checkpointApi.checkpointStorageKey(ownerA);
  const oldRecord = legacyEnvelope(ownerA, fixture('legacy-hidden-run'), 8, at(7));
  const corruptV2 = '{damaged v2 bytes';
  storage.setItem(legacyKey, oldRecord);
  storage.setItem(v2Key, corruptV2);
  assert.equal(checkpointApi.readCheckpoint(storage, ownerA).status, 'corrupt');
  assert.equal(checkpointApi.writeCheckpoint(storage, ownerA, fixture('must-not-fallback'), { expectedRevision: 0 }).status, 'corrupt');
  assert.equal(storage.getItem(v2Key), corruptV2);
  assert.equal(storage.getItem(legacyKey), oldRecord);
});

check('a v2 clear marker fingerprints but never changes corrupt legacy source bytes', () => {
  const storage = new MemoryStorage();
  const legacyKey = checkpointApi.legacyCheckpointStorageKey(ownerA);
  const v2Key = checkpointApi.checkpointStorageKey(ownerA);
  const corruptLegacy = '{damaged v1 bytes';
  storage.setItem(legacyKey, corruptLegacy);
  const cleared = checkpointApi.discardUnreadableCheckpoint(storage, ownerA);
  assert.equal(cleared.status, 'missing');
  const markerBytes = storage.getItem(v2Key);
  const marker = JSON.parse(markerBytes);
  assert.equal(marker.kind, 'cleared');
  assert.equal(marker.legacyFingerprint.length, corruptLegacy.length);
  assert.equal(checkpointApi.readCheckpoint(storage, ownerA).status, 'missing');
  assert.equal(storage.getItem(legacyKey), corruptLegacy);

  const changedLegacy = '{changed old-tab bytes';
  storage.setItem(legacyKey, changedLegacy);
  const read = checkpointApi.readCheckpoint(storage, ownerA);
  assert.equal(read.status, 'conflict');
  assert.equal(read.error, 'legacy-checkpoint-changed');
  assert.equal(checkpointApi.writeCheckpoint(storage, ownerA, fixture('must-not-write-after-clear'), { expectedRevision: 0 }).status, 'conflict');
  assert.equal(storage.getItem(v2Key), markerBytes);
  assert.equal(storage.getItem(legacyKey), changedLegacy);
});

check('missing storage starts at revision zero and a fresh write round-trips a real engine state', () => {
  const storage = new MemoryStorage();
  const missing = checkpointApi.readCheckpoint(storage, ownerA);
  assert.equal(missing.status, 'missing');
  assert.equal(missing.revision, 0);
  const state = fixture();
  const written = expectWrite(storage, ownerA, state, 0, at(1));
  assert.equal(written.revision, 1);
  assert.equal(written.savedAt, at(1));
  const loaded = checkpointApi.readCheckpoint(storage, ownerA);
  assert.equal(loaded.status, 'ready');
  assert.equal(loaded.checkpoint.previous, null);
  assert.deepEqual(snapshotState(loaded.checkpoint.current), snapshotState(state));
  assert.deepEqual(snapshotState(written.checkpoint.current), snapshotState(state));
});

check('same-run autosaves replace only current while a new run atomically moves the old current to previous', () => {
  const storage = new MemoryStorage();
  const first = fixture('same-run');
  const firstWrite = expectWrite(storage, ownerA, first, 0, at(2));
  const updated = fixture('same-run', { day: 9, inventory: { ...first.inventory, berry: 14 }, meta: { ...first.meta, perkPoints: 6 } });
  const secondWrite = expectWrite(storage, ownerA, updated, firstWrite.revision, at(3));
  assert.equal(secondWrite.revision, 2);
  assert.equal(secondWrite.checkpoint.previous, null, 'Autosaving the same run must not create a recovery copy of itself.');
  assert.deepEqual(snapshotState(secondWrite.checkpoint.current), snapshotState(updated));

  const nextRun = fixture('next-run', { day: 1, ap: 5, ended: false, victory: false });
  const thirdWrite = expectWrite(storage, ownerA, nextRun, secondWrite.revision, at(4));
  assert.equal(thirdWrite.revision, 3);
  assert.equal(thirdWrite.checkpoint.current.runId, 'next-run');
  assert.equal(thirdWrite.checkpoint.previous.runId, 'same-run');
  assert.deepEqual(snapshotState(thirdWrite.checkpoint.previous), snapshotState(updated));

  const restored = checkpointApi.restorePreviousCheckpoint(storage, ownerA, { expectedRevision: thirdWrite.revision, savedAt: at(5) });
  assert.equal(restored.status, 'ready');
  assert.equal(restored.revision, 4);
  assert.equal(restored.checkpoint.current.runId, 'same-run');
  assert.equal(restored.checkpoint.previous.runId, 'next-run');
  assert.deepEqual(snapshotState(restored.checkpoint.current), snapshotState(updated));

  const serverReplacement = fixture('same-run', { day: 10, inventory: { ...updated.inventory, berry: 2 } });
  const forced = checkpointApi.writeCheckpoint(storage, ownerA, serverReplacement, {
    expectedRevision: restored.revision,
    savedAt: at(6),
    forcePrevious: true,
  });
  assert.equal(forced.status, 'ready');
  assert.deepEqual(snapshotState(forced.checkpoint.previous), snapshotState(updated));
  assert.deepEqual(snapshotState(forced.checkpoint.current), snapshotState(serverReplacement));
});

check('checkpoint writes and restore preserve the caller state, including frozen inputs', () => {
  const storage = new MemoryStorage();
  const state = deepFreeze(fixture('immutable-run'));
  const before = structuredClone(state);
  const written = expectWrite(storage, ownerA, state, 0, at(6));
  assert.deepEqual(state, before);
  const restoredNoPrevious = checkpointApi.restorePreviousCheckpoint(storage, ownerA, { expectedRevision: written.revision, savedAt: at(7) });
  assert.equal(restoredNoPrevious.status, 'no-previous');
  assert.deepEqual(state, before);
});

check('checkpoint serialization and restore consume no engine RNG values', () => {
  let rngCalls = 0;
  const state = engine.createNewState({
    rng: () => { rngCalls += 1; return 0.5; },
    runId: 'rng-serialization-run',
    now: at(7),
  });
  const callsAfterCreation = rngCalls;
  const storage = new MemoryStorage();
  const first = expectWrite(storage, ownerA, state, 0, at(8));
  const replacement = fixture('rng-serialization-replacement');
  const second = expectWrite(storage, ownerA, replacement, first.revision, at(9));
  checkpointApi.restorePreviousCheckpoint(storage, ownerA, { expectedRevision: second.revision, savedAt: at(10) });
  assert.equal(rngCalls, callsAfterCreation, 'Checkpoint serialization and restore must not advance gameplay randomness.');
});

check('owner A and guest checkpoints remain isolated from owner B and each other', () => {
  const storage = new MemoryStorage();
  expectWrite(storage, ownerA, fixture('owner-a-run'), 0, at(8));
  expectWrite(storage, ownerB, fixture('owner-b-run'), 0, at(9));
  expectWrite(storage, guestOwner, fixture('guest-run'), 0, at(10));
  assert.equal(checkpointApi.readCheckpoint(storage, ownerA).checkpoint.current.runId, 'owner-a-run');
  assert.equal(checkpointApi.readCheckpoint(storage, ownerB).checkpoint.current.runId, 'owner-b-run');
  assert.equal(checkpointApi.readCheckpoint(storage, guestOwner).checkpoint.current.runId, 'guest-run');
});

check('corrupt, unknown-version and foreign-owner envelopes are never overwritten', () => {
  const corrupt = new MemoryStorage();
  const key = checkpointApi.checkpointStorageKey(ownerA);
  corrupt.setItem(key, '{invalid json');
  const corruptBytes = corrupt.getItem(key);
  assert.equal(checkpointApi.readCheckpoint(corrupt, ownerA).status, 'corrupt');
  assert.equal(checkpointApi.writeCheckpoint(corrupt, ownerA, fixture(), { expectedRevision: 0, savedAt: at(11) }).status, 'corrupt');
  assert.equal(corrupt.getItem(key), corruptBytes);

  const valid = new MemoryStorage();
  expectWrite(valid, ownerA, fixture('versioned-run'), 0, at(12));
  const original = JSON.parse(valid.getItem(key));
  for (const [name, mutate] of [
    ['unknown schema', (envelope) => { envelope.schemaVersion += 1; }],
    ['foreign owner', (envelope) => { envelope.owner = ownerB; }],
  ]) {
    const envelope = structuredClone(original);
    mutate(envelope);
    valid.setItem(key, JSON.stringify(envelope));
    const bytes = valid.getItem(key);
    assert.equal(checkpointApi.readCheckpoint(valid, ownerA).status, 'corrupt', name);
    assert.equal(checkpointApi.writeCheckpoint(valid, ownerA, fixture('replacement'), { expectedRevision: original.revision, savedAt: at(13) }).status, 'corrupt', name);
    assert.equal(valid.getItem(key), bytes, `${name} data must remain unchanged.`);
  }
});

check('confirmed corrupt recovery backs up exact bytes and starts the next checkpoint at revision one', () => {
  const storage = new MemoryStorage();
  const key = checkpointApi.checkpointStorageKey(ownerA);
  const backupKey = checkpointApi.checkpointBackupKey(ownerA);
  const raw = '{broken checkpoint\n한글 원문';
  storage.setItem(key, raw);
  const cleared = checkpointApi.discardUnreadableCheckpoint(storage, ownerA);
  assert.equal(cleared.status, 'missing');
  assert.equal(cleared.backedUp, true);
  assert.equal(storage.getItem(backupKey), raw);
  assert.equal(checkpointApi.readCheckpoint(storage, ownerA).status, 'missing');
  assert.equal(JSON.parse(storage.getItem(key)).kind, 'cleared', 'The primary reset marker must prevent old legacy data from returning.');
  const saved = expectWrite(storage, ownerA, fixture('after-corrupt-recovery'), 0, at(14));
  assert.equal(saved.revision, 1);
  assert.equal(saved.checkpoint.previous, null);
  assert.equal(storage.getItem(backupKey), raw);
});

check('corrupt recovery preserves the original when backup, read or reset-marker writes fail', () => {
  for (const failure of ['failSet', 'failGet', 'failMarker']) {
    const storage = new MemoryStorage();
    const key = checkpointApi.checkpointStorageKey(ownerA);
    const backupKey = checkpointApi.checkpointBackupKey(ownerA);
    const raw = '{keep these damaged bytes';
    storage.setItem(key, raw);
    storage.setItem(backupKey, 'older backup');
    const originalSet = storage.setItem.bind(storage);
    if (failure === 'failMarker') storage.setItem = (writtenKey, value) => {
      if (writtenKey === key) throw new Error('reset marker write blocked');
      originalSet(writtenKey, value);
    };
    else storage[failure] = true;
    const cleared = checkpointApi.discardUnreadableCheckpoint(storage, ownerA);
    assert.equal(cleared.ok, false, failure);
    if (failure === 'failMarker') storage.setItem = originalSet;
    else storage[failure] = false;
    assert.equal(storage.getItem(key), raw, failure);
    assert.equal(storage.getItem(backupKey), failure === 'failMarker' ? raw : 'older backup', failure);
  }
});

check('corrupt recovery refuses normal or missing records and unknown owners without writing', () => {
  const storage = new MemoryStorage();
  expectWrite(storage, ownerA, fixture('healthy-record'), 0, at(14));
  const before = storage.snapshot();
  for (const owner of [ownerA, ownerB, null]) {
    assert.equal(checkpointApi.discardUnreadableCheckpoint(storage, owner).ok, false);
    assert.deepEqual(storage.snapshot(), before);
  }
});

check('corrupt recovery preserves another tab record changed while the backup is written', () => {
  const storage = new MemoryStorage();
  const key = checkpointApi.checkpointStorageKey(ownerA);
  const backupKey = checkpointApi.checkpointBackupKey(ownerA);
  const external = new MemoryStorage();
  expectWrite(external, ownerA, fixture('external-replacement'), 0, at(14));
  const externalBytes = external.getItem(key);
  const raw = '{old damaged record';
  storage.setItem(key, raw);
  const originalSet = storage.setItem.bind(storage);
  storage.setItem = (writtenKey, value) => {
    originalSet(writtenKey, value);
    if (writtenKey === backupKey) originalSet(key, externalBytes);
  };
  assert.equal(checkpointApi.discardUnreadableCheckpoint(storage, ownerA).status, 'conflict');
  assert.equal(storage.getItem(key), externalBytes);
  assert.equal(storage.getItem(backupKey), raw);
});

check('confirmed repeated corrupt recovery uses one backup slot, isolated by owner', () => {
  const storage = new MemoryStorage();
  const key = checkpointApi.checkpointStorageKey(ownerA);
  const backupKey = checkpointApi.checkpointBackupKey(ownerA);
  storage.setItem(checkpointApi.checkpointBackupKey(ownerB), 'owner B backup');
  for (const raw of ['{first damaged record', '{second damaged record']) {
    storage.setItem(key, raw);
    assert.equal(checkpointApi.discardUnreadableCheckpoint(storage, ownerA).ok, true);
    assert.equal(storage.getItem(backupKey), raw);
    assert.equal(storage.getItem(checkpointApi.checkpointBackupKey(ownerB)), 'owner B backup');
  }
  assert.equal(storage.snapshot().length, 3, 'Two owner-isolated backup slots plus one primary reset marker are retained.');
});

await checkAsync('the actual hook only recovers a corrupt checkpoint after an explicit call, then saves revision one', async () => {
  const storage = new MemoryStorage();
  const key = checkpointApi.checkpointStorageKey(guestOwner);
  const raw = '{damaged hook record';
  storage.setItem(key, raw);
  const current = fixture('hook-recovery-current');
  const harness = hookHarness({ storage, state: current });
  try {
    harness.render();
    await settleHookEffects();
    const view = harness.render();
    assert.equal(view.status, 'corrupt');
    assert.equal(storage.getItem(key), raw, 'Mounting must not discard unreadable bytes.');
    assert.equal(storage.getItem(checkpointApi.checkpointBackupKey(guestOwner)), null);
    const recovered = view.discardUnreadable();
    assert.equal(recovered.ok, true);
    assert.equal(recovered.backedUp, true);
    const saved = checkpointApi.readCheckpoint(storage, guestOwner);
    assert.equal(saved.revision, 1);
    assert.equal(saved.checkpoint.current.runId, current.runId);
    assert.equal(storage.getItem(checkpointApi.checkpointBackupKey(guestOwner)), raw);
    const bytes = storage.getItem(key);
    assert.equal(harness.render().discardUnreadable().ok, false);
    assert.equal(storage.getItem(key), bytes, 'A healthy record must never be discarded.');
  } finally {
    harness.unmount();
  }
});

await checkAsync('a failed hook backup stays corrupt and can be retried without losing the original', async () => {
  const storage = new MemoryStorage();
  const key = checkpointApi.checkpointStorageKey(guestOwner);
  const raw = '{quota-blocked hook record';
  storage.setItem(key, raw);
  const harness = hookHarness({ storage });
  try {
    harness.render();
    await settleHookEffects();
    storage.failSet = true;
    const failed = harness.render().discardUnreadable();
    assert.equal(failed.ok, false);
    assert.equal(failed.status, 'corrupt');
    assert.match(failed.message, /백업.*저장하지 못해/);
    assert.equal(storage.getItem(key), raw);
    storage.failSet = false;
    assert.equal(harness.render().discardUnreadable().ok, true);
    assert.equal(checkpointApi.readCheckpoint(storage, guestOwner).revision, 1);
  } finally {
    storage.failSet = false;
    harness.unmount();
  }
});

check('stale revisions, invalid state and invalid timestamps cannot replace current checkpoint bytes', () => {
  const storage = new MemoryStorage();
  const written = expectWrite(storage, ownerA, fixture('conflict-run'), 0, at(14));
  const originalBytes = storage.getItem(checkpointApi.checkpointStorageKey(ownerA));
  assert.equal(checkpointApi.writeCheckpoint(storage, ownerA, fixture('unversioned-write')).status, 'invalid-state');
  assert.equal(checkpointApi.writeCheckpoint(storage, ownerA, fixture('stale-write'), { expectedRevision: 0, savedAt: at(15) }).status, 'conflict');
  assert.equal(checkpointApi.restorePreviousCheckpoint(storage, ownerA, { expectedRevision: written.revision - 1, savedAt: at(16) }).status, 'conflict');
  assert.equal(checkpointApi.writeCheckpoint(storage, ownerA, { runId: 'bad' }, { expectedRevision: written.revision, savedAt: at(17) }).status, 'invalid-state');
  assert.equal(checkpointApi.writeCheckpoint(storage, ownerA, fixture('bad-time'), { expectedRevision: written.revision, savedAt: 'not-a-date' }).status, 'invalid-state');
  assert.equal(storage.getItem(checkpointApi.checkpointStorageKey(ownerA)), originalBytes);
});

check('storage read, write quota and security failures preserve prior bytes and report unavailable', () => {
  const storage = new MemoryStorage();
  const first = expectWrite(storage, ownerA, fixture('durable-run'), 0, at(18));
  const key = checkpointApi.checkpointStorageKey(ownerA);
  const bytes = storage.getItem(key);

  storage.failSet = true;
  const quota = checkpointApi.writeCheckpoint(storage, ownerA, fixture('must-not-save'), { expectedRevision: first.revision, savedAt: at(19) });
  assert.equal(quota.status, 'unavailable');
  assert.equal(storage.getItem(key), bytes);
  storage.failSet = false;

  storage.failGet = true;
  const security = checkpointApi.readCheckpoint(storage, ownerA);
  assert.equal(security.status, 'unavailable');
  storage.failGet = false;
  assert.equal(storage.getItem(key), bytes);

  const noStorage = checkpointApi.readCheckpoint(null, ownerA);
  assert.equal(noStorage.status, 'unavailable');
  assert.equal(storage.getItem(key), bytes);
});

await checkAsync('the actual hook waits for hydration, restores saved state before autosave and preserves a refresh-equivalent run', async () => {
  const storage = new MemoryStorage();
  const saved = fixture('restored-run', {
    day: 17,
    ap: 4,
    ended: true,
    victory: false,
    inventory: { berry: 19, wood: 3, hide: 5 },
    meta: { ...fixture().meta, perkPoints: 9, lifetimeScore: 2430 },
  });
  expectWrite(storage, guestOwner, saved, 0, at(20));
  const oldInput = fixture('stale-render-input');
  const harness = hookHarness({ storage, state: oldInput, hydrated: false });
  const beforeHydration = storage.writes;
  assert.equal(harness.render().ready, false);
  assert.equal(storage.writes, beforeHydration);

  const hydrated = harness.render({ hydrated: true });
  await settleHookEffects();
  const hydratedView = harness.render();
  assert.equal(hydrated.ready, false, 'The render that starts hydration must not expose controls before its effect completes.');
  assert.equal(hydratedView.ready, true, 'The next render exposes the restored owner after hydration completes.');
  assert.equal(hydratedView.status, 'ready');
  assert.equal(harness.state.runId, saved.runId);
  assert.deepEqual(snapshotState(harness.state), snapshotState(saved));
  assert.deepEqual(harness.writes.restored.at(-1), {
    state: harness.state,
    source: 'current',
    ownerKey: guestOwner,
  });
  const afterRestore = storage.writes;
  harness.render();
  assert.equal(storage.writes, afterRestore, 'The restored current run must not be overwritten by the stale first-render state.');
  harness.unmount();
});

await checkAsync('controlled StrictMode effect replay keeps a fresh-missing owner ready', async () => {
  const storage = new MemoryStorage();
  const harness = hookHarness({ storage, user: { id: 'strict-fresh-owner' }, token: 'fresh-token', state: fixture('strict-fresh-run') });
  harness.render();
  harness.replayEffects();
  const settled = await settleWriterOwnership(harness);
  assert.equal(settled.ready, true, 'The second owner bootstrap must publish readiness after replay.');
  assert.ok(['missing', 'ready'].includes(settled.status));
  assert.ok(['ready', 'missing'].includes(checkpointApi.readCheckpoint(storage, 'user:id:strict-fresh-owner').status));
  harness.unmount();
});

await checkAsync('controlled StrictMode effect replay restores an existing owner checkpoint', async () => {
  const storage = new MemoryStorage();
  const account = checkpointApi.checkpointOwner({ user: { id: 'strict-existing-owner' }, authenticated: true });
  const saved = fixture('strict-existing-run', { day: 16, inventory: { berry: 28, wood: 6 } });
  expectWrite(storage, account, saved, 0, at(20));
  const harness = hookHarness({ storage, user: { id: 'strict-existing-owner' }, token: 'existing-token', state: fixture('strict-stale-render') });
  harness.render();
  harness.replayEffects();
  const settled = await settleWriterOwnership(harness);
  assert.equal(settled.ready, true, 'The replayed owner bootstrap must publish readiness.');
  assert.equal(harness.state.runId, saved.runId);
  assert.equal(harness.state.day, saved.day);
  assert.equal(checkpointApi.readCheckpoint(storage, account).checkpoint.current.runId, saved.runId);
  harness.unmount();
});

await checkAsync('the actual hook never writes for an unknown authenticated owner and keeps active-account data isolated on switch', async () => {
  const storage = new MemoryStorage();
  const accountA = checkpointApi.checkpointOwner({ user: { id: 'hook-account-a' }, authenticated: true });
  const accountB = checkpointApi.checkpointOwner({ user: { id: 'hook-account-b' }, authenticated: true });
  const savedA = fixture('account-a-run', { day: 13 });
  expectWrite(storage, accountA, savedA, 0, at(21));
  const unknown = hookHarness({ storage, user: {}, token: 'signed-in', state: fixture('unknown-owner') });
  unknown.render();
  await settleHookEffects();
  const unknownStatus = unknown.render();
  assert.equal(unknownStatus.status, 'owner-unknown');
  assert.equal(unknownStatus.ready, false, 'An unknown authenticated owner must not be treated as save-ready.');
  assert.match(unknownStatus.message, /계정 정보를 확인할 수 없어 자동 저장을 중단했습니다/, 'The settled unknown-owner state must retain its actionable warning instead of showing loading forever.');
  const unknownFlush = unknownStatus.flush();
  assert.equal(unknownFlush.ok, false, 'Unknown owners must not flush an unowned run.');
  const unknownReplacement = unknownStatus.replaceRun(fixture('unknown-replacement'));
  assert.equal(unknownReplacement.ok, false, 'Unknown owners must not replace a run from a server load.');
  assert.equal(storage.writes, 1);
  unknown.updateState(fixture('unowned-progress', { day: 15 }));
  unknown.render({ user: { id: 'hook-account-a' }, token: 'token-a' });
  await settleHookEffects();
  const recoveredOwner = unknown.render();
  assert.equal(recoveredOwner.ready, true, 'A valid identity must finish owner bootstrap.');
  assert.equal(recoveredOwner.status, 'ready');
  assert.equal(unknown.state.runId, savedA.runId, 'The valid account must restore its own checkpoint, not the unowned state.');
  assert.equal(unknown.state.day, savedA.day);
  assert.deepEqual(snapshotState(checkpointApi.readCheckpoint(storage, accountA).checkpoint.current), snapshotState(savedA));
  assert.equal(checkpointApi.readCheckpoint(storage, accountB).status, 'missing', 'Unowned progress must not be copied into another account.');
  unknown.unmount();

  const account = hookHarness({ storage, user: { id: 'hook-account-a' }, token: 'token-a', state: fixture('pre-account') });
  account.render();
  await settleWriterOwnership(account);
  assert.equal(account.state.runId, 'account-a-run');
  account.render({ user: { id: 'hook-account-b' }, token: 'token-b' });
  await settleHookEffects();
  account.render();
  assert.equal(account.state.day, 1, 'Switching accounts starts an isolated fresh local run.');
  assert.equal(checkpointApi.readCheckpoint(storage, accountA).checkpoint.current.runId, 'account-a-run');
  account.render();
  await settleHookEffects();
  assert.equal(checkpointApi.readCheckpoint(storage, accountB).checkpoint.current.day, 1);
  account.unmount();
});

await checkAsync('a failed owner A flush restores A memory on return and never copies it into owner B', async () => {
  const storage = new MemoryStorage();
  const accountA = checkpointApi.checkpointOwner({ user: { id: 'transition-account-a' }, authenticated: true });
  const accountB = checkpointApi.checkpointOwner({ user: { id: 'transition-account-b' }, authenticated: true });
  const savedA = fixture('transition-a-saved', { day: 12 });
  expectWrite(storage, accountA, savedA, 0, at(21));
  const harness = hookHarness({ storage, user: { id: 'transition-account-a' }, token: 'token-a', state: fixture('initial') });
  harness.render();
  await settleHookEffects();
  harness.render();
  const latestA = fixture(savedA.runId, { day: 18, inventory: { ...savedA.inventory, berry: 33 } });
  harness.updateState(latestA);
  storage.failSet = true;
  harness.render({ user: { id: 'transition-account-b' }, token: 'token-b' });
  await settleHookEffects();
  harness.render();
  assert.equal(harness.state.day, 1, 'The account switch must start with an isolated run.');
  const initialB = checkpointApi.readCheckpoint(storage, accountB);
  assert.ok(['missing', 'ready'].includes(initialB.status), 'B may be missing or may already have saved its fresh isolated run.');
  if (initialB.status === 'ready') assert.notEqual(initialB.checkpoint.current.runId, latestA.runId);
  storage.failSet = false;
  harness.render({ user: { id: 'transition-account-a' }, token: 'token-a' });
  await settleHookEffects();
  harness.render();
  assert.equal(harness.state.runId, latestA.runId);
  assert.equal(harness.state.day, 18, 'Returning to A must recover its failed-flush state from memory.');
  assert.deepEqual(snapshotState(checkpointApi.readCheckpoint(storage, accountA).checkpoint.current), snapshotState(latestA));
  const savedB = checkpointApi.readCheckpoint(storage, accountB);
  if (savedB.status === 'ready') assert.notEqual(savedB.checkpoint.current.runId, latestA.runId, 'A progress must never enter B storage.');
  assert.ok(['missing', 'ready'].includes(savedB.status), 'B storage must remain isolated whether its fresh run has autosaved yet or not.');
  harness.unmount();
});

await checkAsync('auth invalidation preserves the mounted account checkpoint until explicit logout switches to guest', async () => {
  const storage = new MemoryStorage();
  const account = checkpointApi.checkpointOwner({ user: { id: 'expired-account' }, authenticated: true });
  const saved = fixture('expired-local-run', { day: 14, inventory: { berry: 11, wood: 5 } });
  expectWrite(storage, account, saved, 0, at(22));
  const harness = hookHarness({ storage, user: { id: 'expired-account' }, token: 'expired-token', state: fixture('initial') });
  harness.render();
  await settleHookEffects();
  harness.render();
  assert.equal(harness.state.runId, saved.runId);
  harness.window.dispatch('fixture-auth-sync', { reason: 'auth-invalidated' });
  harness.render({ user: null, token: null });
  await settleHookEffects();
  const expiredView = harness.render();
  assert.match(expiredView.message, /로그인이 만료되었습니다/, 'Auth invalidation must explain that the preserved run is local-only until sign-in.');
  assert.equal(harness.state.runId, saved.runId);
  assert.equal(checkpointApi.readCheckpoint(storage, account).checkpoint.current.runId, saved.runId);
  assert.equal(checkpointApi.readCheckpoint(storage, guestOwner).status, 'missing');

  harness.window.dispatch('fixture-auth-sync', { reason: 'logout' });
  harness.render();
  await settleHookEffects();
  harness.render();
  harness.render();
  await settleHookEffects();
  const loggedOutView = harness.render();
  assert.doesNotMatch(loggedOutView.message, /로그인이 만료되었습니다/, 'Explicit logout must clear the expired-account notice.');
  assert.equal(harness.state.day, 1);
  assert.equal(checkpointApi.readCheckpoint(storage, guestOwner).checkpoint.current.day, 1);
  assert.equal(checkpointApi.readCheckpoint(storage, guestOwner).checkpoint.current.runId, harness.state.runId);
  harness.unmount();
});

await checkAsync('same-owner auth invalidation keeps the latest in-memory run when disk flush fails', async () => {
  const storage = new MemoryStorage();
  const account = checkpointApi.checkpointOwner({ user: { id: 'same-owner-expiry' }, authenticated: true });
  const saved = fixture('same-owner-expiry-run', { day: 11 });
  expectWrite(storage, account, saved, 0, at(22));
  const harness = hookHarness({ storage, user: { id: 'same-owner-expiry' }, token: 'expired-token', state: fixture('stale-render') });
  harness.render();
  await settleHookEffects();
  harness.render();
  harness.updateState(fixture(saved.runId, { day: 15 }));
  storage.failSet = true;
  harness.window.dispatch('fixture-auth-sync', { reason: 'auth-invalidated' });
  harness.render({ user: null, token: null });
  await settleHookEffects();
  harness.render();
  assert.equal(harness.state.day, 15, 'Auth invalidation must retain the same-owner live state despite a stale disk checkpoint.');
  assert.equal(checkpointApi.readCheckpoint(storage, account).checkpoint.current.day, 11);
  assert.match(harness.render().message, /저장 상태|저장소를 사용할 수 없어/);
  harness.unmount();
});

await checkAsync('same-tab route remount restores the latest failed-flush checkpoint without leaking owners or post-unmount writes', async () => {
  const storage = new MemoryStorage();
  const userA = { id: 'route-remount-owner-a' };
  const userB = { id: 'route-remount-owner-b' };
  const accountA = checkpointApi.checkpointOwner({ user: userA, authenticated: true });
  const accountB = checkpointApi.checkpointOwner({ user: userB, authenticated: true });
  const savedA = deepFreeze(fixture('route-remount-run-a', { day: 14, ap: 2, inventory: { berry: 17, wood: 6 } }));
  const savedB = deepFreeze(fixture('route-remount-run-b', { day: 9, ap: 1, inventory: { berry: 23, wood: 2 } }));
  const savedGuest = deepFreeze(fixture('route-remount-run-guest', { day: 6, ap: 3, inventory: { berry: 12, wood: 8 } }));
  const savedSnapshots = [savedA, savedB, savedGuest].map(fullRunSnapshot);
  expectWrite(storage, accountA, savedA, 0, at(31));
  expectWrite(storage, accountB, savedB, 0, at(32));
  expectWrite(storage, guestOwner, savedGuest, 0, at(33));
  const keyA = checkpointApi.checkpointStorageKey(accountA);
  const keyB = checkpointApi.checkpointStorageKey(accountB);
  const keyGuest = checkpointApi.checkpointStorageKey(guestOwner);
  const originalABytes = storage.getItem(keyA);
  const originalBBytes = storage.getItem(keyB);
  const originalGuestBytes = storage.getItem(keyGuest);
  const startingWrites = storage.writes;
  const sameTabWindow = new MemoryWindow(storage);
  const latest = fixture(savedA.runId, {
    day: 16,
    ap: 1,
    inventory: { ...savedA.inventory, berry: 41, obsidian_shard: 3 },
    camp: { ...savedA.camp, fuel: 1 },
    exploration: { ...savedA.exploration, visits: { ...savedA.exploration.visits, 'echo-cave': 4 } },
    projects: { ...savedA.projects, selectedProjectId: 'drying-rack' },
  });

  const harness = hookHarness({
    storage,
    user: userA,
    token: 'fixture-old-session',
    state: fixture('stale-route-remount-input'),
    windowInstance: sameTabWindow,
    controlMicrotasks: true,
  });
  try {
    harness.render();
    harness.drainMicrotasks();
    harness.render();
    harness.drainMicrotasks();
    assert.deepEqual(fullRunSnapshot(harness.state), fullRunSnapshot(savedA));

    harness.updateState(fixture(savedA.runId, { day: 15, inventory: { ...savedA.inventory, berry: 29 } }));
    storage.failSet = true;
    harness.window.dispatch('fixture-auth-sync', { reason: 'auth-invalidated' });
    harness.render({ user: null, token: null });
    harness.drainMicrotasks();
    assert.equal(harness.state.day, 15, 'A failed auth-expiry flush must retain A latest progress in the mounted hook.');
    assert.equal(storage.getItem(keyA), originalABytes, 'The failed flush must leave A original checkpoint bytes unchanged.');
    assert.equal(storage.getItem(keyB), originalBBytes);
    assert.equal(storage.getItem(keyGuest), originalGuestBytes);

    harness.updateState(latest);
    harness.render();
    assert.ok(harness.pendingMicrotaskCount() > 0, 'The scenario must leave a real hook-scheduled flush queued across unmount.');
    const writesBeforeUnmount = storage.writes;
    const stateCallsBeforeUnmount = harness.writes.stateCalls.length;
    const restoresBeforeUnmount = harness.writes.restored.length;
    const stateUpdatesBeforeUnmount = harness.react?.postUnmountStateUpdates?.length || 0;
    const listenersBeforeUnmount = harness.window.listenerCount();
    const removalsBeforeUnmount = harness.window.removeCalls;
    assert.ok(listenersBeforeUnmount > 0, 'The mounted hook must have registered lifecycle listeners.');

    const unmountResult = harness.unmount();
    assert.equal(unmountResult.listeners, 0, 'Every installed hook listener must be removed by its real effect cleanup.');
    assert.equal(unmountResult.removeCalls - removalsBeforeUnmount, listenersBeforeUnmount, 'Each installed listener cleanup must run exactly once.');
    const removalsAfterUnmount = harness.window.removeCalls;
    harness.unmount();
    assert.equal(harness.window.removeCalls, removalsAfterUnmount, 'Calling unmount twice must not run any cleanup twice.');
    harness.drainMicrotasks({ restoreQueue: true });
    assert.equal(harness.writes.stateCalls.length, stateCallsBeforeUnmount, 'Queued work must not call the run-state setter after unmount.');
    assert.equal(harness.writes.restored.length, restoresBeforeUnmount, 'Queued work must not restore state after unmount.');
    assert.deepEqual(harness.writes.postUnmountStateCalls, []);
    assert.deepEqual(harness.writes.postUnmountRestores, []);
    assert.equal(harness.react?.postUnmountStateUpdates?.length || 0, stateUpdatesBeforeUnmount);
    assert.equal(storage.writes, writesBeforeUnmount, 'A failed unmount flush and stale queued callbacks must not write.');
    assert.equal(storage.getItem(keyA), originalABytes);

    storage.failSet = false;
    const otherTabWindow = new MemoryWindow(storage);
    const otherTab = hookHarness({
      storage,
      user: userB,
      token: 'fixture-account-b-session',
      state: fixture('other-tab-stale'),
      windowInstance: otherTabWindow,
    });
    otherTab.render();
    await settleHookEffects();
    const otherTabView = otherTab.render();
    await settleHookEffects();
    assert.equal(otherTabView.ready, true);
    assert.deepEqual(fullRunSnapshot(otherTab.state), fullRunSnapshot(savedB), 'A other-tab/window mount must restore only B.');
    assert.equal(storage.getItem(keyA), originalABytes, 'A pending run must not be written by B in another window.');
    assert.equal(storage.getItem(keyB), originalBBytes);
    assert.equal(storage.writes, writesBeforeUnmount);
    assert.equal(otherTab.unmount().listeners, 0);

    const guestTab = hookHarness({
      storage,
      state: fixture('same-tab-guest-stale'),
      windowInstance: sameTabWindow,
    });
    guestTab.render();
    await settleHookEffects();
    const guestView = guestTab.render();
    await settleHookEffects();
    assert.equal(guestView.ready, true);
    assert.deepEqual(fullRunSnapshot(guestTab.state), fullRunSnapshot(savedGuest), 'A pending account run must not become guest progress.');
    assert.equal(storage.getItem(keyA), originalABytes);
    assert.equal(storage.getItem(keyGuest), originalGuestBytes);
    assert.equal(storage.writes, writesBeforeUnmount);
    assert.equal(guestTab.unmount().listeners, 0);

    const remount = hookHarness({
      storage,
      user: userA,
      token: 'fixture-new-session',
      state: fixture('stale-route-remount-input-two'),
      windowInstance: sameTabWindow,
      controlMicrotasks: true,
    });
    try {
      assert.strictEqual(remount.window, sameTabWindow, 'The route remount must reuse this tab window.');
      remount.render();
      remount.drainMicrotasks();
      remount.render();
      remount.drainMicrotasks();
      const resumed = remount.render();
      assert.equal(resumed.ready, true);
      assert.equal(resumed.status, 'ready');
      assert.deepEqual(fullRunSnapshot(remount.state), fullRunSnapshot(latest), 'Same-tab reauthentication must recover the newest complete in-memory run after the disk flush failed.');
      assert.equal(storage.writes, writesBeforeUnmount + 1, 'A successful remount recovery must commit exactly one CAS write.');
      const recovered = checkpointApi.readCheckpoint(storage, accountA);
      assert.equal(recovered.status, 'ready');
      assert.deepEqual(fullRunSnapshot(recovered.checkpoint.current), fullRunSnapshot(latest));
      assert.equal(storage.getItem(keyB), originalBBytes, 'Recovery must leave B bytes unchanged.');
      assert.equal(storage.getItem(keyGuest), originalGuestBytes, 'Recovery must leave guest bytes unchanged.');
      assert.deepEqual(storage.snapshot().map(([key]) => key).sort(), [keyA, keyB, keyGuest].sort(), 'No other owner key may be created.');
      assert.deepEqual(fullRunSnapshot(savedA), savedSnapshots[0], 'The original A fixture must remain immutable.');
      assert.deepEqual(fullRunSnapshot(savedB), savedSnapshots[1]);
      assert.deepEqual(fullRunSnapshot(savedGuest), savedSnapshots[2]);
      assert.equal(remount.pendingMicrotaskCount(), 0, 'The reauthenticated view must have no unobserved queued work.');
      const stateCallsBeforeFinalUnmount = remount.writes.stateCalls.length;
      const restoresBeforeFinalUnmount = remount.writes.restored.length;
      assert.equal(remount.unmount().listeners, 0);
      remount.drainMicrotasks({ restoreQueue: true });
      assert.equal(remount.writes.stateCalls.length, stateCallsBeforeFinalUnmount);
      assert.equal(remount.writes.restored.length, restoresBeforeFinalUnmount);
      assert.deepEqual(remount.writes.postUnmountStateCalls, []);
      assert.deepEqual(remount.writes.postUnmountRestores, []);
    } finally {
      remount.unmount();
      remount.drainMicrotasks({ restoreQueue: true });
    }
  } finally {
    const listeners = harness.window.listenerCount();
    const result = harness.unmount();
    if (listeners && result.listeners !== 0) throw new Error('Route-remount fixture leaked effect listeners during cleanup.');
    harness.drainMicrotasks({ restoreQueue: true });
  }
});

await checkAsync('dirty latest action is synchronously checkpointed exactly once by immediate unmount cleanup', async () => {
  const storage = new MemoryStorage();
  const user = { id: 'immediate-unmount-owner' };
  const account = checkpointApi.checkpointOwner({ user, authenticated: true });
  const window = new MemoryWindow(storage);
  const initial = fixture('immediate-unmount-run', { day: 10, ap: 2 });
  const latest = fixture(initial.runId, { day: 11, ap: 1, inventory: { ...initial.inventory, berry: 13 } });
  const latestStateRef = { current: initial };
  const harness = hookHarness({ storage, user, token: 'immediate-unmount-token', state: initial, latestStateRef, windowInstance: window, controlMicrotasks: true });
  try {
    harness.render();
    harness.drainMicrotasks();
    harness.render();
    harness.drainMicrotasks();
    assert.equal(harness.render().ready, true);
    const writesBeforeAction = storage.writes;
    const restoresBeforeAction = harness.writes.restored.length;

    latestStateRef.current = latest;
    harness.updateState(latest);
    harness.render();
    assert.ok(harness.pendingMicrotaskCount() > 0, 'The final action must leave an actual scheduled flush pending at unmount.');
    const listenersBeforeUnmount = window.listenerCount();
    assert.ok(listenersBeforeUnmount > 0);
    assert.equal(harness.unmount().listeners, 0, 'Immediate unmount must run effect cleanup and remove every listener.');
    assert.equal(storage.writes, writesBeforeAction + 1, 'Cleanup must make one synchronous final CAS write, not zero or duplicate writes.');
    const saved = checkpointApi.readCheckpoint(storage, account);
    assert.equal(saved.status, 'ready');
    assert.deepEqual(fullRunSnapshot(saved.checkpoint.current), fullRunSnapshot(latest));
    harness.drainMicrotasks({ restoreQueue: true });
    assert.equal(storage.writes, writesBeforeAction + 1, 'Queued pre-cleanup callbacks must not write a second time.');
    assert.equal(harness.writes.restored.length, restoresBeforeAction, 'Unmount cleanup must not publish a UI restore.');
    assert.deepEqual(harness.writes.postUnmountStateCalls, []);
    assert.deepEqual(harness.writes.postUnmountRestores, []);
    assert.deepEqual(harness.react.postUnmountStateUpdates, []);
  } finally {
    harness.unmount();
    harness.drainMicrotasks({ restoreQueue: true });
  }
});

await checkAsync('StrictMode cleanup replay invalidates old queued flushes while allowing one fresh-generation flush', async () => {
  const storage = new MemoryStorage();
  const user = { id: 'strict-old-queue-owner' };
  const account = checkpointApi.checkpointOwner({ user, authenticated: true });
  const window = new MemoryWindow(storage);
  const initial = fixture('strict-old-queue-run', { day: 10 });
  const latest = fixture(initial.runId, { day: 12, ap: 1, inventory: { ...initial.inventory, berry: 18 } });
  const harness = hookHarness({ storage, user, token: 'strict-old-queue-token', state: initial, windowInstance: window, controlMicrotasks: true });
  try {
    harness.render();
    harness.drainMicrotasks();
    harness.render();
    harness.drainMicrotasks();
    assert.equal(harness.render().ready, true);
    const writesBeforeAction = storage.writes;

    harness.updateState(latest);
    harness.render();
    const oldGenerationQueueLength = harness.pendingMicrotaskCount();
    assert.ok(oldGenerationQueueLength > 0, 'The old generation must have queued callbacks before StrictMode cleanup/replay.');
    harness.replayEffects();
    assert.ok(harness.pendingMicrotaskCount() > oldGenerationQueueLength, 'Effect replay must schedule a distinct new-generation callback set.');
    assert.equal(storage.writes, writesBeforeAction + 1, 'StrictMode cleanup must synchronously persist the dirty latest state exactly once.');
    const writesAfterReplayCleanup = storage.writes;
    const replayRead = checkpointApi.readCheckpoint(storage, account);
    assert.deepEqual(fullRunSnapshot(replayRead.checkpoint.current), fullRunSnapshot(latest));
    assert.equal(replayRead.revision, 2, 'Cleanup must advance the owner revision exactly once.');
    const stateCallsAfterReplaySetup = harness.writes.stateCalls.length;
    const restoresAfterReplaySetup = harness.writes.restored.length;
    harness.drainMicrotasks({ limit: oldGenerationQueueLength });
    assert.equal(storage.writes, writesAfterReplayCleanup, 'Callbacks from the cleaned-up generation must not persist after replay.');
    assert.equal(harness.writes.stateCalls.length, stateCallsAfterReplaySetup, 'Old callbacks must not invoke run-state setters after replay setup.');
    assert.equal(harness.writes.restored.length, restoresAfterReplaySetup, 'Old callbacks must not publish stale restores after replay setup.');

    harness.drainMicrotasks();
    assert.equal(storage.writes, writesAfterReplayCleanup, 'The replayed generation must not duplicate the cleanup flush.');
    const saved = checkpointApi.readCheckpoint(storage, account);
    assert.equal(saved.status, 'ready');
    assert.deepEqual(fullRunSnapshot(saved.checkpoint.current), fullRunSnapshot(latest));
    assert.deepEqual(harness.writes.postUnmountStateCalls, []);
    assert.deepEqual(harness.writes.postUnmountRestores, []);
    assert.deepEqual(harness.react.postUnmountStateUpdates, []);
    assert.equal(harness.unmount().listeners, 0);
  } finally {
    harness.unmount();
    harness.drainMicrotasks({ restoreQueue: true });
  }
});

await checkAsync('external checkpoint bytes survive bounded same-window A/B/A remounts after revision conflict or corruption', async () => {
  for (const guard of ['revision-conflict', 'corrupt']) {
    const storage = new MemoryStorage();
    const userA = { id: `aba-guard-owner-a-${guard}` };
    const userB = { id: `aba-guard-owner-b-${guard}` };
    const accountA = checkpointApi.checkpointOwner({ user: userA, authenticated: true });
    const accountB = checkpointApi.checkpointOwner({ user: userB, authenticated: true });
    const savedA = fixture(`aba-guard-run-a-${guard}`, { day: 10, inventory: { berry: 7, wood: 4 } });
    const savedB = deepFreeze(fixture(`aba-guard-run-b-${guard}`, { day: 9, inventory: { berry: 22, wood: 3 } }));
    expectWrite(storage, accountA, savedA, 0, at(40));
    expectWrite(storage, accountB, savedB, 0, at(41));
    const keyA = checkpointApi.checkpointStorageKey(accountA);
    const keyB = checkpointApi.checkpointStorageKey(accountB);
    const window = new MemoryWindow(storage);
    const latestA = fixture(savedA.runId, { day: 12, ap: 1, inventory: { ...savedA.inventory, berry: 31 } });
    const pending = hookHarness({ storage, user: userA, token: `aba-token-a-${guard}`, state: fixture(`aba-stale-${guard}`), windowInstance: window, controlMicrotasks: true });
    try {
      pending.render();
      pending.drainMicrotasks();
      pending.render();
      pending.drainMicrotasks();
      assert.equal(pending.render().ready, true);
      pending.updateState(fixture(savedA.runId, { day: 11, inventory: { ...savedA.inventory, berry: 19 } }));
      storage.failSet = true;
      window.dispatch('fixture-auth-sync', { reason: 'auth-invalidated' });
      pending.render({ user: null, token: null });
      pending.drainMicrotasks();
      pending.updateState(latestA);
      pending.render();
      pending.drainMicrotasks();
      assert.equal(pending.state.day, 12);
      assert.deepEqual(pending.writes.postUnmountStateCalls, []);
      assert.equal(pending.unmount().listeners, 0);
      pending.drainMicrotasks({ restoreQueue: true });
    } finally {
      pending.unmount();
      pending.drainMicrotasks({ restoreQueue: true });
    }

    storage.failSet = false;
    let protectedABytes;
    if (guard === 'revision-conflict') {
      const externalA = fixture(savedA.runId, { day: 20, ap: 3, inventory: { ...savedA.inventory, berry: 99 } });
      expectWrite(storage, accountA, externalA, 1, at(42));
      protectedABytes = storage.getItem(keyA);
      assert.deepEqual(fullRunSnapshot(checkpointApi.readCheckpoint(storage, accountA).checkpoint.current), fullRunSnapshot(externalA));
    } else {
      protectedABytes = '{corrupt checkpoint fixture';
      storage.values.set(keyA, protectedABytes);
      assert.equal(checkpointApi.readCheckpoint(storage, accountA).status, 'corrupt');
    }
    const protectedBBytes = storage.getItem(keyB);
    const writesAfterExternalChange = storage.writes;

    const remountA = hookHarness({ storage, user: userA, token: `aba-token-a2-${guard}`, state: fixture(`aba-second-stale-${guard}`), windowInstance: window, controlMicrotasks: true });
    try {
      remountA.render();
      const viewA = await settleWriterOwnership(remountA);
      assert.equal(viewA.ready, true);
      assert.deepEqual(fullRunSnapshot(remountA.state), fullRunSnapshot(latestA), 'A remount must retain its pending latest state while refusing to overwrite changed/corrupt storage.');
      assert.equal(storage.getItem(keyA), protectedABytes, 'A conflict or corrupt raw checkpoint must remain byte-for-byte intact.');
      assert.equal(storage.getItem(keyB), protectedBBytes);
      assert.equal(storage.writes, writesAfterExternalChange, 'Pending recovery may not replace protected external bytes.');
      assert.ok(/conflict|corrupt|손상|다른 곳에서 변경/.test(viewA.status + viewA.message), 'The guard must remain visible instead of claiming clean persistence.');
      assert.equal(remountA.unmount().listeners, 0);
      remountA.drainMicrotasks({ restoreQueue: true });
    } finally {
      remountA.unmount();
      remountA.drainMicrotasks({ restoreQueue: true });
    }

    const remountB = hookHarness({ storage, user: userB, token: `aba-token-b-${guard}`, state: fixture(`aba-b-stale-${guard}`), windowInstance: window });
    remountB.render();
    await settleHookEffects();
    remountB.render();
    await settleHookEffects();
    assert.deepEqual(fullRunSnapshot(remountB.state), fullRunSnapshot(savedB), 'Switching to B must restore B, never A pending data.');
    assert.equal(storage.getItem(keyA), protectedABytes);
    assert.equal(storage.getItem(keyB), protectedBBytes);
    assert.equal(storage.writes, writesAfterExternalChange);
    assert.equal(remountB.unmount().listeners, 0);

    const remountAAgain = hookHarness({ storage, user: userA, token: `aba-token-a3-${guard}`, state: fixture(`aba-third-stale-${guard}`), windowInstance: window, controlMicrotasks: true });
    try {
      remountAAgain.render();
      await settleWriterOwnership(remountAAgain);
      assert.deepEqual(fullRunSnapshot(remountAAgain.state), fullRunSnapshot(latestA), 'A/B/A must recover only A pending state from the same tab memory.');
      assert.equal(storage.getItem(keyA), protectedABytes, 'Repeated A/B/A retries must never alter the external/raw A value.');
      assert.equal(storage.getItem(keyB), protectedBBytes);
      assert.equal(storage.writes, writesAfterExternalChange);
      assert.deepEqual(remountAAgain.writes.postUnmountStateCalls, []);
      assert.deepEqual(remountAAgain.writes.postUnmountRestores, []);
      assert.equal(remountAAgain.unmount().listeners, 0);
      remountAAgain.drainMicrotasks({ restoreQueue: true });
    } finally {
      remountAAgain.unmount();
      remountAAgain.drainMicrotasks({ restoreQueue: true });
    }
  }
});

await checkAsync('same-account reauthentication after auth invalidation resumes the latest account checkpoint', async () => {
  const storage = new MemoryStorage();
  const user = { id: 'same-account-reauth' };
  const account = checkpointApi.checkpointOwner({ user, authenticated: true });
  const saved = deepFreeze(fixture('same-account-reauth-run', { day: 14 }));
  const savedSnapshot = snapshotState(saved);
  expectWrite(storage, account, saved, 0, at(26));
  const harness = hookHarness({ storage, user, token: 'old-fixture-session', state: fixture('stale-reauth-render') });
  harness.render();
  await settleHookEffects();
  harness.render();
  const latest = fixture(saved.runId, { day: 15, inventory: { ...saved.inventory, berry: 29 } });
  harness.updateState(latest);

  harness.window.dispatch('fixture-auth-sync', { reason: 'auth-invalidated' });
  harness.render({ user: null, token: null });
  await settleHookEffects();
  assert.equal(harness.state.runId, saved.runId);
  assert.equal(harness.state.day, 15);
  assert.deepEqual(snapshotState(checkpointApi.readCheckpoint(storage, account).checkpoint.current), snapshotState(latest));
  assert.equal(checkpointApi.readCheckpoint(storage, guestOwner).status, 'missing');
  assert.equal(checkpointApi.readCheckpoint(storage, ownerB).status, 'missing');

  harness.window.dispatch('fixture-auth-sync', { reason: 'saveAuth' });
  harness.render({ user, token: 'new-fixture-session' });
  await settleHookEffects();
  const resumed = harness.render();
  assert.equal(resumed.ready, true);
  assert.equal(resumed.status, 'ready');
  assert.equal(harness.state.runId, saved.runId);
  assert.equal(harness.state.day, 15);
  assert.doesNotMatch(resumed.message, /로그인이 만료되었습니다/);
  assert.deepEqual(snapshotState(checkpointApi.readCheckpoint(storage, account).checkpoint.current), snapshotState(latest));
  assert.equal(checkpointApi.readCheckpoint(storage, guestOwner).status, 'missing');
  assert.equal(checkpointApi.readCheckpoint(storage, ownerB).status, 'missing');
  assert.deepEqual(snapshotState(saved), savedSnapshot, 'Auth recovery must not mutate the original checkpoint fixture.');
  harness.unmount();
});

await checkAsync('same-account reauthentication retries the newest checkpoint after auth-expiry flush recovers', async () => {
  const storage = new MemoryStorage();
  const user = { id: 'same-account-flush-recovery' };
  const account = checkpointApi.checkpointOwner({ user, authenticated: true });
  const saved = deepFreeze(fixture('same-account-flush-recovery-run', { day: 11 }));
  const savedSnapshot = snapshotState(saved);
  expectWrite(storage, account, saved, 0, at(27));
  const writesBeforeAuthExpiry = storage.writes;
  const harness = hookHarness({ storage, user, token: 'old-fixture-session', state: fixture('stale-flush-recovery-render') });
  harness.render();
  await settleHookEffects();
  harness.render();
  const latest = fixture(saved.runId, { day: 16, inventory: { ...saved.inventory, berry: 37 } });
  harness.updateState(latest);
  storage.failSet = true;

  harness.window.dispatch('fixture-auth-sync', { reason: 'auth-invalidated' });
  harness.render({ user: null, token: null });
  await settleHookEffects();
  const expiredView = harness.render();
  assert.equal(harness.state.runId, saved.runId);
  assert.equal(harness.state.day, 16, 'A failed local flush must not replace the live account run.');
  assert.match(expiredView.message, /저장 상태|저장소를 사용할 수 없어/);
  assert.deepEqual(snapshotState(checkpointApi.readCheckpoint(storage, account).checkpoint.current), savedSnapshot);
  assert.equal(checkpointApi.readCheckpoint(storage, guestOwner).status, 'missing');
  assert.equal(checkpointApi.readCheckpoint(storage, ownerB).status, 'missing');

  const latestAfterFailure = fixture(saved.runId, { day: 17, inventory: { ...saved.inventory, berry: 41 } });
  harness.updateState(latestAfterFailure);
  storage.failSet = false;
  harness.window.dispatch('fixture-auth-sync', { reason: 'saveAuth' });
  harness.render({ user, token: 'new-fixture-session' });
  await settleHookEffects();
  const resumed = harness.render();
  assert.equal(resumed.ready, true);
  assert.equal(resumed.status, 'ready');
  assert.equal(harness.state.runId, saved.runId);
  assert.equal(harness.state.day, 17);
  assert.equal(storage.writes, writesBeforeAuthExpiry + 1, 'Successful same-account recovery must persist once.');
  assert.equal(resumed.flush().ok, true);
  const stable = harness.render();
  assert.equal(stable.ready, true);
  assert.equal(stable.status, 'ready');
  assert.equal(storage.writes, writesBeforeAuthExpiry + 1, 'A same-state flush and render must not write again.');
  assert.deepEqual(
    snapshotState(checkpointApi.readCheckpoint(storage, account).checkpoint.current),
    snapshotState(latestAfterFailure),
    'After storage recovers, same-account reauthentication must save the latest in-memory state, not the earlier failed-flush snapshot.',
  );
  assert.equal(checkpointApi.readCheckpoint(storage, guestOwner).status, 'missing');
  assert.equal(checkpointApi.readCheckpoint(storage, ownerB).status, 'missing');
  assert.deepEqual(snapshotState(saved), savedSnapshot, 'Failed-flush recovery must not mutate the original checkpoint fixture.');
  harness.unmount();
});

await checkAsync('same-account auth-expiry retries preserve newer disk state and cancel safely across recovery guards', async () => {
  for (const guard of ['revision-conflict', 'corrupt', 'still-unavailable', 'account-switch']) {
    const storage = new MemoryStorage();
    const userA = { id: `reauth-guard-a-${guard}` };
    const userB = { id: `reauth-guard-b-${guard}` };
    const accountA = checkpointApi.checkpointOwner({ user: userA, authenticated: true });
    const accountB = checkpointApi.checkpointOwner({ user: userB, authenticated: true });
    const savedA = deepFreeze(fixture(`reauth-guard-run-a-${guard}`, { day: 9 }));
    const savedASnapshot = snapshotState(savedA);
    const savedB = deepFreeze(fixture(`reauth-guard-run-b-${guard}`, { day: 13 }));
    const savedBSnapshot = snapshotState(savedB);
    expectWrite(storage, accountA, savedA, 0, at(28));
    expectWrite(storage, accountB, savedB, 0, at(29));
    const keyA = checkpointApi.checkpointStorageKey(accountA);
    const keyB = checkpointApi.checkpointStorageKey(accountB);
    const originalABytes = storage.getItem(keyA);
    const originalBBytes = storage.getItem(keyB);
    const harness = hookHarness({ storage, user: userA, token: 'old-guard-session', state: fixture(`stale-guard-render-${guard}`) });
    harness.render();
    await settleHookEffects();
    harness.render();
    const latestA = fixture(savedA.runId, { day: 18, inventory: { ...savedA.inventory, berry: 47 } });
    harness.updateState(latestA);
    storage.failSet = true;

    harness.window.dispatch('fixture-auth-sync', { reason: 'auth-invalidated' });
    harness.render({ user: null, token: null });
    await settleHookEffects();
    harness.render();
    assert.equal(harness.state.runId, savedA.runId, `${guard}: failed flush must retain A's live run.`);
    assert.equal(harness.state.day, 18, `${guard}: failed flush must retain A's latest day in memory.`);
    assert.equal(storage.getItem(keyA), originalABytes, `${guard}: a failed flush must leave A's old checkpoint bytes intact.`);
    assert.equal(storage.getItem(keyB), originalBBytes, `${guard}: A's invalidation must not alter B's bytes.`);

    let protectedBytes = originalABytes;
    if (guard === 'revision-conflict') {
      storage.failSet = false;
      const external = fixture(savedA.runId, { day: 19, inventory: { ...savedA.inventory, berry: 53 } });
      const externalWrite = checkpointApi.writeCheckpoint(storage, accountA, external, {
        expectedRevision: checkpointApi.readCheckpoint(storage, accountA).revision,
        savedAt: at(30),
      });
      assert.equal(externalWrite.status, 'ready');
      protectedBytes = storage.getItem(keyA);
    } else if (guard === 'corrupt') {
      storage.failSet = false;
      storage.values.set(keyA, '{corrupt checkpoint fixture');
      protectedBytes = storage.getItem(keyA);
    }

    harness.window.dispatch('fixture-auth-sync', { reason: 'saveAuth' });
    harness.render({ user: userA, token: 'new-guard-session' });

    if (guard === 'account-switch') {
      harness.render({ user: userB, token: 'other-guard-session' });
    }
    await settleHookEffects();
    const view = harness.render();

    if (guard === 'account-switch') {
      assert.equal(view.ready, true);
      assert.equal(view.status, 'ready');
      assert.equal(harness.state.runId, savedB.runId, 'A queued retry must not overwrite B or replace B with A progress.');
      assert.equal(harness.state.day, 13);
      assert.deepEqual(snapshotState(harness.state), savedBSnapshot, 'B must resume its complete prior checkpoint after A recovery is canceled.');
      assert.equal(storage.getItem(keyA), originalABytes, 'The queued A retry must be canceled after the active owner switches to B.');
      assert.equal(storage.getItem(keyB), originalBBytes, 'B checkpoint bytes must stay unchanged by A recovery.');
      assert.doesNotMatch(view.message, /로그인이 만료되었습니다/);
    } else {
      assert.equal(harness.state.runId, savedA.runId, `${guard}: account A's latest run must remain in memory.`);
      assert.equal(harness.state.day, 18, `${guard}: guarded retry must not replace A's live run.`);
      assert.equal(storage.getItem(keyA), protectedBytes, `${guard}: retry must not overwrite newer, corrupt, or unavailable disk state.`);
      assert.equal(storage.getItem(keyB), originalBBytes, `${guard}: retry must not touch account B.`);
      if (guard === 'revision-conflict') assert.match(view.message, /다른 탭|충돌/);
      if (guard === 'corrupt') assert.match(view.message, /읽을 수 없어|덮어쓰기를 중단/);
      if (guard === 'still-unavailable') {
        assert.match(view.message, /저장 상태|저장소를 사용할 수 없어/);
        assert.equal(storage.getItem(keyA), originalABytes);
      }
      assert.deepEqual(snapshotState(savedA), savedASnapshot, `${guard}: original A fixture must remain immutable.`);
    }

    assert.equal(checkpointApi.readCheckpoint(storage, guestOwner).status, 'missing', `${guard}: recovery must not create guest progress.`);
    assert.equal(checkpointApi.readCheckpoint(storage, ownerB).status, 'missing', `${guard}: unrelated global owner fixture must remain absent.`);
    assert.deepEqual(snapshotState(savedB), savedBSnapshot, `${guard}: original B fixture must remain immutable.`);
    harness.unmount();
  }
});

await checkAsync('pagehide flush persists the newest live same-run state without creating a previous-run backup', async () => {
  const storage = new MemoryStorage();
  const current = fixture('pagehide-run', { day: 5 });
  const latestStateRef = { current };
  const harness = hookHarness({ storage, state: current, latestStateRef });
  harness.render();
  await settleHookEffects();
  harness.render();
  const changed = fixture('pagehide-run', { day: 6, inventory: { ...current.inventory, berry: 21 } });
  latestStateRef.current = changed;
  harness.window.dispatch('pagehide');
  const saved = checkpointApi.readCheckpoint(storage, guestOwner);
  assert.equal(saved.status, 'ready');
  assert.deepEqual(snapshotState(saved.checkpoint.current), snapshotState(changed));
  assert.equal(saved.checkpoint.previous, null);
  harness.unmount();
});

await checkAsync('beforeunload warns when the newest live checkpoint cannot be written', async () => {
  const storage = new MemoryStorage();
  const current = fixture('beforeunload-run', { day: 5 });
  const harness = hookHarness({ storage, state: current });
  harness.render();
  await settleHookEffects();
  const ready = harness.render();
  assert.equal(ready.ready, true);
  harness.updateState(fixture(current.runId, { day: 6 }));
  storage.failSet = true;
  harness.render();
  await settleHookEffects();
  const event = harness.window.dispatch('beforeunload', {}, {
    prevented: false,
    preventDefault() { this.prevented = true; },
  });
  assert.equal(event.prevented, true, 'A failed final flush must request a beforeunload confirmation.');
  assert.equal(event.returnValue, '');
  assert.equal(checkpointApi.readCheckpoint(storage, guestOwner).checkpoint.current.day, 5);
  harness.unmount();
});

await checkAsync('the actual hook force-backs up a latest same-run state before replacing it with a remote-loaded run', async () => {
  const storage = new MemoryStorage();
  const initial = fixture('same-remote-run', { day: 12 });
  expectWrite(storage, guestOwner, initial, 0, at(23));
  const latestStateRef = { current: initial };
  const harness = hookHarness({ storage, state: fixture('stale-input'), latestStateRef });
  harness.render();
  await settleHookEffects();
  const firstView = harness.render();
  assert.equal(firstView.ready, true);
  assert.equal(harness.state.runId, initial.runId);

  const latestLocal = fixture('same-remote-run', { day: 15, inventory: { ...initial.inventory, berry: 23 } });
  latestStateRef.current = latestLocal;
  const remoteLoaded = fixture('same-remote-run', { day: 9, inventory: { ...initial.inventory, berry: 4 } });
  const result = firstView.replaceRun(remoteLoaded);
  assert.equal(result.ok, true);
  assert.equal(harness.state.day, remoteLoaded.day);
  assert.deepEqual(snapshotState(latestStateRef.current), snapshotState(remoteLoaded));
  const saved = checkpointApi.readCheckpoint(storage, guestOwner);
  assert.equal(saved.checkpoint.current.day, remoteLoaded.day);
  assert.deepEqual(snapshotState(saved.checkpoint.previous), snapshotState(latestLocal));
  assert.equal(harness.writes.stateCalls.at(-1).runId, remoteLoaded.runId);
  harness.unmount();
});

await checkAsync('restoring the previous run first flushes the latest live action into the outgoing run', async () => {
  const storage = new MemoryStorage();
  const first = fixture('swap-first', { day: 7 });
  const firstWrite = expectWrite(storage, guestOwner, first, 0, at(23));
  const second = fixture('swap-second', { day: 4 });
  const secondWrite = expectWrite(storage, guestOwner, second, firstWrite.revision, at(24));
  const latestStateRef = { current: second };
  const harness = hookHarness({ storage, state: second, latestStateRef });
  harness.render();
  await settleHookEffects();
  const view = harness.render();
  assert.equal(view.hasPrevious, true);
  const latestAction = fixture(second.runId, { day: 5, inventory: { ...second.inventory, berry: 41 } });
  latestStateRef.current = latestAction;
  const restored = view.restorePrevious();
  assert.equal(restored.ok, true);
  assert.equal(harness.state.runId, first.runId);
  const saved = checkpointApi.readCheckpoint(storage, guestOwner);
  assert.equal(saved.revision, secondWrite.revision + 2, 'The live flush and previous-run swap must each advance the revision.');
  assert.deepEqual(snapshotState(saved.checkpoint.current), snapshotState(first));
  assert.deepEqual(snapshotState(saved.checkpoint.previous), snapshotState(latestAction));
  harness.unmount();
});

await checkAsync('a cross-tab revision change blocks the actual hook autosave and protects the other tab bytes', async () => {
  const storage = new MemoryStorage();
  const local = fixture('cross-tab-run', { day: 7 });
  expectWrite(storage, guestOwner, local, 0, at(24));
  const harness = hookHarness({ storage, state: local });
  harness.render();
  await settleHookEffects();
  const view = harness.render();
  assert.equal(view.ready, true);
  const external = fixture('cross-tab-run', { day: 10, inventory: { ...local.inventory, berry: 31 } });
  const externalWrite = checkpointApi.writeCheckpoint(storage, guestOwner, external, {
    expectedRevision: checkpointApi.readCheckpoint(storage, guestOwner).revision,
    savedAt: at(25),
  });
  const externalBytes = storage.getItem(checkpointApi.checkpointStorageKey(guestOwner));
  harness.window.dispatch('storage', {}, { key: checkpointApi.checkpointStorageKey(guestOwner) });
  const blocked = view.flush();
  assert.equal(externalWrite.status, 'ready');
  assert.equal(blocked.status, 'conflict');
  assert.equal(storage.getItem(checkpointApi.checkpointStorageKey(guestOwner)), externalBytes);
  harness.unmount();
});

await checkAsync('the actual server-load hook discards delayed responses after same-run edits, new runs, or account-session changes', async () => {
  for (const change of ['same-run-edit', 'new-run', 'account-session']) {
    let resolveDetail;
    const detailPromise = new Promise((resolve) => { resolveDetail = resolve; });
    const current = fixture(`server-load-${change}`, { day: 4 });
    const latestStateRef = { current };
    const session = { account: 'server-account-a' };
    let getCount = 0;
    const scenario = serverPersistenceHarness({
      state: current,
      latestStateRef,
      authSession: session,
      get: () => (++getCount === 1 ? Promise.resolve(saveList) : detailPromise),
    });
    const pending = scenario.view.loadRun();
    await Promise.resolve();
    await Promise.resolve();
    assert.equal(scenario.calls.get.length, 2, `Expected list+detail requests for ${change}.`);
    if (change === 'same-run-edit') latestStateRef.current = fixture(current.runId, { day: 5 });
    if (change === 'new-run') latestStateRef.current = fixture('brand-new-local-run', { day: 1 });
    if (change === 'account-session') scenario.harness.authSession = { account: 'server-account-b' };
    resolveDetail(saveDetail(fixture('remote-response', { day: 22 })));
    await pending;
    assert.equal(scenario.calls.setState.length, 0, `${change} must not replace the current run.`);
    assert.equal(scenario.calls.difficulty.length, 0, `${change} must not alter new-run difficulty.`);
    assert.equal(scenario.calls.actionResult.length, 0, `${change} must not alter the run action result.`);
    assert.equal(scenario.calls.toast.length, 0, `${change} must not announce a stale load as successful.`);
  }
});

await checkAsync('the actual server-load hook leaves current state and run controls untouched when checkpoint replacement fails', async () => {
  const calls = { get: [], setState: [], difficulty: [], actionResult: [], toast: [] };
  const current = fixture('protected-current', { day: 6 });
  const latestStateRef = { current };
  globalThis.__primitiveArchiveServerHarness = {
    authSession: {}, cacheClears: [], refs: [], stateValues: [], stateWrites: [],
    get(path, options) {
      calls.get.push({ path, options });
      return Promise.resolve(calls.get.length === 1 ? saveList : saveDetail(fixture('remote-must-not-apply', { day: 19 })));
    },
    put: () => Promise.resolve({}),
    post: () => Promise.resolve({}),
  };
  const view = invokePersistenceHook({
    latestStateRef,
    replaceRun: (next) => { calls.setState.push(next); return { ok: false, status: 'unavailable', message: 'checkpoint unavailable' }; },
    setActionResult: (value) => calls.actionResult.push(value),
    setNewRunDifficulty: (value) => calls.difficulty.push(value),
    setState: (value) => calls.setState.push(value),
    showToast: (value) => calls.toast.push(value),
    state: current,
    token: 'fixture-token',
  });
  await view.loadRun();
  assert.equal(calls.get.length, 2);
  assert.equal(calls.setState.length, 1, 'Only the guarded replacement attempt is expected; no fallback setState may run.');
  assert.equal(calls.setState[0].runId, 'remote-must-not-apply');
  assert.equal(latestStateRef.current, current);
  assert.equal(calls.difficulty.length, 0);
  assert.equal(calls.actionResult.length, 0);
  assert.equal(calls.toast.length, 0);
});

check('required runtime fields are validated without replacing malformed checkpoint bytes', () => {
  const breakState = [
    (state) => { delete state.log; },
    (state) => { delete state.research; },
    (state) => { delete state.civics; },
    (state) => { delete state.weather; },
    (state) => { state.log = [null]; },
    (state) => { state.research = []; },
    (state) => { state.research.completed = []; },
    (state) => { state.research.progress = null; },
    (state) => { state.research.selectedTechId = null; },
    (state) => { state.civics.completed = null; },
    (state) => { state.civics.progress = []; },
    (state) => { state.civics.selectedCivicId = 4; },
  ];
  for (const [index, breakOne] of breakState.entries()) {
    const storage = new MemoryStorage();
    const healthy = fixture(`required-fields-${index}`);
    expectWrite(storage, guestOwner, healthy, 0, at(1));
    const key = checkpointApi.checkpointStorageKey(guestOwner);
    const original = storage.getItem(key);
    const broken = structuredClone(healthy);
    breakOne(broken);
    assert.equal(checkpointApi.writeCheckpoint(storage, guestOwner, broken, { expectedRevision: 1 }).status, 'invalid-state', `Invalid current state ${index} must not be serialized.`);
    assert.equal(storage.getItem(key), original);
    for (const slot of ['current', 'previous']) {
      const envelope = JSON.parse(original);
      envelope[slot] = broken;
      const damagedBytes = JSON.stringify(envelope);
      storage.setItem(key, damagedBytes);
      assert.equal(checkpointApi.readCheckpoint(storage, guestOwner).status, 'corrupt', `Malformed ${slot} state ${index} must not be restored as ready.`);
      assert.equal(checkpointApi.writeCheckpoint(storage, guestOwner, healthy, { expectedRevision: 1 }).status, 'corrupt');
      assert.equal(storage.getItem(key), damagedBytes, 'Rejected bytes must remain available for explicit recovery.');
    }
  }
});

await checkAsync('malformed research and log checkpoints enter the existing corrupt recovery path without restoration or overwrite', async () => {
  for (const missing of ['research', 'log']) {
    const storage = new MemoryStorage();
    expectWrite(storage, guestOwner, fixture(`malformed-hook-${missing}`), 0, at(1));
    const key = checkpointApi.checkpointStorageKey(guestOwner);
    const envelope = JSON.parse(storage.getItem(key));
    delete envelope.current[missing];
    const bytes = JSON.stringify(envelope);
    storage.setItem(key, bytes);
    const safe = fixture(`safe-in-memory-${missing}`);
    const harness = hookHarness({ storage, state: safe });
    harness.render();
    await settleHookEffects();
    const view = harness.render();
    assert.equal(view.status, 'corrupt');
    assert.equal(harness.state.runId, safe.runId);
    assert.equal(harness.writes.restored.length, 0);
    assert.equal(view.flush().status, 'corrupt');
    assert.equal(storage.getItem(key), bytes);
    harness.unmount();
  }
});

await checkAsync('server loads reject missing gameplay data before normalization can invent replacement progress', async () => {
  for (const missing of ['research', 'log', 'civics']) {
    const current = fixture(`current-before-invalid-server-${missing}`);
    const remote = fixture(`invalid-server-${missing}`);
    delete remote[missing];
    let requests = 0;
    const scenario = serverPersistenceHarness({ state: current, get: () => Promise.resolve(++requests === 1 ? saveList : saveDetail(remote)) });
    await scenario.view.loadRun();
    assert.equal(scenario.calls.setState.length, 0);
    assert.equal(scenario.calls.difficulty.length, 0);
    assert.equal(scenario.calls.actionResult.length, 0);
    assert.equal(scenario.latestStateRef.current, current);
  }
});

await checkAsync('the actual checkpoint hook quarantines null optional structures before a crashing state can reach the game', async () => {
  for (const field of ['tribe', 'projects', 'diplomacy', 'exploration', 'meta']) {
    const storage = new MemoryStorage();
    expectWrite(storage, guestOwner, fixture(`structure-hook-${field}`), 0, at(1));
    const key = checkpointApi.checkpointStorageKey(guestOwner);
    const envelope = JSON.parse(storage.getItem(key));
    envelope.current[field] = null;
    const bytes = JSON.stringify(envelope);
    storage.setItem(key, bytes);
    const safe = fixture(`safe-structure-${field}`);
    const harness = hookHarness({ storage, state: safe });
    try {
      harness.render();
      await settleHookEffects();
      const view = harness.render();
      assert.equal(view.status, 'corrupt', field);
      assert.ok(view.message);
      assert.equal(harness.state.runId, safe.runId);
      assert.doesNotThrow(() => engine.archiveVictorySummary(harness.state));
      assert.equal(harness.writes.restored.length, 0);
      assert.equal(view.flush().status, 'corrupt');
      assert.equal(storage.getItem(key), bytes);
    } finally {
      harness.unmount();
    }
  }
});

await checkAsync('server-load hook rejects null optional structures and preserves the current run', async () => {
  for (const field of ['tribe', 'projects', 'diplomacy', 'exploration', 'meta']) {
    const current = fixture(`structure-server-current-${field}`);
    const remote = fixture(`structure-server-remote-${field}`);
    remote[field] = null;
    let requests = 0;
    const scenario = serverPersistenceHarness({ state: current, get: () => Promise.resolve(++requests === 1 ? saveList : saveDetail(remote)) });
    await scenario.view.loadRun();
    assert.equal(scenario.calls.setState.length, 0, field);
    assert.equal(scenario.calls.difficulty.length, 0);
    assert.equal(scenario.calls.actionResult.length, 0);
    assert.equal(scenario.latestStateRef.current, current);
    assert.ok(scenario.calls.toast.some((toast) => toast.tone === 'danger'));
    assert.doesNotThrow(() => engine.archiveVictorySummary(scenario.latestStateRef.current));
  }
});

check('optional metadata can still be backfilled without rejecting a healthy gameplay checkpoint', () => {
  const storage = new MemoryStorage();
  const state = fixture('optional-checkpoint-fields');
  delete state.devTools;
  delete state.eventChains;
  delete state.research.lastUnlockText;
  expectWrite(storage, guestOwner, state, 0, at(1));
  assert.equal(checkpointApi.readCheckpoint(storage, guestOwner).status, 'ready');
});

check('null and array optional top-level structures are rejected without changing checkpoint bytes', () => {
  const invalidStructures = ['tribe', 'projects', 'diplomacy', 'exploration', 'meta']
    .flatMap((field) => [
      [`${field}-null`, (state) => { state[field] = null; }],
      [`${field}-array`, (state) => { state[field] = []; }],
    ]);

  for (const [name, damage] of invalidStructures) {
    const storage = new MemoryStorage();
    const healthy = fixture(`null-structure-existing-${name}`);
    expectWrite(storage, guestOwner, healthy, 0, at(1));
    const key = checkpointApi.checkpointStorageKey(guestOwner);
    const original = storage.getItem(key);
    const broken = structuredClone(fixture(`null-structure-candidate-${name}`));
    damage(broken);
    assert.equal(checkpointApi.writeCheckpoint(storage, guestOwner, broken, { expectedRevision: 1 }).status, 'invalid-state', name);
    assert.equal(storage.getItem(key), original, `${name}: rejected write must preserve the existing record`);

    const envelope = JSON.parse(original);
    envelope.current = broken;
    const corruptBytes = JSON.stringify(envelope);
    storage.setItem(key, corruptBytes);
    assert.equal(checkpointApi.readCheckpoint(storage, guestOwner).status, 'corrupt', name);
    assert.equal(storage.getItem(key), corruptBytes, `${name}: corrupt read must preserve recoverable source bytes`);
    assert.equal(checkpointApi.writeCheckpoint(storage, guestOwner, healthy, { expectedRevision: 1 }).status, 'corrupt', `${name}: a later write must not overwrite corrupt bytes`);
    assert.equal(storage.getItem(key), corruptBytes);
  }
});

check('nested optional values accepted by engine normalizers remain checkpoint-compatible', () => {
  const storage = new MemoryStorage();
  const state = fixture('normalizable-nested-optional-values');
  state.tribe.assignments = null;
  state.tribe.lastProduction = null;
  state.projects.progress = null;
  state.diplomacy.contacts = { 'river-tribe': null };
  state.exploration.revealed = null;
  state.meta.ownedPerks.gathering = null;
  expectWrite(storage, guestOwner, state, 0, at(1));
  const read = checkpointApi.readCheckpoint(storage, guestOwner);
  assert.equal(read.status, 'ready');
  assert.doesNotThrow(() => engine.archiveVictorySummary(read.checkpoint.current));
});

check('legacy saves may omit optional run structures and remain usable by the production summary consumer', () => {
  const storage = new MemoryStorage();
  const state = fixture('legacy-missing-optional-structures');
  for (const field of ['tribe', 'projects', 'diplomacy', 'exploration', 'meta']) delete state[field];
  expectWrite(storage, guestOwner, state, 0, at(1));
  const read = checkpointApi.readCheckpoint(storage, guestOwner);
  assert.equal(read.status, 'ready');
  assert.doesNotThrow(() => engine.archiveVictorySummary(read.checkpoint.current));
  for (const field of ['tribe', 'projects', 'diplomacy', 'exploration', 'meta']) {
    assert.equal(Object.hasOwn(read.checkpoint.current, field), false, `${field} should remain omitted in the decoded legacy-compatible state`);
  }
});

const invalidNumericStates = [
  ['missing-counters', (state) => { delete state.counters; }],
  ['null-counters', (state) => { state.counters = null; }],
  ['array-counters', (state) => { state.counters = []; }],
  ...['fireLevel', 'shelterLevel', 'workbenchLevel', 'fuel'].map((field) => [
    `missing-${field}`, (state) => { delete state.camp[field]; },
  ]),
  ...[null, '1', {}, [], NaN, Infinity, -1].flatMap((value, index) => [
    [`counter-value-${index}`, (state) => { state.counters.gather = value; }],
    [`camp-level-${index}`, (state) => { state.camp.fireLevel = value; }],
    [`camp-fuel-${index}`, (state) => { state.camp.fuel = value; }],
  ]),
  ...['archiveRoomLevel', 'scribeDeskLevel', 'libraryShelfLevel'].map((field) => [
    `invalid-${field}`, (state) => { state.camp[field] = {}; },
  ]),
];

check('invalid counters and camp numbers cannot be saved or restored as playable current or previous runs', () => {
  for (const [name, damage] of invalidNumericStates) {
    const storage = new MemoryStorage();
    const healthy = fixture(`numeric-state-${name}`);
    expectWrite(storage, guestOwner, healthy, 0, at(1));
    const key = checkpointApi.checkpointStorageKey(guestOwner);
    const original = storage.getItem(key);
    const broken = structuredClone(healthy);
    damage(broken);
    assert.equal(checkpointApi.writeCheckpoint(storage, guestOwner, broken, { expectedRevision: 1 }).status, 'invalid-state', name);
    assert.equal(storage.getItem(key), original);
    for (const slot of ['current', 'previous']) {
      const envelope = JSON.parse(original);
      envelope[slot] = broken;
      const bytes = JSON.stringify(envelope);
      storage.setItem(key, bytes);
      assert.equal(checkpointApi.readCheckpoint(storage, guestOwner).status, 'corrupt', `${name}: ${slot}`);
      assert.equal(checkpointApi.writeCheckpoint(storage, guestOwner, healthy, { expectedRevision: 1 }).status, 'corrupt');
      assert.equal(storage.getItem(key), bytes, 'Damaged bytes must remain available for explicit recovery.');
    }
  }
});

await checkAsync('the actual checkpoint hook blocks missing counters and malformed camp values without exposing a crashing run', async () => {
  for (const [name, damage] of invalidNumericStates.filter(([name]) => ['missing-counters', 'camp-level-2', 'camp-fuel-1'].includes(name))) {
    const storage = new MemoryStorage();
    expectWrite(storage, guestOwner, fixture(`numeric-hook-${name}`), 0, at(1));
    const key = checkpointApi.checkpointStorageKey(guestOwner);
    const envelope = JSON.parse(storage.getItem(key));
    damage(envelope.current);
    const bytes = JSON.stringify(envelope);
    storage.setItem(key, bytes);
    const safe = fixture(`safe-numeric-hook-${name}`);
    const harness = hookHarness({ storage, state: safe });
    harness.render();
    await settleHookEffects();
    const view = harness.render();
    assert.equal(view.status, 'corrupt', name);
    assert.ok(view.message);
    assert.equal(harness.state.runId, safe.runId);
    assert.ok(Number.isFinite(engine.scoreState(harness.state)));
    assert.equal(harness.writes.restored.length, 0);
    assert.equal(view.flush().status, 'corrupt');
    assert.equal(storage.getItem(key), bytes);
    harness.unmount();
  }
});

await checkAsync('server loads reject invalid counters and camp numbers before normalization or current-run replacement', async () => {
  for (const [name, damage] of invalidNumericStates.filter(([name]) => ['missing-counters', 'camp-level-2', 'camp-fuel-1'].includes(name))) {
    const current = fixture(`numeric-server-current-${name}`);
    const remote = fixture(`numeric-server-remote-${name}`);
    damage(remote);
    let requests = 0;
    const scenario = serverPersistenceHarness({ state: current, get: () => Promise.resolve(++requests === 1 ? saveList : saveDetail(remote)) });
    await scenario.view.loadRun();
    assert.equal(scenario.calls.setState.length, 0, name);
    assert.equal(scenario.calls.difficulty.length, 0);
    assert.equal(scenario.calls.actionResult.length, 0);
    assert.equal(scenario.latestStateRef.current, current);
  }
});

check('older healthy counters and camp data can omit later optional additions while keeping finite scores', () => {
  const storage = new MemoryStorage();
  const state = fixture('older-optional-core-numbers');
  state.counters = { gather: 2, hunt: 1, craft: 0 };
  delete state.camp.archiveRoomLevel;
  delete state.camp.scribeDeskLevel;
  delete state.camp.libraryShelfLevel;
  expectWrite(storage, guestOwner, state, 0, at(1));
  const read = checkpointApi.readCheckpoint(storage, guestOwner);
  assert.equal(read.status, 'ready');
  assert.ok(Number.isFinite(engine.scoreState(read.checkpoint.current)));
  assert.deepEqual(read.checkpoint.current.counters, state.counters);
  assert.equal(engine.SAVE_VERSION, 'primitive-archive-v1');
});

await checkAsync('a reset marker followed by a failed state write preserves current progress for the next same-tab mount', async () => {
  const storage = new MemoryStorage();
  const window = new MemoryWindow(storage);
  const key = checkpointApi.checkpointStorageKey(guestOwner);
  const raw = '{unreadable old bytes';
  storage.setItem(key, raw);
  const latest = fixture('reset-retry-live', { day: 22, ap: 2, inventory: { berry: 77, wood: 6 } });
  const writer = hookHarness({ storage, windowInstance: window, state: latest });
  writer.render();
  const view = await settleWriterOwnership(writer);
  assert.equal(view.status, 'corrupt');
  const originalSet = storage.setItem.bind(storage);
  storage.setItem = (writtenKey, value) => {
    if (writtenKey === key && JSON.parse(value).kind !== 'cleared') throw new Error('Only the full state write exceeds the temporary quota');
    originalSet(writtenKey, value);
  };
  const failed = view.discardUnreadable();
  assert.equal(failed.ok, false);
  assert.equal(failed.status, 'unavailable');
  assert.equal(checkpointApi.readCheckpoint(storage, guestOwner).status, 'missing');
  assert.equal(storage.getItem(checkpointApi.checkpointBackupKey(guestOwner)), raw);
  writer.unmount();
  storage.setItem = originalSet;
  const remount = hookHarness({ storage, windowInstance: window, state: fixture('stale-after-reset') });
  try {
    remount.render();
    const restored = await settleWriterOwnership(remount);
    assert.equal(restored.status, 'ready');
    assert.deepEqual(fullRunSnapshot(remount.state), fullRunSnapshot(latest));
    assert.equal(checkpointApi.readCheckpoint(storage, guestOwner).revision, 1);
    assert.equal(storage.getItem(checkpointApi.checkpointBackupKey(guestOwner)), raw);
  } finally { remount.unmount(); writer.unmount(); }
});

await checkAsync('two live hooks permit one same-owner writer and a read-only tab cannot replace or clear its bytes', async () => {
  const storage = new MemoryStorage();
  const user = { id: 'exclusive-owner' };
  const owner = checkpointApi.checkpointOwner({ user, authenticated: true });
  const writer = hookHarness({ storage, user, token: 'writer-token', state: fixture('writer-run') });
  writer.render();
  let writerView = await settleWriterOwnership(writer);
  assert.equal(writerView.flush().ok, true);
  const key = checkpointApi.checkpointStorageKey(owner);
  const originalBytes = storage.getItem(key);
  const readerWindow = new MemoryWindow(storage);
  const reader = hookHarness({ storage, user, token: 'reader-token', state: fixture('reader-stale'), windowInstance: readerWindow });
  try {
    reader.render();
    await settleHookEffects();
    const view = reader.render();
    assert.equal(view.ready, true);
    assert.equal(view.exclusive, false);
    assert.equal(view.status, 'conflict');
    assert.match(view.message, /다른 탭.*보기만/);
    assert.deepEqual(fullRunSnapshot(reader.state), fullRunSnapshot(writer.state));
    for (const attempt of [() => view.flush(), () => view.replaceRun(fixture('denied-replacement')), () => view.restorePrevious(), () => view.discardUnreadable()]) {
      assert.equal(attempt().ok, false);
      assert.equal(storage.getItem(key), originalBytes);
    }
    reader.unmount();
    const latest = fixture('writer-run', { day: 19, ap: 1, inventory: { berry: 81, wood: 9 } });
    writer.updateState(latest);
    writerView = writer.render();
    assert.equal(writerView.flush().ok, true);
    writer.unmount();
    const resumed = hookHarness({ storage, user, token: 'reader-token', state: fixture('reopened-reader'), windowInstance: readerWindow });
    try {
      resumed.render();
      const resumedView = await settleWriterOwnership(resumed);
      assert.equal(resumedView.status, 'ready');
      assert.deepEqual(fullRunSnapshot(resumed.state), fullRunSnapshot(latest), 'An old spectator must not manufacture an unsaved snapshot that hides newer acknowledged data.');
    } finally { resumed.unmount(); }
  } finally { reader.unmount(); writer.unmount(); }
});

await checkAsync('read-only spectator can close without a warning while a failed writer retains its pending-change warning', async () => {
  const storage = new MemoryStorage();
  const user = { id: 'beforeunload-lease-owner' };
  const writer = hookHarness({ storage, user, token: 'writer-token', state: fixture('beforeunload-owner') });
  writer.render();
  await settleWriterOwnership(writer);

  const spectatorWindow = new MemoryWindow(storage);
  const spectator = hookHarness({ storage, user, token: 'spectator-token', state: fixture('spectator-render'), windowInstance: spectatorWindow });
  try {
    spectator.render();
    await settleHookEffects();
    assert.equal(spectator.render().exclusive, false);
    const closeSpectator = spectatorWindow.dispatch('beforeunload', {}, {
      prevented: false,
      preventDefault() { this.prevented = true; },
    });
    assert.equal(closeSpectator.prevented, false);
    assert.equal(closeSpectator.returnValue, undefined);
  } finally { spectator.unmount(); writer.unmount(); }

  const failedStorage = new MemoryStorage();
  const failedWriter = hookHarness({ storage: failedStorage, user, token: 'failed-writer-token', state: fixture('failed-beforeunload-owner') });
  try {
    failedWriter.render();
    const view = await settleWriterOwnership(failedWriter);
    failedStorage.failSet = true;
    failedWriter.updateState(fixture('failed-beforeunload-owner', { day: 16 }));
    failedWriter.render();
    assert.equal(view.flush().status, 'unavailable');
    const pendingClose = failedWriter.window.dispatch('beforeunload', {}, {
      prevented: false,
      preventDefault() { this.prevented = true; },
    });
    assert.equal(pendingClose.prevented, true);
    assert.equal(pendingClose.returnValue, '');
    assert.equal(failedWriter.react.unmounted, false);
  } finally { failedStorage.failSet = false; failedWriter.unmount(); }
});

await checkAsync('legacy storage events are ignored when unchanged and persistent v2 fingerprint conflicts survive reload', async () => {
  const storage = new MemoryStorage();
  const legacyKey = checkpointApi.legacyCheckpointStorageKey(guestOwner);
  const v2Key = checkpointApi.checkpointStorageKey(guestOwner);
  const legacyState = fixture('legacy-event-run', { day: 11 });
  const originalLegacy = legacyEnvelope(guestOwner, legacyState, 4, at(8));
  const changedBeforeMigration = legacyEnvelope(guestOwner, fixture('changed-before-migration', { day: 12 }), 4, at(8));
  storage.setItem(legacyKey, originalLegacy);
  const preMigrationWindow = new MemoryWindow(storage);
  const preMigrationTab = hookHarness({ storage, windowInstance: preMigrationWindow, state: fixture('pre-migration-stale') });
  try {
    preMigrationTab.render();
    const preMigration = await settleWriterOwnership(preMigrationTab);
    assert.equal(preMigration.status, 'ready');
    assert.equal(preMigrationTab.state.day, 11);
    preMigrationWindow.dispatch('storage', {}, { key: legacyKey, oldValue: originalLegacy, newValue: originalLegacy });
    assert.equal(preMigrationTab.render().status, 'ready', 'The first unchanged v1 event before migration must not be treated as a second writer.');
    storage.setItem(legacyKey, changedBeforeMigration);
    preMigrationWindow.dispatch('storage', {}, { key: legacyKey, oldValue: originalLegacy, newValue: changedBeforeMigration });
    const preMigrationConflict = preMigrationTab.render();
    assert.equal(preMigrationConflict.status, 'conflict', 'A same-revision v1 content change before migration must still conflict.');
    assert.match(preMigrationConflict.message, /다른 버전의 게임 탭/);
  } finally { preMigrationTab.unmount(); }

  const legacySourceAtMigration = storage.getItem(legacyKey);
  const legacy = checkpointApi.readCheckpoint(storage, guestOwner);
  expectWrite(storage, guestOwner, fixture('legacy-event-run', { day: 12 }), legacy.revision, at(9));
  const originalV2 = storage.getItem(v2Key);
  const changedLegacy = legacyEnvelope(guestOwner, fixture('old-legacy-tab-run', { day: 13 }), 5, at(10));
  const window = new MemoryWindow(storage);
  const firstTab = hookHarness({ storage, windowInstance: window, state: fixture('legacy-event-stale') });
  try {
    firstTab.render();
    const initial = await settleWriterOwnership(firstTab);
    assert.equal(initial.status, 'ready');
    assert.equal(firstTab.state.day, 12);
    assert.equal(window.listenerCount('storage'), 1, 'The active owner should observe storage changes.');

    window.dispatch('storage', {}, { key: legacyKey, oldValue: legacySourceAtMigration, newValue: legacySourceAtMigration });
    assert.equal(firstTab.render().status, 'ready', 'An unchanged legacy event must not create a false conflict.');

    storage.setItem(legacyKey, changedLegacy);
    window.dispatch('storage', {}, { key: legacyKey, oldValue: legacySourceAtMigration, newValue: changedLegacy });
    const conflicted = firstTab.render();
    assert.equal(conflicted.status, 'conflict', 'A changed legacy key event must conflict immediately.');
    assert.match(conflicted.message, /다른 버전의 게임 탭/);
    assert.equal(storage.getItem(v2Key), originalV2);
    assert.equal(storage.getItem(legacyKey), changedLegacy);
  } finally { firstTab.unmount(); }

  const reopened = hookHarness({ storage, windowInstance: new MemoryWindow(storage), state: fixture('reopened-legacy-owner') });
  try {
    reopened.render();
    const view = await settleWriterOwnership(reopened);
    assert.equal(view.status, 'conflict', 'The persisted v2 fingerprint must keep the conflict after reload.');
    assert.match(view.message, /다른 버전의 게임 탭/);
    assert.equal(reopened.state.runId, 'reopened-legacy-owner', 'A changed legacy source must not silently restore or overwrite either version.');
    assert.equal(storage.getItem(v2Key), originalV2);
    assert.equal(storage.getItem(legacyKey), changedLegacy);
  } finally { reopened.unmount(); }
});

await checkAsync('a missing lock provider restores saved state for viewing while every checkpoint mutation fails closed', async () => {
  const storage = new MemoryStorage();
  const user = { id: 'unsupported-locks-owner' };
  const owner = checkpointApi.checkpointOwner({ user, authenticated: true });
  const saved = fixture('unsupported-saved', { day: 17 });
  expectWrite(storage, owner, saved, 0, at(20));
  const before = storage.snapshot();
  const window = new MemoryWindow(storage);
  window.navigator.locks = null;
  const harness = hookHarness({ storage, user, token: 'unsupported-token', windowInstance: window, state: fixture('unowned-render') });
  try {
    harness.render();
    await settleHookEffects();
    const view = harness.render();
    assert.equal(view.ready, true);
    assert.equal(view.exclusive, false);
    assert.equal(view.status, 'unavailable');
    assert.deepEqual(fullRunSnapshot(harness.state), fullRunSnapshot(saved));
    for (const attempt of [() => view.flush(), () => view.replaceRun(fixture('cannot-replace')), () => view.restorePrevious(), () => view.discardUnreadable()]) assert.equal(attempt().ok, false);
    assert.deepEqual(storage.snapshot(), before);
  } finally { harness.unmount(); }
});

await checkAsync('a pending writer acquisition cancelled by unmount never restores, writes, or updates a departed owner', async () => {
  const storage = new MemoryStorage();
  const window = new MemoryWindow(storage);
  let grant;
  let finish;
  window.navigator.locks = { request(name, _options, callback) { grant = () => { const task = callback({ name, mode: 'exclusive' }); Promise.resolve(task).then(finish); }; return new Promise((resolve) => { finish = resolve; }); } };
  const harness = hookHarness({ storage, windowInstance: window, state: fixture('late-lease') });
  harness.render();
  assert.equal(harness.render().exclusive, false);
  const before = storage.snapshot();
  harness.unmount();
  grant();
  await settleHookEffects();
  assert.deepEqual(storage.snapshot(), before);
  assert.deepEqual(harness.writes.postUnmountStateCalls, []);
  assert.deepEqual(harness.writes.postUnmountRestores, []);
  assert.deepEqual(harness.react.postUnmountStateUpdates, []);
});

await checkAsync('back-forward cache handoff flushes before release and resumes the latest acknowledged same-owner checkpoint', async () => {
  const storage = new MemoryStorage();
  const user = { id: 'bfcache-owner' };
  const owner = checkpointApi.checkpointOwner({ user, authenticated: true });
  const cached = hookHarness({ storage, user, token: 'cached-token', state: fixture('cache-run') });
  cached.render();
  await settleWriterOwnership(cached);
  const latestBeforeHide = fixture('cache-run', { day: 19, ap: 1 });
  cached.updateState(latestBeforeHide);
  cached.render();
  cached.window.dispatch('pagehide', {}, { persisted: true });
  assert.deepEqual(fullRunSnapshot(checkpointApi.readCheckpoint(storage, owner).checkpoint.current), fullRunSnapshot(latestBeforeHide));
  const other = hookHarness({ storage, user, token: 'other-token', state: fixture('other-render') });
  try {
    other.render();
    const view = await settleWriterOwnership(other);
    assert.equal(view.exclusive, true);
    const latestElsewhere = fixture('cache-run', { day: 20, ap: 2, inventory: { berry: 28, wood: 5 } });
    other.updateState(latestElsewhere);
    assert.equal(other.render().flush().ok, true);
    other.unmount();
    const protectedBytes = storage.getItem(checkpointApi.checkpointStorageKey(owner));
    cached.window.dispatch('pageshow', {}, { persisted: true });
    const resumed = await settleWriterOwnership(cached);
    assert.equal(resumed.status, 'ready');
    assert.deepEqual(fullRunSnapshot(cached.state), fullRunSnapshot(latestElsewhere));
    assert.equal(storage.getItem(checkpointApi.checkpointStorageKey(owner)), protectedBytes, 'Resuming an acknowledged view must not write a stale checkpoint over the other tab.');
  } finally { other.unmount(); cached.unmount(); }
});

console.log(JSON.stringify({ pass: failures.length === 0, checks: checks.length, failures }, null, 2));
if (failures.length) process.exitCode = 1;
