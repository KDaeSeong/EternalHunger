import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';

const { cloneMovementRosterForPlanning, runPhaseActorActionPipeline } = await import('../src/app/simulation/_lib/phaseActorActionPipelineRuntime.js');
const { refreshActorGrowthPlan } = await import('../src/app/simulation/_lib/growthPlanRuntime.js');
const { getActorDimensionRiftId } = await import('../src/app/simulation/_lib/dimensionRiftSpaceRuntime.js');
const { appendSimulationLog } = await import('../src/app/simulation/_lib/logActionRuntime.js');

let checks = 0;
const check = (name, run) => {
  run();
  checks += 1;
  console.log(`PASS ${name}`);
};

check('the action pipeline treats a malformed roster as an empty boundary', () => {
  const result = runPhaseActorActionPipeline({ state: { phaseSurvivors: null } });
  assert.deepEqual(result, { newlyDead: [], pendingPickAssigned: false, updatedSurvivors: [] });
});

const source = [
  {
    _id: 'planner-1',
    hp: 100,
    zoneId: 'a',
    inventory: [{ itemId: 'fiber', qty: 1, tags: ['route_goal'], metadata: { source: 'field' } }],
    activeEffects: [{ name: 'read-only-status', remainingDuration: 5 }],
    _spatial: { x: 1, y: 2 },
  },
  {
    _id: 'rift-1',
    hp: 100,
    zoneId: 'a',
    _combatSpaceId: 'dimension_rift:r1',
    _dimensionRiftEntry: { riftId: 'r1', enteredAtSec: 10 },
    inventory: [],
  },
];

check('planning roster keeps legacy output while isolating planner-owned fields', () => {
  const legacy = structuredClone(source.filter((actor) => !getActorDimensionRiftId(actor)));
  legacy.forEach((actor) => refreshActorGrowthPlan(actor, [], {}));

  const optimized = cloneMovementRosterForPlanning(source);
  optimized.forEach((actor) => refreshActorGrowthPlan(actor, [], {}));

  assert.deepEqual(optimized, legacy);
  assert.equal(optimized.length, 1, 'dimension-rift actors stay out of world movement planning');
  assert.notEqual(optimized[0], source[0]);
  assert.notEqual(optimized[0].inventory, source[0].inventory);
  assert.notEqual(optimized[0].inventory[0].metadata, source[0].inventory[0].metadata);
  assert.equal(optimized[0].activeEffects, source[0].activeEffects, 'read-only status state is not deep-cloned');
  optimized[0].inventory[0].metadata.source = 'planner-only';
  assert.equal(source[0].inventory[0].metadata.source, 'field');
});

check('full log refs append in place without changing order or contents', () => {
  const refs = { fullLogsRef: { current: [] }, fullLogEntriesRef: { current: [] }, logSeqRef: { current: 0 } };
  const fullLogs = refs.fullLogsRef.current;
  const fullEntries = refs.fullLogEntriesRef.current;
  const updates = [];
  for (let index = 0; index < 2000; index += 1) {
    appendSimulationLog({ text: `line-${index}`, type: 'system', refs, actions: { setLogs: (update) => updates.push(update) } });
  }
  assert.equal(refs.fullLogsRef.current, fullLogs);
  assert.equal(refs.fullLogEntriesRef.current, fullEntries);
  assert.equal(refs.fullLogsRef.current.length, 2000);
  assert.equal(refs.fullLogEntriesRef.current[1999].text, 'line-1999');
  assert.equal(updates.length, 2000, 'visible React updaters remain one per log');
});

check('visible log enqueue preserves one immutable entry per event', () => {
  const refs = { fullLogsRef: { current: [] }, fullLogEntriesRef: { current: [] }, logSeqRef: { current: 0 } };
  const visible = [];
  appendSimulationLog({ text: 'queued', type: 'highlight', refs, actions: {
    enqueueVisibleLog: (entry) => visible.push(entry),
  } });
  assert.deepEqual(visible, [{ text: 'queued', type: 'highlight', id: 'log-1' }]);
});

console.log(JSON.stringify({ checks, pass: true, scope: 'phase movement/log append performance; no browser/build' }));
