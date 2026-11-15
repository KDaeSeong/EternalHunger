import assert from 'node:assert/strict';
import './lib/register-simulation-modules.mjs';

const engine = await import('../src/app/games/primitive-archive/_lib/primitiveArchiveEngine.js');
const data = await import('../src/app/games/primitive-archive/_lib/primitiveArchiveData.js');
const checkpoint = await import('../src/app/games/primitive-archive/_lib/primitiveArchiveCheckpoint.js');
const clone = value => structuredClone(value);
let passed = 0;
const failures = [];
function check(name, run) {
  try { run(); passed++; console.log(`PASS ${name}`); }
  catch (error) { failures.push(name); console.error(`FAIL ${name}: ${error.message}`); }
}
const stamp = state => ({ runId: state.runId, day: state.day, ap: state.ap,
  updatedAt: state.updatedAt, completedYears: state.calendar?.completedYears ?? null });
const eligible = (state, tree, completed) => tree.filter(row => !completed[row.id]
  && row.prereqs.every(id => state.research.completed[id]));

// These intentionally controlled, prerequisite-closed fixtures isolate the
// return boundary. They do not represent a natural 244-node campaign, reuse a
// private checkpoint, or claim that a restored campaign has been completed.
function fixture({ name, gate = '', extraOpen = [], selectedTech = 'BREECH_LOADING_RIFLE',
  selectedCivic = 'FACTORY_SYSTEM', annual = true, ap = 0 } = {}) {
  const excluded = new Set([gate, ...extraOpen].filter(Boolean));
  let changed = true;
  while (changed) {
    changed = false;
    for (const row of data.TECH_TREE) if (!excluded.has(row.id) && row.prereqs.some(id => excluded.has(id))) {
      excluded.add(row.id); changed = true;
    }
  }
  let state = engine.createNewState({ runId: `selection-checkpoint:${name}`, now: '2026-11-15T00:00:00.000Z', rng: () => 0.5 });
  state.day = 40;
  state.ap = ap;
  state.research.completed = Object.fromEntries(data.TECH_TREE.filter(row => !excluded.has(row.id)).map(row => [row.id, true]));
  state.research.progress = Object.fromEntries(data.TECHNOLOGY_TREE.map(row => [row.id, excluded.has(row.id) ? 0 : row.cost]));
  state.research.eureka = Object.fromEntries(data.TECHNOLOGY_TREE.map(row => [row.id, true]));
  state.research.inspiration = Object.fromEntries(data.TECHNOLOGY_TREE.map(row => [row.id, true]));
  state.research.selectedTechId = selectedTech;
  state.civics.completed = Object.fromEntries(data.CIVIC_TREE.filter(row => !excluded.has(row.id)).map(row => [row.id, true]));
  state.civics.progress = Object.fromEntries(data.CIVIC_TREE.map(row => [row.id, excluded.has(row.id) ? 0 : row.cost]));
  state.civics.inspiration = Object.fromEntries(data.CIVIC_TREE.map(row => [row.id, true]));
  state.civics.selectedCivicId = selectedCivic;
  if (gate) {
    const row = data.TECH_TREE.find(row => row.id === gate);
    (data.CIVIC_TREE.some(row => row.id === gate) ? state.civics : state.research).progress[gate] = row.cost - 1;
  }
  for (const row of data.TECH_TREE) if (state.research.completed[row.id]) {
    assert.ok(row.prereqs.every(id => state.research.completed[id]), `Controlled fixture preserves prerequisites: ${row.id}`);
  }
  state.camp = { ...state.camp, fireLevel: 1, shelterLevel: 2, workbenchLevel: 1, fuel: 0 };
  state.inventory = { berry: 20, wood: 2 };
  state.tribe.population = 8;
  state.tribe.morale = 80;
  state.tribe.growthProgress = 0;
  state.tribe.assignments = Object.fromEntries(data.TRIBE_JOBS.map(row => [row.id, row.id === 'forager' ? 8 : 0]));
  state.tribe.autoAssignments = Object.fromEntries(data.TRIBE_JOBS.map(row => [row.id, 0]));
  state = engine.normalizeState(state);
  assert.equal(engine.researchSystemStatus(state).unlocked, true, 'Controlled fixture satisfies all actual research facility requirements');
  assert.equal(engine.researchSystemStatus(state).actionUnlocked, true, 'Controlled fixture satisfies actual paid research prerequisites');
  assert.equal(engine.civicsSystemStatus(state).unlocked, true, 'Controlled fixture enables the actual civic system');
  assert.equal(engine.civicsSystemStatus(state).actionUnlocked, true, 'Controlled fixture enables actual paid civic actions');
  if (annual) state = engine.startAnnualSettlementAction(state, stamp(state), { observedLifetimeYears: 60 });
  assert.equal(checkpoint.isValidRunState(state), true);
  return state;
}
function strictReadback(state) {
  const before = clone(state);
  assert.equal(checkpoint.isValidRunState(state), true);
  assert.deepEqual(engine.normalizeState(JSON.parse(JSON.stringify(state))), state, 'Full JSON readback must preserve the produced state');
  assert.deepEqual(state, before, 'Readback must not mutate its source');
}
function transition(source, execute, { annual = false, expectedDraws = 0 } = {}) {
  const before = clone(source), ambient = Math.random;
  let draws = 0;
  Math.random = () => { throw new Error('Ambient RNG is forbidden in this controlled transition'); };
  let result;
  try {
    result = execute(source, () => { draws++; return 0.5; });
    strictReadback(result);
  } finally { Math.random = ambient; }
  assert.deepEqual(source, before, 'Execution must preserve the input state');
  if (expectedDraws !== null) assert.equal(draws, expectedDraws);
  if (annual) {
    assert.equal(result.calendar.completedYears, source.calendar.completedYears + 1);
    assert.equal(result.day, source.day + 1);
    assert.equal(result.ap, source.apMax);
  }
  return result;
}
const year = source => transition(source, (state, rng) => engine.runSettlementYearAction(state, stamp(state), { rng }), { annual: true });
const progressDelta = (before, after, tree, key) => tree.reduce((sum, row) => sum
  + Number(after[key].progress[row.id] || 0) - Number(before[key].progress[row.id] || 0), 0);
