const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { verifyToken } = require('../middleware/authMiddleware');
const {
  clearAuthCookies,
  issueAuthCookies,
  normalizeUsername,
  validateCsrfRequest,
  validatePassword,
  validateUsername,
} = require('../utils/authPolicy');
const { consumeRateLimit, positiveInt, requestSubject } = require('../utils/rateLimit');
const { normalizeRecoveryCode } = require('../utils/recoveryCode');

const router = express.Router();
const AUTH_WINDOW_MS = positiveInt(process.env.AUTH_RATE_LIMIT_WINDOW_MS, 10 * 60 * 1000);
const LOGIN_MAX = positiveInt(process.env.LOGIN_RATE_LIMIT_MAX, 10);
const SIGNUP_MAX = positiveInt(process.env.SIGNUP_RATE_LIMIT_MAX, 5);
const RESET_MAX = positiveInt(process.env.RESET_PASSWORD_MAX_ATTEMPTS, 8);

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
    statistics: user.statistics,
    isAdmin: Boolean(user.isAdmin),
    moderationStatus: user.moderationStatus || 'active',
    moderationReason: user.moderationReason || '',
    suspendedUntil: user.suspendedUntil || null,
    recoveryCodeCreatedAt: user.passwordRecovery?.codeHash
      ? user.passwordRecovery?.codeCreatedAt || null
      : null,
  };
}

async function enforceRate(req, res, scope, discriminator, limit) {
  try {
    const rate = await consumeRateLimit({
      scope,
      subject: requestSubject(req, discriminator),
      limit,
      windowMs: AUTH_WINDOW_MS,
    });
    res.set('X-RateLimit-Remaining', String(rate.remaining));
    if (rate.allowed) return true;
    res.set('Retry-After', String(rate.retryAfterSec));
    res.status(429).json({
      error: `요청이 너무 잦습니다. ${rate.retryAfterSec}초 후 다시 시도해주세요.`,
      code: 'RATE_LIMITED',
      retryAfterSec: rate.retryAfterSec,
    });
    return false;
  } catch (error) {
    console.error('auth rate limit unavailable:', error);
    res.status(503).json({
      error: '인증 보호 서비스를 사용할 수 없습니다. 잠시 후 다시 시도해주세요.',
      code: 'RATE_LIMIT_UNAVAILABLE',
    });
    return false;
  }
}

router.post('/signup', async (req, res) => {
  const usernameCheck = validateUsername(req.body?.username);
  if (!await enforceRate(req, res, 'auth:signup', usernameCheck.username, SIGNUP_MAX)) return;
  const passwordCheck = validatePassword(req.body?.password);
  const nickname = normalizeNickname(req.body?.nickname);
  const acceptTerms = req.body?.acceptTerms === true || req.body?.acceptTerms === 'true';
  const acceptPrivacy = req.body?.acceptPrivacy === true || req.body?.acceptPrivacy === 'true';

  if (!usernameCheck.ok) {
    return res.status(400).json({ error: usernameCheck.error, code: 'USERNAME_POLICY' });
  }
  if (!passwordCheck.ok) {
    return res.status(400).json({ error: passwordCheck.error, code: 'PASSWORD_POLICY' });
  }
  if (nickname && (nickname.length < 2 || nickname.length > 20)) {
    return res.status(400).json({ error: '닉네임은 2~20자로 입력해주세요.' });
  }
  if (!acceptTerms || !acceptPrivacy) {
    return res.status(400).json({ error: '이용약관과 개인정보 처리방침에 동의해주세요.' });
  }

  try {
    const acceptedAt = new Date();
    await User.create({
      username: usernameCheck.username,
      password: passwordCheck.password,
      nickname,
      agreements: {
        termsAcceptedAt: acceptedAt,
        privacyAcceptedAt: acceptedAt,
        termsVersion: '2026-07-04',
        privacyVersion: '2026-07-04',
      },
    });
    return res.status(201).json({ message: '회원가입 성공' });
  } catch (error) {
    console.error('signup failed:', error);
    if (error?.code === 11000) {
      return res.status(409).json({ error: '이미 존재하는 아이디입니다.' });
    }
    return res.status(400).json({ error: '회원가입에 실패했습니다.' });
  }
});

