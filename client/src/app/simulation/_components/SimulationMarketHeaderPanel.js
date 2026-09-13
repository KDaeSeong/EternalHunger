'use client';

import GameActionIcon from '../../games/_components/GameActionIcon';
import SimulationMarketCharacterPicker from './SimulationMarketCharacterPicker';
import SimulationMarketEventLogCard from './SimulationMarketEventLogCard';
import SimulationMarketParticipantPresetCard from './SimulationMarketParticipantPresetCard';
import SimulationMarketRunSummaryCard from './SimulationMarketRunSummaryCard';
import SimulationMarketToolbar from './SimulationMarketToolbar';

export default function SimulationMarketHeaderPanel({
  addLog,
  applyParticipantPresetToCurrent,
  candidateSurvivors,
  day,
  deleteSelectedParticipantPreset,
  devEventPreviewLimit,
  exportBattleLog,
  isAdvancing,
  isGameOver,
  marketCardRenderLimit,
  matchSec,
  participantPresetName,
  participantPresets,
  runEvents,
  runEventsPreviewText,
  runProgressSummary,
  saveCurrentParticipantPreset,
  saveSelectedParticipantPresetId,
  selectedChar,
  selectedCharId,
  selectedParticipantPresetId,
  setParticipantPresetName,
  setSelectedCharId,
  setShowAllMarketRows,
  setShowDevDebugDetails,
  setShowDevEventLog,
  setShowMarketPanel,
  showAllMarketRows,
  showDevDebugDetails,
  showDevEventLog,
  survivors,
}) {
  return (
    <div className="market-header">
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
        <h2 style={{ margin: 0 }}>상점/조합/교환</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button className="market-close" type="button" data-game-sfx="click" onClick={() => setShowMarketPanel(false)} title="패널 닫기" aria-label="패널 닫기">
            <GameActionIcon action="close" label="패널 닫기" />
          </button>
        </div>
      </div>

      <SimulationMarketCharacterPicker
        selectedChar={selectedChar}
        selectedCharId={selectedCharId}
        setSelectedCharId={setSelectedCharId}
        survivors={survivors}
      />

      <SimulationMarketToolbar
        exportBattleLog={exportBattleLog}
        marketCardRenderLimit={marketCardRenderLimit}
        setShowAllMarketRows={setShowAllMarketRows}
        setShowDevDebugDetails={setShowDevDebugDetails}
        setShowDevEventLog={setShowDevEventLog}
        showAllMarketRows={showAllMarketRows}
        showDevDebugDetails={showDevDebugDetails}
        showDevEventLog={showDevEventLog}
      />

      <SimulationMarketParticipantPresetCard
        applyParticipantPresetToCurrent={applyParticipantPresetToCurrent}
        candidateSurvivors={candidateSurvivors}
        day={day}
        deleteSelectedParticipantPreset={deleteSelectedParticipantPreset}
        isAdvancing={isAdvancing}
        isGameOver={isGameOver}
        matchSec={matchSec}
        participantPresetName={participantPresetName}
        participantPresets={participantPresets}
        saveCurrentParticipantPreset={saveCurrentParticipantPreset}
        saveSelectedParticipantPresetId={saveSelectedParticipantPresetId}
        selectedParticipantPresetId={selectedParticipantPresetId}
        setParticipantPresetName={setParticipantPresetName}
        survivors={survivors}
      />

      <SimulationMarketEventLogCard
        addLog={addLog}
        devEventPreviewLimit={devEventPreviewLimit}
        runEvents={runEvents}
        runEventsPreviewText={runEventsPreviewText}
        showDevEventLog={showDevEventLog}
      />

      <SimulationMarketRunSummaryCard runProgressSummary={runProgressSummary} />
    </div>
  );
}
