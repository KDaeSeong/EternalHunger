import {
  getForbiddenAddedZoneIdsForPhase as getForbiddenAddedZoneIdsForPhaseRuntime,
  getForbiddenZoneIdsForPhase as getForbiddenZoneIdsForPhaseRuntime,
} from './forbiddenZoneRuntime';
import { createMapActionRuntime } from './mapActionRuntime';

export function useSimulationMapActions({
  actions = {},
  refs = {},
  state = {},
} = {}) {
  const {
    forbiddenCacheRef,
  } = refs;
  const {
    settings,
    zones,
  } = state;

  const getForbiddenZoneIdsForPhase = (mapObj, dayNum, phaseKey) => (
    getForbiddenZoneIdsForPhaseRuntime(mapObj, dayNum, phaseKey, zones, settings, forbiddenCacheRef?.current)
  );
  const getForbiddenAddedZoneIdsForPhase = (mapObj, dayNum, phaseKey) => (
    getForbiddenAddedZoneIdsForPhaseRuntime(mapObj, dayNum, phaseKey, zones, settings, forbiddenCacheRef?.current)
  );
  const getMapActions = () => createMapActionRuntime({
    refs,
    state,
    actions: {
      ...actions,
      getForbiddenZoneIdsForPhase,
    },
  });

  return {
    doHyperloopJump: (toMapId, whoId) => getMapActions().doHyperloopJump(toMapId, whoId),
    getForbiddenAddedZoneIdsForPhase,
    getForbiddenZoneIdsForPhase,
    refreshMapSettingsFromServer: (reason = 'manual') => getMapActions().refreshMapSettingsFromServer(reason),
  };
}
