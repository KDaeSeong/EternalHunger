import assert from 'node:assert/strict';
import { crossedDragThreshold, edgeScrollDelta, moveDraggedUnit, parseDropTarget, samePosition } from '../src/app/games/kivotos-autochess/_lib/autochessDrag.js';
import { createNewState, moveUnit } from '../src/app/games/kivotos-autochess/_lib/autochessEngine.js';
import { getPlayer } from '../src/app/games/kivotos-autochess/_lib/autochessMarket.js';
import { isValidSave, poolConserved, serializeState, restoreState } from '../src/app/games/kivotos-autochess/_lib/autochessSave.js';

let passed = 0;
const check = (name, fn) => { fn(); passed++; console.log('PASS ' + name); };
const owner = 'guest';
function fixture() {
  const state = createNewState({ now: 1000, seed: 42, runId: 'drag-test' });
  const player = getPlayer(state);
  for (const id of player.shop) if (id) state.pool[id]++;
  player.shop = Array(5).fill(null);
  const add = (studentId, position) => {
    state.pool[studentId]--;
    const unit = { uid: 'p0-u' + state.nextUnitId++, studentId, star: 1, position };
    player.units.push(unit);
    return unit;
  };
  const tank = add('yuuka', { kind: 'field', x: 0, y: 0 });
  const caster = add('gi-lisa', { kind: 'field', x: 1, y: 0 });
  add('serika', { kind: 'field', x: 2, y: 0 });
  const bench = add('nte-fadia', { kind: 'bench', slot: 0 });
  const reserve = add('nte-jiuyuan', { kind: 'bench', slot: 1 });
  assert(isValidSave(state)); assert(poolConserved(state));
  return { state, tank, caster, bench, reserve };
}
const gesture = (state, unit) => ({ owner, runId: state.runId, round: state.round, uid: unit.uid, sourcePosition: { ...unit.position } });
const unitAt = (state, uid) => getPlayer(state).units.find(unit => unit.uid === uid);
const valid = state => { assert(isValidSave(state)); assert(poolConserved(state)); };

