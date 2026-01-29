// server/models/GameEvent.js
const mongoose = require('mongoose');

const EventSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  text: String,
  type: { type: String, default: 'normal' },
  // ★ 아래 필드들이 반드시 있어야 저장이 됩니다!
  survivorCount: { type: Number, default: 1 },
  victimCount: { type: Number, default: 0 },
  timeOfDay: { type: String, default: 'both' }, // 'both', 'day', 'night'
  // 🗺️ 구역/맵 조건 (로드맵 6번·2번 연동)
  mapId: { type: mongoose.Schema.Types.ObjectId, ref: 'Map', required: false },
  zoneId: { type: String, required: false }, // 맵 내부 구역 식별자
  // ✅ 추가 조건(확장용): 예) { phaseMin:1, phaseMax:3, requiresItemTag:'heal' }
  conditions: { type: Object, default: {} },
  image: String
}, { timestamps: true });

module.exports = mongoose.model('GameEvent', EventSchema);
