import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { gameBgmProfile } from '../src/app/games/_lib/gameBgmProfiles.js';
import {
  SCHALE_IDLE_BGM_SCENES,
  SCHALE_IDLE_SOUNDTRACK,
  resolveSchaleIdleBgmScene,
  schaleIdleResultMusic,
} from '../src/app/games/schale-idle-rpg/_lib/schaleIdleSoundtrack.js';

const routeUrl = new URL('../src/app/games/schale-idle-rpg/', import.meta.url);
const pageSource = await readFile(new URL('play/page.js', routeUrl), 'utf8');
const tabsSource = await readFile(new URL('_components/SchaleIdleFeatureTabs.js', routeUrl), 'utf8');
const profileSource = await readFile(new URL('../src/app/games/_lib/gameBgmProfiles.js', import.meta.url), 'utf8');
const themeSource = await readFile(new URL('../src/app/games/_lib/gameAudioThemes.js', import.meta.url), 'utf8');
const iconSource = await readFile(new URL('../src/app/games/_components/GameActionIcon.js', import.meta.url), 'utf8');

assert.equal(SCHALE_IDLE_SOUNDTRACK.length, 7, '샬레 Idle RPG는 7개 상황별 음악 장면을 제공해야 합니다.');
assert.equal(new Set(SCHALE_IDLE_SOUNDTRACK.map((row) => row.theme)).size, 7, '샬레 음악 테마는 중복되면 안 됩니다.');
assert.equal(new Set(SCHALE_IDLE_SOUNDTRACK.map((row) => gameBgmProfile(row.theme).bpm)).size, 7, '장면별 템포는 모두 달라야 합니다.');

const requiredOrchestrationLayers = [
  'bellGain',
  'brassGain',
  'choirGain',
  'cymbalGain',
  'pluckGain',
  'pulseGain',
  'stringGain',
  'timpaniGain',
];

for (const row of SCHALE_IDLE_SOUNDTRACK) {
  const profile = gameBgmProfile(row.theme);
  const loopSeconds = (profile.steps / 16) * 4 * (60 / profile.bpm);
  assert.match(profile.label, /^Schale Idle RPG OST · /, `${row.theme}에는 전용 OST 라벨이 필요합니다.`);
  assert.equal(profile.arrangement.length, 10, `${row.theme}은 10개 구간으로 편곡되어야 합니다.`);
  assert.ok(profile.steps >= 34 * 16, `${row.theme}은 짧은 반복음이 아닌 장편 구조여야 합니다.`);
  assert.ok(loopSeconds >= 70, `${row.theme}의 루프 길이는 70초 이상이어야 합니다.`);
  assert.notEqual(profile.leadWave, 'square', `${row.theme}의 주선율에 각진 사각파를 사용하면 안 됩니다.`);
  for (const layer of requiredOrchestrationLayers) {
    assert.ok(profile.orchestration[layer] > 0, `${row.theme}에 ${layer} 편성이 필요합니다.`);
  }
}

assert.equal(resolveSchaleIdleBgmScene(), SCHALE_IDLE_BGM_SCENES.patrol);
assert.equal(resolveSchaleIdleBgmScene({ activeTabId: 'gear' }), SCHALE_IDLE_BGM_SCENES.workshop);
assert.equal(resolveSchaleIdleBgmScene({ activeTabId: 'plan' }), SCHALE_IDLE_BGM_SCENES.briefing);
assert.equal(resolveSchaleIdleBgmScene({ activeTabId: 'season' }), SCHALE_IDLE_BGM_SCENES.breakthrough);
assert.equal(resolveSchaleIdleBgmScene({ activeTabId: 'records' }), SCHALE_IDLE_BGM_SCENES.reward);
assert.equal(resolveSchaleIdleBgmScene({ stamina: 10 }), SCHALE_IDLE_BGM_SCENES.setback);
assert.equal(resolveSchaleIdleBgmScene({ readinessPct: 25 }), SCHALE_IDLE_BGM_SCENES.setback);
assert.equal(resolveSchaleIdleBgmScene({ riskLabel: '위험' }), SCHALE_IDLE_BGM_SCENES.setback);

assert.equal(schaleIdleResultMusic({ action: 'tower', tone: 'success' })?.theme, SCHALE_IDLE_BGM_SCENES.tower);
assert.equal(schaleIdleResultMusic({ action: 'tower', tone: 'danger' })?.theme, SCHALE_IDLE_BGM_SCENES.setback);
assert.equal(schaleIdleResultMusic({ action: 'claim' })?.theme, SCHALE_IDLE_BGM_SCENES.reward);
assert.equal(schaleIdleResultMusic({ action: 'research' })?.theme, SCHALE_IDLE_BGM_SCENES.breakthrough);
assert.equal(schaleIdleResultMusic({ action: 'craft' })?.theme, SCHALE_IDLE_BGM_SCENES.workshop);
assert.equal(schaleIdleResultMusic({ action: 'settle' })?.theme, SCHALE_IDLE_BGM_SCENES.patrol);
assert.equal(schaleIdleResultMusic({ action: 'rest' })?.theme, SCHALE_IDLE_BGM_SCENES.briefing);
assert.equal(schaleIdleResultMusic({ action: 'warning' })?.theme, SCHALE_IDLE_BGM_SCENES.setback);
assert.equal(schaleIdleResultMusic({ action: 'unknown' }), null);

for (const token of [
  'useGameBgm',
  'resolveSchaleIdleBgmScene',
  'schaleIdleResultMusic',
  'setMusicScene(baseMusicScene)',
  'setMusicScene(transition.theme)',
  'activeTabId: activeFeatureTabId',
]) {
  assert.ok(pageSource.includes(token), `플레이 페이지에 ${token} 연동이 필요합니다.`);
}

assert.ok(tabsSource.includes('activeTabId={activeTabId}'), '샬레 기능 탭은 현재 탭을 외부에서 제어해야 합니다.');
assert.ok(tabsSource.includes('onTabChange={onTabChange}'), '샬레 기능 탭은 탭 변경 이벤트를 전달해야 합니다.');
assert.ok(themeSource.includes("['schale-idle-rpg', 'idle']"), '기존 샬레 효과음 테마는 유지해야 합니다.');

for (const arrangement of [
  'idleBriefing',
  'idlePatrol',
  'idleWorkshop',
  'idleTower',
  'idleBreakthrough',
  'idleReward',
  'idleSetback',
]) {
  assert.ok(profileSource.includes(`${arrangement}: sceneArrangement`), `${arrangement} 장편 편곡이 필요합니다.`);
}

for (const action of SCHALE_IDLE_SOUNDTRACK.map((row) => row.icon)) {
  const iconToken = action.includes('-') ? `'${action}':` : `${action}:`;
  assert.ok(iconSource.includes(iconToken), `${action} 행동 아이콘 매핑이 필요합니다.`);
}

console.log(JSON.stringify({
  soundtrackScenes: SCHALE_IDLE_SOUNDTRACK.length,
  orchestrationLayers: requiredOrchestrationLayers.length,
  profileBars: SCHALE_IDLE_SOUNDTRACK.map((row) => gameBgmProfile(row.theme).steps / 16),
  minimumLoopSeconds: Number(Math.min(...SCHALE_IDLE_SOUNDTRACK.map((row) => {
    const profile = gameBgmProfile(row.theme);
    return (profile.steps / 16) * 4 * (60 / profile.bpm);
  })).toFixed(1)),
  dynamicScenes: true,
}, null, 2));
