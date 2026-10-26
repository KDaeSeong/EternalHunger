import { GAME_SLUG, SAVE_VERSION } from './primitiveArchiveData';

const CHECKPOINT_SCHEMA_VERSION = 2;
const CHECKPOINT_KEY_PREFIX = 'primitive-archive:checkpoint:v2:';
const LEGACY_CHECKPOINT_SCHEMA_VERSION = 1;
const LEGACY_CHECKPOINT_KEY_PREFIX = 'primitive-archive:checkpoint:v1:';
const CHECKPOINT_WRITER_LOCK_PREFIX = 'primitive-archive:checkpoint-writer:v2:';
const releasedWriterRequests = new WeakMap();

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function identityPart(value) {
  if (typeof value !== 'string' && typeof value !== 'number') return '';
  return String(value).trim();
}

export function checkpointOwner({ user, authenticated } = {}) {
  if (authenticated === false) return 'guest';
  if (authenticated !== true || !isRecord(user)) return null;

  const id = identityPart(user.id) || identityPart(user._id);
  if (id) return `user:id:${encodeURIComponent(id)}`;

  const username = identityPart(user.username).toLocaleLowerCase('en-US');
  return username ? `user:name:${encodeURIComponent(username)}` : null;
}

export function checkpointStorageKey(ownerKey) {
  return `${CHECKPOINT_KEY_PREFIX}${encodeURIComponent(ownerKey)}`;
}

export function legacyCheckpointStorageKey(ownerKey) {
  return `${LEGACY_CHECKPOINT_KEY_PREFIX}${encodeURIComponent(ownerKey)}`;
}

function checkpointWriterLockName(ownerKey) {
  return `${CHECKPOINT_WRITER_LOCK_PREFIX}${encodeURIComponent(ownerKey)}`;
}

function fingerprintCheckpointSource(raw) {
  if (raw === null || raw === undefined) return null;
  let first = 0x811c9dc5;
  let second = 0x9e3779b9;
  for (let index = 0; index < raw.length; index += 1) {
    const code = raw.charCodeAt(index);
    first = Math.imul(first ^ code, 0x01000193);
    second = Math.imul(second ^ code, 0x85ebca6b);
  }
  return {
    length: raw.length,
    hashA: (first >>> 0).toString(16).padStart(8, '0'),
    hashB: (second >>> 0).toString(16).padStart(8, '0'),
  };
}

function isValidCheckpointFingerprint(value) {
  return value === null || (isRecord(value)
    && Number.isInteger(value.length)
    && value.length >= 0
    && /^[0-9a-f]{8}$/.test(value.hashA)
    && /^[0-9a-f]{8}$/.test(value.hashB));
}

function compareLegacyCheckpoint(read, legacyRaw, storedFingerprint, tracked = true) {
  if (!['ready', 'missing'].includes(read.status)) return read;
  if (!tracked && legacyRaw !== null && legacyRaw !== undefined) {
    return result('conflict', {
      revision: read.revision,
      savedAt: read.savedAt,
      storageKey: read.storageKey,
      error: 'legacy-checkpoint-untracked',
    });
  }
  if (tracked && !sameCheckpointFingerprint(storedFingerprint, fingerprintCheckpointSource(legacyRaw))) {
    return result('conflict', {
      revision: read.revision,
      savedAt: read.savedAt,
      storageKey: read.storageKey,
      error: 'legacy-checkpoint-changed',
    });
  }
  return read;
}

function sameCheckpointFingerprint(left, right) {
  return left === null || right === null
    ? left === right
    : isRecord(left) && isRecord(right)
      && left.length === right.length
      && left.hashA === right.hashA
      && left.hashB === right.hashB;
}

function notifyLeaseStatus(onStatus, status, error = null) {
  try {
    onStatus?.(status, error);
  } catch {
    // A UI observer must not affect lock ownership or release.
  }
}

/**
 * Acquires the per-owner Web Lock used to serialize all checkpoint mutations.
 * The returned controller is immediate so callers can release while acquisition
 * is pending. Await `ready` for the final held/busy/unavailable result.
 */