check('all 24 friendly cells and nine bench slots are valid drop targets', () => {
  for (let y = 0; y < 4; y++) for (let x = 0; x < 6; x++)
    assert.deepEqual(parseDropTarget('field:' + x + ':' + y), { kind: 'field', x, y });
  for (let slot = 0; slot < 9; slot++) assert.deepEqual(parseDropTarget('bench:' + slot), { kind: 'bench', slot });
});
check('enemy, outside, malformed and foreign drop payloads are rejected', () => {
  for (const key of ['field:6:0', 'field:0:4', 'field:-1:0', 'field:NaN:0', 'field:0:0:1', 'bench:9', 'bench:-1', 'enemy:0:0', 'constructor', '__proto__', '', null, {}])
    assert.equal(parseDropTarget(key), null);
});
check('small pointer jitter remains a click and deliberate motion starts a drag', () => {
  assert.equal(crossedDragThreshold({ x: 10, y: 10 }, { x: 13, y: 13 }), false);
  assert.equal(crossedDragThreshold({ x: 10, y: 10 }, { x: 16, y: 10 }), true);
  assert.equal(crossedDragThreshold({ x: NaN, y: 10 }, { x: 30, y: 30 }), false);
});
check('edge scrolling is bounded and idle in the middle of the viewport', () => {
  assert.equal(edgeScrollDelta(400, 800), 0);
  assert.equal(edgeScrollDelta(0, 800), -14);
  assert.equal(edgeScrollDelta(800, 800), 14);
  assert.equal(edgeScrollDelta(-1000, 800), -14);
  assert.equal(edgeScrollDelta(9000, 800), 14);
  assert.equal(edgeScrollDelta(4, 0), 0);
});
check('field to empty field moves the dragged unit without mutating the source save', () => {
  const { state, tank } = fixture(), before = JSON.stringify(state), target = { kind: 'field', x: 4, y: 3 };
  const next = moveDraggedUnit(state, gesture(state, tank), target, owner);
  assert(samePosition(unitAt(next, tank.uid).position, target)); assert.equal(JSON.stringify(state), before); valid(next);
});
check('field to occupied field swaps exactly the two positions', () => {
  const { state, tank, caster } = fixture();
  const next = moveDraggedUnit(state, gesture(state, tank), caster.position, owner);
  assert.deepEqual(unitAt(next, tank.uid).position, caster.position);
  assert.deepEqual(unitAt(next, caster.uid).position, tank.position); valid(next);
});
check('bench to empty field respects available formation capacity', () => {
  const { state, bench } = fixture(); getPlayer(state).level = 4;
  const target = { kind: 'field', x: 4, y: 3 }, next = moveDraggedUnit(state, gesture(state, bench), target, owner);
  assert.deepEqual(unitAt(next, bench.uid).position, target); valid(next);
});
check('a full field rejects an extra deployment without consuming gold or copies', () => {
  const { state, bench } = fixture(), target = { kind: 'field', x: 4, y: 3 };
  const next = moveDraggedUnit(state, gesture(state, bench), target, owner);
  assert.deepEqual(unitAt(next, bench.uid).position, bench.position);
  assert.equal(getPlayer(next).gold, getPlayer(state).gold); assert.deepEqual(next.pool, state.pool);
  assert(next.log[0].text.includes('정원이 가득')); valid(next);
});
check('bench to occupied field swaps at full capacity', () => {
  const { state, bench, tank } = fixture();
  const next = moveDraggedUnit(state, gesture(state, bench), tank.position, owner);
  assert.deepEqual(unitAt(next, bench.uid).position, tank.position);
  assert.deepEqual(unitAt(next, tank.uid).position, bench.position); valid(next);
});
check('field to empty bench returns the unit to the requested slot', () => {
  const { state, tank } = fixture(), target = { kind: 'bench', slot: 8 };
  const next = moveDraggedUnit(state, gesture(state, tank), target, owner);
  assert.deepEqual(unitAt(next, tank.uid).position, target); valid(next);
});
check('field to occupied bench swaps positions without selling either unit', () => {
  const { state, tank, bench } = fixture();
  const next = moveDraggedUnit(state, gesture(state, tank), bench.position, owner);
  assert.deepEqual(unitAt(next, tank.uid).position, bench.position);
  assert.deepEqual(unitAt(next, bench.uid).position, tank.position);
  assert.equal(getPlayer(next).units.length, getPlayer(state).units.length); valid(next);
});
check('bench to bench supports both relocation and swapping', () => {
  const { state, bench, reserve } = fixture();
  const next = moveDraggedUnit(state, gesture(state, bench), reserve.position, owner);
  assert.deepEqual(unitAt(next, reserve.uid).position, bench.position); valid(next);
  const final = moveDraggedUnit(next, gesture(next, unitAt(next, bench.uid)), { kind: 'bench', slot: 8 }, owner);
  assert.deepEqual(unitAt(final, bench.uid).position, { kind: 'bench', slot: 8 }); valid(final);
});
check('same-cell and invalid/outside drops leave the complete save unchanged', () => {
  const { state, tank } = fixture(), drag = gesture(state, tank);
  for (const target of [tank.position, null, { kind: 'field', x: 0, y: -1 }, { kind: 'bench', slot: 9 }])
    assert.equal(moveDraggedUnit(state, drag, target, owner), state);
});
check('account, run, round and combat transitions invalidate a pending gesture', () => {
  const { state, tank } = fixture(), drag = gesture(state, tank), target = { kind: 'bench', slot: 8 };
  assert.equal(moveDraggedUnit(state, drag, target, 'account:other'), state);
  for (const changed of [{ ...drag, runId: 'new-run' }, { ...drag, round: drag.round + 1 }])
    assert.equal(moveDraggedUnit(state, changed, target, owner), state);
  for (const phase of ['battle', 'spectate', 'finished']) {
    const altered = { ...state, phase }; assert.equal(moveDraggedUnit(altered, drag, target, owner), altered);
  }
});
check('a unit moved during the gesture cannot be moved again by the stale origin', () => {
  const { state, tank } = fixture(), drag = gesture(state, tank);
  const changed = moveUnit(state, tank.uid, { kind: 'field', x: 5, y: 3 });
  assert.equal(moveDraggedUnit(changed, drag, { kind: 'bench', slot: 8 }, owner), changed);
});
check('opponent units and missing units cannot be dragged into the human formation', () => {
  const { state } = fixture(), enemy = state.players[1].units[0], target = { kind: 'bench', slot: 8 };
  assert.equal(moveDraggedUnit(state, gesture(state, enemy), target, owner), state);
  assert.equal(moveDraggedUnit(state, { ...gesture(state, enemy), uid: 'missing' }, target, owner), state);
});
check('dragging preserves progression, opponents, RNG, pool and save compatibility', () => {
  const { state, tank } = fixture(), next = moveDraggedUnit(state, gesture(state, tank), { kind: 'bench', slot: 8 }, owner);
  const a = getPlayer(state), b = getPlayer(next);
  for (const key of ['gold', 'level', 'xp', 'commander', 'shop']) assert.deepEqual(b[key], a[key]);
  assert.deepEqual(next.players.slice(1), state.players.slice(1)); assert.equal(next.rng, state.rng);
  assert.deepEqual(next.pool, state.pool); valid(next);
  const restored = restoreState(serializeState(next));
  assert.deepEqual(getPlayer(restored).units, b.units); valid(restored);
});
console.log(JSON.stringify({ passed, friendlyDropCells: 24, benchDropSlots: 9 }));
