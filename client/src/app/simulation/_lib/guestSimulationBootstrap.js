import { DEFAULT_ER_STATS } from '../../../utils/erStats.js';
import { applyGuestCharacterProfiles } from './guestCharacterProfileRuntime.js';
import {
  LUMIA_DEFAULT_EDGES,
  LUMIA_HYPERLOOP_ZONE_IDS,
  LUMIA_KIOSK_ZONE_IDS,
} from './simulationConstants.js';
import {
  loadLocalSimulationMaps,
  readLocalRulesetOverride,
  readLocalRulesetSelection,
} from './localSimulationMapRuntime.js';
import { buildRulesetSnapshot, normalizeRulesetId } from '../../../utils/rulesets.js';
import { mergeGuestItemCatalog } from './guestItemProfileRuntime.js';

export const GUEST_SIMULATION_MAP_ID = 'guest-lumia-island';
export const GUEST_SIMULATION_ROSTER_SIZE = 24;

// A versioned local chunk, not a backend request. Return a fresh copy so a run
// cannot mutate the shared catalog used by later matches.
export async function loadGuestSimulationItemCatalog(options = {}) {
  const { GUEST_ITEM_CATALOG, GUEST_ITEM_CATALOG_META } = await import('../_generated/guestItemCatalog.generated.js');
  if (GUEST_ITEM_CATALOG_META?.schemaVersion !== 1
    || !Array.isArray(GUEST_ITEM_CATALOG)
    || GUEST_ITEM_CATALOG.length !== GUEST_ITEM_CATALOG_META.itemCount
    || !GUEST_ITEM_CATALOG.some((item) => item?.recipe?.ingredients?.length)) {
    throw new Error('내장 아이템 카탈로그를 불러오지 못했습니다. 새로고침 후 다시 시도해주세요.');
  }
  return mergeGuestItemCatalog(GUEST_ITEM_CATALOG, options);
}

const GUEST_CALLSIGNS = [
  '백로', '매화', '청람', '은하', '도담', '해오름',
  '나래', '초롱', '미르', '새벽', '윤슬', '노을',
  '가람', '보라', '여울', '솔빛', '라온', '다온',
  '마루', '구름', '이슬', '바람', '하늘', '별하',
];

const GUEST_LUMIA_ZONE_NAMES = {
  alley: '골목길',
  gas_station: '주유소',
  archery: '양궁장',
  school: '학교',
  police: '경찰서',
  firestation: '소방서',
  temple: '절',
  stream: '개울',
  park: '연못',
  hospital: '병원',
  hotel: '호텔',
  beach: '모래사장',
  forest: '숲',
  apartment: '고급 주택가',
  cemetery: '묘지',
  cathedral: '성당',
  warehouse: '창고',
  port: '항구',
  barge: '바지선',
  factory: '공장',
  lab: '연구소',
};

const GUEST_ARCHETYPES = [
  {
    role: 'tank', weaponType: '망치', tacticalSkill: '초월', erTrait: 'fortress',
    stats: { maxHp: 118, attackPower: 22, defense: 19, attackSpeed: 0.66, attackRange: 1.4, sightRange: 8.2 },
  },
  {
    role: 'marksman', weaponType: '돌격소총', tacticalSkill: '리펄서 미사일', erTrait: 'adrenaline',
    stats: { maxHp: 94, attackPower: 25, defense: 12, attackSpeed: 0.86, attackRange: 5.2, sightRange: 9.4 },
  },
  {
    role: 'support', weaponType: '기타', tacticalSkill: '치유의 바람', erTrait: 'ampDrone',
    stats: { maxHp: 106, attackPower: 20, skillAmp: 23, defense: 15, attackSpeed: 0.72, attackRange: 3.8, sightRange: 9.1 },
  },
  {
    role: 'assassin', weaponType: '단검', tacticalSkill: '플라즈마 대시', erTrait: 'sprint',
    stats: { maxHp: 92, attackPower: 29, defense: 12, attackSpeed: 0.94, attackRange: 1.3, sightRange: 8.4 },
  },
  {
    role: 'bruiser', weaponType: '도끼', tacticalSkill: '퀘이크', erTrait: 'devour',
    stats: { maxHp: 112, attackPower: 28, defense: 16, attackSpeed: 0.71, attackRange: 1.6, sightRange: 8 },
  },
  {
    role: 'mage', weaponType: '아르카나', tacticalSkill: '프로토콜 위반', erTrait: 'ampDrone',
    stats: { maxHp: 96, attackPower: 19, skillAmp: 29, defense: 13, attackSpeed: 0.7, attackRange: 4.4, sightRange: 8.8 },
  },
  {
    role: 'duelist', weaponType: '레이피어', tacticalSkill: '붉은 폭풍', erTrait: 'sprint',
    stats: { maxHp: 101, attackPower: 27, defense: 14, attackSpeed: 0.88, attackRange: 1.8, sightRange: 8.1 },
  },
  {
    role: 'scout', weaponType: '권총', tacticalSkill: '블링크', erTrait: 'adrenaline',
    stats: { maxHp: 97, attackPower: 24, defense: 13, attackSpeed: 0.9, attackRange: 4.2, sightRange: 10.2 },
  },
];

export function isGuestSimulationSession(token, user) {
  const identity = String(user?.username || user?.id || user?._id || '').trim();
  return !token || !identity;
}

