import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const sourceUrl = new URL('../src/app/games/school-simulator/_lib/schoolSimulatorFeedback.js', import.meta.url);
const source = await readFile(sourceUrl, 'utf8');
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

assert.equal(transition(schoolState({ runId: 'school-b' })), 'newRun');
assert.equal(cue(schoolState({ runId: 'school-b' })), 'start');

const semester = schoolState({
  school: { semester: 2, week: 1 },
  semesterHistory: [{ id: 'term-1' }],
});
assert.equal(transition(semester), 'semester');
assert.equal(cue(semester), 'semester');

assert.equal(transition(schoolState({
  school: { festival: { active: { id: 'arts' }, history: [] } },
})), 'festivalStart');
assert.equal(transition(schoolState({
  school: { festival: { active: null, history: [{ id: 'arts' }] } },
})), 'festivalComplete');

assert.equal(cue(schoolState({
  events: { pending: { id: 'incident-1' }, history: [] },
})), 'schoolIncident');
assert.equal(cue(schoolState({
  events: { pending: null, history: [{ id: 'incident-1' }] },
})), 'schoolResolution');

assert.equal(cue(schoolState({ school: { budget: -1 } })), 'schoolCrisis');
assert.equal(cue(schoolState({ school: { policyPreset: 'academic' } })), 'policy');
assert.equal(cue(schoolState({ school: { week: 4 } })), 'schoolBell');

const riskBase = schoolState({
  students: [student({ stress: 80 }), student({ health: 30 }), student()],
});
const recovered = schoolState();
assert.equal(feedback.schoolFeedbackTransition(riskBase, recovered), 'recovery');
assert.equal(feedback.schoolActionCue(riskBase, recovered), 'schoolRecovery');

const blocked = schoolState({ log: ['AP가 부족합니다.'] });
assert.equal(transition(blocked), 'blocked');
assert.equal(feedback.schoolResultPresentation('예산이 부족합니다.').tone, 'warning');
assert.equal(feedback.schoolResultPresentation('School Simulator 진행 상태를 저장했습니다.').action, 'save');
assert.equal(feedback.schoolResultPresentation('저장된 진행 상태를 불러왔습니다.').action, 'load');

console.log(JSON.stringify({
  transitions: 10,
  dedicatedCues: 5,
  contextualResultIcons: true,
}, null, 2));
