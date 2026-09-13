import { useMemo, useReducer, useState } from 'react';
import { getDefaultSimulationSettings } from './simulationPageRuntime';
import { createInitialSimulationFrame, reduceSimulationFrame, SIMULATION_FRAME_FIELDS } from './simulationFrameRuntime';

export function useSimulationMatchState() {
  const [frame, dispatchFrame] = useReducer(reduceSimulationFrame, undefined, createInitialSimulationFrame);
  const frameActions = useMemo(() => ({
    ...Object.fromEntries(SIMULATION_FRAME_FIELDS.map((field) => [
      `set${field[0].toUpperCase()}${field.slice(1)}`,
      (value) => dispatchFrame({ type: 'field', field, value }),
    ])),
    setSimulationFrame: (value) => dispatchFrame({ type: 'publish', frame: value }),
  }), []);
  const [candidateSurvivors, setCandidateSurvivors] = useState([]);
  const [isGameOver, setIsGameOver] = useState(false);
  const [loading, setLoading] = useState(true);

  const [showResultModal, setShowResultModal] = useState(false);
  const [gameEndReason, setGameEndReason] = useState(null);
  const [winner, setWinner] = useState(null);
  const [winnerPredictionId, setWinnerPredictionId] = useState('');
  const [resultSummary, setResultSummary] = useState(null);

  const [settings, setSettings] = useState(getDefaultSimulationSettings);

  return {
    ...frame,
    ...frameActions,
    candidateSurvivors,
    gameEndReason,
    isGameOver,
    loading,
    resultSummary,
    setCandidateSurvivors,
    setGameEndReason,
    setIsGameOver,
    setLoading,
    setResultSummary,
    setSettings,
    setShowResultModal,
    setWinner,
    setWinnerPredictionId,
    settings,
    showResultModal,
    winner,
    winnerPredictionId,
  };
}
