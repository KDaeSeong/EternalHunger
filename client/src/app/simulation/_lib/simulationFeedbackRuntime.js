function listLength(value) {
  if (Array.isArray(value)) return value.length;
  if (value instanceof Set) return value.size;
  return 0;
}

function listSignature(value) {
  const rows = value instanceof Set ? Array.from(value) : Array.isArray(value) ? value : [];
  return rows
    .map((entry) => String(entry?._id || entry?.id || entry || '').trim())
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b))
    .join('|');
}

export function createSimulationFeedbackSnapshot({
  autoPlay,
  day,
  dead,
  forbiddenAddedNow,
  isGameOver,
  phase,
  winner,
}) {
  return {
    autoPlay: Boolean(autoPlay),
    day: Math.max(0, Number(day || 0)),
    deadCount: listLength(dead),
    forbiddenSignature: listSignature(forbiddenAddedNow),
    gameOver: Boolean(isGameOver),
    hasWinner: Boolean(winner),
    phase: String(phase || ''),
  };
}

export function getSimulationFeedbackCue(previous, current) {
  if (!previous || !current) return '';
  if (current.day === 0 && previous.day > 0) return '';

  if (!previous.gameOver && current.gameOver) {
    return current.hasWinner ? 'victory' : 'defeat';
  }
  if (current.deadCount > previous.deadCount) return 'elimination';
  if (current.deadCount < previous.deadCount) return 'revive';
  if (
    current.forbiddenSignature
    && current.forbiddenSignature !== previous.forbiddenSignature
  ) return 'zoneLock';

  const phaseChanged = current.day !== previous.day || current.phase !== previous.phase;
  if (!current.autoPlay && current.day > 0 && phaseChanged) {
    return current.phase === 'morning' ? 'phaseDay' : 'phaseNight';
  }
  return '';
}
