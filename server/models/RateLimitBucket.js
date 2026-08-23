const mongoose = require('mongoose');

const RateLimitBucketSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true, index: true },
  scope: { type: String, required: true, index: true },
  count: { type: Number, default: 0 },
  windowStartedAt: { type: Date, required: true },
  expiresAt: { type: Date, required: true, index: { expireAfterSeconds: 0 } },
}, { versionKey: false });

module.exports = mongoose.model('RateLimitBucket', RateLimitBucketSchema);
