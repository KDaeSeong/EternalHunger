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

  // 🗺️ 맵 내부 구역(로드맵 2-1, 2-4, 6-4)
  zones: [{
    zoneId: { type: String, required: true },
    name: { type: String, required: true },
    // 간단 폴리곤(캔버스 좌표계 등) — 필요하면 rect로 바꿔도 됩니다.
    polygon: [{ x: Number, y: Number }],
    isForbidden: { type: Boolean, default: false }
  }],

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
    enabled: { type: Boolean, default: false },
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
