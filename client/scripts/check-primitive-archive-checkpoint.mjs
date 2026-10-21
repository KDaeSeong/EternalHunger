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

  snapshot() {
    return [...this.values.entries()].sort(([a], [b]) => a.localeCompare(b));
  }
}

class MemoryWindow {
  listeners = new Map();

  constructor(localStorage) { this.localStorage = localStorage; }
  addEventListener(type, listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(listener);
  }
  removeEventListener(type, listener) { this.listeners.get(type)?.delete(listener); }
  dispatch(type, detail = {}, values = {}) {
    const event = { type, detail, ...values };
    for (const listener of [...(this.listeners.get(type) || [])]) listener(event);
    return event;
  }
  cleanup() {
    for (const listeners of this.listeners.values()) listeners.clear();
  }
}

function hookHarness({ storage = new MemoryStorage(), state = fixture(), hydrated = true, user = null, token = null, latestStateRef = null } = {}) {
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
  const window = new MemoryWindow(storage);
  globalThis.window = window;
  globalThis.__primitiveArchiveHookHarness = react;
  let currentState = state;
  const writes = { restored: [], stateCalls: [] };
  const props = { hydrated, user, token, latestStateRef };
  const onRestore = (next, context) => writes.restored.push({ state: next, ...context });
  const render = (changes = {}) => {
    Object.assign(props, changes);
    react.beginRender();
    const value = invokeCheckpointHook({
      ...props,
      state: currentState,
      setState: (next) => {
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
    get state() { return currentState; },
    get window() { return window; },
    render,
    replayEffects() { react.replayEffects(); },
    updateState(next) {
      currentState = next;
      if (props.latestStateRef) props.latestStateRef.current = next;
    },
    storage,
    writes,
    unmount() { window.cleanup(); },
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
  await settleHookEffects();
  const view = harness.render();
  assert.equal(view.ready, true);
  await settleHookEffects();
  const settled = harness.render();
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
  await settleHookEffects();
  const view = harness.render();
  await settleHookEffects();
  const settled = harness.render();
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
  assert.equal(storage.writes, 1);
  unknown.unmount();

  const account = hookHarness({ storage, user: { id: 'hook-account-a' }, token: 'token-a', state: fixture('pre-account') });
  account.render();
  await settleHookEffects();
  account.render();
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

console.log(JSON.stringify({ pass: failures.length === 0, checks: checks.length, failures }, null, 2));
if (failures.length) process.exitCode = 1;
