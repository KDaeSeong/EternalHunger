// server/routes/user.js
const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();

const User = require('../models/User');
const UserFollow = require('../models/UserFollow');
const { createNotification } = require('../utils/notifications');

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

function normalizeId(value) {
  if (!value) return '';
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (typeof value?.toHexString === 'function') return value.toHexString();
  if (value?._id && value._id !== value) return normalizeId(value._id);
  if (value?.id && value.id !== value) return normalizeId(value.id);
  if (typeof value?.toString === 'function') return value.toString();
  return '';
}

function isValidObjectId(value) {
  return mongoose.Types.ObjectId.isValid(String(value || ''));
}

async function getFollowState(targetUserId, viewerId) {
  const [followerCount, followingCount, existingFollow] = await Promise.all([
    UserFollow.countDocuments({ followingId: targetUserId }),
    UserFollow.countDocuments({ followerId: targetUserId }),
    viewerId && normalizeId(viewerId) !== normalizeId(targetUserId)
      ? UserFollow.exists({ followerId: viewerId, followingId: targetUserId })
      : null,
  ]);

  return {
    followerCount,
    followingCount,
    following: Boolean(existingFollow),
    isSelf: Boolean(viewerId && normalizeId(viewerId) === normalizeId(targetUserId)),
  };
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

router.put('/password', async (req, res) => {
  try {
    const currentPassword = String(req.body?.currentPassword || '');
    const newPassword = String(req.body?.newPassword || '');

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: '현재 비밀번호와 새 비밀번호를 입력해주세요.' });
    }
    if (newPassword.length < 6 || newPassword.length > 72) {
      return res.status(400).json({ error: '새 비밀번호는 6~72자로 입력해주세요.' });
    }
    if (currentPassword === newPassword) {
      return res.status(400).json({ error: '새 비밀번호는 현재 비밀번호와 달라야 합니다.' });
    }

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) return res.status(401).json({ error: '현재 비밀번호가 일치하지 않습니다.' });

    user.password = newPassword;
    await user.save();

    res.json({ message: '비밀번호를 변경했습니다.', user: publicUser(user) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '비밀번호 변경에 실패했습니다.' });
  }
});

router.post('/deactivate', async (req, res) => {
  try {
    const currentPassword = String(req.body?.currentPassword || '');
    const confirmText = String(req.body?.confirmText || '').trim();

    if (!currentPassword) {
      return res.status(400).json({ error: '현재 비밀번호를 입력해주세요.' });
    }
    if (confirmText !== '탈퇴') {
      return res.status(400).json({ error: '확인 문구에 탈퇴를 입력해주세요.' });
    }

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
    if (user.isAdmin) {
      return res.status(400).json({ error: '관리자 계정은 유저 관리 화면에서 권한을 넘긴 뒤 처리해주세요.' });
    }

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) return res.status(401).json({ error: '현재 비밀번호가 일치하지 않습니다.' });

    const now = new Date();
    const suffix = String(user._id || req.user.id);
    user.username = `deactivated_${suffix}`;
    user.nickname = '탈퇴한 사용자';
    user.profileBio = '';
    user.password = `deactivated:${suffix}:${now.getTime()}:${Math.random()}`;
    user.lp = 0;
    user.credits = 0;
    user.perks = [];
    user.badges = [];
    user.personalHistory = [];
    user.moderationStatus = 'deactivated';
    user.moderationReason = '사용자 요청으로 탈퇴 처리됨';
    user.suspendedUntil = null;
    user.moderatedBy = user._id;
    user.moderatedAt = now;
    user.deactivatedAt = now;

    await user.save();
    await UserFollow.deleteMany({
      $or: [
        { followerId: user._id },
        { followingId: user._id },
      ],
    });

    res.json({ message: '계정이 탈퇴 처리되었습니다.' });
  } catch (err) {
    console.error(err);
    if (err?.code === 11000) {
      return res.status(409).json({ error: '탈퇴 처리 중 계정 식별자 충돌이 발생했습니다. 다시 시도해주세요.' });
    }
    res.status(500).json({ error: '계정 탈퇴 처리에 실패했습니다.' });
  }
});

router.get('/follows/:targetUserId', async (req, res) => {
  try {
    const targetUserId = String(req.params.targetUserId || '');
    if (!isValidObjectId(targetUserId)) {
      return res.status(400).json({ error: '사용자 ID가 올바르지 않습니다.' });
    }

    const target = await User.findById(targetUserId).select('_id').lean();
    if (!target) return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });

    res.json(await getFollowState(target._id, req.user.id));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '팔로우 상태를 확인하지 못했습니다.' });
  }
});

router.post('/follows/:targetUserId', async (req, res) => {
  try {
    const targetUserId = String(req.params.targetUserId || '');
    if (!isValidObjectId(targetUserId)) {
      return res.status(400).json({ error: '사용자 ID가 올바르지 않습니다.' });
    }
    if (normalizeId(targetUserId) === normalizeId(req.user.id)) {
      return res.status(400).json({ error: '자기 자신은 팔로우할 수 없습니다.' });
    }

    const target = await User.findById(targetUserId).select('_id username nickname').lean();
    if (!target) return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });

    try {
      await UserFollow.create({ followerId: req.user.id, followingId: target._id });
      await createNotification({
        userId: target._id,
        actorId: req.user.id,
        type: 'user_follow',
        title: '새 팔로워',
        message: '새 사용자가 회원님을 팔로우했습니다.',
        link: `/users/${req.user.id}`,
        meta: { followerId: normalizeId(req.user.id) },
      });
    } catch (err) {
      if (err?.code !== 11000) throw err;
    }

    res.json({
      message: '팔로우했습니다.',
      ...(await getFollowState(target._id, req.user.id)),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '팔로우에 실패했습니다.' });
  }
});

router.delete('/follows/:targetUserId', async (req, res) => {
  try {
    const targetUserId = String(req.params.targetUserId || '');
    if (!isValidObjectId(targetUserId)) {
      return res.status(400).json({ error: '사용자 ID가 올바르지 않습니다.' });
    }

    const target = await User.findById(targetUserId).select('_id').lean();
    if (!target) return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });

    await UserFollow.deleteOne({ followerId: req.user.id, followingId: target._id });
    res.json({
      message: '팔로우를 해제했습니다.',
      ...(await getFollowState(target._id, req.user.id)),
      following: false,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '팔로우 해제에 실패했습니다.' });
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
