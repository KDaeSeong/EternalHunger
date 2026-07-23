import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  primitiveActionFeedback,
  primitiveActionResultPresentation,
  primitiveMilestoneCue,
  primitiveMilestoneSnapshot,
  primitiveTextPresentation,
} from '../src/app/games/primitive-archive/_lib/primitiveArchiveFeedback.js';

const routeUrl = new URL('../src/app/games/primitive-archive/', import.meta.url);
const componentUrl = new URL('_components/', routeUrl);
const playSource = await readFile(new URL('PrimitiveArchivePlayContent.js', componentUrl), 'utf8');
const actionSource = await readFile(new URL('PrimitiveArchiveActionWorkspace.js', componentUrl), 'utf8');
const campSource = await readFile(new URL('PrimitiveArchiveCampWorkspace.js', componentUrl), 'utf8');
const growthSource = await readFile(new URL('PrimitiveArchiveGrowthTab.js', componentUrl), 'utf8');
const partySource = await readFile(new URL('PrimitiveArchivePartyWorkspace.js', componentUrl), 'utf8');
const projectSource = await readFile(new URL('PrimitiveArchiveProjectsPanel.js', componentUrl), 'utf8');
const researchPreviewSource = await readFile(new URL('PrimitiveArchiveResearchTreePreview.js', componentUrl), 'utf8');
const tribeSource = await readFile(new URL('PrimitiveArchiveTribeTab.js', componentUrl), 'utf8');
const inventorySource = await readFile(new URL('PrimitiveArchiveInventoryTab.js', componentUrl), 'utf8');
const reportSource = await readFile(new URL('PrimitiveArchiveReportTab.js', componentUrl), 'utf8');
const runSource = await readFile(new URL('PrimitiveArchiveRunTab.js', componentUrl), 'utf8');
const turnHorizonSource = await readFile(new URL('PrimitiveArchiveTurnHorizon.js', componentUrl), 'utf8');
const visualSource = await readFile(new URL('PrimitiveArchiveVisuals.js', componentUrl), 'utf8');
const worldMapSource = await readFile(new URL('PrimitiveArchiveWorldMap.js', componentUrl), 'utf8');
const primitiveSource = await readFile(new URL('../src/app/games/_components/GamePlayPrimitives.js', import.meta.url), 'utf8');
const iconSource = await readFile(new URL('../src/app/games/_components/GameActionIcon.js', import.meta.url), 'utf8');
const soundSource = await readFile(new URL('../src/app/games/_lib/useGameSfx.js', import.meta.url), 'utf8');
const audioThemeSource = await readFile(new URL('../src/app/games/_lib/gameAudioThemes.js', import.meta.url), 'utf8');
const styleSource = await readFile(new URL('../src/styles/AppShell.css', import.meta.url), 'utf8');

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

const base = {
  runId: 'primitive-feedback',
  day: 1,
  ap: 4,
  ended: false,
  victory: false,
  log: ['Day 1: 기존 기록'],
  party: [{ hp: 100 }],
  counters: { gather: 0, hunt: 0, craft: 0, farm: 0, herd: 0, fish: 0, mine: 0, meals: 0, camp: 0 },
  exploration: { discoverySerial: 0 },
  projects: { completionSerial: 0 },
  research: { completionSerial: 0, eureka: {} },
  civics: { completionSerial: 0, inspiration: {} },
  tribe: { growthSerial: 0 },
  diplomacy: { contactSerial: 0 },
};

