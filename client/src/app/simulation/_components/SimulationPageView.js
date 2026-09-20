'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import SiteHeader from '../../../components/SiteHeader';
import { useGameBgm } from '../../games/_components/GameBgmProvider';
import { useGameSfxEventHandlers } from '../../games/_lib/useGameSfx';
import { getTimeOfDayFromPhase } from '../_lib/simulationEngine';
import {
  ETERNAL_HUNGER_BGM_SCENES,
  eternalHungerEventMusic,
  resolveEternalHungerBgmScene,
} from '../_lib/eternalHungerSoundtrack';
import {
  createSimulationFeedbackSnapshot,
  getSimulationFeedbackDisplay,
  getSimulationFeedbackPresentation,
} from '../_lib/simulationFeedbackRuntime';
import SimulationGameScreen from './SimulationGameScreen';
import SimulationMarketPanel from './SimulationMarketPanel';
import SimulationResultModal from './SimulationResultModal';
import SimulationSurvivorBoard from './SimulationSurvivorBoard';
import SimulationReplayHistory from './SimulationReplayHistory';
import SimulationObserverPerformancePanel from './SimulationObserverPerformancePanel';

const SIMULATION_SFX_STORAGE_KEY = 'eternal-hunger:simulation-sfx';

function initialSfxEnabled() {
  if (typeof window === 'undefined') return true;
  try {
    return window.localStorage.getItem(SIMULATION_SFX_STORAGE_KEY) !== 'off';
  } catch {
    return true;
  }
}

