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
  const decidingSet = sets[sets.length - 1] || null;
  const homeTeamId = String(result.homeTeamId || fixture.homeTeamId || '');
  const decidingWinnerIsHome = decidingSet && String(decidingSet.winnerTeamId || '') === homeTeamId;
  const winningBuildStyle = String(
    (decidingWinnerIsHome ? decidingSet?.homeBuildStyle : decidingSet?.awayBuildStyle) || '',
  );
  const winningBuildName = String(
    (decidingWinnerIsHome ? decidingSet?.homeBuildName : decidingSet?.awayBuildName) || '',
  );
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
    winningBuildStyle,
    winningBuildName,
    tempoLabel: String(decidingSet?.tempoLabel || ''),
    keyEventLabel: String(decidingSet?.keyEventLabel || ''),
  };
}

function playerId(player) {
  return String(player?.id || player?.playerId || '');
}

function rosterSignature(state) {
  return safeArray(state?.teams)
    .map((team) => `${team.id}:${safeArray(team.roster).map(playerId).sort().join(',')}`)
    .sort()
    .join('|');
}

function contractSignature(state) {
  return Object.entries(state?.contracts || {})
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([id, contract]) => `${id}:${contract?.teamId || ''}:${contract?.salary || 0}:${contract?.yearsLeft || 0}`)
    .join('|');
}

function inventorySignature(state) {
  return safeArray(state?.inventories)
    .map((inventory) => {
      const itemRows = safeArray(inventory?.items)
        .map((item) => [String(item?.itemId || ''), Number(item?.qty || 0)])
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([id, qty]) => `${id}:${qty}`)
        .join(',');
      return `${inventory?.teamId || ''}:${itemRows}`;
    })
    .sort()
    .join('|');
}

function equipmentSignature(state) {
  return safeArray(state?.inventories)
    .flatMap((inventory) => Object.entries(inventory?.equipped || {}).map(([player, slots]) => (
      `${inventory?.teamId || ''}:${player}:${Object.entries(slots || {}).sort(([a], [b]) => a.localeCompare(b)).map(([slot, item]) => `${slot}:${item}`).join(',')}`
    )))
    .sort()
    .join('|');
}

function personalChampionName(state) {
  const personal = state?.personalLeague || {};
  const championId = String(personal.championPlayerId || '');
  const champion = safeArray(personal.participants).find((participant) => playerId(participant) === championId);
  return String(champion?.playerName || champion?.name || championId || '');
}

const MATCH_STYLE_PRESENTATIONS = Object.freeze({
  rush: { action: 'starleague-build-rush', cue: 'starleagueRush', label: '초반 타이밍 적중', tone: 'warning' },
  harass: { action: 'starleague-build-harass', cue: 'starleagueHarass', label: '견제 운영 적중', tone: 'highlight' },
  tech: { action: 'starleague-build-tech', cue: 'starleagueTech', label: '테크 카드 적중', tone: 'highlight' },
  macro: { action: 'starleague-build-macro', cue: 'starleagueMacro', label: '운영전 승리', tone: 'success' },
  balanced: { action: 'starleague-build-balanced', cue: 'starleagueBalanced', label: '정면 승부 승리', tone: 'ready' },
});

const FEEDBACK_PROFILES = {
  idle: { action: 'signal', cue: '', label: '최근 리그 결과', tone: 'ready' },
  newRun: { action: 'new', cue: 'start', label: '새 리그 개막', tone: 'highlight' },
  seasonChampion: { action: 'champion', cue: 'champion', label: '시즌 챔피언 확정', tone: 'champion' },
  nextSeason: { action: 'season', cue: 'season', label: '다음 시즌 개막', tone: 'highlight' },
  regularMatch: { action: 'match', cue: 'match', label: '경기 종료', tone: 'ready' },
  personalStart: { action: 'cup', cue: 'cupStart', label: '개인리그 개막', tone: 'highlight' },
  personalProgress: { action: 'cup', cue: 'cupMatch', label: '개인리그 단계 완료', tone: 'success' },
  personalMatch: { action: 'cup', cue: 'cupMatch', label: '개인리그 경기 종료', tone: 'ready' },
  personalChampion: { action: 'champion', cue: 'champion', label: '개인리그 우승', tone: 'champion' },
  winnersStart: { action: 'winners', cue: 'winnersStart', label: '위너스리그 개막', tone: 'highlight' },
  winnersSet: { action: 'winners', cue: 'winnersSet', label: '위너스리그 세트 종료', tone: 'ready' },
  winnersChampion: { action: 'champion', cue: 'champion', label: '위너스리그 우승', tone: 'champion' },
  sponsor: { action: 'sponsor', cue: 'sponsor', label: '스폰서 협상 완료', tone: 'success' },
  training: { action: 'training', cue: 'training', label: '훈련 투자 완료', tone: 'success' },
  freeAgent: { action: 'recruit', cue: 'recruit', label: 'FA 영입 완료', tone: 'success' },
  contract: { action: 'contract', cue: 'contract', label: '재계약 완료', tone: 'success' },
  release: { action: 'release', cue: 'release', label: '선수 방출', tone: 'warning' },
  trade: { action: 'transfer', cue: 'transfer', label: '트레이드 성사', tone: 'success' },
  tradeRejected: { action: 'transfer', cue: 'tradeRejected', label: '트레이드 결렬', tone: 'warning' },
  shop: { action: 'shop', cue: 'shop', label: '상점 구매 완료', tone: 'success' },
  equip: { action: 'equip', cue: 'equip', label: '장비 장착', tone: 'highlight' },
  unequip: { action: 'unequip', cue: 'unequip', label: '장비 해제', tone: 'ready' },
  consume: { action: 'consume', cue: 'consume', label: '아이템 사용', tone: 'success' },
  teamTraining: { action: 'training', cue: 'training', label: '선수 특훈 완료', tone: 'success' },
  teamRest: { action: 'rest', cue: 'rest', label: '선수 휴식 완료', tone: 'success' },
  fanMeeting: { action: 'sponsor', cue: 'sponsor', label: '팬미팅 완료', tone: 'success' },
  blocked: { action: 'warning', cue: 'warning', label: '운영 처리 불가', tone: 'warning' },
};

