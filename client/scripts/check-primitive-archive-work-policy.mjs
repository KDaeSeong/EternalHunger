import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import './lib/register-simulation-modules.mjs';
const engine = await import('../src/app/games/primitive-archive/_lib/primitiveArchiveEngine.js');
const data = await import('../src/app/games/primitive-archive/_lib/primitiveArchiveData.js');
const clone = value => structuredClone(value);
const jobs = values => Object.fromEntries(engine.TRIBE_JOBS.map(job => [job.id, values[job.id] || 0]));
const observable = state => { const result = clone(state); delete result.log; delete result.updatedAt; return result; };
function fixture(mode = 'surplus', unlocked = true) {
  const state = engine.createNewState({ runId: 'work-policy-baseline-' + mode,
    now: '2026-11-02T00:00:00.000Z', rng: () => 0.5 });
  state.camp = { ...state.camp, fireLevel: 1, shelterLevel: 3, workbenchLevel: 1, fuel: 10 };
  state.weather = { id: 'clear', name: '검사 맑음', cold: 0, temp: 20, actionMod: 0 };
  state.inventory = { berry: mode === 'scarce' ? 0 : 100, wood: 30, fiber: 20, stone: 20 };
  state.tribe.population = 6;
  state.tribe.assignments = jobs(mode === 'manual' ? { forager: 3, builder: 1, scholar: 2 } : {});
  state.tribe.autoAssignments = jobs({});
  state.research.completed = { ...state.research.completed, GATHERING: true, HUNTING: true, SETTLEMENT: true,
    FOOD_STORAGE: true, WRITING: true, ...(unlocked ? { STATE_WORKFORCE: true } : {}) };
  if (unlocked) state.civics.completed.STATE_WORKFORCE = true;
  state.research.selectedTechId = 'STONE_TOOLS';
  return state;
}
function nextMorning(state) { return engine.advanceDay(state, { rng: () => 0.5 }); }
const policy = (state, id) => engine.changeTribeWorkPolicyAction(state, id);
const freeze = value => { if (value && typeof value === 'object' && !Object.isFrozen(value)) {
  Object.freeze(value); Object.values(value).forEach(freeze);
} return value; };
let checks = 0;
const failures = [];
function check(name, run) {
  try { run(); checks++; console.log(`PASS ${name}`); }
  catch (error) { failures.push(name); console.error(`FAIL ${name}: ${String(error.message).slice(0, 700)}`); }
}

check('the actual State Workforce civic completion unlocks choices while unfinished and conflicting legacy flags do not', () => {
  const state = fixture('surplus', false);
  assert.ok(engine.CIVIC_TREE.some(civic => civic.id === 'STATE_WORKFORCE'));
  assert.ok(!engine.TECHNOLOGY_TREE.some(tech => tech.id === 'STATE_WORKFORCE'));
  assert.equal(engine.tribeSummary(state).workPolicy.unlocked, false);
  const civic = engine.CIVIC_TREE.find(row => row.id === 'STATE_WORKFORCE');
  state.civics.selectedCivicId = civic.id;
  state.civics.progress[civic.id] = civic.cost - 1;
  assert.equal(engine.tribeSummary(state).workPolicy.unlocked, false);
  const completed = engine.runCivicAction(state, state.party[0].id, { rng: () => 0.5 });
  assert.equal(completed.civics.completed.STATE_WORKFORCE, true);
  assert.equal(completed.research.completed.STATE_WORKFORCE, true);
  assert.equal(engine.tribeSummary(completed).workPolicy.unlocked, true);
  const legacy = fixture('surplus', false);
  legacy.research.completed.STATE_WORKFORCE = true;
  assert.equal(engine.tribeSummary(legacy).workPolicy.unlocked, true);
  legacy.civics.completed.STATE_WORKFORCE = false;
  assert.equal(engine.tribeSummary(legacy).workPolicy.unlocked, false);
});

