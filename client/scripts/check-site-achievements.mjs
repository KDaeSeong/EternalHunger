import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { achievementProgressPercent, createAchievementRequests, filterAchievements } from '../src/app/achievements/_lib/achievementRequests.js';
import { GAME_ENTRY_ROUTES } from '../src/app/games/_lib/gameCatalog.js';

const require = createRequire(import.meta.url);
const { ACHIEVEMENTS, CATALOG_VERSION, GAME_MILESTONES, buildAchievementRows } = require('../../shared/achievementCatalog.cjs');
const preview = { achievements: buildAchievementRows(), user: null };
const deferred = () => { let resolve; let reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const payload = (userId, label = 'current') => ({ catalogVersion: CATALOG_VERSION, user: { _id: userId },
  season: { totalCount: 47 }, unclaimedRewards: { count: 0 }, achievements: preview.achievements,
  userProgress: { lp: 50, credits: 100 }, label });

function harness() {
  let session = 'session-A';
  let view;
  const reads = [], posts = [], wallets = [], claims = [], changes = [];
  const controller = createAchievementRequests({ preview, catalogVersion: CATALOG_VERSION,
    getSession: () => session, isCurrentSession: (captured) => captured === session,
    read: () => { const task = deferred(); reads.push(task); return task.promise; },
    post: (body) => { const task = deferred(); posts.push({ ...task, body }); return task.promise; },
    onChange: (state) => { view = state; changes.push(state); },
    onWallet: (progress, captured) => wallets.push({ progress, captured }), onClaim: (data) => claims.push(data),
  });
  controller.reset({ key: 'owner-A', userId: 'A' });
  return { controller, reads, posts, wallets, claims, changes, view: () => view,
    setSession: (value) => { session = value; } };
}

let checks = 0;
async function check(title, work) { await work(); checks += 1; console.log('PASS ' + title); }

await check('all game achievement links use the real current game entry routes', () => {
  for (const game of GAME_MILESTONES) {
    const row = ACHIEVEMENTS.find((entry) => entry.id === `game_${game.slug}`);
    assert.ok(row);
    assert.equal(row.href, GAME_ENTRY_ROUTES[game.slug], game.slug);
  }
  assert.equal(preview.achievements.length, 47);
  assert.ok(preview.achievements.every((row) => !row.completed && !row.claimable));
});

await check('fractional progress renders its actual percentage', () => {
  assert.deepEqual([0, 0.24, 0.38, 0.5, 0.999, 1, 2, -1, NaN].map(achievementProgressPercent), [0, 24, 38, 50, 100, 100, 100, 0, 0]);
});

await check('section, state and Korean search combine without mutating the catalog', () => {
  const before = JSON.stringify(preview.achievements);
  assert.equal(filterAchievements(preview.achievements, { section: 'archive' }).length, 3);
  assert.equal(filterAchievements(preview.achievements, { search: '문명' }).length, 3);
  assert.equal(filterAchievements(preview.achievements, { status: 'claimable' }).length, 0);
  assert.equal(filterAchievements(preview.achievements, { section: 'twenty', search: '정답' }).length, 3);
  assert.equal(JSON.stringify(preview.achievements), before);
});

await check('the latest read wins when responses resolve out of order', async () => {
  const h = harness();
  const first = h.controller.load(), second = h.controller.load();
  h.reads[1].resolve(payload('A', 'new')); await second;
  h.reads[0].resolve(payload('A', 'old')); await first;
  assert.equal(h.view().payload.label, 'new'); assert.equal(h.view().loading, false);
});

await check('switching accounts clears old progress before either response arrives', async () => {
  const h = harness();
  const first = h.controller.load();
  h.setSession('session-B'); h.controller.reset({ key: 'owner-B', userId: 'B' });
  assert.equal(h.view().payload.user, null);
  const second = h.controller.load();
  h.reads[0].resolve(payload('A')); await first;
  assert.equal(h.view().payload.user, null);
  h.reads[1].resolve(payload('B')); await second;
  assert.equal(h.view().payload.user._id, 'B');
});

await check('a claim retires an earlier read so it cannot overwrite the receipt', async () => {
  const h = harness();
  const read = h.controller.load(), claim = h.controller.claim({ all: true });
  h.posts[0].resolve(payload('A', 'receipt')); await claim;
  h.reads[0].resolve(payload('A', 'stale-before-payment')); await read;
  assert.equal(h.view().payload.label, 'receipt'); assert.equal(h.wallets.length, 1);
  assert.equal(h.wallets[0].captured, 'session-A');
});

await check('double clicks and refresh during payment cannot start a second request', async () => {
  const h = harness();
  const one = h.controller.claim({ achievementIds: ['first_sim'] });
  assert.equal(await h.controller.claim({ all: true }), false);
  assert.equal(await h.controller.load(), false);
  assert.equal(h.posts.length, 1); assert.equal(h.reads.length, 0);
  h.posts[0].resolve(payload('A')); await one;
  assert.equal(h.view().claiming, false);
});

await check('logout during payment cannot change a wallet or show an old account receipt', async () => {
  const h = harness();
  const claim = h.controller.claim({ all: true });
  h.setSession('guest'); h.controller.reset(null);
  h.posts[0].resolve(payload('A')); await claim;
  assert.equal(h.view().payload.user, null); assert.equal(h.wallets.length, 0); assert.equal(h.claims.length, 0);
});

await check('another account can claim while the previous account response is pending', async () => {
  const h = harness();
  const first = h.controller.claim({ all: true });
  h.setSession('session-B'); h.controller.reset({ key: 'owner-B', userId: 'B' });
  const second = h.controller.claim({ all: true });
  h.posts[0].resolve(payload('A')); await first;
  assert.equal(h.view().claiming, true);
  h.posts[1].resolve(payload('B')); await second;
  assert.equal(h.wallets.length, 1); assert.equal(h.wallets[0].captured, 'session-B');
  assert.equal(h.view().payload.user._id, 'B');
});

await check('session renewal rejects a retired response without leaving loading stuck', async () => {
  const h = harness();
  const first = h.controller.load(); h.setSession('renewed-A');
  h.reads[0].resolve(payload('A')); await first;
  assert.equal(h.view().loading, false); assert.ok(h.view().error);
  const second = h.controller.load(); h.reads[1].resolve(payload('A')); await second;
  assert.equal(h.view().error, ''); assert.equal(h.view().payload.user._id, 'A');
});

await check('malformed, old-version and wrong-account responses cannot become personal progress', async () => {
  for (const bad of [{}, { ...payload('A'), catalogVersion: 'old' }, { ...payload('A'), season: null }, payload('B')]) {
    const h = harness(); const request = h.controller.load(); h.reads[0].resolve(bad); await request;
    assert.equal(h.view().payload.user, null); assert.ok(h.view().error); assert.equal(h.view().loading, false);
  }
});

await check('network failure preserves current progress and retires cleanly on unmount', async () => {
  const h = harness();
  const first = h.controller.load(); h.reads[0].resolve(payload('A', 'kept')); await first;
  const second = h.controller.load(); h.reads[1].reject(new Error('offline')); await second;
  assert.equal(h.view().payload.label, 'kept'); assert.equal(h.view().error, 'offline');
  const third = h.controller.load(); h.controller.invalidate(); const count = h.changes.length;
  h.reads[2].resolve(payload('A')); await third;
  assert.equal(h.changes.length, count);
});

console.log(`SITE_ACHIEVEMENTS_CHECKS ${checks}/${checks}`);
