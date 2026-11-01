import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import * as E from '../src/app/games/kivotos-autochess/_lib/autochessEngine.js';
import * as M from '../src/app/games/kivotos-autochess/_lib/autochessMarket.js';
import * as C from '../src/app/games/kivotos-autochess/_lib/autochessCombat.js';
import * as S from '../src/app/games/kivotos-autochess/_lib/autochessSave.js';
import * as L from '../src/app/games/kivotos-autochess/_lib/autochessStorage.js';
import { STUDENTS, STUDENT_BY_ID, COPIES_BY_COST, MAX_FRAMES } from '../src/app/games/kivotos-autochess/_lib/autochessData.js';
let passed=0;
const check=(name,fn)=>{fn();passed++;console.log('PASS '+name);};
const fresh=(seed=42)=>E.createNewState({now:1000,seed,runId:'test-'+seed});
const clone=s=>JSON.parse(JSON.stringify(s));
const human=s=>M.getPlayer(s);
const valid=s=>{assert(S.isValidSave(s),'Invalid state '+s.phase+' round '+s.round);assert(S.poolConserved(s));};
function add(s,id,star=1,position={kind:'bench',slot:M.firstBenchSlot(human(s))}){
 const n=3**(star-1);assert(s.pool[id]>=n);s.pool[id]-=n;
 const unit={uid:'p0-u'+s.nextUnitId++,studentId:id,star,position};human(s).units.push(unit);return unit;
}
function offer(s,id,index=0){
 const p=human(s);if(p.shop[index])s.pool[p.shop[index]]++;
 assert(s.pool[id]>0);s.pool[id]--;p.shop[index]=id;
}
function ready(s=fresh()){
 for(let i=0;i<5;i++)s=E.buyUnit(s,i);
 return E.autoFormation(s);
}
const memory=()=>{const data=new Map();return {data,getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};};
check('seeded initialization gives legal shared-pool markets and seven funded AI teams',()=>{
 const a=fresh();assert.deepEqual(a,fresh());valid(a);assert.equal(a.players.length,8);assert.equal(STUDENTS.length,20);
 for(const p of a.players){assert.equal(p.shop.length,5);assert(p.gold>=0&&p.gold<=12);assert(M.fieldUnits(p).length<=3);}
 assert(a.players.slice(1).every(p=>p.units.length>0));assert.equal(E.beginCombat(a).phase,'planning');
});
check('purchase transfers a reserved offer without consuming the pool twice',()=>{
 const a=fresh(),index=human(a).shop.findIndex(Boolean),id=human(a).shop[index],before=JSON.stringify(a);
 const b=E.buyUnit(a,index);assert.equal(JSON.stringify(a),before);assert.equal(b.pool[id],a.pool[id]);assert.equal(human(b).shop[index],null);
 assert.equal(human(b).gold,human(a).gold-STUDENT_BY_ID[id].cost);valid(b);
 const again=E.buyUnit(b,index);assert.deepEqual(human(again),human(b));valid(again);
});
check('unaffordable and invalid shop actions preserve economy and inventory',()=>{
 const a=fresh();human(a).gold=0;
 for(const b of [E.buyUnit(a,0),E.buyUnit(a,-1),E.buyUnit(a,Infinity),E.rerollShop(a),E.buyExperience(a),E.trainCommander(a,'luck')]){
 assert.deepEqual(human(b),human(a));assert.deepEqual(b.pool,a.pool);valid(b);
 }
});
check('reroll conserves all reserved copies and costs two gold without intelligence',()=>{
 const a=fresh(),b=E.rerollShop(a);valid(b);assert.equal(human(b).gold,human(a).gold-2);assert.notEqual(b.rng,a.rng);
});
check('locked unbought offers persist through round settlement and other AI purchases',()=>{
 let a=E.toggleShopLock(ready()),offers=[...human(a).shop];a=E.finishBattle(E.beginCombat(a));valid(a);
 assert.deepEqual(human(a).shop,offers);assert.equal(human(a).locked,true);
});
check('three copies merge while preserving a deployed location and exact pool total',()=>{
 const a=fresh();M.restoreShopCopies(a,human(a));
 const deployed=add(a,'aris',1,{kind:'field',x:2,y:3});add(a,'aris');add(a,'aris');
 assert.equal(M.mergeUnits(human(a)),1);assert.equal(human(a).units.length,1);assert.equal(human(a).units[0].uid,deployed.uid);
 assert.equal(human(a).units[0].star,2);assert.deepEqual(human(a).units[0].position,{kind:'field',x:2,y:3});valid(a);
});
check('nine base copies chain into one three-star and selling returns all nine',()=>{
 const a=fresh();M.restoreShopCopies(a,human(a));for(let i=0;i<9;i++)add(a,'aris');
 assert.equal(M.mergeUnits(human(a)),4);assert.equal(human(a).units[0].star,3);valid(a);
 const p=human(a),gold=p.gold,pool=a.pool.aris,b=E.sellUnit(a,p.units[0].uid);valid(b);
 assert.equal(b.pool.aris,pool+9);assert.equal(human(b).gold,gold+45);assert.equal(human(b).units.length,0);
});
check('full bench permits a completing triple and refuses a non-merging purchase',()=>{
 const a=fresh();M.restoreShopCopies(a,human(a));add(a,'aris');add(a,'aris');
 for(const student of STUDENTS.filter(s=>s.id!=='aris'&&a.pool[s.id]>0).slice(0,7))add(a,student.id);
 offer(a,'aris');human(a).gold=100;let b=E.buyUnit(a,0);valid(b);assert.equal(human(b).units.length,8);
 const c=clone(a);offer(c,'mika');const units=clone(human(c).units),gold=human(c).gold;c.players[0].gold=gold;
 const d=E.buyUnit(c,0);assert.deepEqual(human(d).units,units);assert.equal(human(d).gold,gold);valid(d);
});
check('placement enforces home coordinates and capacity; occupied positions swap',()=>{
 let a=ready();add(a,'aris');const p=human(a),bench=M.benchUnits(p)[0];assert(bench);
 const bad=E.moveUnit(a,bench.uid,{kind:'field',x:8,y:0});assert.equal(bad,a);
 const cap=E.moveUnit(a,bench.uid,{kind:'field',x:0,y:0});assert.equal(M.fieldUnits(human(cap)).length,3);assert.equal(human(cap).units.find(u=>u.uid===bench.uid).position.kind,'bench');
 const target=M.fieldUnits(p)[0],before=clone(target.position);a=E.moveUnit(a,bench.uid,target.position);valid(a);
 assert.deepEqual(human(a).units.find(u=>u.uid===bench.uid).position,before);
 assert.equal(human(a).units.find(u=>u.uid===target.uid).position.kind,'bench');
});
check('automatic formation costs no gold and fills distinct cells with guard front lines',()=>{
 const a=ready(),gold=human(a).gold,b=E.autoFormation(a);valid(b);assert.equal(human(b).gold,gold);
 for(const u of M.fieldUnits(human(b)))if(STUDENT_BY_ID[u.studentId].role==='guard')assert(u.position.y<=1);
});
check('experience progresses within level cap; commander training respects costs and caps',()=>{
 let a=fresh();human(a).gold=1000;
 for(let i=0;i<50;i++)a=E.buyExperience(a);assert.equal(human(a).level,8);assert.equal(human(a).xp,0);
 for(const stat of ['intelligence','luck'])for(let i=0;i<7;i++)a=E.trainCommander(a,stat);
 assert.deepEqual(human(a).commander,{intelligence:5,luck:5});valid(a);
 const gold=human(a).gold;assert.equal(human(E.trainCommander(a,'luck')).gold,gold);
});
check('intelligence raises actual interest cap; luck shifts odds without bypassing level gates',()=>{
 const p=human(fresh());p.gold=100;assert.equal(M.nextInterest(p),5);p.commander.intelligence=4;assert.equal(M.nextInterest(p),7);
 for(let level=3;level<=8;level++){
 p.level=level;p.commander.luck=0;const low=M.oddsFor(p);p.commander.luck=5;const high=M.oddsFor(p);
 assert(Math.abs(high.reduce((n,v)=>n+v,0)-100)<.001);assert(high[0]<low[0]);
 for(let i=0;i<5;i++)if(low[i]===0)assert.equal(high[i],0);
 assert(high.at(low.findLastIndex(n=>n>0))>low.at(low.findLastIndex(n=>n>0)));
 }
});
check('depleted eligible pool yields empty slots instead of negative counts or forbidden tiers',()=>{
 const a=fresh(),p=human(a);M.restoreShopCopies(a,p);
 for(const student of STUDENTS)if(student.cost<=2)a.pool[student.id]=0;
 M.fillShop(a,p);assert(p.shop.every(id=>id===null));assert(Object.values(a.pool).every(n=>n>=0));
});
check('duplicate students count once for academy and role synergy',()=>{
 const a=fresh();M.restoreShopCopies(a,human(a));add(a,'serika',1,{kind:'field',x:0,y:0});add(a,'serika',1,{kind:'field',x:1,y:0});
 let traits=M.synergiesFor(human(a));assert.equal(traits.academy.find(t=>t.id==='abydos').count,1);
 add(a,'ayane',1,{kind:'field',x:2,y:0});traits=M.synergiesFor(human(a));assert.equal(traits.academy.find(t=>t.id==='abydos').tier,1);
 assert(C.battleTeam(human(a),0).every(u=>u.shield>0));valid(a);
});
check('pathfinding detours around live occupants without entering an occupied cell',()=>{
 const actor={x:2,y:6,side:0,hp:10,range:1},target={x:2,y:2,side:1,hp:10},wall={x:2,y:5,side:0,hp:10};
 const move=C.nextMove(actor,target,[actor,target,wall]);assert(move);assert.notDeepEqual(move,{x:2,y:5});assert.equal(Math.abs(move.x-2)+Math.abs(move.y-6),1);
});
check('battle simulation is deterministic, bounded and leaves roster ownership untouched',()=>{
 const a=ready(),pair=a.pairings[0],left=M.getPlayer(a,pair.a),right=M.getPlayer(a,pair.b),before=JSON.stringify(a);
 const battle=C.simulateBattle(left,right,123);assert.deepEqual(battle,C.simulateBattle(left,right,123));assert.equal(JSON.stringify(a),before);
 assert(battle.duration<=60);assert(battle.frames.length<=MAX_FRAMES);assert(battle.frames.length>1);
 assert(S.validTrace({round:1,left,right,humanMatch:true,...battle}));
 assert(battle.frames.some(f=>f[2].some(e=>e[2]==='attack')));
});
check('support, protection and offensive skills all appear in full-roster combat',()=>{
 const make=(side,ids)=>({id:'p'+side,name:'team'+side,units:ids.map((id,i)=>({uid:'p'+side+'-u'+(i+1),studentId:id,star:2,position:{kind:'field',x:i%6,y:Math.floor(i/6)}}))});
 const left=make(0,['yuuka','haruka','ayane','midori','noa','ako','hina','aris']);
 const right=make(1,['hoshino','mika','koharu','hanako','azusa','iori','tsurugi','nonomi']);
 const b=C.simulateBattle(left,right,887),kinds=new Set(b.frames.flatMap(f=>f[2].map(e=>e[2])));
 for(const kind of ['attack','skill','heal','shield','buff'])assert(kinds.has(kind),kind);
 assert(b.frames.some(f=>f[2].some(e=>e[2]==='buff'&&e[3]>=24)), 'Support synergy must scale rally potency');
});
check('phase guards block economic actions during battle and settlement happens only once',()=>{
 const battle=E.beginCombat(ready());valid(battle);
 for(const fn of [s=>E.buyUnit(s,0),E.rerollShop,E.buyExperience,E.autoFormation,s=>E.trainCommander(s,'luck'),E.beginCombat])assert.equal(fn(battle),battle);
 const finished=E.finishBattle(battle);valid(finished);assert.equal(E.finishBattle(finished),finished);
});
check('battle reload restores the same sealed outcomes and pauses at the same frame',()=>{
 const battle=E.advancePlayback(E.beginCombat(ready()));const saved=S.serializeState(battle,1234),restored=S.restoreState(saved,99999);
 assert.equal(restored.frameIndex,battle.frameIndex);assert.equal(restored.paused,true);assert.deepEqual(restored.pending,battle.pending);
 assert.deepEqual(E.finishBattle(restored).players,E.finishBattle(battle).players);
 assert.deepEqual(restored.players,battle.players);valid(restored);
});
check('animated completion and skip-to-result yield identical economy and next markets',()=>{
 const battle=E.beginCombat(ready()),skip=E.finishBattle(battle);let animated=battle;
 for(let i=0;i<MAX_FRAMES+2&&animated.phase==='battle';i++)animated=E.advancePlayback(animated);
 assert.deepEqual(animated,skip);
});
check('malformed saves reject wrong versions, overlapping units, forged pools and invalid traces',()=>{
 const a=E.beginCombat(ready()),bad=[];
 let b=clone(a);b.version='future';bad.push(b);
 b=clone(a);b.players[0].gold=-1;bad.push(b);
 b=clone(a);b.lastIncome={base:5,interest:0,streak:0,victory:1,total:{bad:true}};bad.push(b);
 b=clone(a);b.pool.serika++;bad.push(b);
 b=clone(a);b.players[0].units[1].position=clone(b.players[0].units[0].position);bad.push(b);
 b=clone(a);b.nextUnitId=1;bad.push(b);
 b=clone(a);b.pending.round++;bad.push(b);
 b=clone(a);b.pending.watch.round++;bad.push(b);
 b=clone(a);b.pending.watch.frames[0][1][0][5]=Infinity;bad.push(b);
 b=clone(a);b.pending.watch.frames[0][1]=[];bad.push(b);
 b=clone(a);b.pending.results[0].a='p99';bad.push(b);
 b=clone(a);b.frameIndex=MAX_FRAMES;bad.push(b);
 for(const value of bad){assert.equal(S.isValidSave(value),false);assert.throws(()=>S.restoreState(value));}
});
check('local guest and account keys isolate writes; replacement preserves previous progress',()=>{
 const storage=memory(),a=fresh(),b=fresh(99);L.writeLocalRun(storage,'guest',a);L.writeLocalRun(storage,'account:1',b);
 assert.equal(L.readLocalRun(storage,'guest').runId,a.runId);assert.equal(L.readLocalRun(storage,'account:1').runId,b.runId);
 L.writeLocalRun(storage,'guest',b,true);assert.equal(L.readLocalRun(storage,'guest',true).runId,a.runId);
 assert.equal(L.readLocalRun(storage,'account:1').runId,b.runId);
});
check('corrupt local originals are retained exactly; quota failure cannot overwrite current save',()=>{
 const storage=memory(),key=L.localSaveKey('guest');storage.setItem(key,'broken original');
 assert.throws(()=>L.readLocalRun(storage,'guest'));L.writeLocalRun(storage,'guest',fresh(),true);
 assert.equal(storage.getItem(key+':unreadable'),'broken original');
 storage.setItem(key,'different broken original');assert.throws(()=>L.writeLocalRun(storage,'guest',fresh(8),true));assert.equal(storage.getItem(key),'different broken original');
 const limited={getItem:()=>null,setItem:()=>{throw new Error('quota');}};assert.throws(()=>L.writeLocalRun(limited,'guest',fresh()));
});
let matches=0,maxSaveBytes=0,ghostMatches=0,totalRounds=0;
check('forty full seeded matches conserve the pool and produce eight unique final ranks',()=>{
 for(let seed=1;seed<=40;seed++){
 let s=fresh(seed);
 for(let guard=0;guard<31&&s.phase!=='finished';guard++){
  if(s.phase==='planning'){
   if(human(s).gold>=12&&human(s).level<7)s=E.buyExperience(s);
   for(let i=0;i<5;i++)s=E.buyUnit(s,i);
   s=E.autoFormation(s);
  }
  assert(['planning','spectate'].includes(s.phase));
  ghostMatches+=s.pairings.filter(p=>p.ghost).length;
  const battle=E.beginCombat(s);valid(battle);maxSaveBytes=Math.max(maxSaveBytes,Buffer.byteLength(JSON.stringify(battle)));
  s=E.finishBattle(battle);totalRounds++;valid(s);
 }
 assert.equal(s.phase,'finished');assert.equal(new Set(s.players.map(p=>p.rank)).size,8);assert.equal(s.players.filter(p=>p.hp>0).length,1);
 assert(s.round<=30);assert(s.log.length<=36);assert(s.resultHistory.length<=12);matches++;
 }
 assert(ghostMatches>0);assert(maxSaveBytes<500*1024);
});
check('eliminated humans can finish spectating without regaining units or income',()=>{
 let s=fresh(3);
 while(s.phase==='planning'){if(!human(s).units.length)s=ready(s);s=E.finishBattle(E.beginCombat(s));valid(s);}
 if(s.phase==='spectate'){
 const gold=human(s).gold,rank=human(s).rank;s=E.finishSpectating(s);valid(s);
 assert.equal(s.phase,'finished');assert.equal(human(s).rank,rank);assert.equal(human(s).gold,gold);assert.equal(human(s).units.length,0);
 }
});
check('round limit resolves remaining survivors into a unique final ranking',()=>{
 let s=ready();s.round=30;s=E.finishBattle(E.beginCombat(s));valid(s);assert.equal(s.phase,'finished');assert.equal(new Set(s.players.map(p=>p.rank)).size,8);
});
check('official portraits cover every Autochess and Defense student with verified local hashes',()=>{
 const dir=new URL('../public/games/shared/blue-archive/',import.meta.url),manifest=JSON.parse(fs.readFileSync(new URL('sources.json',dir),'utf8'));
 const required=new Set([...STUDENTS.map(s=>s.id),'yuzu']);assert.equal(manifest.icons.length,required.size);assert(/Official.*game-art/i.test(manifest.sourceKind));
 for(const icon of manifest.icons){assert(required.has(icon.id));const data=fs.readFileSync(new URL(icon.file,dir));assert.equal(crypto.createHash('sha256').update(data).digest('hex'),icon.sha256);assert.deepEqual(icon.dimensions,[160,160]);required.delete(icon.id);}
 assert.equal(required.size,0);
});
console.log(JSON.stringify({passed,matches,totalRounds,ghostMatches,maxSaveBytes}));
