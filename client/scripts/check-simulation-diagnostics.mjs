import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';
import {
  buildSimulationDiagnostics,
  classifySimulationDeathSource,
} from '../src/app/simulation/_lib/simulationDiagnostics.js';

const { createPhaseDeathRuntime } = await import('../src/app/simulation/_lib/phaseDeathRuntime.js');

let checks = 0;
function check(name, run) {
  run();
  checks += 1;
  console.log(`PASS ${name}`);
}

check('explicit wildlife identity cannot inflate the PvP death share', () => {
  assert.equal(classifySimulationDeathSource({ reason: 'wildlife_hunt', by: 'wildlife:bear:z:1' }), 'wildlife');
  assert.equal(classifySimulationDeathSource({ reason: 'hp_zero_reconcile', by: 'wildlife:wolf:z:2' }), 'wildlife');
});

check('combat reasons remain PvP even when a legacy event omitted its killer', () => {
  assert.equal(classifySimulationDeathSource({ reason: 'combat' }), 'pvp');
  assert.equal(classifySimulationDeathSource({ reason: 'critical_flee', by: 'hunter' }), 'pvp');
  assert.equal(classifySimulationDeathSource({ reason: 'character_skill_splash', by: 'caster' }), 'pvp');
});

check('environmental reasons override an incidental source field and legacy killers still classify', () => {
  assert.equal(classifySimulationDeathSource({ reason: 'detonation', by: 'stale-last-attacker' }), 'environment');
  assert.equal(classifySimulationDeathSource({ reason: 'forbidden_zone' }), 'environment');
  assert.equal(classifySimulationDeathSource({ reason: 'legacy', by: 'actor-a' }), 'pvp');
});

check('diagnostics expose mutually consistent death source and reason totals', () => {
  const runEvents = [
    { kind: 'death', reason: 'wildlife_hunt', by: 'wildlife:bear:z:1', at: { day: 2, phase: 'night' } },
    { kind: 'death', reason: 'combat', by: 'actor-a', at: { day: 3, phase: 'morning' } },
    { kind: 'death', reason: 'character_skill_splash', by: 'actor-b', at: { day: 4, phase: 'night' } },
    { kind: 'death', reason: 'detonation', by: 'stale-last-attacker', at: { day: 6, phase: 'morning' } },
    { kind: 'death', reason: 'status_effect', at: { day: 1, phase: 'night' } },
  ];
  const metrics = buildSimulationDiagnostics({ runEvents });
  assert.deepEqual({ total: metrics.deaths.total, pvp: metrics.deaths.pvp, nonPvp: metrics.deaths.nonPvp,
    wildlife: metrics.deaths.wildlife, environment: metrics.deaths.environment },
  { total: 5, pvp: 2, nonPvp: 3, wildlife: 1, environment: 2 });
  assert.equal(metrics.deaths.pvp + metrics.deaths.nonPvp, metrics.deaths.total);
  assert.equal(metrics.deaths.wildlife + metrics.deaths.environment, metrics.deaths.nonPvp);
  assert.deepEqual(metrics.deaths.byReason, {
    wildlife_hunt: 1, combat: 1, character_skill_splash: 1, detonation: 1, status_effect: 1,
  });
});

check('equipment diagnostics resolve equipped ids through inventory and catalog metadata', () => {
  const survivor = {
    _id: 'actor-a',
    equipped: {
      weapon: 'gear-weapon',
      head: 'gear-head',
      clothes: 'gear-clothes',
      arm: 'gear-arm',
      shoes: 'gear-shoes',
    },
    inventory: [
      { itemId: 'gear-head', tier: 4 },
      { id: 'gear-clothes', craftedTier: 4 },
      { _id: 'gear-arm', tier: 4 },
      { externalId: 'gear-shoes', tier: 4 },
    ],
  };
  const metrics = buildSimulationDiagnostics({
    survivors: [survivor],
    itemMetaById: { 'gear-weapon': { tier: 4 } },
  });
  assert.equal(metrics.equipment.totalEquipped, 5);
  assert.equal(metrics.equipment.tierCounts.t4, 5);
  assert.equal(metrics.equipment.tierCounts.unknown, 0);
  assert.equal(metrics.equipment.heroGearReadyCount, 1);
  assert.equal(metrics.equipment.actors[0].heroOrBetter, 5);
});

