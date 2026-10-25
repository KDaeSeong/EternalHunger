import assert from 'node:assert/strict';
import './lib/register-simulation-modules.mjs';
const engine = await import('../src/app/games/primitive-archive/_lib/primitiveArchiveEngine.js');

const base = engine.createNewState({ rng: () => 0.5, runId: 'manual-workforce-check', now: '2026-10-25T00:00:00.000Z' });
const jobs = engine.TRIBE_JOBS.map((job) => job.id);
const manualAssignments = { ...base.tribe.assignments };
const noAutoAssignments = Object.fromEntries(jobs.map((id) => [id, 0]));
const noEvents = () => 0.5;

function growthFixture(overrides = {}) {
  return engine.normalizeState({
    ...base,
    day: 1,
    camp: { ...base.camp, shelterLevel: 1 },
    inventory: { ...base.inventory, berry: 2, wood: 0, meat: 0 },
    tribe: {
      ...base.tribe,
      population: 4,
      morale: 65,
      growthProgress: 8,
      assignments: { ...manualAssignments },
      autoAssignments: { ...noAutoAssignments },
    },
    ...overrides,
  });
}

let checks = 0;
const failures = [];
function check(name, run) {
  try { run(); checks += 1; console.log(`PASS ${name}`); }
  catch (error) { failures.push({ name, message: error.message }); console.error(`FAIL ${name}: ${error.message}`); }
}

check('manual play before settlement research leaves newly grown residents unassigned', () => {
  const start = growthFixture();
  const afterGrowth = engine.advanceDay(start, { rng: noEvents });
  assert.equal(afterGrowth.tribe.population, 5);
  assert.deepEqual(afterGrowth.tribe.assignments, manualAssignments);
  assert.equal(engine.tribeSummary(afterGrowth).unassigned, 1);
  assert.ok(!afterGrowth.log.some((line) => line.includes('직업 배치')));
});

check('settlement assigns a newcomer before the next manual day production and preserves manual jobs', () => {
  const afterGrowth = engine.advanceDay(growthFixture(), { rng: noEvents });
  const settled = engine.normalizeState({
    ...afterGrowth,
    research: {
      ...afterGrowth.research,
      completed: { ...afterGrowth.research.completed, SETTLEMENT: true },
    },
  });
  const afterNextManualDay = engine.advanceDay(settled, { rng: noEvents });
  assert.equal(afterNextManualDay.tribe.population, 5);
  assert.equal(Object.values(afterNextManualDay.tribe.assignments).reduce((sum, n) => sum + n, 0), 5);
  assert.equal(engine.tribeSummary(afterNextManualDay).unassigned, 0);
  for (const id of jobs) {
    assert.equal(afterNextManualDay.tribe.assignments[id] - afterNextManualDay.tribe.autoAssignments[id], manualAssignments[id], `${id} manual assignment was changed.`);
  }
  assert.equal(afterNextManualDay.tribe.autoAssignments.forager, 1);
  assert.equal(afterNextManualDay.tribe.lastProduction.gains.wood, 2);
  assert.equal(afterNextManualDay.tribe.lastProduction.gains.berry, 2);
  assert.ok(afterNextManualDay.log.some((line) => line.includes('정착지 직업 배치')));
  assert.ok(!afterNextManualDay.log.some((line) => line.includes('하루 자동 운영 직업 배치')));
});

check('legacy manual assignments with no auto-assignment metadata are preserved after settlement', () => {
  const tribe = { ...base.tribe, population: 5, assignments: { ...manualAssignments } };
  delete tribe.autoAssignments;
  const state = growthFixture({
    tribe,
    research: { ...base.research, completed: { ...base.research.completed, SETTLEMENT: true } },
  });
  const next = engine.advanceDay(state, { rng: noEvents });
  for (const id of jobs) {
    assert.equal(next.tribe.assignments[id] - next.tribe.autoAssignments[id], manualAssignments[id], `${id} legacy manual assignment was changed.`);
  }
  assert.equal(Object.values(next.tribe.assignments).reduce((sum, n) => sum + n, 0), 5);
  assert.equal(engine.tribeSummary(next).unassigned, 0);
});

check('settlement fills only unlocked jobs and never exceeds population', () => {
  const state = growthFixture({
    tribe: { ...base.tribe, population: 6, assignments: { ...manualAssignments }, autoAssignments: { ...noAutoAssignments } },
    research: { ...base.research, completed: { ...base.research.completed, SETTLEMENT: true } },
  });
  const next = engine.advanceDay(state, { rng: noEvents });
  const assigned = Object.values(next.tribe.assignments).reduce((sum, n) => sum + n, 0);
  assert.equal(assigned, next.tribe.population);
  for (const job of engine.TRIBE_JOBS) {
    if (job.techId && !next.research.completed[job.techId]) assert.equal(next.tribe.assignments[job.id], 0, `${job.id} is locked.`);
  }
});

check('auto-workforce opt-in remains available before settlement and ended runs do not redistribute workers', () => {
  const beforeSettlement = growthFixture({ tribe: { ...base.tribe, population: 5, assignments: { ...manualAssignments }, autoAssignments: { ...noAutoAssignments } } });
  const automatic = engine.advanceDay(beforeSettlement, { rng: noEvents, autoWorkforce: true });
  assert.equal(engine.tribeSummary(automatic).unassigned, 0);
  assert.ok(automatic.log.some((line) => line.includes('하루 자동 운영 직업 배치')));

  const ended = engine.normalizeState({
    ...beforeSettlement,
    ended: true,
    research: { ...beforeSettlement.research, completed: { ...beforeSettlement.research.completed, SETTLEMENT: true } },
  });
  const settledEnded = engine.advanceDay(ended, { rng: noEvents });
  assert.deepEqual(settledEnded.tribe.assignments, ended.tribe.assignments);
  assert.deepEqual(settledEnded.tribe.autoAssignments, ended.tribe.autoAssignments);
  assert.ok(!settledEnded.log.some((line) => line.includes('직업 배치')));
});

console.log(JSON.stringify({ checks, pass: failures.length === 0, failures }));
if (failures.length) process.exitCode = 1;
