import assert from 'node:assert/strict';
import './lib/register-simulation-modules.mjs';
const engine = await import('../src/app/games/primitive-archive/_lib/primitiveArchiveEngine.js');

function fixture(runId, overrides = {}) {
  const base = engine.createNewState({ runId, now: '2026-10-27T00:00:00.000Z', rng: () => 0.5 });
  return engine.normalizeState({
    ...base,
    ap: 2,
    inventory: { herb_tonic: 1, berry: 1 },
    party: base.party.map((member) => ({ ...member, hp: 100, hunger: 0, stamina: 100, bodyTemp: 37 })),
    ...overrides,
  });
}

function noLog(state) {
  const copy = structuredClone(state);
  delete copy.log;
  delete copy.updatedAt;
  return copy;
}

function choice(state, id) {
  return engine.recoveryChoiceRows(state).find((row) => row.id === id);
}

let checks = 0;
function check(name, run) {
  run();
  checks += 1;
  console.log(`PASS ${name}`);
}

check('healthy fed survivor is not selected for casualties diluted care', () => {
  const state = fixture('recovery-healthy-survivor-casualties');
  state.party = state.party.map((member, index) => ({
    ...member,
    hp: index === 0 ? 100 : 0,
    hunger: index === 0 ? 0 : 100,
    stamina: index === 0 ? 100 : 0,
    bodyTemp: index === 0 ? 37 : 25,
  }));
  assert.equal(engine.averageParty(state, 'hp'), 33, 'Fixture must retain the misleading all-party average.');
  assert.notEqual(choice(state, 'field_tonic')?.enabled, true);
  assert.notEqual(choice(state, 'ration_break')?.enabled, true);
  for (const id of ['field_tonic', 'ration_break']) {
    const before = structuredClone(state);
    let draws = 0;
    const next = engine.runRecoveryChoiceAction(state, 'shiroko', id, { rng: () => { draws += 1; return 0.5; } });
    assert.equal(draws, 0, `${id} must reject without consuming action RNG.`);
    assert.deepEqual(noLog(next), noLog(before), `${id} must preserve AP, supplies, and party state.`);
    assert.deepEqual(state, before, `${id} must not mutate its input.`);
  }

  const tracking = structuredClone(state);
  tracking.day = 7;
  tracking.research.completed.CARTOGRAPHY = true;
  tracking.exploration = {
    ...tracking.exploration,
    selectedRegionId: 'whisper-woods',
    revealed: { ...tracking.exploration.revealed, 'echo-cave': true },
  };
  assert.equal(choice(tracking, 'risk_track')?.enabled, true, 'Dead companions cannot dilute a living tracker’s HP or stamina gate.');

  const afterEvent = structuredClone(state);
  afterEvent.counters.events = 1;
  assert.notEqual(choice(afterEvent, 'field_tonic')?.enabled, true, 'Event pressure alone cannot offer a zero-benefit treatment.');
  let draws = 0;
  const denied = engine.runRecoveryChoiceAction(afterEvent, 'shiroko', 'field_tonic', { rng: () => { draws += 1; return 0.5; } });
  assert.equal(draws, 0);
  assert.deepEqual(noLog(denied), noLog(afterEvent));
});

check('one injured and starving survivor keeps both real treatments visible despite healthy companions', () => {
  const state = fixture('recovery-single-demand-diluted');
  state.inventory = { herb_tonic: 1, cooked_meat: 1 };
  state.party = state.party.map((member, index) => ({
    ...member,
    hp: index === 0 ? 12 : 100,
    hunger: index === 0 ? 96 : 0,
  }));
  assert.ok(engine.averageParty(state, 'hp') > 55);
  assert.ok(engine.averageParty(state, 'hunger') < 42);
  assert.equal(choice(state, 'field_tonic')?.enabled, true);
  assert.equal(choice(state, 'ration_break')?.enabled, true);
});

