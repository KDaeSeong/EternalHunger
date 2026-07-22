import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  racingLogosFeedbackCue,
  racingLogosFeedbackSnapshot,
  racingLogosFeedbackTransition,
  racingLogosResultPresentation,
  racingLogosTextPresentation,
} from '../src/app/games/racing-logos-demo/_lib/racingLogosFeedback.js';
import {
  applyLocalPackAction,
  auditLogoPackAction,
  clearLocalPackAction,
  createNewState,
  generateRaceCardAction,
  generateSeasonCardAction,
  parseLocalPackText,
  sampleLocalPackText,
  setFilterAction,
} from '../src/app/games/racing-logos-demo/_lib/racingLogosEngine.js';

const routeUrl = new URL('../src/app/games/racing-logos-demo/', import.meta.url);
const componentUrl = new URL('_components/', routeUrl);
const pageSource = await readFile(new URL('play/page.js', routeUrl), 'utf8');
const componentSources = await Promise.all([
  'RacingLogosAuditTab.js',
  'RacingLogosLocalPackTab.js',
  'RacingLogosCalendarTab.js',
  'RacingLogosDataPackTab.js',
  'RacingLogosAdvancedTab.js',
].map((name) => readFile(new URL(name, componentUrl), 'utf8')));
const semanticComponentSources = await Promise.all([
  'RacingLogosAdvancedTab.js',
  'RacingLogosAuditTab.js',
  'RacingLogosCalendarTab.js',
  'RacingLogosDataPackTab.js',
  'RacingLogosEventsTab.js',
  'RacingLogosLocalPackTab.js',
  'RacingLogosLogTab.js',
  'RacingLogosMatrixTab.js',
  'RacingLogosPlayPanels.js',
  'RacingLogosTracksTab.js',
].map((name) => readFile(new URL(name, componentUrl), 'utf8')));
const visualSource = await readFile(new URL('RacingLogosVisuals.js', componentUrl), 'utf8');
const iconSource = await readFile(new URL('../src/app/games/_components/GameActionIcon.js', import.meta.url), 'utf8');
const soundSource = await readFile(new URL('../src/app/games/_lib/useGameSfx.js', import.meta.url), 'utf8');
const styleSource = await readFile(new URL('../src/styles/AppShell.css', import.meta.url), 'utf8');

function seed(runId = 'racing-feedback') {
  return createNewState({ now: '2026-07-12T00:00:00.000Z', runId });
}

function expectResult(previous, current, expected) {
  const presentation = racingLogosResultPresentation(previous, current);
  assert.equal(racingLogosFeedbackTransition(previous, current), expected.key, `${expected.key} 전환을 선택해야 합니다.`);
  assert.equal(presentation.action, expected.action, `${expected.key} 아이콘을 선택해야 합니다.`);
  assert.equal(presentation.cue, expected.cue, `${expected.key} 결과음을 선택해야 합니다.`);
  assert.equal(presentation.tone, expected.tone, `${expected.key} 결과 톤을 선택해야 합니다.`);
  return presentation;
}

const base = seed();
const baseSnapshot = racingLogosFeedbackSnapshot(base);
assert.equal(baseSnapshot.auditCount, 0, '새 검수는 감사 이력 0건이어야 합니다.');
assert.equal(racingLogosFeedbackCue(null, baseSnapshot), '', '첫 렌더에서는 결과음을 재생하면 안 됩니다.');
assert.equal(racingLogosFeedbackCue(baseSnapshot, { ...baseSnapshot }), '', '변화가 없으면 결과음을 재생하면 안 됩니다.');

const incompleteAudit = auditLogoPackAction(base);
expectResult(base, incompleteAudit, { key: 'logoAudit', action: 'logo-audit', cue: 'logoAudit', tone: 'highlight' });

const parsed = parseLocalPackText(sampleLocalPackText());
assert.equal(parsed.ok, true, '샘플 로컬팩은 유효해야 합니다.');
const packed = applyLocalPackAction(base, parsed.value);
expectResult(base, packed, { key: 'packApply', action: 'pack-apply', cue: 'packApply', tone: 'success' });
const perfectAudit = auditLogoPackAction(packed);
expectResult(packed, perfectAudit, { key: 'logoAuditPerfect', action: 'logo-perfect', cue: 'logoAuditPerfect', tone: 'success' });
assert.equal(racingLogosFeedbackSnapshot(perfectAudit).auditCompleteness, 100, '샘플 팩 감사 완성도는 100%여야 합니다.');

