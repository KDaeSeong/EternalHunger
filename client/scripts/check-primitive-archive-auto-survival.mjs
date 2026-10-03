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
check('normal runs survive and develop using ordinary paid actions across three seeds', () => {
  for (const seed of [7, 19, 43]) {
    const rng = seededRng(seed);
    let state = engine.createNewState({ difficulty: 'normal', rng, runId: `survival-${seed}`, now: '2026-10-03T00:00:00.000Z' });
    for (let day = 0; day < 120 && !state.ended && !engine.archiveVictorySummary(state).canComplete; day += 1) {
      state = engine.runAutoDayAction(state, { rng });
    }
    const victory = engine.archiveVictorySummary(state);
    naturalRuns.push({ seed, day: state.day, ended: state.ended, canComplete: victory.canComplete, meals: state.counters.meals, crafts: state.counters.craft });
    assert.equal(state.ended, false, `Seed ${seed} must not collapse while ignoring usable survival actions.`);
    assert.equal(victory.canComplete, true, `Seed ${seed} must still reach all five actual development objectives.`);
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

console.log(JSON.stringify({ pass: !failures.length, checks, failures, naturalRuns, evidence: 'current engine actions only; no old result files, real saves, accounts, or original executable' }, null, 2));
if (failures.length) process.exitCode = 1;
