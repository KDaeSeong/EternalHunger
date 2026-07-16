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
const bgmPreferenceSource = await readFile(
  path.join(appRoot, 'games', '_lib', 'gameBgmPreferences.js'),
  'utf8',
);
const bgmProfileSource = await readFile(
  path.join(appRoot, 'games', '_lib', 'gameBgmProfiles.js'),
  'utf8',
);
const audioThemeSource = await readFile(
  path.join(appRoot, 'games', '_lib', 'gameAudioThemes.js'),
  'utf8',
);
const preferenceModule = await import(`data:text/javascript;base64,${Buffer.from(preferenceSource).toString('base64')}`);
const bgmPreferenceModule = await import(`data:text/javascript;base64,${Buffer.from(bgmPreferenceSource).toString('base64')}`);
const bgmProfileModule = await import(`data:text/javascript;base64,${Buffer.from(bgmProfileSource).toString('base64')}`);
const audioThemeModule = await import(`data:text/javascript;base64,${Buffer.from(audioThemeSource).toString('base64')}`);
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
assert.equal(bgmPreferenceModule.readGameBgmEnabled(fakeStorage), false, 'BGM은 사용자가 켜기 전까지 기본 비활성화여야 합니다.');
bgmPreferenceModule.writeGameBgmEnabled(true, fakeStorage);
assert.equal(bgmPreferenceModule.readGameBgmEnabled(fakeStorage), true);
assert.equal(bgmPreferenceModule.writeGameBgmVolume(1.4, fakeStorage), 1, 'BGM 볼륨은 100%를 넘지 않아야 합니다.');
assert.equal(bgmPreferenceModule.writeGameBgmVolume(-0.2, fakeStorage), 0, 'BGM 볼륨은 0% 아래로 내려가지 않아야 합니다.');
assert.equal(bgmPreferenceModule.writeGameBgmVolume(0.42, fakeStorage), 0.42);
assert.equal(bgmPreferenceModule.readGameBgmVolume(fakeStorage), 0.42);

const allFiles = await walkJavaScript(appRoot);
const gameFiles = allFiles.filter((file) => file.includes(`${path.sep}games${path.sep}`));
const feedbackFiles = allFiles.filter((file) => /feedback\.js$/i.test(file));
const gameSources = await Promise.all(gameFiles.map((file) => readFile(file, 'utf8')));
const feedbackSources = await Promise.all(feedbackFiles.map((file) => readFile(file, 'utf8')));
const sfxSource = await readFile(path.join(appRoot, 'games', '_lib', 'useGameSfx.js'), 'utf8');
const shellSource = await readFile(path.join(appRoot, 'games', '_components', 'GamePlayShell.js'), 'utf8');
const tutorialSource = await readFile(path.join(appRoot, 'games', '_components', 'GameTutorialLauncher.js'), 'utf8');
const soundControlSource = await readFile(path.join(appRoot, 'games', '_components', 'GameSoundControl.js'), 'utf8');
const bgmProviderSource = await readFile(path.join(appRoot, 'games', '_components', 'GameBgmProvider.js'), 'utf8');
const appProvidersSource = await readFile(path.join(clientRoot, 'src', 'components', 'AppProviders.js'), 'utf8');
const primitiveSource = await readFile(path.join(appRoot, 'games', '_components', 'GamePlayPrimitives.js'), 'utf8');
const iconSource = await readFile(path.join(appRoot, 'games', '_components', 'GameActionIcon.js'), 'utf8');

