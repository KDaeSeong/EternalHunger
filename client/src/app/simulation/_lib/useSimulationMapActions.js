import { useEffect, useLayoutEffect, useRef } from 'react';
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
  const currentInputsRef = useRef(state);
  useLayoutEffect(() => { currentInputsRef.current = state; }, [state]);
  const { mapPreparationRef } = refs;
  useEffect(() => () => {
    if (mapPreparationRef?.current) {
      mapPreparationRef.current.cancelled = true;
      mapPreparationRef.current = null;
    }
  }, [mapPreparationRef]);
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
      getCurrentMapInputs: () => currentInputsRef.current,
      getForbiddenZoneIdsForPhase,
    },
  });

  return {
    doHyperloopJump: (toMapId, whoId) => getMapActions().doHyperloopJump(toMapId, whoId),
    getForbiddenAddedZoneIdsForPhase,
    getForbiddenZoneIdsForPhase,
    removeLocalMap: (mapId) => getMapActions().removeLocalMap(mapId),
    refreshMapSettingsFromServer: (reason = 'manual') => getMapActions().refreshMapSettingsFromServer(reason),
    saveLocalMap: (mapDraft) => getMapActions().saveLocalMap(mapDraft),
    selectLocalMap: (mapId) => getMapActions().selectLocalMap(mapId),
  };
}