const cleared = clearLocalPackAction(packed);
expectResult(packed, cleared, { key: 'packClear', action: 'pack-clear', cue: 'packClear', tone: 'warning' });

const filtered = setFilterAction(base, { region: 'japan', surface: 'turf' });
const filterPresentation = expectResult(base, filtered, { key: 'filterChanged', action: 'filter', cue: '', tone: 'highlight' });
assert.match(filterPresentation.detail, /일본.*잔디/, '필터 결과에는 지역과 주로가 표시되어야 합니다.');

const raceCard = generateRaceCardAction(base);
expectResult(base, raceCard, { key: 'raceCard', action: 'race-card', cue: 'raceCard', tone: 'success' });
const seasonCard = generateSeasonCardAction(base);
expectResult(base, seasonCard, { key: 'seasonCard', action: 'season-card', cue: 'seasonCard', tone: 'success' });

const perfectWithRace = generateRaceCardAction(perfectAudit);
const releaseReady = generateSeasonCardAction(perfectWithRace);
const releasePresentation = expectResult(perfectWithRace, releaseReady, { key: 'dataPackReady', action: 'release-ready', cue: 'dataPackReady', tone: 'champion' });
assert.match(releasePresentation.detail, /모두 준비/, '배포 준비 결과는 완성 조건을 설명해야 합니다.');

const emptyFilter = setFilterAction(base, { region: 'moon' });
const blocked = generateRaceCardAction(emptyFilter);
expectResult(emptyFilter, blocked, { key: 'blocked', action: 'pack-invalid', cue: 'packInvalid', tone: 'warning' });
const blockedAgain = generateRaceCardAction(blocked);
expectResult(blocked, blockedAgain, { key: 'blocked', action: 'pack-invalid', cue: 'packInvalid', tone: 'warning' });

const newRun = seed('racing-feedback-new');
expectResult(base, newRun, { key: 'newRun', action: 'new', cue: 'start', tone: 'highlight' });
assert.equal(racingLogosFeedbackCue(base, newRun), '', '다른 검수를 불러올 때 자동 시작음을 내면 안 됩니다.');
assert.equal(racingLogosTextPresentation('유효한 JSON 객체가 아닙니다.').action, 'pack-invalid', '잘못된 JSON은 오류 아이콘이어야 합니다.');
assert.equal(racingLogosTextPresentation("Expected property name or '}' in JSON at position 1").tone, 'warning', '브라우저 영문 JSON 구문 오류도 경고 톤이어야 합니다.');
assert.equal(racingLogosTextPresentation('보강 JSON 초안을 로컬팩 편집기에 불러왔습니다.').action, 'draft', '초안 로드는 초안 아이콘이어야 합니다.');
assert.equal(racingLogosTextPresentation('검수 상태를 저장했습니다.').action, 'save', '저장 결과는 저장 아이콘이어야 합니다.');
assert.equal(racingLogosTextPresentation('저장된 검수를 불러왔습니다.').action, 'load', '불러오기 결과는 폴더 아이콘이어야 합니다.');

for (const cue of [
  'logoAudit', 'logoAuditPerfect', 'packApply', 'packClear', 'packInvalid', 'raceCard',
  'seasonCard', 'dataPackReady', 'draftLoaded', 'start',
]) {
  assert.match(soundSource, new RegExp(`\\n  ${cue}: \\[`), `${cue} 결과음 프로필이 있어야 합니다.`);
}
for (const icon of [
  'logo-audit', 'logo-perfect', 'race-card', 'season-card', 'release-ready', 'pack-apply',
  'pack-clear', 'pack-invalid', 'filter', 'draft', 'new', 'save', 'load', 'archive',
]) {
  const escaped = icon.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  assert.match(iconSource, new RegExp(`\\n  (?:'${escaped}'|${escaped}): `), `${icon} 결과 아이콘 매핑이 있어야 합니다.`);
}
for (const icon of [
  'analysis', 'calendar', 'complete', 'filter', 'logs', 'map', 'search', 'settings',
  'status', 'tactics', 'target', 'title', 'trophy',
]) {
  assert.match(iconSource, new RegExp(`\\n  ${icon}: `), `${icon} 레이싱 UI 아이콘 매핑이 있어야 합니다.`);
}

