import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';

const { createPlanningMovePowerSnapshot, estimateMovePower } = await import('../src/app/simulation/_lib/movePowerRuntime.js');
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
