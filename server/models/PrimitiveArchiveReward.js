const mongoose = require('mongoose');

const RUN_REWARD_INDEX = { userId: 1, gameSlug: 1, runId: 1 };
const RUN_REWARD_INDEX_OPTIONS = {
  name: 'primitive_archive_reward_user_game_run_unique',
  unique: true,
};
let rewardIdentityIndexPromise = null;

const PrimitiveArchiveRewardSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  gameSlug: { type: String, required: true, trim: true, lowercase: true },
  runId: { type: String, required: true, trim: true, maxlength: 160 },
  status: { type: String, enum: ['ineligible', 'daily_limit', 'awarded'], required: true },
  tier: { type: String, enum: ['basic', 'full', null], default: null },
  lp: { type: Number, min: 0, default: 0 },
  credits: { type: Number, min: 0, default: 0 },
  awardedDayKey: { type: String, default: '' },
  awardedAt: { type: Date, default: null },
}, { timestamps: true });

PrimitiveArchiveRewardSchema.index(RUN_REWARD_INDEX, RUN_REWARD_INDEX_OPTIONS);

PrimitiveArchiveRewardSchema.statics.ensureRewardIdentityIndex = function ensureRewardIdentityIndex() {
  if (!rewardIdentityIndexPromise) {
    rewardIdentityIndexPromise = this.collection.createIndex(RUN_REWARD_INDEX, RUN_REWARD_INDEX_OPTIONS)
      .catch((error) => {
        rewardIdentityIndexPromise = null;
        throw error;
      });
  }
  return rewardIdentityIndexPromise;
};

module.exports = mongoose.model('PrimitiveArchiveReward', PrimitiveArchiveRewardSchema);
