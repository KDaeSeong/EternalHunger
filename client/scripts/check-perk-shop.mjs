import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import ts from 'typescript';
import * as gameplayPerks from '../src/utils/gameplayPerks.js';
import * as cosmeticPerks from '../src/utils/cosmeticPerks.js';

const pagePath = resolve('src/app/perks/page.js');
const pageSource = readFileSync(pagePath, 'utf8');
const pageCode = ts.transpile(pageSource, {
  target: ts.ScriptTarget.ES2022,
  module: ts.ModuleKind.CommonJS,
  jsx: ts.JsxEmit.ReactJSX,
});

const element = (type, props, key) => ({ type, props: { ...(props || {}), ...(key === undefined ? {} : { key }) } });
const Fragment = Symbol('Fragment');
let active = null;

const React = {
  useState(initial) {
    const harness = active;
    const index = harness.stateCursor++;
    if (!(index in harness.states)) harness.states[index] = typeof initial === 'function' ? initial() : initial;
    if (!harness.setters[index]) {
      harness.setters[index] = (value) => {
        const current = harness.states[index];
        harness.states[index] = typeof value === 'function' ? value(current) : value;
      };
    }
    return [harness.states[index], harness.setters[index]];
  },
  useRef(initial) {
    const harness = active;
    const index = harness.refCursor++;
    if (!(index in harness.refs)) harness.refs[index] = { current: initial };
    return harness.refs[index];
  },
  useMemo(callback) { return callback(); },
  useEffect(callback, deps) {
    const harness = active;
    const index = harness.effectCursor++;
    const previous = harness.effects[index];
    const equal = Array.isArray(deps) && Array.isArray(previous?.deps)
      && deps.length === previous.deps.length
      && deps.every((value, item) => Object.is(value, previous.deps[item]));
    if (!previous || !equal) harness.pendingEffects.push({ index, callback, deps, previous });
  },
};

function createHarness({ user, session, getQueue = [], postQueue = [] }) {
  const harness = {
    authUser: user,
    session: { ...session },
    stateCursor: 0,
    states: [],
    setters: [],
    refCursor: 0,
    refs: [],
    effectCursor: 0,
    effects: [],
    pendingEffects: [],
    getQueue: [...getQueue],
    postQueue: [...postQueue],
    getCalls: [],
    postCalls: [],
    storedUpdates: [],
    clears: [],
    toasts: [],
    render() {
      active = harness;
      harness.stateCursor = 0;
      harness.refCursor = 0;
      harness.effectCursor = 0;
      harness.pendingEffects = [];
      return pageModule.exports.default();
    },
    runEffects() {
      active = harness;
      for (const pending of harness.pendingEffects) {
        pending.previous?.cleanup?.();
        const cleanup = pending.callback();
        harness.effects[pending.index] = { deps: pending.deps, cleanup };
      }
      harness.pendingEffects = [];
    },
    setAccount(nextUser, nextSession) {
      harness.authUser = nextUser;
      harness.session = { ...nextSession };
    },
  };

  const reactJsxRuntime = {
    Fragment,
    jsx: element,
    jsxs: element,
  };
  const dependency = (specifier) => {
    if (specifier === 'react/jsx-runtime') return reactJsxRuntime;
    if (specifier === 'react') return React;
    if (specifier === 'next/link') return { default: (props) => element('a', props) };
    if (specifier === '../../components/SiteHeader') return { default: () => null };
    if (specifier === '../../components/ToastProvider') return { useToast: () => ({ showToast: (toast) => harness.toasts.push(toast) }) };
    if (specifier === '../../utils/client-auth') return { useAuthUser: () => harness.authUser };
    if (specifier === '../../utils/gameplayPerks') return gameplayPerks;
    if (specifier === '../../utils/cosmeticPerks') return cosmeticPerks;
    if (specifier === '../../styles/PerkCosmetics.css') return {};
    if (specifier === '../../utils/api') return {
      apiGet: async (url) => {
        harness.getCalls.push(url);
        const next = harness.getQueue.shift();
        return typeof next === 'function' ? next(url) : next;
      },
      apiPost: async (url, body) => {
        harness.postCalls.push({ url, body });
        const next = harness.postQueue.shift();
        return typeof next === 'function' ? next(url, body) : next;
      },
      captureAuthSession: () => ({ ...harness.session }),
      isCurrentAuthSession: (session) => session?.scope === harness.session.scope
        && session?.revision === harness.session.revision
        && session?.csrfToken === harness.session.csrfToken,
      clearApiGetCache: (url) => harness.clears.push(url),
      clearAuth: () => { harness.authUser = null; },
      updateStoredUser: (user, options) => {
        harness.storedUpdates.push({ user, options });
        harness.authUser = user;
      },
    };
    throw new Error(`Unexpected component dependency: ${specifier}`);
  };
  const module = { exports: {} };
  new Function('require', 'module', 'exports', pageCode)((id) => dependency(id), module, module.exports);
  globalThis.pageModule = module;
  return harness;
}

