const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { COSMETICS, resolveCosmeticPerks } = require('../utils/cosmeticPerks');
const { DEFAULT_PUBLIC_PERKS } = require('../utils/defaultPerks');
const { scopedFilter } = require('../utils/requestScope');
const { dedupeScopedPerks } = require('../utils/defaultPerks');
const { mapPublicUser, PUBLIC_FOLLOW_USER_SELECT } = require('../routes/publicModules/shared');

const routeSource = readFileSync(path.join(__dirname, '../routes/perks.js'), 'utf8');

function makeHarness({ owned = [], perks = [] } = {}) {
  const user = {
    _id: 'user-1', username: 'private-name', nickname: '공개 이름', lp: 1000, credits: 25,
    perks: [...owned], perkLoadouts: {}, cosmeticLoadout: {}, isAdmin: false, badges: [], statistics: {},
  };
  const routes = new Map();
  const writes = [];
  const perkQueries = [];
  const User = {
    findById(id) {
      return {
        select() { return this; },
        lean: async () => String(id) === 'user-1' ? structuredClone(user) : null,
      };
    },
    async findOneAndUpdate(filter, update) {
      writes.push({ filter: structuredClone(filter), update: structuredClone(update) });
      if (String(filter._id) !== 'user-1' || (filter.perks && !user.perks.includes(filter.perks))) return null;
      for (const [key, value] of Object.entries(update.$set || {})) {
        const [root, field] = key.split('.');
        user[root] = { ...(user[root] || {}), [field]: value };
      }
      return structuredClone(user);
    },
  };
  const Perk = {
    find(filter) {
      perkQueries.push(structuredClone(filter));
      return { lean: async () => perks.filter((perk) => {
        if (perk.code !== filter.code || (filter.isActive === true && perk.isActive !== true)) return false;
        const ownerClause = filter.$or || filter.$and?.find((clause) => Array.isArray(clause.$or))?.$or;
        return !ownerClause || ownerClause.some((clause) => (
          Object.prototype.hasOwnProperty.call(clause, 'ownerUserId')
          && (clause.ownerUserId === perk.ownerUserId
            || (clause.ownerUserId === null && (perk.ownerUserId === null || perk.ownerUserId === undefined))
            || (clause.ownerUserId?.$exists === false && perk.ownerUserId === undefined))
        ));
      }) };
    },
  };
  const express = { Router: () => ({
    get(route, handler) { routes.set(`GET ${route}`, handler); },
    post(route, handler) { routes.set(`POST ${route}`, handler); },
  }) };
  const module = { exports: {} };
  vm.runInNewContext(routeSource, {
    require: (id) => ({
      express,
      '../models/User': User,
      '../models/Perk': Perk,
      '../utils/requestScope': { scopedFilter },
      '../utils/defaultPerks': {
        dedupeScopedPerks,
        ensureDefaultPublicPerks: async () => {},
        normalizePerkLoadouts: (value) => value || {},
        PERK_LOADOUT_GAME_SLUGS: [],
      },
      '../utils/cosmeticPerks': require('../utils/cosmeticPerks'),
    })[id],
    module,
    exports: module.exports,
    console: { error() {} },
    Number, Array, Boolean, String, Set, Map, Math, Object,
  }, { filename: path.join(__dirname, '../routes/perks.js') });

  async function call(route, body = {}) {
    let status = 200;
    let payload;
    const res = { status(value) { status = value; return this; }, json(value) { payload = value; return value; } };
    await routes.get(route)({ user: { id: 'user-1' }, body }, res);
    return { status, payload };
  }
  return { user, writes, perkQueries, call };
}

test('legacy cosmetic accounts resolve their last owned known cosmetic and both owned badges', () => {
  const result = resolveCosmeticPerks({ perks: [
    'COS_TITLE_ROOKIE', 'COS_TITLE_NIGHT_RUNNER', 'COS_FRAME_SKYLINE',
    'COS_BADGE_ALPHA', 'COS_BADGE_WEAKLINE', 'COS_LOG_CYAN', 'COS_VICTORY_SPOTLIGHT',
  ] });
  assert.equal(result.title.code, 'COS_TITLE_NIGHT_RUNNER');
  assert.equal(result.portraitFrame.value, 'skyline');
  assert.deepEqual(result.badges.map((badge) => badge.code), ['COS_BADGE_ALPHA', 'COS_BADGE_WEAKLINE']);
  assert.equal(result.logStyle.value, 'cyan');
  assert.equal(result.victoryEffect.value, 'spotlight');
});

test('explicit empty or invalid configured slots disable fallback; unknown and unowned legacy codes never render', () => {
  const result = resolveCosmeticPerks({
    perks: ['COS_TITLE_ROOKIE', 'COS_FRAME_SKYLINE', 'UNKNOWN'],
    cosmeticLoadout: { title: '', portraitFrame: 'COS_TITLE_ROOKIE', logStyle: 'NOT_A_COSMETIC' },
  });
  assert.equal(result.title, null);
  assert.equal(result.portraitFrame, null);
  assert.equal(result.logStyle, null);
  assert.equal(result.victoryEffect, null);
  assert.deepEqual(result.badges, []);
});

test('non-string configured slots stay explicitly disabled in own-user serialization', () => {
  const user = { perks: ['COS_TITLE_ROOKIE'], cosmeticLoadout: { title: null } };
  assert.equal(resolveCosmeticPerks(user).title, null);
  assert.deepEqual(require('../utils/cosmeticPerks').normalizeCosmeticLoadout(user.cosmeticLoadout), { title: '' });
  assert.equal(resolveCosmeticPerks({ ...user, cosmeticLoadout: require('../utils/cosmeticPerks').normalizeCosmeticLoadout(user.cosmeticLoadout) }).title, null);
});

