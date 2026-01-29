// server/models/Kiosk.js
const mongoose = require('mongoose');

/**
 * 🏪 키오스크(로드맵 3번)
 * - 맵/구역에 배치되어 판매·교환을 담당
 * - catalog는 '판매'/'구매'/'교환' 3모드로 확장 가능
 */
const KioskSchema = new mongoose.Schema({
  kioskId: { type: String, required: true, unique: true }, // 예: KIOSK_001
  name: { type: String, default: '키오스크' },

  mapId: { type: mongoose.Schema.Types.ObjectId, ref: 'Map', required: true },
  zoneId: { type: String },

  x: { type: Number, default: 0 },
  y: { type: Number, default: 0 },

  catalog: [{
    itemId: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: true },
    mode: { type: String, enum: ['sell', 'buy', 'exchange'], default: 'sell' },

    // sell/buy 가격
    priceCredits: { type: Number, default: 0 },

    // exchange용: 'giveItemId/giveQty를 주면 itemId를 받는다' 같은 구조
    exchange: {
      giveItemId: { type: mongoose.Schema.Types.ObjectId, ref: 'Item' },
      giveQty: { type: Number, default: 1 }
    }
  }],

  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Kiosk', KioskSchema);