assert.doesNotMatch(shellSource, /GameSoundControl/, '게임 영웅 영역은 공용 오디오 메뉴를 중복 렌더링하면 안 됩니다.');
assert.match(tutorialSource, /gameAudioThemeForPath\(pathname\)/, '튜토리얼이 없는 게임도 경로 테마를 사용해야 합니다.');
assert.match(tutorialSource, /<GameSoundControl theme=\{audioTheme\} \/>/, '모든 테마 지원 게임에 공용 오디오 메뉴가 있어야 합니다.');
assert.match(appProvidersSource, /<GameBgmProvider>/, '앱 공급자는 경로 전환에도 유지되는 BGM 공급자를 포함해야 합니다.');
assert.match(soundControlSource, /type="range"/, '공용 오디오 메뉴는 BGM 볼륨 슬라이더를 제공해야 합니다.');
assert.match(soundControlSource, /toggleMusic/, '공용 오디오 메뉴는 BGM 재생 상태를 전환해야 합니다.');
assert.match(bgmProviderSource, /createOscillator\(\)/, 'BGM은 Web Audio 오실레이터로 합성되어야 합니다.');
assert.match(bgmProviderSource, /createBufferSource\(\)/, 'BGM은 노이즈 기반 드럼 레이어를 합성해야 합니다.');
assert.match(bgmProviderSource, /createStereoPanner\(\)/, 'BGM은 스테레오 위치를 구분해야 합니다.');
assert.match(bgmProviderSource, /createConvolver\(\)/, 'BGM은 합성 리버브 공간을 제공해야 합니다.');
assert.match(bgmProviderSource, /scheduleDrumStep/, 'BGM은 독립 드럼 시퀀서를 사용해야 합니다.');
assert.match(bgmProviderSource, /gameBgmArrangementState/, 'BGM은 장기 섹션 편곡 상태를 사용해야 합니다.');
assert.match(bgmProviderSource, /GAME_BGM_DUCK_EVENT/, 'BGM은 게임 효과음 재생 중 덕킹되어야 합니다.');
assert.match(bgmProviderSource, /visibilitychange/, '숨겨진 탭에서는 BGM 음량을 낮춰야 합니다.');
assert.match(bgmProviderSource, /LOOK_AHEAD_SECONDS/, 'BGM 재생은 일정한 선행 스케줄러를 사용해야 합니다.');
assert.match(
  primitiveSource,
  /resolveGameAction\(action, label, text\)\.kind/,
  'Recent results must infer an icon from their visible context.',
);
assert.match(sfxSource, /audioOn:\s*\[/);
assert.match(sfxSource, /audioOff:\s*\[/);
assert.match(sfxSource, /sync:\s*\[/);
assert.match(sfxSource, /readGameSfxPreference\(resolvedTheme\)/);
assert.match(sfxSource, /resolveGameAudioTheme/, '효과음과 BGM은 같은 경로 테마 해석기를 사용해야 합니다.');
assert.match(sfxSource, /CustomEvent\(GAME_BGM_DUCK_EVENT/, '게임 효과음은 배경음 덕킹 이벤트를 보내야 합니다.');

const expectedRouteThemes = [
  'eternalhunger',
  'simulation',
  'twenty-questions',
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
  assert.ok(audioThemeSource.includes(`['${slug}',`), `Missing route sound theme: ${slug}`);
}

const expectedBgmThemes = [...new Set(expectedRouteThemes.map((slug) => audioThemeModule.gameAudioThemeForPath(`/${slug}`)))];
for (const theme of expectedBgmThemes) {
  const profile = bgmProfileModule.gameBgmProfile(theme);
  assert.equal(profile.label.length > 0, true, `BGM profile label is required: ${theme}`);
  assert.equal(profile.lead.length, 16, `BGM lead loop must contain 16 steps: ${theme}`);
  assert.equal(profile.leadB.length, 16, `BGM alternate lead loop must contain 16 steps: ${theme}`);
  assert.equal(profile.counter.length, 16, `BGM counter melody must contain 16 steps: ${theme}`);
  assert.equal(profile.bass.length, 16, `BGM bass loop must contain 16 steps: ${theme}`);
  assert.equal(profile.arp.length, 16, `BGM arpeggio loop must contain 16 steps: ${theme}`);
  ['kick', 'snare', 'hat', 'perc'].forEach((track) => {
    assert.equal(profile.drums[track].length, 16, `BGM drum track must contain 16 steps: ${theme}/${track}`);
  });
  assert.equal(profile.arrangement.length >= 5, true, `BGM arrangement needs at least five sections: ${theme}`);
  assert.equal(profile.steps >= 192, true, `BGM arrangement must run for at least twelve bars: ${theme}`);
  assert.equal(
    new Set(profile.arrangement.map((section) => section.id)).size,
    profile.arrangement.length,
    `BGM arrangement section ids must be unique: ${theme}`,
  );
  const opening = bgmProfileModule.gameBgmArrangementState(profile, 0);
  const finale = bgmProfileModule.gameBgmArrangementState(profile, profile.steps - 1);
  assert.equal(opening.sectionIndex, 0, `BGM arrangement must begin at the first section: ${theme}`);
  assert.equal(finale.sectionIndex, profile.arrangement.length - 1, `BGM arrangement must end at the final section: ${theme}`);
  assert.equal(Number.isFinite(bgmProfileModule.gameBgmChordRoot(profile, opening)), true, `BGM chord root must resolve: ${theme}`);
  assert.equal(profile.delayMix >= 0 && profile.delayMix <= 0.2, true, `BGM delay mix must be bounded: ${theme}`);
  assert.equal(profile.reverbMix >= 0 && profile.reverbMix <= 0.2, true, `BGM reverb mix must be bounded: ${theme}`);
  assert.equal(bgmProfileModule.gameBgmStepDuration(profile) > 0, true, `BGM step duration must be positive: ${theme}`);
  assert.equal(bgmProfileModule.gameBgmNoteFrequency(profile, 0, 1) > 0, true, `BGM note frequency must be positive: ${theme}`);
}

const arrangementSignatures = new Set(expectedBgmThemes.map((theme) => {
  const profile = bgmProfileModule.gameBgmProfile(theme);
  return JSON.stringify([profile.leadB, profile.counter, profile.drums.kick]);
}));
assert.equal(arrangementSignatures.size >= 10, true, '게임별 BGM 편곡은 충분히 서로 달라야 합니다.');

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
assert.equal(iconKeys.has('music'), true, 'BGM 켜짐 아이콘이 있어야 합니다.');
assert.equal(iconKeys.has('music-off'), true, 'BGM 꺼짐 아이콘이 있어야 합니다.');

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
  bgmThemes: expectedBgmThemes.length,
  bgmArrangementSteps: Math.min(...expectedBgmThemes.map((theme) => bgmProfileModule.gameBgmProfile(theme).steps)),
  bgmLayers: 9,
  bgmDefaultEnabled: bgmPreferenceModule.readGameBgmEnabled(new Map()),
  soundPreferenceKey: preferenceModule.gameSfxPreferenceKey('school'),
}, null, 2));
