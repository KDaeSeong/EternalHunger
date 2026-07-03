import { runFacilityGatherPhase } from './phaseFacilityGatherRuntime';
import { runFieldLootPhase } from './phaseFieldLootRuntime';
import { runWorldSpawnPickupPhase } from './phaseWorldSpawnPickupRuntime';

export function runActorLootStep({
  actions = {},
  actor = null,
  movementResult = {},
  state = {},
} = {}) {
  const {
    craftables,
    itemMetaById,
    itemNameById,
    mapObj,
    nextDay = 1,
    nextPhase = 'morning',
    nextSpawn,
    pendingPickAssigned: initialPendingPickAssigned = false,
    pendingTranscendPick = null,
    phaseIdxNow = 0,
    publicItems = [],
    ruleset,
    selectedCharId = '',
    showMarketPanel = false,
  } = state;
  const {
    addLog = () => {},
    applyLootCraftResult = () => null,
    atNow = () => null,
    emitItemGainIfAny = () => {},
    emitObjectiveRunEvent = () => {},
    emitRunEvent = () => {},
    getZoneName = (zoneId) => String(zoneId || ''),
    grantMastery = () => {},
    setPendingTranscendPick = () => {},
  } = actions;

  let updated = actor;
  let pendingPickAssigned = initialPendingPickAssigned;

  const facilityGatherResult = runFacilityGatherPhase({
    state: {
      actor: updated,
      mapObj,
      nextDay,
      publicItems,
      ruleset,
    },
    actions: {
      addLog,
      atNow,
      emitItemGainIfAny,
      getZoneName,
    },
  });
  updated = facilityGatherResult.actor;

  const fieldLootResult = runFieldLootPhase({
    state: {
      actor: updated,
      craftables,
      didMove: movementResult.didMove,
      itemMetaById,
      itemNameById,
      mapObj,
      nextDay,
      nextPhase,
      pendingPickAssigned,
      pendingTranscendPick,
      preGoal: movementResult.preGoal,
      publicItems,
      ruleset,
      selectedCharId,
      showMarketPanel,
    },
    actions: {
      addLog,
      applyLootCraftResult,
      atNow,
      emitItemGainIfAny,
      getZoneName,
      grantMastery,
      setPendingTranscendPick,
    },
  });
  updated = fieldLootResult.actor;
  pendingPickAssigned = fieldLootResult.pendingPickAssigned;

  const worldSpawnPickupResult = runWorldSpawnPickupPhase({
    state: {
      actor: updated,
      craftables,
      didMove: movementResult.didMove,
      itemMetaById,
      itemNameById,
      nextDay,
      nextPhase,
      nextSpawn,
      pendingPickAssigned,
      pendingTranscendPick,
      phaseIdxNow,
      preGoal: movementResult.preGoal,
      publicItems,
      ruleset,
      selectedCharId,
      showMarketPanel,
    },
    actions: {
      addLog,
      applyLootCraftResult,
      atNow,
      emitItemGainIfAny,
      emitObjectiveRunEvent,
      emitRunEvent,
      getZoneName,
      grantMastery,
      setPendingTranscendPick,
    },
  });
  updated = worldSpawnPickupResult.actor;
  pendingPickAssigned = worldSpawnPickupResult.pendingPickAssigned;

  return {
    actor: updated,
    fieldLootResult,
    pendingPickAssigned,
    worldSpawnPickupResult,
  };
}
