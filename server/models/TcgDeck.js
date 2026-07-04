const mongoose = require('mongoose');

const TcgDeckSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  gameSlug: { type: String, required: true, trim: true, lowercase: true, maxlength: 80, index: true },
  deckKey: { type: String, required: true, trim: true, lowercase: true, maxlength: 80 },
  name: { type: String, default: '스타터 덱', trim: true, maxlength: 80 },
  cardIds: [{ type: String, trim: true, maxlength: 80 }],
  active: { type: Boolean, default: false, index: true },
  summary: { type: mongoose.Schema.Types.Mixed, default: {} },
}, {
  timestamps: true,
});

TcgDeckSchema.index({ userId: 1, gameSlug: 1, deckKey: 1 }, { unique: true });
TcgDeckSchema.index({ userId: 1, gameSlug: 1, active: -1, updatedAt: -1 });

module.exports = mongoose.model('TcgDeck', TcgDeckSchema);
