import assert from 'node:assert/strict';
import './lib/register-simulation-modules.mjs';
const engine = await import('../src/app/games/primitive-archive/_lib/primitiveArchiveEngine.js');

let checks = 0;
const failures = [];
function check(name, run) {
  try {
    run();
    checks += 1;
    console.log(`PASS ${name}`);
  } catch (error) {
    failures.push({ name, message: error.message.split('\n')[0] });
    console.error(`FAIL ${name}: ${error.message.split('\n')[0]}`);
  }
}

function fixture(runId, overrides = {}) {
  const base = engine.createNewState({ runId, difficulty: 'normal', rng: () => 0.5 });
  return engine.normalizeState({
    ...base,
    ap: 2,
    inventory: { ...base.inventory, berry: 1, wood: 1 },
    party: base.party.map((member, index) => (index === 0
      ? { ...member, hp: 100, stamina: 50, hunger: 20 }
      : member)),
    ...overrides,
  });
}

check('safe gather rows expose fixed berry and wood choices with shared availability rules', () => {
  const state = fixture('safe-gather-rows');
  const rows = engine.safeGatherActionRows(state, state.party[0].id);
  assert.deepEqual(rows.map(({ id, label, action, outcome, costText, enabled, reason }) => (
    { id, label, action, outcome, costText, enabled, reason }
  )), [
    { id: 'berry', label: '안전 채집 · 베리', action: 'safe-gather', outcome: '베리 +2', costText: 'AP 1 · ST 6 · 허기 +1', enabled: true, reason: '' },
    { id: 'wood', label: '안전 채집 · 나무', action: 'safe-gather', outcome: '나무 +1', costText: 'AP 1 · ST 6 · 허기 +1', enabled: true, reason: '' },
  ]);
});

check('berry and wood safe gathering are deterministic and do not grant normal-gather progress', () => {
  for (const [resourceId, expectedQty] of [['berry', 2], ['wood', 1]]) {
    const state = fixture(`safe-gather-${resourceId}`);
    state.counters.gather = 7;
    state.research.counters.actionSuccess.gather = 3;
    state.research.counters.actionFail.gather = 2;
    const before = structuredClone(state);
    let rngCalls = 0;
    const next = engine.runSafeGatherAction(state, state.party[0].id, resourceId, { rng: () => { rngCalls += 1; return 0.5; } });
    assert.equal(next.inventory[resourceId], before.inventory[resourceId] + expectedQty);
    assert.equal(next.ap, before.ap - 1);
    assert.equal(next.party[0].stamina, before.party[0].stamina - 6);
    assert.equal(next.party[0].hunger, before.party[0].hunger + 1);
    assert.equal(next.counters.gather, before.counters.gather);
    assert.equal(next.research.counters.actionSuccess.gather, before.research.counters.actionSuccess.gather);
    assert.equal(next.research.counters.actionFail.gather, before.research.counters.actionFail.gather);
    assert.deepEqual(next.exploration, before.exploration);
    assert.deepEqual(next.eventChains, before.eventChains);
    assert.equal(rngCalls, 0, 'A non-final action must not call action RNG or dialogue RNG.');
    assert.deepEqual(state, before, 'The action must leave its input state untouched.');
  }
});

check('last safe gather action passes through normal end-of-day settlement', () => {
  const state = fixture('safe-gather-settlement', { ap: 1 });
  const beforeSerial = state.tribe.productionSerial;
  let rngCalls = 0;
  const next = engine.runSafeGatherAction(state, state.party[0].id, 'berry', { rng: () => { rngCalls += 1; return 0.5; } });
  assert.equal(next.day, state.day + 1);
  assert.equal(next.ap, next.apMax);
  assert.equal(next.tribe.productionSerial, beforeSerial + 1);
  assert.ok(rngCalls > 0, 'Normal day settlement may use the supplied RNG.');
});

check('ended, missing, dead, no-AP, and invalid-resource requests are rejected without spending AP or items', () => {
  const base = fixture('safe-gather-rejected');
  const actorId = base.party[0].id;
  const cases = [
    ['ended', { ended: true }, actorId, 'berry'],
    ['missing actor', {}, 'not-in-party', 'berry'],
    ['dead actor', { party: base.party.map((member) => member.id === actorId ? { ...member, hp: 0 } : member) }, actorId, 'berry'],
    ['no AP', { ap: 0 }, actorId, 'berry'],
    ['invalid resource', {}, actorId, 'stone'],
  ];
  for (const [name, overrides, requestedActor, resourceId] of cases) {
    const state = fixture(`safe-gather-rejected-${name}`, overrides);
    const before = structuredClone(state);
    let rngCalls = 0;
    const next = engine.runSafeGatherAction(state, requestedActor, resourceId, { rng: () => { rngCalls += 1; return 0.5; } });
    if (name === 'ended') assert.equal(next, state, 'Ended runs must remain completely unchanged.');
    assert.equal(next.ap, before.ap, `${name}: AP must not change.`);
    assert.deepEqual(next.inventory, before.inventory, `${name}: inventory must not change.`);
    assert.equal(next.day, before.day, `${name}: no settlement may run.`);
    assert.equal(rngCalls, 0, `${name}: action must not consume RNG.`);
    if (name === 'invalid resource') {
      assert.equal(engine.safeGatherActionRows(state, requestedActor).every((row) => row.enabled), true, 'Valid UI choices stay available when an invalid direct request is rejected.');
    } else {
      assert.equal(engine.safeGatherActionRows(state, requestedActor).every((row) => !row.enabled), true, `${name}: UI rows must be disabled.`);
    }
  }
});

check('new-run reserve bonus applies only to very easy, easy, and normal', () => {
  const expected = {
    veryeasy: { berry: 10, wood: 6 },
    easy: { berry: 8, wood: 5 },
    normal: { berry: 6, wood: 4 },
    hard: { berry: 1, wood: 2 },
    nightmare: { berry: 1, wood: 2 },
  };
  for (const [difficulty, stock] of Object.entries(expected)) {
    const state = engine.createNewState({ difficulty, runId: `safe-gather-start-${difficulty}`, rng: () => 0.5 });
    assert.equal(state.inventory.berry, stock.berry, `${difficulty} berries`);
    assert.equal(state.inventory.wood, stock.wood, `${difficulty} wood`);
  }
});

check('normalizing an existing save does not grant the new-run reserve bonus', () => {
  const state = fixture('safe-gather-existing-save');
  state.inventory = { berry: 1, wood: 3, stone: 9 };
  assert.deepEqual(engine.normalizeState(state).inventory, { berry: 1, wood: 3, stone: 9 });
});

if (failures.length) {
  console.error(JSON.stringify({ checks, failures }));
  process.exitCode = 1;
} else {
  console.log(`PASS ${checks} safe-gather checks`);
}