router.post('/login', async (req, res) => {
  const rawUsername = String(req.body?.username || '').trim();
  const username = normalizeUsername(rawUsername);
  if (!await enforceRate(req, res, 'auth:login', username, LOGIN_MAX)) return;
  const password = String(req.body?.password || '');
  if (!rawUsername || !password) {
    return res.status(400).json({ error: '아이디와 비밀번호를 입력해주세요.' });
  }

  try {
    const candidates = [...new Set([rawUsername, username])];
    const user = await User.findOne({ username: { $in: candidates } });
    const isMatch = user ? await bcrypt.compare(password, user.password) : false;
    if (!user || !isMatch) {
      return res.status(401).json({
        error: '아이디 또는 비밀번호가 올바르지 않습니다.',
        code: 'AUTH_INVALID_CREDENTIALS',
      });
    }
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

    const token = jwt.sign(
      { id: user._id },
      process.env.MY_SECRET_KEY,
      { expiresIn: process.env.AUTH_TOKEN_TTL || '30d' },
    );
    issueAuthCookies(res, token);
    return res.json({ user: publicUser(user) });
  } catch (error) {
    console.error('login failed:', error);
    return res.status(500).json({ error: '로그인에 실패했습니다.' });
  }
});

router.get('/session', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      clearAuthCookies(res);
      return res.status(401).json({ error: '사용자를 찾을 수 없습니다.', code: 'AUTH_USER_NOT_FOUND' });
    }
    return res.json({ user: publicUser(user) });
  } catch (error) {
    console.error('session lookup failed:', error);
    return res.status(500).json({ error: '세션을 확인하지 못했습니다.' });
  }
});

router.post('/logout', (req, res) => {
  if (!validateCsrfRequest(req)) {
    return res.status(403).json({ error: '요청 검증 정보가 올바르지 않습니다.', code: 'CSRF_INVALID' });
  }
  clearAuthCookies(res);
  return res.status(204).end();
});

router.post('/reset-password', async (req, res) => {
  const invalidRecoveryMessage = '아이디 또는 복구 코드가 올바르지 않습니다.';
  const rawUsername = String(req.body?.username || '').trim();
  const username = normalizeUsername(rawUsername);
  if (!await enforceRate(req, res, 'auth:reset-password', username, RESET_MAX)) return;
  const recoveryCode = normalizeRecoveryCode(req.body?.recoveryCode);
  const passwordCheck = validatePassword(req.body?.newPassword);

  if (!rawUsername || !recoveryCode || !req.body?.newPassword) {
    return res.status(400).json({ error: '아이디, 복구 코드, 새 비밀번호를 모두 입력해주세요.' });
  }
  if (recoveryCode.length < 16) {
    return res.status(401).json({ error: invalidRecoveryMessage });
  }
  if (!passwordCheck.ok) {
    return res.status(400).json({ error: passwordCheck.error, code: 'PASSWORD_POLICY' });
  }

  try {
    const candidates = [...new Set([rawUsername, username])];
    const user = await User.findOne({ username: { $in: candidates } });
    const codeHash = user?.passwordRecovery?.codeHash || '';
    if (!user || isAccountDeactivated(user) || !codeHash) {
      return res.status(401).json({ error: invalidRecoveryMessage });
    }
    if (!await bcrypt.compare(recoveryCode, codeHash)) {
      return res.status(401).json({ error: invalidRecoveryMessage });
    }
    if (await user.comparePassword(passwordCheck.password)) {
      return res.status(400).json({ error: '새 비밀번호는 기존 비밀번호와 달라야 합니다.' });
    }

    user.password = passwordCheck.password;
    user.passwordRecovery.codeHash = '';
    user.passwordRecovery.codeCreatedAt = null;
    user.passwordRecovery.codeUsedAt = new Date();
    await user.save();
    clearAuthCookies(res);
    return res.json({ message: '비밀번호를 재설정했습니다. 새 비밀번호로 로그인해주세요.' });
  } catch (error) {
    console.error('password reset failed:', error);
    return res.status(500).json({ error: '비밀번호 재설정에 실패했습니다.' });
  }
});

module.exports = router;