const TEXT_PRESENTATIONS = [
  { pattern: /로그인|실패|없습니다|부족|찾을 수 없습니다|할 수 없습니다|필요|품절/, force: true, value: { action: 'warning', label: '처리 안내', tone: 'warning' } },
  { pattern: /불러오|불러왔/, force: true, value: { action: 'load', label: '시즌 불러오기', tone: 'success' } },
  { pattern: /저장/, force: true, value: { action: 'save', label: '시즌 저장', tone: 'success' } },
  { pattern: /전적|스냅샷/, force: true, value: { action: 'archive', label: '시즌 기록', tone: 'success' } },
];

export function starleagueFeedbackSnapshot(state) {
  const latestMatch = latestPlayedMatch(state);
  const personal = state?.personalLeague || {};
  const personalMatches = safeArray(personal.matches);
  const winners = state?.winnersLeague || {};
  const winnersSets = safeArray(winners.sets);
  const econLogs = safeArray(state?.econLogs);
  const latestEcon = econLogs[0] || econLogs[econLogs.length - 1] || null;
  return {
    runId: String(state?.runId || ''),
    seasonNo: Math.max(1, Number(state?.seasonNo || 1)),
    regularPlayed: fixtureRows(state).filter(({ fixture }) => fixture?.played).length,
    personalPlayed: personalMatches.filter((match) => match?.played).length,
    personalStage: String(personal.stage || 'NOT_STARTED'),
    personalPhase: String(personal.phase || ''),
    personalReportCount: safeArray(personal.stageReports).length,
    personalChampionName: personalChampionName(state),
    winnersPlayed: winnersSets.length,
    winnersStage: String(winners.stage || 'NOT_STARTED'),
    winnersChampionTeamName: winners.championTeamId ? teamName(state, winners.championTeamId, '우승팀') : '',
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
    latestWinningBuildStyle: String(latestMatch?.winningBuildStyle || ''),
    latestWinningBuildName: String(latestMatch?.winningBuildName || ''),
    latestTempoLabel: String(latestMatch?.tempoLabel || ''),
    latestKeyEventLabel: String(latestMatch?.keyEventLabel || ''),
    latestLog: String(state?.log?.[0] || ''),
    econLogCount: econLogs.length,
    latestEconTag: String(latestEcon?.tag || ''),
    freeAgentSeq: Number(state?.freeAgentSeq || 0),
    rosterSignature: rosterSignature(state),
    contractSignature: contractSignature(state),
    inventorySignature: inventorySignature(state),
    equipmentSignature: equipmentSignature(state),
    teamActionCount: Object.keys(state?.teamActionsUsed || {}).length,
  };
}

function asSnapshot(value) {
  return Object.prototype.hasOwnProperty.call(value || {}, 'latestMatchId')
    ? value
    : starleagueFeedbackSnapshot(value);
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
  const stylePresentation = MATCH_STYLE_PRESENTATIONS[snapshot.latestWinningBuildStyle];
  if (stylePresentation) {
    const styleDetail = [
      matchDetail(snapshot),
      snapshot.latestWinningBuildName,
      snapshot.latestTempoLabel,
      snapshot.latestKeyEventLabel,
    ].filter(Boolean).join(' · ');
    return { ...stylePresentation, detail: styleDetail };
  }
  return { action: 'match', cue: 'match', label: '경기 종료', tone: 'ready', detail: matchDetail(snapshot) };
}

