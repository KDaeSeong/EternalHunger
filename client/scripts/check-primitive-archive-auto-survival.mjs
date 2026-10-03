import assert from 'node:assert/strict';
import './lib/register-simulation-modules.mjs';
const engine = await import('../src/app/games/primitive-archive/_lib/primitiveArchiveEngine.js');

function seededRng(seed) {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 0x100000000;
  };
}

function fixture(overrides = {}) {
  const base = engine.createNewState({ rng: () => 0.5, runId: 'auto-survival-check', now: '2026-10-03T00:00:00.000Z' });
  return engine.normalizeState({
    ...base,
    ap: 1,
    camp: { ...base.camp, fireLevel: 1, shelterLevel: 1, workbenchLevel: 1, fuel: 2 },
    inventory: { berry: 9 },
    party: base.party.map((member) => ({ ...member, hunger: 70, hp: 100, stamina: 100, bodyTemp: 37 })),
    // These controlled care cases compare automatic party actions with the
    // same paid manual action, independently of workforce redistribution.
    tribe: { ...base.tribe, autoAssignments: {} },
    ...overrides,
  });
}

let checks = 0;
const failures = [];
function check(name, run) {
  try {
    run();
    checks += 1;
    console.log(`PASS ${name}`);
  } catch (error) {
    failures.push({ name, message: error.message });
    console.error(`FAIL ${name}: ${error.message}`);
  }
}

const noEvents = () => 0.999;
const operationalFields = ['day', 'ap', 'party', 'inventory', 'camp', 'research', 'civics', 'counters', 'tribe'];
function expectSameOperation(actual, expected) {
  for (const key of operationalFields) assert.deepEqual(actual[key], expected[key], `Auto care must keep the real ${key} costs and effects.`);
}

check('hungry living party uses paid group rations within one AP', () => {
  const state = fixture();
  const original = structuredClone(state);
  const next = engine.runAutoDayAction(state, { rng: noEvents });
  assert.equal(next.counters.meals, 3);
  assert.ok(next.log.some((entry) => entry.includes('비상 배식 완료')));
  assert.equal(next.day, state.day + 1);
  assert.deepEqual(state, original, 'Auto care must not mutate its input.');
  assert.ok(next.inventory.berry < state.inventory.berry);
  expectSameOperation(next, engine.runRecoveryChoiceAction(state, 'shiroko', 'ration_break', { rng: noEvents }));
});

check('one hungry member does not waste food on the healthy members', () => {
  const state = fixture();
  state.party = state.party.map((member, index) => ({ ...member, hunger: index ? 0 : 70 }));
  const next = engine.runAutoDayAction(state, { rng: noEvents });
  assert.equal(next.counters.meals, 1);
  assert.ok(!next.log.some((entry) => entry.includes('비상 배식 완료')));
});

function rationPriorityFixture(overrides = {}) {
  const state = fixture({ inventory: { cooked_meat: 1 }, ...overrides });
  state.weather = { ...state.weather, cold: 0, id: 'clear' };
  state.party = state.party.map((member, index) => ({
    ...member,
    hp: index === 1 ? 4 : 80,
    hunger: index === 1 ? 94 : index === 0 ? 99 : 85,
  }));
  return state;
}

check('the last automatic meal protects a critically injured starving survivor before a healthier hungrier member', () => {
  const state = rationPriorityFixture();
  const original = structuredClone(state);
  const next = engine.runAutoDayAction(state, { rng: noEvents });
  assert.ok(next.party.find((member) => member.id === 'hina').hp > 0, 'A usable meal must not be allocated away from a survivor who would die tonight.');
  assert.equal(next.counters.meals, 1);
  assert.ok(next.log.some((entry) => entry.includes('생존 우선 배분') && entry.includes('히나')));
  expectSameOperation(next, engine.runEatAction(state, 'hina', { rng: noEvents }));
  assert.deepEqual(state, original);
});

check('scarce group rations feed critically injured starving members before healthier recipients', () => {
  const state = rationPriorityFixture({ inventory: { cooked_meat: 2 } });
  state.party[1].hunger = 80;
  state.party[2].hunger = 94;
  const next = engine.runRecoveryChoiceAction(state, 'shiroko', 'ration_break', { rng: noEvents });
  assert.ok(next.party.find((member) => member.id === 'hina').hp > 0);
  assert.equal(next.counters.meals, 2);
  assert.equal(next.party.find((member) => member.id === 'noa').hunger, 100, 'The third, healthier recipient waits when only two actual meals exist.');
  assert.ok(next.log.some((entry) => entry.includes('생존 우선 배분') && entry.includes('히나')));
});

check('equally starving critical members receive scarce food in order of actual remaining HP', () => {
  const state = rationPriorityFixture();
  state.party[0].hp = 20;
  state.party[0].hunger = 100;
  const next = engine.runAutoDayAction(state, { rng: noEvents });
  expectSameOperation(next, engine.runEatAction(state, 'hina', { rng: noEvents }));
});

check('ordinary hunger ordering stays unchanged when nobody is critically injured and starving', () => {
  const state = rationPriorityFixture();
  state.party = state.party.map((member) => ({ ...member, hp: 80 }));
  const next = engine.runAutoDayAction(state, { rng: noEvents });
  expectSameOperation(next, engine.runEatAction(state, 'shiroko', { rng: noEvents }));
  assert.ok(!next.log.some((entry) => entry.includes('생존 우선 배분')));
});

check('low HP alone does not divert a scarce meal from someone actually starving', () => {
  const state = rationPriorityFixture();
  state.party[1].hunger = 20;
  const next = engine.runAutoDayAction(state, { rng: noEvents });
  expectSameOperation(next, engine.runEatAction(state, 'shiroko', { rng: noEvents }));
});

check('scarce food priority is derived again after ordinary JSON restoration without reviving dead members', () => {
  const state = rationPriorityFixture();
  state.party[2].hp = 0;
  state.party[2].hunger = 100;
  const loaded = engine.normalizeState(JSON.parse(JSON.stringify(state)));
  const next = engine.runAutoDayAction(loaded, { rng: noEvents });
  assert.ok(next.party.find((member) => member.id === 'hina').hp > 0);
  assert.equal(next.party.find((member) => member.id === 'noa').hp, 0);
  expectSameOperation(next, engine.runEatAction(loaded, 'hina', { rng: noEvents }));
});

check('medicine is not consumed as a zero-nutrition meal', () => {
  const state = fixture({ inventory: { herb_tonic: 3 } });
  state.research.completed.FISHING = true;
  const next = engine.runAutoDayAction(state, { rng: () => 0.1 });
  assert.equal(next.inventory.herb_tonic, 3);
  assert.equal(next.counters.meals, 0);
  assert.equal(next.counters.fish, 1);
});

check('empty food stock uses unlocked fishing before random gathering', () => {
  const state = fixture({ inventory: {} });
  state.research.completed.FISHING = true;
  const next = engine.runAutoDayAction(state, { rng: () => 0.1 });
  assert.equal(next.counters.fish, 1);
  assert.equal(next.counters.gather, 0);
  assert.equal(engine.canSelectActionZone(state), false, 'Fishing must work without bypassing the map unlock.');
});

check('cooking uses real meat and fuel, then feeds the party', () => {
  const state = fixture({ ap: 2, inventory: { meat: 6 } });
  const next = engine.runAutoDayAction(state, { rng: noEvents });
  assert.ok(next.log.some((entry) => entry.includes('고기를 구웠습니다')));
  assert.ok(next.log.some((entry) => entry.includes('비상 배식 완료')));
  assert.equal(next.counters.meals, 3);
  assert.equal(next.camp.fuel, 0, 'Cooking and the overnight fire each consume one fuel.');
  assert.ok(next.inventory.meat < state.inventory.meat);
});

check('last AP is spent eating instead of cooking a meal for tomorrow', () => {
  const state = fixture({ inventory: { meat: 1 } });
  const next = engine.runAutoDayAction(state, { rng: noEvents });
  assert.equal(next.counters.meals, 1);
  assert.ok(!next.log.some((entry) => entry.includes('고기를 구웠습니다')));
});

