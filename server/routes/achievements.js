const express = require('express');
const mongoose = require('mongoose');
const { createAchievementService } = require('../utils/achievementService');
const { createAchievementTotalsLoader } = require('../utils/achievementTotals');
const { buildAchievementPayload } = require('../utils/achievementPayload');
const { publicAchievementCatalog } = require('../../shared/achievementCatalog.cjs');

const defaultModels = {
  User: require('../models/User'),
  AchievementRecord: require('../models/AchievementRecord'),
  Character: require('../models/Characters'),
  GameLog: require('../models/GameLog'),
  Post: require('../models/Post'),
  TeamRecord: require('../models/TeamRecord'),
  TwentyQuestionsRoom: require('../models/TwentyQuestionsRoom'),
  GamePlayRecord: require('../models/GamePlayRecord'),
  PrimitiveArchiveReward: require('../models/PrimitiveArchiveReward'),
};

function getUserId(req) {
  const raw = req.user?.id ?? req.user?._id ?? req.user?.userId;
  const value = raw?.toHexString ? raw.toHexString() : String(raw || '');
  return mongoose.Types.ObjectId.isValid(value) ? new mongoose.Types.ObjectId(value) : null;
}

function createAchievementsRouter(overrides = {}) {
  const models = { ...defaultModels, ...overrides };
  const service = createAchievementService({ ...models, loadTotals: overrides.loadTotals || createAchievementTotalsLoader(models) });
  const router = express.Router();
  const handle = (action) => async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: '로그인이 필요합니다.' });
    try {
      const snapshot = action === 'claim' ? await service.claim(userId, req.body) : await service.snapshot(userId);
      return res.json(buildAchievementPayload(snapshot));
    } catch (error) {
      const messages = {
        ACHIEVEMENT_USER_NOT_FOUND: '사용자를 찾을 수 없습니다.',
        ACHIEVEMENT_INVALID_SELECTION: '받을 업적을 올바르게 선택해주세요.',
        ACHIEVEMENT_NOT_UNLOCKED: '아직 달성하지 않은 업적입니다. 진행도를 새로고침해주세요.',
        ACHIEVEMENT_CLAIM_CONFLICT: '보상 수령 상태가 바뀌었습니다. 새로고침 후 다시 확인해주세요.',
      };
      if (!error.status) console.error('Achievement request failed:', error);
      return res.status(error.status || 503).json({ error: messages[error.code]
        || '업적을 처리하지 못했습니다. 잠시 후 다시 시도해주세요. 보상은 중복 지급되지 않습니다.' });
    }
  };
  router.get('/', handle('snapshot'));
  router.post('/claim', handle('claim'));
  return router;
}

module.exports = createAchievementsRouter();
module.exports.createAchievementsRouter = createAchievementsRouter;
module.exports.publicCatalog = (_req, res) => res.json(publicAchievementCatalog());
