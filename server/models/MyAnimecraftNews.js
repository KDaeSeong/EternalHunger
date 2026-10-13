const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  userId: { type: String, required: true }, careerId: { type: String, required: true },
  requestKey: { type: String, required: true }, status: { type: String, enum: ['pending', 'ready'], default: 'pending' },
  result: mongoose.Schema.Types.Mixed, createdAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, required: true },
}, { versionKey: false });
schema.index({ userId: 1, careerId: 1, requestKey: 1 }, { unique: true });
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
module.exports = mongoose.models.MyAnimecraftNews || mongoose.model('MyAnimecraftNews', schema);
