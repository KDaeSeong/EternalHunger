const mongoose = require('mongoose');

// The deterministic primary key makes each account/achievement identity unique
// before optional secondary indexes have finished building.
const AchievementRecordSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  achievementId: { type: String, required: true, maxlength: 100 },
  catalogVersion: { type: String, required: true },
  unlockedAt: { type: Date, required: true },
  unlockValue: { type: Number, required: true, min: 0 },
  points: { type: Number, required: true, min: 0 },
  rewardLp: { type: Number, required: true, min: 0 },
  rewardCredits: { type: Number, required: true, min: 0 },
  claimedAt: { type: Date, default: null },
  awardedLp: { type: Number, default: 0, min: 0 },
  awardedCredits: { type: Number, default: 0, min: 0 },
}, { timestamps: true });

AchievementRecordSchema.index({ userId: 1, claimedAt: 1 });

module.exports = mongoose.model('AchievementRecord', AchievementRecordSchema);
