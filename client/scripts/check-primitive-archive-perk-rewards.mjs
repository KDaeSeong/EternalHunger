import assert from 'node:assert/strict';
import './lib/register-simulation-modules.mjs';

const engine = await import('../src/app/games/primitive-archive/_lib/primitiveArchiveEngine.js');
const checkpointApi = await import('../src/app/games/primitive-archive/_lib/primitiveArchiveCheckpoint.js');

const failures = [];
const passed = [];
const now = '2026-10-26T00:00:00.000Z';

function fixture(runId, overrides = {}) {
  const base = engine.createNewState({ runId, now, rng: () => 0.5, difficulty: 'normal' });
  return engine.normalizeState({
    ...base,
    day: 4,
    ap: 2,
    party: base.party.map((member) => ({ ...member, hp: 80, hunger: 15, stamina: 90, bodyTemp: 37 })),
    ...overrides,
  });
}

function archiveReadyFixture(runId, overrides = {}) {
  const base = fixture(runId);
  return engine.normalizeState({
    ...base,
    day: engine.ARCHIVE_VICTORY_DAY,
    camp: { ...base.camp, archiveRoomLevel: 1, scribeDeskLevel: 1, libraryShelfLevel: 1 },
    inventory: { ...base.inventory, book_craft_guide: 1, book_camp_manual: 1 },
    research: {
      ...base.research,
      completed: Object.fromEntries(engine.TECHNOLOGY_TREE.filter((row) => row.archiveRequired).map((row) => [row.id, true])),
    },
    civics: {
      ...base.civics,
      completed: Object.fromEntries(engine.CIVIC_TREE.filter((row) => row.archiveRequired).map((row) => [row.id, true])),
    },
    ...overrides,
  });
}

function memoryStorage() {
  const values = new Map();
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); },
  };
}

function check(name, run) {
  try {
    run();
    passed.push(name);
    console.log(`PASS ${name}`);
  } catch (error) {
    failures.push({ name, message: error?.message || String(error) });
    console.error(`FAIL ${name}: ${error?.message || error}`);
  }
}

check('ordinary settlement rewards points from the current score exactly once', () => {
  const state = fixture('perk-ordinary-settlement', { meta: { perkPoints: 7, lifetimeScore: 100, runsCompleted: 2 } });
  const before = structuredClone(state);
  const score = engine.scoreState(state);
  const expected = Math.max(1, Math.floor(score / 850));
  const settled = engine.settleRunAction(state);
  assert.equal(settled.meta.lastAward, expected);
  assert.equal(settled.meta.perkPoints, state.meta.perkPoints + expected);
  assert.equal(settled.meta.lifetimeScore, state.meta.lifetimeScore + score);
  assert.equal(settled.meta.runsCompleted, state.meta.runsCompleted + 1);
  assert.equal(settled.meta.lastSettledRunId, state.runId);
  const repeated = engine.settleRunAction(settled);
  assert.equal(repeated.meta.perkPoints, settled.meta.perkPoints);
  assert.equal(repeated.meta.lifetimeScore, settled.meta.lifetimeScore);
  assert.equal(repeated.meta.runsCompleted, settled.meta.runsCompleted);
  assert.deepEqual(state, before);
});

check('archive completion awards its higher score ratio exactly once', () => {
  const state = archiveReadyFixture('perk-archive-completion', { meta: { perkPoints: 5, lifetimeScore: 300, runsCompleted: 1 } });
  assert.equal(engine.archiveVictorySummary(state).canComplete, true);
  const before = structuredClone(state);
  const score = engine.scoreState({ ...state, victory: true });
  const expected = Math.max(3, Math.floor(score / 700));
  const completed = engine.completeArchiveAction(state);
  assert.equal(completed.victory, true);
  assert.equal(completed.meta.lastAward, expected);
  assert.equal(completed.meta.perkPoints, state.meta.perkPoints + expected);
  assert.equal(completed.meta.lifetimeScore, state.meta.lifetimeScore + score);
  assert.equal(completed.meta.runsCompleted, state.meta.runsCompleted + 1);
  const repeated = engine.completeArchiveAction(completed);
  assert.equal(repeated.meta.perkPoints, completed.meta.perkPoints);
  assert.equal(repeated.meta.lifetimeScore, completed.meta.lifetimeScore);
  assert.equal(repeated.meta.runsCompleted, completed.meta.runsCompleted);
  assert.deepEqual(state, before);
});

