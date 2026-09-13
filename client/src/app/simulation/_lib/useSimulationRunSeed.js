import { useEffect, useRef, useState } from 'react';

const SEED_STORAGE_KEY = 'eh_run_seed';

export function createNewSimulationSeed(currentSeed = '') {
  const now = String(Date.now());
  const current = String(currentSeed || '').trim();
  const prefix = `${now}-new`;
  if (current === now) return `${prefix}-1`;
  if (current === prefix) return `${prefix}-2`;
  if (current.startsWith(`${prefix}-`)) {
    const suffix = Number(current.slice(prefix.length + 1));
    if (Number.isSafeInteger(suffix) && suffix >= 1) return `${prefix}-${suffix + 1}`;
  }
  return now;
}

function getInitialSeed() {
  try {
    const value = window.localStorage.getItem(SEED_STORAGE_KEY);
    const seed = value && String(value).trim() ? String(value).trim() : '';
    return seed || String(Date.now());
  } catch {
    return String(Date.now());
  }
}

export function useSimulationRunSeed(savedSeed) {
  const [runSeed, setRunSeed] = useState(() => savedSeed ?? getInitialSeed());
  const [seedDraft, setSeedDraft] = useState(() => runSeed);
  // Initialized at the first engine phase, after the actual pregame roster is
  // chosen. Renders, pregame edits and unrelated UI never consume this stream.
  const runRandomRef = useRef(null);

  useEffect(() => {
    if (savedSeed !== undefined) return;
    try {
      window.localStorage.setItem(SEED_STORAGE_KEY, String(runSeed || '').trim() || '0');
    } catch {
      // ignore storage errors
    }
  }, [runSeed, savedSeed]);

  return {
    runRandomRef,
    runSeed,
    seedDraft,
    setRunSeed,
    setSeedDraft,
  };
}
