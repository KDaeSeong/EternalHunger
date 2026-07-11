function counter(state, key) {
  return Number(state?.counters?.[key] || 0);
}

export function tonkatsuResultCue(previous, next) {
  if (!previous || !next || previous.runId !== next.runId) return '';

  if (counter(next, 'battles') > counter(previous, 'battles')) {
    return counter(next, 'victories') > counter(previous, 'victories') ? 'victory' : 'defeat';
  }

  if (counter(next, 'tournaments') > counter(previous, 'tournaments')) {
    return counter(next, 'tournamentWins') > counter(previous, 'tournamentWins') ? 'champion' : 'defeat';
  }

  const judgeAttempts = counter(next, 'judgeMatches') - counter(previous, 'judgeMatches');
  if (judgeAttempts > 0) {
    const judgeCorrect = counter(next, 'judgeCorrect') - counter(previous, 'judgeCorrect');
    return judgeCorrect / judgeAttempts >= 0.5 ? 'judgeCorrect' : 'judgeWrong';
  }

  if (!previous.ended && next.ended) return 'complete';
  return '';
}
