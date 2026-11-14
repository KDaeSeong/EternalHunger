import assert from 'node:assert/strict';
import { PADS, STUDENTS, STAT_DEFS } from '../src/app/games/infinite-defense/_lib/infiniteDefenseData.js';
import { assignStudent, createNewState, isValidSave, serializeState, startWave, swapDefenders, restoreState } from '../src/app/games/infinite-defense/_lib/infiniteDefenseEngine.js';
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
check('an unplaced character still needs an empty pad', () => {
  const state=deploy(fresh(),'shiroko','p1');
  assert.equal(defenseDropStatus(state,'yuuka','p1').kind,'occupied');
  assert.equal(deploy(state,'yuuka','p1'),state);
  const miner=assignStudent(state,'noa','mine');
  assert.equal(deploy(miner,'noa','p1'),miner);
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

const pair = () => {
  let state={...fresh(),coins:1000};
  state=assignStudent(state,'shiroko','defend','p1');
  state=assignStudent(state,'hina','defend','p2');
  return state;
};
check('occupied defender pads swap atomically without a second placement charge', () => {
  const state=pair(),before=structuredClone(state),next=deploy(state,'shiroko','p2');
  assert.equal(defenseDropStatus(state,'shiroko','p2').kind,'swap');
  assert.equal(defenseDropStatus(state,'shiroko','p2').cost,0);
  assert.equal(next.assignments.shiroko.padId,'p2'); assert.equal(next.assignments.hina.padId,'p1');
  assert.equal(next.coins,state.coins); assert.equal(next.logId,state.logId+1);
  assert.deepEqual(state,before); assert(isValidSave(next));
});
check('swapping again restores both complete assignments and leaves other characters untouched', () => {
  const state=pair(),swapped=deploy(state,'shiroko','p2'),returned=deploy(swapped,'hina','p2');
  assert.deepEqual(returned.assignments,state.assignments);
  assert.equal(returned.coins,state.coins); assert.deepEqual(returned.upgrades,state.upgrades);
});
check('zero-credit defenders can exchange their occupied pads', () => {
  const state={...pair(),coins:0},next=deploy(state,'hina','p1');
  assert.notEqual(next,state); assert.equal(next.coins,0);
  assert.equal(next.assignments.hina.padId,'p1'); assert.equal(next.assignments.shiroko.padId,'p2');
});
check('a live swap preserves each character power, cooldown, training, and the combat timeline', () => {
  let state=pair();state=startWave(state);
  state.assignments.shiroko={...state.assignments.shiroko,power:3,cooldown:.47};
  state.assignments.hina={...state.assignments.hina,power:5,cooldown:.81};
  state.upgrades={shiroko:Object.fromEntries(STAT_DEFS.map(s=>[s.id,s.id==='agility'?2:0])),
    hina:Object.fromEntries(STAT_DEFS.map(s=>[s.id,s.id==='shooting'?4:0]))};
  const next=deploy(state,'shiroko','p2');
  assert.deepEqual(next.assignments.shiroko,{...state.assignments.shiroko,padId:'p2'});
  assert.deepEqual(next.assignments.hina,{...state.assignments.hina,padId:'p1'});
  for(const field of ['upgrades','enemies','effects','wave','waveTime','elapsed','spawnIndex','kills','baseHp','coins'])
    assert.deepEqual(next[field],state[field],field);
  assert(isValidSave(next));
});
check('the direct swap action rejects reserve, mining, unknown, same-character and ended requests', () => {
  const state=pair();
  for(const [a,b] of [['shiroko','shiroko'],['shiroko','noa'],['missing','hina'],['shiroko','missing']])
    assert.equal(swapDefenders(state,a,b),state);
  const mined=assignStudent(state,'hina','mine');
  assert.equal(swapDefenders(mined,'shiroko','hina'),mined);
  const ended={...state,phase:'defeat',baseHp:0};assert.equal(swapDefenders(ended,'shiroko','hina'),ended);
});
check('stale sources and account or phase changes cannot exchange occupants', () => {
  const state=pair(),drag=gesture(state,'shiroko'),moved=assignStudent(state,'shiroko','defend','p3');
  assert.equal(moveDraggedDefender(moved,drag,'p2',owner),moved);
  for(const patch of [{owner:'account:other'},{runId:'different'},{wave:2},{phase:'wave'}])
    assert.equal(moveDraggedDefender(state,{...drag,...patch},'p2',owner),state);
});
check('drop-time occupancy swaps the current defender and leaves a former occupant alone', () => {
  let state=pair();state=assignStudent(state,'yuuka','defend','p3');
  const drag=gesture(state,'shiroko');
  state=assignStudent(state,'hina','defend','p4');
  state=assignStudent(state,'yuuka','defend','p2');
  const next=moveDraggedDefender(state,drag,'p2',owner);
  assert.equal(next.assignments.shiroko.padId,'p2');assert.equal(next.assignments.yuuka.padId,'p1');
  assert.equal(next.assignments.hina.padId,'p4'); assert(isValidSave(next));
});
check('cross-origin swaps preserve unique occupied pads and valid saves', () => {
  const ids=['shiroko',...STUDENTS.filter(s=>s.origin!==STUDENTS[0].origin).map(s=>s.id)];
  for(const id of ids.filter(id=>id!=='shiroko')) {
    let state={...fresh(),coins:10000};
    state=assignStudent(state,'shiroko','defend','p1');state=assignStudent(state,id,'defend','p2');
    state=deploy(state,id,'p1');
    assert.equal(state.assignments.shiroko.padId,'p2'); assert.equal(state.assignments[id].padId,'p1');
    const save=serializeState(state,1000);assert(isValidSave(save));
    assert.deepEqual(restoreState(save,1000).assignments,state.assignments);
  }
});

console.log(JSON.stringify({passed,characters:STUDENTS.length,pads:PADS.length}));
