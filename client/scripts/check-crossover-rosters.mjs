import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { CROSSOVER_CHARACTERS, CROSSOVER_BY_ID, CHARACTER_ORIGINS } from '../src/app/games/_lib/crossoverCharacters.js';
import * as A from '../src/app/games/kivotos-autochess/_lib/autochessData.js';
import * as E from '../src/app/games/kivotos-autochess/_lib/autochessEngine.js';
import * as M from '../src/app/games/kivotos-autochess/_lib/autochessMarket.js';
import * as C from '../src/app/games/kivotos-autochess/_lib/autochessCombat.js';
import * as S from '../src/app/games/kivotos-autochess/_lib/autochessSave.js';
import * as L from '../src/app/games/kivotos-autochess/_lib/autochessStorage.js';
import * as D from '../src/app/games/infinite-defense/_lib/infiniteDefenseData.js';
import * as DE from '../src/app/games/infinite-defense/_lib/infiniteDefenseEngine.js';
import * as DL from '../src/app/games/infinite-defense/_lib/infiniteDefenseStorage.js';
let passed=0;const check=(name,fn)=>{fn();passed++;console.log('PASS '+name);};
const clone=x=>JSON.parse(JSON.stringify(x));
const fresh=()=>E.createNewState({now:1000,seed:44,runId:'crossover-test'});
const defense=()=>DE.createNewState({now:1000,runId:'defense-crossover'});
const memory=()=>{const data=new Map();return {data,getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value)};};
function legacyAuto(){
 const s=fresh(),allowed=new Set(A.LEGACY_STUDENT_IDS);
 s.version=A.LEGACY_SAVE_VERSION;
 s.pool=Object.fromEntries(A.LEGACY_STUDENT_IDS.map(id=>[id,A.COPIES_BY_COST[A.STUDENT_BY_ID[id].cost]]));
 for(const p of s.players){
  if(!['abydos','gehenna','millennium','trinity','balanced'].includes(p.focus))p.focus='balanced';
  p.units=p.units.filter(u=>allowed.has(u.studentId));p.shop=p.shop.map(id=>allowed.has(id)?id:null);
  for(const id of p.shop)if(id)s.pool[id]--;
  for(const unit of p.units)s.pool[unit.studentId]-=M.copiesOf(unit);
 }
 return s;
}
function legacyDefense(){
 let s=DE.assignStudent(defense(),'shiroko','defend','p1');
 s=DE.trainStudent(s,'shiroko','shooting');s=DE.upgradePower(s,'shiroko');
 s=DE.advanceTime(DE.startWave(s),2);s=DE.setPaused(s,true);
 s=DE.serializeState(s,1000);s.version=D.LEGACY_SAVE_VERSION;
 for(const id of Object.keys(s.assignments))if(!D.LEGACY_STUDENT_IDS.includes(id))delete s.assignments[id];
 return s;
}
const player=(side,ids)=>({id:'p'+side,name:'test'+side,units:ids.map((id,i)=>({uid:'p'+side+'-u'+(i+1),studentId:id,star:1,position:{kind:'field',x:i%6,y:Math.floor(i/6)}}))});
check('both games include the same six official Korean identities from each new franchise',()=>{
 assert.equal(A.STUDENTS.length,32);assert.equal(D.STUDENTS.length,18);assert.equal(CROSSOVER_CHARACTERS.length,12);
 assert.equal(Object.keys(CHARACTER_ORIGINS).length,3);
 for(const origin of ['nte','genshin']){
  assert.equal(A.STUDENTS.filter(s=>s.origin===origin).length,6);assert.equal(D.STUDENTS.filter(s=>s.origin===origin).length,6);
 }
 for(const meta of CROSSOVER_CHARACTERS){assert.equal(A.STUDENT_BY_ID[meta.id].name,meta.name);assert.equal(DE.getStudent(meta.id).name,meta.name);}
});
check('all legacy base values and IDs remain available alongside the new factions',()=>{
 assert.equal(A.LEGACY_STUDENT_IDS.length,20);assert.equal(D.LEGACY_STUDENT_IDS.length,6);
 assert.equal(A.STUDENT_BY_ID.shiroko.cost,3);assert.equal(DE.getStudent('shiroko').damage,13);assert.equal(DE.getStudent('noa').mining,2.2);
 assert.deepEqual(Object.keys(A.ACADEMIES).slice(0,4),['abydos','gehenna','millennium','trinity']);
});
check('new Autochess matches give both crossover factions an AI plan',()=>{
 const s=fresh();assert(s.players.some(p=>p.focus==='nte'));assert(s.players.some(p=>p.focus==='genshin'));assert(S.isValidSave(s));
});
check('every crossover piece can be drawn through a finite shared pool at the proper level',()=>{
 const s=fresh(),p=M.getPlayer(s),seen=new Set();p.level=8;p.xp=0;
 for(let i=0;i<500;i++){M.fillShop(s,p);for(const id of p.shop)seen.add(id);assert(S.poolConserved(s));}
 for(const character of CROSSOVER_CHARACTERS)assert(seen.has(character.id),character.name);
 assert(S.isValidSave(s));
});
check('Hetero City shields trigger once per unit at the first skill, at the four-piece strength',()=>{
 const left=player(0,['nte-sakiri','nte-jiuyuan','nte-hathor','nte-nanally']);
 const right=player(1,['gi-jean','gi-ningguang','gi-diluc','gi-keqing']);
 const actors=C.battleTeam(left,0);assert(actors.every(a=>a.firstSkillShield===.24));
 const fight=C.simulateBattle(left,right,67),seen=new Map();
 for(const frame of fight.frames)for(const fx of frame[2])if(fx[2]==='shield'&&fx[0]===fx[1]&&actors.some(a=>a.uid===fx[0])){
  const times=seen.get(fx[0])||new Set();times.add(frame[0]);seen.set(fx[0],times);
 }
 assert(seen.size>0);
 for(const times of seen.values())assert(times.size<=1,'First-skill shield repeated');
});
check('Teyvat skill bonus applies at two and four unique characters and combines with support roles',()=>{
 let p=player(0,['gi-jean','gi-lisa']);assert(C.battleTeam(p,0).every(a=>Math.abs(a.skillMul-1.15)<1e-9));
 p=player(0,['gi-jean','gi-lisa','gi-ningguang','gi-zhongli','nte-sakiri']);
 const actors=C.battleTeam(p,0);assert.equal(actors.find(a=>a.studentId==='gi-lisa').skillMul,1.3);
 assert.equal(actors.find(a=>a.studentId==='gi-jean').skillMul,1.3*1.2);
});
check('all twelve new fighters produce legal, deterministic combat frames',()=>{
 for(const meta of CROSSOVER_CHARACTERS){
  const left=player(0,[meta.id]),right=player(1,['serika']);
  const fight=C.simulateBattle(left,right,987);assert.deepEqual(fight,C.simulateBattle(left,right,987));
  assert(S.validTrace({...fight,round:1,left,right,humanMatch:true}),meta.name);
 }
});
check('v1 Autochess migration preserves every player, old pool count and RNG without mutating input',()=>{
 const original=legacyAuto(),raw=JSON.stringify(original);assert(S.isValidSave(original));
 const restored=S.restoreState(original,1000);assert.equal(restored.version,A.SAVE_VERSION);assert(S.isValidSave(restored));
 assert.deepEqual(restored.players,original.players);assert.equal(restored.rng,original.rng);assert.equal(restored.round,original.round);
 for(const id of A.LEGACY_STUDENT_IDS)assert.equal(restored.pool[id],original.pool[id]);
 for(const meta of CROSSOVER_CHARACTERS)assert.equal(restored.pool[meta.id],A.COPIES_BY_COST[A.STUDENT_BY_ID[meta.id].cost]);
 assert.equal(JSON.stringify(original),raw);
});
check('in-progress v1 battles retain their sealed results and playback frame during migration',()=>{
 let old=legacyAuto(),p=M.getPlayer(old);
 const id='serika';if(old.pool[id]===0)throw new Error('fixture exhausted');
 old.pool[id]--;p.units.push({uid:'p0-u'+old.nextUnitId++,studentId:id,star:1,position:{kind:'field',x:2,y:0}});
 old=E.advancePlayback(E.beginCombat(old));assert(S.isValidSave(old));
 const restored=S.restoreState(old,1000);assert.deepEqual(restored.pending,old.pending);assert.equal(restored.frameIndex,old.frameIndex);assert.equal(restored.paused,true);
 const a=E.finishBattle(restored),b=E.finishBattle(S.restoreState(old,1000));assert.deepEqual(a,b);assert(S.isValidSave(a));
});
check('invalid or mixed v1 Autochess data and future versions are rejected rather than guessed',()=>{
 const s=legacyAuto(),raw=JSON.stringify(s);let bad=clone(s);delete bad.pool.shiroko;assert.equal(S.isValidSave(bad),false);
 bad=clone(s);bad.pool['nte-fadia']=24;assert.equal(S.isValidSave(bad),false);
 bad=clone(s);bad.players[0].shop[0]='nte-fadia';assert.equal(S.isValidSave(bad),false);
 bad=clone(s);bad.version='kivotos-autochess-v99';assert.throws(()=>S.restoreState(bad));
 assert.equal(JSON.stringify(s),raw);
});
check('local Autochess migration keeps the exact original v1 bytes in a stable recovery key',()=>{
 const db=memory(),key=L.localSaveKey('guest'),raw=JSON.stringify(legacyAuto());db.setItem(key,raw);
 const restored=L.readLocalRun(db,'guest');L.writeLocalRun(db,'guest',restored);
 assert.equal(db.getItem(key+':legacy-v1'),raw);assert.equal(JSON.parse(db.getItem(key)).version,A.SAVE_VERSION);
 L.writeLocalRun(db,'guest',fresh());assert.equal(db.getItem(key+':legacy-v1'),raw);
 assert.equal(L.readLocalRun(db,'account:other'),null);
});
check('v1 Defense migration preserves a running wave, deployed positions, investment and enemies',()=>{
 const old=legacyDefense(),raw=JSON.stringify(old);assert(DE.isValidSave(old));
 const restored=DE.restoreState(old,1000);assert(DE.isValidSave(restored));assert.equal(restored.version,D.SAVE_VERSION);
 for(const key of ['coins','wave','clearedWave','elapsed','spawnIndex','waveTime','kills','nextEnemyId'])assert.equal(restored[key],old[key],key);
 assert.deepEqual(restored.enemies,old.enemies);assert.deepEqual(restored.upgrades,old.upgrades);assert.equal(restored.paused,true);
 for(const id of D.LEGACY_STUDENT_IDS)assert.deepEqual(restored.assignments[id],old.assignments[id]);
 for(const meta of CROSSOVER_CHARACTERS)assert.deepEqual(restored.assignments[meta.id],{mode:'reserve',padId:'',paid:false,power:0,cooldown:0});
 assert.equal(JSON.stringify(old),raw);
});
check('Defense rejects incomplete or mixed legacy schemas while retaining the raw local checkpoint',()=>{
 const old=legacyDefense();let bad=clone(old);delete bad.assignments.noa;assert.equal(DE.isValidSave(bad),false);
 bad=clone(old);bad.assignments['nte-fadia']={...bad.assignments.shiroko};assert.equal(DE.isValidSave(bad),false);
 const db=memory(),key=DL.localSaveKey('guest'),raw=JSON.stringify({...old,version:'infinite-defense-v99'});db.setItem(key,raw);
 assert.throws(()=>DL.readLocalRun(db,'guest',1000));assert.equal(db.getItem(key),raw);
});
check('local Defense migration preserves exact v1 bytes before its first v2 write',()=>{
 const old=legacyDefense(),db=memory(),key=DL.localSaveKey('guest'),raw=JSON.stringify(old);db.setItem(key,raw);
 const state=DL.readLocalRun(db,'guest',1000);DL.writeLocalRun(db,'guest',state,1000);
 assert.equal(db.getItem(key+':legacy-v1'),raw);assert.equal(JSON.parse(db.getItem(key)).version,D.SAVE_VERSION);
 DL.writeLocalRun(db,'guest',defense(),1000);assert.equal(db.getItem(key+':legacy-v1'),raw);
});
check('Defense mining capacity remains six and a new character can replace a retiring miner',()=>{
 let s=defense();for(const character of D.STUDENTS)s=DE.assignStudent(s,character.id,'mine');
 assert.equal(Object.values(s.assignments).filter(a=>a.mode==='mine').length,6);
 assert.equal(s.assignments['nte-nanally'].mode,'reserve');const before=s.coins;
 s=DE.assignStudent(s,'shiroko','reserve');s=DE.assignStudent(s,'nte-nanally','mine');
 assert.equal(s.assignments['nte-nanally'].mode,'mine');assert.equal(s.coins,before);assert(DE.isValidSave(s));
});
check('every new Defense character can deploy, earn kills and retain training in save restoration',()=>{
 for(const character of CROSSOVER_CHARACTERS){
  let s=DE.assignStudent(defense(),character.id,'defend','p1');s=DE.trainStudent(s,character.id,'shooting');
  const invested=s.assignments[character.id].paid;s=DE.advanceTime(DE.startWave(s),24);
  assert(invested);assert(s.kills>0,character.name);assert(s.baseHp>0);assert(DE.isValidSave(s));
  const restored=DE.restoreState(DE.serializeState(s,1000),1000);assert.equal(restored.upgrades[character.id].shooting,1);assert(restored.assignments[character.id].paid);
 }
});
check('the twelve portrait assets are publisher-hosted official illustrations with verified bytes',()=>{
 const dir=new URL('../public/games/shared/crossover/',import.meta.url),manifest=JSON.parse(fs.readFileSync(new URL('sources.json',dir),'utf8'));
 assert.equal(manifest.icons.length,12);
 for(const icon of manifest.icons){
  assert(CROSSOVER_CHARACTERS.some(c=>c.id===icon.id&&c.name===icon.name));
  assert(['nte.perfectworld.com','upload-os-bbs.hoyolab.com'].includes(new URL(icon.sourceUrl).hostname));
  assert.equal(crypto.createHash('sha256').update(fs.readFileSync(new URL(icon.file,dir))).digest('hex'),icon.sha256);
 }
});
check('prototype property names cannot masquerade as known characters in imported saves',()=>{
 for(const id of ['constructor','toString','__proto__']){
  const state=fresh(),p=M.getPlayer(state);
  p.units.push({uid:'p0-u'+state.nextUnitId++,studentId:id,star:1,position:{kind:'bench',slot:0}});
  assert.equal(A.STUDENT_BY_ID[id],undefined);assert.equal(CROSSOVER_BY_ID[id],undefined);
  assert.equal(S.poolConserved(state),false);assert.equal(S.isValidSave(state),false);
 }
});
console.log(JSON.stringify({passed,autochessCharacters:A.STUDENTS.length,defenseCharacters:D.STUDENTS.length,newOfficialPortraits:CROSSOVER_CHARACTERS.length}));
