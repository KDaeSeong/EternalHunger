import assert from 'node:assert/strict';
import {
  starleagueFeedbackCue,
  starleagueFeedbackPresentation,
  starleagueFeedbackSnapshot,
} from '../src/app/games/myanimecraft/_lib/starleagueFeedback.js';
import {
  createNewState,
  getMatchArchiveRows,
  getSeriesReplayReport,
  simulateNextMatchAction,
} from '../src/app/games/myanimecraft/_lib/myAnimeCraftEngine.js';

const teams = [
  { id: 'team-a', name: '알파' },
  { id: 'team-b', name: '베타' },
  { id: 'team-c', name: '감마' },
];

function state(overrides = {}) {
  return {
    runId: 'league-a',
    seasonNo: 1,
    ended: false,
    championTeamId: '',
    teams,
    fixtures: [],
    postseasonFixtures: [],
    personalLeague: { stage: 'NOT_STARTED', matches: [] },
    winnersLeague: { stage: 'NOT_STARTED', sets: [] },
    ...overrides,
  };
}

function playedFixture({
  ace = false,
  firstWinner = 'team-a',
  id = 'f-1',
  probabilityHome = 55,
  scoreAway = 1,
  scoreHome = 2,
  winner = 'team-a',
} = {}) {
  return {
    id,
    round: 1,
    homeTeamId: 'team-a',
    awayTeamId: 'team-b',
    played: true,
    result: {
      matchId: `match-${id}`,
      playedAt: 100,
      homeTeamId: 'team-a',
      awayTeamId: 'team-b',
      homeTeamName: '알파',
      awayTeamName: '베타',
      winnerTeamId: winner,
      scoreHome,
      scoreAway,
      sets: [
        { setNo: 1, winnerTeamId: firstWinner, probabilityHome },
        ...(ace ? [{ setNo: 2, winnerTeamId: winner, probabilityHome: 50, isAceSet: true }] : []),
      ],
    },
  };
}

const base = starleagueFeedbackSnapshot(state());
assert.equal(base.regularPlayed, 0, '초기 시즌은 진행 경기 0개여야 합니다.');
assert.equal(starleagueFeedbackCue(null, base), '', '첫 렌더에서는 중계음을 재생하면 안 됩니다.');
assert.equal(starleagueFeedbackCue(base, { ...base }), '', '선택만 바뀌면 중계음을 재생하면 안 됩니다.');

const winSnapshot = starleagueFeedbackSnapshot(state({ fixtures: [playedFixture()] }));
assert.equal(winSnapshot.latestWinnerTeamName, '알파', '최근 승리 팀 이름을 계산해야 합니다.');
assert.equal(
  starleagueFeedbackCue(base, winSnapshot, 'team-a'),
  'victory',
  '응원팀 승리는 승리 효과음을 사용해야 합니다.',
);

const lossSnapshot = starleagueFeedbackSnapshot(state({
  fixtures: [playedFixture({ winner: 'team-b', firstWinner: 'team-b', scoreHome: 0, scoreAway: 2 })],
}));
assert.equal(
  starleagueFeedbackCue(base, lossSnapshot, 'team-a'),
  'defeat',
  '응원팀 패배는 패배 효과음을 사용해야 합니다.',
);

const aceSnapshot = starleagueFeedbackSnapshot(state({ fixtures: [playedFixture({ ace: true })] }));
assert.equal(aceSnapshot.latestHasAceSet, true, '에이스 세트를 감지해야 합니다.');
assert.equal(
  starleagueFeedbackCue(base, aceSnapshot, 'team-c'),
  'verdict',
  '중립 관전 중 에이스 결정전은 전용 판정음을 사용해야 합니다.',
);

const comebackFixture = playedFixture({ firstWinner: 'team-b', winner: 'team-a' });
comebackFixture.result.sets.push({ setNo: 2, winnerTeamId: 'team-a', probabilityHome: 55 });
const comebackSnapshot = starleagueFeedbackSnapshot(state({ fixtures: [comebackFixture] }));
assert.equal(comebackSnapshot.latestComeback, true, '첫 세트를 내준 승자의 역전을 감지해야 합니다.');
assert.equal(
  starleagueFeedbackCue(base, comebackSnapshot, 'team-c'),
  'comeback',
  '중립 관전 중 역전승은 전용 상승음을 사용해야 합니다.',
);

const upsetSnapshot = starleagueFeedbackSnapshot(state({
  fixtures: [playedFixture({ probabilityHome: 35, scoreHome: 1, scoreAway: 0 })],
}));
assert.equal(upsetSnapshot.latestUpset, true, '42% 이하 사전 승률 승리를 이변으로 감지해야 합니다.');
assert.equal(
  starleagueFeedbackCue(base, upsetSnapshot, 'team-c'),
  'event',
  '중립 관전 중 이변은 이벤트 효과음을 사용해야 합니다.',
);

