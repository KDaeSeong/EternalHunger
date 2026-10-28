import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import ts from 'typescript';
import * as cosmetics from '../src/utils/cosmeticPerks.js';

const Fragment = Symbol('Fragment');
const jsxRuntime = {
  Fragment,
  jsx: (type, props, key) => ({ type, props: { ...(props || {}), ...(key === undefined ? {} : { key }) } }),
  jsxs: (type, props, key) => ({ type, props: { ...(props || {}), ...(key === undefined ? {} : { key }) } }),
};

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

function loadComponent(path, dependency, React) {
  const source = readFileSync(path, 'utf8');
  const code = ts.transpile(source, {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.CommonJS,
    jsx: ts.JsxEmit.ReactJSX,
  });
  const module = { exports: {} };
  new Function('require', 'module', 'exports', code)((specifier) => {
    if (specifier === 'react/jsx-runtime') return jsxRuntime;
    if (specifier === 'react') return React;
    return dependency(specifier);
  }, module, module.exports);
  return module.exports.default;
}

function makeHookHost() {
  let stateCursor = 0;
  const states = [];
  const pendingEffects = [];
  return {
    reset() { stateCursor = 0; pendingEffects.length = 0; },
    pendingEffects,
    useState(initial) {
      const index = stateCursor++;
      if (!(index in states)) states[index] = typeof initial === 'function' ? initial() : initial;
      return [states[index], (next) => { states[index] = typeof next === 'function' ? next(states[index]) : next; }];
    },
    useMemo(callback) { return callback(); },
    useCallback(callback) { return callback; },
    useEffect(callback) { pendingEffects.push(callback); },
  };
}

function profileAccount() {
  return {
    id: 'profile-owner',
    username: 'profile-owner',
    nickname: '치장 주인',
    displayName: '치장 주인',
    profileBio: '기존 소개 유지',
    perks: ['COS_TITLE_ROOKIE', 'COS_FRAME_SKYLINE', 'COS_BADGE_ALPHA'],
    cosmetics: {
      title: { code: 'COS_TITLE_NIGHT_RUNNER' },
      portraitFrame: { code: 'COS_FRAME_GOLDLINE' },
      badges: [{ code: 'COS_BADGE_WEAKLINE' }],
    },
    badges: [{ name: '기존 우승 배지', unlockedAt: '2026-01-01' }],
  };
}

function assertAccountMarkup(tree) {
  const classes = [];
  walk(tree, (node) => { if (node.type === 'span' || node.type === 'strong') classes.push(String(node.props?.className || '')); });
  const content = textContent(tree);
  assert.match(content, /치장 주인/);
  assert.match(content, /루미아 신입 생존자/);
  assert.match(content, /기존 우승 배지/);
  assert.match(content, /알파 추적자 배지/);
  assert.doesNotMatch(content, /위클라인 감시자 배지/);
  assert.ok(classes.some((value) => value.includes('perk-title')));
  let avatar = null;
  walk(tree, (node) => { if (String(node.props?.className || '').includes('account-cosmetic-avatar')) avatar = node; });
  assert.ok(avatar);
  assert.match(avatar.props.className, /perk-frame--skyline/);
  assert.doesNotMatch(avatar.props.className, /goldline/);
}

const ReactAccount = {
  useMemo: (callback) => callback(),
};
const AccountProfileDashboard = loadComponent(
  resolve('src/app/account/_components/AccountProfileDashboard.js'),
  (specifier) => {
    if (specifier === 'next/link') return { default: (props) => jsxRuntime.jsx('a', props) };
    if (specifier === '../_lib/accountUtils') return {
      formatNumber: (value) => Number(value || 0).toLocaleString('ko-KR'),
      formatRate: (value) => `${Math.round(Number(value || 0) * 1000) / 10}%`,
      getDisplayName: (user) => user?.displayName || user?.nickname || user?.username || '사용자',
    };
    if (specifier === '../../../utils/cosmeticPerks') return cosmetics;
    if (specifier === '../../../styles/PerkCosmetics.css') return {};
    throw new Error(`Unexpected account component dependency: ${specifier}`);
  },
);

