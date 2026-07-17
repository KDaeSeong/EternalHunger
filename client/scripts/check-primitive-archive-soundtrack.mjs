import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const clientRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const profilePath = path.join(clientRoot, 'src', 'app', 'games', '_lib', 'gameBgmProfiles.js');
const soundtrackPath = path.join(clientRoot, 'src', 'app', 'games', 'primitive-archive', '_lib', 'primitiveArchiveSoundtrack.js');
const playPath = path.join(clientRoot, 'src', 'app', 'games', 'primitive-archive', '_components', 'PrimitiveArchivePlayContent.js');
const tabsPath = path.join(clientRoot, 'src', 'app', 'games', 'primitive-archive', '_components', 'PrimitiveArchiveFeatureTabs.js');
const providerPath = path.join(clientRoot, 'src', 'app', 'games', '_components', 'GameBgmProvider.js');
const soundControlPath = path.join(clientRoot, 'src', 'app', 'games', '_components', 'GameSoundControl.js');

async function importSource(filePath) {
  const source = await readFile(filePath, 'utf8');
  const encoded = Buffer.from(source).toString('base64');
  return { source, module: await import(`data:text/javascript;base64,${encoded}`) };
}

const [{ module: profiles }, { module: soundtrack }] = await Promise.all([
  importSource(profilePath),
  importSource(soundtrackPath),
]);
const [playSource, tabsSource, providerSource, soundControlSource] = await Promise.all([
  readFile(playPath, 'utf8'),
  readFile(tabsPath, 'utf8'),
  readFile(providerPath, 'utf8'),
  readFile(soundControlPath, 'utf8'),
]);

assert.equal(soundtrack.PRIMITIVE_ARCHIVE_SOUNDTRACK.length, 7, '문명 아카이브 OST는 일곱 장면을 가져야 합니다.');
assert.equal(
  new Set(soundtrack.PRIMITIVE_ARCHIVE_SOUNDTRACK.map((track) => track.theme)).size,
  7,
  '장면별 OST 테마 키는 중복되면 안 됩니다.',
);

const expectedBars = {
  'archive-survival': 36,
  'archive-frontier': 40,
  'archive-insight': 36,
  'archive-settlement': 40,
  'archive-crisis': 40,
  'archive-era': 32,
  'archive-legacy': 32,
};

const expectedBpm = {
  'archive-survival': 78,
  'archive-frontier': 94,
  'archive-insight': 88,
  'archive-settlement': 104,
  'archive-crisis': 126,
  'archive-era': 112,
  'archive-legacy': 72,
};

for (const track of soundtrack.PRIMITIVE_ARCHIVE_SOUNDTRACK) {
  const profile = profiles.gameBgmProfile(track.theme);
  assert.equal(profiles.GAME_BGM_PROFILE_KEYS.includes(track.theme), true, `누락된 OST 프로필: ${track.theme}`);
  assert.match(profile.label, /^문명 아카이브 OST · /, `곡명이 OST 형식이 아닙니다: ${track.theme}`);
  assert.equal(profile.icon, track.icon, `곡 장면 아이콘이 일치하지 않습니다: ${track.theme}`);
  assert.equal(profile.lead.length, 16, `A 주제 길이 오류: ${track.theme}`);
  assert.equal(profile.leadB.length, 16, `B 주제 길이 오류: ${track.theme}`);
  assert.equal(profile.leadC.length, 16, `C 주제 길이 오류: ${track.theme}`);
  assert.equal(profile.pulse.length, 16, `리듬 펄스 길이 오류: ${track.theme}`);
  assert.equal(profile.bpm, expectedBpm[track.theme], `장면 템포 오류: ${track.theme}`);
  assert.equal(profile.steps / 16, expectedBars[track.theme], `곡 마디 수 오류: ${track.theme}`);
  assert.equal(profile.arrangement.length >= 9, true, `곡은 최소 9개 구간으로 전개되어야 합니다: ${track.theme}`);
  assert.equal(profile.fadeInSeconds >= 0.6, true, `곡 시작 페이드가 너무 짧습니다: ${track.theme}`);
  assert.equal(profile.crossfadeSeconds >= 0.5, true, `장면 크로스페이드가 너무 짧습니다: ${track.theme}`);
  assert.equal(profile.chordVoicing.length >= 4, true, `OST 화음은 4성 이상이어야 합니다: ${track.theme}`);
  assert.equal(profile.chordRoots.length >= 8, true, `화성 진행은 최소 8마디 변주를 가져야 합니다: ${track.theme}`);
  assert.equal(profile.orchestration.stringGain > 0, true, `스트링 레이어가 누락됐습니다: ${track.theme}`);
  assert.equal(profile.orchestration.pulseGain > 0, true, `펄스 레이어가 누락됐습니다: ${track.theme}`);
  assert.equal(profile.orchestration.cymbalGain > 0, true, `심벌 레이어가 누락됐습니다: ${track.theme}`);
  assert.equal(
    profile.arrangement.some((section) => Array.isArray(section.leadSequence)),
    true,
    `마디별 주제 변주가 누락됐습니다: ${track.theme}`,
  );
  assert.equal(
    profile.arrangement.some((section) => Number(section.keyShift || 0) > 0),
    true,
    `후반 조성 이동이 누락됐습니다: ${track.theme}`,
  );
  const energies = profile.arrangement.map((section) => Number(section.energy || 0));
  assert.equal(
    Math.max(...energies) - Math.min(...energies) >= 0.5,
    true,
    `구간별 에너지 대비가 부족합니다: ${track.theme}`,
  );
  const loopSeconds = (profile.steps / 16) * 4 * (60 / profile.bpm);
  assert.equal(loopSeconds >= 65, true, `게임 BGM 루프가 너무 짧습니다: ${track.theme}`);
}

