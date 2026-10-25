import assert from 'node:assert/strict';
import './lib/register-simulation-modules.mjs';
const engine = await import('../src/app/games/primitive-archive/_lib/primitiveArchiveEngine.js');

const base = engine.createNewState({ rng: () => 0.5, runId: 'settlement-care-check', now: '2026-10-25T00:00:00.000Z' });
const noEvents = () => 0.5;
const builderAssignments = Object.fromEntries(engine.TRIBE_JOBS.map((job) => [job.id, job.id === 'builder' ? 4 : 0]));
const noAutomaticWorkers = Object.fromEntries(engine.TRIBE_JOBS.map((job) => [job.id, 0]));

function fixture(overrides = {}) {
  return engine.normalizeState({
    ...base,
    day: 20,
    ap: 2,
    camp: { ...base.camp, fireLevel: 0, shelterLevel: 0, workbenchLevel: 0, fuel: 0 },
    weather: { id: 'clear', name: '맑음', temp: 16, cold: 0, actionMod: 0 },
    inventory: { berry: 0, wood: 0, cooked_meat: 0, packed_ration: 0, meat: 0, grain: 0, fish: 0, milk: 0, jerky: 0 },
    research: {
      ...base.research,
      completed: { ...base.research.completed, SETTLEMENT: true, FOOD_STORAGE: true },
    },
    tribe: {
      ...base.tribe,
      population: 4,
      assignments: { ...builderAssignments },
      autoAssignments: { ...noAutomaticWorkers },
    },
    party: base.party.map((member) => ({ ...member, hp: 100, hunger: 10, stamina: 70, bodyTemp: 37 })),
    ...overrides,
  });
}

let checks = 0;
const failures = [];
let manualDayReceipt = null;
function check(name, run) {
  try { run(); checks += 1; console.log(`PASS ${name}`); }
  catch (error) { failures.push({ name, message: error.message }); console.error(`FAIL ${name}: ${error.message}`); }
}

function assertNightMatchesForecast(state, next) {
  const rows = engine.nightSurvivalRows(state);
  for (const row of rows) {
    const actual = next.party.find((member) => member.id === row.id);
    assert.equal(row.hp, actual.hp, `${row.id} HP must match the prepared night projection.`);
    assert.equal(row.hunger, actual.hunger, `${row.id} hunger must match the prepared night projection.`);
    assert.ok(Math.abs(row.bodyTemp - actual.bodyTemp) < 1e-9, `${row.id} body temperature must match the prepared night projection.`);
  }
  return rows;
}

check('both settlement and food storage are required to unlock evening care', () => {
  for (const completed of [
    { SETTLEMENT: true, FOOD_STORAGE: false },
    { SETTLEMENT: false, FOOD_STORAGE: true },
  ]) {
    const state = fixture({
      camp: { ...base.camp, fireLevel: 1, fuel: 0 },
      weather: { id: 'snow', name: '눈', temp: -8, cold: 12, actionMod: 0 },
      inventory: { berry: 8, wood: 1 },
      research: { ...base.research, completed: { ...base.research.completed, ...completed } },
    });
    const summary = engine.survivalSupplySummary(state);
    const next = engine.advanceDay(state, { rng: noEvents });
    assert.equal(summary.careUnlocked, false);
    assert.equal(summary.woodSpent, 0);
    assert.deepEqual(summary.foodSpent, {});
    assert.equal(next.camp.fuel, 0);
    assert.equal(next.inventory.wood, 1);
    assert.equal(next.counters.meals, state.counters.meals);
    assert.ok(!next.log.some((line) => line.includes('정착지 저녁 관리')));
  }

  const ended = fixture({
    ended: true,
    camp: { ...base.camp, fireLevel: 1, fuel: 0 },
    weather: { id: 'snow', name: '눈', temp: -8, cold: 12, actionMod: 0 },
    inventory: { berry: 8, wood: 1 },
  });
  const endedSummary = engine.survivalSupplySummary(ended);
  const endedNext = engine.advanceDay(ended, { rng: noEvents });
  assert.equal(endedSummary.careActive, false);
  assert.equal(endedSummary.woodSpent, 0);
  assert.deepEqual(endedSummary.foodSpent, {});
  assert.equal(endedNext.camp.fuel, 0);
  assert.equal(endedNext.inventory.wood, 1);
  assert.equal(endedNext.counters.meals, ended.counters.meals);
  assert.ok(!endedNext.log.some((line) => line.includes('정착지 저녁 관리')));
});

