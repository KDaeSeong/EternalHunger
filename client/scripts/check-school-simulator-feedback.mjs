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
  return {
    stress: 40,
    health: 80,
    satisfaction: 70,
    understanding: 50,
    careerReadiness: 45,
    ...overrides,
  };
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
      admissions: { brandAwareness: 50 },
    },
    player: { burnoutRisk: 20, weeklyActionPoint: 7, energy: 72, mental: 68 },
    students: [student(), student(), student()],
    teachers: [{ fatigue: 45, morale: 65 }],
    facilities: [{ condition: 70 }],
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

const impactBase = schoolState({
  students: [
    student({ stress: 72, satisfaction: 58, understanding: 48 }),
    student({ stress: 70, satisfaction: 60, understanding: 50 }),
    student({ stress: 68, satisfaction: 62, understanding: 52 }),
  ],
  log: ['운영 준비'],
});
const impactNext = schoolState({
  school: { budget: 11750 },
  player: { burnoutRisk: 20, weeklyActionPoint: 5, energy: 70, mental: 67 },
  students: [
    student({ stress: 62, satisfaction: 64, understanding: 54 }),
    student({ stress: 60, satisfaction: 66, understanding: 56 }),
    student({ stress: 58, satisfaction: 68, understanding: 58 }),
  ],
  log: ['상담 강화 행동을 실행했습니다.'],
});
const impactRows = feedback.schoolFeedbackImpacts(impactBase, impactNext);
assert.deepEqual(
  impactRows.map((row) => row.label),
  ['위험 학생', '평균 이해', '평균 만족', '예산'],
  '핵심 학생 변화 3개와 운영 비용 1개를 우선 표시해야 합니다.',
);
assert.equal(impactRows[0].value, '-3명');
assert.equal(impactRows[0].tone, 'success');
assert.equal(impactRows[3].value, '-250');
assert.ok(impactRows.length <= 4, '행동 변화량은 최대 4칸이어야 합니다.');

const teacherImpacts = feedback.schoolFeedbackImpacts(
  schoolState({ teachers: [{ fatigue: 72, morale: 48 }], log: ['운영 준비'] }),
  schoolState({
    school: { budget: 11800 },
    player: { burnoutRisk: 20, weeklyActionPoint: 6, energy: 72, mental: 68 },
    teachers: [{ fatigue: 58, morale: 56 }],
    log: ['김하늘 교사에게 역량 연수를 적용했습니다.'],
  }),
);
assert.deepEqual(teacherImpacts.slice(0, 2).map((row) => row.label), ['교사 사기', '교사 피로']);
assert.ok(teacherImpacts.slice(0, 2).every((row) => row.tone === 'success'));

const maintenanceImpacts = feedback.schoolFeedbackImpacts(
  schoolState({ facilities: [{ condition: 54 }], log: ['운영 준비'] }),
  schoolState({ facilities: [{ condition: 66 }], log: ['시설 점검 / 보수 행동을 실행했습니다.'] }),
);
assert.equal(maintenanceImpacts[0].label, '시설 상태');
assert.equal(maintenanceImpacts[0].value, '+12');

const noMetricImpacts = feedback.schoolFeedbackImpacts(
  base,
  schoolState({ log: ['생활 지도 행동을 실행했습니다.'] }),
);
assert.deepEqual(noMetricImpacts, [{
  action: 'school-operation',
  label: '운영 실행',
  value: '수치 변화 없음',
  tone: 'success',
}]);
assert.deepEqual(feedback.schoolFeedbackImpacts(base, schoolState({ runId: 'school-b' })), []);

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

const schoolThemeMatch = sfxSource.match(/\n  school: \{([\s\S]*?)\n  \},\n  coding: \{/);
assert.ok(schoolThemeMatch, '학교 전용 사운드 테마를 찾을 수 있어야 합니다.');
const schoolThemeSource = schoolThemeMatch[1];
let layeredCueCount = 0;
for (const [action, cueId] of dedicatedProfiles) {
  assert.match(iconSource, new RegExp(`['"]${action}['"]\\s*:`), `${action} 전용 아이콘이 등록되어야 합니다.`);
  const cueMatch = schoolThemeSource.match(new RegExp(`\\n\\s*${cueId}\\s*:\\s*\\[([\\s\\S]*?)\\n\\s*\\]`));
  assert.ok(cueMatch, `${cueId}가 학교 테마 안에 등록되어야 합니다.`);
  assert.ok((cueMatch[1].match(/\{/g) || []).length >= 3, `${cueId}는 3개 이상의 레이어를 사용해야 합니다.`);
  layeredCueCount += 1;
}
const schoolNoiseLayerCount = (schoolThemeSource.match(/source: 'noise'/g) || []).length;
const schoolReverbLayerCount = (schoolThemeSource.match(/reverb:/g) || []).length;
assert.ok(schoolNoiseLayerCount >= 20, '학교 테마는 행동별 질감을 위한 노이즈 레이어를 충분히 사용해야 합니다.');
assert.ok(schoolReverbLayerCount >= 24, '학교 테마는 공간감을 위한 잔향 레이어를 충분히 사용해야 합니다.');

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
assert.match(visualSource, /export function SchoolSimulatorImpactStrip/);
assert.match(visualSource, /aria-label="최근 학교 운영 변화량"/);
assert.match(styleSource, /\.school-panel-title h2/);
assert.match(styleSource, /\.game-save-row\.school-icon-row/);
assert.match(styleSource, /\.school-impact-strip/);
assert.match(styleSource, /\.school-impact-chip\.is-success/);

for (const action of ['advisor', 'guide', 'analysis', 'audio', 'players', 'archive', 'logs']) {
  assert.match(iconSource, new RegExp(`\\n\\s*${action}\\s*:`), `${action} 공통 아이콘이 등록되어 있어야 합니다.`);
}

assert.match(resultSource, /action=\{resultPresentation\?\.action/);
assert.match(resultSource, /tone=\{resultPresentation\?\.tone/);
assert.match(pageSource, /<GameControlButton action="new" cue="off"/);
assert.match(pageSource, /if \(presentation\.cue\) playGameSfx\(presentation\.cue\)/);
assert.match(pageSource, /schoolFeedbackImpacts\(previousState, nextState\)/);
assert.match(pageSource, /<SchoolSimulatorImpactStrip items=\{resultImpacts\} \/>/);
assert.match(pageSource, /onLoaded: \(nextState\) => \{[\s\S]*?stateRef\.current = nextState;[\s\S]*?setResultImpacts\(\[\]\)/);

console.log(JSON.stringify({
  transitions: dedicatedProfiles.length,
  dedicatedCues: dedicatedProfiles.length,
  dedicatedIcons: dedicatedProfiles.length,
  schoolThemeCues: layeredCueCount,
  schoolNoiseLayers: schoolNoiseLayerCount,
  schoolReverbLayers: schoolReverbLayerCount,
  impactRows: impactRows.length,
  contextualResultPanels: localResultCount + 1,
  semanticPanelTitles: semanticPanelTitleCount,
  semanticIconRows: semanticIconRowCount,
  singleResultCueControls: true,
}, null, 2));
