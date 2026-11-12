import assert from 'node:assert/strict';
import './lib/register-simulation-modules.mjs';

const calendar = await import('../src/app/games/primitive-archive/_lib/primitiveArchiveCalendar.js');
const lineage = await import('../src/app/games/primitive-archive/_lib/primitiveArchiveLineage.js');
const checkpoint = await import('../src/app/games/primitive-archive/_lib/primitiveArchiveCheckpoint.js');
const engine = await import('../src/app/games/primitive-archive/_lib/primitiveArchiveEngine.js');
let passed = 0;
const failures = [];
function check(name, run) {
  try { run(); passed += 1; console.log(`PASS ${name}`); }
  catch (error) { failures.push({ name, message: error.message }); console.error(`FAIL ${name}: ${error.stack || error.message}`); }
}
function fresh(id = 'annual-calendar') {
  const state = engine.createNewState({ runId: id, now: '2026-11-12T00:00:00.000Z', rng: () => 0.5 });
  state.day = 40;
  Object.assign(state.research.completed, { SETTLEMENT: true, FOOD_STORAGE: true });
  state.camp.shelterLevel = 1;
  state.inventory.berry = 10;
  return state;
}
function annual(id, lifetime = 60) {
  const state = fresh(id);
  state.calendar = calendar.createAnnualCalendar(state, { observedLifetimeYears: lifetime });
  return state;
}
// These are focused calendar/lineage boundaries, without pretending to execute
// an economic year. The annual-operation test owns the complete engine route.
function clockBoundary(state, applyLineage = true, paid = true) {
  const next = { ...state, day: state.day + 1, calendar: calendar.advanceAnnualCalendar(state) };
  if (applyLineage) {
    // A declared receipt fixture isolates lineage's paid-supply contract. The
    // full annual-operation check, not this focused helper, executes production.
    const need = next.calendar.lastCensus.foodNeed;
    next.tribe = { ...next.tribe, lastProduction: { ...next.tribe.lastProduction, day: next.day,
      foodNeed: need, foodProvided: paid ? need : 0, shortage: paid ? 0 : need,
      foodSpent: paid ? { berry: need } : {} } };
  }
  return applyLineage ? lineage.tickLineageYear(next) : next;
}
function years(state, count, paid = true) {
  for (let index = 0; index < count; index += 1) state = clockBoundary(state, true, paid);
  return state;
}
const memoryStorage = () => {
  const values = new Map();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)) };
};

check('missing calendar stays daily across normalize, queries and checkpoint roundtrip', () => {
  const input = fresh('calendar-missing');
  const before = structuredClone(input);
  assert.equal(calendar.isAnnualMode(input), false);
  assert.equal(calendar.isValidAnnualCalendar(undefined, input), true);
  assert.equal(calendar.syncAnnualCalendarPeople(input), input);
  assert.equal(calendar.annualCalendarSummary(input).enabled, false);
  assert.equal(Object.hasOwn(engine.normalizeState(input), 'calendar'), false);
  assert.deepEqual(input, before);
  const storage = memoryStorage();
  assert.equal(checkpoint.writeCheckpoint(storage, 'guest', input, { expectedRevision: 0 }).status, 'ready');
  assert.equal(Object.hasOwn(checkpoint.readCheckpoint(storage, 'guest').checkpoint.current, 'calendar'), false);
});

check('creation observes living people only without modifying historical records or ticking', () => {
  const state = fresh('calendar-create');
  const before = structuredClone(state);
  const raw = calendar.createAnnualCalendar(state);
  assert.deepEqual(state, before);
  assert.equal(raw.completedYears, 0); assert.equal(raw.startedDay, 40); assert.equal(raw.lastSettledDay, 40);
  assert.equal(raw.observedLifetimeYears, 60); assert.equal(raw.lastCensus, null);
  assert.equal(raw.people.length, state.party.length);
  assert.ok(raw.people.every(person => person.observedFromYear === 0 && person.serviceFromYear === 0));
  assert.equal(calendar.isValidAnnualCalendar(raw, state), true);
  assert.throws(() => calendar.createAnnualCalendar({ ...state, calendar: null }));
  assert.throws(() => calendar.createAnnualCalendar(state, { observedLifetimeYears: 61 }));
});

