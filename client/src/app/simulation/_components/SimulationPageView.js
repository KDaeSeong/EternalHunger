'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import SiteHeader from '../../../components/SiteHeader';
import { useGameSfxEventHandlers } from '../../games/_lib/useGameSfx';
import { getTimeOfDayFromPhase } from '../_lib/simulationEngine';
import {
  createSimulationFeedbackSnapshot,
  getSimulationFeedbackDisplay,
  getSimulationFeedbackPresentation,
} from '../_lib/simulationFeedbackRuntime';
import SimulationGameScreen from './SimulationGameScreen';
import SimulationMarketPanel from './SimulationMarketPanel';
import SimulationResultModal from './SimulationResultModal';
import SimulationSurvivorBoard from './SimulationSurvivorBoard';

const SIMULATION_SFX_STORAGE_KEY = 'eternal-hunger:simulation-sfx';

function initialSfxEnabled() {
  if (typeof window === 'undefined') return true;
  try {
    return window.localStorage.getItem(SIMULATION_SFX_STORAGE_KEY) !== 'off';
  } catch {
    return true;
  }
}

export default function SimulationPageView(props) {
  const {
    activeMap,
    assistCounts,
    autoPlay,
    closeUiModal,
    creditSourceSummary,
    day,
    dead,
    exportBattleLog,
    forbiddenNow,
    forbiddenAddedNow,
    gainDetailSummary,
    gainSourceSummary,
    gameEndReason,
    getTeamStateForActor,
    getZoneName,
    killCounts,
    objectiveSummary,
    phase,
    resultSummary,
    runActionSummary,
    runSupportSummary,
    setShowResultModal,
    settings,
    isGameOver,
    logs,
    showMarketPanel,
    showResultModal,
    specialSourceSummary,
    survivors,
    topRankedCharacters,
    uiModal,
    winner,
    zones,
  } = props;
  const timeOfDay = getTimeOfDayFromPhase(phase);
  const [sfxEnabled, setSfxEnabled] = useState(initialSfxEnabled);
  const previousFeedbackRef = useRef(null);
  const {
    handleGameSfxChangeCapture,
    handleGameSfxPointerDownCapture,
    playGameSfx,
  } = useGameSfxEventHandlers({ enabled: sfxEnabled, theme: 'battle', volume: 0.18 });
  const feedbackSnapshot = useMemo(() => createSimulationFeedbackSnapshot({
    autoPlay,
    day,
    dead,
    forbiddenAddedNow,
    isGameOver,
    logs,
    phase,
    winner,
  }), [autoPlay, day, dead, forbiddenAddedNow, isGameOver, logs, phase, winner]);
  const eventFeedback = useMemo(
    () => getSimulationFeedbackDisplay(feedbackSnapshot),
    [feedbackSnapshot],
  );

  useEffect(() => {
    const previous = previousFeedbackRef.current;
    previousFeedbackRef.current = feedbackSnapshot;
    const presentation = getSimulationFeedbackPresentation(previous, feedbackSnapshot);
    if (presentation?.cue) playGameSfx(presentation.cue);
  }, [feedbackSnapshot, playGameSfx]);

  const toggleSfx = useCallback(() => {
    setSfxEnabled((current) => {
      const next = !current;
      try {
        window.localStorage.setItem(SIMULATION_SFX_STORAGE_KEY, next ? 'on' : 'off');
      } catch {
        // Storage availability must not block the in-session sound toggle.
      }
      return next;
    });
  }, []);

  return (
    <main
      className="simulation-page"
      data-game-sfx-enabled={sfxEnabled ? 'true' : 'false'}
      onChangeCapture={handleGameSfxChangeCapture}
      onPointerDownCapture={handleGameSfxPointerDownCapture}
    >
      <SiteHeader className="simulation-site-header" />

      {uiModal ? (
        <div
          className="eh-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeUiModal();
          }}
        />
      ) : null}

      <div className={`simulation-container modal-layout ${showMarketPanel ? 'devtools-open' : ''}`}>
        <SimulationSurvivorBoard
          activeMap={activeMap}
          closeUiModal={closeUiModal}
          day={day}
          dead={dead}
          forbiddenNow={forbiddenNow}
          getTeamStateForActor={getTeamStateForActor}
          getZoneName={getZoneName}
          killCounts={killCounts}
          phase={phase}
          settings={settings}
          survivors={survivors}
          timeOfDay={timeOfDay}
          uiModal={uiModal}
          zones={zones}
        />

        <SimulationGameScreen
          {...props}
          eventFeedback={eventFeedback}
          onToggleSfx={toggleSfx}
          sfxEnabled={sfxEnabled}
        />

        <SimulationMarketPanel {...props} />
      </div>

      <SimulationResultModal
        open={showResultModal}
        gameEndReason={gameEndReason}
        winner={winner}
        resultSummary={resultSummary}
        specialSourceSummary={specialSourceSummary}
        gainSourceSummary={gainSourceSummary}
        creditSourceSummary={creditSourceSummary}
        gainDetailSummary={gainDetailSummary}
        runSupportSummary={runSupportSummary}
        runActionSummary={runActionSummary}
        objectiveSummary={objectiveSummary}
        topRankedCharacters={topRankedCharacters}
        killCounts={killCounts}
        assistCounts={assistCounts}
        onExportBattleLog={exportBattleLog}
        onClose={() => setShowResultModal(false)}
      />
    </main>
  );
}
