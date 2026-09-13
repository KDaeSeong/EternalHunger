import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const { createSimulationFrame, createInitialSimulationFrame, reduceSimulationFrame,
  publishSimulationFrame, combineSimulationCounts } = await import('../src/app/simulation/_lib/simulationFrameRuntime.js');
const { runPvpActionLoop } = await import('../src/app/simulation/_lib/phasePvpActionLoopRuntime.js');
const { getMatchEndState } = await import('../src/app/simulation/_lib/matchEndRuntime.js');
const { finalizeSimulationPhase } = await import('../src/app/simulation/_lib/phaseFinalizationRuntime.js');
const { getInvRules } = await import('../src/app/simulation/_lib/inventoryItemRules.js');
const { getRuleset } = await import('../src/utils/rulesets.js');

let checks = 0;
const check = async (name, run) => { await run(); checks += 1; console.log(`PASS ${name}`); };
const actor = (id, extra = {}) => ({ _id: id, name: id, teamId: id, zoneId: 'a', hp: 100, maxHp: 100,
  inventory: [{ itemId: 'part', qty: 2 }], equipped: { weapon: 'weapon-a' }, ...extra });
const input = (extra = {}) => ({ day: 2, phase: 'night', matchSec: 380, survivors: [actor('a')], dead: [actor('b', { hp: 0 })],
  killCounts: { a: 1 }, spawnState: { mapId: 'map', fieldResources: { remaining: 2 } },
  forbiddenIds: new Set(['b']), mapId: 'map', ...extra });

await check('one publish replaces clock, life state, gear, counters and world together', () => {
  const frame = createSimulationFrame(input());
  const actions = [];
  let state = createInitialSimulationFrame();
  publishSimulationFrame(frame, { setSimulationFrame: (value) => {
    actions.push(value); state = reduceSimulationFrame(state, { type: 'publish', frame: value });
  }, setSurvivors: () => assert.fail('Atomic host must not use individual setters.') });
  assert.equal(actions.length, 1);
  assert.equal(state.matchSec, 380);
  assert.equal(state.survivors[0].equipped.weapon, 'weapon-a');
  assert.equal(state.dead[0]._id, 'b');
  assert.equal(state.killCounts.a, 1);
  assert.deepEqual(state.forbiddenZoneIds, ['b']);
  assert.equal(state.spawnState.fieldResources.remaining, 2);
});

await check('mutating the live engine or the UI cannot alter the other side of a frame', () => {
  const source = input();
  const frame = createSimulationFrame(source);
  source.survivors[0].hp = 1;
  source.survivors[0].inventory[0].qty = 0;
  source.spawnState.fieldResources.remaining = 0;
  source.killCounts.a = 2;
  source.forbiddenIds.add('a');
  assert.equal(frame.survivors[0].hp, 100);
  assert.equal(frame.survivors[0].inventory[0].qty, 2);
  assert.equal(frame.spawnState.fieldResources.remaining, 2);
  assert.equal(frame.killCounts.a, 1);
  assert.deepEqual(frame.forbiddenZoneIds, ['b']);
  frame.survivors[0].zoneId = 'b';
  assert.equal(source.survivors[0].zoneId, 'a');
});

await check('revival removes the old corpse in the very same frame, without duplicates', () => {
  const frame = createSimulationFrame(input({ survivors: [actor('a'), actor('b', { hp: 65, revivedOnce: true })],
    dead: [actor('b', { hp: 0 }), actor('b', { hp: 0 })] }));
  assert.equal(frame.survivors.length, 2);
  assert.equal(frame.dead.length, 0);
  assert.equal(frame.survivors[1].hp, 65);
});

await check('normalized death metadata wins over a stale zero-HP row and newer deaths win over old records', () => {
  const frame = createSimulationFrame(input({ survivors: [actor('a', { hp: 0, safeZoneUntil: 20 })],
    dead: [actor('a', { hp: 0, _deathAt: 10 }), actor('a', { hp: 0, _deathAt: 380, safeZoneUntil: 0, _deathBy: 'combat' })] }));
  assert.equal(frame.survivors.length, 0);
  assert.equal(frame.dead.length, 1);
  assert.equal(frame.dead[0]._deathAt, 380);
  assert.equal(frame.dead[0].safeZoneUntil, 0);
});

