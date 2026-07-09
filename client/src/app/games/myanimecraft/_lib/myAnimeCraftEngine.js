import {
  RACE_LABELS,
  MAPS,
  BUILD_STYLE_LABELS,
  BUILD_STYLE_KEYS,
  BUILD_DEFS,
  CAREER_STAT_KEYS,
  FREE_AGENT_NAMES,
  ECON_TAG_LABELS,
  EQUIPMENT_SLOT_LABELS,
  ITEM_DEFS,
  TEAM_ACTION_DEFS,
  PERSONAL_ROUND_LABELS,
  PERSONAL_PHASE_LABELS,
  POSTSEASON_LABELS,
  POSTSEASON_PRIZES,
  TEAM_BLUEPRINTS,
} from './myAnimeCraftData';

export {
  GAME_SLUG,
  QUICK_SAVE_SLOT,
  SAVE_VERSION,
  RACE_LABELS,
  MAPS,
  BUILD_STYLE_LABELS,
  BUILD_STYLE_KEYS,
  BUILD_DEFS,
  CAREER_STAT_KEYS,
  FREE_AGENT_NAMES,
  ECON_TAG_LABELS,
  EQUIPMENT_SLOT_LABELS,
  ITEM_DEFS,
  TEAM_ACTION_DEFS,
  PERSONAL_ROUND_LABELS,
  PERSONAL_PHASE_LABELS,
  POSTSEASON_LABELS,
  POSTSEASON_PRIZES,
  TEAM_BLUEPRINTS,
} from './myAnimeCraftData';

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

function itemById(itemId) {
  return ITEM_DEFS.find((item) => item.id === itemId) || null;
}

function equipmentSlotOfKind(kind) {
  if (kind === 'keyboard') return 'keyboard';
  if (kind === 'mouse') return 'mouse';
  if (kind === 'monitor') return 'monitor';
  if (kind === 'gear') return 'gear';
  return null;
}

function normalizeInventoryEntry(entry, teamId) {
  const items = Array.isArray(entry?.items)
    ? entry.items
      .filter((item) => item && itemById(item.itemId))
      .map((item) => ({
        itemId: item.itemId,
        qty: clamp(Math.floor(Number(item.qty || 0)), 0, 9999),
      }))
      .filter((item) => item.qty > 0)
    : [];
  const equipped = entry?.equipped && typeof entry.equipped === 'object' ? entry.equipped : {};
  return {
    teamId,
    items,
    equipped: Object.fromEntries(Object.entries(equipped).map(([playerId, slots]) => [
      playerId,
      Object.fromEntries(Object.entries(slots || {}).filter(([, itemId]) => {
        const item = itemById(itemId);
        return item && equipmentSlotOfKind(item.kind);
      })),
    ])),
  };
}

function createInventories(teams, existing = []) {
  const source = Array.isArray(existing) ? existing : [];
  return teams.map((teamData) => {
    const previous = source.find((item) => item?.teamId === teamData.id);
    return normalizeInventoryEntry(previous, teamData.id);
  });
}

function shopWeek(stateLike) {
  return Number(stateLike?.week || 1);
}

function buildShopOffers(seedBase, seasonNo, week) {
  const rng = createRng(`${seedBase}|shop|s${seasonNo}|w${week}`);
  const byKind = ['consumable', 'keyboard', 'mouse', 'monitor', 'gear'].map((kind) => {
    const pool = ITEM_DEFS.filter((item) => item.kind === kind);
    return pool[Math.floor(rng() * pool.length) % pool.length];
  }).filter(Boolean);
  const extras = [...ITEM_DEFS]
    .sort((a, b) => {
      const aRoll = createRng(`${seedBase}|${seasonNo}|${week}|${a.id}`)();
      const bRoll = createRng(`${seedBase}|${seasonNo}|${week}|${b.id}`)();
      return aRoll - bRoll;
    })
    .filter((item) => !byKind.some((picked) => picked.id === item.id))
    .slice(0, 3);
  const picked = [...byKind, ...extras].slice(0, 8);
  const featuredId = picked.length ? picked[Math.floor(rng() * picked.length) % picked.length].id : '';
  return picked.map((item) => {
    const salePct = item.id === featuredId ? Math.floor(20 + rng() * 26) : (rng() < 0.25 ? Math.floor(10 + rng() * 31) : 0);
    const price = Math.max(1, Math.floor(item.price * (100 - salePct) / 100));
    const stock = item.kind === 'consumable' ? Math.floor(3 + rng() * 4) : Math.floor(1 + rng() * 2);
    return {
      offerId: `offer-${seasonNo}-${week}-${item.id}`,
      itemId: item.id,
      basePrice: item.price,
      price,
      stock: item.id === featuredId ? stock + 2 : stock,
      salePct,
      featured: item.id === featuredId,
    };
  });
}

