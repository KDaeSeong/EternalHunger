import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  GAME_BGM_LAYER_ROLES,
  gameBgmProfile,
} from '../src/app/games/_lib/gameBgmProfiles.js';
import {
  SCHOOL_SIMULATOR_BGM_SCENES,
  SCHOOL_SIMULATOR_SOUNDTRACK,
  resolveSchoolSimulatorBgmScene,
  schoolSimulatorResultMusic,
} from '../src/app/games/school-simulator/_lib/schoolSimulatorSoundtrack.js';

const routeUrl = new URL('../src/app/games/school-simulator/', import.meta.url);
const pageSource = await readFile(new URL('play/page.js', routeUrl), 'utf8');
const featureSource = await readFile(new URL('_components/SchoolSimulatorFeatureTabs.js', routeUrl), 'utf8');
const profileSource = await readFile(new URL('../src/app/games/_lib/gameBgmProfiles.js', import.meta.url), 'utf8');
const soundSource = await readFile(new URL('../src/app/games/_lib/useGameSfx.js', import.meta.url), 'utf8');
const cssSource = await readFile(new URL('../src/styles/AppShell.css', import.meta.url), 'utf8');

assert.equal(SCHOOL_SIMULATOR_SOUNDTRACK.length, 8, '학교 시뮬레이터는 8개 상황별 음악 장면을 제공해야 합니다.');
assert.equal(new Set(SCHOOL_SIMULATOR_SOUNDTRACK.map((row) => row.theme)).size, 8, '학교 음악 테마는 중복되면 안 됩니다.');
assert.ok(GAME_BGM_LAYER_ROLES.includes('bell-accent'), '배경음 엔진은 벨 레이어를 제공해야 합니다.');
assert.ok(GAME_BGM_LAYER_ROLES.includes('string-ensemble'), '배경음 엔진은 스트링 레이어를 제공해야 합니다.');

for (const row of SCHOOL_SIMULATOR_SOUNDTRACK) {
  const profile = gameBgmProfile(row.theme);
  assert.match(profile.label, /^학교 시뮬레이터 OST/, `${row.theme}에는 전용 재생 라벨이 필요합니다.`);
  assert.equal(profile.arrangement.length, 10, `${row.theme}은 10개 구간 편곡이어야 합니다.`);
  assert.ok(profile.steps >= 32 * 16, `${row.theme}은 짧은 루프가 아닌 장편 편곡이어야 합니다.`);
  assert.ok(profile.orchestration.stringGain > 0, `${row.theme}은 스트링 레이어를 사용해야 합니다.`);
  assert.ok(profile.orchestration.bellGain > 0, `${row.theme}은 학교 벨 레이어를 사용해야 합니다.`);
  assert.ok(profile.orchestration.pluckGain > 0, `${row.theme}은 플럭 레이어를 사용해야 합니다.`);
}

const stableSchool = {
  budget: 10_000,
  burnoutRisk: 20,
  riskLevel: 20,
  riskStudentCount: 1,
};
assert.equal(resolveSchoolSimulatorBgmScene({ ...stableSchool, activeTabId: 'operations' }), SCHOOL_SIMULATOR_BGM_SCENES.morning);
assert.equal(resolveSchoolSimulatorBgmScene({ ...stableSchool, activeTabId: 'class' }), SCHOOL_SIMULATOR_BGM_SCENES.classroom);
assert.equal(resolveSchoolSimulatorBgmScene({ ...stableSchool, activeTabId: 'students' }), SCHOOL_SIMULATOR_BGM_SCENES.counseling);
assert.equal(resolveSchoolSimulatorBgmScene({ ...stableSchool, activeTabId: 'staff' }), SCHOOL_SIMULATOR_BGM_SCENES.campus);
assert.equal(resolveSchoolSimulatorBgmScene({ ...stableSchool, activeTabId: 'clubs' }), SCHOOL_SIMULATOR_BGM_SCENES.festival);
assert.equal(resolveSchoolSimulatorBgmScene({ ...stableSchool, activeTabId: 'advanced' }), SCHOOL_SIMULATOR_BGM_SCENES.afterschool);
assert.equal(resolveSchoolSimulatorBgmScene({ ...stableSchool, activeTabId: 'class', pendingEvent: true }), SCHOOL_SIMULATOR_BGM_SCENES.incident);
assert.equal(resolveSchoolSimulatorBgmScene({ ...stableSchool, activeTabId: 'class', budget: -1 }), SCHOOL_SIMULATOR_BGM_SCENES.incident);

