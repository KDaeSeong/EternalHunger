import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import { STUDENTS } from '../src/app/games/kivotos-autochess/_lib/autochessData.js';
import { CHARACTER_EFFECTS, characterEffectFor, characterTrails } from '../src/app/games/kivotos-autochess/_lib/autochessCharacterEffects.js';
import { characterSoundVoices, combatSoundCue, autochessCueProfile, shouldPlayCombatFrame, createEffectPreview } from '../src/app/games/kivotos-autochess/_lib/autochessCombatSound.js';
import { combatPresentation } from '../src/app/games/kivotos-autochess/_lib/autochessCombatEffects.js';
import { boardTeamsFor } from '../src/app/games/kivotos-autochess/_lib/autochessBoardTeams.js';

let passed = 0;
const check = (name, run) => { run(); passed++; console.log('PASS ' + name); };
const present = preview => combatPresentation(preview.watch.frames[0], boardTeamsFor(preview.player, null, preview.watch));
check('all 32 roster characters have authored profiles without changing the roster', () => {
  assert.equal(STUDENTS.length, 32); assert.deepEqual(Object.keys(CHARACTER_EFFECTS).sort(), STUDENTS.map(x => x.id).sort());
});
check('every character has distinct attack and skill geometry beyond palette alone', () => {
  for (const kind of ['attack','skill']) {
    const signatures = STUDENTS.map(x => { const p = CHARACTER_EFFECTS[x.id][kind]; return JSON.stringify([p.trail,p.count,p.spread,p.sigil,p.size]); });
    assert.equal(new Set(signatures).size, 32);
  }
});
check('all 64 attack and skill previews carry the correct student and signature', () => {
  for (const student of STUDENTS) for (const kind of ['attack','skill']) {
    const result = present(createEffectPreview(student.id, kind, 2));
    assert.equal(result.effects.length, 1); assert.equal(result.effects[0].from.studentId, student.id);
    assert.equal(result.effects[0].profile.sigil, CHARACTER_EFFECTS[student.id][kind].sigil);
  }
});
check('support previews point at allies while attack previews point at the opponent', () => {
  for (const student of STUDENTS) for (const kind of ['attack','skill']) {
    const fx = present(createEffectPreview(student.id, kind)).effects[0];
    assert.equal(fx.to.badge, kind === 'skill' && ['heal','shield','rally'].includes(student.skill) ? '아군' : '적군');
    assert.equal(fx.teamColor, '#75d9ff');
  }
});
check('all projectile paths are finite and stay bounded in count', () => {
  for (const student of STUDENTS) for (const kind of ['attack','skill']) {
    const fx = present(createEffectPreview(student.id, kind)).effects[0], trails = characterTrails(fx);
    assert(trails.length <= 5); assert(trails.every(x => !/NaN|Infinity/.test(x.d) && x.d.startsWith('M')));
  }
});
check('passive NTE shields keep a shield motif separate from active offensive skills', () => {
  assert.equal(characterEffectFor('nonomi','shield').motif, 'passive-ward');
  assert.equal(characterEffectFor('nonomi','skill').motif, 'cartridges');
});
check('all characters have distinct synthesized attack and skill cues', () => {
  for (const kind of ['attack','skill']) {
    const signatures = STUDENTS.map(x => JSON.stringify(characterSoundVoices(x.id, kind)));
    assert.equal(new Set(signatures).size, 32);
  }
});
check('all sound voices have safe finite envelopes and bounded short duration', () => {
  for (const student of STUDENTS) for (const kind of ['attack','skill','heal','shield','buff']) {
    const voices = characterSoundVoices(student.id, kind); assert(voices.length >= 2 && voices.length <= 4);
    for (const voice of voices) {
      assert(Number.isFinite(voice.frequency) && voice.frequency >= 20 && voice.frequency < 10000);
      assert(voice.gain > 0 && voice.gain <= .5); assert(voice.duration > 0 && voice.duration <= .18);
      assert((voice.start || 0) + voice.duration < .3);
    }
  }
});
check('area damage, healing and shielding emit one cue per caster rather than per target', () => {
  const preview = createEffectPreview('nonomi','skill'); preview.watch.frames[0][2].push(['p0-u1','p1-u1','skill',120]);
  const rows = JSON.parse(combatSoundCue(preview.watch,0).slice(10));
  assert.equal(rows.length,1); assert.equal(rows[0][0],'nonomi');
});
check('dense frames prioritize skills and cap the mix at three actions and twelve voices', () => {
  const preview = createEffectPreview('serika','attack'), frame = preview.watch.frames[0];
  frame[1] = STUDENTS.slice(0,8).map((x,i) => ['p0-u'+i,x.id,0,i%6,4,100,100,0,0,1]);
  frame[2] = frame[1].map((x,i) => [x[0],frame[1][(i+1)%8][0],i===7?'skill':'attack',10]);
  const cue = combatSoundCue(preview.watch,0), rows=JSON.parse(cue.slice(10));
  assert.equal(rows.length,3); assert.equal(rows[0][1],'skill'); assert(autochessCueProfile(cue).length<=12);
});
check('panning follows board position and invalid custom cues cannot generate voices', () => {
  const preview = createEffectPreview('aris','skill'), cue = combatSoundCue(preview.watch,0);
  assert(JSON.parse(cue.slice(10))[0][2] < 0); assert.equal(autochessCueProfile('click'),null);
  for(const bad of ['autochess:bad','autochess:{}','autochess:[["unknown","attack",0]]']) assert.deepEqual(autochessCueProfile(bad),[]);
});
check('pause, hidden pages, duplicate renders and rewinds cannot replay combat sounds', () => {
  const previous={key:'run:1:p0:p1',index:4};
  const current={key:previous.key,index:5,active:true,paused:false,hidden:false};
  assert(shouldPlayCombatFrame(previous,current));
  for(const change of [{index:4},{index:3},{paused:true},{hidden:true},{active:false},{key:'another'}])
    assert.equal(shouldPlayCombatFrame(previous,{...current,...change}),false);
  assert.equal(shouldPlayCombatFrame(null,current),false);
});
check('the terminal copied frame does not replay its already played event list', () => {
  const preview=createEffectPreview('aris','skill'), first=preview.watch.frames[0];
  preview.watch.frames.push([.6,structuredClone(first[1]),structuredClone(first[2])]);
  assert.equal(combatSoundCue(preview.watch,1),'');
});
check('effect and sound derivation leave existing sealed replays unchanged', () => {
  const preview=createEffectPreview('gi-lisa','skill'), before=JSON.stringify(preview);
  for(let i=0;i<5;i++){present(preview);autochessCueProfile(combatSoundCue(preview.watch,0));}
  assert.equal(JSON.stringify(preview),before); assert.equal(combatSoundCue(createEffectPreview('gi-lisa').watch,0),'');
});

