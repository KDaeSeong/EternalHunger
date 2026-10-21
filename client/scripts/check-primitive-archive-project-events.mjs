import assert from 'node:assert/strict';
import './lib/register-simulation-modules.mjs';

const engine = await import('../src/app/games/primitive-archive/_lib/primitiveArchiveEngine.js');

const checks = [];
const failures = [];

function check(name, run) {
  try {
    run();
    checks.push(name);
    console.log(`PASS ${name}`);
  } catch (error) {
    failures.push({ name, message: error.message });
    console.error(`FAIL ${name}: ${error.message}`);
  }
}

function projectFixture() {
  const base = engine.createNewState({
    rng: () => 0.5,
    runId: 'project-events-deterministic',
    now: '2026-10-21T00:00:00.000Z',
  });
  return engine.normalizeState({
    ...base,
    day: 7,
    ap: 6,
    weather: { id: 'clear', cold: 0, actionMod: 0 },
    research: { ...base.research, completed: { GATHERING: true } },
    inventory: { ...base.inventory, berry: 40, wood: 3, fiber: 2, jerky: 0 },
    party: base.party.map((member) => ({ ...member, hp: 100, hunger: 0, stamina: 100, bodyTemp: 37 })),
    camp: { ...base.camp, fireLevel: 1, shelterLevel: 1, fuel: 2 },
    projects: { ...base.projects, selectedProjectId: 'drying-rack' },
  });
}

function eventFixture(kind = 'obsidian_vein') {
  const base = engine.createNewState({
    rng: () => 0.5,
    runId: `event-${kind}`,
    now: '2026-10-21T00:00:00.000Z',
  });
  return engine.normalizeState({
    ...base,
    day: 7,
    ap: 4,
    weather: { id: 'clear', cold: 0, actionMod: 0 },
    inventory: { ...base.inventory, berry: 40, meat: 10 },
    party: base.party.map((member) => ({ ...member, hp: 100, hunger: 0, stamina: 100, bodyTemp: 37 })),
    camp: { ...base.camp, fireLevel: 1, shelterLevel: 1, fuel: 2 },
    eventChains: [{ id: 'rare-chain', kind, zoneId: 'cave', startedDay: 7, expiresDay: 10, resolved: false }],
  });
}

function eventProtectedSnapshot(state) {
  return {
    ap: state.ap,
    party: state.party,
    inventory: state.inventory,
    eventChains: state.eventChains,
    counters: state.counters,
    research: state.research,
    day: state.day,
  };
}

