import assert from 'node:assert/strict';
import './lib/register-simulation-modules.mjs';
const engine = await import('../src/app/games/primitive-archive/_lib/primitiveArchiveEngine.js');
const tradition = await import('../src/app/games/primitive-archive/_lib/primitiveArchiveProjectTradition.js');
const checkpoint = await import('../src/app/games/primitive-archive/_lib/primitiveArchiveCheckpoint.js');
const faith = await import('../src/app/games/primitive-archive/_lib/primitiveArchiveAncestralFaith.js');
const clone = value => structuredClone(value);
const owner = 'guest';
const savedAt = '2026-11-01T00:00:00.000Z';
const key = checkpoint.checkpointStorageKey(owner);
class Storage {
  values = new Map();
  getItem(id) { return this.values.get(id) ?? null; }
  setItem(id, value) { this.values.set(id, String(value)); }
  removeItem(id) { this.values.delete(id); }
}
function fixture() {
  let state = engine.createNewState({ runId: 'project-tradition-checkpoint', difficulty: 'easy', now: savedAt, rng: () => 0.5 });
  state.camp = { ...state.camp, fireLevel: 1, shelterLevel: 3, workbenchLevel: 1, fuel: 10 };
  state.inventory = { berry: 50, wood: 30, fiber: 20, stone: 20 };
  state.weather = { id: 'clear', name: '검사 맑음', temp: 20, cold: 0, actionMod: 0 };
  state.tribe.assignments = Object.fromEntries(engine.TRIBE_JOBS.map(job => [job.id,
    job.id === 'forager' ? 3 : job.id === 'builder' ? 1 : 0]));
  state.tribe.autoAssignments = Object.fromEntries(engine.TRIBE_JOBS.map(job => [job.id, 0]));
  state.research.completed = { ...state.research.completed, GATHERING: true, HUNTING: true,
    CORDAGE: true, SETTLEMENT: true, FOOD_STORAGE: true };
  const actorId = state.party[0].id;
  for (let index = 0; index < 3; index++) state = engine.runCampAction(state, actorId, 'fuel', { rng: () => 0.5 });
  state = engine.ancestralRiteAction(state, actorId, actorId);
  return engine.normalizeState(engine.reserveProjectTraditionAction(state, actorId));
}
let groups = 0;
const failures = [];
function check(name, run) {
  try { run(); groups++; console.log(`PASS ${name}`); }
  catch (error) { failures.push(name); console.error(`FAIL ${name}: ${String(error.message).slice(0, 600)}`); }
}
function roundTrip(state) {
  const storage = new Storage();
  assert.equal(checkpoint.writeCheckpoint(storage, owner, state, { expectedRevision: 0, savedAt }).status, 'ready');
  return { storage, restored: engine.normalizeState(checkpoint.readCheckpoint(storage, owner).checkpoint.current) };
}

check('reservation and consumed charges round-trip without another rite, action, material payment or reward', () => {
  const state = fixture();
  const { restored } = roundTrip(state);
  for (const field of ['projectTradition', 'ancestralFaith', 'founderHistory', 'inventory', 'party', 'research', 'civics']) {
    assert.deepEqual(restored[field], state[field]);
  }
  assert.equal(restored.ap, state.ap);
  assert.equal(restored.day, state.day);
  const again = engine.reserveProjectTraditionAction(restored, restored.party[0].id);
  assert.deepEqual(again.projectTradition, restored.projectTradition);
  assert.deepEqual(again.ancestralFaith, restored.ancestralFaith);
  assert.deepEqual(again.inventory, restored.inventory);
});

check('a due-day transient checkpoint retains the paid reservation after ordinary same-day faith expires', () => {
  const state = engine.normalizeState({ ...fixture(), day: 2 });
  assert.equal(state.ancestralFaith.active, null);
  assert.equal(state.ancestralFaith.lastRiteDay, 1);
  const { restored } = roundTrip(state);
  assert.deepEqual(restored.projectTradition.pending, state.projectTradition.pending);
  assert.equal(tradition.projectTraditionBonus(restored, {
    projectId: 'drying-rack', baseWork: 1, progressBefore: 0, work: 5 }), 1);
});

