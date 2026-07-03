import { useEffect } from 'react';
import { getAliveTeams } from './simulationEngine';

export function useSimulationPhaseSideEffects({
  refs = {},
  state = {},
  actions = {},
  startBlocked = false,
  finishGameRef,
  proceedPhaseGuarded,
} = {}) {
  const {
    autoSpeedRef,
    proceedPhaseGuardedRef,
  } = refs;
  const {
    assistCounts,
    autoPlay,
    autoSpeed,
    day,
    isAdvancing,
    isGameOver,
    killCounts,
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

  useEffect(() => {
    if (loading || isGameOver) return;
    if (day === 0) return;
    if (!Array.isArray(survivors)) return;
    const aliveTeams = getAliveTeams(survivors);
    if (aliveTeams.length > 1) return;
    const finalSurvivors = aliveTeams[0]?.members || survivors;
    const id = window.setTimeout(() => {
      finishGameRef.current?.(finalSurvivors, killCounts, assistCounts);
    }, 0);
    return () => window.clearTimeout(id);
  }, [survivors, day, loading, isGameOver, killCounts, assistCounts, finishGameRef]);

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