check('strict optional schema rejects malformed time, lifetime, identity, census and periods', () => {
  const state = annual('calendar-invalid');
  const mutations = [
    raw => { raw.runId = 'other-run'; }, raw => { raw.startedDay = '40'; },
    raw => { raw.completedYears = 1; }, raw => { raw.lastSettledDay = 41; },
    raw => { raw.observedLifetimeYears = 0; }, raw => { raw.observedLifetimeYears = '60'; },
    raw => { raw.extra = true; }, raw => { raw.people.push({ ...raw.people[0] }); },
    raw => { raw.people[0].actorId = 'unknown'; }, raw => { raw.people[0].observedFromYear = 1; },
    raw => { raw.people[0].serviceFromYear = -1; }, raw => { raw.people[0].serviceUntilYear = 1; },
    raw => { raw.people[0].serviceFromYear = null; raw.people[0].serviceUntilYear = 0; },
    raw => { raw.lastCensus = { workers: 4, prepared: 0, retired: 0, active: 3, total: 7, foodNeed: 2 }; },
    raw => { raw.people.pop(); }, raw => { raw.people[0].observedFromYear = Number.MAX_SAFE_INTEGER + 1; },
  ];
  for (const mutate of mutations) {
    const raw = structuredClone(state.calendar); mutate(raw);
    assert.equal(calendar.isValidAnnualCalendar(raw, state), false);
    assert.equal(checkpoint.isValidRunState({ ...state, calendar: raw }), false);
  }
  for (const raw of [null, false, [], {}, 'annual']) assert.equal(calendar.isValidAnnualCalendar(raw, state), false);
  assert.equal(checkpoint.isValidRunState({ ...state, calendar: null }), false);
  assert.equal(checkpoint.isValidRunState({ ...state, calendar: undefined }), false);
});

check('advance captures pre-update census; receipt summary requires actual matching day only', () => {
  const input = annual('calendar-census');
  const before = structuredClone(input);
  const next = clockBoundary(input, false);
  assert.deepEqual(input, before);
  assert.deepEqual(next.calendar.lastCensus, { workers: 4, prepared: 0, retired: 0, active: 3, total: 7, foodNeed: 2 });
  next.tribe = { ...next.tribe, population: 5 };
  assert.equal(calendar.isValidAnnualCalendar(next.calendar, next), true);
  assert.equal(calendar.annualCalendarSummary(next).receiptRecorded, false);
  next.tribe.lastProduction = { ...next.tribe.lastProduction, day: next.day };
  const summary = calendar.annualCalendarSummary(next);
  assert.equal(summary.year, 2); assert.equal(summary.receiptYear, 1);
  assert.equal(summary.receipt, next.tribe.lastProduction);
  assert.equal(summary.census.workers, 5); assert.equal(summary.lastCensus.workers, 4);
  const bad = structuredClone(next); bad.calendar.lastCensus.foodNeed = 99;
  assert.equal(calendar.isValidAnnualCalendar(bad.calendar, bad), false);
});

check('prepare and retirement preserve total census, real workers, IDs and equipment ownership', () => {
  const input = annual('calendar-prepare');
  const total = calendar.annualCensus(input);
  const actorId = input.party[0].id;
  const equipment = structuredClone(input.equipment[actorId]);
  const prepared = lineage.prepareLineageSuccessor(input, actorId);
  assert.equal(prepared.ok, true);
  assert.equal(prepared.state.tribe.population, input.tribe.population - 1);
  assert.equal(calendar.annualCensus(prepared.state).total, total.total);
  assert.equal(calendar.annualCensus(prepared.state).prepared, 1);
  const heirId = prepared.state.lineage.prepared[0].actor.id;
  assert.equal(calendar.annualPersonSummary(prepared.state, heirId).serviceYears, null);
  const retired = lineage.retireLineageActor(prepared.state, actorId);
  assert.equal(retired.ok, true);
  assert.equal(calendar.annualCensus(retired.state).total, total.total);
  assert.equal(calendar.annualCensus(retired.state).prepared, 0);
  assert.equal(calendar.annualCensus(retired.state).retired, 1);
  assert.equal(retired.state.equipment[actorId], undefined);
  assert.deepEqual(retired.state.equipment[heirId], equipment);
  assert.equal(calendar.annualPersonSummary(retired.state, actorId).serviceEnded, true);
  assert.equal(calendar.annualPersonSummary(retired.state, heirId).serviceYears, 0);
  assert.equal(checkpoint.isValidRunState(retired.state), true);
});

check('annual census defensively counts duplicated person IDs only once', () => {
  const state = annual('calendar-dedupe');
  const actor = state.party[0];
  state.lineage.prepared.push({ actor });
  state.lineage.members.push({ actorId: actor.id, stage: 'retired', retiredSnapshot: actor });
  assert.deepEqual(calendar.annualCensus(state), { workers: 4, prepared: 0, retired: 0, active: 3, total: 7, foodNeed: 2 });
});

