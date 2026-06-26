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
  { zoneId: 'park', name: '연못' },
  { zoneId: 'hospital', name: '병원' },
  { zoneId: 'hotel', name: '호텔' },
  { zoneId: 'beach', name: '모래사장' },
  { zoneId: 'forest', name: '숲' },
  { zoneId: 'apartment', name: '고급 주택가' },
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
  'beach',
  'cemetery',
  'factory',
  'port',
];

const ZONE_DISPLAY_NAME_OVERRIDES = {
  park: '연못',
  beach: '모래사장',
  apartment: '고급 주택가',
};

const ZONE_ID_ALIASES = {
  pond: 'park',
  residential: 'apartment',
  uptown: 'apartment',
  high_residential: 'apartment',
  sandy_beach: 'beach',
  sandybeach: 'beach',
};

function canonicalZoneId(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  return ZONE_ID_ALIASES[raw] || raw;
}

function normalizeZoneDisplayName(zone) {
  const zoneId = canonicalZoneId(zone?.zoneId);
  return ZONE_DISPLAY_NAME_OVERRIDES[zoneId] || String(zone?.name || zoneId);
}

function normalizeZoneList(zones) {
  const merged = new Map();
  for (const rawZone of (Array.isArray(zones) ? zones : [])) {
    const zoneId = canonicalZoneId(rawZone?.zoneId);
    if (!zoneId) continue;
    const zone = {
      ...(rawZone || {}),
      zoneId,
      name: normalizeZoneDisplayName({ ...rawZone, zoneId }),
    };
    const prev = merged.get(zoneId);
    if (!prev) {
      merged.set(zoneId, zone);
      continue;
    }
    merged.set(zoneId, {
      ...prev,
      ...zone,
      zoneNo: Math.min(Number(prev.zoneNo || 9999), Number(zone.zoneNo || 9999)),
      polygon: Array.isArray(prev.polygon) && prev.polygon.length ? prev.polygon : zone.polygon,
      isForbidden: Boolean(prev.isForbidden || zone.isForbidden),
      hasKiosk: Boolean(prev.hasKiosk || zone.hasKiosk),
      coreSpawn: Boolean(prev.coreSpawn || zone.coreSpawn),
    });
  }
  return [...merged.values()]
    .sort((a, b) => Number(a.zoneNo || 9999) - Number(b.zoneNo || 9999))
    .map((zone, idx) => ({
      ...zone,
      zoneNo: idx + 1,
      name: normalizeZoneDisplayName(zone),
    }));
}

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
  ZONE_DISPLAY_NAME_OVERRIDES,
  ZONE_ID_ALIASES,
  canonicalZoneId,
  normalizeZoneDisplayName,
  normalizeZoneList,
};