function deferred() {
  let resolvePromise;
  let rejectPromise;
  const promise = new Promise((resolve, reject) => { resolvePromise = resolve; rejectPromise = reject; });
  return { promise, resolve: resolvePromise, reject: rejectPromise };
}

function walk(node, visit) {
  if (Array.isArray(node)) return node.forEach((child) => walk(child, visit));
  if (!node || typeof node !== 'object') return;
  visit(node);
  walk(node.props?.children, visit);
}

function textContent(node) {
  if (node === null || node === undefined || typeof node === 'boolean') return '';
  if (Array.isArray(node)) return node.map(textContent).join('');
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  return textContent(node.props?.children);
}

function findButton(tree, label) {
  let found = null;
  walk(tree, (node) => {
    if (!found && node.type === 'button' && textContent(node).trim() === label) found = node;
  });
  assert.ok(found, `button "${label}" should be rendered`);
  return found;
}

function findCard(tree, name) {
  let found = null;
  walk(tree, (node) => {
    if (!found && node.type === 'article' && String(node.props?.className || '').includes('perk-card') && textContent(node).includes(name)) found = node;
  });
  assert.ok(found, `card "${name}" should be rendered`);
  return found;
}

async function settle() {
  for (let i = 0; i < 8; i += 1) await Promise.resolve();
}

function fixtureUser(id, username, lp = 1000, perks = [], perkLoadouts = {}) {
  return {
    id,
    _id: id,
    username,
    lp,
    perks,
    perkLoadouts: gameplayPerks.normalizeGameplayPerkLoadouts(perkLoadouts, perks),
  };
}

const apiProducts = gameplayPerks.GAMEPLAY_PERK_PRODUCTS.map((product) => ({
  code: product.code,
  name: product.name,
  description: product.description,
  lpCost: product.lpCost,
  category: 'buff',
  effects: product.effects,
  isActive: true,
  isCosmetic: false,
}));

const getResponse = (user) => Promise.resolve({ perks: apiProducts, user });

{
  const user = fixtureUser('owner-a', 'owner-a', 1000);
  const harness = createHarness({ user, session: { scope: 'auth:a', revision: 1, csrfToken: 'a' }, getQueue: [getResponse(user)] });
  let tree = harness.render();
  harness.runEffects();
  await settle();
  tree = harness.render();
  assert.match(textContent(tree), /플레이 특전/);
  assert.match(textContent(tree), /문명 아카이브/);
  assert.match(textContent(tree), /영구 보유/);
  assert.match(textContent(findCard(tree, '꼼꼼한 채집')), /처음 3번의 일반 채집 성공/);
  assert.match(textContent(findCard(tree, '연구 기록법')), /최대 10번 적용/);
  assert.match(textContent(findCard(tree, '꼼꼼한 채집')), /LP/);
  assert.match(textContent(findCard(tree, '출발 후원금')), /경기 크레딧/);
  assert.match(textContent(findCard(tree, '조달 제휴')), /5% 할인/);
  assert.match(textContent(tree), /0\/3/);
  assert.doesNotMatch(textContent(tree), /향후 밸런스형 특전|향후 특전/);
}