export function acquireCheckpointWriterLease(ownerKey, { locks, onStatus } = {}) {
  let status = null;
  let closed = false;
  let resolveReady;
  let releaseHold;
  let readyResolved = false;
  let requestCompletion = null;
  const ready = new Promise((resolve) => { resolveReady = resolve; });
  const hold = new Promise((resolve) => { releaseHold = resolve; });
  const settle = (nextStatus, error = null) => {
    status = nextStatus;
    notifyLeaseStatus(onStatus, nextStatus, error);
    if (!readyResolved) {
      readyResolved = true;
      resolveReady({ status: nextStatus, error, release });
    }
  };
  const release = () => {
    if (closed) return;
    closed = true;
    releaseHold();
    if (requestCompletion && locks && status !== 'busy') {
      let released = releasedWriterRequests.get(locks);
      if (!released) {
        released = new Map();
        releasedWriterRequests.set(locks, released);
      }
      const name = checkpointWriterLockName(ownerKey);
      released.set(name, requestCompletion);
      const forget = () => { if (released.get(name) === requestCompletion) released.delete(name); };
      requestCompletion.then(forget, forget);
    }
    if (!readyResolved) settle('unavailable', 'released-before-acquire');
  };
  const controller = {
    // Only held grants permission; pending and released controllers fail closed.
    get status() { return closed ? 'unavailable' : status || 'pending'; },
    release,
    ready,
  };

  if (typeof ownerKey !== 'string' || !ownerKey) {
    settle('unavailable', 'owner-unknown');
    return controller;
  }
  if (!locks || typeof locks.request !== 'function') {
    settle('unavailable', 'web-locks-unavailable');
    return controller;
  }

  const onLock = (lock) => {
    if (closed) return undefined;
    if (!lock) {
      settle('busy', 'writer-busy');
      return undefined;
    }
    settle('held');
    return hold;
  };

  try {
    const name = checkpointWriterLockName(ownerKey);
    const request = () => closed ? undefined : locks.request(name, {
      mode: 'exclusive', ifAvailable: true,
    }, onLock);
    // A StrictMode/SPA remount can follow release in the same task. Wait for
    // this context's released request to finish, never for another live writer.
    const previousRelease = releasedWriterRequests.get(locks)?.get(name);
    requestCompletion = Promise.resolve(previousRelease ? previousRelease.then(request) : request()).catch((error) => {
      if (!closed && !readyResolved) settle('unavailable', error);
    });
  } catch (error) {
    settle('unavailable', error);
  }
  return controller;
}

function isValidProgressTrack(value, selectedKey) {
  return isRecord(value)
    && typeof value[selectedKey] === 'string'
    && isRecord(value.progress)
    && isRecord(value.completed);
}

function isFiniteNonNegative(value) {
  return Number.isFinite(value) && value >= 0;
}

function isValidCamp(value) {
  return isRecord(value)
    && ['fireLevel', 'shelterLevel', 'workbenchLevel', 'fuel']
      .every((key) => isFiniteNonNegative(value[key]))
    && ['archiveRoomLevel', 'scribeDeskLevel', 'libraryShelfLevel']
      .every((key) => !Object.hasOwn(value, key) || isFiniteNonNegative(value[key]));
}

export function isValidRunState(value) {
  if (!isRecord(value)
    || typeof value.runId !== 'string'
    || !value.runId.trim()
    || !Number.isInteger(value.day)
    || value.day < 1
    || !Number.isFinite(value.ap)
    || value.ap < 0
    || !Number.isFinite(value.apMax)
    || value.apMax < 1
    || !Array.isArray(value.party)
    || value.party.length < 1
    || !isRecord(value.inventory)
    || !isValidCamp(value.camp)
    || !isRecord(value.counters)
    || !Object.values(value.counters).every(isFiniteNonNegative)
    || !isRecord(value.weather)
    || !isValidProgressTrack(value.research, 'selectedTechId')
    || !isValidProgressTrack(value.civics, 'selectedCivicId')
    || !Array.isArray(value.log)
    || !value.log.every((line) => typeof line === 'string')
    || typeof value.ended !== 'boolean'
    || typeof value.victory !== 'boolean') return false;

  return value.party.every((member) => (
    isRecord(member)
    && typeof member.id === 'string'
    && member.id.trim().length > 0
    && Number.isFinite(member.hp)
  ));
}

function validSavedAt(value) {
  if (typeof value !== 'string') return false;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString() === value;
}

function cloneState(value) {
  return JSON.parse(JSON.stringify(value));
}

function result(status, values = {}) {
  return {
    ok: status === 'ready' || status === 'missing',
    status,
    checkpoint: null,
    revision: 0,
    savedAt: null,
    error: null,
    ...values,
  };
}

