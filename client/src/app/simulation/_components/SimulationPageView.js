'use client';

import SiteHeader from '../../../components/SiteHeader';
import { getTimeOfDayFromPhase } from '../_lib/simulationEngine';
import SimulationGameScreen from './SimulationGameScreen';
import SimulationMarketPanel from './SimulationMarketPanel';
import SimulationResultModal from './SimulationResultModal';
import SimulationSurvivorBoard from './SimulationSurvivorBoard';

export default function SimulationPageView(props) {
  const {
    activeMap,
    assistCounts,
    closeUiModal,
    creditSourceSummary,
    day,
    dead,
    exportBattleLog,
    forbiddenNow,
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

  return (
    <main className="simulation-page">
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

        <SimulationGameScreen {...props} />

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