check('actual work, one receipt and a later manual completion survive reload and explicit previous-snapshot storage', () => {
  const reserved = fixture();
  const applied = engine.advanceDay(reserved, { rng: () => 0.5 });
  const { storage, restored } = roundTrip(applied);
  assert.deepEqual(restored.projectTradition, applied.projectTradition);
  const completed = engine.runProjectAction(restored, restored.party[0].id, 'drying-rack', { rng: () => 0.5 });
  assert.equal(completed.projectTradition.records[0].completedDay, 2);
  assert.equal(checkpoint.writeCheckpoint(storage, owner, completed, { expectedRevision: 1, savedAt, forcePrevious: true }).status, 'ready');
  const saved = checkpoint.readCheckpoint(storage, owner).checkpoint;
  assert.deepEqual(saved.previous.projectTradition, applied.projectTradition);
  assert.deepEqual(engine.normalizeState(saved.current).projectTradition, completed.projectTradition);
  assert.equal(engine.normalizeState(saved.current).inventory.jerky, 1);
});

check('missing pre-feature state stays disabled and does not backfill completed facilities or founder history', () => {
  const old = fixture();
  delete old.projectTradition;
  old.projects.completed['drying-rack'] = true;
  old.projects.progress['drying-rack'] = 5;
  const before = clone(old.founderHistory);
  const { restored } = roundTrip(old);
  assert.equal(restored.projectTradition.origin, 'legacy_disabled');
  assert.deepEqual(restored.projectTradition.records, []);
  assert.equal(restored.projectTradition.pending, null);
  assert.deepEqual(restored.founderHistory, before);
  assert.equal(engine.projectTraditionSummary(restored).canReserve, false);
  const legacy = clone(old);
  delete legacy.lineage;
  delete legacy.ancestralFaith;
  delete legacy.founderHistory;
  assert.equal(roundTrip(legacy).restored.projectTradition.origin, 'legacy_disabled');
});

check('defined malformed reservations reject engine restoration and checkpoint writes without replacing protected bytes', () => {
  const state = fixture();
  const { storage } = roundTrip(state);
  const protectedBytes = storage.getItem(key);
  for (const mutate of [
    value => { value.projectTradition = null; },
    value => { value.projectTradition.version = 2; },
    value => { value.projectTradition.runId = 'other-run'; },
    value => { value.projectTradition.pending.dueDay += 1; },
    value => { value.projectTradition.pending.founderId = 'not-a-founder'; },
    value => { value.projectTradition.pending.projectId = 'not-a-project'; },
    value => { value.projectTradition.lastReservedDay = 0; },
    value => { value.projectTradition.pending.extra = true; },
    value => { value.ancestralFaith.lastRiteDay = 0; value.ancestralFaith.lastRiteFounderId = ''; value.ancestralFaith.active = null; },
    value => { value.ancestralFaith.active = null; value.ancestralFaith.lastRiteFounderId = value.party[1].id; },
    value => { value.ancestralFaith.active = null; value.founderHistory.members[0].tallies.camp = 2; },
    value => { delete value.founderHistory; },
    value => { delete value.ancestralFaith; },
    value => { value.lineage.mode = 'legacy'; value.lineage.members = []; },
  ]) {
    const invalid = clone(state);
    mutate(invalid);
    assert.equal(checkpoint.isValidRunState(invalid), false);
    assert.throws(() => engine.normalizeState(invalid), RangeError);
    assert.equal(checkpoint.writeCheckpoint(storage, owner, invalid, { expectedRevision: 1, savedAt }).status, 'invalid-state');
    assert.equal(storage.getItem(key), protectedBytes);
  }
  const noRite = clone(state);
  noRite.ancestralFaith = { ...noRite.ancestralFaith, lastRiteDay: 0, lastRiteFounderId: '', active: null };
  assert.equal(faith.isValidAncestralFaith(noRite.ancestralFaith, noRite), true);
  assert.equal(tradition.isValidProjectTradition(noRite.projectTradition, noRite), false);
});

