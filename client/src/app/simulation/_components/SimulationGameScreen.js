'use client';

import {
  getAliveTeams,
  getTimeOfDayFromPhase,
} from '../_lib/simulationEngine';
import SimulationForbiddenStatusBar from './SimulationForbiddenStatusBar';
import SimulationEventFeedbackBar from './SimulationEventFeedbackBar';
import SimulationMainStage from './SimulationMainStage';
import SimulationScreenHeader from './SimulationScreenHeader';

function getPrimaryProceedLabel({
  aliveTeamCount,
  day,
  isAdvancing,
  isGameOver,
  loading,
  phase,
  startBlocked,
  startBlockedText,
}) {
  if (loading) return '로딩 중...';
  if (isAdvancing) return '진행 중...';
  if (startBlocked) return startBlockedText || '시작 조건 부족';
  if (isGameOver) return '다시 하기';
  if (day === 0) return '게임 시작';
  if (aliveTeamCount <= 1) return '결과 확인';
  if (phase === 'morning') return day >= 6 ? '서든데스' : '밤 진행';
  return day >= 6 ? '서든데스' : '낮 진행';
}

export default function SimulationGameScreen({
  activeMap,
  activeMapId,
  actorAvatarByName,
  autoPlay,
  autoSpeed,
  characterSkillsEnabled,
  closeUiModal,
  day,
  dead,
  detonationRiskSummary,
  doHyperloopJump,
  eventFeedback,
  fireAndReport,
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
  isRefreshingMapSettings,
  isSelectedCharOnHyperloopPad,
  killCounts,
  loading,
  logBoxMaxH,
  logBoxRef,
  logWindowRef,
  logs,
  mapRefreshToast,
  maps,
  matchSec,
  onToggleSfx,
  onToggleDevTools = () => {},
  pendingTranscendPick,
  phase,
  prevPhaseLogs,
  proceedPhaseGuarded,
  recentMoveTrails,
  recentPings,
  refreshMapSettingsFromServer,
  selectedCharId,
  setAutoPlay,
  setHyperloopDestId,
  setShowDetailedLogs,
  setShowPrevLogs,
  setUiModal,
  settings,
  sfxEnabled,
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
  setWinnerPredictionId,
  zones,
  zoneEdges,
  zonePos,
}) {
  const timeOfDay = getTimeOfDayFromPhase(phase);
  const aliveTeamCount = getAliveTeams(survivors).length;
  const actionDisabled = loading || isAdvancing || startBlocked || (showMarketPanel && !!pendingTranscendPick);
  const primaryProceedLabel = getPrimaryProceedLabel({
    aliveTeamCount,
    day,
    isAdvancing,
    isGameOver,
    loading,
    phase,
    startBlocked,
    startBlockedText,
  });

  return (
    <section className={`game-screen ${phase === 'morning' ? 'morning-mode' : 'night-mode'}`}>
      <SimulationScreenHeader
        actionDisabled={actionDisabled}
        day={day}
        fireAndReport={fireAndReport}
        isAdvancing={isAdvancing}
        isGameOver={isGameOver}
        isRefreshingMapSettings={isRefreshingMapSettings}
        loading={loading}
        mapRefreshToast={mapRefreshToast}
        matchSec={matchSec}
        onProceed={proceedPhaseGuarded}
        onToggleSfx={onToggleSfx}
        onToggleDevTools={onToggleDevTools}
        primaryProceedLabel={primaryProceedLabel}
        refreshMapSettingsFromServer={refreshMapSettingsFromServer}
        setUiModal={setUiModal}
        showMarketPanel={showMarketPanel}
        sfxEnabled={sfxEnabled}
        startBlocked={startBlocked}
        startBlockedText={startBlockedText}
        timeOfDay={timeOfDay}
      />

      <SimulationForbiddenStatusBar
        detonationRiskSummary={detonationRiskSummary}
        forbiddenAddedNow={forbiddenAddedNow}
        getZoneName={getZoneName}
      />

      <SimulationEventFeedbackBar feedback={eventFeedback} />

      <SimulationMainStage
        actionDisabled={actionDisabled}
        activeMap={activeMap}
        activeMapId={activeMapId}
        actorAvatarByName={actorAvatarByName}
        aliveTeamCount={aliveTeamCount}
        autoPlay={autoPlay}
        autoSpeed={autoSpeed}
        characterSkillsEnabled={characterSkillsEnabled}
        closeUiModal={closeUiModal}
        day={day}
        dead={dead}
        doHyperloopJump={doHyperloopJump}
        forbiddenAddedNow={forbiddenAddedNow}
        forbiddenNow={forbiddenNow}
        getTeamStateForActor={getTeamStateForActor}
        getZoneName={getZoneName}
        handleCharacterSkillsToggle={handleCharacterSkillsToggle}
        handleMatchModeChange={handleMatchModeChange}
        hyperloopCharId={hyperloopCharId}
        hyperloopDestId={hyperloopDestId}
        hyperloopDestIds={hyperloopDestIds}
        hyperloopPadName={hyperloopPadName}
        hyperloopPadZoneId={hyperloopPadZoneId}
        hyperloopZoneSet={hyperloopZoneSet}
        isAdvancing={isAdvancing}
        isGameOver={isGameOver}
        isSelectedCharOnHyperloopPad={isSelectedCharOnHyperloopPad}
        killCounts={killCounts}
        loading={loading}
        logBoxMaxH={logBoxMaxH}
        logBoxRef={logBoxRef}
        logWindowRef={logWindowRef}
        logs={logs}
        maps={maps}
        matchSec={matchSec}
        onToggleDevTools={onToggleDevTools}
        phase={phase}
        prevPhaseLogs={prevPhaseLogs}
        proceedPhaseGuarded={proceedPhaseGuarded}
        recentMoveTrails={recentMoveTrails}
        recentPings={recentPings}
        selectedCharId={selectedCharId}
        setAutoPlay={setAutoPlay}
        setHyperloopDestId={setHyperloopDestId}
        setShowDetailedLogs={setShowDetailedLogs}
        setShowPrevLogs={setShowPrevLogs}
        setWinnerPredictionId={setWinnerPredictionId}
        settings={settings}
        showDetailedLogs={showDetailedLogs}
        showMarketPanel={showMarketPanel}
        showPrevLogs={showPrevLogs}
        spawnState={spawnState}
        startBlocked={startBlocked}
        startBlockedText={startBlockedText}
        survivors={survivors}
        uiModal={uiModal}
        updateAutoSpeed={updateAutoSpeed}
        winnerPredictionId={winnerPredictionId}
        zones={zones}
        zoneEdges={zoneEdges}
        zonePos={zonePos}
      />
    </section>
  );
}
