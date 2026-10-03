import assert from 'node:assert/strict';
import './lib/register-simulation-modules.mjs';
const engine = await import('../src/app/games/primitive-archive/_lib/primitiveArchiveEngine.js');

function fixture(overrides = {}) {
  const base = engine.createNewState({ rng: () => 0.5, runId: 'personal-night', now: '2026-10-03T00:00:00.000Z' });
  return engine.normalizeState({
    ...base, day: 20, ap: 1,
    weather: { id: 'snow', name: '눈', cold: 12, temp: -8, actionMod: 0 },
    camp: { ...base.camp, fireLevel: 0, shelterLevel: 0, workbenchLevel: 0, fuel: 0 },
    inventory: { berry: 30, wood: 8, stone: 8, fiber: 8, hide: 8 },
    equipment: { shiroko: { top: 'fur_coat' } },
    party: base.party.map((member) => ({ ...member, hp: 100, hunger: 0, stamina: 100, bodyTemp: 37 })),
    ...overrides,
  });
}

const noEvents = () => 0.999;
const failures = [];
let checks = 0;
function check(name, run) {
  try { run(); checks += 1; console.log(`PASS ${name}`); }
  catch (error) { failures.push({ name, message: error.message }); console.error(`FAIL ${name}: ${error.message}`); }
}
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} must equal ${expected}.`);

check('a coat protects its actual wearer at night rather than lending the party average to everybody', () => {
  const state = fixture(); const original = structuredClone(state);
  const next = engine.advanceDay(state, { rng: noEvents });
  const [clothed, naked, other] = next.party;
  assert.equal(clothed.hp, 96); assert.equal(clothed.hunger, 9); near(clothed.bodyTemp, 35.69);
  assert.equal(naked.hp, 81); assert.equal(naked.hunger, 12); near(naked.bodyTemp, 33.77);
  assert.equal(other.hp, naked.hp); near(other.bodyTemp, naked.bodyTemp);
  assert.deepEqual(state, original);
});

check('moving the same coat moves its protection and does not improve an unrelated companion', () => {
  const first = engine.advanceDay(fixture(), { rng: noEvents });
  const second = engine.advanceDay(fixture({ equipment: { hina: { top: 'fur_coat' } } }), { rng: noEvents });
  assert.equal(second.party[0].hp, first.party[1].hp);
  assert.equal(second.party[1].hp, first.party[0].hp);
  assert.deepEqual(second.party[2], first.party[2]);
});

check('identically dressed companions retain the existing uniform-party cold and snow balance', () => {
  const state = fixture({ equipment: { shiroko: { top: 'fur_coat' }, hina: { top: 'fur_coat' }, noa: { top: 'fur_coat' } } });
  for (const member of engine.advanceDay(state, { rng: noEvents }).party) {
    assert.equal(member.hp, 96); assert.equal(member.hunger, 9); near(member.bodyTemp, 35.69);
  }
});

check('clothing worn by a dead companion cannot shelter the living or revive its wearer', () => {
  const state = fixture(); state.party[0].hp = 0;
  const withoutCoat = { ...state, equipment: {} };
  const first = engine.advanceDay(state, { rng: noEvents });
  const second = engine.advanceDay(withoutCoat, { rng: noEvents });
  assert.equal(first.party[0].hp, 0);
  assert.deepEqual(first.party.slice(1), second.party.slice(1));
});

check('fire and shelter protect everyone while fuel is consumed once for the shared camp', () => {
  const state = fixture(); state.camp = { ...state.camp, fireLevel: 2, shelterLevel: 2, fuel: 1 };
  const next = engine.advanceDay(state, { rng: noEvents });
  assert.equal(next.camp.fuel, 0);
  for (const member of next.party) { assert.equal(member.hp, 100); assert.equal(member.hunger, 8); near(member.bodyTemp, 37.3); }
});

check('an empty fire lends no warmth but the actual wearer still benefits from a built shelter', () => {
  const state = fixture(); state.camp = { ...state.camp, fireLevel: 3, shelterLevel: 1, fuel: 0 };
  const next = engine.advanceDay(state, { rng: noEvents });
  assert.equal(next.camp.fuel, 0);
  assert.equal(next.party[0].hp, 99); near(next.party[0].bodyTemp, 36.41);
  assert.equal(next.party[1].hp, 84); near(next.party[1].bodyTemp, 34.49);
});

check('cold damage is rounded only after actual personal warmth and difficulty are applied', () => {
  for (const difficulty of ['veryeasy', 'easy', 'normal', 'hard', 'nightmare']) {
    const state = fixture({ difficulty });
    const next = engine.advanceDay(state, { rng: noEvents });
    assert.ok(next.party[0].hp > next.party[1].hp, `${difficulty}: a real coat must reduce exposure.`);
    assert.ok(next.party[0].bodyTemp > next.party[1].bodyTemp);
  }
});

check('a zero-cold clear night retains hunger and shared shelter recovery without inventing a clothing bonus', () => {
  const state = fixture({ weather: { id: 'clear', name: '맑음', cold: 0, temp: 12, actionMod: 0 } });
  const next = engine.advanceDay(state, { rng: noEvents });
  for (const member of next.party) { assert.equal(member.hp, 100); assert.equal(member.hunger, 8); near(member.bodyTemp, 37.65); }
});

check('automatic closing pays for real fuel even when well-clothed companions hide one bare companion from the mean', () => {
  const state = fixture(); state.weather.cold = 8;
  state.equipment = { hina: { top: 'fur_coat' }, noa: { top: 'fur_coat' } };
  state.camp = { ...state.camp, fireLevel: 2, shelterLevel: 1, workbenchLevel: 1, fuel: 0 };
  const next = engine.runAutoDayAction(state, { rng: noEvents });
  assert.equal(next.day, 21);
  assert.equal(next.inventory.wood, state.inventory.wood - 1 + Number(next.tribe.lastProduction.gains.wood || 0));
  assert.equal(next.camp.fuel, 1);
  assert.ok(next.log.some((line) => line.includes('모닥불 연료를 보충')));
  assert.ok(next.party.every((member) => member.hp === 100));
});

check('automatic closing strengthens an inadequate shared fire for the least-protected real companion', () => {
  const state = fixture();
  state.equipment = { hina: { top: 'fur_coat' }, noa: { top: 'fur_coat' } };
  state.camp = { ...state.camp, fireLevel: 1, shelterLevel: 1, workbenchLevel: 1, fuel: 1 };
  const next = engine.runAutoDayAction(state, { rng: noEvents });
  assert.equal(next.day, 21);
  assert.equal(next.camp.fireLevel, 2);
  assert.equal(next.inventory.wood, state.inventory.wood - 2 + Number(next.tribe.lastProduction.gains.wood || 0));
  assert.equal(next.inventory.stone, state.inventory.stone - 2 + Number(next.tribe.lastProduction.gains.stone || 0));
  assert.equal(next.camp.fuel, 0);
  assert.ok(next.party.every((member) => member.hp >= 99));
});

check('a missing camp and empty stock cannot grant imaginary fuel, warmth or survival', () => {
  const state = fixture({ equipment: {}, inventory: {}, ap: 1 });
  state.party = state.party.map((member) => ({ ...member, hp: 1, bodyTemp: 30, hunger: 100 }));
  const next = engine.runAutoDayAction(state, { rng: noEvents });
  assert.equal(next.camp.fireLevel, 0); assert.equal(next.camp.fuel, 0);
  assert.equal(next.day, 21); assert.equal(next.ended, true);
  assert.ok(Object.values(next.inventory).every((quantity) => quantity >= 0));
});

check('night forecasts are read-only, member-specific and match the next real daily settlement', () => {
  const state = fixture(); const original = structuredClone(state);
  const rows = engine.nightSurvivalRows(state);
  assert.deepEqual(state, original);
  assert.equal(rows.length, 3);
  assert.equal(rows[0].insulation, 4); assert.equal(rows[1].insulation, 0);
  const next = engine.advanceDay(state, { rng: noEvents });
  for (const row of rows) {
    const actual = next.party.find((member) => member.id === row.id);
    assert.equal(row.hp, actual.hp); assert.equal(row.hunger, actual.hunger); near(row.bodyTemp, actual.bodyTemp);
    assert.equal(row.currentHp - row.hp, row.damage);
    assert.equal(row.damage, row.coldDamage + row.hungerDamage + row.hypothermiaDamage);
  }
});

check('forecasts respond immediately to a real equipment change and omit dead members', () => {
  const state = fixture(); state.party[2].hp = 0;
  const first = engine.nightSurvivalRows(state);
  state.equipment = { hina: { top: 'fur_coat' } };
  const second = engine.nightSurvivalRows(state);
  assert.equal(first.length, 2); assert.equal(second.length, 2);
  assert.equal(first[0].hp, second[1].hp); assert.equal(first[1].hp, second[0].hp);
  assert.equal(second.some((row) => row.id === 'noa'), false);
});

check('ordinary JSON restoration keeps actual clothing and reproduces exposure without saving forecasts', () => {
  const state = fixture(); const restored = engine.normalizeState(JSON.parse(JSON.stringify(state)));
  assert.deepEqual(engine.nightSurvivalRows(restored), engine.nightSurvivalRows(state));
  const resumed = engine.advanceDay(restored, { rng: noEvents });
  const original = engine.advanceDay(state, { rng: noEvents });
  // Wall-clock log timestamps are not saved gameplay outcomes.
  delete resumed.updatedAt; delete original.updatedAt;
  assert.deepEqual(resumed, original);
  assert.equal(Object.hasOwn(restored, 'nightForecast'), false);
  assert.equal(engine.SAVE_VERSION, 'primitive-archive-v1');
});

console.log(JSON.stringify({ checks, pass: !failures.length, failures, evidence: 'current real engine, member-specific clothing, paid camp actions; no old result files or accounts' }));
if (failures.length) process.exitCode = 1;