const actionRows = [
  { label: '채집', action: 'primitive-gather', cue: 'gather', resultLabel: '채집 성공', log: 'Day 1: 채집 성공', counter: 'gather' },
  { label: '사냥', action: 'primitive-hunt', cue: 'combat', resultLabel: '사냥 성공', log: 'Day 1: 사냥 성공', counter: 'hunt' },
  { label: '제작', action: 'primitive-craft', cue: 'craft', resultLabel: '제작 성공', log: 'Day 1: 제작 성공', counter: 'craft' },
  { label: '농업', action: 'primitive-farm', cue: 'farm', resultLabel: '농업 생산', log: 'Day 1: 농업 성공', counter: 'farm' },
  { label: '목축', action: 'primitive-herd', cue: 'herd', resultLabel: '목축 생산', log: 'Day 1: 목축 성공', counter: 'herd' },
  { label: '어로', action: 'primitive-fishing', cue: 'fish', resultLabel: '어로 성공', log: 'Day 1: 어로 성공', counter: 'fish' },
  { label: '채광', action: 'primitive-mining', cue: 'mine', resultLabel: '채광 성공', log: 'Day 1: 채광 성공', counter: 'mine' },
  { label: '식사', action: 'primitive-meal', cue: 'consume', resultLabel: '식사 완료', log: 'Day 1: 열매를 먹었습니다.', counter: 'meals' },
  { label: '휴식', action: 'primitive-rest', cue: 'rest', resultLabel: '휴식 완료', log: 'Day 1: 휴식했습니다.' },
  { label: '연구', action: 'primitive-research', cue: 'research', resultLabel: '연구 진척', log: 'Day 1: 연구 +4RP' },
  { label: '부족 회의', action: 'primitive-civic', cue: 'policy', resultLabel: '사회 제도 진척', log: 'Day 1: 부족 회의 +4CP' },
  { label: '캠프', action: 'primitive-camp', cue: 'camp', resultLabel: '캠프 작업 완료', log: 'Day 1: 모닥불 연료를 보충했습니다.', counter: 'camp' },
  { label: '부족 프로젝트', action: 'primitive-project', cue: 'project', resultLabel: '프로젝트 작업', log: 'Day 1: 공동 작업 +3' },
  { label: '직접 대응', action: 'primitive-event', cue: 'event', resultLabel: '위기 대응 완료', log: 'Day 1: 비상 배식을 실행했습니다.' },
  { label: '탐험 단서 대응', action: 'primitive-event', cue: 'event', resultLabel: '탐험 단서 처리', log: 'Day 1: 탐험 단서 대응을 완료했습니다.' },
  { label: '하루 자동 운영', action: 'primitive-day', cue: 'auto', resultLabel: '하루 자동 운영', log: 'Day 2: 하루 자동 운영 정산', day: 2 },
  { label: '행동 지역 변경', action: 'primitive-region', cue: 'confirm', resultLabel: '행동 지역 지정', log: 'Day 1: 행동 지역을 숲으로 지정했습니다.', noSpend: true },
  { label: '부족 프로젝트 지정', action: 'primitive-project', cue: 'project', resultLabel: '공동 목표 지정', log: 'Day 1: 공동 목표 프로젝트를 지정했습니다.', noSpend: true },
  { label: '직업 배치', action: 'primitive-job', cue: 'assign', resultLabel: '부족원 배치 변경', log: 'Day 1: 채집꾼 배치를 변경했습니다.', noSpend: true },
  { label: '외교', action: 'primitive-diplomacy', cue: 'diplomacy', resultLabel: '부족 외교 완료', log: 'Day 1: 경쟁 부족과 교역했습니다.', noSpend: true },
  { label: '합류', action: 'primitive-recruit', cue: 'recruit', resultLabel: '파티 합류', log: 'Day 1: 노아가 파티에 합류했습니다.', noSpend: true },
  { label: '연구 목표 변경', action: 'primitive-research', cue: 'confirm', resultLabel: '연구 목표 변경', log: 'Day 1: 연구 목표를 수렵으로 변경했습니다.', noSpend: true },
  { label: '사회 제도 목표 변경', action: 'primitive-civic', cue: 'confirm', resultLabel: '사회 제도 목표 변경', log: 'Day 1: 사회 제도 목표를 정착으로 변경했습니다.', noSpend: true },
  { label: '특전 구매', action: 'primitive-perk', cue: 'upgrade', resultLabel: '특전 구매 완료', log: 'Day 1: 생존 특전을 구매했습니다.', noSpend: true },
  { label: '자동 장착', action: 'primitive-equip', cue: 'equip', resultLabel: '추천 장비 장착', log: 'Day 1: 역할 추천 장비를 자동 장착했습니다.', noSpend: true },
  { label: '장비 해제', action: 'primitive-equip', cue: 'equip', resultLabel: '장비 해제 완료', log: 'Day 1: 장비를 모두 해제했습니다.', noSpend: true },
  { label: '장비 변경', action: 'primitive-equip', cue: 'equip', resultLabel: '장비 변경 완료', log: 'Day 1: 무기 장비를 변경했습니다.', noSpend: true },
];