check('cold-night fuel and high-hunger food use real stock while preserving tribe rations', () => {
  const state = fixture({
    camp: { ...base.camp, fireLevel: 1, shelterLevel: 0, fuel: 0 },
    weather: { id: 'snow', name: '눈', temp: -8, cold: 8, actionMod: 0 },
    inventory: { berry: 8, wood: 1 },
    party: base.party.map((member) => ({
      ...member,
      hp: 80,
      hunger: member.id === 'hina' ? 92 : member.id === 'shiroko' ? 88 : 10,
      bodyTemp: 37,
    })),
  });
  const original = structuredClone(state);
  const summary = engine.survivalSupplySummary(state);
  const rows = engine.nightSurvivalRows(state);
  assert.deepEqual(state, original, 'Forecasting cannot consume real inventory or modify party state.');
  assert.equal(summary.careUnlocked, true);
  assert.equal(summary.fuelNeeded, true);
  assert.equal(summary.woodSpent, 1);
  assert.equal(summary.fuelAdded, 2);
  assert.equal(summary.foodSpent.berry, 7);
  assert.equal(summary.peopleFed, 1, 'The hungriest survivor receives food first.');
  assert.equal(summary.rationNeed, 1);
  assert.equal(summary.rationStock - summary.foodSpent.berry, summary.rationNeed,
    'Evening care must keep the full next tribe ration in stock.');
  assert.equal(rows.find((row) => row.id === 'hina').hunger, 45);
  assert.equal(rows.find((row) => row.id === 'hina').warmth, 4);
  const restored = engine.normalizeState(JSON.parse(JSON.stringify(state)));
  assert.deepEqual(engine.survivalSupplySummary(restored), summary);
  assert.deepEqual(engine.nightSurvivalRows(restored), rows);
  const next = engine.advanceDay(state, { rng: noEvents });
  const restoredNext = engine.advanceDay(restored, { rng: noEvents });
  assert.deepEqual(restoredNext.party, next.party);
  assert.deepEqual(restoredNext.inventory, next.inventory);
  assert.deepEqual(restoredNext.camp, next.camp);
  assert.deepEqual(restoredNext.counters, next.counters);
  assertNightMatchesForecast(state, next);
  assert.equal(next.camp.fuel, 1, 'The two added fuel units pay the existing one-unit night cost.');
  assert.equal(next.inventory.wood, 0);
  assert.equal(next.inventory.berry, 0, 'The one reserved tribe portion is consumed only by the normal day settlement.');
  assert.equal(next.counters.meals - state.counters.meals, 7);
  assert.ok(next.log.some((line) => line.includes('정착지 저녁 관리') && line.includes('AP 소모 없음')));
});

check('food retains its existing nutrition, healing and warmth effects', () => {
  const state = fixture({
    party: base.party.map((member) => member.id === 'hina'
      ? { ...member, hp: 10, hunger: 92, bodyTemp: 35 }
      : { ...member, hp: 100, hunger: 0, bodyTemp: 37 }),
    inventory: { cooked_meat: 3 },
  });
  const summary = engine.survivalSupplySummary(state);
  assert.equal(summary.foodSpent.cooked_meat, 2);
  const rows = engine.nightSurvivalRows(state);
  const hina = rows.find((row) => row.id === 'hina');
  assert.equal(hina.hunger, 44);
  assert.equal(hina.hp, 10 + engine.ITEMS.cooked_meat.heal * 2);
  assert.ok(Math.abs(hina.bodyTemp - 36.55) < 1e-9, 'Two cooked meals retain the group-meal 0.45 warmth each before ordinary night recovery.');
  const next = engine.advanceDay(state, { rng: noEvents });
  assertNightMatchesForecast(state, next);
  assert.equal(next.counters.meals - state.counters.meals, 2);
});

