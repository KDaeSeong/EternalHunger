const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {
  DEFAULT_PUBLIC_PERKS,
  dedupeScopedPerks,
  normalizePerkLoadouts,
  PERK_LOADOUT_GAME_SLUGS,
} = require('../utils/defaultPerks');
const { getOwnedPerkContext } = require('../utils/perkRuntime');

const routeSource = readFileSync(path.join(__dirname, '../routes/perks.js'), 'utf8');

function makeHarness({ owned = [], perkRows = [], secondUser = false } = {}) {
  const firstUser = {
    _id: 'user-1', username: 'first', nickname: '', lp: 900, credits: 20,
    perks: [...owned], perkLoadouts: { 'primitive-archive': [], 'eternal-hunger': [] },
    isAdmin: false, badges: [], statistics: {},
  };
  const users = new Map([['user-1', firstUser]]);
  if (secondUser) users.set('user-2', {
    _id: 'user-2', username: 'second', nickname: '', lp: 500, credits: 10,
    perks: [], perkLoadouts: { 'primitive-archive': [], 'eternal-hunger': [] },
    isAdmin: false, badges: [], statistics: {},
  });
  const routes = new Map();
  const writes = [];
  const User = {
    findById(id) {
      return {
        select() { return this; },
        lean: async () => {
          const user = users.get(String(id));
          return user ? structuredClone(user) : null;
        },
      };
    },
    async findOneAndUpdate(filter, update, options) {
      writes.push({ filter: structuredClone(filter), update: structuredClone(update), options: structuredClone(options) });
      const user = users.get(String(filter._id));
      if (!user || (filter.perks?.$all && filter.perks.$all.some((code) => !user.perks.includes(code)))) return null;
      const [root, gameSlug] = Object.keys(update.$set)[0].split('.');
      user[root] = { ...(user[root] || {}), [gameSlug]: [...update.$set[Object.keys(update.$set)[0]]] };
      return structuredClone(user);
    },
  };
  const Perk = {
    find(filter) {
      const query = {
        sort() { return this; },
        lean: async () => perkRows.filter((perk) => {
          if (filter.isActive === true && perk.isActive !== true) return false;
          if (typeof filter.code === 'string') return perk.code === filter.code;
          if (Array.isArray(filter.code?.$in)) return filter.code.$in.includes(perk.code);
          return true;
        }),
      };
      return query;
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
      '../utils/requestScope': { scopedFilter: (_req, filter) => filter },
      '../utils/defaultPerks': {
        dedupeScopedPerks,
        ensureDefaultPublicPerks: async () => {},
        normalizePerkLoadouts,
        PERK_LOADOUT_GAME_SLUGS,
      },
      '../utils/cosmeticPerks': require('../utils/cosmeticPerks'),
    })[id],
    module,
    exports: module.exports,
    console: { error() {} },
    Number,
    Array,
    Boolean,
    String,
    Set,
    Map,
    Math,
    Object,
  }, { filename: path.join(__dirname, '../routes/perks.js') });

  async function call(route, body = {}, userId = 'user-1') {
    let status = 200;
    let payload;
    const res = {
      status(value) { status = value; return this; },
      json(value) { payload = value; return value; },
    };
    await routes.get(route)({ user: { id: userId }, body }, res);
    return { status, payload };
  }

  return { users, writes, call };
}

function gameplayProducts() {
  return DEFAULT_PUBLIC_PERKS.filter((perk) => perk.code.startsWith('PLAY_'));
}

