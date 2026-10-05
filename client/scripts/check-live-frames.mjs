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
const { subscribeObserverWorkMeasurements } = await import('../src/app/simulation/_lib/observerWorkMeasurementRuntime.js');

let checks = 0;
const check = async (name, run) => { await run(); checks += 1; console.log(`PASS ${name}`); };
const actor = (id, extra = {}) => ({ _id: id, name: id, teamId: id, zoneId: 'a', hp: 100, maxHp: 100,
  inventory: [{ itemId: 'part', qty: 2 }], equipped: { weapon: 'weapon-a' }, ...extra });
const input = (extra = {}) => ({ day: 2, phase: 'night', matchSec: 380, survivors: [actor('a')], dead: [actor('b', { hp: 0 })],
  killCounts: { a: 1 }, spawnState: { mapId: 'map', fieldResources: { remaining: 2 } },
  forbiddenIds: new Set(['b']), mapId: 'map', ...extra });
// Exercise the actual owned-frame boundary, not a candidate copy helper or an
// old saved match. Keep these contracts when changing publication performance.
const copyFrameData = (value) => createSimulationFrame(input({ spawnState: value })).spawnState;

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

await check('snapshot data retains primitive values, sparse arrays, own keys and native writable output', () => {
  const tags = new Array(4); tags[1] = undefined; tags[3] = '검'; tags.extra = { count: 2 };
  const record = Object.create(null);
  Object.defineProperty(record, '__proto__', { value: { own: true }, enumerable: true });
  Object.defineProperty(record, 'hidden', { value: 'ignore', enumerable: false });
  record[Symbol('ignore')] = 'ignore';
  record.primitive = [undefined, null, false, 0, -0, NaN, Infinity, -Infinity, 9n, '名字'];
  record.tags = Object.freeze(tags);
  Object.freeze(record);
  const copied = copyFrameData(record);
  assert.deepEqual(copied, structuredClone(record));
  assert.equal(Object.getPrototypeOf(copied), Object.prototype);
  assert.equal(Object.hasOwn(copied, '__proto__'), true);
  assert.equal(copied.own, undefined);
  assert.equal(Object.hasOwn(copied.tags, 0), false);
  assert.equal(Object.hasOwn(copied.tags, 1), true);
  assert.equal(Object.hasOwn(copied, 'hidden'), false);
  assert.equal(Object.getOwnPropertyDescriptor(copied, '__proto__').writable, true);
  copied.tags.extra.count = 3;
  assert.equal(record.tags.extra.count, 2);
});

await check('snapshot data preserves cyclic and cross-field aliases while owning the complete graph', () => {
  const shared = { key: 'same', nested: [1, 2] };
  const root = { a: shared, b: shared, rows: [shared] };
  shared.owner = root; root.self = root;
  const copied = copyFrameData(root);
  assert.deepEqual(copied, structuredClone(root));
  assert.equal(copied.a, copied.b);
  assert.equal(copied.a, copied.rows[0]);
  assert.equal(copied.self, copied);
  assert.equal(copied.a.owner, copied);
  assert.notEqual(copied, root); assert.notEqual(copied.a, shared);
  copied.a.nested.push(3);
  assert.deepEqual(shared.nested, [1, 2]);
});

await check('frame publication retains built-in snapshot values and cross-aliases', () => {
  const shared = { hp: 2 };
  const buffer = new ArrayBuffer(8), bytes = new Uint8Array(buffer);
  bytes[3] = 17;
  const source = { shared, map: new Map([[shared, new Set([shared])]]), date: new Date(123),
    regex: /test/gi, buffer, bytes, view: new DataView(buffer, 2, 4) };
  source.map.set(source, shared); source.regex.lastIndex = 4;
  const copied = copyFrameData(source);
  assert.deepEqual(copied, structuredClone(source));
  assert.equal(copied.map.get(copied), copied.shared);
  assert.equal(copied.map.get(copied.shared).has(copied.shared), true);
  assert.equal(copied.bytes.buffer, copied.buffer);
  assert.equal(copied.view.buffer, copied.buffer);
  copied.bytes[3] = 33; assert.equal(bytes[3], 17);
  assert.equal(copied.regex.lastIndex, 0);
});

