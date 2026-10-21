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

const RARE_EVENT_EXPECTATIONS = {
  megafauna_tracks: {
    rewards: { dino_hide: 1, dino_bone: 2, meat: 2 },
    staminaCost: 20,
    hungerAdd: 5,
    failDamage: 11,
    failStamina: 11,
  },
  rune_cache: {
    rewards: { rune_shard: 1, clay: 1, resin: 1 },
    staminaCost: 14,
    hungerAdd: 4,
    failDamage: 5,
    failStamina: 9,
  },
  mutant_nest: {
    rewards: { mutant_gland: 1, tooth: 2, bone: 2 },
    staminaCost: 22,
    hungerAdd: 5,
    failDamage: 13,
    failStamina: 12,
  },
};

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

function trackingFixture({ cartography = true, cave = false, plains = false, inventory = {} } = {}) {
  const base = eventFixture();
  return engine.normalizeState({
    ...base,
    eventChains: [],
    research: { ...base.research, completed: cartography ? { CARTOGRAPHY: true } : {} },
    inventory: { ...base.inventory, ...inventory },
    exploration: {
      ...base.exploration,
      selectedRegionId: 'whisper-woods',
      revealed: {
        'camp-heart': true,
        'whisper-woods': true,
        'river-ford': true,
        'echo-cave': cave,
        'sun-meadow': plains,
      },
    },
  });
}

function trackingProtectedSnapshot(state) {
  const snapshot = structuredClone(state);
  delete snapshot.log;
  delete snapshot.updatedAt;
  return snapshot;
}

check('targeted rare tracking refuses locked or undiscovered terrain without AP, resource or RNG costs', () => {
  for (const options of [
    { cartography: false, cave: true },
    { cartography: true, cave: false },
    { cartography: true, cave: false, plains: true },
  ]) {
    const state = trackingFixture(options);
    const original = structuredClone(state);
    const row = engine.recoveryChoiceRows(state).find((entry) => entry.id === 'risk_track');
    assert.equal(row.enabled, false, 'Targeted tracking must not silently become a random or fallback action.');
    assert.match(row.detail, options.cartography ? /동굴.*발견/ : /지도 제작.*연구/);
    let draws = 0;
    const next = engine.runRecoveryChoiceAction(state, 'shiroko', 'risk_track', {
      rng: () => { draws += 1; return 0.999; },
    });
    assert.equal(draws, 0, 'Rejected tracking must not consume the gameplay RNG stream.');
    assert.deepEqual(trackingProtectedSnapshot(next), trackingProtectedSnapshot(state));
    assert.deepEqual(state, original);
  }
});

check('unlocked rare tracking names and visits the discovered cave instead of the selected forest', () => {
  for (const inventory of [{}, { dino_bone: 2 }]) {
    const state = trackingFixture({ cave: true, inventory });
    const original = structuredClone(state);
    const row = engine.recoveryChoiceRows(state).find((entry) => entry.id === 'risk_track');
    assert.equal(row.enabled, true);
    assert.equal(row.title, '희귀 흔적 추적', 'Missing obsidian still requires cave gathering after other rare loot is found.');
    assert.match(row.detail, /메아리 동굴.*채집/);
    assert.match(row.costText, /동굴 채집/);
    let draws = 0;
    const next = engine.runRecoveryChoiceAction(state, 'shiroko', 'risk_track', {
      rng: () => draws++ === 0 ? 0 : 0.999,
    });
    assert.equal(next.ap, state.ap - 1);
    assert.equal(next.counters.gather, state.counters.gather + 1);
    assert.ok(next.log.some((line) => /채집 성공.*메아리 동굴/.test(line)));
    assert.equal(next.exploration.selectedRegionId, 'whisper-woods', 'A one-off tracking action must not replace the ordinary selected region.');
    assert.deepEqual(state, original);
  }
});

check('sufficient rare stock switches both tracking guidance and the paid action to discovered plains hunting', () => {
  const state = trackingFixture({ plains: true, inventory: { obsidian_shard: 2 } });
  const original = structuredClone(state);
  const row = engine.recoveryChoiceRows(state).find((entry) => entry.id === 'risk_track');
  assert.equal(row.enabled, true);
  assert.equal(row.title, '메가파우나 추적');
  assert.match(row.detail, /햇살 초원.*사냥/);
  assert.match(row.costText, /초원 사냥/);
  let draws = 0;
  const next = engine.runRecoveryChoiceAction(state, 'hina', 'risk_track', {
    rng: () => draws++ === 0 ? 0 : 0.999,
  });
  assert.equal(next.ap, state.ap - 1);
  assert.equal(next.counters.hunt, state.counters.hunt + 1);
  assert.ok(next.log.some((line) => /사냥 성공.*햇살 초원/.test(line)));
  assert.equal(next.exploration.selectedRegionId, 'whisper-woods');
  assert.deepEqual(state, original);

  const missingPlains = trackingFixture({ cave: true, inventory: { obsidian_shard: 2 } });
  const missingRow = engine.recoveryChoiceRows(missingPlains).find((entry) => entry.id === 'risk_track');
  assert.equal(missingRow.enabled, false);
  assert.match(missingRow.detail, /초원.*발견/);
  const rejected = engine.runRecoveryChoiceAction(missingPlains, 'hina', 'risk_track', {
    rng: () => { throw new Error('Undiscovered plains tracking consumed RNG.'); },
  });
  assert.deepEqual(trackingProtectedSnapshot(rejected), trackingProtectedSnapshot(missingPlains));
});

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

