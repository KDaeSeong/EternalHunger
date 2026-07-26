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
  ['fogWarning', 'fogWarning', eventLog('fog-warning-1', '🌫️ 퍼플 포그 경고! 약 15s 후, 일부 구역에서 시야가 악화됩니다.')],
  ['fogSpread', 'fogSpread', eventLog('fog-spread-1', '🌫️ 퍼플 포그 확산! (약 25s)')],
  ['fogClear', 'fogClear', eventLog('fog-clear-1', '🌫️ 퍼플 포그가 걷혔습니다.')],
  ['detonationGraceEnded', 'detonationGraceEnded', eventLog('grace-end-1', '⚠️ 유예 종료: 안전구역도 위험해졌습니다.')],
  ['detonationDeath', 'detonationDeath', eventLog('detonation-death-1', '💥 [히나] 폭발 타이머가 0이 되어 사망했습니다. (구역: 학교)', 'death')],
  ['cnotEscape', 'cnotEscape', eventLog('cnot-1', '🌀 [시로코] CNOT 게이트 발동 → 병원 (에너지 -15)')],
  ['portableSafeZone', 'portableSafeZone', eventLog('safe-zone-1', '🛡️ [유우카] 휴대용 안전지대 전개 (12s) (에너지 -20)')],
  ['hyperloopJump', 'hyperloopJump', eventLog('hyperloop-1', '🌀 하이퍼루프 이동: 성당 → 병원 (시로코)')],
  ['riftOpen', 'riftOpen', eventLog('rift-1', '🌀 차원의 틈 개방: 학교 (최대 2팀)')],
  ['riftBattle', 'riftBattle', eventLog('rift-2', '⚔️ 차원의 틈 교전: [1팀] 승리', 'death')],
  ['bossSpawn', 'bossSpawn', eventLog('boss-1', '⚠️ 오메가 출현! 위치를 확인하세요.')],
  ['bossDefeat', 'bossDefeat', eventLog('boss-2', '🧿 변이체(오메가) 격파! 포스 코어 획득 가능')],
  ['objectiveSpawn', 'objectiveSpawn', eventLog('objective-1', '🌠 오브젝트 등장: 운석/생명의 나무 (x2)')],
  ['rareSupply', 'rareSupply', eventLog('supply-1', '🟪 전설 보급 상자 도착 (x1)')],
  ['transcendSupply', 'transcendSupply', eventLog('supply-2', '🎁 초월 보급 상자 도착 (x1)')],
  ['specialCraft', 'specialCraft', eventLog('craft-1', '🧬 포스 코어 조합: 운석 파편 + 생명의 나무 수액 → 포스 코어 x1')],
  ['marketCraft', 'marketCraft', eventLog('market-craft-1', '🛠️ [조합] 장비 조합 완료 (x1)', 'system')],
  ['kioskTrade', 'kioskTrade', eventLog('kiosk-trade-1', '🏪 [키오스크] 구매 완료 (x1)', 'system')],
  ['droneDelivery', 'droneDelivery', eventLog('drone-1', '🚁 [드론] 구매 완료 (x1)', 'system')],
  ['perkUnlock', 'perkUnlock', eventLog('perk-1', '🎖️ [특전] 구매 완료 (FAST_START)', 'system')],
  ['marketTrade', 'marketTrade', eventLog('trade-1', '✅ [거래] 수락 완료', 'system')],
  ['marketCraftFailure', 'marketCraftFailure', eventLog('market-craft-failure-1', '⚠️ [조합 실패] 재료가 부족합니다.', 'death')],
  ['kioskTradeFailure', 'kioskTradeFailure', eventLog('kiosk-failure-1', '⚠️ [키오스크 실패] 크레딧이 부족합니다.', 'death')],
  ['droneDeliveryFailure', 'droneDeliveryFailure', eventLog('drone-failure-1', '⚠️ [드론 구매 실패] 크레딧이 부족합니다.', 'death')],
  ['perkUnlockFailure', 'perkUnlockFailure', eventLog('perk-failure-1', '⚠️ [특전 구매 실패] 토큰이 부족합니다.', 'death')],
  ['marketTradeFailure', 'marketTradeFailure', eventLog('trade-failure-1', '⚠️ [거래 오퍼 실패] 보유 재료가 부족합니다.', 'death')],
  ['marketFailure', 'marketFailure', eventLog('market-failure-1', '⚠️ [상점 처리 실패] 요청을 완료하지 못했습니다.', 'death')],
  ['combatKill', 'combatKill', eventLog('kill-1', '☠️ [시로코] → [히나] 처치 (+1킬, 어시: 유우카)', 'death')],
  ['teamWipeProtection', 'teamWipeProtection', eventLog('wipe-protect-1', '🛡️ 스쿼드 전멸 방지: 2일차 낮까지 부활 가능한 팀이 남아 있어 게임 종료를 보류합니다.')],
  ['masteryLevel', 'masteryLevel', eventLog('mastery-1', '⚙️ [시로코] 권총 숙련도 Lv.2 달성 (전투)')],
  ['tacticalUpgrade', 'tacticalUpgrade', eventLog('tactical-1', '🎛️ [시로코] 전술 강화 모듈 사용 → 전술 스킬 레벨 +1 (Lv.2)')],
  ['routeComplete', 'routeComplete', eventLog('route-1', '✅ [시로코] 1일차 낮 루트 파밍 완료: 영웅 장비 5부위 완성')],
  ['legendaryCrateOpen', 'legendaryCrateOpen', eventLog('legend-open-1', '🟪 [시로코] 학교에서 🎁 전설 재료 상자를 열어 [미스릴] 획득')],
  ['objectiveCollected', 'objectiveCollected', eventLog('objective-pickup-1', '🌠 [시로코] 숲 오브젝트 채집: [생명의 나무] 획득')],
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

