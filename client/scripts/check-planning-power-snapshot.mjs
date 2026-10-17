import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';

const { createPlanningMovePowerSnapshot, estimateMovePower, shouldAvoidCombatByMovePower,
  sortActorsByMovePowerDescending } = await import('../src/app/simulation/_lib/movePowerRuntime.js');
const { buildTeamCoordination, pickTeamSafeZone } = await import('../src/app/simulation/_lib/teamTacticsRuntime.js');
const { getRuleset } = await import('../src/utils/rulesets.js');
const { makeShieldEffect, makeRegenEffect } = await import('../src/utils/statusEffectDefinitions.js');
const { getShieldValue, getRegenValue } = await import('../src/utils/statusEffectSelectors.js');
const { getWeaponMasteryLevel } = await import('../src/utils/erMeta.js');

let checks = 0;
const check = (name, run) => { run(); checks++; console.log(`PASS ${name}`); };
const actor = (id, teamId, zoneId, extra = {}) => ({ _id: id, name: id, teamId, zoneId, hp: 100, maxHp: 100,
  weaponType: '양손검', stats: { attackPower: 24, defense: 14, maxHp: 100 }, inventory: [], ...extra });
const graph = { a: ['b', 'd'], b: ['a', 'c'], c: ['b', 'd'], d: ['a', 'c'] };
const ruleset = getRuleset('ER_S11'), context = { ruleset, battleSettings: { battle: { erMetaScale: 0.7 } } };
const roster = [actor('leader', 'one', 'a', { teamSlot: 1 }), actor('friend', 'one', 'a', { teamSlot: 2 }),
  actor('enemy', 'two', 'b', { hp: 75, erRole: 'assassin' })];

check('position-only search copies preserve exact power and input ownership', () => {
  const before = structuredClone(roster), snapshot = createPlanningMovePowerSnapshot(roster, context);
  for (const row of roster) for (const zoneId of Object.keys(graph)) {
    const projected = { ...row, zoneId };
    assert.equal(snapshot(projected), estimateMovePower(projected, context));
  }
  assert.deepEqual(roster, before);
  assert.ok(roster.every(row => !Object.hasOwn(row, '_planningPower')));
});

check('one strength calculation serves repeated graph queries, not repeated stat reads', () => {
  let reads = 0;
  const row = actor('counted', 'one', 'a', { stats: { get attackPower() { reads++; return 24; } } });
  const snapshot = createPlanningMovePowerSnapshot([row], context), initial = reads;
  assert.ok(initial > 0);
  for (let i = 0; i < 200; i++) snapshot({ ...row, zoneId: ['a', 'b'][i % 2] });
  assert.equal(reads, initial);
});

check('move-power sorting matches the stable independent reference and preserves the avoid choice', () => {
  const tieFirst = actor('tie-first', 'two', 'a');
  const stronger = actor('stronger', 'two', 'a', { stats: { attackPower: 120, defense: 14, maxHp: 100 } });
  const tieSecond = actor('tie-second', 'two', 'a');
  const weaker = actor('weaker', 'two', 'a', { stats: { attackPower: 8, defense: 14, maxHp: 100 } });
  const legacySort = rows => rows.slice().sort((left, right) =>
    Number(estimateMovePower(right, context) || 0) - Number(estimateMovePower(left, context) || 0));
  const rows = [tieFirst, stronger, tieSecond, weaker];
  const originalRows = rows.slice();
  const expected = legacySort(rows);
  const actual = sortActorsByMovePowerDescending(rows, context);
  assert.deepEqual(actual, expected);
  assert.deepEqual(rows, originalRows, 'Sorting must not reorder the source roster.');
  assert.equal(actual[1], tieFirst, 'Equal scores must retain the input roster order.');
  assert.equal(actual[2], tieSecond, 'Equal scores must retain the input roster order.');
  const reordered = [tieSecond, weaker, tieFirst, stronger];
  assert.deepEqual(sortActorsByMovePowerDescending(reordered, context), legacySort(reordered));
  const me = actor('me', 'one', 'a', { stats: { attackPower: 15, defense: 14, maxHp: 100 } });
  assert.deepEqual(shouldAvoidCombatByMovePower(me, actual[0], context),
    shouldAvoidCombatByMovePower(me, expected[0], context));
});

