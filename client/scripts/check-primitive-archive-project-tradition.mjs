import assert from 'node:assert/strict';
import './lib/register-simulation-modules.mjs';
const engine = await import('../src/app/games/primitive-archive/_lib/primitiveArchiveEngine.js');
const tradition = await import('../src/app/games/primitive-archive/_lib/primitiveArchiveProjectTradition.js');
const checkpoint = await import('../src/app/games/primitive-archive/_lib/primitiveArchiveCheckpoint.js');
const clone = value => structuredClone(value);
const jobs = counts => Object.fromEntries(engine.TRIBE_JOBS.map(job => [job.id, counts[job.id] || 0]));
const observable = state => { const result = clone(state); delete result.log; delete result.updatedAt; return result; };
function fixture(kind = 'craft') {
  let state = engine.createNewState({ runId: `project-tradition-${kind}`, difficulty: 'easy',
    now: '2026-11-01T00:00:00.000Z', rng: () => 0.5 });
  state.camp = { ...state.camp, fireLevel: 1, shelterLevel: 3, workbenchLevel: 1, fuel: 10 };
  state.inventory = { berry: 50, wood: 30, fiber: 20, stone: 20, resin: 10 };
  state.weather = { id: 'clear', name: '검사 맑음', temp: 20, cold: 0, actionMod: 0 };
  state.tribe.assignments = jobs({ forager: 3, builder: 1 });
  state.tribe.autoAssignments = jobs({});
  state.research.completed = { ...state.research.completed, GATHERING: true, HUNTING: true,
    CORDAGE: true, SETTLEMENT: true, FOOD_STORAGE: true };
  const actorId = state.party[0].id;
  for (let index = 0; index < 3; index++) state = kind === 'craft'
    ? engine.runCampAction(state, actorId, 'fuel', { rng: () => 0.5 })
    : engine.runSafeGatherAction(state, actorId, 'wood', { rng: () => 0.5 });
  assert.equal(state.day, 1);
  assert.equal(state.ap, 2);
  state = engine.ancestralRiteAction(state, actorId, actorId);
  assert.equal(state.ancestralFaith.active?.domain, kind);
  return state;
}
function reserve(state) { return engine.reserveProjectTraditionAction(state, state.party[0].id); }
let groups = 0;
const failures = [];
function check(name, run) {
  try { run(); groups++; console.log(`PASS ${name}`); }
  catch (error) { failures.push(name); console.error(`FAIL ${name}: ${String(error.message).slice(0, 500)}`); }
}

check('new runs opt in and absent or explicit legacy fields remain disabled without past construction credit', () => {
  const state = fixture();
  assert.equal(engine.projectTraditionSummary(state).canReserve, true);
  const old = clone(state);
  delete old.projectTradition;
  const restored = engine.normalizeState(old);
  assert.equal(engine.projectTraditionSummary(restored).enabled, false);
  assert.deepEqual(restored.projectTradition.records, []);
  assert.deepEqual(restored.projects, engine.normalizeState(state).projects);
  const explicit = engine.createNewState({ lineageMode: 'legacy', rng: () => 0.5 });
  assert.equal(engine.projectTraditionSummary(explicit).enabled, false);
});

check('a real three-deed rite spends one shared craft use without AP, stamina, time, research, inventory or RNG', () => {
  const state = fixture();
  const before = clone(state);
  const random = Math.random;
  Math.random = () => { throw new Error('Reservation or summary drew gameplay RNG'); };
  let next;
  try {
    const summary = engine.projectTraditionSummary(state, state.party[0].id);
    assert.equal(summary.availableCharges, 2);
    assert.equal(summary.baseWork, 1);
    assert.equal(summary.bonusWork, 1);
    assert.match(summary.evidenceText, /캠프 관리 3회/);
    next = reserve(state);
    assert.equal(engine.projectTraditionSummary(next).canReserve, false);
    assert.deepEqual(observable(reserve(next)), observable(next));
  } finally { Math.random = random; }
  assert.deepEqual(state, before);
  assert.equal(next.ancestralFaith.active.remaining, 1);
  const expected = observable(before);
  expected.ancestralFaith.active.remaining = 1;
  expected.projectTradition.lastReservedDay = 1;
  expected.projectTradition.pending = { reservedDay: 1, dueDay: 2,
    projectId: 'drying-rack', founderId: state.party[0].id };
  assert.deepEqual(observable(next), expected);
  assert.deepEqual(next.founderHistory, before.founderHistory);
});

