'use client';

import { useId, useMemo, useRef, useState } from 'react';
import { buildTeamObserverModel } from '../_lib/teamObserverRuntime';
import { getActorTeamId } from '../_lib/teamRuntime';
import SimulationTeamObserverPanel from './SimulationTeamObserverPanel';
import { getRuleset } from '../../../utils/rulesets';
import { normalizeMatchMode } from '../_lib/matchRosterRuntime';
import { formatClock } from '../_lib/simulationFormattingRuntime';
import { extractActorNameFromLog } from '../_lib/simulationEngine';
import SimulationControlPanel from './SimulationControlPanel';
import SimulationLogPanel from './SimulationLogPanel';
import SimulationMatchStatusPanel from './SimulationMatchStatusPanel';
import SimulationMinimapPanel from './SimulationMinimapPanel';
import SimulationPregameRosterSetup from './SimulationPregameRosterSetup';
import SimulationPregameMapRulesSetup from './SimulationPregameMapRulesSetup';
import SimulationWorldSpawnToolbar from './SimulationWorldSpawnToolbar';

function getObserverActorId(actor) {
  return String(actor?._id || actor?.id || '');
}

function buildObserverTrackedActorIds(survivors, dead, selectedTeamId) {
  const actors = new Map();
  for (const actor of [
    ...(Array.isArray(dead) ? dead : []),
    ...(Array.isArray(survivors) ? survivors : []),
  ]) {
    const id = getObserverActorId(actor);
    if (id) actors.set(id, actor);
  }
  const teamIds = [...new Set([...actors.values()].map(getActorTeamId).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
  const teamId = teamIds.includes(selectedTeamId) ? selectedTeamId : teamIds[0] || '';
  return [...actors.values()]
    .filter((actor) => getActorTeamId(actor) === teamId)
    .map(getObserverActorId);
}

export default function SimulationMainStage({
  seedControl,
  replayMode,
  draftMode,
  evaluationMode,
  actionDisabled,
  activeMap,
  activeMapId,
  actorAvatarByName,
  applyCustomParticipantRoster,
  saveLocalCharacter,
  applyParticipantPresetToCurrent,
  aliveTeamCount,
  autoPlay,
  autoSpeed,
  assistCounts,
  characterSkillsEnabled,
  candidateSurvivors,
  closeUiModal,
  day,
  dead,
  doHyperloopJump,
  forbiddenAddedNow,
  forbiddenNow,
  guestMode,
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
  mapPreparation,
  matchSec,
  onLocalRulesChanged,
  removeLocalMap,
  onToggleDevTools,
  participantSelectionMode,
  phase,
  prevPhaseLogs,
  publicItems,
  runEvents,
  saveLocalMap,
  selectLocalMap,
  proceedPhaseGuarded,
  recentMoveTrails,
  recentPings,
  selectedCharId,
  setAutoPlay,
  setHyperloopDestId,
  setUiModal,
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
  const [observedTeamId, setObservedTeamId] = useState('');
  const [observerTab, setObserverTab] = useState('team');
  const observerId = useId();
  const observerTabsRef = useRef({});
  const observerTabs = [{ id: 'team', label: '팀 관전' }, { id: 'match', label: '경기 현황' }, { id: 'logs', label: '전체 로그' }];
  const handleObserverTabKey = (event, index) => {
    let nextIndex;
    if (event.key === 'ArrowRight') nextIndex = (index + 1) % observerTabs.length;
    else if (event.key === 'ArrowLeft') nextIndex = (index + observerTabs.length - 1) % observerTabs.length;
    else if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = observerTabs.length - 1;
    else return;
    event.preventDefault();
    const nextId = observerTabs[nextIndex].id;
    setObserverTab(nextId);
    observerTabsRef.current[nextId]?.focus();
  };
  const observerTrackedActorIds = useMemo(
    () => buildObserverTrackedActorIds(survivors, dead, observedTeamId),
    [survivors, dead, observedTeamId]
  );
  const observerModel = useMemo(() => {
    if (observerTab !== 'team') return null;
    return buildTeamObserverModel({
      survivors, dead, events: runEvents, teamId: observedTeamId, matchSec,
      publicItems, killCounts, assistCounts, isGameOver, zoneName: getZoneName,
      spawnState, forbiddenIds: forbiddenNow, settings, day, phase,
    });
  }, [observerTab, survivors, dead, runEvents, observedTeamId, matchSec, publicItems, killCounts, assistCounts, isGameOver, getZoneName, spawnState, forbiddenNow, settings, day, phase]);
  const battlefield = (
      <div className="simulation-stage">
        <div className="simulation-battlefield-column">
          {day > 0 ? <details className="simulation-field-details">
            <summary>필드 현황 · 자원·보스·야생동물</summary>
          <SimulationWorldSpawnToolbar
            activeMapId={activeMapId}
            day={day}
            spawnState={spawnState}
            zones={zones}
          />
          </details> : null}

          <SimulationMinimapPanel
            trackedActorIds={observerTrackedActorIds}
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
            openMap={() => setUiModal?.('map')}
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

        <aside className="simulation-side-column" aria-label="관전과 경기 기록">
          <div className="simulation-observer-tabs" role="tablist" aria-label="관전 정보">
            {observerTabs.map((option, index) => (
              <button key={option.id} type="button" role="tab" id={`${observerId}-${option.id}-tab`}
                ref={(node) => { observerTabsRef.current[option.id] = node; }}
                aria-selected={observerTab === option.id} aria-controls={`${observerId}-${option.id}-panel`}
                tabIndex={observerTab === option.id ? 0 : -1}
                onKeyDown={(event) => handleObserverTabKey(event, index)}
                onClick={() => setObserverTab(option.id)}>{option.label}</button>
            ))}
          </div>
          <div className="simulation-observer-slot" role="tabpanel" id={`${observerId}-team-panel`}
            aria-labelledby={`${observerId}-team-tab`} hidden={observerTab !== 'team'} tabIndex={0}>
            {observerTab === 'team'
              ? <SimulationTeamObserverPanel model={observerModel} onTeamChange={setObservedTeamId} isGameOver={isGameOver} />
              : null}
          </div>
          <div className="simulation-observer-slot" role="tabpanel" id={`${observerId}-match-panel`}
            aria-labelledby={`${observerId}-match-tab`} hidden={observerTab !== 'match'} tabIndex={0}>
            {observerTab === 'match' ? <SimulationMatchStatusPanel
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
            /> : null}
          </div>

          <div className="simulation-observer-log-slot" role="tabpanel" id={`${observerId}-logs-panel`}
            aria-labelledby={`${observerId}-logs-tab`} hidden={observerTab !== 'logs' && uiModal !== 'log'} tabIndex={0}>
          {observerTab === 'logs' || uiModal === 'log' ? <SimulationLogPanel
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
          /> : null}
          </div>
        </aside>
      </div>
  );
  const pregameSettings = <>
      {seedControl}
      {!replayMode && (!evaluationMode || draftMode) ? <SimulationPregameRosterSetup
        applyCustomParticipantRoster={applyCustomParticipantRoster}
        saveLocalCharacter={saveLocalCharacter}
        applyParticipantPresetToCurrent={applyParticipantPresetToCurrent}
        candidateSurvivors={candidateSurvivors}
        day={day}
        disabled={loading || isAdvancing || isGameOver}
        matchMode={normalizeMatchMode(settings?.matchMode)}
        matchSec={matchSec}
        participantSelectionMode={participantSelectionMode}
        survivors={survivors}
      /> : null}

      {!replayMode && (!evaluationMode || draftMode) ? <SimulationPregameMapRulesSetup
        key={`${String(activeMapId || 'none')}:${String(settings?.rulesetId || '')}`}
        activeMap={activeMap}
        activeMapId={activeMapId}
        day={day}
        disabled={loading || isAdvancing || isGameOver}
        guestMode={guestMode}
        maps={maps}
        matchSec={matchSec}
        onMapChange={selectLocalMap}
        onMapDelete={removeLocalMap}
        onMapSave={saveLocalMap}
        onRulesChanged={onLocalRulesChanged}
        settings={settings}
      /> : null}
  </>;
  return (
    <>
      <SimulationControlPanel
        mapPreparation={mapPreparation}
        settingsContent={pregameSettings}
        replayMode={replayMode}
        draftMode={draftMode}
        evaluationMode={evaluationMode}
        matchMode={normalizeMatchMode(settings?.matchMode)}
        onMatchModeChange={handleMatchModeChange}
        matchModeDisabled={replayMode || loading || isAdvancing || day !== 0}
        matchSec={matchSec}
        survivors={survivors}
        winnerPredictionId={winnerPredictionId}
        onWinnerPredictionChange={setWinnerPredictionId}
        winnerPredictionDisabled={loading || isAdvancing || isGameOver || day !== 0 || matchSec !== 0}
        characterSkillsEnabled={characterSkillsEnabled}
        onCharacterSkillsToggle={handleCharacterSkillsToggle}
        characterSkillsDisabled={replayMode || loading || isAdvancing || day !== 0}
        isGameOver={isGameOver}
        onRestart={() => window.location.reload()}
        onProceed={evaluationMode && !draftMode && day === 0
          ? () => setAutoPlay(true)
          : proceedPhaseGuarded}
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
        autoDisabled={Boolean(mapPreparation) || loading || isGameOver || startBlocked}
        autoSpeed={autoSpeed}
        onAutoSpeedChange={updateAutoSpeed}
        speedDisabled={Boolean(mapPreparation) || loading || isGameOver}
      />
      {battlefield}
    </>
  );
}