await check('frame publication reads each accessor once and preserves authoritative errors', () => {
  let reads = 0;
  const shared = { value: 7 };
  const source = { first: shared, get value() { reads++; return shared; }, last: shared };
  const copied = copyFrameData(source);
  assert.equal(reads, 1);
  assert.equal(copied.value, copied.first); assert.equal(copied.value, copied.last);
  assert.notEqual(copied.value, shared);
  const broken = { get value() { throw new Error('authoritative getter'); } };
  assert.throws(() => copyFrameData(broken), /authoritative getter/);
});

await check('unsupported snapshot values still raise the authoritative native clone error', () => {
  for (const value of [() => {}, Symbol('bad'), new WeakMap(), Promise.resolve(1)]) {
    assert.throws(() => copyFrameData({ nested: { value } }), { name: 'DataCloneError' });
  }
});

await check('frames copy shared item keys exactly once per frame without caching mutable state between frames', () => {
  const keys = { item: '소재' };
  const inventory = [{ itemId: 'item', qty: 2, equipmentEffects: [{ name: '파열', amount: 3 }] }];
  const source = input({ survivors: [actor('a', { _itemKeyById: keys, inventory }), actor('c', { _itemKeyById: keys })],
    dead: [actor('b', { hp: 0, _itemKeyById: keys })], spawnState: { keys, remaining: [3] } });
  const first = createSimulationFrame(source);
  assert.equal(first.survivors[0]._itemKeyById, first.survivors[1]._itemKeyById);
  assert.equal(first.survivors[0]._itemKeyById, first.dead[0]._itemKeyById);
  assert.equal(first.survivors[0]._itemKeyById, first.spawnState.keys);
  assert.notEqual(first.spawnState.keys, keys);
  keys.item = '변경'; inventory[0].qty = 1; inventory[0].equipmentEffects[0].amount = 4;
  source.spawnState.remaining[0] = 2;
  const second = createSimulationFrame(source);
  assert.equal(first.spawnState.keys.item, '소재'); assert.equal(second.spawnState.keys.item, '변경');
  assert.equal(first.survivors[0].inventory[0].qty, 2); assert.equal(second.survivors[0].inventory[0].qty, 1);
  assert.equal(first.survivors[0].inventory[0].equipmentEffects[0].amount, 3);
  assert.deepEqual(first.spawnState.remaining, [3]); assert.deepEqual(second.spawnState.remaining, [2]);
  second.spawnState.keys.item = '화면 수정'; assert.equal(keys.item, '변경');
  assert.notEqual(first.spawnState.keys, second.spawnState.keys);
});

await check('frame publication retains the full snapshot without changing death order or filtering', () => {
  const source = input({ survivors: [actor('a'), actor('b', { hp: 0 })],
    dead: [actor('c', { hp: 0, _deathAt: 10 }), actor('b', { hp: 0, _deathAt: 20 })] });
  const expected = structuredClone({ day: source.day, phase: source.phase, matchSec: source.matchSec,
    survivors: [source.survivors[0]], dead: source.dead, killCounts: source.killCounts,
    assistCounts: {}, spawnState: source.spawnState, forbiddenAddedNow: [],
    forbiddenZoneIds: [...source.forbiddenIds], frameMapId: source.mapId });
  assert.deepEqual(createSimulationFrame(source), expected);
  assert.deepEqual(source.dead.map(row => row._id), ['c', 'b']);
});

await check('optional frame timing preserves the exact owned snapshot and reads no diagnostic clock after disposal', () => {
  const source = input(); const original = structuredClone(source);
  const expected = createSimulationFrame(source); const measured = []; let ticks = 0;
  const dispose = subscribeObserverWorkMeasurements(() => ++ticks, entry => measured.push(entry));
  let frame;
  try { frame = createSimulationFrame(source); } finally { dispose(); }
  assert.deepEqual(frame, expected); assert.deepEqual(source, original);
  assert.notEqual(frame.survivors, source.survivors); assert.notEqual(frame.spawnState, source.spawnState);
  assert.deepEqual(measured, [{ name: 'frame.snapshot', startTime: 1, duration: 1 }]);
  createSimulationFrame(source); assert.equal(ticks, 2); assert.equal(measured.length, 1);
});

await check('frame diagnostic failures do not alter successful snapshots or hide authoritative clone errors', () => {
  const source = input(); const expected = createSimulationFrame(source);
  const dispose = subscribeObserverWorkMeasurements(() => 1, () => { throw new Error('diagnostic failed'); });
  try {
    assert.deepEqual(createSimulationFrame(source), expected);
    assert.throws(() => createSimulationFrame(input({ spawnState: { unsupported: () => {} } })), { name: 'DataCloneError' });
  } finally { dispose(); }
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