check('old cycle23 retired person survives annual year1 with cycle/day tick/history frozen', () => {
  let state = fresh('calendar-old-cycle');
  state.lineage.communityStartedDay = 1;
  state.lineage.members = state.lineage.members.map(member => ({ ...member, cycle: 23, stage: 'elder' }));
  const actorId = state.party[0].id;
  state = lineage.prepareLineageSuccessor(state, actorId).state;
  state = lineage.retireLineageActor(state, actorId).state;
  const history = structuredClone(state.founderHistory);
  const cycles = state.lineage.members.map(member => [member.actorId, member.cycle]);
  const dailyTick = state.lineage.lastTickDay;
  state.calendar = calendar.createAnnualCalendar(state);
  assert.equal(lineage.tickLineageDay(state), state);
  state = clockBoundary(state);
  assert.deepEqual(state.lineage.members.map(member => [member.actorId, member.cycle]), cycles);
  assert.equal(state.lineage.lastTickDay, dailyTick);
  const retired = state.lineage.members.find(member => member.actorId === actorId);
  assert.equal(retired.stage, 'retired'); assert.equal(retired.retiredSnapshot.hp, 100);
  assert.deepEqual(state.founderHistory, history);
  assert.equal(lineage.tickLineageYear(state), state, 'duplicate completed year is a no-op');
  assert.equal(checkpoint.isValidRunState(state), true);
});

check('the same historical daily cycle23 still reaches the existing natural end at cycle24', () => {
  const input = fresh('calendar-daily-cycle');
  input.lineage.communityStartedDay = 1;
  input.lineage.members = input.lineage.members.map(member => ({ ...member, cycle: 23, stage: 'elder' }));
  const next = lineage.tickLineageDay({ ...input, day: input.day + 1 });
  assert.equal(Object.hasOwn(next, 'calendar'), false);
  assert.equal(next.ended, true);
  assert.ok(next.lineage.members.every(member => member.cycle === 24 && member.stage === 'deceased'));
  assert.ok(next.founderHistory.members.every(member => member.deathRecord.reason === '게임 생애주기 종료'));
  assert.equal(checkpoint.isValidRunState(next), true);
});

check('activity20 warns; activity25 hands over once while preserving observed history', () => {
  let state = annual('calendar-25');
  const actorId = state.party[0].id;
  state = lineage.prepareLineageSuccessor(state, actorId).state;
  const heirId = state.lineage.prepared[0].actor.id;
  state = years(state, 19);
  assert.equal(lineage.lineageSummary(state).rows.find(row => row.actorId === actorId).warning, false);
  state = clockBoundary(state);
  assert.equal(lineage.lineageSummary(state).rows.find(row => row.actorId === actorId).warning, true);
  state = years(state, 4);
  assert.ok(state.party.some(actor => actor.id === actorId));
  state = clockBoundary(state);
  assert.ok(state.party.some(actor => actor.id === heirId));
  const prior = state.lineage.members.find(member => member.actorId === actorId);
  assert.equal(prior.stage, 'retired'); assert.equal(prior.retiredSnapshot.hp, 100); assert.equal(prior.deathRecord, null);
  assert.equal(calendar.annualPersonSummary(state, actorId).serviceYears, 25);
  assert.equal(calendar.annualPersonSummary(state, heirId).serviceYears, 0);
  assert.equal(calendar.annualPersonSummary(state, heirId).observedYears, 25);
  assert.equal(lineage.tickLineageYear(state), state);
  assert.equal(checkpoint.isValidRunState(state), true);
});

check('year25 handover accepts current paid rations at zero stock and rejects shortage/stale receipt', () => {
  for (const kind of ['paid', 'shortage', 'stale']) {
    let state = annual(`calendar-supply-${kind}`);
    const actorId = state.party[0].id;
    state = lineage.prepareLineageSuccessor(state, actorId).state;
    const heirId = state.lineage.prepared[0].actor.id;
    state = years(state, 24);
    state.inventory = {};
    state = clockBoundary(state, false);
    const need = state.calendar.lastCensus.foodNeed;
    state.tribe = { ...state.tribe, lastProduction: { ...state.tribe.lastProduction,
      day: kind === 'stale' ? state.day - 1 : state.day, foodNeed: need,
      foodProvided: kind === 'shortage' ? need - 1 : need, shortage: kind === 'shortage' ? 1 : 0,
      foodSpent: { berry: kind === 'shortage' ? need - 1 : need } } };
    const next = lineage.tickLineageYear(state);
    assert.equal(next.party.some(actor => actor.id === heirId), kind === 'paid', kind);
    assert.equal(next.lineage.members.find(member => member.actorId === actorId).stage, kind === 'paid' ? 'retired' : 'active', kind);
    assert.equal(checkpoint.isValidRunState(next), true);
  }
});

