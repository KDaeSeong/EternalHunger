'use client';
import { useEffect, useRef } from 'react';
import useGameSfx from '../../_lib/useGameSfx';
import { defenseCueProfile, defenseSoundCue, newDefenseSoundEvents } from '../_lib/infiniteDefenseSound.js';

export default function useDefenseCombatAudio({ state, active, volume }) {
  const cursor=useRef(null);
  const play=useGameSfx({theme:'tactical',volume:volume*.24,enabled:volume>0,resolveProfile:defenseCueProfile});
  useEffect(()=>{
    const current={runId:state.runId,elapsed:state.elapsed,ids:state.effects.map(fx=>fx.id),
      active:active&&state.phase==='wave',paused:state.paused,hidden:document.hidden};
    const previous=cursor.current;cursor.current=current;
    const cue=defenseSoundCue(newDefenseSoundEvents(previous,current,state));
    if(cue)play(cue);
  },[state,active,play]);
}
