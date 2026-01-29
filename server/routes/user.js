// server/routes/user.js
const express = require('express');
const router = express.Router();

const User = require('../models/User');

/**
 * ✅ 내 계정 정보
 * GET /api/user/me
 * - index.js에서 verifyToken을 걸어주므로 여기서는 req.user 사용 가능
 */
router.get('/me', async (req, res) => {
  try {
    const user = await User.findById(req.user.id, 'username lp credits statistics isAdmin badges createdAt');
    if (!user) return res.status(404).json({ error: '유저를 찾을 수 없습니다.' });
    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '유저 조회 실패' });
  }
});

/**
 * ✅ 시뮬레이션 종료 보상/전적 반영
 * POST /api/user/update-stats
 * body: { kills:number, isWin:boolean, lpEarned:number, creditsEarned?:number }
 *
 * - user.statistics: 누적 전적(유저 기준)
 * - user.lp: 레거시 포인트(특전 구매 재화)
 * - user.credits: 게임 재화(로드맵 5번)
 */
router.post('/update-stats', async (req, res) => {
  try {
    const kills = Number(req.body?.kills || 0);
    const isWin = Boolean(req.body?.isWin);
    const lpEarned = Number(req.body?.lpEarned || 0);
    const creditsEarned = Number(req.body?.creditsEarned || 0);

    const update = {
      $inc: {
        lp: lpEarned,
        credits: creditsEarned,
        'statistics.totalGames': 1,
        'statistics.totalKills': kills,
        'statistics.totalWins': isWin ? 1 : 0
      }
    };

    const user = await User.findByIdAndUpdate(req.user.id, update, { new: true });
    if (!user) return res.status(404).json({ error: '유저를 찾을 수 없습니다.' });

    res.json({
      message: '전적/보상 반영 완료',
      newLp: user.lp,
      credits: user.credits,
      statistics: user.statistics
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '전적/보상 반영 실패' });
  }
});

module.exports = router;