check('a policy setting changes only the selected field and normal log metadata without RNG, costs or immediate work', () => {
  const state = fixture(); state.ap = 0;
  state.party[0] = { ...state.party[0], hp: 1, stamina: 0, hunger: 85 };
  const before = clone(state);
  freeze(state);
  const random = Math.random;
  Math.random = () => { throw new Error('Policy setting drew randomness'); };
  let selected;
  try { selected = policy(state, 'construction'); }
  finally { Math.random = random; }
  const expected = observable(before); expected.tribe.workPolicy = 'construction';
  assert.deepEqual(observable(selected), expected);
  assert.deepEqual(state, before);
  assert.equal(selected.day, state.day);
  assert.deepEqual(selected.founderHistory, state.founderHistory);
  assert.deepEqual(selected.meta, state.meta);
});

check('invalid, locked, repeated and ended changes preserve all gameplay state and draw no RNG', () => {
  const ready = fixture(), locked = fixture('surplus', false), ended = { ...fixture(), ended: true };
  const random = Math.random;
  Math.random = () => { throw new Error('Rejected policy setting drew randomness'); };
  try {
    for (const [state, id] of [[ready, 'balanced'], [ready, 'missing'], [ready, null], [ready, undefined],
      [locked, 'construction'], [locked, 'research'], [ended, 'construction']]) {
      assert.deepEqual(observable(policy(state, id)), observable(state));
    }
  } finally { Math.random = random; }
});

check('safe representative mornings actually trade construction and research using the same six workers', () => {
  const source = fixture(); const before = clone(source);
  const results = Object.fromEntries(['balanced', 'construction', 'research'].map(id => [id,
    nextMorning(id === 'balanced' ? source : policy(source, id))]));
  assert.equal(results.balanced.tribe.lastProduction.projectWork, 2);
  assert.equal(results.balanced.tribe.lastProduction.researchPoints, 1);
  assert.equal(results.construction.tribe.assignments.builder, 5);
  assert.equal(results.construction.tribe.lastProduction.projectWork, 5);
  assert.equal(results.construction.tribe.lastProduction.researchPoints, 0);
  assert.equal(results.construction.projects.completed['drying-rack'], true);
  assert.equal(results.construction.inventory.jerky, 1);
  assert.equal(results.research.tribe.assignments.scholar, 6);
  assert.equal(results.research.tribe.lastProduction.projectWork, 0);
  assert.equal(results.research.tribe.lastProduction.researchPoints, 6);
  for (const [id, result] of Object.entries(results)) {
    assert.equal(Object.values(result.tribe.assignments).reduce((sum, count) => sum + count, 0), 6);
    assert.equal(result.tribe.lastProduction.workPolicy, id);
    assert.deepEqual(result.tribe.lastProduction.assignments, result.tribe.assignments);
    assert.equal(result.tribe.lastProduction.shortage, 0);
    assert.equal(result.ap, source.apMax);
    assert.deepEqual(result.meta, source.meta);
  }
  assert.deepEqual(source, before);
});

check('concentrated workers are bounded by the remaining project work and real research need', () => {
  const build = fixture(); build.projects.progress['drying-rack'] = 3;
  build.projects.resourceCommitted['drying-rack'] = true;
  const nextBuild = nextMorning(policy(build, 'construction'));
  assert.equal(nextBuild.tribe.assignments.builder, 2);
  assert.equal(nextBuild.tribe.lastProduction.projectWork, 2);
  assert.equal(nextBuild.projects.progress['drying-rack'], 5);
  assert.equal(nextBuild.inventory.jerky, 1);
  const study = fixture(); const tech = engine.TECHNOLOGY_TREE.find(row => row.id === 'STONE_TOOLS');
  study.research.progress[tech.id] = tech.cost - 2;
  const nextStudy = nextMorning(policy(study, 'research'));
  assert.equal(nextStudy.tribe.assignments.scholar, 2);
  assert.equal(nextStudy.tribe.lastProduction.researchRequested, 2);
  assert.equal(nextStudy.tribe.lastProduction.researchPoints, 2);
  assert.equal(nextStudy.research.progress[tech.id], tech.cost);
});