check('developer-adjusted ordinary and clear runs award no meta points or lifetime score', () => {
  const ordinary = engine.updateDeveloperToolsAction(fixture('perk-dev-settlement'), {
    enabled: true, guaranteedSuccess: true,
  });
  const switchedOff = engine.updateDeveloperToolsAction(ordinary, { enabled: false, guaranteedSuccess: false });
  assert.equal(switchedOff.devTools.used, true);
  const settled = engine.settleRunAction(switchedOff);
  assert.equal(settled.meta.lastAward, 0);
  assert.equal(settled.meta.perkPoints, switchedOff.meta.perkPoints);
  assert.equal(settled.meta.lifetimeScore, switchedOff.meta.lifetimeScore);

  const ready = engine.updateDeveloperToolsAction(archiveReadyFixture('perk-dev-clear'), {
    enabled: true, actionBonuses: { gather: 0.2 },
  });
  const completed = engine.completeArchiveAction(ready);
  assert.equal(completed.victory, true);
  assert.equal(completed.meta.lastAward, 0);
  assert.equal(completed.meta.perkPoints, ready.meta.perkPoints);
  assert.equal(completed.meta.lifetimeScore, ready.meta.lifetimeScore);
  assert.equal(completed.meta.runsCompleted, ready.meta.runsCompleted + 1);
});

check('all six current perks retain their declared cost and level cap', () => {
  assert.deepEqual(engine.PERK_DEFS.map(({ id, cost, maxLevel }) => [id, cost, maxLevel]), [
    ['perk_supply_pack', 2, 1],
    ['perk_craft_cache', 2, 2],
    ['perk_rations', 1, 3],
    ['perk_medicine_pouch', 2, 1],
    ['perk_extra_ap', 3, 1],
    ['perk_start_fuel', 1, 1],
  ]);
});

check('every valid perk purchase charges the declared cost and refuses purchases beyond max level', () => {
  const totalCost = engine.PERK_DEFS.reduce((sum, perk) => sum + perk.cost * perk.maxLevel, 0);
  assert.equal(totalCost, 15);
  let state = fixture('perk-purchase-all', { meta: { perkPoints: totalCost } });
  const before = structuredClone(state);
  for (const perk of engine.PERK_DEFS) {
    for (let level = 1; level <= perk.maxLevel; level += 1) {
      const priorPoints = state.meta.perkPoints;
      state = engine.buyPerkAction(state, perk.id);
      assert.equal(state.meta.perkPoints, priorPoints - perk.cost, `${perk.id} level ${level} cost`);
      assert.equal(state.meta.ownedPerks[perk.id], level, `${perk.id} level ${level}`);
    }
    const atCap = structuredClone(state.meta);
    state = engine.buyPerkAction(state, perk.id);
    assert.equal(state.meta.perkPoints, atCap.perkPoints, `${perk.id} cannot exceed its cap`);
    assert.deepEqual(state.meta.ownedPerks, atCap.ownedPerks);
  }
  assert.equal(state.meta.perkPoints, 0);
  assert.deepEqual(before.meta.ownedPerks, {});
  assert.equal(before.meta.perkPoints, totalCost, 'Purchases must not mutate their input state.');
  const noFunds = engine.buyPerkAction(state, 'perk_supply_pack');
  assert.equal(noFunds.meta.perkPoints, 0);
  assert.deepEqual(noFunds.meta.ownedPerks, state.meta.ownedPerks);
  assert.deepEqual(engine.buyPerkAction(state, 'unknown-perk').meta, state.meta);
});

