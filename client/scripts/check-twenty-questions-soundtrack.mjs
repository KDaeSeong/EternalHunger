import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { gameBgmProfile } from '../src/app/games/_lib/gameBgmProfiles.js';
import {
  TWENTY_QUESTIONS_BGM_SCENES,
  TWENTY_QUESTIONS_SOUNDTRACK,
  resolveTwentyQuestionsLobbyBgmScene,
  resolveTwentyQuestionsRoomBgmScene,
  twentyQuestionsResultMusic,
} from '../src/app/twenty-questions/_lib/twentyQuestionsSoundtrack.js';

const routeUrl = new URL('../src/app/twenty-questions/', import.meta.url);
const lobbySource = await readFile(new URL('page.js', routeUrl), 'utf8');
const roomSource = await readFile(new URL('_components/TwentyQuestionsRoomContent.js', routeUrl), 'utf8');
const profileSource = await readFile(new URL('../src/app/games/_lib/gameBgmProfiles.js', import.meta.url), 'utf8');
const themeSource = await readFile(new URL('../src/app/games/_lib/gameAudioThemes.js', import.meta.url), 'utf8');
const iconSource = await readFile(new URL('../src/app/games/_components/GameActionIcon.js', import.meta.url), 'utf8');

assert.equal(TWENTY_QUESTIONS_SOUNDTRACK.length, 7, '스무고개는 7개 상황별 음악 장면을 제공해야 합니다.');
assert.equal(new Set(TWENTY_QUESTIONS_SOUNDTRACK.map((row) => row.theme)).size, 7, '스무고개 음악 테마는 중복되면 안 됩니다.');
assert.equal(new Set(TWENTY_QUESTIONS_SOUNDTRACK.map((row) => gameBgmProfile(row.theme).bpm)).size, 7, '장면별 템포는 모두 달라야 합니다.');

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

for (const row of TWENTY_QUESTIONS_SOUNDTRACK) {
  const profile = gameBgmProfile(row.theme);
  const loopSeconds = (profile.steps / 16) * 4 * (60 / profile.bpm);
  assert.match(profile.label, /^Twenty Questions OST · /, `${row.theme}에는 전용 OST 라벨이 필요합니다.`);
  assert.equal(profile.arrangement.length, 10, `${row.theme}은 10개 구간으로 편곡되어야 합니다.`);
  assert.ok(profile.steps >= 34 * 16, `${row.theme}은 짧은 반복음이 아닌 장편 구조여야 합니다.`);
  assert.ok(loopSeconds >= 70, `${row.theme}의 루프 길이는 70초 이상이어야 합니다.`);
  assert.notEqual(profile.leadWave, 'square', `${row.theme}의 주선율에 각진 사각파를 사용하면 안 됩니다.`);
  for (const layer of requiredOrchestrationLayers) {
    assert.ok(profile.orchestration[layer] > 0, `${row.theme}에 ${layer} 편성이 필요합니다.`);
  }
}

assert.equal(resolveTwentyQuestionsLobbyBgmScene(), TWENTY_QUESTIONS_BGM_SCENES.lobby);
assert.equal(resolveTwentyQuestionsLobbyBgmScene({ writerOpen: true }), TWENTY_QUESTIONS_BGM_SCENES.create);
assert.equal(resolveTwentyQuestionsLobbyBgmScene({ loadError: '오류' }), TWENTY_QUESTIONS_BGM_SCENES.setback);

assert.equal(resolveTwentyQuestionsRoomBgmScene(), TWENTY_QUESTIONS_BGM_SCENES.inquiry);
assert.equal(resolveTwentyQuestionsRoomBgmScene({ status: 'solved' }), TWENTY_QUESTIONS_BGM_SCENES.reveal);
assert.equal(resolveTwentyQuestionsRoomBgmScene({ answerRevealed: true }), TWENTY_QUESTIONS_BGM_SCENES.reveal);
assert.equal(resolveTwentyQuestionsRoomBgmScene({ status: 'closed' }), TWENTY_QUESTIONS_BGM_SCENES.setback);
assert.equal(resolveTwentyQuestionsRoomBgmScene({ attemptsLeft: 0 }), TWENTY_QUESTIONS_BGM_SCENES.setback);
assert.equal(resolveTwentyQuestionsRoomBgmScene({ attemptsLeft: 5 }), TWENTY_QUESTIONS_BGM_SCENES.guess);
assert.equal(resolveTwentyQuestionsRoomBgmScene({ submitting: 'guess' }), TWENTY_QUESTIONS_BGM_SCENES.guess);
assert.equal(resolveTwentyQuestionsRoomBgmScene({ isHost: true, pendingCount: 2 }), TWENTY_QUESTIONS_BGM_SCENES.pending);
assert.equal(resolveTwentyQuestionsRoomBgmScene({ isHost: false, pendingCount: 2 }), TWENTY_QUESTIONS_BGM_SCENES.inquiry);

