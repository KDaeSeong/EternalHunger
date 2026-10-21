const mongoose = require('mongoose');

const RUN_IDENTITY_INDEX_KEYS = { userId: 1, gameSlug: 1, clientRunId: 1 };
const RUN_IDENTITY_INDEX_OPTIONS = {
  name: 'userId_1_gameSlug_1_clientRunId_1',
  unique: true,
  partialFilterExpression: { clientRunId: { $type: 'string', $gt: '' } },
};
let runIdentityIndexPromise = null;

const GamePlayRecordSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  gameSlug: { type: String, required: true, trim: true, lowercase: true, maxlength: 80, index: true },
  clientRunId: { type: String, trim: true, maxlength: 160 },
  title: { type: String, default: '플레이 기록', trim: true, maxlength: 120 },
  mode: { type: String, default: '', trim: true, maxlength: 80 },
  result: { type: String, enum: ['win', 'loss', 'draw', 'clear', 'fail', 'none'], default: 'none', index: true },
  score: { type: Number, default: 0, index: true },
  playTimeSec: { type: Number, default: 0 },
  summary: { type: mongoose.Schema.Types.Mixed, default: {} },
  payload: { type: mongoose.Schema.Types.Mixed, default: {} },
  payloadBytes: { type: Number, default: 0 },
  playedAt: { type: Date, default: Date.now, index: true },
}, {
  timestamps: true,
});

GamePlayRecordSchema.index({ userId: 1, gameSlug: 1, playedAt: -1 });
GamePlayRecordSchema.index({ gameSlug: 1, score: -1, playedAt: -1 });
GamePlayRecordSchema.index(RUN_IDENTITY_INDEX_KEYS, RUN_IDENTITY_INDEX_OPTIONS);

GamePlayRecordSchema.statics.ensureRunIdentityIndex = function ensureRunIdentityIndex() {
  if (!runIdentityIndexPromise) {
    runIdentityIndexPromise = this.collection.createIndex(RUN_IDENTITY_INDEX_KEYS, {
      ...RUN_IDENTITY_INDEX_OPTIONS,
      partialFilterExpression: {
        clientRunId: { ...RUN_IDENTITY_INDEX_OPTIONS.partialFilterExpression.clientRunId },
      },
    }).catch((error) => {
      runIdentityIndexPromise = null;
      throw error;
    });
  }
  return runIdentityIndexPromise;
};

module.exports = mongoose.model('GamePlayRecord', GamePlayRecordSchema);
