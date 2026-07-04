export const GAME_SLUG = 'myanimecraft';
export const QUICK_SAVE_SLOT = 'myanimecraft-main';
export const SAVE_VERSION = 'myanimecraft-v1';

export const RACE_LABELS = {
  T: '테란',
  Z: '저그',
  P: '프로토스',
};

export const MAPS = [
  { id: 'map-1', name: '폴리포이드', matchupBalance: {} },
  { id: 'map-2', name: '파이썬', matchupBalance: {} },
  { id: 'map-3', name: '서킷브레이커', matchupBalance: {} },
  { id: 'map-4', name: '네오 실피드', matchupBalance: {} },
  { id: 'map-5', name: '블루스톰', matchupBalance: {} },
  { id: 'map-6', name: '라만차', matchupBalance: {} },
  { id: 'map-7', name: '태양의 제국', matchupBalance: {} },
  { id: 'map-8', name: '그라운드 제로', matchupBalance: {} },
];

const CAREER_STAT_KEYS = ['attack', 'defense', 'strategy', 'sense', 'macro', 'scout', 'control', 'harass'];

const FREE_AGENT_NAMES = [
  ['Nova', 'Rush'],
  ['Mika', 'Orbit'],
  ['Seri', 'Vector'],
  ['Kanna', 'Forge'],
  ['Rin', 'Anchor'],
  ['Haru', 'Signal'],
  ['Yuzu', 'Prime'],
  ['Aki', 'Tempo'],
];

const TEAM_BLUEPRINTS = [
  {
    id: 'team-home',
    name: '블루 스타즈',
    coach: '우시오 노아',
    coachStyle: 'balanced',
    money: 1000,
    roster: [
      player('h1', '시로코', 'T', 7, 78, 525, 545, 525, 535, 520, 550, 505, 555, 525),
      player('h2', '히나', 'Z', 7, 78, 520, 540, 520, 530, 515, 545, 500, 550, 520),
      player('h3', '노아', 'P', 6, 78, 510, 530, 510, 520, 505, 535, 490, 540, 510),
      player('h4', '유세이', 'T', 6, 78, 500, 520, 500, 510, 495, 525, 480, 530, 500),
      ...generatedRoster('home-sub', '블루', 4, 501),
    ],
  },
  {
    id: 'team-away',
    name: '레드 윙즈',
    coach: '잭 아틀라스',
    coachStyle: 'aggressive',
    money: 1000,
    roster: [
      player('a1', '잭', 'T', 7, 78, 515, 535, 515, 525, 510, 540, 495, 545, 515),
      player('a2', '아템', 'P', 7, 78, 518, 538, 518, 528, 513, 543, 498, 548, 518),
      player('a3', '우미', 'Z', 6, 78, 505, 525, 505, 515, 500, 530, 485, 535, 505),
      player('a4', '파이', 'P', 6, 78, 500, 520, 500, 510, 495, 525, 480, 530, 500),
      ...generatedRoster('away-sub', '레드', 4, 500),
    ],
  },
  team('t_4c143973', '옐로우 썬더즈', '유우키 쥬다이', 'balanced', '옐로우', 500),
  team('t_bd833b22', '그린 리프', '이자요이 노노미', 'balanced', '그린', 499),
  team('t_1a79937d', '오렌지 머슬', '쿠다 이즈나', 'balanced', '오렌지', 498),
  team('t_43b08c60', '퍼플 퍼퓸', '시틀라리', 'balanced', '퍼플', 497),
  team('t_0321d176', '다크 블루 갤럭시', '은하', 'balanced', '갤럭시', 496),
  team('t_75dddcf8', '화이트 스파키즈', '푸리나', 'balanced', '화이트', 495),
  team('t_fb447514', '블랙 타이달', '조마에 사오리', 'balanced', '블랙', 494),
  team('t_881e5490', '레인보우 리플렉터', '세미', 'balanced', '레인보우', 493),
];

function player(id, name, race, level, condition, fame, attack, defense, strategy, sense, macro, scout, control, harass) {
  return {
    id,
    name,
    race,
    level,
    condition,
    fame,
    stats: { attack, defense, strategy, sense, macro, scout, control, harass },
  };
}