check('zero fuel is paid for before cooking when three AP remain', () => {
  const state = fixture({ ap: 3, inventory: { meat: 6, wood: 1 } });
  state.camp.fuel = 0;
  const next = engine.runAutoDayAction(state, { rng: noEvents });
  assert.ok(next.log.some((entry) => entry.includes('모닥불 연료를 보충했습니다')));
  assert.ok(next.log.some((entry) => entry.includes('고기를 구웠습니다')));
  assert.ok(next.log.some((entry) => entry.includes('비상 배식 완료')));
  assert.equal(next.counters.meals, 3);
});

check('critical party injuries use existing paid first aid, not one-member rest', () => {
  const state = fixture({ inventory: { herb_tonic: 1 } });
  state.party = state.party.map((member) => ({ ...member, hp: 10, hunger: 0 }));
  const next = engine.runAutoDayAction(state, { rng: noEvents });
  assert.ok(next.log.some((entry) => entry.includes('전원 HP +14')));
  assert.equal(next.inventory.herb_tonic, 0);
  assert.ok(next.party.every((member) => member.hp > 10));
  expectSameOperation(next, engine.runRecoveryChoiceAction(state, 'shiroko', 'field_tonic', { rng: noEvents }));
});

check('field medicine pays unlocked herbs and a berry rather than gifting recovery', () => {
  const state = fixture({ inventory: { herb: 2, berry: 1 } });
  state.party = state.party.map((member) => ({ ...member, hp: 10, hunger: 0 }));
  state.research.completed.HERBALISM = true;
  const next = engine.runAutoDayAction(state, { rng: noEvents });
  assert.equal(next.inventory.herb, 0);
  assert.ok(next.log.some((entry) => entry.includes('전원 HP +8')));
  expectSameOperation(next, engine.runRecoveryChoiceAction(state, 'shiroko', 'field_tonic', { rng: noEvents }));
});

check('dead members are neither fed nor resurrected by collective care', () => {
  const state = fixture();
  state.party[0].hp = 0;
  const next = engine.runAutoDayAction(state, { rng: noEvents });
  assert.equal(next.counters.meals, 2);
  assert.equal(next.party[0].hp, 0);
  expectSameOperation(next, engine.runRecoveryChoiceAction(state, 'hina', 'ration_break', { rng: noEvents }));
});

check('unresearched food production remains locked and real fishing may still fail', () => {
  const state = fixture({ inventory: {} });
  const locked = engine.runAutoDayAction(state, { rng: noEvents });
  assert.equal(locked.counters.fish, 0);
  assert.equal(locked.counters.farm, 0);
  state.research.completed.FISHING = true;
  const failed = engine.runAutoDayAction(state, { rng: noEvents });
  const fishing = state.party.map((member) => ({
    actorId: member.id,
    row: engine.specializedActionRows(state, member.id).find((row) => row.id === 'fish'),
  })).sort((a, b) => b.row.chance - a.row.chance)[0];
  assert.ok(failed.log.some((entry) => entry.includes(`${fishing.row.label} 실패`)));
  assert.equal(failed.counters.fish, 0, 'Fishing counts successful production, not failed attempts.');
  assert.equal(Number(failed.inventory.fish || 0), 0);
  assert.equal(failed.day, state.day + 1, 'A failed attempt still consumes the last AP.');
  expectSameOperation(failed, engine.runSpecializedAction(state, fishing.actorId, 'fish', '', { rng: noEvents }));
  assert.equal(failed.devTools.enabled, false);
});

check('ordinary survival care neither invents ingredients nor changes map selection', () => {
  const state = fixture({ inventory: {}, ap: 1 });
  state.party = state.party.map((member) => ({ ...member, hp: 10, hunger: 0 }));
  const next = engine.runAutoDayAction(state, { rng: noEvents });
  assert.ok(!next.log.some((entry) => entry.includes('전원 HP +')));
  assert.equal(Number(next.inventory.herb_tonic || 0), 0);
  assert.equal(engine.canSelectActionZone(next), false);
});

check('completed or exhausted runs spend no additional meals, medicine or AP', () => {
  for (const overrides of [{ ended: true }, { ap: 0 }]) {
    const state = fixture({ inventory: { meat: 6, herb_tonic: 3 }, ...overrides });
    expectSameOperation(engine.runAutoDayAction(state, { rng: noEvents }), state);
  }
});

const naturalRuns = [];
function coldFixture(overrides = {}) {
  const state = fixture({
    inventory: { wood: 1 },
    camp: { fireLevel: 1, shelterLevel: 0, workbenchLevel: 0, fuel: 0 },
    ...overrides,
  });
  state.equipment = {};
  state.weather = { ...state.weather, id: 'snow', cold: 12 };
  state.party = state.party.map((member) => ({ ...member, hp: 100, hunger: 0, stamina: 100, bodyTemp: 37 }));
  return state;
}

check('an empty campfire gives no free night heat but stocked fire pays one fuel', () => {
  const unlit = coldFixture();
  const original = structuredClone(unlit);
  const lit = { ...unlit, camp: { ...unlit.camp, fuel: 1 } };
  const coldNight = engine.advanceDay(unlit, { rng: noEvents });
  const warmNight = engine.advanceDay(lit, { rng: noEvents });
  assert.equal(coldNight.party[0].hp, 81);
  assert.equal(warmNight.party[0].hp, 92);
  assert.ok(Math.abs(coldNight.party[0].bodyTemp - 33.77) < 1e-9);
  assert.ok(Math.abs(warmNight.party[0].bodyTemp - 34.73) < 1e-9);
  assert.equal(coldNight.camp.fuel, 0);
  assert.equal(warmNight.camp.fuel, 0, 'The last fuel protects this night and is then consumed.');
  assert.ok(coldNight.log.some((line) => line.includes('모닥불 보온 없이')));
  assert.deepEqual(unlit, original);
});

check('an empty campfire gives no free warmth during ordinary paid actions either', () => {
  const unlit = coldFixture({ ap: 2 });
  const lit = { ...unlit, camp: { ...unlit.camp, fuel: 1 } };
  const coldTurn = engine.afterAction(unlit, 'shiroko', 0, 0, { rng: noEvents });
  const warmTurn = engine.afterAction(lit, 'shiroko', 0, 0, { rng: noEvents });
  assert.ok(Math.abs((warmTurn.party[0].bodyTemp - coldTurn.party[0].bodyTemp) - 0.02275) < 1e-9);
  assert.equal(warmTurn.camp.fuel, 1, 'Ordinary turns do not add a second overnight fuel charge.');
  assert.equal(coldTurn.day, unlit.day);
  assert.equal(warmTurn.day, lit.day);
});

check('shelter warmth remains available without fuel and fuel alone cannot replace a built fire', () => {
  const sheltered = coldFixture();
  sheltered.camp.shelterLevel = 3;
  sheltered.weather.cold = 7;
  const noFire = { ...sheltered, camp: { ...sheltered.camp, fireLevel: 0, fuel: 3 } };
  const emptyFire = { ...sheltered, camp: { ...sheltered.camp, fireLevel: 3, fuel: 0 } };
  const one = engine.advanceDay(noFire, { rng: noEvents });
  const two = engine.advanceDay(emptyFire, { rng: noEvents });
  assert.deepEqual(one.party, two.party);
  assert.equal(one.party[0].hp, 100);
  assert.equal(one.camp.fuel, 3);
  assert.equal(two.camp.fuel, 0);
});

check('the last automatic AP fuels a cold night with real wood instead of studying', () => {
  const state = coldFixture();
  const next = engine.runAutoDayAction(state, { rng: noEvents });
  assert.ok(next.log.some((line) => line.includes('모닥불 연료를 보충했습니다')));
  assert.equal(next.inventory.wood, state.inventory.wood - 1 + Number(next.tribe.lastProduction.gains.wood || 0));
  assert.equal(next.camp.fuel, 1, 'Wood creates two fuel; the night consumes one.');
  assert.equal(next.day, state.day + 1);
  // The acting member also pays the ordinary turn's temperature loss;
  // real overnight tribe production must not be mistaken for free fuel.
  expectSameOperation(next, engine.runCampAction(state, 'noa', 'fuel', { rng: noEvents }));
});

check('automatic cooking does not consume the last cold-night fuel without time or wood to refill it', () => {
  const state = coldFixture({ ap: 2, inventory: { meat: 6 } });
  state.camp.fuel = 1;
  state.party = state.party.map((member) => ({ ...member, hunger: 46 }));
  const next = engine.runAutoDayAction(state, { rng: noEvents });
  assert.ok(next.counters.meals >= 3, 'The party can eat real uncooked food without burning its night reserve.');
  assert.ok(!next.log.some((line) => line.includes('고기를 구웠습니다')));
  assert.ok(next.log.some((line) => line.includes('모닥불 연료를 1 소비했습니다')));
  assert.equal(next.camp.fuel, 0);
});