test('default gameplay products match the fixed codes, costs, game scopes and equipped-effect metadata', () => {
  const actual = gameplayProducts();
  assert.deepEqual(actual.map(({ code, lpCost }) => [code, lpCost]), [
    ['PLAY_ARCHIVE_CAREFUL_GATHER', 250],
    ['PLAY_ARCHIVE_RESEARCH_NOTES', 400],
    ['PLAY_EH_START_SPONSOR', 250],
    ['PLAY_EH_PROCUREMENT_PARTNER', 400],
  ]);
  assert.deepEqual(actual.map(({ code, effects }) => [code, effects]), [
    ['PLAY_ARCHIVE_CAREFUL_GATHER', {
      gameSlug: 'primitive-archive', requiresEquip: true, gameplayKind: 'careful_gather', amount: 1, maxUses: 3, balanceAffecting: true,
    }],
    ['PLAY_ARCHIVE_RESEARCH_NOTES', {
      gameSlug: 'primitive-archive', requiresEquip: true, gameplayKind: 'research_notes', amount: 1, maxUses: 10, balanceAffecting: true,
    }],
    ['PLAY_EH_START_SPONSOR', {
      gameSlug: 'eternal-hunger', requiresEquip: true, gameplayKind: 'start_sponsor', amount: 30, maxUses: 1, balanceAffecting: true,
    }],
    ['PLAY_EH_PROCUREMENT_PARTNER', {
      gameSlug: 'eternal-hunger', requiresEquip: true, gameplayKind: 'procurement_partner', discountPct: 0.05, balanceAffecting: true,
    }],
  ]);
  assert.deepEqual(PERK_LOADOUT_GAME_SLUGS, ['primitive-archive', 'eternal-hunger']);
  assert.deepEqual(normalizePerkLoadouts(null), { 'primitive-archive': [], 'eternal-hunger': [] });
});

test('user schema persists loadouts as a plain-object field without database access', () => {
  const User = require('../models/User');
  assert.equal(User.schema.path('perkLoadouts').instance, 'Mixed');
  const user = new User({ username: 'fixture-user', password: 'fixture-password' });
  assert.deepEqual(user.perkLoadouts, {});
});

test('loadout saves are account-scoped, game-scoped, capped, and never change LP or ownership', async () => {
  const products = gameplayProducts();
  const owned = products.map((perk) => perk.code);
  const harness = makeHarness({ owned, perkRows: products, secondUser: true });
  const secondBefore = structuredClone(harness.users.get('user-2'));
  const result = await harness.call('POST /loadout', {
    gameSlug: 'primitive-archive',
    codes: ['PLAY_ARCHIVE_CAREFUL_GATHER', 'PLAY_ARCHIVE_RESEARCH_NOTES'],
  });
  assert.equal(result.status, 200);
  assert.deepEqual(result.payload.perkLoadouts, {
    'primitive-archive': ['PLAY_ARCHIVE_CAREFUL_GATHER', 'PLAY_ARCHIVE_RESEARCH_NOTES'],
    'eternal-hunger': [],
  });
  assert.deepEqual(result.payload.user.perkLoadouts, result.payload.perkLoadouts);
  assert.equal(result.payload.user.lp, 900);
  assert.deepEqual(result.payload.user.perks, owned);
  assert.deepEqual(harness.users.get('user-2'), secondBefore);
  assert.deepEqual(Object.keys(harness.writes[0].update.$set), ['perkLoadouts.primitive-archive']);

  const otherGame = await harness.call('POST /loadout', {
    gameSlug: 'eternal-hunger', codes: ['PLAY_EH_START_SPONSOR'],
  });
  assert.equal(otherGame.status, 200);
  assert.deepEqual(otherGame.payload.perkLoadouts['primitive-archive'], ['PLAY_ARCHIVE_CAREFUL_GATHER', 'PLAY_ARCHIVE_RESEARCH_NOTES']);
  assert.deepEqual(otherGame.payload.perkLoadouts['eternal-hunger'], ['PLAY_EH_START_SPONSOR']);

  const cleared = await harness.call('POST /loadout', { gameSlug: 'eternal-hunger', codes: [] });
  assert.equal(cleared.status, 200);
  assert.deepEqual(cleared.payload.perkLoadouts['eternal-hunger'], []);
  assert.equal(harness.users.get('user-1').lp, 900);
  assert.deepEqual(harness.users.get('user-1').perks, owned);
});