assert.match(pageSource, /const stateRef = useRef\(state\)/, '연속 에셋 행동은 최신 상태 참조를 사용해야 합니다.');
assert.match(pageSource, /racingLogosResultPresentation\(previousState, nextState\)/, '상태 행동마다 결과 프레젠테이션을 계산해야 합니다.');
assert.match(pageSource, /setState=\{applyRacingState\}/, '하위 탭 상태 변경은 공통 결과 래퍼를 통과해야 합니다.');
assert.match(pageSource, /action=\{resultPresentation\.action\}/, '상단 결과 패널에 결과 아이콘을 전달해야 합니다.');
assert.match(pageSource, /publishResult\('보강 JSON 초안을[^\n]+, 'draftLoaded'\)/, '초안 로드는 전용 결과음을 재생해야 합니다.');

for (const source of componentSources) {
  assert.match(source, /action=\{resultPresentation\.action\}/, '행동 탭 결과 패널에 결과 아이콘을 전달해야 합니다.');
  assert.match(source, /tone=\{resultPresentation\.tone\}/, '행동 탭 결과 패널에 결과 톤을 전달해야 합니다.');
  for (const match of source.matchAll(/setState\(\(current\) =>/g)) {
    const buttonPrefix = source.slice(Math.max(0, match.index - 500), match.index);
    if (buttonPrefix.lastIndexOf('<select') > buttonPrefix.lastIndexOf('<ActionButton')) continue;
    assert.match(buttonPrefix, /cue="off"/, '상태 기반 결과음이 있는 버튼은 선행 클릭음을 꺼야 합니다.');
  }
}

const semanticSource = semanticComponentSources.join('\n');
const semanticPanelTitles = [...semanticSource.matchAll(/<RacingLogosPanelTitle\b/g)].length;
const semanticInfoRows = [...semanticSource.matchAll(/<RacingLogosInfoRow\b/g)].length;
const semanticStatIcons = [...semanticSource.matchAll(/<SmallStat icon=/g)].length;
assert.equal(semanticPanelTitles, 25, '레이싱 로고 패널 제목 25개가 의미 아이콘을 사용해야 합니다.');
assert.equal(semanticInfoRows, 7, '레이싱 로고 핵심 정보 행 7개가 공통 시각 행을 사용해야 합니다.');
assert.equal(semanticStatIcons, 28, '레이싱 로고 요약 통계 28개가 의미 아이콘을 사용해야 합니다.');
assert.doesNotMatch(semanticSource, /className="games-panel-title"/, '아이콘 없는 원시 패널 제목을 남기면 안 됩니다.');
assert.doesNotMatch(semanticSource, /className="game-save-row"/, '공통 시각 요소가 없는 원시 정보 행을 남기면 안 됩니다.');
assert.equal([...semanticSource.matchAll(/leading=\{<LogoPreview/g)].length, 3, '트랙·이벤트·라운드 행은 실제 로고 미리보기를 보존해야 합니다.');
assert.match(visualSource, /export function RacingLogosPanelTitle/, '레이싱 로고 공통 패널 제목 컴포넌트가 필요합니다.');
assert.match(visualSource, /export function RacingLogosInfoRow/, '레이싱 로고 공통 정보 행 컴포넌트가 필요합니다.');
assert.match(visualSource, /leading \? 'racing-logo-preview-row' : 'racing-logo-icon-row'/, '정보 행은 로고와 의미 아이콘 레이아웃을 구분해야 합니다.');
assert.match(styleSource, /\.racing-logos-panel-title__copy/, '레이싱 패널 제목 아이콘 레이아웃이 필요합니다.');
assert.match(styleSource, /\.game-save-row\.racing-logo-preview-row/, '실제 로고 미리보기 행 레이아웃이 필요합니다.');

console.log(JSON.stringify({
  feedbackTransitions: 10,
  resultCues: 10,
  resultPanels: componentSources.length + 1,
  releaseReady: true,
  semanticInfoRows,
  semanticPanelTitles,
  semanticStatIcons,
}, null, 2));
