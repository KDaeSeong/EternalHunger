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

function clothingFixture(overrides = {}) {
  const base = fixture();
  return engine.normalizeState({
    ...base, day: 18, ap: 3,
    weather: { id: 'clear', name: '맑음', cold: 0, temp: 16, actionMod: 0 },
    camp: { ...base.camp, fireLevel: 3, shelterLevel: 3, workbenchLevel: 1, fuel: 12 },
    research: { ...base.research, completed: Object.fromEntries(engine.TECH_TREE.map((tech) => [tech.id, true])) },
    inventory: { berry: 30, hide: 12, fiber: 6, wood: 15, stone: 10, resin: 5, clay: 10, twine: 3 },
    equipment: {},
    counters: { ...base.counters, craft: 100, gather: 0 },
    ...overrides,
  });
}

function ownedEquipment(state, itemId) {
  return Number(state.inventory[itemId] || 0) + Object.values(state.equipment)
    .reduce((sum, slots) => sum + Object.values(slots).filter((id) => id === itemId).length, 0);
}

function firstRoll(value) {
  let first = true;
  return () => { if (!first) return 0.999; first = false; return value; };
}

function newlyCommittedMaterial(before, after, itemId) {
  return engine.TRIBE_PROJECTS.filter((project) => after.projects.resourceCommitted[project.id]
    && !before.projects.resourceCommitted[project.id])
    .reduce((sum, project) => sum + Number(project.cost[itemId] || 0), 0);
}

check('autumn operation makes and wears real basic clothing before archive work even when shared camp heat is sufficient', () => {
  const state = clothingFixture();
  const next = engine.runAutoDayAction(state, { rng: firstRoll(0) });
  assert.equal(ownedEquipment(next, 'hide_pants'), 1);
  assert.ok(engine.nightSurvivalRows(next).some((row) => row.insulation === 2));
  assert.equal(next.counters.craft, state.counters.craft + 1, 'Basic survival clothing must not be blocked by an unrelated gather/craft ratio.');
  assert.equal(next.inventory.hide, state.inventory.hide - 3 + Number(next.tribe.lastProduction.gains.hide || 0));
  assert.equal(next.inventory.fiber, state.inventory.fiber - 1 - newlyCommittedMaterial(state, next, 'fiber')
    + Number(next.tribe.lastProduction.gains.fiber || 0));
  assert.equal(Number(next.inventory.book_craft_guide || 0), 0);
  assert.ok(next.log.some((line) => line.includes('개인 보온 대비')));
});

check('the clothing plan is read-only and selects an unlocked affordable garment that improves a real unprotected survivor', () => {
  const state = clothingFixture(); const original = structuredClone(state);
  const plan = engine.autoWarmClothingPlan(state);
  assert.equal(plan.kind, 'craft'); assert.equal(plan.id, 'hide_pants'); assert.equal(plan.itemId, 'hide_pants');
  assert.deepEqual(plan.cost, { hide: 3, fiber: 1 });
  assert.deepEqual(state, original);
});

check('a failed automatic garment attempt pays real materials and cannot invent worn clothing', () => {
  const state = clothingFixture();
  const next = engine.runAutoDayAction(state, { rng: noEvents });
  assert.equal(ownedEquipment(next, 'hide_pants'), 0);
  assert.ok(engine.nightSurvivalRows(next).every((row) => row.insulation === 0));
  assert.equal(next.inventory.hide, state.inventory.hide - 3 + Number(next.tribe.lastProduction.gains.hide || 0));
  assert.equal(next.inventory.fiber, state.inventory.fiber - 1 - newlyCommittedMaterial(state, next, 'fiber')
    + Number(next.tribe.lastProduction.gains.fiber || 0));
  assert.ok(next.log.some((line) => line.includes('제작 실패')));
});

check('spring and summer warmth do not displace ordinary development with proactive winter garments', () => {
  for (const day of [3, 9, 27, 33]) assert.equal(engine.autoWarmClothingPlan(clothingFixture({ day })), null);
});

check('actual cold weather still permits affordable basic personal protection outside the winter season', () => {
  const state = clothingFixture({ day: 3, weather: { id: 'wind', name: '차가운 바람', cold: 5, temp: 4, actionMod: -0.04 } });
  assert.equal(engine.autoWarmClothingPlan(state).id, 'hide_pants');
});

check('clothing preparation retains the food, care, camp and remaining-action survival gates', () => {
  for (const changes of [
    { ap: 2 }, { ap: 1 }, { inventory: { hide: 12, fiber: 6 } },
    { camp: { fireLevel: 1, shelterLevel: 1, workbenchLevel: 0, fuel: 1 } },
    { ended: true },
  ]) assert.equal(engine.autoWarmClothingPlan(clothingFixture(changes)), null);
  for (const patch of [{ hunger: 75 }, { hp: 30 }, { stamina: 20 }, { bodyTemp: 33 }]) {
    const state = clothingFixture(); state.party[1] = { ...state.party[1], ...patch };
    assert.equal(engine.autoWarmClothingPlan(state), null);
  }
});