check('automatic cooking refills real fuel first when three actions and wood are available', () => {
  const state = coldFixture({ ap: 3, inventory: { meat: 6, wood: 1 } });
  state.camp.fuel = 1;
  state.party = state.party.map((member) => ({ ...member, hunger: 70 }));
  const next = engine.runAutoDayAction(state, { rng: noEvents });
  assert.ok(next.log.some((line) => line.includes('모닥불 연료를 보충했습니다')));
  assert.ok(next.log.some((line) => line.includes('고기를 구웠습니다')));
  assert.equal(next.counters.meals, 3);
  assert.equal(next.inventory.wood, state.inventory.wood - 1 + Number(next.tribe.lastProduction.gains.wood || 0));
  assert.equal(next.camp.fuel, 1, 'One wood, one cooking payment and one overnight payment reconcile exactly.');
});

check('automatic heating cannot create fuel from nothing or preempt hungry meals without hypothermia risk', () => {
  const noWood = coldFixture({ inventory: {} });
  const stranded = engine.runAutoDayAction(noWood, { rng: noEvents });
  assert.equal(stranded.camp.fuel, 0);
  assert.ok(!stranded.log.some((line) => line.includes('모닥불 연료를 보충했습니다')));
  const starving = coldFixture({ inventory: { berry: 6, wood: 1 } });
  starving.weather.cold = 5;
  starving.party = starving.party.map((member) => ({ ...member, hunger: 90 }));
  const fed = engine.runAutoDayAction(starving, { rng: noEvents });
  assert.equal(fed.counters.meals, 3);
  assert.ok(!fed.log.some((line) => line.includes('모닥불 연료를 보충했습니다')));
});

check('starving survivors pay for night fuel when eating alone would leave them exposed to hypothermia', () => {
  const state = coldFixture({ inventory: { berry: 6, wood: 1 } });
  state.party = state.party.map((member) => ({ ...member, hunger: 90 }));
  const original = structuredClone(state);
  const next = engine.runAutoDayAction(state, { rng: noEvents });
  const mealsOnly = engine.runRecoveryChoiceAction(state, 'noa', 'ration_break', { rng: noEvents });
  assert.ok(next.log.some((line) => line.includes('저체온 위험:')));
  assert.ok(next.party.every((member, index) => member.hp > mealsOnly.party[index].hp));
  assert.equal(next.counters.meals, 0);
  expectSameOperation(next, engine.runCampAction(state, 'noa', 'fuel', { rng: noEvents }));
  assert.deepEqual(state, original);
});

check('sufficient passive shelter keeps hungry meals ahead of unnecessary emergency heating', () => {
  const state = coldFixture({ inventory: { berry: 6, wood: 1 } });
  state.camp.shelterLevel = 3;
  state.party = state.party.map((member) => ({ ...member, hunger: 90 }));
  const next = engine.runAutoDayAction(state, { rng: noEvents });
  assert.equal(next.counters.meals, 3);
  assert.ok(!next.log.some((line) => line.includes('저체온 위험:')));
  assert.ok(!next.log.some((line) => line.includes('모닥불 연료를 보충했습니다')));
});

check('starving survivors improve an insufficient lit fire with real materials instead of ignoring projected hypothermia', () => {
  const state = coldFixture({ inventory: { wood: 2, stone: 2 } });
  state.weather.cold = 14;
  state.camp.fuel = 1;
  state.party = state.party.map((member) => ({ ...member, hunger: 90 }));
  const next = engine.runAutoDayAction(state, { rng: noEvents });
  assert.equal(next.camp.fireLevel, 2);
  assert.equal(next.camp.fuel, 0);
  expectSameOperation(next, engine.runCampAction(state, 'noa', 'fire', { rng: noEvents }));
});

check('automatic survival strengthens an inadequate lit camp before spending the last AP on development', () => {
  const state = coldFixture({ inventory: { wood: 2, stone: 2 } });
  state.camp.fuel = 1;
  const next = engine.runAutoDayAction(state, { rng: noEvents });
  assert.equal(next.camp.fireLevel, 2);
  assert.equal(next.camp.fuel, 0);
  assert.equal(next.inventory.wood, Number(next.tribe.lastProduction.gains.wood || 0));
  assert.equal(Number(next.inventory.stone || 0), 0);
  expectSameOperation(next, engine.runCampAction(state, 'noa', 'fire', { rng: noEvents }));
});

check('automatic cold protection can pay for shelter when the fire is already at its cap', () => {
  const state = coldFixture({ inventory: { wood: 3, fiber: 2, hide: 1 } });
  state.camp.fireLevel = 3;
  state.camp.fuel = 1;
  state.weather.cold = 20;
  const next = engine.runAutoDayAction(state, { rng: noEvents });
  assert.equal(next.camp.fireLevel, 3);
  assert.equal(next.camp.shelterLevel, 1);
  expectSameOperation(next, engine.runCampAction(state, 'noa', 'shelter', { rng: noEvents }));
});

function tribeFixture(overrides = {}) {
  const state = fixture({
    day: 2,
    inventory: {},
    camp: { fireLevel: 3, shelterLevel: 3, workbenchLevel: 2, fuel: 10 },
    ...overrides,
  });
  state.weather = { ...state.weather, cold: 0 };
  state.party = state.party.map((member) => ({ ...member, hp: 100, hunger: 0, stamina: 100, bodyTemp: 37 }));
  state.tribe.population = 5;
  state.research.completed = { GATHERING: true, HUNTING: true, STONE_TOOLS: true, AGRICULTURE: true };
  return state;
}

check('new tribe workers produce food before logging when next-day rations would be short', () => {
  const state = tribeFixture();
  const original = structuredClone(state);
  const next = engine.runAutoDayAction(state, { rng: noEvents });
  assert.equal(next.tribe.assignments.farmer, 1);
  assert.equal(next.tribe.assignments.logger, 0);
  assert.equal(next.tribe.lastProduction.shortage, 0);
  assert.equal(next.tribe.lastProduction.gains.grain, 1);
  assert.ok(next.log.some((line) => line.includes('식량 부족 예방')));
  assert.equal(next.day, state.day + 1);
  assert.deepEqual(state, original);
});

check('new workers plan beyond an even-day hunt payout instead of starving on the following day', () => {
  const state = tribeFixture({ day: 1 });
  const next = engine.runAutoDayAction(state, { rng: noEvents });
  assert.equal(next.tribe.assignments.farmer, 1);
  const following = engine.advanceDay(next, { rng: noEvents });
  assert.equal(next.tribe.lastProduction.shortage, 0);
  assert.equal(following.tribe.lastProduction.shortage, 0);
});

check('primitive food assignment remains available without inventing researched farming or fishing', () => {
  const state = tribeFixture();
  state.research.completed = { GATHERING: true, HUNTING: true, STONE_TOOLS: true };
  const next = engine.runAutoDayAction(state, { rng: noEvents });
  assert.equal(next.tribe.assignments.farmer, 0);
  assert.equal(next.tribe.assignments.fisher, 0);
  assert.equal(next.tribe.assignments.forager, 3);
  assert.equal(next.tribe.lastProduction.shortage, 0);
});

check('multiple new workers recompute food pressure without starving other useful jobs', () => {
  const state = tribeFixture();
  state.tribe.population = 9;
  const next = engine.runAutoDayAction(state, { rng: noEvents });
  assert.equal(next.tribe.assignments.farmer, 2);
  assert.equal(next.tribe.assignments.logger, 1);
  assert.equal(Object.values(next.tribe.assignments).reduce((sum, count) => sum + count, 0), 9);
  assert.equal(next.tribe.lastProduction.foodNeed, 3);
  assert.equal(next.tribe.lastProduction.shortage, 0);
});

check('sufficient real food stock preserves development-oriented allocation', () => {
  const state = tribeFixture({ inventory: { berry: 20 } });
  const next = engine.runAutoDayAction(state, { rng: noEvents });
  assert.equal(next.tribe.assignments.logger, 1);
  assert.equal(next.tribe.assignments.farmer, 0);
  assert.ok(!next.log.some((line) => line.includes('식량 부족 예방')));
});

