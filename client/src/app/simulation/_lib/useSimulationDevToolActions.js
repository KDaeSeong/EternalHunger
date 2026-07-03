import { createDevToolActionRuntime } from './devToolActionRuntime';

export function useSimulationDevToolActions({
  actions = {},
  state = {},
} = {}) {
  const getDevToolActions = () => createDevToolActionRuntime({ state, actions });

  return {
    devForceUseConsumable: (charId, invIndex) => getDevToolActions().devForceUseConsumable(charId, invIndex),
    resolvePendingTranscendPick: (optionIndex, method = 'manual') => (
      getDevToolActions().resolvePendingTranscendPick(optionIndex, method)
    ),
    setEquipForSurvivor: (survivorId, slot, itemIdOrNull) => (
      getDevToolActions().setEquipForSurvivor(survivorId, slot, itemIdOrNull)
    ),
  };
}