check('locked recipes and missing materials cannot become free garments or unlock bypasses', () => {
  const locked = clothingFixture(); locked.research.completed = {};
  assert.equal(engine.autoWarmClothingPlan(locked), null);
  assert.equal(engine.autoWarmClothingPlan(clothingFixture({ inventory: { berry: 30, wood: 15 } })), null);
});

check('already owned or worn warm garments count toward basic coverage instead of being duplicated', () => {
  const stocked = clothingFixture(); stocked.inventory.hide_pants = 3;
  assert.equal(engine.autoWarmClothingPlan(stocked), null);
  const equipped = engine.autoEquipAction(stocked, 'weather');
  assert.ok(engine.nightSurvivalRows(equipped).every((row) => row.insulation === 2));
  assert.equal(engine.autoWarmClothingPlan(equipped), null);
  assert.equal(ownedEquipment(engine.runAutoDayAction(stocked, { rng: noEvents }), 'hide_pants'), 3);
});

check('basic coverage completes through paid bounded crafting without endlessly clothing already protected companions', () => {
  let state = clothingFixture();
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const plan = engine.autoWarmClothingPlan(state);
    assert.equal(plan.id, 'hide_pants');
    state = engine.runCraftAction(state, 'noa', plan.id, { rng: firstRoll(0) });
    state = engine.autoEquipAction(state, 'weather');
    assert.equal(ownedEquipment(state, 'hide_pants'), attempt + 1);
    state = engine.normalizeState({ ...state, ap: 3, party: state.party.map((member) => ({ ...member, hp: 100, hunger: 0, stamina: 100, bodyTemp: 37 })) });
  }
  assert.ok(engine.nightSurvivalRows(state).every((row) => row.insulation >= 2));
  assert.equal(engine.autoWarmClothingPlan(state), null);
  assert.equal(state.inventory.hide, 3); assert.equal(state.inventory.fiber, 3);
});

check('automatic equipment redistribution protects living companions rather than leaving scarce clothing on a dead first member', () => {
  const state = clothingFixture(); state.party[0].hp = 0;
  state.equipment = { shiroko: { top: 'fur_coat' } }; state.inventory.hide_pants = 1;
  const next = engine.autoEquipAction(state, 'weather');
  assert.ok(Object.values(next.equipment.shiroko).every((id) => !id));
  assert.equal(ownedEquipment(next, 'fur_coat'), 1); assert.equal(ownedEquipment(next, 'hide_pants'), 1);
  assert.equal(next.party[0].hp, 0);
  assert.ok(engine.nightSurvivalRows(next).some((row) => row.insulation >= 2));
});

check('ordinary JSON restoration derives the same clothing plan and exact paid operation without storing a new forecast or changing RNG draws', () => {
  const state = clothingFixture(); const restored = engine.normalizeState(JSON.parse(JSON.stringify(state)));
  assert.deepEqual(engine.autoWarmClothingPlan(restored), engine.autoWarmClothingPlan(state));
  let firstDraws = 0; let restoredDraws = 0;
  const first = engine.runAutoDayAction(state, { rng: () => firstDraws++ === 0 ? 0 : 0.999 });
  const resumed = engine.runAutoDayAction(restored, { rng: () => restoredDraws++ === 0 ? 0 : 0.999 });
  delete first.updatedAt; delete resumed.updatedAt;
  assert.deepEqual(resumed, first); assert.equal(restoredDraws, firstDraws);
  assert.equal(Object.hasOwn(resumed, 'clothingPlan'), false);
  assert.equal(engine.SAVE_VERSION, 'primitive-archive-v1');
});

check('the same ordinary seeded runs acquire personal winter protection and still reach every archive objective', () => {
  function seededRng(seed) { let value = seed >>> 0; return () => { value = (value * 1664525 + 1013904223) >>> 0; return value / 0x100000000; }; }
  for (const seed of [3, 7, 43]) {
    const rng = seededRng(seed);
    let state = engine.createNewState({ rng, runId: `personal-clothing-${seed}`, now: '2026-10-03T00:00:00.000Z' });
    for (let day = 0; day < 120 && !state.ended; day += 1) {
      state = engine.runAutoDayAction(state, { rng });
      if (state.day === 49) assert.ok(engine.nightSurvivalRows(state).every((row) => row.insulation >= 2), `Seed ${seed} must not leave three survivors unprotected after two winters.`);
      if (state.day >= 49 && engine.archiveVictorySummary(state).canComplete) break;
    }
    assert.equal(state.ended, false); assert.equal(state.party.filter((member) => member.hp > 0).length, 3);
    assert.equal(engine.archiveVictorySummary(state).canComplete, true, `Seed ${seed} must keep all five real archive objectives.`);
  }
});

console.log(JSON.stringify({ checks, pass: !failures.length, failures, evidence: 'current real engine, member-specific clothing, paid camp actions; no old result files or accounts' }));
if (failures.length) process.exitCode = 1;