assert.equal(twentyQuestionsResultMusic({ action: 'guess-correct' })?.theme, TWENTY_QUESTIONS_BGM_SCENES.reveal);
assert.equal(twentyQuestionsResultMusic({ action: 'guess-wrong' })?.theme, TWENTY_QUESTIONS_BGM_SCENES.guess);
assert.equal(twentyQuestionsResultMusic({ action: 'attempt-limit' })?.theme, TWENTY_QUESTIONS_BGM_SCENES.setback);
assert.equal(twentyQuestionsResultMusic({ action: 'question-queued' })?.theme, TWENTY_QUESTIONS_BGM_SCENES.pending);
assert.equal(twentyQuestionsResultMusic({ action: 'answer-yes' })?.theme, TWENTY_QUESTIONS_BGM_SCENES.inquiry);
assert.equal(twentyQuestionsResultMusic({ action: 'room' })?.theme, TWENTY_QUESTIONS_BGM_SCENES.create);
assert.equal(twentyQuestionsResultMusic({ action: 'refresh' })?.theme, TWENTY_QUESTIONS_BGM_SCENES.lobby);
assert.equal(twentyQuestionsResultMusic({ action: 'unknown' }), null);

for (const [source, label, tokens] of [
  [lobbySource, '로비', ['useGameBgm', 'resolveTwentyQuestionsLobbyBgmScene', 'twentyQuestionsResultMusic', 'setMusicScene(baseMusicScene)', 'setMusicScene(transition.theme)', 'setMusicScene(musicBaseSceneRef.current)']],
  [roomSource, '방', ['useGameBgm', 'resolveTwentyQuestionsRoomBgmScene', 'twentyQuestionsResultMusic', 'setMusicScene(baseMusicScene)', 'setMusicScene(transition.theme)', 'setMusicScene(musicBaseSceneRef.current)']],
]) {
  for (const token of tokens) assert.ok(source.includes(token), `${label} 화면에 ${token} 연동이 필요합니다.`);
}

assert.ok(themeSource.includes("['twenty-questions', 'twenty']"), '기존 스무고개 효과음 테마는 유지해야 합니다.');

for (const arrangement of [
  'twentyLobby',
  'twentyCreate',
  'twentyInquiry',
  'twentyPending',
  'twentyGuess',
  'twentyReveal',
  'twentySetback',
]) {
  assert.ok(profileSource.includes(`${arrangement}: sceneArrangement`), `${arrangement} 장편 편곡이 필요합니다.`);
}

for (const action of TWENTY_QUESTIONS_SOUNDTRACK.map((row) => row.icon)) {
  const iconToken = action.includes('-') ? `'${action}':` : `${action}:`;
  assert.ok(iconSource.includes(iconToken), `${action} 행동 아이콘 매핑이 필요합니다.`);
}

console.log(JSON.stringify({
  soundtrackScenes: TWENTY_QUESTIONS_SOUNDTRACK.length,
  orchestrationLayers: requiredOrchestrationLayers.length,
  profileBars: TWENTY_QUESTIONS_SOUNDTRACK.map((row) => gameBgmProfile(row.theme).steps / 16),
  minimumLoopSeconds: Number(Math.min(...TWENTY_QUESTIONS_SOUNDTRACK.map((row) => {
    const profile = gameBgmProfile(row.theme);
    return (profile.steps / 16) * 4 * (60 / profile.bpm);
  })).toFixed(1)),
  dynamicLobby: true,
  dynamicRoom: true,
}, null, 2));