const getMajorEventLog = (key) => majorEventCases.find(([eventKey]) => eventKey === key)?.[2];

const detonationDeathLog = getMajorEventLog('detonationDeath');
const detonationDeathState = snapshot({ dead: [{ id: 'hina' }], logs: [detonationDeathLog] });
assert.equal(
  getSimulationFeedbackCue(base, detonationDeathState),
  'detonationDeath',
  '폭발 타이머 사망은 일반 탈락음보다 전용 폭발음을 우선해야 합니다.',
);
assert.equal(
  getSimulationFeedbackPresentation(base, detonationDeathState)?.action,
  'detonation-death',
  '폭발 타이머 사망은 전용 위험 결과 바를 사용해야 합니다.',
);

const combatKillLog = getMajorEventLog('combatKill');
const combatKillState = snapshot({ dead: [{ id: 'actor-b' }], logs: [combatKillLog] });
assert.equal(
  getSimulationFeedbackCue(base, combatKillState),
  'combatKill',
  '교전 처치는 일반 탈락음보다 전용 처치음을 우선해야 합니다.',
);
assert.equal(
  getSimulationFeedbackPresentation(base, combatKillState)?.action,
  'combat-kill',
  '교전 처치는 처치자와 대상이 포함된 전용 결과 바를 사용해야 합니다.',
);

for (const key of [
  'masteryLevel',
  'tacticalUpgrade',
  'routeComplete',
  'legendaryCrateOpen',
  'objectiveCollected',
  'cnotEscape',
  'portableSafeZone',
]) {
  const log = majorEventCases.find(([eventKey]) => eventKey === key)[2];
  assert.equal(
    getSimulationFeedbackCue(base, snapshot({ autoPlay: true, logs: [log] })),
    '',
    `${key} 사건은 자동 진행 중 반복음을 내면 안 됩니다.`,
  );
  assert.ok(
    getSimulationFeedbackPresentation(base, snapshot({ autoPlay: true, logs: [log] }))?.action,
    `${key} 사건은 자동 진행 중에도 시각 피드백을 유지해야 합니다.`,
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

const hyperloopLog = getMajorEventLog('hyperloopJump');
const manualHyperloop = snapshot({ logs: [hyperloopLog] });
const autoHyperloop = snapshot({ autoPlay: true, logs: [hyperloopLog] });
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
    snapshot({ dead: [{ id: 'actor-b' }], logs: [getMajorEventLog('bossSpawn')] }),
  ),
  'elimination',
  '탈락과 월드 사건이 동시에 발생하면 탈락 피드백을 우선해야 합니다.',
);

