import { normalizeMatchKey, pickWeighted } from './simulationCommon';
import { isItemExcludedFromFieldFarming } from '../../../utils/erItemFilters';
import {
  getLumiaZoneArea,
  getLumiaZoneAreaWeight,
} from './lumiaMapGeometryRuntime';

// Generated from the attached Lumia Island region reference.
// Keep this file deterministic: runtime code consumes zone loot, resource, wildlife, and facility data from here.
const RAW_LUMIA_REGION_DATA = [
  {
    "zoneId": "lab",
    "name": "연구소",
    "items": [],
    "resources": {},
    "wildlife": {},
    "campfire": false,
    "kiosk": true,
    "hyperloop": false
  },
  {
    "zoneId": "alley",
    "name": "골목길",
    "items": [
      "야구공",
      "유리구슬",
      "모자",
      "팔찌",
      "가위",
      "만년필",
      "곡괭이",
      "유리병",
      "리본",
      "십자가",
      "못",
      "라이터",
      "원석",
      "플라스틱",
      "피아노선",
      "냉동 피자"
    ],
    "resources": {
      "돌멩이": 2,
      "나뭇가지": 2
    },
    "wildlife": {
      "닭": 4,
      "박쥐": 1,
      "멧돼지": 0,
      "늑대": 4,
      "곰": 1
    },
    "campfire": true,
    "kiosk": false,
    "hyperloop": false
  },
  {
    "zoneId": "gas_station",
    "name": "주유소",
    "items": [
      "목장갑",
      "렌즈",
      "자전거 헬멧",
      "셔츠",
      "손목시계",
      "고무",
      "고철",
      "라이터",
      "레이저 포인터",
      "마패",
      "배터리",
      "오일",
      "옷감",
      "화학품",
      "빵",
      "냉동 피자"
    ],
    "resources": {
      "돌멩이": 4,
      "나뭇가지": 5,
      "감자": 3
    },
    "wildlife": {
      "닭": 3,
      "박쥐": 1,
      "들개": 1,
      "늑대": 2,
      "곰": 2
    },
    "campfire": false,
    "kiosk": false,
    "hyperloop": true
  },
  {
    "zoneId": "temple",
    "name": "절",
    "items": [
      "녹슨 검",
      "쌍칼",
      "단창",
      "대나무",
      "면도칼",
      "렌즈",
      "유리구슬",
      "머리띠",
      "승복",
      "운동화",
      "타이즈",
      "나막신",
      "곡괭이",
      "깃털",
      "탄창",
      "거북이 등딱지",
      "마패",
      "배터리",
      "옷감",
      "원석",
      "빵",
      "약초",
      "냉동 피자"
    ],
    "resources": {
      "돌멩이": 4,
      "나뭇가지": 4,
      "물": 1,
      "감자": 6
    },
    "wildlife": {
      "닭": 5,
      "박쥐": 4,
      "멧돼지": 3,
      "곰": 2,
      "변이 곰": 2
    },
    "campfire": false,
    "kiosk": true,
    "hyperloop": true
  },
  {
    "zoneId": "police",
    "name": "경찰서",
    "items": [
      "석궁",
      "발터 PPK",
      "페도로프 자동소총",
      "화승총",
      "쇠사슬",
      "손목시계",
      "쇠구슬",
      "분필",
      "리본",
      "쌍안경",
      "탄창",
      "라이터",
      "레이저 포인터",
      "마패",
      "종이",
      "화약",
      "흑연",
      "피아노선",
      "냉동 피자"
    ],
    "resources": {
      "돌멩이": 3,
      "나뭇가지": 3
    },
    "wildlife": {
      "닭": 6,
      "멧돼지": 4,
      "들개": 3
    },
    "campfire": false,
    "kiosk": true,
    "hyperloop": false
  },
  {
    "zoneId": "firestation",
    "name": "소방서",
    "items": [
      "쌍칼",
      "망치",
      "손도끼",
      "목장갑",
      "화승총",
      "바늘",
      "자전거 헬멧",
      "붕대",
      "만년필",
      "쇠구슬",
      "트럼프 카드",
      "십자가",
      "못",
      "고무",
      "고철",
      "배터리",
      "화약",
      "화학품",
      "플라스틱",
      "실",
      "냉동 피자"
    ],
    "resources": {
      "돌멩이": 2,
      "나뭇가지": 3
    },
    "wildlife": {
      "닭": 1,
      "멧돼지": 4,
      "들개": 2,
      "늑대": 2
    },
    "campfire": true,
    "kiosk": true,
    "hyperloop": false
  },
  {
    "zoneId": "stream",
    "name": "개울",
    "items": [
      "망치",
      "양궁",
      "머리띠",
      "전신 수영복",
      "셔츠",
      "슬리퍼",
      "쇠구슬",
      "트럼프 카드",
      "분필",
      "깃털",
      "얼음",
      "거북이 등딱지",
      "고철",
      "원석",
      "화약",
      "플라스틱",
      "피아노선",
      "약초",
      "냉동 피자"
    ],
    "resources": {
      "돌멩이": 4,
      "나뭇가지": 7,
      "꽃": 4,
      "물": 3,
      "감자": 3,
      "대구": 2
    },
    "wildlife": {
      "닭": 2,
      "박쥐": 2,
      "멧돼지": 2,
      "곰": 2
    },
    "campfire": true,
    "kiosk": false,
    "hyperloop": true
  },
  {
    "zoneId": "park",
    "name": "연못",
    "items": [
      "대나무",
      "야구공",
      "양궁",
      "석궁",
      "머리띠",
      "바람막이",
      "전신 수영복",
      "나막신",
      "깃털",
      "리본",
      "거북이 등딱지",
      "오일",
      "원석",
      "종이",
      "흑연",
      "실",
      "약초",
      "냉동 피자"
    ],
    "resources": {
      "돌멩이": 1,
      "나뭇가지": 1,
      "꽃": 4,
      "물": 1,
      "대구": 2
    },
    "wildlife": {
      "닭": 4,
      "박쥐": 2,
      "멧돼지": 3
    },
    "campfire": false,
    "kiosk": false,
    "hyperloop": false
  },
  {
    "zoneId": "hospital",
    "name": "병원",
    "items": [
      "바늘",
      "모자",
      "손목시계",
      "붕대",
      "팔찌",
      "타이즈",
      "가위",
      "유리병",
      "얼음",
      "고무",
      "레이저 포인터",
      "배터리",
      "오일",
      "옷감",
      "화학품",
      "종이",
      "구급상자"
    ],
    "resources": {
      "돌멩이": 4,
      "나뭇가지": 3
    },
    "wildlife": {
      "닭": 3,
      "박쥐": 1,
      "들개": 1,
      "멧돼지": 1,
      "늑대": 4
    },
    "campfire": false,
    "kiosk": true,
    "hyperloop": true
  },
  {
    "zoneId": "archery",
    "name": "양궁장",
    "items": [
      "녹슨 검",
      "단창",
      "단봉",
      "대나무",
      "채찍",
      "양궁",
      "석궁",
      "모자",
      "승복",
      "운동화",
      "가위",
      "쇠구슬",
      "유리병",
      "깃털",
      "쌍안경",
      "못",
      "화약",
      "흑연",
      "피아노선",
      "실",
      "냉동 피자"
    ],
    "resources": {
      "돌멩이": 4,
      "나뭇가지": 4
    },
    "wildlife": {
      "박쥐": 1,
      "멧돼지": 3,
      "늑대": 4,
      "변이 늑대": 3
    },
    "campfire": false,
    "kiosk": true,
    "hyperloop": false
  },
  {
    "zoneId": "school",
    "name": "학교",
    "items": [
      "식칼",
      "손도끼",
      "단봉",
      "야구공",
      "보급형 기타",
      "유리구슬",
      "가면",
      "바람막이",
      "붕대",
      "슬리퍼",
      "가위",
      "만년필",
      "분필",
      "리본",
      "십자가",
      "얼음",
      "라이터",
      "레이저 포인터",
      "종이",
      "화학품",
      "흑연",
      "실",
      "빵",
      "초콜릿",
      "냉동 피자"
    ],
    "resources": {
      "돌멩이": 6,
      "나뭇가지": 7,
      "물": 2
    },
    "wildlife": {
      "닭": 6,
      "박쥐": 4,
      "멧돼지": 3,
      "들개": 2
    },
    "campfire": true,
    "kiosk": true,
    "hyperloop": true
  },
  {
    "zoneId": "hotel",
    "name": "호텔",
    "items": [
      "식칼",
      "면도칼",
      "발터 PPK",
      "페도로프 자동소총",
      "바늘",
      "렌즈",
      "머리띠",
      "셔츠",
      "팔찌",
      "슬리퍼",
      "만년필",
      "트럼프 카드",
      "탄창",
      "얼음",
      "못",
      "배터리",
      "오일",
      "옷감",
      "종이",
      "피아노선",
      "빵",
      "냉동 피자"
    ],
    "resources": {
      "돌멩이": 3,
      "나뭇가지": 6,
      "물": 1
    },
    "wildlife": {
      "닭": 4,
      "박쥐": 1,
      "멧돼지": 1,
      "들개": 3,
      "늑대": 4
    },
    "campfire": false,
    "kiosk": true,
    "hyperloop": true
  },
  {
    "zoneId": "forest",
    "name": "숲",
    "items": [
      "녹슨 검",
      "손도끼",
      "단봉",
      "대나무",
      "석궁",
      "쇠사슬",
      "모자",
      "자전거 헬멧",
      "승복",
      "붕대",
      "타이즈",
      "나막신",
      "곡괭이",
      "깃털",
      "쌍안경",
      "얼음",
      "거북이 등딱지",
      "라이터",
      "레이저 포인터",
      "원석",
      "화약",
      "약초",
      "냉동 피자"
    ],
    "resources": {
      "돌멩이": 5,
      "나뭇가지": 11,
      "꽃": 5,
      "물": 2,
      "감자": 3,
      "대구": 2
    },
    "wildlife": {
      "닭": 4,
      "박": 4,
      "멧돼지": 3,
      "늑대": 2,
      "곰": 1
    },
    "campfire": true,
    "kiosk": false,
    "hyperloop": true
  },
  {
    "zoneId": "cemetery",
    "name": "묘지",
    "items": [
      "채찍",
      "쇠사슬",
      "가면",
      "승복",
      "팔찌",
      "곡괭이",
      "리본",
      "십자가",
      "라이터",
      "마패",
      "옷감",
      "원석",
      "화학품",
      "흑연",
      "플라스틱",
      "냉동 피자"
    ],
    "resources": {
      "돌멩이": 5,
      "나뭇가지": 7,
      "꽃": 5,
      "물": 2,
      "감자": 3,
      "대구": 2
    },
    "wildlife": {
      "닭": 4,
      "박쥐": 4,
      "멧돼지": 4,
      "늑대": 2
    },
    "campfire": true,
    "kiosk": false,
    "hyperloop": false
  },
  {
    "zoneId": "cathedral",
    "name": "성당",
    "items": [
      "녹슨 검",
      "단봉",
      "채찍",
      "면도칼",
      "양궁",
      "화승총",
      "보급형 기타",
      "유리구슬",
      "모자",
      "머리띠",
      "셔츠",
      "슬리퍼",
      "유리병",
      "트럼프 카드",
      "분필",
      "십자가",
      "못",
      "옷감",
      "화약",
      "피아노선",
      "실",
      "빵",
      "냉동 피자"
    ],
    "resources": {
      "돌멩이": 6,
      "나뭇가지": 4,
      "물": 1
    },
    "wildlife": {
      "닭": 8,
      "박쥐": 3,
      "멧돼지": 3,
      "늑대": 2,
      "곰": 1
    },
    "campfire": false,
    "kiosk": true,
    "hyperloop": true
  },
  {
    "zoneId": "factory",
    "name": "공장",
    "items": [
      "망치",
      "손도끼",
      "단창",
      "목장갑",
      "면도칼",
      "발터 PPK",
      "페도로프 자동소총",
      "자전거 헬멧",
      "가면",
      "손목시계",
      "붕대",
      "운동화",
      "쇠구슬",
      "분필",
      "탄창",
      "못",
      "고무",
      "고철",
      "마패",
      "배터리",
      "오일",
      "종이",
      "화학품",
      "플라스틱",
      "초콜릿",
      "냉동 피자"
    ],
    "resources": {
      "돌멩이": 5,
      "나뭇가지": 7,
      "대구": 2
    },
    "wildlife": {
      "닭": 3,
      "박쥐": 3,
      "멧돼지": 1,
      "들개": 3,
      "늑대": 4,
      "변이 늑대": 3
    },
    "campfire": true,
    "kiosk": false,
    "hyperloop": true
  },
  {
    "zoneId": "beach",
    "name": "모래사장",
    "items": [
      "쌍칼",
      "단창",
      "야구공",
      "보급형 기타",
      "바람막이",
      "전신 수영복",
      "운동화",
      "나막신",
      "곡괭이",
      "유리병",
      "쌍안경",
      "거북이 등딱지",
      "고무",
      "고철",
      "오일",
      "원석",
      "흑연",
      "플라스틱",
      "실",
      "냉동 피자"
    ],
    "resources": {
      "돌멩이": 5,
      "나뭇가지": 6,
      "대구": 3
    },
    "wildlife": {
      "박쥐": 2,
      "멧돼지": 2,
      "들개": 1,
      "곰": 3,
      "변이 곰": 2
    },
    "campfire": true,
    "kiosk": false,
    "hyperloop": false
  },
  {
    "zoneId": "apartment",
    "name": "고급 주택가",
    "items": [
      "식칼",
      "채찍",
      "화승총",
      "바늘",
      "보급형 기타",
      "모자",
      "자전거 헬멧",
      "가면",
      "손목시계",
      "팔찌",
      "타이즈",
      "가위",
      "만년필",
      "쇠구슬",
      "트럼프 카드",
      "리본",
      "라이터",
      "옷감",
      "피아노선",
      "초콜릿",
      "냉동 피자"
    ],
    "resources": {
      "돌멩이": 7,
      "나뭇가지": 7,
      "꽃": 6,
      "대구": 2
    },
    "wildlife": {
      "닭": 7,
      "멧돼지": 2,
      "들개": 2,
      "늑대": 2,
      "곰": 2
    },
    "campfire": false,
    "kiosk": false,
    "hyperloop": true
  },
  {
    "zoneId": "warehouse",
    "name": "창고",
    "items": [
      "망치",
      "목장갑",
      "발터 PPK",
      "페도로프 자동소총",
      "머리띠",
      "모자",
      "팔찌",
      "곡괭이",
      "유리병",
      "깃털",
      "리본",
      "고무",
      "배터리",
      "종이",
      "흑연",
      "플라스틱",
      "냉동 피자"
    ],
    "resources": {
      "돌멩이": 2,
      "나뭇가지": 2
    },
    "wildlife": {
      "닭": 2,
      "박쥐": 1,
      "멧돼지": 2,
      "곰": 2
    },
    "campfire": true,
    "kiosk": true,
    "hyperloop": false
  },
  {
    "zoneId": "port",
    "name": "항구",
    "items": [
      "식칼",
      "쌍칼",
      "쇠사슬",
      "바람막이",
      "전신 수영복",
      "손목시계",
      "붕대",
      "가위",
      "만년필",
      "깃털",
      "거북이 등딱지",
      "고철",
      "라이터",
      "마패",
      "원석",
      "실",
      "초콜릿",
      "냉동 피자"
    ],
    "resources": {
      "돌멩이": 2,
      "나뭇가지": 4,
      "대구": 2
    },
    "wildlife": {
      "닭": 2,
      "박쥐": 1,
      "들개": 2,
      "곰": 3
    },
    "campfire": true,
    "kiosk": false,
    "hyperloop": false
  },
  {
    "zoneId": "barge",
    "name": "바지선",
    "items": [
      "자전거 헬멧",
      "손목시계",
      "붕대",
      "렌즈",
      "가위",
      "곡괭이",
      "쇠구슬",
      "유리병",
      "깃털",
      "마패",
      "배터리",
      "오일",
      "옷감",
      "흑연",
      "피아노선",
      "냉동 피자"
    ],
    "resources": {},
    "wildlife": {},
    "campfire": false,
    "kiosk": true,
    "hyperloop": true
  }
];

