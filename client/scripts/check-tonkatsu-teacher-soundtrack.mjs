import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const clientRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const profilePath = path.join(clientRoot, 'src', 'app', 'games', '_lib', 'gameBgmProfiles.js');
const soundtrackPath = path.join(clientRoot, 'src', 'app', 'games', 'tonkatsu-teacher', '_lib', 'tonkatsuTeacherSoundtrack.js');
const pagePath = path.join(clientRoot, 'src', 'app', 'games', 'tonkatsu-teacher', 'play', 'page.js');
const tabsPath = path.join(clientRoot, 'src', 'app', 'games', 'tonkatsu-teacher', '_components', 'TonkatsuTeacherFeatureTabs.js');
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
const [pageSource, tabsSource, iconSource] = await Promise.all([
  readFile(pagePath, 'utf8'),
  readFile(tabsPath, 'utf8'),
  readFile(iconPath, 'utf8'),
]);

assert.equal(soundtrack.TONKATSU_TEACHER_SOUNDTRACK.length, 8, '돈까스 선생님 OST는 8개 상황 장면이어야 합니다.');
assert.equal(
  new Set(soundtrack.TONKATSU_TEACHER_SOUNDTRACK.map((track) => track.theme)).size,
  8,
  '돈까스 선생님 OST 테마는 중복되면 안 됩니다.',
);

const expectedBars = {
  'tonkatsu-opening': 36,
  'tonkatsu-kitchen': 40,
  'tonkatsu-service': 36,
  'tonkatsu-growth': 36,
  'tonkatsu-contest': 44,
  'tonkatsu-judge': 40,
  'tonkatsu-celebration': 36,
  'tonkatsu-setback': 28,
};

const expectedBpm = {
  'tonkatsu-opening': 104,
  'tonkatsu-kitchen': 132,
  'tonkatsu-service': 118,
  'tonkatsu-growth': 108,
  'tonkatsu-contest': 148,
  'tonkatsu-judge': 126,
  'tonkatsu-celebration': 124,
  'tonkatsu-setback': 78,
};