check('two-day food forecast starts from stock after evening meals, without counting those portions again', () => {
  const state = fixture({
    inventory: { berry: 3 },
    party: base.party.map((member) => member.id === 'hina'
      ? { ...member, hunger: 92 }
      : { ...member, hunger: 0 }),
  });
  const summary = engine.survivalSupplySummary(state);
  assert.equal(summary.foodSpent.berry, 2);
  const prepared = engine.normalizeState({
    ...state,
    ended: true,
    inventory: { ...state.inventory, berry: state.inventory.berry - summary.foodSpent.berry },
    party: state.party.map((member) => member.id === 'hina'
      ? { ...member, hunger: member.hunger - summary.foodSpent.berry * engine.ITEMS.berry.nutrition }
      : member),
  });
  const forecastFromPreparedStock = engine.survivalSupplySummary(prepared).forecast;
  assert.deepEqual(summary.forecast, forecastFromPreparedStock);
  assert.deepEqual(summary.forecast.days.map((row) => row.shortage), [0, 1],
    'The remaining berry covers the current close; evening-consumed berries cannot also cover the following close.');
});

check('no food or firewood leaves the existing night costs intact and never revives dead members', () => {
  const state = fixture({
    camp: { ...base.camp, fireLevel: 1, shelterLevel: 0, fuel: 0 },
    weather: { id: 'snow', name: '눈', temp: -8, cold: 12, actionMod: 0 },
    inventory: {},
    party: base.party.map((member) => member.id === 'noa'
      ? { ...member, hp: 0, hunger: 100, bodyTemp: 30 }
      : { ...member, hp: 80, hunger: 90, bodyTemp: 32 }),
  });
  const summary = engine.survivalSupplySummary(state);
  const next = engine.advanceDay(state, { rng: noEvents });
  const rows = assertNightMatchesForecast(state, next);
  assert.equal(summary.fuelNeeded, true);
  assert.equal(summary.fuelShortage, true);
  assert.equal(summary.woodSpent, 0);
  assert.deepEqual(summary.foodSpent, {});
  assert.equal(next.camp.fuel, 0);
  assert.equal(next.party.find((member) => member.id === 'noa').hp, 0);
  assert.equal(next.party.find((member) => member.id === 'noa').hunger, 100);
  assert.ok(rows.every((row) => row.id !== 'noa'));
  assert.ok(next.party.find((member) => member.id === 'shiroko').hp < 80, 'Without real wood or food, ordinary night damage remains.');
  assert.equal(next.counters.meals, state.counters.meals);
});

