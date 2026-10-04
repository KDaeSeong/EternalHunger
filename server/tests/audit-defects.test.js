// Regression tests for the 2026-10-03 source audit (see docs/DEFECT_REGISTER.md DEF-014~).
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const { after, test } = require('node:test');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

const originalEnv = { ...process.env };
process.env.MY_SECRET_KEY = randomBytes(32).toString('hex');
after(() => {
  for (const key of ['MY_SECRET_KEY', 'PROXY_SHARED_SECRET']) {
    if (originalEnv[key] === undefined) delete process.env[key];
    else process.env[key] = originalEnv[key];
  }
});

const routeHandler = (router, method, routePath) => {
  const layer = router.stack.find((row) => row.route?.path === routePath && row.route.methods[method]);
  assert.ok(layer, `${method.toUpperCase()} ${routePath} must exist`);
  return layer.route.stack.at(-1).handle;
};
const fakeRes = () => ({
  code: 200, body: null, headers: {},
  status(code) { this.code = code; return this; },
  json(body) { this.body = body; return this; },
  set(key, value) { this.headers[key] = value; return this; },
});

test('LP is computed from fixed rules: base 50, +100 for a correct prediction, nothing for tainted or solo runs', () => {
  const { computeLpReward } = require('../utils/lpReward');
  const roster = [{ charId: 'a', teamId: 't1' }, { charId: 'b', teamId: 't1' }, { charId: 'c', teamId: 't2' }];
  assert.equal(computeLpReward({ participants: roster, winnerId: 'a' }).total, 50);
  assert.equal(computeLpReward({ participants: roster, winnerId: 'a', predictedWinnerId: 'a' }).total, 150);
  assert.equal(computeLpReward({ participants: roster, winnerId: 'a', predictedWinnerId: 'b' }).total, 150, 'teammate of the winner');
  assert.equal(computeLpReward({ participants: roster, winnerId: 'a', predictedWinnerId: 'c' }).total, 50);
  assert.equal(computeLpReward({ participants: roster, winnerId: 'a', devRunTainted: true }).total, 0);
  assert.equal(computeLpReward({ participants: roster.slice(0, 1), winnerId: 'a' }).total, 0);
  assert.equal(computeLpReward({ participants: roster, winnerId: 'zz' }).total, 0);
});

test('public names never fall back to the login ID', () => {
  const { publicDisplayName } = require('../utils/publicIdentity');
  const shared = require('../routes/publicModules/shared');
  const user = { _id: '64b0000000000000000a1b2c', username: 'eptjd6215', nickname: '' };
  assert.equal(publicDisplayName(user), '플레이어-1b2c');
  assert.equal(publicDisplayName({ ...user, nickname: '케이시스' }), '케이시스');
  for (const mapped of [shared.mapPublicUser(user), shared.mapCompactUser(user), shared.mapHubUserRank(user)]) {
    assert.equal(JSON.stringify(mapped).includes('eptjd6215'), false);
    assert.equal(mapped.displayName, '플레이어-1b2c');
  }
});

test('client address comes from the proxy only when the shared secret matches', () => {
  const { resolveClientIp } = require('../utils/clientIp');
  delete process.env.PROXY_SHARED_SECRET;
  const proxied = { ip: '10.0.0.1', headers: { 'x-eh-proxied': '1', 'x-eh-client-ip': '203.0.113.7', 'x-eh-proxy-auth': 'x'.repeat(20) } };
  assert.deepEqual(resolveClientIp(proxied), { ip: '10.0.0.1', source: 'direct', shared: true });
  process.env.PROXY_SHARED_SECRET = 'x'.repeat(20);
  assert.deepEqual(resolveClientIp(proxied), { ip: '203.0.113.7', source: 'proxy', shared: false });
  assert.equal(resolveClientIp({ ...proxied, headers: { ...proxied.headers, 'x-eh-proxy-auth': 'wrong-secret-value!!' } }).ip, '10.0.0.1');
  assert.deepEqual(resolveClientIp({ ip: '198.51.100.2', headers: {} }), { ip: '198.51.100.2', source: 'direct', shared: false });
});

