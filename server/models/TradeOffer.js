// server/models/TradeOffer.js
// 🔁 아이템 교환(로드맵 1-3)

const mongoose = require('mongoose');

const TradeOfferSchema = new mongoose.Schema({
  fromUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  fromCharacterId: { type: mongoose.Schema.Types.ObjectId, ref: 'Character', required: true },

  give: [{
    itemId: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: true },
    qty: { type: Number, default: 1 }
  }],
  want: [{
    itemId: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: true },
    qty: { type: Number, default: 1 }
  }],
  wantCredits: { type: Number, default: 0 },

  note: { type: String, default: '' },

  status: { type: String, enum: ['open', 'accepted', 'cancelled'], default: 'open' },
  acceptedByUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  acceptedAt: { type: Date }
}, { timestamps: true });

module.exports = mongoose.model('TradeOffer', TradeOfferSchema);
