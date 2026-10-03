// server/routes/rankings.js
const express = require('express');
const router = express.Router();

const User = require('../models/User');
const Character = require('../models/Characters');
const { publicDisplayName } = require('../utils/publicIdentity');

const RANKED_USER_FILTER = {
  moderationStatus: { $ne: 'deactivated' },
  $or: [{ lp: { $gt: 0 } }, { 'statistics.totalGames': { $gt: 0 } }],
};

/**
 * ✅ 랭킹 (Top 3)
 * - wins : 캐릭터 기준 총 우승
 * - kills: 캐릭터 기준 총 킬
 * - points: 유저 기준 LP(레거시 포인트)
 *
 * NOTE:
 * - 메인 화면에서 비로그인으로도 볼 수 있게 '공개 API'로 유지합니다.
 */
router.get('/', async (req, res) => {
  try {
    const wins = await Character.find({}, 'name previewImage records.totalWins')
      .sort({ 'records.totalWins': -1 })
      .limit(3);

    const kills = await Character.find({}, 'name previewImage records.totalKills')
      .sort({ 'records.totalKills': -1 })
      .limit(3);

    const pointRows = await User.find(RANKED_USER_FILTER, 'nickname lp')
      .sort({ lp: -1 })
      .limit(3)
      .lean();
    // 로그인 아이디(username)는 공개 응답에 넣지 않습니다.
    const points = pointRows.map((row) => ({
      _id: row._id,
      nickname: row.nickname || '',
      displayName: publicDisplayName(row),
      lp: Number(row.lp || 0),
    }));

    res.json({ wins, kills, points });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '랭킹 로드 실패' });
  }
});

module.exports = router;
