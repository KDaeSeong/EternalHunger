// server/routes/rankings.js
const express = require('express');
const router = express.Router();
const User = require('../models/User');

router.get('/', async (req, res) => {
  try {
    // 1. 최다 우승자 (Top 3)
    // statistics.totalWins 내림차순 정렬
    const wins = await User.find({}, 'username statistics legacyPoints')
                           .sort({ 'statistics.totalWins': -1 })
                           .limit(3);

    // 2. 최다 킬 (Top 3)
    // statistics.totalKills 내림차순 정렬
    const kills = await User.find({}, 'username statistics legacyPoints')
                            .sort({ 'statistics.totalKills': -1 })
                            .limit(3);

    // 3. 레전드 포인트 (Top 3)
    // legacyPoints 내림차순 정렬
    const points = await User.find({}, 'username statistics legacyPoints')
                             .sort({ lp: -1 })
                             .limit(3);

    res.json({ wins, kills, points });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "랭킹 로드 실패" });
  }
});

module.exports = router;