export function buildGuestSimulationProfile() {
  return {
    _id: 'guest-local',
    id: 'guest-local',
    username: 'guest',
    nickname: '게스트',
    credits: 0,
    lp: 0,
    perks: [],
    isGuest: true,
  };
}

export function buildGuestSimulationRoster() {
  return Array.from({ length: GUEST_SIMULATION_ROSTER_SIZE }, (_, index) => {
    const archetype = GUEST_ARCHETYPES[index % GUEST_ARCHETYPES.length];
    const cycle = Math.floor(index / GUEST_ARCHETYPES.length);
    const id = `guest-survivor-${String(index + 1).padStart(2, '0')}`;
    const stats = {
      ...DEFAULT_ER_STATS,
      ...archetype.stats,
      maxHp: Number(archetype.stats.maxHp || DEFAULT_ER_STATS.maxHp) + cycle * 2,
      attackPower: Number(archetype.stats.attackPower || DEFAULT_ER_STATS.attackPower) + cycle * 0.4,
      defense: Number(archetype.stats.defense || DEFAULT_ER_STATS.defense) + cycle * 0.2,
    };

    return {
      _id: id,
      id,
      name: GUEST_CALLSIGNS[index] || `생존자 ${index + 1}`,
      summary: `게스트 기본 로스터 · ${archetype.role}`,
      gender: index % 2 === 0 ? 'female' : 'male',
      weaponType: archetype.weaponType,
      erWeapons: [archetype.weaponType],
      erRole: archetype.role,
      erTrait: archetype.erTrait,
      tacticalSkill: archetype.tacticalSkill,
      tacticalSkillLevel: 1,
      goalGearTier: 6,
      stats,
      inventory: [],
      records: { games: 0, wins: 0, kills: 0, assists: 0 },
      guestDefault: true,
    };
  });
}

export function buildGuestSimulationMap() {
  const hyperloopIds = new Set(LUMIA_HYPERLOOP_ZONE_IDS.map(String));
  const kioskIds = new Set(LUMIA_KIOSK_ZONE_IDS.map(String));
  const zones = Object.entries(GUEST_LUMIA_ZONE_NAMES).map(([zoneId, name]) => ({
    zoneId,
    name,
    isForbidden: false,
    hasHyperloop: hyperloopIds.has(zoneId),
    hasKiosk: kioskIds.has(zoneId),
  }));
  const zoneIds = new Set(zones.map((zone) => String(zone.zoneId)));
  const zoneConnections = (Array.isArray(LUMIA_DEFAULT_EDGES) ? LUMIA_DEFAULT_EDGES : [])
    .filter(([fromZoneId, toZoneId]) => zoneIds.has(String(fromZoneId)) && zoneIds.has(String(toZoneId)))
    .map(([fromZoneId, toZoneId, connectionType], index) => ({
      _id: `guest-edge-${index + 1}`,
      fromZoneId: String(fromZoneId),
      toZoneId: String(toZoneId),
      bidirectional: true,
      connectionType: String(connectionType || 'road'),
    }));

  return {
    _id: GUEST_SIMULATION_MAP_ID,
    id: GUEST_SIMULATION_MAP_ID,
    name: '루미아 섬 · 내장 지도',
    description: '게스트와 오프라인 초기화를 위한 내장 지도',
    zones,
    zoneConnections,
    crateAllowDeny: {},
    hyperloopDeviceZoneId: 'lab',
    guestDefault: true,
  };
}

export function resolveSimulationBootstrapData({
  charList,
  guestProfiles = [],
  defaultSettings,
  guestMode,
  mapsList,
  meValue,
  settingValue,
  isolatedEvaluation = false,
} = {}) {
  const guestFallback = buildGuestSimulationMap();
  const resolvedMaps = guestMode
    ? (isolatedEvaluation ? [guestFallback] : loadLocalSimulationMaps(guestFallback))
    : (Array.isArray(mapsList) && mapsList.length ? mapsList : [guestFallback]);
  const localRulesetId = guestMode
    ? normalizeRulesetId((isolatedEvaluation ? '' : readLocalRulesetSelection()) || defaultSettings?.rulesetId)
    : '';
  const localRulesetPatch = guestMode && !isolatedEvaluation ? readLocalRulesetOverride(localRulesetId) : null;
  if (!guestMode) {
    return {
      charList: Array.isArray(charList) ? charList : [],
      mapsList: resolvedMaps,
      meValue: meValue && typeof meValue === 'object' ? meValue : {},
      settingValue: settingValue && typeof settingValue === 'object' ? settingValue : {},
    };
  }

  return {
    charList: applyGuestCharacterProfiles(
      Array.isArray(charList) && charList.length ? charList : buildGuestSimulationRoster(),
      isolatedEvaluation ? [] : guestProfiles
    ),
    mapsList: resolvedMaps,
    meValue: buildGuestSimulationProfile(),
    settingValue: {
      ...(defaultSettings && typeof defaultSettings === 'object' ? defaultSettings : {}),
      ...(settingValue && typeof settingValue === 'object' ? settingValue : {}),
      rulesetId: localRulesetId,
      simulationRuleset: buildRulesetSnapshot(localRulesetId, localRulesetPatch),
    },
  };
}