const riftOpenLog = getMajorEventLog('riftOpen');
const repeatedRift = snapshot({ logs: [riftOpenLog] });
assert.equal(
  getSimulationFeedbackCue(repeatedRift, snapshot({ logs: [riftOpenLog, eventLog('ordinary-1', '파밍을 계속합니다.', 'normal')] })),
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
const marketCraftSource = await readFile(new URL('../src/app/simulation/_components/SimulationMarketCraftSection.js', import.meta.url), 'utf8');
const marketKioskSource = await readFile(new URL('../src/app/simulation/_components/SimulationMarketKioskSection.js', import.meta.url), 'utf8');
const marketDroneSource = await readFile(new URL('../src/app/simulation/_components/SimulationMarketDroneSection.js', import.meta.url), 'utf8');
const marketPerkSource = await readFile(new URL('../src/app/simulation/_components/SimulationMarketPerkSection.js', import.meta.url), 'utf8');
const marketOpenTradeSource = await readFile(new URL('../src/app/simulation/_components/SimulationMarketOpenTradeOffers.js', import.meta.url), 'utf8');
const marketTradeCreateSource = await readFile(new URL('../src/app/simulation/_components/SimulationMarketTradeCreateForm.js', import.meta.url), 'utf8');
const pendingTranscendSource = await readFile(new URL('../src/app/simulation/_components/SimulationMarketPendingTranscendCard.js', import.meta.url), 'utf8');

const requiredActions = [
  'boss-defeat',
  'boss-spawn',
  'cnot-escape',
  'combat-kill',
  'detonation-death',
  'detonation-grace',
  'fog-active',
  'fog-clear',
  'fog-warning',
  'legendary-crate-open',
  'mastery-level',
  'objective-collected',
  'route-complete',
  'team-wipe-protection',
  'tactical-upgrade',
  'hyperloop-jump',
  'kiosk-revive',
  'kiosk-trade',
  'market-craft',
  'market-craft-failure',
  'market-failure',
  'market-trade',
  'market-trade-failure',
  'kiosk-trade-failure',
  'drone-delivery-failure',
  'perk-unlock-failure',
  'drone-delivery',
  'perk-unlock',
  'objective-spawn',
  'portable-safe-zone',
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
  'cnotEscape',
  'combatKill',
  'detonationDeath',
  'detonationGraceEnded',
  'fogClear',
  'fogSpread',
  'fogWarning',
  'legendaryCrateOpen',
  'masteryLevel',
  'objectiveCollected',
  'routeComplete',
  'teamWipeProtection',
  'tacticalUpgrade',
  'hyperloopJump',
  'kioskRevive',
  'objectiveSpawn',
  'kioskTrade',
  'marketCraft',
  'marketCraftFailure',
  'marketFailure',
  'marketTrade',
  'marketTradeFailure',
  'kioskTradeFailure',
  'droneDeliveryFailure',
  'perkUnlockFailure',
  'droneDelivery',
  'perkUnlock',
  'portableSafeZone',
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

const resultDrivenMarketControls = [
  [marketCraftSource, 'market-craft', '조합'],
  [marketKioskSource, 'kiosk-trade', '키오스크'],
  [marketDroneSource, 'drone-delivery', '드론'],
  [marketPerkSource, 'perk-unlock', '특전'],
  [marketOpenTradeSource, 'market-trade', '거래 수락'],
  [marketTradeCreateSource, 'market-trade', '거래 생성'],
];
for (const [componentSource, action, label] of resultDrivenMarketControls) {
  assert.match(componentSource, /import GameActionIcon/, `${label} 조작부는 공용 의미 아이콘을 사용해야 합니다.`);
  assert.match(componentSource, new RegExp(`<GameActionIcon action=["']${action}["']`), `${label} 조작부에 ${action} 아이콘이 필요합니다.`);
  assert.match(componentSource, /data-game-sfx="off"/, `${label} 조작부는 서버 결과 전에 성공음을 재생하면 안 됩니다.`);
}
assert.match(pendingTranscendSource, /<GameActionIcon action="transcend-supply"/, '초월 선택 상자는 전용 보급 아이콘을 사용해야 합니다.');
assert.match(pendingTranscendSource, /data-game-sfx="off"/, '초월 선택은 결과 로그보다 먼저 성공음을 재생하면 안 됩니다.');

console.log(JSON.stringify({
  majorEvents: majorEventCases.length + visualOnlyCases.length + 1,
  dedicatedCues: requiredCues.length,
  dedicatedIcons: requiredActions.length,
  dedicatedSfxTheme: true,
  marketResultEvents: 11,
  marketSemanticControls: resultDrivenMarketControls.length + 1,
  persistentEventBar: true,
}, null, 2));
