// server/routes/credits.js
const express = require('express');
const router = express.Router();

const User = require('../models/User');
const { verifyAdmin } = require('../middleware/authMiddleware');

/**
 * 💳 크레딧 시스템(로드맵 5번)
 * - 지급/소모/잔액 조회
 * - 실제 '페이즈마다 지급' 로직은 게임 진행 로직과 붙이면서 자동화하면 됩니다.
 */

// 내 크레딧 잔액
router.get('/balance', async (req, res) => {
  try {
    const user = await User.findById(req.user.id, 'credits');
    if (!user) return res.status(404).json({ error: '유저를 찾을 수 없습니다.' });
    res.json({ credits: user.credits });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '잔액 조회 실패' });
  }
});

// 크레딧 소모(예: 키오스크 구매/드론 구매)
router.post('/spend', async (req, res) => {
  try {
    const amount = Number(req.body?.amount || 0);
    if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ error: 'amount는 양수여야 합니다.' });

    const user = await User.findOneAndUpdate(
      { _id: req.user.id, credits: { $gte: amount } },
      { $inc: { credits: -amount } },
      { new: true }
    );

    if (!user) return res.status(400).json({ error: '크레딧이 부족합니다.' });
    res.json({ message: '결제 완료', credits: user.credits });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '결제 실패' });
  }
});

// ✅ (시뮬레이터용) 크레딧 획득
// - 프론트 시뮬레이터가 페이즈 진행/처치/야생동물 처치 등에 따라 적립하는 용도
// - 서버 검증(실제 전투 로그 기반 산정 등)은 이후 서버화 단계에서 강화 예정
router.post('/earn', async (req, res) => {
  try {
    const amount = Number(req.body?.amount || 0);
    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ error: 'amount는 양수여야 합니다.' });
    }

    // 과도한 적립 방지용 소프트 캡(임시)
    const capped = Math.min(amount, 100000);

    const user = await User.findOneAndUpdate(
      { _id: req.user.id },
      { $inc: { credits: capped } },
      { new: true }
    );

    if (!user) return res.status(404).json({ error: '유저를 찾을 수 없습니다.' });
    res.json({ message: '적립 완료', credits: user.credits, gained: capped });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '적립 실패' });
  }
});

// 관리자: 크레딧 지급
router.post('/grant', verifyAdmin, async (req, res) => {
  try {
    const { username, amount } = req.body || {};
    const inc = Number(amount || 0);

    if (!username) return res.status(400).json({ error: 'username이 필요합니다.' });
    if (!Number.isFinite(inc) || inc === 0) return res.status(400).json({ error: 'amount가 올바르지 않습니다.' });

    const user = await User.findOneAndUpdate(
      { username },
      { $inc: { credits: inc } },
      { new: true }
    );

    if (!user) return res.status(404).json({ error: '유저를 찾을 수 없습니다.' });
    res.json({ message: '크레딧 지급 완료', username: user.username, credits: user.credits });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '지급 실패' });
  }
});

module.exports = router;
