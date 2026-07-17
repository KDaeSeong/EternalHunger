import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const clientRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const profilePath = path.join(clientRoot, 'src', 'app', 'games', '_lib', 'gameBgmProfiles.js');
const soundtrackPath = path.join(clientRoot, 'src', 'app', 'games', 'rail3d-sim', '_lib', 'rail3dSoundtrack.js');
const pagePath = path.join(clientRoot, 'src', 'app', 'games', 'rail3d-sim', 'play', 'page.js');
const schedulePath = path.join(clientRoot, 'src', 'app', 'games', 'rail3d-sim', '_components', 'Rail3dScheduleTab.js');
const enginePath = path.join(clientRoot, 'src', 'app', 'games', 'rail3d-sim', '_lib', 'rail3dEngine.js');
const iconPath = path.join(clientRoot, 'src', 'app', 'games', '_components', 'GameActionIcon.js');
const cssPath = path.join(clientRoot, 'src', 'styles', 'AppShell.css');
const dataRoot = path.join(clientRoot, 'src', 'app', 'games', 'rail3d-sim', '_data');

async function importSource(filePath) {
  const source = await readFile(filePath, 'utf8');
  const encoded = Buffer.from(source).toString('base64');
  return { source, module: await import(`data:text/javascript;base64,${encoded}`) };
}

const [{ module: profiles }, { module: soundtrack }] = await Promise.all([
  importSource(profilePath),
  importSource(soundtrackPath),
]);
const [pageSource, scheduleSource, engineSource, iconSource, cssSource, track, service, segmentData] = await Promise.all([
  readFile(pagePath, 'utf8'),
  readFile(schedulePath, 'utf8'),
  readFile(enginePath, 'utf8'),
  readFile(iconPath, 'utf8'),
  readFile(cssPath, 'utf8'),
  readFile(path.join(dataRoot, 'sampleTrack.json'), 'utf8').then(JSON.parse),
  readFile(path.join(dataRoot, 'sampleService.json'), 'utf8').then(JSON.parse),
  readFile(path.join(dataRoot, 'sampleSegments.json'), 'utf8').then(JSON.parse),
]);

assert.equal(soundtrack.RAIL3D_SOUNDTRACK.length, 6, 'Rail3D OST는 여섯 장면을 가져야 합니다.');
assert.equal(new Set(soundtrack.RAIL3D_SOUNDTRACK.map((row) => row.theme)).size, 6, 'Rail3D OST 테마 키는 중복되면 안 됩니다.');

const expectedBars = {
  'rail-yard': 32,
  'rail-mainline': 40,
  'rail-dispatch': 42,
  'rail-congestion': 44,
  'rail-arrival': 36,
  'rail-archive': 32,
};
const expectedBpm = {
  'rail-yard': 96,
  'rail-mainline': 126,
  'rail-dispatch': 138,
  'rail-congestion': 152,
  'rail-arrival': 118,
  'rail-archive': 82,
};

for (const trackRow of soundtrack.RAIL3D_SOUNDTRACK) {
  const profile = profiles.gameBgmProfile(trackRow.theme);
  assert.equal(profiles.GAME_BGM_PROFILE_KEYS.includes(trackRow.theme), true, `누락된 OST 프로필: ${trackRow.theme}`);
  assert.match(profile.label, /^Rail3D OST · /, `곡명이 OST 형식이 아닙니다: ${trackRow.theme}`);
  assert.equal(profile.icon, trackRow.icon, `곡 장면 아이콘이 일치하지 않습니다: ${trackRow.theme}`);
  assert.equal(profile.bpm, expectedBpm[trackRow.theme], `장면 템포 오류: ${trackRow.theme}`);
  assert.equal(profile.steps / 16, expectedBars[trackRow.theme], `곡 마디 수 오류: ${trackRow.theme}`);
  assert.equal(profile.arrangement.length, 10, `곡은 10개 구간으로 전개되어야 합니다: ${trackRow.theme}`);
  assert.equal(profile.chordVoicing.length >= 4, true, `Rail3D 화음은 4성 이상이어야 합니다: ${trackRow.theme}`);
  assert.equal(profile.chordRoots.length >= 8, true, `화성 진행은 최소 8마디 변주를 가져야 합니다: ${trackRow.theme}`);
  assert.equal(profile.orchestration.stringGain > 0, true, `스트링 레이어가 누락됐습니다: ${trackRow.theme}`);
  assert.equal(profile.orchestration.pulseGain > 0, true, `펄스 레이어가 누락됐습니다: ${trackRow.theme}`);
  assert.equal(profile.orchestration.cymbalGain > 0, true, `심벌 레이어가 누락됐습니다: ${trackRow.theme}`);
  assert.equal(profile.orchestration.ghostGain > 0, true, `고스트 레이어가 누락됐습니다: ${trackRow.theme}`);
  assert.equal(profile.arrangement.some((section) => Array.isArray(section.leadSequence)), true, `주제 변주가 누락됐습니다: ${trackRow.theme}`);
  assert.equal(profile.arrangement.some((section) => Number(section.keyShift || 0) > 0), true, `후반 조성 이동이 누락됐습니다: ${trackRow.theme}`);
  const energies = profile.arrangement.map((section) => Number(section.energy || 0));
  assert.equal(Math.max(...energies) - Math.min(...energies) >= 0.5, true, `구간별 에너지 대비가 부족합니다: ${trackRow.theme}`);
  const loopSeconds = (profile.steps / 16) * 4 * (60 / profile.bpm);
  assert.equal(loopSeconds >= 65, true, `게임 BGM 루프가 너무 짧습니다: ${trackRow.theme}`);
}

