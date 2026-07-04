const mongoose = require('mongoose');

const GameSaveSlotSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  gameSlug: { type: String, required: true, trim: true, lowercase: true, maxlength: 80, index: true },
  slotKey: { type: String, required: true, trim: true, lowercase: true, maxlength: 80 },
  saveName: { type: String, default: '저장 슬롯', trim: true, maxlength: 80 },
  version: { type: String, default: '', trim: true, maxlength: 40 },
  summary: { type: mongoose.Schema.Types.Mixed, default: {} },
  payload: { type: mongoose.Schema.Types.Mixed, default: {} },
  payloadBytes: { type: Number, default: 0 },
  lastPlayedAt: { type: Date, default: null, index: true },
}, {
  timestamps: true,
});

GameSaveSlotSchema.index({ userId: 1, gameSlug: 1, slotKey: 1 }, { unique: true });
GameSaveSlotSchema.index({ userId: 1, updatedAt: -1 });

module.exports = mongoose.model('GameSaveSlot', GameSaveSlotSchema);