check('remaining rare-event branches apply their declared loot, AP, hunger, stamina, and failure costs', () => {
  for (const [kind, expected] of Object.entries(RARE_EVENT_EXPECTATIONS)) {
    for (const outcome of ['success', 'failure']) {
      const initial = eventFixture(kind);
      const row = engine.eventChainRows(initial, 'noa').find((entry) => entry.id === 'rare-chain');
      assert.ok(row?.enabled, `${kind} ${outcome} fixture should be actionable`);
      const actorBefore = initial.party.find((member) => member.id === row.actorId);
      assert.ok(actorBefore, `${kind} should resolve the declared actor`);
      const draw = outcome === 'success' ? () => 0 : () => 0.999;
      const resolved = engine.runEventChainAction(initial, 'noa', 'rare-chain', { rng: draw });
      const actorAfter = resolved.party.find((member) => member.id === row.actorId);

      assert.equal(resolved.ap, initial.ap - 1, `${kind} consumes one AP`);
      assert.equal(resolved.eventChains[0].resolved, true);
      assert.equal(resolved.eventChains[0].ok, outcome === 'success');
      assert.equal(actorAfter.hunger, actorBefore.hunger + expected.hungerAdd);
      if (outcome === 'success') {
        assert.equal(actorAfter.stamina, actorBefore.stamina - expected.staminaCost);
        assert.equal(actorAfter.hp, actorBefore.hp);
        for (const [itemId, quantity] of Object.entries(expected.rewards)) {
          assert.equal(resolved.inventory[itemId], Number(initial.inventory[itemId] || 0) + quantity, `${kind} rewards ${itemId}`);
        }
      } else {
        assert.equal(actorAfter.stamina, actorBefore.stamina - expected.staminaCost - expected.failStamina);
        assert.equal(actorAfter.hp, actorBefore.hp - expected.failDamage, `${kind} failure damage`);
        for (const itemId of Object.keys(expected.rewards)) {
          assert.equal(Number(resolved.inventory[itemId] || 0), Number(initial.inventory[itemId] || 0), `${kind} failure grants no ${itemId}`);
        }
      }
    }
  }
});

check('expired, exhausted, and under-stamina event chains cannot resolve or charge the run', () => {
  const expired = engine.normalizeState({ ...eventFixture('megafauna_tracks'), day: 11 });
  assert.equal(engine.eventChainRows(expired, 'noa').some((row) => row.id === 'rare-chain'), false);
  const expiredSnapshot = eventProtectedSnapshot(expired);
  const expiredAttempt = engine.runEventChainAction(expired, 'noa', 'rare-chain', { rng: () => 0 });
  assert.deepEqual(eventProtectedSnapshot(expiredAttempt), expiredSnapshot);

  const exhausted = engine.normalizeState({ ...eventFixture('rune_cache'), ap: 0 });
  assert.equal(engine.eventChainRows(exhausted, 'noa').find((row) => row.id === 'rare-chain').enabled, false);
  const exhaustedSnapshot = eventProtectedSnapshot(exhausted);
  const exhaustedAttempt = engine.runEventChainAction(exhausted, 'noa', 'rare-chain', { rng: () => 0 });
  assert.deepEqual(eventProtectedSnapshot(exhaustedAttempt), exhaustedSnapshot);

  const tired = engine.normalizeState({
    ...eventFixture('mutant_nest'),
    party: eventFixture('mutant_nest').party.map((member) => ({ ...member, stamina: 11 })),
  });
  assert.equal(engine.eventChainRows(tired, 'noa').find((row) => row.id === 'rare-chain').enabled, false);
  const tiredSnapshot = eventProtectedSnapshot(tired);
  const tiredAttempt = engine.runEventChainAction(tired, 'noa', 'rare-chain', { rng: () => 0 });
  assert.deepEqual(eventProtectedSnapshot(tiredAttempt), tiredSnapshot);
});

check('locked or unaffordable projects preserve materials, progress, and AP', () => {
  const locked = engine.normalizeState({
    ...projectFixture(),
    research: { ...projectFixture().research, completed: {} },
  });
  const lockedRow = engine.projectRows(locked).find((row) => row.id === 'drying-rack');
  assert.equal(lockedRow.available, false);
  assert.equal(lockedRow.canWork, false);
  const lockedResult = engine.runProjectAction(locked, locked.party[0].id, 'drying-rack', { rng: () => 0 });
  assert.equal(lockedResult.ap, locked.ap);
  assert.deepEqual(lockedResult.inventory, locked.inventory);
  assert.deepEqual(lockedResult.projects, locked.projects);

  const shortOnMaterials = engine.normalizeState({
    ...projectFixture(),
    inventory: { ...projectFixture().inventory, wood: 2, fiber: 2 },
  });
  const shortRow = engine.projectRows(shortOnMaterials).find((row) => row.id === 'drying-rack');
  assert.equal(shortRow.available, true);
  assert.equal(shortRow.hasCost, false);
  assert.equal(shortRow.canWork, false);
  const rejected = engine.runProjectAction(shortOnMaterials, shortOnMaterials.party[0].id, 'drying-rack', { rng: () => 0 });
  assert.equal(rejected.ap, shortOnMaterials.ap);
  assert.deepEqual(rejected.inventory, shortOnMaterials.inventory);
  assert.deepEqual(rejected.projects, shortOnMaterials.projects);
});

console.log(JSON.stringify({
  checks: checks.length,
  pass: failures.length === 0,
  failures,
  evidence: 'fresh deterministic synthetic engine fixtures; no browser, natural-play or balance claim',
}, null, 2));
if (failures.length) process.exitCode = 1;