for (const row of actionRows) {
  const current = clone(base);
  current.log = [row.log, ...current.log];
  if (row.day) current.day = row.day;
  else if (!row.noSpend) current.ap -= 1;
  if (row.counter) current.counters[row.counter] += 1;
  const presentation = primitiveActionResultPresentation(base, current, row.label);
  assert.equal(presentation.action, row.action, `${row.label} 결과 아이콘이 맞아야 합니다.`);
  assert.equal(presentation.cue, row.cue, `${row.label} 결과음이 맞아야 합니다.`);
  assert.equal(presentation.label, row.resultLabel, `${row.label} 결과 라벨이 맞아야 합니다.`);
  assert.equal(presentation.tone, 'success', `${row.label} 성공은 성공 톤이어야 합니다.`);
  assert.equal(presentation.detail, row.log, `${row.label} 결과에는 해당 행동 로그가 표시되어야 합니다.`);
}

const gatherFailure = clone(base);
gatherFailure.ap = 3;
gatherFailure.log = ['Day 1: 채집 실패', ...gatherFailure.log];
const gatherFailureResult = primitiveActionResultPresentation(base, gatherFailure, '채집');
assert.equal(gatherFailureResult.action, 'primitive-survival-fail', '실패는 생존 실패 아이콘을 사용해야 합니다.');
assert.equal(gatherFailureResult.cue, 'survivalFail', '실패는 전용 생존 실패음을 사용해야 합니다.');
assert.equal(gatherFailureResult.tone, 'warning', '피해 없는 실패는 경고 톤이어야 합니다.');
const huntDamage = clone(gatherFailure);
huntDamage.log = ['Day 1: 사냥 실패', ...base.log];
huntDamage.party[0].hp = 75;
assert.equal(primitiveActionFeedback(base, huntDamage, '사냥').tone, 'danger', 'HP 피해를 입은 실패는 위험 톤이어야 합니다.');

function expectMilestone(current, options, expected) {
  const result = primitiveActionResultPresentation(base, current, '하루 자동 운영', options);
  assert.equal(result.action, expected.action, `${expected.label} 이정표 아이콘이 맞아야 합니다.`);
  assert.equal(result.label, expected.label, `${expected.label} 이정표 라벨이 맞아야 합니다.`);
  assert.equal(result.outcome, 'milestone', `${expected.label}은 이정표 결과여야 합니다.`);
  assert.equal(result.cue, '', `${expected.label}은 효과 훅과 기본 행동음을 겹쳐 재생하면 안 됩니다.`);
}

expectMilestone({ ...clone(base), exploration: { discoverySerial: 1 } }, {}, { action: 'primitive-discovery', label: '새 지역 발견' });
expectMilestone({ ...clone(base), projects: { completionSerial: 1 } }, {}, { action: 'primitive-project', label: '부족 프로젝트 완성' });
expectMilestone({ ...clone(base), research: { completionSerial: 1, eureka: {} } }, {}, { action: 'primitive-research', label: '기술 연구 완료' });
expectMilestone({ ...clone(base), civics: { completionSerial: 1, inspiration: {} } }, {}, { action: 'primitive-civic', label: '사회 제도 완성' });
expectMilestone({ ...clone(base), research: { completionSerial: 0, eureka: { HUNTING: true } } }, {}, { action: 'primitive-eureka', label: '유레카 촉발' });
expectMilestone({ ...clone(base), civics: { completionSerial: 0, inspiration: { SETTLEMENT: true } } }, {}, { action: 'primitive-inspiration', label: '영감 촉발' });
expectMilestone({ ...clone(base), tribe: { growthSerial: 1 } }, {}, { action: 'primitive-growth', label: '부족 인구 성장' });
expectMilestone({ ...clone(base), diplomacy: { contactSerial: 1 } }, {}, { action: 'primitive-diplomacy', label: '새 부족 접촉' });
expectMilestone(clone(base), { previousSeasonId: 'spring', currentSeasonId: 'summer' }, { action: 'primitive-season', label: '계절 전환' });
expectMilestone(clone(base), { previousEraId: 'ANCIENT', currentEraId: 'CLASSICAL' }, { action: 'primitive-era', label: '새 시대 진입' });
expectMilestone({ ...clone(base), ended: true, victory: true }, {}, { action: 'primitive-victory', label: '아카이브 완성' });
expectMilestone({ ...clone(base), ended: true }, {}, { action: 'primitive-defeat', label: '생존 런 종료' });

const milestoneBase = primitiveMilestoneSnapshot(base, 'spring', 'ANCIENT');
assert.equal(primitiveMilestoneCue(milestoneBase, { ...milestoneBase, seasonId: 'summer' }), 'season', '계절 전환음을 선택해야 합니다.');
assert.equal(primitiveMilestoneCue(milestoneBase, { ...milestoneBase, eraId: 'CLASSICAL' }), 'eraAdvance', '시대 전환음을 선택해야 합니다.');

