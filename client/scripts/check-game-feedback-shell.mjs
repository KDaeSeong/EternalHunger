import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const clientRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const appRoot = path.join(clientRoot, 'src', 'app');

async function walkJavaScript(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walkJavaScript(fullPath));
    if (entry.isFile() && entry.name.endsWith('.js')) files.push(fullPath);
  }
  return files;
}

function objectKeys(source, declaration) {
  const body = source.match(new RegExp(`const ${declaration} = \\{([\\s\\S]*?)\\n\\};`))?.[1] || '';
  return new Set(
    [...body.matchAll(/^\s*(?:'([^']+)'|([A-Za-z][\w-]*))\s*:/gm)]
      .map((match) => match[1] || match[2]),
  );
}

const preferenceSource = await readFile(
  path.join(appRoot, 'games', '_lib', 'gameSfxPreferences.js'),
  'utf8',
);
const preferenceModule = await import(`data:text/javascript;base64,${Buffer.from(preferenceSource).toString('base64')}`);
const fakeValues = new Map();
const fakeStorage = {
  getItem: (key) => fakeValues.get(key) ?? null,
  setItem: (key, value) => fakeValues.set(key, value),
};

assert.equal(preferenceModule.gameSfxPreferenceKey('School'), 'kei-game-lab:game-sfx:school');
assert.equal(preferenceModule.readGameSfxPreference('school', fakeStorage), true);
preferenceModule.writeGameSfxPreference('school', false, fakeStorage);
assert.equal(preferenceModule.readGameSfxPreference('school', fakeStorage), false);
preferenceModule.writeGameSfxPreference('school', true, fakeStorage);
assert.equal(preferenceModule.readGameSfxPreference('school', fakeStorage), true);

const allFiles = await walkJavaScript(appRoot);
const gameFiles = allFiles.filter((file) => file.includes(`${path.sep}games${path.sep}`));
const feedbackFiles = allFiles.filter((file) => /feedback\.js$/i.test(file));
const gameSources = await Promise.all(gameFiles.map((file) => readFile(file, 'utf8')));
const feedbackSources = await Promise.all(feedbackFiles.map((file) => readFile(file, 'utf8')));
const sfxSource = await readFile(path.join(appRoot, 'games', '_lib', 'useGameSfx.js'), 'utf8');
const shellSource = await readFile(path.join(appRoot, 'games', '_components', 'GamePlayShell.js'), 'utf8');
const primitiveSource = await readFile(path.join(appRoot, 'games', '_components', 'GamePlayPrimitives.js'), 'utf8');
const iconSource = await readFile(path.join(appRoot, 'games', '_components', 'GameActionIcon.js'), 'utf8');

assert.match(shellSource, /<GameSoundControl\s*\/>/, 'The shared game shell must expose its sound control.');
assert.match(
  primitiveSource,
  /resolveGameAction\(action, label, text\)\.kind/,
  'Recent results must infer an icon from their visible context.',
);
assert.match(sfxSource, /audioOn:\s*\[/);
assert.match(sfxSource, /audioOff:\s*\[/);
assert.match(sfxSource, /sync:\s*\[/);
assert.match(sfxSource, /readGameSfxPreference\(resolvedTheme\)/);

const expectedRouteThemes = [
  'dual-academy-tcg',
  'ba-vanguard',
  'primitive-archive',
  'tonkatsu-teacher',
  'schale-idle-rpg',
  'ba-srpg',
  'myanimecraft',
  'school-simulator',
  'si-coding-sim',
  'rail3d-sim',
  'company-report',
  'racing-logos-demo',
];
for (const slug of expectedRouteThemes) {
  assert.ok(sfxSource.includes(`['${slug}',`), `Missing route sound theme: ${slug}`);
}

const iconKeys = objectKeys(iconSource, 'ACTION_ICONS');
const cueKeys = objectKeys(sfxSource, 'CUE_PROFILES');
const feedbackActions = new Set();
const feedbackCues = new Set();
for (const source of feedbackSources) {
  for (const match of source.matchAll(/\baction:\s*['"]([A-Za-z0-9-]+)['"]/g)) feedbackActions.add(match[1]);
  for (const match of source.matchAll(/\bcue:\s*['"]([A-Za-z][\w]*)['"]/g)) {
    if (match[1]) feedbackCues.add(match[1]);
  }
}

const missingFeedbackIcons = [...feedbackActions].filter((action) => !iconKeys.has(action));
const missingFeedbackCues = [...feedbackCues].filter((cue) => !cueKeys.has(cue));
assert.deepEqual(missingFeedbackIcons, [], `Missing feedback icons: ${missingFeedbackIcons.join(', ')}`);
assert.deepEqual(missingFeedbackCues, [], `Missing feedback cues: ${missingFeedbackCues.join(', ')}`);

const resultPanelCount = gameSources.reduce(
  (count, source) => count + [...source.matchAll(/<RecentActionResult\b/g)].length,
  0,
);
assert.ok(resultPanelCount >= 40, 'Expected the shared result icon treatment to cover the existing game panels.');

console.log(JSON.stringify({
  feedbackActions: feedbackActions.size,
  feedbackCues: feedbackCues.size,
  resultPanels: resultPanelCount,
  routeThemes: expectedRouteThemes.length,
  soundPreferenceKey: preferenceModule.gameSfxPreferenceKey('school'),
}, null, 2));
