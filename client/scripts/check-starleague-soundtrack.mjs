import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const clientRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const profilePath = path.join(clientRoot, 'src', 'app', 'games', '_lib', 'gameBgmProfiles.js');
const soundtrackPath = path.join(clientRoot, 'src', 'app', 'games', 'myanimecraft', '_lib', 'starleagueSoundtrack.js');
const pagePath = path.join(clientRoot, 'src', 'app', 'games', 'myanimecraft', 'play', 'page.js');
const tabsPath = path.join(clientRoot, 'src', 'app', 'games', 'myanimecraft', '_components', 'MyAnimeCraftFeatureTabs.js');
const soundPath = path.join(clientRoot, 'src', 'app', 'games', '_lib', 'useGameSfx.js');
const iconPath = path.join(clientRoot, 'src', 'app', 'games', '_components', 'GameActionIcon.js');

async function importSource(filePath) {
  const source = await readFile(filePath, 'utf8');
  const encoded = Buffer.from(source).toString('base64');
  return { source, module: await import(`data:text/javascript;base64,${encoded}`) };
}

const [{ module: profiles }, { module: soundtrack }] = await Promise.all([
  importSource(profilePath),
  importSource(soundtrackPath),
]);
const [pageSource, tabsSource, soundSource, iconSource] = await Promise.all([
  readFile(pagePath, 'utf8'),
  readFile(tabsPath, 'utf8'),
  readFile(soundPath, 'utf8'),
  readFile(iconPath, 'utf8'),
]);

assert.equal(soundtrack.STARLEAGUE_SOUNDTRACK.length, 7, '스타리그 OST는 일곱 장면을 가져야 합니다.');
assert.equal(
  new Set(soundtrack.STARLEAGUE_SOUNDTRACK.map((track) => track.theme)).size,
  7,
  '스타리그 OST 테마 키는 중복되면 안 됩니다.',
);

const expectedBars = {
  'starleague-office': 32,
  'starleague-broadcast': 40,
  'starleague-personal': 40,
  'starleague-winners': 40,
  'starleague-finals': 44,
  'starleague-ceremony': 36,
  'starleague-archive': 32,
};

const expectedBpm = {
  'starleague-office': 112,
  'starleague-broadcast': 132,
  'starleague-personal': 138,
  'starleague-winners': 146,
  'starleague-finals': 154,
  'starleague-ceremony': 120,
  'starleague-archive': 84,
};