assert.equal(primitiveTextPresentation('매우 쉬움 난이도로 새 문명 아카이브 런을 시작했습니다.').cue, 'start', '새 런은 시작음을 사용해야 합니다.');
assert.equal(primitiveTextPresentation('로그인하면 런을 저장할 수 있습니다.').action, 'primitive-survival-fail', '비로그인 안내는 생존 실패 아이콘이어야 합니다.');
assert.equal(primitiveTextPresentation('저장된 런을 불러왔습니다.').action, 'load', '불러오기는 폴더 아이콘이어야 합니다.');
assert.equal(primitiveTextPresentation('런을 저장했습니다.').action, 'save', '저장은 저장 아이콘이어야 합니다.');
assert.equal(primitiveTextPresentation('런 결과를 전적에 기록하고 정산했습니다.').action, 'archive', '전적 정산은 기록 아이콘이어야 합니다.');

for (const cue of [
  'start', 'gather', 'combat', 'craft', 'farm', 'herd', 'fish', 'mine', 'consume', 'rest', 'research', 'policy', 'camp',
  'project', 'event', 'auto', 'assign', 'diplomacy', 'recruit', 'upgrade', 'equip',
  'survivalFail', 'champion', 'defeat', 'eraAdvance', 'projectComplete', 'civicComplete',
  'complete', 'inspiration', 'discover', 'season', 'growth',
]) {
  assert.match(soundSource, new RegExp(`\\n {2,4}${cue}: \\[`), `${cue} 결과음 프로필이 있어야 합니다.`);
}

for (const icon of [
  'primitive-camp', 'primitive-civic', 'primitive-craft', 'primitive-day', 'primitive-defeat',
  'primitive-diplomacy', 'primitive-discovery', 'primitive-equip', 'primitive-era',
  'primitive-eureka', 'primitive-event', 'primitive-gather', 'primitive-growth',
  'primitive-farm', 'primitive-herd', 'primitive-fishing', 'primitive-mining',
  'primitive-hunt', 'primitive-inspiration', 'primitive-job', 'primitive-meal',
  'primitive-perk', 'primitive-project', 'primitive-recruit', 'primitive-region',
  'primitive-research', 'primitive-rest', 'primitive-season', 'primitive-survival-fail',
  'primitive-victory',
]) {
  assert.match(iconSource, new RegExp(`\\n  '${icon}': `), `${icon} 결과 아이콘 매핑이 있어야 합니다.`);
}

for (const icon of [
  'analysis', 'archive', 'complete', 'formation', 'guide', 'inventory',
  'lock', 'logs', 'settings', 'status', 'target',
]) {
  assert.match(iconSource, new RegExp(`\\n  ${icon}: `), `${icon} 문명 아카이브 UI 아이콘 매핑이 있어야 합니다.`);
}