check('each owned perk applies its exact new-run effect once and leaves the saved run unchanged', () => {
  const baseline = engine.createNewState({ runId: 'perk-effects-baseline', now, rng: () => 0.5, difficulty: 'normal' });
  const cases = [
    ['perk_supply_pack', 1, { berry: 3, wood: 2, stone: 2 }],
    ['perk_craft_cache', 2, { fiber: 2, hide: 2, bone: 2 }],
    ['perk_rations', 3, { cooked_meat: 3, jerky: 3 }],
    ['perk_medicine_pouch', 1, { herb: 2, berry: 1, herb_tonic: 1 }],
    ['perk_extra_ap', 1, { ap: 1, apMax: 1 }],
    ['perk_start_fuel', 1, { fuel: 6 }],
  ];
  for (const [perkId, level, gains] of cases) {
    const saved = fixture(`perk-effect-${perkId}`, {
      meta: { perkPoints: 0, ownedPerks: { [perkId]: level } },
    });
    const before = structuredClone(saved);
    const fresh = engine.startNewRunFromMeta(saved, { runId: `fresh-${perkId}`, now, rng: () => 0.5, difficulty: 'normal' });
    for (const [key, delta] of Object.entries(gains)) {
      if (key === 'fuel') assert.equal(fresh.camp.fuel, baseline.camp.fuel + delta, `${perkId} camp fuel`);
      else assert.equal(fresh[key] ?? fresh.inventory[key], Number(baseline[key] ?? baseline.inventory[key] ?? 0) + delta, `${perkId} ${key}`);
    }
    assert.deepEqual(engine.normalizeState(fresh).inventory, fresh.inventory, `${perkId} must not apply again during normalization.`);
    assert.deepEqual(saved, before, `${perkId} must not mutate the completed source run.`);
  }
});

check('all six maximum perks serialize, restore, and apply to the next run', () => {
  const owner = 'user:id:perk-checkpoint';
  const storage = memoryStorage();
  const allMax = Object.fromEntries(engine.PERK_DEFS.map((perk) => [perk.id, perk.maxLevel]));
  const saved = engine.createNewState({
    runId: 'perk-checkpoint-current', now, rng: () => 0.5, difficulty: 'normal',
    meta: { perkPoints: 0, ownedPerks: allMax, lifetimeScore: 12345, runsCompleted: 7, lastAward: 12, lastSettledRunId: 'prior-run' },
  });
  const first = checkpointApi.writeCheckpoint(storage, owner, saved, { expectedRevision: 0, savedAt: now });
  assert.equal(first.status, 'ready');
  const noPerks = engine.normalizeState({
    ...engine.createNewState({
      runId: 'perk-checkpoint-other', now, rng: () => 0.5, difficulty: 'normal', meta: saved.meta,
    }),
    meta: { ...saved.meta, ownedPerks: {}, perkPoints: 3 },
  });
  const second = checkpointApi.writeCheckpoint(storage, owner, noPerks, {
    expectedRevision: 1, forcePrevious: true, savedAt: '2026-10-26T00:01:00.000Z',
  });
  assert.equal(second.status, 'ready');
  const restored = checkpointApi.restorePreviousCheckpoint(storage, owner, {
    expectedRevision: 2, savedAt: '2026-10-26T00:02:00.000Z',
  });
  assert.equal(restored.status, 'ready');
  const revived = engine.normalizeState(restored.checkpoint.current);
  assert.deepEqual(revived.meta.ownedPerks, allMax);
  assert.equal(revived.meta.perkPoints, 0);
  assert.equal(revived.meta.lifetimeScore, 12345);
  assert.equal(revived.meta.runsCompleted, 7);
  const next = engine.startNewRunFromMeta(revived, { runId: 'perk-checkpoint-next', now, rng: () => 0.5, difficulty: 'normal' });
  assert.equal(next.inventory.berry, 10);
  assert.equal(next.inventory.wood, 6);
  assert.equal(next.inventory.stone, 4);
  assert.equal(next.inventory.fiber, 4);
  assert.equal(next.inventory.hide, 2);
  assert.equal(next.inventory.bone, 2);
  assert.equal(next.inventory.cooked_meat, 3);
  assert.equal(next.inventory.jerky, 3);
  assert.equal(next.inventory.herb, 2);
  assert.equal(next.inventory.berry, 10);
  assert.equal(next.inventory.herb_tonic, 1);
  assert.equal(next.apMax, 5);
  assert.equal(next.ap, 5);
  assert.equal(next.camp.fuel, 6);
  assert.equal(next.devTools.used, false);

  const injured = engine.normalizeState({
    ...next,
    ap: 2,
    party: next.party.map((member) => ({ ...member, hp: 50, stamina: 50 })),
  });
  const treated = engine.runRecoveryChoiceAction(injured, injured.party[0].id, 'field_tonic', { rng: () => 0.5 });
  assert.equal(treated.inventory.herb_tonic, 0);
  assert.ok(treated.party.every((member) => member.hp === 64), 'The granted tonic must be usable for its actual party heal.');
});

