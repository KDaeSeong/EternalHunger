const mongoose = require('mongoose');

const KioskSchema = new mongoose.Schema({
  kioskId: { type: String, required: true },
  ownerUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  name: { type: String, default: 'Kiosk' },

  mapId: { type: mongoose.Schema.Types.ObjectId, ref: 'Map', required: true },
  zoneId: { type: String },

  x: { type: Number, default: 0 },
  y: { type: Number, default: 0 },

  catalog: [{
    itemId: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: true },
    mode: { type: String, enum: ['sell', 'buy', 'exchange'], default: 'sell' },
    priceCredits: { type: Number, default: 0 },
    exchange: {
      giveItemId: { type: mongoose.Schema.Types.ObjectId, ref: 'Item' },
      giveQty: { type: Number, default: 1 },
    },
  }],

  createdAt: { type: Date, default: Date.now },
});

KioskSchema.index({ ownerUserId: 1, kioskId: 1 }, { unique: true });

module.exports = mongoose.model('Kiosk', KioskSchema);