check('primitive tribe rations alone do not discard the existing low-stock food reserve priority', () => {
  const state = tribeFixture({ inventory: { meat: 1 } });
  state.camp.workbenchLevel = 0;
  state.tribe.population = 6;
  state.tribe.assignments.hunter = 2;
  state.research.completed = {};
  assert.equal(engine.tribeSummary(state).foodForecast.totalShortage, 0);
  const next = engine.runAutoDayAction(state, { rng: noEvents });
  assert.equal(next.tribe.assignments.forager, 3);
  assert.equal(next.tribe.assignments.hunter, 2);
});

check('automatic assignment neither steals existing manual workers nor invents extra population', () => {
  const state = tribeFixture();
  state.tribe.assignments = Object.fromEntries(engine.TRIBE_JOBS.map((job) => [job.id, job.id === 'logger' ? 5 : 0]));
  const next = engine.runAutoDayAction(state, { rng: noEvents });
  assert.deepEqual(next.tribe.assignments, state.tribe.assignments);
  assert.equal(next.tribe.assignmentSerial, state.tribe.assignmentSerial);
  assert.equal(next.tribe.lastProduction.shortage, 2, 'An existing manual allocation may still be insufficient; do not conceal it.');
});

check('tribe food forecast is read-only and matches two actual paid daily settlements', () => {
  const state = tribeFixture({ inventory: { berry: 1 } });
  const original = structuredClone(state);
  const forecast = engine.tribeSummary(state).foodForecast;
  assert.equal(forecast.days.length, 2);
  const one = engine.advanceDay(state, { rng: noEvents });
  const two = engine.advanceDay(one, { rng: noEvents });
  for (const [index, actual] of [one, two].entries()) {
    const row = forecast.days[index];
    const production = actual.tribe.lastProduction;
    assert.equal(row.day, actual.day);
    assert.equal(row.produced, engine.tribeSummary({ ...actual, inventory: production.gains }).foodStock);
    assert.equal(row.need, production.foodNeed);
    assert.equal(row.provided, production.foodProvided);
    assert.equal(row.shortage, production.shortage);
    assert.equal(row.reserve, engine.tribeSummary(actual).foodStock);
    assert.deepEqual(row.spent, production.foodSpent);
  }
  assert.deepEqual(state, original);
});

check('food forecasts use real whole-item portions rather than treating medicine or high-value rations as fractional food', () => {
  const state = tribeFixture({ inventory: { packed_ration: 1, herb_tonic: 10 } });
  state.tribe.assignments = Object.fromEntries(engine.TRIBE_JOBS.map((job) => [job.id, job.id === 'builder' ? 5 : 0]));
  const forecast = engine.tribeSummary(state).foodForecast;
  assert.equal(forecast.days[0].available, 3);
  assert.equal(forecast.days[0].provided, 3);
  assert.deepEqual(forecast.days[0].spent, { packed_ration: 1 });
  assert.equal(forecast.days[0].reserve, 0);
  assert.equal(forecast.days[1].shortage, 2);
  assert.equal(forecast.totalShortage, 2);
});

check('food forecasts honor locked saved jobs and ordinary job changes cost no AP or food', () => {
  const state = tribeFixture();
  delete state.research.completed.AGRICULTURE;
  state.tribe.assignments = Object.fromEntries(engine.TRIBE_JOBS.map((job) => [job.id, job.id === 'farmer' ? 4 : 0]));
  assert.equal(engine.tribeSummary(state).foodForecast.days[0].produced, 0);
  const blocked = engine.adjustTribeJobAction(state, 'farmer', 1);
  assert.deepEqual(blocked.tribe.assignments, state.tribe.assignments);
  const assigned = engine.adjustTribeJobAction(state, 'forager', 1);
  assert.equal(assigned.ap, state.ap);
  assert.deepEqual(assigned.inventory, state.inventory);
  assert.equal(assigned.tribe.assignments.forager, 1);
  assert.equal(engine.tribeSummary(assigned).foodForecast.days[0].produced, 1);
});

check('ordinary JSON save restoration retains tribe allocation and regenerates the same food forecast', () => {
  const state = tribeFixture({ inventory: { cooked_meat: 2, fish: 1 } });
  const restored = engine.normalizeState(JSON.parse(JSON.stringify(state)));
  assert.ok(engine.tribeSummary(restored).foodForecast);
  assert.deepEqual(restored.tribe, state.tribe);
  assert.deepEqual(engine.tribeSummary(restored).foodForecast, engine.tribeSummary(state).foodForecast);
  assert.equal(engine.SAVE_VERSION, 'primitive-archive-v1');
});

function automaticTribeFixture(overrides = {}) {
  const state = tribeFixture(overrides);
  state.tribe.population = 4;
  state.tribe.autoAssignments = { ...state.tribe.assignments };
  return state;
}

check('automatic workers leave a locked construction job for real primitive food production', () => {
  const state = automaticTribeFixture();
  state.research.completed = {};
  state.camp.workbenchLevel = 0;
  const original = structuredClone(state);
  const next = engine.runAutoDayAction(state, { rng: noEvents });
  assert.equal(next.tribe.assignments.builder, 0);
  assert.equal(next.tribe.assignments.forager, 3);
  assert.equal(next.tribe.assignments.farmer, 0);
  assert.equal(next.tribe.lastProduction.gains.berry, 2);
  assert.equal(next.tribe.lastProduction.shortage, 0);
  assert.equal(next.tribe.assignments.scholar, 0);
  assert.deepEqual(next.tribe.autoAssignments, next.tribe.assignments);
  assert.ok(next.log.some((line) => line.includes('건설대 -1') && line.includes('채집대 +1')));
  assert.deepEqual(state, original);
});

check('idle automatic construction stops when the selected project has no materials or is already finished', () => {
  for (const completed of [false, true]) {
    const state = automaticTribeFixture({ inventory: { berry: 20 } });
    if (completed) state.projects.completed['drying-rack'] = true;
    const next = engine.runAutoDayAction(state, { rng: noEvents });
    assert.equal(next.tribe.assignments.builder, 0);
    assert.equal(next.tribe.lastProduction.projectWork, 0);
    assert.equal(Boolean(next.projects.resourceCommitted['drying-rack']), false);
    assert.equal(Object.values(next.tribe.assignments).reduce((sum, count) => sum + count, 0), state.tribe.population);
  }
});

check('automatic builders return to an affordable project and pay its real material and work costs', () => {
  const state = automaticTribeFixture({ inventory: { berry: 20, wood: 3, fiber: 2 } });
  state.tribe.assignments = { ...state.tribe.assignments, hunter: 2, builder: 0 };
  state.tribe.autoAssignments = { ...state.tribe.assignments };
  const next = engine.runAutoDayAction(state, { rng: noEvents });
  assert.equal(next.tribe.assignments.builder, 1);
  assert.equal(next.tribe.assignments.hunter, 1);
  assert.equal(next.projects.resourceCommitted['drying-rack'], true);
  assert.equal(next.projects.progress['drying-rack'], 1);
  assert.equal(next.tribe.lastProduction.projectWork, 1);
  assert.equal(next.inventory.wood, state.inventory.wood + next.tribe.lastProduction.gains.wood - 3);
  assert.equal(next.inventory.fiber, 0);
  assert.equal(Boolean(next.projects.completed['drying-rack']), false);
});

check('already committed construction keeps working without paying its materials twice', () => {
  const state = automaticTribeFixture({ inventory: { berry: 20 } });
  state.projects.resourceCommitted['drying-rack'] = true;
  state.projects.progress['drying-rack'] = 2;
  const next = engine.runAutoDayAction(state, { rng: noEvents });
  assert.equal(next.tribe.assignments.builder, 1);
  assert.equal(next.projects.progress['drying-rack'], 3);
  assert.equal(next.tribe.lastProduction.projectStarted, false);
  assert.equal(next.inventory.wood, next.tribe.lastProduction.gains.wood);
  assert.equal(Number(next.inventory.fiber || 0), Number(next.tribe.lastProduction.gains.fiber || 0));
});

