import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';
import axios from 'axios';
import { readFileSync } from 'node:fs';
const { createMapActionRuntime } = await import('../src/app/simulation/_lib/mapActionRuntime.js');
const { buildBaseZoneGraph, buildHyperloopZoneGraph, getHyperloopZoneIds, isHyperloopTransit } = await import('../src/app/simulation/_lib/mapGraphRuntime.js');
let checks = 0;
const map = {_id:'main',zones:[{zoneId:'pad',hasHyperloop:true},{zoneId:'dest'}],zoneConnections:[{fromZoneId:'dest',toZoneId:'pad',bidirectional:false}]};
function fixture(patch={}, refreshRender=false) {
  const state={day:0,loading:false,isAdvancing:false,isGameOver:false,activeMapId:'main',maps:[map],survivors:[{_id:'a',mapId:'main',zoneId:'pad',hp:100,_pendingCharacterCast:{targetId:'b'}}],candidateSurvivors:[],publicItems:[],settings:{},...patch};
  let latest=state; const writes=[];
  const refs={runLockedRef:{current:false},isAdvancingRef:{current:false},mapPreparationRef:{current:null},isRefreshingMapsRef:{current:false},activeMapIdRef:{current:'main'},activeMapRef:{current:map},mapsRef:{current:state.maps}};
  const actions={getCurrentMapInputs:()=>latest,setIsRefreshingMapSettings:()=>{if(refreshRender) latest={...latest}}};
  for(const key of ['applyActiveMapId','setMaps','setSurvivors','setCandidateSurvivors','emitRunEvent']) actions[key]=value=>writes.push([key,value]);
  return {state,refs,writes,latest:patch=>{latest={...state,...patch}},api:createMapActionRuntime({state,refs,actions,storage:{values:new Map(),getItem(key){return this.values.get(key)??null},setItem(key,value){this.values.set(key,String(value))}}})};
}
for(const patch of [{day:1},{isGameOver:true},{loading:true},{isAdvancing:true},{replayMode:true},{evaluationMode:true}]) {
  const f=fixture(patch), before=structuredClone(f.state);
  assert.equal(await f.api.selectLocalMap('remote'),false);
  assert.equal(await f.api.refreshMapSettingsFromServer(),false);
  assert.equal(f.api.doHyperloopJump('remote','a'),false);
  assert.deepEqual(f.writes,[]);assert.deepEqual(f.state,before);checks++;
}
for(const ref of ['runLockedRef','isAdvancingRef']) {
  const f=fixture();f.refs[ref].current=true;
  assert.equal(await f.api.selectLocalMap('remote'),false);assert.equal(await f.api.refreshMapSettingsFromServer('start'),false);assert.deepEqual(f.writes,[]);checks++;
}
const storage={getItem:key=>key==='user'?'{}':null};
const oldWindow=globalThis.window,oldAdapter=axios.defaults.adapter;
globalThis.window={localStorage:storage,location:{origin:'http://localhost',hostname:'localhost'}};
try {
  {
    let release;const deferred=new Promise(resolve=>{release=resolve});
    const responseMap={...map,name:'Refreshed main map'};
    axios.defaults.adapter=async config=>{await deferred;return {data:[responseMap],status:200,statusText:'OK',headers:{},config}};
    const f=fixture({},true),pending=f.api.refreshMapSettingsFromServer();
    await new Promise(resolve=>setImmediate(resolve));release();
    assert.equal(await pending,true,'Refresh busy state rerender with identical input fields must allow the response');
    assert.equal(f.refs.activeMapRef.current,responseMap);assert.deepEqual(f.refs.mapsRef.current,[responseMap]);
    assert.deepEqual(f.writes.map(([kind])=>kind),['setMaps','applyActiveMapId']);checks++;
  }
  for(const transition of [f=>{f.refs.runLockedRef.current=true},f=>{f.refs.isAdvancingRef.current=true},f=>f.latest({day:1}),f=>f.latest({replayMode:true}),f=>f.latest({evaluationMode:true}),f=>{f.refs.mapPreparationRef.current={}},f=>{f.refs.activeMapRef.current={...map,name:'changed'}},f=>f.latest({settings:{changed:true}}),f=>f.latest({activeMapId:'other'}),f=>{f.refs.mapsRef.current=[{...map,name:'Changed same ID'}]}]) {
    let release,requested=false;const deferred=new Promise(resolve=>{release=resolve});
    axios.defaults.adapter=async config=>{requested=true;await deferred;return {data:[{...map,_id:'remote'}],status:200,statusText:'OK',headers:{},config}};
    const f=fixture(),pending=f.api.refreshMapSettingsFromServer();
    await new Promise(resolve=>setImmediate(resolve));assert.equal(requested,true);transition(f);const expectedMap=f.refs.activeMapRef.current;release();assert.equal(await pending,false);
    assert.deepEqual(f.writes,[]);assert.equal(f.refs.activeMapIdRef.current,'main');assert.equal(f.refs.activeMapRef.current,expectedMap);checks++;
  }
} finally {axios.defaults.adapter=oldAdapter;if(oldWindow===undefined)delete globalThis.window;else globalThis.window=oldWindow;}
const zones=getHyperloopZoneIds(map,map.zones),base=buildBaseZoneGraph(map,map.zones),graph=buildHyperloopZoneGraph(base,map.zones,zones);
assert.ok(graph.pad.includes('dest'));assert.equal(isHyperloopTransit(base,zones,'pad','dest'),true);checks++;
const { runActorMovementDecisionPhase } = await import('../src/app/simulation/_lib/phaseActorMovementRuntime.js');
const { withSimulationRandom } = await import('../src/utils/simulationRandom.js');
const actor={_id:'regional',name:'Regional',mapId:'main',zoneId:'pad',hp:100,maxHp:100,stats:{attackPower:20,defense:10},inventory:[]};
const events=[], reservations=[];
const movement=withSimulationRandom(()=>0,()=>runActorMovementDecisionPhase({state:{actor,phaseSurvivors:[actor],craftables:[],itemKeyById:{},itemMetaById:{},itemNameById:{},kiosks:[],mapObj:map,nextDay:3,nextPhase:'morning',phaseIdxNow:4,forbiddenIds:new Set(['pad']),ruleset:{ai:{recoverHpBelow:38,targetTtlMin:1,targetTtlMax:1},forbidden:{escapeMoveChance:1}},zoneGraph:graph,zones:map.zones},actions:{atNow:()=>({day:3,phase:'morning',sec:100}),isHyperloopTransit:(from,to)=>isHyperloopTransit(base,zones,from,to),emitRunEvent:(kind,payload)=>events.push({kind,...payload}),reserveActionSecond:sec=>reservations.push(sec)}}));
assert.equal(movement.nextZoneId,'dest');assert.equal(movement.actor.mapId,'main');assert.equal(movement.usedHyperloopMove,true);assert.equal(movement.moveEtaSec,3);
assert.ok(events.some(event=>event.kind==='move'&&event.transport==='hyperloop'&&event.from==='pad'&&event.to==='dest'&&event.etaSec===3));assert.deepEqual(reservations,[3]);checks++;
// A fresh pregame instance can prepare its map after an earlier locked run.
const fresh=fixture();assert.equal(await fresh.api.selectLocalMap('local'),false);
const { buildGuestSimulationMap } = await import('../src/app/simulation/_lib/guestSimulationBootstrap.js');
assert.equal(await fresh.api.selectLocalMap(buildGuestSimulationMap()._id),true);assert.ok(fresh.writes.some(([kind])=>kind==='applyActiveMapId'));checks++;
const ui=readFileSync(new URL('../src/app/simulation/_components/SimulationMinimapHyperloopControl.js',import.meta.url),'utf8');
assert.equal(ui.includes('<select'),false);assert.equal(ui.includes('doHyperloopJump('),false);checks++;
const { createSimulationRunInput, prepareSimulationRunInput, validateSimulationRunInput } = await import('../src/app/simulation/_lib/simulationReplayRuntime.js');
const source={activeMap:map,settings:{rulesetId:'ER_S11'},runSeed:'single-map',survivors:[{_id:'one',mapId:'foreign',zoneId:'pad',hp:100,inventory:[{itemId:'ore',qty:2}]},{_id:'two',zoneId:'dest',hp:80}],dead:[{_id:'returning',mapId:'old',zoneId:'dest',hp:0,_pendingRevival:true}]};
const original=structuredClone(source),input=createSimulationRunInput(source,null);
assert.deepEqual(source,original);assert.ok([...input.initialFrame.survivors,...input.initialFrame.dead].every(actor=>actor.mapId==='main'));checks++;
for(const list of ['survivors','dead']) {
  const invalid=structuredClone(input);invalid.initialFrame[list][0].mapId='foreign';const before=structuredClone(invalid);
  assert.throws(()=>validateSimulationRunInput(invalid));assert.throws(()=>prepareSimulationRunInput(invalid));assert.deepEqual(invalid,before);checks++;
}
const legacy=structuredClone(input);delete legacy.initialFrame.survivors[0].mapId;legacy.initialFrame.survivors[1].mapId='';delete legacy.initialFrame.dead[0].mapId;
const legacyBefore=structuredClone(legacy),restored=prepareSimulationRunInput(JSON.parse(JSON.stringify(legacy))).state;
assert.deepEqual(legacy,legacyBefore);assert.ok([...restored.survivors,...restored.dead].every(actor=>actor.mapId==='main'));
const canonical=prepareSimulationRunInput(JSON.parse(JSON.stringify(input))).state;
assert.deepEqual(restored.survivors,canonical.survivors);assert.deepEqual(restored.dead,canonical.dead);assert.equal(restored.runSeed,source.runSeed);assert.deepEqual(restored.survivors[0].inventory,source.survivors[0].inventory);checks++;
const missingId=structuredClone(input);delete missingId.map._id;const missingBefore=structuredClone(missingId);
assert.throws(()=>validateSimulationRunInput(missingId));assert.throws(()=>prepareSimulationRunInput(missingId));assert.deepEqual(missingId,missingBefore);assert.throws(()=>createSimulationRunInput({...source,activeMap:{zones:map.zones}},null));checks++;
const alias=createSimulationRunInput({...source,activeMap:{id:'alias-map',zones:map.zones}},null);assert.equal(prepareSimulationRunInput(alias).state.activeMapId,'alias-map');assert.equal(alias.initialFrame.dead[0].mapId,'alias-map');checks++;
const spaced=createSimulationRunInput({...source,activeMap:{_id:' main ',zones:map.zones}},null);
assert.equal(spaced.initialFrame.survivors[0].mapId,' main ');assert.equal(prepareSimulationRunInput(spaced).state.activeMapId,' main ');
const wrongSpace=structuredClone(input);wrongSpace.initialFrame.survivors[0].mapId=' main ';assert.throws(()=>prepareSimulationRunInput(wrongSpace));checks++;
const nativeRandom=Math.random;
try {
  Math.random=()=>{throw new Error('Map capture and preparation must not draw RNG')};
  withSimulationRandom(()=>{throw new Error('Map capture and preparation must not draw simulation RNG')},()=>{
    const captured=createSimulationRunInput(source,null),prepared=prepareSimulationRunInput(JSON.parse(JSON.stringify(captured))).state;
    assert.deepEqual(prepared.survivors,captured.initialFrame.survivors);assert.deepEqual(prepared.dead,captured.initialFrame.dead);
  });checks++;
} finally {Math.random=nativeRandom;}
console.log(`SINGLE_MAP_CONTRACT ${checks}/${checks}: rejected calls preserve actor/cast/map/events; stale server replies cannot publish; regional hyperloop remains available.`);
