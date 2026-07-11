// server/middleware/authMiddleware.js
const jwt = require('jsonwebtoken');
const User = require('../models/User');

function isSuspensionActive(user) {
  if (user?.moderationStatus !== 'suspended') return false;
  if (!user.suspendedUntil) return true;
  return new Date(user.suspendedUntil).getTime() > Date.now();
}

function isAccountDeactivated(user) {
  return user?.moderationStatus === 'deactivated';
}

const verifyToken = async (req, res, next) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';

  if (!token) {
    return res.status(401).json({
      error: '로그인이 필요합니다.',
      code: 'AUTH_REQUIRED',
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.MY_SECRET_KEY);
    const user = await User.findById(decoded.id)
      .select('_id isAdmin moderationStatus moderationReason suspendedUntil')
      .lean();

    if (!user) {
      return res.status(401).json({
        error: '사용자를 찾을 수 없습니다.',
        code: 'AUTH_USER_NOT_FOUND',
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

    req.user = { ...decoded, id: String(user._id), isAdmin: Boolean(user.isAdmin) };
    return next();
  } catch (err) {
    const expired = err?.name === 'TokenExpiredError';
    return res.status(401).json({
      error: expired ? '로그인 시간이 만료되었습니다.' : '유효하지 않은 토큰입니다.',
      code: expired ? 'AUTH_TOKEN_EXPIRED' : 'AUTH_TOKEN_INVALID',
    });
  }
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

module.exports = { verifyToken, verifyAdmin };
