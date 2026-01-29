// server/models/Perk.js
const mongoose = require('mongoose');

/**
 * 🎖️ 특전(로드맵 7번)
 * - lp를 소모해 영구 버프/꾸미기 해금
 */
const PerkSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true }, // 예: PERK_HP_01
  name: { type: String, required: true },
  description: { type: String, default: '' },
  lpCost: { type: Number, default: 0 },
  category: { type: String, default: 'buff' }, // buff / cosmetic 등
  effects: { type: Object, default: {} },      // 예: { hpPlus: 20 }
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('Perk', PerkSchema);
