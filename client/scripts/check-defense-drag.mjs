import assert from 'node:assert/strict';
import { PADS, STUDENTS } from '../src/app/games/infinite-defense/_lib/infiniteDefenseData.js';
import { assignStudent, createNewState, isValidSave, serializeState, startWave } from '../src/app/games/infinite-defense/_lib/infiniteDefenseEngine.js';
import { crossedDragThreshold, defenseDropStatus, edgeScrollDelta, moveDraggedDefender, parseDefenseDropTarget } from '../src/app/games/infinite-defense/_lib/infiniteDefenseDrag.js';

let passed = 0;
const check = (name, fn) => { fn(); passed++; console.log('PASS ' + name); };
const owner = 'guest';
const fresh = () => createNewState({ now: 1000, runId: 'defense-drag-test' });
const gesture = (state, studentId) => ({ owner, runId: state.runId, phase: state.phase, wave: state.wave, studentId,
  sourceAssignment: { ...state.assignments[studentId] } });
const deploy = (state, studentId, padId) => moveDraggedDefender(state, gesture(state, studentId), padId, owner);

check('all eight pads accept only their exact target keys', () => {
  for (const pad of PADS) assert.equal(parseDefenseDropTarget(pad.id), pad.id);
  for (const bad of ['p0','p9','p01','p1:x','constructor','__proto__','',null,{},1]) assert.equal(parseDefenseDropTarget(bad), null);
});
check('pointer jitter remains a click and deliberate motion starts a drag', () => {
  assert.equal(crossedDragThreshold({x:0,y:0},{x:3,y:4}), false);
  assert.equal(crossedDragThreshold({x:0,y:0},{x:0,y:6}), true);
  assert.equal(crossedDragThreshold({x:0,y:0},{x:NaN,y:8}), false);
});
check('edge scrolling stays bounded and leaves the center still', () => {
  assert.equal(edgeScrollDelta(400,800),0);
  assert.equal(edgeScrollDelta(0,800),-14);
  assert.equal(edgeScrollDelta(800,800),14);
  assert.equal(edgeScrollDelta(200,0),0);
});
check('every character can deploy with exactly the existing first-placement cost', () => {
  for (const student of STUDENTS) {
    const state = fresh(), before = structuredClone(state), next = deploy(state,student.id,'p1');
    assert.equal(next.coins,state.coins-student.cost);
    assert.deepEqual(next.assignments[student.id],{...state.assignments[student.id],mode:'defend',padId:'p1',paid:true});
    assert.deepEqual(state,before); assert(isValidSave(next));
  }
});
check('a paid defender moves to another pad without paying again', () => {
  const state=deploy(fresh(),'shiroko','p1'), next=deploy(state,'shiroko','p8');
  assert.equal(next.coins,state.coins); assert.equal(next.assignments.shiroko.padId,'p8');
  assert.equal(next.logId,state.logId+1); assert(isValidSave(next));
});
check('dragging a paid reserve or miner back to defense keeps the investment', () => {
  for (const mode of ['reserve','mine']) {
    const paid=deploy(fresh(),'yuuka','p1'), state=assignStudent(paid,'yuuka',mode), next=deploy(state,'yuuka','p3');
    assert.equal(next.coins,state.coins); assert.equal(next.assignments.yuuka.padId,'p3'); assert(isValidSave(next));
  }
});
check('an unpaid miner pays once and leaves mining without duplication', () => {
  const state=assignStudent(fresh(),'noa','mine'), next=deploy(state,'noa','p2');
  assert.equal(next.coins,state.coins-STUDENTS.find(s=>s.id==='noa').cost);
  assert.equal(next.assignments.noa.mode,'defend'); assert(isValidSave(next));
});
check('an occupied pad rejects the drop without replacing either character', () => {
  const state=deploy(fresh(),'shiroko','p1');
  assert.equal(defenseDropStatus(state,'yuuka','p1').kind,'occupied');
  assert.equal(deploy(state,'yuuka','p1'),state);
  const paid=deploy({...state,coins:1000},'yuuka','p2');
  assert.equal(deploy(paid,'yuuka','p1'),paid);
});
check('the current pad and an outside release leave the full state unchanged', () => {
  const state=deploy(fresh(),'shiroko','p1');
  for(const pad of ['p1',null,'p100','']) assert.equal(deploy(state,'shiroko',pad),state);
  assert.equal(defenseDropStatus(state,'shiroko','p1').kind,'same');
});
check('insufficient or changed credits cannot be spent by a delayed gesture', () => {
  const state={...fresh(),coins:0}, drag=gesture(state,'hina');
  assert.equal(defenseDropStatus(state,'hina','p1').kind,'funds');
  assert.equal(moveDraggedDefender(state,drag,'p1',owner),state);
  const paid=deploy(fresh(),'shiroko','p1'), empty={...paid,coins:0};
  assert.equal(deploy(empty,'shiroko','p2').coins,0);
});
check('repositioning retains power and cooldown during a live wave', () => {
  let state=deploy(fresh(),'shiroko','p1');
  state=startWave(state); state.assignments.shiroko={...state.assignments.shiroko,power:3,cooldown:.47};
  const next=deploy(state,'shiroko','p3');
  assert.deepEqual(next.assignments.shiroko,{...state.assignments.shiroko,padId:'p3'});
  assert.deepEqual(next.enemies,state.enemies); assert.equal(next.waveTime,state.waveTime); assert(isValidSave(next));
});
check('ended operations reject drag placement', () => {
  const state={...fresh(),phase:'defeat',baseHp:0};
  assert.equal(deploy(state,'shiroko','p1'),state);
});
check('gestures from an old account, run, phase, or wave are rejected', () => {
  const state=fresh(), drag=gesture(state,'shiroko');
  for(const patch of [{owner:'account:other'},{owner:''},{runId:'old-run'},{phase:'wave'},{wave:2}])
    assert.equal(moveDraggedDefender(state,{...drag,...patch},'p1',owner),state);
  assert.equal(moveDraggedDefender(state,drag,'p1',''),state);
});
check('a source reassigned while dragging cannot be moved by the stale gesture', () => {
  const state=deploy(fresh(),'shiroko','p1'), drag=gesture(state,'shiroko'), moved=assignStudent(state,'shiroko','defend','p2');
  assert.equal(moveDraggedDefender(moved,drag,'p3',owner),moved);
  const mined=assignStudent(state,'shiroko','mine');
  assert.equal(moveDraggedDefender(mined,drag,'p3',owner),mined);
});
check('the latest occupied target is checked again when applying a drop', () => {
  const state={...fresh(),coins:1000}, drag=gesture(state,'shiroko'), occupied=assignStudent(state,'yuuka','defend','p1');
  assert.equal(moveDraggedDefender(occupied,drag,'p1',owner),occupied);
});
check('unknown sources and incomplete gestures fail without mutation', () => {
  const state=fresh();
  for(const drag of [null,{}, {...gesture(state,'shiroko'),studentId:'missing'}, {...gesture(state,'shiroko'),sourceAssignment:null}])
    assert.equal(moveDraggedDefender(state,drag,'p1',owner),state);
});
check('repeated cross-origin moves preserve unique occupancy and save compatibility', () => {
  let state={...fresh(),coins:10000};
  for(const [i,student] of STUDENTS.entries()) {
    state=deploy(state,student.id,PADS[i%PADS.length].id);
    assert(isValidSave(state));
    state=assignStudent(state,student.id,'reserve');
  }
  const save=serializeState(state,1000);
  assert(isValidSave(save)); assert.equal(Object.keys(save.assignments).length,18);
  assert(!('drag' in save)); assert(!('dragView' in save));
});
console.log(JSON.stringify({passed,characters:STUDENTS.length,pads:PADS.length}));
