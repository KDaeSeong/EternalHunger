const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const { after, test } = require('node:test');
const jwt = require('jsonwebtoken');
const { getOptionalUserId, scopedFilter } = require('../utils/requestScope');

const originalSecret = process.env.MY_SECRET_KEY;
process.env.MY_SECRET_KEY = randomBytes(32).toString('hex');
after(() => {
  if (originalSecret === undefined) delete process.env.MY_SECRET_KEY;
  else process.env.MY_SECRET_KEY = originalSecret;
});
const owner = '111111111111111111111111';
const other = '222222222222222222222222';
const token = id => jwt.sign({ id }, process.env.MY_SECRET_KEY, { expiresIn: '1m' });
const cookieRequest = value => ({ headers: { cookie: `eh_csrf=unused; token=${encodeURIComponent(value)}` } });
const sharedClauses = [{ ownerUserId: null }, { ownerUserId: { $exists: false } }];

test('public simulation reads include the verified cookie owner and shared data', () => {
  const request = cookieRequest(token(owner));
  assert.equal(getOptionalUserId(request), owner);
  assert.deepEqual(scopedFilter(request), { $or: [{ ownerUserId: owner }, ...sharedClauses] });
  assert.deepEqual(scopedFilter(request, { isActive: true }),
    { isActive: true, $or: [{ ownerUserId: owner }, ...sharedClauses] });
});

test('verified request identity and explicit legacy authorization retain precedence', () => {
  const request = cookieRequest(token(other));
  assert.equal(getOptionalUserId({ ...request, user: { id: owner } }), owner);
  for (const authorization of [`Bearer ${token(owner)}`, `bearer ${token(owner)}`, token(owner)]) {
    assert.equal(getOptionalUserId({ headers: { ...request.headers, authorization } }), owner);
  }
  assert.equal(getOptionalUserId({ headers: { ...request.headers, authorization: 'Bearer invalid' } }), null,
    'An invalid explicit identity must not silently fall back to a different cookie identity.');
});

test('missing, malformed, expired and forged cookies cannot include account-owned data', () => {
  const expired = jwt.sign({ id: owner }, process.env.MY_SECRET_KEY, { expiresIn: -1 });
  const forged = jwt.sign({ id: other }, randomBytes(32).toString('hex'));
  for (const request of [{}, { headers: {} }, cookieRequest(''), cookieRequest('not-a-jwt'),
    { headers: { cookie: 'token=%zz' } }, cookieRequest(expired), cookieRequest(forged)]) {
    assert.equal(getOptionalUserId(request), null);
    assert.deepEqual(scopedFilter(request), { $or: sharedClauses });
  }
});

test('cookie-scoped reads preserve existing query boolean clauses without replacing the owner filter', () => {
  const query = { $or: [{ tier: 4 }, { tier: 5 }] };
  assert.deepEqual(scopedFilter(cookieRequest(token(owner)), query),
    { $and: [query, { $or: [{ ownerUserId: owner }, ...sharedClauses] }] });
});

test('the actual simulation catalog projection includes authored consumable and equipment effects', () => {
  const { PUBLIC_ITEM_SELECT } = require('../routes/publicModules/shared');
  const fields = new Set(PUBLIC_ITEM_SELECT.split(/\s+/));
  for (const field of ['recipe', 'consumeEffect', 'equipmentEffects']) assert.ok(fields.has(field), field);
});
