// server/routes/user.js
const express = require('express');
const router = express.Router();
const User = require('../models/User');
const authMiddleware = require('../middleware/auth'); // 위에서 만든 문지기

// 내 전적 업데이트 (POST /api/user/update-stats)
router.post('/update-stats', authMiddleware, async (req, res) => {
  try {
    const { kills, isWin, lpEarned } = req.body;
    const userId = req.user.id; // 문지기가 확인해준 유저 ID

    // 1. 유저 검색
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: "유저를 찾을 수 없습니다." });

    // 2. 스탯 누적 (기존 값 + 새로운 값)
    user.statistics.totalGames += 1;
    user.statistics.totalKills += kills;
    if (isWin) {
      user.statistics.totalWins += 1;
      user.legacyPoints += lpEarned; // LP 지급
    }

    // 3. 저장
    await user.save();

    res.json({ 
      message: "전적 갱신 완료", 
      newLp: user.legacyPoints,
      stats: user.statistics 
    });
    
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "전적 저장 실패" });
  }
});

module.exports = router;