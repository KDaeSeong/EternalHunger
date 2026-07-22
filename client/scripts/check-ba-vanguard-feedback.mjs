import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  baVanguardFeedbackCue,
  baVanguardFeedbackSnapshot,
  baVanguardFeedbackTransition,
  baVanguardResultPresentation,
  baVanguardTextPresentation,
} from '../src/app/games/ba-vanguard/_lib/baVanguardFeedback.js';
import {
  PRESET_DECKS,
  activateVCAct,
  advancePhase,
  autoRide,
  autoRideReadiness,
  callFromHand,
  declareAttack,
  endTurn,
  getCard,
  getPreset,
  guardAddFromHand,
  guardEnd,
  initDuelState,
  mulliganAll,
  retireCircle,
  rideFromHand,
  rideReadiness,
  strideWithAutoCost,
} from '../src/app/games/ba-vanguard/_lib/baVanguardCatalog.js';

const routeUrl = new URL('../src/app/games/ba-vanguard/', import.meta.url);
const componentUrl = new URL('_components/', routeUrl);
const pageSource = await readFile(new URL('BaVanguardPlayContent.js', componentUrl), 'utf8');
const duelSource = await readFile(new URL('BaVanguardDuelTab.js', componentUrl), 'utf8');
const handSource = await readFile(new URL('BaVanguardHandLogTab.js', componentUrl), 'utf8');
const boardSource = await readFile(new URL('BaVanguardBoard.js', componentUrl), 'utf8');
const deckSource = await readFile(new URL('BaVanguardDeckTab.js', componentUrl), 'utf8');
const tacticsSource = await readFile(new URL('BaVanguardTacticsTab.js', componentUrl), 'utf8');
const visualSource = await readFile(new URL('BaVanguardVisuals.js', componentUrl), 'utf8');
const iconSource = await readFile(new URL('../src/app/games/_components/GameActionIcon.js', import.meta.url), 'utf8');
const soundSource = await readFile(new URL('../src/app/games/_lib/useGameSfx.js', import.meta.url), 'utf8');
const styleSource = await readFile(new URL('../src/styles/AppShell.css', import.meta.url), 'utf8');

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

const myDeck = getPreset(PRESET_DECKS[0]?.id);
const oppDeck = getPreset(PRESET_DECKS[1]?.id || PRESET_DECKS[0]?.id);

function seed(seedValue = 2401) {
  return initDuelState({
    meDeck: myDeck,
    oppDeck,
    seed: seedValue,
    first: 'me',
    firstTurnNoDraw: false,
  });
}

function unit(cardId) {
  return { uid: `check-${cardId}`, cardId, isRest: false, powerMod: 0, critMod: 0 };
}

function cardIdWhere(predicate, entries = myDeck.main) {
  const row = entries.find((entry) => predicate(getCard(entry.cardId)));
  assert.ok(row?.cardId, '검사에 필요한 카드가 프리셋에 있어야 합니다.');
  return row.cardId;
}

function expectResult(previous, current, expected) {
  const presentation = baVanguardResultPresentation(previous, current);
  assert.equal(baVanguardFeedbackTransition(previous, current), expected.key, `${expected.key} 전환을 선택해야 합니다.`);
  assert.equal(presentation.action, expected.action, `${expected.key} 아이콘을 선택해야 합니다.`);
  assert.equal(presentation.cue, expected.cue, `${expected.key} 결과음을 선택해야 합니다.`);
  assert.equal(presentation.tone, expected.tone, `${expected.key} 결과 톤을 선택해야 합니다.`);
  return presentation;
}

const base = seed();
const baseSnapshot = baVanguardFeedbackSnapshot(base);
assert.equal(baseSnapshot.meHand, 5, '초기 내 패는 5장이어야 합니다.');
assert.equal(baVanguardFeedbackCue(null, baseSnapshot), '', '첫 렌더에서는 결과음을 재생하면 안 됩니다.');
assert.equal(baVanguardFeedbackCue(baseSnapshot, { ...baseSnapshot }), '', '변화가 없으면 결과음을 재생하면 안 됩니다.');

const mulligan = clone(base);
assert.equal(mulliganAll(mulligan, 'me'), true, '첫 스탠드 페이즈에는 멀리건할 수 있어야 합니다.');
expectResult(base, mulligan, { key: 'draw', action: 'vanguard-draw', cue: 'vanguardDraw', tone: 'success' });

