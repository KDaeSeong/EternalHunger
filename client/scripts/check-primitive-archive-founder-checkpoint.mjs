import assert from 'node:assert/strict';
import './lib/register-simulation-modules.mjs';
const engine = await import('../src/app/games/primitive-archive/_lib/primitiveArchiveEngine.js');
const checkpoint = await import('../src/app/games/primitive-archive/_lib/primitiveArchiveCheckpoint.js');
const owner = 'guest';
const key = checkpoint.checkpointStorageKey(owner);
const at = '2026-10-30T00:00:00.000Z';
class Storage {
  values = new Map();
  fail = false;
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { if (this.fail) throw new Error('quota'); this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
}
const fresh = runId => engine.createNewState({ runId, now: at, rng: () => 0.5,
  founderIds: engine.STUDENTS.slice(-3).map(member => member.id) });
const storage = new Storage();
let state = fresh('founder-checkpoint-current');
state = engine.runSafeGatherAction(state, state.party[0].id, 'wood', { rng: () => 0.5 });
assert.equal(checkpoint.isValidRunState(state), true);
assert.equal(checkpoint.writeCheckpoint(storage, owner, state, { expectedRevision: 0, savedAt: at }).status, 'ready');
let loaded = checkpoint.readCheckpoint(storage, owner);
assert.equal(loaded.status, 'ready');
assert.deepEqual(loaded.checkpoint.current.founderHistory, state.founderHistory);
assert.deepEqual(engine.normalizeState(loaded.checkpoint.current).founderHistory, state.founderHistory);
console.log('PASS committed founder roster and real deed survive checkpoint and engine restoration');

const original = storage.getItem(key);
for (const mutate of [
  history => { history.runId = 'another-run'; },
  history => { history.members[0].tallies.gather = -1; },
  history => { history.members.push(structuredClone(history.members[0])); },
  history => { history.members[0].recentDeeds.push(...Array.from({ length: 9 }, () => ({ day: 1, kind: 'gather', target: '', gains: [] }))); },
  history => { history.observedFromDay = 999; },
]) {
  const envelope = JSON.parse(original);
  mutate(envelope.current.founderHistory);
  const raw = JSON.stringify(envelope);
  storage.setItem(key, raw);
  assert.equal(checkpoint.readCheckpoint(storage, owner).status, 'corrupt');
  assert.equal(checkpoint.writeCheckpoint(storage, owner, state, { expectedRevision: 1, savedAt: at }).status, 'corrupt');
  assert.equal(storage.getItem(key), raw);
}
storage.setItem(key, original);
console.log('PASS malformed or cross-run present history is corrupt and original bytes are never overwritten');

const legacy = fresh('founder-checkpoint-legacy');
legacy.day = 40;
delete legacy.founderHistory;
const legacyStorage = new Storage();
assert.equal(checkpoint.writeCheckpoint(legacyStorage, owner, legacy, { expectedRevision: 0, savedAt: at }).status, 'ready');
const legacyRestored = engine.normalizeState(checkpoint.readCheckpoint(legacyStorage, owner).checkpoint.current);
assert.equal(legacyRestored.founderHistory.origin, 'observed_legacy');
assert.equal(legacyRestored.founderHistory.observedFromDay, 40);
assert.ok(legacyRestored.founderHistory.members.every(member => !member.isFounder
  && !member.recentDeeds.length && !Object.keys(member.tallies).length));
assert.equal(checkpoint.writeCheckpoint(legacyStorage, owner, legacyRestored, { expectedRevision: 1, savedAt: at }).status, 'ready');
assert.deepEqual(checkpoint.readCheckpoint(legacyStorage, owner).checkpoint.current.founderHistory, legacyRestored.founderHistory);
console.log('PASS legacy observation starts today without inventing old deeds or founders');

storage.fail = true;
const changed = engine.runSafeGatherAction(state, state.party[1].id, 'wood', { rng: () => 0.5 });
assert.equal(checkpoint.writeCheckpoint(storage, owner, changed, { expectedRevision: 1, savedAt: at }).status, 'unavailable');
assert.equal(storage.getItem(key), original);
storage.fail = false;
const replacement = fresh('founder-checkpoint-next');
assert.equal(checkpoint.writeCheckpoint(storage, owner, replacement, { expectedRevision: 1, savedAt: at }).status, 'ready');
loaded = checkpoint.readCheckpoint(storage, owner);
assert.deepEqual(loaded.checkpoint.previous.founderHistory, state.founderHistory);
assert.deepEqual(loaded.checkpoint.current.founderHistory, replacement.founderHistory);
assert.notEqual(loaded.checkpoint.current.runId, loaded.checkpoint.previous.runId);
console.log('PASS quota failure preserves existing history and new-run rollover keeps separate previous history');
console.log(JSON.stringify({ pass: true, checks: 4, scope: 'real checkpoint and engine with fresh in-memory guest storage; no browser or account writes' }));
