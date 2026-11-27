import assert from 'node:assert/strict';
import './lib/register-simulation-modules.mjs';
const engine = await import('../src/app/games/primitive-archive/_lib/primitiveArchiveEngine.js');

const freeze = value => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };
const jobs = values => Object.fromEntries(engine.TRIBE_JOBS.map(job => [job.id, values[job.id] || 0]));
function fixture() {
  let state = engine.createNewState({ runId: 'policy-comparison', now: '2026-11-27T00:00:00.000Z', rng: () => 0.5 });
  state.day = 10;
  state.camp = { ...state.camp, fireLevel: 1, shelterLevel: 3, workbenchLevel: 1, fuel: 20 };
  state.inventory = { berry: 1000, wood: 100, fiber: 100, stone: 100, hide: 100, paper: 100, clay: 100, grain: 100, meat: 100, resin: 100, herb: 100 };
  for (const row of engine.TECHNOLOGY_TREE) state.research.completed[row.id] = true;
  for (const row of engine.CIVIC_TREE) state.civics.completed[row.id] = true;
  const tech = engine.TECHNOLOGY_TREE.at(-1);
  delete state.research.completed[tech.id]; state.research.selectedTechId = tech.id; state.research.progress[tech.id] = 0;
  state.tribe.population = 12; state.tribe.assignments = jobs({ forager: 1 }); state.tribe.autoAssignments = jobs({});
  state = engine.normalizeState(state);
  return engine.startAnnualSettlementAction(state, { runId: state.runId, day: state.day, ap: state.ap, updatedAt: state.updatedAt, completedYears: null }, { observedLifetimeYears: 60 });
}
const source = fixture();
assert.equal(source.calendar?.mode, 'annual');
const snapshot = structuredClone(source);
const random = Math.random;
let comparison;
try {
  Math.random = () => { throw Error('Preview must not draw randomness'); };
  comparison = engine.annualWorkPolicyComparison(freeze(source));
} finally { Math.random = random; }
assert.deepEqual(source, snapshot);
assert.equal(comparison.available, true);
assert.equal(comparison.policies.length, 3);
for (const policy of comparison.policies) {
  assert.ok(policy.assignments.forager >= 1, 'Manual worker remains assigned');
  assert.ok(policy.rows.every(row => Number.isFinite(row.value) && Number.isFinite(row.delta)));
}
const summaries = [];
for (const policy of comparison.policies) {
  let current = structuredClone(snapshot);
  current.tribe.workPolicy = policy.id;
  const totals = { projectWork: 0, researchPoints: 0, shortage: 0, production: {} };
  for (let year = 0; year < 10; year++) {
    const before = current.calendar.completedYears;
    current = engine.runSettlementYearAction(current, { runId: current.runId, day: current.day, ap: current.ap,
      updatedAt: current.updatedAt, completedYears: before });
    assert.equal(current.calendar.completedYears, before + 1);
    const receipt = current.tribe.lastProduction;
    if (year === 0) {
      assert.deepEqual(receipt.gains, policy.receipt.gains);
      assert.equal(receipt.projectWork, policy.receipt.projectWork);
      assert.equal(receipt.researchPoints, policy.receipt.researchPoints);
      assert.equal(receipt.shortage, policy.receipt.shortage);
    }
    for (const key of ['projectWork', 'researchPoints', 'shortage']) totals[key] += Number(receipt[key] || 0);
    for (const [key, quantity] of Object.entries(receipt.gains)) totals.production[key] = (totals.production[key] || 0) + quantity;
  }
  summaries.push({ policy: policy.id, years: current.calendar.completedYears, ...totals });
}
assert.equal(engine.annualWorkPolicyComparison({ ...snapshot, ended: true }).available, false);
const scarce = structuredClone(snapshot);
scarce.inventory = {};
const scarceComparison = engine.annualWorkPolicyComparison(freeze(scarce));
assert.ok(scarceComparison.policies.slice(1).every(policy => policy.rows.every(row => row.delta === 0)), 'Unsafe reserves prevent specialty reallocation');
assert.ok(scarceComparison.warnings.length);
const manual = structuredClone(snapshot);
manual.tribe.assignments = jobs({ forager: manual.tribe.population });
manual.tribe.autoAssignments = jobs({});
assert.ok(engine.annualWorkPolicyComparison(freeze(manual)).policies.every(policy => policy.assignments.forager === manual.tribe.population));
assert.notDeepEqual(summaries[0].production, summaries[1].production);
assert.ok(summaries[1].projectWork > summaries[0].projectWork);
assert.ok(summaries[2].researchPoints > summaries[0].researchPoints);
console.log(JSON.stringify({ pass: true, summaries, scope: 'Controlled actual ten-year settlement per policy; not natural balance or player acceptance.' }));