const drawState = clone(base);
assert.equal(advancePhase(drawState, false), true, '스탠드에서 드로우 페이즈로 진행해야 합니다.');
expectResult(base, drawState, { key: 'draw', action: 'vanguard-draw', cue: 'vanguardDraw', tone: 'success' });
const mainState = clone(drawState);
assert.equal(advancePhase(mainState, false), true, '드로우에서 메인 페이즈로 진행해야 합니다.');
expectResult(drawState, mainState, { key: 'phase', action: 'phase', cue: 'vanguardPhase', tone: 'highlight' });

const grade1Id = cardIdWhere((card) => card?.type === 'normal' && card.grade === 1);
const grade2Id = cardIdWhere((card) => card?.type === 'normal' && card.grade === 2);
const defaultAutoRide = autoRideReadiness(mainState, 'me');
assert.equal(defaultAutoRide.canRide, true, '기본 시드에서도 자동 라이드 또는 라이드 어시스트가 준비되어야 합니다.');
assert.equal(defaultAutoRide.wantGrade, 1, '초기 G0 VC는 G1 라이드 후보를 찾아야 합니다.');

const assistedRideState = clone(mainState);
const assistedHandCount = assistedRideState.players.me.hand.length;
const assistedDeckCount = assistedRideState.players.me.deck.length;
const assistedSoulCount = assistedRideState.players.me.soul.length;
assert.equal(autoRide(assistedRideState, 'me'), true, '패에 G1이 없어도 라이드 어시스트로 자동 라이드해야 합니다.');
assert.equal(getCard(assistedRideState.players.me.circles.VC?.cardId)?.grade, 1, '자동 라이드 후 VC는 G1이어야 합니다.');
assert.equal(assistedRideState.players.me.hand.length, assistedHandCount - 1, '라이드한 카드는 패에서 빠져야 합니다.');
assert.equal(assistedRideState.players.me.deck.length, assistedDeckCount, '라이드 어시스트 교환은 덱 장수를 유지해야 합니다.');
assert.equal(assistedRideState.players.me.soul.length, assistedSoulCount + 1, '이전 스타터는 소울로 이동해야 합니다.');
assert.equal(assistedRideState.players.me.rideTurn, assistedRideState.turn, '라이드한 턴을 기록해야 합니다.');
const assistedRidePresentation = expectResult(mainState, assistedRideState, { key: 'rideAssist', action: 'vanguard-ride-assist', cue: 'vanguardRideAssist', tone: 'success' });
assert.match(assistedRidePresentation.detail, /라이드 어시스트/, '어시스트 결과는 교환 과정을 직접 설명해야 합니다.');
const assistedRideLogCount = assistedRideState.log.length;
assert.equal(autoRide(assistedRideState, 'me'), false, '같은 턴에 두 번 라이드할 수 없어야 합니다.');
assert.equal(assistedRideState.log.length, assistedRideLogCount + 1, '중복 라이드 거절 사유를 로그에 남겨야 합니다.');
assert.match(assistedRideState.log[0], /이미 라이드/, '중복 라이드 로그가 턴당 1회 제한을 설명해야 합니다.');

const invalidGradeRide = clone(mainState);
invalidGradeRide.players.me.hand.unshift(grade2Id);
const invalidGradeReadiness = rideReadiness(invalidGradeRide, 'me', grade2Id);
assert.equal(invalidGradeReadiness.canRide, false, 'G0 VC 위에 G2를 건너뛰어 라이드할 수 없어야 합니다.');
const invalidGradeHandCount = invalidGradeRide.players.me.hand.length;
assert.equal(rideFromHand(invalidGradeRide, 'me', grade2Id), false, '잘못된 등급의 수동 라이드를 거절해야 합니다.');
assert.equal(invalidGradeRide.players.me.hand.length, invalidGradeHandCount, '거절된 라이드 카드는 패에 남아야 합니다.');
expectResult(mainState, invalidGradeRide, { key: 'invalid', action: 'vanguard-invalid', cue: 'vanguardInvalid', tone: 'warning' });

