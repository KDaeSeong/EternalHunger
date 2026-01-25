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
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Map', MapSchema);