import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  starleagueFeedbackCue,
  starleagueFeedbackPresentation,
  starleagueFeedbackSnapshot,
  starleagueFeedbackTransition,
  starleagueResultPresentation,
  starleagueTextPresentation,
} from '../src/app/games/myanimecraft/_lib/starleagueFeedback.js';
import {
  advancePersonalLeagueAction,
  advanceWinnersLeagueAction,
  buyShopItemAction,
  consumeInventoryItemAction,
  createNewState,
  equipInventoryItemAction,
  getSeasonShopRows,
  getTeamContractRows,
  getMatchArchiveRows,
  getSeriesReplayReport,
  inventoryRowsForTeam,
  investTrainingAction,
  negotiateSponsorAction,
  releasePlayerAction,
  renewContractAction,
  runTeamActionAction,
  simulateNextMatchAction,
  signFreeAgentAction,
  startPersonalLeagueAction,
  startWinnersLeagueAction,
  teamActionRows,
  unequipSlotAction,
} from '../src/app/games/myanimecraft/_lib/myAnimeCraftEngine.js';

const routeUrl = new URL('../src/app/games/myanimecraft/', import.meta.url);
const componentUrl = new URL('_components/', routeUrl);
const pageSource = await readFile(new URL('play/page.js', routeUrl), 'utf8');
const leagueSource = await readFile(new URL('MyAnimeCraftLeagueTab.js', componentUrl), 'utf8');
const cupsSource = await readFile(new URL('MyAnimeCraftCupsTab.js', componentUrl), 'utf8');
const teamSource = await readFile(new URL('MyAnimeCraftTeamTab.js', componentUrl), 'utf8');
const marketSource = await readFile(new URL('MyAnimeCraftMarketTab.js', componentUrl), 'utf8');
const recordsSource = await readFile(new URL('MyAnimeCraftRecordsTab.js', componentUrl), 'utf8');
const visualsSource = await readFile(new URL('MyAnimeCraftVisuals.js', componentUrl), 'utf8');
const iconSource = await readFile(new URL('../src/app/games/_components/GameActionIcon.js', import.meta.url), 'utf8');
const soundSource = await readFile(new URL('../src/app/games/_lib/useGameSfx.js', import.meta.url), 'utf8');
const styleSource = await readFile(new URL('../src/styles/AppShell.css', import.meta.url), 'utf8');

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

function expectResult(previous, current, expected, selectedTeamId = '') {
  const presentation = starleagueResultPresentation(previous, current, selectedTeamId);
  assert.equal(starleagueFeedbackTransition(previous, current), expected.key, `${expected.key} 전환을 선택해야 합니다.`);
  assert.equal(presentation.action, expected.action, `${expected.key} 아이콘을 선택해야 합니다.`);
  assert.equal(presentation.cue, expected.cue, `${expected.key} 결과음을 선택해야 합니다.`);
  assert.equal(presentation.tone, expected.tone, `${expected.key} 결과 톤을 선택해야 합니다.`);
  return presentation;
}

