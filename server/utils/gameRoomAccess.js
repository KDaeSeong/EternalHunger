const crypto = require('crypto');

function generateJoinCode() {
  return crypto.randomBytes(24).toString('base64url');
}

function hashJoinCode(value) {
  return crypto.createHash('sha256').update(String(value || '')).digest('hex');
}

function verifyJoinCode(value, expectedHash) {
  if (!value || !expectedHash) return false;
  const actual = Buffer.from(hashJoinCode(value), 'hex');
  const expected = Buffer.from(String(expectedHash), 'hex');
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

module.exports = { generateJoinCode, hashJoinCode, verifyJoinCode };
