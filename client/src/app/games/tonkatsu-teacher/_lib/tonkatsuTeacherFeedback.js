function counter(state, key) {
  return Number(state?.counters?.[key] || 0);
}

export const TONKATSU_METHOD_CUES = {
  m_fry: 'fry',
  m_grill: 'grill',
  m_boil: 'boil',
  m_simmer: 'simmer',
  m_sauce: 'sauce',
  m_dessert: 'dessert',
};

function craftSerial(state) {
  return Number(state?.lastCraft?.serial || 0);
}

export function tonkatsuResultCue(previous, next) {
  if (!previous || !next || previous.runId !== next.runId) return '';

  if (craftSerial(next) > craftSerial(previous)) {
    if (next.lastCraft?.masteryRaised?.length) return 'methodLevelUp';
    if (!next.lastCraft?.success) return 'cookFail';
    return TONKATSU_METHOD_CUES[next.lastCraft?.primaryMethodId] || 'cook';
  }

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