check('manual job edits protect their current workers while automatic peers remain movable', () => {
  const state = automaticTribeFixture();
  state.research.completed = {};
  const edited = engine.adjustTribeJobAction(state, 'forager', -1);
  assert.equal(edited.tribe.autoAssignments.forager, 0);
  assert.equal(edited.tribe.assignments.forager, 1);
  assert.equal(edited.tribe.autoAssignments.builder, 1);
  assert.equal(edited.ap, state.ap);
  const next = engine.runAutoDayAction(edited, { rng: noEvents });
  assert.ok(next.tribe.assignments.forager >= 1);
  assert.equal(next.tribe.assignments.forager - next.tribe.autoAssignments.forager, 1);
  assert.equal(next.tribe.assignments.builder, 0);
});

check('established automatic loggers cover a new food shortage without moving manual foragers', () => {
  const state = automaticTribeFixture();
  state.tribe.population = 8;
  state.tribe.assignments = Object.fromEntries(engine.TRIBE_JOBS.map((job) => [job.id,
    job.id === 'logger' ? 6 : job.id === 'forager' ? 2 : 0,
  ]));
  state.tribe.autoAssignments = { logger: 6 };
  assert.equal(engine.tribeSummary(state).foodForecast.totalShortage, 2);
  const next = engine.runAutoDayAction(state, { rng: noEvents });
  assert.ok(next.tribe.assignments.logger < 6);
  assert.equal(next.tribe.assignments.forager - next.tribe.autoAssignments.forager, 2);
  assert.equal(next.tribe.lastProduction.shortage, 0);
  assert.equal(engine.tribeSummary(next).foodForecast.totalShortage, 0);
  assert.equal(Object.values(next.tribe.assignments).reduce((sum, count) => sum + count, 0), 8);
});

check('an unchanged automatic assignment does not emit a fake change or increment its serial', () => {
  const state = automaticTribeFixture({ inventory: { berry: 20 } });
  state.tribe.assignments = { ...state.tribe.assignments, builder: 0, logger: 1 };
  state.tribe.autoAssignments = { ...state.tribe.assignments };
  const next = engine.runAutoDayAction(state, { rng: noEvents });
  assert.deepEqual(next.tribe.assignments, state.tribe.assignments);
  assert.equal(next.tribe.assignmentSerial, state.tribe.assignmentSerial);
  assert.ok(!next.log.some((line) => line.includes('하루 자동 운영 직업 배치')));
});

check('automatic scholars leave jobs with locked facilities or no remaining technology', () => {
  for (const completed of [false, true]) {
    const state = automaticTribeFixture({ inventory: { berry: 20 } });
    state.tribe.assignments = { ...state.tribe.assignments, builder: 0, scholar: 1 };
    state.tribe.autoAssignments = { scholar: 1 };
    if (completed) state.research.completed = Object.fromEntries(engine.TECH_TREE.map((tech) => [tech.id, true]));
    else state.camp.workbenchLevel = 0;
    const next = engine.runAutoDayAction(state, { rng: noEvents });
    assert.equal(next.tribe.assignments.scholar, 0);
    assert.equal(next.tribe.lastProduction.researchPoints, 0);
    assert.equal(next.tribe.assignments.forager - next.tribe.autoAssignments.forager, 2);
    assert.equal(next.tribe.assignments.hunter - next.tribe.autoAssignments.hunter, 1);
  }
});

check('a legacy save without assignment ownership never lends its existing manual workers', () => {
  const state = automaticTribeFixture();
  delete state.tribe.autoAssignments;
  const restored = engine.normalizeState(JSON.parse(JSON.stringify(state)));
  assert.ok(Object.values(restored.tribe.autoAssignments).every((count) => count === 0));
  const next = engine.runAutoDayAction(restored, { rng: noEvents });
  assert.deepEqual(next.tribe.assignments, restored.tribe.assignments);
  assert.equal(next.tribe.assignmentSerial, restored.tribe.assignmentSerial);
});

check('automatic assignment ownership survives JSON restoration and cannot exceed real workers', () => {
  const state = automaticTribeFixture();
  const restored = engine.normalizeState(JSON.parse(JSON.stringify(state)));
  assert.deepEqual(restored.tribe, state.tribe);
  const invalid = engine.normalizeState({ ...state, tribe: { ...state.tribe,
    autoAssignments: { forager: 50, hunter: -1, builder: 'not-a-count', farmer: 20 },
  } });
  assert.equal(invalid.tribe.autoAssignments.forager, 2);
  assert.equal(invalid.tribe.autoAssignments.hunter, 0);
  assert.equal(invalid.tribe.autoAssignments.builder, 0);
  assert.equal(invalid.tribe.autoAssignments.farmer, 0);
  const summary = engine.tribeSummary(invalid);
  assert.equal(summary.jobs.find((job) => job.id === 'hunter').manualCount, 1);
  assert.equal(summary.jobs.find((job) => job.id === 'forager').autoCount, 2);
  expectSameOperation(engine.runAutoDayAction(restored, { rng: noEvents }), engine.runAutoDayAction(state, { rng: noEvents }));
});

check('all-manual food shortages stay visible and failed edits never change ownership', () => {
  const state = automaticTribeFixture();
  state.tribe.autoAssignments = {};
  state.tribe.assignments = Object.fromEntries(engine.TRIBE_JOBS.map((job) => [job.id, job.id === 'builder' ? 4 : 0]));
  state.research.completed = {};
  const normalized = engine.normalizeState(state);
  const blocked = engine.adjustTribeJobAction(normalized, 'farmer', 1);
  assert.deepEqual(blocked.tribe, normalized.tribe);
  const next = engine.runAutoDayAction(normalized, { rng: noEvents });
  assert.deepEqual(next.tribe.assignments, normalized.tribe.assignments);
  assert.equal(next.tribe.lastProduction.shortage, 1);
});

function sharedRationFixture(itemId = 'meat') {
  const state = automaticTribeFixture({ inventory: { [itemId]: 1 } });
  state.tribe.population = 6;
  state.tribe.assignments = { ...state.tribe.assignments, builder: 2, scholar: 1 };
  state.tribe.autoAssignments = { ...state.tribe.assignments };
  state.research.completed = { GATHERING: true, HUNTING: true };
  state.projects.resourceCommitted['drying-rack'] = true;
  state.party = state.party.map((member) => ({ ...member, hunger: 70 }));
  return state;
}

check('hungry party food competes with automatic development work even when tribe meals are already covered', () => {
  const state = sharedRationFixture();
  state.day = 2;
  state.inventory = {};
  state.tribe.assignments = { ...state.tribe.assignments, forager: 3, hunter: 2, builder: 1, scholar: 0 };
  state.tribe.autoAssignments = { ...state.tribe.assignments };
  const original = structuredClone(state);
  assert.equal(engine.tribeSummary(state).foodForecast.totalShortage, 0);
  const next = engine.runAutoDayAction(state, { rng: noEvents });
  assert.equal(next.tribe.lastProduction.shortage, 0);
  assert.equal(next.tribe.assignments.builder, 0, 'Automatic project work must not outrank food for living hungry companions.');
  assert.equal(next.tribe.assignments.scholar, 0);
  assert.ok(next.tribe.lastProduction.gains.meat >= 1, 'Real workers must leave nutritious food after the tribe has eaten.');
  assert.ok(Number(next.inventory.meat || 0) >= 1);
  assert.ok(next.log.some((line) => line.includes('파티 식량 대비')));
  assert.equal(Object.values(next.tribe.assignments).reduce((sum, count) => sum + count, 0), state.tribe.population);
  assert.deepEqual(state, original);
});

check('healthy companions and stocked food keep affordable automatic development work available', () => {
  for (const stocked of [false, true]) {
    const state = sharedRationFixture();
    state.inventory = stocked ? { berry: 40 } : {};
    state.party = state.party.map((member) => ({ ...member, hunger: stocked ? 70 : 0 }));
    const next = engine.runAutoDayAction(state, { rng: noEvents });
    assert.ok(next.tribe.lastProduction.projectWork > 0, 'Food preparation must stop displacing construction once real provisions suffice.');
    if (stocked) assert.ok(next.tribe.lastProduction.researchPoints > 0);
    assert.equal(next.tribe.lastProduction.shortage, 0);
  }
});

