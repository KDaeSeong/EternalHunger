import assert from 'node:assert/strict';
import './lib/register-simulation-modules.mjs';

const engine = await import('../src/app/games/primitive-archive/_lib/primitiveArchiveEngine.js');
const checkpointApi = await import('../src/app/games/primitive-archive/_lib/primitiveArchiveCheckpoint.js');

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

class CooperatingFakeLockManager {
  held = new Map();
  calls = [];
  requestCompletions = new Map();
  rejectRequests = false;
  delayGrant = false;
  pendingGrants = [];

  request(name, options, callback) {
    this.calls.push({ name, options });
    if (this.rejectRequests) return Promise.reject(new Error('fake lock manager rejected request'));
    const grant = () => {
      if (this.held.has(name)) return Promise.resolve(callback(null));
      const releaseSignal = deferred();
      const lock = { name, mode: options?.mode || 'exclusive' };
      this.held.set(name, releaseSignal);
      return Promise.resolve(callback(lock)).finally(() => {
        if (this.held.get(name) === releaseSignal) this.held.delete(name);
        releaseSignal.resolve();
      });
    };
    let completion;
    if (!this.delayGrant) completion = grant();
    else {
      const pending = deferred();
      this.pendingGrants.push(() => pending.resolve(grant()));
      completion = pending.promise;
    }
    this.requestCompletions.set(name, completion);
    return completion;
  }

  grantNext() {
    const grant = this.pendingGrants.shift();
    assert.ok(grant, 'Expected one delayed lock request.');
    grant();
  }

  async waitForRequestCompletion(name) {
    await this.requestCompletions.get(name);
  }
}

function fixture(runId, patch = {}) {
  const state = engine.createNewState({ runId, difficulty: 'normal', rng: () => 0.5 });
  return engine.normalizeState({ ...state, ...patch });
}

function storage() {
  const values = new Map();
  return {
    values,
    writes: 0,
    failSetKeys: new Set(),
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) {
      if (this.failSetKeys.has(key)) throw new Error('injected storage write failure');
      this.writes += 1;
      values.set(key, String(value));
    },
    removeItem(key) { values.delete(key); },
    snapshot() { return [...values.entries()].sort(([a], [b]) => a.localeCompare(b)); },
  };
}

function writeOnlyWithHeldLease(lease, storageValue, owner, state, options) {
  if (lease.status !== 'held') return { status: lease.status, written: false };
  return { ...checkpointApi.writeCheckpoint(storageValue, owner, state, options), written: true };
}

function check(name, run) {
  return { name, run };
}