const ZONE_ID_ALIASES = {
  pond: 'park',
  residential: 'apartment',
  uptown: 'apartment',
  sandy_beach: 'beach',
  sandybeach: 'beach',
};

const RESOURCE_ALIASES = {
  '돌멩이': ['돌멩이', '돌'],
  '나뭇가지': ['나뭇가지', '나뭇', '나무'],
  '물': ['물'],
  '감자': ['감자'],
  '대구': ['대구'],
  '꽃': ['꽃'],
};

const WILDLIFE_NAME_TO_KEY = {
  '닭': 'chicken',
  '박': 'bat',
  '박쥐': 'bat',
  '멧돼지': 'boar',
  '들개': 'dog',
  '늑대': 'wolf',
  '곰': 'bear',
  '변이 닭': 'chicken',
  '변이 박쥐': 'bat',
  '변이 멧돼지': 'boar',
  '변이 들개': 'dog',
  '변이 늑대': 'wolf',
  '변이 곰': 'bear',
};

function canonicalZoneId(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  return ZONE_ID_ALIASES[raw] || raw;
}

function itemNamesForRegion(region) {
  const names = [...(Array.isArray(region?.items) ? region.items : [])];
  for (const name of Object.keys(region?.resources || {})) {
    const aliases = RESOURCE_ALIASES[name] || [name];
    aliases.forEach((alias) => names.push(alias));
  }
  return [...new Set(names.map((name) => String(name || '').trim()).filter(Boolean))];
}

