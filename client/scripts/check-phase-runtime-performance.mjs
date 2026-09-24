import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';

const { cloneMovementRosterForPlanning, runPhaseActorActionPipeline } = await import('../src/app/simulation/_lib/phaseActorActionPipelineRuntime.js');
const { refreshActorGrowthPlan } = await import('../src/app/simulation/_lib/growthPlanRuntime.js');
const { getActorDimensionRiftId } = await import('../src/app/simulation/_lib/dimensionRiftSpaceRuntime.js');
const { appendSimulationLog } = await import('../src/app/simulation/_lib/logActionRuntime.js');
const { ensureEquipped } = await import('../src/app/simulation/_lib/survivorRuntime.js');
const { getInvItemId, inferEquipSlot } = await import('../src/app/simulation/_lib/inventoryRules.js');
const { EQUIP_SLOTS } = await import('../src/app/simulation/_lib/simulationConstants.js');
const { ER_STAT_FIELDS, ER_STAT_KEYS, DEFAULT_ER_STATS, normalizeErStats } = await import('../src/utils/erStats.js');

let checks = 0;
const check = (name, run) => {
  run();
  checks += 1;
  console.log(`PASS ${name}`);
};

check('the action pipeline treats a malformed roster as an empty boundary', () => {
  const result = runPhaseActorActionPipeline({ state: { phaseSurvivors: null } });
  assert.deepEqual(result, { newlyDead: [], pendingPickAssigned: false, updatedSurvivors: [] });
});

const source = [
  {
    _id: 'planner-1',
    hp: 100,
    zoneId: 'a',
    inventory: [{ itemId: 'fiber', qty: 1, tags: ['route_goal'], metadata: { source: 'field' } }],
    activeEffects: [{ name: 'read-only-status', remainingDuration: 5 }],
    _spatial: { x: 1, y: 2 },
  },
  {
    _id: 'rift-1',
    hp: 100,
    zoneId: 'a',
    _combatSpaceId: 'dimension_rift:r1',
    _dimensionRiftEntry: { riftId: 'r1', enteredAtSec: 10 },
    inventory: [],
  },
];

check('planning roster keeps legacy output while isolating planner-owned fields', () => {
  const legacy = structuredClone(source.filter((actor) => !getActorDimensionRiftId(actor)));
  legacy.forEach((actor) => refreshActorGrowthPlan(actor, [], {}));

  const optimized = cloneMovementRosterForPlanning(source);
  optimized.forEach((actor) => refreshActorGrowthPlan(actor, [], {}));

  assert.deepEqual(optimized, legacy);
  assert.equal(optimized.length, 1, 'dimension-rift actors stay out of world movement planning');
  assert.notEqual(optimized[0], source[0]);
  assert.notEqual(optimized[0].inventory, source[0].inventory);
  assert.notEqual(optimized[0].inventory[0].metadata, source[0].inventory[0].metadata);
  assert.equal(optimized[0].activeEffects, source[0].activeEffects, 'read-only status state is not deep-cloned');
  optimized[0].inventory[0].metadata.source = 'planner-only';
  assert.equal(source[0].inventory[0].metadata.source, 'field');
});

check('full log refs append in place without changing order or contents', () => {
  const refs = { fullLogsRef: { current: [] }, fullLogEntriesRef: { current: [] }, logSeqRef: { current: 0 } };
  const fullLogs = refs.fullLogsRef.current;
  const fullEntries = refs.fullLogEntriesRef.current;
  const updates = [];
  for (let index = 0; index < 2000; index += 1) {
    appendSimulationLog({ text: `line-${index}`, type: 'system', refs, actions: { setLogs: (update) => updates.push(update) } });
  }
  assert.equal(refs.fullLogsRef.current, fullLogs);
  assert.equal(refs.fullLogEntriesRef.current, fullEntries);
  assert.equal(refs.fullLogsRef.current.length, 2000);
  assert.equal(refs.fullLogEntriesRef.current[1999].text, 'line-1999');
  assert.equal(updates.length, 2000, 'visible React updaters remain one per log');
});

check('visible log enqueue preserves one immutable entry per event', () => {
  const refs = { fullLogsRef: { current: [] }, fullLogEntriesRef: { current: [] }, logSeqRef: { current: 0 } };
  const visible = [];
  appendSimulationLog({ text: 'queued', type: 'highlight', refs, actions: {
    enqueueVisibleLog: (entry) => visible.push(entry),
  } });
  assert.deepEqual(visible, [{ text: 'queued', type: 'highlight', id: 'log-1' }]);
});

