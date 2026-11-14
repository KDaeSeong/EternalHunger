import { characterSoundVoices } from '../../kivotos-autochess/_lib/autochessCombatSound.js';
import { DEFENSE_CHARACTER_EFFECTS, defenseEffectEvents } from './infiniteDefenseEffects.js';

export function defenseSoundCue(events, stage = '') {
  const actions=new Map();
  for(const event of events){
    const kind=event.kind==='mine'?'buff':stage==='attack'?'attack':stage==='skill'||event.traits.length?'skill':'attack';
    const row={id:event.studentId,kind,pan:Math.round((event.from.x/12-.5)*160)/100};
    if(!actions.has(row.id)||kind!=='attack')actions.set(row.id,row);
  }
  const selected=[...actions.values()].sort((a,b)=>(b.kind!=='attack')-(a.kind!=='attack')).slice(0,3);
  return selected.length?'defense:'+JSON.stringify(selected.map(row=>[row.id,row.kind,row.pan])):'';
}
export function defenseCueProfile(cue){
  if(!String(cue).startsWith('defense:'))return null;
  try{
    const rows=JSON.parse(cue.slice(8));if(!Array.isArray(rows)||rows.length>3)return [];
    const scale=1/Math.sqrt(Math.max(1,rows.length));
    return rows.flatMap(([id,kind,pan])=>DEFENSE_CHARACTER_EFFECTS[id]
      ?characterSoundVoices(id,kind,DEFENSE_CHARACTER_EFFECTS[id]).map(spec=>({...spec,
        gain:spec.gain*scale*(kind==='buff'?.45:1),pan:Math.max(-.8,Math.min(.8,Number(pan)||0))})):[]).slice(0,12);
  }catch{return [];}
}
export function newDefenseSoundEvents(previous,current,state){
  if(!previous||previous.runId!==current.runId||current.elapsed<=previous.elapsed||!current.active||current.paused||current.hidden)return [];
  const ids=new Set(previous.ids);
  return defenseEffectEvents(state).filter(event=>!ids.has(event.id));
}