const LUMIA_REGION_DATA = RAW_LUMIA_REGION_DATA.map((region) => ({
  ...region,
  zoneId: canonicalZoneId(region.zoneId),
  searchNames: itemNamesForRegion(region),
}));

const REGION_BY_ZONE_ID = new Map(LUMIA_REGION_DATA.map((region) => [String(region.zoneId), region]));
const REGION_BY_NAME_KEY = new Map(LUMIA_REGION_DATA.map((region) => [normalizeMatchKey(region.name), region]));

function getRegionData(zoneIdOrName) {
  const id = canonicalZoneId(zoneIdOrName);
  if (REGION_BY_ZONE_ID.has(id)) return REGION_BY_ZONE_ID.get(id);
  const key = normalizeMatchKey(zoneIdOrName);
  return REGION_BY_NAME_KEY.get(key) || null;
}

function getZoneRegionData(zoneId) {
  return getRegionData(zoneId);
}

function itemNameCandidates(item) {
  return [item?.name, item?.text, item?.localizedName, item?.itemKey, item?.externalId]
    .map((value) => String(value || '').trim())
    .filter(Boolean);
}

function matchNameScore(item, regionName) {
  const target = normalizeMatchKey(regionName);
  if (!target) return 0;
  let best = 0;
  for (const name of itemNameCandidates(item)) {
    const key = normalizeMatchKey(name);
    if (!key) continue;
    if (key === target) best = Math.max(best, 10);
    else if (key.includes(target) || target.includes(key)) best = Math.max(best, 6);
  }
  return best;
}