check('zero/one-item sorts avoid estimating and batched scoring reduces repeated comparator work', () => {
  let singletonReads = 0;
  const singleton = actor('single', 'one', 'a', { stats: { get attackPower() { singletonReads++; return 24; } } });
  assert.deepEqual(sortActorsByMovePowerDescending([], context), []);
  assert.deepEqual(sortActorsByMovePowerDescending([singleton], context), [singleton]);
  assert.equal(singletonReads, 0, 'A roster smaller than two must not invoke move-power estimation.');

  const makeCounted = id => actor(id, 'one', 'a', { stats: { get attackPower() { countedReads++; return 24; },
    defense: 14, maxHp: 100 } });
  let countedReads = 0;
  const rows = [makeCounted('c'), makeCounted('a'), makeCounted('b'), makeCounted('d'), makeCounted('e')];
  const expected = rows.slice().sort((left, right) =>
    Number(estimateMovePower(right, context) || 0) - Number(estimateMovePower(left, context) || 0));
  const comparatorReads = countedReads;
  countedReads = 0;
  const actual = sortActorsByMovePowerDescending(rows, context);
  const batchedReads = countedReads;
  assert.deepEqual(actual, expected);
  assert.ok(batchedReads < comparatorReads, `Expected fewer stat reads (${batchedReads} < ${comparatorReads}).`);
});

check('finite and nonfinite estimated scores retain historical ordering semantics', () => {
  const plainA = actor('plain-a', 'one', 'a');
  const plainB = actor('plain-b', 'one', 'a');
  const equipped = actor('equipped', 'one', 'a', { inventory: [{ itemId: 'w', equipSlot: 'weapon', type: '무기', tier: 2 }],
    equipped: { weapon: 'w' } });
  const rows = [plainA, equipped, plainB];
  const infiniteContext = { ...context, ruleset: { ...ruleset, ai: { ...ruleset.ai, powerWeaponPerTier: Infinity } } };
  const legacyInfinite = rows.slice().sort((left, right) =>
    Number(estimateMovePower(right, infiniteContext) || 0) - Number(estimateMovePower(left, infiniteContext) || 0));
  assert.equal(estimateMovePower(equipped, infiniteContext), Infinity);
  assert.deepEqual(sortActorsByMovePowerDescending(rows, infiniteContext), legacyInfinite);
  const nanContext = { ...context, ruleset: { ...ruleset, ai: { ...ruleset.ai, powerWeaponPerTier: NaN } } };
  const legacyNan = rows.slice().sort((left, right) =>
    Number(estimateMovePower(right, nanContext) || 0) - Number(estimateMovePower(left, nanContext) || 0));
  assert.ok(rows.every(row => Number.isNaN(estimateMovePower(row, nanContext))));
  assert.deepEqual(sortActorsByMovePowerDescending(rows, nanContext), legacyNan);
});

check('a later action sort reads current HP, equipment, status and role facts', () => {
  const changing = actor('changing', 'two', 'a', { stats: { attackPower: 18, defense: 14, maxHp: 100 } });
  const steady = actor('steady', 'two', 'a', { stats: { attackPower: 35, defense: 14, maxHp: 100 } });
  const currentLegacySort = rows => rows.slice().sort((left, right) =>
    Number(estimateMovePower(right, context) || 0) - Number(estimateMovePower(left, context) || 0));
  const candidates = [changing, steady];
  assert.deepEqual(sortActorsByMovePowerDescending(candidates, context), currentLegacySort(candidates));
  assert.equal(sortActorsByMovePowerDescending(candidates, context)[0], steady);

  changing.hp = 25;
  changing.stats = { ...changing.stats, attackPower: 100 };
  changing.inventory = [{ itemId: 'updated-weapon', equipSlot: 'weapon', type: '무기', tier: 6 }];
  changing.equipped = { weapon: 'updated-weapon' };
  changing.activeEffects = [makeShieldEffect(18, 5), makeRegenEffect(7, 5)];
  changing.erRole = 'assassin';
  const afterBoundary = sortActorsByMovePowerDescending(candidates, context);
  assert.deepEqual(afterBoundary, currentLegacySort(candidates));
  assert.equal(afterBoundary[0], changing, 'The later sort must use changed actor facts, not prior scores.');
  const me = actor('me-after-perk', 'one', 'a', { hp: 30 });
  me._perkRuntime = { aggressionPlus: 0.8 };
  assert.deepEqual(shouldAvoidCombatByMovePower(me, afterBoundary[0], context),
    shouldAvoidCombatByMovePower(me, currentLegacySort(candidates)[0], context));
});

