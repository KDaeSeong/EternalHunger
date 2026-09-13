import { findItemByKeywords, shuffleArray } from './simulationCommon';
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
  const choices = getDimensionRiftChoiceKeys(day)
    .map((key) => ({ key, item: findDimensionRiftChoiceItem(publicItems, key) }))
    .filter(({ item }) => item?._id && !item.deleted);
  return choices.length ? shuffleArray(choices)[0] : { key: '', item: null };
}

function buildDimensionRiftSpawn(prevState, zones, forbiddenIds, curDay, curPhase, matchMode, mapId, rule = {}) {
  const state = prevState && typeof prevState === 'object' ? prevState : {};
  if (state.dimensionRiftMatchClosure) return { state, announcements: [] };
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
    .filter((r) => r?.rewardClosure || r?.rewardOffer?.status === 'pending' || Number(r?.day || 0) >= d - 1);

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
    status: 'open',
    entrants: [],
    resolved: false,
    winnerTeamId: '',
    loserTeamId: '',
    entrantTeamIds: [],
  }));

  state.dimensionRifts = [...active, ...created];
  state.spawnedDay.dimensionRift = spawnKey;

  return {
    state,
    announcements: [`🌀 차원의 틈 개방: ${picked.map((z) => z.name).join(', ')} (최대 ${maxTeams}팀)`],
  };
}

function listActiveDimensionRifts(state) {
  if (state?.dimensionRiftMatchClosure) return [];
  return (Array.isArray(state?.dimensionRifts) ? state.dimensionRifts : [])
    .filter((r) => r && !r.resolved && !r.matchClosure);
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
  // Repeated clock observations must not re-roll entrants or consume RNG.
  return [...grouped.values()].sort((a, b) => a.teamId.localeCompare(b.teamId))
    .slice(0, Math.max(1, Number(rift?.maxTeams || 2)));
}

function resolveDimensionRiftWinner(entrantTeams, { entryClosed = false } = {}) {
  const teams = Array.isArray(entrantTeams) ? entrantTeams.filter(Boolean) : [];
  if (!entryClosed || !teams.length || teams.some((team) => team.unknown)) return null;
  const remaining = teams.filter((team) => !team.outcome && (team.members || []).some((actor) => Number(actor?.hp) > 0));
  if (remaining.length !== 1) return null;
  const losers = teams.filter((team) => team !== remaining[0]);
  return {
    winner: remaining[0], loser: losers[0] || null, losers,
    uncontested: teams.length === 1,
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