function validateEnvelope(value, ownerKey, schemaVersion) {
  if (!isRecord(value)
    || value.schemaVersion !== schemaVersion
    || value.gameSlug !== GAME_SLUG
    || value.saveVersion !== SAVE_VERSION
    || value.owner !== ownerKey
    || (schemaVersion === CHECKPOINT_SCHEMA_VERSION
      && Object.hasOwn(value, 'legacyFingerprint')
      && !isValidCheckpointFingerprint(value.legacyFingerprint))
    || !Number.isInteger(value.revision)
    || value.revision < 1
    || !validSavedAt(value.savedAt)
    || !isValidRunState(value.current)
    || !(value.previous === null || isValidRunState(value.previous))) return false;
  return true;
}

export function readCheckpoint(storage, ownerKey) {
  if (typeof ownerKey !== 'string' || !ownerKey) {
    return result('unavailable', { error: 'owner-unknown' });
  }

  let raw;
  let legacyRaw;
  try {
    raw = storage.getItem(checkpointStorageKey(ownerKey));
    legacyRaw = storage.getItem(legacyCheckpointStorageKey(ownerKey));
  } catch {
    return result('unavailable', { error: 'storage-read-failed' });
  }

  if (raw !== null && raw !== undefined) {
    const decoded = decodeCheckpoint(raw, ownerKey, CHECKPOINT_SCHEMA_VERSION, checkpointStorageKey(ownerKey));
    if (!decoded.legacyFingerprintTracked) return compareLegacyCheckpoint(decoded, legacyRaw, null, false);
    return compareLegacyCheckpoint(decoded, legacyRaw, decoded.legacyFingerprint);
  }
  const legacyRead = decodeCheckpoint(legacyRaw, ownerKey, LEGACY_CHECKPOINT_SCHEMA_VERSION, legacyCheckpointStorageKey(ownerKey));
  if (['ready', 'missing'].includes(legacyRead.status)) {
    legacyRead.legacyFingerprint = fingerprintCheckpointSource(legacyRaw);
    legacyRead.legacyFingerprintTracked = true;
  }
  return legacyRead;
}

function decodeCheckpoint(raw, ownerKey, schemaVersion, storageKey) {
  if (raw === null || raw === undefined) return result('missing', { storageKey });
  if (typeof raw !== 'string') return result('corrupt', { error: 'invalid-envelope', storageKey });

  let envelope;
  try {
    envelope = JSON.parse(raw);
  } catch {
    return result('corrupt', { error: 'invalid-json', storageKey });
  }
  if (schemaVersion === CHECKPOINT_SCHEMA_VERSION
    && isRecord(envelope)
    && envelope.schemaVersion === CHECKPOINT_SCHEMA_VERSION
    && envelope.gameSlug === GAME_SLUG
    && envelope.saveVersion === SAVE_VERSION
    && envelope.owner === ownerKey
    && envelope.kind === 'cleared'
    && envelope.revision === 0
    && (!Object.hasOwn(envelope, 'legacyFingerprint') || isValidCheckpointFingerprint(envelope.legacyFingerprint))
    && validSavedAt(envelope.savedAt)
    && envelope.current === null
    && envelope.previous === null) {
    return result('missing', {
      revision: 0,
      savedAt: envelope.savedAt,
      storageKey,
      cleared: true,
      legacyFingerprint: envelope.legacyFingerprint,
      legacyFingerprintTracked: Object.hasOwn(envelope, 'legacyFingerprint'),
    });
  }
  if (!validateEnvelope(envelope, ownerKey, schemaVersion)) {
    return result('corrupt', { error: 'invalid-envelope', storageKey });
  }

  try {
    return result('ready', {
      checkpoint: {
        current: cloneState(envelope.current),
        previous: envelope.previous ? cloneState(envelope.previous) : null,
      },
      revision: envelope.revision,
      savedAt: envelope.savedAt,
      storageKey,
      legacy: schemaVersion === LEGACY_CHECKPOINT_SCHEMA_VERSION,
      legacyFingerprint: envelope.legacyFingerprint,
      legacyFingerprintTracked: Object.hasOwn(envelope, 'legacyFingerprint'),
    });
  } catch {
    return result('corrupt', { error: 'invalid-state', storageKey });
  }
}

function expectedRevisionMatches(read, expectedRevision) {
  return Number.isInteger(expectedRevision)
    && expectedRevision >= 0
    && read.revision === expectedRevision;
}

