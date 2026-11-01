import assert from 'node:assert/strict';
import { ENEMY_TYPES, PADS, ROUTE, SAVE_VERSION, STUDENTS } from '../src/app/games/infinite-defense/_lib/infiniteDefenseData.js';
import * as engine from '../src/app/games/infinite-defense/_lib/infiniteDefenseEngine.js';
import { localSaveKey, readLocalRun, writeLocalRun } from '../src/app/games/infinite-defense/_lib/infiniteDefenseStorage.js';

let passed = 0;
function check(name, fn) { fn(); passed++; console.log('PASS ' + name); }
const fresh = () => engine.createNewState({ now: 1000, runId: 'def-test' });
const clone = value => JSON.parse(JSON.stringify(value));
const comparable = s => ({ phase: s.phase, wave: s.wave, coins: s.coins, enemies: s.enemies, spawnIndex: s.spawnIndex, assignments: s.assignments, kills: s.kills, baseHp: s.baseHp });
const storage = () => {
  const data = new Map();
  return { data, getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
};

check('initial state validates and cannot start without defenders', () => {
  const state = fresh();
  assert(engine.isValidSave(state));
  assert.equal(engine.startWave(state), state);
  assert.equal(STUDENTS.length, 18);
  assert.equal(Object.keys(ENEMY_TYPES).filter(k => k !== 'boss').length, 4);
  assert.equal(new Set(PADS.map(p => p.id)).size, PADS.length);
});
check('placement pays once and returning from mine preserves investment', () => {
  let state = engine.assignStudent(fresh(), 'shiroko', 'defend', 'p1');
  assert.equal(state.coins, 230 - engine.getStudent('shiroko').cost);
  const coins = state.coins;
  state = engine.assignStudent(state, 'shiroko', 'mine');
  state = engine.assignStudent(state, 'shiroko', 'defend', 'p2');
  assert.equal(state.coins, coins);
  assert.equal(state.assignments.shiroko.padId, 'p2');
});
check('occupied and unknown positions cannot consume money', () => {
  const state = engine.assignStudent(fresh(), 'shiroko', 'defend', 'p1');
  assert.equal(engine.assignStudent(state, 'yuuka', 'defend', 'p1'), state);
  assert.equal(engine.assignStudent(state, 'shiroko', 'defend', 'unknown'), state);
  assert.equal(engine.assignStudent(state, 'unknown', 'mine'), state);
});
check('unaffordable actions are inert', () => {
  const state = { ...fresh(), coins: 0 };
  assert.equal(engine.assignStudent(state, 'hina', 'defend', 'p1'), state);
  assert.equal(engine.trainStudent(state, 'shiroko', 'shooting'), state);
  assert.equal(engine.upgradePower(state, 'shiroko'), state);
  assert.equal(engine.upgradeMine(state), state);
});
check('dexterity changes mining yield without changing shooting range', () => {
  let state = engine.assignStudent(fresh(), 'noa', 'mine');
  const before = engine.studentStats(state, 'noa'), rate = engine.miningRate(state);
  state = engine.trainStudent(state, 'noa', 'dexterity');
  const after = engine.studentStats(state, 'noa');
  assert(after.miningRate > before.miningRate);
  assert(engine.miningRate(state) > rate);
  assert.equal(after.range, before.range);
});
check('shooting and agility change actual range and attack interval', () => {
  let state = fresh();
  const before = engine.studentStats(state, 'shiroko');
  state = engine.trainStudent(state, 'shiroko', 'shooting');
  state = engine.trainStudent(state, 'shiroko', 'agility');
  const after = engine.studentStats(state, 'shiroko');
  assert(after.range > before.range);
  assert(after.interval < before.interval);
});
check('mine assignment and equipment multiply real production', () => {
  let state = engine.assignStudent(fresh(), 'noa', 'mine');
  const workerRate = engine.miningRate(state);
  state = engine.upgradeMine(state);
  assert(engine.miningRate(state) > workerRate);
  const coins = state.coins;
  const next = engine.advanceTime(state, 10);
  assert(Math.abs(next.coins - coins - engine.miningRate(state) * 10) < .08);
  assert.equal(state.coins, coins);
});
check('pause freezes combat and production', () => {
  const state = engine.setPaused(engine.startWave(engine.assignStudent(fresh(), 'shiroko', 'defend', 'p1')), true);
  assert.equal(engine.advanceTime(state, 30), state);
});
check('fixed-step continuation is deterministic', () => {
  const state = engine.startWave(engine.assignStudent(fresh(), 'shiroko', 'defend', 'p1'));
  const full = engine.advanceTime(state, 2);
  let split = state;
  for (let i = 0; i < 20; i++) split = engine.advanceTime(split, .1);
  assert.deepEqual(comparable(full), comparable(split));
  assert.equal(state.enemies.length, 0);
});
check('wave composition introduces all enemy classes and periodic bosses', () => {
  assert(!engine.wavePlan(1).some(e => e.type === 'boss'));
  assert(engine.wavePlan(20).some(e => e.type === 'boss'));
  assert(engine.wavePlan(40).some(e => e.type === 'boss'));
  assert.equal(new Set(engine.wavePlan(10).map(e => e.type)).size, 4);
  const plan = engine.wavePlan(20);
  assert(plan.every((row, i) => i === 0 || row.at >= plan[i - 1].at));
});
check('route interpolation respects turns and exit', () => {
  assert.deepEqual(engine.pointAt(0), ROUTE[0]);
  assert.deepEqual(engine.pointAt(engine.ROUTE_LENGTH), ROUTE.at(-1));
  assert.deepEqual(engine.pointAt(4), ROUTE[1]);
});
check('mid-wave checkpoint restores exact enemies and pauses', () => {
  const state = engine.advanceTime(engine.startWave(engine.assignStudent(fresh(), 'shiroko', 'defend', 'p1')), 2);
  const checkpoint = engine.serializeState(state, 2000);
  const restored = engine.restoreState(clone(checkpoint), 2000);
  assert(restored.paused);
  assert.deepEqual(comparable(restored), comparable(state));
  const resumed = engine.setPaused(restored, false);
  assert.deepEqual(comparable(engine.advanceTime(resumed, 1)), comparable(engine.advanceTime(state, 1)));
});
check('offline mining caps at eight hours and never resolves combat', () => {
  let state = engine.assignStudent(fresh(), 'noa', 'mine');
  state = engine.startWave(engine.assignStudent(state, 'shiroko', 'defend', 'p1'));
  const saved = engine.serializeState(state, 1000);
  const restored = engine.restoreState(saved, 1000 + 20 * 3600 * 1000);
  assert.equal(restored.wave, state.wave);
  assert.deepEqual(restored.enemies, state.enemies);
  assert.equal(restored.elapsed, state.elapsed);
  assert.equal(restored.coins, Math.round((state.coins + engine.miningRate(state) * 28800) * 1000) / 1000);
  assert(restored.paused);
});
check('offline receipt cannot be claimed twice at the same timestamp', () => {
  const now = 1000 + 3600 * 1000;
  const first = engine.applyOfflineMining(fresh(), now);
  const second = engine.applyOfflineMining(first, now);
  assert.equal(first.coins, second.coins);
  assert.equal(first.log.length, second.log.length);
});
check('future clock does not grant negative income', () => {
  const state = engine.serializeState(fresh(), 5000);
  const result = engine.applyOfflineMining(state, 1000);
  assert.equal(result.coins, state.coins);
  assert.equal(result.savedAt, 5000);
});
check('unknown and corrupt checkpoints cannot replace a run', () => {
  for (const modify of [
    s => { s.version = 'future'; }, s => { s.coins = -1; }, s => { s.coins = NaN; },
    s => { s.baseHp = 26; }, s => { s.firstClear = true; }, s => { s.phase = 'victory'; },
    s => { s.wave = .5; }, s => { s.enemies = Array(101).fill({}); },
    s => { s.assignments.shiroko.mode = 'other'; }, s => { s.assignments.shiroko.padId = 'p1'; },
    s => { s.upgrades.shiroko = { dexterity: -1, shooting: 0, agility: 0 }; },
  ]) {
    const bad = fresh(); modify(bad);
    assert(!engine.isValidSave(bad));
    assert.throws(() => engine.restoreState(bad, 1000));
  }
});
check('duplicate pad ownership is rejected on restore', () => {
  let state = engine.assignStudent(fresh(), 'shiroko', 'defend', 'p1');
  state = engine.assignStudent(state, 'yuuka', 'defend', 'p2');
  state.assignments.yuuka.padId = 'p1';
  assert(!engine.isValidSave(state));
});
let completed;
check('normal actions and earned resources clear all 20 waves and boss', () => {
  let state = fresh();
  state = engine.assignStudent(state, 'shiroko', 'defend', 'p1');
  state = engine.assignStudent(state, 'yuuka', 'defend', 'p3');
  for (const id of ['hina', 'aris', 'yuzu', 'noa']) state = engine.assignStudent(state, id, 'mine');
  for (let wave = 1; wave <= 20; wave++) {
    state = engine.advanceTime(state, 10);
    for (const [id, pad] of [['hina', 'p4'], ['aris', 'p6'], ['yuzu', 'p5']]) {
      if (state.assignments[id].mode !== 'defend' && state.coins >= engine.getStudent(id).cost + 50) state = engine.assignStudent(state, id, 'defend', pad);
    }
    for (let i = 0; i < 40; i++) {
      const choices = STUDENTS.filter(s => state.assignments[s.id].mode === 'defend').sort((a, b) => state.assignments[a.id].power - state.assignments[b.id].power);
      const id = choices[0].id;
      if (state.coins < engine.powerCost(state, id) + 40) break;
      state = engine.upgradePower(state, id);
    }
    state = engine.startWave(state);
    let ticks = 0;
    while (state.phase === 'wave' && ticks++ < 240) state = engine.advanceTime(state, 1);
    assert.notEqual(state.phase, 'defeat', 'lost at wave ' + wave);
    assert.equal(state.clearedWave, wave);
    assert(engine.isValidSave(engine.serializeState(state, 1000)));
  }
  assert.equal(state.phase, 'victory');
  assert(state.firstClear);
  assert.equal(state.baseHp, 25, 'boss must be killed instead of leaking');
  completed = state;
});
check('endless mode continues beyond 20 with stronger enemies', () => {
  const state = engine.startWave(completed);
  assert.equal(state.wave, 21);
  assert.equal(state.phase, 'wave');
  assert.equal(state.clearedWave, 20);
  assert(engine.wavePlan(21).length >= engine.wavePlan(20).length - 1);
  assert(engine.isValidSave(engine.serializeState(state, 1000)));
});
check('boss reaching the exit is a defeat, never a clear', () => {
  const state = clone(engine.startWave({ ...completed, phase: 'intermission', wave: 39, clearedWave: 39 }));
  state.spawnIndex = engine.wavePlan(40).length;
  state.enemies = [{ id: state.nextEnemyId++, type: 'boss', hp: 1000, maxHp: 1000, armor: 0, speed: 1, reward: 100, leak: 25, distance: engine.ROUTE_LENGTH - .01, slowUntil: 0, slowFactor: 0 }];
  for (const id of Object.keys(state.assignments)) state.assignments[id].mode = 'mine';
  const next = engine.advanceTime(state, .1);
  assert.equal(next.phase, 'defeat');
  assert.equal(next.clearedWave, 39);
});
check('unprotected base loses and terminal state cannot restart or earn', () => {
  let state = engine.startWave(engine.assignStudent(fresh(), 'noa', 'defend', 'p8'));
  state = engine.assignStudent(state, 'noa', 'mine');
  for (let i = 0; i < 20 && state.phase !== 'defeat'; i++) {
    if (state.phase === 'intermission') {
      state = engine.assignStudent(state, 'noa', 'defend', 'p8');
      state = engine.startWave(state);
      state = engine.assignStudent(state, 'noa', 'mine');
    }
    state = engine.advanceTime(state, 60);
  }
  assert.equal(state.phase, 'defeat');
  assert.equal(engine.advanceTime(state, 60), state);
  assert.equal(engine.startWave(state), state);
  assert.equal(engine.trainStudent(state, 'noa', 'dexterity'), state);
  assert(engine.isValidSave(engine.serializeState(state)));
});
check('repair consumes currency, caps health and cannot run during battle', () => {
  const state = { ...fresh(), baseHp: 23 };
  const next = engine.repairBase(state);
  assert.equal(next.baseHp, 25);
  assert.equal(next.coins, state.coins - 55);
  const battle = engine.startWave(engine.assignStudent(state, 'shiroko', 'defend', 'p1'));
  assert.equal(engine.repairBase(battle), battle);
});
check('event history is bounded without affecting economy', () => {
  let state = fresh();
  for (let i = 0; i < 100; i++) state = engine.assignStudent(state, 'noa', i % 2 ? 'reserve' : 'mine');
  assert.equal(state.log.length, engine.MAX_LOG);
  assert.equal(state.coins, 230);
  assert(engine.isValidSave(engine.serializeState(state)));
});
check('per-account local checkpoints do not touch other games or users', () => {
  const db = storage(); db.setItem('user', 'protected'); db.setItem('other-game', 'original');
  writeLocalRun(db, 'guest', fresh(), 1000);
  writeLocalRun(db, 'account:123', { ...fresh(), runId: 'other-owner' }, 1000);
  assert.equal(readLocalRun(db, 'guest', 1000).runId, 'def-test');
  assert.equal(readLocalRun(db, 'account:123', 1000).runId, 'other-owner');
  assert.equal(db.getItem('user'), 'protected');
  assert.equal(db.getItem('other-game'), 'original');
  assert.notEqual(localSaveKey('guest'), localSaveKey('account:123'));
});
check('replacement retains exactly the previous checkpoint', () => {
  const db = storage();
  writeLocalRun(db, 'guest', fresh(), 1000);
  writeLocalRun(db, 'guest', { ...fresh(), runId: 'new-run' }, 1000, true);
  assert.equal(readLocalRun(db, 'guest', 1000).runId, 'new-run');
  assert.equal(readLocalRun(db, 'guest', 1000, true).runId, 'def-test');
});
check('unreadable bytes survive replacement beside a valid previous run', () => {
  const db = storage(), key = localSaveKey('guest');
  const good = JSON.stringify(fresh());
  db.setItem(key, 'broken JSON'); db.setItem(key + ':previous', good);
  writeLocalRun(db, 'guest', fresh(), 1000, true);
  assert.equal(db.getItem(key + ':unreadable'), 'broken JSON');
  assert.equal(db.getItem(key + ':previous'), good);
});
check('quota error preserves the current checkpoint', () => {
  const db = storage(), key = localSaveKey('guest'), old = JSON.stringify(fresh());
  db.setItem(key, old);
  const failing = { getItem: db.getItem, setItem: () => { throw new Error('quota'); } };
  assert.throws(() => writeLocalRun(failing, 'guest', { ...fresh(), runId: 'new' }, 1000, true));
  assert.equal(db.getItem(key), old);
});
check('future version cannot be silently imported as current', () => {
  const db = storage(), key = localSaveKey('guest');
  const raw = JSON.stringify({ ...fresh(), version: SAVE_VERSION + '-future' }); db.setItem(key, raw);
  assert.throws(() => readLocalRun(db, 'guest', 1000));
  assert.equal(db.getItem(key), raw);
});
console.log(JSON.stringify({ passed, completedWave: completed.clearedWave, hp: completed.baseHp, kills: completed.kills, virtualSeconds: completed.elapsed }));