function regionItemMatchScore(item, region) {
  if (!item || !region) return 0;
  let best = 0;
  for (const name of region.searchNames || []) best = Math.max(best, matchNameScore(item, name));
  return best;
}

function getRegionZoneWeightsForItem(item, zones, forbiddenIds) {
  const forb = forbiddenIds instanceof Set ? forbiddenIds : new Set();
  const zoneIds = Array.isArray(zones) && zones.length
    ? zones.map((z) => canonicalZoneId(z?.zoneId || z?.id || z?.name)).filter(Boolean)
    : LUMIA_REGION_DATA.map((z) => z.zoneId);
  const out = new Map();
  for (const zoneId0 of zoneIds) {
    const zoneId = canonicalZoneId(zoneId0);
    if (!zoneId || forb.has(zoneId)) continue;
    const region = getRegionData(zoneId);
    if (!region) continue;
    const score = regionItemMatchScore(item, region);
    if (score <= 0) continue;
    const resourceBonus = Object.entries(region.resources || {}).reduce((sum, [name, count]) => {
      return sum + (matchNameScore(item, name) > 0 ? Math.min(5, Number(count || 0)) : 0);
    }, 0);
    out.set(zoneId, score + resourceBonus);
  }
  return out;
}

function listRegionLootCandidates(zoneId, publicItems, opts = {}) {
  const region = getRegionData(zoneId);
  if (!region) return [];
  const list = Array.isArray(publicItems) ? publicItems : [];
  const goalItemIds = new Set((Array.isArray(opts.goalItemIds) ? opts.goalItemIds : []).map(String));
  const routeItemIds = new Set((Array.isArray(opts.routeItemIds) ? opts.routeItemIds : []).map(String));
  const filterItem = typeof opts.filterItem === 'function' ? opts.filterItem : null;
  return list
    .map((item) => {
      if (!item?._id) return null;
      if (isItemExcludedFromFieldFarming(item)) return null;
      if (filterItem && !filterItem(item)) return null;
      const score = regionItemMatchScore(item, region);
      if (score <= 0) return null;
      const itemId = String(item._id);
      let weight = score;
      if (goalItemIds.has(itemId)) weight += Number(opts.goalWeight ?? 12);
      if (routeItemIds.has(itemId)) weight += Number(opts.routeWeight ?? 10);
      return { item, itemId, weight: Math.max(0.1, weight), minQty: 1, maxQty: Number(opts.maxQty || 1) };
    })
    .filter(Boolean);
}