const favoriteRecoveryFixture = playedFixture({
  firstWinner: 'team-b',
  probabilityHome: 65,
  scoreHome: 2,
  scoreAway: 1,
  winner: 'team-a',
});
favoriteRecoveryFixture.result.sets.push({ setNo: 2, winnerTeamId: 'team-a', probabilityHome: 65 });
const favoriteRecoverySnapshot = starleagueFeedbackSnapshot(state({ fixtures: [favoriteRecoveryFixture] }));
assert.equal(
  favoriteRecoverySnapshot.latestUpset,
  false,
  '최종 패배 팀의 이변 세트만으로 경기 전체를 이변으로 판정하면 안 됩니다.',
);

const sameTimeFirst = playedFixture({ id: 'same-time-first' });
const sameTimeLast = playedFixture({ id: 'same-time-last', winner: 'team-b', firstWinner: 'team-b', scoreHome: 0, scoreAway: 2 });
const sameTimeSnapshot = starleagueFeedbackSnapshot(state({ fixtures: [sameTimeFirst, sameTimeLast] }));
assert.equal(
  sameTimeSnapshot.latestMatchId,
  'REGULAR-same-time-last',
  '동일 시각에 끝난 경기는 실제 처리 순서상 마지막 경기를 최신 경기로 선택해야 합니다.',
);

const championSnapshot = starleagueFeedbackSnapshot(state({
  ended: true,
  championTeamId: 'team-a',
  fixtures: [playedFixture()],
}));
assert.equal(starleagueFeedbackCue(winSnapshot, championSnapshot, 'team-c'), 'champion', '시즌 종료는 챔피언 효과음을 우선해야 합니다.');
assert.equal(
  starleagueFeedbackPresentation(championSnapshot).label,
  '시즌 챔피언 확정',
  '시즌 종료 화면 신호는 챔피언을 명시해야 합니다.',
);

const personalDone = starleagueFeedbackSnapshot(state({ personalLeague: { stage: 'DONE', matches: [] } }));
assert.equal(starleagueFeedbackCue(base, personalDone), 'champion', '개인리그 완료는 우승 효과음을 사용해야 합니다.');
const nextSeason = { ...base, seasonNo: 2 };
assert.equal(starleagueFeedbackCue(base, nextSeason), 'season', '다음 시즌은 시즌 전환음을 사용해야 합니다.');
assert.equal(starleagueFeedbackCue(base, { ...championSnapshot, runId: 'league-b' }), '', '다른 런을 불러올 때 결과음을 내면 안 됩니다.');

const comebackPresentation = starleagueFeedbackPresentation(comebackSnapshot, 'team-c');
assert.deepEqual(
  { action: comebackPresentation.action, label: comebackPresentation.label, tone: comebackPresentation.tone },
  { action: 'comeback', label: '역전승', tone: 'success' },
  '역전 중계 신호는 상승 아이콘과 성공 톤을 사용해야 합니다.',
);

const simulatedState = simulateNextMatchAction(createNewState({
  now: '2026-07-11T00:00:00.000Z',
  runId: 'feedback-commentary-check',
}));
const simulatedMatch = getMatchArchiveRows(simulatedState, 1)[0];
const commentaryText = simulatedMatch.sets
  .flatMap((setResult) => setResult.timeline || [])
  .map((line) => line.text || '')
  .join('\n');
const replayReport = getSeriesReplayReport(simulatedMatch);
assert.ok(
  replayReport.headline.startsWith(`${simulatedMatch.homeTeamName} ${simulatedMatch.scoreHome}:${simulatedMatch.scoreAway} ${simulatedMatch.awayTeamName}.`),
  '시리즈 총평 스코어라인은 승패와 관계없이 홈팀 대 원정팀 순서를 유지해야 합니다.',
);
const visibleCommentaryText = [
  commentaryText,
  ...simulatedMatch.sets.flatMap((setResult) => [setResult.headline, setResult.turningPoint]),
  replayReport.headline,
  ...replayReport.highlights,
].filter(Boolean).join('\n');
assert.ok(commentaryText.length > 100, '실제 경기에는 충분한 중계 타임라인이 생성되어야 합니다.');
assert.doesNotMatch(
  visibleCommentaryText,
  /동선와|동선로|운영가|전환가|이\(가\)|을\(를\)|Player [2459]이\b|Player [013678]가\b|Player [2459]을\b|Player [013678]를\b/,
  '실제 중계와 다시보기 문장에 잘못된 한국어 조사나 병기형 조사가 남으면 안 됩니다.',
);

console.log('Starleague feedback checks passed.');