const scenes = soundtrack.RAIL3D_BGM_SCENES;
const resolve = soundtrack.resolveRail3dBgmScene;
assert.equal(resolve({ nowS: 0, total: 4 }), scenes.yard);
assert.equal(resolve({ nowS: 30, total: 4 }), scenes.mainline);
assert.equal(resolve({ activeTabId: 'schedule', nowS: 30, total: 4 }), scenes.dispatch);
assert.equal(resolve({ activeTabId: 'log', nowS: 30, total: 4 }), scenes.archive);
assert.equal(resolve({ stopped: 1, nowS: 30, total: 4 }), scenes.congestion);
assert.equal(resolve({ tokenWaits: 1, nowS: 30, total: 4 }), scenes.congestion);
assert.equal(resolve({ completed: 4, total: 4, stopped: 2 }), scenes.arrival);
assert.deepEqual(soundtrack.rail3dResultMusic({ key: 'serviceComplete' }), { theme: scenes.arrival, durationMs: 18_000 });
assert.equal(soundtrack.rail3dResultMusic({ key: 'blockConflict' }).theme, scenes.congestion);
assert.equal(soundtrack.rail3dResultMusic({ key: 'signalAdjust' }).theme, scenes.dispatch);
assert.equal(soundtrack.rail3dResultMusic({ key: 'stationArrive' }).theme, scenes.mainline);
assert.equal(soundtrack.rail3dResultMusic({ key: 'idle' }), null);

assert.equal(track.stations.length, 5, '동서 간선은 5개 역이어야 합니다.');
assert.equal(track.edges.length, 4, '동서 간선은 4개 선로 엣지여야 합니다.');
assert.equal(segmentData.segments.length, 3, '토큰 구간은 서부·중앙·동부 세 구간이어야 합니다.');
assert.equal(service.services.length, 4, '운행 다이아는 네 개 서비스를 가져야 합니다.');
assert.equal(service.trains.length, 4, '운행 다이아는 네 편성을 가져야 합니다.');
assert.deepEqual(new Set(service.services.map((row) => row.direction)), new Set(['동행', '서행']));
for (const serviceRow of service.services) {
  assert.equal(serviceRow.stops.length, 5, `${serviceRow.code}는 5개 역 정차 시각을 가져야 합니다.`);
  assert.equal(Boolean(serviceRow.color), true, `${serviceRow.code} 노선색이 필요합니다.`);
}

assert.match(engineSource, /departuresByStation/, '출발 간격은 출발역별로 계산해야 합니다.');
assert.match(engineSource, /serviceCode:/, '엔진 리포트가 열차 번호를 제공해야 합니다.');
assert.match(engineSource, /function claimsMainline/, '대피선과 본선 점유를 구분하는 판정이 필요합니다.');
assert.match(engineSource, /if \(key && claimsMainline\(advanced\)\)/, '대피선 열차는 본선 블록을 점유하면 안 됩니다.');
assert.match(pageSource, /resolveRail3dBgmScene/, '탭과 운행 상태가 기본 음악 장면에 연결되어야 합니다.');
assert.match(pageSource, /rail3dResultMusic/, '운행 사건이 임시 음악 장면에 연결되어야 합니다.');
assert.match(pageSource, /setMusicScene\(musicTransition\.theme\)/, '사건 트랙 전환이 BGM 공급자에 전달되어야 합니다.');
assert.match(scheduleSource, /rail-timetable-progress/, '운행 다이아에 정차 진행률이 필요합니다.');
assert.match(scheduleSource, /GameActionIcon/, '시간표와 역 운행판에 상태 아이콘이 필요합니다.');
assert.match(scheduleSource, /station\.calls\.slice\(0, 4\)/, '역 운행판은 예정 호출을 표시해야 합니다.');
assert.match(cssSource, /\.rail-timetable-grid/, '운행 다이아 전용 밀집 레이아웃이 필요합니다.');
for (const icon of soundtrack.RAIL3D_SOUNDTRACK.map((row) => row.icon)) {
  const escaped = icon.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  assert.match(iconSource, new RegExp(`\\n  ['\"]?${escaped}['\"]?: `), `${icon} 장면 아이콘 매핑이 필요합니다.`);
}

console.log(JSON.stringify({
  soundtrackScenes: soundtrack.RAIL3D_SOUNDTRACK.length,
  stations: track.stations.length,
  services: service.services.length,
  trains: service.trains.length,
  tokenSegments: segmentData.segments.length,
}, null, 2));
