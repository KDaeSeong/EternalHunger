'use client';

import { getRuleset } from '../../../utils/rulesets';
import { normalizeMatchMode } from '../_lib/matchRosterRuntime';
import { formatClock } from '../_lib/simulationFormattingRuntime';
import { extractActorNameFromLog } from '../_lib/simulationEngine';
import SimulationControlPanel from './SimulationControlPanel';
import SimulationLogPanel from './SimulationLogPanel';
import SimulationMatchStatusPanel from './SimulationMatchStatusPanel';
import SimulationMinimapPanel from './SimulationMinimapPanel';
import SimulationPregameRosterSetup from './SimulationPregameRosterSetup';
import SimulationWorldSpawnToolbar from './SimulationWorldSpawnToolbar';

export default function SimulationMainStage({
  actionDisabled,
  activeMap,
  activeMapId,
  actorAvatarByName,
  applyCustomParticipantRoster,
  applyParticipantPresetToCurrent,
  aliveTeamCount,
  autoPlay,
  autoSpeed,
  characterSkillsEnabled,
  candidateSurvivors,
  closeUiModal,
  day,
  dead,
  doHyperloopJump,
  forbiddenAddedNow,
  forbiddenNow,
  getTeamStateForActor,
  getZoneName,
  handleCharacterSkillsToggle,
  handleMatchModeChange,
  hyperloopCharId,
  hyperloopDestId,
  hyperloopDestIds,
  hyperloopPadName,
  hyperloopPadZoneId,
  hyperloopZoneSet,
  isAdvancing,
  isGameOver,
  isSelectedCharOnHyperloopPad,
  killCounts,
  loading,
  logBoxMaxH,
  logBoxRef,
  logWindowRef,
  logs,
  maps,
  matchSec,
  onToggleDevTools,
  participantSelectionMode,
  phase,
  prevPhaseLogs,
  proceedPhaseGuarded,
  recentMoveTrails,
  recentPings,
  selectedCharId,
  setAutoPlay,
  setHyperloopDestId,
  setWinnerPredictionId,
  setShowDetailedLogs,
  setShowPrevLogs,
  settings,
  showDetailedLogs,
  showMarketPanel,
  showPrevLogs,
  spawnState,
  startBlocked,
  startBlockedText,
  survivors,
  uiModal,
  updateAutoSpeed,
  winnerPredictionId,
  zones,
  zoneEdges,
  zonePos,
}) {
  return (
    <>
      <div className="simulation-stage">
        <div className="simulation-battlefield-column">
          <SimulationWorldSpawnToolbar
            activeMapId={activeMapId}
            day={day}
            spawnState={spawnState}
            zones={zones}
          />

          <SimulationMinimapPanel
            activeMapId={activeMapId}
            closeUiModal={closeUiModal}
            day={day}
            dead={dead}
            doHyperloopJump={doHyperloopJump}
            forbiddenNow={forbiddenNow}
            getTeamStateForActor={getTeamStateForActor}
            getZoneName={getZoneName}
            hyperloopCharId={hyperloopCharId}
            hyperloopDestId={hyperloopDestId}
            hyperloopDestIds={hyperloopDestIds}
            hyperloopPadName={hyperloopPadName}
            hyperloopPadZoneId={hyperloopPadZoneId}
            hyperloopZoneSet={hyperloopZoneSet}
            isAdvancing={isAdvancing}
            isGameOver={isGameOver}
            isSelectedCharOnHyperloopPad={isSelectedCharOnHyperloopPad}
            loading={loading}
            maps={maps}
            recentMoveTrails={recentMoveTrails}
            recentPings={recentPings}
            selectedCharId={selectedCharId}
            setHyperloopDestId={setHyperloopDestId}
            survivors={survivors}
            uiModal={uiModal}
            zones={zones}
            zoneEdges={zoneEdges}
            zonePos={zonePos}
          />
        </div>

        <aside className="simulation-side-column" aria-label="Simulation status and logs">
          <SimulationMatchStatusPanel
            day={day}
            phase={phase}
            matchSec={formatClock(matchSec)}
            survivors={survivors}
            dead={dead}
            killCounts={killCounts}
            activeMap={activeMap}
            zones={zones}
            forbiddenNow={forbiddenNow}
            spawnState={spawnState}
            getZoneName={getZoneName}
          />

          <SimulationLogPanel
            uiModal={uiModal}
            closeUiModal={closeUiModal}
            day={day}
            activeMap={activeMap}
            zones={zones}
            forbiddenNow={forbiddenNow}
            forbiddenAddedNow={forbiddenAddedNow}
            settings={settings}
            getRuleset={getRuleset}
            getZoneName={getZoneName}
            prevPhaseLogs={prevPhaseLogs}
            showPrevLogs={showPrevLogs}
            setShowPrevLogs={setShowPrevLogs}
            logs={logs}
            showDetailedLogs={showDetailedLogs}
            setShowDetailedLogs={setShowDetailedLogs}
            logWindowRef={logWindowRef}
            logBoxRef={logBoxRef}
            logBoxMaxH={logBoxMaxH}
            actorAvatarByName={actorAvatarByName}
            extractActorNameFromLog={extractActorNameFromLog}
          />
        </aside>
      </div>

      <SimulationPregameRosterSetup
        applyCustomParticipantRoster={applyCustomParticipantRoster}
        applyParticipantPresetToCurrent={applyParticipantPresetToCurrent}
        candidateSurvivors={candidateSurvivors}
        day={day}
        disabled={loading || isAdvancing || isGameOver}
        matchMode={normalizeMatchMode(settings?.matchMode)}
        matchSec={matchSec}
        participantSelectionMode={participantSelectionMode}
        survivors={survivors}
      />

      <SimulationControlPanel
        matchMode={normalizeMatchMode(settings?.matchMode)}
        onMatchModeChange={handleMatchModeChange}
        matchModeDisabled={loading || isAdvancing || day !== 0}
        matchSec={matchSec}
        survivors={survivors}
        winnerPredictionId={winnerPredictionId}
        onWinnerPredictionChange={setWinnerPredictionId}
        winnerPredictionDisabled={loading || isAdvancing || isGameOver || day !== 0 || matchSec !== 0}
        characterSkillsEnabled={characterSkillsEnabled}
        onCharacterSkillsToggle={handleCharacterSkillsToggle}
        characterSkillsDisabled={loading || isAdvancing}
        isGameOver={isGameOver}
        onRestart={() => window.location.reload()}
        onProceed={proceedPhaseGuarded}
        actionDisabled={actionDisabled}
        loading={loading}
        isAdvancing={isAdvancing}
        startBlocked={startBlocked}
        startBlockedText={startBlockedText}
        day={day}
        phase={phase}
        aliveTeamCount={aliveTeamCount}
        showMarketPanel={showMarketPanel}
        onToggleDevTools={onToggleDevTools}
        autoPlay={autoPlay}
        onToggleAutoPlay={() => setAutoPlay((v) => !v)}
        autoDisabled={loading || isGameOver || startBlocked}
        autoSpeed={autoSpeed}
        onAutoSpeedChange={updateAutoSpeed}
        speedDisabled={loading || isGameOver}
      />
    </>
  );
}