assert.equal(schoolSimulatorResultMusic({ key: 'lesson' })?.theme, SCHOOL_SIMULATOR_BGM_SCENES.classroom);
assert.equal(schoolSimulatorResultMusic({ key: 'career' })?.theme, SCHOOL_SIMULATOR_BGM_SCENES.counseling);
assert.equal(schoolSimulatorResultMusic({ key: 'festivalComplete' })?.theme, SCHOOL_SIMULATOR_BGM_SCENES.festival);
assert.equal(schoolSimulatorResultMusic({ key: 'crisis' })?.theme, SCHOOL_SIMULATOR_BGM_SCENES.incident);
assert.equal(schoolSimulatorResultMusic({ key: 'semester' })?.theme, SCHOOL_SIMULATOR_BGM_SCENES.semester);
assert.equal(schoolSimulatorResultMusic({ key: 'newRun' })?.theme, SCHOOL_SIMULATOR_BGM_SCENES.morning);
assert.equal(schoolSimulatorResultMusic({ key: 'idle' }), null);

for (const token of [
  'useGameBgm',
  'resolveSchoolSimulatorBgmScene',
  'schoolSimulatorResultMusic',
  'setMusicScene(baseMusicScene)',
  'activeFeatureTabId={activeFeatureTabId}',
  'setActiveFeatureTabId={setActiveFeatureTabId}',
  'playMusicTransition(presentation)',
]) {
  assert.ok(pageSource.includes(token), `플레이 페이지에 ${token} 연동이 필요합니다.`);
}
assert.ok(featureSource.includes('activeTabId={activeFeatureTabId}'), '학교 기능 탭은 음악 전환을 위해 제어형이어야 합니다.');
assert.ok(featureSource.includes('onTabChange={setActiveFeatureTabId}'), '학교 기능 탭 변경을 페이지에 전달해야 합니다.');
assert.ok(featureSource.includes('school-icon-row'), '학교 위험·사건·시설 목록에 전용 아이콘 행이 필요합니다.');
for (const action of [
  'school-operation', 'school-lesson', 'school-vision', 'school-incident',
  'school-counseling', 'school-teacher', 'school-club',
]) {
  assert.ok(featureSource.includes(`icon: '${action}'`), `${action} 기능 탭 아이콘이 필요합니다.`);
}

const schoolSfxBlock = soundSource.match(/\n  school: \{([\s\S]*?)\n  \},\n  coding:/)?.[1] || '';
for (const cue of [
  'schoolNewRun', 'schoolSemester', 'schoolFestivalStart', 'schoolFestivalComplete',
  'schoolIncident', 'schoolResolution', 'schoolCrisis', 'schoolRecovery',
  'schoolBell', 'schoolCounseling', 'schoolLesson', 'schoolClub', 'schoolBlocked',
]) {
  assert.match(schoolSfxBlock, new RegExp(`\\n    ${cue}: \\[`), `${cue}는 학교 전용 효과음이어야 합니다.`);
}

assert.ok(cssSource.includes('.game-save-row.school-icon-row'), '학교 아이콘 행 데스크톱 레이아웃이 필요합니다.');
assert.ok(cssSource.includes('.school-icon-row > .game-action-icon'), '학교 아이콘 시각 스타일이 필요합니다.');
for (const arrangement of [
  'schoolMorning', 'schoolClassroom', 'schoolCounseling', 'schoolCampus',
  'schoolFestival', 'schoolIncident', 'schoolSemester', 'schoolAfterschool',
]) {
  assert.ok(profileSource.includes(`${arrangement}: sceneArrangement`), `${arrangement} 장편 편곡이 필요합니다.`);
}

console.log('soundtrackScenes', SCHOOL_SIMULATOR_SOUNDTRACK.length);
console.log('profileBars', SCHOOL_SIMULATOR_SOUNDTRACK.map((row) => gameBgmProfile(row.theme).steps / 16).join(','));
console.log('schoolSfxCues', 13);
console.log('controlledTabs', true);
console.log('iconRows', true);
