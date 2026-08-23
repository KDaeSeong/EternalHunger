const crypto = require('crypto');
const mongoose = require('mongoose');
const RateLimitBucket = require('../models/RateLimitBucket');

function positiveInt(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : fallback;
}

function requestSubject(req, discriminator = '') {
  const ip = req?.ip || req?.socket?.remoteAddress || 'unknown';
  return `${ip}:${String(discriminator || '').trim().toLowerCase()}`;
}

async function incrementBucket(filter, update, options) {
  try {
    return await RateLimitBucket.findOneAndUpdate(filter, update, options).lean();
  } catch (error) {
    if (error?.code !== 11000) throw error;
    return RateLimitBucket.findOneAndUpdate(filter, { $inc: { count: 1 } }, { new: true }).lean();
  }
}

async function consumeRateLimit({ scope, subject, limit, windowMs, now = Date.now() }) {
  if (mongoose.connection.readyState !== 1) {
    const error = new Error('rate limit store is unavailable');
    error.code = 'RATE_LIMIT_UNAVAILABLE';
    throw error;
  }
  const safeLimit = positiveInt(limit, 10);
  const safeWindowMs = positiveInt(windowMs, 10 * 60 * 1000);
  const windowStartedAtMs = Math.floor(now / safeWindowMs) * safeWindowMs;
  const rawKey = `${scope}:${subject}:${windowStartedAtMs}`;
  const key = crypto.createHash('sha256').update(rawKey).digest('hex');
  const expiresAt = new Date(windowStartedAtMs + (safeWindowMs * 2));
  const row = await incrementBucket(
    { key },
    {
      $inc: { count: 1 },
      $setOnInsert: {
        scope,
        windowStartedAt: new Date(windowStartedAtMs),
        expiresAt,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  const resetAtMs = windowStartedAtMs + safeWindowMs;
  return {
    allowed: Number(row?.count || 0) <= safeLimit,
    remaining: Math.max(0, safeLimit - Number(row?.count || 0)),
    retryAfterSec: Math.max(1, Math.ceil((resetAtMs - now) / 1000)),
  };
}

module.exports = { consumeRateLimit, positiveInt, requestSubject };
