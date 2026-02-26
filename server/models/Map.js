// server/models/Map.js
const mongoose = require('mongoose');

const MapSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: String,
  image: String, // 배경 이미지 URL
  // ★ 동선: 연결된 다른 구역들의 ID 목록
  connectedMaps: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Map' }],
  // ★ 키오스크: 해당 구역에 배치된 상점이나 장치들
  kiosks: [{
    kioskId: String,
    x: { type: Number, default: 0 },
    y: { type: Number, default: 0 },
    kioskType: { type: String, default: 'shop' }
  }],

  // 🏪 맵당 1개 키오스크를 두고 싶을 때, "지정한 존"을 기록
  // - zoneId(문자열) 또는 zoneNo(숫자)를 문자열로 넣어도 됨(예: 'hospital' 또는 '1')
  kioskZoneId: { type: String, default: '' },

  // 🌀 하이퍼루프 장치(패드)가 설치된 맵 내부 구역(zoneId)
  // - 서버에 저장해서 "어드민에서 지정 → 모든 유저에게 동일 적용" 되도록 합니다.
  hyperloopDeviceZoneId: { type: String, default: '' },

  // 🔥 모닥불(요리) 가능 구역(zoneId 배열)
  // - 관전형 시뮬에서 '고기 → 스테이크' 자동 조리 등에 사용
  campfireZoneIds: [{ type: String }],

  // 💧 물 채집 가능 구역(zoneId 배열)
  // - 관전형 시뮬에서 '물' 아이템을 파밍할 수 있는 위치
  waterSourceZoneIds: [{ type: String }],

  // 🗺️ 맵 내부 구역(로드맵 2-1, 2-4, 6-4)
  zones: [{
    // ✅ zones를 순차번호로 관리하고 싶을 때 사용(1..N)
    zoneNo: { type: Number, default: 0 },
    zoneId: { type: String, required: true },
    name: { type: String, required: true },
    // 간단 폴리곤(캔버스 좌표계 등) — 필요하면 rect로 바꿔도 됩니다.
    polygon: [{ x: Number, y: Number }],
    isForbidden: { type: Boolean, default: false },
    // 편의 플래그(기본 구역 자동 생성 시 주입)
    hasKiosk: { type: Boolean, default: false },
    coreSpawn: { type: Boolean, default: false }
  }],

  // 🌠 자연 코어(운석/생나 등) 스폰 허용 구역(zoneId 배열)
  // - zones[*].coreSpawn를 기본으로 사용하되, 별도 튜닝/관리용으로 둡니다.
  coreSpawnZones: [{ type: String }],

  // 📦 존별 상자 스폰 허용/금지(관리자 튜닝용)
  // - 형태: { [zoneId]: [ 'food' | 'legendary_material' | 'transcend_pick', ... ] }
  // - 값은 "금지(deny) 리스트"로 동작(배열에 있으면 해당 상자 스폰 금지)
  crateAllowDeny: { type: Map, of: [String], default: {} },

  // 🧭 맵 내부 구역 동선(로드맵 2-2)
  // - 기본: 양방향(bidirectional=true)
  // - 예: { fromZoneId:'A', toZoneId:'B', bidirectional:true }
  zoneConnections: [{
    fromZoneId: { type: String, required: true },
    toZoneId: { type: String, required: true },
    bidirectional: { type: Boolean, default: true }
  }],

  // 🚫 금지구역 설정(로드맵 2-4)
  forbiddenZoneConfig: {
    // 기본 ON (레거시 기본값 false로 인해 "항상 금지구역 0"이 되는 케이스 방지)
    enabled: { type: Boolean, default: true },
    startPhase: { type: Number, default: 3 },
    damagePerTick: { type: Number, default: 5 }
  },

  // 🐾 스폰 설정(로드맵 2-5)
  spawns: {
    animals: [{ species: String, zoneId: String, weight: { type: Number, default: 1 } }],
    mutants: [{ species: String, zoneId: String, weight: { type: Number, default: 1 } }]
  },

  // 📦 아이템 상자(로드맵 2-6)
  itemCrates: [{
    crateId: String,
    zoneId: String,
    x: { type: Number, default: 0 },
    y: { type: Number, default: 0 },
    // 간단 룻 테이블: weight가 높을수록 잘 나옵니다.
    lootTable: [{ itemId: { type: mongoose.Schema.Types.ObjectId, ref: 'Item' }, weight: Number, minQty: Number, maxQty: Number }]
  }],
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Map', MapSchema);
