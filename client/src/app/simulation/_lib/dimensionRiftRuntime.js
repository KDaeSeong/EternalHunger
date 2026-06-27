import { findItemByKeywords, randInt, shuffleArray } from './simulationCommon';
import { getActorTeamId, getActorTeamName } from './teamRuntime';

const RIFT_DAYS = new Set([2, 3, 4]);

const RIFT_GIFT_BY_DAY = {
  2: { rarity: 'hero', tier: 4, label: '영웅' },
  3: { rarity: 'legendary', tier: 5, label: '전설' },
  4: { rarity: 'transcendent', tier: 6, label: '초월' },
};

const RIFT_CHOICE_TABLE = {
  life_tree: ['생명의 나무', '생나', 'tree of life'],
  meteor: ['운석', 'meteor'],
  mithril: ['미스릴', 'mithril'],
  tactical_module: ['전술 강화 모듈', 'tactical enhancement module', 'tactical module'],
  force_core: ['포스 코어', 'force core', 'forcecore'],
};

function isSquadMode(matchMode) {
  const m = String(matchMode || '').toLowerCase();
  return m !== 'solo';
}

function getDimensionRiftGiftMeta(day) {
  return RIFT_GIFT_BY_DAY[Number(day || 0)] || null;
}

function getDimensionRiftChoiceKeys(day) {
  const d = Number(day || 0);
  const base = ['life_tree', 'meteor', 'mithril', 'tactical_module'];
  return d >= 3 ? [...base, 'force_core'] : base;
}

function fallbackGiftItem(day) {
  const meta = getDimensionRiftGiftMeta(day) || RIFT_GIFT_BY_DAY[2];
  const label = `아글라이아의 선물 - ${meta.label}`;
  return {
    _id: `virtual:aglaia_gift:${meta.rarity}`,
    externalId: `virtual:aglaia_gift:${meta.rarity}`,
    name: label,
    type: '소모품',
    itemType: 'special',
    tags: ['aglaia', 'dimension_rift', meta.rarity],
    rarity: meta.rarity,
    tier: meta.tier,
    stackMax: 1,
  };
}

function findDimensionRiftGiftItem(publicItems, day) {
  const meta = getDimensionRiftGiftMeta(day);
  if (!meta) return null;
  const list = Array.isArray(publicItems) ? publicItems : [];
  const label = meta.label;
  const exact = list.find((it) => {
    const name = String(it?.name || it?.text || '');
    const key = `${String(it?._id || '')} ${String(it?.externalId || '')}`.toLowerCase();
    return name.includes('아글라이아의 선물') && (name.includes(label) || key.includes(meta.rarity));
  });
  return exact || findItemByKeywords(list, ['아글라이아의 선물', `aglaia ${meta.rarity}`]) || fallbackGiftItem(day);
}

function findDimensionRiftChoiceItem(publicItems, key) {
  return findItemByKeywords(publicItems, RIFT_CHOICE_TABLE[String(key || '')] || []);
}

function pickDimensionRiftChoice(publicItems, day) {
  const keys = shuffleArray(getDimensionRiftChoiceKeys(day));
  for (const key of keys) {
    const item = findDimensionRiftChoiceItem(publicItems, key);
    if (item?._id) return { key, item };
  }
  return { key: keys[0] || '', item: null };
}

