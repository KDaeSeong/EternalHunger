// server/routes/auth.js
const express = require('express');
const router = express.Router();
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { normalizeRecoveryCode } = require('../utils/recoveryCode');

const resetPasswordBuckets = new Map();
const RESET_PASSWORD_WINDOW_MS = toPositiveInt(process.env.RESET_PASSWORD_WINDOW_MS, 10 * 60 * 1000);
const RESET_PASSWORD_MAX_ATTEMPTS = toPositiveInt(process.env.RESET_PASSWORD_MAX_ATTEMPTS, 8);

function toPositiveInt(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

function normalizeNickname(raw) {
  return String(raw || '').trim().replace(/\s+/g, ' ');
}

function isSuspensionActive(user) {
  if (user?.moderationStatus !== 'suspended') return false;
  if (!user.suspendedUntil) return true;
  return new Date(user.suspendedUntil).getTime() > Date.now();
}

function isAccountDeactivated(user) {
  return user?.moderationStatus === 'deactivated';
}

function pruneResetPasswordBuckets(now) {
  if (resetPasswordBuckets.size < 500) return;
  for (const [key, bucket] of resetPasswordBuckets.entries()) {
    if (!bucket || bucket.resetAt <= now) resetPasswordBuckets.delete(key);
  }
}

function checkResetPasswordRate(req, username) {
  const now = Date.now();
  const key = `${String(username || '').toLowerCase()}:${req.ip || 'unknown'}`;
  let bucket = resetPasswordBuckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + RESET_PASSWORD_WINDOW_MS };
    resetPasswordBuckets.set(key, bucket);
  }
  pruneResetPasswordBuckets(now);
  if (bucket.count >= RESET_PASSWORD_MAX_ATTEMPTS) {
    return {
      allowed: false,
      retryAfterSec: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    };
  }
  bucket.count += 1;
  return { allowed: true, retryAfterSec: 0 };
}

function publicUser(user) {
  return {
    id: user._id,
    _id: user._id,
    username: user.username,
    nickname: user.nickname || '',
    profileBio: user.profileBio || '',
    lp: Number(user.lp || 0),
    credits: Number(user.credits || 0),
    perks: Array.isArray(user.perks) ? user.perks : [],
    isAdmin: Boolean(user.isAdmin),
    moderationStatus: user.moderationStatus || 'active',
    moderationReason: user.moderationReason || '',
    suspendedUntil: user.suspendedUntil || null,
    recoveryCodeCreatedAt: user.passwordRecovery?.codeHash ? user.passwordRecovery?.codeCreatedAt || null : null,
  };
}

router.post('/signup', async (req, res) => {
  try {
    const { username, password } = req.body;
    const nickname = normalizeNickname(req.body?.nickname);
    const acceptTerms = req.body?.acceptTerms === true || req.body?.acceptTerms === 'true';
    const acceptPrivacy = req.body?.acceptPrivacy === true || req.body?.acceptPrivacy === 'true';
    if (nickname && (nickname.length < 2 || nickname.length > 20)) {
      return res.status(400).json({ error: '닉네임은 2~20자로 입력해주세요.' });
    }

    if (!acceptTerms || !acceptPrivacy) {
      return res.status(400).json({ error: '이용약관과 개인정보 처리방침에 동의해주세요.' });
    }

    const acceptedAt = new Date();
    const user = new User({
      username,
      password,
      nickname,
      agreements: {
        termsAcceptedAt: acceptedAt,
        privacyAcceptedAt: acceptedAt,
        termsVersion: '2026-07-04',
        privacyVersion: '2026-07-04',
      },
    });
    await user.save();
    res.status(201).json({ message: '회원가입 성공' });
  } catch (err) {
    console.error(err);
    if (err.code === 11000) {
      return res.status(400).json({ error: '이미 존재하는 아이디입니다.' });
    }
    res.status(400).json({ error: `회원가입 실패: ${err.message}` });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    const user = await User.findOne({ username });
    if (!user) return res.status(401).json({ error: '존재하지 않는 아이디입니다.' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ error: '비밀번호가 일치하지 않습니다.' });
    if (isAccountDeactivated(user)) {
      return res.status(403).json({
        error: '탈퇴한 계정입니다.',
        moderationStatus: 'deactivated',
      });
    }
    if (isSuspensionActive(user)) {
      return res.status(403).json({
        error: '정지된 계정입니다.',
        moderationStatus: user.moderationStatus,
        moderationReason: user.moderationReason || '',
        suspendedUntil: user.suspendedUntil || null,
      });
    }

    const token = jwt.sign({ id: user._id }, process.env.MY_SECRET_KEY, { expiresIn: '1d' });
    res.json({ token, user: publicUser(user) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '로그인 실패' });
  }
});

router.post('/reset-password', async (req, res) => {
  const invalidRecoveryMessage = '아이디 또는 복구 코드가 올바르지 않습니다.';

  try {
    const username = String(req.body?.username || '').trim();
    const recoveryCode = normalizeRecoveryCode(req.body?.recoveryCode);
    const newPassword = String(req.body?.newPassword || '');

    if (!username || !recoveryCode || !newPassword) {
      return res.status(400).json({ error: '아이디, 복구 코드, 새 비밀번호를 모두 입력해주세요.' });
    }
    if (recoveryCode.length < 16) {
      return res.status(401).json({ error: invalidRecoveryMessage });
    }
    if (newPassword.length < 6 || newPassword.length > 72) {
      return res.status(400).json({ error: '새 비밀번호는 6~72자로 입력해주세요.' });
    }

    const rate = checkResetPasswordRate(req, username);
    if (!rate.allowed) {
      res.set('Retry-After', String(rate.retryAfterSec));
      return res.status(429).json({
        error: `비밀번호 재설정 시도가 너무 잦습니다. ${rate.retryAfterSec}초 후 다시 시도해주세요.`,
        retryAfterSec: rate.retryAfterSec,
      });
    }

    const user = await User.findOne({ username });
    const codeHash = user?.passwordRecovery?.codeHash || '';
    if (!user || isAccountDeactivated(user) || !codeHash) {
      return res.status(401).json({ error: invalidRecoveryMessage });
    }

    const isCodeMatch = await bcrypt.compare(recoveryCode, codeHash);
    if (!isCodeMatch) {
      return res.status(401).json({ error: invalidRecoveryMessage });
    }

    const isSamePassword = await user.comparePassword(newPassword);
    if (isSamePassword) {
      return res.status(400).json({ error: '새 비밀번호는 기존 비밀번호와 달라야 합니다.' });
    }

    user.password = newPassword;
    user.passwordRecovery.codeHash = '';
    user.passwordRecovery.codeCreatedAt = null;
    user.passwordRecovery.codeUsedAt = new Date();
    await user.save();

    res.json({ message: '비밀번호를 재설정했습니다. 새 비밀번호로 로그인해주세요.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '비밀번호 재설정에 실패했습니다.' });
  }
});

module.exports = router;
