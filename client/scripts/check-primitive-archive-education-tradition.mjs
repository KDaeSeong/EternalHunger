import assert from 'node:assert/strict';
import './lib/register-simulation-modules.mjs';
const engine = await import('../src/app/games/primitive-archive/_lib/primitiveArchiveEngine.js');
const checkpoint = await import('../src/app/games/primitive-archive/_lib/primitiveArchiveCheckpoint.js');
const tradition = await import('../src/app/games/primitive-archive/_lib/primitiveArchiveProjectTradition.js');
const { recordFounderDeed } = await import('../src/app/games/primitive-archive/_lib/primitiveArchiveFounders.js');
const clone = value => structuredClone(value);
const jobs = values => Object.fromEntries(engine.TRIBE_JOBS.map(job => [job.id, values[job.id] || 0]));
const civicId = 'LIBERALISM';
class Storage {
  values = new Map(); getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, String(value)); } removeItem(key) { this.values.delete(key); }
}
function fixture() {
  let state = engine.createNewState({ runId: 'education-tradition-contract', difficulty: 'easy',
    now: '2026-11-11T00:00:00.000Z', rng: () => 0.5 });
  state.camp = { ...state.camp, fireLevel: 1, shelterLevel: 3, workbenchLevel: 1, fuel: 20 };
  state.weather = { id: 'clear', name: '검사 맑음', cold: 0, temp: 20, actionMod: 0 };
  state.inventory = { berry: 100, wood: 30, fiber: 30, stone: 20, paper: 8 };
  state.tribe.population = 6;
  state.tribe.assignments = jobs({ forager: 2, scholar: 4 }); state.tribe.autoAssignments = jobs({});
  const byId = new Map(engine.TECH_TREE.map(row => [row.id, row]));
  const civicIds = new Set(engine.CIVIC_TREE.map(row => row.id));
  const complete = id => { const row = byId.get(id); assert.ok(row, id);
    for (const prior of row.prereqs || []) complete(prior);
    (civicIds.has(id) ? state.civics : state.research).completed[id] = true; };
  for (const id of ['GATHERING', 'HUNTING', 'SETTLEMENT', 'FOOD_STORAGE', 'PUBLIC_EDUCATION', 'PAPERMAKING']) complete(id);
  for (const id of byId.get(civicId).prereqs || []) complete(id);
  delete state.civics.completed[civicId]; state.civics.selectedCivicId = civicId; state.civics.progress[civicId] = 0;
  state = engine.normalizeState(state);
  for (let i = 0; i < 3; i++) state = recordFounderDeed(state, {
    actorId: state.party[0].id, kind: 'research_contribution', success: true, target: 'bounded-fixture' });
  state = engine.ancestralRiteAction(state, state.party[1].id, state.party[0].id);
  assert.equal(state.ancestralFaith.active?.domain, 'study');
  return engine.configureTribeEducationAction(state, { teachers: 2 });
}
const reserve = state => engine.reserveEducationTraditionAction(state, state.party[1].id);
const morning = state => engine.advanceDay(state, { rng: () => 0.5 });
const balance = state => state.ancestralFaith.active?.remaining || 0;
const receipt = state => state.tribe.lastProduction.education;
let checks = 0; const failures = [];
function check(name, run) {
  try { run(); checks++; console.log(`PASS ${name}`); }
  catch (error) { failures.push(name); console.error(`FAIL ${name}: ${String(error.stack || error).slice(0, 1400)}`); }
}
check('new education domain exposes actual reservation and cancellation APIs', () => {
  for (const name of ['educationTraditionSummary', 'reserveEducationTraditionAction', 'cancelEducationTraditionAction'])
    assert.equal(typeof engine[name], 'function', `New requirement not implemented: ${name}`);
});
check('reservation prepays exactly one shared study use without production or economic payment', () => {
  const source = fixture(), before = clone(source), selected = reserve(source);
  assert.equal(engine.educationTraditionSummary(source, source.party[1].id).canReserve, true);
  assert.equal(balance(source), 2); assert.equal(balance(selected), 1);
  assert.equal(selected.projectTradition.pending.kind, 'education');
  assert.equal(selected.projectTradition.pending.dueDay, source.day + 1);
  for (const field of ['inventory', 'party', 'ap', 'day', 'civics', 'research', 'founderHistory'])
    assert.deepEqual(selected[field], source[field], field);
  assert.deepEqual(source, before);
  const duplicate = reserve(selected);
  assert.deepEqual(duplicate.projectTradition, selected.projectTradition);
  assert.deepEqual(duplicate.ancestralFaith, selected.ancestralFaith);
  for (const action of [engine.reserveProjectTraditionAction, engine.reserveProcessingTraditionAction]) {
    const blocked = action(selected, source.party[1].id);
    assert.deepEqual(blocked.projectTradition, selected.projectTradition);
    assert.deepEqual(blocked.ancestralFaith, selected.ancestralFaith);
  }
});
check('real lesson keeps paper and teachers unchanged and credits CP separately from application count', () => {
  const source = fixture(), plain = morning(source), selected = reserve(source), next = morning(selected);
  const base = receipt(plain), actual = receipt(next), settled = next.projectTradition.lastSettlement;
  assert.ok(base.appliedPoints > 0); assert.equal(actual.basePoints, base.appliedPoints);
  assert.equal(actual.traditionPoints, 2); assert.equal(actual.appliedPoints, actual.basePoints + 2);
  assert.equal(actual.teachers, base.teachers); assert.deepEqual(actual.spent, base.spent);
  assert.equal(next.inventory.paper, plain.inventory.paper); assert.equal(balance(next), 1);
  assert.equal(settled.result, 'applied'); assert.equal(settled.bonusPoints, 2);
  const record = next.projectTradition.educationRecords[0];
  assert.equal(record.applications, 1); assert.equal(record.appliedPoints, 2);
  assert.equal(next.projectTradition.pending, null);
  assert.equal(morning(next).projectTradition.educationRecords[0].applications, 1);
});
check('same civic remaining room clamps bonus and base completion cannot spill into another civic', () => {
  const cost = engine.CIVIC_TREE.find(row => row.id === civicId).cost;
  for (const remaining of [4.5, 3, 0.5]) {
    const source = fixture(); source.civics.progress[civicId] = cost - remaining;
    for (const row of engine.CIVIC_TREE) if (row.id !== civicId) source.civics.completed[row.id] = true;
    const plain = morning(source), next = morning(reserve(source));
    const base = receipt(plain).appliedPoints, actual = receipt(next);
    assert.equal(actual.traditionPoints || 0, Math.min(2, Math.max(0, remaining - base)));
    if (actual.traditionPoints > 0) {
      assert.equal(next.projectTradition.educationRecords[0].applications, 1);
      assert.equal(next.projectTradition.educationRecords[0].appliedPoints, actual.traditionPoints);
      assert.equal(next.projectTradition.educationRecords[0].lastPoints, actual.traditionPoints);
      assert.deepEqual(roundTrip(next).projectTradition, next.projectTradition);
    }
    assert.equal(actual.civicId, civicId); assert.ok(actual.appliedPoints <= remaining);
    for (const id of Object.keys(next.civics.progress)) if (id !== civicId)
      assert.equal(next.civics.progress[id], plain.civics.progress[id], 'Bonus cannot transfer to the next civic');
  }
});
check('missing teachers or paper and changed plan expire without refund or rollover', () => {
  for (const mutate of [s => { s.inventory.paper = 0; }, s => { s.tribe.assignments = jobs({ forager: 6 }); },
    s => { s.tribe.educationPlan.teachers = 1; }, s => { s.civics.completed[civicId] = true; }]) {
    const selected = reserve(fixture()); mutate(selected); const next = morning(selected);
    assert.equal(next.projectTradition.pending, null); assert.equal(balance(next), 1);
    assert.equal(next.projectTradition.lastSettlement.result, 'expired');
    assert.equal(next.projectTradition.lastSettlement.bonusPoints, 0);
    assert.equal(next.projectTradition.educationRecords?.length || 0, 0);
  }
});
check('cancellation spends no second use and retains the shared daily slot', () => {
  const selected = reserve(fixture());
  const cancelled = engine.cancelEducationTraditionAction(selected, selected.party[1].id);
  assert.equal(cancelled.projectTradition.pending, null); assert.equal(balance(cancelled), 1);
  assert.equal(cancelled.projectTradition.lastReservedDay, selected.day);
  assert.equal(engine.educationTraditionSummary(cancelled, cancelled.party[1].id).canReserve, false);
  assert.equal(balance(morning(cancelled)), 1);
});
function roundTrip(source) {
  const storage = new Storage();
  assert.equal(checkpoint.writeCheckpoint(storage, 'guest', source, { expectedRevision: 0,
    savedAt: '2026-11-11T00:00:00.000Z' }).status, 'ready');
  const read = checkpoint.readCheckpoint(storage, 'guest'); assert.equal(read.status, 'ready');
  return engine.normalizeState(JSON.parse(JSON.stringify(read.checkpoint.current)));
}
check('checkpoint and JSON retain paid pending and legitimate receipts without another charge', () => {
  const selected = reserve(fixture()), restored = roundTrip(selected);
  assert.deepEqual(restored.projectTradition, selected.projectTradition);
  assert.deepEqual(restored.ancestralFaith, selected.ancestralFaith);
  const next = morning(restored), again = roundTrip(next);
  assert.deepEqual(again.projectTradition, next.projectTradition);
  assert.deepEqual(receipt(again), receipt(next));
});
check('legacy education receipts retain their exact optional-field-free shape', () => {
  const source = morning(fixture()), original = clone(receipt(source));
  assert.equal(Object.hasOwn(original, 'traditionPoints'), false);
  const restored = roundTrip(source);
  assert.deepEqual(receipt(restored), original);
  assert.equal(Object.hasOwn(restored.projectTradition, 'educationRecords'), false);
});
check('checkpoint validation rejects forged bonus evidence and cross-domain pending', () => {
  const selected = reserve(fixture()), applied = morning(selected);
  for (const mutate of [s => { s.projectTradition.pending.kind = 'processing'; },
    s => { s.projectTradition.pending.founderId = 'unearned-founder'; },
    s => { s.ancestralFaith.active.domain = 'craft'; },
    s => { s.projectTradition.pending.dueDay += 1; }]) {
    const forged = clone(selected); mutate(forged);
    assert.equal(checkpoint.isValidRunState(forged), false, 'Mixed or unpaid provenance must not become a valid saved reservation');
  }
  for (const mutate of [s => { receipt(s).traditionPoints = 3; },
    s => { receipt(s).basePoints += 1; receipt(s).traditionPoints -= 1; },
    s => { receipt(s).traditionFounderId = 'unearned-founder'; },
    s => { receipt(s).basePoints = 0; },
    s => { s.projectTradition.educationRecords[0].applications = 2; },
    s => { s.projectTradition.educationRecords[0].appliedPoints = 3; },
    s => { s.projectTradition.lastSettlement.bonusPoints = 3; }]) {
    const forged = clone(applied); mutate(forged);
    assert.equal(checkpoint.isValidRunState(forged), false, 'Credits require matching bounded real production evidence');
  }
});
check('missed morning and ended run expire paid uses while duplicate settlement remains inert', () => {
  for (const [elapsed, ended, reason] of [[2, false, 'missed_day'], [1, true, 'ended']]) {
    const selected = reserve(fixture()); selected.day += elapsed; selected.ended = ended;
    const next = tradition.settleEducationTradition(selected);
    assert.equal(next.projectTradition.pending, null); assert.equal(balance(next), 1);
    assert.equal(next.projectTradition.lastSettlement.reason, reason);
    assert.equal(next.projectTradition.lastSettlement.bonusPoints, 0);
    assert.deepEqual(tradition.settleEducationTradition(next), next);
  }
  const selected = reserve(fixture());
  assert.deepEqual(tradition.settleEducationTradition(selected), selected, 'Settlement before the due morning is inert');
  assert.deepEqual(tradition.settleProcessingTradition(selected), selected);
  assert.deepEqual(tradition.settleProjectTradition(selected), selected);
});
check('the education destination cannot accept an unpaid study use or craft-domain reservation', () => {
  const source = fixture(), actorId = source.party[0].id;
  assert.deepEqual(tradition.reserveEducationTradition(source, { civicId, teachers: 2, founderId: actorId }), source,
    'The low-level reservation must require a previously consumed use');
  const craft = clone(source); craft.ancestralFaith.active.domain = 'craft';
  assert.equal(checkpoint.isValidRunState(craft), false, 'Study-only deeds cannot authorize a craft-domain charge');
});
check('bonus eligibility requires the exact saved target, teachers, paper and positive basic lesson', () => {
  const selected = reserve(fixture()); selected.day += 1;
  const args = { civicId, teachersRequested: 2, teachers: 2, paperSpent: 2, basePoints: 4, remainingNeed: 20 };
  assert.equal(tradition.educationTraditionBonus(selected, args), 2);
  for (const edit of [{ civicId: 'DEMOCRACY' }, { teachersRequested: 1 }, { teachers: 0 },
    { paperSpent: 0 }, { basePoints: 0 }, { basePoints: -1 }, { remainingNeed: 4 }])
    assert.equal(tradition.educationTraditionBonus(selected, { ...args, ...edit }), 0);
  const settled = morning(reserve(fixture()));
  assert.deepEqual(tradition.settleEducationTradition(settled, { ...args, bonusPoints: 2, progressAfter: 6 }), settled);
});
check('reservation, cancellation and previews draw no new gameplay randomness', () => {
  const source = fixture(), original = Math.random;
  Math.random = () => { throw Error('Education reservation must not consume gameplay RNG'); };
  try {
    engine.educationTraditionSummary(source, source.party[1].id);
    const selected = reserve(source);
    engine.cancelEducationTraditionAction(selected, selected.party[1].id);
  } finally { Math.random = original; }
});
check('a later same-day cancellation preserves the previous real lesson through reload', () => {
  const applied = morning(reserve(fixture())), historic = clone(receipt(applied));
  const renewed = engine.ancestralRiteAction(applied, applied.party[1].id, applied.party[0].id);
  const selected = reserve(renewed);
  assert.equal(selected.projectTradition.pending?.kind, 'education');
  const cancelled = engine.cancelEducationTraditionAction(selected, selected.party[1].id);
  const restored = roundTrip(cancelled);
  assert.deepEqual(receipt(restored), historic);
  assert.equal(restored.projectTradition.educationRecords[0].applications, 1);
  assert.equal(restored.projectTradition.lastSettlement.reason, 'cancelled');
  const forged = clone(restored); receipt(forged).basePoints += 1; receipt(forged).traditionPoints -= 1;
  assert.equal(checkpoint.isValidRunState(forged), false, 'Cancellation cannot weaken the exact historic base/tradition split');
  const forgedRecord = clone(restored); forgedRecord.projectTradition.educationRecords[0].lastPoints = 1;
  assert.equal(checkpoint.isValidRunState(forgedRecord), false);
});
check('four consecutive real education applications preserve the earlier production during settlement', () => {
  let state = morning(reserve(fixture()));
  for (let count = 2; count <= 4; count++) {
    state = engine.ancestralRiteAction(state, state.party[1].id, state.party[0].id);
    state = morning(reserve(state));
    assert.equal(state.projectTradition.educationRecords[0].applications, count);
    assert.equal(state.projectTradition.educationRecords[0].appliedPoints, count * 2);
    assert.equal(state.projectTradition.educationRecords[0].previousDay, state.day - 1);
    assert.equal(state.projectTradition.educationRecords[0].lastPoints, 2);
    assert.equal(state.projectTradition.educationRecords[0].previousPoints, 2);
    assert.deepEqual(roundTrip(state).projectTradition, state.projectTradition);
    for (const mutate of [row => { row.previousDay = row.lastDay; },
      row => { row.applications = 1; }, row => { row.previousDay = row.firstDay - 1; },
      row => { row.previousPoints = 1; }, row => { row.lastPoints = 3; },
      ...(count > 2 ? [row => { row.previousDay = row.firstDay; }] : [])]) {
      const forged = clone(state); mutate(forged.projectTradition.educationRecords[0]);
      assert.equal(checkpoint.isValidRunState(forged), false, 'Previous-day evidence must agree with the number of actual applications');
    }
  }
});
check('reuse after two unreserved mornings records the exact prior application without inventing gap days', () => {
  let state = morning(reserve(fixture())); const firstDay = state.day;
  state = morning(morning(state));
  assert.equal(state.projectTradition.educationRecords[0].applications, 1);
  state = engine.ancestralRiteAction(state, state.party[1].id, state.party[0].id);
  state = morning(reserve(state));
  const row = state.projectTradition.educationRecords[0];
  assert.equal(row.firstDay, firstDay); assert.equal(row.previousDay, firstDay);
  assert.equal(row.lastDay, firstDay + 3); assert.equal(row.applications, 2); assert.equal(row.appliedPoints, 4);
  assert.deepEqual(roundTrip(state).projectTradition, state.projectTradition);
  const forged = clone(state); forged.projectTradition.educationRecords[0].previousDay = firstDay + 1;
  assert.equal(checkpoint.isValidRunState(forged), false);
});
check('later project reservation preserves education evidence and blocks the education destination', () => {
  let state = morning(reserve(fixture())); const historic = clone(receipt(state));
  for (let i = 0; i < 4; i++) state = recordFounderDeed(state, {
    actorId: state.party[0].id, kind: 'project', success: true, target: 'bounded-fixture' });
  state.research.completed.CORDAGE = true;
  state.tribe.assignments = jobs({ forager: 2, scholar: 3, builder: 1 });
  state = engine.ancestralRiteAction(state, state.party[1].id, state.party[0].id);
  assert.equal(state.ancestralFaith.active?.domain, 'craft');
  const project = engine.reserveProjectTraditionAction(state, state.party[1].id);
  assert.ok(project.projectTradition.pending?.projectId);
  const blocked = reserve(project);
  assert.deepEqual(blocked.projectTradition, project.projectTradition);
  assert.deepEqual(blocked.ancestralFaith, project.ancestralFaith);
  assert.deepEqual(receipt(roundTrip(project)), historic);
  assert.equal(checkpoint.isValidRunState(morning(project)), true);
});
check('corrupt current and previous education provenance blocks checkpoint rewrite and preserves bytes', () => {
  const source = morning(reserve(fixture())), storage = new Storage(), savedAt = '2026-11-11T00:00:00.000Z';
  assert.equal(checkpoint.writeCheckpoint(storage, 'guest', source, { expectedRevision: 0, savedAt }).status, 'ready');
  assert.equal(checkpoint.writeCheckpoint(storage, 'guest', source, { expectedRevision: 1, savedAt, forcePrevious: true }).status, 'ready');
  const key = checkpoint.checkpointStorageKey('guest'), healthy = storage.getItem(key);
  for (const side of ['current', 'previous']) {
    const envelope = JSON.parse(healthy); envelope[side].tribe.lastProduction.education.traditionPoints = 3;
    const corrupt = JSON.stringify(envelope); storage.setItem(key, corrupt);
    assert.equal(checkpoint.readCheckpoint(storage, 'guest').status, 'corrupt');
    assert.equal(checkpoint.writeCheckpoint(storage, 'guest', source, { expectedRevision: 2, savedAt }).status, 'corrupt');
    assert.equal(checkpoint.restorePreviousCheckpoint(storage, 'guest', { expectedRevision: 2, savedAt }).status, 'corrupt');
    assert.equal(storage.getItem(key), corrupt);
  }
});
console.log(JSON.stringify({ checks, pass: failures.length === 0, failures }));
if (failures.length) process.exitCode = 1;
