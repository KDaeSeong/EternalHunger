// server/routes/user.js
const express = require('express');
const router = express.Router();

const User = require('../models/User');

const PUBLIC_USER_SELECT = 'username nickname profileBio lp credits perks statistics isAdmin badges createdAt';

function normalizeNickname(raw) {
  return String(raw || '').trim().replace(/\s+/g, ' ');
}

function normalizeProfileBio(raw) {
  return String(raw || '')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function publicUser(user) {
  if (!user) return null;
  return {
    id: user._id,
    _id: user._id,
    username: user.username,
    nickname: user.nickname || '',
    profileBio: user.profileBio || '',
    lp: Number(user.lp || 0),
    credits: Number(user.credits || 0),
    perks: Array.isArray(user.perks) ? user.perks : [],
    statistics: user.statistics,
    isAdmin: Boolean(user.isAdmin),
    badges: Array.isArray(user.badges) ? user.badges : [],
    createdAt: user.createdAt,
  };
}

/**
 * ✅ 내 계정 정보
 * GET /api/user/me
 * - index.js에서 verifyToken을 걸어주므로 여기서는 req.user 사용 가능
 */
router.get('/me', async (req, res) => {
  try {
    const user = await User.findById(req.user.id, PUBLIC_USER_SELECT);
    if (!user) return res.status(404).json({ error: '유저를 찾을 수 없습니다.' });
    res.json(publicUser(user));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '유저 조회 실패' });
  }
});

router.put('/nickname', async (req, res) => {
  try {
    const nickname = normalizeNickname(req.body?.nickname);
    if (nickname.length < 2 || nickname.length > 20) {
      return res.status(400).json({ error: '닉네임은 2~20자로 입력해주세요.' });
    }

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $set: { nickname } },
      { new: true }
    ).select(PUBLIC_USER_SELECT);
    if (!user) return res.status(404).json({ error: '유저를 찾을 수 없습니다.' });

    res.json({ message: '닉네임을 저장했습니다.', user: publicUser(user) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '닉네임 저장 실패' });
  }
});

router.put('/profile', async (req, res) => {
  try {
    const nickname = normalizeNickname(req.body?.nickname);
    const profileBio = normalizeProfileBio(req.body?.profileBio);
    if (nickname.length < 2 || nickname.length > 20) {
      return res.status(400).json({ error: '닉네임은 2~20자로 입력해주세요.' });
    }
    if (profileBio.length > 240) {
      return res.status(400).json({ error: '소개는 240자 이내로 입력해주세요.' });
    }

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $set: { nickname, profileBio } },
      { new: true }
    ).select(PUBLIC_USER_SELECT);
    if (!user) return res.status(404).json({ error: '유저를 찾을 수 없습니다.' });

    res.json({ message: '프로필을 저장했습니다.', user: publicUser(user) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '프로필 저장에 실패했습니다.' });
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
    const rawKills = Number(req.body?.kills || 0);
    const kills = Number.isFinite(rawKills) && rawKills > 0 ? Math.floor(rawKills) : 0;
    const isWin = Boolean(req.body?.isWin);
    const rawLpEarned = Number(req.body?.lpEarned || 0);
    const lpEarned = Number.isFinite(rawLpEarned) && rawLpEarned > 0 ? Math.floor(rawLpEarned) : 0;
    const rawCreditsEarned = Number(req.body?.creditsEarned || 0);
    const creditsEarned = Number.isFinite(rawCreditsEarned) && rawCreditsEarned > 0 ? Math.floor(rawCreditsEarned) : 0;

    const update = {
      $inc: {
        lp: lpEarned,
        credits: creditsEarned,
        'statistics.totalGames': 1,
        'statistics.totalKills': kills,
        'statistics.totalWins': isWin ? 1 : 0
      }
    };

    const user = await User.findByIdAndUpdate(req.user.id, update, { new: true }).select(PUBLIC_USER_SELECT);
    if (!user) return res.status(404).json({ error: '유저를 찾을 수 없습니다.' });

    res.json({
      message: '전적/보상 반영 완료',
      newLp: user.lp,
      lpEarnedApplied: lpEarned,
      credits: user.credits,
      creditsEarnedApplied: creditsEarned,
      statistics: user.statistics,
      user: publicUser(user)
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '전적/보상 반영 실패' });
  }
});

module.exports = router;