check('manual project work charges shared materials once, persists its commitment, and grants completion reward once', () => {
  const initial = projectFixture();
  const original = structuredClone(initial);
  const project = engine.projectRows(initial).find((row) => row.id === 'drying-rack');
  assert.equal(project.available, true);
  assert.equal(project.committed, false);
  assert.equal(project.canWork, true);

  const estimate = engine.projectActionEstimate(initial, initial.party[0].id, 'drying-rack');
  let current = engine.runProjectAction(initial, initial.party[0].id, 'drying-rack', { rng: () => 0.999 });
  assert.equal(current.projects.resourceCommitted['drying-rack'], true);
  assert.equal(current.projects.progress['drying-rack'], estimate.work);
  assert.equal(current.inventory.wood, initial.inventory.wood - 3);
  assert.equal(current.inventory.fiber, initial.inventory.fiber - 2);
  assert.equal(current.inventory.jerky, initial.inventory.jerky);

  current = engine.normalizeState(JSON.parse(JSON.stringify(current)));
  assert.equal(engine.projectRows(current).find((row) => row.id === 'drying-rack').committed, true);
  let previousProgress = current.projects.progress['drying-rack'];
  for (let attempt = 0; attempt < 5 && !current.projects.completed['drying-rack']; attempt += 1) {
    const beforeWood = current.inventory.wood;
    const beforeFiber = current.inventory.fiber;
    const beforeJerky = current.inventory.jerky;
    const beforeSerial = current.projects.completionSerial;
    current = engine.runProjectAction(current, current.party[0].id, 'drying-rack', { rng: () => 0.999 });
    assert.ok(current.projects.progress['drying-rack'] > previousProgress);
    assert.equal(current.inventory.wood, beforeWood, 'Committed project work must not charge wood again.');
    assert.equal(current.inventory.fiber, beforeFiber, 'Committed project work must not charge fiber again.');
    previousProgress = current.projects.progress['drying-rack'];
    if (!current.projects.completed['drying-rack']) {
      assert.equal(current.inventory.jerky, beforeJerky);
      assert.equal(current.projects.completionSerial, beforeSerial);
    }
  }

  assert.equal(current.projects.completed['drying-rack'], true, 'Five bounded work attempts must complete the five-work project.');
  assert.equal(current.projects.progress['drying-rack'], 5);
  assert.equal(current.projects.completionSerial, 1);
  assert.equal(current.projects.lastCompletedId, 'drying-rack');
  assert.equal(current.inventory.jerky, original.inventory.jerky + 1);
  const completed = engine.normalizeState(JSON.parse(JSON.stringify(current)));
  const snapshot = {
    ap: completed.ap,
    inventory: completed.inventory,
    projects: completed.projects,
    counters: completed.counters,
    party: completed.party,
    day: completed.day,
  };
  const repeated = engine.runProjectAction(completed, completed.party[0].id, 'drying-rack', { rng: () => { throw new Error('Completed project consumed RNG.'); } });
  assert.equal(repeated.projects.completionSerial, 1);
  assert.deepEqual(repeated.inventory, snapshot.inventory);
  assert.deepEqual(repeated.projects, snapshot.projects);
  assert.deepEqual(repeated.counters, snapshot.counters);
  assert.deepEqual(repeated.party, snapshot.party);
  assert.equal(repeated.day, snapshot.day);
  assert.equal(repeated.ap, snapshot.ap);
  assert.deepEqual(initial, original, 'The deterministic fixture must remain unchanged.');
});

check('pending rare event survives a day boundary and success or failure is persisted without a second charge', () => {
  for (const outcome of ['success', 'failure']) {
    const initial = eventFixture();
    const dayLater = engine.normalizeState(JSON.parse(JSON.stringify(engine.advanceDay(initial, { rng: () => 0.999 }))));
    const pending = engine.eventChainRows(dayLater, 'noa').find((row) => row.id === 'rare-chain');
    assert.equal(dayLater.day, 8);
    assert.equal(pending.enabled, true);
    assert.equal(pending.daysLeft, 2);
    assert.equal(dayLater.eventChains[0].resolved, false);

    const before = structuredClone(dayLater);
    const draw = outcome === 'success' ? () => 0 : () => 0.999;
    const resolved = engine.runEventChainAction(dayLater, 'noa', 'rare-chain', { rng: draw });
    assert.equal(resolved.ap, before.ap - 1);
    assert.equal(resolved.eventChains[0].resolved, true);
    assert.equal(resolved.eventChains[0].ok, outcome === 'success');
    if (outcome === 'success') {
      assert.equal(resolved.inventory.obsidian_shard, Number(before.inventory.obsidian_shard || 0) + 2);
      assert.equal(resolved.inventory.flint, Number(before.inventory.flint || 0) + 1);
      assert.equal(resolved.party[2].hp, before.party[2].hp);
    } else {
      assert.equal(Number(resolved.inventory.obsidian_shard || 0), Number(before.inventory.obsidian_shard || 0));
      assert.equal(Number(resolved.inventory.flint || 0), Number(before.inventory.flint || 0));
      assert.ok(resolved.party[2].hp < before.party[2].hp);
      assert.ok(resolved.party[2].stamina < before.party[2].stamina);
    }

    const restored = engine.normalizeState(JSON.parse(JSON.stringify(resolved)));
    const restoredSnapshot = eventProtectedSnapshot(restored);
    const repeated = engine.runEventChainAction(restored, 'noa', 'rare-chain', { rng: () => { throw new Error('Resolved event consumed RNG.'); } });
    assert.deepEqual(eventProtectedSnapshot(repeated), restoredSnapshot);
  }
});

console.log(JSON.stringify({
  checks: checks.length,
  pass: failures.length === 0,
  failures,
  evidence: 'fresh deterministic synthetic engine fixtures; no browser, natural-play or balance claim',
}, null, 2));
if (failures.length) process.exitCode = 1;