check('corrupt stored reservations remain byte-identical and block overwrite rather than becoming an empty history', () => {
  const state = fixture();
  const { storage } = roundTrip(state);
  const envelope = JSON.parse(storage.getItem(key));
  envelope.current.projectTradition.pending.dueDay += 1;
  const corrupt = JSON.stringify(envelope);
  storage.setItem(key, corrupt);
  assert.equal(checkpoint.readCheckpoint(storage, owner).status, 'corrupt');
  assert.equal(checkpoint.writeCheckpoint(storage, owner, state, { expectedRevision: 1, savedAt }).status, 'corrupt');
  assert.equal(storage.getItem(key), corrupt);
});

check('actual contribution records reject missing links, duplicates, false dates and work exceeding time or project progress', () => {
  const applied = engine.advanceDay(fixture(), { rng: () => 0.5 });
  assert.equal(tradition.isValidProjectTradition(applied.projectTradition, applied), true);
  for (const mutate of [
    value => { value.projectTradition.records = []; },
    value => { value.projectTradition.records.push(clone(value.projectTradition.records[0])); },
    value => { value.projectTradition.records[0].firstDay = 1; },
    value => { value.projectTradition.records[0].appliedWork = 2; },
    value => { value.projectTradition.records[0].founderId = 'unknown'; },
    value => { value.projectTradition.records[0].lastDay = value.day + 1; },
    value => { value.projectTradition.records[0].completedDay = value.day; },
    value => { value.projectTradition.lastSettlement.bonusWork = 2; },
    value => { value.projectTradition.lastSettlement.progressAfter += 1; },
    value => { value.projectTradition.lastSettlement.result = 'expired'; },
    value => { value.day = 6; Object.assign(value.projectTradition.records[0], { appliedWork: 3, lastDay: 6 }); },
    value => { value.day = 8; value.projects.progress['drying-rack'] = 5;
      Object.assign(value.projectTradition.records[0], { appliedWork: 6, lastDay: 8 }); },
    value => { value.day = 4; value.projects.progress['drying-rack'] = 3;
      Object.assign(value.projectTradition.records[0], { appliedWork: 2, lastDay: 4 });
      value.founderHistory.members[1].tallies.camp = 3;
      value.projectTradition.records.push({ ...value.projectTradition.records[0], founderId: value.party[1].id }); },
  ]) {
    const invalid = clone(applied);
    mutate(invalid);
    assert.equal(tradition.isValidProjectTradition(invalid.projectTradition, invalid), false);
    assert.equal(checkpoint.isValidRunState(invalid), false);
    assert.throws(() => engine.normalizeState(invalid), RangeError);
  }
});

check('final completed records require their real completion day while the explicit internal transition still works', () => {
  const applied = engine.advanceDay(fixture(), { rng: () => 0.5 });
  const completed = engine.runProjectAction(applied, applied.party[0].id, 'drying-rack', { rng: () => 0.5 });
  assert.equal(completed.projectTradition.records[0].completedDay, completed.day);
  const invalid = clone(completed);
  invalid.projectTradition.records[0].completedDay = 0;
  assert.equal(tradition.isValidProjectTradition(invalid.projectTradition, invalid), false);
  assert.equal(checkpoint.isValidRunState(invalid), false);
  assert.throws(() => engine.normalizeState(invalid), RangeError);
  assert.deepEqual(tradition.markProjectTraditionCompleted(invalid, 'drying-rack').projectTradition,
    completed.projectTradition);
});

console.log(`Project tradition checkpoint: ${groups} focused groups passed.`);
if (failures.length) process.exitCode = 1;
