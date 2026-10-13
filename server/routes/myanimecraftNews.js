const express = require('express');
const { verifyToken } = require('../middleware/authMiddleware');
const { createNewsService } = require('../utils/myanimecraftNewsService');
const { MAX_BYTES } = require('../utils/myanimecraftNewsFacts');

function createNewsRouter({ authenticate = verifyToken, service = createNewsService() } = {}) {
  const router = express.Router();
  router.use(authenticate);
  router.post('/generate', async (req, res) => {
    res.set('Cache-Control', 'no-store');
    try {
      if (Buffer.byteLength(JSON.stringify(req.body ?? null)) > MAX_BYTES) return res.status(413).json({ error: '기사 자료가 너무 큽니다.' });
      const result = await service.generate(String(req.user?.id || ''), req.body?.snapshot);
      return res.json(result);
    } catch (error) {
      return res.status(error.status === 400 || error.status === 413 || error.status === 401 ? error.status : 503)
        .json({ error: error.status === 400 ? '기사 자료를 확인할 수 없습니다.' : '온라인 편집을 이용할 수 없습니다. 저장된 기사는 유지됩니다.' });
    }
  });
  return router;
}
module.exports = createNewsRouter();
module.exports.createNewsRouter = createNewsRouter;
