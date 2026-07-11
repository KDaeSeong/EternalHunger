function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function teamName(state, teamId, fallback = '') {
  return safeArray(state?.teams).find((team) => String(team?.id || '') === String(teamId || ''))?.name
    || fallback
    || String(teamId || '');
}

function fixtureRows(state) {
  return [
    ...safeArray(state?.fixtures).map((fixture) => ({ fixture, stage: 'REGULAR' })),
    ...safeArray(state?.postseasonFixtures).map((fixture) => ({ fixture, stage: 'POSTSEASON' })),
  ].map((row, order) => ({ ...row, order }));
}

function setWinnerProbability(result, setResult) {
  const pHome = Number.isFinite(Number(setResult?.probabilityHome)) ? Number(setResult.probabilityHome) : 50;
  if (String(setResult?.winnerTeamId || '') === String(result?.homeTeamId || '')) return pHome;
  if (String(setResult?.winnerTeamId || '') === String(result?.awayTeamId || '')) return 100 - pHome;
  return 50;
}

function latestPlayedMatch(state) {
  const row = fixtureRows(state)
    .filter(({ fixture }) => fixture?.played && fixture?.result)
    .sort((a, b) => (
      Number(b.fixture.result?.playedAt || 0) - Number(a.fixture.result?.playedAt || 0)
      || Number(b.fixture.round || 0) - Number(a.fixture.round || 0)
      || b.order - a.order
    ))[0];
  if (!row) return null;
  const { fixture, stage } = row;
  const result = fixture.result || {};
  const sets = safeArray(result.sets);
  const winnerTeamId = String(result.winnerTeamId || '');
  const firstWinnerTeamId = String(sets[0]?.winnerTeamId || '');
  const upsetSet = sets
    .filter((setResult) => String(setResult?.winnerTeamId || '') === winnerTeamId)
    .map((setResult) => ({ setResult, probability: setWinnerProbability(result, setResult) }))
    .sort((a, b) => a.probability - b.probability)[0];
  return {
    id: `${stage}-${fixture.id || result.matchId || result.playedAt || 'match'}`,
    stage,
    stageLabel: stage === 'POSTSEASON'
      ? String(fixture.label || '포스트시즌')
      : `${Number(fixture.round || result.round || 0)}주차`,
    homeTeamId: String(result.homeTeamId || fixture.homeTeamId || ''),
    awayTeamId: String(result.awayTeamId || fixture.awayTeamId || ''),
    homeTeamName: String(result.homeTeamName || teamName(state, result.homeTeamId || fixture.homeTeamId, '홈')),
    awayTeamName: String(result.awayTeamName || teamName(state, result.awayTeamId || fixture.awayTeamId, '원정')),
    winnerTeamId,
    winnerTeamName: teamName(
      state,
      winnerTeamId,
      winnerTeamId === String(result.homeTeamId || '') ? result.homeTeamName : result.awayTeamName,
    ),
    scoreHome: Math.max(0, Number(result.scoreHome || 0)),
    scoreAway: Math.max(0, Number(result.scoreAway || 0)),
    setCount: sets.length,
    hasAceSet: sets.some((setResult) => Boolean(setResult?.isAceSet)),
    comeback: sets.length >= 2 && Boolean(firstWinnerTeamId) && firstWinnerTeamId !== winnerTeamId,
    upset: Boolean(upsetSet && upsetSet.probability <= 42),
    upsetProbability: upsetSet ? Math.round(upsetSet.probability) : 50,
  };
}