assert.match(playSource, /const stateRef = useRef\(state\)/, '빠른 연속 행동은 최신 상태 참조를 사용해야 합니다.');
assert.match(playSource, /const replaceState = useCallback/, '불러온 런은 상태와 이정표 기준을 함께 교체해야 합니다.');
assert.match(playSource, /primitiveActionResultPresentation\(previousState, nextState, label/, '모든 행동은 공통 결과 프레젠테이션을 계산해야 합니다.');
assert.match(playSource, /actionFeedback=\{resultPresentation\}/, '모든 기능 탭에 공통 결과 프레젠테이션을 전달해야 합니다.');
assert.match(playSource, /action="new" cue="off"/, '새 런 버튼은 시작음과 클릭음이 겹치지 않아야 합니다.');
assert.match(playSource, /action="auto" cue="off"/, '자동 운영 버튼은 결과음과 클릭음이 겹치지 않아야 합니다.');
assert.match(playSource, /useGameSfx\(\{ theme: 'civilization' \}\)/, '플레이 화면은 문명 전용 효과음 테마를 사용해야 합니다.');
assert.match(audioThemeSource, /\['primitive-archive', 'civilization'\]/, '문명 아카이브 라우트는 문명 전용 효과음 테마에 매핑되어야 합니다.');

for (const source of [actionSource, campSource, growthSource, projectSource, tribeSource, inventorySource]) {
  assert.match(source, /actionFeedback\?\.label/, '행동이 있는 탭은 동적 결과 라벨을 표시해야 합니다.');
  assert.match(source, /actionFeedback\?\.tone/, '행동이 있는 탭은 동적 결과 톤을 표시해야 합니다.');
}
assert.match(actionSource, /action="research" cue="off"/, '연구 버튼은 결과음과 클릭음이 겹치지 않아야 합니다.');
assert.match(campSource, /action="event" cue="off"/, '탐험 사건 버튼은 결과음과 클릭음이 겹치지 않아야 합니다.');
assert.match(projectSource, /action="project"\s+cue="off"/, '프로젝트 작업은 결과음과 클릭음이 겹치지 않아야 합니다.');
assert.match(tribeSource, /data-game-sfx="off"/, '직업 배치 스테퍼는 배치 결과음만 재생해야 합니다.');
assert.match(inventorySource, /action="equip" cue="off"/, '자동 장착은 장비 결과음만 재생해야 합니다.');
assert.match(primitiveSource, /SmallStat\(\{ icon = '', label, value \}\)/, '소형 통계는 의미 아이콘을 지원해야 합니다.');
assert.equal([...campSource.matchAll(/<SmallStat icon=/g)].length >= 14, true, '캠프와 런 리포트에 최소 14개 의미 아이콘이 필요합니다.');
assert.equal([...reportSource.matchAll(/<SmallStat icon=/g)].length >= 11, true, '기록서 요약에 최소 11개 의미 아이콘이 필요합니다.');
assert.match(reportSource, /CHAPTER_ICONS/, '기록서 챕터마다 의미 아이콘을 선택해야 합니다.');
assert.equal([...reportSource.matchAll(/game-save-row game-save-row--icon/g)].length >= 2, true, '인계와 챕터 행에 아이콘 레이아웃이 필요합니다.');

const semanticSources = [
  actionSource,
  campSource,
  growthSource,
  inventorySource,
  partySource,
  projectSource,
  reportSource,
  researchPreviewSource,
  runSource,
  tribeSource,
  turnHorizonSource,
  worldMapSource,
].join('\n');
const semanticPanelTitles = [...semanticSources.matchAll(/<PrimitiveArchivePanelTitle\b/g)].length;
const semanticIconRows = [...semanticSources.matchAll(/<PrimitiveArchiveIconRow\b/g)].length;
assert.equal(semanticPanelTitles, 27, '문명 아카이브 패널 제목 27개가 의미 아이콘을 사용해야 합니다.');
assert.equal(semanticIconRows, 6, '문명 아카이브 핵심 정보 행 6개가 의미 아이콘을 사용해야 합니다.');
assert.doesNotMatch(semanticSources, /className="games-panel-title"/, '아이콘 없는 원시 패널 제목을 남기면 안 됩니다.');
assert.doesNotMatch(semanticSources, /className="game-save-row"/, '아이콘 없는 원시 핵심 정보 행을 남기면 안 됩니다.');
assert.match(visualSource, /export function PrimitiveArchivePanelTitle/, '문명 아카이브 공통 패널 제목 컴포넌트가 필요합니다.');
assert.match(visualSource, /export function PrimitiveArchiveIconRow/, '문명 아카이브 공통 정보 행 컴포넌트가 필요합니다.');
assert.match(visualSource, /export function primitiveItemAction/, '인벤토리 항목 종류별 아이콘 선택기가 필요합니다.');
assert.match(styleSource, /\.primitive-archive-panel-title__copy/, '패널 제목 아이콘 레이아웃 스타일이 필요합니다.');
assert.match(styleSource, /\.game-save-row\.primitive-archive-icon-row/, '정보 행 아이콘 레이아웃 스타일이 필요합니다.');
assert.match(styleSource, /\.primitive-archive-icon-row\.is-locked/, '잠긴 발전 후보의 시각 상태가 필요합니다.');

const resultPanels = [actionSource, campSource, growthSource, projectSource, tribeSource, inventorySource]
  .reduce((sum, source) => sum + [...source.matchAll(/<RecentActionResult\b/g)].length, 0);
assert.equal(resultPanels, 7, '행동 화면 전반에 7개 결과 패널이 있어야 합니다.');

console.log(JSON.stringify({
  actionProfiles: actionRows.length,
  milestoneProfiles: 12,
  resultPanels,
  semanticIconRows,
  semanticPanelTitles,
  semanticStatIcons: 25,
  latestStateWrapper: true,
}, null, 2));