const cases = [
  check('one owner has at most one held writer lease', async () => {
    const locks = new CooperatingFakeLockManager();
    const first = checkpointApi.acquireCheckpointWriterLease('user:id:lease-a', { locks });
    const second = checkpointApi.acquireCheckpointWriterLease('user:id:lease-a', { locks });
    const [firstReady, secondReady] = await Promise.all([first.ready, second.ready]);
    assert.deepEqual([firstReady.status, secondReady.status].sort(), ['busy', 'held']);
    first.release();
    second.release();
  }),
  check('different owners can hold independent writer leases', async () => {
    const locks = new CooperatingFakeLockManager();
    const first = checkpointApi.acquireCheckpointWriterLease('user:id:lease-owner-a', { locks });
    const second = checkpointApi.acquireCheckpointWriterLease('user:id:lease-owner-b', { locks });
    assert.deepEqual((await Promise.all([first.ready, second.ready])).map((row) => row.status), ['held', 'held']);
    first.release();
    second.release();
  }),
  check('release is idempotent and permits a later same-owner lease', async () => {
    const locks = new CooperatingFakeLockManager();
    const first = checkpointApi.acquireCheckpointWriterLease('user:id:lease-reacquire', { locks });
    assert.equal((await first.ready).status, 'held');
    const lockName = locks.calls[0].name;
    first.release();
    first.release();
    await locks.waitForRequestCompletion(lockName);
    const second = checkpointApi.acquireCheckpointWriterLease('user:id:lease-reacquire', { locks });
    const secondReady = await second.ready;
    assert.equal(secondReady.status, 'held');
    second.release();
  }),
  check('cancellation before delayed grant rejects a late lock grant', async () => {
    const locks = new CooperatingFakeLockManager();
    locks.delayGrant = true;
    const lease = checkpointApi.acquireCheckpointWriterLease('user:id:lease-cancel', { locks });
    assert.equal(lease.status, 'pending');
    lease.release();
    assert.equal((await lease.ready).status, 'unavailable');
    locks.grantNext();
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(lease.status, 'unavailable');
    assert.equal(locks.held.size, 0);
  }),
  check('missing or rejected lock providers fail closed', async () => {
    const storageValue = storage();
    const state = fixture('lease-no-lock-write');
    const unsupported = checkpointApi.acquireCheckpointWriterLease('user:id:no-locks');
    assert.equal(unsupported.status, 'unavailable');
    assert.equal((await unsupported.ready).status, 'unavailable');
    assert.equal(writeOnlyWithHeldLease(unsupported, storageValue, 'user:id:no-locks', state, {
      expectedRevision: 0, savedAt: '2026-10-25T00:00:00.000Z',
    }).written, false);
    const locks = new CooperatingFakeLockManager();
    locks.rejectRequests = true;
    const rejected = checkpointApi.acquireCheckpointWriterLease('user:id:rejected-lock', { locks });
    assert.equal((await rejected.ready).status, 'unavailable');
    assert.equal(writeOnlyWithHeldLease(rejected, storageValue, 'user:id:rejected-lock', state, {
      expectedRevision: 0, savedAt: '2026-10-25T00:00:00.000Z',
    }).written, false);
    assert.equal(storageValue.writes, 0, 'Unavailable callers must perform no checkpoint mutation.');
  }),
  check('one lease can write and restore v2, then preserve and clear corrupt bytes', async () => {
    const owner = 'user:id:lease-mutations';
    const locks = new CooperatingFakeLockManager();
    const storageValue = storage();
    const lease = checkpointApi.acquireCheckpointWriterLease(owner, { locks });
    assert.equal((await lease.ready).status, 'held');

    const original = fixture('lease-original');
    const first = writeOnlyWithHeldLease(lease, storageValue, owner, original, {
      expectedRevision: 0, savedAt: '2026-10-25T00:00:00.000Z',
    });
    assert.equal(first.status, 'ready');
    assert.equal(first.revision, 1);
    const changed = fixture('lease-changed', { ap: 2 });
    const second = writeOnlyWithHeldLease(lease, storageValue, owner, changed, {
      expectedRevision: 1, savedAt: '2026-10-25T00:01:00.000Z',
    });
    assert.equal(second.status, 'ready');
    assert.equal(second.revision, 2);
    assert.deepEqual(second.checkpoint.current, changed);

    const restored = lease.status === 'held' ? checkpointApi.restorePreviousCheckpoint(storageValue, owner, {
      expectedRevision: 2, savedAt: '2026-10-25T00:02:00.000Z',
    }) : { status: lease.status };
    assert.equal(restored.status, 'ready');
    assert.equal(restored.revision, 3);
    assert.deepEqual(restored.checkpoint.current, original);

    const primaryKey = checkpointApi.checkpointStorageKey(owner);
    const corruptBytes = '{corrupt-current-checkpoint';
    storageValue.setItem(primaryKey, corruptBytes);
    assert.equal(checkpointApi.readCheckpoint(storageValue, owner).status, 'corrupt');
    const cleared = lease.status === 'held' ? checkpointApi.discardUnreadableCheckpoint(storageValue, owner) : { status: lease.status };
    assert.equal(cleared.status, 'missing');
    const clearMarker = JSON.parse(storageValue.getItem(primaryKey));
    assert.equal(clearMarker.kind, 'cleared');
    assert.equal(clearMarker.revision, 0);
    assert.equal(clearMarker.current, null);
    assert.equal(clearMarker.previous, null);
    const clearedRead = checkpointApi.readCheckpoint(storageValue, owner);
    assert.equal(clearedRead.status, 'missing');
    assert.equal(clearedRead.revision, 0);
    assert.equal(storageValue.getItem(checkpointApi.checkpointBackupKey(owner)), corruptBytes);
    const afterClear = writeOnlyWithHeldLease(lease, storageValue, owner, changed, {
      expectedRevision: 0, savedAt: '2026-10-25T00:03:00.000Z',
    });
    assert.equal(afterClear.status, 'ready');
    assert.equal(afterClear.revision, 1, 'A post-clear write must start a fresh v2 revision 1.');
    const primaryEnvelope = JSON.parse(storageValue.getItem(primaryKey));
    assert.equal(primaryEnvelope.schemaVersion, 2);
    assert.deepEqual(primaryEnvelope.current, changed);
    lease.release();
  }),
  check('corrupt v2 clear marker masks but preserves a healthy legacy v1 checkpoint', async () => {
    const owner = 'user:id:legacy-under-corrupt-v2';
    const locks = new CooperatingFakeLockManager();
    const storageValue = storage();
    const primaryKey = checkpointApi.checkpointStorageKey(owner);
    const legacyKey = checkpointApi.legacyCheckpointStorageKey(owner);
    const legacyState = fixture('healthy-legacy-preserved');
    const legacyBytes = JSON.stringify({
      schemaVersion: 1, gameSlug: engine.GAME_SLUG, saveVersion: engine.SAVE_VERSION,
      owner, revision: 1, savedAt: '2026-10-24T00:00:00.000Z', current: legacyState, previous: null,
    });
    const corruptBytes = '{corrupt-v2-over-healthy-v1';
    storageValue.setItem(legacyKey, legacyBytes);
    storageValue.setItem(primaryKey, corruptBytes);
    const lease = checkpointApi.acquireCheckpointWriterLease(owner, { locks });
    assert.equal((await lease.ready).status, 'held');

    assert.equal(checkpointApi.readCheckpoint(storageValue, owner).status, 'corrupt', 'Corrupt primary takes precedence over legacy fallback.');
    assert.equal(checkpointApi.discardUnreadableCheckpoint(storageValue, owner).status, 'missing');
    const marker = JSON.parse(storageValue.getItem(primaryKey));
    assert.equal(marker.kind, 'cleared');
    assert.equal(checkpointApi.readCheckpoint(storageValue, owner).status, 'missing');
    assert.equal(checkpointApi.readCheckpoint(storageValue, owner).revision, 0);
    assert.equal(storageValue.getItem(checkpointApi.checkpointBackupKey(owner)), corruptBytes);
    assert.equal(storageValue.getItem(legacyKey), legacyBytes, 'Clear must not delete or rewrite the healthy v1 bytes.');

    const next = writeOnlyWithHeldLease(lease, storageValue, owner, fixture('new-after-v2-clear'), {
      expectedRevision: 0, savedAt: '2026-10-25T00:04:00.000Z',
    });
    assert.equal(next.status, 'ready');
    assert.equal(next.revision, 1);
    assert.equal(storageValue.getItem(legacyKey), legacyBytes);
    lease.release();
  }),
  check('corrupt legacy v1 alone is backed up and masked by a v2 clear marker', async () => {
    const owner = 'user:id:corrupt-legacy-only';
    const locks = new CooperatingFakeLockManager();
    const storageValue = storage();
    const primaryKey = checkpointApi.checkpointStorageKey(owner);
    const legacyKey = checkpointApi.legacyCheckpointStorageKey(owner);
    const corruptBytes = '{corrupt-v1-only';
    storageValue.setItem(legacyKey, corruptBytes);
    const lease = checkpointApi.acquireCheckpointWriterLease(owner, { locks });
    assert.equal((await lease.ready).status, 'held');

    const before = checkpointApi.readCheckpoint(storageValue, owner);
    assert.equal(before.status, 'corrupt');
    assert.equal(before.storageKey, legacyKey);
    const cleared = checkpointApi.discardUnreadableCheckpoint(storageValue, owner);
    assert.equal(cleared.status, 'missing');
    assert.equal(cleared.revision, 0);
    const marker = JSON.parse(storageValue.getItem(primaryKey));
    assert.equal(marker.kind, 'cleared');
    assert.equal(marker.revision, 0);
    assert.equal(checkpointApi.readCheckpoint(storageValue, owner).status, 'missing');
    assert.equal(storageValue.getItem(`${legacyKey}:unreadable-backup`), corruptBytes);
    assert.equal(storageValue.getItem(legacyKey), corruptBytes, 'Unreadable v1 original bytes must remain untouched.');
    lease.release();
  }),
  check('failed clear-marker write preserves corrupt current and its verified backup', async () => {
    const owner = 'user:id:marker-write-failure';
    const locks = new CooperatingFakeLockManager();
    const storageValue = storage();
    const primaryKey = checkpointApi.checkpointStorageKey(owner);
    const legacyKey = checkpointApi.legacyCheckpointStorageKey(owner);
    const legacyBytes = '{legacy-original-must-remain';
    const corruptBytes = '{corrupt-v2-marker-failure';
    storageValue.setItem(legacyKey, legacyBytes);
    storageValue.setItem(primaryKey, corruptBytes);
    storageValue.failSetKeys.add(primaryKey);
    const lease = checkpointApi.acquireCheckpointWriterLease(owner, { locks });
    assert.equal((await lease.ready).status, 'held');

    const failed = checkpointApi.discardUnreadableCheckpoint(storageValue, owner);
    assert.equal(failed.status, 'unavailable');
    assert.equal(failed.error, 'clear-marker-write-failed');
    assert.equal(storageValue.getItem(primaryKey), corruptBytes, 'Failed marker write must leave unreadable source bytes in place.');
    assert.equal(storageValue.getItem(checkpointApi.checkpointBackupKey(owner)), corruptBytes);
    assert.equal(storageValue.getItem(legacyKey), legacyBytes, 'Marker failure must not touch legacy bytes.');
    assert.equal(checkpointApi.readCheckpoint(storageValue, owner).status, 'corrupt');
    lease.release();
  }),
  check('two tabs that read revision 1 before requesting a lease cannot overwrite the winning bytes', async () => {
    const owner = 'user:id:lease-race';
    const locks = new CooperatingFakeLockManager();
    const storageValue = storage();
    const seed = checkpointApi.writeCheckpoint(storageValue, owner, fixture('lease-seed', { ap: 1 }), {
      expectedRevision: 0, savedAt: '2026-10-25T01:00:00.000Z',
    });
    assert.equal(seed.status, 'ready');
    const tabARead = checkpointApi.readCheckpoint(storageValue, owner);
    const tabBRead = checkpointApi.readCheckpoint(storageValue, owner);
    assert.equal(tabARead.revision, 1);
    assert.equal(tabBRead.revision, 1);

    const stateA = fixture('lease-tab-a', { ap: 2 });
    const stateB = fixture('lease-tab-b', { ap: 3 });
    const bytesB = JSON.stringify(stateB);
    const leaseB = checkpointApi.acquireCheckpointWriterLease(owner, { locks });
    const leaseA = checkpointApi.acquireCheckpointWriterLease(owner, { locks });
    const [readyB, readyA] = await Promise.all([leaseB.ready, leaseA.ready]);
    assert.equal(readyB.status, 'held');
    assert.equal(readyA.status, 'busy');

    const writeB = writeOnlyWithHeldLease(leaseB, storageValue, owner, stateB, {
      expectedRevision: tabBRead.revision, savedAt: '2026-10-25T01:01:00.000Z',
    });
    assert.equal(writeB.status, 'ready');
    let writeA = null;
    if (readyA.status === 'held') {
      writeA = writeOnlyWithHeldLease(leaseA, storageValue, owner, stateA, {
        expectedRevision: tabARead.revision, savedAt: '2026-10-25T01:02:00.000Z',
      });
    }
    assert.equal(writeA, null, 'The busy tab must not attempt a checkpoint write.');
    const persistedBytes = storageValue.getItem(checkpointApi.checkpointStorageKey(owner));
    assert.equal(JSON.stringify(JSON.parse(persistedBytes).current), bytesB, 'The losing tab must not replace B bytes with its stale state.');
    assert.deepEqual(checkpointApi.readCheckpoint(storageValue, owner).checkpoint.current, stateB);
    leaseB.release();
    leaseA.release();
  }),
];

let failures = 0;
for (const { name, run } of cases) {
  try {
    await run();
    console.log(`PASS ${name}`);
  } catch (error) {
    failures += 1;
    console.error(`FAIL ${name}: ${error?.message || error}`);
  }
}
console.log(`Writer lease checks: ${cases.length - failures}/${cases.length}. Cooperating fake-lock results are not evidence of browser-level atomicity.`);
if (failures) process.exitCode = 1;
