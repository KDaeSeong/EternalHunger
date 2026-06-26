const mongoose = require('mongoose');

const PerkSchema = new mongoose.Schema({
  code: { type: String, required: true },
  ownerUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  name: { type: String, required: true },
  description: { type: String, default: '' },
  lpCost: { type: Number, default: 0 },
  category: { type: String, default: 'cosmetic' },
  effects: { type: Object, default: {} },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

PerkSchema.index({ ownerUserId: 1, code: 1 }, { unique: true });

module.exports = mongoose.model('Perk', PerkSchema);