const accountTree = AccountProfileDashboard({
  activityError: '', activityLoading: false, activityUser: {}, badges: profileAccount().badges,
  bioValue: '기존 소개 유지', isDirty: false, message: '', nextBio: '기존 소개 유지', nicknameValue: '치장 주인',
  publicProfileHref: '/users/profile-owner', saveProfile: () => {}, saving: false, setDraftBio: () => {},
  setDraftNickname: () => {}, summary: { postCount: 0, commentCount: 0 }, totalGames: 0, user: profileAccount(), winRate: 0,
});
assertAccountMarkup(accountTree);

const publicUser = {
  id: 'public-owner', username: 'public-owner', displayName: '공개 유저', profileBio: '공개 소개 유지',
  cosmetics: {
    title: { code: 'COS_TITLE_NIGHT_RUNNER', name: '야간 루퍼', kind: 'title', value: '야간 루퍼' },
    portraitFrame: { code: 'COS_FRAME_GOLDLINE', name: '골드 라인 초상화 프레임', kind: 'portraitFrame', value: 'goldline' },
    logStyle: null, victoryEffect: null,
    badges: [{ code: 'COS_BADGE_WEAKLINE', name: '위클라인 감시자 배지', kind: 'badge', value: 'weakline_watcher' }],
  },
  badges: [{ name: '기존 공개 배지' }],
};
assert.equal(Object.hasOwn(publicUser, 'perks'), false, 'public fixture must not expose private perk ownership');
const profileHarness = makeHookHost();
let loadCalls = 0;
const UserProfilePage = loadComponent(
  resolve('src/app/users/[id]/page.js'),
  (specifier) => {
    if (specifier === 'next/link') return { default: (props) => jsxRuntime.jsx('a', props) };
    if (specifier === 'next/navigation') return { useParams: () => ({ id: 'public-owner' }) };
    if (specifier === 'react') return profileHarness;
    if (specifier === '../../../components/SiteHeader') return { default: () => null };
    if (specifier === '../../../components/ToastProvider') return { useToast: () => ({ showToast: () => {} }) };
    if (specifier === '../../../components/UserFollowPreview') return { default: () => null };
    if (specifier === '../../../utils/api') return {
      apiDelete: async () => ({}), apiPost: async () => ({}), clearApiGetCache: () => {},
      apiGetCached: async () => { loadCalls += 1; return { user: publicUser, viewerFollow: {}, social: {} }; },
    };
    if (specifier === '../../../utils/client-auth') return { useAuthToken: () => null, useHydrated: () => false };
    if (specifier === '../../../utils/cosmeticPerks') return cosmetics;
    if (specifier === '../../../styles/PerkCosmetics.css') return {};
    throw new Error(`Unexpected public profile dependency: ${specifier}`);
  }, profileHarness,
);
profileHarness.useParams = () => ({ id: 'public-owner' });
profileHarness.useToast = () => ({ showToast: () => {} });
profileHarness.useAuthToken = () => null;
profileHarness.useHydrated = () => false;
profileHarness.apiGetCached = async () => ({ user: publicUser, viewerFollow: {}, social: {} });

profileHarness.reset();
let publicTree = UserProfilePage();
const effects = [...profileHarness.pendingEffects];
for (const effect of effects) effect();
await new Promise((resolvePromise) => setTimeout(resolvePromise, 0));
profileHarness.reset();
publicTree = UserProfilePage();
assert.equal(loadCalls, 1);
assert.match(textContent(publicTree), /공개 소개 유지/);
assert.match(textContent(publicTree), /야간 루퍼/);
assert.match(textContent(publicTree), /기존 공개 배지/);
assert.match(textContent(publicTree), /위클라인 감시자 배지/);
let publicAvatar = null;
walk(publicTree, (node) => { if (String(node.props?.className || '').includes('profile-hero-avatar')) publicAvatar = node; });
assert.ok(publicAvatar);
assert.match(publicAvatar.props.className, /perk-frame--goldline/);

assert.equal(cosmetics.resolveCosmeticPerks({
  perks: ['COS_TITLE_ROOKIE'],
  cosmeticLoadout: { title: ' COS_TITLE_ROOKIE ' },
}).title, null, 'whitespace around a slot code remains invalid');
assert.equal(cosmetics.resolveCosmeticPerks({
  cosmetics: { title: { code: 'COS_TITLE_ROOKIE' }, portraitFrame: null, badges: [] },
  cosmeticLoadout: { title: null },
}).title, null, 'an explicit null slot disables the sanitized fallback');

console.log(JSON.stringify({ pass: true, ownProfileRendered: true, publicProfileRendered: true }, null, 2));
