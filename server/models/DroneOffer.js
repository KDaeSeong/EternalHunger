// server/models/DroneOffer.js
const mongoose = require('mongoose');

/**
 * 🚁 전송 드론 판매 목록(로드맵 4번)
 * - 하급 아이템 위주로 고정 판매(혹은 페이즈별 로테이션)
 */
const DroneOfferSchema = new mongoose.Schema({
  ownerUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  itemId: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: true },
  priceCredits: { type: Number, default: 0 },
  maxTier: { type: Number, default: 1 }, // 예: tier<=1만 허용
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('DroneOffer', DroneOfferSchema);
