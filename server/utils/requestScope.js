const jwt = require('jsonwebtoken');

function normalizeId(value) {
  const id = String(value || '').trim();
  return id || null;
}

function getUserId(req) {
  return normalizeId(req?.user?.id || req?.user?._id || req?.user?.userId);
}

function getOptionalUserId(req) {
  const fromRequest = getUserId(req);
  if (fromRequest) return fromRequest;

  const raw = String(req?.headers?.authorization || '').trim();
  const token = raw.toLowerCase().startsWith('bearer ') ? raw.slice(7).trim() : raw;
  if (!token || !process.env.MY_SECRET_KEY) return null;

  try {
    const decoded = jwt.verify(token, process.env.MY_SECRET_KEY);
    return normalizeId(decoded?.id || decoded?._id || decoded?.userId);
  } catch {
    return null;
  }
}

function requireUserId(req, res) {
  const userId = getUserId(req);
  if (!userId) {
    res.status(401).json({ error: '로그인이 필요합니다.' });
    return null;
  }
  return userId;
}

function ownedFilter(reqOrUserId, extra = {}) {
  const userId = typeof reqOrUserId === 'string' ? reqOrUserId : getUserId(reqOrUserId);
  return { ...(extra || {}), ownerUserId: userId };
}

function legacyFilter(extra = {}) {
  const base = extra || {};
  const clause = {
    $or: [
      { ownerUserId: null },
      { ownerUserId: { $exists: false } },
    ],
  };
  if (base.$or || base.$and) return { $and: [base, clause] };
  return { ...base, ...clause };
}

function scopedFilter(reqOrUserId, extra = {}) {
  const userId = typeof reqOrUserId === 'string' ? reqOrUserId : getOptionalUserId(reqOrUserId);
  if (!userId) return legacyFilter(extra);
  const base = extra || {};
  const clause = {
    $or: [
      { ownerUserId: userId },
      { ownerUserId: null },
      { ownerUserId: { $exists: false } },
    ],
  };
  if (base.$or || base.$and) return { $and: [base, clause] };
  return { ...base, ...clause };
}

function withOwner(reqOrUserId, payload = {}) {
  const userId = typeof reqOrUserId === 'string' ? reqOrUserId : getUserId(reqOrUserId);
  const out = { ...(payload || {}) };
  delete out.ownerUserId;
  delete out.userId;
  out.ownerUserId = userId;
  return out;
}

async function findScoped(Model, reqOrUserId, query = {}, sort = null) {
  const q = Model.find(scopedFilter(reqOrUserId, query || {}));
  if (sort) q = q.sort(sort);
  return q;
}

module.exports = {
  getUserId,
  getOptionalUserId,
  requireUserId,
  ownedFilter,
  legacyFilter,
  scopedFilter,
  withOwner,
  findScoped,
};
