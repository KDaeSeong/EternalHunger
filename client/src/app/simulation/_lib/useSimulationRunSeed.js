import { useEffect, useRef, useState } from 'react';
import { createSeedRng } from './randomSeedRuntime';

const SEED_STORAGE_KEY = 'eh_run_seed';

function getInitialSeed() {
  try {
    const value = window.localStorage.getItem(SEED_STORAGE_KEY);
    const seed = value && String(value).trim() ? String(value).trim() : '';
    return seed || String(Date.now());
  } catch {
    return String(Date.now());
  }
}

export function useSimulationRunSeed({
  day,
  isAdvancing,
  isGameOver,
  matchSec,
} = {}) {
  const [runSeed, setRunSeed] = useState(getInitialSeed);
  const [seedDraft, setSeedDraft] = useState(getInitialSeed);
  const randomBackupRef = useRef(null);

  function applyRunSeed(seedStr) {
    const seed = String(seedStr || '').trim() || '0';
    try {
      window.localStorage.setItem(SEED_STORAGE_KEY, seed);
    } catch {
      // ignore storage errors
    }
    if (!randomBackupRef.current) randomBackupRef.current = Math.random;
    Math.random = createSeedRng(`RUN:${seed}`);
  }

  function restoreRandom() {
    if (randomBackupRef.current) Math.random = randomBackupRef.current;
  }

  useEffect(() => {
    if (!runSeed) return;
    if (isAdvancing || isGameOver) return;
    if (day !== 0 || matchSec !== 0) return;
    applyRunSeed(runSeed);
  }, [runSeed, day, matchSec, isAdvancing, isGameOver]);

  useEffect(() => () => restoreRandom(), []);

  return {
    runSeed,
    seedDraft,
    setRunSeed,
    setSeedDraft,
  };
}