await check('existing functional field setters retain other fields and counts are not accumulated twice', () => {
  const original = createSimulationFrame(input());
  const changed = reduceSimulationFrame(original, { type: 'field', field: 'survivors', value: (rows) => rows.map((row) => ({ ...row, hp: 90 })) });
  assert.equal(changed.survivors[0].hp, 90);
  assert.equal(original.survivors[0].hp, 100);
  assert.equal(changed.matchSec, 380);
  assert.equal(changed.dead, original.dead);
  assert.deepEqual(combineSimulationCounts({ a: 1 }, { a: 2, b: 1 }), { a: 3, b: 1 });
  assert.deepEqual(combineSimulationCounts({ a: 1 }, { a: 2, b: 1 }), { a: 3, b: 1 });
});

await check('observing preserves death order used by deterministic revival', () => {
  const a = actor('a', { hp: 0 }); const b = actor('b', { hp: 0 }); const c = actor('c', { hp: 0 });
  const frame = createSimulationFrame(input({ survivors: [a, b, c], dead: [c, b, a] }));
  assert.deepEqual(frame.dead.map((row) => row._id), ['c', 'b', 'a']);
});

await check('phase completion preserves chronological corpse order while replacing newer death metadata', async () => {
  let frame;
  await finalizeSimulationPhase({ state: {
    survivorMap: new Map([['c', actor('c')], ['d', actor('d')]]),
    dead: [actor('b', { hp: 0, _deathAt: 10 }), actor('a', { hp: 0, _deathAt: 12 })],
    phaseDeadSnapshots: [actor('a', { hp: 0, _deathAt: 20 })],
  }, actions: { publishFinalFrame: (value) => { frame = value; } } });
  assert.deepEqual(frame.dead.map((row) => row._id), ['b', 'a']);
  assert.equal(frame.dead[1]._deathAt, 20);
});

await check('an elapsed death is published before display wait and the clock stops at that second', async () => {
  let offset = 0; const frames = []; let currentMap;
  await runPvpActionLoop({ state: { updatedSurvivors: [actor('a'), actor('b')], phaseDurationSec: 60,
    getPhaseRuntimeOffsetSec: () => offset, currentActionSec: () => offset },
    actions: { reserveActionSecond: (sec) => { offset += sec; },
      advanceWorld: ({ survivorMap, newDeadIds }) => {
        currentMap = survivorMap;
        if (offset === 1) { survivorMap.get('b').hp = 0; if (!newDeadIds.includes('b')) newDeadIds.push('b'); }
      }, shouldEndMatch: () => getMatchEndState({ survivors: [...currentMap.values()] }).finished,
      publishActionFrame: ({ survivorMap, wait }) => {
        frames.push({ offset, wait, living: [...survivorMap.values()].filter((row) => row.hp > 0).map((row) => row._id) });
      },
    } });
  assert.equal(offset, 1);
  assert.deepEqual(frames.map((frame) => frame.offset), [0, 0.25, 0.5, 0.75, 1]);
  assert.ok(frames.slice(0, -1).every((frame) => frame.living.join(',') === 'a,b'));
  assert.deepEqual(frames.at(-1).living, ['a']);
});

await check('a fully wiped protected roster still publishes every elapsed second until revival phase', async () => {
  let offset = 0; const visible = [];
  await runPvpActionLoop({ state: { updatedSurvivors: [], phaseDurationSec: 3, getPhaseRuntimeOffsetSec: () => offset, currentActionSec: () => offset },
    actions: { reserveActionSecond: (sec) => { offset += sec; }, shouldEndMatch: () => false,
      publishActionFrame: () => visible.push(offset) } });
  assert.deepEqual(visible, [0, 1, 2, 3]);
});

await check('inventory display is wired to the active rules instead of a fixed three-slot label', () => {
  assert.equal(getInvRules(getRuleset()).maxSlots, 10);
  assert.equal(getInvRules({ inventory: { maxSlots: 7 } }).maxSlots, 7);
  const board = readFileSync(new URL('../src/app/simulation/_components/SimulationSurvivorBoard.js', import.meta.url), 'utf8');
  assert.match(board, /getInvRules\(getRuleset\(settings\?\.rulesetId,\s*settings\?\.simulationRuleset\)\)/);
  assert.match(board, /<InventorySummary actor=\{actor\} settings=\{settings\}/);
  assert.match(board, /\{inventory\.length\}\/\{maxSlots\}/);
  assert.doesNotMatch(board, /\{inventory\.length\}\/3/);
});

console.log(`LIVE_FRAME_CHECKS ${checks}/${checks}`);
