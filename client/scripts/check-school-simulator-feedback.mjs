import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const sourceUrl = new URL('../src/app/games/school-simulator/_lib/schoolSimulatorFeedback.js', import.meta.url);
const iconSourceUrl = new URL('../src/app/games/_components/GameActionIcon.js', import.meta.url);
const sfxSourceUrl = new URL('../src/app/games/_lib/useGameSfx.js', import.meta.url);
const resultSourceUrl = new URL('../src/app/games/school-simulator/_components/SchoolSimulatorActionResult.js', import.meta.url);
const pageSourceUrl = new URL('../src/app/games/school-simulator/play/page.js', import.meta.url);
const visualSourceUrl = new URL('../src/app/games/school-simulator/_components/SchoolSimulatorVisuals.js', import.meta.url);
const helperSourceUrl = new URL('../src/app/games/school-simulator/_lib/schoolSimulatorPlayHelpers.js', import.meta.url);
const styleSourceUrl = new URL('../src/styles/AppShell.css', import.meta.url);
const componentSourceUrls = [
  new URL('../src/app/games/school-simulator/_components/SchoolSimulatorFeatureTabs.js', import.meta.url),
  new URL('../src/app/games/school-simulator/_components/SchoolSimulatorAdvancedOperations.js', import.meta.url),
  new URL('../src/app/games/school-simulator/_components/SchoolSimulatorAdvancedPeople.js', import.meta.url),
  new URL('../src/app/games/school-simulator/_components/SchoolSimulatorAdvancedVisionEvents.js', import.meta.url),
  new URL('../src/app/games/school-simulator/_components/SchoolSimulatorAdvancedReports.js', import.meta.url),
];