function team(id, name, coach, coachStyle, prefix, base) {
  return {
    id,
    name,
    coach,
    coachStyle,
    money: 1000,
    roster: generatedRoster(id, prefix, 8, base),
  };
}

function generatedRoster(teamId, prefix, count, base) {
  const races = ['T', 'Z', 'P', 'T', 'Z', 'P', 'T', 'Z'];
  return Array.from({ length: count }, (_, index) => {
    const slot = index + 1;
    const step = Math.max(0, 4 - index);
    const rating = base + step * 5;
    return player(
      `${teamId}-${slot}`,
      `${prefix} Player ${slot}`,
      races[index % races.length],
      Math.max(0, 4 - Math.floor(index / 2)),
      100,
      Math.max(0, (4 - Math.floor(index / 2)) * 45),
      rating + 12,
      rating,
      rating + 8,
      rating + 4,
      rating + 13,
      rating - 8,
      rating + 14,
      rating + 1,
    );
  });
}

function cloneTeam(teamData) {
  return {
    ...teamData,
    money: Number(teamData.money || 0),
    career: normalizeTeamCareer(teamData),
    roster: teamData.roster.map((member) => ({
      ...member,
      salaryStep: Number(member.salaryStep || 0),
      stats: { ...member.stats },
    })),
  };
}

export function getSourceSummary() {
  return {
    teams: TEAM_BLUEPRINTS.length,
    maps: 94,
    importedMaps: MAPS.length,
    source: 'starleague-masterdata.json',
  };
}

export function createNewState(options = {}) {
  const now = options.now || new Date().toISOString();
  const teams = TEAM_BLUEPRINTS.map(cloneTeam);
  const fixtures = generateSchedule(teams);
  return {
    runId: options.runId || `sl-${Date.now().toString(36)}`,
    startedAt: now,
    updatedAt: now,
    seasonNo: 1,
    week: 1,
    teams,
    mapPool: MAPS.map((item) => item.id),
    fixtures,
    standings: createStandings(teams),
    freeAgentSeq: 0,
    log: ['시즌 1이 개막했습니다. 다음 경기나 이번 주 전체 진행을 눌러 리그를 진행하세요.'],
    ended: false,
    championTeamId: '',
  };
}

export function normalizeState(value) {
  const base = createNewState();
  if (!value || typeof value !== 'object') return base;
  const teams = Array.isArray(value.teams) && value.teams.length ? value.teams.map(cloneTeam) : base.teams;
  const fixtures = Array.isArray(value.fixtures) && value.fixtures.length ? value.fixtures : generateSchedule(teams);
  return {
    ...base,
    ...value,
    teams,
    fixtures,
    standings: Array.isArray(value.standings) && value.standings.length ? value.standings : rebuildStandings(teams, fixtures),
    mapPool: Array.isArray(value.mapPool) && value.mapPool.length ? value.mapPool : base.mapPool,
    freeAgentSeq: Number(value.freeAgentSeq || 0),
    log: Array.isArray(value.log) ? value.log.slice(0, 90) : base.log,
  };
}

function createStandings(teams) {
  return teams.map((item) => ({
    teamId: item.id,
    wins: 0,
    losses: 0,
    mapWins: 0,
    mapLosses: 0,
    money: Number(item.money || 0),
    streak: 0,
  }));
}

function generateSchedule(teams) {
  const ids = teams.map((item) => item.id);
  const rotating = [...ids];
  const fixtures = [];
  const rounds = ids.length - 1;
  for (let round = 1; round <= rounds; round += 1) {
    for (let index = 0; index < ids.length / 2; index += 1) {
      const left = rotating[index];
      const right = rotating[rotating.length - 1 - index];
      const homeTeamId = round % 2 === 0 ? right : left;
      const awayTeamId = round % 2 === 0 ? left : right;
      fixtures.push({
        id: `R${round}-M${index + 1}`,
        round,
        homeTeamId,
        awayTeamId,
        played: false,
        result: null,
      });
    }
    rotating.splice(1, 0, rotating.pop());
  }
  return fixtures;
}