test('loadout rejects invalid, duplicate, excessive, unowned, inactive, unknown and wrong-game codes without writes', async () => {
  const products = gameplayProducts();
  const generic = { code: 'COS_TITLE_ROOKIE', lpCost: 120, isActive: true, effects: { cosmeticKind: 'title' } };
  const inactive = { ...products[0], code: 'PLAY_ARCHIVE_INACTIVE', isActive: false };
  const wrongGame = products.find((perk) => perk.code === 'PLAY_EH_START_SPONSOR');
  const unowned = products.find((perk) => perk.code === 'PLAY_ARCHIVE_RESEARCH_NOTES');
  const owned = [products[0].code, products[2].code, products[3].code, inactive.code, generic.code, 'UNKNOWN_OWNED_CODE'];
  const harness = makeHarness({ owned, perkRows: [...products, generic, inactive] });
  const invalidRequests = [
    [{ gameSlug: 'unknown-game', codes: [] }, 400],
    [{ gameSlug: 'primitive-archive', codes: 'PLAY_ARCHIVE_CAREFUL_GATHER' }, 400],
    [{ gameSlug: 'primitive-archive', codes: [products[0].code, products[0].code] }, 400],
    [{ gameSlug: 'primitive-archive', codes: [products[0].code, unowned.code] }, 403],
    [{ gameSlug: 'primitive-archive', codes: [inactive.code] }, 400],
    [{ gameSlug: 'primitive-archive', codes: [wrongGame.code] }, 400],
    [{ gameSlug: 'primitive-archive', codes: ['UNKNOWN_OWNED_CODE'] }, 400],
    [{ gameSlug: 'primitive-archive', codes: [generic.code] }, 400],
    [{ gameSlug: 'primitive-archive', codes: [products[0].code, products[2].code, products[3].code, inactive.code] }, 400],
  ];
  for (const [body, expectedStatus] of invalidRequests) {
    const result = await harness.call('POST /loadout', body);
    assert.equal(result.status, expectedStatus, JSON.stringify(body));
  }
  assert.equal(harness.writes.length, 0);
  assert.equal(harness.users.get('user-1').lp, 900);
  assert.deepEqual(harness.users.get('user-1').perkLoadouts, { 'primitive-archive': [], 'eternal-hunger': [] });
});

test('available perks returns both normalized loadouts in the own-user payload', async () => {
  const products = gameplayProducts();
  const harness = makeHarness({
    owned: [products[0].code],
    perkRows: products,
  });
  harness.users.get('user-1').perkLoadouts = {
    'primitive-archive': [products[0].code, products[0].code, null, products[1].code, 'EXTRA'],
    'eternal-hunger': 'invalid',
    ignored: ['NOT_EXPOSED'],
  };
  const result = await harness.call('GET /available');
  assert.equal(result.status, 200);
  assert.deepEqual(result.payload.user.perkLoadouts, {
    'primitive-archive': [products[0].code, products[1].code, 'EXTRA'],
    'eternal-hunger': [],
  });
});

test('equipped game-specific effects never enter the legacy automatic perk bundle', async () => {
  const effects = [
    { code: 'AUTO', isActive: true, effects: { kioskDiscountPct: 0.1, startCreditsPlus: 5 } },
    { code: 'EQUIPPED', isActive: true, effects: {
      gameSlug: 'eternal-hunger', requiresEquip: true, gameplayKind: 'procurement_partner',
      kioskDiscountPct: 0.4, startCreditsPlus: 100,
    } },
  ];
  const context = await getOwnedPerkContext({ id: 'user-1', perks: ['AUTO', 'EQUIPPED'] }, {
    find() { return { lean: async () => effects }; },
  });
  assert.equal(context.perks.length, 2);
  assert.equal(context.effects.kioskDiscountPct, 0.1);
  assert.equal(context.effects.startCreditsPlus, 5);
});