{
  const initialUser = fixtureUser('owner-b', 'owner-b', 1000);
  const purchasedUser = fixtureUser('owner-b', 'owner-b', 750, [gameplayPerks.GAMEPLAY_PERK_CODES.CAREFUL_GATHER]);
  const equippedUser = fixtureUser('owner-b', 'owner-b', 750, [gameplayPerks.GAMEPLAY_PERK_CODES.CAREFUL_GATHER], {
    'primitive-archive': [gameplayPerks.GAMEPLAY_PERK_CODES.CAREFUL_GATHER],
  });
  const clearedUser = fixtureUser('owner-b', 'owner-b', 750, [gameplayPerks.GAMEPLAY_PERK_CODES.CAREFUL_GATHER]);
  const harness = createHarness({
    user: initialUser,
    session: { scope: 'auth:b', revision: 2, csrfToken: 'b' },
    getQueue: [getResponse(initialUser)],
    postQueue: [
      Promise.resolve({ user: purchasedUser, message: '특전 구매 완료' }),
      Promise.resolve({ user: equippedUser, perkLoadouts: equippedUser.perkLoadouts, message: '게임 특전 장착을 저장했습니다.' }),
      Promise.resolve({ user: clearedUser, perkLoadouts: clearedUser.perkLoadouts, message: '게임 특전 장착을 해제했습니다.' }),
    ],
  });
  harness.render();
  harness.runEffects();
  await settle();
  let tree = harness.render();

  findButton(findCard(tree, '꼼꼼한 채집'), '구매').props.onClick();
  await settle();
  tree = harness.render();
  assert.deepEqual(harness.postCalls[0], { url: '/perks/purchase', body: { code: 'PLAY_ARCHIVE_CAREFUL_GATHER' } });
  assert.deepEqual(harness.storedUpdates[0].options, { session: { scope: 'auth:b', revision: 2, csrfToken: 'b' } });
  assert.match(textContent(findCard(tree, '꼼꼼한 채집')), /장착해야 효과가 적용됩니다/);
  assert.match(textContent(tree), /0\/3/);

  findButton(findCard(tree, '꼼꼼한 채집'), '장착').props.onClick();
  await settle();
  tree = harness.render();
  assert.deepEqual(harness.postCalls[1], {
    url: '/perks/loadout',
    body: { gameSlug: 'primitive-archive', codes: ['PLAY_ARCHIVE_CAREFUL_GATHER'] },
  });
  assert.match(textContent(tree), /1\/3/);
  assert.ok(findButton(findCard(tree, '꼼꼼한 채집'), '장착 해제'));

  findButton(findCard(tree, '꼼꼼한 채집'), '장착 해제').props.onClick();
  await settle();
  tree = harness.render();
  assert.deepEqual(harness.postCalls[2], { url: '/perks/loadout', body: { gameSlug: 'primitive-archive', codes: [] } });
  assert.match(textContent(tree), /0\/3/);
  assert.equal(harness.storedUpdates.length, 4);
}

{
  const ownerA = fixtureUser('race-a', 'race-a', 111);
  const ownerB = fixtureUser('race-b', 'race-b', 1000);
  const ownerC = fixtureUser('race-c', 'race-c', 333);
  const oldLoad = deferred();
  const oldPurchase = deferred();
  const harness = createHarness({
    user: ownerA,
    session: { scope: 'auth:race-a', revision: 1, csrfToken: 'a' },
    getQueue: [oldLoad.promise, getResponse(ownerB), getResponse(ownerC)],
    postQueue: [oldPurchase.promise],
  });
  harness.render();
  harness.runEffects();

  harness.setAccount(ownerB, { scope: 'auth:race-b', revision: 1, csrfToken: 'b' });
  harness.render();
  harness.runEffects();
  await settle();
  let tree = harness.render();
  assert.match(textContent(tree), /race-b/);
  assert.doesNotMatch(textContent(tree), /owner-a/);

  findButton(findCard(tree, '꼼꼼한 채집'), '구매').props.onClick();
  await settle();
  harness.setAccount(ownerC, { scope: 'auth:race-c', revision: 1, csrfToken: 'c' });
  harness.render();
  harness.runEffects();
  await settle();
  const updatesBeforeLatePurchase = harness.storedUpdates.length;
  oldPurchase.resolve({ user: fixtureUser('race-b', 'owner-b', 0, ['PLAY_ARCHIVE_CAREFUL_GATHER']), message: 'stale purchase response' });
  await settle();
  oldLoad.resolve({ perks: [], user: fixtureUser('race-a', 'owner-a', 0, ['PLAY_EH_START_SPONSOR']) });
  await settle();
  tree = harness.render();
  assert.match(textContent(tree), /race-c/);
  assert.doesNotMatch(textContent(tree), /owner-a|owner-b|stale purchase response/);
  assert.equal(harness.storedUpdates.length, updatesBeforeLatePurchase, 'late response must not update another account snapshot');
}