check('normal personal crafting and community reservation compete for the same two purchased uses', () => {
  const source = fixture();
  const personal = engine.runCraftAction(source, source.party[0].id, 'twine', { rng: () => 0.5 });
  assert.equal(personal.ancestralFaith.active.remaining, 1);
  const reserved = reserve(personal);
  assert.equal(reserved.ancestralFaith.active, null);
  assert.equal(reserved.ap, personal.ap);
  assert.match(engine.projectTraditionSummary(reserved).evidenceText, /캠프 관리 3회/);
  const next = engine.advanceDay(reserved, { rng: () => 0.5 });
  assert.equal(next.tribe.lastProduction.projectTraditionWork, 1);
});

check('a confirmed deceased founder supplies the same one work without new deeds or a death reward', () => {
  const source = fixture();
  const founderId = source.party[0].id;
  source.party[0].hp = 1;
  const dead = engine.runHuntAction(source, founderId, 'plains', { rng: () => 0.999999 });
  assert.equal(dead.party[0].hp, 0);
  const beforeHistory = clone(dead.founderHistory.members[0]);
  const actingId = dead.party[1].id;
  assert.equal(engine.projectTraditionSummary(dead, actingId).canReserve, true);
  const reserved = engine.reserveProjectTraditionAction(dead, actingId);
  assert.equal(reserved.ancestralFaith.active.remaining, 1);
  const next = engine.advanceDay(reserved, { rng: () => 0.5 });
  assert.equal(next.tribe.lastProduction.projectTraditionWork, 1);
  assert.equal(next.projectTradition.records[0].appliedWork, 1);
  assert.deepEqual(next.founderHistory.members[0], beforeHistory);
  assert.equal(next.inventory.jerky || 0, 0);
});

check('due reservations survive real day normalization and apply only to paid materials and actual builder work', () => {
  const reserved = reserve(fixture());
  const transient = engine.normalizeState({ ...clone(reserved), day: 2 });
  assert.equal(transient.ancestralFaith.active, null);
  assert.equal(transient.projectTradition.pending.dueDay, 2);
  assert.equal(checkpoint.isValidRunState(transient), true);
  const before = clone(reserved);
  const next = engine.advanceDay(reserved, { rng: () => 0.5 });
  assert.deepEqual(reserved, before);
  assert.equal(next.projects.progress['drying-rack'], 2);
  assert.equal(next.projects.resourceCommitted['drying-rack'], true);
  assert.equal(next.tribe.lastProduction.projectBaseWork, 1);
  assert.equal(next.tribe.lastProduction.projectTraditionWork, 1);
  assert.equal(next.tribe.lastProduction.projectWork, 2);
  assert.equal(next.inventory.wood, before.inventory.wood + next.tribe.lastProduction.gains.wood - 3);
  assert.equal(next.inventory.fiber, before.inventory.fiber + next.tribe.lastProduction.gains.fiber - 2);
  assert.deepEqual(next.founderHistory.members[0].tallies, before.founderHistory.members[0].tallies);
  assert.deepEqual(next.projectTradition.records, [{ projectId: 'drying-rack', founderId: before.party[0].id,
    appliedWork: 1, firstDay: 2, lastDay: 2, completedDay: 0 }]);
  assert.equal(next.projectTradition.pending, null);
  assert.equal(next.projectTradition.lastSettlement.result, 'applied');
  assert.equal(checkpoint.isValidRunState(next), true);
  const again = engine.advanceDay(next, { rng: () => 0.5 });
  assert.equal(again.tribe.lastProduction.projectTraditionWork, 0);
  assert.deepEqual(again.projectTradition.records, next.projectTradition.records);
  assert.deepEqual(again.projectTradition.lastSettlement, next.projectTradition.lastSettlement);
});