function onlyNewCompletion(before, after, id) {
  assert.deepEqual(data.TECH_TREE.filter(row => !before.research.completed[row.id] && after.research.completed[row.id]).map(row => row.id), [id]);
}

check('annual civic completion replaces a completed technology only after all academic stages', () => {
  const before = fixture({ name: 'civic-opens-tech', gate: 'FACTORY_SYSTEM' });
  assert.equal(before.research.completed.BREECH_LOADING_RIFLE, true);
  assert.equal(before.research.selectedTechId, 'BREECH_LOADING_RIFLE');
  assert.equal(eligible(before, data.TECHNOLOGY_TREE, before.research.completed).length, 0);
  const after = year(before);
  onlyNewCompletion(before, after, 'FACTORY_SYSTEM');
  assert.equal(after.research.selectedTechId, 'RAILWAY_ENGINEERING');
  assert.equal(progressDelta(before, after, data.TECHNOLOGY_TREE, 'research'), 0, 'Selection repair must not award additional current-year RP');
  assert.equal(progressDelta(before, after, data.CIVIC_TREE, 'civics'), 1);
});

check('annual technology completion also repairs a completed civic selection', () => {
  const before = fixture({ name: 'tech-opens-civic', gate: 'RAILWAY_ENGINEERING', selectedTech: 'RAILWAY_ENGINEERING' });
  assert.equal(before.civics.selectedCivicId, 'FACTORY_SYSTEM');
  assert.equal(eligible(before, data.CIVIC_TREE, before.civics.completed).length, 0);
  const after = year(before);
  onlyNewCompletion(before, after, 'RAILWAY_ENGINEERING');
  assert.equal(after.civics.selectedCivicId, 'MUNICIPAL_GOVERNMENT');
  assert.equal(progressDelta(before, after, data.TECHNOLOGY_TREE, 'research'), 1);
  const cp = progressDelta(before, after, data.CIVIC_TREE, 'civics');
  assert.ok(cp > 0 && cp <= 18, 'Existing later civic stage still contributes to its available civic');
  assert.equal(after.civics.progress.MUNICIPAL_GOVERNMENT, cp);
});