check('research priority sends surplus workers to useful alternative jobs after its one remaining RP is staffed', () => {
  const source = fixture();
  source.tribe.population = 24;
  source.inventory.berry = 1000;
  for (const tech of engine.TECHNOLOGY_TREE) source.research.completed[tech.id] = true;
  const tech = engine.TECHNOLOGY_TREE.find(row => row.id === 'STONE_TOOLS');
  source.research.completed[tech.id] = false;
  source.research.progress[tech.id] = tech.cost - 1;
  const before = clone(source);
  const balanced = nextMorning(source);
  const focused = nextMorning(policy(source, 'research'));
  assert.equal(balanced.tribe.assignments.scholar, 5);
  assert.equal(focused.tribe.assignments.scholar, 1);
  assert.equal(focused.tribe.lastProduction.researchRequested, 1);
  assert.equal(focused.tribe.lastProduction.researchPoints, 1);
  assert.equal(Object.values(focused.tribe.assignments).reduce((sum, count) => sum + count, 0), 24);
  assert.equal(focused.tribe.assignments.hunter, balanced.tribe.assignments.hunter + 4);
  assert.ok(focused.tribe.lastProduction.gains.meat > balanced.tribe.lastProduction.gains.meat);
  assert.deepEqual(source, before);
});

check('food and existing reserve safety keep the exact old allocation when a preferred policy cannot safely diversify', () => {
  for (const mode of ['scarce', 'thin-reserve']) {
    const source = fixture(mode === 'scarce' ? mode : 'surplus');
    if (mode === 'thin-reserve') source.inventory.berry = 5;
    const balanced = nextMorning(source);
    for (const id of ['construction', 'research']) {
      const selected = policy(source, id);
      assert.match(engine.tribeSummary(selected).workPolicy.applicationBlockedReason, /식량 안전/);
      const next = nextMorning(selected);
      assert.deepEqual(next.tribe.assignments, balanced.tribe.assignments);
      assert.deepEqual(next.tribe.lastProduction.gains, balanced.tribe.lastProduction.gains);
      assert.deepEqual(next.inventory, balanced.inventory);
      assert.equal(next.tribe.lastProduction.projectWork, balanced.tribe.lastProduction.projectWork);
      assert.equal(next.tribe.lastProduction.researchPoints, balanced.tribe.lastProduction.researchPoints);
    }
  }
});

check('unavailable construction material and missing research targets fall back without free work or idle priority jobs', () => {
  const source = fixture(); source.inventory.wood = 0; source.inventory.fiber = 0;
  const balanced = nextMorning(source);
  const selected = policy(source, 'construction');
  assert.match(engine.tribeSummary(selected).workPolicy.applicationBlockedReason, /실제 자재/);
  const next = nextMorning(selected);
  assert.equal(next.tribe.lastProduction.projectWork, 0);
  assert.equal(next.tribe.assignments.builder, 0);
  assert.deepEqual(next.tribe.assignments, balanced.tribe.assignments);
  const finished = fixture();
  for (const tech of engine.TECHNOLOGY_TREE) finished.research.completed[tech.id] = true;
  const withoutResearch = nextMorning(policy(finished, 'research'));
  assert.equal(withoutResearch.tribe.assignments.scholar, 0);
  assert.equal(withoutResearch.tribe.lastProduction.researchPoints, 0);
  assert.match(engine.tribeSummary(policy(finished, 'research')).workPolicy.applicationBlockedReason, /유효한 목표 기술/);
});