function rebuildStandings(teams, fixtures) {
  return fixtures.reduce((standings, fixture) => {
    if (!fixture.played || !fixture.result) return standings;
    return applyResultToStandings(standings, fixture.result);
  }, createStandings(teams));
}

function createRng(seed) {
  let hash = 2166136261;
  String(seed).split('').forEach((char) => {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  });
  return () => {
    hash += 0x6D2B79F5;
    let t = hash;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function statAverageFromStats(stats = {}) {
  return CAREER_STAT_KEYS.reduce((sum, key) => sum + Number(stats[key] || 0), 0) / CAREER_STAT_KEYS.length;
}

function normalizeTeamCareer(teamData) {
  const roster = Array.isArray(teamData.roster) ? teamData.roster : [];
  const rosterFame = roster.reduce((sum, member) => sum + Number(member.fame || 0), 0);
  const baseFan = Math.round(900 + rosterFame / Math.max(1, roster.length) * 5 + Math.max(0, teamPower(teamData)) * 2);
  const career = teamData.career && typeof teamData.career === 'object' ? teamData.career : {};
  return {
    sponsorTier: clamp(Number(career.sponsorTier || 1), 1, 6),
    fanBase: Math.max(0, Math.round(Number(career.fanBase || baseFan))),
    trainingLevel: clamp(Number(career.trainingLevel || 1), 1, 8),
    scoutingLevel: clamp(Number(career.scoutingLevel || 1), 1, 8),
    payrollPressure: Math.max(0, Math.round(Number(career.payrollPressure || calcTeamPayroll(teamData)))),
  };
}

function addStateLog(state, line) {
  return {
    ...state,
    log: [line, ...state.log].slice(0, 90),
  };
}

function syncTeamEconomy(state, teamId, updater) {
  const teamData = getTeam(state, teamId);
  const standing = getStanding(state, teamId);
  const currentMoney = Number(standing?.money ?? teamData.money ?? 0);
  const updatedTeam = updater({ ...teamData, money: currentMoney, career: normalizeTeamCareer(teamData) }, currentMoney);
  const nextMoney = Number(updatedTeam.money ?? currentMoney);
  return {
    ...state,
    teams: state.teams.map((item) => (item.id === teamId ? cloneTeam(updatedTeam) : item)),
    standings: state.standings.map((row) => (row.teamId === teamId ? { ...row, money: nextMoney } : row)),
    updatedAt: new Date().toISOString(),
  };
}

export function calcPlayerMarketValue(member) {
  const avg = statAverageFromStats(member?.stats || {});
  const fame = Number(member?.fame || 0);
  const salaryStep = Number(member?.salaryStep || 0);
  return clamp(Math.floor(avg * 0.82 + Number(member?.level || 1) * 24 + fame * 0.32 + salaryStep * 12), 60, 560);
}

export function calcTeamPayroll(teamData) {
  if (!Array.isArray(teamData?.roster)) return 0;
  return teamData.roster.reduce((sum, member) => sum + Math.max(10, Math.floor(calcPlayerMarketValue(member) * 0.22)), 0);
}

function rankedIndex(state, teamId) {
  return getTopTeams(state, state.teams.length).findIndex((row) => row.teamId === teamId);
}

function makeFreeAgentCandidate(state, teamId, seqOffset = 0) {
  const teamData = getTeam(state, teamId);
  const career = normalizeTeamCareer(teamData);
  const seq = Number(state.freeAgentSeq || 0) + seqOffset;
  const rng = createRng(`${state.runId}|fa|${state.seasonNo}|${state.week}|${teamId}|${seq}`);
  const nameParts = FREE_AGENT_NAMES[Math.floor(rng() * FREE_AGENT_NAMES.length) % FREE_AGENT_NAMES.length];
  const base = clamp(teamPower(teamData) + career.scoutingLevel * 10 + Math.round((rng() - 0.35) * 72), 420, 660);
  const race = ['T', 'Z', 'P'][Math.floor(rng() * 3) % 3];
  const level = clamp(3 + Math.floor((base - 420) / 45), 3, 8);
  const stats = CAREER_STAT_KEYS.reduce((acc, key, index) => {
    acc[key] = clamp(Math.round(base + (rng() - 0.5) * 58 + (index % 2 === 0 ? 8 : -4)), 260, 820);
    return acc;
  }, {});
  const candidate = {
    id: `fa-${state.seasonNo}-${state.week}-${teamId}-${seq + 1}`,
    name: `${nameParts[0]} ${nameParts[1]}`,
    race,
    level,
    condition: 92,
    fame: Math.round(80 + level * 32 + rng() * 180),
    salaryStep: 0,
    stats,
  };
  const marketValue = calcPlayerMarketValue(candidate);
  return {
    player: candidate,
    signingBonus: Math.max(110, Math.floor(marketValue * 0.62)),
    salary: Math.max(16, Math.floor(marketValue * 0.28)),
    yearsLeft: marketValue >= 320 || level >= 7 ? 3 : 2,
  };
}

export function getFreeAgentPreview(state, teamId) {
  const current = normalizeState(state);
  return makeFreeAgentCandidate(current, teamId, 0);
}

export function careerSummary(state, teamId) {
  const current = normalizeState(state);
  const teamData = getTeam(current, teamId);
  const career = normalizeTeamCareer(teamData);
  const standing = getStanding(current, teamId);
  const payroll = calcTeamPayroll(teamData);
  const preview = makeFreeAgentCandidate(current, teamId, 0);
  return {
    ...career,
    money: Number(standing?.money ?? teamData.money ?? 0),
    payroll,
    rosterValue: teamData.roster.reduce((sum, member) => sum + calcPlayerMarketValue(member), 0),
    freeAgentCost: preview.signingBonus,
    freeAgentName: preview.player.name,
    freeAgentRace: preview.player.race,
  };
}

function mapById(id) {
  return MAPS.find((item) => item.id === id) || MAPS[0];
}

export function getTeam(state, teamId) {
  return state.teams.find((item) => item.id === teamId) || state.teams[0];
}

export function teamName(state, teamId) {
  return getTeam(state, teamId)?.name || teamId;
}

function getStanding(state, teamId) {
  return state.standings.find((item) => item.teamId === teamId) || createStandings([getTeam(state, teamId)])[0];
}

function averageStats(member) {
  const stats = member.stats || {};
  return (
    Number(stats.attack || 0) * 1.1
    + Number(stats.defense || 0) * 0.85
    + Number(stats.strategy || 0)
    + Number(stats.sense || 0) * 0.95
    + Number(stats.macro || 0)
    + Number(stats.scout || 0) * 0.8
    + Number(stats.control || 0) * 1.1
    + Number(stats.harass || 0) * 0.85
  ) / 7.65;
}

function coachBonus(teamData, setNo) {
  if (teamData.coachStyle === 'aggressive') return setNo <= 2 ? 12 : 4;
  if (teamData.coachStyle === 'macro') return setNo >= 3 ? 10 : 2;
  if (teamData.coachStyle === 'mindgame') return setNo === 5 ? 16 : 5;
  return 7;
}

function playerPower(member, teamData, setNo, rng) {
  return averageStats(member)
    + Number(member.level || 0) * 14
    + Number(member.fame || 0) / 18
    + (Number(member.condition || 100) - 75) * 0.9
    + coachBonus(teamData, setNo)
    + (rng() - 0.5) * 96;
}

function lineupFor(teamData, fixtureId) {
  const offset = fixtureId.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const sorted = [...teamData.roster].sort((a, b) => (
    averageStats(b) + Number(b.level || 0) * 12 + Number(b.fame || 0) / 20
  ) - (
    averageStats(a) + Number(a.level || 0) * 12 + Number(a.fame || 0) / 20
  ));
  return Array.from({ length: 5 }, (_, index) => sorted[(index + offset) % sorted.length]);
}

function simulateSet({ state, fixture, homeTeam, awayTeam, homePlayer, awayPlayer, setNo, scoreHome, scoreAway }) {
  const mapIds = state.mapPool.length ? state.mapPool : MAPS.map((item) => item.id);
  const map = mapById(mapIds[(fixture.round + setNo - 2) % mapIds.length]);
  const rng = createRng(`${state.runId}|${fixture.id}|${setNo}|${scoreHome}-${scoreAway}`);
  const homePower = playerPower(homePlayer, homeTeam, setNo, rng);
  const awayPower = playerPower(awayPlayer, awayTeam, setNo, rng);
  const diff = homePower - awayPower;
  const pHome = clamp(0.5 + diff / 520, 0.14, 0.86);
  const homeWin = rng() < pHome;
  return {
    setNo,
    mapId: map.id,
    mapName: map.name,
    homePlayerId: homePlayer.id,
    homePlayerName: homePlayer.name,
    awayPlayerId: awayPlayer.id,
    awayPlayerName: awayPlayer.name,
    winnerTeamId: homeWin ? homeTeam.id : awayTeam.id,
    winnerPlayerId: homeWin ? homePlayer.id : awayPlayer.id,
    probabilityHome: Math.round(pHome * 100),
    durationSec: Math.round(clamp(640 + Math.abs(diff) * -0.45 + rng() * 460, 540, 1480)),
  };
}

function simulateFixture(state, fixture) {
  const homeTeam = getTeam(state, fixture.homeTeamId);
  const awayTeam = getTeam(state, fixture.awayTeamId);
  const homeLineup = lineupFor(homeTeam, fixture.id);
  const awayLineup = lineupFor(awayTeam, fixture.id);
  let scoreHome = 0;
  let scoreAway = 0;
  const sets = [];

  for (let setNo = 1; setNo <= 5 && scoreHome < 3 && scoreAway < 3; setNo += 1) {
    const setResult = simulateSet({
      state,
      fixture,
      homeTeam,
      awayTeam,
      homePlayer: homeLineup[(setNo - 1) % homeLineup.length],
      awayPlayer: awayLineup[(setNo - 1) % awayLineup.length],
      setNo,
      scoreHome,
      scoreAway,
    });
    sets.push(setResult);
    if (setResult.winnerTeamId === homeTeam.id) scoreHome += 1;
    else scoreAway += 1;
  }

  return {
    matchId: fixture.id,
    round: fixture.round,
    homeTeamId: homeTeam.id,
    awayTeamId: awayTeam.id,
    homeTeamName: homeTeam.name,
    awayTeamName: awayTeam.name,
    scoreHome,
    scoreAway,
    winnerTeamId: scoreHome > scoreAway ? homeTeam.id : awayTeam.id,
    loserTeamId: scoreHome > scoreAway ? awayTeam.id : homeTeam.id,
    sets,
    playedAt: Date.now(),
  };
}

function applyResultToStandings(standings, result) {
  return standings.map((row) => {
    if (row.teamId !== result.homeTeamId && row.teamId !== result.awayTeamId) return row;
    const isHome = row.teamId === result.homeTeamId;
    const mapFor = isHome ? result.scoreHome : result.scoreAway;
    const mapAgainst = isHome ? result.scoreAway : result.scoreHome;
    const won = row.teamId === result.winnerTeamId;
    return {
      ...row,
      wins: row.wins + (won ? 1 : 0),
      losses: row.losses + (won ? 0 : 1),
      mapWins: row.mapWins + mapFor,
      mapLosses: row.mapLosses + mapAgainst,
      money: Number(row.money || 0) + (won ? 150 : 70),
      streak: won ? Math.max(1, Number(row.streak || 0) + 1) : Math.min(-1, Number(row.streak || 0) - 1),
    };
  });
}

function tuneRosterAfterMatch(teams, result) {
  const playedWinners = new Set(result.sets.filter((setResult) => setResult.winnerTeamId === result.winnerTeamId).map((setResult) => setResult.winnerPlayerId));
  const playedPlayers = new Set(result.sets.flatMap((setResult) => [setResult.homePlayerId, setResult.awayPlayerId]));
  return teams.map((teamData) => ({
    ...teamData,
    roster: teamData.roster.map((member) => {
      const played = playedPlayers.has(member.id);
      const wonSet = playedWinners.has(member.id);
      return {
        ...member,
        condition: clamp(Number(member.condition || 100) + (played ? (wonSet ? -3 : -7) : 2), 35, 100),
        fame: Math.max(0, Number(member.fame || 0) + (wonSet ? 7 : played ? 2 : 0)),
      };
    }),
  }));
}

function advanceWeekIfNeeded(state) {
  const totalRounds = Math.max(...state.fixtures.map((fixture) => fixture.round));
  const currentRoundDone = state.fixtures
    .filter((fixture) => fixture.round === state.week)
    .every((fixture) => fixture.played);
  const allDone = state.fixtures.every((fixture) => fixture.played);

  if (allDone) {
    const leader = getTopTeams(state, 1)[0];
    return {
      ...state,
      ended: true,
      championTeamId: leader?.teamId || '',
      log: [`${leader?.teamName || '선두 팀'}이 시즌 ${state.seasonNo} 우승을 확정했습니다.`, ...state.log].slice(0, 90),
    };
  }

  if (currentRoundDone && state.week < totalRounds) {
    return {
      ...state,
      week: state.week + 1,
      log: [`${state.week + 1}주차 일정으로 넘어갔습니다.`, ...state.log].slice(0, 90),
    };
  }
  return state;
}

function addResultLog(state, result) {
  const winner = result.winnerTeamId === result.homeTeamId ? result.homeTeamName : result.awayTeamName;
  return {
    ...state,
    log: [
      `${result.round}주차 ${result.homeTeamName} ${result.scoreHome}:${result.scoreAway} ${result.awayTeamName} - ${winner} 승`,
      ...state.log,
    ].slice(0, 90),
  };
}

export function simulateNextMatchAction(state) {
  const current = normalizeState(state);
  if (current.ended) {
    return {
      ...current,
      log: ['이미 시즌이 종료됐습니다. 전적에 기록하거나 다음 시즌을 시작하세요.', ...current.log].slice(0, 90),
    };
  }
  const fixture = current.fixtures.find((item) => item.round === current.week && !item.played)
    || current.fixtures.find((item) => !item.played);
  if (!fixture) return advanceWeekIfNeeded(current);

  const result = simulateFixture(current, fixture);
  let next = {
    ...current,
    fixtures: current.fixtures.map((item) => (
      item.id === fixture.id ? { ...item, played: true, result } : item
    )),
    standings: applyResultToStandings(current.standings, result),
    teams: tuneRosterAfterMatch(current.teams, result),
    updatedAt: new Date().toISOString(),
  };
  next = addResultLog(next, result);
  return advanceWeekIfNeeded(next);
}

export function simulateWeekAction(state) {
  let next = normalizeState(state);
  const targetWeek = next.week;
  while (!next.ended && next.fixtures.some((fixture) => fixture.round === targetWeek && !fixture.played)) {
    next = simulateNextMatchAction(next);
  }
  return next;
}

export function negotiateSponsorAction(state, teamId) {
  const current = normalizeState(state);
  if (current.ended) return addStateLog(current, '시즌 종료 후에는 스폰서 협상을 진행할 수 없습니다.');
  const teamData = getTeam(current, teamId);
  const rank = rankedIndex(current, teamId);
  const career = normalizeTeamCareer(teamData);
  const rankBonus = Math.max(0, current.teams.length - Math.max(0, rank)) * 14;
  const gain = Math.round(170 + career.sponsorTier * 85 + career.fanBase / 70 + rankBonus);
  const fanGain = Math.round(80 + career.sponsorTier * 25 + Math.max(0, teamPower(teamData) - 480) * 0.6);
  const tierGain = rank >= 0 && rank <= 2 && career.sponsorTier < 6 ? 1 : 0;
  const next = syncTeamEconomy(current, teamId, (team) => ({
    ...team,
    money: Number(team.money || 0) + gain,
    career: {
      ...career,
      sponsorTier: clamp(career.sponsorTier + tierGain, 1, 6),
      fanBase: career.fanBase + fanGain,
    },
  }));
  return addStateLog(next, `${teamData.name} 스폰서 협상: +${gain} Cr, 팬 +${fanGain}${tierGain ? ', 스폰서 등급 상승' : ''}`);
}

export function investTrainingAction(state, teamId) {
  const current = normalizeState(state);
  if (current.ended) return addStateLog(current, '시즌 종료 후에는 훈련 투자를 진행할 수 없습니다.');
  const teamData = getTeam(current, teamId);
  const career = normalizeTeamCareer(teamData);
  const standing = getStanding(current, teamId);
  const money = Number(standing?.money ?? teamData.money ?? 0);
  const cost = Math.round(150 + career.trainingLevel * 95 + teamData.roster.length * 8);
  if (money < cost) {
    return addStateLog(current, `${teamData.name} 훈련 투자 실패: ${cost} Cr 필요, 보유 ${money} Cr`);
  }
  const statGain = 2 + Math.floor(career.trainingLevel / 2);
  const next = syncTeamEconomy(current, teamId, (team) => ({
    ...team,
    money: Number(team.money || 0) - cost,
    career: {
      ...career,
      trainingLevel: clamp(career.trainingLevel + 1, 1, 8),
    },
    roster: team.roster.map((member, index) => ({
      ...member,
      condition: clamp(Number(member.condition || 100) + 8, 0, 100),
      fame: Number(member.fame || 0) + (index < 5 ? 5 : 2),
      stats: CAREER_STAT_KEYS.reduce((acc, key) => {
        acc[key] = clamp(Number(member.stats?.[key] || 0) + statGain + (index < 5 ? 1 : 0), 0, 1000);
        return acc;
      }, {}),
    })),
  }));
  return addStateLog(next, `${teamData.name} 훈련 투자: -${cost} Cr, 훈련 Lv.${clamp(career.trainingLevel + 1, 1, 8)}`);
}

export function signFreeAgentAction(state, teamId) {
  const current = normalizeState(state);
  if (current.ended) return addStateLog(current, '시즌 종료 후에는 FA 영입을 진행할 수 없습니다.');
  const teamData = getTeam(current, teamId);
  const standing = getStanding(current, teamId);
  const money = Number(standing?.money ?? teamData.money ?? 0);
  if (teamData.roster.length >= 12) {
    return addStateLog(current, `${teamData.name} FA 영입 실패: 로스터가 가득 찼습니다.`);
  }
  const offer = makeFreeAgentCandidate(current, teamId, 0);
  if (money < offer.signingBonus) {
    return addStateLog(current, `${teamData.name} FA 영입 실패: ${offer.player.name} 계약금 ${offer.signingBonus} Cr 필요`);
  }
  const career = normalizeTeamCareer(teamData);
  const next = syncTeamEconomy(
    {
      ...current,
      freeAgentSeq: Number(current.freeAgentSeq || 0) + 1,
    },
    teamId,
    (team) => ({
      ...team,
      money: Number(team.money || 0) - offer.signingBonus,
      career: {
        ...career,
        scoutingLevel: clamp(career.scoutingLevel + 1, 1, 8),
        fanBase: career.fanBase + Math.round(offer.player.fame / 4),
        payrollPressure: calcTeamPayroll({ ...team, roster: [...team.roster, offer.player] }) + offer.salary,
      },
      roster: [...team.roster, offer.player],
    }),
  );
  return addStateLog(next, `${teamData.name} FA 영입: ${offer.player.name} 계약금 -${offer.signingBonus} Cr, 연봉 ${offer.salary} Cr/${offer.yearsLeft}년`);
}

export function startNextSeasonAction(state) {
  const current = normalizeState(state);
  const next = createNewState();
  const carriedTeams = current.teams.map((teamData) => {
    const career = normalizeTeamCareer(teamData);
    const standing = getStanding(current, teamData.id);
    const payroll = calcTeamPayroll(teamData);
    const moneyAfterPayroll = Number(standing?.money ?? teamData.money ?? 0) - payroll;
    return cloneTeam({
      ...teamData,
      money: moneyAfterPayroll,
      career: {
        ...career,
        fanBase: Math.round(career.fanBase * 1.04),
        payrollPressure: payroll,
      },
      roster: teamData.roster.map((member) => ({
        ...member,
        condition: clamp(Number(member.condition || 100) + (moneyAfterPayroll >= 0 ? 18 : -8), 30, 100),
        fame: Math.max(0, Number(member.fame || 0) + (current.championTeamId === teamData.id ? 24 : 8)),
      })),
    });
  });
  const fixtures = generateSchedule(carriedTeams);
  return {
    ...next,
    runId: current.runId,
    startedAt: current.startedAt,
    seasonNo: Number(current.seasonNo || 1) + 1,
    teams: carriedTeams,
    fixtures,
    standings: createStandings(carriedTeams),
    freeAgentSeq: Number(current.freeAgentSeq || 0),
    log: [`시즌 ${Number(current.seasonNo || 1) + 1}이 새로 시작됐습니다.`, ...current.log].slice(0, 90),
  };
}

export function getTopTeams(state, limit = 10) {
  const current = normalizeState(state);
  return current.standings
    .map((row) => {
      const teamData = getTeam(current, row.teamId);
      return {
        ...row,
        teamName: teamData.name,
        coach: teamData.coach,
        diff: Number(row.mapWins || 0) - Number(row.mapLosses || 0),
      };
    })
    .sort((a, b) => (
      b.wins - a.wins
      || b.diff - a.diff
      || b.mapWins - a.mapWins
      || a.teamName.localeCompare(b.teamName, 'ko-KR')
    ))
    .slice(0, limit);
}

export function getCurrentFixtures(state) {
  const current = normalizeState(state);
  return current.fixtures.filter((fixture) => fixture.round === current.week);
}

export function fixtureLabel(state, fixture) {
  const result = fixture.result;
  if (!result) return `${teamName(state, fixture.homeTeamId)} vs ${teamName(state, fixture.awayTeamId)}`;
  return `${result.homeTeamName} ${result.scoreHome}:${result.scoreAway} ${result.awayTeamName}`;
}

export function getPlayedCount(state) {
  return normalizeState(state).fixtures.filter((fixture) => fixture.played).length;
}

export function getTotalFixtureCount(state) {
  return normalizeState(state).fixtures.length;
}

export function scoreState(state) {
  const current = normalizeState(state);
  const leader = getTopTeams(current, 1)[0];
  const careerScore = current.teams.reduce((sum, teamData) => {
    const career = normalizeTeamCareer(teamData);
    return sum + career.sponsorTier * 80 + career.trainingLevel * 55 + career.scoutingLevel * 45 + career.fanBase / 90;
  }, 0);
  return Math.max(0, Math.round(
    getPlayedCount(current) * 35
    + Number(leader?.wins || 0) * 180
    + Number(leader?.diff || 0) * 24
    + current.standings.reduce((sum, row) => sum + Number(row.money || 0), 0) / 12
    + careerScore
  ));
}

export function getPlayTimeSec(state) {
  const start = new Date(state.startedAt || '').getTime();
  if (!Number.isFinite(start)) return 0;
  return Math.max(0, Math.floor((Date.now() - start) / 1000));
}

export function summaryForState(state) {
  const current = normalizeState(state);
  const leader = getTopTeams(current, 1)[0];
  return {
    seasonNo: current.seasonNo,
    week: current.week,
    played: getPlayedCount(current),
    total: getTotalFixtureCount(current),
    leader: leader?.teamName || '',
    champion: current.championTeamId ? teamName(current, current.championTeamId) : '',
    teams: current.teams.length,
    careerValue: Math.round(current.teams.reduce((sum, teamData) => {
      const career = normalizeTeamCareer(teamData);
      return sum + career.fanBase + career.sponsorTier * 250 + career.trainingLevel * 180 + career.scoutingLevel * 140;
    }, 0)),
    score: scoreState(current),
  };
}

export function teamPower(teamData) {
  if (!teamData?.roster?.length) return 0;
  const sorted = [...teamData.roster]
    .sort((a, b) => averageStats(b) - averageStats(a))
    .slice(0, 5);
  return Math.round(sorted.reduce((sum, member) => sum + averageStats(member), 0) / sorted.length);
}
