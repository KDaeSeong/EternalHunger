import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  gameBgmProfile,
} from '../src/app/games/_lib/gameBgmProfiles.js';
import {
  SI_CODING_BGM_SCENES,
  SI_CODING_SOUNDTRACK,
  resolveSiCodingBgmScene,
  siCodingResultMusic,
} from '../src/app/games/si-coding-sim/_lib/siCodingSimSoundtrack.js';

const routeUrl = new URL('../src/app/games/si-coding-sim/', import.meta.url);
const pageSource = await readFile(new URL('play/page.js', routeUrl), 'utf8');
const profileSource = await readFile(new URL('../src/app/games/_lib/gameBgmProfiles.js', import.meta.url), 'utf8');
const themeSource = await readFile(new URL('../src/app/games/_lib/gameAudioThemes.js', import.meta.url), 'utf8');
const iconSource = await readFile(new URL('../src/app/games/_components/GameActionIcon.js', import.meta.url), 'utf8');

assert.equal(SI_CODING_SOUNDTRACK.length, 7, 'SI 코딩은 7개 상황별 음악 장면을 제공해야 합니다.');
assert.equal(new Set(SI_CODING_SOUNDTRACK.map((row) => row.theme)).size, 7, 'SI 코딩 음악 테마는 중복되면 안 됩니다.');
assert.equal(new Set(SI_CODING_SOUNDTRACK.map((row) => gameBgmProfile(row.theme).bpm)).size, 7, '장면별 템포가 모두 달라야 합니다.');

for (const row of SI_CODING_SOUNDTRACK) {
  const profile = gameBgmProfile(row.theme);
  const loopSeconds = (profile.steps / 16) * 4 * (60 / profile.bpm);
  assert.match(profile.label, /^SI Coding Sim OST · /, `${row.theme}에는 전용 OST 라벨이 필요합니다.`);
  assert.equal(profile.arrangement.length, 10, `${row.theme}은 10개 구간 편곡이어야 합니다.`);
  assert.ok(profile.steps >= 34 * 16, `${row.theme}은 짧은 반복음이 아닌 장편 편곡이어야 합니다.`);
  assert.ok(loopSeconds >= 70, `${row.theme}의 루프가 70초보다 짧습니다.`);
  assert.ok(profile.orchestration.stringGain > 0, `${row.theme}은 스트링 레이어를 사용해야 합니다.`);
  assert.ok(profile.orchestration.pluckGain > 0, `${row.theme}은 플럭 레이어를 사용해야 합니다.`);
  assert.ok(profile.orchestration.cymbalGain > 0, `${row.theme}은 심벌 레이어를 사용해야 합니다.`);
  assert.notEqual(profile.leadWave, 'square', `${row.theme}의 주선율에 사각파를 사용하면 안 됩니다.`);
}

assert.equal(resolveSiCodingBgmScene(), SI_CODING_BGM_SCENES.focus);
assert.equal(resolveSiCodingBgmScene({ activeTabId: 'docs' }), SI_CODING_BGM_SCENES.docs);
assert.equal(resolveSiCodingBgmScene({ activeTabId: 'code' }), SI_CODING_BGM_SCENES.execution);
assert.equal(resolveSiCodingBgmScene({ activeTabId: 'audit' }), SI_CODING_BGM_SCENES.audit);
assert.equal(resolveSiCodingBgmScene({ activeTabId: 'advanced' }), SI_CODING_BGM_SCENES.audit);
assert.equal(resolveSiCodingBgmScene({ activeTabId: 'code', stamina: 15 }), SI_CODING_BGM_SCENES.risk);
assert.equal(resolveSiCodingBgmScene({ activeTabId: 'field', evaluationGrade: 'FAIL' }), SI_CODING_BGM_SCENES.risk);
assert.equal(resolveSiCodingBgmScene({ activeTabId: 'field', evaluationGrade: 'A' }), SI_CODING_BGM_SCENES.success);
assert.equal(resolveSiCodingBgmScene({ activeTabId: 'field', outcomeScore: 95 }), SI_CODING_BGM_SCENES.success);
assert.equal(resolveSiCodingBgmScene({ submittedTasks: 4, totalTasks: 4 }), SI_CODING_BGM_SCENES.delivery);

assert.equal(siCodingResultMusic({ key: 'documentReview' })?.theme, SI_CODING_BGM_SCENES.docs);
assert.equal(siCodingResultMusic({ key: 'taskSelect' })?.theme, SI_CODING_BGM_SCENES.execution);
assert.equal(siCodingResultMusic({ key: 'codeFail' })?.theme, SI_CODING_BGM_SCENES.risk);
assert.equal(siCodingResultMusic({ key: 'codePass' })?.theme, SI_CODING_BGM_SCENES.success);
assert.equal(siCodingResultMusic({ key: 'codePerfect' })?.durationMs, 14_000);
assert.equal(siCodingResultMusic({ key: 'projectApproved' })?.theme, SI_CODING_BGM_SCENES.delivery);
assert.equal(siCodingResultMusic({ key: 'idle' }), null);

for (const token of [
  'useGameBgm',
  'resolveSiCodingBgmScene',
  'siCodingResultMusic',
  'setMusicScene(baseMusicScene)',
  'setMusicScene(transition.theme)',
  'activeTabId: activeFeatureTabId',
]) {
  assert.ok(pageSource.includes(token), `플레이 페이지에 ${token} 연동이 필요합니다.`);
}
assert.ok(themeSource.includes("['si-coding-sim', 'coding']"), 'SI 코딩 라우트는 기존 효과음 테마를 유지해야 합니다.');
assert.ok(pageSource.includes('setMusicScene(baseMusicScene)'), '페이지가 효과음 테마와 별개로 장면 BGM을 지정해야 합니다.');

for (const arrangement of [
  'codingFocus',
  'codingDocs',
  'codingExecution',
  'codingAudit',
  'codingRisk',
  'codingSuccess',
  'codingDelivery',
]) {
  assert.ok(profileSource.includes(`${arrangement}: sceneArrangement`), `${arrangement} 장편 편곡이 필요합니다.`);
}

for (const action of SI_CODING_SOUNDTRACK.map((row) => row.icon)) {
  const iconToken = action.includes('-') ? `'${action}':` : `${action}:`;
  assert.ok(iconSource.includes(iconToken), `${action} 행동 아이콘 매핑이 필요합니다.`);
}

console.log(JSON.stringify({
  soundtrackScenes: SI_CODING_SOUNDTRACK.length,
  profileBars: SI_CODING_SOUNDTRACK.map((row) => gameBgmProfile(row.theme).steps / 16),
  minimumLoopSeconds: Number(Math.min(...SI_CODING_SOUNDTRACK.map((row) => {
    const profile = gameBgmProfile(row.theme);
    return (profile.steps / 16) * 4 * (60 / profile.bpm);
  })).toFixed(1)),
  dynamicScenes: true,
}, null, 2));