for (const track of soundtrack.STARLEAGUE_SOUNDTRACK) {
  const profile = profiles.gameBgmProfile(track.theme);
  assert.equal(profiles.GAME_BGM_PROFILE_KEYS.includes(track.theme), true, `누락된 OST 프로필: ${track.theme}`);
  assert.match(profile.label, /^스타리그 OST · /, `곡명이 OST 형식이 아닙니다: ${track.theme}`);
  assert.equal(profile.icon, track.icon, `곡 장면 아이콘이 일치하지 않습니다: ${track.theme}`);
  assert.equal(profile.bpm, expectedBpm[track.theme], `장면 템포 오류: ${track.theme}`);
  assert.equal(profile.steps / 16, expectedBars[track.theme], `곡 마디 수 오류: ${track.theme}`);
  assert.equal(profile.lead.length, 16, `A 주제 길이 오류: ${track.theme}`);
  assert.equal(profile.leadB.length, 16, `B 주제 길이 오류: ${track.theme}`);
  assert.equal(profile.leadC.length, 16, `C 주제 길이 오류: ${track.theme}`);
  assert.equal(profile.pulse.length, 16, `리듬 펄스 길이 오류: ${track.theme}`);
  assert.equal(profile.arrangement.length >= 10, true, `곡은 최소 10개 구간으로 전개되어야 합니다: ${track.theme}`);
  assert.equal(profile.fadeInSeconds >= 0.55, true, `곡 시작 페이드가 너무 짧습니다: ${track.theme}`);
  assert.equal(profile.crossfadeSeconds >= 0.55, true, `장면 크로스페이드가 너무 짧습니다: ${track.theme}`);
  assert.equal(profile.chordVoicing.length >= 4, true, `OST 화음은 4성 이상이어야 합니다: ${track.theme}`);
  assert.equal(profile.chordRoots.length >= 8, true, `화성 진행은 최소 8마디 변주를 가져야 합니다: ${track.theme}`);
  assert.equal(profile.orchestration.stringGain > 0, true, `스트링 레이어가 누락됐습니다: ${track.theme}`);
  assert.equal(profile.orchestration.pulseGain > 0, true, `펄스 레이어가 누락됐습니다: ${track.theme}`);
  assert.equal(profile.orchestration.cymbalGain > 0, true, `심벌 레이어가 누락됐습니다: ${track.theme}`);
  assert.equal(profile.orchestration.ghostGain > 0, true, `고스트 스네어 레이어가 누락됐습니다: ${track.theme}`);
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

const scenes = soundtrack.STARLEAGUE_BGM_SCENES;
const resolve = soundtrack.resolveStarleagueBgmScene;
assert.equal(resolve({ activeTabId: 'league' }), scenes.broadcast);
assert.equal(resolve({ activeTabId: 'team' }), scenes.office);
assert.equal(resolve({ activeTabId: 'market' }), scenes.office);
assert.equal(resolve({ activeTabId: 'records' }), scenes.archive);
assert.equal(resolve({ activeTabId: 'league', seasonStage: 'POSTSEASON_READY' }), scenes.finals);
assert.equal(resolve({ activeTabId: 'league', seasonStage: 'POSTSEASON' }), scenes.finals);
assert.equal(resolve({ activeTabId: 'league', ended: true }), scenes.ceremony);
assert.equal(resolve({ activeTabId: 'cups', personalStage: 'IN_PROGRESS' }), scenes.personal);
assert.equal(resolve({ activeTabId: 'cups', personalStage: 'DONE', winnersStage: 'NOT_STARTED' }), scenes.winners);
assert.equal(resolve({ activeTabId: 'cups', personalStage: 'IN_PROGRESS', winnersStage: 'IN_PROGRESS' }), scenes.winners);

assert.deepEqual(
  soundtrack.starleagueResultMusic({ key: 'regularMatch', action: 'comeback' }),
  { theme: scenes.finals, durationMs: 15_000 },
);
assert.deepEqual(
  soundtrack.starleagueResultMusic({ key: 'regularMatch', action: 'match' }),
  { theme: scenes.finals, durationMs: 10_000 },
);
assert.equal(soundtrack.starleagueResultMusic({ key: 'personalMatch' }).theme, scenes.personal);
assert.equal(soundtrack.starleagueResultMusic({ key: 'winnersSet' }).theme, scenes.winners);
assert.equal(soundtrack.starleagueResultMusic({ key: 'seasonChampion' }).theme, scenes.ceremony);
assert.equal(soundtrack.starleagueResultMusic({ key: 'training' }), null);

assert.match(pageSource, /resolveStarleagueBgmScene/, '탭과 리그 상태가 기본 음악 장면에 연결되어야 합니다.');
assert.match(pageSource, /starleagueResultMusic/, '경기 결과가 임시 음악 장면에 연결되어야 합니다.');
assert.match(pageSource, /setMusicScene\(musicTransition\.theme\)/, '결과 트랙 전환이 BGM 공급자에 전달되어야 합니다.');
assert.match(pageSource, /activeTabId=\{activeTabId\}/, '현재 기능 탭이 음악 장면 해석에 공유되어야 합니다.');
assert.match(tabsSource, /onTabChange=\{onTabChange\}/, '스타리그 탭 전환을 상위 상태로 알려야 합니다.');

for (const cue of ['match', 'cupStart', 'cupMatch', 'winnersStart', 'winnersSet', 'verdict', 'comeback', 'victory', 'defeat', 'event', 'champion']) {
  assert.match(soundSource, new RegExp(`\\n    ${cue}: \\[`), `${cue} 중계 테마 효과음이 있어야 합니다.`);
}
for (const icon of soundtrack.STARLEAGUE_SOUNDTRACK.map((track) => track.icon)) {
  assert.match(iconSource, new RegExp(`\\n  ['\"]?${icon}['\"]?: `), `${icon} 장면 아이콘 매핑이 있어야 합니다.`);
}

console.log(`Starleague soundtrack checks passed (${soundtrack.STARLEAGUE_SOUNDTRACK.length} tracks).`);
