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
  image: String
}, { timestamps: true });

module.exports = mongoose.model('GameEvent', EventSchema);