const BLOCKED_LOG = /실패|거절|없습니다|부족|찾을 수 없습니다|할 수 없습니다|종료 후|이미 |최소 \d+인 로스터|다시 선택|품절/;

export function starleagueFeedbackTransition(previousValue, currentValue) {
  if (!previousValue || !currentValue) return 'idle';
  const previous = asSnapshot(previousValue);
  const current = asSnapshot(currentValue);
  if (previous.runId !== current.runId) return 'newRun';
  if (!previous.ended && current.ended) return 'seasonChampion';
  if (current.seasonNo > previous.seasonNo) return 'nextSeason';
  if (current.latestMatchId && current.latestMatchId !== previous.latestMatchId) return 'regularMatch';

  if (previous.personalStage !== 'DONE' && current.personalStage === 'DONE') return 'personalChampion';
  if (previous.personalStage === 'NOT_STARTED' && current.personalStage === 'IN_PROGRESS') return 'personalStart';
  if (current.personalPlayed > previous.personalPlayed) return 'personalMatch';
  if (current.personalPhase !== previous.personalPhase || current.personalReportCount > previous.personalReportCount) return 'personalProgress';

  if (previous.winnersStage !== 'DONE' && current.winnersStage === 'DONE') return 'winnersChampion';
  if (previous.winnersStage === 'NOT_STARTED' && current.winnersStage === 'IN_PROGRESS') return 'winnersStart';
  if (current.winnersPlayed > previous.winnersPlayed) return 'winnersSet';

  if (!current.latestLog || current.latestLog === previous.latestLog) return 'idle';
  if (/트레이드.*(?:실패|거절)|트레이드를 거절/.test(current.latestLog)) return 'tradeRejected';
  if (BLOCKED_LOG.test(current.latestLog)) return 'blocked';
  if (/스폰서 협상/.test(current.latestLog)) return 'sponsor';
  if (/훈련 투자/.test(current.latestLog)) return 'training';
  if (/FA 영입/.test(current.latestLog) || current.freeAgentSeq > previous.freeAgentSeq) return 'freeAgent';
  if (/방출/.test(current.latestLog)) return 'release';
  if (/트레이드 성사/.test(current.latestLog)) return 'trade';
  if (/재계약/.test(current.latestLog) || current.contractSignature !== previous.contractSignature) return 'contract';
  if (/상점 구매/.test(current.latestLog)) return 'shop';
  if (/장착을 해제/.test(current.latestLog)) return 'unequip';
  if (/장착:/.test(current.latestLog) || current.equipmentSignature !== previous.equipmentSignature) return 'equip';
  if (/에게 .* 사용:/.test(current.latestLog)) return 'consume';
  if (current.teamActionCount > previous.teamActionCount) {
    if (/팬미팅/.test(current.latestLog)) return 'fanMeeting';
    if (/휴식/.test(current.latestLog)) return 'teamRest';
    return 'teamTraining';
  }
  if (current.inventorySignature !== previous.inventorySignature) return 'shop';
  return 'idle';
}

export function starleagueResultPresentation(previousValue, currentValue, selectedTeamId = '') {
  const current = asSnapshot(currentValue);
  const key = starleagueFeedbackTransition(previousValue, current);
  if (key === 'regularMatch') return { key, ...starleagueFeedbackPresentation(current, selectedTeamId) };
  const profile = { key, ...FEEDBACK_PROFILES[key] };
  if (key === 'newRun') return { ...profile, detail: `시즌 ${current.seasonNo}이 개막했습니다.` };
  if (key === 'nextSeason') return { ...profile, label: `시즌 ${current.seasonNo} 개막`, detail: current.latestLog };
  if (key === 'seasonChampion') return { ...profile, detail: `시즌 정상 · ${current.championTeamName || '우승팀'}` };
  if (key === 'personalChampion') return { ...profile, detail: `${current.personalChampionName || '우승 선수'} 개인리그 정상` };
  if (key === 'winnersChampion') return { ...profile, detail: `${current.winnersChampionTeamName || '우승팀'} 위너스리그 정상` };
  return current.latestLog ? { ...profile, detail: current.latestLog } : profile;
}

export function starleagueFeedbackCue(previous, current, selectedTeamId = '') {
  if (!previous || !current || asSnapshot(previous).runId !== asSnapshot(current).runId) return '';
  return starleagueResultPresentation(previous, current, selectedTeamId).cue || '';
}

export function starleagueTextPresentation(text, fallback = FEEDBACK_PROFILES.idle) {
  const normalized = String(text || '');
  const matched = TEXT_PRESENTATIONS.find((row) => row.pattern.test(normalized));
  if (fallback?.key && fallback.key !== 'idle' && !matched?.force) return fallback;
  return matched ? { key: 'message', cue: '', ...matched.value } : fallback;
}
