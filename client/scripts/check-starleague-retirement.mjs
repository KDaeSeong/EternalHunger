import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  GAME_CATALOG, GAME_ROADMAP, GAME_ENTRY_ROUTES, MYANIME_GAME_SLUGS,
  dynamicGameCandidateToGame, findGameBySlug, getAllGames, isRetiredWebGame,
} from '../src/app/games/_lib/gameCatalog.js';
import { gameAudioThemeForPath } from '../src/app/games/_lib/gameAudioThemes.js';
import { getGameTutorialForPath } from '../src/app/games/_lib/gameTutorials.js';
import nextConfig from '../next.config.mjs';

const source = name => readFile(new URL('../src/' + name, import.meta.url), 'utf8');
let checks = 0;
const check = async (name, run) => { await run(); checks++; console.log('PASS ' + name); };

await check('retired game is absent from both hub catalogs and all play entry routes', () => {
  for (const games of [GAME_CATALOG, GAME_ROADMAP, getAllGames()]) {
    assert.equal(games.some(game => isRetiredWebGame(game.slug)), false);
  }
  assert.equal(MYANIME_GAME_SLUGS.includes('myanimecraft'), false);
  assert.equal(GAME_ENTRY_ROUTES.myanimecraft, undefined);
  assert.equal(findGameBySlug('myanimecraft'), null);
});
await check('stale server candidates cannot restore the retired web game', () => {
  for (const slug of ['myanimecraft', ' myanimecraft ', 'MYANIMECRAFT']) {
    assert.equal(dynamicGameCandidateToGame({ slug, title: 'Starleague Sim', stage: 'playable',
      supportsSaves: true, supportsRecords: true, primaryHref: '/games/myanimecraft/play' }), null);
  }
  assert.equal(dynamicGameCandidateToGame({ slug: 'another-game', title: '다른 후보' }).slug, 'another-game');
});
await check('other supported games retain their existing play aliases', () => {
  for (const slug of ['primitive-archive', 'company-report', 'school-simulator', 'ba-vanguard', 'kivotos-autochess', 'infinite-defense']) {
    assert.equal(MYANIME_GAME_SLUGS.includes(slug), true);
    assert.equal(GAME_ENTRY_ROUTES[slug], `/myanime/${slug}/play`);
    assert.equal(findGameBySlug(slug).integration.stage, 'playable');
  }
});
await check('both old play entries render the same notice without importing the league player', async () => {
  const canonical = await source('app/games/myanimecraft/play/page.js');
  const alias = await source('app/myanime/[slug]/play/page.js');
  assert.match(canonical, /export \{ default \} from '\.\.\/\.\.\/_components\/RetiredStarleaguePage'/);
  assert.doesNotMatch(canonical, /myAnimeCraftEngine|GamePlayShell|apiPut|apiPost|useState/);
  assert.match(alias, /if \(isRetiredWebGame\(slug\)\) return <RetiredStarleaguePage \/>/);
  assert.doesNotMatch(alias, /games\/myanimecraft\/play|myanimecraft:\s*dynamic/);
});
await check('the former canonical address can reach its notice instead of the old hub redirect', async () => {
  const redirects = await nextConfig.redirects();
  assert.equal(redirects.some(row => row.source === '/games/myanimecraft/play'), false);
  assert.ok(redirects.some(row => row.source === '/simulation'));
});
await check('the notice keeps historical records and saves accessible without mutating data', async () => {
  const notice = await source('app/games/_components/RetiredStarleaguePage.js');
  assert.match(notice, /스타리그 웹 플레이 종료/);
  assert.match(notice, /마이애니메이션크래프트는 별도 앱으로 개발/);
  assert.match(notice, /\/games\/records\?gameSlug=myanimecraft/);
  assert.match(notice, /\/games\/saves\?gameSlug=myanimecraft/);
  assert.doesNotMatch(notice, /apiPost|apiPut|apiDelete|localStorage|indexedDB|myAnimeCraftEngine|GamePlayShell/);
});
await check('cached game tiles no longer expose a play action', async () => {
  assert.match(await source('app/games/_components/GamesHubCards.js'), /if \(isRetiredWebGame\(game\?\.slug\)\) return ''/);
});
await check('old play routes no longer select Starleague sound or tutorials', async () => {
  for (const pathname of ['/games/myanimecraft/play', '/myanime/myanimecraft/play']) {
    assert.equal(gameAudioThemeForPath(pathname), '');
    assert.equal(getGameTutorialForPath(pathname), null);
  }
  assert.equal(gameAudioThemeForPath('/myanime/primitive-archive/play'), 'civilization');
  assert.doesNotMatch(await source('app/games/_lib/gameTutorials.js'), /myanimecraft:\s*\{/);
});
console.log(JSON.stringify({ checks, status: 'passed', scope: 'Retired web entry, active catalogs, stale candidates and data-preserving notice; native project and historical data retained.' }));