test('cosmetic route changes one owned active scoped slot, supports explicit clear, and rejects invalid requests', async () => {
  const products = DEFAULT_PUBLIC_PERKS.filter((perk) => Object.hasOwn(COSMETICS, perk.code));
  const harness = makeHarness({ owned: ['COS_TITLE_ROOKIE', 'COS_FRAME_SKYLINE'], perks: products });
  const equipped = await harness.call('POST /cosmetics', { kind: 'title', code: 'COS_TITLE_ROOKIE' });
  assert.equal(equipped.status, 200);
  assert.equal(equipped.payload.user.cosmeticLoadout.title, 'COS_TITLE_ROOKIE');
  assert.equal(equipped.payload.user.cosmetics.title.code, 'COS_TITLE_ROOKIE');

  const cleared = await harness.call('POST /cosmetics', { kind: 'title', code: '' });
  assert.equal(cleared.status, 200);
  assert.equal(cleared.payload.user.cosmeticLoadout.title, '');
  assert.equal(cleared.payload.user.cosmetics.title, null);
  assert.equal(cleared.payload.user.cosmetics.portraitFrame.code, 'COS_FRAME_SKYLINE');
  assert.equal(harness.user.lp, 1000);

  const beforeWrites = harness.writes.length;
  for (const [body, status] of [
    [{ kind: 'badge', code: 'COS_BADGE_ALPHA' }, 400],
    [{ kind: 'title', code: 1 }, 400],
    [{ kind: 'title', code: 'COS_FRAME_SKYLINE' }, 400],
    [{ kind: 'title', code: 'COS_TITLE_NIGHT_RUNNER' }, 403],
  ]) assert.equal((await harness.call('POST /cosmetics', body)).status, status);
  assert.equal(harness.writes.length, beforeWrites);
  assert.deepEqual(Object.keys(harness.writes[0].update.$set), ['cosmeticLoadout.title']);
  assert.deepEqual(harness.writes[0].filter.perks, 'COS_TITLE_ROOKIE');
});

test('cosmetic routes do not modify gameplay loadouts, ownership, or LP', async () => {
  const product = { code: 'COS_TITLE_ROOKIE', name: '루미아 신입 생존자', lpCost: 120, category: 'title', isActive: true,
    effects: { cosmeticKind: 'title', title: '루미아 신입 생존자', balanceAffecting: false } };
  const harness = makeHarness({ owned: ['COS_TITLE_ROOKIE'], perks: [product] });
  harness.user.cosmeticLoadout.title = 'COS_TITLE_ROOKIE';
  const equipped = await harness.call('POST /cosmetics', { kind: 'title', code: 'COS_TITLE_ROOKIE' });
  assert.equal(equipped.payload.user.perkLoadouts['eternal-hunger'], undefined);
  assert.equal(harness.user.lp, 1000);
  assert.deepEqual(harness.user.perks, ['COS_TITLE_ROOKIE']);
  assert.deepEqual(harness.user.cosmeticLoadout, { title: 'COS_TITLE_ROOKIE' });
});

test('actual scopedFilter prevents selecting a same-code perk owned by another account', async () => {
  const foreignPerk = {
    code: 'COS_TITLE_ROOKIE', name: '루미아 신입 생존자', isActive: true,
    ownerUserId: 'user-2', effects: { cosmeticKind: 'title' },
  };
  const harness = makeHarness({ owned: ['COS_TITLE_ROOKIE'], perks: [foreignPerk] });
  const result = await harness.call('POST /cosmetics', { kind: 'title', code: 'COS_TITLE_ROOKIE' });
  assert.equal(result.status, 400);
  assert.equal(harness.writes.length, 0);
  assert.deepEqual(harness.perkQueries[0].$or, [
    { ownerUserId: 'user-1' },
    { ownerUserId: null },
    { ownerUserId: { $exists: false } },
  ]);
});

test('public user mapper exposes displayName and curated cosmetics only, with profile projection data', () => {
  const mapped = mapPublicUser({
    _id: 'public-id', username: 'private-handle', nickname: '공개 이름', perks: ['COS_TITLE_ROOKIE', 'COS_BADGE_ALPHA'],
    cosmeticLoadout: { title: 'COS_TITLE_ROOKIE' }, password: 'never-return',
  });
  assert.equal(mapped.displayName, '공개 이름');
  assert.deepEqual(mapped.cosmetics.title, COSMETICS.COS_TITLE_ROOKIE);
  assert.deepEqual(mapped.cosmetics.badges.map((badge) => badge.code), ['COS_BADGE_ALPHA']);
  assert.equal(Object.hasOwn(mapped, 'username'), false);
  assert.equal(Object.hasOwn(mapped, 'perks'), false);
  assert.equal(Object.hasOwn(mapped, 'cosmeticLoadout'), false);
  assert.ok(PUBLIC_FOLLOW_USER_SELECT.split(' ').includes('perks'), 'follow-list population supplies ownership to the same public mapper');
  assert.ok(PUBLIC_FOLLOW_USER_SELECT.split(' ').includes('cosmeticLoadout'), 'follow-list population supplies explicit unequip choices');

  const publicUsersSource = readFileSync(path.join(__dirname, '../routes/publicModules/users.js'), 'utf8');
  assert.match(publicUsersSource, /\.select\('username nickname profileBio lp statistics badges createdAt perks cosmeticLoadout'\)/);
});
