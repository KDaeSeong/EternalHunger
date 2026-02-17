// server/utils/defaultZones.js
// ✅ "기본 맵 구역" 표준 세트
// - 키오스크 존재: 병원, 성당, 경찰서, 소방서, 양궁장, 절, 창고, 연구소, 호텔, 학교
// - 키오스크 없음: 주유소, 골목길, 모래사장, 숲, 개울, 연못, 공장, 항구, 고급 주택가

const ZONE_ID_BY_NAME = {
  '병원': 'hospital',
  '성당': 'cathedral',
  '경찰서': 'police',
  '소방서': 'firestation',
  '양궁장': 'archery',
  '절': 'temple',
  '창고': 'warehouse',
  '연구소': 'lab',
  '호텔': 'hotel',
  '학교': 'school',

  '주유소': 'gas_station',
  '골목길': 'alley',
  '모래사장': 'beach',
  '숲': 'forest',
  '개울': 'stream',
  '연못': 'pond',
  '공장': 'factory',
  '항구': 'port',
  '고급 주택가': 'residential',
};

const KIOSK_ZONE_NAMES = [
  '병원', '성당', '경찰서', '소방서', '양궁장', '절', '창고', '연구소', '호텔', '학교',
];

const NO_KIOSK_ZONE_NAMES = [
  '주유소', '골목길', '모래사장', '숲', '개울', '연못', '공장', '항구', '고급 주택가',
];

// ✅ 운석/생명의 나무 자연 스폰(2일차 낮 이후) 가능 구역(기본값)
// - "일부 맵(구역)"만 해당: 필요하면 여기만 조정하면 됩니다.
const CORE_SPAWN_ZONE_NAMES = [
  '모래사장', '숲', '개울', '연못', '공장', '항구',
];


const DEFAULT_ZONE_NAMES = [...KIOSK_ZONE_NAMES, ...NO_KIOSK_ZONE_NAMES];

const DEFAULT_ZONES = DEFAULT_ZONE_NAMES.map((name) => ({
  zoneId: ZONE_ID_BY_NAME[name] || name,
  name,
  polygon: [],
  isForbidden: false,
  // 편의 플래그(클라/시뮬에서 활용)
  hasKiosk: KIOSK_ZONE_NAMES.includes(name),
  coreSpawn: CORE_SPAWN_ZONE_NAMES.includes(name),
}));

module.exports = {
  ZONE_ID_BY_NAME,
  KIOSK_ZONE_NAMES,
  NO_KIOSK_ZONE_NAMES,
  CORE_SPAWN_ZONE_NAMES,
  DEFAULT_ZONE_NAMES,
  DEFAULT_ZONES,
};