test('a password change invalidates older tokens, and optional auth ignores them on public routes', async () => {
  const User = require('../models/User');
  const { optionalAuth, resolveSession } = require('../middleware/authMiddleware');
  const { getOptionalUserId } = require('../utils/requestScope');
  const id = '64b000000000000000000001';
  let stored = { _id: id, isAdmin: false, moderationStatus: 'active', tokenVersion: 1 };
  const originalFindById = User.findById;
  User.findById = () => ({ select() { return this; }, lean: async () => stored });
  try {
    const oldToken = jwt.sign({ id, tv: 0 }, process.env.MY_SECRET_KEY);
    const newToken = jwt.sign({ id, tv: 1 }, process.env.MY_SECRET_KEY);
    const bearer = (token) => ({ method: 'GET', headers: { authorization: `Bearer ${token}` } });
    assert.equal((await resolveSession(bearer(oldToken))).ok, false);
    assert.equal((await resolveSession(bearer(newToken))).ok, true);

    const revoked = { method: 'GET', headers: { cookie: `token=${oldToken}` } };
    await optionalAuth(revoked, {}, () => {});
    assert.equal(revoked.user, undefined);
    assert.equal(getOptionalUserId(revoked), null, 'a rejected cookie must not be decoded again');

    const valid = { method: 'GET', headers: { cookie: `token=${newToken}` } };
    await optionalAuth(valid, {}, () => {});
    assert.equal(getOptionalUserId(valid), id);

    stored = { ...stored, moderationStatus: 'suspended', suspendedUntil: null };
    const suspended = { method: 'GET', headers: { cookie: `token=${newToken}` } };
    await optionalAuth(suspended, {}, () => {});
    assert.equal(getOptionalUserId(suspended), null);
  } finally {
    User.findById = originalFindById;
  }
});

function characterStore(userId) {
  const docs = [];
  const asId = (value) => String(value);
  const matches = (doc, filter = {}) => {
    if (filter.userId && asId(doc.userId) !== asId(filter.userId)) return false;
    const idFilter = filter._id;
    if (idFilter === undefined) return true;
    if (idFilter && typeof idFilter === 'object' && Array.isArray(idFilter.$in)) return idFilter.$in.map(asId).includes(asId(doc._id));
    if (idFilter && typeof idFilter === 'object' && Array.isArray(idFilter.$nin)) return !idFilter.$nin.map(asId).includes(asId(doc._id));
    return asId(doc._id) === asId(idFilter);
  };
  const query = (rows) => {
    const q = { select() { return q; }, sort() { return q; }, session() { return q; }, lean: async () => rows.map((row) => ({ ...row })),
      then(resolve, reject) { return Promise.resolve(rows.map((row) => ({ ...row }))).then(resolve, reject); } };
    return q;
  };
  const model = {
    find(filter) { return query(docs.filter((doc) => matches(doc, filter))); },
    async deleteMany(filter) {
      const before = docs.length;
      for (let index = docs.length - 1; index >= 0; index -= 1) if (matches(docs[index], filter)) docs.splice(index, 1);
      return { deletedCount: before - docs.length };
    },
    async findOneAndUpdate(filter, update) {
      const doc = docs.find((row) => matches(row, filter));
      if (!doc) return null;
      Object.assign(doc, update.$set);
      return { ...doc };
    },
    async create(rows) {
      return rows.map((row) => {
        const doc = { records: { totalKills: 0, totalAssists: 0, totalWins: 0, gamesPlayed: 0, deathCount: 0 }, ...row, _id: new mongoose.Types.ObjectId().toString() };
        docs.push(doc);
        return { ...doc };
      });
    },
    db: { async transaction(run) {
      const snapshot = structuredClone(docs);
      try { return await run({ fake: true }); } catch (error) { docs.splice(0, docs.length, ...snapshot); throw error; }
    } },
  };
  const seed = (name, records) => {
    const doc = { _id: new mongoose.Types.ObjectId().toString(), userId, name, gender: '여', records };
    docs.push(doc);
    return doc;
  };
  return { docs, model, seed };
}

test('character save keeps server-owned records and deletes only characters it was told to delete', async () => {
  const Character = require('../models/Characters');
  const Item = require('../models/Item');
  const router = require('../routes/characters');
  const save = routeHandler(router, 'post', '/save');
  const userId = '64b000000000000000000002';
  const store = characterStore(userId);
  const records = { totalKills: 69, totalAssists: 12, totalWins: 67, gamesPlayed: 94, deathCount: 27 };
  const shiroko = store.seed('시로코', records);
  const terror = store.seed('시로코·테러', records);
  const stale = store.seed('다른 탭에서 만든 캐릭터', records);

  const saved = Object.fromEntries(['find', 'deleteMany', 'findOneAndUpdate', 'create'].map((key) => [key, Character[key]]));
  const savedDb = Character.db;
  const savedItemFind = Item.find;
  Object.assign(Character, store.model);
  Object.defineProperty(Character, 'db', { value: store.model.db, configurable: true, writable: true });
  Item.find = async () => [];
  try {
    const res = fakeRes();
    await save({
      user: { id: userId },
      body: {
        // A client that never loaded `stale`, editing one character and deleting another.
        characters: [{ _id: shiroko._id, name: '시로코', gender: '여', records: { totalWins: 99999, totalKills: 0 } }],
        deletedIds: [terror._id],
      },
    }, res);
    assert.equal(res.code, 200, JSON.stringify(res.body));
    const byId = new Map(store.docs.map((doc) => [doc._id, doc]));
    assert.deepEqual(byId.get(shiroko._id).records, records, 'records cannot be written by the client');
    assert.equal(byId.has(terror._id), false, 'explicitly deleted');
    assert.equal(byId.has(stale._id), true, 'characters missing from the request are kept');

    const conflict = fakeRes();
    await save({ user: { id: userId }, body: { characters: [{ _id: shiroko._id, name: 'x' }], deletedIds: [shiroko._id] } }, conflict);
    assert.equal(conflict.code, 400);
  } finally {
    Object.assign(Character, saved);
    Object.defineProperty(Character, 'db', { value: savedDb, configurable: true, writable: true });
    Item.find = savedItemFind;
  }
});