const rideState = clone(mainState);
rideState.players.me.hand.unshift(grade1Id);
assert.equal(rideFromHand(rideState, 'me', grade1Id), true, 'G1 카드는 초기 VC 위에 라이드할 수 있어야 합니다.');
expectResult(mainState, rideState, { key: 'ride', action: 'vanguard-ride', cue: 'vanguardRide', tone: 'success' });

const callState = clone(mainState);
callState.players.me.hand.unshift(grade1Id);
assert.equal(callFromHand(callState, 'me', grade1Id, 'RC_FL'), true, '빈 리어가드 서클에 콜할 수 있어야 합니다.');
expectResult(mainState, callState, { key: 'call', action: 'vanguard-call', cue: 'vanguardCall', tone: 'success' });
const retiredState = clone(callState);
assert.equal(retireCircle(retiredState, 'me', 'RC_FL'), true, '콜한 유닛을 퇴각시킬 수 있어야 합니다.');
expectResult(callState, retiredState, { key: 'retired', action: 'vanguard-retire', cue: 'vanguardRetire', tone: 'warning' });

const grade3Id = cardIdWhere((card) => card?.type === 'normal' && card.grade === 3);
const strideState = clone(mainState);
strideState.players.me.circles.VC = unit(grade3Id);
strideState.players.me.hand = [grade3Id, ...strideState.players.me.hand];
assert.equal(strideWithAutoCost(strideState, 'me'), true, 'G3 VC와 비용이 있으면 스트라이드해야 합니다.');
expectResult(mainState, strideState, { key: 'stride', action: 'vanguard-stride', cue: 'vanguardStride', tone: 'champion' });

const skillState = clone(mainState);
skillState.players.me.circles.VC = unit(grade3Id);
skillState.players.me.hand = [grade1Id, ...skillState.players.me.hand];
assert.equal(activateVCAct(skillState, 'me', grade1Id), true, '비용 카드가 있으면 VC 스킬을 사용할 수 있어야 합니다.');
expectResult(mainState, skillState, { key: 'skill', action: 'vanguard-skill', cue: 'vanguardSkill', tone: 'highlight' });

function battleSeed(active) {
  const state = seed(active === 'me' ? 3101 : 3102);
  state.active = active;
  state.first = active;
  state.firstTurnNoDraw = false;
  state.phase = 'BATTLE';
  return state;
}

const attackBase = battleSeed('me');
const attackState = clone(attackBase);
assert.equal(declareAttack(attackState, 'VC', 'VC'), true, '내 VC가 상대 VC를 공격할 수 있어야 합니다.');
expectResult(attackBase, attackState, { key: 'attackDeclared', action: 'vanguard-attack', cue: 'vanguardAttack', tone: 'highlight' });

const guardWindowBase = battleSeed('opp');
const guardWindow = clone(guardWindowBase);
assert.equal(declareAttack(guardWindow, 'VC', 'VC'), true, 'AI VC가 내 VC를 공격할 수 있어야 합니다.');
const guardWindowPresentation = expectResult(guardWindowBase, guardWindow, { key: 'guardWindow', action: 'vanguard-guard-window', cue: 'vanguardGuardWindow', tone: 'warning' });
assert.match(guardWindowPresentation.detail, /패와 G 가디언/, '가드 창 결과에는 방어 자원 안내가 있어야 합니다.');

const triggerId = cardIdWhere((card) => card?.type === 'trigger');
const guarded = clone(guardWindow);
guarded.players.me.hand.unshift(triggerId);
assert.equal(guardAddFromHand(guarded, 'me', triggerId), true, '실드 카드로 가드할 수 있어야 합니다.');
expectResult(guardWindow, guarded, { key: 'guardAdded', action: 'vanguard-guard', cue: 'vanguardGuard', tone: 'success' });

const sentinelId = cardIdWhere((card) => card?.type === 'sentinel');
const perfectGuard = clone(guardWindow);
perfectGuard.players.me.hand = [sentinelId, triggerId, ...perfectGuard.players.me.hand];
assert.equal(guardAddFromHand(perfectGuard, 'me', sentinelId), true, '센티넬과 비용 카드로 완전 가드할 수 있어야 합니다.');
expectResult(guardWindow, perfectGuard, { key: 'perfectGuard', action: 'vanguard-perfect-guard', cue: 'vanguardPerfectGuard', tone: 'champion' });