function ensureShop(state) {
  const seasonNo = Number(state.seasonNo || 1);
  const week = shopWeek(state);
  const shop = state.shop && typeof state.shop === 'object' ? state.shop : null;
  if (!shop || Number(shop.seasonNo) !== seasonNo || Number(shop.week) !== week || !Array.isArray(shop.offers)) {
    return {
      seasonNo,
      week,
      offers: buildShopOffers(state.runId || 'starleague', seasonNo, week),
      lastRerollAt: Date.now(),
    };
  }
  return {
    ...shop,
    seasonNo,
    week,
    offers: shop.offers
      .filter((offer) => offer && itemById(offer.itemId))
      .map((offer) => ({
        offerId: String(offer.offerId || `offer-${seasonNo}-${week}-${offer.itemId}`),
        itemId: offer.itemId,
        basePrice: Math.max(1, Math.floor(Number(offer.basePrice || itemById(offer.itemId)?.price || 1))),
        price: Math.max(1, Math.floor(Number(offer.price || itemById(offer.itemId)?.price || 1))),
        stock: clamp(Math.floor(Number(offer.stock || 0)), 0, 99),
        salePct: Math.max(0, Math.floor(Number(offer.salePct || 0))),
        featured: Boolean(offer.featured),
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

function createEmptyPersonalLeague(seasonNo = 1) {
  return {
    seasonNo: Number(seasonNo || 1),
    format: 'V2',
    stage: 'NOT_STARTED',
    phase: '대기',
    currentRound: 0,
    participants: [],
    matches: [],
    stageReports: [],
    championPlayerId: '',
    runnerUpPlayerId: '',
    updatedAt: 0,
  };
}

function createEmptyWinnersLeague(seasonNo = 1) {
  return {
    seasonNo: Number(seasonNo || 1),
    stage: 'NOT_STARTED',
    homeTeamId: '',
    awayTeamId: '',
    scoreHome: 0,
    scoreAway: 0,
    currentHomePlayerId: '',
    currentAwayPlayerId: '',
    usedHomePlayerIds: [],
    usedAwayPlayerIds: [],
    sets: [],
    championTeamId: '',
    runnerUpTeamId: '',
    updatedAt: 0,
  };
}

function normalizePersonalParticipant(value) {
  if (!value || typeof value !== 'object') return null;
  const playerId = String(value.playerId || '').trim();
  const teamId = String(value.teamId || '').trim();
  if (!playerId || !teamId) return null;
  return {
    seed: Math.max(1, Math.floor(Number(value.seed || 1))),
    playerId,
    playerName: String(value.playerName || playerId),
    teamId,
    teamName: String(value.teamName || teamId),
    race: String(value.race || ''),
    rating: Math.round(Number(value.rating || 0)),
    formScore: Math.round(Number(value.formScore || 0)),
    seedTier: String(value.seedTier || ''),
  };
}

function normalizeTimelineLine(value) {
  if (!value || typeof value !== 'object') return null;
  const text = String(value.text || '').trim();
  if (!text) return null;
  return {
    t: Math.max(0, Math.floor(Number(value.t || 0))),
    caster: String(value.caster || '중계'),
    text,
  };
}

function normalizeSetTimeline(value) {
  return Array.isArray(value)
    ? value.map(normalizeTimelineLine).filter(Boolean).slice(0, 18)
    : [];
}

function normalizePersonalSetDetail(value) {
  if (!value || typeof value !== 'object') return null;
  return {
    setNo: Math.max(1, Math.floor(Number(value.setNo || 1))),
    mapId: String(value.mapId || ''),
    mapName: String(value.mapName || ''),
    homePlayerId: String(value.homePlayerId || ''),
    homePlayerName: String(value.homePlayerName || ''),
    awayPlayerId: String(value.awayPlayerId || ''),
    awayPlayerName: String(value.awayPlayerName || ''),
    winnerId: String(value.winnerId || ''),
    winnerName: String(value.winnerName || ''),
    homeBuildName: String(value.homeBuildName || ''),
    awayBuildName: String(value.awayBuildName || ''),
    homeBuildStyle: String(value.homeBuildStyle || ''),
    awayBuildStyle: String(value.awayBuildStyle || ''),
    homeBuildReason: String(value.homeBuildReason || ''),
    awayBuildReason: String(value.awayBuildReason || ''),
    homeBuildPickShare: Math.max(0, Math.round(Number(value.homeBuildPickShare || 0))),
    awayBuildPickShare: Math.max(0, Math.round(Number(value.awayBuildPickShare || 0))),
    homeBuildMetaBias: Math.round(Number(value.homeBuildMetaBias || 0) * 10) / 10,
    awayBuildMetaBias: Math.round(Number(value.awayBuildMetaBias || 0) * 10) / 10,
    homeBuildMapFit: Math.round(Number(value.homeBuildMapFit || 0) * 10) / 10,
    awayBuildMapFit: Math.round(Number(value.awayBuildMapFit || 0) * 10) / 10,
    broadcastHeadline: String(value.broadcastHeadline || ''),
    turningPoint: String(value.turningPoint || ''),
    durationSec: Math.max(0, Math.floor(Number(value.durationSec || 0))),
    timeline: normalizeSetTimeline(value.timeline),
  };
}

function normalizePersonalStageReport(value) {
  if (!value || typeof value !== 'object') return null;
  const phase = String(value.phase || '').trim();
  if (!phase) return null;
  return {
    phase,
    label: String(value.label || PERSONAL_PHASE_LABELS[phase] || phase),
    summary: String(value.summary || ''),
    entrantCount: Math.max(0, Math.floor(Number(value.entrantCount || 0))),
    qualifierPlayerIds: Array.isArray(value.qualifierPlayerIds) ? value.qualifierPlayerIds.map(String).slice(0, 64) : [],
    qualifierNames: Array.isArray(value.qualifierNames) ? value.qualifierNames.map(String).slice(0, 64) : [],
    profileText: String(value.profileText || ''),
    seedText: String(value.seedText || ''),
    upsetText: String(value.upsetText || ''),
    topSeedNames: Array.isArray(value.topSeedNames) ? value.topSeedNames.map(String).slice(0, 8) : [],
    upsetNames: Array.isArray(value.upsetNames) ? value.upsetNames.map(String).slice(0, 8) : [],
    averageEntrantRating: Math.round(Number(value.averageEntrantRating || 0)),
    averageQualifierRating: Math.round(Number(value.averageQualifierRating || 0)),
    averageQualifierForm: Math.round(Number(value.averageQualifierForm || 0)),
    playedAt: Number(value.playedAt || Date.now()),
  };
}

function normalizePersonalMatch(value) {
  if (!value || typeof value !== 'object') return null;
  const playerAId = String(value.playerAId || '').trim();
  const playerBId = String(value.playerBId || '').trim();
  if (!playerAId || !playerBId) return null;
  return {
    id: String(value.id || `personal-${Date.now().toString(36)}`),
    round: Math.max(1, Math.floor(Number(value.round || 1))),
    bracketIndex: Math.max(0, Math.floor(Number(value.bracketIndex || 0))),
    playerAId,
    playerBId,
    scoreA: Math.max(0, Math.floor(Number(value.scoreA || 0))),
    scoreB: Math.max(0, Math.floor(Number(value.scoreB || 0))),
    winnerId: String(value.winnerId || ''),
    setWinners: Array.isArray(value.setWinners) ? value.setWinners.map(String).slice(0, 5) : [],
    mapNames: Array.isArray(value.mapNames) ? value.mapNames.map(String).slice(0, 5) : [],
    setDetails: Array.isArray(value.setDetails) ? value.setDetails.map(normalizePersonalSetDetail).filter(Boolean).slice(0, 5) : [],
    played: Boolean(value.played),
    playedAt: Number(value.playedAt || 0),
  };
}

function normalizePersonalLeague(value, seasonNo = 1) {
  const targetSeason = Number(seasonNo || 1);
  if (!value || typeof value !== 'object' || Number(value.seasonNo || targetSeason) !== targetSeason) {
    return createEmptyPersonalLeague(targetSeason);
  }
  const stage = ['NOT_STARTED', 'IN_PROGRESS', 'DONE'].includes(value.stage) ? value.stage : 'NOT_STARTED';
  const participants = Array.isArray(value.participants)
    ? value.participants.map(normalizePersonalParticipant).filter(Boolean).slice(0, 64)
    : [];
  const matches = Array.isArray(value.matches)
    ? value.matches.map(normalizePersonalMatch).filter(Boolean).slice(0, 80)
    : [];
  const format = ['LEGACY16', 'V2'].includes(value.format) ? value.format : 'V2';
  return {
    ...createEmptyPersonalLeague(targetSeason),
    ...value,
    seasonNo: targetSeason,
    format,
    stage,
    phase: String(value.phase || (stage === 'NOT_STARTED' ? '대기' : '16강')),
    currentRound: Math.max(0, Math.floor(Number(value.currentRound || 0))),
    participants,
    matches,
    stageReports: Array.isArray(value.stageReports) ? value.stageReports.map(normalizePersonalStageReport).filter(Boolean).slice(0, 20) : [],
    championPlayerId: String(value.championPlayerId || ''),
    runnerUpPlayerId: String(value.runnerUpPlayerId || ''),
    updatedAt: Number(value.updatedAt || 0),
  };
}

function normalizeWinnersSet(value) {
  if (!value || typeof value !== 'object') return null;
  return {
    id: String(value.id || `winners-${Date.now().toString(36)}`),
    setNo: Math.max(1, Math.floor(Number(value.setNo || 1))),
    mapName: String(value.mapName || ''),
    homePlayerId: String(value.homePlayerId || ''),
    homePlayerName: String(value.homePlayerName || ''),
    awayPlayerId: String(value.awayPlayerId || ''),
    awayPlayerName: String(value.awayPlayerName || ''),
    winnerTeamId: String(value.winnerTeamId || ''),
    winnerTeamName: String(value.winnerTeamName || ''),
    winnerPlayerId: String(value.winnerPlayerId || ''),
    winnerPlayerName: String(value.winnerPlayerName || ''),
    probabilityHome: Math.round(Number(value.probabilityHome || 0)),
    durationSec: Math.max(0, Math.floor(Number(value.durationSec || 0))),
    mapId: String(value.mapId || ''),
    homeBuildName: String(value.homeBuildName || ''),
    awayBuildName: String(value.awayBuildName || ''),
    homeBuildStyle: String(value.homeBuildStyle || ''),
    awayBuildStyle: String(value.awayBuildStyle || ''),
    homeBuildReason: String(value.homeBuildReason || ''),
    awayBuildReason: String(value.awayBuildReason || ''),
    homeBuildPickShare: Math.max(0, Math.round(Number(value.homeBuildPickShare || 0))),
    awayBuildPickShare: Math.max(0, Math.round(Number(value.awayBuildPickShare || 0))),
    homeBuildMetaBias: Math.round(Number(value.homeBuildMetaBias || 0) * 10) / 10,
    awayBuildMetaBias: Math.round(Number(value.awayBuildMetaBias || 0) * 10) / 10,
    homeBuildMapFit: Math.round(Number(value.homeBuildMapFit || 0) * 10) / 10,
    awayBuildMapFit: Math.round(Number(value.awayBuildMapFit || 0) * 10) / 10,
    broadcastHeadline: String(value.broadcastHeadline || ''),
    turningPoint: String(value.turningPoint || ''),
    timeline: normalizeSetTimeline(value.timeline),
    playedAt: Number(value.playedAt || Date.now()),
  };
}

function normalizeWinnersLeague(value, seasonNo = 1) {
  const targetSeason = Number(seasonNo || 1);
  if (!value || typeof value !== 'object' || Number(value.seasonNo || targetSeason) !== targetSeason) {
    return createEmptyWinnersLeague(targetSeason);
  }
  const stage = ['NOT_STARTED', 'IN_PROGRESS', 'DONE'].includes(value.stage) ? value.stage : 'NOT_STARTED';
  return {
    ...createEmptyWinnersLeague(targetSeason),
    ...value,
    seasonNo: targetSeason,
    stage,
    homeTeamId: String(value.homeTeamId || ''),
    awayTeamId: String(value.awayTeamId || ''),
    scoreHome: Math.max(0, Math.floor(Number(value.scoreHome || 0))),
    scoreAway: Math.max(0, Math.floor(Number(value.scoreAway || 0))),
    currentHomePlayerId: String(value.currentHomePlayerId || ''),
    currentAwayPlayerId: String(value.currentAwayPlayerId || ''),
    usedHomePlayerIds: Array.isArray(value.usedHomePlayerIds) ? value.usedHomePlayerIds.map(String).slice(0, 12) : [],
    usedAwayPlayerIds: Array.isArray(value.usedAwayPlayerIds) ? value.usedAwayPlayerIds.map(String).slice(0, 12) : [],
    sets: Array.isArray(value.sets) ? value.sets.map(normalizeWinnersSet).filter(Boolean).slice(0, 20) : [],
    championTeamId: String(value.championTeamId || ''),
    runnerUpTeamId: String(value.runnerUpTeamId || ''),
    updatedAt: Number(value.updatedAt || 0),
  };
}

function normalizePersonalHistory(history) {
  if (!Array.isArray(history)) return [];
  return history
    .filter((entry) => entry && typeof entry === 'object')
    .map((entry) => ({
      seasonNo: Number(entry.seasonNo || 1),
      championPlayerId: String(entry.championPlayerId || ''),
      championPlayerName: String(entry.championPlayerName || ''),
      championTeamId: String(entry.championTeamId || ''),
      championTeamName: String(entry.championTeamName || ''),
      runnerUpPlayerId: String(entry.runnerUpPlayerId || ''),
      runnerUpPlayerName: String(entry.runnerUpPlayerName || ''),
      runnerUpTeamName: String(entry.runnerUpTeamName || ''),
      played: Math.max(0, Math.floor(Number(entry.played || 0))),
      at: Number(entry.at || Date.now()),
    }))
    .slice(0, 40);
}

function normalizeWinnersHistory(history) {
  if (!Array.isArray(history)) return [];
  return history
    .filter((entry) => entry && typeof entry === 'object')
    .map((entry) => ({
      seasonNo: Number(entry.seasonNo || 1),
      championTeamId: String(entry.championTeamId || ''),
      championTeamName: String(entry.championTeamName || ''),
      runnerUpTeamId: String(entry.runnerUpTeamId || ''),
      runnerUpTeamName: String(entry.runnerUpTeamName || ''),
      scoreHome: Math.max(0, Math.floor(Number(entry.scoreHome || 0))),
      scoreAway: Math.max(0, Math.floor(Number(entry.scoreAway || 0))),
      allKillPlayerName: String(entry.allKillPlayerName || ''),
      sets: Math.max(0, Math.floor(Number(entry.sets || 0))),
      at: Number(entry.at || Date.now()),
    }))
    .slice(0, 40);
}

export function createNewState(options = {}) {
  const now = options.now || new Date().toISOString();
  const runId = options.runId || `sl-${Date.now().toString(36)}`;
  const teams = TEAM_BLUEPRINTS.map(cloneTeam);
  const fixtures = generateSchedule(teams);
  const contracts = ensureContractsForTeams(teams, {}, 1);
  const state = {
    runId,
    startedAt: now,
    updatedAt: now,
    seasonNo: 1,
    week: 1,
    teams,
    mapPool: MAPS.map((item) => item.id),
    fixtures,
    standings: createStandings(teams),
    contracts,
    inventories: createInventories(teams),
    shop: null,
    econLogs: [],
    teamActionsUsed: {},
    seasonReports: [],
    postseasonFixtures: [],
    postseasonPrizesAwarded: false,
    personalLeague: createEmptyPersonalLeague(1),
    personalHistory: [],
    winnersLeague: createEmptyWinnersLeague(1),
    winnersHistory: [],
    freeAgentSeq: 0,
    log: ['시즌 1이 개막했습니다. 다음 경기나 이번 주 전체 진행을 눌러 리그를 진행하세요.'],
    ended: false,
    championTeamId: '',
  };
  return {
    ...state,
    shop: ensureShop(state),
  };
}

export function normalizeState(value) {
  const base = createNewState();
  if (!value || typeof value !== 'object') return base;
  const teams = Array.isArray(value.teams) && value.teams.length ? value.teams.map(cloneTeam) : base.teams;
  const fixtures = Array.isArray(value.fixtures) && value.fixtures.length ? value.fixtures : generateSchedule(teams);
  const seasonNo = Number(value.seasonNo || base.seasonNo || 1);
  const merged = {
    ...base,
    ...value,
    teams,
    fixtures,
    contracts: ensureContractsForTeams(teams, value.contracts, seasonNo),
    inventories: createInventories(teams, value.inventories),
    econLogs: normalizeEconLogs(value.econLogs),
    teamActionsUsed: value.teamActionsUsed && typeof value.teamActionsUsed === 'object' ? value.teamActionsUsed : base.teamActionsUsed,
    seasonReports: Array.isArray(value.seasonReports) ? value.seasonReports.slice(0, 60) : base.seasonReports,
    postseasonFixtures: normalizePostseasonFixtures(value.postseasonFixtures),
    postseasonPrizesAwarded: Boolean(value.postseasonPrizesAwarded),
    personalLeague: normalizePersonalLeague(value.personalLeague, seasonNo),
    personalHistory: normalizePersonalHistory(value.personalHistory),
    winnersLeague: normalizeWinnersLeague(value.winnersLeague, seasonNo),
    winnersHistory: normalizeWinnersHistory(value.winnersHistory),
    standings: Array.isArray(value.standings) && value.standings.length ? value.standings : rebuildStandings(teams, fixtures),
    mapPool: Array.isArray(value.mapPool) && value.mapPool.length ? value.mapPool : base.mapPool,
    freeAgentSeq: Number(value.freeAgentSeq || 0),
    log: Array.isArray(value.log) ? value.log.slice(0, 90) : base.log,
  };
  return {
    ...merged,
    shop: ensureShop(merged),
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

function normalizePostseasonFixtures(fixtures) {
  if (!Array.isArray(fixtures)) return [];
  return fixtures
    .filter((fixture) => fixture && typeof fixture === 'object')
    .map((fixture, index) => ({
      id: String(fixture.id || `PO-${index + 1}`),
      round: Math.max(1, Math.floor(Number(fixture.round || index + 1))),
      label: String(fixture.label || POSTSEASON_LABELS[Number(fixture.round || index + 1)] || `포스트시즌 ${index + 1}`),
      homeTeamId: String(fixture.homeTeamId || ''),
      awayTeamId: String(fixture.awayTeamId || ''),
      played: Boolean(fixture.played),
      result: fixture.result || null,
    }))
    .sort((a, b) => a.round - b.round);
}

function createPostseasonFixtures(state) {
  const top = getTopTeams(state, 4);
  if (top.length < 2) return [];
  if (top.length === 2) {
    return [{
      id: `PO-S${state.seasonNo}-R1`,
      round: 1,
      label: POSTSEASON_LABELS[3],
      homeTeamId: top[0].teamId,
      awayTeamId: top[1].teamId,
      played: false,
      result: null,
    }];
  }
  if (top.length === 3) {
    return [
      {
        id: `PO-S${state.seasonNo}-R1`,
        round: 1,
        label: POSTSEASON_LABELS[2],
        homeTeamId: top[1].teamId,
        awayTeamId: top[2].teamId,
        played: false,
        result: null,
      },
      {
        id: `PO-S${state.seasonNo}-R2`,
        round: 2,
        label: POSTSEASON_LABELS[3],
        homeTeamId: top[0].teamId,
        awayTeamId: '__TBD__',
        played: false,
        result: null,
      },
    ];
  }
  return [
    {
      id: `PO-S${state.seasonNo}-R1`,
      round: 1,
      label: POSTSEASON_LABELS[1],
      homeTeamId: top[2].teamId,
      awayTeamId: top[3].teamId,
      played: false,
      result: null,
    },
    {
      id: `PO-S${state.seasonNo}-R2`,
      round: 2,
      label: POSTSEASON_LABELS[2],
      homeTeamId: top[1].teamId,
      awayTeamId: '__TBD__',
      played: false,
      result: null,
    },
    {
      id: `PO-S${state.seasonNo}-R3`,
      round: 3,
      label: POSTSEASON_LABELS[3],
      homeTeamId: top[0].teamId,
      awayTeamId: '__TBD__',
      played: false,
      result: null,
    },
  ];
}

function isRegularSeasonComplete(state) {
  return state.fixtures.length > 0 && state.fixtures.every((fixture) => fixture.played);
}

function nextPostseasonFixture(state) {
  return normalizePostseasonFixtures(state.postseasonFixtures)
    .find((fixture) => !fixture.played && fixture.homeTeamId && fixture.awayTeamId && fixture.homeTeamId !== '__TBD__' && fixture.awayTeamId !== '__TBD__');
}

function advancePostseasonBracket(fixtures, result) {
  const currentRound = Number(fixtures.find((fixture) => fixture.id === result.matchId)?.round || result.round || 1);
  return normalizePostseasonFixtures(fixtures).map((fixture) => {
    if (fixture.id === result.matchId) return { ...fixture, played: true, result };
    if (!fixture.played && Number(fixture.round) === currentRound + 1 && fixture.awayTeamId === '__TBD__') {
      return { ...fixture, awayTeamId: result.winnerTeamId };
    }
    return fixture;
  });
}

function postseasonChampionId(state) {
  const fixtures = normalizePostseasonFixtures(state.postseasonFixtures);
  if (!fixtures.length || fixtures.some((fixture) => !fixture.played || !fixture.result)) return '';
  const final = fixtures.slice().sort((a, b) => b.round - a.round)[0];
  return final?.result?.winnerTeamId || '';
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

function buildDef(race, matchup, name, style, tags = []) {
  return {
    id: `${race}-${matchup}-${name}`.replace(/\s+/g, '_'),
    race,
    matchup,
    name,
    style,
    tags,
  };
}

function matchupOf(a, b) {
  if (a === 'T' && b === 'Z') return 'TvZ';
  if (a === 'Z' && b === 'T') return 'TvZ';
  if (a === 'T' && b === 'P') return 'TvP';
  if (a === 'P' && b === 'T') return 'TvP';
  if (a === 'Z' && b === 'P') return 'ZvP';
  if (a === 'P' && b === 'Z') return 'ZvP';
  if (a === 'T' && b === 'T') return 'TvT';
  if (a === 'Z' && b === 'Z') return 'ZvZ';
  return 'PvP';
}

function signedMapBias(a, b, matchup, raw) {
  if (matchup === 'TvZ') {
    if (a === 'T' && b === 'Z') return raw;
    if (a === 'Z' && b === 'T') return -raw;
  }
  if (matchup === 'TvP') {
    if (a === 'T' && b === 'P') return raw;
    if (a === 'P' && b === 'T') return -raw;
  }
  if (matchup === 'ZvP') {
    if (a === 'Z' && b === 'P') return raw;
    if (a === 'P' && b === 'Z') return -raw;
  }
  return 0;
}

function mapMultiplier(aRace, bRace, map) {
  const matchup = matchupOf(aRace, bRace);
  const raw = Number(map?.matchupBalance?.[matchup] || 0);
  return 1 + signedMapBias(aRace, bRace, matchup, raw) * 0.6;
}

function conditionMultiplier(member) {
  return clamp(0.88 + (Number(member?.condition || 75) - 75) / 650, 0.84, 1.08);
}

function levelMultiplier(member) {
  return 1 + clamp(Number(member?.level || 0), 0, 12) * 0.018;
}

function phasePower(member) {
  const stats = member?.stats || {};
  const early = Number(stats.scout || 0) * 0.2
    + Number(stats.harass || 0) * 0.2
    + Number(stats.sense || 0) * 0.25
    + Number(stats.control || 0) * 0.35;
  const mid = Number(stats.strategy || 0) * 0.35
    + Number(stats.control || 0) * 0.35
    + Number(stats.defense || 0) * 0.3;
  const late = Number(stats.macro || 0) * 0.35
    + Number(stats.attack || 0) * 0.25
    + Number(stats.strategy || 0) * 0.25
    + Number(stats.control || 0) * 0.15;
  const overall = Number(stats.attack || 0) * 0.12
    + Number(stats.defense || 0) * 0.12
    + Number(stats.strategy || 0) * 0.15
    + Number(stats.sense || 0) * 0.12
    + Number(stats.macro || 0) * 0.13
    + Number(stats.scout || 0) * 0.12
    + Number(stats.control || 0) * 0.14
    + Number(stats.harass || 0) * 0.1;
  return { early, mid, late, overall };
}

function playerBuildPreference(member) {
  const stats = member?.stats || {};
  return {
    rush: (Number(stats.harass || 0) * 0.55 + Number(stats.sense || 0) * 0.45) / 1000,
    macro: (Number(stats.macro || 0) * 0.75 + Number(stats.defense || 0) * 0.25) / 1000,
    tech: (Number(stats.strategy || 0) * 0.65 + Number(stats.scout || 0) * 0.35) / 1000,
    harass: (Number(stats.harass || 0) * 0.65 + Number(stats.control || 0) * 0.35) / 1000,
    balanced: (Number(stats.control || 0) * 0.45 + Number(stats.strategy || 0) * 0.35 + Number(stats.sense || 0) * 0.2) / 1000,
  };
}

function coachBuildBias(style, buildStyle) {
  if (style === 'aggressive') return buildStyle === 'rush' || buildStyle === 'harass' ? 0.1 : -0.02;
  if (style === 'macro') return buildStyle === 'macro' || buildStyle === 'tech' ? 0.1 : -0.02;
  if (style === 'mindgame') return buildStyle === 'balanced' ? 0.03 : 0.01;
  return buildStyle === 'balanced' ? 0.06 : 0.01;
}

function createStyleLedger() {
  return BUILD_STYLE_KEYS.reduce((ledger, style) => {
    ledger[style] = { count: 0, wins: 0 };
    return ledger;
  }, {});
}

function createBuildMetaBucket() {
  return { styles: createStyleLedger(), total: 0, lastStyle: '' };
}

function createBuildMetaLedger() {
  return {
    players: {},
    maps: {},
    global: createStyleLedger(),
    totalSets: 0,
    totalSides: 0,
  };
}

function validBuildStyle(style) {
  return BUILD_STYLE_LABELS[style] ? style : '';
}

function addStyleResult(ledger, style, won) {
  const key = validBuildStyle(style);
  if (!key) return;
  const current = ledger[key] || { count: 0, wins: 0 };
  ledger[key] = {
    count: current.count + 1,
    wins: current.wins + (won ? 1 : 0),
  };
}

function recordBuildMetaSide(meta, playerId, style, won, mapKey) {
  const key = validBuildStyle(style);
  if (!key || !playerId) return;
  const id = String(playerId);
  if (!meta.players[id]) meta.players[id] = createBuildMetaBucket();
  meta.players[id].total += 1;
  meta.players[id].lastStyle = key;
  addStyleResult(meta.players[id].styles, key, won);
  addStyleResult(meta.global, key, won);
  meta.totalSides += 1;

  if (mapKey) {
    const safeMapKey = String(mapKey);
    if (!meta.maps[safeMapKey]) meta.maps[safeMapKey] = createBuildMetaBucket();
    meta.maps[safeMapKey].total += 1;
    meta.maps[safeMapKey].lastStyle = key;
    addStyleResult(meta.maps[safeMapKey].styles, key, won);
  }
}

function recordBuildMetaSet(meta, setResult) {
  if (!setResult || typeof setResult !== 'object') return;
  const homeStyle = validBuildStyle(setResult.homeBuildStyle);
  const awayStyle = validBuildStyle(setResult.awayBuildStyle);
  if (!homeStyle && !awayStyle) return;
  const mapKey = setResult.mapId || setResult.mapName || '';
  const winnerPlayerId = String(setResult.winnerPlayerId || setResult.winnerId || '');
  const homePlayerId = String(setResult.homePlayerId || '');
  const awayPlayerId = String(setResult.awayPlayerId || '');
  recordBuildMetaSide(meta, homePlayerId, homeStyle, winnerPlayerId && winnerPlayerId === homePlayerId, mapKey);
  recordBuildMetaSide(meta, awayPlayerId, awayStyle, winnerPlayerId && winnerPlayerId === awayPlayerId, mapKey);
  meta.totalSets += 1;
}

function collectBuildMeta(state) {
  const meta = createBuildMetaLedger();
  const current = state && typeof state === 'object' ? state : {};
  const recordResult = (result) => {
    if (!result || typeof result !== 'object' || !Array.isArray(result.sets)) return;
    result.sets.forEach((setResult) => recordBuildMetaSet(meta, setResult));
  };

  (Array.isArray(current.fixtures) ? current.fixtures : []).forEach((fixture) => {
    if (fixture?.played && fixture?.result) recordResult(fixture.result);
  });
  normalizePostseasonFixtures(current.postseasonFixtures).forEach((fixture) => {
    if (fixture.played && fixture.result) recordResult(fixture.result);
  });
  normalizeWinnersLeague(current.winnersLeague, current.seasonNo).sets.forEach((setResult) => recordBuildMetaSet(meta, setResult));
  normalizePersonalLeague(current.personalLeague, current.seasonNo).matches.forEach((match) => {
    (Array.isArray(match.setDetails) ? match.setDetails : []).forEach((setResult) => recordBuildMetaSet(meta, setResult));
  });

  return meta;
}

function styleWinRate(row) {
  return row && row.count ? row.wins / row.count : 0;
}

function bestStyleFromLedger(ledger, minCount = 2) {
  return BUILD_STYLE_KEYS
    .map((style) => {
      const row = ledger?.[style] || { count: 0, wins: 0 };
      const count = Number(row.count || 0);
      const wins = Number(row.wins || 0);
      const rate = styleWinRate(row);
      return { style, count, wins, rate, score: rate + Math.min(count, 12) * 0.006 };
    })
    .filter((row) => row.count >= minCount && row.rate >= 0.5)
    .sort((a, b) => b.score - a.score)[0] || null;
}

function createBuildMetaContext(meta, player, map) {
  const styleBias = BUILD_STYLE_KEYS.reduce((result, style) => {
    result[style] = 0;
    return result;
  }, {});
  const playerBucket = meta.players[String(player?.id || '')];
  const mapBucket = meta.maps[String(map?.id || '')] || meta.maps[String(map?.name || '')];

  BUILD_STYLE_KEYS.forEach((style) => {
    const playerRow = playerBucket?.styles?.[style];
    const mapRow = mapBucket?.styles?.[style];
    const globalRow = meta.global?.[style];
    if (playerRow && playerRow.count >= 2) {
      styleBias[style] += clamp((styleWinRate(playerRow) - 0.5) * 0.13, -0.045, 0.055);
    }
    if (mapRow && mapRow.count >= 3) {
      styleBias[style] += clamp((styleWinRate(mapRow) - 0.5) * 0.07, -0.03, 0.035);
    }
    if (meta.totalSides >= 16 && globalRow?.count) {
      const popularity = globalRow.count / meta.totalSides;
      styleBias[style] -= clamp((popularity - 0.34) * 0.06, 0, 0.025);
    }
    if (playerBucket?.lastStyle === style && playerBucket.total >= 2) {
      styleBias[style] -= 0.018;
    }
  });

  const bestPlayerStyle = bestStyleFromLedger(playerBucket?.styles, 2);
  const bestMapStyle = bestStyleFromLedger(mapBucket?.styles, 3);
  const notes = [];
  if (bestPlayerStyle) {
    notes.push(`${player.name}은 최근 ${BUILD_STYLE_LABELS[bestPlayerStyle.style]} 카드가 손에 잘 맞는 흐름`);
  }
  if (bestMapStyle) {
    notes.push(`${map.name}에서는 ${BUILD_STYLE_LABELS[bestMapStyle.style]} 준비가 자주 살아나는 편`);
  }

  return {
    styleBias,
    recentStyle: playerBucket?.lastStyle || '',
    sampleSize: Number(playerBucket?.total || 0),
    mapSampleSize: Number(mapBucket?.total || 0),
    notes,
  };
}

function buildMetaInsightLine(rng, homeMeta, awayMeta) {
  const notes = [...new Set([...(homeMeta?.notes || []), ...(awayMeta?.notes || [])])];
  const homeSample = Number(homeMeta?.sampleSize || 0);
  const awaySample = Number(awayMeta?.sampleSize || 0);
  const mapSample = Math.max(Number(homeMeta?.mapSampleSize || 0), Number(awayMeta?.mapSampleSize || 0));
  const sampleText = homeSample + awaySample >= 8 || mapSample >= 4
    ? `최근 기록을 보면 선수전 ${homeSample + awaySample}세트, 이 맵 ${mapSample}세트 정도의 흐름이 있습니다. `
    : '';
  if (notes.length >= 2) {
    const first = notes[Math.floor(rng() * notes.length)];
    const second = notes.find((note) => note !== first) || notes[0];
    return `${sampleText}${first}, 그리고 ${second}. 그래서 첫 정찰이 늦으면 벤치에서 바로 표정이 굳을 수 있습니다.`;
  }
  if (notes.length === 1) {
    return `${sampleText}${notes[0]} 쪽으로 눈이 갑니다. 상대가 이 패턴을 의식하고 출발했는지를 봐야 합니다.`;
  }
  return '양쪽 기록이 많지 않으면 빌드 이름보다 첫 정찰, 첫 병력 위치, 앞마당 타이밍이 더 먼저 보입니다.';
}

function styleTagLabel(tag) {
  const labels = {
    rush: '러시',
    macro: '운영',
    tech: '테크',
    harass: '견제',
    balanced: '밸런스',
    small: '소형맵',
    large: '대형맵',
  };
  return labels[tag] || tag;
}

function coachStyleLabel(style) {
  const labels = {
    aggressive: '공격형',
    macro: '운영형',
    mindgame: '심리전형',
    balanced: '밸런스형',
  };
  return labels[style] || '밸런스형';
}

function signedPct(value) {
  const safe = Math.round(Number(value || 0) * 1000) / 10;
  return `${safe >= 0 ? '+' : ''}${safe}%`;
}

function buildDraftReasons({
  item,
  member,
  teamData,
  matchedTags,
  preferenceScore,
  coachBias,
  metaBonus,
  repeatPenalty,
}) {
  const reasons = [];
  if (matchedTags.length) reasons.push(`맵 태그 ${matchedTags.map(styleTagLabel).join('/')} 적합`);
  if (preferenceScore >= 0.58) reasons.push(`${member?.name || '선수'}의 ${BUILD_STYLE_LABELS[item.style] || item.style} 성향`);
  if (coachBias >= 0.06) reasons.push(`${coachStyleLabel(teamData?.coachStyle)} 코칭 보정`);
  if (metaBonus >= 0.012) reasons.push(`최근 메타 보정 ${signedPct(metaBonus)}`);
  if (metaBonus <= -0.012) reasons.push(`메타 견제 보정 ${signedPct(metaBonus)}`);
  if (repeatPenalty < 0) reasons.push('직전 스타일 반복 억제');
  if (!reasons.length) reasons.push(`${BUILD_STYLE_LABELS[item.style] || item.style} 기본 준비도`);
  return reasons.slice(0, 3);
}

function materializeBuildPick(row, total, ranked) {
  const rank = ranked.findIndex((candidate) => candidate.item.id === row.item.id) + 1;
  return {
    ...row.item,
    draft: {
      ...row.draft,
      pickRank: rank || 1,
      pickShare: Math.round((row.score / Math.max(1e-9, total)) * 100),
    },
  };
}

function buildPlanSummary(build) {
  const draft = build?.draft || {};
  const reasons = Array.isArray(draft.reasons) ? draft.reasons.filter(Boolean) : [];
  const tags = Array.isArray(draft.matchedTags) ? draft.matchedTags.map(styleTagLabel).join('/') : '';
  const detail = [
    tags ? `맵 ${tags}` : '',
    Number.isFinite(Number(draft.metaBiasPct)) && Math.abs(Number(draft.metaBiasPct)) >= 1 ? `메타 ${draft.metaBiasPct >= 0 ? '+' : ''}${draft.metaBiasPct}%` : '',
    Number(draft.pickShare || 0) ? `선택권 ${draft.pickShare}%` : '',
  ].filter(Boolean).join(' · ');
  return `${buildName(build)}: ${reasons.join(', ') || '기본 선택'}${detail ? ` (${detail})` : ''}`;
}

function buildPlanMatchLineV2(homePlayer, awayPlayer, homeBuild, awayBuild) {
  return `${homePlayer.name} 쪽은 ${buildPlanSummary(homeBuild)}. ${awayPlayer.name} 쪽은 ${buildPlanSummary(awayBuild)}입니다. 겉으로 단순해 보여도 첫 진출 타이밍은 다릅니다.`;
}

function pickBuild(seed, teamData, member, opponent, map, metaContext = null) {
  const rng = createRng(seed);
  const matchup = matchupOf(member?.race, opponent?.race);
  const options = BUILD_DEFS.filter((item) => item.race === member?.race && item.matchup === matchup);
  if (!options.length) return buildDef(member?.race || 'T', matchup, '기본 운영', 'balanced');

  const preference = playerBuildPreference(member);
  const weighted = options.map((item) => {
    const mapTags = Array.isArray(map?.tags) ? map.tags : [];
    const matchedTags = item.tags.filter((tag) => mapTags.includes(tag));
    const tagBonus = item.tags.reduce((sum, tag) => sum + (mapTags.includes(tag) ? 0.04 : 0), 0);
    const preferenceScore = Number(preference[item.style] || 0.5);
    const coachBias = coachBuildBias(teamData?.coachStyle, item.style);
    const metaBonus = clamp(Number(metaContext?.styleBias?.[item.style] || 0), -0.08, 0.08);
    const repeatPenalty = metaContext?.recentStyle === item.style ? -0.012 : 0;
    const randomNudge = (rng() - 0.5) * 0.06;
    const score = clamp(
      preferenceScore
        + coachBias
        + tagBonus
        + metaBonus
        + repeatPenalty
        + randomNudge,
      0.01,
      0.99,
    );
    return {
      item,
      score: Math.exp(score / 0.9),
      draft: {
        preferencePct: Math.round(preferenceScore * 100),
        coachBiasPct: Math.round(coachBias * 1000) / 10,
        mapFitPct: Math.round(tagBonus * 1000) / 10,
        metaBiasPct: Math.round(metaBonus * 1000) / 10,
        repeatPenaltyPct: Math.round(repeatPenalty * 1000) / 10,
        matchedTags,
        reasons: buildDraftReasons({
          item,
          member,
          teamData,
          matchedTags,
          preferenceScore,
          coachBias,
          metaBonus,
          repeatPenalty,
        }),
      },
    };
  });
  const total = weighted.reduce((sum, row) => sum + row.score, 0);
  const ranked = [...weighted].sort((a, b) => b.score - a.score);
  let roll = rng() * total;
  for (const row of weighted) {
    roll -= row.score;
    if (roll <= 0) return materializeBuildPick(row, total, ranked);
  }
  return materializeBuildPick(weighted[weighted.length - 1], total, ranked);
}

function counterBonus(myStyle, opponentStyle) {
  if (myStyle === opponentStyle) return 0;
  if (myStyle === 'rush' && opponentStyle === 'macro') return 0.045;
  if (myStyle === 'rush' && opponentStyle === 'tech') return 0.02;
  if (myStyle === 'rush' && opponentStyle === 'harass') return 0.01;
  if (myStyle === 'harass' && opponentStyle === 'macro') return 0.03;
  if (myStyle === 'harass' && opponentStyle === 'tech') return 0.015;
  if (myStyle === 'tech' && opponentStyle === 'rush') return 0.04;
  if (myStyle === 'macro' && opponentStyle === 'tech') return 0.03;
  if (myStyle === 'balanced') return 0.01;
  return -0.005;
}

function stylePhaseBonus(style) {
  if (style === 'rush') return { early: 0.055, mid: 0.02, late: -0.02 };
  if (style === 'harass') return { early: 0.02, mid: 0.04, late: 0 };
  if (style === 'tech') return { early: -0.01, mid: 0.045, late: 0.015 };
  if (style === 'macro') return { early: -0.02, mid: 0.015, late: 0.06 };
  return { early: 0.01, mid: 0.01, late: 0.01 };
}

function pressureOf(member, opponent, teamData) {
  const mean = (Number(member?.fame || 0) + Number(opponent?.fame || 0)) / 2;
  const z = (Number(member?.fame || 0) - mean) / 600;
  const pressure = clamp(0.5 + (1 / (1 + Math.exp(-z)) - 0.5), 0, 1);
  const coachStability = teamData?.coachStyle === 'aggressive'
    ? 0.5
    : teamData?.coachStyle === 'macro'
    ? 0.62
    : teamData?.coachStyle === 'mindgame'
    ? 0.58
    : 0.65;
  return { pressure, coachStability };
}

function noiseMultiplierFromPressure(info, importance) {
  const base = 1 + Number(info?.pressure || 0) * 0.18 * importance;
  const stability = 1 - (Number(info?.coachStability || 0.55) - 0.55) * 0.12;
  return clamp(base * stability, 0.85, 1.25);
}

function importanceForSet(scoreHome, scoreAway) {
  const homeNeed = 3 - Number(scoreHome || 0);
  const awayNeed = 3 - Number(scoreAway || 0);
  if (homeNeed <= 1 || awayNeed <= 1) return 1.2;
  if (Number(scoreHome || 0) + Number(scoreAway || 0) >= 3) return 1.05;
  return 0.9;
}

function gaussian(rng, mean = 0, sigma = 1) {
  const u1 = Math.max(1e-9, rng());
  const u2 = Math.max(1e-9, rng());
  return mean + Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2) * sigma;
}

function baseNoiseAmp(homePlayer, awayPlayer) {
  const mirror = homePlayer?.race === awayPlayer?.race;
  const controlAverage = (
    Number(homePlayer?.stats?.strategy || 0)
    + Number(homePlayer?.stats?.scout || 0)
    + Number(homePlayer?.stats?.control || 0)
    + Number(awayPlayer?.stats?.strategy || 0)
    + Number(awayPlayer?.stats?.scout || 0)
    + Number(awayPlayer?.stats?.control || 0)
  ) / 6;
  const base = mirror ? 55 : 95;
  return clamp(base * (1 - clamp((controlAverage - 520) / 2400, 0, 0.25)), 35, 120);
}

function durationFromDiff(rng, diff, mirror) {
  const swing = clamp(260 - Math.abs(diff) * 0.6, 0, 320);
  const base = mirror ? 1120 : 980;
  return Math.round(clamp(base + swing + gaussian(rng, 0, 65), 540, 1650));
}

function pickLine(rng, lines) {
  return lines[Math.floor(rng() * lines.length) % lines.length];
}

function hasKoreanFinalConsonant(text) {
  const char = String(text || '').trim().slice(-1);
  if ('013678'.includes(char)) return true;
  if ('2459'.includes(char)) return false;
  const code = char.charCodeAt(0);
  if (code < 0xAC00 || code > 0xD7A3) return false;
  return (code - 0xAC00) % 28 !== 0;
}

function topic(text) {
  return `${text}${hasKoreanFinalConsonant(text) ? '은' : '는'}`;
}

function subject(text) {
  return `${text}${hasKoreanFinalConsonant(text) ? '이' : '가'}`;
}

function formatGameClock(seconds) {
  const safe = Math.max(0, Math.floor(Number(seconds || 0)));
  const minutes = Math.floor(safe / 60);
  const rest = safe % 60;
  return `${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`;
}

function buildTimelineLine(t, caster, text) {
  return {
    t: Math.max(0, Math.floor(Number(t || 0))),
    caster,
    text,
  };
}

function buildName(build) {
  return build?.name || '기본 운영';
}

function buildStyleName(build) {
  return BUILD_STYLE_LABELS[build?.style] || build?.style || '운영';
}

function mapFlavorLine(rng, map) {
  const tags = Array.isArray(map?.tags) ? map.tags : [];
  if (tags.includes('rush') || tags.includes('small')) {
    return pickLine(rng, [
      `${topic(map.name)} 러시 거리가 짧습니다. 앞마당을 먹는 순간이 안전한 게 아니라, 바로 질문을 받는 순간입니다.`,
      `${map.name}에서는 첫 정찰이 늦으면 빌드가 아니라 본진 화면이 먼저 흔들립니다. 초반 심리전이 진짜 빠릅니다.`,
    ]);
  }
  if (tags.includes('large') || tags.includes('macro')) {
    return pickLine(rng, [
      `${topic(map.name)} 넓습니다. 편하게 먹는 맵처럼 보여도, 센터 장악을 놓치면 빈집과 드랍에 계속 끌려다닙니다.`,
      `${map.name}은 장기전 그림이 자주 나옵니다. 멀티 숫자보다 중요한 건 병력 회전과 업그레이드 타이밍입니다.`,
    ]);
  }
  if (tags.includes('harass')) {
    return pickLine(rng, [
      `${topic(map.name)} 흔들 포인트가 많습니다. 본대 싸움 전에 일꾼 피해, 드랍 동선, 시야 싸움으로 점수가 벌어질 수 있습니다.`,
      `${map.name}에서는 화면 밖 견제가 진짜 무섭습니다. 수비 동선 하나 꼬이면 해설이 바로 목소리를 높일 장면입니다.`,
    ]);
  }
  if (tags.includes('tech')) {
    return pickLine(rng, [
      `${topic(map.name)} 테크를 숨기기 좋습니다. 관건은 건물 숫자가 아니라 상대가 그 냄새를 언제 맡느냐입니다.`,
      `${map.name}에서는 준비한 카드가 공개되는 순간이 분기점입니다. 다크든, 드랍이든, 레이스든 한 번 늦으면 크게 맞습니다.`,
    ]);
  }
  return pickLine(rng, [
    `${topic(map.name)} 밸런스가 좋습니다. 그래서 더 무섭습니다. 작은 정찰 실패 하나가 양쪽 운영 차이로 누적됩니다.`,
    `${map.name}은 한쪽으로 쉽게 기울지 않습니다. 초반 선택보다 중반 판단력이 더 크게 드러나는 전장입니다.`,
  ]);
}

function matchupFlavorLine(rng, aRace, bRace) {
  const matchup = matchupOf(aRace, bRace);
  if (matchup === 'TvP') {
    return pickLine(rng, [
      '테프전은 테란의 탱크 라인과 프로토스의 셔틀/리콜 타이밍 싸움입니다. 조이기가 완성되느냐, 뚫는 타이밍이 먼저 오느냐입니다.',
      '테란은 마인과 탱크로 시간을 벌고, 프로토스는 게이트 회전과 한방 병력으로 균열을 냅니다. 진출 타이밍 하나가 세트 전체입니다.',
    ]);
  }
  if (matchup === 'TvZ') {
    return pickLine(rng, [
      '테저전은 테란이 계속 손을 바쁘게 만들고, 저그가 해처리 회전력으로 숨을 트는 구도입니다. 베슬 타이밍과 디파일러 타이밍을 같이 봐야 합니다.',
      '테란이 바이오닉으로 계속 두드리느냐, 저그가 뮤탈과 러커로 시간을 벌어 하이브까지 가느냐. 이 리듬 싸움이 핵심입니다.',
    ]);
  }
  if (matchup === 'ZvP') {
    return pickLine(rng, [
      '저프전은 커세어 시야와 히드라 압박, 그리고 템플러 확보 시간이 맞물립니다. 프로토스가 한 번 버티면 한방이 커집니다.',
      '저그는 해처리 숫자로 맵을 덮고, 프로토스는 질럿-드라군-템플러 타이밍을 맞춥니다. 중반 한타가 진짜 결승점입니다.',
    ]);
  }
  if (matchup === 'TvT') {
    return pickLine(rng, [
      '테테전은 탱크 라인, 벌처 동선, 레이스 시야가 전부입니다. 자리 한 번 밀리면 복구에 시간이 너무 오래 걸립니다.',
      '서로 한 번에 끝내기 어렵습니다. 그래서 더 집요하게 멀티와 센터를 두고 줄다리기를 해야 합니다.',
    ]);
  }
  if (matchup === 'ZvZ') {
    return pickLine(rng, [
      '저저전은 숨 쉴 틈이 없습니다. 저글링 한 번, 스커지 한 번, 뮤탈 숫자 한 기 차이가 바로 경기입니다.',
      '빌드가 조금만 엇갈려도 화면이 순식간에 터집니다. 이 매치업은 해설할 시간보다 장면이 먼저 지나갑니다.',
    ]);
  }
  return pickLine(rng, [
    '프프전은 로보틱스, 다크, 리버 정보를 누가 먼저 보느냐입니다. 옵저버 타이밍이 곧 생명줄입니다.',
    '프로토스 mirror는 초반 선택이 끝까지 따라옵니다. 리버가 살아남느냐, 드라군 라인이 먼저 잡히느냐를 봐야 합니다.',
  ]);
}

function buildClashLine(rng, homeBuild, awayBuild) {
  const homeStyle = BUILD_STYLE_LABELS[homeBuild.style] || homeBuild.style;
  const awayStyle = BUILD_STYLE_LABELS[awayBuild.style] || awayBuild.style;
  if (homeBuild.style === awayBuild.style) {
    return pickLine(rng, [
      `양쪽 모두 ${homeStyle} 성향입니다. ${buildName(homeBuild)} 대 ${buildName(awayBuild)}, 같은 방향을 봤기 때문에 빌드 완성도와 컨트롤이 그대로 드러납니다.`,
      `${homeStyle} 정면 구도입니다. 여기서는 특별한 한 수보다 첫 교전의 진형, 생산 쉬는 시간, 업그레이드 박자가 승부를 가릅니다.`,
    ]);
  }
  if (homeBuild.style === 'rush' || awayBuild.style === 'rush') {
    const attacker = homeBuild.style === 'rush' ? buildName(homeBuild) : buildName(awayBuild);
    return pickLine(rng, [
      `${attacker} 카드가 빠르게 걸어옵니다. 막는 쪽은 일꾼 동원, 첫 유닛 위치, 입구 심시티까지 모두 맞아야 합니다.`,
      `러시 카드가 섞였습니다. 이건 빌드 우위보다 발견 시점이 중요합니다. 한 박자 늦으면 앞마당이 아니라 본진이 위험합니다.`,
    ]);
  }
  if (homeBuild.style === 'harass' || awayBuild.style === 'harass') {
    return pickLine(rng, [
      `견제 카드가 보입니다. ${buildName(homeBuild)}와 ${buildName(awayBuild)}의 충돌이라, 본대보다 화면 밖 피해가 먼저 점수로 쌓일 수 있습니다.`,
      `한쪽은 흔들고 한쪽은 버티는 그림입니다. 드랍, 뮤탈, 리버가 한 번만 살아나도 중반 병력 구성이 달라집니다.`,
    ]);
  }
  if (homeBuild.style === 'tech' || awayBuild.style === 'tech') {
    return pickLine(rng, [
      `테크 카드가 숨어 있습니다. ${buildName(homeBuild)}와 ${buildName(awayBuild)} 중 누가 먼저 숨긴 카드를 보여주느냐가 분기점입니다.`,
      `운영 속에 테크 전환이 섞였습니다. 옵저버, 스캔, 오버로드 위치 하나가 해설 포인트가 됩니다.`,
    ]);
  }
  return pickLine(rng, [
    `${homeStyle} 대 ${awayStyle} 구도입니다. ${buildName(homeBuild)}와 ${buildName(awayBuild)}의 완성 시간이 다르기 때문에 중간 타이밍이 비어 있습니다.`,
    `빌드가 정면으로 겹치지는 않습니다. 어느 쪽 계획이 먼저 완성되느냐, 그리고 그 전에 상대를 얼마나 귀찮게 만드느냐가 관건입니다.`,
  ]);
}

function scoutingReadLine(rng, homePlayer, awayPlayer, homeBuild, awayBuild) {
  const homePlan = `${homePlayer.name}의 ${buildName(homeBuild)}`;
  const awayPlan = `${awayPlayer.name}의 ${buildName(awayBuild)}`;
  if (homeBuild.style === 'rush' && awayBuild.style === 'macro') {
    return pickLine(rng, [
      `${homePlan}가 앞마당 욕심을 바로 찌릅니다. ${awayPlayer.name}은 드론, 프로브, SCV를 몇 기까지 동원할지가 첫 번째 판단입니다.`,
      `${awayPlayer.name}이 자원 쪽을 먼저 봤는데, ${homePlayer.name}의 러시 타이밍이 빠릅니다. 정찰이 한 박자만 늦어도 입구가 무너질 수 있습니다.`,
    ]);
  }
  if (awayBuild.style === 'rush' && homeBuild.style === 'macro') {
    return pickLine(rng, [
      `${awayPlan}가 먼저 칼을 뽑았습니다. ${homePlayer.name}의 확장 선택이 욕심으로 끝날지, 배짱으로 끝날지 여기서 갈립니다.`,
      `${homePlayer.name}이 넓게 출발했는데 ${awayPlayer.name}은 바로 압박입니다. 초반 방어 위치가 화면 중앙보다 더 중요합니다.`,
    ]);
  }
  if (homeBuild.style === 'tech' || awayBuild.style === 'tech') {
    const techPlayer = homeBuild.style === 'tech' ? homePlayer.name : awayPlayer.name;
    const techBuild = homeBuild.style === 'tech' ? homeBuild : awayBuild;
    return pickLine(rng, [
      `${techPlayer}의 ${buildName(techBuild)} 냄새가 납니다. 지금 정찰이 끊기면 다크, 리버, 레이스 같은 첫 카드에 바로 맞습니다.`,
      `${techPlayer} 쪽 테크 건물이 숨었습니다. 상대가 지금 봐야 하는 건 병력 숫자가 아니라 생산 건물의 방향입니다.`,
    ]);
  }
  if (homeBuild.style === 'harass' || awayBuild.style === 'harass') {
    return pickLine(rng, [
      `${homePlan}, ${awayPlan}. 양쪽 모두 미니맵을 넓게 써야 합니다. 본진 화면만 보면 셔틀, 뮤탈, 드랍십을 놓칩니다.`,
      `정찰이 서로 엇갈립니다. 이럴 때는 큰 한방보다 작은 견제 피해가 누적돼서 세트 분위기를 바꿉니다.`,
    ]);
  }
  return pickLine(rng, [
    `${homePlan}와 ${awayPlan}입니다. 빌드는 크게 터지지 않았고, 첫 번째 진출 타이밍을 누가 더 정확히 잡느냐가 중요합니다.`,
    `양쪽 출발은 안정적입니다. 그래서 더 디테일을 봐야 합니다. 정찰 생존, 첫 병력 위치, 앞마당 타이밍이 전부 점수입니다.`,
  ]);
}

function pressureLine(rng, scoreHome, scoreAway, isAceSet) {
  if (isAceSet) {
    return pickLine(rng, [
      '에이스전입니다. 이 한 세트는 빌드보다 손 떨림을 먼저 봐야 합니다. 한 번의 정찰 실패가 그대로 매치 종료입니다.',
      '스코어 2:2에서 나오는 에이스전, 여기서는 준비한 카드도 중요하지만 평소보다 안전하게 시작하는 배짱이 필요합니다.',
    ]);
  }
  if (scoreHome === 2 || scoreAway === 2) {
    return pickLine(rng, [
      '매치 포인트가 걸려 있습니다. 쫓기는 쪽은 무리하면 끝나고, 앞선 쪽은 굳히려다 역전의 빌미를 줄 수 있습니다.',
      '한쪽은 끝낼 수 있고 한쪽은 버텨야 합니다. 이럴 때 초반 빌드 선택이 평소보다 훨씬 무겁게 들어옵니다.',
    ]);
  }
  if (scoreHome || scoreAway) {
    return pickLine(rng, [
      `현재 스코어 ${scoreHome}:${scoreAway}. 여기서 균형이 맞춰지느냐, 한쪽으로 확 기울어지느냐가 오늘 매치의 톤을 정합니다.`,
      `스코어가 이미 움직였습니다. 다음 세트는 단순한 1승이 아니라 엔트리 싸움의 주도권입니다.`,
    ]);
  }
  return pickLine(rng, [
    '첫 세트는 벤치 분위기를 정합니다. 여기서 이기면 다음 엔트리까지 훨씬 편하게 나올 수 있습니다.',
    '시작 세트입니다. 준비한 빌드의 완성도도 중요하지만, 상대 첫 정찰을 어떻게 처리하느냐부터 봐야 합니다.',
  ]);
}

function swingLine(rng, winnerName, leaderName, closeGame, homeWin, pHome) {
  const favoriteHome = Number(pHome || 0.5) >= 0.56;
  const favoriteName = favoriteHome ? '홈' : Number(pHome || 0.5) <= 0.44 ? '원정' : '';
  const upset = favoriteName && ((favoriteHome && !homeWin) || (!favoriteHome && homeWin));
  if (upset) {
    return pickLine(rng, [
      `${subject(winnerName)} 예상을 비트는 흐름을 만듭니다! 이건 단순히 이기는 정도가 아니라 벤치 분위기까지 가져가는 세트입니다.`,
      `${winnerName} 쪽에서 판을 뒤집었습니다. 준비한 카드가 통했고, 지금 상대 표정이 굳을 만한 장면입니다.`,
    ]);
  }
  if (closeGame) {
    return pickLine(rng, [
      '아직 끝난 게 아닙니다! 병력 한 번 잘못 돌리면 바로 반대편으로 흐름이 넘어갑니다. 이런 경기는 마지막 교전 전까지 모릅니다.',
      '세트가 정말 촘촘합니다. 지금은 누가 더 잘했느냐보다 누가 덜 흔들리느냐입니다.',
    ]);
  }
  return pickLine(rng, [
    `${leaderName} 쪽으로 흐름이 기웁니다. 이제는 멋진 장면보다 실수 없이 굳히는 운영이 중요합니다.`,
    `${subject(leaderName)} 주도권을 잡았습니다. 상대는 수비하면서 동시에 역습 타이밍을 만들어야 하는 어려운 국면입니다.`,
  ]);
}

function broadcastHeadlineForSet({ setNo, map, homePlayer, awayPlayer, homeBuild, awayBuild, homeWin, noisyDiff, isAceSet }) {
  const winner = homeWin ? homePlayer : awayPlayer;
  const loser = homeWin ? awayPlayer : homePlayer;
  const winnerBuild = homeWin ? homeBuild : awayBuild;
  const loserBuild = homeWin ? awayBuild : homeBuild;
  const closeGame = Math.abs(Number(noisyDiff || 0)) < 95;
  const prefix = `${setNo}세트${isAceSet ? ' 에이스전' : ''} · ${map.name}`;
  if (closeGame) {
    return `${prefix}: ${winner.name}, 마지막 교전 한 끗으로 ${loser.name}을 잡았습니다.`;
  }
  if (winnerBuild.style === 'rush') {
    return `${prefix}: ${winner.name}, ${buildName(winnerBuild)} 타이밍으로 초반부터 경기를 접었습니다.`;
  }
  if (winnerBuild.style === 'harass') {
    return `${prefix}: ${winner.name}, 견제 누적으로 ${loser.name}의 운영 박자를 끊었습니다.`;
  }
  if (winnerBuild.style === 'tech') {
    return `${prefix}: ${winner.name}, 숨긴 ${buildName(winnerBuild)} 카드가 승부를 갈랐습니다.`;
  }
  if (loserBuild.style === 'rush') {
    return `${prefix}: ${winner.name}, 초반 압박을 넘긴 뒤 운영으로 뒤집었습니다.`;
  }
  return `${prefix}: ${winner.name}, ${buildName(winnerBuild)} 흐름을 끝까지 굳혔습니다.`;
}

function turningPointForSet({ durationSec, winnerName, loserName, winnerBuild, loserBuild, closeGame }) {
  const clock = formatGameClock(Math.round(durationSec * (closeGame ? 0.62 : 0.48)));
  if (closeGame) {
    return `${clock} 중앙 교전에서 ${winnerName}이 병력을 간발의 차로 남긴 장면이 승부처였습니다.`;
  }
  if (winnerBuild.style === 'rush') {
    return `${clock} 첫 압박 때 ${loserName}의 방어 병력이 늦게 모이면서 경기가 크게 기울었습니다.`;
  }
  if (winnerBuild.style === 'harass') {
    return `${clock} 견제가 일꾼과 시야를 동시에 흔들며 ${winnerName} 쪽으로 주도권이 넘어갔습니다.`;
  }
  if (winnerBuild.style === 'tech') {
    return `${clock} ${buildName(winnerBuild)}가 공개된 순간 ${loserName}의 대응 병력이 엇갈렸습니다.`;
  }
  if (loserBuild.style === 'rush') {
    return `${clock} 초반 러시를 막아낸 뒤 ${winnerName}의 멀티와 생산력이 한 번에 살아났습니다.`;
  }
  return `${clock} 센터를 먼저 잡은 뒤 ${winnerName}이 멀티와 병력 회전을 동시에 굴린 장면이 핵심이었습니다.`;
}

function openingTellLine(rng, playerName, build) {
  const race = build?.race;
  const style = build?.style;
  if (race === 'T') {
    if (style === 'rush') {
      return pickLine(rng, [
        `${playerName}, SCV가 먼저 나갑니다. 배럭 타이밍이 빠르죠. 상대 입장에서는 입구에 뭐가 올라오는지 바로 봐야 합니다.`,
        `${playerName} 쪽 배럭 숫자가 빨리 찍힙니다. 이거 첫 마린 위치가 보이면 수비 쪽 손이 바빠집니다.`,
      ]);
    }
    if (style === 'macro') {
      return pickLine(rng, [
        `${playerName}은 커맨드 욕심을 냅니다. 앞마당이 빨라요. 대신 첫 벌처, 첫 탱크 나오기 전 구간이 열립니다.`,
        `${playerName} 쪽은 자원줄을 먼저 폅니다. 이 선택은 중반부터 힘이 붙지만, 초반 정찰을 놓치면 위험합니다.`,
      ]);
    }
    if (style === 'tech') {
      return pickLine(rng, [
        `${playerName}의 팩토리 이후 동선이 중요합니다. 애드온인지 스타포트인지, 여기서 상대 대응이 완전히 갈립니다.`,
        `${playerName}은 테크를 감춥니다. 스캔 전에 냄새를 못 맡으면 첫 레이스나 드랍십에 화면이 흔들릴 수 있습니다.`,
      ]);
    }
    return pickLine(rng, [
      `${playerName}은 벌처 동선을 넓게 씁니다. 마인 하나, 드랍십 한 번이 프로브와 드론을 계속 뒤로 물릴 수 있습니다.`,
      `${playerName} 쪽은 본대보다 옆구리를 봅니다. 상대 미니맵이 빨간 점에 얼마나 빨리 반응하느냐가 중요합니다.`,
    ]);
  }
  if (race === 'Z') {
    if (style === 'rush') {
      return pickLine(rng, [
        `${playerName}, 스포닝 풀이 빠릅니다. 저글링이 달리면 이건 빌드 설명할 시간이 아니라 입구부터 봐야 합니다.`,
        `${playerName} 쪽 저글링 타이밍이 앞당겨졌습니다. 상대 첫 유닛이 밖으로 나가면 바로 싸움 납니다.`,
      ]);
    }
    if (style === 'macro') {
      return pickLine(rng, [
        `${playerName}은 해처리를 늘립니다. 드론을 째는 만큼 첫 압박을 얼마나 깔끔하게 넘기느냐가 핵심입니다.`,
        `${playerName} 쪽 앞마당과 세 번째 해처리 그림입니다. 시간을 벌면 라바 회전력이 확 살아납니다.`,
      ]);
    }
    if (style === 'tech') {
      return pickLine(rng, [
        `${playerName}은 레어 타이밍을 당깁니다. 뮤탈인지 러커인지, 상대가 갈림길을 맞힐 수 있느냐입니다.`,
        `${playerName}의 스파이어 냄새가 납니다. 터렛, 캐논, 커세어 준비가 늦으면 일꾼 라인이 흔들립니다.`,
      ]);
    }
    return pickLine(rng, [
      `${playerName}은 오버로드와 저글링으로 시야를 넓힙니다. 뮤탈 한 번 돌면 본진과 앞마당을 동시에 봐야 합니다.`,
      `${playerName} 쪽은 흔드는 운영입니다. 피해가 작아 보여도 수비 병력이 묶이면 다음 한타가 달라집니다.`,
    ]);
  }
  if (style === 'rush') {
    return pickLine(rng, [
      `${playerName}, 게이트 타이밍이 빠릅니다. 첫 질럿이 어디로 뛰느냐에 따라 상대 앞마당이 바로 흔들립니다.`,
      `${playerName} 쪽 초반 압박입니다. 드라군이 합류하기 전까지 입구 심시티와 컨트롤 싸움이 큽니다.`,
    ]);
  }
  if (style === 'macro') {
    return pickLine(rng, [
      `${playerName}은 넥서스를 봅니다. 프로브를 살리면서 캐논, 게이트 타이밍을 같이 맞춰야 합니다.`,
      `${playerName} 쪽은 더블 이후 한방을 준비합니다. 초반을 넘기면 게이트 회전이 무섭게 붙습니다.`,
    ]);
  }
  if (style === 'tech') {
    return pickLine(rng, [
      `${playerName}은 코어 이후 테크가 빠릅니다. 다크인지 리버인지 확인 못 하면 수비 병력이 엉뚱한 데 서게 됩니다.`,
      `${playerName}의 로보틱스, 템플러 계열 선택지가 열립니다. 상대 정찰이 끊기면 바로 큰 장면이 나옵니다.`,
    ]);
  }
  return pickLine(rng, [
    `${playerName}은 셔틀과 커세어 쪽으로 손을 벌립니다. 본대보다 시야와 견제 루트가 먼저 움직입니다.`,
    `${playerName} 쪽은 리버 한 번, 커세어 한 번으로 상대 리듬을 끊으려 합니다. 수비 반응 속도가 관건입니다.`,
  ]);
}

function mapControlCallLine(rng, leaderName, leaderBuild, closeGame) {
  if (closeGame) {
    return pickLine(rng, [
      '센터가 아직 비어 있습니다. 누가 먼저 잡았다고 말하기 어렵고, 양쪽 다 병력 한 번 잘못 돌리면 바로 역습 맞습니다.',
      '미니맵이 계속 흔들립니다. 앞마당 수비, 센터 병력, 견제 대응이 동시에 들어와서 실수 한 번이 너무 큽니다.',
    ]);
  }
  const plan = leaderBuild ? buildName(leaderBuild) : '준비한 운영';
  return pickLine(rng, [
    `${leaderName} 쪽이 센터를 먼저 밟았습니다. ${plan}가 살아났고, 이제 상대는 나오는 길부터 불편합니다.`,
    `${leaderName}이 시야를 넓힙니다. 이러면 상대는 공격을 가도 출발이 보이고, 수비를 해도 멀티가 늦어집니다.`,
  ]);
}

function decisiveFightLine(rng, winnerName, loserName, winnerBuild, closeGame) {
  if (closeGame) {
    return pickLine(rng, [
      `교전 붙습니다! ${winnerName}이 간발의 차로 남겼어요. ${loserName}도 거의 잡을 뻔했는데 마지막 화력이 모자랐습니다.`,
      `이 싸움 정말 큽니다. ${winnerName}이 병력을 남깁니다. 여기서 살아남은 병력이 바로 역러시 압박이 됩니다.`,
    ]);
  }
  return pickLine(rng, [
    `${winnerName}이 정면에서 크게 이깁니다. ${buildName(winnerBuild)}로 만든 힘이 여기서 폭발했습니다.`,
    `${winnerName}의 타이밍이 정확했습니다. 상대 병력이 모이기 전에 치고 들어가면서 세트가 크게 기웁니다.`,
  ]);
}

function earlyBroadcastLine(rng, homePlayer, awayPlayer, homeBuild, awayBuild) {
  if (homeBuild.style === 'rush' || awayBuild.style === 'rush') {
    const attacker = homeBuild.style === 'rush' ? homePlayer.name : awayPlayer.name;
    const attackBuild = homeBuild.style === 'rush' ? homeBuild : awayBuild;
    return pickLine(rng, [
      `${attacker} 쪽이 먼저 움직입니다! ${buildName(attackBuild)}입니다. 이거 정찰이 늦으면 앞마당이 아니라 경기 전체가 흔들립니다!`,
      `${attacker} 초반 타이밍 잡습니다. 막는 쪽은 침착하게 첫 방어만 넘기면 되는데, 그 첫 방어가 제일 어렵습니다.`,
    ]);
  }
  if (homeBuild.style === 'harass' || awayBuild.style === 'harass') {
    return pickLine(rng, [
      `초반부터 시야를 흔들 준비가 보입니다. ${buildName(homeBuild)}와 ${buildName(awayBuild)}, 견제 한 번에 손이 꼬이면 중반 교전이 달라집니다.`,
      '서로 정찰이 중요합니다. 빈틈 보이는 순간 바로 흔들러 들어갑니다. 이건 손 빠른 선수가 웃는 흐름입니다.',
    ]);
  }
  return pickLine(rng, [
    `초반은 탐색전입니다. ${buildName(homeBuild)} 대 ${buildName(awayBuild)}, 아직 본심을 다 보여주지 않았습니다.`,
    '서로 숨겨놓고 출발합니다. 지금은 작은 정보 하나가 큰 선택지로 이어지는 시간입니다.',
  ]);
}

function midBroadcastLine(rng, leaderName, closeGame, leaderBuild = null) {
  if (closeGame) {
    return pickLine(rng, [
      '중반 팽팽합니다! 여기서 한 번만 잘못 싸우면 그대로 흐름이 넘어갑니다. 센터 싸움, 견제 수비, 멀티 체크가 동시에 돌아갑니다.',
      '아직 모릅니다. 자리 한 번, 병력 방향 한 번에 판이 확 바뀝니다. 이런 경기가 해설하기 제일 어렵습니다.',
    ]);
  }
  const plan = leaderBuild ? `${buildName(leaderBuild)}의 ${buildStyleName(leaderBuild)} 흐름` : '준비한 흐름';
  return pickLine(rng, [
    `${leaderName} 쪽이 템포를 잡았습니다. ${plan}이 살아났고, 이제 상대에게 숨 돌릴 시간을 안 주는 게 중요합니다.`,
    `${subject(leaderName)} 주도권을 쥐었습니다. 여기서 무리하지 않고 멀티와 병력 회전만 이어가도 상대가 답답해집니다.`,
  ]);
}

function lateBroadcastLine(rng, winnerName, closeGame, winnerBuild = null) {
  if (closeGame) {
    return pickLine(rng, [
      '후반 갑니다! 마지막 한 번, 어디서 싸우느냐가 전부입니다. 지금은 병력 숫자보다 싸우는 위치가 더 중요합니다!',
      '끝까지 모릅니다! 한타 한 번에 오늘 세트 흐름이 전부 뒤집힐 수 있습니다. 해설진도 숨을 고르는 타이밍입니다!',
    ]);
  }
  const finishPlan = winnerBuild ? `${buildName(winnerBuild)}로 만든 우위` : '만들어 둔 우위';
  return pickLine(rng, [
    `${winnerName} 쪽이 마무리 각을 봅니다. ${finishPlan}가 아직 유지됩니다. 병력 교환만 깔끔하면 끝까지 밀 수 있습니다.`,
    `${subject(winnerName)} 마지막 문 앞까지 왔습니다. 상대는 수비만으로는 부족하고 역습 타이밍 하나를 만들어야 합니다.`,
  ]);
}

function broadcastSideLabel(player) {
  return `${player.name}(${RACE_LABELS[player.race] || player.race})`;
}

function broadcastMapReadLine(map) {
  const tags = Array.isArray(map?.tags) ? map.tags : [];
  if (tags.includes('rush') || tags.includes('small')) {
    return `${map.name}, 러시 거리가 짧습니다. 정찰 한 번 늦으면 해설할 것도 없이 입구부터 불이 붙습니다.`;
  }
  if (tags.includes('large') || tags.includes('macro')) {
    return `${map.name}은 넓습니다. 여기서는 멀티를 먹는 쪽보다 그 멀티를 지킬 동선이 더 중요합니다.`;
  }
  if (tags.includes('harass')) {
    return `${map.name}, 화면 밖 견제가 무섭습니다. 미니맵 한 번 놓치면 일꾼 줄이 그대로 비죠.`;
  }
  if (tags.includes('tech')) {
    return `${map.name}은 숨긴 테크가 잘 먹힙니다. 옵저버, 스캔, 오버로드 위치가 곧 해설 포인트입니다.`;
  }
  return `${map.name}, 밸런스는 좋지만 작은 정찰 차이가 운영 차이로 번지는 맵입니다.`;
}

function broadcastOpeningReadLine(homePlayer, awayPlayer, homeBuild, awayBuild) {
  const homePlan = `${homePlayer.name}은 ${buildName(homeBuild)}`;
  const awayPlan = `${awayPlayer.name}은 ${buildName(awayBuild)}`;
  if (homeBuild.style === 'rush' || awayBuild.style === 'rush') {
    const attacker = homeBuild.style === 'rush' ? homePlayer.name : awayPlayer.name;
    const defender = homeBuild.style === 'rush' ? awayPlayer.name : homePlayer.name;
    const attackBuild = homeBuild.style === 'rush' ? homeBuild : awayBuild;
    return `${attacker}, ${buildName(attackBuild)}입니다. ${defender}가 이걸 보면 게임이고 못 보면 사고입니다.`;
  }
  if (homeBuild.style === 'harass' || awayBuild.style === 'harass') {
    return `${homePlan}, ${awayPlan}. 오늘 포인트는 본대보다 견제 동선입니다. 화면 두 개를 동시에 봐야 합니다.`;
  }
  if (homeBuild.style === 'tech' || awayBuild.style === 'tech') {
    const techPlayer = homeBuild.style === 'tech' ? homePlayer.name : awayPlayer.name;
    const techBuild = homeBuild.style === 'tech' ? homeBuild : awayBuild;
    return `${techPlayer} 쪽에 ${buildName(techBuild)} 냄새가 납니다. 지금 정찰이 끊기면 첫 카드에 바로 맞습니다.`;
  }
  return `${homePlan}, ${awayPlan}. 크게 꼬이지는 않았습니다. 첫 진출 타이밍이 세트의 첫 분기점입니다.`;
}

function broadcastMetaReadLine(rng, homeMeta, awayMeta) {
  const notes = [...new Set([...(homeMeta?.notes || []), ...(awayMeta?.notes || [])])];
  const homeSample = Number(homeMeta?.sampleSize || 0);
  const awaySample = Number(awayMeta?.sampleSize || 0);
  const mapSample = Math.max(Number(homeMeta?.mapSampleSize || 0), Number(awayMeta?.mapSampleSize || 0));
  if (notes.length) {
    const note = notes[Math.floor(rng() * notes.length) % notes.length];
    return `${note}. 벤치가 이 패턴을 읽고 들어왔는지, 첫 정찰 반응에서 바로 보입니다.`;
  }
  if (homeSample + awaySample >= 4 || mapSample >= 3) {
    return `표본은 크지 않지만 선수전 ${homeSample + awaySample}세트, 맵 ${mapSample}세트가 쌓였습니다. 오늘은 빌드보다 첫 교전 위치를 봐야 합니다.`;
  }
  return '데이터는 아직 얇습니다. 이런 세트는 이름값보다 첫 정찰, 첫 병력, 앞마당 타이밍이 먼저입니다.';
}

function broadcastMatchupReadLine(homePlayer, awayPlayer, homeBuild, awayBuild) {
  const matchup = matchupOf(homePlayer.race, awayPlayer.race);
  if (matchup === 'TvZ') {
    return `테저전입니다. ${buildName(homeBuild)} 대 ${buildName(awayBuild)}, 베슬 타이밍과 뮤탈·러커 견제 반응이 같이 움직입니다.`;
  }
  if (matchup === 'TvP') {
    return '테프전입니다. 탱크 라인과 셔틀·리버 동선, 어느 쪽이 먼저 시야를 끊느냐가 큽니다.';
  }
  if (matchup === 'ZvP') {
    return '저프전입니다. 커세어 시야와 히드라 압박, 템플러 확보 시간이 정면으로 부딪힙니다.';
  }
  if (matchup === 'TvT') {
    return '테테전입니다. 탱크 라인 한 번 밀리면 복구가 오래 걸립니다. 자리 싸움이 곧 점수입니다.';
  }
  if (matchup === 'ZvZ') {
    return '저저전입니다. 저글링 한 번, 스커지 한 번 차이가 그대로 세트가 됩니다.';
  }
  if (matchup === 'PvP') {
    return '프프전입니다. 로보틱스와 리버 정보, 그리고 첫 드라군 위치가 제일 먼저 보입니다.';
  }
  return `${RACE_LABELS[homePlayer.race] || homePlayer.race} 대 ${RACE_LABELS[awayPlayer.race] || awayPlayer.race}, 첫 정보전이 중요합니다.`;
}

function broadcastFirstFightLine(winnerName, loserName, winnerBuild, closeGame) {
  if (closeGame) {
    return `교전 붙습니다! ${winnerName}이 간발의 차이로 남겼습니다. ${loserName}도 거의 잡았는데 마지막 화력이 모자랐어요.`;
  }
  if (winnerBuild.style === 'rush') {
    return `${winnerName}이 밀고 들어갑니다! ${buildName(winnerBuild)} 타이밍, 이건 방어 병력 모이기 전에 들어간 겁니다.`;
  }
  if (winnerBuild.style === 'harass') {
    return `${winnerName}의 견제가 누적됩니다. 일꾼 줄고 시야 흔들리고, 상대 손이 점점 바빠집니다.`;
  }
  if (winnerBuild.style === 'tech') {
    return `${winnerName}의 숨긴 카드가 나왔습니다. 이 타이밍에 대응 병력이 비면 바로 경기가 기웁니다.`;
  }
  return `${winnerName}이 정면에서 크게 이깁니다. ${buildName(winnerBuild)}로 만든 힘이 여기서 터졌습니다.`;
}

function broadcastSwingReadLine(winnerName, leaderName, closeGame, homeWin, pHome) {
  const favoriteHome = Number(pHome || 0.5) >= 0.56;
  const underdogWin = (favoriteHome && !homeWin) || (!favoriteHome && homeWin && Number(pHome || 0.5) <= 0.44);
  if (underdogWin) {
    return `${winnerName}, 예측을 깨고 있습니다. 이건 빌드 하나가 아니라 현장 판단으로 분위기를 뒤집은 세트입니다.`;
  }
  if (closeGame) {
    return '아직 모릅니다. 병력 한 덩어리 방향만 틀어져도 바로 반대편으로 흐름이 넘어갑니다.';
  }
  return `${leaderName}이 주도권을 잡았습니다. 이제 무리하지 않고 센터와 멀티만 묶으면 상대가 답답해집니다.`;
}

function broadcastFinishReadLine(winnerName, winnerBuild, closeGame, isAceSet) {
  if (isAceSet) {
    return `${winnerName}, 에이스전 압박을 버팁니다. 이 세트는 다음 경기 분위기까지 흔들 수 있습니다.`;
  }
  if (closeGame) {
    return `${winnerName}이 마지막 전투를 먼저 잡았습니다. 지금은 병력 숫자보다 진출 방향 하나가 더 큽니다.`;
  }
  return `${winnerName}이 ${buildName(winnerBuild)}로 만든 우위를 끝까지 놓치지 않습니다. 마무리 각이 보입니다.`;
}

function broadcastReplayCenterLine(rng, { winnerName, loserName, winnerBuild, loserBuild, closeGame, map, homeWin, pHome, noisyDiff }) {
  const favoriteHome = Number(pHome || 0.5) >= 0.56;
  const favoriteAway = Number(pHome || 0.5) <= 0.44;
  const upset = (favoriteHome && !homeWin) || (favoriteAway && homeWin);
  if (upset) {
    return pickLine(rng, [
      `리플레이로 보면 ${winnerName}의 첫 대응이 제일 컸습니다. 불리한 예측값을 빌드가 아니라 위치 선정으로 뒤집었습니다.`,
      `${winnerName}이 예상 흐름을 깨뜨린 장면입니다. ${loserName}은 준비한 방향은 맞았는데, 첫 교전 장소를 강요당했습니다.`,
    ]);
  }
  if (closeGame) {
    return pickLine(rng, [
      `리플레이센터에서 잡은 장면은 마지막 교전 전 병력 방향입니다. ${winnerName}이 반 박자 먼저 중앙을 잡은 게 차이였습니다.`,
      `승부처를 다시 보면 ${map.name} 중앙 시야가 갈렸습니다. ${loserName}이 한 화면 늦게 반응하면서 마지막 화력이 모자랐습니다.`,
    ]);
  }
  if (winnerBuild.style === 'rush') {
    return pickLine(rng, [
      `${winnerName}의 ${buildName(winnerBuild)}는 정찰 타이밍을 찌른 빌드입니다. ${loserName}이 본 순간에는 이미 방어선이 얇았습니다.`,
      `초반 리플레이를 보면 ${winnerName}이 병력 도착 시간을 거의 낭비하지 않았습니다. 러시 거리가 그대로 주도권이 됐습니다.`,
    ]);
  }
  if (winnerBuild.style === 'harass') {
    return pickLine(rng, [
      `${winnerName}은 큰 한 방보다 누적 피해로 이겼습니다. 일꾼, 시야, 생산 동선이 조금씩 밀리면서 ${loserName}이 먼저 흔들렸습니다.`,
      `견제 장면을 다시 보면 피해량보다 중요한 건 수비 병력 위치였습니다. ${loserName}의 본대 합류가 계속 늦어졌습니다.`,
    ]);
  }
  if (winnerBuild.style === 'tech') {
    return pickLine(rng, [
      `${winnerName}의 ${buildName(winnerBuild)}가 공개된 타이밍에 ${loserName}의 정찰이 끊겼습니다. 대응 병력이 엉뚱한 쪽에 섰습니다.`,
      `숨긴 테크가 먹힌 이유는 속도보다 정보 차이였습니다. ${loserName}이 준비할 수 있는 시간이 거의 없었습니다.`,
    ]);
  }
  if (loserBuild.style === 'rush') {
    return pickLine(rng, [
      `${loserName}의 초반 압박은 나쁘지 않았습니다. 다만 ${winnerName}이 첫 수비를 넘기자마자 생산과 멀티 차이가 벌어졌습니다.`,
      `초반 러시를 막은 뒤 흐름이 완전히 바뀌었습니다. ${winnerName}이 역공보다 복구와 확장을 먼저 고른 판단이 좋았습니다.`,
    ]);
  }
  return pickLine(rng, [
    `${winnerName}은 무리하지 않았습니다. ${buildName(winnerBuild)} 흐름에서 센터와 멀티를 같이 잡으면서 체감 주도권을 확실히 만들었습니다.`,
    `리플레이 핵심은 운영 순서입니다. ${winnerName}이 병력 회전, 멀티, 시야를 한 번에 맞추면서 ${loserName}이 역습 각을 못 잡았습니다.`,
  ]);
}

function broadcastBenchReactionLine(rng, { winnerName, loserName, isAceSet, scoreHome, scoreAway, closeGame }) {
  if (isAceSet) {
    return pickLine(rng, [
      `${winnerName} 벤치가 크게 일어납니다. 에이스전 한 세트는 승점보다 다음 엔트리 신뢰까지 가져갑니다.`,
      `${loserName} 쪽은 표정이 굳었습니다. 에이스전 패배는 단순한 1패가 아니라 시리즈 플랜 전체가 흔들리는 장면입니다.`,
    ]);
  }
  if (scoreHome === 2 || scoreAway === 2) {
    return pickLine(rng, [
      `${winnerName} 쪽 벤치는 이제 끝낼 수 있다는 표정입니다. 반대로 ${loserName} 쪽은 다음 세트 카드가 굉장히 무거워졌습니다.`,
      `매치 포인트 구간에서 나온 승리라 체감이 큽니다. ${winnerName} 쪽은 엔트리 선택 폭이 확 넓어졌습니다.`,
    ]);
  }
  if (closeGame) {
    return pickLine(rng, [
      `양쪽 벤치 모두 손에 땀이 나는 세트였습니다. ${winnerName}이 가져갔지만 ${loserName}도 다음 세트에 바로 반격할 근거는 남겼습니다.`,
      `이런 접전은 패한 쪽도 무너지지 않습니다. ${loserName}은 빌드보다 마지막 교전 판단만 복기하면 됩니다.`,
    ]);
  }
  return pickLine(rng, [
    `${winnerName} 쪽 벤치 분위기가 가벼워집니다. 준비한 방향이 통했다는 확신이 생기는 승리입니다.`,
    `${loserName} 쪽은 바로 피드백이 필요합니다. 빌드가 틀렸다기보다 첫 대응 순서가 늦었습니다.`,
  ]);
}

function buildSetTimeline({
  rng,
  setNo,
  map,
  homePlayer,
  awayPlayer,
  homeBuild,
  awayBuild,
  homeWin,
  durationSec,
  noisyDiff,
  pHome = 0.5,
  scoreHome = 0,
  scoreAway = 0,
  isAceSet = false,
  homeMeta = null,
  awayMeta = null,
}) {
  const winnerName = homeWin ? homePlayer.name : awayPlayer.name;
  const leaderName = noisyDiff >= 0 ? homePlayer.name : awayPlayer.name;
  const leaderBuild = noisyDiff >= 0 ? homeBuild : awayBuild;
  const winnerBuild = homeWin ? homeBuild : awayBuild;
  const loserName = homeWin ? awayPlayer.name : homePlayer.name;
  const absDiff = Math.abs(Number(noisyDiff || 0));
  const closeGame = absDiff < 95;
  const scoreText = scoreHome || scoreAway ? ` 현재 매치 스코어 ${scoreHome}:${scoreAway}.` : ' 첫 세트 분위기가 중요합니다.';
  return [
    buildTimelineLine(0, '캐스터', `자, ${setNo}세트${isAceSet ? ' 에이스전' : ''} 갑니다. ${broadcastSideLabel(homePlayer)} 대 ${broadcastSideLabel(awayPlayer)}, 맵은 ${map.name}.${scoreText}`),
    buildTimelineLine(7, '해설', broadcastMapReadLine(map)),
    buildTimelineLine(15, '캐스터', `빌드는 ${homePlayer.name} ${buildName(homeBuild)}, ${awayPlayer.name} ${buildName(awayBuild)}입니다.`),
    buildTimelineLine(24, '해설', broadcastOpeningReadLine(homePlayer, awayPlayer, homeBuild, awayBuild)),
    buildTimelineLine(36, '캐스터', broadcastMetaReadLine(rng, homeMeta, awayMeta)),
    buildTimelineLine(Math.round(durationSec * 0.22), '해설', broadcastMatchupReadLine(homePlayer, awayPlayer, homeBuild, awayBuild)),
    buildTimelineLine(Math.round(durationSec * 0.35), '캐스터', broadcastFirstFightLine(winnerName, loserName, winnerBuild, closeGame)),
    buildTimelineLine(Math.round(durationSec * 0.49), '해설', leaderBuild.style === 'macro'
      ? `${leaderName}이 멀티를 먼저 안정시킵니다. 상대는 기다리면 더 불편해져요, 지금 뭔가 흔들어야 합니다.`
      : `${leaderName}이 ${buildStyleName(leaderBuild)} 주도권을 잡았습니다. 다음 장면은 센터 장악이냐 역습이냐입니다.`),
    buildTimelineLine(Math.round(durationSec * 0.63), '캐스터', broadcastSwingReadLine(winnerName, leaderName, closeGame, homeWin, pHome)),
    buildTimelineLine(Math.round(durationSec * 0.78), '해설', broadcastFinishReadLine(winnerName, winnerBuild, closeGame, isAceSet)),
    buildTimelineLine(Math.max(0, durationSec - 42), '리플레이센터', broadcastReplayCenterLine(rng, {
      winnerName,
      loserName,
      winnerBuild,
      loserBuild: homeWin ? awayBuild : homeBuild,
      closeGame,
      map,
      homeWin,
      pHome,
      noisyDiff,
    })),
    buildTimelineLine(Math.max(0, durationSec - 18), '벤치', broadcastBenchReactionLine(rng, {
      winnerName,
      loserName,
      isAceSet,
      scoreHome,
      scoreAway,
      closeGame,
    })),
    buildTimelineLine(durationSec, '캐스터', `${winnerName} 승리! ${formatGameClock(durationSec)}, ${setNo}세트 여기서 끝납니다!`),
  ].sort((a, b) => a.t - b.t);
}

const CAST_RACE_LABELS = {
  T: '테란',
  Z: '저그',
  P: '프로토스',
};

const CAST_STYLE_LABELS = {
  rush: '초반 승부',
  macro: '운영',
  tech: '테크 전환',
  harass: '견제',
  balanced: '정석 운영',
};

function castRaceLabel(player) {
  return CAST_RACE_LABELS[player?.race] || player?.race || '랜덤';
}

function castStyleLabel(build) {
  return CAST_STYLE_LABELS[build?.style] || buildStyleName(build);
}

function castSideLabel(player) {
  return `${player?.name || '선수'}(${castRaceLabel(player)})`;
}

function castBuildLabel(build) {
  const name = buildName(build);
  const style = castStyleLabel(build);
  return name.includes(style) ? name : `${name} 계열의 ${style}`;
}

function tempoWordForBuild(build) {
  if (build?.style === 'rush') return '빠릅니다';
  if (build?.style === 'harass') return '흔들 준비입니다';
  if (build?.style === 'tech') return '숨긴 카드가 있습니다';
  if (build?.style === 'macro') return '판을 길게 봅니다';
  return '정면 힘싸움도 봅니다';
}

function broadcastOpenLineV2({ setNo, map, homePlayer, awayPlayer, scoreHome, scoreAway, isAceSet }) {
  const setLabel = `${setNo}세트${isAceSet ? ' 에이스결정전' : ''}`;
  if (isAceSet) {
    return `${setLabel}, 여기서 끝납니다. ${castSideLabel(homePlayer)} 대 ${castSideLabel(awayPlayer)}, 전장은 ${map.name}.`;
  }
  if (scoreHome === 2 || scoreAway === 2) {
    return `${setLabel} 갑니다. 매치 포인트입니다. ${castSideLabel(homePlayer)} 대 ${castSideLabel(awayPlayer)}, 맵 ${map.name}.`;
  }
  if (scoreHome || scoreAway) {
    return `${setLabel} 출발합니다. 스코어 ${scoreHome}:${scoreAway}, 흐름을 끊느냐 굳히느냐의 세트입니다.`;
  }
  return `${setLabel} 시작합니다. ${castSideLabel(homePlayer)} 대 ${castSideLabel(awayPlayer)}, 맵은 ${map.name}.`;
}

function scorePressureLine(scoreHome, scoreAway, isAceSet) {
  if (isAceSet) return '이런 경기는 빌드보다 첫 정찰, 첫 교전 판단이 더 무겁습니다.';
  if (scoreHome === 2 || scoreAway === 2) return `한쪽은 끝내고 싶고, 한쪽은 무조건 버텨야 하는 ${scoreHome}:${scoreAway}입니다.`;
  if (scoreHome || scoreAway) return `스코어 ${scoreHome}:${scoreAway}. 여기서 한 번 밀리면 다음 세트 밴픽까지 부담이 갑니다.`;
  return '첫 세트라 탐색전처럼 보여도, 선취점이 오늘 분위기를 만듭니다.';
}

function mapReadLineV2(map) {
  const tags = Array.isArray(map?.tags) ? map.tags : [];
  if (tags.includes('rush') || tags.includes('small')) {
    return `${topic(map.name)} 초반 거리가 가깝습니다. 앞마당 욕심을 내기 전에 입구 심시티와 첫 정찰이 먼저예요.`;
  }
  if (tags.includes('large') || tags.includes('macro')) {
    return `${topic(map.name)} 넓습니다. 한 번에 끝내기보다 멀티 타이밍, 병력 회전, 센터 시야가 오래 갑니다.`;
  }
  if (tags.includes('harass')) {
    return `${topic(map.name)} 견제 동선이 많습니다. 본진 화면만 오래 보면 드랍이나 빈집에 바로 흔들립니다.`;
  }
  if (tags.includes('tech')) {
    return `${topic(map.name)} 숨긴 테크가 잘 먹힙니다. 정찰 한 번 놓치면 첫 카드가 그대로 승부처가 됩니다.`;
  }
  return `${topic(map.name)} 밸런스형입니다. 그래서 작은 정찰 차이와 첫 교전 위치가 더 크게 보입니다.`;
}

function buildMetaReadLineV2(rng, homeMeta, awayMeta) {
  const notes = [...new Set([...(homeMeta?.notes || []), ...(awayMeta?.notes || [])])].filter(Boolean);
  const homeSample = Number(homeMeta?.sampleSize || 0);
  const awaySample = Number(awayMeta?.sampleSize || 0);
  const mapSample = Math.max(Number(homeMeta?.mapSampleSize || 0), Number(awayMeta?.mapSampleSize || 0));
  if (notes.length) {
    const note = notes[Math.floor(rng() * notes.length) % notes.length];
    return `${note}. 그래도 표본은 표본입니다. 오늘은 정찰 반응과 첫 병력 위치가 답을 말해줍니다.`;
  }
  if (homeSample + awaySample >= 4 || mapSample >= 3) {
    return `최근 표본은 선수 ${homeSample + awaySample}세트, 맵 ${mapSample}세트입니다. 빌드명보다 첫 병력 동선이 더 중요해요.`;
  }
  return '표본은 아직 얇습니다. 이런 세트는 이름값보다 스타팅, 정찰, 첫 교전 판단을 봐야 합니다.';
}

function matchupReadLineV2(homePlayer, awayPlayer, homeBuild, awayBuild) {
  const matchup = matchupOf(homePlayer.race, awayPlayer.race);
  const buildPair = `${castBuildLabel(homeBuild)} 대 ${castBuildLabel(awayBuild)}`;
  if (matchup === 'TvZ') return `테저전입니다. ${buildPair}. 테란은 베슬 타이밍, 저그는 뮤탈과 디파일러 전환까지 이어지는 시간이 관건입니다.`;
  if (matchup === 'TvP') return `테프전입니다. ${buildPair}. 탱크 라인을 어디까지 밀고, 프로토스가 어느 타이밍에 덮치느냐가 핵심입니다.`;
  if (matchup === 'ZvP') return `저프전입니다. ${buildPair}. 커세어 시야, 해처리 숫자, 첫 한방 진출 시간이 서로 맞물립니다.`;
  if (matchup === 'TvT') return `테테전입니다. ${buildPair}. 자리 한 번 잘못 잡으면 복구가 오래 걸리는 매치업입니다.`;
  if (matchup === 'ZvZ') return `저저전입니다. ${buildPair}. 저글링 한 번, 뮤탈 한 번의 숫자 차이가 바로 세트가 됩니다.`;
  if (matchup === 'PvP') return `프프전입니다. ${buildPair}. 로보틱스 정보와 첫 드라군 위치가 가장 먼저 보입니다.`;
  return `${castRaceLabel(homePlayer)} 대 ${castRaceLabel(awayPlayer)}입니다. ${buildPair}. 초반 정보전이 먼저입니다.`;
}

function openingReadLineV2(homePlayer, awayPlayer, homeBuild, awayBuild) {
  if (homeBuild.style === 'rush' || awayBuild.style === 'rush') {
    const attacker = homeBuild.style === 'rush' ? homePlayer : awayPlayer;
    const defender = homeBuild.style === 'rush' ? awayPlayer : homePlayer;
    const attackBuild = homeBuild.style === 'rush' ? homeBuild : awayBuild;
    return `${attacker.name} 쪽이 먼저 걸어옵니다. ${castBuildLabel(attackBuild)}. ${defender.name}은 첫 정찰이 곧 방어 타이밍입니다.`;
  }
  if (homeBuild.style === 'harass' || awayBuild.style === 'harass') {
    return `양쪽 모두 화면을 넓게 써야 합니다. ${homePlayer.name}은 ${castBuildLabel(homeBuild)}, ${awayPlayer.name}은 ${castBuildLabel(awayBuild)}. 흔들리는 쪽이 먼저 손해 봅니다.`;
  }
  if (homeBuild.style === 'tech' || awayBuild.style === 'tech') {
    const techPlayer = homeBuild.style === 'tech' ? homePlayer : awayPlayer;
    const techBuild = homeBuild.style === 'tech' ? homeBuild : awayBuild;
    return `${techPlayer.name} 쪽에 ${castBuildLabel(techBuild)} 냄새가 납니다. 지금 확인하지 못하면 첫 카드에 정면으로 맞습니다.`;
  }
  return `${homePlayer.name}은 ${castBuildLabel(homeBuild)}, ${awayPlayer.name}은 ${castBuildLabel(awayBuild)}. 아직은 정면 힘싸움 구도입니다.`;
}

function firstFightLineV2(winnerName, loserName, winnerBuild, closeGame) {
  if (closeGame) {
    return `첫 교전 붙었습니다! ${winnerName}이 근소하게 잡았어요. 그래도 ${loserName}, 병력 방향만 다시 잡으면 바로 반격 가능합니다.`;
  }
  if (winnerBuild.style === 'rush') {
    return `${winnerName}이 바로 들어갑니다! ${buildName(winnerBuild)} 타이밍이 방어 병력 모이기 전에 꽂혔습니다.`;
  }
  if (winnerBuild.style === 'harass') {
    return `${winnerName}의 견제가 누적됩니다. 일꾼, 시야, 생산 동선이 동시에 흔들려요. 상대 손이 바빠집니다.`;
  }
  if (winnerBuild.style === 'tech') {
    return `${winnerName}의 숨긴 카드가 열렸습니다. 준비 병력이 빗나가면 이 순간부터 경기가 기울 수 있습니다.`;
  }
  return `${winnerName}이 정면에서 이득을 봅니다. 무리하지 않았고, 병력 교환이 깔끔했습니다.`;
}

function midgameLineV2(leaderName, leaderBuild, closeGame) {
  if (closeGame) {
    return '중반이 정말 팽팽합니다. 멀티 하나, 병력 방향 하나만 틀어져도 바로 흐름이 넘어갑니다.';
  }
  if (leaderBuild.style === 'macro') {
    return `${leaderName}이 멀티를 먼저 안정화했습니다. 상대는 기다리면 더 불편해집니다. 지금 흔들어야 합니다.`;
  }
  if (leaderBuild.style === 'harass') {
    return `${leaderName}이 계속 흔듭니다. 이건 화려한 한 방보다 화면 전환과 판단 속도로 만든 리드입니다.`;
  }
  return `${leaderName}이 ${castStyleLabel(leaderBuild)} 흐름으로 주도권을 잡았습니다. 다음 장면은 센터 싸움인지, 역습인지 봐야 합니다.`;
}

function swingLineV2(winnerName, leaderName, closeGame, homeWin, pHome) {
  const favoriteHome = Number(pHome || 0.5) >= 0.57;
  const favoriteAway = Number(pHome || 0.5) <= 0.43;
  const upset = (favoriteHome && !homeWin) || (favoriteAway && homeWin);
  if (upset) return `${winnerName}이 뒤집습니다! 이건 운이 아니라 첫 판단과 교전 위치로 만든 반전입니다.`;
  if (closeGame) return '아직 몰라요. 병력 한 덩어리 방향만 틀어져도 바로 반대편으로 흐름이 넘어갑니다.';
  return `${leaderName}이 주도권을 놓지 않습니다. 이제 센터와 멀티를 같이 잡으면 마무리 각이 보입니다.`;
}

function finishLineV2(winnerName, winnerBuild, closeGame, isAceSet) {
  if (isAceSet) return `${winnerName}, 에이스결정전의 압박을 버팁니다. 지금 이 한 세트는 점수 이상의 무게입니다.`;
  if (closeGame) return `${winnerName}이 마지막 교전을 먼저 잡았습니다. 숫자보다 진출 방향 하나가 더 컸어요.`;
  return `${winnerName}이 ${castBuildLabel(winnerBuild)}로 만든 우위를 끝까지 놓치지 않습니다. 이제 마무리입니다.`;
}

function replayCenterLineV2(rng, { winnerName, loserName, winnerBuild, loserBuild, closeGame, map, homeWin, pHome }) {
  const favoriteHome = Number(pHome || 0.5) >= 0.57;
  const favoriteAway = Number(pHome || 0.5) <= 0.43;
  const upset = (favoriteHome && !homeWin) || (favoriteAway && homeWin);
  if (upset) {
    return pickLine(rng, [
      `리플레이로 보면 ${winnerName}의 첫 이동 경로가 가장 컸습니다. 불리한 예측값을 빌드보다 위치 선정으로 뒤집었습니다.`,
      `${winnerName}이 준비된 방향을 강요했습니다. ${loserName}은 맞는 선택을 했지만 첫 교전 장소가 좋지 않았습니다.`,
    ]);
  }
  if (closeGame) {
    return `리플레이센터 기준 승부처는 ${map.name} 중앙 교전입니다. ${winnerName}이 반 박자 먼저 자리를 잡은 게 차이였습니다.`;
  }
  if (winnerBuild.style === 'rush') return `${winnerName}의 초반 타이밍이 정확했습니다. ${loserName}의 방어 병력은 모이기 전에 끊겼습니다.`;
  if (winnerBuild.style === 'harass') return `${winnerName}의 견제는 피해량보다 동선 파괴가 컸습니다. ${loserName}의 생산 리듬이 계속 밀렸습니다.`;
  if (winnerBuild.style === 'tech') return `${winnerName}의 ${castBuildLabel(winnerBuild)}가 공개된 순간 ${loserName}의 준비 병력이 빗나갔습니다.`;
  if (loserBuild.style === 'rush') return `${loserName}의 초반 승부를 막은 뒤 ${winnerName}이 복구보다 확장을 먼저 고른 판단이 좋았습니다.`;
  return `${winnerName}은 무리하지 않았습니다. 병력 교환, 멀티 시야, 센터 장악을 순서대로 맞췄습니다.`;
}

function benchReactionLineV2(rng, { winnerName, loserName, isAceSet, scoreHome, scoreAway, closeGame }) {
  if (isAceSet) {
    return `${winnerName} 벤치는 크게 일어납니다. 반대로 ${loserName} 쪽은 다음 경기 플랜 전체를 다시 만져야 합니다.`;
  }
  if (scoreHome === 2 || scoreAway === 2) {
    return `${winnerName} 쪽은 이제 끝낼 수 있다는 표정입니다. ${loserName} 쪽은 다음 세트 첫 빌드 선택이 훨씬 무거워집니다.`;
  }
  if (closeGame) {
    return pickLine(rng, [
      `${loserName} 쪽도 고개 숙일 세트는 아닙니다. 마지막 교전 판단만 복기하면 바로 반격 근거가 있습니다.`,
      `${winnerName} 쪽은 웃지만 안심하긴 이릅니다. 이런 접전은 다음 세트 밴픽과 빌드 심리에 바로 남습니다.`,
    ]);
  }
  return `${winnerName} 벤치 분위기가 가벼워졌습니다. ${loserName} 쪽은 빌드보다 첫 반응 순서를 다시 봐야 합니다.`;
}

function broadcastHeadlineForSetV2({ setNo, map, homePlayer, awayPlayer, homeBuild, awayBuild, homeWin, noisyDiff, isAceSet }) {
  const winner = homeWin ? homePlayer : awayPlayer;
  const loser = homeWin ? awayPlayer : homePlayer;
  const winnerBuild = homeWin ? homeBuild : awayBuild;
  const loserBuild = homeWin ? awayBuild : homeBuild;
  const closeGame = Math.abs(Number(noisyDiff || 0)) < 95;
  const prefix = `${setNo}세트${isAceSet ? ' 에이스결정전' : ''} · ${map.name}`;
  if (closeGame) return `${prefix}: ${winner.name}, 마지막 교전 한 박자로 ${loser.name}을 잡았습니다.`;
  if (winnerBuild.style === 'rush') return `${prefix}: ${winner.name}, ${buildName(winnerBuild)} 타이밍으로 초반부터 경기를 열었습니다.`;
  if (winnerBuild.style === 'harass') return `${prefix}: ${winner.name}, 견제 누적으로 ${loser.name}의 운영 리듬을 끊었습니다.`;
  if (winnerBuild.style === 'tech') return `${prefix}: ${winner.name}, 숨긴 ${castBuildLabel(winnerBuild)} 카드로 흐름을 가져왔습니다.`;
  if (loserBuild.style === 'rush') return `${prefix}: ${winner.name}, 초반 압박을 넘긴 뒤 운영으로 뒤집었습니다.`;
  return `${prefix}: ${winner.name}, ${castStyleLabel(winnerBuild)} 흐름을 끝까지 밀었습니다.`;
}

function turningPointForSetV2({ durationSec, winnerName, loserName, winnerBuild, loserBuild, closeGame }) {
  const clock = formatGameClock(Math.round(durationSec * (closeGame ? 0.62 : 0.48)));
  if (closeGame) return `${clock} 중앙 교전에서 ${winnerName}이 병력 방향을 반 박자 먼저 틀며 결정타를 만들었습니다.`;
  if (winnerBuild.style === 'rush') return `${clock} 첫 압박 때 ${loserName}의 방어 병력이 나뉘면서 경기가 크게 기울었습니다.`;
  if (winnerBuild.style === 'harass') return `${clock} 견제가 일꾼과 시야를 동시에 흔들며 ${winnerName} 쪽으로 주도권이 넘어갔습니다.`;
  if (winnerBuild.style === 'tech') return `${clock} ${castBuildLabel(winnerBuild)}가 공개되며 ${loserName}의 대응 병력이 빗나갔습니다.`;
  if (loserBuild.style === 'rush') return `${clock} 초반 압박을 막은 뒤 ${winnerName}의 멀티와 생산이 동시에 살아났습니다.`;
  return `${clock} 센터를 먼저 잡은 ${winnerName}이 병력 회전과 멀티를 동시에 굴렸습니다.`;
}

function buildSetTimelineV2({
  rng,
  setNo,
  map,
  homePlayer,
  awayPlayer,
  homeBuild,
  awayBuild,
  homeWin,
  durationSec,
  noisyDiff,
  pHome = 0.5,
  scoreHome = 0,
  scoreAway = 0,
  isAceSet = false,
  homeMeta = null,
  awayMeta = null,
}) {
  const winnerName = homeWin ? homePlayer.name : awayPlayer.name;
  const loserName = homeWin ? awayPlayer.name : homePlayer.name;
  const winnerBuild = homeWin ? homeBuild : awayBuild;
  const leaderName = Number(noisyDiff || 0) >= 0 ? homePlayer.name : awayPlayer.name;
  const leaderBuild = Number(noisyDiff || 0) >= 0 ? homeBuild : awayBuild;
  const closeGame = Math.abs(Number(noisyDiff || 0)) < 95;
  return [
    buildTimelineLine(0, '캐스터', broadcastOpenLineV2({ setNo, map, homePlayer, awayPlayer, scoreHome, scoreAway, isAceSet })),
    buildTimelineLine(7, '해설', `${scorePressureLine(scoreHome, scoreAway, isAceSet)} ${mapReadLineV2(map)}`),
    buildTimelineLine(18, '캐스터', `빌드 갈렸습니다. ${homePlayer.name} ${castBuildLabel(homeBuild)}, ${tempoWordForBuild(homeBuild)}. ${awayPlayer.name} ${castBuildLabel(awayBuild)}, ${tempoWordForBuild(awayBuild)}.`),
    buildTimelineLine(31, '해설', openingReadLineV2(homePlayer, awayPlayer, homeBuild, awayBuild)),
    buildTimelineLine(47, '분석', buildPlanMatchLineV2(homePlayer, awayPlayer, homeBuild, awayBuild)),
    buildTimelineLine(63, '해설', buildMetaReadLineV2(rng, homeMeta, awayMeta)),
    buildTimelineLine(Math.round(durationSec * 0.21), '해설', matchupReadLineV2(homePlayer, awayPlayer, homeBuild, awayBuild)),
    buildTimelineLine(Math.round(durationSec * 0.34), '캐스터', firstFightLineV2(winnerName, loserName, winnerBuild, closeGame)),
    buildTimelineLine(Math.round(durationSec * 0.49), '해설', midgameLineV2(leaderName, leaderBuild, closeGame)),
    buildTimelineLine(Math.round(durationSec * 0.64), '캐스터', swingLineV2(winnerName, leaderName, closeGame, homeWin, pHome)),
    buildTimelineLine(Math.round(durationSec * 0.80), '해설', finishLineV2(winnerName, winnerBuild, closeGame, isAceSet)),
    buildTimelineLine(Math.max(0, durationSec - 38), '리플레이', replayCenterLineV2(rng, {
      winnerName,
      loserName,
      winnerBuild,
      loserBuild: homeWin ? awayBuild : homeBuild,
      closeGame,
      map,
      homeWin,
      pHome,
    })),
    buildTimelineLine(Math.max(0, durationSec - 16), '벤치', benchReactionLineV2(rng, {
      winnerName,
      loserName,
      isAceSet,
      scoreHome,
      scoreAway,
      closeGame,
    })),
    buildTimelineLine(durationSec, '캐스터', `${winnerName} 승리! 경기 시간 ${formatGameClock(durationSec)}, ${setNo}세트 끝납니다.`),
  ].sort((a, b) => a.t - b.t);
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

function findPlayerOnTeam(teamData, playerId) {
  return teamData?.roster?.find((member) => member.id === playerId) || teamData?.roster?.[0] || null;
}

function estimateTradeInternal(state, ourTeamId, ourPlayerId, theirTeamId, theirPlayerId, cashFromUs = 0) {
  const current = normalizeState(state);
  const ourTeam = getTeam(current, ourTeamId);
  const theirTeam = getTeam(current, theirTeamId);
  const ourPlayer = findPlayerOnTeam(ourTeam, ourPlayerId);
  const theirPlayer = findPlayerOnTeam(theirTeam, theirPlayerId);
  if (!ourTeam || !theirTeam || ourTeam.id === theirTeam.id || !ourPlayer || !theirPlayer) {
    return {
      ok: false,
      acceptChance: 0,
      ratio: 0,
      note: '트레이드 상대와 선수를 다시 선택하세요.',
      ourValue: 0,
      theirValue: 0,
      cashFromUs: 0,
      canTrade: false,
    };
  }

  const cash = Math.max(0, Math.floor(Number(cashFromUs || 0)));
  const ourValue = calcPlayerMarketValue(ourPlayer);
  const theirValue = calcPlayerMarketValue(theirPlayer);
  const receivedByOpponent = ourValue + cash;
  const givenByOpponent = Math.max(1, theirValue);
  const ratio = receivedByOpponent / givenByOpponent;
  let acceptChance = 0.1;
  let note = '상대가 관심이 적습니다.';

  if (ratio >= 1.25) {
    acceptChance = 0.95;
    note = '상대 입장에서 매우 유리합니다.';
  } else if (ratio >= 1.1) {
    acceptChance = 0.85;
    note = '상대 입장에서 유리합니다.';
  } else if (ratio >= 1.0) {
    acceptChance = 0.6;
    note = '대체로 납득 가능한 제안입니다.';
  } else if (ratio >= 0.92) {
    acceptChance = 0.35;
    note = '살짝 손해라서 고민합니다.';
  }

  if (!current.ended) {
    acceptChance *= 0.7;
    note = `(시즌 중) ${note}`;
  }

  const ourStanding = getStanding(current, ourTeam.id);
  const ourMoney = Number(ourStanding?.money ?? ourTeam.money ?? 0);
  const canTrade = ourMoney >= cash && ourTeam.roster.length >= 5 && theirTeam.roster.length >= 5;
  return {
    ok: true,
    acceptChance: clamp(acceptChance, 0.05, 0.98),
    ratio: Math.round(ratio * 1000) / 1000,
    note,
    ourValue,
    theirValue,
    cashFromUs: cash,
    ourTeamId: ourTeam.id,
    ourTeamName: ourTeam.name,
    theirTeamId: theirTeam.id,
    theirTeamName: theirTeam.name,
    ourPlayerId: ourPlayer.id,
    ourPlayerName: ourPlayer.name,
    theirPlayerId: theirPlayer.id,
    theirPlayerName: theirPlayer.name,
    canTrade,
  };
}

function createPlayerContract(member, teamId, seasonNo, overrides = {}) {
  const marketValue = calcPlayerMarketValue(member);
  return {
    playerId: member.id,
    teamId,
    salary: Math.max(10, Math.floor(Number(overrides.salary ?? marketValue * 0.22))),
    signingBonus: Math.max(0, Math.floor(Number(overrides.signingBonus ?? 0))),
    yearsLeft: clamp(Number(overrides.yearsLeft ?? 2), 1, 5),
    startedSeasonNo: Number(overrides.startedSeasonNo || seasonNo || 1),
  };
}

function ensureContractsForTeams(teams, existing, seasonNo = 1) {
  const source = existing && typeof existing === 'object' ? existing : {};
  return teams.reduce((contracts, teamData) => {
    teamData.roster.forEach((member) => {
      const previous = source[member.id];
      contracts[member.id] = createPlayerContract(member, teamData.id, seasonNo, previous || {});
    });
    return contracts;
  }, {});
}

function teamPayrollFromContracts(contracts, teamData) {
  return teamData.roster.reduce((sum, member) => {
    const contract = contracts?.[member.id];
    return sum + Number(contract?.salary || Math.max(10, Math.floor(calcPlayerMarketValue(member) * 0.22)));
  }, 0);
}

function contractRowsForTeam(state, teamId) {
  const teamData = getTeam(state, teamId);
  const standing = getStanding(state, teamId);
  const money = Number(standing?.money ?? teamData.money ?? 0);
  return teamData.roster.map((member) => {
    const contract = state.contracts?.[member.id] || createPlayerContract(member, teamData.id, state.seasonNo);
    const quote = contractRenewalQuote(member, contract);
    const releaseFee = contractReleaseFee(contract);
    return {
      playerId: member.id,
      playerName: member.name,
      salary: Number(contract.salary || 0),
      yearsLeft: Number(contract.yearsLeft || 0),
      signingBonus: Number(contract.signingBonus || 0),
      marketValue: calcPlayerMarketValue(member),
      renewalSalary: quote.salary,
      renewalYears: quote.yearsLeft,
      renewalBonus: quote.signingBonus,
      releaseFee,
      canRenew: money >= quote.signingBonus,
      canRelease: teamData.roster.length > 5 && money >= releaseFee,
      riskLabel: Number(contract.yearsLeft || 0) <= 1 ? '만료 임박' : Number(contract.salary || 0) >= quote.salary ? '안정' : '재평가',
    };
  }).sort((a, b) => b.salary - a.salary || a.playerName.localeCompare(b.playerName, 'ko-KR'));
}

function contractRenewalQuote(member, contract = {}) {
  const marketValue = calcPlayerMarketValue(member);
  const salary = Math.max(
    Number(contract.salary || 0) + (Number(contract.yearsLeft || 0) <= 1 ? 6 : 3),
    Math.floor(marketValue * 0.24),
  );
  const pressureMult = Number(contract.yearsLeft || 0) <= 1 ? 0.36 : 0.28;
  return {
    salary,
    yearsLeft: Number(contract.yearsLeft || 0) <= 1 ? 3 : Math.min(4, Number(contract.yearsLeft || 0) + 1),
    signingBonus: Math.max(24, Math.floor(marketValue * pressureMult)),
  };
}

function contractReleaseFee(contract = {}) {
  const salary = Number(contract.salary || 0);
  const yearsLeft = Math.max(1, Number(contract.yearsLeft || 1));
  return Math.max(10, Math.floor(salary * (yearsLeft <= 1 ? 0.5 : 0.8 + (yearsLeft - 1) * 0.35)));
}

function activeSideEventBlocksRosterMove(state) {
  const personal = normalizePersonalLeague(state.personalLeague, state.seasonNo);
  const winners = normalizeWinnersLeague(state.winnersLeague, state.seasonNo);
  if (personal.stage === 'IN_PROGRESS') return '개인리그 진행 중에는 선수 방출을 할 수 없습니다.';
  if (winners.stage === 'IN_PROGRESS') return '위너스리그 진행 중에는 선수 방출을 할 수 없습니다.';
  return '';
}

function normalizeEconLogs(logs) {
  if (!Array.isArray(logs)) return [];
  return logs
    .filter((entry) => entry && typeof entry === 'object')
    .map((entry) => ({
      id: String(entry.id || `econ-${Date.now().toString(36)}`),
      seasonNo: Number(entry.seasonNo || 1),
      week: Number(entry.week || 0),
      teamId: String(entry.teamId || ''),
      teamName: String(entry.teamName || ''),
      tag: String(entry.tag || 'BONUS'),
      amount: Math.trunc(Number(entry.amount || 0)),
      note: String(entry.note || ''),
      at: Number(entry.at || Date.now()),
      meta: entry.meta && typeof entry.meta === 'object' ? entry.meta : {},
    }))
    .slice(0, 160);
}

function addEconLog(state, params) {
  const teamData = params.teamId ? getTeam(state, params.teamId) : null;
  const entry = {
    id: `econ-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    seasonNo: Number(params.seasonNo ?? state.seasonNo ?? 1),
    week: Number(params.week ?? state.week ?? 0),
    teamId: params.teamId || '',
    teamName: params.teamName || teamData?.name || '',
    tag: params.tag || 'BONUS',
    amount: Math.trunc(Number(params.amount || 0)),
    note: params.note || ECON_TAG_LABELS[params.tag] || '경제 로그',
    at: params.at || Date.now(),
    meta: params.meta || {},
  };
  return {
    ...state,
    econLogs: [entry, ...normalizeEconLogs(state.econLogs)].slice(0, 160),
  };
}

export function getTeamContractRows(state, teamId) {
  const current = normalizeState(state);
  return contractRowsForTeam(current, teamId);
}

export function renewContractAction(state, teamId, playerId) {
  const current = normalizeState(state);
  const teamData = getTeam(current, teamId);
  const member = teamData.roster.find((item) => item.id === playerId);
  if (!member) return addStateLog(current, '재계약할 선수를 찾을 수 없습니다.');
  const standing = getStanding(current, teamData.id);
  const money = Number(standing?.money ?? teamData.money ?? 0);
  const previous = current.contracts?.[member.id] || createPlayerContract(member, teamData.id, current.seasonNo);
  const quote = contractRenewalQuote(member, previous);
  if (money < quote.signingBonus) {
    return addStateLog(current, `${teamData.name} 재계약 실패: ${member.name} 계약금 ${quote.signingBonus} Cr 필요, 보유 ${money} Cr`);
  }

  let next = syncTeamEconomy(current, teamData.id, (team) => ({
    ...team,
    money: Number(team.money || 0) - quote.signingBonus,
  }));
  next = {
    ...next,
    contracts: {
      ...next.contracts,
      [member.id]: {
        ...previous,
        teamId: teamData.id,
        salary: quote.salary,
        signingBonus: quote.signingBonus,
        yearsLeft: quote.yearsLeft,
        startedSeasonNo: Number(current.seasonNo || 1),
      },
    },
  };
  next = addEconLog(next, {
    tag: 'PAYROLL',
    teamId: teamData.id,
    amount: -quote.signingBonus,
    note: `${member.name} 재계약 계약금`,
    meta: { playerId: member.id, salary: quote.salary, yearsLeft: quote.yearsLeft },
  });
  return addStateLog(next, `${teamData.name}이 ${member.name}과 ${quote.yearsLeft}년 재계약했습니다. 연봉 ${quote.salary} Cr, 계약금 ${quote.signingBonus} Cr`);
}

export function releasePlayerAction(state, teamId, playerId) {
  const current = normalizeState(state);
  const blockReason = activeSideEventBlocksRosterMove(current);
  if (blockReason) return addStateLog(current, blockReason);
  const teamData = getTeam(current, teamId);
  const member = teamData.roster.find((item) => item.id === playerId);
  if (!member) return addStateLog(current, '방출할 선수를 찾을 수 없습니다.');
  if (teamData.roster.length <= 5) return addStateLog(current, `${teamData.name}은 최소 5인 로스터를 유지해야 합니다.`);
  const contract = current.contracts?.[member.id] || createPlayerContract(member, teamData.id, current.seasonNo);
  const releaseFee = contractReleaseFee(contract);
  const standing = getStanding(current, teamData.id);
  const money = Number(standing?.money ?? teamData.money ?? 0);
  if (money < releaseFee) return addStateLog(current, `${member.name} 방출 실패: 위약금 ${releaseFee} Cr 필요, 보유 ${money} Cr`);

  const nextContracts = { ...current.contracts };
  delete nextContracts[member.id];
  const nextTeams = current.teams.map((team) => {
    if (team.id !== teamData.id) return team;
    return cloneTeam({
      ...team,
      money: money - releaseFee,
      roster: team.roster.filter((item) => item.id !== member.id),
    });
  });
  const nextInventories = createInventories(nextTeams, current.inventories).map((inventory) => {
    if (inventory.teamId !== teamData.id) return inventory;
    const equipped = { ...inventory.equipped };
    delete equipped[member.id];
    return { ...inventory, equipped };
  });
  let next = {
    ...current,
    teams: nextTeams,
    standings: current.standings.map((row) => (row.teamId === teamData.id ? { ...row, money: money - releaseFee } : row)),
    contracts: nextContracts,
    inventories: nextInventories,
    updatedAt: new Date().toISOString(),
  };
  next = addEconLog(next, {
    tag: 'PAYROLL',
    teamId: teamData.id,
    amount: -releaseFee,
    note: `${member.name} 방출 위약금`,
    meta: { playerId: member.id, release: true },
  });
  return addStateLog(next, `${teamData.name}이 ${member.name}을 방출했습니다. 위약금 ${releaseFee} Cr, 남은 로스터 ${teamData.roster.length - 1}명`);
}

export function tradeCandidateRows(state, ourTeamId) {
  const current = normalizeState(state);
  const ourTeam = getTeam(current, ourTeamId);
  return current.teams
    .filter((teamData) => teamData.id !== ourTeam.id)
    .map((teamData) => ({
      teamId: teamData.id,
      teamName: teamData.name,
      coach: teamData.coach,
      power: teamPower(teamData, current),
      roster: teamData.roster
        .map((member) => ({
          playerId: member.id,
          playerName: member.name,
          race: member.race,
          level: Number(member.level || 0),
          condition: Number(member.condition || 0),
          fame: Number(member.fame || 0),
          marketValue: calcPlayerMarketValue(member),
        }))
        .sort((a, b) => b.marketValue - a.marketValue || a.playerName.localeCompare(b.playerName, 'ko-KR')),
    }))
    .sort((a, b) => b.power - a.power || a.teamName.localeCompare(b.teamName, 'ko-KR'));
}

export function tradePreview(state, ourTeamId, ourPlayerId, theirTeamId, theirPlayerId, cashFromUs = 0) {
  return estimateTradeInternal(state, ourTeamId, ourPlayerId, theirTeamId, theirPlayerId, cashFromUs);
}

export function econSummary(state, teamId) {
  const current = normalizeState(state);
  const logs = normalizeEconLogs(current.econLogs).filter((entry) => !teamId || entry.teamId === teamId);
  const income = logs.filter((entry) => entry.amount > 0).reduce((sum, entry) => sum + entry.amount, 0);
  const expense = logs.filter((entry) => entry.amount < 0).reduce((sum, entry) => sum + Math.abs(entry.amount), 0);
  const contracts = teamId ? contractRowsForTeam(current, teamId) : [];
  return {
    income,
    expense,
    net: income - expense,
    count: logs.length,
    last: logs.slice(0, 8),
    payroll: teamId ? teamPayrollFromContracts(current.contracts, getTeam(current, teamId)) : 0,
    expiringCount: contracts.filter((item) => item.yearsLeft <= 1).length,
  };
}

function getTeamInventory(state, teamId) {
  return createInventories(state.teams, state.inventories).find((item) => item.teamId === teamId) || normalizeInventoryEntry(null, teamId);
}

function addInventoryItem(state, teamId, itemId, qty = 1) {
  const amount = clamp(Math.floor(Number(qty || 0)), 0, 9999);
  if (!amount) return state;
  const inventories = createInventories(state.teams, state.inventories).map((inventory) => {
    if (inventory.teamId !== teamId) return inventory;
    const items = [...inventory.items];
    const index = items.findIndex((item) => item.itemId === itemId);
    if (index >= 0) items[index] = { ...items[index], qty: clamp(Number(items[index].qty || 0) + amount, 0, 9999) };
    else items.push({ itemId, qty: amount });
    return { ...inventory, items };
  });
  return { ...state, inventories };
}

function consumeInventoryItem(state, teamId, itemId, qty = 1) {
  const amount = clamp(Math.floor(Number(qty || 0)), 0, 9999);
  if (!amount) return state;
  const inventories = createInventories(state.teams, state.inventories).map((inventory) => {
    if (inventory.teamId !== teamId) return inventory;
    const items = inventory.items
      .map((item) => (item.itemId === itemId ? { ...item, qty: clamp(Number(item.qty || 0) - amount, 0, 9999) } : item))
      .filter((item) => item.qty > 0);
    return { ...inventory, items };
  });
  return { ...state, inventories };
}

function equippedItemUseCount(inventory, itemId, exceptPlayerId = '') {
  return Object.entries(inventory.equipped || {}).reduce((sum, [playerId, slots]) => {
    if (playerId === exceptPlayerId) return sum;
    return sum + Object.values(slots || {}).filter((id) => id === itemId).length;
  }, 0);
}

function inventoryQty(inventory, itemId) {
  return Number(inventory.items.find((item) => item.itemId === itemId)?.qty || 0);
}

function inferSetKey(itemId) {
  return String(itemId || '').match(/-(\d+)$/)?.[1] || null;
}

function applyEquippedToPlayer(playerData, inventory) {
  const equipped = inventory?.equipped?.[playerData.id];
  if (!equipped) return playerData;
  const stats = { ...(playerData.stats || {}) };
  Object.values(equipped).forEach((itemId) => {
    const item = itemById(itemId);
    Object.entries(item?.effects?.statsDelta || {}).forEach(([key, amount]) => {
      stats[key] = Number(stats[key] || 0) + Number(amount || 0);
    });
  });

  const slotIds = Object.values(equipped).filter(Boolean);
  let equipmentMul = 1;
  if (slotIds.length === 2) equipmentMul = 1.01;
  else if (slotIds.length === 3) equipmentMul = 1.025;
  else if (slotIds.length >= 4) equipmentMul = 1.04;

  const setKeys = slotIds.map(inferSetKey).filter(Boolean);
  if (setKeys.length >= 3 && setKeys.every((key) => key === setKeys[0])) equipmentMul += 0.02;
  else if (setKeys.length === 2 && setKeys[0] === setKeys[1]) equipmentMul += 0.008;

  return {
    ...playerData,
    stats,
    equipmentMul: clamp(equipmentMul, 0.9, 1.12),
  };
}

function teamWithEquipment(state, teamData) {
  const inventory = getTeamInventory(state, teamData.id);
  return {
    ...teamData,
    roster: teamData.roster.map((member) => applyEquippedToPlayer(member, inventory)),
  };
}

export function getSeasonShopRows(state) {
  const current = normalizeState(state);
  return ensureShop(current).offers.map((offer) => {
    const item = itemById(offer.itemId);
    return {
      ...offer,
      name: item?.name || offer.itemId,
      kind: item?.kind || 'other',
      slot: equipmentSlotOfKind(item?.kind),
      effects: item?.effects || {},
    };
  });
}

export function inventoryRowsForTeam(state, teamId) {
  const current = normalizeState(state);
  const inventory = getTeamInventory(current, teamId);
  return inventory.items.map((entry) => {
    const item = itemById(entry.itemId);
    return {
      ...entry,
      name: item?.name || entry.itemId,
      kind: item?.kind || 'other',
      slot: equipmentSlotOfKind(item?.kind),
      equippedCount: equippedItemUseCount(inventory, entry.itemId),
      effects: item?.effects || {},
    };
  }).sort((a, b) => String(a.kind).localeCompare(String(b.kind), 'ko-KR') || a.name.localeCompare(b.name, 'ko-KR'));
}

export function equipmentRowsForPlayer(state, teamId, playerId) {
  const current = normalizeState(state);
  const inventory = getTeamInventory(current, teamId);
  const slots = inventory.equipped?.[playerId] || {};
  return Object.entries(EQUIPMENT_SLOT_LABELS).map(([slot, label]) => {
    const itemId = slots[slot] || '';
    const item = itemById(itemId);
    return {
      slot,
      label,
      itemId,
      itemName: item?.name || '',
      effects: item?.effects || {},
    };
  });
}

export function buyShopItemAction(state, teamId, offerId) {
  let current = normalizeState(state);
  if (current.ended) return addStateLog(current, '시즌 종료 후에는 상점 구매를 진행할 수 없습니다.');
  const shop = ensureShop(current);
  const offer = shop.offers.find((item) => item.offerId === offerId);
  if (!offer) return addStateLog(current, '상점 상품을 찾을 수 없습니다.');
  if (Number(offer.stock || 0) <= 0) return addStateLog(current, '해당 상품은 품절됐습니다.');
  const item = itemById(offer.itemId);
  if (!item) return addStateLog(current, '아이템 정보를 찾을 수 없습니다.');
  const teamData = getTeam(current, teamId);
  const standing = getStanding(current, teamId);
  const money = Number(standing?.money ?? teamData.money ?? 0);
  if (money < offer.price) return addStateLog(current, `${teamData.name} 상점 구매 실패: ${offer.price} Cr 필요, 보유 ${money} Cr`);

  current = syncTeamEconomy(current, teamId, (team) => ({
    ...team,
    money: Number(team.money || 0) - offer.price,
  }));
  current = addInventoryItem({
    ...current,
    shop: {
      ...shop,
      offers: shop.offers.map((row) => (row.offerId === offerId ? { ...row, stock: Math.max(0, Number(row.stock || 0) - 1) } : row)),
    },
  }, teamId, item.id, 1);
  current = addEconLog(current, {
    teamId,
    tag: 'SHOP',
    amount: -offer.price,
    note: `${teamData.name} 상점 구매: ${item.name}`,
    meta: { itemId: item.id, itemName: item.name, price: offer.price },
  });
  return addStateLog(current, `${teamData.name} 상점 구매: ${item.name} -${offer.price} Cr`);
}

export function equipInventoryItemAction(state, teamId, playerId, itemId) {
  const current = normalizeState(state);
  const item = itemById(itemId);
  const slot = equipmentSlotOfKind(item?.kind);
  if (!item || !slot) return addStateLog(current, '장착할 수 없는 아이템입니다.');
  const teamData = getTeam(current, teamId);
  const playerData = teamData.roster.find((member) => member.id === playerId);
  if (!playerData) return addStateLog(current, '선수를 찾을 수 없습니다.');
  const inventory = getTeamInventory(current, teamId);
  const currentSlots = inventory.equipped[playerId] || {};
  const equippedElsewhere = equippedItemUseCount(inventory, itemId, playerId);
  const alreadyOnPlayer = Object.values(currentSlots).filter((id) => id === itemId).length;
  if (inventoryQty(inventory, itemId) <= equippedElsewhere + alreadyOnPlayer && currentSlots[slot] !== itemId) {
    return addStateLog(current, `${item.name} 보유 수량이 부족합니다.`);
  }
  const inventories = createInventories(current.teams, current.inventories).map((row) => {
    if (row.teamId !== teamId) return row;
    return {
      ...row,
      equipped: {
        ...row.equipped,
        [playerId]: {
          ...(row.equipped[playerId] || {}),
          [slot]: itemId,
        },
      },
    };
  });
  return addStateLog({
    ...current,
    inventories,
    updatedAt: new Date().toISOString(),
  }, `${playerData.name} ${EQUIPMENT_SLOT_LABELS[slot]} 장착: ${item.name}`);
}

export function unequipSlotAction(state, teamId, playerId, slot) {
  const current = normalizeState(state);
  const teamData = getTeam(current, teamId);
  const playerData = teamData.roster.find((member) => member.id === playerId);
  const inventories = createInventories(current.teams, current.inventories).map((row) => {
    if (row.teamId !== teamId) return row;
    const nextSlots = { ...(row.equipped[playerId] || {}) };
    delete nextSlots[slot];
    return {
      ...row,
      equipped: {
        ...row.equipped,
        [playerId]: nextSlots,
      },
    };
  });
  return addStateLog({
    ...current,
    inventories,
    updatedAt: new Date().toISOString(),
  }, `${playerData?.name || '선수'} ${EQUIPMENT_SLOT_LABELS[slot] || slot} 장착을 해제했습니다.`);
}

export function consumeInventoryItemAction(state, teamId, playerId, itemId) {
  let current = normalizeState(state);
  const item = itemById(itemId);
  if (!item || item.kind !== 'consumable') return addStateLog(current, '사용할 수 없는 아이템입니다.');
  const inventory = getTeamInventory(current, teamId);
  if (inventoryQty(inventory, itemId) <= 0) return addStateLog(current, `${item.name} 보유 수량이 없습니다.`);
  const teamData = getTeam(current, teamId);
  const playerData = teamData.roster.find((member) => member.id === playerId);
  if (!playerData) return addStateLog(current, '선수를 찾을 수 없습니다.');
  const conditionDelta = Number(item.effects?.conditionDelta || 0);
  const fameDelta = Number(item.effects?.fameDelta || 0);
  current = {
    ...current,
    teams: current.teams.map((team) => (team.id === teamId ? {
      ...team,
      roster: team.roster.map((member) => (member.id === playerId ? {
        ...member,
        condition: clamp(Number(member.condition || 0) + conditionDelta, 0, 100),
        fame: Math.max(0, Math.round(Number(member.fame || 0) + fameDelta)),
      } : member)),
    } : team)),
  };
  current = consumeInventoryItem(current, teamId, itemId, 1);
  return addStateLog({
    ...current,
    updatedAt: new Date().toISOString(),
  }, `${playerData.name}에게 ${item.name} 사용: 컨디션 +${conditionDelta}${fameDelta ? `, 명성 +${fameDelta}` : ''}`);
}

function buildSeasonReport(state) {
  const leader = getTopTeams(state, 1)[0];
  const postseasonChampionTeamId = postseasonChampionId(state);
  const postseasonChampion = postseasonChampionTeamId ? getTeam(state, postseasonChampionTeamId) : null;
  const personal = normalizePersonalLeague(state.personalLeague, state.seasonNo);
  const personalChampion = personalParticipantById(personal, personal.championPlayerId);
  const winners = normalizeWinnersLeague(state.winnersLeague, state.seasonNo);
  const winnersChampion = winners.championTeamId ? getTeam(state, winners.championTeamId) : null;
  const seasonLogs = normalizeEconLogs(state.econLogs).filter((entry) => entry.seasonNo === Number(state.seasonNo || 1));
  const income = seasonLogs.filter((entry) => entry.amount > 0).reduce((sum, entry) => sum + entry.amount, 0);
  const expense = seasonLogs.filter((entry) => entry.amount < 0).reduce((sum, entry) => sum + Math.abs(entry.amount), 0);
  return {
    seasonNo: Number(state.seasonNo || 1),
    createdAt: Date.now(),
    championTeamId: postseasonChampionTeamId || leader?.teamId || '',
    championTeamName: postseasonChampion?.name || leader?.teamName || '',
    regularChampionTeamId: leader?.teamId || '',
    regularChampionTeamName: leader?.teamName || '',
    postseasonChampionTeamId,
    postseasonChampionTeamName: postseasonChampion?.name || '',
    personalChampionPlayerId: personal.championPlayerId || '',
    personalChampionPlayerName: personalChampion?.playerName || '',
    personalChampionTeamName: personalChampion?.teamName || '',
    winnersChampionTeamId: winners.championTeamId || '',
    winnersChampionTeamName: winnersChampion?.name || '',
    played: getPlayedCount(state),
    total: getTotalFixtureCount(state),
    income,
    expense,
    net: income - expense,
    score: scoreState(state),
  };
}

function appendSeasonReport(state) {
  const existing = Array.isArray(state.seasonReports) ? state.seasonReports : [];
  if (existing.some((report) => Number(report.seasonNo) === Number(state.seasonNo))) return state;
  return {
    ...state,
    seasonReports: [buildSeasonReport(state), ...existing].slice(0, 60),
  };
}

export function getSeasonReportRows(state, limit = 8) {
  const current = normalizeState(state);
  return (Array.isArray(current.seasonReports) ? current.seasonReports : [])
    .map((report) => ({
      seasonNo: Number(report.seasonNo || 0),
      championTeamId: String(report.championTeamId || ''),
      championTeamName: String(report.championTeamName || ''),
      regularChampionTeamId: String(report.regularChampionTeamId || ''),
      regularChampionTeamName: String(report.regularChampionTeamName || ''),
      postseasonChampionTeamId: String(report.postseasonChampionTeamId || ''),
      postseasonChampionTeamName: String(report.postseasonChampionTeamName || ''),
      personalChampionPlayerId: String(report.personalChampionPlayerId || ''),
      personalChampionPlayerName: String(report.personalChampionPlayerName || ''),
      personalChampionTeamName: String(report.personalChampionTeamName || ''),
      winnersChampionTeamId: String(report.winnersChampionTeamId || ''),
      winnersChampionTeamName: String(report.winnersChampionTeamName || ''),
      played: Math.max(0, Math.floor(Number(report.played || 0))),
      total: Math.max(0, Math.floor(Number(report.total || 0))),
      income: Math.round(Number(report.income || 0)),
      expense: Math.round(Number(report.expense || 0)),
      net: Math.round(Number(report.net || 0)),
      score: Math.round(Number(report.score || 0)),
      createdAt: Number(report.createdAt || 0),
    }))
    .sort((a, b) => b.seasonNo - a.seasonNo || b.createdAt - a.createdAt)
    .slice(0, limit);
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
  const base = clamp(teamPower(teamData, state) + career.scoutingLevel * 10 + Math.round((rng() - 0.35) * 72), 420, 660);
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
  const payroll = teamPayrollFromContracts(current.contracts, teamData);
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

function lineupFor(teamData, fixtureId) {
  const offset = fixtureId.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const sorted = [...teamData.roster].sort((a, b) => (
    averageStats(b) + Number(b.level || 0) * 12 + Number(b.fame || 0) / 20
  ) - (
    averageStats(a) + Number(a.level || 0) * 12 + Number(a.fame || 0) / 20
  ));
  return Array.from({ length: 5 }, (_, index) => sorted[(index + offset) % sorted.length]);
}

function acePlayerFor(teamData) {
  return [...teamData.roster].sort((a, b) => (
    averageStats(b)
    + Number(b.level || 0) * 18
    + Number(b.fame || 0) / 24
    + Number(b.condition || 0) * 0.4
  ) - (
    averageStats(a)
    + Number(a.level || 0) * 18
    + Number(a.fame || 0) / 24
    + Number(a.condition || 0) * 0.4
  ))[0] || teamData.roster[0];
}

function aceSetMultiplier(member) {
  const stats = member?.stats || {};
  const clutch = (
    Number(stats.attack || 0) * 0.22
    + Number(stats.defense || 0) * 0.18
    + Number(stats.strategy || 0) * 0.2
    + Number(stats.sense || 0) * 0.16
    + Number(stats.control || 0) * 0.24
  ) / 500;
  return 1 + clamp((clutch - 1) * 0.035 + Number(member?.fame || 0) / 36000, 0, 0.055);
}

function simulateSet({ state, fixture, homeTeam, awayTeam, homePlayer, awayPlayer, setNo, scoreHome, scoreAway, isAceSet = false }) {
  const mapIds = state.mapPool.length ? state.mapPool : MAPS.map((item) => item.id);
  const map = mapById(mapIds[(fixture.round + setNo - 2) % mapIds.length]);
  const seed = `${state.runId}|${fixture.id}|${setNo}|${scoreHome}-${scoreAway}`;
  const rng = createRng(seed);
  const buildMeta = collectBuildMeta(state);
  const homeMeta = createBuildMetaContext(buildMeta, homePlayer, map);
  const awayMeta = createBuildMetaContext(buildMeta, awayPlayer, map);
  const homeBuild = pickBuild(`${seed}|build|home`, homeTeam, homePlayer, awayPlayer, map, homeMeta);
  const awayBuild = pickBuild(`${seed}|build|away`, awayTeam, awayPlayer, homePlayer, map, awayMeta);
  const homePhase = phasePower(homePlayer);
  const awayPhase = phasePower(awayPlayer);
  const homeBuildPhase = stylePhaseBonus(homeBuild.style);
  const awayBuildPhase = stylePhaseBonus(awayBuild.style);
  const homeCounter = counterBonus(homeBuild.style, awayBuild.style);
  const awayCounter = counterBonus(awayBuild.style, homeBuild.style);
  const homeBaseMul = conditionMultiplier(homePlayer) * levelMultiplier(homePlayer) * mapMultiplier(homePlayer.race, awayPlayer.race, map) * Number(homePlayer.equipmentMul || 1) * (isAceSet ? aceSetMultiplier(homePlayer) : 1);
  const awayBaseMul = conditionMultiplier(awayPlayer) * levelMultiplier(awayPlayer) * mapMultiplier(awayPlayer.race, homePlayer.race, map) * Number(awayPlayer.equipmentMul || 1) * (isAceSet ? aceSetMultiplier(awayPlayer) : 1);
  const coachMul = (style) => (
    style === 'balanced' ? 1.01
    : style === 'macro' ? 1.008
    : style === 'aggressive' ? 1.006
    : style === 'mindgame' ? 1.004
    : 1
  );
  const homeCoachMul = coachMul(homeTeam.coachStyle);
  const awayCoachMul = coachMul(awayTeam.coachStyle);
  const homeEarly = homePhase.early * homeBaseMul * (1 + homeBuildPhase.early + homeCounter * 0.7) * homeCoachMul;
  const homeMid = homePhase.mid * homeBaseMul * (1 + homeBuildPhase.mid + homeCounter * 0.55) * homeCoachMul;
  const homeLate = homePhase.late * homeBaseMul * (1 + homeBuildPhase.late + homeCounter * 0.3) * homeCoachMul;
  const awayEarly = awayPhase.early * awayBaseMul * (1 + awayBuildPhase.early + awayCounter * 0.7) * awayCoachMul;
  const awayMid = awayPhase.mid * awayBaseMul * (1 + awayBuildPhase.mid + awayCounter * 0.55) * awayCoachMul;
  const awayLate = awayPhase.late * awayBaseMul * (1 + awayBuildPhase.late + awayCounter * 0.3) * awayCoachMul;
  const diff = 0.34 * (homeEarly - awayEarly) + 0.36 * (homeMid - awayMid) + 0.3 * (homeLate - awayLate);
  const importance = importanceForSet(scoreHome, scoreAway) + (isAceSet ? 0.15 : 0);
  const homePressure = pressureOf(homePlayer, awayPlayer, homeTeam);
  const awayPressure = pressureOf(awayPlayer, homePlayer, awayTeam);
  let noiseAmp = baseNoiseAmp(homePlayer, awayPlayer);
  noiseAmp *= noiseMultiplierFromPressure(homePressure, importance);
  noiseAmp *= noiseMultiplierFromPressure(awayPressure, importance);
  if (homeTeam.coachStyle === 'mindgame' || awayTeam.coachStyle === 'mindgame') noiseAmp *= 1.05;
  noiseAmp *= 1 - clamp((Math.abs(diff) - 240) / 1800, 0, 0.18);
  const noisyDiff = diff + gaussian(rng, 0, noiseAmp);
  const pHome = clamp(1 / (1 + Math.exp(-noisyDiff / 220)), 0.08, 0.92);
  const homeWin = rng() < pHome;
  const durationSec = durationFromDiff(rng, noisyDiff, homePlayer.race === awayPlayer.race);
  const winnerName = homeWin ? homePlayer.name : awayPlayer.name;
  const loserName = homeWin ? awayPlayer.name : homePlayer.name;
  const winnerBuild = homeWin ? homeBuild : awayBuild;
  const loserBuild = homeWin ? awayBuild : homeBuild;
  const closeGame = Math.abs(Number(noisyDiff || 0)) < 95;
  const timeline = buildSetTimelineV2({
    rng,
    setNo,
    map,
    homePlayer,
    awayPlayer,
    homeBuild,
    awayBuild,
    homeWin,
    durationSec,
    noisyDiff,
    pHome,
    scoreHome,
    scoreAway,
    isAceSet,
    homeMeta,
    awayMeta,
  });
  return {
    setNo,
    isAceSet: Boolean(isAceSet),
    mapId: map.id,
    mapName: map.name,
    homePlayerId: homePlayer.id,
    homePlayerName: homePlayer.name,
    awayPlayerId: awayPlayer.id,
    awayPlayerName: awayPlayer.name,
    winnerTeamId: homeWin ? homeTeam.id : awayTeam.id,
    winnerPlayerId: homeWin ? homePlayer.id : awayPlayer.id,
    probabilityHome: Math.round(pHome * 100),
    durationSec,
    matchup: matchupOf(homePlayer.race, awayPlayer.race),
    homeBuildName: homeBuild.name,
    awayBuildName: awayBuild.name,
    homeBuildStyle: homeBuild.style,
    awayBuildStyle: awayBuild.style,
    homeBuildReason: buildPlanSummary(homeBuild),
    awayBuildReason: buildPlanSummary(awayBuild),
    homeBuildPickShare: Number(homeBuild.draft?.pickShare || 0),
    awayBuildPickShare: Number(awayBuild.draft?.pickShare || 0),
    homeBuildMetaBias: Number(homeBuild.draft?.metaBiasPct || 0),
    awayBuildMetaBias: Number(awayBuild.draft?.metaBiasPct || 0),
    homeBuildMapFit: Number(homeBuild.draft?.mapFitPct || 0),
    awayBuildMapFit: Number(awayBuild.draft?.mapFitPct || 0),
    broadcastHeadline: broadcastHeadlineForSetV2({
      setNo,
      map,
      homePlayer,
      awayPlayer,
      homeBuild,
      awayBuild,
      homeWin,
      noisyDiff,
      isAceSet,
    }),
    turningPoint: turningPointForSetV2({
      durationSec,
      winnerName,
      loserName,
      winnerBuild,
      loserBuild,
      closeGame,
    }),
    timeline,
    mapBiasHome: Math.round((mapMultiplier(homePlayer.race, awayPlayer.race, map) - 1) * 1000) / 10,
    phaseDiff: Math.round(diff),
    noisyDiff: Math.round(noisyDiff),
    noiseAmp: Math.round(noiseAmp),
    counterHome: Math.round(homeCounter * 1000) / 10,
    counterAway: Math.round(awayCounter * 1000) / 10,
    aceBoostHome: isAceSet ? Math.round((aceSetMultiplier(homePlayer) - 1) * 1000) / 10 : 0,
    aceBoostAway: isAceSet ? Math.round((aceSetMultiplier(awayPlayer) - 1) * 1000) / 10 : 0,
  };
}

function simulateFixture(state, fixture) {
  const homeTeam = teamWithEquipment(state, getTeam(state, fixture.homeTeamId));
  const awayTeam = teamWithEquipment(state, getTeam(state, fixture.awayTeamId));
  const homeLineup = lineupFor(homeTeam, fixture.id);
  const awayLineup = lineupFor(awayTeam, fixture.id);
  let scoreHome = 0;
  let scoreAway = 0;
  const sets = [];

  for (let setNo = 1; setNo <= 5 && scoreHome < 3 && scoreAway < 3; setNo += 1) {
    const isAceSet = setNo === 5 && scoreHome === 2 && scoreAway === 2;
    const homePlayer = isAceSet ? acePlayerFor(homeTeam) : homeLineup[(setNo - 1) % homeLineup.length];
    const awayPlayer = isAceSet ? acePlayerFor(awayTeam) : awayLineup[(setNo - 1) % awayLineup.length];
    const setResult = simulateSet({
      state,
      fixture,
      homeTeam,
      awayTeam,
      homePlayer,
      awayPlayer,
      setNo,
      scoreHome,
      scoreAway,
      isAceSet,
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

function addStandingMoney(standings, teamId, amount) {
  return standings.map((row) => (
    row.teamId === teamId ? { ...row, money: Number(row.money || 0) + amount } : row
  ));
}

function loserTeamId(result) {
  if (!result) return '';
  return result.winnerTeamId === result.homeTeamId ? result.awayTeamId : result.homeTeamId;
}

function postseasonRankTeamIds(state) {
  const fixtures = normalizePostseasonFixtures(state.postseasonFixtures).filter((fixture) => fixture.played && fixture.result);
  if (!fixtures.length) return [];
  const ordered = fixtures.slice().sort((a, b) => b.round - a.round);
  const ranks = [];
  const final = ordered[0];
  if (final?.result?.winnerTeamId) ranks.push(final.result.winnerTeamId);
  const runnerUp = loserTeamId(final?.result);
  if (runnerUp) ranks.push(runnerUp);
  ordered.slice(1).forEach((fixture) => {
    const loser = loserTeamId(fixture.result);
    if (loser && !ranks.includes(loser)) ranks.push(loser);
  });
  return ranks;
}

function awardPostseasonPrizes(state) {
  if (state.postseasonPrizesAwarded) return state;
  let next = { ...state, postseasonPrizesAwarded: true };
  postseasonRankTeamIds(state).slice(0, POSTSEASON_PRIZES.length).forEach((teamId, index) => {
    const amount = POSTSEASON_PRIZES[index] || 0;
    if (!amount) return;
    next = {
      ...next,
      standings: addStandingMoney(next.standings, teamId, amount),
    };
    next = addEconLog(next, {
      tag: 'BONUS',
      teamId,
      amount,
      note: `포스트시즌 ${index + 1}위 상금`,
      meta: { postseason: true, rank: index + 1 },
    });
  });
  return next;
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
    const postseasonFixtures = normalizePostseasonFixtures(state.postseasonFixtures);
    if (!postseasonFixtures.length) {
      const bracket = createPostseasonFixtures(state);
      if (bracket.length) {
        return {
          ...state,
          week: totalRounds + 1,
          postseasonFixtures: bracket,
          log: [`정규 시즌이 종료됐습니다. 상위 ${Math.min(4, bracket.length + 1)}팀 포스트시즌이 시작됩니다.`, ...state.log].slice(0, 90),
        };
      }
    }

    const postseasonChampion = postseasonChampionId({ ...state, postseasonFixtures });
    if (postseasonChampion) {
      const withPrizes = awardPostseasonPrizes({ ...state, postseasonFixtures });
      return appendSeasonReport({
        ...withPrizes,
        ended: true,
        championTeamId: postseasonChampion,
        log: [`${teamName(withPrizes, postseasonChampion)}이 시즌 ${state.seasonNo} 포스트시즌 우승을 차지했습니다.`, ...withPrizes.log].slice(0, 90),
      });
    }

    return {
      ...state,
      week: totalRounds + 1,
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
  const aceSet = result.sets.find((setResult) => setResult.isAceSet);
  return {
    ...state,
    log: [
      `${result.round}주차 ${result.homeTeamName} ${result.scoreHome}:${result.scoreAway} ${result.awayTeamName} - ${winner} 승${aceSet ? ` · 에이스전 ${aceSet.homePlayerName} vs ${aceSet.awayPlayerName}` : ''}`,
      ...state.log,
    ].slice(0, 90),
  };
}

function addPostseasonResultLog(state, result, label) {
  const winner = result.winnerTeamId === result.homeTeamId ? result.homeTeamName : result.awayTeamName;
  const aceSet = result.sets.find((setResult) => setResult.isAceSet);
  return {
    ...state,
    log: [
      `${label} ${result.homeTeamName} ${result.scoreHome}:${result.scoreAway} ${result.awayTeamName} - ${winner} 승${aceSet ? ` · 에이스전 ${aceSet.homePlayerName} vs ${aceSet.awayPlayerName}` : ''}`,
      ...state.log,
    ].slice(0, 90),
  };
}

function simulatePostseasonFixtureAction(state, fixture) {
  const result = simulateFixture(state, fixture);
  const winnerReward = 260 + Number(fixture.round || 1) * 80;
  const loserReward = 130 + Number(fixture.round || 1) * 45;
  let next = {
    ...state,
    postseasonFixtures: advancePostseasonBracket(state.postseasonFixtures, result),
    standings: addStandingMoney(
      addStandingMoney(state.standings, result.winnerTeamId, winnerReward),
      result.loserTeamId,
      loserReward,
    ),
    teams: tuneRosterAfterMatch(state.teams, result),
    updatedAt: new Date().toISOString(),
  };
  [
    { teamId: result.winnerTeamId, amount: winnerReward, result: '승' },
    { teamId: result.loserTeamId, amount: loserReward, result: '패' },
  ].forEach((reward) => {
    next = addEconLog(next, {
      tag: 'BONUS',
      teamId: reward.teamId,
      amount: reward.amount,
      note: `${fixture.label} ${reward.result} 수당`,
      meta: {
        postseason: true,
        matchId: result.matchId,
        winnerTeamId: result.winnerTeamId,
        scoreHome: result.scoreHome,
        scoreAway: result.scoreAway,
      },
    });
  });
  next = addPostseasonResultLog(next, result, fixture.label);
  return advanceWeekIfNeeded(next);
}

export function simulateNextMatchAction(state) {
  let current = normalizeState(state);
  if (current.ended) {
    return {
      ...current,
      log: ['이미 시즌이 종료됐습니다. 전적에 기록하거나 다음 시즌을 시작하세요.', ...current.log].slice(0, 90),
    };
  }
  const fixture = current.fixtures.find((item) => item.round === current.week && !item.played)
    || current.fixtures.find((item) => !item.played);
  if (!fixture && isRegularSeasonComplete(current) && !normalizePostseasonFixtures(current.postseasonFixtures).length) {
    current = advanceWeekIfNeeded(current);
  }
  const postseasonFixture = !fixture ? nextPostseasonFixture(current) : null;
  if (!fixture && postseasonFixture) return simulatePostseasonFixtureAction(current, postseasonFixture);
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
  [
    { teamId: result.homeTeamId, amount: result.winnerTeamId === result.homeTeamId ? 150 : 70 },
    { teamId: result.awayTeamId, amount: result.winnerTeamId === result.awayTeamId ? 150 : 70 },
  ].forEach((reward) => {
    next = addEconLog(next, {
      tag: 'MATCH_REWARD',
      teamId: reward.teamId,
      amount: reward.amount,
      note: `${fixture.id} 경기 상금`,
      meta: {
        matchId: result.matchId,
        winnerTeamId: result.winnerTeamId,
        scoreHome: result.scoreHome,
        scoreAway: result.scoreAway,
      },
    });
  });
  next = addResultLog(next, result);
  return advanceWeekIfNeeded(next);
}

export function simulateWeekAction(state) {
  let next = normalizeState(state);
  const targetWeek = next.week;
  const targetHadRegularFixtures = next.fixtures.some((fixture) => fixture.round === targetWeek && !fixture.played);
  while (!next.ended && next.fixtures.some((fixture) => fixture.round === targetWeek && !fixture.played)) {
    next = simulateNextMatchAction(next);
  }
  if (!targetHadRegularFixtures && isRegularSeasonComplete(next) && !normalizePostseasonFixtures(next.postseasonFixtures).length) {
    next = advanceWeekIfNeeded(next);
  }
  while (!targetHadRegularFixtures && !next.ended && isRegularSeasonComplete(next) && nextPostseasonFixture(next)) {
    next = simulateNextMatchAction(next);
  }
  return next;
}

function seasonAutoProgressSignature(state) {
  const current = normalizeState(state);
  const postseasonFixtures = normalizePostseasonFixtures(current.postseasonFixtures);
  return [
    current.week,
    current.ended ? 1 : 0,
    current.championTeamId || '',
    current.fixtures.filter((fixture) => fixture.played).length,
    postseasonFixtures.length,
    postseasonFixtures.filter((fixture) => fixture.played).length,
  ].join(':');
}

export function simulateSeasonAction(state, maxTurns = 64) {
  let next = normalizeState(state);
  const limit = clamp(Math.floor(Number(maxTurns || 64)), 1, 512);
  let turns = 0;

  while (!next.ended && turns < limit) {
    const before = seasonAutoProgressSignature(next);
    next = simulateWeekAction(next);
    turns += 1;

    if (seasonAutoProgressSignature(next) === before) {
      next = simulateNextMatchAction(next);
      turns += 1;
      if (seasonAutoProgressSignature(next) === before) break;
    }
  }

  if (next.ended) {
    return addStateLog(next, `자동 진행 완료: 시즌 ${next.seasonNo} 우승 ${teamName(next, next.championTeamId)}`);
  }
  return addStateLog(next, `자동 진행이 ${turns}회 처리 후 중단되었습니다. 남은 일정을 수동으로 확인하세요.`);
}

function personalRoundLabel(round) {
  return PERSONAL_ROUND_LABELS[Number(round || 0)] || `${round}라운드`;
}

function personalPhaseLabel(phase) {
  return PERSONAL_PHASE_LABELS[phase] || phase || '대기';
}

function personalPlayerRows(state) {
  return state.teams.flatMap((teamData) => {
    const equippedTeam = teamWithEquipment(state, teamData);
    return teamData.roster.map((member) => {
      const equippedMember = equippedTeam.roster.find((row) => row.id === member.id) || member;
      const rating = Math.round(
        averageStats(equippedMember)
        + Number(member.level || 0) * 18
        + Number(member.fame || 0) * 0.18
        + Number(member.condition || 0) * 0.45,
      );
      const formScore = Math.round(
        Number(member.condition || 0) * 0.7
        + Number(member.level || 0) * 3.5
        + Number(member.fame || 0) * 0.035,
      );
      return {
        playerId: member.id,
        playerName: member.name,
        teamId: teamData.id,
        teamName: teamData.name,
        race: member.race,
        rating,
        formScore,
      };
    });
  }).sort((a, b) => b.rating - a.rating || a.playerName.localeCompare(b.playerName, 'ko-KR'));
}

function personalSeedTier(seed) {
  const value = Math.max(1, Math.floor(Number(seed || 1)));
  if (value <= 8) return '본선 시드';
  if (value <= 16) return '듀얼 시드';
  if (value <= 24) return '32강 시드';
  return 'PC방 예선';
}

function buildPersonalParticipants(state, size = 32) {
  return personalPlayerRows(state)
    .slice(0, size)
    .map((row, index) => ({
      ...row,
      seed: index + 1,
      seedTier: personalSeedTier(index + 1),
    }));
}

function participantIds(participants) {
  return participants.map((participant) => participant.playerId).filter(Boolean);
}

function participantNameById(personal, playerId) {
  return personalParticipantById(personal, playerId)?.playerName || playerId;
}

function uniqueIds(ids) {
  const seen = new Set();
  return ids.filter((id) => {
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

function pickV2Qualifiers(personal, ids, count, seed) {
  const rng = createRng(seed);
  const byId = new Map(personal.participants.map((participant) => [participant.playerId, participant]));
  return uniqueIds(ids)
    .map((id) => {
      const participant = byId.get(id);
      return {
        id,
        score: Number(participant?.rating || 0)
          + Number(participant?.seed ? 80 - participant.seed : 0)
          + Number(participant?.formScore || 0) * 0.45
          + rng() * 120,
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(2, count))
    .map((row) => row.id);
}

function averageNumber(rows, getter) {
  const values = rows.map((row) => Number(getter(row) || 0)).filter((value) => Number.isFinite(value));
  if (!values.length) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function compactCountText(rows, getter, labeler = (value) => value) {
  const counts = new Map();
  rows.forEach((row) => {
    const key = String(getter(row) || '').trim();
    if (!key) return;
    counts.set(key, Number(counts.get(key) || 0) + 1);
  });
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || String(labeler(a[0])).localeCompare(String(labeler(b[0])), 'ko-KR'))
    .slice(0, 4)
    .map(([key, count]) => `${labeler(key)} ${count}`)
    .join(' · ');
}

function buildPersonalStageProfile(personal, entrantIds, qualifierIds) {
  const entrantSet = uniqueIds(entrantIds).map((id) => personalParticipantById(personal, id)).filter(Boolean);
  const qualifierSet = uniqueIds(qualifierIds).map((id) => personalParticipantById(personal, id)).filter(Boolean);
  const topSeedNames = qualifierSet
    .slice()
    .sort((a, b) => Number(a.seed || 99) - Number(b.seed || 99))
    .slice(0, 4)
    .map((row) => `${row.seed}번 ${row.playerName}`);
  const upsetNames = qualifierSet
    .filter((row) => Number(row.seed || 0) >= 17)
    .sort((a, b) => Number(b.formScore || 0) - Number(a.formScore || 0))
    .slice(0, 4)
    .map((row) => `${row.playerName}(${row.seed}번)`);
  const averageEntrantRating = averageNumber(entrantSet, (row) => row.rating);
  const averageQualifierRating = averageNumber(qualifierSet, (row) => row.rating);
  const averageQualifierForm = averageNumber(qualifierSet, (row) => row.formScore);
  return {
    profileText: [
      compactCountText(qualifierSet, (row) => row.race, (race) => RACE_LABELS[race] || race),
      averageQualifierRating ? `통과 평균 ${averageQualifierRating}` : '',
      averageQualifierForm ? `폼 ${averageQualifierForm}` : '',
    ].filter(Boolean).join(' · '),
    seedText: compactCountText(qualifierSet, (row) => row.seedTier || personalSeedTier(row.seed)),
    upsetText: upsetNames.length ? `하위 시드 돌파: ${upsetNames.join(' / ')}` : '',
    topSeedNames,
    upsetNames,
    averageEntrantRating,
    averageQualifierRating,
    averageQualifierForm,
  };
}

function appendPersonalStageReport(personal, phase, entrantIds, qualifierIds, summary) {
  const profile = buildPersonalStageProfile(personal, entrantIds, qualifierIds);
  const report = {
    phase,
    label: personalPhaseLabel(phase),
    summary,
    entrantCount: entrantIds.length,
    qualifierPlayerIds: qualifierIds,
    qualifierNames: qualifierIds.map((id) => participantNameById(personal, id)),
    ...profile,
    playedAt: Date.now(),
  };
  return {
    ...personal,
    stageReports: [report, ...(personal.stageReports || [])].slice(0, 20),
    updatedAt: Date.now(),
  };
}

function makePersonalRoundMatches(playerIds, round, seasonNo) {
  const ordered = [...playerIds];
  const paired = [];
  for (let index = 0; index < ordered.length / 2; index += 1) {
    paired.push({
      id: `PL-S${seasonNo}-R${round}-M${index + 1}`,
      round,
      bracketIndex: index,
      playerAId: ordered[index],
      playerBId: ordered[ordered.length - 1 - index],
      scoreA: 0,
      scoreB: 0,
      winnerId: '',
      setWinners: [],
      mapNames: [],
      played: false,
      playedAt: 0,
    });
  }
  return paired;
}

function personalParticipantById(personal, playerId) {
  return personal.participants.find((item) => item.playerId === playerId) || null;
}

function findPlayerContext(state, playerId) {
  for (const teamData of state.teams) {
    const rawPlayer = teamData.roster.find((member) => member.id === playerId);
    if (!rawPlayer) continue;
    const equippedTeam = teamWithEquipment(state, teamData);
    const playerData = equippedTeam.roster.find((member) => member.id === playerId) || rawPlayer;
    return {
      team: teamData,
      equippedTeam,
      player: playerData,
      rawPlayer,
    };
  }
  return null;
}

function simulatePersonalMatch(state, match) {
  const home = findPlayerContext(state, match.playerAId);
  const away = findPlayerContext(state, match.playerBId);
  if (!home || !away) {
    return {
      ...match,
      played: true,
      winnerId: home?.player?.id || away?.player?.id || match.playerAId,
      playedAt: Date.now(),
    };
  }

  const winNeed = Number(match.round || 1) >= 3 ? 3 : 2;
  let scoreA = 0;
  let scoreB = 0;
  const setWinners = [];
  const mapNames = [];
  const setDetails = [];
  for (let setNo = 1; setNo <= winNeed * 2 - 1 && scoreA < winNeed && scoreB < winNeed; setNo += 1) {
    const setResult = simulateSet({
      state,
      fixture: {
        id: match.id,
        round: Number(match.round || 1),
      },
      homeTeam: home.equippedTeam,
      awayTeam: away.equippedTeam,
      homePlayer: home.player,
      awayPlayer: away.player,
      setNo,
      scoreHome: scoreA,
      scoreAway: scoreB,
    });
    setWinners.push(setResult.winnerPlayerId);
    mapNames.push(setResult.mapName);
    setDetails.push({
      setNo,
      mapId: setResult.mapId,
      mapName: setResult.mapName,
      homePlayerId: home.player.id,
      homePlayerName: home.player.name,
      awayPlayerId: away.player.id,
      awayPlayerName: away.player.name,
      winnerId: setResult.winnerPlayerId,
      winnerName: setResult.winnerPlayerId === home.player.id ? home.player.name : away.player.name,
      homeBuildName: setResult.homeBuildName,
      awayBuildName: setResult.awayBuildName,
      homeBuildStyle: setResult.homeBuildStyle,
      awayBuildStyle: setResult.awayBuildStyle,
      homeBuildReason: setResult.homeBuildReason,
      awayBuildReason: setResult.awayBuildReason,
      homeBuildPickShare: setResult.homeBuildPickShare,
      awayBuildPickShare: setResult.awayBuildPickShare,
      homeBuildMetaBias: setResult.homeBuildMetaBias,
      awayBuildMetaBias: setResult.awayBuildMetaBias,
      homeBuildMapFit: setResult.homeBuildMapFit,
      awayBuildMapFit: setResult.awayBuildMapFit,
      broadcastHeadline: setResult.broadcastHeadline,
      turningPoint: setResult.turningPoint,
      durationSec: setResult.durationSec,
      timeline: setResult.timeline,
    });
    if (setResult.winnerPlayerId === home.player.id) scoreA += 1;
    else scoreB += 1;
  }

  return {
    ...match,
    scoreA,
    scoreB,
    winnerId: scoreA > scoreB ? home.player.id : away.player.id,
    setWinners,
    mapNames,
    setDetails,
    played: true,
    playedAt: Date.now(),
  };
}

function applyPersonalMatchGrowth(state, match) {
  const winnerId = match.winnerId;
  const loserId = match.playerAId === winnerId ? match.playerBId : match.playerAId;
  const round = Number(match.round || 1);
  return {
    ...state,
    teams: state.teams.map((teamData) => ({
      ...teamData,
      roster: teamData.roster.map((member) => {
        if (member.id === winnerId) {
          return {
            ...member,
            condition: clamp(Number(member.condition || 100) - 2, 35, 100),
            fame: Math.max(0, Number(member.fame || 0) + 10 + round * 3),
            stats: {
              ...member.stats,
              sense: clamp(Number(member.stats?.sense || 0) + 1, 0, 1000),
              control: clamp(Number(member.stats?.control || 0) + 1, 0, 1000),
            },
          };
        }
        if (member.id === loserId) {
          return {
            ...member,
            condition: clamp(Number(member.condition || 100) - 5, 30, 100),
            fame: Math.max(0, Number(member.fame || 0) + 3 + round),
          };
        }
        return member;
      }),
    })),
  };
}

function addPersonalMatchAllowance(state, match) {
  const winner = findPlayerContext(state, match.winnerId);
  const loserId = match.playerAId === match.winnerId ? match.playerBId : match.playerAId;
  const loser = findPlayerContext(state, loserId);
  const winAmount = 35 + Number(match.round || 1) * 15;
  const loseAmount = 12 + Number(match.round || 1) * 8;
  let next = state;
  [
    { ctx: winner, amount: winAmount, result: '승' },
    { ctx: loser, amount: loseAmount, result: '패' },
  ].forEach((row) => {
    if (!row.ctx?.team?.id) return;
    next = syncTeamEconomy(next, row.ctx.team.id, (team) => ({
      ...team,
      money: Number(team.money || 0) + row.amount,
    }));
    next = addEconLog(next, {
      tag: 'PERSONAL',
      teamId: row.ctx.team.id,
      amount: row.amount,
      note: `개인리그 ${personalRoundLabel(match.round)} ${row.result} 수당: ${row.ctx.player.name}`,
      meta: { matchId: match.id, playerId: row.ctx.player.id, round: match.round },
    });
  });
  return next;
}

function appendPersonalHistory(state, personal, champion, runnerUp) {
  const existing = normalizePersonalHistory(state.personalHistory);
  if (existing.some((entry) => Number(entry.seasonNo) === Number(state.seasonNo || 1))) return state;
  return {
    ...state,
    personalHistory: [{
      seasonNo: Number(state.seasonNo || 1),
      championPlayerId: champion?.playerId || '',
      championPlayerName: champion?.playerName || '',
      championTeamId: champion?.teamId || '',
      championTeamName: champion?.teamName || '',
      runnerUpPlayerId: runnerUp?.playerId || '',
      runnerUpPlayerName: runnerUp?.playerName || '',
      runnerUpTeamName: runnerUp?.teamName || '',
      played: personal.matches.filter((match) => match.played).length,
      at: Date.now(),
    }, ...existing].slice(0, 40),
  };
}

function awardPersonalChampion(state, personal, finalMatch) {
  const champion = personalParticipantById(personal, finalMatch.winnerId);
  const runnerUpId = finalMatch.playerAId === finalMatch.winnerId ? finalMatch.playerBId : finalMatch.playerAId;
  const runnerUp = personalParticipantById(personal, runnerUpId);
  let next = state;
  [
    { participant: champion, amount: 600, label: '우승 상금' },
    { participant: runnerUp, amount: 300, label: '준우승 상금' },
  ].forEach((row) => {
    if (!row.participant?.teamId) return;
    next = syncTeamEconomy(next, row.participant.teamId, (team) => ({
      ...team,
      money: Number(team.money || 0) + row.amount,
    }));
    next = addEconLog(next, {
      tag: 'PERSONAL',
      teamId: row.participant.teamId,
      amount: row.amount,
      note: `개인리그 ${row.label}: ${row.participant.playerName}`,
      meta: { playerId: row.participant.playerId, seasonNo: personal.seasonNo },
    });
  });
  next = appendPersonalHistory(next, personal, champion, runnerUp);
  return addStateLog(next, `${champion?.playerName || '선수'}가 시즌 ${personal.seasonNo} 개인리그 우승을 차지했습니다.`);
}

function advancePersonalRoundIfNeeded(state) {
  const personal = normalizePersonalLeague(state.personalLeague, state.seasonNo);
  if (personal.stage !== 'IN_PROGRESS') return state;
  const currentRound = Number(personal.currentRound || 1);
  const roundMatches = personal.matches
    .filter((match) => Number(match.round) === currentRound)
    .sort((a, b) => a.bracketIndex - b.bracketIndex);
  if (!roundMatches.length || roundMatches.some((match) => !match.played || !match.winnerId)) return state;

  const winners = roundMatches.map((match) => match.winnerId);
  if (winners.length <= 1) {
    const finalMatch = roundMatches[0];
    const finishedPersonal = {
      ...personal,
      stage: 'DONE',
      phase: '완료',
      championPlayerId: finalMatch.winnerId,
      runnerUpPlayerId: finalMatch.playerAId === finalMatch.winnerId ? finalMatch.playerBId : finalMatch.playerAId,
      updatedAt: Date.now(),
    };
    return awardPersonalChampion({
      ...state,
      personalLeague: finishedPersonal,
      updatedAt: new Date().toISOString(),
    }, finishedPersonal, finalMatch);
  }

  const nextRound = currentRound + 1;
  const nextMatches = makePersonalRoundMatches(winners, nextRound, personal.seasonNo);
  return addStateLog({
    ...state,
    personalLeague: {
      ...personal,
      currentRound: nextRound,
      phase: personalRoundLabel(nextRound),
      matches: [...personal.matches, ...nextMatches],
      updatedAt: Date.now(),
    },
    updatedAt: new Date().toISOString(),
  }, `개인리그 ${personalRoundLabel(nextRound)} 대진이 확정됐습니다.`);
}

function latestPersonalStageReport(personal, phase) {
  return (personal.stageReports || []).find((report) => report.phase === phase) || null;
}

function advancePersonalV2Preliminary(state) {
  const current = normalizeState(state);
  let personal = normalizePersonalLeague(current.personalLeague, current.seasonNo);
  const allIds = participantIds(personal.participants);
  if (personal.phase === 'PC_BANG') {
    const entrants = allIds.slice(16);
    const qualifierIds = pickV2Qualifiers(personal, entrants.length ? entrants : allIds, Math.min(8, Math.max(2, Math.floor((entrants.length || allIds.length) / 2))), `${current.runId}|pl|pcbang|s${current.seasonNo}`);
    personal = appendPersonalStageReport(personal, 'PC_BANG', entrants.length ? entrants : allIds, qualifierIds, `${qualifierIds.length}명이 듀얼 토너먼트로 진출했습니다.`);
    return addStateLog({
      ...current,
      personalLeague: {
        ...personal,
        phase: 'DUAL_TOURNAMENT',
      },
      updatedAt: new Date().toISOString(),
    }, `개인리그 ${personalPhaseLabel('PC_BANG')} 완료. ${qualifierIds.map((id) => participantNameById(personal, id)).join(', ')} 진출.`);
  }

  if (personal.phase === 'DUAL_TOURNAMENT') {
    const pcReport = latestPersonalStageReport(personal, 'PC_BANG');
    const seeded = allIds.slice(8, 16);
    const entrants = uniqueIds([...seeded, ...(pcReport?.qualifierPlayerIds || [])]);
    const qualifierIds = pickV2Qualifiers(personal, entrants.length ? entrants : allIds, Math.min(8, Math.max(2, Math.floor((entrants.length || allIds.length) / 2))), `${current.runId}|pl|dual|s${current.seasonNo}`);
    personal = appendPersonalStageReport(personal, 'DUAL_TOURNAMENT', entrants.length ? entrants : allIds, qualifierIds, `${qualifierIds.length}명이 32강 시드권을 확보했습니다.`);
    return addStateLog({
      ...current,
      personalLeague: {
        ...personal,
        phase: 'RO32',
      },
      updatedAt: new Date().toISOString(),
    }, `개인리그 ${personalPhaseLabel('DUAL_TOURNAMENT')} 완료. ${qualifierIds.map((id) => participantNameById(personal, id)).join(', ')} 통과.`);
  }

  if (personal.phase === 'RO32') {
    const dualReport = latestPersonalStageReport(personal, 'DUAL_TOURNAMENT');
    const entrants = uniqueIds([...allIds.slice(0, 24), ...(dualReport?.qualifierPlayerIds || [])]);
    const qualifierIds = pickV2Qualifiers(personal, entrants.length ? entrants : allIds, 16, `${current.runId}|pl|ro32|s${current.seasonNo}`);
    const matches = makePersonalRoundMatches(qualifierIds, 1, current.seasonNo);
    personal = appendPersonalStageReport(personal, 'RO32', entrants.length ? entrants : allIds, qualifierIds, '8개 조 듀얼을 마치고 16강 대진이 확정됐습니다.');
    return addStateLog({
      ...current,
      personalLeague: {
        ...personal,
        phase: personalRoundLabel(1),
        currentRound: 1,
        matches,
      },
      updatedAt: new Date().toISOString(),
    }, `개인리그 ${personalPhaseLabel('RO32')} 완료. 16강 대진이 확정됐습니다.`);
  }

  return current;
}

export function startPersonalLeagueAction(state) {
  const current = normalizeState(state);
  const existing = normalizePersonalLeague(current.personalLeague, current.seasonNo);
  if (existing.stage === 'IN_PROGRESS') return addStateLog(current, '이미 개인리그가 진행 중입니다.');
  if (existing.stage === 'DONE') return addStateLog(current, '이번 시즌 개인리그는 이미 종료됐습니다.');

  const participants = buildPersonalParticipants(current, 32);
  if (participants.length < 2) return addStateLog(current, '개인리그를 시작할 선수가 부족합니다.');
  return addStateLog({
    ...current,
    personalLeague: {
      seasonNo: current.seasonNo,
      format: 'V2',
      stage: 'IN_PROGRESS',
      phase: 'PC_BANG',
      currentRound: 0,
      participants,
      matches: [],
      stageReports: [],
      championPlayerId: '',
      runnerUpPlayerId: '',
      updatedAt: Date.now(),
    },
    updatedAt: new Date().toISOString(),
  }, `시즌 ${current.seasonNo} 개인리그 V2가 개막했습니다. PC방 예선부터 32강 듀얼을 거쳐 16강 토너먼트로 진행합니다.`);
}

export function advancePersonalLeagueAction(state) {
  let current = normalizeState(state);
  const personal = normalizePersonalLeague(current.personalLeague, current.seasonNo);
  if (personal.stage === 'NOT_STARTED') return startPersonalLeagueAction(current);
  if (personal.stage === 'DONE') return addStateLog(current, '개인리그가 이미 종료됐습니다.');
  if (personal.format === 'V2' && ['PC_BANG', 'DUAL_TOURNAMENT', 'RO32'].includes(personal.phase)) {
    return advancePersonalV2Preliminary(current);
  }

  current = advancePersonalRoundIfNeeded(current);
  let nextPersonal = normalizePersonalLeague(current.personalLeague, current.seasonNo);
  if (nextPersonal.stage === 'DONE') return current;
  const match = nextPersonal.matches.find((item) => Number(item.round) === Number(nextPersonal.currentRound) && !item.played)
    || nextPersonal.matches.find((item) => !item.played);
  if (!match) return advancePersonalRoundIfNeeded(current);

  const result = simulatePersonalMatch(current, match);
  nextPersonal = {
    ...nextPersonal,
    matches: nextPersonal.matches.map((item) => (item.id === match.id ? result : item)),
    updatedAt: Date.now(),
  };
  current = {
    ...current,
    personalLeague: nextPersonal,
    updatedAt: new Date().toISOString(),
  };
  current = applyPersonalMatchGrowth(current, result);
  current = addPersonalMatchAllowance(current, result);

  const participantA = personalParticipantById(nextPersonal, result.playerAId);
  const participantB = personalParticipantById(nextPersonal, result.playerBId);
  const winner = personalParticipantById(nextPersonal, result.winnerId);
  current = addStateLog(
    current,
    `개인리그 ${personalRoundLabel(result.round)}: ${participantA?.playerName || result.playerAId} ${result.scoreA}:${result.scoreB} ${participantB?.playerName || result.playerBId} - ${winner?.playerName || result.winnerId} 승`,
  );
  return advancePersonalRoundIfNeeded(current);
}

export function getPersonalLeagueSummary(state) {
  const current = normalizeState(state);
  const personal = normalizePersonalLeague(current.personalLeague, current.seasonNo);
  const nextMatch = personal.matches.find((match) => Number(match.round) === Number(personal.currentRound) && !match.played)
    || personal.matches.find((match) => !match.played)
    || null;
  const champion = personalParticipantById(personal, personal.championPlayerId);
  const runnerUp = personalParticipantById(personal, personal.runnerUpPlayerId);
  const a = nextMatch ? personalParticipantById(personal, nextMatch.playerAId) : null;
  const b = nextMatch ? personalParticipantById(personal, nextMatch.playerBId) : null;
  return {
    seasonNo: personal.seasonNo,
    format: personal.format || 'V2',
    stage: personal.stage,
    phase: personal.phase,
    phaseLabel: personalPhaseLabel(personal.phase),
    currentRound: personal.currentRound,
    participants: personal.participants.length,
    played: personal.matches.filter((match) => match.played).length,
    total: personal.matches.length,
    championName: champion?.playerName || '',
    championTeamName: champion?.teamName || '',
    runnerUpName: runnerUp?.playerName || '',
    nextMatchLabel: nextMatch ? `${personalRoundLabel(nextMatch.round)} · ${a?.playerName || nextMatch.playerAId} vs ${b?.playerName || nextMatch.playerBId}` : '',
    stageReports: (personal.stageReports || []).map((report) => ({
      ...report,
      label: personalPhaseLabel(report.phase),
      qualifierNames: Array.isArray(report.qualifierNames) && report.qualifierNames.length
        ? report.qualifierNames
        : (report.qualifierPlayerIds || []).map((id) => participantNameById(personal, id)),
    })),
    historyCount: normalizePersonalHistory(current.personalHistory).length,
  };
}

export function getPersonalLeagueRows(state, limit = 12) {
  const current = normalizeState(state);
  const personal = normalizePersonalLeague(current.personalLeague, current.seasonNo);
  return personal.matches
    .map((match) => {
      const a = personalParticipantById(personal, match.playerAId);
      const b = personalParticipantById(personal, match.playerBId);
      const winner = personalParticipantById(personal, match.winnerId);
      return {
        ...match,
        roundLabel: personalRoundLabel(match.round),
        playerAName: a?.playerName || match.playerAId,
        playerBName: b?.playerName || match.playerBId,
        playerATeamName: a?.teamName || '',
        playerBTeamName: b?.teamName || '',
        winnerName: winner?.playerName || '',
      };
    })
    .sort((a, b) => (
      Number(a.played) - Number(b.played)
      || a.round - b.round
      || a.bracketIndex - b.bracketIndex
    ))
    .slice(0, limit);
}

function winnersLineupFor(state, teamData) {
  const equippedTeam = teamWithEquipment(state, teamData);
  return [...equippedTeam.roster]
    .sort((a, b) => (
      averageStats(b) + Number(b.level || 0) * 12 + Number(b.fame || 0) / 25
    ) - (
      averageStats(a) + Number(a.level || 0) * 12 + Number(a.fame || 0) / 25
    ))
    .slice(0, 7);
}

function firstAvailableWinnersPlayer(lineup, usedIds) {
  const used = new Set(Array.isArray(usedIds) ? usedIds : []);
  return lineup.find((member) => !used.has(member.id)) || lineup[lineup.length - 1] || null;
}

function appendWinnersHistory(state, winners) {
  const existing = normalizeWinnersHistory(state.winnersHistory);
  if (existing.some((entry) => Number(entry.seasonNo) === Number(state.seasonNo || 1))) return state;
  const championTeam = getTeam(state, winners.championTeamId);
  const runnerUpTeam = getTeam(state, winners.runnerUpTeamId);
  const setWins = new Map();
  winners.sets.forEach((setResult) => {
    setWins.set(setResult.winnerPlayerName, Number(setWins.get(setResult.winnerPlayerName) || 0) + 1);
  });
  const allKillPlayerName = [...setWins.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || '';
  return {
    ...state,
    winnersHistory: [{
      seasonNo: Number(state.seasonNo || 1),
      championTeamId: championTeam?.id || winners.championTeamId || '',
      championTeamName: championTeam?.name || winners.championTeamId || '',
      runnerUpTeamId: runnerUpTeam?.id || winners.runnerUpTeamId || '',
      runnerUpTeamName: runnerUpTeam?.name || winners.runnerUpTeamId || '',
      scoreHome: winners.scoreHome,
      scoreAway: winners.scoreAway,
      allKillPlayerName,
      sets: winners.sets.length,
      at: Date.now(),
    }, ...existing].slice(0, 40),
  };
}

function applyWinnersSetGrowth(state, setResult) {
  const loserPlayerId = setResult.homePlayerId === setResult.winnerPlayerId ? setResult.awayPlayerId : setResult.homePlayerId;
  return {
    ...state,
    teams: state.teams.map((teamData) => ({
      ...teamData,
      roster: teamData.roster.map((member) => {
        if (member.id === setResult.winnerPlayerId) {
          return {
            ...member,
            condition: clamp(Number(member.condition || 100) - 2, 35, 100),
            fame: Math.max(0, Number(member.fame || 0) + 11),
            stats: {
              ...member.stats,
              attack: clamp(Number(member.stats?.attack || 0) + 1, 0, 1000),
              control: clamp(Number(member.stats?.control || 0) + 1, 0, 1000),
            },
          };
        }
        if (member.id === loserPlayerId) {
          return {
            ...member,
            condition: clamp(Number(member.condition || 100) - 6, 30, 100),
            fame: Math.max(0, Number(member.fame || 0) + 2),
          };
        }
        return member;
      }),
    })),
  };
}

function addWinnersSetAllowance(state, setResult) {
  const loserTeamId = setResult.winnerTeamId === setResult.homeTeamId ? setResult.awayTeamId : setResult.homeTeamId;
  let next = state;
  [
    { teamId: setResult.winnerTeamId, amount: 45, result: '승' },
    { teamId: loserTeamId, amount: 18, result: '패' },
  ].forEach((row) => {
    if (!row.teamId) return;
    next = syncTeamEconomy(next, row.teamId, (team) => ({
      ...team,
      money: Number(team.money || 0) + row.amount,
    }));
    next = addEconLog(next, {
      tag: 'WINNERS',
      teamId: row.teamId,
      amount: row.amount,
      note: `위너스리그 ${setResult.setNo}세트 ${row.result} 수당`,
      meta: { setId: setResult.id, winnerPlayerId: setResult.winnerPlayerId },
    });
  });
  return next;
}

function awardWinnersChampion(state, winners) {
  let next = state;
  [
    { teamId: winners.championTeamId, amount: 520, label: '우승 상금' },
    { teamId: winners.runnerUpTeamId, amount: 240, label: '준우승 상금' },
  ].forEach((row) => {
    if (!row.teamId) return;
    next = syncTeamEconomy(next, row.teamId, (team) => ({
      ...team,
      money: Number(team.money || 0) + row.amount,
    }));
    next = addEconLog(next, {
      tag: 'WINNERS',
      teamId: row.teamId,
      amount: row.amount,
      note: `위너스리그 ${row.label}`,
      meta: { seasonNo: winners.seasonNo, scoreHome: winners.scoreHome, scoreAway: winners.scoreAway },
    });
  });
  next = appendWinnersHistory(next, winners);
  return addStateLog(next, `${teamName(next, winners.championTeamId)}이 시즌 ${winners.seasonNo} 위너스리그에서 ${winners.scoreHome}:${winners.scoreAway}로 승리했습니다.`);
}

export function startWinnersLeagueAction(state, homeTeamId = '') {
  const current = normalizeState(state);
  const existing = normalizeWinnersLeague(current.winnersLeague, current.seasonNo);
  if (existing.stage === 'IN_PROGRESS') return addStateLog(current, '이미 위너스리그가 진행 중입니다.');
  if (existing.stage === 'DONE') return addStateLog(current, '이번 시즌 위너스리그는 이미 종료됐습니다.');

  const homeTeam = getTeam(current, homeTeamId);
  const opponent = getTopTeams(current, current.teams.length).find((row) => row.teamId !== homeTeam.id)
    || current.teams.find((teamData) => teamData.id !== homeTeam.id);
  const awayTeam = getTeam(current, opponent?.teamId || opponent?.id);
  const homeLineup = winnersLineupFor(current, homeTeam);
  const awayLineup = winnersLineupFor(current, awayTeam);
  const homePlayer = firstAvailableWinnersPlayer(homeLineup, []);
  const awayPlayer = firstAvailableWinnersPlayer(awayLineup, []);
  if (!homePlayer || !awayPlayer || homeTeam.id === awayTeam.id) return addStateLog(current, '위너스리그를 시작할 팀과 선수가 부족합니다.');

  return addStateLog({
    ...current,
    winnersLeague: {
      seasonNo: current.seasonNo,
      stage: 'IN_PROGRESS',
      homeTeamId: homeTeam.id,
      awayTeamId: awayTeam.id,
      scoreHome: 0,
      scoreAway: 0,
      currentHomePlayerId: homePlayer.id,
      currentAwayPlayerId: awayPlayer.id,
      usedHomePlayerIds: [homePlayer.id],
      usedAwayPlayerIds: [awayPlayer.id],
      sets: [],
      championTeamId: '',
      runnerUpTeamId: '',
      updatedAt: Date.now(),
    },
    updatedAt: new Date().toISOString(),
  }, `위너스리그 개막: ${homeTeam.name} vs ${awayTeam.name}`);
}

export function advanceWinnersLeagueAction(state) {
  let current = normalizeState(state);
  let winners = normalizeWinnersLeague(current.winnersLeague, current.seasonNo);
  if (winners.stage === 'NOT_STARTED') return startWinnersLeagueAction(current);
  if (winners.stage === 'DONE') return addStateLog(current, '위너스리그가 이미 종료됐습니다.');

  const rawHomeTeam = getTeam(current, winners.homeTeamId);
  const rawAwayTeam = getTeam(current, winners.awayTeamId);
  const homeTeam = teamWithEquipment(current, rawHomeTeam);
  const awayTeam = teamWithEquipment(current, rawAwayTeam);
  const homeLineup = winnersLineupFor(current, rawHomeTeam);
  const awayLineup = winnersLineupFor(current, rawAwayTeam);
  const homePlayer = homeLineup.find((member) => member.id === winners.currentHomePlayerId) || firstAvailableWinnersPlayer(homeLineup, winners.usedHomePlayerIds);
  const awayPlayer = awayLineup.find((member) => member.id === winners.currentAwayPlayerId) || firstAvailableWinnersPlayer(awayLineup, winners.usedAwayPlayerIds);
  if (!homePlayer || !awayPlayer) return addStateLog(current, '위너스리그 출전 선수를 찾을 수 없습니다.');

  const setNo = winners.sets.length + 1;
  const setResult = simulateSet({
    state: current,
    fixture: {
      id: `WL-S${winners.seasonNo}-SET${setNo}`,
      round: setNo,
    },
    homeTeam,
    awayTeam,
    homePlayer,
    awayPlayer,
    setNo,
    scoreHome: winners.scoreHome,
    scoreAway: winners.scoreAway,
  });
  const scoreHome = winners.scoreHome + (setResult.winnerTeamId === homeTeam.id ? 1 : 0);
  const scoreAway = winners.scoreAway + (setResult.winnerTeamId === awayTeam.id ? 1 : 0);
  const winnerTeamName = setResult.winnerTeamId === homeTeam.id ? homeTeam.name : awayTeam.name;
  const winnerPlayerName = setResult.winnerPlayerId === homePlayer.id ? homePlayer.name : awayPlayer.name;
  const setRecord = {
    id: `WL-S${winners.seasonNo}-SET${setNo}`,
    setNo,
    mapName: setResult.mapName,
    homeTeamId: homeTeam.id,
    awayTeamId: awayTeam.id,
    homePlayerId: homePlayer.id,
    homePlayerName: homePlayer.name,
    awayPlayerId: awayPlayer.id,
    awayPlayerName: awayPlayer.name,
    winnerTeamId: setResult.winnerTeamId,
    winnerTeamName,
    winnerPlayerId: setResult.winnerPlayerId,
    winnerPlayerName,
    probabilityHome: setResult.probabilityHome,
    durationSec: setResult.durationSec,
    mapId: setResult.mapId,
    homeBuildName: setResult.homeBuildName,
    awayBuildName: setResult.awayBuildName,
    homeBuildStyle: setResult.homeBuildStyle,
    awayBuildStyle: setResult.awayBuildStyle,
    homeBuildReason: setResult.homeBuildReason,
    awayBuildReason: setResult.awayBuildReason,
    homeBuildPickShare: setResult.homeBuildPickShare,
    awayBuildPickShare: setResult.awayBuildPickShare,
    homeBuildMetaBias: setResult.homeBuildMetaBias,
    awayBuildMetaBias: setResult.awayBuildMetaBias,
    homeBuildMapFit: setResult.homeBuildMapFit,
    awayBuildMapFit: setResult.awayBuildMapFit,
    broadcastHeadline: setResult.broadcastHeadline,
    turningPoint: setResult.turningPoint,
    timeline: setResult.timeline,
    playedAt: Date.now(),
  };

  const nextHomeUsed = new Set(winners.usedHomePlayerIds);
  const nextAwayUsed = new Set(winners.usedAwayPlayerIds);
  let nextHomePlayerId = homePlayer.id;
  let nextAwayPlayerId = awayPlayer.id;
  if (setResult.winnerTeamId === homeTeam.id) {
    const nextAwayPlayer = firstAvailableWinnersPlayer(awayLineup, [...nextAwayUsed]);
    if (nextAwayPlayer) {
      nextAwayUsed.add(nextAwayPlayer.id);
      nextAwayPlayerId = nextAwayPlayer.id;
    }
  } else {
    const nextHomePlayer = firstAvailableWinnersPlayer(homeLineup, [...nextHomeUsed]);
    if (nextHomePlayer) {
      nextHomeUsed.add(nextHomePlayer.id);
      nextHomePlayerId = nextHomePlayer.id;
    }
  }

  const done = scoreHome >= 4 || scoreAway >= 4 || setNo >= 7;
  winners = {
    ...winners,
    stage: done ? 'DONE' : 'IN_PROGRESS',
    scoreHome,
    scoreAway,
    currentHomePlayerId: done ? '' : nextHomePlayerId,
    currentAwayPlayerId: done ? '' : nextAwayPlayerId,
    usedHomePlayerIds: [...nextHomeUsed],
    usedAwayPlayerIds: [...nextAwayUsed],
    sets: [...winners.sets, setRecord],
    championTeamId: done ? (scoreHome > scoreAway ? homeTeam.id : awayTeam.id) : '',
    runnerUpTeamId: done ? (scoreHome > scoreAway ? awayTeam.id : homeTeam.id) : '',
    updatedAt: Date.now(),
  };

  current = {
    ...current,
    winnersLeague: winners,
    updatedAt: new Date().toISOString(),
  };
  current = applyWinnersSetGrowth(current, setRecord);
  current = addWinnersSetAllowance(current, setRecord);
  current = addStateLog(current, `위너스리그 ${setNo}세트: ${homePlayer.name} vs ${awayPlayer.name} - ${winnerPlayerName} 승 (${scoreHome}:${scoreAway})`);
  if (done) return awardWinnersChampion(current, winners);
  return current;
}

export function getWinnersLeagueSummary(state) {
  const current = normalizeState(state);
  const winners = normalizeWinnersLeague(current.winnersLeague, current.seasonNo);
  const homeTeam = winners.homeTeamId ? getTeam(current, winners.homeTeamId) : null;
  const awayTeam = winners.awayTeamId ? getTeam(current, winners.awayTeamId) : null;
  const currentHome = homeTeam?.roster.find((member) => member.id === winners.currentHomePlayerId);
  const currentAway = awayTeam?.roster.find((member) => member.id === winners.currentAwayPlayerId);
  const champion = winners.championTeamId ? getTeam(current, winners.championTeamId) : null;
  return {
    seasonNo: winners.seasonNo,
    stage: winners.stage,
    homeTeamName: homeTeam?.name || '',
    awayTeamName: awayTeam?.name || '',
    scoreHome: winners.scoreHome,
    scoreAway: winners.scoreAway,
    played: winners.sets.length,
    total: 7,
    nextMatchLabel: winners.stage === 'IN_PROGRESS' ? `${currentHome?.name || '-'} vs ${currentAway?.name || '-'}` : '',
    championTeamName: champion?.name || '',
    historyCount: normalizeWinnersHistory(current.winnersHistory).length,
  };
}

export function getWinnersLeagueRows(state, limit = 10) {
  const current = normalizeState(state);
  const winners = normalizeWinnersLeague(current.winnersLeague, current.seasonNo);
  return winners.sets
    .map((setResult) => ({
      ...setResult,
      label: `${setResult.setNo}세트`,
    }))
    .sort((a, b) => b.setNo - a.setNo)
    .slice(0, limit);
}

function teamActionDef(actionId) {
  return TEAM_ACTION_DEFS.find((action) => action.id === actionId) || null;
}

function teamActionUsageKey(state, teamId, playerId) {
  return `${Number(state.seasonNo || 1)}:${Number(state.week || 1)}:${teamId}:${playerId}`;
}

function teamActionEffectText(action) {
  const parts = [`운영비 ${action.cost.toLocaleString('ko-KR')} Cr`];
  if (action.conditionDelta) parts.push(`컨디션 ${action.conditionDelta > 0 ? '+' : ''}${action.conditionDelta}`);
  if (action.statDelta) parts.push(`전 스탯 +${action.statDelta}`);
  if (action.fameDelta) parts.push(`명성 +${action.fameDelta}`);
  if (action.moneyDelta) parts.push(`수입 +${action.moneyDelta.toLocaleString('ko-KR')} Cr`);
  if (action.rewardItemId) parts.push(`${itemById(action.rewardItemId)?.name || '보상'} +1`);
  return parts.join(' · ');
}

export function teamActionRows(state, teamId, playerId) {
  const current = normalizeState(state);
  const teamData = getTeam(current, teamId);
  const player = findPlayerOnTeam(teamData, playerId);
  const standing = getStanding(current, teamId);
  const money = Number(standing?.money ?? teamData.money ?? 0);
  const used = current.teamActionsUsed && player
    ? current.teamActionsUsed[teamActionUsageKey(current, teamId, player.id)]
    : null;
  return TEAM_ACTION_DEFS.map((action) => {
    const netCost = Math.max(0, Number(action.cost || 0) - Math.max(0, Number(action.moneyDelta || 0)));
    const conditionAfter = Number(player?.condition || 0) + Number(action.conditionDelta || 0);
    const canRun = Boolean(player)
      && !current.ended
      && !used
      && money >= Number(action.cost || 0)
      && conditionAfter >= 0;
    return {
      ...action,
      playerId: player?.id || '',
      playerName: player?.name || '',
      used: Boolean(used),
      canRun,
      money,
      netCost,
      conditionAfter,
      effectText: teamActionEffectText(action),
      disabledReason: used
        ? '이번 주에 이미 운영 액션을 사용했습니다.'
        : money < Number(action.cost || 0)
          ? `${Number(action.cost || 0).toLocaleString('ko-KR')} Cr 필요`
          : conditionAfter < 0
            ? '컨디션 부족'
            : '',
    };
  });
}

export function runTeamActionAction(state, teamId, playerId, actionId) {
  const current = normalizeState(state);
  if (current.ended) return addStateLog(current, '시즌 종료 후에는 팀 운영 액션을 진행할 수 없습니다.');
  const action = teamActionDef(actionId);
  if (!action) return addStateLog(current, '알 수 없는 팀 운영 액션입니다.');
  const teamData = getTeam(current, teamId);
  const player = findPlayerOnTeam(teamData, playerId);
  if (!teamData || !player) return addStateLog(current, '팀과 선수를 다시 선택하세요.');
  const usageKey = teamActionUsageKey(current, teamId, player.id);
  if (current.teamActionsUsed?.[usageKey]) return addStateLog(current, `${player.name}은(는) 이번 주 팀 운영 액션을 이미 사용했습니다.`);
  const standing = getStanding(current, teamId);
  const money = Number(standing?.money ?? teamData.money ?? 0);
  if (money < Number(action.cost || 0)) {
    return addStateLog(current, `${teamData.name} ${action.label} 실패: ${Number(action.cost || 0).toLocaleString('ko-KR')} Cr 필요`);
  }
  if (Number(player.condition || 0) + Number(action.conditionDelta || 0) < 0) {
    return addStateLog(current, `${player.name}의 컨디션이 부족합니다.`);
  }

  let next = syncTeamEconomy(current, teamId, (team) => {
    const career = normalizeTeamCareer(team);
    return {
      ...team,
      money: Number(team.money || 0) - Number(action.cost || 0) + Number(action.moneyDelta || 0),
      career: {
        ...career,
        fanBase: career.fanBase + (action.id === 'FANMEETING' ? 120 + Number(player.fame || 0) : 0),
      },
      roster: team.roster.map((member) => {
        if (member.id !== player.id) return member;
        return {
          ...member,
          condition: clamp(Number(member.condition || 0) + Number(action.conditionDelta || 0), 0, 100),
          fame: Math.max(0, Number(member.fame || 0) + Number(action.fameDelta || 0)),
          stats: CAREER_STAT_KEYS.reduce((acc, key) => {
            acc[key] = clamp(Number(member.stats?.[key] || 0) + Number(action.statDelta || 0), 0, 1000);
            return acc;
          }, {}),
        };
      }),
    };
  });

  if (action.rewardItemId) next = addInventoryItem(next, teamId, action.rewardItemId, 1);
  next = {
    ...next,
    teamActionsUsed: {
      ...(current.teamActionsUsed || {}),
      [usageKey]: {
        actionId: action.id,
        teamId,
        playerId: player.id,
        week: current.week,
        seasonNo: current.seasonNo,
        at: Date.now(),
      },
    },
  };
  const amount = -Number(action.cost || 0) + Number(action.moneyDelta || 0);
  const withEcon = addEconLog(next, {
    tag: action.id === 'FANMEETING' ? 'BONUS' : 'TRAINING',
    teamId,
    amount,
    note: `${action.label}: ${player.name}`,
    meta: {
      actionId: action.id,
      playerId: player.id,
      playerName: player.name,
      conditionDelta: action.conditionDelta,
      fameDelta: action.fameDelta,
      statDelta: action.statDelta,
      rewardItemId: action.rewardItemId,
    },
  });
  return addStateLog(withEcon, `${teamData.name} ${action.label}: ${player.name} · ${teamActionEffectText(action)}`);
}

export function negotiateSponsorAction(state, teamId) {
  const current = normalizeState(state);
  if (current.ended) return addStateLog(current, '시즌 종료 후에는 스폰서 협상을 진행할 수 없습니다.');
  const teamData = getTeam(current, teamId);
  const rank = rankedIndex(current, teamId);
  const career = normalizeTeamCareer(teamData);
  const rankBonus = Math.max(0, current.teams.length - Math.max(0, rank)) * 14;
  const gain = Math.round(170 + career.sponsorTier * 85 + career.fanBase / 70 + rankBonus);
  const fanGain = Math.round(80 + career.sponsorTier * 25 + Math.max(0, teamPower(teamData, current) - 480) * 0.6);
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
  return addStateLog(addEconLog(next, {
    tag: 'SPONSOR',
    teamId,
    amount: gain,
    note: '스폰서 협상',
    meta: { fanGain, tierGain },
  }), `${teamData.name} 스폰서 협상: +${gain} Cr, 팬 +${fanGain}${tierGain ? ', 스폰서 등급 상승' : ''}`);
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
  return addStateLog(addEconLog(next, {
    tag: 'TRAINING',
    teamId,
    amount: -cost,
    note: '훈련 투자',
    meta: { statGain, trainingLevel: clamp(career.trainingLevel + 1, 1, 8) },
  }), `${teamData.name} 훈련 투자: -${cost} Cr, 훈련 Lv.${clamp(career.trainingLevel + 1, 1, 8)}`);
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
  let next = syncTeamEconomy(
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
        payrollPressure: calcTeamPayroll({ ...team, roster: [...team.roster, offer.player] }),
      },
      roster: [...team.roster, offer.player],
    }),
  );
  next = {
    ...next,
    contracts: {
      ...next.contracts,
      [offer.player.id]: createPlayerContract(offer.player, teamId, current.seasonNo, {
        salary: offer.salary,
        signingBonus: offer.signingBonus,
        yearsLeft: offer.yearsLeft,
        startedSeasonNo: current.seasonNo,
      }),
    },
  };
  return addStateLog(addEconLog(next, {
    tag: 'FA',
    teamId,
    amount: -offer.signingBonus,
    note: `${offer.player.name} FA 계약금`,
    meta: { playerId: offer.player.id, playerName: offer.player.name, salary: offer.salary, yearsLeft: offer.yearsLeft },
  }), `${teamData.name} FA 영입: ${offer.player.name} 계약금 -${offer.signingBonus} Cr, 연봉 ${offer.salary} Cr/${offer.yearsLeft}년`);
}

export function applyTradeAction(state, ourTeamId, ourPlayerId, theirTeamId, theirPlayerId, cashFromUs = 0) {
  let current = normalizeState(state);
  const preview = estimateTradeInternal(current, ourTeamId, ourPlayerId, theirTeamId, theirPlayerId, cashFromUs);
  if (!preview.ok) return addStateLog(current, preview.note);
  if (!preview.canTrade) {
    return addStateLog(current, `${preview.ourTeamName} 트레이드 실패: 현금 또는 로스터 조건을 확인하세요.`);
  }

  const rng = createRng(`${current.runId}|trade|${current.seasonNo}|${current.week}|${preview.ourPlayerId}|${preview.theirPlayerId}|${preview.cashFromUs}`);
  if (rng() >= preview.acceptChance) {
    return addStateLog(current, `${preview.theirTeamName}이(가) 트레이드를 거절했습니다. ${preview.note} 수락률 ${Math.round(preview.acceptChance * 100)}%`);
  }

  const ourTeam = getTeam(current, preview.ourTeamId);
  const theirTeam = getTeam(current, preview.theirTeamId);
  const ourPlayer = findPlayerOnTeam(ourTeam, preview.ourPlayerId);
  const theirPlayer = findPlayerOnTeam(theirTeam, preview.theirPlayerId);
  const cash = preview.cashFromUs;

  current = {
    ...current,
    teams: current.teams.map((teamData) => {
      if (teamData.id === preview.ourTeamId) {
        return cloneTeam({
          ...teamData,
          roster: teamData.roster
            .filter((member) => member.id !== ourPlayer.id)
            .concat({ ...theirPlayer }),
        });
      }
      if (teamData.id === preview.theirTeamId) {
        return cloneTeam({
          ...teamData,
          roster: teamData.roster
            .filter((member) => member.id !== theirPlayer.id)
            .concat({ ...ourPlayer }),
        });
      }
      return teamData;
    }),
    standings: current.standings.map((row) => {
      if (row.teamId === preview.ourTeamId) return { ...row, money: Number(row.money || 0) - cash };
      if (row.teamId === preview.theirTeamId) return { ...row, money: Number(row.money || 0) + cash };
      return row;
    }),
    inventories: createInventories(current.teams, current.inventories).map((inventory) => {
      if (inventory.teamId === preview.ourTeamId) {
        const equipped = { ...(inventory.equipped || {}) };
        delete equipped[ourPlayer.id];
        return { ...inventory, equipped };
      }
      if (inventory.teamId === preview.theirTeamId) {
        const equipped = { ...(inventory.equipped || {}) };
        delete equipped[theirPlayer.id];
        return { ...inventory, equipped };
      }
      return inventory;
    }),
    contracts: {
      ...current.contracts,
      [ourPlayer.id]: {
        ...(current.contracts?.[ourPlayer.id] || createPlayerContract(ourPlayer, preview.theirTeamId, current.seasonNo)),
        teamId: preview.theirTeamId,
      },
      [theirPlayer.id]: {
        ...(current.contracts?.[theirPlayer.id] || createPlayerContract(theirPlayer, preview.ourTeamId, current.seasonNo)),
        teamId: preview.ourTeamId,
      },
    },
    updatedAt: new Date().toISOString(),
  };

  if (cash > 0) {
    current = addEconLog(current, {
      tag: 'TRADE',
      teamId: preview.ourTeamId,
      amount: -cash,
      note: `${preview.theirPlayerName} 트레이드 현금 보상`,
      meta: { trade: true, theirTeamId: preview.theirTeamId, ourPlayerId: preview.ourPlayerId, theirPlayerId: preview.theirPlayerId },
    });
    current = addEconLog(current, {
      tag: 'TRADE',
      teamId: preview.theirTeamId,
      amount: cash,
      note: `${preview.ourPlayerName} 트레이드 현금 수령`,
      meta: { trade: true, ourTeamId: preview.ourTeamId, ourPlayerId: preview.ourPlayerId, theirPlayerId: preview.theirPlayerId },
    });
  }

  return addStateLog(current, `트레이드 성사: ${preview.ourTeamName} ${preview.ourPlayerName} + ${cash}Cr ↔ ${preview.theirTeamName} ${preview.theirPlayerName}`);
}

export function startNextSeasonAction(state) {
  const current = normalizeState(state);
  const next = createNewState();
  const nextSeasonNo = Number(current.seasonNo || 1) + 1;
  const payrollByTeam = new Map();
  const carriedTeams = current.teams.map((teamData) => {
    const career = normalizeTeamCareer(teamData);
    const standing = getStanding(current, teamData.id);
    const payroll = teamPayrollFromContracts(current.contracts, teamData);
    payrollByTeam.set(teamData.id, payroll);
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
  let rolledContracts = ensureContractsForTeams(carriedTeams, current.contracts, nextSeasonNo);
  rolledContracts = Object.fromEntries(Object.entries(rolledContracts).map(([playerId, contract]) => [
    playerId,
    {
      ...contract,
      yearsLeft: Math.max(1, Number(contract.yearsLeft || 2) - 1),
      salary: Math.max(10, Number(contract.salary || 0) + (Number(contract.yearsLeft || 2) <= 1 ? 4 : 0)),
    },
  ]));
  let nextState = {
    ...next,
    runId: current.runId,
    startedAt: current.startedAt,
    seasonNo: nextSeasonNo,
    teams: carriedTeams,
    fixtures,
    standings: createStandings(carriedTeams),
    contracts: rolledContracts,
    inventories: createInventories(carriedTeams, current.inventories),
    econLogs: normalizeEconLogs(current.econLogs),
    seasonReports: Array.isArray(current.seasonReports) ? current.seasonReports.slice(0, 60) : [],
    postseasonFixtures: [],
    postseasonPrizesAwarded: false,
    personalLeague: createEmptyPersonalLeague(nextSeasonNo),
    personalHistory: normalizePersonalHistory(current.personalHistory),
    winnersLeague: createEmptyWinnersLeague(nextSeasonNo),
    winnersHistory: normalizeWinnersHistory(current.winnersHistory),
    freeAgentSeq: Number(current.freeAgentSeq || 0),
    log: [`시즌 ${Number(current.seasonNo || 1) + 1}이 새로 시작됐습니다.`, ...current.log].slice(0, 90),
  };
  nextState = {
    ...nextState,
    shop: ensureShop(nextState),
  };
  payrollByTeam.forEach((payroll, teamId) => {
    if (payroll <= 0) return;
    nextState = addEconLog(nextState, {
      tag: 'PAYROLL',
      teamId,
      amount: -payroll,
      seasonNo: nextSeasonNo,
      week: 0,
      note: `시즌 ${nextSeasonNo} 연봉 지급`,
      meta: { payroll, rosterCount: getTeam(current, teamId).roster.length },
    });
  });
  return nextState;
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

export function getTopPlayers(state, limit = 12) {
  const current = normalizeState(state);
  const records = new Map();

  current.teams.forEach((teamData) => {
    teamData.roster.forEach((member) => {
      records.set(member.id, {
        playerId: member.id,
        playerName: member.name,
        teamId: teamData.id,
        teamName: teamData.name,
        race: member.race,
        level: Number(member.level || 0),
        condition: Number(member.condition || 0),
        fame: Number(member.fame || 0),
        skill: Math.round(averageStats(teamWithEquipment(current, teamData).roster.find((row) => row.id === member.id) || member)),
        matchWins: 0,
        matchLosses: 0,
        setWins: 0,
        setLosses: 0,
        personalWins: 0,
        personalLosses: 0,
        winnersWins: 0,
        winnersLosses: 0,
      });
    });
  });

  [...current.fixtures, ...normalizePostseasonFixtures(current.postseasonFixtures)].forEach((fixture) => {
    const result = fixture.result;
    if (!fixture.played || !result) return;
    const homePlayers = new Set();
    const awayPlayers = new Set();
    result.sets.forEach((setResult) => {
      if (setResult.homePlayerId) homePlayers.add(setResult.homePlayerId);
      if (setResult.awayPlayerId) awayPlayers.add(setResult.awayPlayerId);

      const homeRecord = records.get(setResult.homePlayerId);
      const awayRecord = records.get(setResult.awayPlayerId);
      if (homeRecord) {
        if (setResult.winnerPlayerId === setResult.homePlayerId) homeRecord.setWins += 1;
        else homeRecord.setLosses += 1;
      }
      if (awayRecord) {
        if (setResult.winnerPlayerId === setResult.awayPlayerId) awayRecord.setWins += 1;
        else awayRecord.setLosses += 1;
      }
    });

    homePlayers.forEach((playerId) => {
      const record = records.get(playerId);
      if (!record) return;
      if (result.winnerTeamId === result.homeTeamId) record.matchWins += 1;
      else record.matchLosses += 1;
    });
    awayPlayers.forEach((playerId) => {
      const record = records.get(playerId);
      if (!record) return;
      if (result.winnerTeamId === result.awayTeamId) record.matchWins += 1;
      else record.matchLosses += 1;
    });
  });

  normalizePersonalLeague(current.personalLeague, current.seasonNo).matches.forEach((match) => {
    if (!match.played || !match.winnerId) return;
    const loserId = match.playerAId === match.winnerId ? match.playerBId : match.playerAId;
    const winnerRecord = records.get(match.winnerId);
    const loserRecord = records.get(loserId);
    if (winnerRecord) winnerRecord.personalWins += 1;
    if (loserRecord) loserRecord.personalLosses += 1;
  });

  normalizeWinnersLeague(current.winnersLeague, current.seasonNo).sets.forEach((setResult) => {
    if (!setResult.winnerPlayerId) return;
    const loserId = setResult.homePlayerId === setResult.winnerPlayerId ? setResult.awayPlayerId : setResult.homePlayerId;
    const winnerRecord = records.get(setResult.winnerPlayerId);
    const loserRecord = records.get(loserId);
    if (winnerRecord) winnerRecord.winnersWins += 1;
    if (loserRecord) loserRecord.winnersLosses += 1;
  });

  return [...records.values()]
    .map((record) => {
      const matchDiff = record.matchWins - record.matchLosses;
      const setDiff = record.setWins - record.setLosses;
      const winRate = record.matchWins + record.matchLosses
        ? Math.round((record.matchWins / (record.matchWins + record.matchLosses)) * 100)
        : 0;
      const score = Math.round(
        record.skill
        + record.matchWins * 120
        + record.setWins * 20
        + record.personalWins * 65
        + record.winnersWins * 58
        + record.level * 40
        + record.fame * 2
        + setDiff * 12
        + matchDiff * 35,
      );
      return {
        ...record,
        matchDiff,
        setDiff,
        winRate,
        score,
      };
    })
    .sort((a, b) => (
      b.score - a.score
      || b.matchWins - a.matchWins
      || b.setDiff - a.setDiff
      || a.playerName.localeCompare(b.playerName, 'ko-KR')
    ))
    .slice(0, limit);
}

function rivalryPairKey(playerAId, playerBId) {
  const ids = [String(playerAId || ''), String(playerBId || '')].filter(Boolean).sort();
  return ids.length === 2 && ids[0] !== ids[1] ? `${ids[0]}::${ids[1]}` : '';
}

function rivalryPlayerMeta(state, playerId, fallbackName = '') {
  const context = findPlayerContext(state, playerId);
  return {
    playerId: String(playerId || ''),
    playerName: context?.player?.name || fallbackName || String(playerId || ''),
    teamId: context?.team?.id || '',
    teamName: context?.team?.name || '',
    race: context?.player?.race || '',
    skill: context?.player ? Math.round(averageStats(context.player)) : 0,
  };
}

function ensureRivalryLedgerRow(ledger, state, entry) {
  const key = rivalryPairKey(entry.homePlayerId, entry.awayPlayerId);
  if (!key) return null;
  const [playerAId, playerBId] = key.split('::');
  if (!ledger.has(key)) {
    const metaA = rivalryPlayerMeta(
      state,
      playerAId,
      String(entry.homePlayerId) === playerAId ? entry.homePlayerName : entry.awayPlayerName,
    );
    const metaB = rivalryPlayerMeta(
      state,
      playerBId,
      String(entry.homePlayerId) === playerBId ? entry.homePlayerName : entry.awayPlayerName,
    );
    ledger.set(key, {
      key,
      playerAId,
      playerBId,
      playerAName: metaA.playerName,
      playerBName: metaB.playerName,
      playerATeamName: metaA.teamName,
      playerBTeamName: metaB.teamName,
      playerARace: metaA.race,
      playerBRace: metaB.race,
      playerASkill: metaA.skill,
      playerBSkill: metaB.skill,
      sets: 0,
      aWins: 0,
      bWins: 0,
      aceSets: 0,
      closeSets: 0,
      totalDurationSec: 0,
      sources: {},
      maps: {},
      latest: null,
    });
  }
  return ledger.get(key);
}

function addRivalrySet(ledger, state, entry) {
  const homePlayerId = String(entry?.homePlayerId || '');
  const awayPlayerId = String(entry?.awayPlayerId || '');
  const winnerPlayerId = String(entry?.winnerPlayerId || entry?.winnerId || '');
  if (!homePlayerId || !awayPlayerId || homePlayerId === awayPlayerId || !winnerPlayerId) return;

  const row = ensureRivalryLedgerRow(ledger, state, {
    ...entry,
    homePlayerId,
    awayPlayerId,
  });
  if (!row) return;

  row.sets += 1;
  if (winnerPlayerId === row.playerAId) row.aWins += 1;
  if (winnerPlayerId === row.playerBId) row.bWins += 1;
  if (entry?.isAceSet) row.aceSets += 1;

  const probabilityHome = Number(entry?.probabilityHome || 0);
  const winnerProb = probabilityHome
    ? (winnerPlayerId === homePlayerId ? probabilityHome : 100 - probabilityHome)
    : 0;
  if (winnerProb && winnerProb <= 56) row.closeSets += 1;

  const durationSec = Math.max(0, Number(entry?.durationSec || 0));
  row.totalDurationSec += durationSec;

  const source = String(entry?.source || '리그');
  row.sources[source] = Number(row.sources[source] || 0) + 1;
  const mapName = String(entry?.mapName || entry?.mapId || '').trim();
  if (mapName) row.maps[mapName] = Number(row.maps[mapName] || 0) + 1;

  const playedAt = Number(entry?.playedAt || 0);
  if (!row.latest || playedAt >= Number(row.latest.playedAt || 0)) {
    row.latest = {
      playedAt,
      source,
      stageLabel: String(entry?.stageLabel || source),
      mapName,
      setNo: Number(entry?.setNo || 0),
      winnerPlayerId,
      winnerName: winnerPlayerId === homePlayerId
        ? String(entry?.homePlayerName || row.playerAName)
        : String(entry?.awayPlayerName || row.playerBName),
    };
  }
}

function addFixtureRivalrySets(ledger, state, fixture, stageLabel) {
  const result = fixture?.result;
  if (!fixture?.played || !result || !Array.isArray(result.sets)) return;
  result.sets.forEach((setResult) => {
    addRivalrySet(ledger, state, {
      source: stageLabel || '정규리그',
      stageLabel: stageLabel || `${result.round || fixture.round || '-'}주차`,
      playedAt: Number(result.playedAt || 0),
      ...setResult,
    });
  });
}

function addPersonalRivalrySets(ledger, state, match) {
  if (!match?.played) return;
  if (Array.isArray(match.setDetails) && match.setDetails.length) {
    match.setDetails.forEach((setResult) => {
      addRivalrySet(ledger, state, {
        source: '개인리그',
        stageLabel: `개인리그 ${personalRoundLabel(match.round)}`,
        playedAt: Number(match.playedAt || 0),
        homePlayerId: setResult.homePlayerId,
        homePlayerName: setResult.homePlayerName,
        awayPlayerId: setResult.awayPlayerId,
        awayPlayerName: setResult.awayPlayerName,
        winnerPlayerId: setResult.winnerId,
        setNo: setResult.setNo,
        mapId: setResult.mapId,
        mapName: setResult.mapName,
        durationSec: setResult.durationSec,
      });
    });
    return;
  }

  (Array.isArray(match.setWinners) ? match.setWinners : []).forEach((winnerId, index) => {
    addRivalrySet(ledger, state, {
      source: '개인리그',
      stageLabel: `개인리그 ${personalRoundLabel(match.round)}`,
      playedAt: Number(match.playedAt || 0),
      homePlayerId: match.playerAId,
      awayPlayerId: match.playerBId,
      winnerPlayerId: winnerId,
      setNo: index + 1,
      mapName: Array.isArray(match.mapNames) ? match.mapNames[index] : '',
    });
  });
}

function sourceSummaryLabel(sources) {
  return Object.entries(sources || {})
    .sort((a, b) => Number(b[1] || 0) - Number(a[1] || 0) || a[0].localeCompare(b[0], 'ko-KR'))
    .slice(0, 3)
    .map(([label, count]) => `${label} ${count}`)
    .join(' · ');
}

function mapSummaryLabel(maps) {
  return Object.entries(maps || {})
    .sort((a, b) => Number(b[1] || 0) - Number(a[1] || 0) || a[0].localeCompare(b[0], 'ko-KR'))
    .slice(0, 2)
    .map(([label, count]) => `${label} ${count}회`)
    .join(' · ');
}

function rivalryRowLabel(row) {
  const leaderName = row.aWins >= row.bWins ? row.playerAName : row.playerBName;
  const leaderWins = Math.max(row.aWins, row.bWins);
  const trailerWins = Math.min(row.aWins, row.bWins);
  if (row.aWins === row.bWins) return `동률 ${row.aWins}:${row.bWins}`;
  return `${leaderName} ${leaderWins}:${trailerWins} 우세`;
}

export function getRivalryReport(state, limit = 8) {
  const current = normalizeState(state);
  const ledger = new Map();

  current.fixtures.forEach((fixture) => {
    addFixtureRivalrySets(ledger, current, fixture, `${fixture.round || '-'}주차`);
  });
  normalizePostseasonFixtures(current.postseasonFixtures).forEach((fixture) => {
    addFixtureRivalrySets(ledger, current, fixture, fixture.label || POSTSEASON_LABELS[fixture.round] || '포스트시즌');
  });
  normalizePersonalLeague(current.personalLeague, current.seasonNo).matches.forEach((match) => {
    addPersonalRivalrySets(ledger, current, match);
  });
  normalizeWinnersLeague(current.winnersLeague, current.seasonNo).sets.forEach((setResult) => {
    addRivalrySet(ledger, current, {
      source: '위너스리그',
      stageLabel: '위너스리그',
      playedAt: Number(setResult.playedAt || 0),
      ...setResult,
    });
  });

  const rows = [...ledger.values()]
    .map((row) => {
      const winGap = Math.abs(row.aWins - row.bWins);
      const balanceScore = Math.max(0, 6 - winGap);
      const sourceLabel = sourceSummaryLabel(row.sources);
      const mapLabel = mapSummaryLabel(row.maps);
      const avgDurationMin = row.sets ? Math.round((row.totalDurationSec / row.sets) / 60) : 0;
      const rivalryScore = row.sets * 12 + balanceScore * 8 + row.closeSets * 6 + row.aceSets * 8;
      return {
        ...row,
        winGap,
        winRateA: row.sets ? Math.round((row.aWins / row.sets) * 100) : 0,
        winRateB: row.sets ? Math.round((row.bWins / row.sets) * 100) : 0,
        recordLabel: rivalryRowLabel(row),
        sourceLabel,
        mapLabel,
        avgDurationMin,
        rivalryScore,
        headline: `${row.playerAName} vs ${row.playerBName} · ${row.sets}세트 · ${rivalryRowLabel(row)}`,
        detail: [
          sourceLabel ? `무대 ${sourceLabel}` : '',
          mapLabel ? `주요 맵 ${mapLabel}` : '',
          row.closeSets ? `예측 접전 ${row.closeSets}세트` : '',
          row.aceSets ? `에이스전 ${row.aceSets}회` : '',
        ].filter(Boolean).join(' · '),
      };
    })
    .sort((a, b) => (
      b.rivalryScore - a.rivalryScore
      || b.sets - a.sets
      || a.winGap - b.winGap
      || a.playerAName.localeCompare(b.playerAName, 'ko-KR')
    ))
    .slice(0, limit);

  const top = rows[0];
  return {
    totalPairs: ledger.size,
    totalSets: [...ledger.values()].reduce((sum, row) => sum + Number(row.sets || 0), 0),
    sampleLabel: ledger.size ? `${ledger.size}쌍 · ${[...ledger.values()].reduce((sum, row) => sum + Number(row.sets || 0), 0)}세트` : '표본 없음',
    headline: top
      ? `${top.playerAName}와 ${top.playerBName}의 맞대결이 현재 최대 라이벌리입니다. ${top.recordLabel}, 누적 ${top.sets}세트입니다.`
      : '경기를 진행하면 선수별 맞대결과 라이벌리 흐름이 누적됩니다.',
    rows,
  };
}

export function getCurrentFixtures(state) {
  const current = normalizeState(state);
  if (isRegularSeasonComplete(current)) {
    const postseasonRows = normalizePostseasonFixtures(current.postseasonFixtures).filter((fixture) => !fixture.played);
    if (postseasonRows.length) return postseasonRows.slice(0, 1);
  }
  return current.fixtures.filter((fixture) => fixture.round === current.week);
}

export function fixtureLabel(state, fixture) {
  const result = fixture.result;
  const homeName = fixture.homeTeamId === '__TBD__' ? '대기' : teamName(state, fixture.homeTeamId);
  const awayName = fixture.awayTeamId === '__TBD__' ? '대기' : teamName(state, fixture.awayTeamId);
  if (!result) return `${fixture.label ? `${fixture.label} · ` : ''}${homeName} vs ${awayName}`;
  return `${result.homeTeamName} ${result.scoreHome}:${result.scoreAway} ${result.awayTeamName}`;
}

export function getPlayedCount(state) {
  const current = normalizeState(state);
  return current.fixtures.filter((fixture) => fixture.played).length
    + normalizePostseasonFixtures(current.postseasonFixtures).filter((fixture) => fixture.played).length;
}

export function getTotalFixtureCount(state) {
  const current = normalizeState(state);
  return current.fixtures.length + normalizePostseasonFixtures(current.postseasonFixtures).length;
}

export function getPostseasonRows(state) {
  const current = normalizeState(state);
  return normalizePostseasonFixtures(current.postseasonFixtures).map((fixture) => ({
    id: fixture.id,
    round: fixture.round,
    label: fixture.label || POSTSEASON_LABELS[fixture.round] || `포스트시즌 ${fixture.round}`,
    homeTeamId: fixture.homeTeamId,
    awayTeamId: fixture.awayTeamId,
    homeTeamName: fixture.homeTeamId === '__TBD__' ? '대기' : teamName(current, fixture.homeTeamId),
    awayTeamName: fixture.awayTeamId === '__TBD__' ? '대기' : teamName(current, fixture.awayTeamId),
    played: fixture.played,
    scoreHome: fixture.result?.scoreHome ?? null,
    scoreAway: fixture.result?.scoreAway ?? null,
    winnerTeamId: fixture.result?.winnerTeamId || '',
    winnerTeamName: fixture.result?.winnerTeamId ? teamName(current, fixture.result.winnerTeamId) : '',
  }));
}

export function getMatchArchiveRows(state, limit = 18) {
  const current = normalizeState(state);
  const regularRows = current.fixtures.map((fixture) => ({
    stage: 'REGULAR',
    stageLabel: `${fixture.round}주차`,
    fixtureId: fixture.id,
    fixture,
  }));
  const postseasonRows = normalizePostseasonFixtures(current.postseasonFixtures).map((fixture) => ({
    stage: 'POSTSEASON',
    stageLabel: fixture.label || POSTSEASON_LABELS[fixture.round] || `포스트시즌 ${fixture.round}`,
    fixtureId: fixture.id,
    fixture,
  }));
  return [...regularRows, ...postseasonRows]
    .filter((row) => row.fixture.played && row.fixture.result)
    .map((row) => {
      const result = row.fixture.result;
      const winnerName = result.winnerTeamId === result.homeTeamId ? result.homeTeamName : result.awayTeamName;
      const aceSet = Array.isArray(result.sets) ? result.sets.find((setResult) => setResult.isAceSet) : null;
      return {
        id: `${row.stage}-${row.fixtureId}`,
        stage: row.stage,
        stageLabel: row.stageLabel,
        fixtureId: row.fixtureId,
        matchId: result.matchId || row.fixtureId,
        round: result.round || row.fixture.round,
        homeTeamId: result.homeTeamId || row.fixture.homeTeamId || '',
        awayTeamId: result.awayTeamId || row.fixture.awayTeamId || '',
        homeTeamName: result.homeTeamName,
        awayTeamName: result.awayTeamName,
        scoreHome: Number(result.scoreHome || 0),
        scoreAway: Number(result.scoreAway || 0),
        winnerTeamId: result.winnerTeamId || '',
        winnerTeamName: winnerName,
        playedAt: Number(result.playedAt || 0),
        setCount: Array.isArray(result.sets) ? result.sets.length : 0,
        aceSetLabel: aceSet ? `${aceSet.homePlayerName} vs ${aceSet.awayPlayerName}` : '',
        sets: Array.isArray(result.sets) ? result.sets : [],
      };
    })
    .sort((a, b) => b.playedAt - a.playedAt || b.round - a.round)
    .slice(0, limit);
}

function setWinnerSide(match, setResult) {
  if (!setResult?.winnerTeamId) return '';
  if (setResult.winnerTeamId === match.homeTeamId) return 'home';
  if (setResult.winnerTeamId === match.awayTeamId) return 'away';
  return '';
}

function setWinnerName(match, setResult) {
  const side = setWinnerSide(match, setResult);
  if (side === 'home') return setResult.homePlayerName || match.homeTeamName;
  if (side === 'away') return setResult.awayPlayerName || match.awayTeamName;
  return setResult.winnerPlayerName || '승자';
}

function setWinProbabilityForWinner(match, setResult) {
  const side = setWinnerSide(match, setResult);
  const pHome = Number(setResult?.probabilityHome || 50);
  if (side === 'home') return pHome;
  if (side === 'away') return 100 - pHome;
  return 50;
}

function setLoserName(match, setResult) {
  const side = setWinnerSide(match, setResult);
  if (side === 'home') return setResult.awayPlayerName || match.awayTeamName;
  if (side === 'away') return setResult.homePlayerName || match.homeTeamName;
  return '상대';
}

function styleCountRows(sets) {
  const counts = {};
  sets.forEach((setResult) => {
    [setResult.homeBuildStyle, setResult.awayBuildStyle].forEach((style) => {
      const key = normalizeBuildStyle(style);
      if (!key) return;
      counts[key] = Number(counts[key] || 0) + 1;
    });
  });
  return Object.entries(counts)
    .map(([style, count]) => ({
      style,
      label: BUILD_STYLE_LABELS[style] || style,
      count,
    }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'ko-KR'));
}

export function getSeriesReplayReport(match) {
  if (!match || !Array.isArray(match.sets) || !match.sets.length) {
    return {
      headline: '경기 기록을 선택하면 시리즈 총평이 표시됩니다.',
      keySetLabel: '-',
      styleLabel: '-',
      mapLabel: '-',
      tempoLabel: '-',
      highlights: [],
    };
  }
  const sets = match.sets;
  const winner = match.winnerTeamName || (match.scoreHome >= match.scoreAway ? match.homeTeamName : match.awayTeamName);
  const loser = winner === match.homeTeamName ? match.awayTeamName : match.homeTeamName;
  const aceSet = sets.find((setResult) => setResult.isAceSet);
  const closeSet = [...sets].sort((a, b) => Math.abs(Number(a.noisyDiff || 0)) - Math.abs(Number(b.noisyDiff || 0)))[0];
  const upsetSet = [...sets]
    .map((setResult) => ({ setResult, upsetGap: Math.max(0, 50 - setWinProbabilityForWinner(match, setResult)) }))
    .sort((a, b) => b.upsetGap - a.upsetGap)[0];
  const longestSet = [...sets].sort((a, b) => Number(b.durationSec || 0) - Number(a.durationSec || 0))[0];
  const styleRows = styleCountRows(sets);
  const mapCount = new Set(sets.map((setResult) => setResult.mapName || setResult.mapId).filter(Boolean)).size;
  const avgDuration = Math.round(sets.reduce((sum, setResult) => sum + Number(setResult.durationSec || 0), 0) / sets.length);
  const tempoLabel = avgDuration >= 1180 ? '장기전 중심' : avgDuration <= 780 ? '초반 교전 중심' : '중반 운영 중심';
  const leadText = match.scoreHome === match.scoreAway
    ? '마지막 세트까지 균형이 무너지지 않았습니다.'
    : Math.abs(Number(match.scoreHome || 0) - Number(match.scoreAway || 0)) >= 2
      ? `${winner}이 세트 흐름을 강하게 틀어쥐었습니다.`
      : `${winner}이 접전 흐름에서 한 세트를 더 가져갔습니다.`;
  const headline = `${winner} ${match.scoreHome}:${match.scoreAway} ${loser}. ${leadText}`;
  const highlights = [
    aceSet ? `에이스전: ${aceSet.homePlayerName} vs ${aceSet.awayPlayerName}, ${setWinnerName(match, aceSet)}이 압박을 버텼습니다.` : '',
    closeSet ? `${closeSet.setNo}세트는 체감상 가장 팽팽했습니다. ${setWinnerName(match, closeSet)}이 ${setLoserName(match, closeSet)}을(를) 상대로 마지막 교전을 남겼습니다.` : '',
    upsetSet?.upsetGap >= 5 ? `${upsetSet.setResult.setNo}세트는 예측을 비튼 승부였습니다. ${setWinnerName(match, upsetSet.setResult)}의 사전 승률은 ${setWinProbabilityForWinner(match, upsetSet.setResult)}%였습니다.` : '',
    longestSet ? `가장 긴 세트는 ${longestSet.setNo}세트 ${longestSet.mapName}, ${Math.round(Number(longestSet.durationSec || 0) / 60)}분대 운영전이었습니다.` : '',
    styleRows[0] ? `시리즈 대표 빌드 성향은 ${styleRows[0].label}입니다. 양 팀 합산 ${styleRows[0].count}회 선택됐습니다.` : '',
  ].filter(Boolean).slice(0, 5);
  return {
    headline,
    keySetLabel: aceSet
      ? `에이스전 · ${setWinnerName(match, aceSet)}`
      : closeSet
        ? `${closeSet.setNo}세트 · 접전`
        : '-',
    styleLabel: styleRows[0] ? `${styleRows[0].label} ${styleRows[0].count}회` : '-',
    mapLabel: `${mapCount}개 맵`,
    tempoLabel,
    highlights,
  };
}

export function getBuildMetaReport(state) {
  const current = normalizeState(state);
  const meta = collectBuildMeta(current);
  const styleRows = BUILD_STYLE_KEYS
    .map((style) => {
      const row = meta.global[style] || { count: 0, wins: 0 };
      const count = Number(row.count || 0);
      const wins = Number(row.wins || 0);
      return {
        style,
        label: BUILD_STYLE_LABELS[style] || style,
        count,
        wins,
        losses: Math.max(0, count - wins),
        winRate: count ? Math.round((wins / count) * 100) : 0,
        usagePct: meta.totalSides ? Math.round((count / meta.totalSides) * 100) : 0,
      };
    })
    .sort((a, b) => b.count - a.count || b.winRate - a.winRate || a.label.localeCompare(b.label, 'ko-KR'));

  const playerRows = Object.entries(meta.players)
    .map(([playerId, bucket]) => {
      const context = findPlayerContext(current, playerId);
      const bestStyle = bestStyleFromLedger(bucket.styles, 2)
        || BUILD_STYLE_KEYS
          .map((style) => ({ style, ...bucket.styles[style] }))
          .filter((row) => Number(row.count || 0) > 0)
          .sort((a, b) => Number(b.count || 0) - Number(a.count || 0))[0];
      if (!bestStyle) return null;
      const count = Number(bestStyle.count || 0);
      const wins = Number(bestStyle.wins || 0);
      return {
        playerId,
        playerName: context?.player?.name || playerId,
        teamName: context?.team?.name || '',
        style: bestStyle.style,
        styleLabel: BUILD_STYLE_LABELS[bestStyle.style] || bestStyle.style,
        count,
        wins,
        winRate: count ? Math.round((wins / count) * 100) : 0,
        total: Number(bucket.total || 0),
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.winRate - a.winRate || b.count - a.count || b.total - a.total)
    .slice(0, 5);

  const mapRows = Object.entries(meta.maps)
    .map(([mapKey, bucket]) => {
      const map = MAPS.find((item) => item.id === mapKey || item.name === mapKey);
      const bestStyle = bestStyleFromLedger(bucket.styles, 3)
        || BUILD_STYLE_KEYS
          .map((style) => ({ style, ...bucket.styles[style] }))
          .filter((row) => Number(row.count || 0) > 0)
          .sort((a, b) => Number(b.count || 0) - Number(a.count || 0))[0];
      if (!bestStyle) return null;
      const count = Number(bestStyle.count || 0);
      const wins = Number(bestStyle.wins || 0);
      return {
        mapKey,
        mapName: map?.name || mapKey,
        style: bestStyle.style,
        styleLabel: BUILD_STYLE_LABELS[bestStyle.style] || bestStyle.style,
        count,
        wins,
        winRate: count ? Math.round((wins / count) * 100) : 0,
        total: Number(bucket.total || 0),
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.total - a.total || b.winRate - a.winRate || a.mapName.localeCompare(b.mapName, 'ko-KR'))
    .slice(0, 5);

  const topStyle = styleRows.find((row) => row.count > 0);
  const hotPlayer = playerRows[0];
  const mapTrend = mapRows[0];
  const insight = meta.totalSets
    ? [
      topStyle ? `최다 선택은 ${topStyle.label} ${topStyle.count}회(${topStyle.usagePct}%)입니다.` : '',
      hotPlayer ? `${hotPlayer.playerName}의 ${hotPlayer.styleLabel} 승률이 ${hotPlayer.winRate}%로 가장 뜨겁습니다.` : '',
      mapTrend ? `${mapTrend.mapName}에서는 ${mapTrend.styleLabel} 카드가 ${mapTrend.count}회 포착됐습니다.` : '',
    ].filter(Boolean).join(' ')
    : '아직 진행된 세트가 없습니다. 경기를 진행하면 빌드 스타일, 선수 성향, 맵별 메타가 누적됩니다.';

  return {
    totalSets: meta.totalSets,
    totalSides: meta.totalSides,
    sampleLabel: meta.totalSets ? `${meta.totalSets}세트 · 빌드 선택 ${meta.totalSides}회` : '표본 없음',
    insight,
    styleRows,
    playerRows,
    mapRows,
  };
}

export function getSeasonFinaleReport(state) {
  const current = normalizeState(state);
  const stageSummary = getSeasonStageSummary(current);
  const standings = getTopTeams(current, 5);
  const players = getTopPlayers(current, 5);
  const buildMeta = getBuildMetaReport(current);
  const personal = getPersonalLeagueSummary(current);
  const winners = getWinnersLeagueSummary(current);
  const archiveRows = getMatchArchiveRows(current, 5);
  const leader = standings[0];
  const topPlayer = players[0];
  const latestMatch = archiveRows[0];
  const seasonLogs = normalizeEconLogs(current.econLogs).filter((entry) => entry.seasonNo === Number(current.seasonNo || 1));
  const income = Math.round(seasonLogs.filter((entry) => entry.amount > 0).reduce((sum, entry) => sum + entry.amount, 0));
  const expense = Math.round(seasonLogs.filter((entry) => entry.amount < 0).reduce((sum, entry) => sum + Math.abs(entry.amount), 0));
  const net = income - expense;
  const champion = stageSummary.postseasonChampionTeamName || (current.championTeamId ? teamName(current, current.championTeamId) : '');
  const favoriteStyle = buildMeta.styleRows.find((row) => row.count > 0);
  const hotPlayer = buildMeta.playerRows[0];
  const mapTrend = buildMeta.mapRows[0];
  const played = getPlayedCount(current);
  const total = getTotalFixtureCount(current);
  const progressPct = total ? Math.round((played / total) * 100) : 0;
  const headline = current.ended
    ? `${champion || leader?.teamName || '우승팀'}이 시즌 ${current.seasonNo} 우승을 확정했습니다.`
    : stageSummary.stage === 'POSTSEASON'
      ? `포스트시즌이 ${stageSummary.postseasonPlayed}/${stageSummary.postseasonTotal}까지 진행됐습니다.`
      : `${current.week}주차 정규리그 진행 중입니다. 선두는 ${leader?.teamName || '미정'}입니다.`;
  const highlights = [
    leader ? `정규 선두 ${leader.teamName}: ${leader.wins}승 ${leader.losses}패, 득실 ${leader.diff >= 0 ? '+' : ''}${leader.diff}` : '',
    topPlayer ? `선수 랭킹 1위 ${topPlayer.playerName}: 승률 ${topPlayer.winRate}%, 명성 ${topPlayer.fame.toLocaleString('ko-KR')}` : '',
    favoriteStyle ? `시즌 대표 빌드 성향은 ${favoriteStyle.label}: ${favoriteStyle.count}회 선택, 승률 ${favoriteStyle.winRate}%` : '',
    personal.championName ? `개인리그 챔피언 ${personal.championName}${personal.championTeamName ? `(${personal.championTeamName})` : ''}` : '',
    winners.championTeamName ? `위너스리그 챔피언 ${winners.championTeamName}` : '',
    latestMatch ? `최근 경기 ${latestMatch.homeTeamName} ${latestMatch.scoreHome}:${latestMatch.scoreAway} ${latestMatch.awayTeamName}` : '',
  ].filter(Boolean);
  const recommendations = current.ended
    ? ['전적 기록으로 시즌 스냅샷을 남기고 다음 시즌으로 넘어가세요.', '시즌 리포트에서 메타/경제 흐름을 확인해 장기 밸런스를 조정하세요.']
    : [
      stageSummary.stage === 'POSTSEASON_READY' ? '정규리그가 끝났습니다. 다음 경기 진행으로 포스트시즌을 시작하세요.' : '',
      stageSummary.stage === 'POSTSEASON' ? '포스트시즌 진행 중입니다. 최근 경기 아카이브로 에이스전과 빌드 선택을 확인하세요.' : '',
      stageSummary.stage === 'REGULAR' ? '이번 주 전체 진행으로 표본을 늘리면 빌드 메타와 중계 흐름이 더 선명해집니다.' : '',
      net < 0 ? '시즌 수지가 적자입니다. 스폰서 협상과 훈련 투자 타이밍을 재조정하세요.' : '',
    ].filter(Boolean);

  return {
    seasonNo: Number(current.seasonNo || 1),
    headline,
    stage: stageSummary.stage,
    stageLabel: stageSummary.label,
    played,
    total,
    progressPct,
    championTeamName: champion,
    leaderTeamName: leader?.teamName || '',
    topPlayerName: topPlayer?.playerName || '',
    topPlayerWinRate: Number(topPlayer?.winRate || 0),
    income,
    expense,
    net,
    score: scoreState(current),
    meta: {
      sampleLabel: buildMeta.sampleLabel,
      favoriteStyleLabel: favoriteStyle?.label || '',
      favoriteStyleCount: Number(favoriteStyle?.count || 0),
      favoriteStyleWinRate: Number(favoriteStyle?.winRate || 0),
      hotPlayerName: hotPlayer?.playerName || '',
      hotPlayerStyleLabel: hotPlayer?.styleLabel || '',
      mapTrendName: mapTrend?.mapName || '',
      mapTrendStyleLabel: mapTrend?.styleLabel || '',
    },
    personal: {
      stage: personal.stage,
      championName: personal.championName || '',
      championTeamName: personal.championTeamName || '',
      played: personal.played,
      total: personal.total,
    },
    winners: {
      stage: winners.stage,
      championTeamName: winners.championTeamName || '',
      scoreHome: winners.scoreHome,
      scoreAway: winners.scoreAway,
      played: winners.played,
      total: winners.total,
    },
    highlights,
    recommendations,
  };
}

export function getSeasonStageSummary(state) {
  const current = normalizeState(state);
  const regularDone = isRegularSeasonComplete(current);
  const postseasonRows = getPostseasonRows(current);
  const postseasonPlayed = postseasonRows.filter((fixture) => fixture.played).length;
  const postseasonTotal = postseasonRows.length;
  const championId = postseasonChampionId(current);
  return {
    regularDone,
    postseasonStarted: postseasonTotal > 0,
    postseasonPlayed,
    postseasonTotal,
    postseasonChampionTeamName: championId ? teamName(current, championId) : '',
    stage: current.ended
      ? 'DONE'
      : postseasonTotal > 0
        ? 'POSTSEASON'
        : regularDone
          ? 'POSTSEASON_READY'
          : 'REGULAR',
    label: current.ended
      ? '시즌 종료'
      : postseasonTotal > 0
        ? `포스트시즌 ${postseasonPlayed}/${postseasonTotal}`
        : regularDone
          ? '포스트시즌 준비'
          : `${current.week}주차 정규리그`,
  };
}

export function scoreState(state) {
  const current = normalizeState(state);
  const leader = getTopTeams(current, 1)[0];
  const personal = normalizePersonalLeague(current.personalLeague, current.seasonNo);
  const winners = normalizeWinnersLeague(current.winnersLeague, current.seasonNo);
  const postseasonRows = getPostseasonRows(current);
  const careerScore = current.teams.reduce((sum, teamData) => {
    const career = normalizeTeamCareer(teamData);
    return sum + career.sponsorTier * 80 + career.trainingLevel * 55 + career.scoutingLevel * 45 + career.fanBase / 90;
  }, 0);
  const itemScore = createInventories(current.teams, current.inventories).reduce((sum, inventory) => {
    const owned = inventory.items.reduce((itemSum, item) => itemSum + Number(item.qty || 0), 0);
    const equipped = Object.values(inventory.equipped || {}).reduce((slotSum, slots) => slotSum + Object.values(slots || {}).filter(Boolean).length, 0);
    return sum + owned * 8 + equipped * 28;
  }, 0);
  return Math.max(0, Math.round(
    getPlayedCount(current) * 35
    + Number(leader?.wins || 0) * 180
    + Number(leader?.diff || 0) * 24
    + current.standings.reduce((sum, row) => sum + Number(row.money || 0), 0) / 12
    + careerScore
    + itemScore
    + personal.matches.filter((match) => match.played).length * 28
    + (personal.stage === 'DONE' ? 450 : 0)
    + winners.sets.length * 34
    + (winners.stage === 'DONE' ? 380 : 0)
    + postseasonRows.filter((fixture) => fixture.played).length * 55
    + (postseasonChampionId(current) ? 520 : 0)
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
  const personalSummary = getPersonalLeagueSummary(current);
  const winnersSummary = getWinnersLeagueSummary(current);
  const stageSummary = getSeasonStageSummary(current);
  const finaleReport = getSeasonFinaleReport(current);
  return {
    seasonNo: current.seasonNo,
    week: current.week,
    played: getPlayedCount(current),
    total: getTotalFixtureCount(current),
    proleagueAceSets: current.fixtures.reduce((sum, fixture) => (
      sum + (Array.isArray(fixture.result?.sets) ? fixture.result.sets.filter((setResult) => setResult.isAceSet).length : 0)
    ), 0),
    leader: leader?.teamName || '',
    champion: current.championTeamId ? teamName(current, current.championTeamId) : '',
    seasonStage: stageSummary.stage,
    seasonStageLabel: stageSummary.label,
    postseasonPlayed: stageSummary.postseasonPlayed,
    postseasonTotal: stageSummary.postseasonTotal,
    postseasonChampionTeamName: stageSummary.postseasonChampionTeamName,
    teams: current.teams.length,
    careerValue: Math.round(current.teams.reduce((sum, teamData) => {
      const career = normalizeTeamCareer(teamData);
      return sum + career.fanBase + career.sponsorTier * 250 + career.trainingLevel * 180 + career.scoutingLevel * 140;
    }, 0)),
    econLogs: normalizeEconLogs(current.econLogs).length,
    seasonReports: Array.isArray(current.seasonReports) ? current.seasonReports.length : 0,
    seasonFinale: {
      headline: finaleReport.headline,
      progressPct: finaleReport.progressPct,
      leaderTeamName: finaleReport.leaderTeamName,
      championTeamName: finaleReport.championTeamName,
      topPlayerName: finaleReport.topPlayerName,
      favoriteStyleLabel: finaleReport.meta.favoriteStyleLabel,
      net: finaleReport.net,
    },
    personalLeague: {
      stage: personalSummary.stage,
      phase: personalSummary.phase,
      played: personalSummary.played,
      total: personalSummary.total,
      championName: personalSummary.championName,
      championTeamName: personalSummary.championTeamName,
      historyCount: personalSummary.historyCount,
    },
    winnersLeague: {
      stage: winnersSummary.stage,
      scoreHome: winnersSummary.scoreHome,
      scoreAway: winnersSummary.scoreAway,
      played: winnersSummary.played,
      total: winnersSummary.total,
      championTeamName: winnersSummary.championTeamName,
      historyCount: winnersSummary.historyCount,
    },
    inventoryItems: createInventories(current.teams, current.inventories).reduce((sum, inventory) => (
      sum + inventory.items.reduce((itemSum, item) => itemSum + Number(item.qty || 0), 0)
    ), 0),
    score: scoreState(current),
  };
}

export function teamPower(teamData, state = null) {
  const resolvedTeam = state ? teamWithEquipment(normalizeState(state), teamData) : teamData;
  if (!resolvedTeam?.roster?.length) return 0;
  const sorted = [...resolvedTeam.roster]
    .sort((a, b) => averageStats(b) - averageStats(a))
    .slice(0, 5);
  return Math.round(sorted.reduce((sum, member) => sum + averageStats(member), 0) / sorted.length);
}
