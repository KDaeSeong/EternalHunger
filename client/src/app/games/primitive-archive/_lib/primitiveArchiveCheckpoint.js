import { GAME_SLUG, SAVE_VERSION } from './primitiveArchiveData';

const CHECKPOINT_SCHEMA_VERSION = 1;
const CHECKPOINT_KEY_PREFIX = 'primitive-archive:checkpoint:v1:';

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

function isValidRunState(value) {
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
    || !isRecord(value.camp)
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

function validateEnvelope(value, ownerKey) {
  if (!isRecord(value)
    || value.schemaVersion !== CHECKPOINT_SCHEMA_VERSION
    || value.gameSlug !== GAME_SLUG
    || value.saveVersion !== SAVE_VERSION
    || value.owner !== ownerKey
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
  try {
    raw = storage.getItem(checkpointStorageKey(ownerKey));
  } catch {
    return result('unavailable', { error: 'storage-read-failed' });
  }

  return decodeCheckpoint(raw, ownerKey);
}

function decodeCheckpoint(raw, ownerKey) {
  if (raw === null || raw === undefined) return result('missing');
  if (typeof raw !== 'string') return result('corrupt', { error: 'invalid-envelope' });

  let envelope;
  try {
    envelope = JSON.parse(raw);
  } catch {
    return result('corrupt', { error: 'invalid-json' });
  }
  if (!validateEnvelope(envelope, ownerKey)) {
    return result('corrupt', { error: 'invalid-envelope' });
  }

  try {
    return result('ready', {
      checkpoint: {
        current: cloneState(envelope.current),
        previous: envelope.previous ? cloneState(envelope.previous) : null,
      },
      revision: envelope.revision,
      savedAt: envelope.savedAt,
    });
  } catch {
    return result('corrupt', { error: 'invalid-state' });
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
  if (currentRead.status === 'corrupt' || currentRead.status === 'unavailable') return currentRead;
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
  if (currentRead.status === 'corrupt' || currentRead.status === 'unavailable') return currentRead;
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

// Only called after the player confirms. Unreadable bytes (a damaged record or one
// written by a different save version) are copied to a single backup key before
// the live key is cleared, so the next write starts a fresh envelope at revision 1.
export function discardUnreadableCheckpoint(storage, ownerKey) {
  if (typeof ownerKey !== 'string' || !ownerKey) {
    return result('unavailable', { error: 'owner-unknown' });
  }
  const key = checkpointStorageKey(ownerKey);
  let raw;
  try {
    raw = storage.getItem(key);
  } catch {
    return result('unavailable', { error: 'storage-read-failed' });
  }
  const read = decodeCheckpoint(raw, ownerKey);
  if (read.status !== 'corrupt') {
    return result('conflict', { revision: read.revision, savedAt: read.savedAt, error: 'not-corrupt' });
  }
  if (typeof raw !== 'string') return result('corrupt', { error: 'invalid-envelope' });

  try {
    storage.setItem(checkpointBackupKey(ownerKey), raw);
  } catch {
    // Never discard the only copy when quota or security settings block backup.
    return result('corrupt', { error: 'backup-write-failed' });
  }
  try {
    // Detect a changed live record before deleting it. localStorage does not
    // provide an atomic compare-and-delete operation across independent tabs.
    if (storage.getItem(key) !== raw) return result('conflict', { error: 'revision-conflict', backedUp: true });
  } catch {
    return result('unavailable', { error: 'storage-read-failed', backedUp: true });
  }
  try {
    storage.removeItem(key);
  } catch {
    return result('unavailable', { error: 'storage-write-failed', backedUp: true });
  }
  return result('missing', { backedUp: true });
}