const [
  source,
  iconSource,
  sfxSource,
  resultSource,
  pageSource,
  visualSource,
  helperSource,
  styleSource,
  ...componentSources
] = await Promise.all([
  readFile(sourceUrl, 'utf8'),
  readFile(iconSourceUrl, 'utf8'),
  readFile(sfxSourceUrl, 'utf8'),
  readFile(resultSourceUrl, 'utf8'),
  readFile(pageSourceUrl, 'utf8'),
  readFile(visualSourceUrl, 'utf8'),
  readFile(helperSourceUrl, 'utf8'),
  readFile(styleSourceUrl, 'utf8'),
  ...componentSourceUrls.map((url) => readFile(url, 'utf8')),
]);
const moduleUrl = `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const feedback = await import(moduleUrl);

function student(overrides = {}) {
  return { stress: 40, health: 80, satisfaction: 70, ...overrides };
}

function schoolState(overrides = {}) {
  const base = {
    runId: 'school-a',
    school: {
      year: 1,
      semester: 1,
      week: 3,
      budget: 12000,
      policyPreset: 'balanced',
      riskLevel: 20,
      festival: { active: null, history: [] },
    },
    player: { burnoutRisk: 20 },
    students: [student(), student(), student()],
    events: { pending: null, history: [] },
    semesterHistory: [],
    log: ['운영 준비'],
  };
  return {
    ...base,
    ...overrides,
    school: { ...base.school, ...(overrides.school || {}) },
    player: { ...base.player, ...(overrides.player || {}) },
    events: { ...base.events, ...(overrides.events || {}) },
  };
}

const base = schoolState();
const transition = (next) => feedback.schoolFeedbackTransition(base, next);
const cue = (next) => feedback.schoolActionCue(base, next);
const presentation = (next) => feedback.schoolActionPresentation(base, next);

const structuralCases = [
  {
    name: '새 학교',
    state: schoolState({ runId: 'school-b' }),
    transition: 'newRun',
    cue: 'schoolNewRun',
    action: 'school-new',
  },
  {
    name: '학기 전환',
    state: schoolState({ school: { semester: 2, week: 1 }, semesterHistory: [{ id: 'term-1' }] }),
    transition: 'semester',
    cue: 'schoolSemester',
    action: 'school-semester',
  },
  {
    name: '행사 시작',
    state: schoolState({ school: { festival: { active: { id: 'arts' }, history: [] } } }),
    transition: 'festivalStart',
    cue: 'schoolFestivalStart',
    action: 'school-festival-start',
  },
  {
    name: '행사 완료',
    state: schoolState({ school: { festival: { active: null, history: [{ id: 'arts' }] } } }),
    transition: 'festivalComplete',
    cue: 'schoolFestivalComplete',
    action: 'school-festival-complete',
  },
  {
    name: '사건 발생',
    state: schoolState({ events: { pending: { id: 'incident-1' }, history: [] } }),
    transition: 'incident',
    cue: 'schoolIncident',
    action: 'school-incident',
  },
  {
    name: '사건 해결',
    state: schoolState({ events: { pending: null, history: [{ id: 'incident-1' }] } }),
    transition: 'incidentResolved',
    cue: 'schoolResolution',
    action: 'school-resolution',
  },
  {
    name: '운영 경보',
    state: schoolState({ school: { budget: -1 } }),
    transition: 'crisis',
    cue: 'schoolCrisis',
    action: 'school-crisis',
  },
  {
    name: '정책 변경',
    state: schoolState({ school: { policyPreset: 'academic' } }),
    transition: 'policy',
    cue: 'schoolPolicy',
    action: 'school-policy',
  },
  {
    name: '새 주차',
    state: schoolState({ school: { week: 4 } }),
    transition: 'week',
    cue: 'schoolBell',
    action: 'school-week',
  },
  {
    name: '실행 불가',
    state: schoolState({ log: ['AP가 부족합니다.'] }),
    transition: 'blocked',
    cue: 'schoolBlocked',
    action: 'school-blocked',
  },
];

for (const row of structuralCases) {
  assert.equal(transition(row.state), row.transition, `${row.name} 전환을 구분해야 합니다.`);
  assert.equal(cue(row.state), row.cue, `${row.name} 전용 효과음을 사용해야 합니다.`);
  assert.equal(presentation(row.state).action, row.action, `${row.name} 전용 아이콘을 사용해야 합니다.`);
}

const riskBase = schoolState({
  students: [student({ stress: 80 }), student({ health: 30 }), student()],
});
const recovered = schoolState();
assert.equal(feedback.schoolFeedbackTransition(riskBase, recovered), 'recovery');
assert.equal(feedback.schoolActionCue(riskBase, recovered), 'schoolRecovery');
assert.equal(feedback.schoolActionPresentation(riskBase, recovered).action, 'school-recovery');

const actionCases = [
  ['상담 지원', '상담 강화 행동을 실행했습니다.', 'counseling', 'schoolCounseling', 'school-counseling'],
  ['수업 운영', '국어 수업 방식을 발표형으로 조정했습니다.', 'lesson', 'schoolLesson', 'school-lesson'],
  ['시설 정비', '시설 점검 / 보수 행동을 실행했습니다.', 'maintenance', 'schoolMaintenance', 'school-maintenance'],
  ['교사 지원', '김하늘 교사에게 역량 연수를 적용했습니다.', 'teacher', 'schoolTeacher', 'school-teacher'],
  ['입학 홍보', '지역 홍보 캠페인을 진행했습니다.', 'admission', 'schoolAdmission', 'school-admission'],
  ['진로 지도', '인문 트랙 진로 상담을 진행했습니다.', 'career', 'schoolCareer', 'school-career'],
  ['동아리 운영', '신규 모집으로 3명이 합류했습니다.', 'club', 'schoolClub', 'school-club'],
  ['운영진 회복', '짧은 휴식을 취했습니다.', 'rest', 'schoolRest', 'school-rest'],
  ['학교 비전', '장기 학교 비전을 자율 성장으로 설정했습니다.', 'vision', 'schoolVision', 'school-vision'],
  ['일반 운영', '생활 지도 행동을 실행했습니다.', 'action', 'schoolOperation', 'school-operation'],
];

for (const [name, log, expectedTransition, expectedCue, expectedAction] of actionCases) {
  const next = schoolState({ log: [log] });
  assert.equal(transition(next), expectedTransition, `${name} 로그를 구분해야 합니다.`);
  assert.equal(cue(next), expectedCue, `${name} 전용 효과음을 사용해야 합니다.`);
  assert.equal(presentation(next).action, expectedAction, `${name} 전용 아이콘을 사용해야 합니다.`);
}

assert.equal(feedback.schoolResultPresentation('예산이 부족합니다.').tone, 'warning');
assert.equal(feedback.schoolResultPresentation('School Simulator 진행 상태를 저장했습니다.').action, 'save');
assert.equal(feedback.schoolResultPresentation('저장된 진행 상태를 불러왔습니다.').action, 'load');

const dedicatedProfiles = [
  ['school-new', 'schoolNewRun'],
  ['school-semester', 'schoolSemester'],
  ['school-festival-complete', 'schoolFestivalComplete'],
  ['school-festival-start', 'schoolFestivalStart'],
  ['school-incident', 'schoolIncident'],
  ['school-resolution', 'schoolResolution'],
  ['school-crisis', 'schoolCrisis'],
  ['school-recovery', 'schoolRecovery'],
  ['school-policy', 'schoolPolicy'],
  ['school-week', 'schoolBell'],
  ['school-blocked', 'schoolBlocked'],
  ['school-counseling', 'schoolCounseling'],
  ['school-lesson', 'schoolLesson'],
  ['school-maintenance', 'schoolMaintenance'],
  ['school-teacher', 'schoolTeacher'],
  ['school-admission', 'schoolAdmission'],
  ['school-career', 'schoolCareer'],
  ['school-club', 'schoolClub'],
  ['school-rest', 'schoolRest'],
  ['school-vision', 'schoolVision'],
  ['school-operation', 'schoolOperation'],
];

for (const [action, cueId] of dedicatedProfiles) {
  assert.match(iconSource, new RegExp(`['"]${action}['"]\\s*:`), `${action} 전용 아이콘이 등록되어야 합니다.`);
  assert.match(sfxSource, new RegExp(`\\n\\s*${cueId}\\s*:`), `${cueId} 전용 효과음이 등록되어야 합니다.`);
}