test('character save and read preserve explicit HP damage units without changing unmarked legacy values or records', async () => {
  const Character = require('../models/Characters');
  const Item = require('../models/Item');
  const router = require('../routes/characters');
  const save = routeHandler(router, 'post', '/save');
  const read = routeHandler(router, 'get', '/');
  const userId = '64b000000000000000000003';
  const store = characterStore(userId);
  const records = { totalKills: 5, totalAssists: 2, totalWins: 1, gamesPlayed: 4, deathCount: 3 };
  const explicit = store.seed('퍼센트 단위', { ...records });
  const legacy = store.seed('이전 단위', { ...records });
  const saved = Object.fromEntries(['find', 'deleteMany', 'findOneAndUpdate', 'create'].map(key => [key, Character[key]]));
  const savedDb = Character.db;
  const savedItemFind = Item.find;
  Object.assign(Character, store.model);
  Object.defineProperty(Character, 'db', { value: store.model.db, configurable: true, writable: true });
  Item.find = async () => [];
  try {
    const q = { enabled: true, type: 'attack_skill', name: '체력 피해', maxHpPct: [0.2, 0.25, 0.5, 1, 4] };
    const response = fakeRes();
    await save({ user: { id: userId }, body: { deletedIds: [], characters: [
      { _id: explicit._id, name: explicit.name, characterSkills: { q: { ...q, hpDamagePercentUnit: 'percent' } },
        records: { totalWins: 999 } },
      { _id: legacy._id, name: legacy.name, characterSkills: { q: { ...q, hpDamagePercentUnit: 'forged-unit' } } },
    ] } }, response);
    assert.equal(response.code, 200, JSON.stringify(response.body));
    const loaded = fakeRes();
    await read({ user: { id: userId }, query: {} }, loaded);
    assert.equal(loaded.code, 200);
    const byId = new Map(loaded.body.map(row => [String(row._id), row]));
    assert.equal(byId.get(explicit._id).characterSkills.q.hpDamagePercentUnit, 'percent');
    assert.deepEqual(byId.get(explicit._id).characterSkills.q.maxHpPct, q.maxHpPct);
    assert.equal(Object.hasOwn(byId.get(legacy._id).characterSkills.q, 'hpDamagePercentUnit'), false);
    assert.deepEqual(byId.get(legacy._id).characterSkills.q.maxHpPct, q.maxHpPct);
    assert.deepEqual(byId.get(explicit._id).records, records);
    assert.deepEqual(byId.get(legacy._id).records, records);
    assert.equal(store.docs.length, 2);
  } finally {
    Object.assign(Character, saved);
    Object.defineProperty(Character, 'db', { value: savedDb, configurable: true, writable: true });
    Item.find = savedItemFind;
  }
});

test('POST /api/game/end reaches the unified game handler through the real app routing', async () => {
  const { app } = require('../index');
  const User = require('../models/User');
  const id = '64b000000000000000000003';
  const originalFindById = User.findById;
  User.findById = () => ({ select() { return this; }, lean: async () => ({ _id: id, isAdmin: false, moderationStatus: 'active', tokenVersion: 0 }) });
  const server = app.listen(0);
  try {
    const { port } = server.address();
    const token = jwt.sign({ id, tv: 0 }, process.env.MY_SECRET_KEY);
    const response = await fetch(`http://127.0.0.1:${port}/api/game/end`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ clientRunId: 'eh-routing-check-0001', winnerId: 'missing', participants: [{ _id: 'a' }] }),
    });
    const body = await response.json();
    // Only routes/game.js answers with this code; a shadowing router would not.
    assert.equal(response.status, 400, JSON.stringify(body));
    assert.equal(body.code, 'WINNER_NOT_IN_ROSTER');

    for (const [path, code] of [['/api/credits/earn', 'CLIENT_REWARD_DISABLED'], ['/api/user/update-stats', 'CLIENT_STATS_DISABLED']]) {
      const closed = await fetch(`http://127.0.0.1:${port}${path}`, {
        method: 'POST',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify({ amount: 100000, lpEarned: 99999 }),
      });
      assert.equal(closed.status, 410);
      assert.equal((await closed.json()).code, code);
    }
  } finally {
    server.close();
    User.findById = originalFindById;
  }
});
