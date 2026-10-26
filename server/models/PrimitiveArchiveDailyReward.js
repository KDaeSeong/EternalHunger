const mongoose = require('mongoose');

const DAILY_REWARD_INDEX = { userId: 1, dayKey: 1 };
const DAILY_REWARD_INDEX_OPTIONS = {
  name: 'primitive_archive_daily_reward_user_day_unique',
  unique: true,
};
let dailyIdentityIndexPromise = null;

const PrimitiveArchiveDailyRewardSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  dayKey: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
  lp: { type: Number, min: 0, default: 0 },
  credits: { type: Number, min: 0, default: 0 },
}, { timestamps: true });

PrimitiveArchiveDailyRewardSchema.index(DAILY_REWARD_INDEX, DAILY_REWARD_INDEX_OPTIONS);

PrimitiveArchiveDailyRewardSchema.statics.ensureDailyIdentityIndex = function ensureDailyIdentityIndex() {
  if (!dailyIdentityIndexPromise) {
    dailyIdentityIndexPromise = this.collection.createIndex(DAILY_REWARD_INDEX, DAILY_REWARD_INDEX_OPTIONS)
      .catch((error) => {
        dailyIdentityIndexPromise = null;
        throw error;
      });
  }
  return dailyIdentityIndexPromise;
};

module.exports = mongoose.model('PrimitiveArchiveDailyReward', PrimitiveArchiveDailyRewardSchema);