const blocked = clone(perfectGuard);
assert.equal(guardEnd(blocked), true, '완전 가드 후 배틀을 해결할 수 있어야 합니다.');
expectResult(perfectGuard, blocked, { key: 'attackBlocked', action: 'vanguard-blocked', cue: 'vanguardBlocked', tone: 'success' });

const hit = clone(attackState);
assert.equal(guardEnd(hit), true, '가드 없이 내 공격을 해결할 수 있어야 합니다.');
expectResult(attackState, hit, { key: 'attackHit', action: 'vanguard-hit', cue: 'vanguardHit', tone: 'success' });

const incoming = clone(guardWindow);
assert.equal(guardEnd(incoming), true, '가드 없이 AI 공격을 해결할 수 있어야 합니다.');
expectResult(guardWindow, incoming, { key: 'damageTaken', action: 'vanguard-damage', cue: 'vanguardDamage', tone: 'danger' });

const triggerState = clone(base);
triggerState.log = ['[나] 파워 트리거가 발동했습니다. (드라이브 체크)', ...triggerState.log];
expectResult(base, triggerState, { key: 'trigger', action: 'vanguard-trigger', cue: 'vanguardTrigger', tone: 'champion' });

for (const trigger of [
  { label: '크리티컬', key: 'triggerCritical', action: 'vanguard-trigger-critical', cue: 'vanguardTriggerCritical', tone: 'champion' },
  { label: '드로우', key: 'triggerDraw', action: 'vanguard-trigger-draw', cue: 'vanguardTriggerDraw', tone: 'success' },
  { label: '스탠드', key: 'triggerStand', action: 'vanguard-trigger-stand', cue: 'vanguardTriggerStand', tone: 'highlight' },
  { label: '힐', key: 'triggerHeal', action: 'vanguard-trigger-heal', cue: 'vanguardTriggerHeal', tone: 'success' },
]) {
  const state = clone(base);
  state.log = [`[나] ${trigger.label} 트리거가 발동했습니다. (드라이브 체크)`, ...state.log];
  expectResult(base, state, trigger);
}

const invalid = clone(mainState);
assert.equal(strideWithAutoCost(invalid, 'me'), false, 'G0 VC에서는 스트라이드가 거절되어야 합니다.');
expectResult(mainState, invalid, { key: 'invalid', action: 'vanguard-invalid', cue: 'vanguardInvalid', tone: 'warning' });
const wrongAiTurn = clone(mainState);
wrongAiTurn.log = ['[나] 현재는 AI가 진행할 차례가 아닙니다.', ...wrongAiTurn.log];
expectResult(mainState, wrongAiTurn, { key: 'invalid', action: 'vanguard-invalid', cue: 'vanguardInvalid', tone: 'warning' });

const endState = clone(mainState);
endState.phase = 'END';
const nextTurn = clone(endState);
assert.equal(endTurn(nextTurn), true, '엔드 페이즈에서 다음 턴을 시작해야 합니다.');
expectResult(endState, nextTurn, { key: 'turn', action: 'vanguard-turn', cue: 'vanguardTurn', tone: 'highlight' });

const victory = clone(base);
victory.winner = 'me';
victory.log = ['[나] 6데미지로 승리했습니다.', ...victory.log];
expectResult(base, victory, { key: 'victory', action: 'vanguard-victory', cue: 'vanguardVictory', tone: 'champion' });
const defeat = clone(base);
defeat.winner = 'opp';
defeat.log = ['[AI] 6데미지로 승리했습니다.', ...defeat.log];
expectResult(base, defeat, { key: 'defeat', action: 'vanguard-defeat', cue: 'vanguardDefeat', tone: 'danger' });
const deckOutDefeat = clone(base);
deckOutDefeat.winner = 'opp';
deckOutDefeat.log = ['[나] 덱이 비어 패배했습니다.', ...deckOutDefeat.log];
expectResult(base, deckOutDefeat, { key: 'deckOutDefeat', action: 'vanguard-deck-out', cue: 'vanguardDeckOut', tone: 'danger' });
const deckOutVictory = clone(base);
deckOutVictory.winner = 'me';
deckOutVictory.log = ['[AI] 드라이브 체크 중 덱이 비었습니다.', ...deckOutVictory.log];
expectResult(base, deckOutVictory, { key: 'deckOutVictory', action: 'vanguard-deck-out', cue: 'vanguardVictory', tone: 'champion' });

