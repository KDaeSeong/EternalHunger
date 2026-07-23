import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  classifySimulationMajorEvent,
  createSimulationFeedbackSnapshot,
  getSimulationFeedbackCue,
  getSimulationFeedbackDisplay,
  getSimulationFeedbackPresentation,
} from '../src/app/simulation/_lib/simulationFeedbackRuntime.js';

function snapshot(overrides = {}) {
  return createSimulationFeedbackSnapshot({
    autoPlay: false,
    day: 1,
    dead: [],
    forbiddenAddedNow: [],
    isGameOver: false,
    logs: [],
    phase: 'morning',
    winner: null,
    ...overrides,
  });
}

function eventLog(id, text, type = 'highlight') {
  return { id, text, type };
}

const base = snapshot();
assert.equal(getSimulationFeedbackCue(null, base), '', '첫 렌더에서는 효과음을 재생하면 안 됩니다.');
assert.equal(
  getSimulationFeedbackCue(base, snapshot({ phase: 'night' })),
  'phaseNight',
  '수동 밤 전환은 밤 효과음을 사용해야 합니다.',
);
assert.equal(
  getSimulationFeedbackCue(snapshot({ phase: 'night' }), snapshot({ day: 2, phase: 'morning' })),
  'phaseDay',
  '수동 낮 전환은 낮 효과음을 사용해야 합니다.',
);
assert.equal(
  getSimulationFeedbackCue(base, snapshot({ autoPlay: true, phase: 'night' })),
  '',
  '자동 진행 중에는 매 페이즈 효과음을 반복하면 안 됩니다.',
);
assert.equal(
  getSimulationFeedbackCue(base, snapshot({ dead: [{ id: 'actor-b' }] })),
  'elimination',
  '사망자 증가는 처치 효과음을 사용해야 합니다.',
);
assert.equal(
  getSimulationFeedbackCue(snapshot({ dead: [{ id: 'actor-b' }] }), base),
  'revive',
  '사망자 감소는 부활 효과음을 사용해야 합니다.',
);

const forbidden = snapshot({ forbiddenAddedNow: new Set(['hospital', 'school']) });
assert.equal(forbidden.forbiddenSignature, 'hospital|school', '금지구역 서명은 순서와 자료형에 흔들리면 안 됩니다.');
assert.equal(
  getSimulationFeedbackCue(base, forbidden),
  'zoneLock',
  '신규 금지구역은 경고 효과음을 사용해야 합니다.',
);
assert.equal(
  getSimulationFeedbackCue(base, snapshot({ isGameOver: true, winner: { id: 'actor-a', name: '시로코' } })),
  'victory',
  '승자가 있는 게임 종료는 승리 효과음을 사용해야 합니다.',
);
assert.equal(
  getSimulationFeedbackCue(base, snapshot({ isGameOver: true })),
  'defeat',
  '전멸 종료는 패배 효과음을 사용해야 합니다.',
);
assert.equal(
  getSimulationFeedbackCue(snapshot({ day: 5, dead: [{ id: 'actor-b' }] }), snapshot({ day: 0 })),
  '',
  '새 게임 초기화는 부활 효과음으로 오인하면 안 됩니다.',
);

const majorEventCases = [
  ['hyperloopJump', 'hyperloopJump', eventLog('hyperloop-1', '🌀 하이퍼루프 이동: 성당 → 병원 (시로코)')],
  ['riftOpen', 'riftOpen', eventLog('rift-1', '🌀 차원의 틈 개방: 학교 (최대 2팀)')],
  ['riftBattle', 'riftBattle', eventLog('rift-2', '⚔️ 차원의 틈 교전: [1팀] 승리', 'death')],
  ['bossSpawn', 'bossSpawn', eventLog('boss-1', '⚠️ 오메가 출현! 위치를 확인하세요.')],
  ['bossDefeat', 'bossDefeat', eventLog('boss-2', '🧿 변이체(오메가) 격파! 포스 코어 획득 가능')],
  ['objectiveSpawn', 'objectiveSpawn', eventLog('objective-1', '🌠 오브젝트 등장: 운석/생명의 나무 (x2)')],
  ['rareSupply', 'rareSupply', eventLog('supply-1', '🟪 전설 보급 상자 도착 (x1)')],
  ['transcendSupply', 'transcendSupply', eventLog('supply-2', '🎁 초월 보급 상자 도착 (x1)')],
  ['specialCraft', 'specialCraft', eventLog('craft-1', '🧬 포스 코어 조합: 운석 파편 + 생명의 나무 수액 → 포스 코어 x1')],
  ['suddenDeath', 'suddenDeath', eventLog('sudden-1', '=== 서든데스 발동: 최종 안전구역 2곳 제외 전지역 금지 ===')],
];

