// server/utils/defaultZones.js
// ✅ "기본 맵 구역"(map 내부 micro-zone) 표준 세트
// - Map(맵)은 '병원/숲/호텔...' 같은 "지역(Area)" 단위
// - zones는 맵 내부의 "미세 구역"(Z1~Z19)으로만 유지
//   (zones에 '병원/숲...' 같은 지역명을 넣으면 '맵/존' 개념이 섞여서 깨집니다)

// 🏪 키오스크가 설치되는 "지역(맵 이름)" 목록
// - 유저 요구사항: 병원, 양궁장, 호텔, 창고, 연구소, 절, 소방서, 경찰서, 성당, 학교
const KIOSK_MAP_NAMES = [
  '병원',
  '양궁장',
  '호텔',
  '창고',
  '연구소',
  '절',
  '소방서',
  '경찰서',
  '성당',
  '학교',
];

// 🗺️ 맵 내부 기본 micro-zone (Z1~Z19)
const DEFAULT_ZONE_COUNT = 19;
const DEFAULT_ZONE_IDS = Array.from({ length: DEFAULT_ZONE_COUNT }, (_, i) => `Z${i + 1}`);

// 🌠 자연 코어(운석/생나) 기본 스폰 허용 micro-zone
// - 실제 튜닝은 어드민 coreSpawnZones/존별 설정을 우선
const CORE_SPAWN_ZONE_IDS = ['Z3', 'Z7', 'Z12', 'Z16'];

const DEFAULT_ZONES = DEFAULT_ZONE_IDS.map((zoneId, idx) => ({
  zoneId,
  name: `구역 ${idx + 1}`,
  polygon: [],
  isForbidden: false,
  // 편의 플래그(클라/시뮬에서 활용)
  hasKiosk: false, // ✅ 키오스크는 "맵(지역)" 단위로 존재
  coreSpawn: CORE_SPAWN_ZONE_IDS.includes(zoneId),
}));

module.exports = {
  KIOSK_MAP_NAMES,
  DEFAULT_ZONE_IDS,
  CORE_SPAWN_ZONE_IDS,
  DEFAULT_ZONES,
};