function hasExpectedRevision(expectedRevision) {
  return Number.isInteger(expectedRevision) && expectedRevision >= 0;
}

function makeSavedAt(value) {
  const savedAt = value === undefined ? new Date().toISOString() : value;
  return validSavedAt(savedAt) ? savedAt : null;
}

function writeEnvelope(storage, ownerKey, envelope) {
  try {
    storage.setItem(checkpointStorageKey(ownerKey), JSON.stringify(envelope));
    return true;
  } catch {
    return false;
  }
}

export function writeCheckpoint(storage, ownerKey, state, {
  expectedRevision,
  savedAt: savedAtOption,
  forcePrevious = false,
} = {}) {
  if (typeof ownerKey !== 'string' || !ownerKey) {
    return result('unavailable', { error: 'owner-unknown' });
  }
  if (!isValidRunState(state)) return result('invalid-state', { error: 'invalid-state' });
  if (!hasExpectedRevision(expectedRevision)) {
    return result('invalid-state', { error: 'expected-revision-required' });
  }

  const currentRead = readCheckpoint(storage, ownerKey);
  if (currentRead.status === 'corrupt' || currentRead.status === 'unavailable' || currentRead.status === 'conflict') return currentRead;
  if (!expectedRevisionMatches(currentRead, expectedRevision)) {
    return result('conflict', { revision: currentRead.revision, savedAt: currentRead.savedAt, error: 'revision-conflict' });
  }

  const savedAt = makeSavedAt(savedAtOption);
  if (!savedAt) return result('invalid-state', { revision: currentRead.revision, error: 'invalid-saved-at' });

  let snapshot;
  try {
    snapshot = cloneState(state);
  } catch {
    return result('invalid-state', { revision: currentRead.revision, savedAt: currentRead.savedAt, error: 'invalid-state' });
  }

  const prior = currentRead.checkpoint;
  const sameRun = prior?.current?.runId === snapshot.runId && !forcePrevious;
  const envelope = {
    schemaVersion: CHECKPOINT_SCHEMA_VERSION,
    gameSlug: GAME_SLUG,
    saveVersion: SAVE_VERSION,
    owner: ownerKey,
    legacyFingerprint: currentRead.legacyFingerprintTracked
      ? currentRead.legacyFingerprint
      : fingerprintCheckpointSource(null),
    revision: currentRead.revision + 1,
    savedAt,
    current: snapshot,
    previous: sameRun ? prior.previous : prior?.current || null,
  };

  if (!writeEnvelope(storage, ownerKey, envelope)) {
    return result('unavailable', { revision: currentRead.revision, savedAt: currentRead.savedAt, error: 'storage-write-failed' });
  }

  return result('ready', {
    checkpoint: { current: snapshot, previous: envelope.previous },
    revision: envelope.revision,
    savedAt,
  });
}

export function restorePreviousCheckpoint(storage, ownerKey, { expectedRevision, savedAt: savedAtOption } = {}) {
  if (typeof ownerKey !== 'string' || !ownerKey) {
    return result('unavailable', { error: 'owner-unknown' });
  }
  if (!hasExpectedRevision(expectedRevision)) {
    return result('invalid-state', { error: 'expected-revision-required' });
  }

  const currentRead = readCheckpoint(storage, ownerKey);
  if (currentRead.status === 'corrupt' || currentRead.status === 'unavailable' || currentRead.status === 'conflict') return currentRead;
  if (!expectedRevisionMatches(currentRead, expectedRevision)) {
    return result('conflict', { revision: currentRead.revision, savedAt: currentRead.savedAt, error: 'revision-conflict' });
  }
  if (!currentRead.checkpoint?.previous) {
    return result('no-previous', { revision: currentRead.revision, savedAt: currentRead.savedAt, error: 'no-previous-checkpoint' });
  }

  const savedAt = makeSavedAt(savedAtOption);
  if (!savedAt) return result('invalid-state', { revision: currentRead.revision, savedAt: currentRead.savedAt, error: 'invalid-saved-at' });

  const envelope = {
    schemaVersion: CHECKPOINT_SCHEMA_VERSION,
    gameSlug: GAME_SLUG,
    saveVersion: SAVE_VERSION,
    owner: ownerKey,
    legacyFingerprint: currentRead.legacyFingerprintTracked
      ? currentRead.legacyFingerprint
      : fingerprintCheckpointSource(null),
    revision: currentRead.revision + 1,
    savedAt,
    current: currentRead.checkpoint.previous,
    previous: currentRead.checkpoint.current,
  };
  if (!writeEnvelope(storage, ownerKey, envelope)) {
    return result('unavailable', { revision: currentRead.revision, savedAt: currentRead.savedAt, error: 'storage-write-failed' });
  }

  return result('ready', {
    checkpoint: { current: envelope.current, previous: envelope.previous },
    revision: envelope.revision,
    savedAt,
  });
}