assert.equal(baVanguardTextPresentation('새 BA Vanguard 듀얼을 시작했습니다.').cue, 'vanguardStart', '새 듀얼은 전용 시작음을 사용해야 합니다.');
assert.equal(baVanguardTextPresentation('BA Vanguard 리플레이를 준비했습니다.').cue, 'vanguardReplay', '리플레이 준비는 전용 결과음을 사용해야 합니다.');
assert.equal(baVanguardTextPresentation('로그인하면 상태를 저장할 수 있습니다.').action, 'vanguard-invalid', '비로그인 안내는 실행 불가 아이콘이어야 합니다.');
assert.equal(baVanguardTextPresentation('저장된 BA Vanguard 상태를 불러왔습니다.').action, 'load', '불러오기 결과는 폴더 아이콘이어야 합니다.');
assert.equal(baVanguardTextPresentation('BA Vanguard 상태를 저장했습니다.').action, 'save', '저장 결과는 저장 아이콘이어야 합니다.');
assert.equal(baVanguardTextPresentation('플레이테스트 결과를 전적에 기록했습니다.').action, 'archive', '전적 기록은 보관 아이콘이어야 합니다.');

for (const cue of [
  'vanguardStart', 'vanguardPhase', 'vanguardInvalid', 'vanguardTurn', 'vanguardDraw',
  'vanguardRide', 'vanguardRideAssist', 'vanguardStride', 'vanguardCall', 'vanguardSkill', 'vanguardAttack',
  'vanguardGuardWindow', 'vanguardGuard', 'vanguardPerfectGuard', 'vanguardBlocked',
  'vanguardTrigger', 'vanguardTriggerCritical', 'vanguardTriggerDraw', 'vanguardTriggerStand',
  'vanguardTriggerHeal', 'vanguardHit', 'vanguardDamage', 'vanguardVictory', 'vanguardDefeat',
  'vanguardRetire', 'vanguardDeckOut', 'vanguardReplay',
]) {
  assert.match(soundSource, new RegExp(`\\n  ${cue}: \\[`), `${cue} 결과음 프로필이 있어야 합니다.`);
}

for (const icon of [
  'vanguard-turn', 'vanguard-draw', 'vanguard-ride', 'vanguard-ride-assist', 'vanguard-call', 'vanguard-stride',
  'vanguard-skill', 'vanguard-attack', 'vanguard-guard-window', 'vanguard-guard',
  'vanguard-perfect-guard', 'vanguard-blocked', 'vanguard-trigger', 'vanguard-trigger-critical',
  'vanguard-trigger-draw', 'vanguard-trigger-stand', 'vanguard-trigger-heal', 'vanguard-hit',
  'vanguard-damage', 'vanguard-retire', 'vanguard-victory', 'vanguard-defeat',
  'vanguard-deck-out', 'vanguard-invalid', 'vanguard-replay',
]) {
  assert.match(iconSource, new RegExp(`\\n  '${icon}': `), `${icon} 결과 아이콘 매핑이 있어야 합니다.`);
}