check('a new action boundary recomputes changed HP, equipment, effects and mastery', () => {
  const row = structuredClone(roster[0]);
  const prior = createPlanningMovePowerSnapshot([row], context)(row);
  const variants = [
    { ...row, hp: 20 },
    { ...row, stats: { ...row.stats, attackPower: 80 } },
    { ...row, inventory: [{ itemId: 'new-weapon', equipSlot: 'weapon', type: '무기', tier: 6 }],
      equipped: { weapon: 'new-weapon' } },
    { ...row, activeEffects: [makeShieldEffect(10, 5), makeRegenEffect(4, 5)] },
    { ...row, erRole: 'assassin' },
  ];
  assert.equal(getShieldValue(variants[3]), 10);
  assert.equal(getRegenValue(variants[3]), 4);
  for (const changed of variants) {
    const next = createPlanningMovePowerSnapshot([changed], context)(changed);
    assert.equal(next, estimateMovePower(changed, context));
    assert.notEqual(next, prior);
  }
  // Mastery affects other ER modifiers, not the current move-power score.
  // Preserve the direct estimator's result instead of inventing a power bonus.
  const mastered = { ...row, mastery: { weapon: { xp: 1200, level: 8 } } };
  assert.equal(getWeaponMasteryLevel(mastered), 8);
  assert.equal(createPlanningMovePowerSnapshot([mastered], context)(mastered), estimateMovePower(mastered, context));
});

check('unknown, missing and duplicate identities use the original estimator', () => {
  const first = actor('duplicate', 'one', 'a'), second = actor('duplicate', 'two', 'b', { hp: 15 });
  const missing = { ...first, _id: undefined }, legacy = { ...first, _id: undefined, id: 'legacy' };
  const snapshot = createPlanningMovePowerSnapshot([first, second, missing, legacy, null], context);
  for (const row of [first, second, missing, legacy, actor('unknown', 'three', 'c'), null]) {
    assert.equal(snapshot(row), estimateMovePower(row, context));
  }
  assert.equal(createPlanningMovePowerSnapshot(null, context)(first), estimateMovePower(first, context));
});

check('safe route, forbidden/blocked path, party projections and coordination stay identical', () => {
  for (let scenario = 0; scenario < 45; scenario++) {
    const rows = roster.map((row, i) => ({ ...structuredClone(row),
      zoneId: Object.keys(graph)[(scenario + i) % 4], hp: 20 + (scenario * (i + 1)) % 81 }));
    const forbiddenIds = new Set(scenario % 3 ? [] : ['c']);
    const snapshot = createPlanningMovePowerSnapshot(rows, context), direct = row => estimateMovePower(row, context);
    for (const row of rows) for (const targetZoneId of ['', 'a', 'c']) for (const travelParty of [[], rows.slice(0, 2)]) {
      const options = { targetZoneId, travelParty, maxDepth: 4, enemyFree: scenario % 2 === 0 };
      assert.deepEqual(pickTeamSafeZone(row, rows, graph, forbiddenIds, { ...options, estimatePower: snapshot }),
        pickTeamSafeZone(row, rows, graph, forbiddenIds, { ...options, estimatePower: direct }));
    }
    const options = { roster: rows, zoneGraph: graph, forbiddenIds, day: 3, phase: 'night', ruleset,
      chooseLeaderMove: () => ({ targets: ['d'], reason: 'controlled-route' }) };
    assert.deepEqual(buildTeamCoordination({ ...options, estimatePower: snapshot }),
      buildTeamCoordination({ ...options, estimatePower: direct }));
  }
});

console.log(JSON.stringify({ pass: true, checks, scope: 'independent planning snapshot and path equivalence; not browser pace or full match acceptance' }));