check('ineligible actions retain all gameplay state and draw no RNG', () => {
  const good = fixture();
  const cases = [
    state => { state.ended = true; },
    state => { state.ap = 0; },
    state => { state.tribe.assignments = jobs({ forager: 4 }); },
    state => { state.inventory.wood = 0; state.inventory.fiber = 0; },
    state => { state.projects.selectedProjectId = ''; },
    state => { state.projects.selectedProjectId = 'palisade'; },
    state => { state.projects.completed['drying-rack'] = true; state.projects.progress['drying-rack'] = 5; },
    state => { state.projects.progress['drying-rack'] = 4; },
    state => { state.ancestralFaith.active = null; },
  ];
  const invalid = cases.map(mutate => { const state = clone(good); mutate(state); return state; });
  invalid.push(fixture('gather'));
  const dead = engine.runHuntAction({ ...clone(good), party: good.party.map((row, index) =>
    index ? { ...row } : { ...row, hp: 1 }) }, good.party[0].id, 'plains', { rng: () => 0.999999 });
  invalid.push(dead);
  const random = Math.random;
  Math.random = () => { throw new Error('Ineligible reservation drew RNG'); };
  try {
    for (const state of invalid) {
      const before = observable(state);
      assert.equal(engine.projectTraditionSummary(state, state.party[0].id).canReserve, false);
      assert.deepEqual(observable(reserve(state)), before);
    }
    assert.deepEqual(observable(engine.reserveProjectTraditionAction(good, 'missing')), observable(good));
  } finally { Math.random = random; }
});

check('changing selection expires the original reservation instead of transferring it or allowing another bet', () => {
  let state = reserve(fixture());
  state.research.completed.CARTOGRAPHY = true;
  state = engine.selectProjectAction(state, 'trail-markers');
  const charges = state.ancestralFaith.active.remaining;
  assert.equal(engine.projectTraditionSummary(state).canReserve, false);
  assert.equal(reserve(state).ancestralFaith.active.remaining, charges);
  const next = engine.advanceDay(state, { rng: () => 0.5 });
  assert.equal(next.projectTradition.pending, null);
  assert.equal(next.projectTradition.lastSettlement.reason, 'target_changed');
  assert.equal(next.projectTradition.lastSettlement.reservedProjectId, 'drying-rack');
  assert.equal(next.projectTradition.lastSettlement.projectId, 'trail-markers');
  assert.equal(next.projects.progress['trail-markers'], 1);
  assert.equal(next.tribe.lastProduction.projectTraditionWork, 0);
  assert.deepEqual(next.projectTradition.records, []);
});

check('missing materials, removed builders and unavailable prerequisites expire once with precise receipts', () => {
  for (const [reason, mutate] of [
    ['materials', state => { state.inventory.wood = 0; state.inventory.fiber = 0; }],
    ['no_builders', state => { state.tribe.assignments = jobs({ forager: 4 }); }],
    ['locked', state => { state.research.completed.GATHERING = false; }],
  ]) {
    const state = reserve(fixture());
    mutate(state);
    const next = engine.advanceDay(state, { rng: () => 0.5 });
    assert.equal(next.projectTradition.lastSettlement.reason, reason);
    assert.equal(next.projectTradition.lastSettlement.bonusWork, 0);
    assert.equal(next.projectTradition.pending, null);
    assert.deepEqual(next.projectTradition.records, []);
    assert.equal(checkpoint.isValidRunState(next), true);
  }
});

