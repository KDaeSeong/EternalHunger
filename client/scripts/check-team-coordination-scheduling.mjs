import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';

const { buildTeamCoordination, buildTeamCoordinationSteps } = await import('../src/app/simulation/_lib/teamTacticsRuntime.js');
const { runGrowthActionSteps } = await import('../src/app/simulation/_lib/growthActionSchedulingRuntime.js');
const { createSeedRng } = await import('../src/app/simulation/_lib/randomSeedRuntime.js');
const { withSimulationRandom, runSimulationSteps, simulationRandom, getActiveSimulationRandom } = await import('../src/utils/simulationRandom.js');

let checks = 0;
const check = async (name, run) => { await run(); checks += 1; console.log(`PASS ${name}`); };
const roster = Array.from({ length: 24 }, (_, index) => ({
  _id: `actor-${index}`, teamId: `team:${Math.floor(index / 3)}`, teamSlot: index % 3 + 1,
  zoneId: `zone-${Math.floor(index / 3)}`, hp: 100, maxHp: 100, inventory: [],
  _growthPlan: { openingComplete: true, blocked: '', targetId: '' },
}));
const zoneGraph = Object.fromEntries(Array.from({ length: 8 }, (_, index) =>
  [`zone-${index}`, [`zone-${(index + 1) % 8}`]]));
const serialize = result => ({ movementPlans: [...result.movementPlans], regroupDecisions: [...result.regroupDecisions] });
function options(onChoice = () => {}) {
  return { roster: structuredClone(roster), zoneGraph, day: 3, phase: 'morning',
    estimatePower: () => 100, ruleset: { ai: { recoverHpBelow: 38 } },
    chooseLeaderMove: actor => {
      onChoice(actor);
      return { targets: [actor.zoneId], reason: `sample-${simulationRandom()}` };
    } };
}

await check('24 actors are planned as eight indivisible ordered squads', () => {
  const chosen = [], input = options(actor => chosen.push(actor.teamId));
  const before = JSON.stringify(input.roster), source = createSeedRng('coordination');
  const steps = buildTeamCoordinationSteps(input);
  assert.equal(withSimulationRandom(source, () => steps.next()).done, false);
  assert.equal(chosen.length, 0);
  for (let count = 1; count < 8; count += 1) {
    assert.equal(withSimulationRandom(source, () => steps.next()).done, false);
    assert.equal(chosen.length, count);
  }
  const finished = withSimulationRandom(source, () => steps.next());
  assert.equal(finished.done, true); assert.equal(chosen.length, 8);
  assert.equal(finished.value.movementPlans.size, 24);
  assert.equal(JSON.stringify(input.roster), before, 'Coordination must leave its shared snapshot intact.');
});

await check('budgeted scheduling preserves synchronous plans, ordering and RNG draws', async () => {
  const directRandom = createSeedRng('coordination'), scheduledRandom = createSeedRng('coordination');
  const directOrder = [], scheduledOrder = [];
  const direct = withSimulationRandom(directRandom, () => buildTeamCoordination(options(actor => directOrder.push(actor._id))));
  let clock = 0, pauses = 0;
  const scheduled = await runSimulationSteps(scheduledRandom, runGrowthActionSteps(
    buildTeamCoordinationSteps(options(actor => scheduledOrder.push(actor._id))), {
      now: () => clock += 10, sliceBudgetMs: 8,
      requestYield: async () => {
        await Promise.resolve();
        assert.equal(getActiveSimulationRandom(), null, 'Browser work cannot retain the match RNG.');
        pauses += 1;
        withSimulationRandom(createSeedRng(`other-match-${pauses}`), () => simulationRandom());
      },
    }));
  assert.ok(pauses >= 8); assert.deepEqual(serialize(scheduled), serialize(direct));
  assert.deepEqual(scheduledOrder, directOrder); assert.deepEqual(scheduledRandom.getState(), directRandom.getState());
});

await check('cancelling between squads does not plan the remaining teams', () => {
  let choices = 0;
  const source = createSeedRng('cancel'), steps = buildTeamCoordinationSteps(options(() => choices++));
  withSimulationRandom(source, () => steps.next());
  withSimulationRandom(source, () => steps.next());
  assert.equal(choices, 1); const before = source.getState();
  steps.return(); assert.equal(steps.next().done, true);
  assert.equal(choices, 1); assert.deepEqual(source.getState(), before);
});

await check('solo matches return no coordination and draw no randomness', () => {
  const source = createSeedRng('solo'); const before = source.getState();
  const result = withSimulationRandom(source, () => buildTeamCoordinationSteps({ ...options(), isSoloMatch: true }).next());
  assert.equal(result.done, true); assert.equal(result.value.movementPlans.size, 0);
  assert.deepEqual(source.getState(), before);
});

await check('a rejected real scheduling wait closes the remaining squad iterator and releases RNG', async () => {
  const source = createSeedRng('failed-squad-wait'), expected = createSeedRng('failed-squad-wait');
  let clock = 0, pauses = 0, choices = 0;
  const steps = buildTeamCoordinationSteps(options(() => choices++));
  const failure = new Error('host scheduling failed');
  await assert.rejects(runSimulationSteps(source, runGrowthActionSteps(steps, {
    now: () => clock += 9, requestYield: () => ++pauses === 2 ? Promise.reject(failure) : Promise.resolve(),
  })), error => error === failure);
  expected();
  assert.equal(choices, 1); assert.equal(steps.next().done, true);
  assert.deepEqual(source.getState(), expected.getState()); assert.equal(getActiveSimulationRandom(), null);
});

await check('one slow squad can exceed the slice budget and remains indivisible', async () => {
  const source = createSeedRng('slow-squad'); let clock = 0, choices = 0, pauses = 0;
  const steps = runGrowthActionSteps(buildTeamCoordinationSteps(options(() => { choices++; clock += 100; })), {
    now: () => clock, sliceBudgetMs: 8, requestYield: () => { pauses++; return Promise.resolve(); },
  });
  const first = withSimulationRandom(source, () => steps.next());
  assert.equal(first.done, false); assert.equal(choices, 1); assert.equal(clock, 100);
  assert.equal(pauses, 1, 'The budget creates a checkpoint after work; it is not an 8ms hard ceiling.');
  const before = source.getState(); steps.return();
  assert.equal(choices, 1); assert.deepEqual(source.getState(), before);
  await first.value;
});

console.log(JSON.stringify({ checks, pass: true, scope: 'squad scheduling, cancellation, snapshot and RNG contracts; not browser timing or paint proof' }));
