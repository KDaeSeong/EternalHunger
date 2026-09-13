import { runDetonationTickPhase } from './phaseDetonationTickRuntime';
import { runDimensionRiftPhase } from './phaseDimensionRiftRuntime';

export function runPhaseWorldResolution({
  actions = {},
  refs = {},
  state = {},
} = {}) {
  const {
    suddenDeathActiveRef,
  } = refs;
  const {
    canReviveThisMatch = false,
    currentActionSec = () => 0,
    fogLocalSec = 0,
    forbiddenIds = new Set(),
    isSoloMatch = false,
    itemMetaById,
    itemNameById,
    mapObj,
    movePowerContext = {},
    newlyDead = [],
    nextDay = 1,
    nextPhase = 'morning',
    nextSpawn,
    phaseDurationSec = 0,
    phaseIdxNow = 0,
    phaseStartSec = 0,
    publicItems = [],
    reviveCutoffIdx = 0,
    revivalContext,
    ruleset,
    suddenDeathSafeZoneIds = [],
    tickSec = 1,
    updatedSurvivors = [],
    useDetonation = false,
    zoneGraph = {},
    zones = [],
  } = state;
  const {
    addLog = () => {},
    appendPhaseDeadSnapshots = (actor) => actor,
    atNow = () => null,
    emitDeathRunEventOnce = () => {},
    emitItemGainIfAny = () => {},
    emitRunEvent = () => {},
    flushDeadSnapshots = () => {},
    getZoneName = (zoneId) => String(zoneId || ''),
    setDeathMetadata = () => {},
  } = actions;

  const dimensionRiftResult = runDimensionRiftPhase({
    state: {
      revivalContext,
      currentActionSec,
      forbiddenIds,
      isSoloMatch,
      itemMetaById,
      itemNameById,
      movePowerContext,
      nextDay,
      nextPhase,
      nextSpawn,
      phaseStartSec,
      phaseDurationSec,
      phaseIdxNow,
      publicItems,
      ruleset,
      updatedSurvivors,
      zones,
    },
    actions: {
      addLog,
      atNow,
      emitItemGainIfAny,
      emitRunEvent,
      getZoneName,
    },
  });
  let resolvedSurvivors = dimensionRiftResult.updatedSurvivors;

  const detonationTickResult = state.deferTimeTicks ? { updatedSurvivors: resolvedSurvivors } : runDetonationTickPhase({
    state: {
      canReviveThisMatch,
      fogLocalSec,
      forbiddenIds,
      mapObj,
      newlyDead,
      phaseDurationSec,
      phaseIdxNow,
      phaseStartSec,
      reviveCutoffIdx,
      ruleset,
      suddenDeathActive: Boolean(suddenDeathActiveRef?.current),
      tickSec,
      updatedSurvivors: resolvedSurvivors,
      useDetonation,
      zoneGraph,
    },
    actions: {
      addLog,
      atNow,
      emitDeathRunEventOnce,
      getZoneName,
      setDeathMetadata,
    },
  });
  resolvedSurvivors = detonationTickResult.updatedSurvivors;

  flushDeadSnapshots(appendPhaseDeadSnapshots(newlyDead));

  return {
    newlyDead,
    updatedSurvivors: resolvedSurvivors,
  };
}