export function starleagueFeedbackSnapshot(state) {
  const latestMatch = latestPlayedMatch(state);
  const personalMatches = safeArray(state?.personalLeague?.matches);
  const winnersSets = safeArray(state?.winnersLeague?.sets);
  return {
    runId: String(state?.runId || ''),
    seasonNo: Math.max(1, Number(state?.seasonNo || 1)),
    regularPlayed: fixtureRows(state).filter(({ fixture }) => fixture?.played).length,
    personalPlayed: personalMatches.filter((match) => match?.played).length,
    personalStage: String(state?.personalLeague?.stage || 'NOT_STARTED'),
    winnersPlayed: winnersSets.length,
    winnersStage: String(state?.winnersLeague?.stage || 'NOT_STARTED'),
    ended: Boolean(state?.ended),
    championTeamName: state?.championTeamId ? teamName(state, state.championTeamId, '우승팀') : '',
    latestMatchId: String(latestMatch?.id || ''),
    latestWinnerTeamId: String(latestMatch?.winnerTeamId || ''),
    latestHomeTeamId: String(latestMatch?.homeTeamId || ''),
    latestAwayTeamId: String(latestMatch?.awayTeamId || ''),
    latestHomeTeamName: String(latestMatch?.homeTeamName || ''),
    latestAwayTeamName: String(latestMatch?.awayTeamName || ''),
    latestWinnerTeamName: String(latestMatch?.winnerTeamName || ''),
    latestStageLabel: String(latestMatch?.stageLabel || ''),
    latestScoreHome: Math.max(0, Number(latestMatch?.scoreHome || 0)),
    latestScoreAway: Math.max(0, Number(latestMatch?.scoreAway || 0)),
    latestSetCount: Math.max(0, Number(latestMatch?.setCount || 0)),
    latestHasAceSet: Boolean(latestMatch?.hasAceSet),
    latestComeback: Boolean(latestMatch?.comeback),
    latestUpset: Boolean(latestMatch?.upset),
    latestUpsetProbability: Math.max(0, Number(latestMatch?.upsetProbability || 0)),
  };
}

function matchDetail(snapshot) {
  if (!snapshot.latestMatchId) return '다음 경기 결과를 기다리고 있습니다.';
  return [
    snapshot.latestStageLabel,
    `${snapshot.latestHomeTeamName} ${snapshot.latestScoreHome}:${snapshot.latestScoreAway} ${snapshot.latestAwayTeamName}`,
    `${snapshot.latestWinnerTeamName || '승리 팀'} 승`,
  ].filter(Boolean).join(' · ');
}

export function starleagueFeedbackPresentation(snapshot, selectedTeamId = '') {
  const teamId = String(selectedTeamId || '');
  if (snapshot?.ended) {
    return { action: 'champion', cue: 'champion', label: '시즌 챔피언 확정', tone: 'champion', detail: `시즌 정상 · ${snapshot.championTeamName || snapshot.latestWinnerTeamName || '우승팀'}` };
  }
  if (!snapshot?.latestMatchId) {
    return { action: 'signal', cue: '', label: '중계 대기', tone: 'ready', detail: matchDetail(snapshot || {}) };
  }
  const involved = teamId && [snapshot.latestHomeTeamId, snapshot.latestAwayTeamId].includes(teamId);
  if (involved) {
    const won = snapshot.latestWinnerTeamId === teamId;
    return { action: won ? 'victory' : 'defeat', cue: won ? 'victory' : 'defeat', label: won ? '응원팀 승리' : '응원팀 패배', tone: won ? 'success' : 'danger', detail: matchDetail(snapshot) };
  }
  if (snapshot.latestHasAceSet) {
    return { action: 'verdict', cue: 'verdict', label: '에이스 결정전', tone: 'highlight', detail: matchDetail(snapshot) };
  }
  if (snapshot.latestComeback) {
    return { action: 'comeback', cue: 'comeback', label: '역전승', tone: 'success', detail: matchDetail(snapshot) };
  }
  if (snapshot.latestUpset) {
    return { action: 'event', cue: 'event', label: '이변 발생', tone: 'warning', detail: `${matchDetail(snapshot)} · 최저 사전 승률 ${snapshot.latestUpsetProbability}%` };
  }
  return { action: 'match', cue: 'match', label: '경기 종료', tone: 'ready', detail: matchDetail(snapshot) };
}

export function starleagueFeedbackCue(previous, current, selectedTeamId = '') {
  if (!previous || !current || previous.runId !== current.runId) return '';
  if (!previous.ended && current.ended) return 'champion';
  if (previous.personalStage !== 'DONE' && current.personalStage === 'DONE') return 'champion';
  if (previous.winnersStage !== 'DONE' && current.winnersStage === 'DONE') return 'champion';
  if (current.latestMatchId && current.latestMatchId !== previous.latestMatchId) {
    return starleagueFeedbackPresentation(current, selectedTeamId).cue || 'match';
  }
  if (current.personalPlayed > previous.personalPlayed || current.winnersPlayed > previous.winnersPlayed) return 'match';
  if (current.seasonNo > previous.seasonNo) return 'season';
  return '';
}