assert.match(pageSource, /const replaceDuel = useCallback/, '불러온 듀얼은 피드백 기준 상태를 함께 교체해야 합니다.');
assert.match(pageSource, /setDuel: replaceDuel/, '저장/방 불러오기는 상태 교체 래퍼를 사용해야 합니다.');
assert.match(pageSource, /baVanguardResultPresentation\(feedbackRef\.current, current\)/, '듀얼 변화마다 결과 프레젠테이션을 계산해야 합니다.');
assert.match(pageSource, /action=\{resultPresentation\.action\}/, '상단 결과 패널에 결과 아이콘을 전달해야 합니다.');
assert.match(pageSource, /cue="off" onClick=\{downloadReplayExport\}/, '리플레이 버튼은 전용 결과음과 클릭음이 겹치지 않아야 합니다.');
assert.match(pageSource, /setTimeout\(\(\) => runAiUntilStop\(false\), AI_FEEDBACK_DELAY_MS\)/, '자동 AI 연장은 내 차례에서 실행 불가 결과를 덮어쓰면 안 됩니다.');
assert.match(pageSource, /const autoRideState = autoRideReadiness\(duel, 'me'\)/, '듀얼 화면은 자동 라이드 가능 상태를 엔진에서 계산해야 합니다.');
assert.match(pageSource, /const selectedRideState = rideReadiness\(duel, 'me', selectedHandId\)/, '선택 카드의 수동 라이드 가능 상태를 엔진에서 계산해야 합니다.');
assert.match(duelSource, /onClick=\{\(\) => runAiUntilStop\(true\)\}/, '직접 누른 AI 진행만 실행 불가 피드백을 요청해야 합니다.');
assert.match(duelSource, /disabled=\{!autoRideState\.canRide\}/, '자동 라이드 버튼은 실행 가능 상태를 반영해야 합니다.');
assert.match(duelSource, /autoRideState\.source === 'assist'/, '자동 라이드 버튼은 라이드 어시스트 사용 여부를 알려야 합니다.');
assert.match(handSource, /disabled=\{!selectedRideState\.canRide\}/, '수동 라이드 버튼은 선택 카드의 등급과 턴 제한을 반영해야 합니다.');
assert.match(handSource, /selectedRideState\.reason/, '패 액션은 라이드 불가 사유를 표시해야 합니다.');

for (const source of [duelSource, handSource]) {
  assert.match(source, /<RecentActionResult\b/, '행동 탭에 최근 결과 패널이 있어야 합니다.');
  assert.match(source, /action=\{resultPresentation\.action\}/, '행동 탭 결과 패널에 전용 아이콘을 전달해야 합니다.');
  assert.match(source, /tone=\{resultPresentation\.tone\}/, '행동 탭 결과 패널에 결과 톤을 전달해야 합니다.');
}
for (const source of [duelSource, handSource, boardSource]) {
  for (const match of source.matchAll(/onClick=\{(?:on|\(\) => on)(?:AutoRide|Mulligan|Stride|VCAct|RideSelected|CallSelected|Retire|GGuard|GuardAdd|GuardEnd|nextPhase|runAiUntilStop|startNewDuel)/g)) {
    const buttonPrefix = source.slice(Math.max(0, match.index - 260), match.index);
    assert.match(buttonPrefix, /cue="off"/, '상태 결과음이 있는 버튼은 선행 클릭음을 꺼야 합니다.');
  }
}
assert.match(boardSource, /side === 'opp' && selectedAttacker \? 'off'/, '공격 목표 클릭은 전투 결과음과 선행음을 겹치지 않아야 합니다.');

const visualSources = [boardSource, deckSource, duelSource, handSource, tacticsSource];
const panelTitleCount = visualSources.reduce((count, source) => count + [...source.matchAll(/<BaVanguardPanelTitle\b/g)].length, 0);
const iconRowCount = visualSources.reduce((count, source) => count + [...source.matchAll(/<BaVanguardIconRow\b/g)].length, 0);
assert.equal(panelTitleCount, 23, 'BA Vanguard의 23개 기능 패널 제목에 의미 아이콘이 있어야 합니다.');
assert.equal(iconRowCount, 12, '판단·분석·전투 핵심 행 12곳에 의미 아이콘이 있어야 합니다.');
assert.doesNotMatch(visualSources.join('\n'), /<div className="games-panel-title">/, '기존 무아이콘 패널 제목이 남으면 안 됩니다.');
assert.match(visualSource, /export function BaVanguardPanelTitle/, '전용 패널 제목 컴포넌트가 있어야 합니다.');
assert.match(visualSource, /export function BaVanguardIconRow/, '전용 판단 행 컴포넌트가 있어야 합니다.');
assert.match(styleSource, /\.ba-vanguard-panel-title h2 \.game-action-icon/, '패널 제목 아이콘 스타일이 있어야 합니다.');
assert.match(styleSource, /\.ba-vanguard-icon-row > \.game-action-icon/, '판단 행 아이콘 스타일이 있어야 합니다.');

console.log(JSON.stringify({
  feedbackTransitions: 28,
  resultCues: 27,
  resultPanels: 3,
  semanticPanelTitles: panelTitleCount,
  semanticRows: iconRowCount,
  loadedStateWrapper: true,
  rideAssistRegression: true,
}, null, 2));