const scenes = soundtrack.PRIMITIVE_ARCHIVE_BGM_SCENES;
const resolve = soundtrack.resolvePrimitiveArchiveBgmScene;
assert.equal(resolve({ activeTabId: 'actions' }), scenes.survival);
assert.equal(resolve({ activeTabId: 'map' }), scenes.frontier);
assert.equal(resolve({ activeTabId: 'growth' }), scenes.insight);
assert.equal(resolve({ activeTabId: 'camp' }), scenes.settlement);
assert.equal(resolve({ activeTabId: 'tribe' }), scenes.settlement);
assert.equal(resolve({ activeTabId: 'map', hp: 35 }), scenes.crisis);
assert.equal(resolve({ activeTabId: 'growth', hunger: 70 }), scenes.crisis);
assert.equal(resolve({ activeTabId: 'camp', bodyTemp: 35.4 }), scenes.crisis);
assert.equal(resolve({ activeTabId: 'actions', ended: true }), scenes.legacy);
assert.equal(resolve({ activeTabId: 'actions', victory: true }), scenes.legacy);
assert.equal(soundtrack.primitiveArchiveCrisisLevel({ hp: 20, hunger: 80 }), 2);
assert.deepEqual(soundtrack.primitiveArchiveMilestoneMusic('eraAdvance'), { theme: scenes.era, durationMs: 15_000 });
assert.deepEqual(soundtrack.primitiveArchiveMilestoneMusic('discover'), { theme: scenes.frontier, durationMs: 9_000 });
assert.equal(soundtrack.primitiveArchiveMilestoneMusic('complete').theme, scenes.insight);
assert.equal(soundtrack.primitiveArchiveMilestoneMusic('growth').theme, scenes.settlement);
assert.equal(soundtrack.primitiveArchiveMilestoneMusic('season'), null);

assert.match(playSource, /resolvePrimitiveArchiveBgmScene/, '플레이 상태가 기본 음악 장면에 연결되어야 합니다.');
assert.match(playSource, /primitiveArchiveMilestoneMusic/, '발견과 발전 이정표가 임시 음악 장면에 연결되어야 합니다.');
assert.match(playSource, /setMusicScene\(musicTransition\.theme\)/, '이정표 트랙 전환이 실제 공급자에 전달되어야 합니다.');
assert.match(playSource, /activeTabId=\{activeTabId\}/, '현재 기능 탭이 음악 장면 해석에 공유되어야 합니다.');
assert.match(tabsSource, /onTabChange=\{setActiveTabId\}/, '문명 아카이브 탭 전환을 상위 상태로 알려야 합니다.');
assert.match(providerSource, /icon: activeProfile\.icon/, 'BGM 공급자는 현재 곡의 장면 아이콘을 노출해야 합니다.');
assert.match(soundControlSource, /games-audio-menu__now-playing/, '오디오 메뉴는 현재 곡 정보를 표시해야 합니다.');
assert.match(soundControlSource, /musicIcon/, '오디오 메뉴는 현재 장면 아이콘을 표시해야 합니다.');

console.log(`Primitive Archive soundtrack checks passed (${soundtrack.PRIMITIVE_ARCHIVE_SOUNDTRACK.length} tracks).`);