check('party food planning cannot borrow manual project workers or promise locked food professions', () => {
  const state = sharedRationFixture();
  state.inventory = {};
  state.tribe.autoAssignments.builder = 0;
  const next = engine.runAutoDayAction(state, { rng: noEvents });
  assert.equal(next.tribe.assignments.builder, 2);
  assert.equal(next.tribe.autoAssignments.builder, 0);
  for (const job of ['farmer', 'fisher', 'herder', 'trapper', 'herbalist']) assert.equal(next.tribe.assignments[job], 0);
  assert.equal(next.tribe.lastProduction.shortage, 0);
  assert.equal(next.tribe.lastProduction.projectWork, 2);
  assert.equal(Object.values(next.tribe.assignments).reduce((sum, count) => sum + count, 0), state.tribe.population);
});

check('automatic closing replans real tribe food after the party eats its morning reserve', () => {
  for (const itemId of ['meat', 'jerky']) {
    const state = sharedRationFixture(itemId);
    const original = structuredClone(state);
    const morning = engine.tribeSummary(state).foodForecast;
    assert.equal(morning.totalShortage, 0);
    assert.equal(morning.days[0].stock, itemId === 'jerky' ? 2 : 1);
    assert.equal(morning.days[0].produced, 1);
    const options = { rng: noEvents };
    const next = engine.runAutoDayAction(state, options);
    assert.equal(next.counters.meals, 1, 'The party must really consume its only stored food.');
    assert.equal(next.tribe.lastProduction.foodNeed, 2);
    assert.equal(next.tribe.lastProduction.shortage, 0, 'Do not use the eaten morning reserve to promise the tribe a meal.');
    assert.equal(next.tribe.lastProduction.foodProvided, 2);
    assert.equal(next.tribe.lastProduction.gains.meat, 2, 'Real reassigned hunters must cover tribe rations and leave a party meal.');
    assert.equal(next.tribe.assignments.hunter, 5);
    assert.equal(next.tribe.assignments.scholar, 0);
    assert.equal(next.tribe.lastProduction.researchPoints, 0);
    assert.equal(next.projects.progress['drying-rack'], 0, 'An automatic project must wait while actual companions still lack food.');
    assert.equal(next.projects.resourceCommitted['drying-rack'], true);
    assert.equal(next.inventory.meat, 1, 'The shared stock must contain exactly the real meat remaining after tribe rations.');
    assert.equal(next.ap, state.apMax);
    assert.equal(next.day, state.day + 1);
    assert.ok(!Object.hasOwn(next, 'autoWorkforce'), 'Automatic-action context must not leak into a save.');
    assert.deepEqual(options, { rng: noEvents });
    assert.deepEqual(state, original);
  }
});

check('automatic food demand excludes dead companions and does not treat medicine as nutrition', () => {
  const healthy = sharedRationFixture();
  healthy.inventory = {};
  healthy.party = healthy.party.map((member, index) => ({ ...member, hp: index ? 0 : 100, hunger: index ? 100 : 0 }));
  const healthyNext = engine.runAutoDayAction(healthy, { rng: noEvents });
  assert.equal(healthyNext.tribe.lastProduction.projectWork, 2);
  assert.equal(healthyNext.party.filter((member) => member.hp > 0).length, 1);
  const medicine = sharedRationFixture();
  medicine.inventory = { herb_tonic: 20 };
  const medicineNext = engine.runAutoDayAction(medicine, { rng: noEvents });
  assert.equal(medicineNext.inventory.herb_tonic, 20);
  assert.equal(medicineNext.tribe.assignments.builder, 0);
  assert.ok(Number(medicineNext.inventory.meat || 0) > 0);
});

check('manual meals and manual day transitions do not trigger automatic closing redistribution', () => {
  const state = sharedRationFixture();
  const eaten = engine.runEatAction(state, 'shiroko', { rng: noEvents });
  assert.equal(eaten.tribe.lastProduction.shortage, 1);
  assert.equal(eaten.tribe.lastProduction.researchPoints, 1);
  assert.deepEqual(eaten.tribe.assignments, state.tribe.assignments);
  assert.equal(eaten.tribe.assignmentSerial, state.tribe.assignmentSerial);
  const empty = { ...state, inventory: {} };
  const advanced = engine.advanceDay(empty, { rng: noEvents });
  assert.equal(advanced.tribe.lastProduction.shortage, 1);
  assert.deepEqual(advanced.tribe.assignments, state.tribe.assignments);
});

check('automatic closing keeps manual work fixed and exposes shortages when no automatic workers remain', () => {
  const state = sharedRationFixture();
  state.tribe.autoAssignments = { forager: 2, hunter: 1 };
  const next = engine.runAutoDayAction(state, { rng: noEvents });
  assert.equal(next.tribe.assignments.builder, 2);
  assert.equal(next.tribe.assignments.scholar, 1);
  assert.equal(next.tribe.autoAssignments.builder, 0);
  assert.equal(next.tribe.autoAssignments.scholar, 0);
  assert.equal(next.tribe.lastProduction.researchPoints, 1);
  assert.equal(next.tribe.lastProduction.shortage, 0);
  assert.equal(next.tribe.assignments.hunter, 2);
  const manual = { ...state, tribe: { ...state.tribe, autoAssignments: {} } };
  const unable = engine.runAutoDayAction(manual, { rng: noEvents });
  assert.deepEqual(unable.tribe.assignments, manual.tribe.assignments);
  assert.equal(unable.tribe.lastProduction.shortage, 1);
  assert.ok(unable.log.some((line) => line.includes('부족 식량 부족')));
});

check('closing planning adds no RNG draws and remains identical after ordinary save restoration', () => {
  const state = sharedRationFixture();
  let automaticDraws = 0;
  let manualDraws = 0;
  const next = engine.runAutoDayAction(state, { rng: () => { automaticDraws += 1; return 0.999; } });
  engine.runEatAction(state, 'shiroko', { rng: () => { manualDraws += 1; return 0.999; } });
  assert.equal(automaticDraws, manualDraws, 'Only the real meal and day transition may draw RNG.');
  const restored = engine.normalizeState(JSON.parse(JSON.stringify(state)));
  expectSameOperation(engine.runAutoDayAction(restored, { rng: noEvents }), next);
});

check('injured starving parties procure real food instead of repeatedly resting with no meals', () => {
  const state = fixture({ inventory: {} });
  state.party = state.party.map((member) => ({ ...member, hp: 20, hunger: 90 }));
  state.research.completed.FISHING = true;
  const next = engine.runAutoDayAction(state, { rng: () => 0.1 });
  assert.equal(next.counters.fish, 1);
  assert.ok(!next.log.some((line) => line.includes('휴식했습니다')));
  const fishing = state.party.map((member) => ({
    actorId: member.id,
    row: engine.specializedActionRows(state, member.id).find((row) => row.id === 'fish'),
  })).sort((a, b) => b.row.chance - a.row.chance)[0];
  expectSameOperation(next, engine.runSpecializedAction(state, fishing.actorId, 'fish', '', { rng: () => 0.1 }));
});

function foodSupplyFixture() {
  const state = fixture({ inventory: {} });
  state.weather = { ...state.weather, id: 'clear', cold: 0 };
  state.party = state.party.map((member) => ({ ...member, hunger: 90 }));
  return state;
}

check('a healthy companion obtains real hunting food instead of treating the injured party average as the hunter HP', () => {
  const catalogStats = engine.STUDENTS.map((student) => structuredClone(student.stats));
  const state = foodSupplyFixture();
  state.party = state.party.map((member, index) => ({ ...member, hp: index === 2 ? 80 : 20 }));
  // The healthy companion has the real hunter's skill and a known food-rich
  // destination. This is not a demand to send a novice into a wasteful hunt.
  state.party[2].stats = { ...state.party[2].stats, hunt: state.party[1].stats.hunt };
  state.research.completed.CARTOGRAPHY = true;
  state.research.completed.HERBALISM = true;
  state.exploration.revealed['sun-meadow'] = true;
  const original = structuredClone(state);
  const next = engine.runAutoDayAction(state, { rng: () => 0.1 });
  assert.equal(next.counters.hunt, 1);
  assert.ok(next.log.some((line) => line.includes('노아의 사냥 성공')));
  assert.ok(next.log.some((line) => line.includes('식량 확보:')));
  expectSameOperation(next, engine.runHuntAction(state, 'noa', 'sun-meadow', { rng: () => 0.1 }));
  assert.deepEqual(state, original);
  assert.deepEqual(engine.STUDENTS.map((student) => student.stats), catalogStats, 'Controlled actor skills must not alter later ordinary runs.');
});