check('perk levels reject malformed entries and clamp imported levels to the declared cap', () => {
  const raw = {
    perk_supply_pack: -1,
    perk_craft_cache: Number.POSITIVE_INFINITY,
    perk_rations: 99,
    perk_medicine_pouch: '1',
    perk_extra_ap: Number.NaN,
    perk_start_fuel: 1.5,
    unknown_perk: 10,
  };
  const state = engine.createNewState({ runId: 'perk-invalid-levels', now, rng: () => 0.5, meta: { ownedPerks: raw } });
  assert.deepEqual(state.meta.ownedPerks, { perk_rations: 3 });
  assert.equal(state.inventory.cooked_meat, 3);
  assert.equal(state.inventory.jerky, 3);
  const standardStart = engine.createNewState({ runId: 'perk-invalid-levels-baseline', now, rng: () => 0.5 });
  assert.equal(state.inventory.fiber, standardStart.inventory.fiber, 'Infinity craft level must not mint arbitrary materials.');
  assert.equal(state.camp.fuel, 0);
});

check('perk reward counters normalize to finite nonnegative safe integers', () => {
  const normalized = engine.createNewState({
    runId: 'perk-reward-counter-normalization', now, rng: () => 0.5,
    meta: { perkPoints: '12.8', lastAward: '17' },
  });
  assert.equal(normalized.meta.perkPoints, 12);
  assert.equal(normalized.meta.lastAward, 17);

  for (const invalid of [Number.POSITIVE_INFINITY, Number.NaN, -2]) {
    const state = engine.createNewState({
      runId: `perk-invalid-counter-${String(invalid)}`, now, rng: () => 0.5,
      meta: { perkPoints: invalid, lastAward: invalid },
    });
    assert.equal(state.meta.perkPoints, 0);
    assert.equal(state.meta.lastAward, 0);
  }
  const capped = engine.createNewState({
    runId: 'perk-reward-counter-cap', now, rng: () => 0.5,
    meta: { perkPoints: Number.MAX_SAFE_INTEGER + 100, lastAward: Number.MAX_SAFE_INTEGER + 100 },
  });
  assert.equal(capped.meta.perkPoints, Number.MAX_SAFE_INTEGER);
  assert.equal(capped.meta.lastAward, Number.MAX_SAFE_INTEGER);
});

check('restored perk points and award survive serialization and support a later purchase', () => {
  const owner = 'user:id:perk-reward-restore';
  const storage = memoryStorage();
  const saved = engine.createNewState({
    runId: 'perk-reward-restore-current', now, rng: () => 0.5,
    meta: { perkPoints: 237, ownedPerks: { perk_rations: 1 }, lastAward: 63 },
  });
  const first = checkpointApi.writeCheckpoint(storage, owner, saved, { expectedRevision: 0, savedAt: now });
  assert.equal(first.status, 'ready');
  const replacement = engine.normalizeState(engine.createNewState({
    runId: 'perk-reward-restore-replacement', now, rng: () => 0.5, meta: saved.meta,
  }));
  const second = checkpointApi.writeCheckpoint(storage, owner, replacement, {
    expectedRevision: 1, forcePrevious: true, savedAt: '2026-10-26T00:01:00.000Z',
  });
  assert.equal(second.status, 'ready');
  const restored = checkpointApi.restorePreviousCheckpoint(storage, owner, {
    expectedRevision: 2, savedAt: '2026-10-26T00:02:00.000Z',
  });
  assert.equal(restored.status, 'ready');
  const revived = engine.normalizeState(restored.checkpoint.current);
  assert.equal(revived.meta.perkPoints, 237);
  assert.equal(revived.meta.lastAward, 63);
  assert.equal(revived.meta.ownedPerks.perk_rations, 1);
  const purchased = engine.buyPerkAction(revived, 'perk_rations');
  assert.equal(purchased.meta.perkPoints, 236);
  assert.equal(purchased.meta.ownedPerks.perk_rations, 2);
});

console.log(`Primitive Archive perk checks: ${passed.length}/${passed.length + failures.length}.`);
if (failures.length) process.exitCode = 1;
