// server/middleware/authMiddleware.js
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const {
  SESSION_COOKIE,
  parseCookies,
  tokenVersionMatches,
  validateCsrfRequest,
} = require('../utils/authPolicy');

function isSuspensionActive(user) {
  if (user?.moderationStatus !== 'suspended') return false;
  if (!user.suspendedUntil) return true;
  return new Date(user.suspendedUntil).getTime() > Date.now();
}

function isAccountDeactivated(user) {
  return user?.moderationStatus === 'deactivated';
}

function readRequestToken(req) {
  const authHeader = req.headers?.authorization || '';
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  const cookieToken = parseCookies(req)[SESSION_COOKIE] || '';
  return {
    token: bearerToken || cookieToken,
    usesCookieSession: !bearerToken && Boolean(cookieToken),
  };
}

/**
 * Resolves the session behind a request. Never throws.
 * @returns {Promise<{ ok: true, user: object, decoded: object } | { ok: false, status: number, body: object }>}
 */
async function resolveSession(req) {
  const { token, usesCookieSession } = readRequestToken(req);
  if (!token) {
    return { ok: false, status: 401, body: { error: '로그인이 필요합니다.', code: 'AUTH_REQUIRED' } };
  }
  if (usesCookieSession && !validateCsrfRequest(req)) {
    return { ok: false, status: 403, body: { error: '요청 검증 정보가 올바르지 않습니다.', code: 'CSRF_INVALID' } };
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.MY_SECRET_KEY);
  } catch (err) {
    const expired = err?.name === 'TokenExpiredError';
    return {
      ok: false,
      status: 401,
      body: {
        error: expired ? '로그인 시간이 만료되었습니다.' : '유효하지 않은 토큰입니다.',
        code: expired ? 'AUTH_TOKEN_EXPIRED' : 'AUTH_TOKEN_INVALID',
      },
    };
  }

  let user;
  try {
    user = await User.findById(decoded.id)
      .select('_id isAdmin moderationStatus moderationReason suspendedUntil tokenVersion')
      .lean();
  } catch {
    return { ok: false, status: 401, body: { error: '유효하지 않은 토큰입니다.', code: 'AUTH_TOKEN_INVALID' } };
  }

  if (!user) {
    return { ok: false, status: 401, body: { error: '사용자를 찾을 수 없습니다.', code: 'AUTH_USER_NOT_FOUND' } };
  }
  // A password change or reset raises tokenVersion; older tokens stop working.
  if (!tokenVersionMatches(decoded, user)) {
    return {
      ok: false,
      status: 401,
      body: { error: '로그인 정보가 변경되어 다시 로그인해야 합니다.', code: 'AUTH_TOKEN_INVALID' },
    };
  }
  if (isAccountDeactivated(user)) {
    return { ok: false, status: 403, body: { error: '탈퇴한 계정입니다.', moderationStatus: 'deactivated' } };
  }
  if (isSuspensionActive(user)) {
    return {
      ok: false,
      status: 403,
      body: {
        error: '정지된 계정입니다.',
        moderationStatus: user.moderationStatus,
        moderationReason: user.moderationReason || '',
        suspendedUntil: user.suspendedUntil || null,
      },
    };
  }
  return { ok: true, user, decoded };
}

function attachUser(req, session) {
  req.user = { ...session.decoded, id: String(session.user._id), isAdmin: Boolean(session.user.isAdmin) };
}

const verifyToken = async (req, res, next) => {
  const session = await resolveSession(req);
  if (!session.ok) return res.status(session.status).json(session.body);
  attachUser(req, session);
  return next();
};

// Public routes: identify a signed-in viewer when possible, otherwise continue
// anonymously. `req.authResolved` tells requestScope not to re-decode tokens
// that this middleware already rejected (expired, revoked, suspended...).
const optionalAuth = async (req, res, next) => {
  req.authResolved = true;
  const { token } = readRequestToken(req);
  if (!token) return next();
  const session = await resolveSession(req);
  if (session.ok) attachUser(req, session);
  return next();
};

const verifyAdmin = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select('isAdmin').lean();
    if (user?.isAdmin) return next();
    return res.status(403).json({ error: '관리자 권한이 없습니다.' });
  } catch (err) {
    return res.status(500).json({ error: '서버 인증 오류' });
  }
};

module.exports = { optionalAuth, resolveSession, verifyAdmin, verifyToken };
