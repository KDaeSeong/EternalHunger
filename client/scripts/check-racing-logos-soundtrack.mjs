import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  GAME_BGM_LAYER_ROLES,
  gameBgmProfile,
} from '../src/app/games/_lib/gameBgmProfiles.js';
import {
  RACING_LOGOS_BGM_SCENES,
  RACING_LOGOS_SOUNDTRACK,
  racingLogosResultMusic,
  resolveRacingLogosBgmScene,
} from '../src/app/games/racing-logos-demo/_lib/racingLogosSoundtrack.js';

const routeUrl = new URL('../src/app/games/racing-logos-demo/', import.meta.url);
const pageSource = await readFile(new URL('play/page.js', routeUrl), 'utf8');
const profileSource = await readFile(new URL('../src/app/games/_lib/gameBgmProfiles.js', import.meta.url), 'utf8');
const soundSource = await readFile(new URL('../src/app/games/_lib/useGameSfx.js', import.meta.url), 'utf8');
const cssSource = await readFile(new URL('../src/styles/AppShell.css', import.meta.url), 'utf8');
const componentSources = await Promise.all([
  'RacingLogosFeatureTabs.js',
  'RacingLogosAuditTab.js',
  'RacingLogosCalendarTab.js',
  'RacingLogosDataPackTab.js',
  'RacingLogosEventsTab.js',
].map((name) => readFile(new URL(`_components/${name}`, routeUrl), 'utf8')));

assert.equal(RACING_LOGOS_SOUNDTRACK.length, 7, '레이싱 로고 데모는 7개 상황별 음악 장면을 제공해야 합니다.');
assert.equal(new Set(RACING_LOGOS_SOUNDTRACK.map((row) => row.theme)).size, 7, '레이싱 음악 테마는 중복되면 안 됩니다.');
assert.ok(GAME_BGM_LAYER_ROLES.includes('supersaw-lead'), '배경음 엔진은 슈퍼소우 레이어를 제공해야 합니다.');
assert.ok(GAME_BGM_LAYER_ROLES.includes('guitar-stab'), '배경음 엔진은 기타 레이어를 제공해야 합니다.');

for (const row of RACING_LOGOS_SOUNDTRACK) {
  const profile = gameBgmProfile(row.theme);
  assert.match(profile.label, /^레이싱 로고 OST/, `${row.theme}에는 전용 재생 라벨이 필요합니다.`);
  assert.equal(profile.arrangement.length, 10, `${row.theme}은 10개 구간 편곡이어야 합니다.`);
  assert.ok(profile.steps >= 32 * 16, `${row.theme}은 짧은 루프가 아닌 장편 편곡이어야 합니다.`);
  assert.ok(profile.orchestration.pulseGain > 0, `${row.theme}은 엔진 펄스 레이어를 사용해야 합니다.`);
  assert.ok(profile.orchestration.guitarGain > 0, `${row.theme}은 기타 스탭 레이어를 사용해야 합니다.`);
}

assert.equal(resolveRacingLogosBgmScene({ activeTabId: 'audit', eventCount: 4 }), RACING_LOGOS_BGM_SCENES.garage);
assert.equal(resolveRacingLogosBgmScene({ activeTabId: 'local-pack', eventCount: 4 }), RACING_LOGOS_BGM_SCENES.telemetry);
assert.equal(resolveRacingLogosBgmScene({ activeTabId: 'tracks', eventCount: 4 }), RACING_LOGOS_BGM_SCENES.grid);
assert.equal(resolveRacingLogosBgmScene({ activeTabId: 'events', eventCount: 4 }), RACING_LOGOS_BGM_SCENES.circuit);
assert.equal(resolveRacingLogosBgmScene({ activeTabId: 'log', eventCount: 4 }), RACING_LOGOS_BGM_SCENES.archive);
assert.equal(resolveRacingLogosBgmScene({ activeTabId: 'data-pack', eventCount: 4, releaseScore: 95 }), RACING_LOGOS_BGM_SCENES.podium);
assert.equal(resolveRacingLogosBgmScene({ activeTabId: 'events', eventCount: 0 }), RACING_LOGOS_BGM_SCENES.redFlag);

assert.equal(racingLogosResultMusic({ key: 'logoAudit' })?.theme, RACING_LOGOS_BGM_SCENES.telemetry);
assert.equal(racingLogosResultMusic({ key: 'raceCard' })?.theme, RACING_LOGOS_BGM_SCENES.circuit);
assert.equal(racingLogosResultMusic({ key: 'seasonCard' })?.theme, RACING_LOGOS_BGM_SCENES.grid);
assert.equal(racingLogosResultMusic({ key: 'dataPackReady' })?.theme, RACING_LOGOS_BGM_SCENES.podium);
assert.equal(racingLogosResultMusic({ key: 'blocked' })?.theme, RACING_LOGOS_BGM_SCENES.redFlag);
assert.equal(racingLogosResultMusic({ key: 'message' }, 'draftLoaded')?.theme, RACING_LOGOS_BGM_SCENES.telemetry);
assert.equal(racingLogosResultMusic({ key: 'idle' }), null);

for (const token of [
  'useGameBgm',
  'resolveRacingLogosBgmScene',
  'racingLogosResultMusic',
  'setMusicScene(baseMusicScene)',
  'playMusicTransition(presentation, presentation.cue)',
  "playMusicTransition({ key: 'newRun' }, 'start')",
]) {
  assert.ok(pageSource.includes(token), `플레이 페이지에 ${token} 연동이 필요합니다.`);
}

const racingSfxBlock = soundSource.match(/\n  racing: \{([\s\S]*?)\n  \},\n\};/)?.[1] || '';
for (const cue of [
  'start', 'logoAudit', 'logoAuditPerfect', 'packApply', 'packClear',
  'packInvalid', 'raceCard', 'seasonCard', 'dataPackReady', 'draftLoaded',
]) {
  assert.match(racingSfxBlock, new RegExp(`\\n    ${cue}: \\[`), `${cue}는 레이싱 전용 효과음이어야 합니다.`);
}

const joinedComponents = componentSources.join('\n');
assert.ok(joinedComponents.includes('racing-logo-icon-row'), '레이싱 제작 큐와 결과 행에 전용 아이콘 레이아웃이 필요합니다.');
assert.ok(joinedComponents.includes('import GameActionIcon'), '레이싱 결과 행은 의미 기반 아이콘을 사용해야 합니다.');
assert.ok(joinedComponents.includes("icon: 'logo-audit'"), '검수 탭은 감사 아이콘을 사용해야 합니다.');
assert.ok(joinedComponents.includes("icon: 'race-card'"), '이벤트 탭은 레이스 아이콘을 사용해야 합니다.');
assert.ok(cssSource.includes('.game-save-row.racing-logo-icon-row'), '레이싱 아이콘 행 데스크톱 레이아웃이 필요합니다.');
assert.ok(cssSource.includes('.racing-logo-icon-row > .game-action-icon'), '레이싱 아이콘 시각 스타일이 필요합니다.');

for (const arrangement of [
  'racingGarage', 'racingTelemetry', 'racingGrid', 'racingCircuit',
  'racingRedFlag', 'racingPodium', 'racingArchive',
]) {
  assert.ok(profileSource.includes(`${arrangement}: sceneArrangement`), `${arrangement} 장편 편곡이 필요합니다.`);
}

console.log('soundtrackScenes', RACING_LOGOS_SOUNDTRACK.length);
console.log('profileBars', RACING_LOGOS_SOUNDTRACK.map((row) => gameBgmProfile(row.theme).steps / 16).join(','));
console.log('racingSfxCues', 10);
console.log('iconRows', true);