for (const lifetime of [60, 80, null]) check(`observed lifetime ${String(lifetime)} is independent of service/daily cycles`, () => {
  let state = annual(`calendar-lifetime-${lifetime}`, lifetime);
  const actorId = state.party[0].id;
  state = lineage.prepareLineageSuccessor(state, actorId).state;
  state = lineage.retireLineageActor(state, actorId).state;
  const count = lifetime ?? 81;
  state = years(state, count - 1);
  assert.equal(state.lineage.members.find(member => member.actorId === actorId).stage, 'retired');
  state = clockBoundary(state);
  const member = state.lineage.members.find(row => row.actorId === actorId);
  assert.equal(member.stage, lifetime === null ? 'retired' : 'deceased');
  if (lifetime !== null) {
    assert.equal(member.deathRecord.reason, '정착 후 관찰 생애 종료');
    assert.equal(member.deathRecord.source, 'natural');
    assert.equal(state.founderHistory.members.find(row => row.actorId === actorId).deathRecord.reason, member.deathRecord.reason);
  }
  assert.equal(lineage.tickLineageYear(state), state);
  assert.equal(checkpoint.isValidRunState(state), true);
});

check('actual natural death freezes observed years through ten later years and is recorded once', () => {
  let state = years(annual('calendar-posthumous'), 30);
  const actorId = state.party[0].id;
  state = lineage.prepareLineageSuccessor(state, actorId).state;
  state = years(state, 30);
  const death = structuredClone(state.founderHistory.members.find(row => row.actorId === actorId).deathRecord);
  assert.equal(death.reason, '정착 후 관찰 생애 종료');
  assert.equal(calendar.annualPersonSummary(state, actorId).observedYears, 60);
  assert.equal(state.ended, false, 'later-observed heir remains alive');
  state = years(state, 10);
  assert.equal(calendar.annualPersonSummary(state, actorId).observedYears, 60);
  assert.deepEqual(state.founderHistory.members.find(row => row.actorId === actorId).deathRecord, death);
  assert.equal(state.lineage.transitions.filter(row => row.kind === 'death' && row.actorId === actorId).length, 1);
  assert.equal(checkpoint.isValidRunState(state), true);
});

check('prepared people reaching their observed lifetime become real preserved death records', () => {
  let state = annual('calendar-prepared-death');
  const actorId = state.party[0].id;
  state = lineage.prepareLineageSuccessor(state, actorId).state;
  const heirId = state.lineage.prepared[0].actor.id;
  // Keep the paid heir prepared by temporarily removing the stock required by
  // the existing handover contract. This isolates its actual observed lifetime.
  state.inventory = {};
  state = years(state, 60, false);
  assert.equal(state.lineage.prepared.some(row => row.actor.id === heirId), false);
  const member = state.lineage.members.find(row => row.actorId === heirId);
  assert.equal(member.stage, 'deceased'); assert.equal(member.retiredSnapshot.hp, 0);
  assert.equal(member.deathRecord.reason, '정착 후 관찰 생애 종료');
  assert.equal(state.founderHistory.members.find(row => row.actorId === heirId).deathRecord.reason, member.deathRecord.reason);
  assert.equal(calendar.annualPersonSummary(state, heirId).observedYears, 60);
  assert.equal(checkpoint.isValidRunState(state), true);
});

