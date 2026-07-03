import { beginSimulationPhase, prepareForbiddenZonePhase } from './phasePreparationRuntime';
import { runPhaseRevival } from './phaseRevivalRuntime';
import {
  buildStarterLoadoutSurvivorsForPhase,
  prepareWorldSpawnsForPhase,
} from './phaseSpawnRuntime';
import { normalizeRuntimeSurvivorList } from './simulationEngine';

export function runSimulationPhaseSetup({
  actions = {},
  helpers = {},
  refs = {},
  state = {},
} = {}) {
  const {
    activeMapIdRef,
    activeMapRef,
    autoSpeedRef,
    startStarterLoadoutAppliedRef,
    suddenDeathActiveRef,
    suddenDeathEndAtSecRef,
    suddenDeathForbiddenAnnouncedRef,
  } = refs;
  const {
    activeMap,
    activeMapId,
    autoSpeed,
    day,
    dead,
    kiosks,
    matchSec,
    phase,
    publicItems,
    settings,
    spawnState,
    survivors,
    zones,
  } = state;
  const {
    getForbiddenAddedZoneIdsForPhase,
    getForbiddenZoneIdsForPhase,
    getZoneName,
  } = helpers;
  const {
    addLog,
    atNow: externalAtNow,
    emitRunEvent,
    normalizeAutoSpeed,
    resetPhaseLogs,
    setDay,
    setDead,
    setForbiddenAddedNow,
    setMatchSec,
    setPhase,
  } = actions;

  const phaseRuntime = beginSimulationPhase({
    refs: {
      autoSpeedRef,
      suddenDeathActiveRef,
      suddenDeathEndAtSecRef,
    },
    state: {
      autoSpeed,
      day,
      matchSec,
      phase,
      settings,
    },
    actions: {
      addLog,
      normalizeAutoSpeed,
      resetPhaseLogs,
      setDay,
      setMatchSec,
      setPhase,
    },
  });
  const {
    atNow,
    canReviveThisMatch,
    matchCfgNow,
    nextDay,
    nextPhase,
    phaseIdxNow,
    phaseStartSec,
    ruleset,
    useDetonation,
  } = phaseRuntime;

  const forbiddenRuntime = prepareForbiddenZonePhase({
    refs: {
      activeMapIdRef,
      activeMapRef,
      suddenDeathActiveRef,
      suddenDeathForbiddenAnnouncedRef,
    },
    state: {
      activeMap,
      activeMapId,
      nextDay,
      nextPhase,
      ruleset,
      settings,
      useDetonation,
      zones,
    },
    helpers: {
      getForbiddenAddedZoneIdsForPhase,
      getForbiddenZoneIdsForPhase,
      getZoneName,
    },
    actions: {
      addLog,
      setForbiddenAddedNow,
    },
  });
  const {
    forbiddenIds,
    mapIdNow,
    mapObj,
  } = forbiddenRuntime;

  const revivalRuntime = runPhaseRevival({
    state: {
      canReviveThisMatch,
      dead,
      forbiddenIds,
      kiosks,
      mapObj,
      phaseIdxNow,
      phaseStartSec,
      publicItems,
      reviveCfg: ruleset?.revive || {},
      ruleset,
      survivors,
      useDetonation,
    },
    actions: {
      addLog,
      atNow: externalAtNow || atNow,
      emitRunEvent,
      setDead,
    },
  });

  const nextSpawn = prepareWorldSpawnsForPhase({
    state: {
      forbiddenIds,
      mapIdNow,
      mapObj,
      matchMode: matchCfgNow.matchMode,
      nextDay,
      nextPhase,
      ruleset,
      spawnState,
      zones,
    },
    actions: {
      addLog,
      atNow: externalAtNow || atNow,
      emitRunEvent,
    },
  });

  let phaseSurvivors = buildStarterLoadoutSurvivorsForPhase({
    refs: {
      startStarterLoadoutAppliedRef,
    },
    state: {
      nextDay,
      nextPhase,
      publicItems,
      ruleset,
      survivors,
    },
    actions: {
      addLog,
    },
  });

  if (revivalRuntime.revivedNow.length) {
    phaseSurvivors = [...phaseSurvivors, ...revivalRuntime.revivedNow];
  }

  return {
    ...phaseRuntime,
    ...forbiddenRuntime,
    ...revivalRuntime,
    nextSpawn,
    phaseSurvivors: normalizeRuntimeSurvivorList(phaseSurvivors),
  };
}