{
  const categoryByKind = {
    title: 'title', portraitFrame: 'portrait_frame', badge: 'badge', logStyle: 'log_style', victoryEffect: 'victory_effect',
  };
  const cosmeticRows = cosmeticPerks.COSMETIC_PERKS.map((perk) => ({
    ...perk,
    category: categoryByKind[perk.kind],
    lpCost: 100,
    effects: { cosmeticKind: perk.kind, balanceAffecting: false },
    isActive: true,
  }));
  const owned = ['COS_TITLE_ROOKIE', 'COS_TITLE_NIGHT_RUNNER', 'COS_FRAME_SKYLINE', 'COS_BADGE_ALPHA', 'COS_LOG_CYAN'];
  const legacy = { ...fixtureUser('cosmetic-owner', 'cosmetic-owner', 500, owned), cosmeticLoadout: undefined, badges: [{ name: '기존 우승 배지', unlockedAt: '2026-01-01' }] };
  const clearedTitle = { ...legacy, cosmeticLoadout: { title: '' } };
  const selectedTitle = { ...legacy, cosmeticLoadout: { title: 'COS_TITLE_ROOKIE' } };
  const harness = createHarness({
    user: legacy,
    session: { scope: 'auth:cosmetics', revision: 1, csrfToken: 'cosmetic-token' },
    getQueue: [Promise.resolve({ perks: cosmeticRows, user: legacy })],
    postQueue: [
      Promise.resolve({ user: clearedTitle, message: '칭호 장착을 해제했습니다.' }),
      Promise.resolve({ user: selectedTitle, message: '칭호를 적용했습니다.' }),
    ],
  });
  harness.render();
  harness.runEffects();
  await settle();
  let tree = harness.render();
  assert.match(textContent(tree), /야간 루퍼/);
  assert.match(textContent(tree), /알파 추적자 배지/);
  assert.match(textContent(findCard(tree, '청록 로그 하이라이트')), /이터널 헝거 전투 로그의 왼쪽 강조선/);
  assert.match(textContent(findCard(tree, '승리 스포트라이트')), /승자가 있는 경기 결과의 우승 영역/);
  const frame = findCard(tree, '야간 루퍼');
  findButton(frame, '장착 해제').props.onClick();
  await settle();
  tree = harness.render();
  assert.deepEqual(harness.postCalls[0], { url: '/perks/cosmetics', body: { kind: 'title', code: '' } });
  assert.match(textContent(tree), /장착한 칭호 없음/);
  findButton(findCard(tree, '루미아 신입 생존자'), '장착').props.onClick();
  await settle();
  tree = harness.render();
  assert.deepEqual(harness.postCalls[1], { url: '/perks/cosmetics', body: { kind: 'title', code: 'COS_TITLE_ROOKIE' } });
  assert.match(textContent(tree), /프로필과 이터널 헝거 관전 결과에 표시되는 칭호/);
  assert.equal(harness.storedUpdates.length, 3);
  assert.deepEqual(cosmeticPerks.resolveCosmeticPerks({ ...legacy, cosmeticLoadout: { title: 'NOT_OWNED' } }).title, null);
  assert.deepEqual(cosmeticPerks.resolveCosmeticPerks({ ...legacy, cosmeticLoadout: { title: '' } }).title, null);
  assert.deepEqual(cosmeticPerks.resolveCosmeticPerks({ perks: [], cosmetics: { title: { code: 'COS_TITLE_ROOKIE' } } }).title, null);
  assert.equal(cosmeticPerks.mergeProfileBadges([{ name: '기존 우승 배지' }], [{ name: '알파 추적자 배지' }]).length, 2);
}

console.log(JSON.stringify({ pass: true, scenarios: 4 }, null, 2));