check('newly unlocked technology preserves an existing valid unfinished goal', () => {
  const before = fixture({ name: 'keep-tech', gate: 'FACTORY_SYSTEM', extraOpen: ['BREECH_LOADING_RIFLE'] });
  assert.equal(before.research.selectedTechId, 'BREECH_LOADING_RIFLE');
  const after = year(before);
  assert.equal(after.research.completed.FACTORY_SYSTEM, true);
  assert.equal(after.research.selectedTechId, 'BREECH_LOADING_RIFLE');
  assert.ok(after.research.progress.BREECH_LOADING_RIFLE > 0);
  assert.equal(after.research.progress.RAILWAY_ENGINEERING, 0);
});

check('newly unlocked civic preserves the existing valid civic and contribution recipient', () => {
  const before = fixture({ name: 'keep-civic', gate: 'RAILWAY_ENGINEERING', extraOpen: ['GENERAL_STAFF'],
    selectedTech: 'RAILWAY_ENGINEERING', selectedCivic: 'GENERAL_STAFF' });
  assert.equal(before.civics.selectedCivicId, 'GENERAL_STAFF');
  const after = year(before);
  assert.equal(after.research.completed.RAILWAY_ENGINEERING, true);
  assert.equal(after.civics.selectedCivicId, 'GENERAL_STAFF');
  assert.ok(after.civics.progress.GENERAL_STAFF > 0);
  assert.equal(after.civics.progress.MUNICIPAL_GOVERNMENT, 0);
});

check('all-complete fixture retains both previous selections without extra academic points', () => {
  const before = fixture({ name: 'all-complete' });
  const after = year(before);
  assert.equal(after.research.selectedTechId, before.research.selectedTechId);
  assert.equal(after.civics.selectedCivicId, before.civics.selectedCivicId);
  assert.deepEqual(after.research.progress, before.research.progress);
  assert.deepEqual(after.civics.progress, before.civics.progress);
});

check('paid annual civic action returns the same canonical selection without advancing time', () => {
  const before = fixture({ name: 'paid-annual', gate: 'FACTORY_SYSTEM', ap: 1 });
  const after = transition(before, (state, rng) => engine.runCivicAction(state, state.party[0].id, { rng }), { expectedDraws: null });
  assert.equal(after.ap, 0);
  assert.equal(after.day, before.day);
  assert.deepEqual(after.calendar, before.calendar);
  assert.equal(after.research.selectedTechId, 'RAILWAY_ENGINEERING');
  assert.equal(progressDelta(before, after, data.TECHNOLOGY_TREE, 'research'), 0);
  assert.equal(progressDelta(before, after, data.CIVIC_TREE, 'civics'), 1);
});

check('daily action boundary repairs cross-unlock selection after existing turn academics', () => {
  const before = fixture({ name: 'daily-turn', gate: 'FACTORY_SYSTEM', annual: false, ap: 2 });
  const after = transition(before, (state, rng) => engine.afterAction(state, state.party[0].id, 1, 1, { rng }));
  assert.equal(after.day, before.day);
  assert.equal(after.ap, 1);
  assert.equal(after.research.selectedTechId, 'RAILWAY_ENGINEERING');
  assert.equal(progressDelta(before, after, data.TECHNOLOGY_TREE, 'research'), 0);
  assert.equal(progressDelta(before, after, data.CIVIC_TREE, 'civics'), 1);
});

check('last daily AP repairs selection after day settlement without adding newly targeted RP', () => {
  const before = fixture({ name: 'daily-last-ap', gate: 'FACTORY_SYSTEM', annual: false, ap: 1 });
  const after = transition(before, (state, rng) => engine.afterAction(state, state.party[0].id, 1, 1, { rng }), { expectedDraws: null });
  assert.equal(after.day, before.day + 1);
  assert.equal(after.research.selectedTechId, 'RAILWAY_ENGINEERING');
  assert.equal(after.research.progress.RAILWAY_ENGINEERING, 0, 'Do not retarget before the existing day research stage');
  assert.equal(progressDelta(before, after, data.TECHNOLOGY_TREE, 'research'), 0);
});

console.log(`Primitive Archive research selection checkpoint: ${passed}/${passed + failures.length}`);
if (failures.length) process.exitCode = 1;