function legacyEnsureEquipped(actor) {
  const inventory = Array.isArray(actor?.inventory) ? actor.inventory : [];
  const equipped = Object.fromEntries(EQUIP_SLOTS.map((slot) => [slot,
    actor?.equipped && typeof actor.equipped === 'object' ? actor.equipped[slot] ?? null : null]));
  const tier = (entry) => Number.isFinite(Number(entry?.tier ?? entry?.t ?? 1))
    ? Math.max(1, Math.min(6, Math.floor(Number(entry?.tier ?? entry?.t ?? 1)))) : 1;
  for (const slot of EQUIP_SLOTS) {
    const id = String(equipped[slot] || '');
    const current = id ? inventory.find((entry) => String(getInvItemId(entry)) === id) : null;
    const candidates = inventory.filter((entry) => String(entry?.equipSlot || inferEquipSlot(entry) || '').toLowerCase() === slot);
    candidates.sort((left, right) => (tier(right) - tier(left))
      || (Number(right?.acquiredDay ?? 0) - Number(left?.acquiredDay ?? 0)));
    const best = candidates[0];
    equipped[slot] = best && (!current || tier(best) > tier(current))
      ? String(getInvItemId(best)) : current ? String(getInvItemId(current)) : null;
  }
  return equipped;
}

check('one inventory classification pass retains equipment selection and input ownership', () => {
  const values = [undefined, null, 0, 1, 3, 6, '4', -2, NaN, Infinity];
  for (let index = 0; index < 300; index += 1) {
    const inventory = [
      ...EQUIP_SLOTS.flatMap((slot, position) => [
        { itemId: slot, equipSlot: slot.toUpperCase(), tier: values[(index + position) % values.length], acquiredDay: index % 4 },
        { itemId: `${slot}-next`, tags: [slot], tier: values[(index * 3 + position) % values.length], acquiredDay: values[index % values.length] },
      ]),
      { itemId: 'weapon', equipSlot: 'weapon', tier: 6 }, // First matching duplicate ID still wins.
      { itemId: 'ingredient', type: 'material', name: '돌' },
      { itemId: 'legacy', type: '무기', name: '검', t: 4 },
      null,
    ];
    const actor = { inventory, equipped: Object.fromEntries(EQUIP_SLOTS.map((slot) => [slot, index % 2 ? slot : 'absent'])) };
    const before = structuredClone(actor);
    assert.deepEqual(ensureEquipped(actor), legacyEnsureEquipped(actor), `fixture ${index}`);
    assert.deepEqual(actor, before);
  }
  assert.deepEqual(ensureEquipped(null), legacyEnsureEquipped(null));
});

check('equipment classification reads a material once instead of once per equipment slot', () => {
  let nameReads = 0;
  const material = { itemId: 'stone', type: 'material', get name() { nameReads += 1; return '돌'; } };
  ensureEquipped({ inventory: [material] });
  assert.equal(nameReads, 1, 'The shared hot path must not infer each item slot five times.');
});

check('single-pass stat normalization preserves rounding, aliases and independent returned objects', () => {
  const values = [undefined, null, NaN, Infinity, -Infinity, -0, 0, -3, 1.23456, 1.0005, 1e21, '2.4995', '', false];
  for (const round of [undefined, false, true]) for (let index = 0; index < 100; index += 1) {
    const stats = Object.fromEntries(ER_STAT_KEYS.map((key, position) => [index % 2 ? key : key.toUpperCase(),
      values[(index + position) % values.length]]));
    if (index % 3 === 0) stats.attackPower = null;
    const before = structuredClone(stats);
    const expected = {};
    for (const field of ER_STAT_FIELDS) {
      const explicit = stats[field.key] ?? stats[field.key.toUpperCase()];
      const number = Number(explicit !== undefined ? explicit : DEFAULT_ER_STATS[field.key]);
      expected[field.key] = Math.max(field.min ?? 0, Math.min(field.max ?? Infinity,
        Number.isFinite(number) ? number : field.defaultValue ?? 0));
    }
    if (round !== false) for (const field of ER_STAT_FIELDS) {
      expected[field.key] = (field.step ?? 1) < 1 ? Number(expected[field.key].toFixed(3)) : Math.round(expected[field.key]);
    }
    const result = normalizeErStats(stats, { round });
    assert.deepEqual(result, expected);
    assert.deepEqual(stats, before);
    result.attackPower = -99;
    assert.deepEqual(normalizeErStats(stats, { round }), expected, 'No mutable result cache may escape.');
  }
});

console.log(JSON.stringify({ checks, pass: true, scope: 'phase movement/log append and hot normalization contracts; no browser/build' }));
