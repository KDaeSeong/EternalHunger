import { useEffect } from 'react';

export function useSimulationPhaseSideEffects({
  refs = {},
  state = {},
  actions = {},
  startBlocked = false,
  proceedPhaseGuarded,
} = {}) {
  const {
    autoSpeedRef,
    proceedPhaseGuardedRef,
  } = refs;
  const {
    autoPlay,
    autoSpeed,
    day,
    isAdvancing,
    isGameOver,
    loading,
    matchSec,
    pendingTranscendPick,
    phase,
    settings,
    showMarketPanel,
    survivors,
  } = state;
  const {
    normalizeAutoSpeed,
  } = actions;

  useEffect(() => {
    proceedPhaseGuardedRef.current = proceedPhaseGuarded;
  });

  // Only the shared-clock phase finalizer can declare the match finished.
  // Rendered snapshots may be mid-action or awaiting a protected team revival.

  useEffect(() => {
    if (!autoPlay) return;
    if (loading) return;
    if (isAdvancing) return;
    if (isGameOver) return;
    if (showMarketPanel && pendingTranscendPick) return;
    if (startBlocked) return;

    const speed = normalizeAutoSpeed(autoSpeedRef.current || autoSpeed);
    const delayMs = Math.max(80, Math.round(220 / speed));

    const id = window.setTimeout(() => {
      proceedPhaseGuardedRef.current?.();
    }, delayMs);

    return () => window.clearTimeout(id);
  }, [autoPlay, autoSpeed, autoSpeedRef, matchSec, loading, isAdvancing, isGameOver, showMarketPanel, pendingTranscendPick, day, phase, settings?.rulesetId, survivors.length, startBlocked, normalizeAutoSpeed, proceedPhaseGuardedRef]);
}