check('actual arrival and death sync registry; old unobserved death is not registered', () => {
  let state = annual('calendar-arrival', null);
  const actor = { ...structuredClone(state.party[0]), id: 'new-observed-actor' };
  state = lineage.observeLineageArrival({ ...state, party: [...state.party, actor] }, actor);
  assert.equal(calendar.annualPersonSummary(state, actor.id).observed, true);
  const death = { day: state.day, source: 'action', reason: 'confirmed controlled action', hpBefore: 100,
    damage: 100, hungerDamage: 0, coldDamage: 0, hypothermiaDamage: 0 };
  state = lineage.observeLineageDeaths({ ...state, party: state.party.map(row => row.id === actor.id ? { ...row, hp: 0, deathRecord: death } : row) });
  assert.equal(calendar.annualPersonSummary(state, actor.id).observed, true, 'registered death remains in registry');
  assert.equal(calendar.annualPersonSummary(state, actor.id).serviceEnded, true);
  const legacy = fresh('calendar-old-death');
  const victim = legacy.party[0];
  legacy.party[0] = { ...victim, hp: 0, deathRecord: { ...death, day: legacy.day - 1 } };
  legacy.lineage = lineage.observeLineageDeaths(legacy).lineage;
  legacy.calendar = calendar.createAnnualCalendar(legacy);
  assert.equal(calendar.annualPersonSummary(legacy, victim.id).observed, false);
  const forged = structuredClone(legacy.calendar);
  forged.people.push({ actorId: victim.id, observedFromYear: 0, serviceFromYear: 0, serviceUntilYear: 0 });
  assert.equal(calendar.isValidAnnualCalendar(forged, legacy), false, 'pre-transition death cannot acquire a new observation anchor');
});

check('legacy lineage remains legacy; daily new-field guard rejects nonzero orphan ticks', () => {
  let state = engine.createNewState({ runId: 'calendar-legacy', lineageMode: 'legacy', rng: () => 0.5 });
  state.calendar = calendar.createAnnualCalendar(state);
  state = years(state, 60);
  assert.equal(state.lineage.mode, 'legacy'); assert.deepEqual(state.lineage.members, []);
  assert.equal(Object.hasOwn(state.lineage, 'lastAnnualTickYear'), false);
  assert.ok(state.party.every(actor => actor.hp === 100));
  assert.equal(checkpoint.isValidRunState(state), true);
  const daily = fresh('calendar-orphan');
  daily.lineage.lastAnnualTickYear = 0;
  assert.equal(checkpoint.isValidRunState(daily), true);
  for (const value of [1, -1, NaN, '0', undefined]) {
    daily.lineage.lastAnnualTickYear = value;
    assert.equal(checkpoint.isValidRunState(daily), false);
  }
});

check('checkpoint binds each run independently, preserves same-run previous and rejects corruption', () => {
  const storage = memoryStorage();
  const first = years(annual('calendar-checkpoint'), 1);
  const saved = checkpoint.writeCheckpoint(storage, 'guest', first, { expectedRevision: 0 });
  assert.equal(saved.status, 'ready');
  const second = years(first, 1);
  assert.equal(checkpoint.writeCheckpoint(storage, 'guest', second, { expectedRevision: saved.revision, forcePrevious: true }).status, 'ready');
  const read = checkpoint.readCheckpoint(storage, 'guest');
  assert.deepEqual(read.checkpoint.current.calendar, second.calendar);
  assert.deepEqual(read.checkpoint.previous.calendar, first.calendar);
  assert.equal(read.checkpoint.current.lineage.lastAnnualTickYear, 2);
  const restored = checkpoint.restorePreviousCheckpoint(storage, 'guest', { expectedRevision: read.revision });
  assert.equal(restored.status, 'ready'); assert.deepEqual(restored.checkpoint.current.calendar, first.calendar);
  const before = storage.getItem(checkpoint.checkpointStorageKey('guest'));
  const bad = structuredClone(second); bad.calendar.runId = 'other';
  assert.equal(checkpoint.writeCheckpoint(storage, 'guest', bad, { expectedRevision: restored.revision }).status, 'invalid-state');
  assert.equal(storage.getItem(checkpoint.checkpointStorageKey('guest')), before);
  for (const slot of ['current', 'previous']) {
    const isolated = memoryStorage();
    const envelope = JSON.parse(before); envelope[slot].calendar.runId = 'foreign-run';
    const corrupt = JSON.stringify(envelope);
    isolated.setItem(checkpoint.checkpointStorageKey('guest'), corrupt);
    assert.equal(checkpoint.readCheckpoint(isolated, 'guest').status, 'corrupt', `${slot} run binding is checked`);
    assert.equal(checkpoint.writeCheckpoint(isolated, 'guest', second, { expectedRevision: restored.revision }).status, 'corrupt');
    assert.equal(isolated.getItem(checkpoint.checkpointStorageKey('guest')), corrupt, 'failed load/write preserves original corrupt bytes');
  }
});

console.log(`RESULT ${passed}/${passed + failures.length} passed; ${failures.length} failed; focused fresh calendar/lineage/checkpoint boundaries only`);
if (failures.length) process.exitCode = 1;