check('a paid final rest still costs one AP and normal stamina while evening care adds no action or RNG', () => {
  const start = fixture({
    ap: 1,
    apMax: 4,
    camp: { ...base.camp, fireLevel: 1, shelterLevel: 0, fuel: 0 },
    weather: { id: 'snow', name: '눈', temp: -8, cold: 8, actionMod: 0 },
    inventory: { berry: 12, wood: 1 },
    party: base.party.map((member) => ({ ...member, hp: 80, hunger: 70, stamina: 45, bodyTemp: 34 })),
  });
  const previewStart = engine.normalizeState({ ...start, ap: 2 });
  let actualCalls = 0;
  let previewCalls = 0;
  const actualRng = () => { actualCalls += 1; return 0.5; };
  const previewRng = () => { previewCalls += 1; return 0.5; };
  const actual = engine.runRestAction(start, 'shiroko', { rng: actualRng });
  const preClose = engine.runRestAction(previewStart, 'shiroko', { rng: previewRng });
  const summary = engine.survivalSupplySummary(preClose);
  const rows = engine.nightSurvivalRows(preClose);
  const expected = engine.advanceDay(preClose, { rng: previewRng });
  assert.equal(actual.day, start.day + 1);
  assert.equal(actual.ap, actual.apMax);
  assert.equal(actualCalls, previewCalls, 'Evening management cannot consume random draws beyond the ordinary night roll.');
  assert.equal(actual.party.find((member) => member.id === 'shiroko').stamina,
    expected.party.find((member) => member.id === 'shiroko').stamina);
  assert.deepEqual(actual.counters, expected.counters);
  assert.deepEqual(actual.inventory, expected.inventory);
  assert.deepEqual(actual.camp, expected.camp);
  for (const row of rows) {
    const member = actual.party.find((candidate) => candidate.id === row.id);
    assert.equal(member.hp, row.hp);
    assert.equal(member.hunger, row.hunger);
    assert.ok(Math.abs(member.bodyTemp - row.bodyTemp) < 1e-9);
  }
  assert.equal(actual.counters.meals - start.counters.meals,
    Object.values(summary.foodSpent).reduce((sum, qty) => sum + qty, 0));
  assert.equal(actual.camp.fuel, 1);
  assert.equal(actual.inventory.wood, 0);
  assert.equal(actual.log.filter((line) => line.includes('휴식했습니다')).length, 1);
});

check('fifteen manual day-ending rests stay fed without meal AP and consume only finite stored food', () => {
  let state = fixture({
    day: 1,
    ap: 1,
    apMax: 1,
    camp: { ...base.camp, fireLevel: 0, shelterLevel: 0, workbenchLevel: 0, fuel: 0 },
    weather: { id: 'clear', name: '맑음', temp: 16, cold: 0, actionMod: 0 },
    inventory: { berry: 250 },
    party: base.party.map((member) => ({ ...member, hp: 100, hunger: 20, stamina: 70, bodyTemp: 37 })),
    tribe: {
      ...base.tribe,
      population: 6,
      assignments: Object.fromEntries(engine.TRIBE_JOBS.map((job) => [job.id, job.id === 'builder' ? 6 : 0])),
      autoAssignments: { ...noAutomaticWorkers },
    },
  });
  const initialBerry = state.inventory.berry;
  const initialMeals = state.counters.meals;
  let eveningFood = 0;
  for (let day = 0; day < 15; day += 1) {
    const previousDay = state.day;
    const previousMeals = state.counters.meals;
    state = engine.runRestAction(state, 'shiroko', { rng: noEvents });
    const used = state.counters.meals - previousMeals;
    eveningFood += used;
    assert.equal(state.day, previousDay + 1, 'The one paid action must close exactly one day.');
    assert.equal(state.ap, 1, 'No additional evening action may be charged.');
    assert.ok(state.party.every((member) => member.hp <= 0 || member.hunger <= 60), `Day ${state.day} should end with the living party fed.`);
    assert.ok(state.inventory.berry >= 0);
  }
  assert.ok(eveningFood > 0, 'Evening management must consume real food when forecasts require it.');
  assert.ok(state.inventory.berry < initialBerry, 'Finite stored food must decrease.');
  assert.equal(initialBerry - state.inventory.berry, eveningFood + 30,
    'Inventory loss is exactly evening portions plus the ordinary two-unit tribe ration for each day.');
  assert.equal(state.counters.meals - initialMeals, eveningFood);
  assert.equal(state.tribe.lastProduction.gains.berry, undefined, 'The fixture has no food-producing workers.');
  manualDayReceipt = { days: 15, paidRestActions: 15, eveningFoodItems: eveningFood, berryBefore: initialBerry, berryAfter: state.inventory.berry };
});

console.log(JSON.stringify({ checks, pass: failures.length === 0, manualDayReceipt, failures }));
if (failures.length) process.exitCode = 1;