const sfxSource=await fs.readFile(new URL('../src/app/games/_lib/useGameSfx.js',import.meta.url),'utf8');
const voiceSource=sfxSource.slice(sfxSource.indexOf('function connectSfxVoice('),sfxSource.indexOf('export default function useGameSfx('));
const sandbox={};vm.runInNewContext(voiceSource+'\nthis.playVoice = playVoice;',sandbox);
function fakeSession(){
  const nodes=[],sources=[],parameters=[];
  const parameter=()=>({setValueAtTime:(...args)=>parameters.push(args),exponentialRampToValueAtTime:(...args)=>parameters.push(args)});
  const node=type=>{const n={type,connect(){},disconnect(){this.disconnected=true;},gain:parameter(),frequency:parameter(),Q:parameter(),pan:parameter(),
    start(t){this.started=t;},stop(t){this.stopped=t;}};nodes.push(n);if(type==='source'||type==='oscillator')sources.push(n);return n;};
  const ctx={currentTime:0,sampleRate:8000,createGain:()=>node('gain'),createStereoPanner:()=>node('pan'),createBiquadFilter:()=>node('filter'),
    createBufferSource:()=>node('source'),createOscillator:()=>node('oscillator'),
    createBuffer:(_channels,length)=>({samples:new Float32Array(length),getChannelData(){return this.samples;}})};
  return {ctx,dryGain:{},convolver:{},nodes,sources,parameters};
}
check('the real shared renderer schedules every authored voice with nonzero gain',()=>{
  for(const student of STUDENTS)for(const kind of ['attack','skill']){
    const session=fakeSession(),voices=characterSoundVoices(student.id,kind);
    voices.forEach((spec,index)=>sandbox.playVoice(session,spec,.2,{mix:{panSpread:.3,reverb:.06},index,count:voices.length}));
    assert.equal(session.sources.length,voices.length);
    assert(session.sources.every(x=>x.started>=0&&x.stopped>x.started));
    assert(session.parameters.some(x=>x[0]>.005));
    assert(session.sources.filter(x=>x.buffer).every(x=>x.buffer.samples.some(y=>y!==0)));
  }
});
check('ended oscillator and noise voices disconnect every transient audio node',()=>{
  for(const student of STUDENTS)for(const kind of ['attack','skill']){
    const session=fakeSession(),voices=characterSoundVoices(student.id,kind);
    voices.forEach((spec,index)=>sandbox.playVoice(session,spec,.2,{mix:{panSpread:.3,reverb:.06},index,count:voices.length}));
    session.sources.forEach(x=>x.onended());assert(session.nodes.every(x=>x.disconnected));
  }
});
check('zero volume and shared mute guard the actual custom-profile callback',()=>{
  const hookSource=sfxSource.slice(sfxSource.indexOf('export default function useGameSfx('),sfxSource.indexOf('export function useGameSfxPreference(')).replace('export default ','');
  let voiced=0,preference=true;
  const context={usePathname:()=>'',useRef:()=>({current:0}),useMemo:fn=>fn(),useCallback:fn=>fn,
    resolveGameAudioTheme:()=> 'tactical',readGameSfxPreference:()=>preference,Date:{now:()=>1000},
    document:{documentElement:{dataset:{}}},window:{dispatchEvent(){}},CustomEvent:function(){},GAME_BGM_DUCK_EVENT:'duck',
    getSharedSfxSession:()=>({ctx:{state:'running'}}),cueProfile:()=>[{frequency:440}],
    sfxSpatialMix:()=>({}),cueDuckEnvelope:()=>({}),playVoice:()=>{voiced++;}};
  vm.runInNewContext(hookSource+'\nthis.useGameSfx=useGameSfx;',context);
  const options={volume:.2,resolveProfile:()=>[{frequency:220},{frequency:330}]};
  context.useGameSfx(options)('custom');assert.equal(voiced,2);
  preference=false;context.useGameSfx(options)('custom');assert.equal(voiced,2);
  preference=true;context.useGameSfx({...options,volume:0})('custom');assert.equal(voiced,2);
  context.useGameSfx({...options,enabled:false})('custom');assert.equal(voiced,2);
  context.useGameSfx({volume:.2})('click');assert.equal(voiced,3);
});
check('silent range and preview controls suppress shared change sounds',()=>{
  const calls=[],attributes={};class FakeElement { closest(){return this;}getAttribute(name){return attributes[name]||null;} }
  const target=new FakeElement(),context={Element:FakeElement,useCallback:fn=>fn,useGameSfx:()=>cue=>calls.push(cue),isDisabledGameSfxControl:()=>false};
  const handlers=sfxSource.slice(sfxSource.indexOf('export function useGameSfxEventHandlers(')).replace('export ','');
  vm.runInNewContext(handlers+'\nthis.handlers=useGameSfxEventHandlers;',context);const handle=context.handlers().handleGameSfxChangeCapture,event={target,currentTarget:{contains:()=>true}};
  attributes['data-game-sfx']='off';handle(event);assert.deepEqual(calls,[]);
  delete attributes['data-game-sfx'];attributes['data-game-sfx-change']='off';handle(event);assert.deepEqual(calls,[]);
  delete attributes['data-game-sfx-change'];handle(event);assert.deepEqual(calls,['select']);
});
console.log(JSON.stringify({passed,characters:STUDENTS.length,individualVisuals:64,individualSounds:64}));