check('chase diagnostics distinguish initial escape from the final chase result', () => {
  const metrics = buildSimulationDiagnostics({
    runEvents: [
      { kind: 'chase', outcome: 'caught', escaped: true, caught: true },
      { kind: 'chase', outcome: 'escaped_after_chase', escaped: true, caught: false },
      { kind: 'chase', outcome: 'escape_no_chase', escaped: true, caught: false },
      { kind: 'chase', outcome: 'blink_escape', escaped: true, caught: false },
      { kind: 'chase', outcome: 'escape_fail', escaped: false, caught: true },
    ],
  });
  assert.deepEqual(metrics.chase, {
    total: 5,
    caught: 2,
    finalEscaped: 3,
    escaped: 4,
    escapeFail: 1,
    escapeNoChase: 1,
    escapedAfterChase: 1,
    blinkEscape: 1,
  });
  assert.equal(metrics.chase.caught + metrics.chase.finalEscaped, metrics.chase.total);
});

check('dead participant readiness uses the pre-loot death snapshot', () => {
  const strippedDead = {
    _id: 'dead-a',
    equipped: { weapon: 't1-weapon' },
    inventory: [{ itemId: 't1-weapon', tier: 1 }],
  };
  const equipmentAtDeath = {
    equippedCount: 5,
    heroOrBetter: 5,
    legendOrBetter: 0,
    bestTier: 4,
    tierCounts: { t1: 0, t2: 0, t3: 0, t4: 5, t5: 0, t6: 0, unknown: 0 },
  };
  const metrics = buildSimulationDiagnostics({
    dead: [strippedDead],
    runEvents: [{ kind: 'death', who: 'dead-a', reason: 'combat', equipmentAtDeath }],
  });
  assert.equal(metrics.equipment.heroGearReadyCount, 1);
  assert.equal(metrics.equipment.totalEquipped, 5);
  assert.equal(metrics.equipment.tierCounts.t4, 5);
  assert.equal(metrics.equipment.actors[0].source, 'death');
});

check('a revived final survivor ignores its stale earlier death snapshot', () => {
  const survivor = {
    _id: 'revived-a',
    equipped: { weapon: 't1-weapon' },
    inventory: [{ itemId: 't1-weapon', tier: 1 }],
  };
  const metrics = buildSimulationDiagnostics({
    survivors: [survivor],
    runEvents: [{ kind: 'death', who: 'revived-a', reason: 'combat', equipmentAtDeath: {
      equippedCount: 5, heroOrBetter: 5, legendOrBetter: 0, bestTier: 4,
      tierCounts: { t1: 0, t2: 0, t3: 0, t4: 5, t5: 0, t6: 0, unknown: 0 },
    } }],
  });
  assert.equal(metrics.equipment.heroGearReadyCount, 0);
  assert.equal(metrics.equipment.totalEquipped, 1);
  assert.equal(metrics.equipment.actors[0].source, 'final');
});

check('death events capture equipment before PvP loot can strip the victim', () => {
  const events = [];
  const actor = {
    _id: 'victim-a',
    name: 'victim-a',
    zoneId: 'z1',
    equipped: { weapon: 'w', head: 'h', clothes: 'c', arm: 'a', shoes: 's' },
    inventory: ['w', 'h', 'c', 'a', 's'].map((itemId) => ({ itemId, tier: 4 })),
  };
  const runtime = createPhaseDeathRuntime({
    phaseIdxNow: 3,
    emitRunEvent: (kind, payload) => events.push({ kind, ...payload }),
    atNow: () => ({ day: 2, phase: 'night', sec: 100 }),
  });
  runtime.emitDeathRunEventOnce(actor, { reason: 'combat', by: 'killer-a' });
  assert.equal(events.length, 1);
  assert.equal(events[0].kind, 'death');
  assert.equal(events[0].equipmentAtDeath.equippedCount, 5);
  assert.equal(events[0].equipmentAtDeath.heroOrBetter, 5);
  assert.equal(events[0].equipmentAtDeath.tierCounts.t4, 5);
});

console.log(`SIMULATION_DIAGNOSTICS_CHECKS ${checks}/${checks}`);