function fundTeam(rawState, teamId, money = 100000) {
  return {
    ...rawState,
    teams: rawState.teams.map((team) => (team.id === teamId ? { ...team, money } : team)),
    standings: rawState.standings.map((standing) => (standing.teamId === teamId ? { ...standing, money } : standing)),
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

const managementSeed = createNewState({
  now: '2026-07-12T00:00:00.000Z',
  runId: 'starleague-management-check',
});
const managementTeamId = managementSeed.teams[0].id;
const managementPlayerId = managementSeed.teams[0].roster[0].id;
const managementBase = fundTeam(managementSeed, managementTeamId);

const sponsorState = negotiateSponsorAction(managementBase, managementTeamId);
expectResult(managementBase, sponsorState, { key: 'sponsor', action: 'sponsor', cue: 'sponsor', tone: 'success' });

const trainingState = investTrainingAction(managementBase, managementTeamId);
expectResult(managementBase, trainingState, { key: 'training', action: 'training', cue: 'training', tone: 'success' });

const freeAgentState = signFreeAgentAction(managementBase, managementTeamId);
expectResult(managementBase, freeAgentState, { key: 'freeAgent', action: 'recruit', cue: 'recruit', tone: 'success' });

const renewableContract = getTeamContractRows(managementBase, managementTeamId).find((contract) => contract.canRenew);
assert.ok(renewableContract, '검증 가능한 재계약 대상이 있어야 합니다.');
const contractState = renewContractAction(managementBase, managementTeamId, renewableContract.playerId);
expectResult(managementBase, contractState, { key: 'contract', action: 'contract', cue: 'contract', tone: 'success' });

const releasableContract = getTeamContractRows(managementBase, managementTeamId).find((contract) => contract.canRelease);
assert.ok(releasableContract, '검증 가능한 방출 대상이 있어야 합니다.');
const releaseState = releasePlayerAction(managementBase, managementTeamId, releasableContract.playerId);
expectResult(managementBase, releaseState, { key: 'release', action: 'release', cue: 'release', tone: 'warning' });

const shopRows = getSeasonShopRows(managementBase);
const equipmentOffer = shopRows.find((offer) => offer.slot && offer.stock > 0);
assert.ok(equipmentOffer, '장착 가능한 상점 상품이 있어야 합니다.');
const equipmentBought = buyShopItemAction(managementBase, managementTeamId, equipmentOffer.offerId);
expectResult(managementBase, equipmentBought, { key: 'shop', action: 'shop', cue: 'shop', tone: 'success' });
const boughtEquipment = inventoryRowsForTeam(equipmentBought, managementTeamId).find((item) => item.itemId === equipmentOffer.itemId);
assert.ok(boughtEquipment, '구매한 장비가 팀 인벤토리에 들어와야 합니다.');
const equippedState = equipInventoryItemAction(equipmentBought, managementTeamId, managementPlayerId, boughtEquipment.itemId);
expectResult(equipmentBought, equippedState, { key: 'equip', action: 'equip', cue: 'equip', tone: 'highlight' });
const unequippedState = unequipSlotAction(equippedState, managementTeamId, managementPlayerId, boughtEquipment.slot);
expectResult(equippedState, unequippedState, { key: 'unequip', action: 'unequip', cue: 'unequip', tone: 'ready' });

const consumableOffer = shopRows.find((offer) => !offer.slot && offer.stock > 0);
assert.ok(consumableOffer, '사용 가능한 소모품 상품이 있어야 합니다.');
const consumableBought = buyShopItemAction(managementBase, managementTeamId, consumableOffer.offerId);
const boughtConsumable = inventoryRowsForTeam(consumableBought, managementTeamId).find((item) => item.itemId === consumableOffer.itemId);
assert.ok(boughtConsumable, '구매한 소모품이 팀 인벤토리에 들어와야 합니다.');
const consumedState = consumeInventoryItemAction(consumableBought, managementTeamId, managementPlayerId, boughtConsumable.itemId);
expectResult(consumableBought, consumedState, { key: 'consume', action: 'consume', cue: 'consume', tone: 'success' });

const teamAction = teamActionRows(managementBase, managementTeamId, managementPlayerId).find((action) => action.canRun);
assert.ok(teamAction, '검증 가능한 주간 팀 운영 행동이 있어야 합니다.');
const teamActionState = runTeamActionAction(managementBase, managementTeamId, managementPlayerId, teamAction.id);
const expectedTeamAction = teamAction.id === 'FANMEETING'
  ? { key: 'fanMeeting', action: 'sponsor', cue: 'sponsor', tone: 'success' }
  : teamAction.id === 'REST'
    ? { key: 'teamRest', action: 'rest', cue: 'rest', tone: 'success' }
    : { key: 'teamTraining', action: 'training', cue: 'training', tone: 'success' };
expectResult(managementBase, teamActionState, expectedTeamAction);

const personalStarted = startPersonalLeagueAction(managementBase);
expectResult(managementBase, personalStarted, { key: 'personalStart', action: 'cup', cue: 'cupStart', tone: 'highlight' });
const personalAdvanced = advancePersonalLeagueAction(personalStarted);
const personalAdvanceKey = starleagueFeedbackTransition(personalStarted, personalAdvanced);
assert.ok(['personalProgress', 'personalMatch'].includes(personalAdvanceKey), '개인리그 진행은 단계 또는 경기 결과로 분류되어야 합니다.');

const winnersStarted = startWinnersLeagueAction(managementBase, managementTeamId);
expectResult(managementBase, winnersStarted, { key: 'winnersStart', action: 'winners', cue: 'winnersStart', tone: 'highlight' });
const winnersAdvanced = advanceWinnersLeagueAction(winnersStarted);
expectResult(winnersStarted, winnersAdvanced, { key: 'winnersSet', action: 'winners', cue: 'winnersSet', tone: 'ready' });

const tradeSucceeded = state({ log: ['트레이드 성사: 알파 A + 0Cr ↔ 베타 B'] });
expectResult(state({ log: ['대기'] }), tradeSucceeded, { key: 'trade', action: 'transfer', cue: 'transfer', tone: 'success' });
const tradeRejected = state({ log: ['베타가 트레이드를 거절했습니다. 수락률 40%'] });
expectResult(state({ log: ['대기'] }), tradeRejected, { key: 'tradeRejected', action: 'transfer', cue: 'tradeRejected', tone: 'warning' });
const blockedAction = state({ log: ['알파 훈련 투자 실패: 300 Cr 필요, 보유 0 Cr'] });
expectResult(state({ log: ['대기'] }), blockedAction, { key: 'blocked', action: 'warning', cue: 'warning', tone: 'warning' });

const newRunState = state({ runId: 'league-new', log: ['시즌 1이 개막했습니다.'] });
expectResult(state({ log: ['대기'] }), newRunState, { key: 'newRun', action: 'new', cue: 'start', tone: 'highlight' });
assert.equal(starleagueFeedbackCue(starleagueFeedbackSnapshot(state()), starleagueFeedbackSnapshot(newRunState)), '', '런 불러오기 비교에서는 개막음을 재생하지 않아야 합니다.');
assert.equal(starleagueTextPresentation('로그인하면 시즌을 저장할 수 있습니다.').tone, 'warning', '비로그인 안내는 경고 톤이어야 합니다.');
assert.equal(starleagueTextPresentation('시즌 상태를 저장했습니다.').action, 'save', '저장 결과는 저장 아이콘이어야 합니다.');
assert.equal(starleagueTextPresentation('저장된 시즌을 불러왔습니다.').action, 'load', '불러오기 결과는 폴더 아이콘이어야 합니다.');

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

const resultCues = [
  'match', 'comeback', 'victory', 'defeat', 'champion', 'season', 'event', 'verdict',
  'cupStart', 'cupMatch', 'winnersStart', 'winnersSet', 'sponsor', 'training', 'recruit',
  'contract', 'release', 'transfer', 'tradeRejected', 'shop', 'equip', 'unequip',
  'consume', 'rest', 'warning', 'start',
];
for (const cue of resultCues) {
  assert.match(soundSource, new RegExp(`\\n  ${cue}: \\[`), `${cue} 결과음 프로필이 있어야 합니다.`);
}
for (const icon of [
  'match', 'comeback', 'victory', 'defeat', 'champion', 'season', 'event', 'verdict',
  'cup', 'winners', 'sponsor', 'training', 'recruit', 'contract', 'release', 'transfer',
  'shop', 'equip', 'unequip', 'consume', 'rest', 'warning', 'new', 'analysis',
  'advisor', 'clock', 'replay', 'calendar', 'players', 'map', 'tournament', 'inventory',
  'finance', 'logs', 'trophy',
]) {
  assert.match(iconSource, new RegExp(`\\n  ['"]?${icon}['"]?: `), `${icon} 결과 아이콘 매핑이 있어야 합니다.`);
}

assert.match(pageSource, /const stateRef = useRef\(state\)/, '연속 운영 행동은 최신 상태 참조를 사용해야 합니다.');
assert.match(pageSource, /starleagueResultPresentation\(previousState, nextState, selectedTeamId\)/, '운영 행동마다 결과 프레젠테이션을 계산해야 합니다.');
assert.match(pageSource, /resultPresentation=\{resultPresentation\}/, '기능 탭에 공통 결과 프레젠테이션을 전달해야 합니다.');
assert.match(pageSource, /publishMessage\('로그인하면/, '비로그인 저장 안내도 고정 결과 영역에 남겨야 합니다.');
assert.match(pageSource, /playGameSfx\('start'\)/, '사용자가 새 시즌을 시작할 때만 개막음을 재생해야 합니다.');

for (const source of [leagueSource, cupsSource, teamSource, marketSource]) {
  if (!source.includes('RecentActionResult')) continue;
  assert.match(source, /action=\{resultPresentation\.action\}/, '각 기능 탭 결과 패널에 결과 아이콘을 전달해야 합니다.');
  assert.match(source, /tone=\{resultPresentation\.tone\}/, '각 기능 탭 결과 패널에 결과 톤을 전달해야 합니다.');
}
const actionSources = [leagueSource, cupsSource, teamSource, marketSource].join('\n');
for (const match of actionSources.matchAll(/applyStateAction\(/g)) {
  const buttonPrefix = actionSources.slice(Math.max(0, match.index - 500), match.index);
  assert.match(buttonPrefix, /cue="off"/, '상태 기반 결과음이 있는 버튼은 선행 클릭음을 꺼야 합니다.');
}
assert.match(teamSource, /TEAM_ACTION_ICONS/, '특훈·휴식·팬미팅은 행동별 아이콘을 선택해야 합니다.');
assert.match(leagueSource, /data-game-sfx="select"/, '경기 다시보기 선택에는 짧은 선택음을 제공해야 합니다.');

const visualComponentsSource = [leagueSource, cupsSource, teamSource, marketSource, recordsSource].join('\n');
const semanticPanelTitles = (visualComponentsSource.match(/<MyAnimeCraftPanelTitle\b/g) || []).length;
const semanticIconRows = (visualComponentsSource.match(/<MyAnimeCraftIconRow\b/g) || []).length;
assert.equal(semanticPanelTitles, 27, '스타리그의 27개 패널 제목에 의미 아이콘을 표시해야 합니다.');
assert.equal(semanticIconRows, 27, '스타리그의 27개 반복 정보 행에 의미 아이콘을 표시해야 합니다.');
assert.doesNotMatch(visualComponentsSource, /className="games-panel-title"/, '스타리그 기능 탭에 아이콘 없는 기존 패널 제목이 남으면 안 됩니다.');
assert.doesNotMatch(visualComponentsSource, /className="game-save-row"/, '스타리그 기능 탭에 아이콘 없는 기존 정보 행이 남으면 안 됩니다.');
assert.match(visualsSource, /export function MyAnimeCraftPanelTitle/, '스타리그 전용 패널 제목 컴포넌트가 있어야 합니다.');
assert.match(visualsSource, /export function MyAnimeCraftIconRow/, '스타리그 전용 정보 행 컴포넌트가 있어야 합니다.');
assert.match(styleSource, /\.starleague-panel-title h2/, '스타리그 패널 제목 아이콘 레이아웃이 있어야 합니다.');
assert.match(styleSource, /\.game-save-row\.starleague-icon-row/, '스타리그 정보 행 아이콘 레이아웃이 있어야 합니다.');

console.log(JSON.stringify({
  feedbackCues: resultCues.length,
  managementProfiles: 15,
  cupProfiles: 7,
  commentaryCharacters: commentaryText.length,
  browserResultPanels: 4,
  semanticPanelTitles,
  semanticIconRows,
}, null, 2));
