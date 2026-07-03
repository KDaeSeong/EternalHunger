import { useEffect, useRef } from 'react';
import {
  getSimulationStartGate,
  runGuardedPhaseAdvance,
} from './phaseControllerGuards';
import { finishSimulationGame } from './finishGameRuntime';
import { runSimulationPhaseCycle } from './simulationPhaseCycleRuntime';
import { useSimulationPhaseSideEffects } from './useSimulationPhaseSideEffects';

export function useSimulationPhaseController({
  actions = {},
  helpers = {},
  refs = {},
  state = {},
} = {}) {
  const {
    autoSpeedRef,
    devRunTaintedRef,
    fullLogsRef,
    isAdvancingRef,
    isFinishingRef,
    proceedPhaseGuardedRef,
  } = refs;
  const {
    assistCounts,
    autoPlay,
    autoSpeed,
    day,
    dead,
    devRunTainted,
    isAdvancing,
    isGameOver,
    killCounts,
    loading,
    matchSec,
    pendingTranscendPick,
    phase,
    runSeed,
    settings,
    showMarketPanel,
    survivors,
    winnerPredictionId,
  } = state;
  const {
    addLog,
    normalizeAutoSpeed,
    refreshMapSettingsFromServer,
    setAutoPlay,
    setCredits,
    setIsAdvancing,
    setIsGameOver,
    setResultSummary,
    setRunEvents,
    setShowResultModal,
    setWinner,
  } = actions;

  const {
    startBlocked,
    startBlockedText,
  } = getSimulationStartGate({ day, settings, survivors });

  async function finishGame(finalSurvivors, latestKillCounts, latestAssistCounts, options = {}) {
    return finishSimulationGame({
      finalSurvivors,
      latestAssistCounts,
      latestKillCounts,
      options,
      refs: {
        fullLogsRef,
        isFinishingRef,
      },
      state: {
        assistCounts,
        dead,
        devRunTainted: Boolean(devRunTainted || devRunTaintedRef?.current),
        killCounts,
        settings,
        winnerPredictionId,
      },
      actions: {
        addLog,
        setAutoPlay,
        setCredits,
        setIsGameOver,
        setResultSummary,
        setShowResultModal,
        setWinner,
      },
    });
  }
  const finishGameRef = useRef(finishGame);

  useEffect(() => {
    finishGameRef.current = finishGame;
  });

  async function proceedPhase() {
    return runSimulationPhaseCycle({
      refs,
      state,
      helpers,
      actions: {
        ...actions,
        finishGame,
      },
    });
  }

  async function proceedPhaseGuarded() {
    return runGuardedPhaseAdvance({
      refs: {
        isAdvancingRef,
      },
      state: {
        day,
        isGameOver,
        loading,
        matchSec,
        pendingTranscendPick,
        phase,
        runSeed,
        settings,
        showMarketPanel,
        survivors,
      },
      actions: {
        addLog,
        refreshMapSettingsFromServer,
        setIsAdvancing,
        setRunEvents,
      },
      proceedPhase,
    });
  }

  useSimulationPhaseSideEffects({
    refs: {
      autoSpeedRef,
      proceedPhaseGuardedRef,
    },
    state: {
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
    },
    actions: {
      normalizeAutoSpeed,
    },
    startBlocked,
    finishGameRef,
    proceedPhaseGuarded,
  });

  return {
    proceedPhase,
    proceedPhaseGuarded,
    startBlocked,
    startBlockedText,
  };
}
