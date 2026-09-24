import {
  getSimulationStartGate,
  runGuardedPhaseAdvance,
} from './phaseControllerGuards';
import { finishSimulationGame } from './finishGameRuntime';
import { runSimulationPhaseCycle } from './simulationPhaseCycleRuntime';
import { useSimulationPhaseSideEffects } from './useSimulationPhaseSideEffects';
import { SIMULATION_FRAME_FIELDS } from './simulationFrameRuntime';

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
    fullRunEventsRef,
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
    runEvents,
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
        day,
        dead,
        devRunTainted: Boolean(devRunTainted || devRunTaintedRef?.current),
        killCounts,
        matchSec,
        runEvents: fullRunEventsRef?.current || runEvents,
        runSeed,
        settings: refs.runInputRef?.current?.settings || settings,
        replayMode: state.replayMode,
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
        completeReplay: () => actions.completeReplay?.({
          events: fullRunEventsRef?.current || runEvents,
          random: refs.runRandomRef?.current?.getState(), ending: options.ending,
          tainted: Boolean(devRunTainted || devRunTaintedRef?.current),
        }),
      },
    });
  }

  async function proceedPhase() {
    const prepared = actions.prepareRun?.({ ...state, activeMap: refs.activeMapRef?.current || state.activeMap });
    if (prepared && day === 0) actions.applyRunInput?.(prepared.state);
    const engineState = prepared ? { ...state, ...prepared.state } : state;
    if (prepared && day > 0) {
      for (const key of SIMULATION_FRAME_FIELDS) if (key in state) engineState[key] = state[key];
    }
    return runSimulationPhaseCycle({
      refs: prepared ? { ...refs, activeMapRef: { current: prepared.state.activeMap }, activeMapIdRef: { current: prepared.state.activeMapId } } : refs,
      state: engineState,
      helpers: prepared?.helpers || helpers,
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
        mapPreparationRef: refs.mapPreparationRef,
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
        refreshMapSettingsFromServer: state.replayMode ? undefined : refreshMapSettingsFromServer,
        lockRunInputs: actions.lockRunInputs,
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
    proceedPhaseGuarded,
  });

  return {
    proceedPhase,
    proceedPhaseGuarded,
    startBlocked,
    startBlockedText,
  };
}