for (const [index, componentSource] of componentSources.entries()) {
  const actionButtonCount = (componentSource.match(/<ActionButton\b/g) || []).length;
  const cueOffCount = (componentSource.match(/cue="off"/g) || []).length;
  const expectedControlCueCount = index === 0 ? 2 : 0;
  assert.equal(
    cueOffCount,
    actionButtonCount + expectedControlCueCount,
    `학교 상태 변경 버튼은 결과 효과음만 재생해야 합니다: ${componentSourceUrls[index].pathname}`,
  );
}

const localResultCount = componentSources
  .reduce((sum, componentSource) => sum + (componentSource.match(/<SchoolSimulatorActionResult\b/g) || []).length, 0);
assert.equal(localResultCount, 18, '모든 학교 기능 패널이 행동별 결과 아이콘을 공유해야 합니다.');
const semanticSources = [...componentSources, helperSource].join('\n');
const semanticPanelTitleCount = (semanticSources.match(/<SchoolSimulatorPanelTitle\b/g) || []).length;
const semanticIconRowCount = (semanticSources.match(/<SchoolSimulatorIconRow\b/g) || []).length;
assert.equal(semanticPanelTitleCount, 51, '학교 기능 제목 51곳에 의미 아이콘이 있어야 합니다.');
assert.equal(semanticIconRowCount, 20, '학교 상태 정보 행 20곳에 의미 아이콘이 있어야 합니다.');
assert.doesNotMatch(semanticSources, /className="games-panel-title"/, '학교 기능 제목에 원시 제목 마크업이 남아 있으면 안 됩니다.');
assert.doesNotMatch(semanticSources, /className="game-save-row"/, '학교 상태 정보에 원시 행 마크업이 남아 있으면 안 됩니다.');
assert.match(visualSource, /export function SchoolSimulatorPanelTitle/);
assert.match(visualSource, /export function SchoolSimulatorIconRow/);
assert.match(styleSource, /\.school-panel-title h2/);
assert.match(styleSource, /\.game-save-row\.school-icon-row/);

for (const action of ['advisor', 'guide', 'analysis', 'audio', 'players', 'archive', 'logs']) {
  assert.match(iconSource, new RegExp(`\\n\\s*${action}\\s*:`), `${action} 공통 아이콘이 등록되어 있어야 합니다.`);
}

assert.match(resultSource, /action=\{resultPresentation\?\.action/);
assert.match(resultSource, /tone=\{resultPresentation\?\.tone/);
assert.match(pageSource, /<GameControlButton action="new" cue="off"/);
assert.match(pageSource, /if \(presentation\.cue\) playGameSfx\(presentation\.cue\)/);

console.log(JSON.stringify({
  transitions: dedicatedProfiles.length,
  dedicatedCues: dedicatedProfiles.length,
  dedicatedIcons: dedicatedProfiles.length,
  contextualResultPanels: localResultCount + 1,
  semanticPanelTitles: semanticPanelTitleCount,
  semanticIconRows: semanticIconRowCount,
  singleResultCueControls: true,
}, null, 2));
