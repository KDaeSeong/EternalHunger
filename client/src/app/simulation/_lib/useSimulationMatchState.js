import { useState } from 'react';
import { getDefaultSimulationSettings } from './simulationPageRuntime';

export function useSimulationMatchState() {
  const [survivors, setSurvivors] = useState([]);
  const [candidateSurvivors, setCandidateSurvivors] = useState([]);
  const [dead, setDead] = useState([]);
  const [forbiddenAddedNow, setForbiddenAddedNow] = useState([]);

  const [day, setDay] = useState(0);
  const [phase, setPhase] = useState('night');
  const [matchSec, setMatchSec] = useState(0);
  const [isGameOver, setIsGameOver] = useState(false);
  const [loading, setLoading] = useState(true);

  const [killCounts, setKillCounts] = useState({});
  const [assistCounts, setAssistCounts] = useState({});
  const [showResultModal, setShowResultModal] = useState(false);
  const [gameEndReason, setGameEndReason] = useState(null);
  const [winner, setWinner] = useState(null);
  const [winnerPredictionId, setWinnerPredictionId] = useState('');
  const [resultSummary, setResultSummary] = useState(null);

  const [settings, setSettings] = useState(getDefaultSimulationSettings);

  return {
    assistCounts,
    candidateSurvivors,
    day,
    dead,
    forbiddenAddedNow,
    gameEndReason,
    isGameOver,
    killCounts,
    loading,
    matchSec,
    phase,
    resultSummary,
    setAssistCounts,
    setCandidateSurvivors,
    setDay,
    setDead,
    setForbiddenAddedNow,
    setGameEndReason,
    setIsGameOver,
    setKillCounts,
    setLoading,
    setMatchSec,
    setPhase,
    setResultSummary,
    setSettings,
    setShowResultModal,
    setSurvivors,
    setWinner,
    setWinnerPredictionId,
    settings,
    showResultModal,
    survivors,
    winner,
    winnerPredictionId,
  };
}