check('later manual completion preserves only actual prior tradition work and grants the old reward once', () => {
  const applied = engine.advanceDay(reserve(fixture()), { rng: () => 0.5 });
  const id = applied.party[0].id;
  const completed = engine.runProjectAction(applied, id, 'drying-rack', { rng: () => 0.5 });
  assert.equal(completed.projects.completed['drying-rack'], true);
  assert.equal(completed.inventory.jerky, 1);
  assert.equal(completed.projectTradition.records[0].appliedWork, 1);
  assert.equal(completed.projectTradition.records[0].completedDay, completed.day);
  assert.equal(engine.projectTraditionSummary(completed).records[0].completedDay, completed.day);
  assert.deepEqual(observable(engine.runProjectAction(completed, id, 'drying-rack')), observable(completed));
  assert.equal(checkpoint.isValidRunState(completed), true);
});

check('separate daily reservations accumulate only applied work in one bounded founder-project record', () => {
  let state = engine.advanceDay(reserve(fixture()), { rng: () => 0.5 });
  state = engine.ancestralRiteAction(state, state.party[0].id, state.party[0].id);
  state = reserve(state);
  state = engine.advanceDay(state, { rng: () => 0.5 });
  assert.equal(state.projects.progress['drying-rack'], 4);
  assert.deepEqual(state.projectTradition.records, [{ projectId: 'drying-rack', founderId: state.party[0].id,
    appliedWork: 2, firstDay: 2, lastDay: 3, completedDay: 0 }]);
  assert.equal(state.projectTradition.lastSettlement.day, 3);
  assert.equal(checkpoint.isValidRunState(state), true);
  assert.deepEqual(engine.normalizeState(clone(state)).projectTradition, state.projectTradition);
});

check('a bonus can complete the project in the same morning without breaking transient record validation', () => {
  let state = fixture();
  state = engine.runProjectAction(state, state.party[0].id, 'drying-rack', { rng: () => 0.5 });
  assert.equal(state.projects.progress['drying-rack'], 3);
  assert.equal(engine.projectTraditionSummary(state).canReserve, true);
  const next = engine.advanceDay(reserve(state), { rng: () => 0.5 });
  assert.equal(next.projects.progress['drying-rack'], 5);
  assert.equal(next.projectTradition.records[0].completedDay, next.day);
  assert.equal(next.projectTradition.lastSettlement.bonusWork, 1);
  assert.equal(next.inventory.jerky, 1);
  assert.equal(checkpoint.isValidRunState(next), true);
});

check('base work filling the remaining room expires the bonus and does not credit a founder', () => {
  let state = reserve(fixture());
  state = engine.runProjectAction(state, state.party[0].id, 'drying-rack', { rng: () => 0.5 });
  state = engine.adjustTribeJobAction(engine.adjustTribeJobAction(state, 'forager', -1), 'builder', 1);
  const next = engine.advanceDay(state, { rng: () => 0.5 });
  assert.equal(next.projectTradition.lastSettlement.reason, 'no_room');
  assert.equal(next.projectTradition.lastSettlement.baseWork, 2);
  assert.equal(next.tribe.lastProduction.projectWork, 2);
  assert.equal(next.tribe.lastProduction.projectTraditionWork, 0);
  assert.deepEqual(next.projectTradition.records, []);
  assert.equal(next.projects.progress['drying-rack'], 5);
});

check('ended runs retain an inert pending notice without inventing a future settlement receipt', () => {
  const reserved = reserve(fixture());
  const ended = engine.settleRunAction(reserved);
  const before = clone(ended);
  const result = engine.projectTraditionSummary(ended);
  assert.equal(result.canReserve, false);
  assert.match(result.pendingText, /런 종료로 추가 작업은 실행되지 않습니다/);
  assert.equal(result.lastSettlement, null);
  assert.equal(tradition.projectTraditionBonus({ ...ended, day: 2 }, {
    projectId: 'drying-rack', baseWork: 1, progressBefore: 0, work: 5 }), 0);
  assert.deepEqual(engine.advanceDay(ended), before);
});

console.log(`Project tradition engine: ${groups} focused groups passed.`);
if (failures.length) process.exitCode = 1;