check('unlocked food sources compete by actual expected nutrition instead of always farming before fishing', () => {
  const state = foodSupplyFixture();
  state.research.completed.FISHING = true;
  state.research.completed.AGRICULTURE = true;
  const next = engine.runAutoDayAction(state, { rng: () => 0.1 });
  assert.equal(next.counters.fish, 1);
  assert.equal(next.counters.farm || 0, 0);
  expectSameOperation(next, engine.runSpecializedAction(state, 'shiroko', 'fish', '', { rng: () => 0.1 }));
});

check('injured companions use unlocked berry-bearing herbal gathering instead of mineral expeditions for food', () => {
  const state = foodSupplyFixture();
  state.party = state.party.map((member) => ({ ...member, hp: 20 }));
  state.research.completed.HERBALISM = true;
  const next = engine.runAutoDayAction(state, { rng: () => 0.1 });
  assert.equal(next.counters.herbal, 1);
  assert.equal(next.counters.hunt || 0, 0);
  expectSameOperation(next, engine.runSpecializedAction(state, 'shiroko', 'herbal', '', { rng: () => 0.1 }));
});

check('map-unlocked food procurement leaves a selected foodless cave for an actually revealed food source', () => {
  const state = foodSupplyFixture();
  state.research.completed.CARTOGRAPHY = true;
  state.exploration.revealed['echo-cave'] = true;
  state.exploration.revealed['sun-meadow'] = true;
  state.exploration.selectedRegionId = 'echo-cave';
  assert.equal(engine.canSelectActionZone(state), true);
  const next = engine.runAutoDayAction(state, { rng: () => 0.1 });
  assert.ok(next.log.some((line) => line.includes('시로코의 채집 성공. 속삭임 숲')));
  expectSameOperation(next, engine.runGatherAction(state, 'shiroko', 'whisper-woods', { rng: () => 0.1 }));
});

check('food procurement does not send a critically injured hunter into a lethal ordinary counterattack', () => {
  const state = foodSupplyFixture();
  state.party = state.party.map((member) => ({ ...member, hp: member.id === 'hina' ? 9 : 0 }));
  const next = engine.runAutoDayAction(state, { rng: noEvents });
  assert.ok(next.log.some((line) => line.includes('히나의 채집 실패')));
  assert.ok(!next.log.some((line) => line.includes('사냥 실패')));
  expectSameOperation(next, engine.runGatherAction(state, 'hina', '', { rng: noEvents }));
  assert.equal(next.party.find((member) => member.id === 'shiroko').hp, 0);
  assert.equal(next.party.find((member) => member.id === 'noa').hp, 0);
});

check('before map unlock food planning preserves the actual random region and exact paid RNG sequence', () => {
  const state = foodSupplyFixture();
  state.party = state.party.map((member) => ({ ...member, hp: member.id === 'hina' ? 100 : 0 }));
  assert.equal(engine.canSelectActionZone(state), false);
  const randomSequence = () => {
    let calls = 0;
    return { rng: () => [0.999, 0.1][calls++] ?? 0.999, calls: () => calls };
  };
  const autoRandom = randomSequence();
  const manualRandom = randomSequence();
  const next = engine.runAutoDayAction(state, { rng: autoRandom.rng });
  const manual = engine.runGatherAction(state, 'hina', '', { rng: manualRandom.rng });
  assert.ok(next.log.some((line) => line.includes('히나의 채집 성공. 얕은 여울')));
  expectSameOperation(next, manual);
  assert.equal(autoRandom.calls(), manualRandom.calls(), 'Planning must not consume random draws or force a food-bearing region.');
  assert.equal(next.exploration.revealed['sun-meadow'], false);
});

check('one scarce meal is eaten before procuring more food instead of spending three AP cooking for one starving member', () => {
  const state = fixture({ ap: 3, inventory: { meat: 1, wood: 1 } });
  state.camp.fuel = 0;
  state.party = state.party.map((member) => ({ ...member, hunger: 90 }));
  state.research.completed.FISHING = true;
  const next = engine.runAutoDayAction(state, { rng: () => 0.1 });
  assert.ok(!next.log.some((line) => line.includes('고기를 구웠습니다')));
  assert.ok(!next.log.some((line) => line.includes('모닥불 연료를 보충했습니다')));
  assert.ok(next.counters.fish >= 1);
  assert.ok(next.counters.meals >= state.party.length);
});

check('a healthy nonstarving party builds an affordable basic workbench before endless food expeditions', () => {
  const state = fixture({ inventory: { wood: 4, stone: 2 } });
  state.party = state.party.map((member) => ({ ...member, hunger: 50 }));
  state.camp.workbenchLevel = 0;
  const next = engine.runAutoDayAction(state, { rng: noEvents });
  assert.equal(next.camp.workbenchLevel, 1);
  expectSameOperation(next, engine.runCampAction(state, 'noa', 'workbench', { rng: noEvents }));
});

function workbenchMorningFixture(overrides = {}) {
  const state = fixture({ ap: 3, apMax: 3, inventory: { meat: 6, wood: 4, stone: 2 }, ...overrides });
  state.weather = { ...state.weather, id: 'clear', cold: 0 };
  state.camp = { ...state.camp, workbenchLevel: 0, fuel: 0 };
  state.party = state.party.map((member) => ({ ...member, hunger: 60 }));
  return state;
}

check('a stocked safe morning pays for the first workbench before a three-action single-portion cooking loop', () => {
  const state = workbenchMorningFixture();
  const original = structuredClone(state);
  const next = engine.runAutoDayAction(state, { rng: noEvents });
  assert.equal(next.camp.workbenchLevel, 1, 'Available workbench materials must not be burned on another entire day of one-portion meal preparation.');
  assert.ok(next.log.some((line) => line.includes('생존 기반:') && line.includes('작업대')));
  const paidWorkbench = engine.runCampAction(state, 'noa', 'workbench', { rng: noEvents });
  assert.equal(paidWorkbench.ap, state.ap - 1);
  assert.equal(paidWorkbench.inventory.wood, 0);
  assert.equal(paidWorkbench.inventory.stone, 0);
  expectSameOperation(next, engine.runAutoDayAction(paidWorkbench, { rng: noEvents }));
  assert.deepEqual(state, original);
});

check('morning workbench planning pays for a real material attempt without selecting a locked destination or forcing success', () => {
  const state = workbenchMorningFixture({ inventory: { meat: 6, wood: 1, stone: 2 } });
  state.camp.fuel = 2;
  const original = structuredClone(state);
  const next = engine.runAutoDayAction(state, { rng: noEvents });
  assert.ok(next.log.some((line) => line.includes('생존 기반:') && line.includes('나무')));
  assert.ok(next.log.some((line) => line.includes('시로코의 채집 실패')));
  assert.equal(engine.canSelectActionZone(next), false);
  assert.equal(next.camp.workbenchLevel, 0, 'An unsuccessful real gathering attempt must not grant the missing facility.');
  const paidGather = engine.runGatherAction(state, 'shiroko', '', { rng: noEvents });
  expectSameOperation(next, engine.runAutoDayAction(paidGather, { rng: noEvents }));
  assert.deepEqual(state, original);
});

check('morning facility planning does not displace actual hunger, injury, stamina or temperature emergencies', () => {
  for (const update of [{ hunger: 90 }, { hp: 10 }, { stamina: 10 }, { bodyTemp: 34 }]) {
    const state = workbenchMorningFixture();
    state.party[0] = { ...state.party[0], ...update };
    const next = engine.runAutoDayAction(state, { rng: noEvents });
    assert.ok(!next.log.some((line) => line.includes('생존 기반:')), `Do not schedule an optional morning task during ${JSON.stringify(update)}.`);
  }
});

check('the bounded morning task is neither repeated during a partial day nor restored as a new save flag', () => {
  const state = workbenchMorningFixture();
  const restored = engine.normalizeState(JSON.parse(JSON.stringify(state)));
  const next = engine.runAutoDayAction(state, { rng: noEvents });
  expectSameOperation(engine.runAutoDayAction(restored, { rng: noEvents }), next);
  assert.equal(next.log.filter((line) => line.includes('생존 기반:')).length, 1);
  for (const ap of [1, 2]) {
    const partial = workbenchMorningFixture({ ap });
    const partialNext = engine.runAutoDayAction(partial, { rng: noEvents });
    assert.ok(!partialNext.log.some((line) => line.includes('생존 기반:')));
  }
  assert.deepEqual(Object.keys(restored).sort(), Object.keys(state).sort());
});

