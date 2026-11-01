import assert from 'node:assert/strict';
import './lib/register-simulation-modules.mjs';
const engine = await import('../src/app/games/primitive-archive/_lib/primitiveArchiveEngine.js');
const checkpoint = await import('../src/app/games/primitive-archive/_lib/primitiveArchiveCheckpoint.js');
const owner = 'guest';
const at = '2026-10-30T00:00:00.000Z';
const key = checkpoint.checkpointStorageKey(owner);
class Storage {
  values = new Map();
  fail = false;
  getItem(id) { return this.values.get(id) ?? null; }
  setItem(id, value) { if (this.fail) throw new Error('quota'); this.values.set(id, String(value)); }
  removeItem(id) { this.values.delete(id); }
}
const fresh = runId => engine.createNewState({ runId, now: at, rng: () => 0.5 });
const settled = runId => {
  const state = fresh(runId);
  state.research.completed.SETTLEMENT = true;
  state.research.completed.FOOD_STORAGE = true;
  state.camp.shelterLevel = 1;
  state.camp.fireLevel = 1;
  state.camp.fuel = 10;
  state.inventory.berry = 50;
  return engine.normalizeState(state);
};
let checks = 0;
const check = (name, run) => { run(); checks += 1; console.log(`PASS ${name}`); };

check('actual preparation and handover retain identities, equipment, history and economy across a checkpoint', () => {
  const before = settled('lineage-save-handover');
  const founderId = before.party[0].id;
  const prepared = engine.prepareSuccessorAction(before, founderId, { rng: () => 0.5 });
  assert.equal(prepared.lineage.prepared.length, 1);
  assert.equal(prepared.tribe.population, before.tribe.population - 1);
  const handed = engine.retireFounderAction(prepared, founderId);
  assert.ok(!handed.party.some(actor => actor.id === founderId));
  const retired = handed.lineage.members.find(member => member.actorId === founderId);
  assert.equal(retired.stage, 'retired');
  assert.ok(retired.retiredSnapshot.hp > 0);
  assert.equal(handed.lineage.prepared.length, 0);
  assert.equal(handed.party[0].id, retired.successorId);
  assert.deepEqual(handed.inventory, prepared.inventory);
  assert.deepEqual(handed.research, prepared.research);
  assert.deepEqual(handed.civics, prepared.civics);
  assert.deepEqual(handed.meta, prepared.meta);
  const storage = new Storage();
  assert.equal(checkpoint.writeCheckpoint(storage, owner, handed, { expectedRevision: 0, savedAt: at }).status, 'ready');
  const restored = engine.normalizeState(checkpoint.readCheckpoint(storage, owner).checkpoint.current);
  for (const field of ['lineage', 'ancestralFaith', 'founderHistory', 'party', 'equipment', 'inventory', 'research', 'civics', 'meta']) {
    assert.deepEqual(restored[field], handed[field], `${field} must survive restoration without another handover or award.`);
  }
  assert.deepEqual(engine.normalizeState(restored).lineage, restored.lineage, 'Rendering/restoration is not a life tick.');
});

check('real recorded work and paid teaching retain the same-day uses and cooldown after restoration', () => {
  let state = settled('lineage-save-teaching');
  const id = state.party[0].id;
  for (let index = 0; index < 3; index += 1) state = engine.runSafeGatherAction(state, id, 'wood', { rng: () => 0.5 });
  assert.equal(state.founderHistory.members.find(member => member.actorId === id).tallies.gather, 3);
  const before = state;
  state = engine.ancestralRiteAction(state, id, id);
  assert.equal(state.ancestralFaith.active.remaining, 2);
  assert.equal(state.inventory.berry, before.inventory.berry - 1);
  assert.equal(state.ap, before.ap);
  const storage = new Storage();
  assert.equal(checkpoint.writeCheckpoint(storage, owner, state, { expectedRevision: 0, savedAt: at }).status, 'ready');
  const restored = engine.normalizeState(checkpoint.readCheckpoint(storage, owner).checkpoint.current);
  assert.deepEqual(restored.ancestralFaith, state.ancestralFaith);
  const repeat = engine.ancestralRiteAction(restored, id, id);
  assert.deepEqual(repeat.ancestralFaith, state.ancestralFaith);
  assert.deepEqual(repeat.inventory, state.inventory);
  assert.equal(repeat.ap, state.ap);
  assert.equal(repeat.day, state.day);
});

