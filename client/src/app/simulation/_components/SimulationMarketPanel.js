'use client';

import SimulationMarketConsumableCard from './SimulationMarketConsumableCard';
import SimulationMarketDebugDetailsPanel from './SimulationMarketDebugDetailsPanel';
import SimulationMarketDiagnosticsPanel from './SimulationMarketDiagnosticsPanel';
import SimulationMarketDevGrantCard from './SimulationMarketDevGrantCard';
import SimulationMarketEquipmentCard from './SimulationMarketEquipmentCard';
import SimulationMarketHeaderPanel from './SimulationMarketHeaderPanel';
import SimulationMarketPendingTranscendCard from './SimulationMarketPendingTranscendCard';
import SimulationMarketTabsPanel from './SimulationMarketTabsPanel';

export default function SimulationMarketPanel({
  acceptTradeOffer,
  activeViewerPerkBundle,
  addLog,
  applyParticipantPresetToCurrent,
  candidateSurvivors,
  cancelTradeOffer,
  createTradeOffer,
  craftables,
  credits,
  day,
  deleteSelectedParticipantPreset,
  devEventPreviewLimit,
  devForceUseConsumable,
  devGrantItemId,
  devGrantItemOptions,
  devGrantItemToSelected,
  devGrantQty,
  devGrantSearch,
  doCraft,
  doDroneBuy,
  doKioskTransaction,
  doPerkPurchase,
  droneOffers,
  exportBattleLog,
  fireAndReport,
  getQty,
  getZoneName,
  inventoryOptions,
  isAdvancing,
  isGameOver,
  itemNameById,
  kiosks,
  loadMarket,
  loadTrades,
  marketCardRenderLimit,
  marketMessage,
  marketTab,
  matchSec,
  myTradeOffers,
  ownedPerkCodeSet,
  participantPresetName,
  participantPresets,
  pendingTranscendPick,
  publicItems,
  publicPerks,
  resolvePendingTranscendPick,
  runActionSummary,
  runEvents,
  runEventsPreviewText,
  runProgressSummary,
  runSeed,
  runSupportSummary,
  saveCurrentParticipantPreset,
  saveSelectedParticipantPresetId,
  seedDraft,
  selectedChar,
  selectedCharId,
  selectedDevGrantItem,
  selectedParticipantPresetId,
  setDevGrantItemId,
  setDevGrantQty,
  setDevGrantSearch,
  setParticipantPresetName,
  setQty,
  setRunSeed,
  setSeedDraft,
  setEquipForSurvivor,
  setMarketTab,
  setShowAllMarketRows,
  setShowDevDebugDetails,
  setShowDevEventLog,
  setShowMarketPanel,
  setSelectedCharId,
  setTradeDraft,
  setTradeWantSearch,
  showAllMarketRows,
  showDevDebugDetails,
  showDevEventLog,
  showMarketPanel,
  simulationDiagnostics,
  simulationDiagnosticsLine,
  survivors,
  syncMyState,
  tradeDraft,
  tradeOffers,
  tradeWantItemOptions,
  tradeWantSearch,
  viewerLp,
  viewerPerks,
  visibleCraftables,
  visibleDevGrantItemOptions,
  visibleDroneOffers,
  visibleKiosks,
  visibleMyTradeOffers,
  visiblePublicPerks,
  visibleTradeOffers,
}) {
  if (!showMarketPanel) return null;

  const marketCardLimit = marketCardRenderLimit;
  const devEventLimit = devEventPreviewLimit;

  return (
    <aside className="market-panel">
      <SimulationMarketHeaderPanel
        addLog={addLog}
        applyParticipantPresetToCurrent={applyParticipantPresetToCurrent}
        candidateSurvivors={candidateSurvivors}
        day={day}
        deleteSelectedParticipantPreset={deleteSelectedParticipantPreset}
        devEventPreviewLimit={devEventLimit}
        exportBattleLog={exportBattleLog}
        isAdvancing={isAdvancing}
        isGameOver={isGameOver}
        marketCardRenderLimit={marketCardLimit}
        matchSec={matchSec}
        participantPresetName={participantPresetName}
        participantPresets={participantPresets}
        runEvents={runEvents}
        runEventsPreviewText={runEventsPreviewText}
        runProgressSummary={runProgressSummary}
        runSeed={runSeed}
        saveCurrentParticipantPreset={saveCurrentParticipantPreset}
        saveSelectedParticipantPresetId={saveSelectedParticipantPresetId}
        seedDraft={seedDraft}
        selectedChar={selectedChar}
        selectedCharId={selectedCharId}
        selectedParticipantPresetId={selectedParticipantPresetId}
        setParticipantPresetName={setParticipantPresetName}
        setRunSeed={setRunSeed}
        setSeedDraft={setSeedDraft}
        setSelectedCharId={setSelectedCharId}
        setShowAllMarketRows={setShowAllMarketRows}
        setShowDevDebugDetails={setShowDevDebugDetails}
        setShowDevEventLog={setShowDevEventLog}
        setShowMarketPanel={setShowMarketPanel}
        showAllMarketRows={showAllMarketRows}
        showDevDebugDetails={showDevDebugDetails}
        showDevEventLog={showDevEventLog}
        survivors={survivors}
      />

      <SimulationMarketDiagnosticsPanel
        runActionSummary={runActionSummary}
        runSupportSummary={runSupportSummary}
        simulationDiagnostics={simulationDiagnostics}
        simulationDiagnosticsLine={simulationDiagnosticsLine}
      />

      <SimulationMarketPendingTranscendCard
        getZoneName={getZoneName}
        isAdvancing={isAdvancing}
        isGameOver={isGameOver}
        pendingTranscendPick={pendingTranscendPick}
        publicItems={publicItems}
        resolvePendingTranscendPick={resolvePendingTranscendPick}
      />

      <SimulationMarketDevGrantCard
        devGrantItemId={devGrantItemId}
        devGrantItemOptions={devGrantItemOptions}
        devGrantItemToSelected={devGrantItemToSelected}
        devGrantQty={devGrantQty}
        devGrantSearch={devGrantSearch}
        isAdvancing={isAdvancing}
        isGameOver={isGameOver}
        selectedChar={selectedChar}
        selectedCharId={selectedCharId}
        selectedDevGrantItem={selectedDevGrantItem}
        setDevGrantItemId={setDevGrantItemId}
        setDevGrantQty={setDevGrantQty}
        setDevGrantSearch={setDevGrantSearch}
        visibleDevGrantItemOptions={visibleDevGrantItemOptions}
      />

      <SimulationMarketConsumableCard
        devForceUseConsumable={devForceUseConsumable}
        isAdvancing={isAdvancing}
        isGameOver={isGameOver}
        selectedChar={selectedChar}
        selectedCharId={selectedCharId}
      />

      <SimulationMarketDebugDetailsPanel
        runProgressSummary={runProgressSummary}
        selectedChar={selectedChar}
        selectedCharId={selectedCharId}
        showDevDebugDetails={showDevDebugDetails}
      />

      <SimulationMarketEquipmentCard
        isAdvancing={isAdvancing}
        isGameOver={isGameOver}
        selectedChar={selectedChar}
        selectedCharId={selectedCharId}
        setEquipForSurvivor={setEquipForSurvivor}
      />

      <SimulationMarketTabsPanel
        acceptTradeOffer={acceptTradeOffer}
        activeViewerPerkBundle={activeViewerPerkBundle}
        cancelTradeOffer={cancelTradeOffer}
        craftables={craftables}
        createTradeOffer={createTradeOffer}
        credits={credits}
        doCraft={doCraft}
        doDroneBuy={doDroneBuy}
        doKioskTransaction={doKioskTransaction}
        doPerkPurchase={doPerkPurchase}
        droneOffers={droneOffers}
        fireAndReport={fireAndReport}
        getQty={getQty}
        inventoryOptions={inventoryOptions}
        itemNameById={itemNameById}
        kiosks={kiosks}
        loadMarket={loadMarket}
        loadTrades={loadTrades}
        marketCardRenderLimit={marketCardLimit}
        marketMessage={marketMessage}
        marketTab={marketTab}
        myTradeOffers={myTradeOffers}
        ownedPerkCodeSet={ownedPerkCodeSet}
        publicItems={publicItems}
        publicPerks={publicPerks}
        selectedCharId={selectedCharId}
        setMarketTab={setMarketTab}
        setQty={setQty}
        setShowAllMarketRows={setShowAllMarketRows}
        setTradeDraft={setTradeDraft}
        setTradeWantSearch={setTradeWantSearch}
        showAllMarketRows={showAllMarketRows}
        syncMyState={syncMyState}
        tradeDraft={tradeDraft}
        tradeOffers={tradeOffers}
        tradeWantItemOptions={tradeWantItemOptions}
        tradeWantSearch={tradeWantSearch}
        viewerLp={viewerLp}
        viewerPerks={viewerPerks}
        visibleCraftables={visibleCraftables}
        visibleDroneOffers={visibleDroneOffers}
        visibleKiosks={visibleKiosks}
        visibleMyTradeOffers={visibleMyTradeOffers}
        visiblePublicPerks={visiblePublicPerks}
        visibleTradeOffers={visibleTradeOffers}
      />
    </aside>
  );
}