function pickRegionLootDrop(zoneId, publicItems, opts = {}) {
  const candidates = listRegionLootCandidates(zoneId, publicItems, opts);
  const picked = pickWeighted(candidates);
  if (!picked?.itemId) return null;
  return {
    item: picked.item,
    itemId: String(picked.itemId),
    qty: Math.max(1, Number(picked.minQty || 1)),
    crateId: 'lumia_region',
    crateType: opts.crateType || 'region_loot',
    zoneId: canonicalZoneId(zoneId),
  };
}

function getRegionWildlifeSpeciesList(zoneId) {
  const region = getRegionData(zoneId);
  const out = [];
  for (const [name, rawCount] of Object.entries(region?.wildlife || {})) {
    const key = WILDLIFE_NAME_TO_KEY[name] || '';
    const count = Math.max(0, Math.floor(Number(rawCount || 0)));
    for (let i = 0; key && i < count; i += 1) out.push(key);
  }
  return out;
}

function getRegionWildlifeCount(zoneId) {
  return getRegionWildlifeSpeciesList(zoneId).length;
}

function getRegionFacilityZoneIds(facilityKey, zones) {
  const key = String(facilityKey || '').trim();
  const zoneIds = Array.isArray(zones) && zones.length
    ? zones.map((z) => canonicalZoneId(z?.zoneId || z?.name)).filter(Boolean)
    : LUMIA_REGION_DATA.map((z) => z.zoneId);
  return [...new Set(zoneIds.filter((zoneId) => Boolean(getRegionData(zoneId)?.[key])))];
}

