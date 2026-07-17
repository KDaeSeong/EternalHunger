import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const clientRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const profilePath = path.join(clientRoot, 'src', 'app', 'games', '_lib', 'gameBgmProfiles.js');
const soundtrackPath = path.join(clientRoot, 'src', 'app', 'simulation', '_lib', 'eternalHungerSoundtrack.js');
const providerPath = path.join(clientRoot, 'src', 'app', 'games', '_components', 'GameBgmProvider.js');
const viewPath = path.join(clientRoot, 'src', 'app', 'simulation', '_components', 'SimulationPageView.js');

async function importSource(filePath) {
  const source = await readFile(filePath, 'utf8');
  const encoded = Buffer.from(source).toString('base64');
  return { source, module: await import(`data:text/javascript;base64,${encoded}`) };
}

const [{ source: profileSource, module: profiles }, { module: soundtrack }] = await Promise.all([
  importSource(profilePath),
  importSource(soundtrackPath),
]);
const [providerSource, viewSource] = await Promise.all([
  readFile(providerPath, 'utf8'),
  readFile(viewPath, 'utf8'),
]);

assert.equal(soundtrack.ETERNAL_HUNGER_SOUNDTRACK.length, 6, '이터널 헝거 OST는 여섯 장면을 모두 가져야 합니다.');
assert.equal(
  new Set(soundtrack.ETERNAL_HUNGER_SOUNDTRACK.map((track) => track.theme)).size,
  6,
  '장면별 OST 테마 키는 중복되면 안 됩니다.',
);

const expectedBars = {
  'eternal-ready': 36,
  'eternal-day': 40,
  'eternal-night': 40,
  'eternal-combat': 44,
  'eternal-final': 48,
  'eternal-result': 32,
};

const expectedBpm = {
  'eternal-ready': 82,
  'eternal-day': 106,
  'eternal-night': 114,
  'eternal-combat': 149,
  'eternal-final': 154,
  'eternal-result': 78,
};

for (const track of soundtrack.ETERNAL_HUNGER_SOUNDTRACK) {
  const profile = profiles.gameBgmProfile(track.theme);
  assert.equal(profiles.GAME_BGM_PROFILE_KEYS.includes(track.theme), true, `누락된 OST 프로필: ${track.theme}`);
  assert.match(profile.label, /^이터널 헝거 OST · /, `곡명이 OST 형식이 아닙니다: ${track.theme}`);
  assert.equal(profile.lead.length, 16, `A 주제 길이 오류: ${track.theme}`);
  assert.equal(profile.leadB.length, 16, `B 주제 길이 오류: ${track.theme}`);
  assert.equal(profile.leadC.length, 16, `C 주제 길이 오류: ${track.theme}`);
  assert.equal(profile.pulse.length, 16, `신스 펄스 길이 오류: ${track.theme}`);
  assert.equal(profile.bpm, expectedBpm[track.theme], `장면 템포 오류: ${track.theme}`);
  assert.equal(profile.steps / 16, expectedBars[track.theme], `곡 마디 수 오류: ${track.theme}`);
  assert.equal(profile.arrangement.length >= 9, true, `곡은 최소 9개 구간으로 전개되어야 합니다: ${track.theme}`);
  assert.equal(profile.fadeInSeconds >= 0.6, true, `곡 시작 페이드가 너무 짧습니다: ${track.theme}`);
  assert.equal(profile.crossfadeSeconds >= 0.5, true, `장면 크로스페이드가 너무 짧습니다: ${track.theme}`);
  assert.equal(profile.chordVoicing.length >= 4, true, `OST 화음은 4성 이상이어야 합니다: ${track.theme}`);
  assert.equal(profile.chordRoots.length >= 8, true, `화성 진행은 최소 8마디 변주를 가져야 합니다: ${track.theme}`);
  assert.equal(profile.orchestration.stringGain > 0, true, `스트링 레이어가 누락됐습니다: ${track.theme}`);
  assert.equal(profile.orchestration.pulseGain > 0, true, `신스 펄스가 누락됐습니다: ${track.theme}`);
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
  assert.equal(loopSeconds >= 70, true, `게임 BGM 루프가 너무 짧습니다: ${track.theme}`);
}

const resolve = soundtrack.resolveEternalHungerBgmScene;
const scenes = soundtrack.ETERNAL_HUNGER_BGM_SCENES;
assert.equal(resolve({ day: 0 }), scenes.ready);
assert.equal(resolve({ day: 1, phase: 'morning', survivorCount: 24 }), scenes.day);
assert.equal(resolve({ day: 2, phase: 'night', survivorCount: 15 }), scenes.night);
assert.equal(resolve({ day: 3, phase: 'morning', survivorCount: 4 }), scenes.final);
assert.equal(resolve({ day: 6, phase: 'morning', survivorCount: 8 }), scenes.final);
assert.equal(resolve({ day: 2, phase: 'night', survivorCount: 0, isGameOver: true }), scenes.result);
assert.equal(soundtrack.eternalHungerCombatMusicDuration({ action: 'rift-battle' }), 14_000);
assert.equal(soundtrack.eternalHungerCombatMusicDuration({ action: 'boss-spawn' }), 10_000);
assert.equal(soundtrack.eternalHungerCombatMusicDuration({ action: 'elimination' }), 0);

assert.match(profileSource, /leadC: freezePattern/, '각 곡 프로필은 C 주제를 보존해야 합니다.');
assert.match(providerSource, /leadKey === 'c'/, 'C 주제를 재생하는 스케줄러 분기가 필요합니다.');
assert.match(providerSource, /scheduleStringEnsemble/, '스트링 앙상블 스케줄러가 필요합니다.');
assert.match(providerSource, /scheduleSynthPulse/, '신스 펄스 스케줄러가 필요합니다.');
assert.match(providerSource, /scheduleRideCymbal/, '심벌 스케줄러가 필요합니다.');
assert.match(providerSource, /scheduleGhostSnare/, '고스트 스네어 스케줄러가 필요합니다.');
assert.match(providerSource, /section\.brightness/, '구간별 밝기 자동화가 필요합니다.');
assert.match(providerSource, /setMusicScene/, 'BGM 공급자는 게임 장면 전환 API를 제공해야 합니다.');
assert.match(providerSource, /profile\.crossfadeSeconds/, '장면별 크로스페이드 시간을 적용해야 합니다.');
assert.match(viewSource, /resolveEternalHungerBgmScene/, '시뮬레이션 상태를 OST 장면에 연결해야 합니다.');
assert.match(viewSource, /eternalHungerCombatMusicDuration/, '특수 교전은 전투 트랙을 임시 재생해야 합니다.');

console.log(`Eternal Hunger soundtrack checks passed (${soundtrack.ETERNAL_HUNGER_SOUNDTRACK.length} tracks).`);