for (const track of soundtrack.TONKATSU_TEACHER_SOUNDTRACK) {
  const profile = profiles.gameBgmProfile(track.theme);
  assert.equal(profiles.GAME_BGM_PROFILE_KEYS.includes(track.theme), true, `누락된 OST 프로필: ${track.theme}`);
  assert.match(profile.label, /^돈까스 선생님 OST · /, `곡명이 OST 형식이 아닙니다: ${track.theme}`);
  assert.equal(profile.icon, track.icon, `곡과 장면 아이콘이 일치하지 않습니다: ${track.theme}`);
  assert.equal(profile.bpm, expectedBpm[track.theme], `장면 템포 오류: ${track.theme}`);
  assert.equal(profile.steps / 16, expectedBars[track.theme], `곡 마디 수 오류: ${track.theme}`);
  assert.equal(profile.lead.length, 16, `A 주제 길이 오류: ${track.theme}`);
  assert.equal(profile.leadB.length, 16, `B 주제 길이 오류: ${track.theme}`);
  assert.equal(profile.leadC.length, 16, `C 주제 길이 오류: ${track.theme}`);
  assert.equal(profile.pulse.length, 16, `리듬 펄스 길이 오류: ${track.theme}`);
  assert.equal(profile.arrangement.length, 10, `곡은 10개 구간으로 전개되어야 합니다: ${track.theme}`);
  assert.equal(profile.fadeInSeconds >= 0.55, true, `곡 시작 페이드가 너무 짧습니다: ${track.theme}`);
  assert.equal(profile.crossfadeSeconds >= 0.55, true, `장면 교차 페이드가 너무 짧습니다: ${track.theme}`);
  assert.equal(profile.chordVoicing.length >= 4, true, `OST 화음은 4성 이상이어야 합니다: ${track.theme}`);
  assert.equal(profile.chordRoots.length >= 8, true, `화성 진행은 8마디 이상이어야 합니다: ${track.theme}`);

  for (const layer of [
    'stringGain', 'pulseGain', 'cymbalGain', 'ghostGain',
    'leadStackGain', 'pluckGain', 'guitarGain', 'timpaniGain', 'hybridGain',
  ]) {
    assert.equal(profile.orchestration[layer] > 0, true, `${layer} 레이어가 누락됐습니다: ${track.theme}`);
  }

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

const scenes = soundtrack.TONKATSU_TEACHER_BGM_SCENES;
const resolve = soundtrack.resolveTonkatsuTeacherBgmScene;
const stableState = { ended: false };
const stableOperations = { readinessPct: 72 };

assert.equal(resolve({ activeTabId: 'kitchen', state: stableState, operationsReport: stableOperations }), scenes.kitchen);
assert.equal(resolve({ activeTabId: 'students', state: stableState, operationsReport: stableOperations }), scenes.service);
assert.equal(resolve({ activeTabId: 'production', state: stableState, operationsReport: stableOperations }), scenes.service);
assert.equal(resolve({ activeTabId: 'growth', state: stableState, operationsReport: stableOperations }), scenes.growth);
assert.equal(resolve({ activeTabId: 'judge', state: stableState, operationsReport: stableOperations }), scenes.judge);
assert.equal(resolve({ activeTabId: 'operations', state: stableState, operationsReport: stableOperations }), scenes.opening);
assert.equal(resolve({ activeTabId: 'advanced', state: stableState, operationsReport: { readinessPct: 18 } }), scenes.setback);
assert.equal(resolve({ activeTabId: 'kitchen', state: { ended: true }, operationsReport: stableOperations }), scenes.celebration);
assert.equal(resolve({
  activeTabId: 'operations',
  state: stableState,
  operationsReport: stableOperations,
  judge: { match: { resolved: false } },
}), scenes.judge);

const resultMusic = soundtrack.tonkatsuTeacherResultMusic;
assert.deepEqual(resultMusic({ key: 'newRun' }), { theme: scenes.opening, durationMs: 8_000 });
assert.deepEqual(resultMusic({ key: 'cook' }), { theme: scenes.kitchen, durationMs: 7_000 });
assert.deepEqual(resultMusic({ key: 'cookFail' }), { theme: scenes.setback, durationMs: 9_000 });
assert.deepEqual(resultMusic({ key: 'serve' }), { theme: scenes.service, durationMs: 8_000 });
assert.deepEqual(resultMusic({ key: 'research' }), { theme: scenes.growth, durationMs: 9_000 });
assert.deepEqual(resultMusic({ key: 'battleVictory' }), { theme: scenes.contest, durationMs: 11_000 });
assert.deepEqual(resultMusic({ key: 'judgeCorrect' }), { theme: scenes.judge, durationMs: 10_000 });
assert.deepEqual(resultMusic({ key: 'tournamentWin' }), { theme: scenes.celebration, durationMs: 18_000 });
assert.equal(resultMusic({ key: 'idle' }), null);

assert.match(pageSource, /useGameBgm/, '플레이 페이지가 동적 음악 공급자를 사용해야 합니다.');
assert.match(pageSource, /resolveTonkatsuTeacherBgmScene/, '기능 탭과 운영 상태가 기본 음악 장면에 연결되어야 합니다.');
assert.match(pageSource, /tonkatsuTeacherResultMusic/, '운영 결과가 임시 음악 장면에 연결되어야 합니다.');
assert.match(pageSource, /setMusicScene\(musicTransition\.theme\)/, '결과 장면 전환을 BGM 공급자에 전달해야 합니다.');
assert.match(pageSource, /activeTabId=\{activeTabId\}/, '현재 기능 탭을 제어 상태로 전달해야 합니다.');
assert.match(tabsSource, /activeTabId=\{activeTabId\}/, '기능 탭은 제어된 활성 탭을 사용해야 합니다.');
assert.match(tabsSource, /onTabChange=\{onTabChange\}/, '기능 탭 전환을 상위 상태로 전달해야 합니다.');

for (const icon of soundtrack.TONKATSU_TEACHER_SOUNDTRACK.map((track) => track.icon)) {
  assert.match(iconSource, new RegExp(`\\n  ['"]${icon}['"]: `), `${icon} 장면 아이콘 매핑이 있어야 합니다.`);
}

console.log(`Tonkatsu Teacher soundtrack checks passed (${soundtrack.TONKATSU_TEACHER_SOUNDTRACK.length} tracks).`);