check('manual and legacy workers remain fixed while explicitly automatic workers can be reassigned', () => {
  const manual = fixture('manual');
  delete manual.tribe.autoAssignments;
  for (const id of ['construction', 'research']) {
    const selected = policy(manual, id);
    assert.match(engine.tribeSummary(selected).workPolicy.applicationBlockedReason, /수동 배치/);
    assert.deepEqual(nextMorning(selected).tribe.assignments, manual.tribe.assignments);
  }
  const mixed = fixture();
  mixed.tribe.assignments = jobs({ forager: 2, hunter: 1, builder: 1, scholar: 2 });
  mixed.tribe.autoAssignments = jobs({ hunter: 1, builder: 1, scholar: 2 });
  const construction = nextMorning(policy(mixed, 'construction'));
  assert.equal(construction.tribe.assignments.forager, 2);
  assert.equal(construction.tribe.autoAssignments.forager, 0);
  assert.equal(construction.tribe.assignments.builder, 4);
  const research = nextMorning(policy(mixed, 'research'));
  assert.equal(research.tribe.assignments.forager, 2);
  assert.equal(research.tribe.assignments.scholar, 4);
});

check('balanced reproduces the fresh pre-change full-state fingerprints and exact normalization/weather draw counts', () => {
  // Captured from these same fresh inputs before policy code was introduced.
  const expected = {
    surplus: ['2c8f0be2d5cbef49545ad7f18ccd1f753502c58b95e81b9d7dc8ce9855679cf7', 2],
    scarce: ['46fc1664d00226b8a8d6f24b7986fadae7e6e9951d43d397100facef01eaf341', 2],
    manual: ['cdf66b35ca06439690b3dc16b8b4cda63ea2e755cb2789a73fc767d9be9d1a4a', 1],
  };
  for (const mode of Object.keys(expected)) {
    const source = fixture(mode); delete source.tribe.workPolicy;
    const before = clone(source);
    let draws = 0, weatherDraws = 0;
    const random = Math.random; let next;
    Math.random = () => { draws++; return 0.5; };
    try { next = engine.advanceDay(source, { rng: () => { weatherDraws++; return 0.5; } }); }
    finally { Math.random = random; }
    assert.deepEqual(source, before);
    assert.equal(draws, expected[mode][1]); assert.equal(weatherDraws, 1);
    const originalShape = clone(next);
    delete originalShape.updatedAt;
    delete originalShape.tribe.workPolicy;
    delete originalShape.tribe.lastProduction.workPolicy;
    delete originalShape.tribe.lastProduction.assignments;
    assert.equal(createHash('sha256').update(JSON.stringify(originalShape)).digest('hex'), expected[mode][0]);
  }
});

check('absent policy fields normalize to balanced while defined invalid values fail closed', () => {
  const source = fixture(); delete source.tribe.workPolicy;
  assert.equal(engine.normalizeState(source).tribe.workPolicy, 'balanced');
  for (const invalid of [null, '', 'balanced ', 'other', 1, {}, []]) {
    assert.throws(() => data.normalizeTribeState({ ...source.tribe, workPolicy: invalid }), RangeError);
    assert.throws(() => engine.normalizeState({ ...source, tribe: { ...source.tribe, workPolicy: invalid } }), RangeError);
  }
});

check('defined morning receipt fields validate strict policy IDs and bounded actual job counts without normalizing historical values', () => {
  const source = nextMorning(fixture());
  const before = clone(source);
  for (const invalid of [undefined, null, '', 'other', 1, {}]) {
    const raw = clone(source); raw.tribe.lastProduction.workPolicy = invalid;
    assert.throws(() => data.normalizeTribeState(raw.tribe), RangeError);
    assert.throws(() => engine.normalizeState(raw), RangeError);
  }
  for (const assignments of [undefined, null, [], { unknown_job: 0 }, { builder: 25 }, { builder: -1 },
    { builder: 1.5 }, { builder: '1' }, { builder: Infinity }, { builder: NaN }, { forager: 24, builder: 1 }]) {
    const raw = clone(source); raw.tribe.lastProduction.assignments = assignments;
    assert.throws(() => data.normalizeTribeState(raw.tribe), RangeError);
    assert.throws(() => engine.normalizeState(raw), RangeError);
  }
  assert.deepEqual(source, before);
});

console.log(JSON.stringify({ passed: failures.length === 0, checks, failures,
  scope: 'Real civic unlock, pure policy settings and controlled morning allocations/receipts with fresh pre-change balanced fingerprints. No browser, account writes or universal balance claim.' }));
if (failures.length) process.exitCode = 1;
