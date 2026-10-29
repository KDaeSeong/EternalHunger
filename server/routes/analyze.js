const express = require('express');

const router = express.Router();
function retiredAnalysis(req, res) {
  return res.status(410).json({
    error: 'AI 캐릭터 자동 작성 기능은 종료되었습니다. 캐릭터 편집에서 직접 작성해주세요.',
    code: 'AI_FEATURE_RETIRED',
  });
}

router.post('/', retiredAnalysis);
router.post('/character-setup', retiredAnalysis);

module.exports = router;