function SimulationEvaluationBrief({
  evaluationCode,
  evaluationSeed,
  draftMode,
  replayMode,
  isGameOver,
}) {
  const modeText = draftMode
    ? '변경 경기: 기준 경기에서 한 조건만 바꾸고 차이를 관찰하세요.'
    : replayMode
      ? '동일 재경기: 기준 경기와 사건·결과가 같은지 관찰하세요.'
      : '기준 경기: 설정을 바꾸지 말고 팀의 파밍·합류·교전·후퇴를 관찰하세요.';
  return (
    <details className="sim-evaluation-brief" aria-label="이터널 헝거 5분 평가 안내">
      <summary>
        <strong>이터널 헝거 · 5분 평가</strong>
        <span className="sim-evaluation-brief__mode">{modeText}</span>
        <span className="sim-evaluation-brief__meta">{evaluationCode} · 시드 {evaluationSeed}</span>
        <span className="sim-evaluation-brief__toggle">평가 안내</span>
      </summary>
      <div className="sim-evaluation-brief__body">
        <dl>
          <div><dt>진행</dt><dd>{isGameOver ? '완주 · 설문 작성 가능' : '평가 시작 한 번 · x32 자동 관전'}</dd></div>
          <div><dt>회수</dt><dd>완료 뒤 JSON 복사 또는 다운로드</dd></div>
        </dl>
        <ol>
          <li>지도와 팀 관전·경기 현황 중 두 곳 이상을 보세요.</li>
          <li>선택한 팀의 파밍·합류·교전·후퇴 이유를 자신의 말로 설명해 보세요.</li>
          <li>결과 화면의 ‘5분 평가 작성’에서 관찰한 항목만 기록하세요.</li>
        </ol>
        <p className="sim-evaluation-privacy">로그인하지 않으며 계정 전적·LP·크레딧을 바꾸지 않습니다. 평가 결과도 자동 전송하지 않습니다.</p>
      </div>
    </details>
  );
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
    draftMode,
    evaluationCode,
    evaluationMode,
    evaluationSeed,
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
  const [evaluationOpenRequest, setEvaluationOpenRequest] = useState(0);
  const previousFeedbackRef = useRef(null);
  const combatMusicTimerRef = useRef(null);
  const { setMusicScene } = useGameBgm();
  const {
    handleGameSfxChangeCapture,
    handleGameSfxPointerDownCapture,
    playGameSfx,
  } = useGameSfxEventHandlers({ enabled: sfxEnabled, theme: 'eternal', volume: 0.18 });
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
  const baseMusicScene = useMemo(() => resolveEternalHungerBgmScene({
    day,
    phase,
    isGameOver,
    hasWinner: Boolean(winner),
    survivorCount: Array.isArray(survivors) ? survivors.length : 0,
  }), [day, isGameOver, phase, survivors, winner]);

  useEffect(() => {
    if (combatMusicTimerRef.current) window.clearTimeout(combatMusicTimerRef.current);
    combatMusicTimerRef.current = null;
    setMusicScene(baseMusicScene);
  }, [baseMusicScene, setMusicScene]);

  useEffect(() => {
    const previous = previousFeedbackRef.current;
    previousFeedbackRef.current = feedbackSnapshot;
    const presentation = getSimulationFeedbackPresentation(previous, feedbackSnapshot);
    if (presentation?.cue) playGameSfx(presentation.cue);
    const eventMusic = eternalHungerEventMusic(presentation);
    const canUseEventTrack = ![
      ETERNAL_HUNGER_BGM_SCENES.final,
      ETERNAL_HUNGER_BGM_SCENES.result,
      ETERNAL_HUNGER_BGM_SCENES.defeat,
    ].includes(baseMusicScene);
    if (eventMusic && canUseEventTrack) {
      if (combatMusicTimerRef.current) window.clearTimeout(combatMusicTimerRef.current);
      setMusicScene(eventMusic.theme);
      combatMusicTimerRef.current = window.setTimeout(() => {
        setMusicScene(baseMusicScene);
        combatMusicTimerRef.current = null;
      }, eventMusic.durationMs);
    }
  }, [baseMusicScene, feedbackSnapshot, playGameSfx, setMusicScene]);

  useEffect(() => () => {
    if (combatMusicTimerRef.current) window.clearTimeout(combatMusicTimerRef.current);
    setMusicScene('');
  }, [setMusicScene]);

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

  const openEvaluation = useCallback(() => {
    setShowResultModal(false);
    setEvaluationOpenRequest((current) => current + 1);
  }, [setShowResultModal]);

  return (
    <main
      className={`simulation-page${evaluationMode ? ' simulation-page--evaluation' : ''}`}
      data-evaluation-mode={evaluationMode ? 'true' : 'false'}
      data-game-sfx-enabled={sfxEnabled ? 'true' : 'false'}
      onChangeCapture={handleGameSfxChangeCapture}
      onPointerDownCapture={handleGameSfxPointerDownCapture}
    >
      {evaluationMode ? <SimulationEvaluationBrief
        evaluationCode={evaluationCode}
        evaluationSeed={evaluationSeed}
        draftMode={draftMode}
        replayMode={props.replayMode}
        isGameOver={isGameOver}
      /> : <SiteHeader className="simulation-site-header" />}
      <SimulationReplayHistory disabled={props.loading || props.isAdvancing || (day > 0 && !isGameOver)}
        onReplay={props.onReplay} onVariant={props.onVariant} replayMode={props.replayMode} draftMode={props.draftMode}
        evaluationMode={evaluationMode} evaluationCode={evaluationCode}
        evaluationRunRecord={props.currentReplayRecord} evaluationOpenRequest={evaluationOpenRequest} />
      {!evaluationMode ? <SimulationObserverPerformancePanel /> : null}

      {uiModal ? (
        <div
          className="eh-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeUiModal();
          }}
        />
      ) : null}

      <div className={`simulation-container modal-layout ${showMarketPanel ? 'devtools-open' : ''}`}>
        {uiModal === 'chars' ? <SimulationSurvivorBoard
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
        /> : null}

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
        runProgressSummary={props.runProgressSummary}
        objectiveSummary={objectiveSummary}
        topRankedCharacters={topRankedCharacters}
        killCounts={killCounts}
        assistCounts={assistCounts}
        onExportBattleLog={exportBattleLog}
        replayStatus={props.replayStatus}
        canReplayCurrent={props.canReplayCurrent}
        onReplayCurrent={props.onReplayCurrent}
        onRetryReplaySave={props.onRetryReplaySave}
        canVariantCurrent={props.canVariantCurrent}
        onVariantCurrent={props.onVariantCurrent}
        evaluationMode={evaluationMode}
        canOpenEvaluation={Boolean(props.currentReplayRecord)}
        onOpenEvaluation={openEvaluation}
        onClose={() => setShowResultModal(false)}
      />
    </main>
  );
}