export function checkpointBackupKey(ownerKey) {
  return `${checkpointStorageKey(ownerKey)}:unreadable-backup`;
}

function backupKeyForCheckpointKey(key) {
  return `${key}:unreadable-backup`;
}

// Only called after the player confirms. Preserve unreadable bytes in a backup,
// then install a v2 clear marker. A marker prevents fallback to the legacy key;
// legacy bytes themselves remain untouched for older unlocked tabs.
export function discardUnreadableCheckpoint(storage, ownerKey) {
  if (typeof ownerKey !== 'string' || !ownerKey) {
    return result('unavailable', { error: 'owner-unknown' });
  }
  const primaryKey = checkpointStorageKey(ownerKey);
  const legacyKey = legacyCheckpointStorageKey(ownerKey);
  let raw;
  try {
    raw = storage.getItem(primaryKey);
  } catch {
    return result('unavailable', { error: 'storage-read-failed' });
  }
  let key = primaryKey;
  let schemaVersion = CHECKPOINT_SCHEMA_VERSION;
  if (raw === null || raw === undefined) {
    key = legacyKey;
    schemaVersion = LEGACY_CHECKPOINT_SCHEMA_VERSION;
    try {
      raw = storage.getItem(key);
    } catch {
      return result('unavailable', { error: 'storage-read-failed' });
    }
  }
  let legacyRaw;
  if (key === legacyKey) {
    legacyRaw = raw;
  } else {
    try {
      legacyRaw = storage.getItem(legacyKey);
    } catch {
      return result('unavailable', { error: 'storage-read-failed' });
    }
  }
  const read = decodeCheckpoint(raw, ownerKey, schemaVersion, key);
  if (read.status !== 'corrupt') {
    return result('conflict', { revision: read.revision, savedAt: read.savedAt, error: 'not-corrupt' });
  }
  if (typeof raw !== 'string') return result('corrupt', { error: 'invalid-envelope' });

  const backupKey = backupKeyForCheckpointKey(key);
  try {
    storage.setItem(backupKey, raw);
    if (storage.getItem(backupKey) !== raw) {
      return result('unavailable', { error: 'backup-verification-failed' });
    }
  } catch {
    // Never discard the only copy when quota or security settings block backup.
    return result('corrupt', { error: 'backup-write-failed' });
  }
  try {
    if (storage.getItem(key) !== raw) return result('conflict', { error: 'revision-conflict', backedUp: true });
    if (key !== primaryKey && storage.getItem(primaryKey) !== null) {
      return result('conflict', { error: 'revision-conflict', backedUp: true });
    }
    if (storage.getItem(legacyKey) !== legacyRaw) {
      return result('conflict', { error: 'legacy-checkpoint-changed', backedUp: true });
    }
  } catch {
    return result('unavailable', { error: 'storage-read-failed', backedUp: true });
  }

  const savedAt = new Date().toISOString();
  const clearMarker = {
    schemaVersion: CHECKPOINT_SCHEMA_VERSION,
    gameSlug: GAME_SLUG,
    saveVersion: SAVE_VERSION,
    owner: ownerKey,
    legacyFingerprint: fingerprintCheckpointSource(legacyRaw),
    kind: 'cleared',
    revision: 0,
    savedAt,
    current: null,
    previous: null,
  };
  const clearMarkerRaw = JSON.stringify(clearMarker);
  try {
    storage.setItem(primaryKey, clearMarkerRaw);
  } catch {
    return result('unavailable', { error: 'clear-marker-write-failed', backedUp: true });
  }
  try {
    if (storage.getItem(primaryKey) !== clearMarkerRaw) {
      return result('conflict', { error: 'clear-marker-verification-failed', backedUp: true });
    }
  } catch {
    return result('unavailable', { error: 'clear-marker-verification-failed', backedUp: true });
  }
  return result('missing', { revision: 0, savedAt, storageKey: primaryKey, cleared: true, backedUp: true });
}