function applyRegionDataToZones(zones) {
  return (Array.isArray(zones) ? zones : []).map((zone) => {
    const zoneId = canonicalZoneId(zone?.zoneId || zone?.name);
    const region = getRegionData(zoneId);
    if (!region) return zone;
    const area = getLumiaZoneArea(zoneId);
    const areaWeight = getLumiaZoneAreaWeight(zoneId);
    return {
      ...zone,
      name: zone?.name || region.name,
      hasKiosk: Boolean(zone?.hasKiosk || region.kiosk),
      hasCampfire: Boolean(zone?.hasCampfire || region.campfire),
      hasHyperloop: Boolean(zone?.hasHyperloop || region.hyperloop),
      area: Number(zone?.area || 0) > 0 ? Number(zone.area) : area,
      areaWeight: Number(zone?.areaWeight || 0) > 0 ? Number(zone.areaWeight) : areaWeight,
    };
  });
}

function getRegionHotspotWeight(zoneId) {
  const count = getRegionWildlifeCount(zoneId);
  return count > 0 ? Math.max(0.8, Math.min(3.2, 0.75 + count / 5)) : 0.8;
}

export {
  LUMIA_REGION_DATA,
  applyRegionDataToZones,
  canonicalZoneId,
  getRegionData,
  getRegionFacilityZoneIds,
  getRegionHotspotWeight,
  getRegionWildlifeCount,
  getRegionWildlifeSpeciesList,
  getRegionZoneWeightsForItem,
  getZoneRegionData,
  listRegionLootCandidates,
  pickRegionLootDrop,
};