check('normal runs survive and develop using ordinary paid actions across fifteen seeds', () => {
  for (const seed of [3, 5, 7, 11, 17, 19, 23, 29, 31, 37, 43, 47, 53, 59, 61]) {
    const rng = seededRng(seed);
    let state = engine.createNewState({ difficulty: 'normal', rng, runId: `survival-${seed}`, now: '2026-10-03T00:00:00.000Z' });
    let shortageDays = 0;
    for (let day = 0; day < 120 && !state.ended && !engine.archiveVictorySummary(state).canComplete; day += 1) {
      state = engine.runAutoDayAction(state, { rng });
      if (state.tribe.lastProduction.shortage > 0) shortageDays += 1;
    }
    const victory = engine.archiveVictorySummary(state);
    naturalRuns.push({ seed, day: state.day, ended: state.ended, canComplete: victory.canComplete, shortageDays, meals: state.counters.meals, crafts: state.counters.craft });
    assert.equal(shortageDays, 0, `Seed ${seed} must not lose tribal meals to stale automatic stock planning.`);
    assert.equal(state.ended, false, `Seed ${seed} must not collapse while ignoring usable survival actions.`);
    assert.equal(victory.canComplete, true, `Seed ${seed} must still reach all five actual development objectives.`);
    assert.equal(state.party.filter((member) => member.hp > 0).length, 3, `Seed ${seed} must not neglect a starving survivor.`);
    assert.equal(state.victory, false, 'Completion remains the player\'s decision.');
    assert.ok(Number(state.camp.fuel) >= 0);
    assert.ok(Object.values(state.inventory).every((qty) => qty >= 0));
    if (seed === 43) {
      const resumedRng = seededRng(seed);
      let resumed = engine.createNewState({ difficulty: 'normal', rng: resumedRng, runId: `survival-${seed}`, now: '2026-10-03T00:00:00.000Z' });
      for (let day = 0; day < 120 && !resumed.ended && !engine.archiveVictorySummary(resumed).canComplete; day += 1) {
        if (day === 18) resumed = engine.normalizeState(JSON.parse(JSON.stringify(resumed)));
        resumed = engine.runAutoDayAction(resumed, { rng: resumedRng });
      }
      expectSameOperation(resumed, state);
    }
  }
});

check('ordinary hard food-care regressions retain every companion and all five paid development objectives', () => {
  for (const seed of [3, 43, 89]) {
    const rng = seededRng(seed);
    let state = engine.createNewState({ difficulty: 'hard', rng, runId: `hard-food-priority-${seed}`, now: '2026-10-03T00:00:00.000Z' });
    let usedSurvivalPriority = false;
    let usedFoodSupplyPlan = false;
    let criticalFoodDays = 0;
    let shortageDays = 0;
    for (let day = 0; day < 120 && !state.ended && !engine.archiveVictorySummary(state).canComplete; day += 1) {
      if (day === 26) state = engine.normalizeState(JSON.parse(JSON.stringify(state)));
      const activeDay = state.day;
      if (state.party.some((member) => member.hp > 0 && member.hp <= 30 && member.hunger >= 75)) criticalFoodDays += 1;
      state = engine.runAutoDayAction(state, { rng });
      if (state.tribe.lastProduction.shortage > 0) shortageDays += 1;
      usedSurvivalPriority ||= state.log.some((line) => line.startsWith(`Day ${activeDay}:`) && line.includes('생존 우선 배분'));
      usedFoodSupplyPlan ||= state.log.some((line) => line.startsWith(`Day ${activeDay}:`) && line.includes('식량 확보:'));
      assert.equal(state.devTools.enabled, false);
      assert.ok(Object.values(state.inventory).every((qty) => qty >= 0));
    }
    const victory = engine.archiveVictorySummary(state);
    naturalRuns.push({ difficulty: 'hard', seed, day: state.day, ended: state.ended, canComplete: victory.canComplete, alive: state.party.filter((member) => member.hp > 0).length, shortageDays, usedSurvivalPriority, usedFoodSupplyPlan, criticalFoodDays });
    assert.equal(shortageDays, 0, `Hard seed ${seed} must cover tribe rations through actual automatic production.`);
    assert.equal(usedFoodSupplyPlan, true, 'The ordinary run must exercise real food procurement.');
    // Better supply may prevent the old seed-89 triage emergency altogether.
    // Do not force survivors into a crisis just to count the old log branch.
    assert.ok(usedSurvivalPriority || criticalFoodDays === 0);
    // A better automatic workforce may now prevent the old seed-3 crisis.
    // Critical ration ordering remains independently covered above; never
    // make an ordinary survivor starve just to reproduce an old log branch.
    assert.equal(state.party.filter((member) => member.hp > 0).length, 3, `Hard seed ${seed} must retain all companions.`);
    assert.equal(victory.canComplete, true, 'Survival care must still leave room for all five paid development objectives.');
    assert.equal(state.victory, false, 'Final completion remains the player\'s decision.');
  }
});

check('real automatic economy sustains repeated seasons across every difficulty without forcing victory or restoring casualties', () => {
  for (const difficulty of ['veryeasy', 'easy', 'normal', 'hard', 'nightmare']) {
    for (const seed of difficulty === 'nightmare' ? [3, 43, 89] : [89]) {
      const rng = seededRng(seed);
      let state = engine.createNewState({ difficulty, rng, runId: `long-food-${difficulty}-${seed}`, now: '2026-10-03T00:00:00.000Z' });
      let firstReady = 0;
      let coldDays = 0;
      let shortageDays = 0;
      let midpointTech = 0;
      const casualties = new Set();
      for (let day = 0; day < 160 && !state.ended; day += 1) {
        if (day === 80) state = engine.normalizeState(JSON.parse(JSON.stringify(state)));
        const activeDay = state.day;
        state = engine.runAutoDayAction(state, { rng });
        assert.equal(state.day, activeDay + 1, 'An automatic day must still use ordinary paid actions and close exactly once.');
        assert.equal(state.devTools.enabled, false);
        assert.equal(state.victory, false, 'Continuing development must not force the player to settle the run.');
        assert.ok(Number(state.camp.fuel) >= 0);
        assert.ok(Object.values(state.inventory).every((qty) => Number.isFinite(qty) && qty >= 0));
        assert.ok(Object.values(state.tribe.assignments).reduce((sum, count) => sum + count, 0) <= state.tribe.population);
        for (const member of state.party) {
          if (casualties.has(member.id)) assert.equal(member.hp, 0, 'Automatic food production cannot resurrect an actual casualty.');
          if (member.hp <= 0) casualties.add(member.id);
        }
        if (state.tribe.lastProduction.shortage > 0) shortageDays += 1;
        if (state.weather.cold >= 5) coldDays += 1;
        if (!firstReady && engine.archiveVictorySummary(state).canComplete) firstReady = state.day;
        if (day === 95) midpointTech = engine.techRows(state).filter((row) => row.completed).length;
      }
      const tech = engine.techRows(state).filter((row) => row.completed).length;
      const civics = engine.civicRows(state).filter((row) => row.completed).length;
      const alive = state.party.filter((member) => member.hp > 0).length;
      naturalRuns.push({ difficulty, seed, longRun: true, day: state.day, alive, firstReady, shortageDays, coldDays, population: state.tribe.population, tech, civics });
      assert.equal(state.day, 161, `Long-run ${difficulty} seed ${seed} must not repeat the old avoidable economy collapse.`);
      assert.equal(state.ended, false);
      assert.equal(shortageDays, 0);
      assert.ok(coldDays > 0, 'The run must exercise actual cold weather rather than a warm controlled fixture.');
      assert.ok(tech > midpointTech, 'Survival work must leave real room for later technological development.');
      assert.ok(civics > 0);
      if (seed === 89) {
        assert.equal(alive, 3, 'The ordinary reference run must retain every living companion without free food or healing.');
        assert.ok(firstReady > 0, 'Every difficulty reference must reach all five real development objectives.');
      }
    }
  }
});

console.log(JSON.stringify({ pass: !failures.length, checks, failures, naturalRuns, evidence: 'current engine actions only; no old result files, real saves, accounts, or original executable' }, null, 2));
if (failures.length) process.exitCode = 1;
