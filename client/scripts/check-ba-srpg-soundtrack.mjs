import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const clientRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const profilePath = path.join(clientRoot, 'src', 'app', 'games', '_lib', 'gameBgmProfiles.js');
const soundtrackPath = path.join(clientRoot, 'src', 'app', 'games', 'ba-srpg', '_lib', 'baSrpgSoundtrack.js');
const pagePath = path.join(clientRoot, 'src', 'app', 'games', 'ba-srpg', 'play', 'page.js');
const tabsPath = path.join(clientRoot, 'src', 'app', 'games', 'ba-srpg', '_components', 'BaSrpgFeatureTabs.js');
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

assert.equal(soundtrack.BA_SRPG_SOUNDTRACK.length, 7, 'BA SRPG OST는 일곱 장면을 가져야 합니다.');
assert.equal(
  new Set(soundtrack.BA_SRPG_SOUNDTRACK.map((track) => track.theme)).size,
  7,
  'BA SRPG OST 테마 키는 중복되면 안 됩니다.',
);

const expectedBars = {
  'srpg-command': 36,
  'srpg-deployment': 40,
  'srpg-town': 36,
  'srpg-battle': 44,
  'srpg-crisis': 44,
  'srpg-victory': 36,
  'srpg-defeat': 28,
};

const expectedBpm = {
  'srpg-command': 102,
  'srpg-deployment': 126,
  'srpg-town': 96,
  'srpg-battle': 148,
  'srpg-crisis': 156,
  'srpg-victory': 124,
  'srpg-defeat': 78,
};

assert.equal(profiles.gameBgmProfile('tactical').label, 'BA SRPG', '라우트 기본 BGM 프로필이 필요합니다.');

for (const track of soundtrack.BA_SRPG_SOUNDTRACK) {
  const profile = profiles.gameBgmProfile(track.theme);
  assert.equal(profiles.GAME_BGM_PROFILE_KEYS.includes(track.theme), true, `누락된 OST 프로필: ${track.theme}`);
  assert.match(profile.label, /^BA SRPG OST · /, `곡명이 OST 형식이 아닙니다: ${track.theme}`);
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

const scenes = soundtrack.BA_SRPG_BGM_SCENES;
const resolve = soundtrack.resolveBaSrpgBgmScene;
const battle = ({ phase = 'player', allyHp = 100, allyMaxHp = 100 } = {}) => ({
  phase,
  units: [
    { id: 'a', hp: allyHp, maxHp: allyMaxHp },
    { id: 'b', hp: allyHp, maxHp: allyMaxHp },
    { id: 'c', hp: allyHp, maxHp: allyMaxHp },
    { id: 'd', hp: allyHp, maxHp: allyMaxHp },
  ],
});

assert.equal(resolve({ activeTabId: 'mission', battle: battle() }), scenes.deployment);
assert.equal(resolve({ activeTabId: 'campaign-expansion', battle: battle() }), scenes.command);
assert.equal(resolve({ activeTabId: 'inventory', battle: battle() }), scenes.command);
assert.equal(resolve({ activeTabId: 'town', battle: battle() }), scenes.town);
assert.equal(resolve({ activeTabId: 'battle', battle: battle(), battleForecast: { threatLevel: '안정' } }), scenes.battle);
assert.equal(resolve({ activeTabId: 'battle', battle: battle(), battleForecast: { threatLevel: '위험' } }), scenes.crisis);
assert.equal(resolve({ activeTabId: 'battle', battle: battle({ allyHp: 30 }), battleForecast: { threatLevel: '주의' } }), scenes.crisis);
assert.equal(resolve({ activeTabId: 'town', battle: battle({ phase: 'cleared' }) }), scenes.victory);
assert.equal(resolve({ activeTabId: 'mission', battle: battle({ phase: 'failed' }) }), scenes.defeat);

assert.deepEqual(soundtrack.baSrpgResultMusic({ action: 'deploy', cue: 'deploy' }, 'deploy'), { theme: scenes.deployment, durationMs: 9_000 });
assert.deepEqual(soundtrack.baSrpgResultMusic({ action: 'srpg-event' }, 'missionEventSmoke'), { theme: scenes.crisis, durationMs: 11_000 });
assert.deepEqual(soundtrack.baSrpgResultMusic({ action: 'srpg-objective-command' }, 'objectiveCapture'), { theme: scenes.battle, durationMs: 9_000 });
assert.deepEqual(soundtrack.baSrpgResultMusic({ action: 'property-buy' }, 'propertyBuy'), { theme: scenes.town, durationMs: 8_000 });
assert.deepEqual(soundtrack.baSrpgResultMusic({ action: 'victory' }, 'victory'), { theme: scenes.victory, durationMs: 18_000 });
assert.deepEqual(soundtrack.baSrpgResultMusic({ action: 'defeat' }, 'defeat'), { theme: scenes.defeat, durationMs: 16_000 });
assert.equal(soundtrack.baSrpgResultMusic({ action: 'signal' }, 'select'), null);

assert.match(pageSource, /useGameBgm/, 'BA SRPG 페이지가 동적 음악 공급자를 사용해야 합니다.');
assert.match(pageSource, /resolveBaSrpgBgmScene/, '탭과 전투 상태가 기본 음악 장면에 연결되어야 합니다.');
assert.match(pageSource, /baSrpgResultMusic/, '작전 결과가 임시 음악 장면에 연결되어야 합니다.');
assert.match(pageSource, /cue \? baSrpgResultMusic/, '초기 기록이나 탭 전환이 임시 음악으로 오인되면 안 됩니다.');
assert.match(pageSource, /setMusicScene\(musicTransition\.theme\)/, '작전 장면 전환이 BGM 공급자에 전달되어야 합니다.');
assert.match(pageSource, /activeTabId=\{activeTabId\}/, '현재 기능 탭이 음악 장면 해석에 공유되어야 합니다.');
assert.match(tabsSource, /onTabChange=\{onTabChange\}/, 'BA SRPG 탭 전환을 상위 상태로 알려야 합니다.');
assert.match(soundSource, /tactical: \{ panSpread: 0\.52, reverb: 0\.15 \}/, '전술 전용 스테레오 공간 음향 설정이 필요합니다.');

for (const cue of [
  'deploy', 'formation', 'objectiveCapture', 'missionEvent', 'missionEventHazard',
  'enemyMark', 'enemyBarrage', 'combat', 'reactionShot', 'unitDown',
  'elimination', 'victory', 'defeat',
]) {
  assert.match(soundSource, new RegExp(`\\n    ${cue}: \\[`), `${cue} 전용 다층 효과음이 있어야 합니다.`);
}
for (const icon of soundtrack.BA_SRPG_SOUNDTRACK.map((track) => track.icon)) {
  assert.match(iconSource, new RegExp(`\\n  ['\"]?${icon}['\"]?: `), `${icon} 장면 아이콘 매핑이 있어야 합니다.`);
}

console.log(`BA SRPG soundtrack checks passed (${soundtrack.BA_SRPG_SOUNDTRACK.length} tracks).`);