check('absent pre-feature fields remain inactive and do not invent ages or deeds', () => {
  for (const withObservedHistory of [false, true]) {
    const raw = fresh(`lineage-save-legacy-${withObservedHistory}`);
    raw.day = 70;
    delete raw.lineage;
    delete raw.ancestralFaith;
    delete raw.projectTradition;
    if (!withObservedHistory) delete raw.founderHistory;
    const storage = new Storage();
    assert.equal(checkpoint.writeCheckpoint(storage, owner, raw, { expectedRevision: 0, savedAt: at }).status, 'ready');
    const restored = engine.normalizeState(checkpoint.readCheckpoint(storage, owner).checkpoint.current);
    assert.equal(restored.lineage.mode, 'legacy');
    assert.deepEqual(restored.lineage.members, []);
    assert.equal(restored.ancestralFaith.origin, 'legacy_disabled');
    assert.deepEqual(restored.party, raw.party);
    assert.deepEqual(restored.inventory, raw.inventory);
    assert.ok(restored.founderHistory.members.every(member => !member.deathRecord && !member.recentDeeds.length));
  }
});

check('present damaged lifecycle and faith records are rejected before any saved bytes are overwritten', () => {
  let state = settled('lineage-save-corrupt');
  const id = state.party[0].id;
  state = engine.prepareSuccessorAction(state, id, { rng: () => 0.5 });
  const storage = new Storage();
  assert.equal(checkpoint.writeCheckpoint(storage, owner, state, { expectedRevision: 0, savedAt: at }).status, 'ready');
  const original = storage.getItem(key);
  for (const mutate of [
    value => { value.lineage.runId = 'foreign-run'; },
    value => { value.lineage.lastTickDay = value.day + 1; },
    value => { value.lineage.members.push(structuredClone(value.lineage.members[0])); },
    value => { value.lineage.members[0].cycle = -1; },
    value => { value.lineage.prepared[0].mentorId = 'missing-mentor'; },
    value => { value.ancestralFaith.runId = 'foreign-run'; },
    value => { value.ancestralFaith.lastRiteDay = value.day + 1; },
    value => { value.ancestralFaith.lastRiteFounderId = 'non-founder'; value.ancestralFaith.lastRiteDay = value.day; },
    value => { value.ancestralFaith.active = { founderId: id, domain: 'gather', day: value.day, remaining: 3 }; },
  ]) {
    const envelope = JSON.parse(original);
    mutate(envelope.current);
    const raw = JSON.stringify(envelope);
    storage.setItem(key, raw);
    assert.equal(checkpoint.readCheckpoint(storage, owner).status, 'corrupt');
    assert.equal(checkpoint.writeCheckpoint(storage, owner, state, { expectedRevision: 1, savedAt: at }).status, 'corrupt');
    assert.equal(storage.getItem(key), raw);
  }
});

check('quota failure and new-run rollover preserve separate succession and faith state', () => {
  const storage = new Storage();
  const current = settled('lineage-save-previous');
  assert.equal(checkpoint.writeCheckpoint(storage, owner, current, { expectedRevision: 0, savedAt: at }).status, 'ready');
  const original = storage.getItem(key);
  storage.fail = true;
  const changed = engine.prepareSuccessorAction(current, current.party[0].id, { rng: () => 0.5 });
  assert.equal(checkpoint.writeCheckpoint(storage, owner, changed, { expectedRevision: 1, savedAt: at }).status, 'unavailable');
  assert.equal(storage.getItem(key), original);
  storage.fail = false;
  const next = fresh('lineage-save-next');
  assert.equal(checkpoint.writeCheckpoint(storage, owner, next, { expectedRevision: 1, savedAt: at }).status, 'ready');
  const loaded = checkpoint.readCheckpoint(storage, owner).checkpoint;
  assert.deepEqual(loaded.previous.lineage, current.lineage);
  assert.deepEqual(loaded.current.lineage, next.lineage);
  assert.equal(loaded.current.ancestralFaith.lastRiteDay, 0);
  assert.equal(loaded.current.lineage.serial, 0);
});
console.log(JSON.stringify({ pass: true, checks,
  scope: 'Real engine actions, current checkpoint validator and isolated in-memory guest storage; not real account, browser restoration or long-campaign acceptance.' }));