check('valid group ration feeds hungry living members, skips a dead member, and charges actual meal and AP costs', () => {
  const state = fixture('recovery-live-group-ration');
  state.inventory = { berry: 2 };
  state.party = state.party.map((member, index) => ({
    ...member,
    hp: index === 2 ? 0 : 100,
    hunger: index === 2 ? 100 : index === 0 ? 85 : 70,
  }));
  const berryBefore = state.inventory.berry;
  const next = engine.runRecoveryChoiceAction(state, state.party[0].id, 'ration_break', { rng: () => 0.999 });
  assert.equal(next.counters.meals, state.counters.meals + 2);
  assert.equal(next.inventory.berry, berryBefore - 2);
  assert.equal(next.ap, state.ap - 1);
  assert.equal(next.party[2].hp, 0);
  assert.equal(next.party[2].hunger, 100);
  assert.ok(next.party[0].hunger < 85);
  assert.ok(next.party[1].hunger < 70);
});

check('valid group tonic heals survivors, skips casualties, and charges existing supply and AP costs', () => {
  const state = fixture('recovery-live-group-tonic');
  state.party = state.party.map((member, index) => ({
    ...member,
    hp: index === 2 ? 0 : index === 0 ? 20 : 45,
    hunger: index === 2 ? 100 : 0,
  }));
  const next = engine.runRecoveryChoiceAction(state, state.party[0].id, 'field_tonic', { rng: () => 0.999 });
  assert.equal(next.inventory.herb_tonic, 0);
  assert.equal(next.ap, state.ap - 1);
  assert.ok(next.party[0].hp > 20);
  assert.ok(next.party[1].hp > 45);
  assert.equal(next.party[2].hp, 0);
  assert.equal(next.party[2].hunger, 100);
});

check('normal-temperature healthy survivors cannot consume warm food or medicine solely for old event pressure', () => {
  for (const foodId of ['berry', 'cooked_meat', 'packed_ration']) {
    const state = fixture(`healthy-event-${foodId}`);
    state.inventory = { [foodId]: 3, herb_tonic: 1 };
    state.counters.events = 2;
    for (const id of ['field_tonic', 'ration_break']) {
      assert.notEqual(choice(state, id)?.enabled, true);
      const next = engine.runRecoveryChoiceAction(state, 'shiroko', id, {
        rng: () => { throw new Error('Denied healthy care must not draw RNG.'); },
      });
      assert.deepEqual(noLog(next), noLog(state));
    }
  }
});

check('ration preview counts actual useful recipients and matches consumed stock', () => {
  const state = fixture('ration-exact-recipient-cost');
  state.inventory = { berry: 3 };
  state.party[0].hunger = 90;
  const row = choice(state, 'ration_break');
  assert.equal(row.enabled, true);
  assert.equal(row.costText, '식량 1개');
  const next = engine.runRecoveryChoiceAction(state, 'shiroko', 'ration_break', { rng: () => 0.99 });
  assert.equal(next.inventory.berry, 2);
  assert.equal(next.counters.meals, state.counters.meals + 1);
  assert.ok(next.party[0].hunger < state.party[0].hunger);
  assert.equal(next.party[1].hunger, 0);
  assert.equal(next.party[2].hunger, 0);
});

check('live run guidance ignores casualties and never counts medicine as nourishing food', () => {
  const state = fixture('live-report-casualty-guidance');
  state.inventory = { berry: 20, herb_tonic: 5 };
  state.weather = { id: 'clear', cold: 0, temp: 22, actionMod: 0 };
  state.party = state.party.map((member, index) => ({
    ...member, hp: index ? 0 : 100, hunger: index ? 100 : 0,
    stamina: index ? 0 : 100, bodyTemp: index ? 25 : 37,
  }));
  const original = structuredClone(state);
  const report = engine.getRunProgressReport(state, 'shiroko');
  assert.equal(report.foodUnits, 20);
  assert.equal(report.riskScore, 0);
  assert.doesNotMatch(report.recommendations.join(' '), /약초 달임|휴식/);
  assert.deepEqual(state, original);
  state.inventory = { herb_tonic: 5 };
  assert.equal(engine.getRunProgressReport(state, 'shiroko').foodUnits, 0);
});

console.log(`\n${checks} recovery-target checks passed.`);
