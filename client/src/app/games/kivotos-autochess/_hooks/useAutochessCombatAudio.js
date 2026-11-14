'use client';

import { useEffect, useRef } from 'react';
import useGameSfx from '../../_lib/useGameSfx';
import { autochessCueProfile, combatSoundCue, shouldPlayCombatFrame } from '../_lib/autochessCombatSound.js';

export default function useAutochessCombatAudio({ watch, frameIndex, runId, active, paused, volume }) {
  const cursor = useRef(null);
  const play = useGameSfx({ theme: 'tactical', volume: volume * .24, enabled: volume > 0, resolveProfile: autochessCueProfile });
  useEffect(() => {
    const current = { key: watch ? runId + ':' + watch.round + ':' + watch.left.id + ':' + watch.right.id : '',
      index: frameIndex, active: active && Boolean(watch), paused, hidden: document.hidden };
    const previous = cursor.current;
    cursor.current = current;
    if (!shouldPlayCombatFrame(previous, current)) return;
    const cue = combatSoundCue(watch, frameIndex);
    if (cue) play(cue);
  }, [watch, frameIndex, runId, active, paused, play]);
}