function buildDimensionRiftSpawn(prevState, zones, forbiddenIds, curDay, curPhase, matchMode, mapId, rule = {}) {
  const state = prevState && typeof prevState === 'object' ? prevState : {};
  const d = Number(curDay || 0);
  const phase = String(curPhase || '');
  const spawnKey = d + (phase === 'night' ? 0.5 : 0);
  const meta = getDimensionRiftGiftMeta(d);
  const enabled = rule?.enabled !== false;
  const allowedDays = Array.isArray(rule?.days) && rule.days.length
    ? new Set(rule.days.map((x) => Number(x || 0)))
    : RIFT_DAYS;
  const targetPhase = String(rule?.phase || 'night');
  if (!enabled || !meta || phase !== targetPhase || !allowedDays.has(d) || !isSquadMode(matchMode)) return { state, announcements: [] };

  if (!state.spawnedDay || typeof state.spawnedDay !== 'object') state.spawnedDay = {};
  if (Number(state.spawnedDay.dimensionRift ?? -1) === spawnKey) {
    return { state, announcements: [] };
  }

  const forbidden = forbiddenIds instanceof Set ? forbiddenIds : new Set(Array.isArray(forbiddenIds) ? forbiddenIds.map(String) : []);
  const zoneRows = (Array.isArray(zones) ? zones : [])
    .map((z) => ({ zoneId: String(z?.zoneId || ''), name: String(z?.name || z?.zoneId || '') }))
    .filter((z) => z.zoneId && !forbidden.has(z.zoneId));
  const count = Math.max(1, Math.floor(Number(rule?.count ?? 4)));
  const maxTeams = Math.max(1, Math.floor(Number(rule?.maxTeams ?? 2)));
  const picked = shuffleArray(zoneRows).slice(0, Math.min(count, zoneRows.length));
  if (!picked.length) return { state, announcements: [] };

  if (!Array.isArray(state.dimensionRifts)) state.dimensionRifts = [];
  const active = state.dimensionRifts
    .filter((r) => !r?.resolved && Number(r?.day || 0) >= d - 1);

  const created = picked.map((z, idx) => ({
    id: `RIFT_${String(mapId || state.mapId || 'map')}_${d}_${idx + 1}`,
    zoneId: z.zoneId,
    zoneName: z.name,
    day: d,
    phase,
    spawnedAt: spawnKey,
    giftRarity: meta.rarity,
    giftTier: meta.tier,
    giftLabel: meta.label,
    maxTeams,
    resolved: false,
    winnerTeamId: '',
    loserTeamId: '',
    entrantTeamIds: [],
  }));

  state.dimensionRifts = [...active, ...created];
  state.spawnedDay.dimensionRift = spawnKey;

  return {
    state,
    announcements: [`🌀 차원의 틈 개방: ${picked.map((z) => z.name).join(', ')} (최대 2팀)`],
  };
}

function listActiveDimensionRifts(state) {
  return (Array.isArray(state?.dimensionRifts) ? state.dimensionRifts : [])
    .filter((r) => r && !r.resolved);
}

function pickRiftEntrantTeams(rift, survivors) {
  const zoneId = String(rift?.zoneId || '');
  const grouped = new Map();
  for (const actor of Array.isArray(survivors) ? survivors : []) {
    if (!actor || Number(actor?.hp || 0) <= 0 || String(actor?.zoneId || '') !== zoneId) continue;
    const teamId = getActorTeamId(actor);
    if (!teamId) continue;
    if (!grouped.has(teamId)) grouped.set(teamId, {
      teamId,
      teamName: getActorTeamName(actor),
      members: [],
    });
    grouped.get(teamId).members.push(actor);
  }
  return shuffleArray([...grouped.values()]).slice(0, Math.max(1, Number(rift?.maxTeams || 2)));
}

function scoreRiftTeam(team, estimatePower) {
  const members = Array.isArray(team?.members) ? team.members : [];
  const raw = members.reduce((sum, actor) => {
    const p = typeof estimatePower === 'function' ? Number(estimatePower(actor) || 0) : Number(actor?.hp || 0);
    return sum + Math.max(1, p);
  }, 0);
  return raw + randInt(0, 12);
}

function resolveDimensionRiftWinner(entrantTeams, estimatePower) {
  const teams = Array.isArray(entrantTeams) ? entrantTeams.filter(Boolean) : [];
  if (teams.length <= 0) return null;
  if (teams.length === 1) return { winner: teams[0], loser: null, uncontested: true };
  const scored = teams
    .map((team) => ({ team, score: scoreRiftTeam(team, estimatePower) }))
    .sort((a, b) => b.score - a.score);
  return {
    winner: scored[0]?.team || null,
    loser: scored[1]?.team || null,
    uncontested: false,
    winnerScore: scored[0]?.score || 0,
    loserScore: scored[1]?.score || 0,
  };
}

export {
  buildDimensionRiftSpawn,
  findDimensionRiftGiftItem,
  getDimensionRiftChoiceKeys,
  getDimensionRiftGiftMeta,
  isSquadMode,
  listActiveDimensionRifts,
  pickDimensionRiftChoice,
  pickRiftEntrantTeams,
  resolveDimensionRiftWinner,
};