for (const [key, cue, log] of majorEventCases) {
  const classified = classifySimulationMajorEvent(log);
  assert.equal(classified?.key, key, `${key} 로그는 전용 사건으로 분류되어야 합니다.`);
  assert.equal(
    getSimulationFeedbackCue(base, snapshot({ logs: [log] })),
    cue,
    `${key} 사건은 ${cue} 효과음을 사용해야 합니다.`,
  );
}

const visualOnlyCases = [
  ['reviveEvent', 'revive', eventLog('revive-visual-1', '✨ [히나] 자동 부활! (1팀 · 2일차 밤, HP 45)')],
  ['eliminationEvent', 'elimination', eventLog('death-visual-1', '💀 [히나] 금지구역 폭발로 사망했습니다.', 'death')],
];
for (const [key, action, log] of visualOnlyCases) {
  const current = snapshot({ logs: [log] });
  assert.equal(classifySimulationMajorEvent(log)?.key, key);
  assert.equal(getSimulationFeedbackCue(base, current), '', `${key} 로그는 상태 변화음과 중복 재생되면 안 됩니다.`);
  assert.equal(getSimulationFeedbackDisplay(current)?.action, action, `${key} 로그는 결과 바 아이콘을 제공해야 합니다.`);
}

const manualHyperloop = snapshot({ logs: [majorEventCases[0][2]] });
const autoHyperloop = snapshot({ autoPlay: true, logs: [majorEventCases[0][2]] });
assert.equal(getSimulationFeedbackCue(base, manualHyperloop), 'hyperloopJump');
assert.equal(getSimulationFeedbackCue(base, autoHyperloop), '', '자동 진행 하이퍼루프는 반복음을 내면 안 됩니다.');
assert.equal(
  getSimulationFeedbackPresentation(base, autoHyperloop)?.action,
  'hyperloop-jump',
  '자동 진행 중에도 핵심 사건의 시각 피드백은 유지해야 합니다.',
);
assert.equal(
  getSimulationFeedbackDisplay(autoHyperloop)?.action,
  'hyperloop-jump',
  '현재 스냅샷만으로도 최신 주요 사건 결과 바를 복원할 수 있어야 합니다.',
);

const kioskReviveLog = eventLog(
  'revive-1',
  '🏪 [시로코] 키오스크 부활: [히나] (-200Cr, HP 45)',
);
assert.equal(
  getSimulationFeedbackCue(
    snapshot({ dead: [{ id: 'hina' }] }),
    snapshot({ dead: [], logs: [kioskReviveLog] }),
  ),
  'kioskRevive',
  '키오스크 부활은 일반 부활보다 구체적인 결과음을 우선해야 합니다.',
);

assert.equal(
  getSimulationFeedbackCue(
    base,
    snapshot({ dead: [{ id: 'actor-b' }], logs: [majorEventCases[3][2]] }),
  ),
  'elimination',
  '탈락과 월드 사건이 동시에 발생하면 탈락 피드백을 우선해야 합니다.',
);

const repeatedRift = snapshot({ logs: [majorEventCases[1][2]] });
assert.equal(
  getSimulationFeedbackCue(repeatedRift, snapshot({ logs: [majorEventCases[1][2], eventLog('ordinary-1', '파밍을 계속합니다.', 'normal')] })),
  '',
  '같은 주요 사건이 최신 일반 로그 때문에 다시 재생되면 안 됩니다.',
);
assert.equal(
  getSimulationFeedbackCue(base, snapshot({ logs: [eventLog('ordinary-2', '시로코가 학교로 이동했습니다.', 'normal')] })),
  '',
  '일반 이동과 파밍 로그는 상태 기반 효과음을 만들면 안 됩니다.',
);

