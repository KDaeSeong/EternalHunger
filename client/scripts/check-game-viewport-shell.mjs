import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const clientRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceRoot = path.join(clientRoot, 'src');

async function source(relativePath) {
  return readFile(path.join(sourceRoot, relativePath), 'utf8');
}

const shellSource = await source('app/games/_components/GamePlayShell.js');
const appShellCss = await source('styles/AppShell.css');
const twentyCss = await source('styles/TwentyQuestions.css');
const tcgPageSource = await source('app/games/dual-academy-tcg/play/page.js');
const twentyLobbySource = await source('app/twenty-questions/page.js');
const twentyRoomSource = await source('app/twenty-questions/_components/TwentyQuestionsRoomContent.js');
const simulationCss = await source('styles/ERSimulation.css');

assert.match(shellSource, /viewport = true/, 'The shared play shell must default to viewport mode.');
assert.match(shellSource, /games-page-shell--viewport/, 'The shared play shell must expose its viewport class.');
assert.match(shellSource, /games-play-chrome/, 'The shared play shell must separate compact status chrome.');
assert.match(shellSource, /games-play-workspace/, 'The shared play shell must own a bounded play workspace.');
assert.match(shellSource, /game-feature-tabs__panel/, 'Shared feature tabs must expose a bounded content panel.');

for (const selector of [
  '.games-page-shell--viewport',
  '.games-play-chrome',
  '.games-play-workspace',
  '.games-play-workspace .game-feature-tabs__panel',
  '.tcg-page-shell--viewport',
  '.tcg-play-workspace',
]) {
  assert.ok(appShellCss.includes(selector), `Missing viewport layout selector: ${selector}`);
}
assert.match(appShellCss, /height:\s*100dvh/, 'Desktop game workspaces must follow the dynamic viewport height.');
assert.match(appShellCss, /overflow:\s*hidden/, 'The page shell must contain overflow instead of extending the document.');
assert.match(appShellCss, /overscroll-behavior:\s*contain/, 'Scrollable game panels must contain wheel and touch scrolling.');
assert.match(appShellCss, /@media \(max-width: 760px\)[\s\S]*height:\s*auto/, 'Small screens must return to safe document flow.');
assert.match(appShellCss, /\.primitive-archive-workspace \.games-action-dock\s*\{[\s\S]*?top:\s*0/, 'Civilization Archive actions must start at the top of the bounded panel.');
assert.match(appShellCss, /\.primitive-world-map-canvas\s*\{[\s\S]*?width:\s*min\(100%,\s*800px\)/, 'Civilization Archive map width must stay bounded on wide desktops.');
assert.match(appShellCss, /\.primitive-archive-page-shell \.games-play-workspace\s*\{[\s\S]*?width:\s*min\(100%,\s*1440px\)/, 'Civilization Archive must cap its desktop workspace width.');
assert.match(appShellCss, /\.primitive-archive-workspace \.game-feature-tabs__panel > \*\s*\{[\s\S]*?width:\s*min\(100%,\s*1320px\)/, 'Civilization Archive tab contents must remain readable on wide displays.');
assert.match(appShellCss, /\.primitive-world-map-canvas\s*\{[\s\S]*?width:\s*min\(100%,\s*560px\)/, 'Civilization Archive map must use the compact desktop canvas.');
assert.match(appShellCss, /\.primitive-party-list\s*\{[\s\S]*?grid-template-columns:\s*repeat\(3/, 'Civilization Archive party cards must use a compact desktop grid.');
assert.match(appShellCss, /\.primitive-inventory-grid\s*\{[\s\S]*?auto-fill/, 'Civilization Archive inventory cards must not stretch across the viewport.');
assert.match(appShellCss, /\.games-rank-split\.primitive-tribe-stats\s*\{[\s\S]*?minmax\(110px,\s*180px\)/, 'Civilization Archive tribe statistics must not stretch across the viewport.');
assert.match(appShellCss, /\.primitive-report-workspace\s*\{[\s\S]*?grid-template-columns:/, 'Civilization Archive reports must use a dense wide-screen grid.');

assert.match(tcgPageSource, /tcg-page-shell--viewport/, 'Dual Academy TCG must use its viewport shell.');
assert.match(tcgPageSource, /tcg-play-workspace/, 'Dual Academy TCG must bound the active feature panel.');
assert.match(twentyLobbySource, /twenty-page--viewport twenty-page--lobby/, 'Twenty Questions lobby must use viewport mode.');
assert.match(twentyRoomSource, /twenty-page--viewport twenty-page--room/, 'Twenty Questions room must use viewport mode.');
assert.match(twentyCss, /\.twenty-page--lobby \.twenty-room-grid[\s\S]*overflow:\s*auto/, 'The room list must scroll inside the lobby workspace.');
assert.match(twentyCss, /\.twenty-page--room \.twenty-shell[\s\S]*overflow:\s*auto/, 'The room detail must scroll inside its workspace.');
assert.match(simulationCss, /\.simulation-page[\s\S]*height:\s*100dvh/, 'Eternal Hunger must remain a viewport-height simulation shell.');

const sharedShellConsumers = [
  'app/games/ba-srpg/play/page.js',
  'app/games/ba-vanguard/_components/BaVanguardPlayContent.js',
  'app/games/company-report/play/page.js',
  'app/games/myanimecraft/play/page.js',
  'app/games/primitive-archive/_components/PrimitiveArchivePlayContent.js',
  'app/games/racing-logos-demo/play/page.js',
  'app/games/rail3d-sim/play/page.js',
  'app/games/schale-idle-rpg/play/page.js',
  'app/games/school-simulator/play/page.js',
  'app/games/si-coding-sim/play/page.js',
  'app/games/tonkatsu-teacher/play/page.js',
];

for (const relativePath of sharedShellConsumers) {
  assert.match(await source(relativePath), /<GamePlayShell/, `Missing shared viewport shell: ${relativePath}`);
}

console.log(JSON.stringify({
  sharedShellGames: sharedShellConsumers.length,
  customViewportGames: ['dual-academy-tcg', 'twenty-questions', 'eternalhunger'],
  desktopOverflow: 'internal-panels',
  mobileFallback: 'document-flow',
}, null, 2));
