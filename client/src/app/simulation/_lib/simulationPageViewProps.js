function buildSimulationPageViewProps({
  constants = {},
  state = {},
  helpers = {},
  logs = {},
  settingsControls = {},
  uiModalState = {},
  marketState = {},
  devRunGuard = {},
  mapState = {},
  flowState = {},
  runSeedState = {},
  participantPresetState = {},
  phaseController = {},
  devToolActions = {},
  mapActions = {},
  marketActions = {},
  derivedData = {},
} = {}) {
  const { exportBattleLog, getZoneName, ...helperProps } = helpers;
  const { selectMarketTab } = marketState;
  const { handleDevToolsToggle } = devRunGuard;

  return {
    ...logs,
    ...settingsControls,
    ...uiModalState,
    ...marketState,
    ...mapState,
    ...flowState,
    ...runSeedState,
    ...participantPresetState,
    ...phaseController,
    ...devToolActions,
    ...mapActions,
    ...marketActions,
    ...derivedData,
    ...constants,
    ...state,
    ...helperProps,
    exportBattleLog,
    getZoneName,
    onToggleDevTools: handleDevToolsToggle,
    setMarketTab: selectMarketTab,
  };
}

export {
  buildSimulationPageViewProps,
};