const iconSource = await readFile(new URL('../src/app/games/_components/GameActionIcon.js', import.meta.url), 'utf8');
const sfxSource = await readFile(new URL('../src/app/games/_lib/useGameSfx.js', import.meta.url), 'utf8');
const audioThemeSource = await readFile(new URL('../src/app/games/_lib/gameAudioThemes.js', import.meta.url), 'utf8');
const pageSource = await readFile(new URL('../src/app/simulation/_components/SimulationPageView.js', import.meta.url), 'utf8');
const gameScreenSource = await readFile(new URL('../src/app/simulation/_components/SimulationGameScreen.js', import.meta.url), 'utf8');
const eventBarSource = await readFile(new URL('../src/app/simulation/_components/SimulationEventFeedbackBar.js', import.meta.url), 'utf8');
const screenHeaderSource = await readFile(new URL('../src/app/simulation/_components/SimulationScreenHeader.js', import.meta.url), 'utf8');
const controlPanelSource = await readFile(new URL('../src/app/simulation/_components/SimulationControlPanel.js', import.meta.url), 'utf8');

const requiredActions = [
  'boss-defeat',
  'boss-spawn',
  'hyperloop-jump',
  'kiosk-revive',
  'objective-spawn',
  'rare-supply',
  'rift-battle',
  'rift-open',
  'special-craft',
  'sudden-death',
  'transcend-supply',
  'zone-lock',
];
for (const action of requiredActions) {
  assert.match(iconSource, new RegExp(`['"]${action}['"]\\s*:`), `Missing Eternal Hunger icon: ${action}`);
}

const requiredCues = [
  'bossDefeat',
  'bossSpawn',
  'hyperloopJump',
  'kioskRevive',
  'objectiveSpawn',
  'rareSupply',
  'riftBattle',
  'riftOpen',
  'specialCraft',
  'suddenDeath',
  'transcendSupply',
];
for (const cue of requiredCues) {
  assert.match(sfxSource, new RegExp(`\\b${cue}:\\s*\\[`), `Missing Eternal Hunger cue: ${cue}`);
}

const eternalThemeMatch = sfxSource.match(/eternal:\s*\{([\s\S]*?)\n\s{2}\},\n\s{2}twenty:/);
assert.ok(eternalThemeMatch, 'Eternal Hunger must use a dedicated SFX theme.');
for (const cue of ['click', 'tab', 'select', 'confirm', 'start', ...requiredCues]) {
  assert.match(eternalThemeMatch[1], new RegExp(`\\b${cue}:\\s*\\[`), `Missing enriched Eternal Hunger cue: ${cue}`);
}
assert.match(audioThemeSource, /\['eternalhunger',\s*'eternal'\]/, 'Eternal Hunger route must resolve to its dedicated SFX theme.');
assert.match(audioThemeSource, /\['simulation',\s*'eternal'\]/, 'Simulation route must resolve to the Eternal Hunger SFX theme.');

assert.match(pageSource, /getSimulationFeedbackPresentation/, '시뮬레이션 페이지는 사건 프레젠테이션을 계산해야 합니다.');
assert.match(pageSource, /theme:\s*'eternal'/, 'Simulation must use the Eternal Hunger SFX theme.');
assert.match(pageSource, /eventFeedback=\{eventFeedback\}/, '최신 사건 프레젠테이션을 게임 화면에 전달해야 합니다.');
assert.match(gameScreenSource, /<SimulationEventFeedbackBar feedback=\{eventFeedback\}/, '게임 화면은 주요 사건 결과 바를 렌더링해야 합니다.');
assert.match(eventBarSource, /<GameActionIcon action=\{feedback\.action/, '주요 사건 결과 바는 전용 아이콘을 사용해야 합니다.');
assert.match(eventBarSource, /role="status"/, '주요 사건 결과 바는 접근 가능한 상태 영역이어야 합니다.');
assert.match(screenHeaderSource, /data-game-sfx="off"/, '상단 페이즈 진행 버튼은 선행 클릭음을 재생하면 안 됩니다.');
assert.match(controlPanelSource, /data-game-sfx="off"/, '하단 페이즈 진행 버튼은 선행 클릭음을 재생하면 안 됩니다.');

console.log(JSON.stringify({
  majorEvents: majorEventCases.length + visualOnlyCases.length + 1,
  dedicatedCues: requiredCues.length,
  dedicatedIcons: requiredActions.length,
  dedicatedSfxTheme: true,
  persistentEventBar: true,
}, null, 2));
