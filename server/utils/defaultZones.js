// Default Lumia Island zones used when an admin map does not define custom zones.

const KIOSK_MAP_NAMES = [
  '양궁장',
  '학교',
  '연구소',
  '경찰서',
  '소방서',
  '절',
  '병원',
  '창고',
  '바지선',
  '성당',
  '호텔',
];

const DEFAULT_ZONE_DEFS = [
  { zoneId: 'alley', name: '골목길' },
  { zoneId: 'gas_station', name: '주유소' },
  { zoneId: 'archery', name: '양궁장' },
  { zoneId: 'school', name: '학교' },
  { zoneId: 'police', name: '경찰서' },
  { zoneId: 'firestation', name: '소방서' },
  { zoneId: 'temple', name: '절' },
  { zoneId: 'stream', name: '개울' },
  { zoneId: 'park', name: '공원' },
  { zoneId: 'hospital', name: '병원' },
  { zoneId: 'hotel', name: '호텔' },
  { zoneId: 'beach', name: '해수욕장' },
  { zoneId: 'forest', name: '숲' },
  { zoneId: 'sandy_beach', name: '모래사장' },
  { zoneId: 'apartment', name: '아파트단지' },
  { zoneId: 'cemetery', name: '묘지' },
  { zoneId: 'cathedral', name: '성당' },
  { zoneId: 'warehouse', name: '창고' },
  { zoneId: 'port', name: '항구' },
  { zoneId: 'barge', name: '바지선' },
  { zoneId: 'factory', name: '공장' },
  { zoneId: 'lab', name: '연구소' },
];

const DEFAULT_ZONE_IDS = DEFAULT_ZONE_DEFS.map((z) => z.zoneId);

const CORE_SPAWN_ZONE_IDS = [
  'forest',
  'stream',
  'sandy_beach',
  'cemetery',
  'factory',
  'port',
];

const DEFAULT_ZONES = DEFAULT_ZONE_DEFS.map((zone, idx) => ({
  zoneNo: idx + 1,
  zoneId: zone.zoneId,
  name: zone.name,
  polygon: [],
  isForbidden: false,
  hasKiosk: KIOSK_MAP_NAMES.includes(zone.name),
  coreSpawn: CORE_SPAWN_ZONE_IDS.includes(zone.zoneId),
}));

module.exports = {
  KIOSK_MAP_NAMES,
  DEFAULT_ZONE_DEFS,
  DEFAULT_ZONE_IDS,
  CORE_SPAWN_ZONE_IDS,
  DEFAULT_ZONES,
};
